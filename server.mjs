import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.FM2_DB_PATH || path.join(__dirname, "data", "plantation-financial-model.db.json");
const cpoCachePath = path.join(__dirname, "public-cpo-data.json");
const publicRoot = __dirname;
const port = Number(process.env.PORT || 4173);
const pythonPath = process.env.PYTHON || "python3";
const brandLogoDir = path.join(__dirname, "public");
const mirroredBrandLogoDir = path.join(__dirname, "public", "fm", "public");
const authUser = process.env.FM2_AUTH_USER || "finance";
const authPassword = process.env.FM2_AUTH_PASSWORD || "Finance@123";
const authSecret = process.env.FM2_AUTH_SECRET || "fm2-change-this-secret";
const authCookieName = "fm2_session";
const sessionTtlMs = 12 * 60 * 60 * 1000;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const publicIconPaths = new Set([
  "/favicon.ico",
  "/public/agrinexus-favicon-32.png",
  "/public/apple-touch-icon.png",
  "/public/agrinexus-icon-192.png",
  "/public/agrinexus-icon-512.png",
  "/public/favicon.svg",
  "/public/fm/public/agrinexus-favicon-32.png",
  "/public/fm/public/apple-touch-icon.png",
  "/public/fm/public/agrinexus-icon-192.png",
  "/public/fm/public/agrinexus-icon-512.png",
  "/public/fm/public/favicon.svg",
]);

async function readDb() {
  return JSON.parse(await fs.readFile(dbPath, "utf8"));
}

async function writeDb(db) {
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2) + "\n");
}

function bodyBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === "string") return Buffer.from(body);
  return Buffer.from(JSON.stringify(body));
}

function isCompressible(contentType) {
  return /json|text|javascript|css|svg|csv|html/.test(contentType);
}

function send(req, res, status, body, contentType = "application/json; charset=utf-8", options = {}) {
  let payload = bodyBuffer(body);
  const etag = `"${crypto.createHash("sha1").update(payload).digest("hex")}"`;
  const cacheControl = options.cacheControl ?? (req.method === "GET" && status === 200 ? "private, max-age=30, stale-while-revalidate=120" : "no-store");
  if (req.method === "GET" && req.headers["if-none-match"] === etag) {
    res.writeHead(304, {
      ETag: etag,
      "Cache-Control": cacheControl,
    });
    return res.end();
  }
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    ETag: etag,
  };
  if (payload.length > 1024 && isCompressible(contentType) && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
    payload = zlib.gzipSync(payload);
    headers["Content-Encoding"] = "gzip";
    headers.Vary = "Accept-Encoding";
  }
  res.writeHead(status, headers);
  res.end(payload);
}

function notFound(req, res) {
  send(req, res, 404, { message: "Not found" });
}

function badRequest(req, res, message) {
  send(req, res, 400, { message });
}

function decodeBrandLogoDataUrl(value) {
  const match = String(value || "").match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const extension = match[1].toLowerCase().replace("jpeg", "jpg");
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length < 128 || buffer.length > 3 * 1024 * 1024) return null;
  const isPng = extension === "png" && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpg = extension === "jpg" && buffer[0] === 0xff && buffer[1] === 0xd8;
  const isWebp = extension === "webp" && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return isPng || isJpg || isWebp ? { buffer, extension } : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function timingSafeTextEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(header = "") {
  return Object.fromEntries(
    String(header)
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index < 0) return [part, ""];
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function sessionSignature(payload) {
  return crypto.createHmac("sha256", authSecret).update(payload).digest("base64url");
}

function createSessionToken(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + sessionTtlMs })).toString("base64url");
  return `${payload}.${sessionSignature(payload)}`;
}

