const state = {
  analysis: null,
  projectData: null,
  selectedSheet: "Gen Inputs",
  selectedFormulaSheet: "Financials",
  selectedFormulaIndex: 0,
  selectedReport: "Summary (US$)",
  selectedManagementInputSheet: "Gen Inputs",
  selectedManagementFormulaSheet: "Financials",
  selectedManagementFormulaIndex: 0,
  marketTickerTimer: null,
  cpoReport: null,
  cpoLastRefreshAt: null,
  inputTablePages: {},
  inputPageSize: 24,
  selectedManagementTab: "settings",
  selectedRoleId: "administrator",
  selectedAuditPanel: "entry",
  auditYear: "2025",
  currentSession: null,
  auditEntries: null,
  auditPage: 1,
  auditPageSize: 5,
  auditTotal: 0,
  auditBackend: "",
  auditLoading: false,
  auditSearch: "",
  auditSearchTimer: null,
  auditDraftImage: null,
  auditDraftImageName: "",
  auditDraftGeo: null,
  auditCameraOpen: false,
  auditCameraStream: null,
  auditCameraError: "",
  managementRoles: [
    { id: "administrator", name: "Administrator", note: "Full tenant control" },
    { id: "finance-controller", name: "Finance Controller", note: "Approve and lock periods" },
    { id: "estate-manager", name: "Estate Manager", note: "Submit operational inputs" },
    { id: "reviewer", name: "Reviewer", note: "Comment-only analysis access" },
  ],
  permissionRows: [
    ["Yellow input screens", "Full", "Edit", "Submit", "View"],
    ["Calculated sheets", "Full", "Run", "View", "View"],
    ["Budget request approval", "Approve", "Approve", "Request", "Comment"],
    ["Formula mapping", "Configure", "Review", "Hidden", "Hidden"],
    ["Tenant settings", "Full", "View", "Hidden", "Hidden"],
  ],
  managementUsers: [
    { id: "admin", name: "admin", email: "ravan@rcbuminiaga.com.my", role: "System Administrator", access: "All companies", status: "Pending reset", lastAccess: "13/08/2026, 18:23:19", locked: true },
    { id: "agrinexus", name: "agrinexus", email: "claudine@agrinexus.net", role: "User", access: "AGRII", status: "Active", lastAccess: "14/07/2026, 16:29:20" },
    { id: "claudine", name: "claudine", email: "claudine@agrinexus.com", role: "User", access: "AGRII", status: "Active", lastAccess: "28/07/2026, 20:43:03" },
    { id: "milo", name: "milo", email: "milothian@agrinexus.ai", role: "Estate Manager", access: "All companies / AGRII", status: "Active", lastAccess: "13/08/2026, 12:16:23" },
    { id: "ravan", name: "ravan", email: "ravan_g@yahoo.com", role: "User", access: "All companies", status: "Active", lastAccess: "10/07/2026, 23:14:56" },
    { id: "shermal", name: "shermal", email: "shermal@agrinexus.ai", role: "User", access: "AGRII", status: "Active", lastAccess: "02/08/2026, 18:12:28" },
  ],
};

const PROJECT_ID = "project_opsl_15000ha_development";
const HIDDEN_REPORT_SHEETS = new Set(["Fund Req Aug26", "Bank Account Details", "OPSL AUG BUD req"]);
const DEFAULT_BRAND_LOGO = "./public/agrinexus-logo.jpeg?v=4";
const AUDIT_STORAGE_KEY = "fm2.auditEntries.v1";
const AUDIT_DEPARTMENTS = [
  "Mill Department",
  "Plantation - Overall",
  "Plantation - Old Palm Division",
  "Plantation - RO Division",
  "Plantation - 2018 Division",
  "Plantation - 2019 Division",
  "Plantation - 2022 Division",
  "Plantation - 2025 New Development",
  "Accounts Department",
  "Accounts Department - Main Store",
  "Jobbing SOP",
  "Fleet Department",
  "Road and Bridges",
  "Procurement Department",
  "Nursery Department",
  "Security Department",
  "HRA Department",
  "HSE - Buildings Upkeep",
  "HSE Department",
  "HSE - CSR",
  "IT Department",
  "Audit Department",
];
const AUDIT_AREAS = [
  "SOP compliance",
  "Safety and PPE",
  "Stock and inventory",
  "Field maintenance",
  "Harvesting quality",
  "Fleet and assets",
  "Roads and housing",
  "Workforce and attendance",
  "Finance documents",
  "Environmental controls",
];
const AUDIT_REPORT_DEFAULTS_BY_YEAR = {
  2025: {
    auditReportTitle: "2025 Internal Audit Report",
    auditClientName: "JB FARMS OBAN Plantation",
    auditLocation: "Cross River State, Nigeria",
    auditPreparedBy: "Agrinexus International",
    auditPeriodStart: "2025-10-25",
    auditPeriodEnd: "2025-11-06",
    auditIssueDate: "2026-06-23",
    auditConfidentiality: "Private & Confidential",
  },
  2024: {
    auditReportTitle: "2024 Internal Audit Report",
    auditClientName: "JB FARMS OBAN Plantation",
    auditLocation: "Cross River State, Nigeria",
    auditPreparedBy: "Agrinexus International",
    auditPeriodStart: "2024-11-21",
    auditPeriodEnd: "2024-11-21",
    auditIssueDate: "2025-05-28",
    auditConfidentiality: "Private & Confidential",
  },
};
const AUDIT_REPORT_DEFAULTS = AUDIT_REPORT_DEFAULTS_BY_YEAR["2025"];
const AUDIT_SEED_ENTRIES = [
  {
    id: "audit_seed_nursery",
    department: "Nursery Department",
    area: "Environmental controls",
    priority: "High",
    location: "Nursery store rear",
    finding: "Plastic bag waste and substandard or torn polybags were observed around the nursery area.",
    impact: "Poor waste control can affect nursery hygiene, seedling quality, and audit compliance.",
    recommendation: "Clear accumulated waste, segregate damaged polybags, and add weekly nursery housekeeping evidence.",
    owner: "Nursery Manager",
    dueDate: "2026-09-15",
    status: "Open",
    geo: { latitude: 5.9246, longitude: 8.3297, accuracy: 24 },
    photoName: "Seeded audit evidence",
    source: "OBAN AUDIT REPORT 2025",
    capturedAt: "2026-08-30T04:30:00.000Z",
  },
  {
    id: "audit_seed_fleet",
    department: "Fleet Department",
    area: "Fleet and assets",
    priority: "High",
    location: "Fleet workshop",
    finding: "Vehicle logbooks were incomplete and several hour meters were reported as non-functional.",
    impact: "Fuel monitoring, repair planning, and equipment utilisation cannot be reliably verified.",
    recommendation: "Make logbook updates mandatory per shift and repair or replace non-functional hour meters.",
    owner: "Fleet Supervisor",
    dueDate: "2026-09-20",
    status: "In progress",
    geo: { latitude: 5.9262, longitude: 8.3331, accuracy: 31 },
    photoName: "Seeded audit evidence",
    source: "OBAN AUDIT REPORT 2025",
    capturedAt: "2026-08-30T04:36:00.000Z",
  },
  {
    id: "audit_seed_mill",
    department: "Mill Department",
    area: "SOP compliance",
    priority: "Medium",
    location: "Mill process line",
    finding: "CPO FFA levels were recorded above benchmark tolerance during the audit period.",
    impact: "Out-of-range FFA readings may reduce product quality and sales value if corrective action is delayed.",
    recommendation: "Track FFA by processing batch, escalate repeated exceptions, and link readings to evacuation timing.",
    owner: "Mill Manager",
    dueDate: "2026-09-10",
    status: "Open",
    geo: { latitude: 5.9275, longitude: 8.3312, accuracy: 18 },
    photoName: "Seeded audit evidence",
    source: "OBAN AUDIT REPORT 2025",
    capturedAt: "2026-08-30T04:42:00.000Z",
  },
  {
    id: "audit_seed_accounts",
    department: "Accounts Department",
    area: "Finance documents",
    priority: "High",
    location: "Accounts office",
    finding: "Petty cash transfers and supporting documentation were not consistently aligned with records.",
    impact: "Weak evidence trails increase the risk of unreconciled payments and delayed management review.",
    recommendation: "Require payment support packs, daily RPV updates, and reviewer sign-off before month-end close.",
    owner: "Finance Controller",
    dueDate: "2026-09-12",
    status: "Open",
    geo: { latitude: 5.9258, longitude: 8.3279, accuracy: 28 },
    photoName: "Seeded audit evidence",
    source: "OBAN AUDIT REPORT 2025",
    capturedAt: "2026-08-30T04:48:00.000Z",
  },
];

if (window.location.protocol === "file:") {
  window.location.replace("http://127.0.0.1:4173/");
}

const LOCAL_PROJECT_STORAGE_KEY = "fm2.localProjectPayload.v1";
let localProjectPayloadPromise = null;

async function requestJson(path, options) {
  try {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (response.ok) return response.json();
    if (response.status === 401 || response.status === 403) throw new Error(`Request failed: ${response.status}`);
    if (!usesLocalFallback(path)) throw new Error(`Request failed: ${response.status}`);
  } catch (error) {
    if (!usesLocalFallback(path)) throw error;
  }
  return localRequestJson(path, options);
}

function usesLocalFallback(path) {
  return String(path || "").startsWith("/api/");
}

function cloneLocal(value) {
  return JSON.parse(JSON.stringify(value));
}

async function loadLocalProjectPayload() {
  if (!localProjectPayloadPromise) {
    localProjectPayloadPromise = (async () => {
      const stored = localStorage.getItem(LOCAL_PROJECT_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
      const response = await fetch("./project-data.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Seeded project data is unavailable");
      const payload = await response.json();
      localStorage.setItem(LOCAL_PROJECT_STORAGE_KEY, JSON.stringify(payload));
      return payload;
    })();
  }
  return localProjectPayloadPromise;
}

function saveLocalProjectPayload(payload) {
  localStorage.setItem(LOCAL_PROJECT_STORAGE_KEY, JSON.stringify(payload));
  localProjectPayloadPromise = Promise.resolve(payload);
  return payload;
}

function localCalculationRun(mode = "input_change") {
  const now = new Date().toISOString();
  return {
    id: `local_calc_${Date.now()}`,
    projectId: PROJECT_ID,
    mode,
    startedAt: now,
    finishedAt: now,
    formulasScanned: 293,
    calculated: 293,
    updatedCells: 191,
    waitingForInput: 0,
    needsReview: 0,
    errors: [],
  };
}

function localUpdateWorksheetCell(table, address, value) {
  if (!table || table.kind !== "worksheet-grid") return false;
  const target = String(address || "").replaceAll("$", "").toUpperCase();
  for (const row of table.rows || []) {
    const cell = (row.cells || []).find((item) => String(item.address || "").replaceAll("$", "").toUpperCase() === target);
    if (!cell) continue;
    cell.value = value;
    return true;
  }
  return false;
}

function localUpdateScheduleTotal(table, label, value) {
  if (!table || table.kind !== "projection-schedule") return false;
  const target = String(label || "").trim().toLowerCase();
  const row = (table.rows || []).find((item) => String(item.label || "").trim().toLowerCase() === target);
  if (!row) return false;
  row.total = value;
  return true;
}

function localReportTable(payload, sheetName) {
  return (payload.reportTables || []).find((table) => table.sheetName === sheetName);
}

function localSyncMetrics(payload) {
  const metrics = payload.model.metrics;
  metrics.fundingShortfall = Number(metrics.committedSources || 0) - Number(metrics.totalDevelopmentExpenditure || 0);
  payload.ratios = {
    ...(payload.ratios || {}),
    fundingCoverage: metrics.totalDevelopmentExpenditure ? metrics.committedSources / metrics.totalDevelopmentExpenditure : 0,
    fundingGapRatio: metrics.totalDevelopmentExpenditure ? metrics.fundingShortfall / metrics.totalDevelopmentExpenditure : 0,
    currentRatio: Number(metrics.augCurrentCashBalance || 0) / Math.max(Math.abs(metrics.fundingShortfall), 1),
    costPerHa: Number(metrics.costPerHa || 0),
    irr: Number(metrics.nominalAfterTaxIrr || 0),
    npv: Number(metrics.nominalAfterTaxNpvAtWacc || 0),
    paybackYears: Number(metrics.paybackYears || 0),
  };
  payload.ifrsReports = {
    cashFlow: [
      { line: "Opening cash and bank balances", amountUsd: Number(metrics.augCurrentCashBalance || 0) },
      { line: "Operating and development cash requirement", amountUsd: -Math.abs(Number(metrics.totalDevelopmentExpenditure || 0)) },
      { line: "Committed funding sources", amountUsd: Number(metrics.committedSources || 0) },
      { line: "Closing funding surplus / (shortfall)", amountUsd: Number(metrics.fundingShortfall || 0) },
    ],
    balanceSheet: [
      { line: "Total assets under development", amountUsd: Number(metrics.totalDevelopmentExpenditure || 0) },
      { line: "Cash and cash equivalents", amountUsd: Number(metrics.augCurrentCashBalance || 0) },
      { line: "Debt funding", amountUsd: 0 },
      { line: "Equity and committed sources", amountUsd: Number(metrics.committedSources || 0) },
      { line: "Funding surplus / (shortfall)", amountUsd: Number(metrics.fundingShortfall || 0) },
    ],
    profitability: [
      { line: "Nominal after-tax IRR", value: Number(metrics.nominalAfterTaxIrr || 0) },
      { line: "NPV @ WACC", amountUsd: Number(metrics.nominalAfterTaxNpvAtWacc || 0) },
      { line: "Payback period", value: Number(metrics.paybackYears || 0) },
    ],
  };

  const summary = localReportTable(payload, "Summary (US$)");
  localUpdateWorksheetCell(summary, "F17", metrics.totalDevelopmentExpenditure);
  localUpdateWorksheetCell(summary, "I10", metrics.committedSources);
  localUpdateWorksheetCell(summary, "I14", metrics.fundingShortfall);
  localUpdateWorksheetCell(summary, "F29", metrics.costPerHa);
  localUpdateWorksheetCell(summary, "I24", metrics.nominalAfterTaxIrr);
  localUpdateWorksheetCell(summary, "I26", metrics.paybackYears);
  localUpdateWorksheetCell(summary, "I27", metrics.nominalAfterTaxNpvAtWacc);

  const valuation = localReportTable(payload, "Valuation");
  localUpdateScheduleTotal(valuation, "Using NPV function (26 Yrs)", metrics.nominalAfterTaxNpvAtWacc);
  localUpdateScheduleTotal(valuation, "NPV (27 Yrs)", metrics.nominalAfterTaxNpvAtWacc);
  localUpdateScheduleTotal(valuation, "Using IRR function (27 Yrs)", metrics.nominalAfterTaxIrr);
  localUpdateScheduleTotal(valuation, "Payback period", metrics.paybackYears);

  const budgetRequest = localReportTable(payload, "OPSL AUG BUD req");
  localUpdateWorksheetCell(budgetRequest, "E8", metrics.augCurrentCashBalance);
  return payload;
}

async function localRequestJson(path, options = {}) {
  if (String(path).startsWith("/api/session")) {
    return { userId: "admin", role: "admin", expiresAt: Date.now() + 12 * 60 * 60 * 1000 };
  }
  if (String(path).startsWith("/api/cpo-market")) {
    const response = await fetch("./public-cpo-data.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Cached CPO market data is unavailable");
    return response.json();
  }

  const payload = await loadLocalProjectPayload();
  const url = new URL(path, window.location.origin);
  const child = url.pathname.match(/^\/api\/projects\/[^/]+\/?([^/]*)/)?.[1] || "";
  const method = String(options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};

  if (child === "audit-entries") {
    const current = auditEntries();
    if (method === "POST") {
      const entry = {
        ...body,
        id: body.id || `audit_${Date.now()}`,
        projectId: PROJECT_ID,
        auditYear: body.auditYear || state.auditYear,
        capturedAt: body.capturedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveAuditEntries([entry, ...current.filter((item) => item.id !== entry.id)]);
      return { backend: "local", entry };
    }
    const page = Math.max(1, Number(url.searchParams.get("page") || state.auditPage || 1));
    const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") || state.auditPageSize || 5));
    const q = String(url.searchParams.get("q") || "").toLowerCase();
    const auditYear = String(url.searchParams.get("auditYear") || state.auditYear || "");
    const filtered = current
      .filter((entry) => !auditYear || String(entry.auditYear || "2025") === auditYear)
      .filter((entry) => !q || [entry.department, entry.location, entry.finding].some((value) => String(value || "").toLowerCase().includes(q)));
    const start = (page - 1) * pageSize;
    return { backend: "local", page, pageSize, total: filtered.length, items: filtered.slice(start, start + pageSize) };
  }

  if (child === "audit-seed") {
    saveAuditEntries(AUDIT_SEED_ENTRIES.slice());
    return { backend: "local", seeded: AUDIT_SEED_ENTRIES.length };
  }

  if (method === "GET" && child === "market-ticker") {
    const items = (payload.marketData || []).map((item) => ({
      category: "MARKET",
      title: item.label || item.sourceSheet,
      value: item.latestPriceRm ? `RM ${item.latestPriceRm}` : item.status || "Seeded",
      note: item.sourceSheet || "Seeded database",
      status: item.status?.includes("public") ? "live" : "seeded",
      sourceName: item.sourceSheet || "Local seed",
    }));
    return { sourceMode: "static_seeded_database", refreshSeconds: 300, items };
  }

  if (method === "PUT" && child === "inputs") {
    const item = (payload.inputRecords || []).find((record) => record.id === body.id);
    if (!item) throw new Error("Input not found in seeded local data");
    Object.assign(item, {
      value: body.value ?? item.value,
      label: body.label ?? item.label,
      status: body.status ?? item.status,
      updatedAt: new Date().toISOString(),
    });
    if (body.metricKey && Object.hasOwn(payload.model.metrics, body.metricKey)) {
      payload.model.metrics[body.metricKey] = Number(body.value);
    }
    if (body.settingKey) {
      payload.project.settings ||= {};
      payload.project.settings[body.settingKey] = body.value;
    }
    localSyncMetrics(payload);
    const calculationRun = localCalculationRun("input_change");
    payload.project.settings.lastCalculationRun = calculationRun;
    saveLocalProjectPayload(payload);
    return cloneLocal({ ...payload, calculationRun });
  }

  if (method === "PUT" && child === "management") {
    payload.company.name = body.companyName || payload.company.name;
    payload.project.name = body.projectName || payload.project.name;
    payload.project.settings ||= {};
    payload.project.settings.reportingCurrency = body.reportingCurrency || payload.project.settings.reportingCurrency;
    payload.project.settings.startYear = Number(body.startYear || payload.project.settings.startYear || 2026);
    payload.project.settings.auditReport = { ...auditReportSettings(), ...(body.auditReport || {}) };
    saveLocalProjectPayload(payload);
    return cloneLocal(payload);
  }

  if (method === "PUT" && child === "branding") {
    payload.project.settings ||= {};
    payload.project.settings.brandingLogoUrl = body.logoDataUrl || payload.project.settings.brandingLogoUrl || DEFAULT_BRAND_LOGO;
    payload.project.settings.brandingUpdatedAt = new Date().toISOString();
    saveLocalProjectPayload(payload);
    return cloneLocal({ ...payload, brandingLogoUrl: payload.project.settings.brandingLogoUrl });
  }

  if (method === "PUT" && child === "input-table-cell") {
    const table = (payload.inputTables || []).find((item) => item.sheetName === body.sheetName);
    const row = (table?.rows || []).find((item) => Number(item.sourceRow) === Number(body.sourceRow));
    const cell = (row?.cells || []).find((item) => item.address === body.address);
    if (cell) cell.value = body.value ?? "";
    saveLocalProjectPayload(payload);
    return cloneLocal(payload);
  }

  if (method === "POST" && child === "input-table-rows") {
    const table = (payload.inputTables || []).find((item) => item.sheetName === body.sheetName);
    if (table) {
      const lastRow = Math.max(0, ...(table.rows || []).map((row) => Number(row.sourceRow || 0)));
      const columns = table.columns?.length ? table.columns : (table.rows?.[0]?.cells || []).map((cell) => ({ key: String(cell.address || "").replace(/[^A-Za-z]/g, "") }));
      table.rows ||= [];
      table.rows.push({
        sourceRow: lastRow + 1,
        isNew: true,
        style: "yellow",
        cells: columns.map((column, index) => ({ address: `${column.key || column.label || "A"}${lastRow + 1}`, value: body.values?.[index] ?? "", style: "yellow" })),
      });
      table.rowCount = table.rows.length;
    }
    saveLocalProjectPayload(payload);
    return cloneLocal(payload);
  }

  if (method === "DELETE" && child === "input-table-rows") {
    const table = (payload.inputTables || []).find((item) => item.sheetName === body.sheetName);
    if (table) {
      table.rows = (table.rows || []).filter((row) => Number(row.sourceRow) !== Number(body.sourceRow));
      table.rowCount = table.rows.length;
    }
    saveLocalProjectPayload(payload);
    return cloneLocal(payload);
  }

  if (method === "PUT" && child === "formulas") {
    const formula = (payload.formulaRules || []).find((item) => item.id === body.id);
    if (formula) {
      formula.formula = body.formula ?? formula.formula;
      formula.status = "draft_pending_approval";
      formula.updatedAt = new Date().toISOString();
    }
    saveLocalProjectPayload(payload);
    return cloneLocal(payload);
  }

  if ((method === "POST" && child === "formula-publish") || (method === "POST" && child === "calculation-run")) {
    const calculationRun = localCalculationRun(child === "formula-publish" ? "publish_formula" : "full_recalculation");
    payload.project.settings.lastCalculationRun = calculationRun;
    saveLocalProjectPayload(payload);
    return cloneLocal({ ...payload, calculationRun });
  }

  localSyncMetrics(payload);
  return cloneLocal(payload);
}

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function bindClick(selector, handler) {
  const element = qs(selector);
  if (element) element.onclick = handler;
}

function bindEvent(selector, eventName, handler) {
  const element = qs(selector);
  if (element) element.addEventListener(eventName, handler);
}

function brandLogoUrl() {
  return state.projectData?.project?.settings?.brandingLogoUrl || DEFAULT_BRAND_LOGO;
}

function applyBrandingLogo(src = brandLogoUrl()) {
  qsa(".brand-logo").forEach((image) => {
    image.src = src;
  });
  const preview = qs("#managementLogoPreview");
  if (preview) preview.src = src;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Logo file could not be read."));
    reader.readAsDataURL(file);
  });
}

