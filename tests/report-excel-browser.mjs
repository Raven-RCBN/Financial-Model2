// Read-only financial report tests against an isolated copy of the seeded database.
// All browser network traffic is intercepted; no production requests or writes.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fm2-excel-test-"));
await fs.copyFile("data/plantation-financial-model.db.json", path.join(directory, "db.json"));
const base = "http://127.0.0.1:43193", origin = "https://fm2.digitalpalm.ai";
const child = spawn(process.execPath, ["server.mjs"], {
  env: { ...process.env, PORT: "43193", FM2_DB_PATH: path.join(directory, "db.json"), FM2_AUTH_USER: "finance-test",
    FM2_AUTH_PASSWORD: "Synthetic-Excel-Test-Only", FM2_AUDIT_FREEZE: "0", FM2_MONGODB_URI: "", MONGODB_URI: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
try {
  await new Promise((resolve, reject) => {
    child.stdout.on("data", data => { if (String(data).includes("running at")) resolve(); });
    child.on("exit", code => reject(new Error(`Server exited ${code}`)));
    setTimeout(() => reject(new Error("Startup timeout")), 10000).unref();
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const login = await fetch(base + "/login", { method: "POST", redirect: "manual",
    body: new URLSearchParams({ userid: "finance-test", password: "Synthetic-Excel-Test-Only" }) });
  assert.equal(login.status, 303);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.includes("cpo-market") || url.pathname.endsWith("/market-ticker")) {
      return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    }
    const response = await route.fetch({ url: base + url.pathname + url.search,
      headers: { ...route.request().headers(), cookie }, maxRedirects: 0 });
    await route.fulfill({ response });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { errors.push(dialog.message()); await dialog.dismiss(); });
  await page.goto(origin + "/app");
  await page.waitForSelector(".report-card", { state: "attached" });
  await page.locator('[data-view="dashboards"]').click();

  async function download(button = "#downloadReport") {
    const pending = page.waitForEvent("download");
    await page.locator(button).click();
    const item = await pending;
    assert.ok(item.suggestedFilename().endsWith(".xlsx"));
    const destination = path.join(directory, item.suggestedFilename());
    await item.saveAs(destination);
    const bytes = await fs.readFile(destination);
    assert.equal(bytes.subarray(0, 2).toString(), "PK", "Must be a real zipped XLSX, not CSV/HTML renamed");
    await page.waitForFunction(() => !document.querySelector("#downloadReport").disabled);
    return { destination, bytes };
  }

  await page.locator('[data-report="Balance Sheet"]').click();
  const first = await download();
  // Independently compare every exported cell to the report currently on screen,
  // including raw numbers, negative display, title merges and all offscreen years.
  async function verify(bytes) {
    return page.evaluate(async bytes => {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(new Uint8Array(bytes));
      const sheet = workbook.worksheets[0];
      const root = document.querySelector("#reportDetail .report-output");
      const titles = Array.from(root.querySelectorAll(".workbook-report-title > *"), el => el.textContent.trim());
      const domRows = Array.from(root.querySelector("table").rows);
      const failures = [];
      titles.forEach((title, index) => {
        if (sheet.getCell(index + 1, 1).value !== title) failures.push(`Title ${index}`);
      });
      domRows.forEach((row, index) => {
        let column = 1;
        for (const domCell of row.cells) {
          const cell = sheet.getCell(titles.length + index + 1, column);
          const text = domCell.textContent.trim();
          if (typeof cell.value === "number") {
            const displayed = text === "-" ? 0 : Number(text.replace(/[(),]/g, "")) * (text.startsWith("(") ? -1 : 1);
            if (Math.abs(cell.value - displayed) > 0.000051) failures.push(`Number ${cell.address}: ${text}`);
          } else if ((cell.value ?? "") !== text) failures.push(`Text ${cell.address}`);
          const css = getComputedStyle(domCell);
          const rgb = css.color.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
          if (rgb) {
            const expected = "FF" + rgb.slice(1).map(n => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
            if (cell.font.color.argb !== expected) failures.push(`Colour ${cell.address}`);
          }
          column += domCell.colSpan;
        }
      });
      return { failures, rowCount: sheet.rowCount, expectedRows: titles.length + domRows.length,
        columnCount: sheet.columnCount, firstYear: sheet.getCell("D5").value, lastYear: sheet.getCell(5, sheet.columnCount).value,
        firstPeriod: sheet.getCell("D4").value, firstPeriodFormat: sheet.getCell("D4").numFmt,
        frozen: sheet.views[0], merged: sheet.getCell("B1").isMerged,
        titleFill: sheet.getCell("A1").fill.fgColor.argb,
        titleEndFill: sheet.getCell(1, sheet.columnCount).fill.fgColor.argb,
        emptyYearHeader: sheet.getCell("A5").value,
        ppe: sheet.getCell("D7").value,
        sourcePpe: state.projectData.reportTables.find(t => t.sheetName === "Balance Sheet")?.rows.find(r => r.label === "PPE")?.values[0],
      };
    }, [...bytes]);
  }
  const balance = await verify(first.bytes);
  assert.deepEqual(balance.failures, []);
  assert.equal(balance.rowCount, balance.expectedRows);
  assert.equal(balance.columnCount, 30);
  assert.equal(balance.firstYear, 2026);
  assert.equal(balance.lastYear, 2052);
  assert.equal(balance.firstPeriod, 0);
  assert.equal(balance.firstPeriodFormat, '0;(0);0');
  assert.equal(balance.ppe, Number(balance.sourcePpe));
  assert.equal(balance.merged, true);
  assert.equal(balance.titleEndFill, balance.titleFill);
  assert.equal(balance.emptyYearHeader, null);
  assert.equal(balance.frozen.xSplit, 3);
  assert.equal(balance.frozen.ySplit, 5);
  await page.screenshot({ path: path.join(directory, "balance-sheet-screen.png"), fullPage: false });
  await page.locator("#viewReport").click();
  const modal = await download("#modalDownloadReport");
  assert.deepEqual((await verify(modal.bytes)).failures, []);
  await page.locator("#closeReportModal").click();

  // Cover every report variant, including compact worksheet grids and fallback reports.
  const names = await page.locator("[data-report]").evaluateAll(nodes => nodes.map(node => node.dataset.report));
  for (const name of names.filter(name => name !== "Balance Sheet")) {
    await page.locator("[data-report]").filter({ hasText: name }).first().click();
    // Exact selection avoids overlapping names such as Year 1 and Year 1 Budget.
    await page.evaluate(name => { state.selectedReport = name; renderReports(); }, name);
    const file = await download();
    const result = await verify(file.bytes);
    assert.deepEqual(result.failures, [], name);
    assert.equal(result.rowCount, result.expectedRows, name);
  }
  // Text must stay inert, and blank/zero/negative/fractional values stay distinct.
  await page.evaluate(() => {
    state.selectedReport = "Balance Sheet";
    const table = state.projectData.reportTables.find(t => t.sheetName === "Balance Sheet");
    table.rows.push({ label: '=HYPERLINK("https://example.test","literal")', values: [0, null, -1234.56789, 0.000001, 12.5] });
    renderReports();
  });
  const edge = await download();
  const edgeResult = await page.evaluate(async bytes => {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(new Uint8Array(bytes));
    const row = wb.worksheets[0].lastRow;
    return { label: row.getCell(1).value, zero: row.getCell(4).value, blank: row.getCell(5).value,
      negative: row.getCell(6).value, negativeFormat: row.getCell(6).numFmt,
      tiny: row.getCell(7).value, tinyFormat: row.getCell(7).numFmt };
  }, [...edge.bytes]);
  assert.equal(typeof edgeResult.label, "string");
  assert.equal(edgeResult.zero, 0);
  assert.equal(edgeResult.blank, "-");
  assert.equal(edgeResult.negative, -1234.56789);
  assert.equal(edgeResult.negativeFormat, '#,##0.0000;(#,##0.0000);"-"');
  assert.equal(edgeResult.tiny, 0.000001);
  assert.equal(edgeResult.tinyFormat, '"-"');
  assert.deepEqual(errors, []);
  await context.unrouteAll({ behavior: "wait" });
  console.log(`PASS: ${names.length} reports, main and preview XLSX downloads, values/styles/all periods, frozen headings, numeric precision and inert text.`);
  console.log(`Test downloads and screenshot: ${directory}`);
} finally {
  await browser?.close();
  child.kill();
  await new Promise(resolve => child.exitCode !== null ? resolve() : child.once("exit", resolve));
  await fs.rm(path.join(directory, "db.json"), { force: true });
}