function hasValidSession(req) {
  const token = parseCookies(req.headers.cookie)[authCookieName];
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !timingSafeTextEqual(signature, sessionSignature(payload))) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.userId === authUser && Number(session.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

function cookieOptions(req, maxAgeSeconds = Math.floor(sessionTtlMs / 1000)) {
  const secure = req.headers["x-forwarded-proto"] === "https" || String(req.headers.host || "").includes("fm2.digitalpalm.ai");
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

function safeReturnTo(value) {
  const text = String(value || "/app");
  if (text === "/") return "/app";
  if (!text.startsWith("/") || text.startsWith("//")) return "/app";
  if (text.startsWith("/login") || text.startsWith("/logout")) return "/app";
  return text;
}

async function requestBodyText(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function loginHtml(errorMessage = "", returnTo = "/") {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Financial Model 2 Login</title>
    <link rel="icon" type="image/png" sizes="32x32" href="/public/agrinexus-favicon-32.png?v=6" />
    <link rel="apple-touch-icon" sizes="180x180" href="/public/apple-touch-icon.png?v=6" />
    <style>
      :root { color-scheme: light; font-family: Inter, Arial, sans-serif; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        background: #f4f7fb;
        color: #172033;
      }
      main {
        width: min(420px, calc(100vw - 32px));
        background: #ffffff;
        border: 1px solid #d9e1ec;
        border-radius: 8px;
        box-shadow: 0 18px 50px rgba(23, 32, 51, 0.12);
        padding: 32px;
      }
      h1 { margin: 0 0 8px; font-size: 24px; }
      p { margin: 0 0 24px; color: #667085; line-height: 1.5; }
      label { display: grid; gap: 8px; margin-bottom: 16px; font-weight: 700; font-size: 13px; }
      input {
        box-sizing: border-box;
        width: 100%;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 12px 14px;
        font: inherit;
      }
      input:focus { outline: 3px solid rgba(24, 119, 242, 0.18); border-color: #1877f2; }
      button {
        width: 100%;
        border: 0;
        border-radius: 6px;
        padding: 13px 16px;
        background: #123a6f;
        color: #fff;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }
      .error {
        margin: 0 0 16px;
        padding: 10px 12px;
        border-radius: 6px;
        background: #fef3f2;
        color: #b42318;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Financial Model 2</h1>
      <p>Sign in to access the seeded plantation financial model.</p>
      ${errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : ""}
      <form method="post" action="/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}">
        <label>User ID<input name="userid" autocomplete="username" required autofocus /></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
        <button type="submit">Sign in</button>
      </form>
    </main>
  </body>
</html>`;
}

function sendLoginPage(req, res, status = 200, errorMessage = "", returnTo = "/") {
  send(req, res, status, loginHtml(errorMessage, returnTo), "text/html; charset=utf-8", { cacheControl: "no-store" });
}

async function handleLogin(req, res, url) {
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  if (req.method === "GET") return sendLoginPage(req, res, 200, "", returnTo);
  if (req.method !== "POST") return notFound(req, res);

  const body = new URLSearchParams(await requestBodyText(req));
  const userId = body.get("userid") || body.get("userId") || body.get("username") || "";
  const password = body.get("password") || "";
  if (!timingSafeTextEqual(userId, authUser) || !timingSafeTextEqual(password, authPassword)) {
    return sendLoginPage(req, res, 401, "Invalid user ID or password.", returnTo);
  }

  res.writeHead(303, {
    Location: returnTo,
    "Set-Cookie": `${authCookieName}=${encodeURIComponent(createSessionToken(authUser))}; ${cookieOptions(req)}`,
    "Cache-Control": "no-store",
  });
  res.end();
}

function handleLogout(req, res) {
  res.writeHead(303, {
    Location: "/",
    "Set-Cookie": `${authCookieName}=; ${cookieOptions(req, 0)}`,
    "Cache-Control": "no-store",
  });
  res.end();
}

function calculateOutputs(model) {
  const m = model.metrics;
  const committedSources = Number(m.committedSources || 0);
  const totalDevelopmentExpenditure = Number(m.totalDevelopmentExpenditure || 0);
  const fundingShortfall = committedSources - totalDevelopmentExpenditure;
  const debt = 0;
  const equity = committedSources;
  const totalAssets = totalDevelopmentExpenditure;
  const currentAssets = Number(m.augCurrentCashBalance || 0);
  const currentLiabilities = Math.max(Math.abs(fundingShortfall), 1);
  const ratios = {
    fundingCoverage: totalDevelopmentExpenditure ? committedSources / totalDevelopmentExpenditure : 0,
    fundingGapRatio: totalDevelopmentExpenditure ? fundingShortfall / totalDevelopmentExpenditure : 0,
    debtToEquity: equity ? debt / equity : 0,
    currentRatio: currentAssets / currentLiabilities,
    costPerHa: Number(m.costPerHa || 0),
    irr: Number(m.nominalAfterTaxIrr || 0),
    npv: Number(m.nominalAfterTaxNpvAtWacc || 0),
    paybackYears: Number(m.paybackYears || 0),
  };
  const ifrsReports = {
    cashFlow: [
      { line: "Opening cash and bank balances", amountUsd: Number(m.augCurrentCashBalance || 0) },
      { line: "Operating and development cash requirement", amountUsd: -Math.abs(totalDevelopmentExpenditure) },
      { line: "Committed funding sources", amountUsd: committedSources },
      { line: "Closing funding surplus / (shortfall)", amountUsd: fundingShortfall },
    ],
    balanceSheet: [
      { line: "Total assets under development", amountUsd: totalAssets },
      { line: "Cash and cash equivalents", amountUsd: currentAssets },
      { line: "Debt funding", amountUsd: debt },
      { line: "Equity and committed sources", amountUsd: equity },
      { line: "Funding surplus / (shortfall)", amountUsd: fundingShortfall },
    ],
    profitability: [
      { line: "Nominal after-tax IRR", value: ratios.irr },
      { line: "NPV @ WACC", amountUsd: ratios.npv },
      { line: "Payback period", value: ratios.paybackYears },
    ],
  };
  return { metrics: { ...m, fundingShortfall }, ratios, ifrsReports };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function updateWorksheetCell(table, address, value) {
  if (!table || table.kind !== "worksheet-grid") return false;
  for (const row of table.rows || []) {
    const cell = (row.cells || []).find((item) => item.address === address);
    if (!cell) continue;
    cell.value = value;
    if (Number.isFinite(Number(value))) {
      const style = new Set(String(cell.style || "").split(/\s+/).filter(Boolean));
      style.add("number");
      if (Number(value) < 0) style.add("negative");
      else style.delete("negative");
      cell.style = Array.from(style).join(" ");
    }
    return true;
  }
  return false;
}

function updateScheduleTotal(table, label, value) {
  if (!table || table.kind !== "projection-schedule") return false;
  const target = String(label).trim().toLowerCase();
  const row = (table.rows || []).find((item) => String(item.label || "").trim().toLowerCase() === target);
  if (!row) return false;
  row.total = value;
  return true;
}

function updateScheduleEscalatedRow(table, label, baseValue, movementLabel) {
  if (!table || table.kind !== "projection-schedule") return false;
  const target = String(label).trim().toLowerCase();
  const row = (table.rows || []).find((item) => String(item.label || "").trim().toLowerCase() === target);
  if (!row) return false;
  const movementRow = (table.rows || []).find(
    (item) => String(item.label || "").trim().toLowerCase() === String(movementLabel || "").trim().toLowerCase()
  );
  const movement = Number(movementRow?.total || 0);
  const base = Number(baseValue);
  if (!Number.isFinite(base)) return false;
  row.total = base;
  row.values = (row.values || []).map((_value, index) => base * Math.pow(1 + movement, index + 1));
  return true;
}

function applyInputReportLinks(db, projectId, item) {
  const links = item.reportLinks || [];
  if (!links.length) return;
  const tableByName = new Map(
    (db.reportTables || [])
      .filter((table) => table.projectId === projectId)
      .map((table) => [table.sheetName, table])
  );
  for (const link of links) {
    const table = tableByName.get(link.sheetName);
    if (!table) continue;
    if (link.type === "worksheetCell") updateWorksheetCell(table, link.address, item.value);
    if (link.type === "scheduleTotal") updateScheduleTotal(table, link.label, item.value);
    if (link.type === "scheduleEscalatedRow") {
      updateScheduleEscalatedRow(table, link.label, item.value, link.movementLabel);
    }
  }
}

function inputTableBySheet(db, projectId, sheetName) {
  return (db.inputTables || []).find((table) => table.projectId === projectId && table.sheetName === sheetName);
}

function reportTableBySheet(db, projectId, sheetName) {
  return (db.reportTables || []).find((table) => table.projectId === projectId && table.sheetName === sheetName);
}

function normaliseCellAddress(address) {
  return String(address || "").replaceAll("$", "").toUpperCase();
}

function splitCellAddress(address) {
  const match = normaliseCellAddress(address).match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return { column: match[1], row: Number(match[2]) };
}

function columnToNumber(column) {
  return String(column || "").toUpperCase().split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

function numberToColumn(number) {
  let value = Number(number);
  let column = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function expandRange(startAddress, endAddress) {
  const start = splitCellAddress(startAddress);
  const end = splitCellAddress(endAddress);
  if (!start || !end) return [];
  const startCol = columnToNumber(start.column);
  const endCol = columnToNumber(end.column);
  const cells = [];
  for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row += 1) {
    for (let col = Math.min(startCol, endCol); col <= Math.max(startCol, endCol); col += 1) {
      cells.push(`${numberToColumn(col)}${row}`);
    }
  }
  return cells;
}

function splitFormulaArgs(text) {
  const args = [];
  let current = "";
  let depth = 0;
  let inQuote = false;
  for (const char of String(text || "")) {
    if (char === "'") inQuote = !inQuote;
    if (!inQuote && char === "(") depth += 1;
    if (!inQuote && char === ")") depth -= 1;
    if (!inQuote && depth === 0 && char === ",") {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim() || text === "") args.push(current.trim());
  return args;
}

function parseReferenceToken(token, currentSheet) {
  const text = String(token || "").trim();
  const match = text.match(/^(?:(?:'([^']+)'|([A-Za-z0-9_& .$()-]+))!)?(\$?[A-Z]{1,3}\$?\d+)$/);
  if (!match) return null;
  return {
    sheetName: (match[1] || match[2] || currentSheet || "").trim(),
    address: normaliseCellAddress(match[3]),
  };
}

function parseRangeToken(token, currentSheet) {
  const text = String(token || "").trim();
  const match = text.match(/^(?:(?:'([^']+)'|([A-Za-z0-9_& .$()-]+))!)?(\$?[A-Z]{1,3}\$?\d+):(\$?[A-Z]{1,3}\$?\d+)$/);
  if (!match) return null;
  return {
    sheetName: (match[1] || match[2] || currentSheet || "").trim(),
    start: normaliseCellAddress(match[3]),
    end: normaliseCellAddress(match[4]),
  };
}

function extractFormulaDependencies(formula, currentSheet) {
  const dependencies = [];
  const seen = new Set();
  const expression = String(formula || "").replace(/^=/, "");
  const refPattern = /(?:(?:'([^']+)'|([A-Za-z0-9_& .$()-]+))!)?(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?/g;
  for (const match of expression.matchAll(refPattern)) {
    const sheetName = (match[1] || match[2] || currentSheet || "").trim();
    const start = normaliseCellAddress(match[3]);
    const end = match[4] ? normaliseCellAddress(match[4]) : "";
    const key = `${sheetName}!${start}${end ? `:${end}` : ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dependencies.push({ sheetName, start, end: end || undefined });
  }
  return dependencies;
}

function findWorksheetCellValue(table, address) {
  if (!table || table.kind !== "worksheet-grid") return undefined;
  const target = normaliseCellAddress(address);
  for (const row of table.rows || []) {
    const cell = (row.cells || []).find((item) => normaliseCellAddress(item.address) === target);
    if (cell) return cell.value;
  }
  return undefined;
}

function getCellValue(db, projectId, sheetName, address) {
  const target = normaliseCellAddress(address);
  const reportValue = findWorksheetCellValue(reportTableBySheet(db, projectId, sheetName), target);
  if (reportValue !== undefined) return reportValue;
  const inputValue = findWorksheetCellValue(inputTableBySheet(db, projectId, sheetName), target);
  if (inputValue !== undefined) return inputValue;
  const inputRecord = (db.inputRecords || []).find(
    (record) => record.projectId === projectId && record.sheetName === sheetName && normaliseCellAddress(record.cell) === target
  );
  if (inputRecord) return inputRecord.value;
  const formulaRecord = (db.formulaRules || []).find(
    (record) => record.projectId === projectId && record.sheetName === sheetName && normaliseCellAddress(record.cell) === target
  );
  if (formulaRecord && formulaRecord.lastCalculatedValue !== undefined) return formulaRecord.lastCalculatedValue;
  return undefined;
}

function coerceNumber(value) {
  if (value === null || value === undefined || value === "" || value === "-") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value).trim();
  const negativeMatch = text.match(/^\((.*)\)$/);
  const cleaned = (negativeMatch ? `-${negativeMatch[1]}` : text).replace(/,/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function excelDateToDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30));
    date.setUTCDate(date.getUTCDate() + Math.trunc(value));
    return date;
  }
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function eomonth(value, months) {
  const date = excelDateToDate(value);
  if (!date) return "";
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + Number(months) + 1, 0));
  return result.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = excelDateToDate(value);
  if (!date) return value;
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + Number(days)));
  return result.toISOString().slice(0, 10);
}

function evaluateFormulaRule(db, projectId, rule) {
  const expression = String(rule.formula || "").trim().replace(/^=/, "");
  const dependencies = extractFormulaDependencies(rule.formula, rule.sheetName);

  function cellValueFromToken(token) {
    const ref = parseReferenceToken(token, rule.sheetName);
    if (!ref) throw new Error(`Unsupported reference ${token}`);
    return getCellValue(db, projectId, ref.sheetName, ref.address);
  }

  function rangeValuesFromToken(token) {
    const range = parseRangeToken(token, rule.sheetName);
    if (!range) return null;
    return expandRange(range.start, range.end).map((address) => getCellValue(db, projectId, range.sheetName, address));
  }

  function aggregateValues(functionName, argText) {
    const values = splitFormulaArgs(argText).flatMap((arg) => {
      const rangeValues = rangeValuesFromToken(arg);
      if (rangeValues) return rangeValues.map(coerceNumber);
      return [coerceNumber(evaluate(arg))];
    });
    if (!values.length) return 0;
    const name = functionName.toUpperCase();
    if (name === "SUM") return values.reduce((sum, value) => sum + value, 0);
    if (name === "AVERAGE") return values.reduce((sum, value) => sum + value, 0) / values.length;
    if (name === "MIN") return Math.min(...values);
    if (name === "MAX") return Math.max(...values);
    throw new Error(`Unsupported function ${functionName}`);
  }

  function evaluate(text) {
    const value = String(text || "").trim();
    const rangeValues = rangeValuesFromToken(value);
    if (rangeValues) return rangeValues.reduce((sum, item) => sum + coerceNumber(item), 0);

    const directReference = parseReferenceToken(value, rule.sheetName);
    if (directReference) return getCellValue(db, projectId, directReference.sheetName, directReference.address);

    const aggregateMatch = value.match(/^(SUM|AVERAGE|MIN|MAX)\((.*)\)$/i);
    if (aggregateMatch) {
      return aggregateValues(aggregateMatch[1], aggregateMatch[2]);
    }

    const ifMatch = value.match(/^IF\((.*)\)$/i);
    if (ifMatch) {
      const [condition, trueValue, falseValue] = splitFormulaArgs(ifMatch[1]);
      return evaluateCondition(condition) ? evaluate(trueValue) : evaluate(falseValue);
    }

    const eomonthMatch = value.match(/^EOMONTH\((.*)\)(?:\s*([+-])\s*(\d+))?$/i);
    if (eomonthMatch) {
      const [dateArg, monthArg] = splitFormulaArgs(eomonthMatch[1]);
      const monthEnd = eomonth(evaluate(dateArg), coerceNumber(evaluate(monthArg)));
      if (!eomonthMatch[2]) return monthEnd;
      return addDays(monthEnd, eomonthMatch[2] === "+" ? Number(eomonthMatch[3]) : -Number(eomonthMatch[3]));
    }

    if (/^[-+]?\d+(?:\.\d+)?$/.test(value)) return Number(value);
    return evaluateArithmetic(value);
  }

  function expressionToNumbers(text) {
    const withRefs = String(text || "").replace(
      /(?:(?:'([^']+)'|([A-Za-z0-9_& .$()-]+))!)?(\$?[A-Z]{1,3}\$?\d+)/g,
      (match) => String(coerceNumber(cellValueFromToken(match)))
    );
    if (!/^[0-9+\-*/().<>=!\s]+$/.test(withRefs)) {
      throw new Error(`Unsupported formula syntax: ${rule.formula}`);
    }
    return withRefs;
  }

  function evaluateArithmetic(text) {
    let expressionText = String(text || "");
    let previous = "";
    const simpleAggregate = /(SUM|AVERAGE|MIN|MAX)\(([^()]+)\)/i;
    while (expressionText !== previous && simpleAggregate.test(expressionText)) {
      previous = expressionText;
      expressionText = expressionText.replace(simpleAggregate, (_match, functionName, argText) => String(aggregateValues(functionName, argText)));
    }
    expressionText = expressionToNumbers(expressionText);
    return Function(`"use strict"; return (${expressionText});`)();
  }

  function evaluateCondition(text) {
    const expressionText = expressionToNumbers(text).replace(/([^<>=!])=([^=])/g, "$1==$2");
    return Boolean(Function(`"use strict"; return (${expressionText});`)());
  }

  try {
    const value = evaluate(expression);
    if (typeof value === "number" && !Number.isFinite(value)) {
      return {
        value: undefined,
        dependencies,
        status: "waiting_for_input",
        message: "Formula retained; waiting for non-zero / valid input values",
      };
    }
    return {
      value,
      dependencies,
      status: "calculated",
      message: "Calculated and written to report output",
    };
  } catch (error) {
    return {
      value: undefined,
      dependencies,
      status: "needs_review",
      message: error.message,
    };
  }
}

function publishCalculationResult(db, projectId, rule, result) {
  const now = new Date().toISOString();
  rule.dependencies = result.dependencies;
  rule.calculationStatus = result.status;
  rule.calculationMessage = result.message;
  rule.lastCalculatedAt = now;
  if (result.status === "waiting_for_input") return false;
  if (result.status !== "calculated") return false;
  rule.lastCalculatedValue = result.value;
  const table = reportTableBySheet(db, projectId, rule.sheetName);
  const updated = updateWorksheetCell(table, rule.cell, result.value);
  rule.lastPublishedAt = now;
  return updated;
}

function recalculateProjectFormulas(db, projectId, options = {}) {
  const now = new Date().toISOString();
  const publishableStatuses = new Set(["approved_baseline", "published_approved"]);
  const focusIds = new Set(options.focusIds || []);
  const rules = (db.formulaRules || []).filter((rule) => {
    if (rule.projectId !== projectId) return false;
    if (focusIds.has(rule.id)) return true;
    return publishableStatuses.has(rule.status);
  });
  const run = {
    id: `calc_${Date.now()}`,
    projectId,
    mode: options.mode || (focusIds.size ? "publish_formula" : "full_recalculation"),
    startedAt: now,
    finishedAt: now,
    formulasScanned: rules.length,
    calculated: 0,
    updatedCells: 0,
    waitingForInput: 0,
    needsReview: 0,
    errors: [],
  };
  for (let pass = 0; pass < 2; pass += 1) {
    for (const rule of rules) {
      const result = evaluateFormulaRule(db, projectId, rule);
      const updated = publishCalculationResult(db, projectId, rule, result);
      if (pass === 1) {
        if (result.status === "calculated") run.calculated += 1;
        else if (result.status === "waiting_for_input") {
          run.waitingForInput += 1;
        } else {
          run.needsReview += 1;
          if (run.errors.length < 12) run.errors.push({ id: rule.id, sheetName: rule.sheetName, cell: rule.cell, message: result.message });
        }
        if (updated) run.updatedCells += 1;
      }
    }
  }
  const project = db.projects.find((item) => item.id === projectId);
  if (project) {
    project.settings ||= {};
    project.settings.lastCalculationRun = run;
  }
  syncReportTablesWithMetrics(db, projectId);
  return run;
}

function updateInputRecordForCell(db, projectId, sheetName, address, value) {
  const item = (db.inputRecords || []).find(
    (record) => record.projectId === projectId && record.sheetName === sheetName && record.cell === address
  );
  if (!item) return;
  item.value = value;
  item.updatedAt = new Date().toISOString();
  applyInputReportLinks(db, projectId, item);
}

function columnLettersFromAddress(address) {
  return String(address || "").replace(/[^A-Za-z]/g, "").toUpperCase();
}

function tableColumns(table) {
  return table.columns?.length
    ? table.columns
    : (table.rows?.[0]?.cells || []).map((cell) => {
        const key = columnLettersFromAddress(cell.address);
        return { key, label: key, sourceColumn: 0 };
      });
}

function nextInputTableRow(table) {
  const maxRow = Math.max(0, ...(table.rows || []).map((row) => Number(row.sourceRow || 0)));
  const sourceRow = maxRow + 1;
  const columns = tableColumns(table);
  return {
    sourceRow,
    isNew: true,
    style: "yellow",
    cells: columns.map((column) => {
      const key = column.key || column.label || "";
      return {
        address: `${key}${sourceRow}`,
        value: "",
        style: "yellow",
      };
    }),
  };
}

function syncReportTablesWithMetrics(db, projectId) {
  const project = db.projects.find((item) => item.id === projectId);
  if (!project) return;
  const model = db.models.find((item) => item.id === project.modelId);
  if (!model) return;
  const calculated = calculateOutputs(model);
  const metrics = calculated.metrics;
  const tableByName = new Map(
    (db.reportTables || [])
      .filter((table) => table.projectId === projectId)
      .map((table) => [table.sheetName, table])
  );
  const inputTableByName = new Map(
    (db.inputTables || [])
      .filter((table) => table.projectId === projectId)
      .map((table) => [table.sheetName, table])
  );

  const summary = tableByName.get("Summary (US$)");
  updateWorksheetCell(summary, "F17", metrics.totalDevelopmentExpenditure);
  updateWorksheetCell(summary, "I10", metrics.committedSources);
  updateWorksheetCell(summary, "I14", metrics.fundingShortfall);
  updateWorksheetCell(summary, "F29", metrics.costPerHa);
  updateWorksheetCell(summary, "I24", metrics.nominalAfterTaxIrr);
  updateWorksheetCell(summary, "I26", metrics.paybackYears);
  updateWorksheetCell(summary, "I27", metrics.nominalAfterTaxNpvAtWacc);

  const valuation = tableByName.get("Valuation");
  updateScheduleTotal(valuation, "Using NPV function (26 Yrs)", metrics.nominalAfterTaxNpvAtWacc);
  updateScheduleTotal(valuation, "NPV (27 Yrs)", metrics.nominalAfterTaxNpvAtWacc);
  updateScheduleTotal(valuation, "Using IRR function (27 Yrs)", metrics.nominalAfterTaxIrr);
  updateScheduleTotal(valuation, "Payback period", metrics.paybackYears);

  const budgetRequest = tableByName.get("OPSL AUG BUD req");
  updateWorksheetCell(budgetRequest, "E8", metrics.augCurrentCashBalance);
  const budgetRequestInput = inputTableByName.get("OPSL AUG BUD req");
  updateWorksheetCell(budgetRequestInput, "E8", metrics.augCurrentCashBalance);
}

function projectPayload(db, projectId, indexes = buildIndexes(db)) {
  syncReportTablesWithMetrics(db, projectId);
  indexes = buildIndexes(db);
  const project = indexes.projectsById.get(projectId);
  if (!project) return null;
  const company = indexes.companiesById.get(project.companyId);
  const model = indexes.modelsById.get(project.modelId);
  const calculated = calculateOutputs(model);
  const key = `${project.companyId}|${projectId}`;
  return {
    company,
    project,
    model: { ...model, metrics: calculated.metrics },
    ratios: calculated.ratios,
    ifrsReports: calculated.ifrsReports,
    inputRecords: indexes.inputsByCompanyProject.get(key) || [],
    inputTables: indexes.inputTablesByCompanyProject.get(key) || [],
    formulaRules: indexes.formulasByCompanyProject.get(key) || [],
    reportSnapshots: indexes.reportsByCompanyProject.get(key) || [],
    reportTables: indexes.reportTablesByCompanyProject.get(key) || [],
    transactions: indexes.transactionsByCompanyProject.get(key) || [],
    marketData: indexes.marketDataByCompanyProject.get(key) || [],
  };
}

function pushIndex(map, key, item) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(item);
}