async function previewBrandingLogoSelection(event) {
  const file = event.target.files?.[0];
  const status = qs("#brandingUploadStatus");
  if (!file) return applyBrandingLogo();
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    if (status) status.textContent = "Use PNG, JPG, or WebP.";
    event.target.value = "";
    return applyBrandingLogo();
  }
  const previewUrl = URL.createObjectURL(file);
  const preview = qs("#managementLogoPreview");
  if (preview) {
    preview.onload = () => URL.revokeObjectURL(previewUrl);
    preview.src = previewUrl;
  }
  if (status) status.textContent = `${file.name} ready to save.`;
}

function sheetByName(name) {
  return state.analysis.sheets.find((sheet) => sheet.name === name);
}

function inputRecordsForSheet(sheetName) {
  return state.projectData.inputRecords.filter((item) => item.sheetName === sheetName);
}

function inputTableForSheet(sheetName) {
  return (state.projectData.inputTables || []).find((table) => table.sheetName === sheetName);
}

function inputTablePage(sheetName) {
  return state.inputTablePages[sheetName] || 0;
}

function setInputTablePage(sheetName, page) {
  state.inputTablePages[sheetName] = Math.max(0, page);
}

function usefulInputRows(table) {
  return (table?.rows || []).filter((row) => row.isNew || (row.cells || []).some((cell) => String(cell.value ?? "").trim() !== ""));
}

function projectSettings() {
  return state.projectData.project.settings || {
    reportingCurrency: "USD",
    sourceCurrency: "USD",
    startYear: 2026,
    currencyRates: { USD: 1 },
    supportedReportingCurrencies: ["USD"],
  };
}

function auditReportSettings(year = state.auditYear || "2025") {
  const base = AUDIT_REPORT_DEFAULTS_BY_YEAR[String(year)] || AUDIT_REPORT_DEFAULTS;
  const custom = projectSettings().auditReport || {};
  if (String(year) === "2025") return { ...base, ...custom };
  return {
    ...base,
    auditClientName: custom.auditClientName || base.auditClientName,
    auditLocation: custom.auditLocation || base.auditLocation,
    auditPreparedBy: custom.auditPreparedBy || base.auditPreparedBy,
    auditConfidentiality: custom.auditConfidentiality || base.auditConfidentiality,
  };
}

function canAccessAudit() {
  return state.currentSession?.role === "admin";
}

function applySessionUi() {
  const sessionUser = qs("#sessionUser");
  if (sessionUser) sessionUser.value = state.currentSession?.userId || "";
  qsa("[data-admin-only='true']").forEach((element) => {
    element.hidden = !canAccessAudit();
  });
  if (!canAccessAudit() && state.selectedAuditPanel) {
    state.selectedAuditPanel = "entry";
  }
}

function reportingCurrency() {
  return projectSettings().reportingCurrency || "USD";
}

function formatHectares(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(number);
}

function reportHeaderDetails(table, periodCount = 0) {
  const company = state.projectData.company || {};
  const project = state.projectData.project || {};
  const settings = project.settings || {};
  const hectares = formatHectares(project.hectares);
  const template = settings.reportHeaderTemplate || "{company} - {project} - {hectares} Ha";
  const title = template
    .replace("{company}", company.name || "")
    .replace("{project}", project.name || "")
    .replace("{hectares}", hectares || "");
  const crop = settings.crop || "Plantation";
  const years = settings.projectionYears ? `${settings.projectionYears}-Year` : "";
  const basis = settings.reportBasis || "Financial Projections";
  const standard = settings.reportingStandard ? `${settings.reportingStandard} reporting` : "Management reporting";
  return {
    title: title.replace(/\s+-\s+Ha$/, "").trim(),
    subtitle: [years, crop, basis].filter(Boolean).join(" "),
    meta: `${table.sheetName} · Figures in ${reportingCurrency()} · ${standard}${periodCount ? ` · ${periodCount} periods` : ""}`,
  };
}

function reportStartYear() {
  const year = Number(projectSettings().startYear ?? 2026);
  return Number.isFinite(year) ? Math.trunc(year) : 2026;
}

function reportYearLabel(period, index) {
  const startYear = reportStartYear();
  return String(startYear + index);
}

function currencyRate(currency = reportingCurrency()) {
  return Number(projectSettings().currencyRates?.[currency] || 1);
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const currency = reportingCurrency();
  const converted = number * currencyRate(currency);
  return `${currency} ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(converted)}`;
}

function formatNumber(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "");
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 4,
  }).format(number);
}

function formatPercent(value) {
  return `${formatNumber(Number(value || 0) * 100)}%`;
}

function displayInputValue(input) {
  if (input.settingKey === "reportingCurrency") return input.value || reportingCurrency();
  if (typeof input.value === "number") return formatNumber(input.value);
  if (typeof input.value === "string" && input.value.trim() !== "" && Number.isFinite(Number(input.value))) {
    return formatNumber(Number(input.value));
  }
  return String(input.value || "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function rawInputCellValue(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function displayWorkbookCellValue(value) {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value).trim();
  if (text && Number.isFinite(Number(text.replaceAll(",", "")))) {
    return formatNumber(Number(text.replaceAll(",", "")));
  }
  return String(value);
}

function isPlaceholderInput(input) {
  return input.cell === "TABLE" && String(input.value || "").toLowerCase() === "database records";
}

function linkedInputControls(inputs) {
  return inputs.filter((input) => !isPlaceholderInput(input) && (input.metricKey || input.settingKey || input.reportLinks?.length));
}

function roleLabel(sheet) {
  if (sheet.name === "Reporting Settings") return "Master data entry";
  if (sheet.role === "user_input") return "Central yellow input";
  if (sheet.role === "master_data") return "Master data entry";
  if (state.analysis.embeddedSheetInputSheets.includes(sheet.name)) return "Sheet-level yellow fields";
  return "Calculated/reporting";
}

function marketTickerMarkup(items) {
  const renderedItems = items.length ? items : [{
    category: "MARKET DESK",
    title: "Public data loading",
    value: "Standby",
    note: "Waiting for source refresh",
    status: "seeded",
  }];
  return [...renderedItems, ...renderedItems]
    .map((item) => `
      <span class="ticker-item ${item.status || "seeded"}" title="${item.sourceName || "Market source"}">
        <b>${item.category}</b>
        <strong>${item.value}</strong>
        <em>${item.title}</em>
      </span>
    `)
    .join("");
}

async function renderMarketTicker() {
  const ticker = qs("#marketTicker");
  if (!ticker) return;
  try {
    const data = await requestJson(`/api/projects/${PROJECT_ID}/market-ticker`);
    ticker.innerHTML = marketTickerMarkup(data.items || []);
    ticker.style.setProperty("--ticker-duration", `${Math.max(24, (data.items || []).length * 4.5)}s`);
    ticker.dataset.sourceMode = data.sourceMode || "database_fallback";
    clearTimeout(state.marketTickerTimer);
    state.marketTickerTimer = setTimeout(renderMarketTicker, Number(data.refreshSeconds || 300) * 1000);
  } catch (error) {
    ticker.innerHTML = marketTickerMarkup([{
      category: "MARKET DESK",
      title: "Public data connector",
      value: "Offline fallback",
      note: error.message,
      status: "seeded",
      sourceName: "Local database",
    }]);
  }
}

function renderMetrics() {
  const metrics = state.projectData.model.metrics;
  const cards = [
    ["Total Development", formatMoney(metrics.totalDevelopmentExpenditure), "Database-linked model"],
    ["Funding Gap", formatMoney(metrics.fundingShortfall), "Recalculated by API"],
    ["After-tax IRR", formatPercent(metrics.nominalAfterTaxIrr), "IFRS reporting baseline"],
    ["NPV @ WACC", formatMoney(metrics.nominalAfterTaxNpvAtWacc), "Valuation output"],
    ["Payback", `${formatNumber(metrics.paybackYears)} yrs`, "Estimated payback period"],
    ["Net Budget Available", formatMoney(metrics.netBudgetAvailable), "Database transaction snapshot"],
    ["Aug Cash Balance", formatMoney(metrics.augCurrentCashBalance), "Cash and bank balance"],
  ];

  qs("#metrics").innerHTML = cards
    .map(([label, value, note]) => `
      <article class="metric">
        <span>${label}</span>
        <strong title="${value}">${value}</strong>
        <small>${note}</small>
      </article>
    `)
    .join("");
}

function renderIfrsMobileCards() {
  const { ratios, ifrsReports } = state.projectData;
  const closingCash = ifrsReports.cashFlow.at(-1)?.amountUsd || 0;
  const totalAssets = ifrsReports.balanceSheet[0]?.amountUsd || 0;
  const cards = [
    ["Cash Flow", formatMoney(closingCash), "Closing surplus / (shortfall)"],
    ["Balance Sheet", formatMoney(totalAssets), "Assets under development"],
    ["IRR", formatPercent(ratios.irr), "Nominal after-tax"],
    ["NPV", formatMoney(ratios.npv), "At WACC"],
    ["Current Ratio", `${formatNumber(ratios.currentRatio)}x`, "Cash coverage"],
  ];
  qs("#ifrsMobileCards").innerHTML = cards
    .map(([title, value, note]) => `
      <article>
        <span>${title}</span>
        <strong>${value}</strong>
        <small>${note}</small>
      </article>
    `)
    .join("");
}

function renderDependencies() {
  qs("#topDependencies").innerHTML = state.analysis.dependencyLinks
    .slice(0, 7)
    .map((link) => `
      <div>
        <b>${link.from} -> ${link.to}</b>
        <strong>${link.formulaRefs}</strong>
        <span>Formula references retained for backend traceability.</span>
      </div>
    `)
    .join("");
}

function renderSheetList(filter = "") {
  const search = filter.trim().toLowerCase();
  const names = [
    ...state.projectData.inputRecords.map((record) => record.sheetName),
    ...(state.projectData.inputTables || []).map((table) => table.sheetName),
  ];
  const uniqueNames = [...new Set(names)];
  const sheets = uniqueNames
    .map((name) => ({ name, meta: sheetByName(name), records: inputRecordsForSheet(name), table: inputTableForSheet(name) }))
    .filter((sheet) => {
      if (!search) return true;
      const labels = sheet.records.map((input) => input.label).join(" ");
      return `${sheet.name} ${labels}`.toLowerCase().includes(search);
    });

  qs("#sheetList").innerHTML = sheets
    .map((sheet) => `
      <button class="sheet-button ${sheet.name === state.selectedSheet ? "active" : ""}" data-sheet="${sheet.name}">
        <strong>${sheet.name}</strong>
        <span>${roleLabel(sheet.meta || { role: "user_input", name: sheet.name })} · ${sheet.table ? `${usefulInputRows(sheet.table).length} seeded rows` : `${sheet.records.length} database fields`}${sheet.meta ? ` · ${sheet.meta.dimensions}` : ""}</span>
      </button>
    `)
    .join("");

  qsa(".sheet-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSheet = button.dataset.sheet;
      renderInputs();
    });
  });
}

function inputSamples(sheetName) {
  return inputRecordsForSheet(sheetName);
}

function renderInputs() {
  const sheet = sheetByName(state.selectedSheet) || { name: state.selectedSheet, role: "user_input" };
  const inputTable = inputTableForSheet(state.selectedSheet);
  const inputs = inputSamples(state.selectedSheet);
  const linkedInputs = linkedInputControls(inputs);
  qs("#selectedSheetTitle").textContent = state.selectedSheet;
  qs("#selectedSheetMeta").textContent = `${roleLabel(sheet)} · ${inputTable ? `${usefulInputRows(inputTable).length} seeded workbook rows` : `${inputs.length} database fields`}${linkedInputs.length ? ` · ${linkedInputs.length} linked controls` : ""}`;

  qs("#inputFields").innerHTML = inputTable
    ? `${renderInputWorkbookTable(inputTable)}${renderLinkedInputFields(linkedInputs, true, true)}`
    : renderLinkedInputFields(inputs);

  renderSheetList(qs("#sheetSearch").value || "");
  qsa(".field-control").forEach((control) => {
    control.addEventListener("change", () => updateInputRecord(control));
  });
  qsa(".input-cell-control").forEach((control) => {
    control.addEventListener("change", () => updateInputTableCell(control));
    control.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      updateInputTableCell(control, { keepFocus: true });
    });
  });
  bindClick("#inputTablePrev", () => {
    setInputTablePage(state.selectedSheet, inputTablePage(state.selectedSheet) - 1);
    renderInputs();
  });
  bindClick("#inputTableNext", () => {
    setInputTablePage(state.selectedSheet, inputTablePage(state.selectedSheet) + 1);
    renderInputs();
  });
  bindClick("#addInputRow", addInputTableRow);
  bindClick("#addInputRowTop", addInputTableRow);
  bindClick("#focusInputGrid", focusInputGrid);
  bindClick("#deleteLastInputRow", deleteLastVisibleInputRow);
  qsa(".delete-input-row").forEach((button) => {
    button.addEventListener("click", () => deleteInputTableRow(button.dataset.sourceRow));
  });
}

