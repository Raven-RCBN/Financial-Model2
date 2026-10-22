import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const SESSION_COOKIE = "fm2_advisory_session";
const STATE_COOKIE = "fm2_advisory_state";
const validToken = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? [] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter((entry) => entry.length));
}
function same(left, right) {
  return validToken(left) && validToken(right) && crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
function trustedUrl(value, production, originOnly = false) {
  const url = new URL(value);
  if (url.username || url.password || url.hash || (originOnly && url.origin !== value)
    || (url.protocol !== "https:" && !(production === false && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new Error("Advisory SSO URLs must use HTTPS (loopback HTTP is allowed locally).");
  }
  return url;
}
export function readAdvisoryConfig(env = process.env) {
  if (env === process.env) {
    try {
      const saved = JSON.parse(readFileSync(env.FM2_SSO_CONFIG_PATH || "/var/lib/fm2/advisory-sso.json", "utf8"));
      env = { ...saved, ...env };
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error("Unable to load FM2 Advisory SSO configuration.");
    }
  }
  if (env.FM2_SSO_ENABLED !== "true") return null;
  const production = env.NODE_ENV === "production";
  const origin = trustedUrl(env.ADVISORY_ORIGIN, production, true).origin;
  const fm2Origin = trustedUrl(env.FM2_ORIGIN, production, true).origin;
  const mainMenu = trustedUrl(env.ADVISORY_MAIN_MENU_URL || `${origin}/`, production);
  if (mainMenu.origin !== origin) throw new Error("The Main Menu URL must belong to Advisory.");
  if (String(env.FM2_SSO_SECRET || "").length < 32) throw new Error("A dedicated FM2 SSO secret of at least 32 characters is required.");
  return { origin, fm2Origin, mainMenu: mainMenu.href, secret: env.FM2_SSO_SECRET };
}

// Allow only the screens, assets and read APIs required for Overview and Reports.
export function advisoryRequestAllowed(method, pathname, session) {
  if (method !== "GET") return false;
  if (["/app", "/advisory-view", "/api/session", "/api/cpo-market", "/api/cpo-market/pdf",
    "/styles.css", "/app.js", "/report-excel.js", "/public-cpo-data.json", "/public/workbook-analysis.json", "/vendor/exceljs-4.4.0.min.js"].includes(pathname)) return true;
  if (/^\/public\/[a-zA-Z0-9_.-]+\.(png|jpeg|jpg|webp|svg|ico)$/.test(pathname)) return true;
  const project = pathname.match(/^\/api\/projects\/([^/]+)(?:\/(summary|summaries|reports|report-pdf|market-ticker))?$/);
  return Boolean(project && session.projectIds?.includes(project[1]));
}

export function overviewReportPayload(payload) {
  // Keep outputs used by the overview and report renderers; omit editable source records.
  return {
    company: payload.company,
    project: payload.project,
    model: payload.model,
    ratios: payload.ratios,
    ifrsReports: payload.ifrsReports,
    reportSnapshots: payload.reportSnapshots,
    reportTables: payload.reportTables,
    transactions: payload.transactions,
    marketData: payload.marketData,
    inputRecords: [], inputTables: [], formulaRules: [],
  };
}

export function createAdvisorySso({ config = readAdvisoryConfig(), fetchImpl = fetch } = {}) {
  const secure = config?.fm2Origin.startsWith("https:");
  // None is needed when Advisory uses agrinexus.ai and FM2 uses digitalpalm.ai.
  // Browsers that block third-party cookies can use the same launch in a new tab.
  const cookieFlags = `Path=/; HttpOnly; SameSite=${secure ? "None; Secure" : "Lax"}`;
  const cookie = (name, value, maxAge) => `${name}=${value}; ${cookieFlags}; Max-Age=${maxAge}`;
  function redirect(res, url, setCookies = []) {
    res.writeHead(303, { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...(setCookies.length ? { "Set-Cookie": setCookies } : {}) });
    res.end();
    return true;
  }
  function fail(res, status, message) {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ message }));
    return true;
  }
  async function backchannel(body) {
    const response = await fetchImpl(`${config.origin}/api/fm2/backchannel`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.secret}` },
      body: JSON.stringify(body),
    });
    return response.ok ? response.json() : null;
  }
  return {
    async handle(req, res, url) {
      const jar = cookies(req);
      // Presence is authoritative: never fall back to an existing native FM2 admin cookie.
      req.advisoryAccess = Object.hasOwn(jar, SESSION_COOKIE);
      const isBridgePath = url.pathname.startsWith("/auth/advisory/") || url.pathname === "/advisory-main-menu" || url.pathname === "/advisory-view";
      if (!config) return isBridgePath || req.advisoryAccess ? fail(res, 503, "Advisory sign-in is not configured on FM2.") : false;
      if (url.pathname === "/advisory-launch.js" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/javascript", "Cache-Control": "no-store" });
        res.end('const launch = document.getElementById("advisory-launch"); if (window.parent !== window) window.parent.postMessage({type:"digitalpalm:fm2-ready",state:launch.dataset.state},launch.dataset.origin);');
        return true;
      }
      if (url.pathname === "/advisory-main-menu" && req.method === "GET") return redirect(res, config.mainMenu);
      if (url.pathname === "/auth/advisory/start" && req.method === "GET") {
        const state = crypto.randomBytes(32).toString("base64url");
        if (url.searchParams.get("embedded") === "1") {
          const origin = config.origin.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Set-Cookie": cookie(STATE_COOKIE, state, 120), "Content-Security-Policy": `default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; frame-ancestors ${config.origin}` });
          res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Connecting to FM2</title></head><body><main id="advisory-launch" data-state="${state}" data-origin="${origin}" style="padding:24px;font-family:system-ui;color:#174f2c">Connecting with your Advisory login…</main><script src="/advisory-launch.js"></script></body></html>`);
          return true;
        }
        return redirect(res, `${config.origin}/api/fm2/authorize?${new URLSearchParams({ state })}`, [cookie(STATE_COOKIE, state, 120)]);
      }
      if (url.pathname === "/auth/advisory/callback" && req.method === "GET") {
        const state = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        if (!same(jar[STATE_COOKIE], state) || !validToken(code)) return fail(res, 401, "Sign-in request expired. Open FM2 from the Advisory card again.");
        const result = await backchannel({ action: "redeem", code, state });
        if (!result || !validToken(result.session) || !Number.isFinite(result.expiresAt) || result.expiresAt <= Date.now()) return fail(res, 401, "Advisory sign-in expired.");
        return redirect(res, "/advisory-view", [
          cookie(STATE_COOKIE, "", 0),
          cookie(SESSION_COOKIE, result.session, Math.min(43200, Math.floor((result.expiresAt - Date.now()) / 1000))),
        ]);
      }
      if (url.pathname === "/advisory-view" && !req.advisoryAccess) return redirect(res, "/auth/advisory/start");
      if (!req.advisoryAccess) return isBridgePath ? fail(res, 404, "Not found") : false;
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Security-Policy", `frame-ancestors 'self' ${config.origin}`);
      const session = validToken(jar[SESSION_COOKIE]) ? await backchannel({ action: "introspect", session: jar[SESSION_COOKIE] }) : null;
      if (!session || session.source !== "advisory" || session.role !== "viewer" || session.expiresAt <= Date.now()) {
        res.setHeader("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
        return fail(res, 401, "Your Advisory session ended or access changed. Return to Main Menu and sign in again.");
      }
      req.advisorySession = { ...session, mainMenuUrl: config.mainMenu, permissions: { add: false, edit: false, delete: false }, views: ["overview", "dashboards"] };
      // A valid Advisory viewer opening the site root should land in its permitted workspace.
      if (req.method === "GET" && ["/", "/app/"].includes(url.pathname)) return redirect(res, "/advisory-view");
      if (!advisoryRequestAllowed(req.method, url.pathname, session)) return fail(res, 403, "Access from Advisory is limited to viewing Overview and Reports.");
      return false;
    },
  };
}