function buildIndexes(db) {
  const indexes = {
    companiesById: new Map(),
    projectsById: new Map(),
    modelsById: new Map(),
    projectsByCompany: new Map(),
    inputsByCompanyProject: new Map(),
    inputsByCompanyProjectSheet: new Map(),
    inputTablesByCompanyProject: new Map(),
    inputTablesByCompanyProjectSheet: new Map(),
    formulasByCompanyProject: new Map(),
    formulasByCompanyProjectSheet: new Map(),
    reportsByCompanyProject: new Map(),
    reportsByCompanyProjectSheet: new Map(),
    reportTablesByCompanyProject: new Map(),
    reportTablesByCompanyProjectSheet: new Map(),
    transactionsByCompanyProject: new Map(),
    transactionsByCompanyProjectCategory: new Map(),
    marketDataByCompanyProject: new Map(),
  };

  for (const item of db.companies) indexes.companiesById.set(item.id, item);
  for (const item of db.projects) {
    indexes.projectsById.set(item.id, item);
    pushIndex(indexes.projectsByCompany, item.companyId, item);
  }
  for (const item of db.models) indexes.modelsById.set(item.id, item);
  for (const item of db.inputRecords) {
    const key = `${item.companyId}|${item.projectId}`;
    pushIndex(indexes.inputsByCompanyProject, key, item);
    pushIndex(indexes.inputsByCompanyProjectSheet, `${key}|${item.sheetName}`, item);
  }
  for (const item of db.inputTables || []) {
    const key = `${item.companyId}|${item.projectId}`;
    pushIndex(indexes.inputTablesByCompanyProject, key, item);
    pushIndex(indexes.inputTablesByCompanyProjectSheet, `${key}|${item.sheetName}`, item);
  }
  for (const item of db.formulaRules) {
    const key = `${item.companyId}|${item.projectId}`;
    pushIndex(indexes.formulasByCompanyProject, key, item);
    pushIndex(indexes.formulasByCompanyProjectSheet, `${key}|${item.sheetName}`, item);
  }
  for (const item of db.reportSnapshots) {
    const key = `${item.companyId}|${item.projectId}`;
    pushIndex(indexes.reportsByCompanyProject, key, item);
    pushIndex(indexes.reportsByCompanyProjectSheet, `${key}|${item.sheetName}`, item);
  }
  for (const item of db.reportTables || []) {
    const key = `${item.companyId}|${item.projectId}`;
    pushIndex(indexes.reportTablesByCompanyProject, key, item);
    pushIndex(indexes.reportTablesByCompanyProjectSheet, `${key}|${item.sheetName}`, item);
  }
  for (const item of db.transactions) {
    const key = `${item.companyId}|${item.projectId}`;
    pushIndex(indexes.transactionsByCompanyProject, key, item);
    pushIndex(indexes.transactionsByCompanyProjectCategory, `${key}|${item.category || "uncategorized"}`, item);
  }
  for (const item of db.marketData) {
    pushIndex(indexes.marketDataByCompanyProject, `${item.companyId}|${item.projectId}`, item);
  }
  return indexes;
}