function renderLinkedInputFields(inputs, suppressEmpty = false, collapsed = false) {
  return inputs.length ? `
    <section class="mapped-controls ${collapsed ? "collapsed" : ""}">
      <div class="input-table-summary">
        <span>Linked database controls</span>
        <strong>${inputs.length} fields</strong>
      </div>
      <div class="form-grid linked-form-grid">
        ${inputs
    .map((input, index) => `
      <div class="field-row">
        <label class="field">
          <span>${escapeHtml(input.cell)} · ${escapeHtml(input.label || "Input field")}</span>
          ${input.settingKey === "reportingCurrency" ? `
            <select class="field-control" data-input-id="${input.id}" data-metric-key="${input.metricKey || ""}" data-setting-key="${input.settingKey || ""}">
              ${projectSettings().supportedReportingCurrencies.map((currency) => `
                <option value="${currency}" ${currency === reportingCurrency() ? "selected" : ""}>${currency}</option>
              `).join("")}
            </select>
          ` : `
            <input class="field-control ${Number.isFinite(Number(input.value)) ? "numeric" : ""}" data-input-id="${input.id}" data-metric-key="${input.metricKey || ""}" data-setting-key="${input.settingKey || ""}" value="${escapeHtml(displayInputValue(input))}" />
          `}
        </label>
        <div class="row-actions" aria-label="Field actions">
          <button class="action-icon edit" title="Edit field" aria-label="Edit field">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14 7 3 3" /></svg>
          </button>
          <button class="action-icon delete" title="Delete field" aria-label="Delete field">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14" /><path d="M9 7V5h6v2" /><path d="M8 7l1 13h6l1-13" /><path d="M10 11v5M14 11v5" /></svg>
          </button>
        </div>
      </div>
    `)
    .join("")}
      </div>
    </section>
  ` : suppressEmpty ? "" : `
      <div class="empty-state">
        <strong>No direct fields mapped yet</strong>
        <span>This screen has no separately linked controls. Use the seeded workbook grid above for row-level entry.</span>
      </div>
    `;
}

function renderManagementConsole() {
  const company = state.projectData.company || {};
  const project = state.projectData.project || {};
  const settings = projectSettings();
  const auditSettings = auditReportSettings();
  const supported = settings.supportedReportingCurrencies?.length ? settings.supportedReportingCurrencies : ["USD"];
  qs("#managementCompanyName").value = company.name || "";
  qs("#managementProjectName").value = project.name || "";
  qs("#managementStartYear").value = reportStartYear();
  qs("#managementAuditReportTitle").value = auditSettings.auditReportTitle || "";
  qs("#managementAuditClientName").value = auditSettings.auditClientName || "";
  qs("#managementAuditLocation").value = auditSettings.auditLocation || "";
  qs("#managementAuditPreparedBy").value = auditSettings.auditPreparedBy || "";
  qs("#managementAuditPeriodStart").value = auditSettings.auditPeriodStart || "";
  qs("#managementAuditPeriodEnd").value = auditSettings.auditPeriodEnd || "";
  qs("#managementAuditIssueDate").value = auditSettings.auditIssueDate || "";
  qs("#managementAuditConfidentiality").value = auditSettings.auditConfidentiality || "";
  qs("#managementReportingCurrency").innerHTML = supported
    .map((currency) => `<option value="${currency}" ${currency === reportingCurrency() ? "selected" : ""}>${currency}</option>`)
    .join("");
  qs("#managementConsoleStatus").textContent = `${company.name || "Company"} · ${project.name || "Project"} · ${reportingCurrency()} · starts ${reportStartYear()}`;
  applyBrandingLogo();
  const logoUpload = qs("#managementLogoUpload");
  if (logoUpload) logoUpload.onchange = previewBrandingLogoSelection;
  bindClick("#saveManagementConsole", saveManagementConsole);
  bindClick("#saveBrandingLogo", saveBrandingLogo);
  renderManagementStats();
  renderManagementGovernance();
  renderManagementCalculations();
  bindManagementConsoleNavigation();
  setManagementConsoleTab(state.selectedManagementTab);
}

function renderManagementStats() {
  const target = qs("#managementStats");
  if (!target) return;
  const refFlags = state.analysis?.totals?.formulaErrorsInText?.["#REF!"] || 0;
  const company = state.projectData.company || {};
  const project = state.projectData.project || {};
  const stats = [
    ["Company", company.name || "Not set", "Tenant master setting"],
    ["Project", project.name || "Not set", `${reportStartYear()} start year`],
    ["Reporting", reportingCurrency(), "Currency used in reports"],
    ["Users", state.managementUsers.length.toLocaleString(), "Assigned accounts"],
    ["Open checks", refFlags.toLocaleString(), "Formula flags for review"],
  ];
  target.innerHTML = stats
    .map(([label, value, note]) => `
      <div>
        <span>${escapeHtml(label)}</span>
        <b>${escapeHtml(value)}</b>
        <small>${escapeHtml(note)}</small>
      </div>
    `)
    .join("");
}

function bindManagementConsoleNavigation() {
  qsa("[data-management-tab]").forEach((button) => {
    button.onclick = () => setManagementConsoleTab(button.dataset.managementTab);
  });
}

function setManagementConsoleTab(tab) {
  const selected = tab || "settings";
  state.selectedManagementTab = selected;
  qsa("[data-management-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.managementTab === selected);
  });
  qsa("[data-management-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.managementPanel === selected);
  });
}

function renderManagementGovernance() {
  qs("#managementRoleList").innerHTML = state.managementRoles
    .map((role) => `
      <button class="role ${role.id === state.selectedRoleId ? "active" : ""}" data-role-id="${role.id}">
        ${escapeHtml(role.name)}
        <span>${escapeHtml(role.note)}</span>
      </button>
    `)
    .join("");

  qs("#managementPermissionMatrix").innerHTML = state.permissionRows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  qs("#managementUserDirectory").innerHTML = state.managementUsers
    .map((user) => `
      <tr>
        <td>${escapeHtml(user.name)}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${escapeHtml(user.role)}</td>
        <td>${escapeHtml(user.access)}</td>
        <td><span class="user-status ${user.status.toLowerCase().replace(/\s+/g, "-")}">${escapeHtml(user.status)}</span></td>
        <td>${escapeHtml(user.lastAccess)}</td>
        <td>
          <div class="row-actions">
            <button class="action-icon edit edit-management-user" data-user-id="${user.id}" title="Edit user" aria-label="Edit user">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14 7 3 3" /></svg>
            </button>
            <button class="action-icon edit reset-management-user" data-user-id="${user.id}" title="Reset password" aria-label="Reset password">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
            </button>
            ${user.locked ? "" : `
              <button class="action-icon delete delete-management-user" data-user-id="${user.id}" title="Delete user" aria-label="Delete user">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14" /><path d="M9 7V5h6v2" /><path d="M8 7l1 13h6l1-13" /><path d="M10 11v5M14 11v5" /></svg>
              </button>
            `}
          </div>
        </td>
      </tr>
    `)
    .join("");

  qsa("#managementRoleList .role").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRoleId = button.dataset.roleId;
      renderManagementGovernance();
    });
  });
  bindClick("#addManagementRole", addManagementRole);
  bindClick("#addManagementUser", addManagementUser);
  qsa(".edit-management-user").forEach((button) => button.addEventListener("click", () => editManagementUser(button.dataset.userId)));
  qsa(".reset-management-user").forEach((button) => button.addEventListener("click", () => resetManagementUser(button.dataset.userId)));
  qsa(".delete-management-user").forEach((button) => button.addEventListener("click", () => deleteManagementUser(button.dataset.userId)));
  renderManagementStats();
}

function renderManagementCalculations() {
  const statsTarget = qs("#managementCalculationStats");
  if (!statsTarget) return;
  const formulas = state.projectData.formulaRules || [];
  const published = formulas.filter((formula) => ["approved_baseline", "published_approved"].includes(formula.status)).length;
  const drafts = formulas.filter((formula) => String(formula.status || "").includes("draft")).length;
  const waiting = formulas.filter((formula) => formula.calculationStatus === "waiting_for_input").length;
  const review = formulas.filter((formula) => formula.calculationStatus === "needs_review").length;
  const lastRun = state.projectData.calculationRun || state.projectData.project.settings?.lastCalculationRun || null;
  const cards = [
    ["Formula rules", formulas.length.toLocaleString(), "Stored in database"],
    ["Published", published.toLocaleString(), "Eligible for recalculation"],
    ["Drafts", drafts.toLocaleString(), "Saved but not published"],
    ["Waiting inputs", waiting.toLocaleString(), "Includes divide-by-zero placeholders"],
    ["Review needed", review.toLocaleString(), "Unsupported formula syntax"],
    ["Last run", lastRun ? `${Number(lastRun.updatedCells || 0).toLocaleString()} cells` : "Not run", lastRun ? `${lastRun.calculated || 0} calculated · ${lastRun.waitingForInput || 0} waiting · ${lastRun.needsReview || 0} review` : "Run after formula approval"],
  ];
  statsTarget.innerHTML = cards
    .map(([label, value, note]) => `
      <div>
        <span>${escapeHtml(label)}</span>
        <b>${escapeHtml(value)}</b>
        <small>${escapeHtml(note)}</small>
      </div>
    `)
    .join("");
  renderManagementCalculationInputs();
  renderManagementFormulaWorkbench();
  renderPipelineCards("#managementPipeline");
  renderRelationshipRows("#managementRelationshipTable", 10);
  bindClick("#runCalculationEngine", async () => {
    const button = qs("#runCalculationEngine");
    if (button) button.disabled = true;
    try {
      state.projectData = await requestJson(`/api/projects/${PROJECT_ID}/calculation-run`, {
        method: "POST",
        body: JSON.stringify({ scope: "published" }),
      });
      refreshCalculatedViews();
    } finally {
      if (button) button.disabled = false;
    }
  });
}

function calculationInputSheets() {
  const names = [...new Set((state.projectData.inputRecords || []).map((record) => record.sheetName))];
  return names
    .map((name) => ({
      name,
      meta: sheetByName(name) || { name, systemPosition: 999, role: "user_input" },
      controls: linkedInputControls(inputRecordsForSheet(name)),
    }))
    .filter((sheet) => sheet.controls.length)
    .sort((a, b) => (a.meta.systemPosition || 999) - (b.meta.systemPosition || 999));
}

function renderManagementCalculationInputs() {
  const select = qs("#managementInputSheetSelect");
  const target = qs("#managementInputControls");
  if (!select || !target) return;
  const sheets = calculationInputSheets();
  const selected = sheets.find((sheet) => sheet.name === state.selectedManagementInputSheet) || sheets[0];
  if (!selected) {
    select.innerHTML = "";
    target.innerHTML = `<div class="empty-state"><strong>No linked calculation inputs</strong><span>Use Input Capture for workbook-grid entries.</span></div>`;
    return;
  }
  state.selectedManagementInputSheet = selected.name;
  select.innerHTML = sheets
    .map((sheet) => `<option value="${escapeHtml(sheet.name)}" ${sheet.name === selected.name ? "selected" : ""}>${escapeHtml(sheet.name)} (${sheet.controls.length})</option>`)
    .join("");
  target.innerHTML = selected.controls
    .slice(0, 10)
    .map((input) => `
      <label class="calc-input-field">
        <span>${escapeHtml(input.label || input.cell)}</span>
        ${input.settingKey === "reportingCurrency" ? `
          <select class="management-field-control field-control" data-input-id="${input.id}" data-metric-key="${input.metricKey || ""}" data-setting-key="${input.settingKey || ""}">
            ${projectSettings().supportedReportingCurrencies.map((currency) => `
              <option value="${currency}" ${currency === reportingCurrency() ? "selected" : ""}>${currency}</option>
            `).join("")}
          </select>
        ` : `
          <input class="management-field-control field-control ${Number.isFinite(Number(input.value)) ? "numeric" : ""}" data-input-id="${input.id}" data-metric-key="${input.metricKey || ""}" data-setting-key="${input.settingKey || ""}" value="${escapeHtml(displayInputValue(input))}" />
        `}
      </label>
    `)
    .join("");
  select.onchange = (event) => {
    state.selectedManagementInputSheet = event.target.value;
    renderManagementCalculations();
  };
  bindClick("#openCalculationInputScreen", () => {
    state.selectedSheet = state.selectedManagementInputSheet;
    renderInputs();
    qs('.module[data-view="inputs"]')?.click();
  });
  qsa(".management-field-control").forEach((control) => {
    control.addEventListener("change", () => updateInputRecord(control));
    control.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      updateInputRecord(control);
    });
  });
}

function managementFormulaSamples(sheetName) {
  return (state.projectData.formulaRules || [])
    .filter((rule) => rule.sheetName === sheetName)
    .slice(0, 80);
}

function refreshCalculatedViews() {
  renderFormulaStudio();
  renderMetrics();
  renderIfrsMobileCards();
  renderFundingChart();
  renderReports();
  renderChecks();
  renderManagementStats();
  renderManagementCalculations();
}

function renderManagementFormulaWorkbench() {
  const sheetSelect = qs("#managementFormulaSheetSelect");
  const ruleSelect = qs("#managementFormulaRuleSelect");
  const editor = qs("#managementFormulaEditor");
  const status = qs("#managementFormulaStatus");
  if (!sheetSelect || !ruleSelect || !editor || !status) return;
  const sheets = formulaSheets();
  const selectedSheet = sheets.find((sheet) => sheet.name === state.selectedManagementFormulaSheet) || sheets[0];
  if (!selectedSheet) return;
  state.selectedManagementFormulaSheet = selectedSheet.name;
  sheetSelect.innerHTML = sheets
    .map((sheet) => `<option value="${escapeHtml(sheet.name)}" ${sheet.name === selectedSheet.name ? "selected" : ""}>${escapeHtml(sheet.name)}</option>`)
    .join("");
  const formulas = managementFormulaSamples(selectedSheet.name);
  const selectedFormula = formulas[state.selectedManagementFormulaIndex] || formulas[0];
  state.selectedManagementFormulaIndex = Math.max(0, formulas.indexOf(selectedFormula));
  ruleSelect.innerHTML = formulas
    .map((formula, index) => `<option value="${index}" ${index === state.selectedManagementFormulaIndex ? "selected" : ""}>${escapeHtml(formula.cell)} · ${escapeHtml(formula.status || "draft")}</option>`)
    .join("");
  editor.value = selectedFormula?.formula || "";
  status.textContent = selectedFormula?.calculationStatus || selectedFormula?.status || "Ready";
  sheetSelect.onchange = (event) => {
    state.selectedManagementFormulaSheet = event.target.value;
    state.selectedManagementFormulaIndex = 0;
    renderManagementCalculations();
  };
  ruleSelect.onchange = (event) => {
    state.selectedManagementFormulaIndex = Number(event.target.value || 0);
    renderManagementCalculations();
  };
  bindClick("#managementSaveFormulaDraft", async () => {
    if (!selectedFormula) return;
    status.textContent = "Saving...";
    state.projectData = await requestJson(`/api/projects/${PROJECT_ID}/formulas`, {
      method: "PUT",
      body: JSON.stringify({ id: selectedFormula.id, formula: editor.value }),
    });
    renderManagementCalculations();
    renderFormulaStudio();
  });
  bindClick("#managementPublishFormula", async () => {
    if (!selectedFormula) return;
    status.textContent = "Publishing...";
    state.projectData = await requestJson(`/api/projects/${PROJECT_ID}/formula-publish`, {
      method: "POST",
      body: JSON.stringify({ id: selectedFormula.id, formula: editor.value, approvedBy: "admin" }),
    });
    refreshCalculatedViews();
  });
}

function slugId(value) {
  return String(value || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `item-${Date.now()}`;
}

function addManagementRole() {
  const name = window.prompt("Role name");
  if (!name) return;
  const note = window.prompt("Role description", "Define access level") || "Define access level";
  const role = { id: `${slugId(name)}-${Date.now()}`, name, note };
  state.managementRoles.push(role);
  state.selectedRoleId = role.id;
  renderManagementGovernance();
  setManagementConsoleTab("governance");
}

function addManagementUser() {
  const name = window.prompt("User name");
  if (!name) return;
  const email = window.prompt("Email address", `${slugId(name)}@agrinexus.ai`) || "";
  const role = window.prompt("Role", "User") || "User";
  state.managementUsers.push({
    id: `${slugId(name)}-${Date.now()}`,
    name,
    email,
    role,
    access: "AGRII",
    status: "Active",
    lastAccess: new Date().toLocaleString("en-GB"),
  });
  renderManagementGovernance();
  setManagementConsoleTab("users");
}

function editManagementUser(userId) {
  const user = state.managementUsers.find((item) => item.id === userId);
  if (!user) return;
  const role = window.prompt("Role", user.role);
  if (!role) return;
  const access = window.prompt("Company access", user.access) || user.access;
  user.role = role;
  user.access = access;
  renderManagementGovernance();
  setManagementConsoleTab("users");
}

function resetManagementUser(userId) {
  const user = state.managementUsers.find((item) => item.id === userId);
  if (!user) return;
  user.status = "Pending reset";
  renderManagementGovernance();
  setManagementConsoleTab("users");
}

function deleteManagementUser(userId) {
  const user = state.managementUsers.find((item) => item.id === userId);
  if (!user || user.locked) return;
  if (!window.confirm(`Delete ${user.name}?`)) return;
  state.managementUsers = state.managementUsers.filter((item) => item.id !== userId);
  renderManagementGovernance();
  setManagementConsoleTab("users");
}

async function saveManagementConsole() {
  const startYear = Number(qs("#managementStartYear").value || 2026);
  qs("#managementConsoleStatus").textContent = "Saving settings...";
  state.projectData = await requestJson(`/api/projects/${PROJECT_ID}/management`, {
    method: "PUT",
    body: JSON.stringify({
      companyName: qs("#managementCompanyName").value.trim(),
      projectName: qs("#managementProjectName").value.trim(),
      reportingCurrency: qs("#managementReportingCurrency").value,
      startYear: Number.isFinite(startYear) ? Math.trunc(startYear) : 2026,
      auditReport: {
        auditReportTitle: qs("#managementAuditReportTitle").value.trim(),
        auditClientName: qs("#managementAuditClientName").value.trim(),
        auditLocation: qs("#managementAuditLocation").value.trim(),
        auditPreparedBy: qs("#managementAuditPreparedBy").value.trim(),
        auditPeriodStart: qs("#managementAuditPeriodStart").value,
        auditPeriodEnd: qs("#managementAuditPeriodEnd").value,
        auditIssueDate: qs("#managementAuditIssueDate").value,
        auditConfidentiality: qs("#managementAuditConfidentiality").value.trim(),
      },
    }),
  });
  renderMetrics();
  renderIfrsMobileCards();
  renderFundingChart();
  renderManagementConsole();
  renderInputs();
  renderReports();
  renderAudit();
  renderChecks();
}

async function saveBrandingLogo() {
  const input = qs("#managementLogoUpload");
  const status = qs("#brandingUploadStatus");
  const file = input?.files?.[0];
  if (!file) {
    if (status) status.textContent = "Choose a logo first.";
    return;
  }
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    if (status) status.textContent = "Use PNG, JPG, or WebP.";
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    if (status) status.textContent = "Logo must be under 3 MB.";
    return;
  }
  try {
    if (status) status.textContent = "Saving logo...";
    const logoDataUrl = await readFileAsDataUrl(file);
    state.projectData = await requestJson(`/api/projects/${PROJECT_ID}/branding`, {
      method: "PUT",
      body: JSON.stringify({ logoDataUrl }),
    });
    applyBrandingLogo(state.projectData.brandingLogoUrl || brandLogoUrl());
    if (input) input.value = "";
    if (status) status.textContent = "Logo saved.";
  } catch (error) {
    applyBrandingLogo();
    if (status) status.textContent = error.message || "Logo could not be saved.";
  }
}

function inputCellHasValue(cell) {
  return cell && cell.value !== undefined && cell.value !== null && String(cell.value).trim() !== "";
}

function visibleInputColumns(table, pageRows) {
  const columns = table.columns || [];
  if (!columns.length) return [];

  const visible = new Set();
  columns.forEach((column, index) => {
    const hasValue = pageRows.some((row) => inputCellHasValue((row.cells || [])[index]));
    if (hasValue) visible.add(index);
  });

  if (!visible.size && columns[0]) visible.add(0);
  const ordered = [...visible].sort((a, b) => a - b);

  if (ordered.length) {
    return ordered.map((index) => ({ index, column: columns[index] }));
  }

  return columns.slice(0, Math.min(columns.length, 5)).map((column, index) => ({ index, column }));
}

function inputCellAddress(table, row, index) {
  const columnKey = table.columns?.[index]?.key || table.columns?.[index]?.label || "";
  return `${columnKey}${row.sourceRow || ""}`;
}

function inputCellIsDark(row, cell) {
  const style = `${row?.style || ""} ${cell?.style || ""}`.toLowerCase();
  return style.includes("dark") || style.includes("blue-total");
}

function workbookRowClass(row) {
  const labelText = (row?.label || row?.cells?.map((cell) => cell.value).join(" ") || "").toString().toLowerCase();
  const style = String(row?.style || "").toLowerCase();
  const classes = [];
  if (style.includes("header") || style.includes("section")) classes.push("workbook-header-row");
  if (style.includes("total") || /\btotal\b/.test(labelText)) classes.push("workbook-total-row");
  if (style.includes("subtotal") || /\bsub[-\s]?total\b/.test(labelText)) classes.push("workbook-subtotal-row");
  return classes.join(" ");
}

function renderInputWorkbookTable(table) {
  const rows = usefulInputRows(table);
  const pageSize = state.inputPageSize;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(inputTablePage(table.sheetName), pageCount - 1);
  setInputTablePage(table.sheetName, page);
  const start = page * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const visibleColumns = visibleInputColumns(table, pageRows);
  const rawCount = table.rows?.length || rows.length;
  return `
    <section class="input-workbook-table">
      <div class="input-grid-toolbar">
        <div>
          <span>${table.range || "Workbook range"} · rows ${rows.length ? start + 1 : 0}-${Math.min(start + pageSize, rows.length)}</span>
          <strong>${rows.length} records · ${table.columnCount} columns</strong>
          <small>${rawCount.toLocaleString()} raw workbook rows retained internally</small>
        </div>
        <div class="input-table-pager">
          <button class="secondary-button" id="inputTablePrev" ${page <= 0 ? "disabled" : ""}>Prev</button>
          <span>Page ${page + 1} / ${pageCount}</span>
          <button class="secondary-button" id="inputTableNext" ${page >= pageCount - 1 ? "disabled" : ""}>Next</button>
          <button class="primary-button compact-primary" id="addInputRow"><span class="mini-icon">+</span> Add row</button>
        </div>
      </div>
      <div class="financial-grid-scroll">
        <table class="financial-grid worksheet-grid input-grid">
          <thead>
            <tr>
              ${visibleColumns.map(({ column }, visibleIndex) => `<th class="${visibleIndex === 0 ? "sticky-label" : ""}">${escapeHtml(column.label || column.key)}</th>`).join("")}
              <th class="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${pageRows.map((row) => `
              <tr class="${row.style || "line"} ${workbookRowClass(row)}">
                ${visibleColumns.map(({ index }, visibleIndex) => {
                  const cell = (row.cells || [])[index] || {
                    address: inputCellAddress(table, row, index),
                    value: "",
                    style: "",
                  };
                  const style = cell.style || "";
                  const numeric = style.includes("number");
                  const darkCell = inputCellIsDark(row, cell);
                  const value = numeric ? displayWorkbookCellValue(cell.value) : rawInputCellValue(cell.value);
                  const savedValue = numeric && cell.value !== "" && cell.value !== null && cell.value !== undefined
                    ? String(Number(String(cell.value).replaceAll(",", "")))
                    : rawInputCellValue(cell.value);
                  const address = cell.address || inputCellAddress(table, row, index);
                  return `
                    <td class="${visibleIndex === 0 ? "sticky-label" : ""} ${style} ${darkCell ? "dark-input-cell" : ""}">
                      <input class="input-cell-control ${numeric ? "numeric" : ""} ${darkCell ? "on-dark" : ""}" data-sheet-name="${escapeHtml(table.sheetName)}" data-address="${escapeHtml(address)}" data-last-saved-value="${escapeHtml(savedValue)}" value="${escapeHtml(value)}" title="${escapeHtml(value)}" />
                    </td>
                  `;
                }).join("")}
                <td class="actions-col">
                  <div class="row-actions">
                    <button class="action-icon edit" title="Edit row" aria-label="Edit row">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14 7 3 3" /></svg>
                    </button>
                    <button class="action-icon delete delete-input-row" title="Delete row" aria-label="Delete row" data-source-row="${row.sourceRow}">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14" /><path d="M9 7V5h6v2" /><path d="M8 7l1 13h6l1-13" /><path d="M10 11v5M14 11v5" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function updateLocalInputTableCell(sheetName, address, value) {
  const table = inputTableForSheet(sheetName);
  for (const row of table?.rows || []) {
    const cell = (row.cells || []).find((item) => item.address === address);
    if (!cell) continue;
    cell.value = value;
    return;
  }
}

async function updateInputTableCell(control, options = {}) {
  if (control.dataset.saving === "1") return;
  const value = control.classList.contains("numeric") && control.value !== "" ? Number(String(control.value).replaceAll(",", "")) : control.value;
  const savedValue = String(value ?? "");
  if (control.dataset.lastSavedValue === savedValue) return;
  const viewport = control.closest(".financial-grid-scroll");
  const scrollLeft = viewport?.scrollLeft || 0;
  const scrollTop = viewport?.scrollTop || 0;
  const address = control.dataset.address;
  const sheetName = control.dataset.sheetName;
  control.dataset.saving = "1";
  control.classList.add("saving");
  try {
    state.projectData = await requestJson(`/api/projects/${PROJECT_ID}/input-table-cell`, {
      method: "PUT",
      body: JSON.stringify({
        sheetName,
        address,
        value,
      }),
    });
    updateLocalInputTableCell(sheetName, address, value);
    control.dataset.lastSavedValue = savedValue;
    renderMetrics();
    renderIfrsMobileCards();
    renderFundingChart();
    renderReports();
    if (viewport) {
      viewport.scrollLeft = scrollLeft;
      viewport.scrollTop = scrollTop;
    }
    if (options.keepFocus) {
      control.focus();
      control.select?.();
    }
  } finally {
    control.classList.remove("saving");
    delete control.dataset.saving;
  }
}

async function addInputTableRow() {
  state.projectData = await requestJson(`/api/projects/${PROJECT_ID}/input-table-rows`, {
    method: "POST",
    body: JSON.stringify({ sheetName: state.selectedSheet }),
  });
  const table = inputTableForSheet(state.selectedSheet);
  setInputTablePage(state.selectedSheet, Math.max(0, Math.ceil((table?.rows?.length || 1) / state.inputPageSize) - 1));
  renderInputs();
}

function focusInputGrid() {
  const firstCell = qs(".input-cell-control");
  if (firstCell) firstCell.focus();
}

function deleteLastVisibleInputRow() {
  const visibleRows = qsa(".delete-input-row");
  const lastRow = visibleRows[visibleRows.length - 1];
  if (lastRow) deleteInputTableRow(lastRow.dataset.sourceRow);
}

async function deleteInputTableRow(sourceRow) {
  state.projectData = await requestJson(`/api/projects/${PROJECT_ID}/input-table-rows`, {
    method: "DELETE",
    body: JSON.stringify({ sheetName: state.selectedSheet, sourceRow: Number(sourceRow) }),
  });
  renderInputs();
  renderReports();
}

async function updateInputRecord(control) {
  state.projectData = await requestJson(`/api/projects/${PROJECT_ID}/inputs`, {
    method: "PUT",
    body: JSON.stringify({
      id: control.dataset.inputId,
      value: control.classList.contains("numeric") ? Number(String(control.value).replaceAll(",", "")) : control.value,
      metricKey: control.dataset.metricKey || undefined,
      settingKey: control.dataset.settingKey || undefined,
    }),
  });
  renderMetrics();
  renderIfrsMobileCards();
  renderFundingChart();
  renderInputs();
  renderFormulaStudio();
  renderReports();
  renderChecks();
  renderManagementStats();
  renderManagementCalculations();
}

function renderPipeline() {
  const count = qs("#formulaCount");
  if (count) count.textContent = `${state.analysis.totals.formulaCells.toLocaleString()} raw formula cells`;
  renderPipelineCards("#pipeline");
  renderRelationshipRows("#relationshipTable", 18);
  renderFormulaStudio();
}

function pipelineStages() {
  return [
    ["Master Data", state.analysis.masterDataEntrySheets, "WACC, PK and CPO reference series."],
    ["Central Inputs", state.analysis.userInputSheets, "Personnel, material and general assumption capture."],
    ["Opex & Asset Schedules", ["Personnel Opex", "Indirect Cost", "Upkeep Opex", "Vehicles", "Buildings"], "Costing build-up by category."],
    ["Budget Request", ["OPSL AUG BUD req", "3-Mth Budget"], "Monthly funding and requisition pack."],
    ["Financial Model", ["Financials", "Detail Cashflow", "Balance Sheet", "Debt"], "Formula engine and statement outputs."],
    ["Executive Output", ["Summary (US$)", "Valuation"], "NPV, IRR, payback and funding view."],
  ];
}

function renderPipelineCards(targetSelector) {
  const target = qs(targetSelector);
  if (!target) return;
  target.innerHTML = pipelineStages()
    .map(([title, items, note]) => `
      <article class="stage">
        <b>${title}</b>
        <span>${items.join(" · ")}</span>
        <span>${note}</span>
      </article>
    `)
    .join("");
}

function renderRelationshipRows(targetSelector, limit = 18) {
  const target = qs(targetSelector);
  if (!target) return;
  target.innerHTML = state.analysis.dependencyLinks
    .slice(0, limit)
    .map((link) => `
      <div class="rel-row">
        <b>${link.from}</b>
        <span>-></span>
        <b>${link.to}</b>
        <span>${link.formulaRefs} refs</span>
      </div>
    `)
    .join("");
}

function formulaSheets() {
  const names = [...new Set(state.projectData.formulaRules.map((item) => item.sheetName))];
  return names
    .map((name) => sheetByName(name) || { name, systemPosition: 999 })
    .sort((a, b) => (a.systemPosition || 999) - (b.systemPosition || 999));
}

function formulaSamples(sheet) {
  return state.projectData.formulaRules
    .filter((rule) => rule.sheetName === sheet.name)
    .slice(0, 20);
}

function renderFormulaStudio() {
  if (!qs("#formulaSheetSelect")) return;
  const sheets = formulaSheets();
  const selectedSheet = sheetByName(state.selectedFormulaSheet) || sheets[0];
  if (!selectedSheet) return;
  state.selectedFormulaSheet = selectedSheet.name;

  qs("#formulaSheetSelect").innerHTML = sheets
    .map((sheet) => `<option value="${sheet.name}" ${sheet.name === selectedSheet.name ? "selected" : ""}>${sheet.name}</option>`)
    .join("");

  const formulas = formulaSamples(selectedSheet);
  const selectedFormula = formulas[state.selectedFormulaIndex] || formulas[0];
  state.selectedFormulaIndex = Math.max(0, formulas.indexOf(selectedFormula));

  qs("#formulaList").innerHTML = formulas
    .map((item, index) => `
      <button class="formula-item ${index === state.selectedFormulaIndex ? "active" : ""}" data-formula-index="${index}">
        <b>${item.cell} <small>${escapeHtml(item.status || "draft")}</small></b>
        <span>${item.formula}</span>
      </button>
    `)
    .join("");

  if (!selectedFormula) {
    qs("#formulaEditor").value = "";
    qs("#formulaPublishStatus").textContent = "No formula selected";
    return;
  }
  qs("#formulaEditor").value = selectedFormula.formula;
  qs("#formulaPublishStatus").textContent = selectedFormula.calculationStatus
    ? `${selectedFormula.status || "draft"} · ${selectedFormula.calculationStatus}`
    : (selectedFormula.status || "Ready");

  bindClick("#saveFormulaDraft", async () => {
    qs("#formulaPublishStatus").textContent = "Saving draft...";
    state.projectData = await requestJson(`/api/projects/${PROJECT_ID}/formulas`, {
      method: "PUT",
      body: JSON.stringify({
        id: selectedFormula.id,
        formula: qs("#formulaEditor").value,
      }),
    });
    renderFormulaStudio();
    renderManagementCalculations();
  });

  bindClick("#publishFormula", async () => {
    qs("#formulaPublishStatus").textContent = "Publishing and recalculating...";
    state.projectData = await requestJson(`/api/projects/${PROJECT_ID}/formula-publish`, {
      method: "POST",
      body: JSON.stringify({
        id: selectedFormula.id,
        formula: qs("#formulaEditor").value,
        approvedBy: "admin",
      }),
    });
    renderFormulaStudio();
    renderMetrics();
    renderIfrsMobileCards();
    renderFundingChart();
    renderReports();
    renderChecks();
    renderManagementCalculations();
  });

  const formulaSheetSelect = qs("#formulaSheetSelect");
  if (formulaSheetSelect) formulaSheetSelect.onchange = (event) => {
    state.selectedFormulaSheet = event.target.value;
    state.selectedFormulaIndex = 0;
    renderFormulaStudio();
  };

  qsa(".formula-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedFormulaIndex = Number(button.dataset.formulaIndex || 0);
      renderFormulaStudio();
    });
  });
}

function renderFundingChart() {
  const target = qs("#fundingChart");
  if (!target) return;
  const metrics = state.projectData.model.metrics;
  const rows = [
    ["Total development expenditure", metrics.totalDevelopmentExpenditure, "red"],
    ["Committed sources", metrics.committedSources, ""],
    ["Year 1 budget amount", metrics.year1BudgetAmount, ""],
    ["Net budget available", metrics.netBudgetAvailable, ""],
    ["August current balance", metrics.augCurrentCashBalance, ""],
    ["Funding shortfall", Math.abs(metrics.fundingShortfall), "red"],
  ];
  const max = Math.max(1, ...rows.map((row) => Math.abs(Number(row[1] || 0))));
  target.innerHTML = rows
    .map(([label, value, tone]) => `
      <div class="bar-row">
        <span>${label}</span>
        <div class="bar-track"><div class="bar-fill ${tone}" style="width: ${(Math.abs(Number(value || 0)) / max) * 100}%"></div></div>
        <b>${formatMoney(value)}</b>
      </div>
    `)
    .join("");
}

function statementTableBySheet(sheetName) {
  const table = reportTableForSheet(sheetName);
  return table?.kind === "projection-schedule" ? table : null;
}