function pageItems(items, url, defaultLimit = 25, maxLimit = 100) {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || defaultLimit), 1), maxLimit);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
  const total = items.length;
  const page = items.slice(offset, offset + limit);
  const nextOffset = offset + limit < total ? offset + limit : null;
  return {
    items: page,
    page: {
      limit,
      offset,
      total,
      nextOffset,
      hasMore: nextOffset !== null,
    },
  };
}

function filterCollection(items, url, fields = []) {
  const sheetName = url.searchParams.get("sheetName");
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  return items.filter((item) => {
    if (sheetName && item.sheetName !== sheetName && item.sourceSheet !== sheetName) return false;
    if (status && item.status !== status) return false;
    if (category && item.category !== category) return false;
    if (!search) return true;
    return fields.some((field) => String(item[field] || "").toLowerCase().includes(search));
  });
}

function aggregateSummaries(payload) {
  const amount = (item, fields) => fields.reduce((sum, field) => sum + Number(item[field] || 0), 0);
  const transactionsByCategory = {};
  for (const item of payload.transactions) {
    const category = item.category || "Uncategorized";
    transactionsByCategory[category] ||= {
      category,
      count: 0,
      amountUsd: 0,
      requestedAmountUsd: 0,
      totalAvailableBudgetUsd: 0,
    };
    transactionsByCategory[category].count += 1;
    transactionsByCategory[category].amountUsd += Number(item.amountUsd || 0);
    transactionsByCategory[category].requestedAmountUsd += Number(item.requestedAmountUsd || 0);
    transactionsByCategory[category].totalAvailableBudgetUsd += Number(item.totalAvailableBudgetUsd || 0);
  }

  const reportsByGroup = {};
  for (const item of payload.reportSnapshots) {
    const group = item.sheetName.includes("Budget") || item.sheetName.includes("Fund")
      ? "Budget and funding"
      : item.sheetName.includes("Opex") || item.sheetName.includes("Nursery")
        ? "Opex and costing"
        : item.sheetName.includes("Balance") || item.sheetName.includes("Financial") || item.sheetName.includes("Cashflow")
          ? "IFRS financial reports"
          : "Other reports";
    reportsByGroup[group] ||= { group, count: 0, formulaCount: 0, contextualInputCount: 0 };
    reportsByGroup[group].count += 1;
    reportsByGroup[group].formulaCount += Number(item.formulaCount || 0);
    reportsByGroup[group].contextualInputCount += Number(item.contextualInputCount || 0);
  }

  return {
    kpis: payload.model.metrics,
    ratios: payload.ratios,
    collectionCounts: {
      inputs: payload.inputRecords.length,
      inputTables: payload.inputTables.length,
      formulas: payload.formulaRules.length,
      reports: payload.reportSnapshots.length,
      reportTables: payload.reportTables.length,
      transactions: payload.transactions.length,
      marketData: payload.marketData.length,
    },
    transactionTotals: {
      amountUsd: amount(payload.transactions, ["amountUsd"]),
      requestedAmountUsd: amount(payload.transactions, ["requestedAmountUsd"]),
      totalAvailableBudgetUsd: amount(payload.transactions, ["totalAvailableBudgetUsd"]),
    },
    transactionsByCategory: Object.values(transactionsByCategory)
      .sort((a, b) => Math.abs(b.amountUsd + b.requestedAmountUsd) - Math.abs(a.amountUsd + a.requestedAmountUsd)),
    reportsByGroup: Object.values(reportsByGroup),
  };
}

async function bodyJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function csvEscape(value) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCsv(payload) {
  const rows = [
    ["Company", payload.company.name],
    ["Project", payload.project.name],
    ["Metric", "Value"],
    ...Object.entries(payload.model.metrics),
    [],
    ["Input ID", "Sheet", "Cell", "Label", "Value", "Status"],
    ...payload.inputRecords.map((item) => [item.id, item.sheetName, item.cell, item.label, item.value, item.status]),
    [],
    ["Report", "Dimensions", "Formula Count", "Contextual Inputs"],
    ...payload.reportSnapshots.map((item) => [item.sheetName, item.dimensions, item.formulaCount, item.contextualInputCount]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function renderPdfReport(projectId, sheetName) {
  const script = path.join(__dirname, "scripts", "render_report_pdf.py");
  const result = spawnSync(pythonPath, [script, dbPath, projectId, sheetName], {
    encoding: "buffer",
    maxBuffer: 30 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.toString("utf8") || "PDF generation failed");
  }
  return result.stdout;
}

function renderCpoMarketPdf() {
  const script = path.join(__dirname, "scripts", "render_cpo_pdf.py");
  const result = spawnSync(pythonPath, [script, cpoCachePath], {
    encoding: "buffer",
    maxBuffer: 12 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.toString("utf8") || "CPO PDF generation failed");
  }
  return result.stdout;
}

function cpoReportDateSlug(report) {
  const value = `${report?.refreshedAt || ""} ${report?.sourceUpdatedAt || ""} ${report?.cacheUpdatedAt || ""}`;
  const iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dated = value.match(/\b(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\b/);
  const months = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  if (dated) {
    const [, day, month, year] = dated;
    return `${year}-${months[month.toLowerCase()] || "01"}-${day.padStart(2, "0")}`;
  }
  return new Date().toISOString().slice(0, 10);
}

const MARKET_TICKER_TTL_MS = 5 * 60 * 1000;
let marketTickerCache = null;

function decodeHtml(value = "") {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function compactWhitespace(value = "") {
  return decodeHtml(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseMpocCpoSettlementPrices(html) {
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1] || "";
  const sourceText = compactWhitespace(description || html);
  const prices = [];
  const pattern = /(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{2})\s*([0-9]{4,5})(?=\s+\d{1,2}\s+[A-Z][a-z]{2}\s+\d{2}| Palm Oil Prices| CPO|$)/g;
  let match;
  while ((match = pattern.exec(sourceText))) {
    const [, day, month, year, value] = match;
    const price = Number(value.replace(/,/g, ""));
    if (!Number.isFinite(price)) continue;
    const fullYear = 2000 + Number(year);
    prices.push({
      label: `${day} ${month}-${year}`,
      dateLabel: `${day} ${month} ${fullYear}`,
      isoDate: `${fullYear}-${String(new Date(`${month} 1, ${fullYear}`).getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      price,
    });
  }
  if (!prices.length) throw new Error("Unable to parse MPOC CPO settlement table");
  return prices;
}

function signedDeltaText(prefix, current, previous, suffix = "day") {
  const diff = Number(current) - Number(previous);
  const pct = previous ? (diff / previous) * 100 : 0;
  const amount = Math.abs(diff);
  const sign = diff >= 0 ? "+" : "-";
  return `${prefix}${amount.toLocaleString(undefined, { maximumFractionDigits: prefix === "$" ? 0 : 0 })} (${sign}${Math.abs(pct).toFixed(2)}%) ${suffix}`;
}

function toneForDelta(current, previous) {
  return Number(current) >= Number(previous) ? "up" : "down";
}

async function readCpoCache() {
  return JSON.parse(await fs.readFile(cpoCachePath, "utf8"));
}

async function liveUsdMyrRate() {
  const data = await fetchJson("https://api.frankfurter.dev/v2/rate/USD/MYR?providers=BNM", 6000);
  const rate = Number(data.rate);
  if (!Number.isFinite(rate)) throw new Error("USD/MYR rate missing from BNM feed");
  return { rate, date: data.date || "" };
}

function updateCpoReportFromSources(cache, settlementRows, fx) {
  const latest = settlementRows.at(-1);
  const previous = settlementRows.at(-2) || latest;
  const first = settlementRows[0] || latest;
  const high = Math.max(...settlementRows.map((row) => row.price));
  const low = Math.min(...settlementRows.map((row) => row.price));
  const latestUsd = fx?.rate ? Math.round(latest.price / fx.rate) : Number(String(cache.cards?.[0]?.secondary || "").replace(/[^0-9.-]/g, "")) || "";
  const previousUsd = fx?.rate ? Math.round(previous.price / fx.rate) : latestUsd;
  const sourceUpdatedAt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
  const trendTone = toneForDelta(latest.price, previous.price);
  const recentTone = toneForDelta(latest.price, first.price);
  const percentile = high === low ? 100 : Math.round(((latest.price - low) / (high - low)) * 100);

  const next = structuredClone(cache);
  next.refreshedAt = `${latest.dateLabel}, MPOC close`;
  next.source = "MPOC Daily Palm Oil Prices";
  next.sourceUrl = "https://www.mpoc.org.my/market-insight/daily-palm-oil-prices/";
  next.previousClose = previous.dateLabel;
  next.refreshStatus = "live";
  next.sourceUpdatedAt = sourceUpdatedAt;
  next.cacheUpdatedAt = sourceUpdatedAt;
  next.fxSourceDate = fx?.date || next.fxSourceDate || "";

  next.cards = Array.isArray(next.cards) ? next.cards : [];
  next.cards[0] = {
    ...(next.cards[0] || {}),
    label: "Front-month FCPO",
    primary: `RM ${latest.price.toLocaleString()}`,
    primaryDelta: signedDeltaText("RM ", latest.price, previous.price),
    primaryTone: trendTone,
    secondary: latestUsd ? `USD ${Number(latestUsd).toLocaleString()}` : next.cards[0]?.secondary || "",
    secondaryDelta: latestUsd && previousUsd ? signedDeltaText("$", latestUsd, previousUsd) : next.cards[0]?.secondaryDelta || "",
    secondaryTone: latestUsd && previousUsd ? toneForDelta(latestUsd, previousUsd) : next.cards[0]?.secondaryTone || "up",
    footnote: `Latest MPOC / Bursa settlement ${latest.dateLabel}`,
  };
  if (next.cards[2]) {
    next.cards[2] = {
      ...next.cards[2],
      primary: fx?.rate ? Number(fx.rate).toFixed(4) : next.cards[2].primary,
      primaryDelta: fx?.date ? `BNM latest ${fx.date}` : next.cards[2].primaryDelta,
      primaryTone: "neutral",
      footnote: "USD/MYR public feed for conversion",
    };
  }

  const labels = settlementRows.map((row) => row.label);
  const prices = settlementRows.map((row) => row.price);
  if (next.curve) {
    next.curve = {
      ...next.curve,
      title: "CPO settlement trend - latest public source",
      subtitle: `Latest ${latest.dateLabel} RM${latest.price.toLocaleString()} | recent high RM${high.toLocaleString()} | recent change ${latest.price - first.price >= 0 ? "+" : "-"}RM${Math.abs(latest.price - first.price).toLocaleString()}`,
      labels,
      prices,
      volume: labels.map((_, index) => next.curve.volume?.[index] || Math.max(2500, Math.round((index + 1) * 1800))),
    };
  }
  next.today = [
    [`Today (latest settlement ${latest.dateLabel})`, `RM ${latest.price.toLocaleString()}`, "neutral"],
    ["1-day change", `${latest.price >= previous.price ? "▲" : "▼"} RM ${Math.abs(latest.price - previous.price).toLocaleString()} (${latest.price >= previous.price ? "+" : "-"}${Math.abs(((latest.price - previous.price) / previous.price) * 100).toFixed(2)}%)`, trendTone],
    ["Recent source change", `${latest.price >= first.price ? "▲" : "▼"} RM ${Math.abs(latest.price - first.price).toLocaleString()} (${latest.price >= first.price ? "+" : "-"}${Math.abs(((latest.price - first.price) / first.price) * 100).toFixed(2)}%)`, recentTone],
    ["Recent high / low", `${high.toLocaleString()} / ${low.toLocaleString()}`, "neutral"],
    ["Public source", "MPOC / Bursa Malaysia", "neutral"],
    ["Position in recent range", `${percentile}th percentile`, "neutral"],
  ];

  return next;
}

async function refreshCpoMarketCache(db) {
  const cache = await readCpoCache();
  try {
    const [html, fxResult] = await Promise.all([
      fetchText("https://www.mpoc.org.my/market-insight/daily-palm-oil-prices/", 10000),
      liveUsdMyrRate().catch((error) => ({ error })),
    ]);
    const settlementRows = parseMpocCpoSettlementPrices(html);
    const report = updateCpoReportFromSources(cache, settlementRows, fxResult?.error ? null : fxResult);
    await fs.writeFile(cpoCachePath, JSON.stringify(report, null, 2) + "\n");

    const marketRecord = db.marketData.find((record) => record.id === "market_cpo_prices");
    const latest = settlementRows.at(-1);
    if (marketRecord && latest) {
      Object.assign(marketRecord, {
        label: `CPO prices ticker - RM ${latest.price.toLocaleString()} (${latest.dateLabel})`,
        status: "public_source_refreshed",
        sourceUrl: report.sourceUrl,
        latestPriceRm: latest.price,
        latestDate: latest.isoDate,
        fxUsdMyr: fxResult?.rate || marketRecord.fxUsdMyr || null,
        updatedAt: new Date().toISOString(),
      });
      await writeDb(db);
    }
    marketTickerCache = null;
    return report;
  } catch (error) {
    return {
      ...cache,
      refreshStatus: "failed",
      refreshError: `${error.message}. Showing last local CPO snapshot.`,
      cacheUpdatedAt: cache.cacheUpdatedAt || cache.refreshedAt || "",
    };
  }
}

async function fetchText(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PlantationFinancialModel/1.0",
        Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) throw new Error(`Public source returned ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, timeoutMs = 2500) {
  return JSON.parse(await fetchText(url, timeoutMs));
}

function tickerItem({ id, category, title, value, note, sourceName, sourceUrl, status = "seeded" }) {
  return {
    id,
    category,
    title,
    value,
    note,
    sourceName,
    sourceUrl,
    status,
    updatedAt: new Date().toISOString(),
  };
}

function seededMarketTicker(payload) {
  const metrics = payload.model.metrics;
  const marketDataLabels = payload.marketData.map((item) => item.label).join(", ");
  return [
    tickerItem({
      id: "cpo-price-watch",
      category: "CPO TICKER",
      title: "USD/t price watch",
      value: "Workbook baseline",
      note: "CPO Prices master-data series retained in database",
      sourceName: "CPO Prices master data",
      sourceUrl: "#",
    }),
    tickerItem({
      id: "usd-myr",
      category: "FX",
      title: "USD exchange rate",
      value: "Public feed standby",
      note: "Frankfurter BNM feed is used when reachable",
      sourceName: "Frankfurter / Bank Negara Malaysia",
      sourceUrl: "https://frankfurter.dev/providers/bnm/",
    }),
    tickerItem({
      id: "commodity-basket",
      category: "COMMODITIES",
      title: "PK, PKO, fertilizer, fuel",
      value: "Master data linked",
      note: marketDataLabels || "PK Prices, CPO Prices, and WACC Benchmarking",
      sourceName: "Workbook master data",
      sourceUrl: "#",
    }),
    tickerItem({
      id: "world-palm-output",
      category: "PRODUCTION",
      title: "World palm plantation output",
      value: "External source slot",
      note: "Ready for MPOB / industry production feed integration",
      sourceName: "Public production website connector",
      sourceUrl: "#",
    }),
    tickerItem({
      id: "market-risk",
      category: "MARKET RISK",
      title: "Weather, certification, logistics",
      value: "Public feed standby",
      note: "Open-Meteo weather is used when reachable",
      sourceName: "Open-Meteo",
      sourceUrl: "https://open-meteo.com/en/docs",
    }),
    tickerItem({
      id: "funding-gap",
      category: "MODEL",
      title: "OP Sierra Leone funding gap",
      value: compactServerMoney(metrics.fundingShortfall),
      note: "Recalculated from database model metrics",
      sourceName: "Plantation Financial Model API",
      sourceUrl: "#",
      status: "database",
    }),
  ];
}

function compactServerMoney(value) {
  const amount = Number(value || 0);
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}USD ${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}USD ${(abs / 1_000).toFixed(1)}k`;
  return `${sign}USD ${abs.toFixed(0)}`;
}

async function liveCpoTickerItem() {
  const sourceUrl = "https://www.proteinreport.org/data/series/global-palm-oil-price";
  const html = await fetchText(sourceUrl);
  const latestBlock = html.match(/Latest value[\s\S]{0,450}?\$([\d,]+)[\s\S]{0,220}?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i);
  const tableRow = html.match(/<td[^>]*>((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})<\/td><td[^>]*>\$([\d,]+)/i);
  const value = latestBlock?.[1] || tableRow?.[2];
  const month = latestBlock?.[2] || tableRow?.[1];
  if (!value) throw new Error("CPO price value was not present in public page");
  return tickerItem({
    id: "cpo-price-watch",
    category: "CPO TICKER",
    title: "USD/t price watch",
    value: `USD/t ${value}`,
    note: month ? `Latest public benchmark ${month}` : "Latest public benchmark",
    sourceName: "Protein Report / World Bank Pink Sheet",
    sourceUrl,
    status: "live",
  });
}

async function liveFxTickerItem() {
  const sourceUrl = "https://api.frankfurter.dev/v2/rate/USD/MYR?providers=BNM";
  const data = await fetchJson(sourceUrl);
  if (!Number.isFinite(Number(data.rate))) throw new Error("USD/MYR rate missing from public feed");
  return tickerItem({
    id: "usd-myr",
    category: "FX",
    title: "USD exchange rate",
    value: `MYR ${Number(data.rate).toFixed(4)}`,
    note: data.date ? `BNM latest ${data.date}` : "BNM latest rate",
    sourceName: "Frankfurter / Bank Negara Malaysia",
    sourceUrl: "https://frankfurter.dev/providers/bnm/",
    status: "live",
  });
}

async function liveWeatherTickerItem() {
  const sourceUrl = "https://api.open-meteo.com/v1/forecast?latitude=8.46&longitude=-13.23&current=temperature_2m,precipitation,wind_speed_10m&timezone=auto";
  const data = await fetchJson(sourceUrl);
  const current = data.current || {};
  if (!Number.isFinite(Number(current.temperature_2m))) throw new Error("Weather temperature missing from public feed");
  const rain = Number(current.precipitation || 0);
  const wind = Number(current.wind_speed_10m || 0);
  return tickerItem({
    id: "market-risk",
    category: "MARKET RISK",
    title: "Weather, certification, logistics",
    value: `${Number(current.temperature_2m).toFixed(0)}C · ${rain.toFixed(1)}mm rain`,
    note: `Sierra Leone gateway wind ${wind.toFixed(0)} km/h`,
    sourceName: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/en/docs",
    status: "live",
  });
}

async function marketTicker(payload) {
  const cacheKey = payload.project.id;
  if (marketTickerCache && marketTickerCache.cacheKey === cacheKey && Date.now() - marketTickerCache.createdAt < MARKET_TICKER_TTL_MS) {
    return marketTickerCache.payload;
  }

  const items = seededMarketTicker(payload);
  const liveResults = await Promise.allSettled([
    liveCpoTickerItem(),
    liveFxTickerItem(),
    liveWeatherTickerItem(),
  ]);
  for (const result of liveResults) {
    if (result.status !== "fulfilled") continue;
    const index = items.findIndex((item) => item.id === result.value.id);
    if (index >= 0) items[index] = result.value;
  }

  const liveCount = items.filter((item) => item.status === "live").length;
  const response = {
    sourceMode: liveCount ? "public_website_with_database_fallback" : "database_fallback",
    refreshSeconds: 300,
    items,
  };
  marketTickerCache = { cacheKey, createdAt: Date.now(), payload: response };
  return response;
}

async function api(req, res, url) {
  const db = await readDb();
  const indexes = buildIndexes(db);
  if (req.method === "GET" && url.pathname === "/api/cpo-market") {
    return send(req, res, 200, await readCpoCache(), "application/json; charset=utf-8", {
      cacheControl: "no-store",
    });
  }
  if (req.method === "GET" && url.pathname === "/api/cpo-market/pdf") {
    const report = await readCpoCache();
    const pdf = renderCpoMarketPdf();
    const disposition = url.searchParams.get("download") === "0" ? "inline" : "attachment";
    res.setHeader("Content-Disposition", `${disposition}; filename="cpo-report-${cpoReportDateSlug(report)}.pdf"`);
    return send(req, res, 200, pdf, "application/pdf", {
      cacheControl: "no-store",
    });
  }
  if ((req.method === "GET" || req.method === "POST") && url.pathname === "/api/cpo-market/refresh") {
    return send(req, res, 200, await refreshCpoMarketCache(db), "application/json; charset=utf-8", {
      cacheControl: "no-store",
    });
  }
  if (req.method === "GET" && url.pathname === "/api/companies") return send(req, res, 200, pageItems(db.companies, url, 25, 100));
  if (req.method === "GET" && url.pathname === "/api/projects") {
    const companyId = url.searchParams.get("companyId");
    const projects = companyId ? indexes.projectsByCompany.get(companyId) || [] : db.projects;
    return send(req, res, 200, pageItems(projects, url, 25, 100));
  }

  const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)(?:\/([^/]+))?$/);
  if (!projectMatch) return notFound(req, res);
  const [, projectId, child] = projectMatch;
  const payload = projectPayload(db, projectId, indexes);
  if (!payload) return notFound(req, res);

  if (req.method === "GET" && !child) return send(req, res, 200, payload);
  if (req.method === "GET" && child === "summary") return send(req, res, 200, {
    company: payload.company,
    project: payload.project,
    model: payload.model,
    ratios: payload.ratios,
    ifrsReports: payload.ifrsReports,
  });
  if (req.method === "GET" && child === "summaries") return send(req, res, 200, aggregateSummaries(payload));
  if (req.method === "GET" && child === "inputs") {
    const records = filterCollection(payload.inputRecords, url, ["sheetName", "cell", "label", "value", "status"]);
    return send(req, res, 200, pageItems(records, url, 25, 200));
  }
  if (req.method === "GET" && child === "reports") {
    const records = filterCollection(payload.reportSnapshots, url, ["sheetName", "dimensions", "status"]);
    return send(req, res, 200, pageItems(records, url, 20, 100));
  }
  if (req.method === "GET" && child === "report-pdf") {
    const sheetName = url.searchParams.get("sheetName");
    if (!sheetName) return badRequest(req, res, "sheetName is required");
    const pdf = renderPdfReport(projectId, sheetName);
    const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    const filename = `${sheetName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report"}.pdf`;
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    return send(req, res, 200, pdf, "application/pdf", {
      cacheControl: "private, max-age=30, stale-while-revalidate=120",
    });
  }
  if (req.method === "GET" && child === "formulas") {
    const records = filterCollection(payload.formulaRules, url, ["sheetName", "cell", "formula", "status"]);
    return send(req, res, 200, pageItems(records, url, 25, 200));
  }
  if (req.method === "GET" && child === "transactions") {
    const records = filterCollection(payload.transactions, url, ["sourceSheet", "category", "description", "status", "notes"]);
    return send(req, res, 200, pageItems(records, url, 50, 500));
  }
  if (req.method === "GET" && child === "market-data") {
    const records = filterCollection(payload.marketData, url, ["sourceSheet", "label", "status"]);
    return send(req, res, 200, pageItems(records, url, 25, 100));
  }
  if (req.method === "GET" && child === "market-ticker") {
    return send(req, res, 200, await marketTicker(payload), "application/json; charset=utf-8", {
      cacheControl: "private, max-age=60, stale-while-revalidate=300",
    });
  }
  if (req.method === "GET" && child === "export") {
    return send(req, res, 200, exportCsv(payload), "text/csv; charset=utf-8", {
      cacheControl: "private, max-age=0, must-revalidate",
    });
  }

  if (req.method === "PUT" && child === "management") {
    const patch = await bodyJson(req);
    const projectRecord = db.projects.find((record) => record.id === projectId);
    const companyRecord = db.companies.find((record) => record.id === projectRecord.companyId);
    if (!projectRecord || !companyRecord) return notFound(req, res);

    const companyName = typeof patch.companyName === "string" ? patch.companyName.trim() : "";
    const projectName = typeof patch.projectName === "string" ? patch.projectName.trim() : "";
    if (companyName) companyRecord.name = companyName;
    if (projectName) projectRecord.name = projectName;

    projectRecord.settings ||= {};
    if (typeof patch.reportingCurrency === "string" && patch.reportingCurrency.trim()) {
      projectRecord.settings.reportingCurrency = patch.reportingCurrency.trim().toUpperCase();
      const currencyInput = db.inputRecords.find((record) => record.id === "input_reporting_currency" && record.projectId === projectId);
      if (currencyInput) currencyInput.value = projectRecord.settings.reportingCurrency;
    }
    if (patch.startYear !== undefined) {
      const year = Number(patch.startYear);
      if (Number.isFinite(year)) projectRecord.settings.startYear = Math.trunc(year);
    }

    await writeDb(db);
    return send(req, res, 200, projectPayload(db, projectId));
  }

  if (req.method === "PUT" && child === "branding") {
    const patch = await bodyJson(req);
    const logo = decodeBrandLogoDataUrl(patch.logoDataUrl);
    if (!logo) return badRequest(req, res, "Upload a PNG, JPG, or WebP logo under 3 MB.");

    const fileName = `branding-logo.${logo.extension}`;
    const cacheToken = Date.now();
    const publicUrl = `/public/${fileName}?v=${cacheToken}`;
    await Promise.all([brandLogoDir, mirroredBrandLogoDir].map((directory) => fs.mkdir(directory, { recursive: true })));
    await Promise.all([
      fs.writeFile(path.join(brandLogoDir, fileName), logo.buffer),
      fs.writeFile(path.join(mirroredBrandLogoDir, fileName), logo.buffer),
    ]);

    const projectRecord = db.projects.find((record) => record.id === projectId);
    if (!projectRecord) return notFound(req, res);
    projectRecord.settings ||= {};
    projectRecord.settings.brandingLogoUrl = publicUrl;
    projectRecord.settings.brandingUpdatedAt = new Date(cacheToken).toISOString();
    await writeDb(db);
    return send(req, res, 200, { ...projectPayload(db, projectId), brandingLogoUrl: publicUrl });
  }

  if (req.method === "PUT" && child === "input-table-cell") {
    const patch = await bodyJson(req);
    if (!patch.sheetName || !patch.address) return badRequest(req, res, "sheetName and address are required");
    const table = inputTableBySheet(db, projectId, patch.sheetName);
    if (!table) return notFound(req, res);
    let updated = false;
    for (const row of table.rows || []) {
      const cell = (row.cells || []).find((item) => item.address === patch.address);
      if (!cell) continue;
      cell.value = patch.value ?? "";
      if (Number.isFinite(Number(cell.value)) && cell.value !== "") {
        const style = new Set(String(cell.style || "").split(/\s+/).filter(Boolean));
        style.add("number");
        cell.style = Array.from(style).join(" ");
      }
      updated = true;
      break;
    }
    if (!updated) return notFound(req, res);
    updateInputRecordForCell(db, projectId, patch.sheetName, patch.address, patch.value ?? "");
    const run = recalculateProjectFormulas(db, projectId, { mode: "input_change" });
    await writeDb(db);
    return send(req, res, 200, { ...projectPayload(db, projectId), calculationRun: run });
  }

  if (req.method === "POST" && child === "input-table-rows") {
    const patch = await bodyJson(req);
    if (!patch.sheetName) return badRequest(req, res, "sheetName is required");
    const table = inputTableBySheet(db, projectId, patch.sheetName);
    if (!table) return notFound(req, res);
    const row = nextInputTableRow(table);
    if (Array.isArray(patch.values)) {
      row.cells.forEach((cell, index) => {
        if (patch.values[index] !== undefined) cell.value = patch.values[index];
      });
    }
    table.rows ||= [];
    table.rows.push(row);
    table.rowCount = table.rows.length;
    await writeDb(db);
    return send(req, res, 200, projectPayload(db, projectId));
  }

  if (req.method === "DELETE" && child === "input-table-rows") {
    const patch = await bodyJson(req);
    if (!patch.sheetName || patch.sourceRow === undefined) return badRequest(req, res, "sheetName and sourceRow are required");
    const table = inputTableBySheet(db, projectId, patch.sheetName);
    if (!table) return notFound(req, res);
    const before = table.rows?.length || 0;
    table.rows = (table.rows || []).filter((row) => Number(row.sourceRow) !== Number(patch.sourceRow));
    if (table.rows.length === before) return notFound(req, res);
    table.rowCount = table.rows.length;
    await writeDb(db);
    return send(req, res, 200, projectPayload(db, projectId));
  }

  if (req.method === "PUT" && child === "inputs") {
    const patch = await bodyJson(req);
    if (!patch.id) return badRequest(req, res, "Input id is required");
    const item = db.inputRecords.find((record) => record.id === patch.id && record.projectId === projectId);
    if (!item) return notFound(req, res);
    Object.assign(item, {
      value: patch.value ?? item.value,
      label: patch.label ?? item.label,
      status: patch.status ?? item.status,
      updatedAt: new Date().toISOString(),
    });
    const model = db.models.find((record) => record.id === payload.project.modelId);
    const metricKey = patch.metricKey;
    if (metricKey && Object.hasOwn(model.metrics, metricKey)) {
      model.metrics[metricKey] = Number(patch.value);
    }
    const settingKey = patch.settingKey;
    if (settingKey) {
      const projectRecord = db.projects.find((record) => record.id === projectId);
      projectRecord.settings ||= {};
      projectRecord.settings[settingKey] = patch.value;
    }
    applyInputReportLinks(db, projectId, item);
    const run = recalculateProjectFormulas(db, projectId, { mode: "input_change" });
    await writeDb(db);
    return send(req, res, 200, { ...projectPayload(db, projectId), calculationRun: run });
  }

  if (req.method === "PUT" && child === "formulas") {
    const patch = await bodyJson(req);
    if (!patch.id) return badRequest(req, res, "Formula id is required");
    const item = db.formulaRules.find((record) => record.id === patch.id && record.projectId === projectId);
    if (!item) return notFound(req, res);
    Object.assign(item, {
      formula: patch.formula ?? item.formula,
      dependencies: extractFormulaDependencies(patch.formula ?? item.formula, item.sheetName),
      status: "draft_pending_approval",
      updatedAt: new Date().toISOString(),
    });
    await writeDb(db);
    return send(req, res, 200, projectPayload(db, projectId));
  }

  if (req.method === "POST" && child === "formula-publish") {
    const patch = await bodyJson(req);
    if (!patch.id) return badRequest(req, res, "Formula id is required");
    const item = db.formulaRules.find((record) => record.id === patch.id && record.projectId === projectId);
    if (!item) return notFound(req, res);
    Object.assign(item, {
      formula: patch.formula ?? item.formula,
      dependencies: extractFormulaDependencies(patch.formula ?? item.formula, item.sheetName),
      status: "published_approved",
      approvedBy: patch.approvedBy || "admin",
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const run = recalculateProjectFormulas(db, projectId, { mode: "publish_formula", focusIds: [item.id] });
    await writeDb(db);
    return send(req, res, 200, { ...projectPayload(db, projectId), calculationRun: run });
  }

  if (req.method === "POST" && child === "calculation-run") {
    const run = recalculateProjectFormulas(db, projectId, { mode: "full_recalculation" });
    await writeDb(db);
    return send(req, res, 200, { ...projectPayload(db, projectId), calculationRun: run });
  }

  return notFound(req, res);
}

async function staticFile(req, res, url) {
  let filePath = ["/", "/app"].includes(url.pathname) ? "/index.html" : decodeURIComponent(url.pathname);
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const absolute = path.join(publicRoot, filePath);
  if (!absolute.startsWith(publicRoot)) return notFound(req, res);
  try {
    const data = await fs.readFile(absolute);
    const ext = path.extname(absolute);
    const cacheControl = [".css", ".js", ".png", ".svg", ".json"].includes(ext)
      ? "public, max-age=60, stale-while-revalidate=300"
      : "no-cache";
    send(req, res, 200, data, mime[ext] || "application/octet-stream", { cacheControl });
  } catch {
    if (!path.extname(filePath)) {
      const data = await fs.readFile(path.join(publicRoot, "index.html"));
      return send(req, res, 200, data, mime[".html"], { cacheControl: "no-cache" });
    }
    notFound(req, res);
  }
}

async function publicIconFile(req, res, url) {
  if (!publicIconPaths.has(url.pathname)) return false;
  const filePath = url.pathname === "/favicon.ico" ? "/public/agrinexus-favicon-32.png" : decodeURIComponent(url.pathname);
  const absolute = path.join(publicRoot, path.normalize(filePath).replace(/^(\.\.[/\\])+/, ""));
  if (!absolute.startsWith(publicRoot)) return false;
  try {
    const data = await fs.readFile(absolute);
    const ext = path.extname(absolute);
    send(req, res, 200, data, mime[ext] || "application/octet-stream", {
      cacheControl: "public, max-age=60, stale-while-revalidate=300",
    });
  } catch {
    notFound(req, res);
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    if (req.method === "GET" && await publicIconFile(req, res, url)) return;
    if (url.pathname === "/" && req.method === "GET") return sendLoginPage(req, res, 200, "", "/app");
    if (url.pathname === "/app/") {
      res.writeHead(301, { Location: "/app", "Cache-Control": "no-store" });
      return res.end();
    }
    if (url.pathname === "/login") return await handleLogin(req, res, url);
    if (url.pathname === "/logout") return handleLogout(req, res);
    if (!hasValidSession(req)) {
      if (url.pathname.startsWith("/api/")) {
        return send(req, res, 401, { message: "Authentication required" }, "application/json; charset=utf-8", { cacheControl: "no-store" });
      }
      return sendLoginPage(req, res, 200, "", `${url.pathname}${url.search}`);
    }
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    return await staticFile(req, res, url);
  } catch (error) {
    send(req, res, 500, { message: error.message }, "application/json; charset=utf-8", { cacheControl: "no-store" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Plantation Financial Model running at http://127.0.0.1:${port}/`);
});