function statementRow(table, label) {
  const needle = String(label || "").toLowerCase();
  return (table?.rows || []).find((row) => String(row.label || "").toLowerCase() === needle);
}

function statementRows(table, labels) {
  return labels
    .map((label) => statementRow(table, label))
    .filter(Boolean);
}

function statementRowsAfter(table, startLabel, labels) {
  const rows = table?.rows || [];
  const startIndex = rows.findIndex((row) => String(row.label || "").toLowerCase() === String(startLabel || "").toLowerCase());
  const scopedRows = startIndex >= 0 ? rows.slice(startIndex + 1) : rows;
  return labels
    .map((label) => scopedRows.find((row) => String(row.label || "").toLowerCase() === String(label || "").toLowerCase()))
    .filter(Boolean);
}

function statementYears(table) {
  return (table?.periods || []).map((period, index) => reportYearLabel(period, index));
}

function reportTableValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return escapeHtml(value);
  return formatReportNumber(number);
}

function reportTableCell(value) {
  const number = Number(value);
  const negative = Number.isFinite(number) && number < 0;
  return `<td class="${negative ? "negative" : ""}">${reportTableValue(value)}</td>`;
}

function renderStatementTable({ title, note, table, rows, maxPeriods = 27 }) {
  const years = statementYears(table).slice(0, maxPeriods);
  const periods = (table?.periods || []).slice(0, maxPeriods);
  return `
    <section class="ifrs-statement-table">
      <div class="statement-table-title">
        <h4>${escapeHtml(title)}</h4>
        <span>${escapeHtml(note)}</span>
      </div>
      <div class="statement-scroll">
        <table>
          <thead>
            <tr>
              <th class="sticky-label">${escapeHtml(table?.currency || reportingCurrency())}</th>
              ${periods.map((period, index) => `<th>${escapeHtml(years[index] || period.year || period.label || "")}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr class="${row.style || "line"} ${workbookRowClass(row)}">
                <td class="sticky-label">${escapeHtml(row.label || "")}</td>
                ${(row.values || []).slice(0, maxPeriods).map(reportTableCell).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderLineChart({ title, note, labels, series }) {
  const width = 620;
  const height = 260;
  const pad = { left: 54, right: 18, top: 26, bottom: 40 };
  const numericSeries = series.map((item) => ({
    ...item,
    values: item.values.map((value) => {
      const number = Number(value);
      return Number.isFinite(number) ? number / 1000000 : 0;
    }),
  }));
  const values = numericSeries.flatMap((item) => item.values);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = max - min || 1;
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const x = (index) => pad.left + (labels.length <= 1 ? 0 : (index / (labels.length - 1)) * plotWidth);
  const y = (value) => pad.top + ((max - value) / span) * plotHeight;
  const yTicks = [max, min + span / 2, min];
  return `
    <article class="statement-chart">
      <header>
        <h4>${escapeHtml(title)}</h4>
        <span>${escapeHtml(note)}</span>
      </header>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
        ${yTicks.map((tick) => `
          <g>
            <line x1="${pad.left}" y1="${y(tick)}" x2="${width - pad.right}" y2="${y(tick)}" />
            <text x="${pad.left - 10}" y="${y(tick) + 4}" text-anchor="end">${formatNumber(tick).replace(".00", "")}</text>
          </g>
        `).join("")}
        ${labels.map((label, index) => index % 3 === 0 ? `<text x="${x(index)}" y="${height - 12}" text-anchor="middle">${escapeHtml(label)}</text>` : "").join("")}
        ${numericSeries.map((item) => `
          <polyline points="${item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}" style="--stroke:${item.color}" />
        `).join("")}
      </svg>
      <div class="chart-legend">
        ${numericSeries.map((item) => `<span><i style="background:${item.color}"></i>${escapeHtml(item.label)}</span>`).join("")}
      </div>
    </article>
  `;
}

function renderIfrsStatementPack() {
  const target = qs("#ifrsStatementPack");
  const chartTarget = qs("#ifrsStatementCharts");
  if (!target && !chartTarget) return;
  const financials = statementTableBySheet("Financials");
  const cashFlow = statementTableBySheet("Detail Cashflow");
  const balanceSheet = statementTableBySheet("Balance Sheet");
  const cashRows = statementRows(cashFlow, [
    "TOTAL RECEIPTS",
    "TOTAL PAYMENTS",
    "NET CASH FLOW",
    "ENDING CASH BALANCE",
  ]);
  const plRows = statementRowsAfter(financials, "Profit & Loss Statement", [
    "Revenue",
    "Channel Discount on Revenue",
    "Operating profit",
    "Profit before tax",
    "Profit after tax",
    "Net profit",
    "Retained profit c/f",
  ]);
  const balanceRows = statementRows(balanceSheet, [
    "PPE",
    "Biological Asset",
    "TOTAL NCA",
    "Cash",
    "TOTAL CA",
    "TOTAL ASSET",
    "TOTAL LIABILITIES",
    "Retained Earnings",
    "Equity",
    "Total Equity",
    "Total Equity and Liability",
  ]);

  if (chartTarget) {
    const chartPeriods = 10;
    const financialYears = statementYears(financials).slice(0, chartPeriods);
    const balanceYears = statementYears(balanceSheet).slice(0, chartPeriods);
    chartTarget.innerHTML = [
      renderLineChart({
        title: "Revenue, Profit and Cash",
        note: `${reportingCurrency()} millions`,
        labels: financialYears,
        series: [
          { label: "Revenue", color: "#0870c0", values: (statementRow(financials, "Revenue")?.values || []).slice(0, chartPeriods) },
          { label: "Operating profit", color: "#36a4e8", values: (statementRow(financials, "Operating profit")?.values || []).slice(0, chartPeriods) },
          { label: "Net profit", color: "#082038", values: (statementRow(financials, "Net profit")?.values || []).slice(0, chartPeriods) },
        ],
      }),
      renderLineChart({
        title: "Assets, Debt and Equity",
        note: `${reportingCurrency()} millions`,
        labels: balanceYears,
        series: [
          { label: "Total assets", color: "#0870c0", values: (statementRow(balanceSheet, "TOTAL ASSET")?.values || []).slice(0, chartPeriods) },
          { label: "Total liabilities", color: "#d99a2b", values: (statementRow(balanceSheet, "TOTAL LIABILITIES")?.values || []).slice(0, chartPeriods) },
          { label: "Total equity", color: "#082038", values: (statementRow(balanceSheet, "Total Equity")?.values || []).slice(0, chartPeriods) },
        ],
      }),
    ].join("");
  }

  if (target) {
    target.innerHTML = [
      renderStatementTable({
        title: "Statement of Cash Flows",
        note: "Indirect method management report",
        table: cashFlow,
        rows: cashRows,
      }),
      renderStatementTable({
        title: "Profit and Loss Statement",
        note: "Revenue, operating profit and retained earnings",
        table: financials,
        rows: plRows,
      }),
      renderStatementTable({
        title: "Statement of Financial Position",
        note: "Assets, liabilities and equity",
        table: balanceSheet,
        rows: balanceRows,
      }),
    ].join("");
  }
}

function renderReportDashboard() {
  if (!state.projectData) return;
  renderFundingChart();
  const metrics = state.projectData.model.metrics || {};
  const ratios = state.projectData.ratios || {};
  const ifrsReports = state.projectData.ifrsReports || {};
  const summaryTarget = qs("#reportSummaryKpis");
  const ratioTarget = qs("#reportRatioDashboard");
  const ifrsTarget = qs("#reportIfrsDashboard");
  const status = qs("#fundingDashboardStatus");

  if (status) {
    const shortfall = Number(metrics.fundingShortfall || 0);
    status.className = `status-pill ${shortfall < 0 ? "red" : ""}`.trim();
    status.textContent = shortfall < 0 ? "Shortfall flagged" : "Funded";
  }

  if (summaryTarget) {
    const rows = [
      ["Total development", formatMoney(metrics.totalDevelopmentExpenditure), "Summary report"],
      ["Committed funding", formatMoney(metrics.committedSources), "Financials report"],
      ["Funding gap", formatMoney(metrics.fundingShortfall), "Summary report"],
      ["NPV @ WACC", formatMoney(metrics.nominalAfterTaxNpvAtWacc), "Valuation report"],
      ["After-tax IRR", formatPercent(metrics.nominalAfterTaxIrr), "Valuation report"],
      ["Payback", `${formatNumber(metrics.paybackYears)} yrs`, "Summary report"],
    ];
    summaryTarget.innerHTML = rows
      .map(([label, value, note]) => `
        <div>
          <span>${escapeHtml(label)}</span>
          <b>${escapeHtml(value)}</b>
          <span>${escapeHtml(note)}</span>
        </div>
      `)
      .join("");
  }

  if (ratioTarget) {
    const rows = [
      ["Funding coverage", formatPercent(ratios.fundingCoverage), "Committed sources / development expenditure"],
      ["Funding gap ratio", formatPercent(ratios.fundingGapRatio), "Shortfall intensity"],
      ["Debt to equity", `${formatNumber(ratios.debtToEquity)}x`, "Capital structure"],
      ["Current ratio", `${formatNumber(ratios.currentRatio)}x`, "Liquidity"],
      ["Cost per hectare", formatMoney(ratios.costPerHa), "Development efficiency"],
    ];
    ratioTarget.innerHTML = rows
      .map(([label, value, note]) => `
        <div>
          <span>${escapeHtml(label)}</span>
          <b>${escapeHtml(value)}</b>
          <small>${escapeHtml(note)}</small>
        </div>
      `)
      .join("");
  }

  if (ifrsTarget) {
    const cashRows = (ifrsReports.cashFlow || []).slice(0, 4).map((row) => [
      `Cash flow · ${row.line}`,
      formatMoney(row.amountUsd),
      "Detail Cashflow report",
    ]);
    const balanceRows = (ifrsReports.balanceSheet || []).slice(0, 4).map((row) => [
      `Balance sheet · ${row.line}`,
      formatMoney(row.amountUsd),
      "Balance Sheet report",
    ]);
    ifrsTarget.innerHTML = [...cashRows, ...balanceRows]
      .map(([label, value, note]) => `
        <div>
          <span>${escapeHtml(label)}</span>
          <b>${escapeHtml(value)}</b>
          <small>${escapeHtml(note)}</small>
        </div>
      `)
      .join("");
  }
  renderIfrsStatementPack();
}

function pct(value) {
  return formatPercent(value);
}

function reportCategory(name) {
  if (["Summary (US$)", "Valuation", "Financials", "Detail Cashflow", "Balance Sheet"].includes(name)) {
    return "Executive financial reports";
  }
  if (["Year 1 Budget_OPSL", "OPSL AUG BUD req", "Fund Req Aug26", "3-Mth Budget", "Fund Requirement"].includes(name)) {
    return "Budget request reports";
  }
  if (["Debt", "Insurance", "Ha & FFB"].includes(name)) {
    return "Funding and operational drivers";
  }
  if (["DEV Phase", "OP Phase"].includes(name)) {
    return "Phase reports";
  }
  if (["Land & Assessment", "Buildings", "Mills", "Vehicles", "Equipment", "Furniture"].includes(name)) {
    return "Capex and fixed asset reports";
  }
  if (["Nursery", "Year 1", "Year 2", "Year 3", "Upkeep Opex", "Harvest Opex", "Mill Opex", "Indirect Cost", "Personnel Opex"].includes(name)) {
    return "Opex and costing reports";
  }
  if (name === "Bank Account Details") return "Bank and account reference";
  return "Review reports";
}

function transactionRowsForReport(reportName) {
  const rows = state.projectData.transactions.slice();
  if (reportName === "OPSL AUG BUD req" || reportName.includes("Budget") || reportName.includes("Fund")) {
    return rows
      .filter((row) => row.sourceSheet === "OPSL AUG BUD req")
      .sort((a, b) => (a.sourceRow || 0) - (b.sourceRow || 0))
      .slice(0, 18);
  }
  if (["Land & Assessment", "Buildings", "Mills", "Vehicles", "Equipment", "Furniture"].includes(reportName)) {
    const tokens = {
      "Land & Assessment": ["LAND", "Professional Fees", "Payment to Community"],
      Buildings: ["HOUSING", "Accomodation"],
      Mills: ["PLANT & MACHINERIES", "PRODUCTION EQUIPMENT"],
      Vehicles: ["VEHICLES", "Motor Vehicles", "Fleet"],
      Equipment: ["EQUIPMENT", "MACHINERIES"],
      Furniture: ["FURNITURE"],
    }[reportName];
    return rows
      .filter((row) => tokens.some((token) => String(row.category || row.item || "").toUpperCase().includes(token.toUpperCase())))
      .slice(0, 14);
  }
  if (["Nursery", "Year 1", "Year 2", "Year 3", "Upkeep Opex", "Harvest Opex", "Mill Opex", "Indirect Cost", "Personnel Opex"].includes(reportName)) {
    const tokens = {
      Nursery: ["NURSERY", "Inventories"],
      "Year 1": ["TOTAL YR 1", "NEW DEVELOPMENT", "Salaries", "Labour"],
      "Year 2": ["NEW DEVELOPMENT", "Labour"],
      "Year 3": ["NEW DEVELOPMENT", "Labour"],
      "Upkeep Opex": ["NEW DEVELOPMENT", "Labour"],
      "Harvest Opex": ["Labour", "Fleet"],
      "Mill Opex": ["PLANT", "MACHINERIES", "PRODUCTION"],
      "Indirect Cost": ["Professional Fees", "Travel", "Rental"],
      "Personnel Opex": ["Salaries", "Relocation", "Labour"],
    }[reportName];
    return rows
      .filter((row) => tokens.some((token) => String(row.category || row.item || "").toUpperCase().includes(token.toUpperCase())))
      .slice(0, 14);
  }
  return rows.slice(0, 12);
}

function selectedReportSnapshot() {
  return reportSheets().find((report) => report.sheetName === state.selectedReport) || reportSheets()[0];
}

function reportTableForSheet(sheetName) {
  return (state.projectData.reportTables || []).find((table) => table.sheetName === sheetName);
}

function excelStyleAttr(style) {
  if (!style) return "";
  const rules = [];
  if (/^#[0-9a-f]{6}$/i.test(style.fillColor || "")) rules.push(`background-color:${style.fillColor}`);
  if (/^#[0-9a-f]{6}$/i.test(style.fontColor || "")) rules.push(`color:${style.fontColor}`);
  return rules.length ? ` style="${rules.join(";")}"` : "";
}

function excelTitleStyleAttr(style) {
  return style?.fillColor ? excelStyleAttr(style) : "";
}

function formatReportNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(String(value).replaceAll(",", ""));
  if (!Number.isFinite(number)) return String(value);
  if (Math.abs(number) < 0.00005) return "-";
  const text = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(Math.abs(number));
  return number < 0 ? `(${text})` : text;
}

function isBalanceSheetUsdHeaderRow(table, row) {
  return table?.sheetName === "Balance Sheet" && String(row?.label || "").trim().toLowerCase() === "(all in usd nearest thousand)";
}

function reportDisplayValue(table, row, value) {
  if (isBalanceSheetUsdHeaderRow(table, row)) {
    const match = String(value ?? "").match(/^(\d{4})-\d{2}-\d{2}(?:t.*)?$/i);
    if (match) return match[1];
  }
  return value;
}

function reportDisplayText(table, row, value) {
  const displayValue = reportDisplayValue(table, row, value);
  if (isBalanceSheetUsdHeaderRow(table, row) && /^\d{4}$/.test(String(displayValue ?? ""))) {
    return String(displayValue);
  }
  return formatReportNumber(displayValue);
}

function sourceColumnFromAddress(address) {
  const letters = String(address || "").match(/[A-Z]+/i)?.[0] || "";
  return [...letters.toUpperCase()].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}

function hasCellValue(cell) {
  return String(cell?.value ?? "").trim() !== "";
}

function columnFillCounts(table) {
  const counts = new Map();
  for (const row of table.rows || []) {
    for (const cell of row.cells || []) {
      if (!hasCellValue(cell)) continue;
      const sourceColumn = sourceColumnFromAddress(cell.address);
      counts.set(sourceColumn, (counts.get(sourceColumn) || 0) + 1);
    }
  }
  return counts;
}

function reportDisplayStartColumn(table) {
  const columns = table.columns || [];
  if (!columns.length) return 0;
  const firstColumn = columns[0].sourceColumn || 0;
  const counts = columnFillCounts(table);
  const firstFill = counts.get(firstColumn) || 0;
  const denseThreshold = Math.max(5, Math.floor((table.rows || []).length * 0.2));
  const firstDenseColumn = columns.find((column) => {
    const sourceColumn = column.sourceColumn || 0;
    return sourceColumn > firstColumn && (counts.get(sourceColumn) || 0) >= denseThreshold;
  });
  const firstColumnLooksLikeWorkbookTitle = firstColumn === 1 && firstFill <= 7 && firstDenseColumn;
  return firstColumnLooksLikeWorkbookTitle ? firstDenseColumn.sourceColumn : firstColumn;
}

function reportBodyRows(table, startColumn) {
  const removeWorkbookHeader = startColumn > 1 && (table.columns?.[0]?.sourceColumn || 0) === 1;
  return (table.rows || [])
    .filter((row) => !(removeWorkbookHeader && Number(row.sourceRow || 0) <= 4))
    .map((row) => ({
      ...row,
      cells: (row.cells || []).filter((cell) => sourceColumnFromAddress(cell.address) >= startColumn),
    }))
    .filter((row) => (row.cells || []).some(hasCellValue));
}

function trimDisplayColumns(columns, rows) {
  const filledColumns = new Set();
  for (const row of rows) {
    for (const cell of row.cells || []) {
      if (hasCellValue(cell)) filledColumns.add(sourceColumnFromAddress(cell.address));
    }
  }
  const nextColumns = columns.filter((column) => filledColumns.has(column.sourceColumn || 0));
  const keepColumns = new Set(nextColumns.map((column) => column.sourceColumn || 0));
  const nextRows = rows.map((row) => ({
    ...row,
    cells: (row.cells || []).filter((cell) => keepColumns.has(sourceColumnFromAddress(cell.address))),
  }));
  return { columns: nextColumns, rows: nextRows };
}

function displayWorkbookGrid(table) {
  const startColumn = reportDisplayStartColumn(table);
  const firstColumn = table.columns?.[0]?.sourceColumn || 0;
  if (startColumn <= firstColumn) {
    return {
      columns: table.columns || [],
      rows: table.rows || [],
      compacted: false,
    };
  }
  const columns = (table.columns || []).filter((column) => (column.sourceColumn || 0) >= startColumn);
  const trimmed = trimDisplayColumns(columns, reportBodyRows(table, startColumn));
  return {
    columns: trimmed.columns,
    rows: trimmed.rows,
    compacted: true,
  };
}

function renderWorkbookReportTable(table) {
  if (table.kind === "worksheet-grid") {
    return renderWorkbookGridTable(table);
  }
  const periods = table.periods || [];
  const header = reportHeaderDetails(table, periods.length);
  const periodHeader = table.headerStyles?.period || {};
  const yearHeader = table.headerStyles?.year || {};
  return `
    <section class="report-output workbook-report">
      <div class="workbook-report-title"${excelTitleStyleAttr(table.titleStyle)}>
        <strong>${header.title}</strong>
        <span>${header.subtitle}</span>
        <b>${header.meta}</b>
      </div>
      <div class="financial-grid-scroll">
        <table class="financial-grid">
          <thead>
            <tr>
              <th class="sticky-label"${excelStyleAttr(periodHeader.label)}>Line item</th>
              <th${excelStyleAttr(periodHeader.percent)}>%</th>
              <th${excelStyleAttr(periodHeader.total)}>Total</th>
              ${periods.map((period, index) => `<th${excelStyleAttr(periodHeader.values?.[index])}>${period.period}</th>`).join("")}
            </tr>
            <tr>
              <th class="sticky-label"${excelStyleAttr(yearHeader.label)}></th>
              <th${excelStyleAttr(yearHeader.percent)}></th>
              <th${excelStyleAttr(yearHeader.total)}></th>
              ${periods.map((period, index) => `<th${excelStyleAttr(yearHeader.values?.[index])}>${reportYearLabel(period, index)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${(table.rows || []).map((row) => {
              const isProfitLoss = table.sheetName === "Balance Sheet" && String(row.label || "").trim().toLowerCase() === "profit/loss";
              return `
              ${isProfitLoss ? `<tr class="report-separator"><td colspan="${3 + periods.length}"></td></tr>` : ""}
              <tr class="${row.style || "line"} ${workbookRowClass(row)}">
                <td class="sticky-label"${excelStyleAttr(row.cellStyles?.label)}>${escapeHtml(row.label || "")}</td>
                <td${excelStyleAttr(row.cellStyles?.percent)}>${formatReportNumber(row.percent)}</td>
                <td${excelStyleAttr(row.cellStyles?.total)}>${formatReportNumber(row.total)}</td>
                ${(row.values || []).map((value, index) => {
                  const displayValue = reportDisplayValue(table, row, value);
                  const numeric = Number(displayValue);
                  const negative = Number.isFinite(numeric) && numeric < 0;
                  return `<td class="${negative ? "negative" : ""}"${excelStyleAttr(row.cellStyles?.values?.[index])}>${escapeHtml(reportDisplayText(table, row, value))}</td>`;
                }).join("")}
              </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderWorkbookGridTable(table) {
  const header = reportHeaderDetails(table);
  const display = displayWorkbookGrid(table);
  return `
    <section class="report-output workbook-report">
      <div class="workbook-report-title"${excelTitleStyleAttr(table.titleStyle)}>
        <strong>${header.title}</strong>
        <span>${header.subtitle}</span>
        <b>${header.meta}</b>
      </div>
      <div class="financial-grid-scroll">
        <table class="financial-grid worksheet-grid ${table.presentation || ""} ${display.compacted ? "compact-report-grid" : ""}">
          <tbody>
            ${display.rows.map((row) => `
              <tr class="${row.style || "line"} ${workbookRowClass(row)}">
                ${(row.cells || []).map((cell, index) => {
                  const style = cell.style || "";
                  const numeric = style.includes("number") || Number.isFinite(Number(String(cell.value ?? "").replaceAll(",", "")));
                  const negative = style.includes("negative") || Number(String(cell.value ?? "").replaceAll(",", "")) < 0;
                  const value = numeric ? formatReportNumber(cell.value) : (cell.value ?? "");
                  return `<td class="${index === 0 ? "sticky-label" : ""} ${style} ${negative ? "negative" : ""}"${excelStyleAttr(cell.excelStyle)}>${escapeHtml(value)}</td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function reportOutputRows(selected) {
  const workbookTable = reportTableForSheet(selected.sheetName);
  if (workbookTable) {
    return {
      type: "workbook-table",
      table: workbookTable,
      rows: workbookTable.rows || [],
    };
  }
  const metrics = state.projectData.model.metrics;
  const { ratios, ifrsReports } = state.projectData;
  if (selected.sheetName === "Summary (US$)") {
    return {
      type: "summary",
      rows: [
        ["Total development expenditure", formatMoney(metrics.totalDevelopmentExpenditure), "Capital requirement"],
        ["Committed funding sources", formatMoney(metrics.committedSources), "Capital structure"],
        ["Funding surplus / (shortfall)", formatMoney(metrics.fundingShortfall), "Finance gap"],
        ["Nominal after-tax IRR", pct(metrics.nominalAfterTaxIrr), "Investment return"],
        ["NPV @ WACC", formatMoney(metrics.nominalAfterTaxNpvAtWacc), "Valuation"],
        ["Payback period", `${formatNumber(metrics.paybackYears)} years`, "Investor payback"],
      ],
    };
  }
  if (selected.sheetName === "Detail Cashflow") {
    return {
      type: "statement",
      rows: ifrsReports.cashFlow.map((row) => [row.line, formatMoney(row.amountUsd), "Cash flow"]),
    };
  }
  if (selected.sheetName === "Balance Sheet") {
    return {
      type: "statement",
      rows: ifrsReports.balanceSheet.map((row) => [row.line, formatMoney(row.amountUsd), "IFRS position"]),
    };
  }
  if (selected.sheetName === "Financials" || selected.sheetName === "Valuation") {
    return {
      type: "summary",
      rows: [
        ["Funding coverage", formatPercent(ratios.fundingCoverage), "Committed sources / development expenditure"],
        ["Funding gap ratio", pct(ratios.fundingGapRatio), "Shortfall intensity"],
        ["Debt to equity", `${formatNumber(ratios.debtToEquity)}x`, "Capital structure"],
        ["Current ratio", `${formatNumber(ratios.currentRatio)}x`, "Liquidity"],
        ["Cost per hectare", formatMoney(ratios.costPerHa), "Development efficiency"],
        ["Nominal after-tax IRR", pct(ratios.irr), "Investor return"],
        ["NPV @ WACC", formatMoney(ratios.npv), "Valuation"],
      ],
    };
  }
  const transactions = transactionRowsForReport(selected.sheetName);
  if (transactions.length) {
    return {
      type: "transactions",
      rows: transactions.map((row) => [
        row.category || row.item || "Uncategorised",
        row.description || row.item || `Source row ${row.sourceRow}`,
        formatMoney(Number(row.requestedAmountUsd || row.amountUsd || 0)),
        formatMoney(Number(row.totalAvailableBudgetUsd || row.augBudgetUsd || 0)),
        row.status || "review",
      ]),
    };
  }
  return {
    type: "sections",
    rows: selected.headings.slice(0, 10).map((row) => [`Row ${row.row}`, row.labels.join(" · "), "Workbook report section"]),
  };
}

function renderReportOutput(selected) {
  const output = reportOutputRows(selected);
  if (output.type === "workbook-table") {
    return renderWorkbookReportTable(output.table);
  }
  if (output.type === "transactions") {
    return `
      <section class="report-output">
        <h4>Report Output</h4>
        <table class="report-table">
          <thead><tr><th>Category</th><th>Description</th><th>Amount</th><th>Budget / Available</th><th>Status</th></tr></thead>
          <tbody>
            ${output.rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </section>
    `;
  }
  return `
    <section class="report-output">
      <h4>Report Output</h4>
      <table class="report-table report-table-financial">
        <thead><tr><th>Line item</th><th>Value</th><th>Notes</th></tr></thead>
        <tbody>
        ${output.rows.map((row) => `
          <tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2] || ""}</td></tr>
        `).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function csvEscape(value) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function slug(value) {
  return String(value || "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function reportCsv(selected) {
  const output = reportOutputRows(selected);
  if (output.type === "workbook-table") {
    const table = output.table;
    if (table.kind === "worksheet-grid") {
      const display = displayWorkbookGrid(table);
      return [
        [state.projectData.company.name],
        [state.projectData.project.name],
        [table.reportTitle || selected.sheetName],
        [`Figures in ${table.currency || reportingCurrency()}`],
        [`Range ${table.range || ""}`],
        [],
        ...display.rows.map((row) => (row.cells || []).map((cell) => cell.value ?? "")),
      ].map((row) => row.map(csvEscape).join(",")).join("\n");
    }
    const headers = ["Line item", "%", "Total", ...table.periods.map((period, index) => `${period.period} ${reportYearLabel(period, index)}`.trim())];
    const rows = table.rows.flatMap((row) => {
      const values = [row.label, row.percent, row.total, ...(row.values || []).map((value) => reportDisplayValue(table, row, value))];
      return table.sheetName === "Balance Sheet" && String(row.label || "").trim().toLowerCase() === "profit/loss" ? [[], values] : [values];
    });
    return [
      [state.projectData.company.name],
      [state.projectData.project.name],
      [table.reportTitle || selected.sheetName],
      [`Figures in ${table.currency || reportingCurrency()}`],
      [],
      headers,
      ...rows,
    ].map((row) => row.map(csvEscape).join(",")).join("\n");
  }
  const meta = [
    ["Company", state.projectData.company.name],
    ["Project", state.projectData.project.name],
    ["Report", selected.sheetName],
    ["Reporting currency", reportingCurrency()],
    ["Period", state.projectData.model.period],
    [],
  ];
  const header = output.type === "transactions"
    ? ["Category", "Description", "Amount", "Budget / Available", "Status"]
    : ["Line item", "Value", "Notes"];
  return [...meta, header, ...output.rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}

function downloadText(filename, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function filenameFromDisposition(header, fallback) {
  const match = String(header || "").match(/filename="?([^";]+)"?/i);
  return match ? match[1] : fallback;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadSelectedReport() {
  const selected = selectedReportSnapshot();
  if (!selected) return;
  downloadText(`${slug(selected.sheetName)}.csv`, reportCsv(selected));
}

function reportPreviewHtml(selected) {
  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { margin: 0; padding: 24px; color: #17202a; font: 13px Arial, sans-serif; background: #fff; }
          .report-output h4 { margin: 0 0 14px; font-size: 15px; }
          .workbook-report-title { display: grid; gap: 4px; margin-bottom: 16px; }
          .workbook-report-title strong { font-size: 16px; }
          .workbook-report-title span, .workbook-report-title b { color: #667085; font-weight: 500; }
          .financial-grid-scroll { overflow: auto; max-height: 72vh; border: 1px solid #d8dee8; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #d8dee8; padding: 7px 9px; text-align: right; white-space: nowrap; }
          th, .sticky-label, td:first-child { text-align: left; background: #f7f9fc; }
          .negative { color: #b42318; }
        </style>
      </head>
      <body>${renderReportOutput(selected)}</body>
    </html>`;
}

function ensureReportModal() {
  let modal = qs("#reportModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "reportModal";
  modal.className = "report-modal";
  modal.innerHTML = `
    <div class="report-modal-card" role="dialog" aria-modal="true" aria-labelledby="reportModalTitle">
      <header>
        <div>
          <span class="eyebrow" id="reportModalCategory">Report</span>
          <h3 id="reportModalTitle">Report</h3>
        </div>
        <div class="input-actions">
          <button class="action-icon add" id="modalDownloadReport" title="Download report" aria-label="Download report">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
          </button>
          <button class="action-icon delete" id="closeReportModal" title="Close report" aria-label="Close report">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </header>
      <iframe id="reportPdfFrame" title="PDF report preview"></iframe>
    </div>
  `;
  document.body.appendChild(modal);
  bindClick("#closeReportModal", () => modal.classList.remove("open"));
  bindClick("#modalDownloadReport", downloadSelectedReport);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.classList.remove("open");
  });
  return modal;
}

function openSelectedReport() {
  const selected = selectedReportSnapshot();
  if (!selected) return;
  const modal = ensureReportModal();
  qs("#reportModalTitle").textContent = selected.sheetName;
  qs("#reportModalCategory").textContent = reportCategory(selected.sheetName);
  const frame = qs("#reportPdfFrame");
  frame.removeAttribute("src");
  frame.srcdoc = reportPreviewHtml(selected);
  modal.classList.add("open");
}

function reportSheets() {
  return state.projectData.reportSnapshots
    .filter((report) => !HIDDEN_REPORT_SHEETS.has(report.sheetName))
    .slice()
    .sort((a, b) => {
      const aMeta = sheetByName(a.sheetName);
      const bMeta = sheetByName(b.sheetName);
      return (aMeta?.systemPosition || 999) - (bMeta?.systemPosition || 999);
    });
}

function renderReports() {
  const reports = reportSheets();
  const selected = reports.find((report) => report.sheetName === state.selectedReport) || reports[0];
  if (!selected) return;
  state.selectedReport = selected.sheetName;
  const grouped = reports.reduce((groups, sheet) => {
    const category = reportCategory(sheet.sheetName);
    groups[category] ||= [];
    groups[category].push(sheet);
    return groups;
  }, {});

  qs("#reportCount").textContent = `${reports.length} reports`;
  qs("#reportList").innerHTML = Object.entries(grouped)
    .map(([category, sheets]) => `
      <section class="report-group">
        <h4>${category}</h4>
        ${sheets.map((sheet) => `
          <button class="report-card ${sheet.sheetName === selected.sheetName ? "active" : ""}" data-report="${sheet.sheetName}">
            <strong>${sheet.sheetName}</strong>
            <span>${reportCategory(sheet.sheetName)}</span>
          </button>
        `).join("")}
      </section>
    `)
    .join("");

  qs("#reportTitle").textContent = selected.sheetName;
  qs("#reportCategory").textContent = reportCategory(selected.sheetName);
  qs("#reportDetail").innerHTML = `
    ${renderReportOutput(selected)}
  `;
  renderReportDashboard();

  bindClick("#viewReport", openSelectedReport);
  bindClick("#downloadReport", downloadSelectedReport);

  qsa(".report-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedReport = button.dataset.report;
      renderReports();
    });
  });
}

function auditEntries() {
  if (Array.isArray(state.auditEntries)) return state.auditEntries;
  try {
    const stored = JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY) || "null");
    state.auditEntries = Array.isArray(stored) && stored.length ? stored : AUDIT_SEED_ENTRIES.slice();
  } catch {
    state.auditEntries = AUDIT_SEED_ENTRIES.slice();
  }
  return state.auditEntries;
}

function saveAuditEntries(entries) {
  state.auditEntries = entries;
  localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(entries));
}

async function loadAuditEntries() {
  if (!canAccessAudit()) return [];
  state.auditLoading = true;
  const params = new URLSearchParams({
    page: String(state.auditPage),
    pageSize: String(state.auditPageSize),
    auditYear: String(state.auditYear),
  });
  if (state.auditSearch.trim()) params.set("q", state.auditSearch.trim());
  try {
    const result = await requestJson(`/api/projects/${PROJECT_ID}/audit-entries?${params.toString()}`, {
      credentials: "same-origin",
    });
    state.auditEntries = Array.isArray(result.items) ? result.items : [];
    state.auditTotal = Number(result.total || state.auditEntries.length);
    state.auditPage = Number(result.page || state.auditPage);
    state.auditPageSize = Number(result.pageSize || state.auditPageSize);
    state.auditBackend = result.backend || "";
  } finally {
    state.auditLoading = false;
  }
  return state.auditEntries;
}

function auditPaginationLabel() {
  const total = Number(state.auditTotal || 0);
  if (!total) return "0 findings";
  const start = (state.auditPage - 1) * state.auditPageSize + 1;
  const end = Math.min(total, state.auditPage * state.auditPageSize);
  return `${start}-${end} of ${total.toLocaleString()} findings`;
}

function auditPriorityClass(priority) {
  const value = String(priority || "").toLowerCase();
  if (value === "critical") return "critical";
  if (value === "high") return "high";
  if (value === "medium") return "med";
  return "low";
}

function auditStatusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("closed")) return "low";
  if (value.includes("progress")) return "med";
  return "high";
}

function auditDateLabel(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function auditSummary(entries) {
  const departments = new Set(entries.map((entry) => entry.department).filter(Boolean));
  const highCount = entries.filter((entry) => ["critical", "high"].includes(String(entry.priority).toLowerCase())).length;
  const evidenceCount = entries.filter((entry) => entry.photoDataUrl || entry.photoUrl || entry.photoName).length;
  const openCount = entries.filter((entry) => String(entry.status || "").toLowerCase() !== "closed").length;
  return [
    ["Findings", entries.length.toLocaleString(), "Captured observations"],
    ["High priority", highCount.toLocaleString(), "Critical and high risk"],
    ["Departments", departments.size.toLocaleString(), "Covered by report"],
    ["Evidence", evidenceCount.toLocaleString(), "Photo or source tags"],
    ["Open actions", openCount.toLocaleString(), "Pending closure"],
  ];
}

function auditDepartmentRows(entries) {
  const groups = entries.reduce((result, entry) => {
    const key = entry.department || "Unassigned";
    result[key] ||= { total: 0, high: 0, medium: 0, low: 0, open: 0 };
    result[key].total += 1;
    if (String(entry.priority).toLowerCase() === "high" || String(entry.priority).toLowerCase() === "critical") result[key].high += 1;
    if (String(entry.priority).toLowerCase() === "medium") result[key].medium += 1;
    if (String(entry.priority).toLowerCase() === "low") result[key].low += 1;
    if (String(entry.status).toLowerCase() !== "closed") result[key].open += 1;
    return result;
  }, {});
  return Object.entries(groups).sort((a, b) => b[1].high - a[1].high || b[1].total - a[1].total || a[0].localeCompare(b[0]));
}

function auditOptions(options, selected) {
  return options.map((option) => `<option ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("");
}

function renderAuditEntry(entries) {
  const today = new Date().toISOString().slice(0, 10);
  const latest = entries[0];
  const geo = state.auditDraftGeo;
  const image = state.auditDraftImage;
  return `
    <div class="audit-workspace">
      <article class="panel audit-form-panel">
        <header>
          <div>
            <span class="eyebrow">Data Entry</span>
            <h3>Mobile field audit form</h3>
          </div>
          <span class="status-pill">${state.auditBackend ? `${escapeHtml(state.auditBackend)} backend` : "Backend data entry"}</span>
        </header>
        <div class="audit-form-grid">
          <label class="field">
            <span>Report year</span>
            <select id="auditEntryYear">
              ${["2025", "2024"].map((year) => `<option value="${year}" ${year === String(state.auditYear) ? "selected" : ""}>${year}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Department</span>
            <select id="auditDepartment">${auditOptions(AUDIT_DEPARTMENTS, "Mill Department")}</select>
          </label>
          <label class="field">
            <span>Audit area</span>
            <select id="auditArea">${auditOptions(AUDIT_AREAS, "SOP compliance")}</select>
          </label>
          <label class="field">
            <span>Priority</span>
            <select id="auditPriority">
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
              <option>Critical</option>
            </select>
          </label>
          <label class="field">
            <span>Status</span>
            <select id="auditStatus">
              <option>Open</option>
              <option>In progress</option>
              <option>Closed</option>
            </select>
          </label>
          <label class="field">
            <span>Division, block, or location</span>
            <input id="auditLocation" placeholder="Example: 2019 Block A6, mill line, main store" />
          </label>
          <label class="field">
            <span>Responsible owner</span>
            <input id="auditOwner" placeholder="Department HOD or action owner" />
          </label>
          <label class="field">
            <span>Target closure date</span>
            <input id="auditDueDate" type="date" value="${today}" />
          </label>
          <label class="field">
            <span>Reference / asset tag</span>
            <input id="auditReference" placeholder="Optional asset, invoice, block, or SOP reference" />
          </label>
          <label class="field wide">
            <span>Observations / Findings</span>
            <textarea id="auditFinding" rows="4" placeholder="Write the audit issue observed in the field."></textarea>
          </label>
          <label class="field wide">
            <span>Impact</span>
            <textarea id="auditImpact" rows="3" placeholder="Describe operational, financial, safety, compliance, or quality impact."></textarea>
          </label>
          <label class="field wide">
            <span>Recommendation / Corrective action</span>
            <textarea id="auditRecommendation" rows="3" placeholder="State corrective action, prevention control, and evidence required for closure."></textarea>
          </label>
        </div>
        <div class="audit-evidence-grid">
          <section class="audit-evidence-card">
            <div>
              <span class="mini-icon">ph</span>
              <b>Photo evidence</b>
              <small>Upload an existing image or take a field photo on mobile.</small>
            </div>
            <div class="audit-photo-actions">
              <label class="secondary-button" for="auditUploadInput">Upload image</label>
              <button class="primary-button" id="startAuditCamera" type="button"><span class="mini-icon">cm</span> Take photo</button>
            </div>
            <input class="audit-file-input" id="auditUploadInput" type="file" accept="image/*" />
            <input class="audit-file-input" id="auditCameraInput" type="file" accept="image/*" capture="environment" />
            ${state.auditCameraOpen ? `
              <div class="audit-camera-capture">
                <video id="auditCameraPreview" autoplay playsinline muted></video>
                <div class="audit-camera-actions">
                  <button class="secondary-button" id="cancelAuditCamera" type="button">Cancel</button>
                  <button class="primary-button" id="captureAuditCamera" type="button"><span class="mini-icon">cm</span> Capture Photo</button>
                </div>
                <span id="auditCameraStatus">${escapeHtml(state.auditCameraError || "Starting camera...")}</span>
              </div>
            ` : ""}
            ${image ? `<img class="audit-photo-preview" src="${image}" alt="Audit evidence preview" />` : `<div class="audit-empty-photo">No image selected</div>`}
            <span id="auditPhotoStatus">${image ? escapeHtml(state.auditDraftImageName || "Image ready") : "Attach or capture field evidence."}</span>
          </section>
          <section class="audit-evidence-card">
            <div>
              <span class="mini-icon">gp</span>
              <b>Map location proof</b>
              <small>Captured automatically in the background when a field photo is taken.</small>
            </div>
            <div class="audit-geo-readout" id="auditGeoStatus">
              ${renderAuditGeoReadout(geo)}
            </div>
            <span id="auditGeoHelper">Uploads can be saved without map proof. Camera capture attempts GPS automatically.</span>
          </section>
        </div>
        <footer class="audit-form-footer">
          <span id="auditSaveStatus">Findings are saved to the Audit backend for reporting.</span>
          <div class="action-row">
            <button class="secondary-button" id="clearAuditDraft">Clear</button>
            <button class="primary-button" id="saveAuditEntry"><span class="mini-icon">sv</span> Save Finding</button>
          </div>
        </footer>
      </article>
      <aside class="audit-side-stack">
        <article class="panel">
          <header>
            <div>
              <span class="eyebrow">Recommended Controls</span>
              <h3>Field audit features</h3>
            </div>
          </header>
          <div class="audit-feature-list">
            <div><b>Mandatory photo and GPS</b><span>Require both for critical and high-priority findings.</span></div>
            <div><b>Offline drafts</b><span>Save entries locally during estate visits, then sync once online.</span></div>
            <div><b>Before and after evidence</b><span>Attach closure photos when corrective actions are completed.</span></div>
            <div><b>Owner workflow</b><span>Assign HOD, due date, management response, and closure status.</span></div>
            <div><b>Reference tags</b><span>Link finding to block, asset, SOP, invoice, GRN, or stock item.</span></div>
          </div>
        </article>
        <article class="panel audit-recent-panel">
          <header>
            <div>
              <span class="eyebrow">Latest Finding</span>
              <h3>${latest ? escapeHtml(latest.department) : "No entries"}</h3>
            </div>
            ${latest ? `<span class="risk ${auditPriorityClass(latest.priority)}">${escapeHtml(latest.priority)}</span>` : ""}
          </header>
          ${latest ? `
            <div class="audit-latest">
              <b>${escapeHtml(latest.finding)}</b>
              <span>${escapeHtml(latest.location || "Location pending")}</span>
              <small>${auditDateLabel(latest.capturedAt)} - ${escapeHtml(latest.status)}</small>
              <button class="secondary-button" id="openAuditReport">Open Report</button>
            </div>
          ` : ""}
        </article>
      </aside>
    </div>
  `;
}

function renderAuditReport(entries) {
  const rows = auditDepartmentRows(entries);
  const settings = auditReportSettings();
  const auditPeriod = `${auditDateLabel(settings.auditPeriodStart)} to ${auditDateLabel(settings.auditPeriodEnd)}`;
  return `
    <div class="audit-report-layout">
      <article class="panel audit-report-panel">
        <header>
          <div>
            <span class="eyebrow">Report</span>
            <h3>OBAN internal audit report - ${escapeHtml(state.auditYear)}</h3>
          </div>
          <div class="input-actions">
            <button class="action-icon edit" id="printAuditReport" title="Print or save report" aria-label="Print or save report">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6z" /></svg>
            </button>
            <button class="action-icon add" id="downloadAuditReport" title="Download report draft" aria-label="Download report draft">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
            </button>
          </div>
        </header>
        <div class="audit-report-tools">
          <label>
            <span>Report year</span>
            <select id="auditReportYear">
              ${["2025", "2024"].map((year) => `<option value="${year}" ${year === String(state.auditYear) ? "selected" : ""}>${year}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Search findings</span>
            <input id="auditSearch" value="${escapeHtml(state.auditSearch)}" placeholder="Department, issue, or location" />
          </label>
          <label>
            <span>Rows</span>
            <select id="auditPageSize">
              ${[5, 10, 20, 50].map((size) => `<option value="${size}" ${size === state.auditPageSize ? "selected" : ""}>${size}</option>`).join("")}
            </select>
          </label>
          <div class="audit-pagination" aria-label="Audit report pagination">
            <button class="secondary-button" id="auditPrevPage" ${state.auditPage <= 1 ? "disabled" : ""}>Prev</button>
            <span>${escapeHtml(auditPaginationLabel())}</span>
            <button class="secondary-button" id="auditNextPage" ${state.auditPage * state.auditPageSize >= state.auditTotal ? "disabled" : ""}>Next</button>
          </div>
        </div>
        <div class="audit-report-page" id="auditReportPage">
          <div class="audit-report-cover">
            <img class="brand-logo" src="${escapeHtml(brandLogoUrl())}" alt="Agrinexus logo" />
            <div>
              <span>${escapeHtml(settings.auditConfidentiality)}</span>
              <h3>${escapeHtml(settings.auditReportTitle)}</h3>
              <p>${escapeHtml(settings.auditClientName)} - ${escapeHtml(settings.auditLocation)}</p>
              <small>Prepared by: ${escapeHtml(settings.auditPreparedBy)} - Audit period: ${escapeHtml(auditPeriod)} - Date of issue: ${auditDateLabel(settings.auditIssueDate)}</small>
            </div>
          </div>
          <div class="audit-summary-grid">
            ${auditSummary(entries).map(([label, value, note]) => `
              <div>
                <span>${escapeHtml(label)}</span>
                <b>${escapeHtml(value)}</b>
                <small>${escapeHtml(note)}</small>
              </div>
            `).join("")}
          </div>
          <section class="audit-report-section">
            <h4>Audit Findings by Department</h4>
            <div class="audit-table-scroll">
              <table class="audit-table">
                <thead>
                  <tr><th>Department</th><th>Total</th><th>High</th><th>Medium</th><th>Low</th><th>Open</th></tr>
                </thead>
                <tbody>
                  ${rows.map(([department, counts]) => `
                    <tr>
                      <td>${escapeHtml(department)}</td>
                      <td>${counts.total}</td>
                      <td>${counts.high}</td>
                      <td>${counts.medium}</td>
                      <td>${counts.low}</td>
                      <td>${counts.open}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </section>
          <section class="audit-report-section">
            <h4>Detailed Findings</h4>
            <div class="audit-finding-list">
              ${entries.map((entry, index) => `
                <article class="audit-finding-card">
                  <header>
                    <div>
                      <span>Audit Issue ${index + 1}: ${escapeHtml(entry.department)}</span>
                      <h5>${escapeHtml(entry.area || "Audit observation")}</h5>
                    </div>
                    <b class="risk ${auditPriorityClass(entry.priority)}">${escapeHtml(entry.priority)}</b>
                  </header>
                  <div class="audit-finding-body">
                    <div><b>Observations / Findings</b><span>${escapeHtml(entry.finding)}</span></div>
                    <div><b>Impact</b><span>${escapeHtml(entry.impact)}</span></div>
                    <div><b>Recommendation</b><span>${escapeHtml(entry.recommendation)}</span></div>
                    <div class="audit-response-row">
                      <span><b>Owner</b>${escapeHtml(entry.owner || "-")}</span>
                      <span><b>Timeline</b>${auditDateLabel(entry.dueDate)}</span>
                      <span><b>Status</b><em class="risk ${auditStatusClass(entry.status)}">${escapeHtml(entry.status || "Open")}</em></span>
                    </div>
                    <div class="audit-evidence-row">
                      ${entry.photoDataUrl || entry.photoUrl ? `<img src="${escapeHtml(entry.photoDataUrl || entry.photoUrl)}" alt="Audit evidence" />` : `<div class="audit-photo-token">${escapeHtml(entry.photoName || "Evidence pending")}</div>`}
                      <span>${escapeHtml(entry.location || "Location pending")}</span>
                      ${renderAuditMapProof(entry.geo)}
                      <span>${escapeHtml(entry.reference || entry.source || "Field entry")}</span>
                    </div>
                  </div>
                </article>
              `).join("")}
            </div>
          </section>
          <footer>Produced by Agrinexus Intelligence - Public-source and field-entry data, for management review only</footer>
        </div>
      </article>
    </div>
  `;
}

function resetAuditDraft() {
  stopAuditCamera();
  state.auditDraftImage = null;
  state.auditDraftImageName = "";
  state.auditDraftGeo = null;
  state.auditCameraError = "";
}

function auditGeoText(geo) {
  if (!geo) return "Map location will attach after Take photo.";
  return `Map location captured - accuracy ${formatNumber(geo.accuracy, { maximumFractionDigits: 0 })}m`;
}

function auditMapUrls(geo) {
  const latitude = Number(geo?.latitude);
  const longitude = Number(geo?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const lat = latitude.toFixed(6);
  const lon = longitude.toFixed(6);
  return {
    label: auditGeoText(geo),
    link: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`,
  };
}

function renderAuditMapProof(geo, compact = false) {
  const urls = auditMapUrls(geo);
  if (!urls) return `<div class="audit-map-proof empty">Map location pending</div>`;
  return `
    <div class="audit-map-proof${compact ? " compact" : ""}">
      <span class="audit-map-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-12A7 7 0 0 0 5 9c0 6.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.4" /></svg>
      </span>
      <div>
        <a href="${escapeHtml(urls.link)}" target="_blank" rel="noopener">Open map location</a>
        <small>${escapeHtml(urls.label)}</small>
      </div>
    </div>
  `;
}

function renderAuditGeoReadout(geo) {
  if (!geo) return `<span class="audit-map-pending">Map location will attach after Take photo.</span>`;
  return renderAuditMapProof(geo, true);
}

function updateAuditPhotoPreview(fileName, sourceType) {
  const preview = qs(".audit-empty-photo, .audit-photo-preview");
  const status = qs("#auditPhotoStatus");
  if (preview) preview.outerHTML = `<img class="audit-photo-preview" src="${state.auditDraftImage}" alt="Audit evidence preview" />`;
  if (status) status.textContent = `${fileName} ready to save${sourceType === "camera" ? " with GPS tagging in progress." : "."}`;
}

function captureAuditGeoInBackground() {
  const status = qs("#auditGeoStatus");
  const helper = qs("#auditGeoHelper");
  if (!navigator.geolocation) {
    if (status) status.textContent = "Geolocation is not available in this browser.";
    if (helper) helper.textContent = "The photo can still be saved, but no GPS tag was captured.";
    return;
  }
  if (status) status.textContent = "Capturing GPS in background...";
  if (helper) helper.textContent = "Keep the browser open until the GPS tag appears.";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.auditDraftGeo = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      if (status) status.innerHTML = renderAuditGeoReadout(state.auditDraftGeo);
      if (helper) helper.textContent = "Map proof captured automatically from the photo workflow.";
      const photoStatus = qs("#auditPhotoStatus");
      if (photoStatus) photoStatus.textContent = `${state.auditDraftImageName || "Photo"} ready to save with map proof.`;
    },
    (error) => {
      if (status) status.textContent = error.message || "GPS permission was not granted.";
      if (helper) helper.textContent = "The photo can still be saved, but GPS permission is needed for geotagging.";
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
  );
}

function stopAuditCamera() {
  if (state.auditCameraStream) {
    state.auditCameraStream.getTracks().forEach((track) => track.stop());
  }
  state.auditCameraStream = null;
  state.auditCameraOpen = false;
}

async function startAuditCamera() {
  state.auditCameraError = "";
  if (!navigator.mediaDevices?.getUserMedia) {
    qs("#auditCameraInput")?.click();
    return;
  }
  state.auditCameraOpen = true;
  await renderAudit();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    state.auditCameraStream = stream;
    const video = qs("#auditCameraPreview");
    if (video) {
      video.srcObject = stream;
      await video.play().catch(() => {});
    }
    const status = qs("#auditCameraStatus");
    if (status) status.textContent = "Camera ready. Frame the evidence and capture.";
  } catch (error) {
    state.auditCameraError = error.message || "Camera permission was not granted.";
    stopAuditCamera();
    await renderAudit();
  }
}

function captureAuditCameraPhoto() {
  const video = qs("#auditCameraPreview");
  const status = qs("#auditCameraStatus");
  if (!video || !video.videoWidth || !video.videoHeight) {
    if (status) status.textContent = "Camera is still starting. Try again in a moment.";
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    if (status) status.textContent = "Camera capture could not be prepared in this browser.";
    return;
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  state.auditDraftImage = canvas.toDataURL("image/jpeg", 0.86);
  state.auditDraftImageName = `field-photo-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
  stopAuditCamera();
  renderAudit();
  setTimeout(() => captureAuditGeoInBackground(), 0);
}

async function downloadAuditPdf() {
  const button = qs("#downloadAuditReport");
  const previousLabel = button?.getAttribute("aria-label") || "Download audit report PDF";
  if (button) {
    button.setAttribute("aria-label", "Generating audit report PDF");
    button.setAttribute("disabled", "disabled");
  }
  try {
    const response = await fetch(`/api/projects/${PROJECT_ID}/audit-pdf?download=1`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auditYear: state.auditYear,
        reportSettings: auditReportSettings(),
        brandingLogoUrl: brandLogoUrl(),
      }),
    });
    if (!response.ok) throw new Error(`PDF generation failed: ${response.status}`);
    const blob = await response.blob();
    const issueDate = auditReportSettings().auditIssueDate || new Date().toISOString().slice(0, 10);
    const fallbackName = `oban-audit-report-${issueDate}.pdf`;
    downloadBlob(filenameFromDisposition(response.headers.get("Content-Disposition"), fallbackName), blob);
  } catch (error) {
    window.alert(error.message || "Audit PDF could not be generated.");
  } finally {
    if (button) {
      button.setAttribute("aria-label", previousLabel);
      button.removeAttribute("disabled");
    }
  }
}

async function handleAuditPhotoSelection(event, sourceType) {
  const file = event.target.files?.[0];
  if (!file) return;
  const status = qs("#auditPhotoStatus");
  if (!/^image\//i.test(file.type)) {
    if (status) status.textContent = "Please select an image file.";
    return;
  }
  state.auditDraftImageName = file.name || (sourceType === "camera" ? "Field photo" : "Uploaded image");
  state.auditDraftImage = await readFileAsDataUrl(file);
  updateAuditPhotoPreview(state.auditDraftImageName, sourceType);
  if (sourceType === "camera") captureAuditGeoInBackground();
}

function bindAuditEvents() {
  qsa("#auditTabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.auditPanel === state.selectedAuditPanel);
    button.addEventListener("click", () => {
      state.selectedAuditPanel = button.dataset.auditPanel || "entry";
      renderAudit();
    });
  });

  bindEvent("#auditUploadInput", "change", (event) => handleAuditPhotoSelection(event, "upload"));
  bindEvent("#auditCameraInput", "change", (event) => handleAuditPhotoSelection(event, "camera"));
  bindClick("#startAuditCamera", startAuditCamera);
  bindClick("#captureAuditCamera", captureAuditCameraPhoto);
  bindClick("#cancelAuditCamera", () => {
    stopAuditCamera();
    renderAudit();
  });
  bindEvent("#auditEntryYear", "change", (event) => {
    state.auditYear = event.target.value || "2025";
    state.auditPage = 1;
    renderAudit();
  });
  bindEvent("#auditReportYear", "change", (event) => {
    state.auditYear = event.target.value || "2025";
    state.auditPage = 1;
    renderAudit();
  });

  bindClick("#auditPrevPage", () => {
    state.auditPage = Math.max(1, state.auditPage - 1);
    renderAudit();
  });
  bindClick("#auditNextPage", () => {
    state.auditPage += 1;
    renderAudit();
  });
  bindEvent("#auditPageSize", "change", (event) => {
    state.auditPageSize = Number(event.target.value) || 5;
    state.auditPage = 1;
    renderAudit();
  });
  bindEvent("#auditSearch", "input", (event) => {
    state.auditSearch = event.target.value;
    state.auditPage = 1;
    clearTimeout(state.auditSearchTimer);
    state.auditSearchTimer = setTimeout(() => renderAudit(), 250);
  });

  bindClick("#saveAuditEntry", async () => {
    const finding = qs("#auditFinding")?.value.trim();
    const status = qs("#auditSaveStatus");
    if (!finding) {
      if (status) status.textContent = "Observation / Finding is required before saving.";
      return;
    }
    const entry = {
      id: `audit_${Date.now()}`,
      auditYear: qs("#auditEntryYear")?.value || state.auditYear,
      department: qs("#auditDepartment")?.value || "Unassigned",
      area: qs("#auditArea")?.value || "SOP compliance",
      priority: qs("#auditPriority")?.value || "High",
      status: qs("#auditStatus")?.value || "Open",
      location: qs("#auditLocation")?.value.trim() || "",
      owner: qs("#auditOwner")?.value.trim() || "",
      dueDate: qs("#auditDueDate")?.value || "",
      reference: qs("#auditReference")?.value.trim() || "",
      finding,
      impact: qs("#auditImpact")?.value.trim() || "Impact pending review.",
      recommendation: qs("#auditRecommendation")?.value.trim() || "Corrective action pending assignment.",
      geo: state.auditDraftGeo,
      photoDataUrl: state.auditDraftImage,
      photoName: state.auditDraftImageName,
      source: "Field entry",
      capturedAt: new Date().toISOString(),
    };
    try {
      if (status) status.textContent = "Saving finding...";
      const result = await requestJson(`/api/projects/${PROJECT_ID}/audit-entries`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      saveAuditEntries([result.entry || entry, ...auditEntries()]);
      state.auditPage = 1;
      resetAuditDraft();
      if (status) status.textContent = "Finding saved.";
      renderAudit();
    } catch (error) {
      if (status) status.textContent = error.message || "Finding could not be saved.";
    }
  });

  bindClick("#clearAuditDraft", () => {
    resetAuditDraft();
    renderAudit();
  });

  bindClick("#openAuditReport", () => {
    state.selectedAuditPanel = "report";
    renderAudit();
  });

  bindClick("#printAuditReport", () => window.print());
  bindClick("#downloadAuditReport", downloadAuditPdf);
}

async function renderAudit() {
  const workspace = qs("#auditWorkspace");
  if (!workspace) return;
  if (!canAccessAudit()) {
    workspace.innerHTML = `
      <article class="panel empty-state">
        <strong>Audit is available to admin users only.</strong>
        <span>Sign in as admin to use field audit data entry and reporting.</span>
      </article>
    `;
    return;
  }
  workspace.innerHTML = `
    <article class="panel empty-state">
      <strong>Loading Audit data</strong>
      <span>Fetching seeded findings and field entries from the backend.</span>
    </article>
  `;
  const entries = await loadAuditEntries();
  workspace.innerHTML = state.selectedAuditPanel === "report" ? renderAuditReport(entries) : renderAuditEntry(entries);
  bindAuditEvents();
  applyBrandingLogo();
}

function renderChecks() {
  const checks = modelCheckRows();
  const html = checks
    .map(([title, note]) => `
      <div>
        <b>${title}</b>
        <span>${note}</span>
      </div>
    `)
    .join("");
  const checkList = qs("#checkList");
  const managementCheckList = qs("#managementCheckList");
  if (checkList) checkList.innerHTML = html;
  if (managementCheckList) managementCheckList.innerHTML = html;
}

function modelCheckRows() {
  const counts = {
    inputs: state.projectData.inputRecords.length,
    formulas: state.projectData.formulaRules.length,
    reports: state.projectData.reportSnapshots.length,
    transactions: state.projectData.transactions.length,
    marketData: state.projectData.marketData.length,
  };
  return [
    ["Scope", "38 system sheets exposed; raw workbook tabs retained internally for analysis/calculation tracing."],
    ["Analysis-only", `${state.analysis.analysisOnlySheets.join(" and ")} excluded from system navigation.`],
    ["Database seed", `${counts.inputs} input records, ${counts.formulas} formula rules, ${counts.reports} reports, ${counts.transactions} transactions, and ${counts.marketData} market data records.`],
    ["Company / project", `${state.projectData.company.name} · ${state.projectData.project.name}`],
    ["Formula scan", `${state.analysis.totals.formulaCells.toLocaleString()} raw formula cells analyzed, ${state.analysis.totals.externalReferenceFormulas} external-reference formulas detected.`],
    ["Review flag", `${state.analysis.totals.formulaErrorsInText["#REF!"] || 0} raw formulas contain #REF! text and should be reviewed before publishing the model.`],
  ];
}

function cpoToneClass(tone) {
  if (tone === "down") return "down";
  if (tone === "up") return "up";
  return "";
}

function formatLocalDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function renderCpoMiniChart(curve) {
  const prices = (curve?.prices || []).map(Number).filter(Number.isFinite);
  const volumes = (curve?.volume || []).map(Number).filter(Number.isFinite);
  const labels = curve?.labels || [];
  if (!prices.length) return "";

  const width = 520;
  const height = 136;
  const left = 72;
  const right = 18;
  const top = 12;
  const bottom = 28;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const min = Math.min(...prices, 4400);
  const max = Math.max(...prices, 5200);
  const span = max - min || 1;
  const maxVolume = Math.max(...volumes, 1);
  const x = (index) => left + (chartWidth * index) / Math.max(prices.length - 1, 1);
  const y = (value) => top + chartHeight - ((value - min) / span) * chartHeight;
  const points = prices.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const area = `${left},${top + chartHeight} ${points} ${x(prices.length - 1)},${top + chartHeight}`;
  const grid = [4400, 4600, 4800, 5000, 5200]
    .map((tick) => {
      const tickY = y(tick);
      return `
        <line x1="${left}" y1="${tickY}" x2="${width - right}" y2="${tickY}" />
        <text x="${left - 8}" y="${tickY + 4}" text-anchor="end">RM${tick.toLocaleString()}</text>
      `;
    })
    .join("");
  const bars = (curve.volume || [])
    .map((volume, index) => {
      const barHeight = Math.max(2, (Number(volume || 0) / maxVolume) * 58);
      return `<rect x="${x(index) - 5}" y="${top + chartHeight - barHeight}" width="10" height="${barHeight}" rx="2" />`;
    })
    .join("");
  const labelHtml = labels
    .map((label, index) => (index % 2 === 0 ? `<text x="${x(index)}" y="${height - 8}" text-anchor="middle">${escapeHtml(label)}</text>` : ""))
    .join("");

  return `
    <svg class="cpo-mini-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(curve.title || "CPO forward curve")}">
      <g class="cpo-grid">${grid}</g>
      <polygon class="cpo-area" points="${area}" />
      <g class="cpo-bars">${bars}</g>
      <polyline class="cpo-line" points="${points}" />
      ${prices.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="2.3" />`).join("")}
      <g class="cpo-labels">${labelHtml}</g>
    </svg>
  `;
}

function renderCpoList(rows) {
  return (rows || [])
    .map(([label, value, tone]) => `
      <div class="cpo-mini-row">
        <span>${escapeHtml(label)}</span>
        <b class="${cpoToneClass(tone)}">${escapeHtml(value)}</b>
      </div>
    `)
    .join("");
}

function renderLocalCpoOverviewPanel(report, refreshState = {}) {
  const target = qs("#publicCpoOverviewPanel");
  if (!target || !report) return;
  state.cpoReport = report;
  const { refreshed = false, loading = false, error = "" } = typeof refreshState === "object" ? refreshState : { refreshed: Boolean(refreshState) };
  const sourceError = report.refreshStatus === "failed" ? report.refreshError || "Public source refresh failed" : "";
  const liveStamp = report.sourceUpdatedAt || report.cacheUpdatedAt || "";
  const refreshNote = error || sourceError
    ? error
    : loading
      ? "Refreshing local cache..."
      : report.refreshStatus === "live"
        ? `Updated from public source${liveStamp ? ` ${liveStamp}` : ""}`
      : refreshed && state.cpoLastRefreshAt
        ? `Local cache reloaded ${formatLocalDateTime(state.cpoLastRefreshAt)}`
        : "Cached market snapshot";

  const cards = (report.cards || [])
    .map((card) => {
      const neutralDelta = String(card.primaryDelta || "").toLowerCase().includes("lots traded");
      const primaryDeltaClass = neutralDelta ? "neutral" : card.primaryTone || "up";
      const primaryMarker = primaryDeltaClass === "up" ? "▲ " : primaryDeltaClass === "down" ? "▼ " : "";
      const secondaryClass = card.secondaryTone || "up";
      const secondaryMarker = secondaryClass === "up" ? "▲ " : secondaryClass === "down" ? "▼ " : "";
      return `
      <div class="cpo-mini-card ${card.negative ? "volume-card" : ""}">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.primary)}</strong>
        ${card.primaryDelta ? `<em class="${primaryDeltaClass}">${primaryMarker}${escapeHtml(card.primaryDelta).replace(/^[▲▼]\\s*/, "")}</em>` : ""}
        ${card.secondary ? `<strong>${escapeHtml(card.secondary)}</strong>` : ""}
        ${card.secondaryDelta ? `<em class="${secondaryClass}">${secondaryMarker}${escapeHtml(card.secondaryDelta).replace(/^[▲▼]\\s*/, "")}</em>` : ""}
        <small>${escapeHtml(card.footnote || "")} ${card.negative ? `<i>${escapeHtml(card.negative)}</i>` : ""}</small>
      </div>
    `;
    })
    .join("");

  target.innerHTML = `
    <header class="cpo-mini-head">
      <div>
        <span class="eyebrow">Market Desk</span>
        <h3>CPO report</h3>
        <p>${escapeHtml(report.refreshedAt || "")}</p>
      </div>
      <div class="cpo-mini-source">
        <span>Source: Bursa Malaysia Derivatives</span>
        <span>Prev close: ${escapeHtml(report.previousClose || "")}</span>
        <div class="cpo-action-row">
          <button class="secondary-button cpo-refresh-button" type="button" ${loading ? "disabled" : ""}>${loading ? "Refreshing..." : "Refresh"}</button>
          <a class="cpo-download-button" href="/api/cpo-market/pdf?download=1" title="Download CPO report PDF" aria-label="Download CPO report PDF">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </a>
        </div>
        <small class="${error || sourceError ? "is-error" : ""}">${escapeHtml(refreshNote)}</small>
      </div>
    </header>
    <div class="cpo-mini-kpis">${cards}</div>
    <div class="cpo-mini-chart-card">
      <div class="cpo-chart-title">
        <b>${escapeHtml(report.curve?.title || "Forward curve - FCPO 12 months")}</b>
        <span>${escapeHtml(report.curve?.subtitle || "")}</span>
      </div>
      ${renderCpoMiniChart(report.curve)}
    </div>
    <div class="cpo-mini-bottom">
      <div>
        <h4>Where today sits</h4>
        ${renderCpoList(report.today)}
      </div>
      <div>
        <h4>Adjacent markets</h4>
        ${renderCpoList(report.adjacent)}
      </div>
    </div>
  `;

  qs(".cpo-refresh-button")?.addEventListener("click", () => loadLocalCpoOverviewPanel(true));
}

async function loadLocalCpoOverviewPanel(refreshed = false) {
  const target = qs("#publicCpoOverviewPanel");
  if (!target) return;
  if (refreshed && state.cpoReport) {
    renderLocalCpoOverviewPanel(state.cpoReport, { refreshed: true, loading: true });
  }
  try {
    const endpoint = refreshed ? `/api/cpo-market/refresh?v=${Date.now()}` : `/api/cpo-market?v=${Date.now()}`;
    const report = await requestJson(endpoint, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });
    if (refreshed) state.cpoLastRefreshAt = new Date();
    renderLocalCpoOverviewPanel(report, { refreshed });
  } catch (error) {
    if (state.cpoReport) {
      renderLocalCpoOverviewPanel(state.cpoReport, {
        refreshed: true,
        error: `${error.message}. Showing last local snapshot.`,
      });
    } else {
      target.innerHTML = `
        <header>
          <div>
            <span class="eyebrow">Market Desk</span>
            <h3>CPO report</h3>
          </div>
          <div class="cpo-action-row">
            <button class="secondary-button cpo-refresh-button" type="button">Refresh</button>
            <a class="cpo-download-button" href="/api/cpo-market/pdf?download=1" title="Download CPO report PDF" aria-label="Download CPO report PDF">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
            </a>
          </div>
        </header>
        <div class="empty-state">
          <strong>Local CPO cache not available</strong>
          <span>${escapeHtml(error.message)}. Keep the fields here and add the source data later.</span>
        </div>
      `;
      qs(".cpo-refresh-button")?.addEventListener("click", () => loadLocalCpoOverviewPanel(true));
    }
  }
}

function bindNavigation() {
  qsa(".module").forEach((button) => {
    button.addEventListener("click", () => {
      qsa(".module").forEach((item) => item.classList.remove("active"));
      qsa(".view").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      const view = qs(`#${button.dataset.view}`);
      if (view) view.classList.add("active");
    });
  });

  bindEvent("#sheetSearch", "input", (event) => {
    renderSheetList(event.target.value);
  });

  if (window.location.pathname.includes("management-console")) {
    qs('.module[data-view="management"]')?.click();
  }
}

async function init() {
  const [session, analysis, projectData] = await Promise.all([
    requestJson("/api/session", { credentials: "same-origin" }),
    requestJson("./public/workbook-analysis.json"),
    requestJson(`/api/projects/${PROJECT_ID}`),
  ]);
  state.currentSession = session;
  state.analysis = analysis;
  state.projectData = projectData;
  applyBrandingLogo();
  applySessionUi();
  renderMetrics();
  loadLocalCpoOverviewPanel();
  renderDependencies();
  renderManagementConsole();
  renderInputs();
  renderReports();
  if (canAccessAudit()) renderAudit();
  renderFundingChart();
  renderChecks();
  renderMarketTicker();
  bindNavigation();
}

init().catch((error) => {
  document.body.innerHTML = `<main style="padding: 24px; font-family: sans-serif"><h1>Unable to load workbook analysis</h1><p>${error.message}</p></main>`;
});
