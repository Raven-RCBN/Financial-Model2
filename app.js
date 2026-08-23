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

if (window.location.protocol === "file:") {
  window.location.replace("http://127.0.0.1:4173/");
}

async function requestJson(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
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

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "");
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
  const supported = settings.supportedReportingCurrencies?.length ? settings.supportedReportingCurrencies : ["USD"];
  qs("#managementCompanyName").value = company.name || "";
  qs("#managementProjectName").value = project.name || "";
  qs("#managementStartYear").value = reportStartYear();
  qs("#managementReportingCurrency").innerHTML = supported
    .map((currency) => `<option value="${currency}" ${currency === reportingCurrency() ? "selected" : ""}>${currency}</option>`)
    .join("");
  qs("#managementConsoleStatus").textContent = `${company.name || "Company"} · ${project.name || "Project"} · ${reportingCurrency()} · starts ${reportStartYear()}`;
  bindClick("#saveManagementConsole", saveManagementConsole);
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
    }),
  });
  renderMetrics();
  renderIfrsMobileCards();
  renderFundingChart();
  renderManagementConsole();
  renderInputs();
  renderReports();
  renderChecks();
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
              <tr class="${row.style || "line"}">
                ${visibleColumns.map(({ index }, visibleIndex) => {
                  const cell = (row.cells || [])[index] || {
                    address: inputCellAddress(table, row, index),
                    value: "",
                    style: "",
                  };
                  const style = cell.style || "";
                  const numeric = style.includes("number");
                  const darkCell = inputCellIsDark(row, cell);
                  const value = rawInputCellValue(cell.value);
                  const address = cell.address || inputCellAddress(table, row, index);
                  return `
                    <td class="${visibleIndex === 0 ? "sticky-label" : ""} ${style} ${darkCell ? "dark-input-cell" : ""}">
                      <input class="input-cell-control ${numeric ? "numeric" : ""} ${darkCell ? "on-dark" : ""}" data-sheet-name="${escapeHtml(table.sheetName)}" data-address="${escapeHtml(address)}" value="${escapeHtml(value)}" title="${escapeHtml(value)}" />
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
              <tr class="${row.style || "line"}">
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

function formatReportNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (Math.abs(number) < 0.005) return "-";
  const text = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(number));
  return number < 0 ? `(${text})` : text;
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
  return `
    <section class="report-output workbook-report">
      <div class="workbook-report-title">
        <strong>${header.title}</strong>
        <span>${header.subtitle}</span>
        <b>${header.meta}</b>
      </div>
      <div class="financial-grid-scroll">
        <table class="financial-grid">
          <thead>
            <tr>
              <th class="sticky-label">Line item</th>
              <th>%</th>
              <th>Total</th>
              ${periods.map((period) => `<th>${period.period}</th>`).join("")}
            </tr>
            <tr>
              <th class="sticky-label"></th>
              <th></th>
              <th></th>
              ${periods.map((period, index) => `<th>${reportYearLabel(period, index)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${(table.rows || []).map((row) => `
              <tr class="${row.style || "line"}">
                <td class="sticky-label">${row.label || ""}</td>
                <td>${formatReportNumber(row.percent)}</td>
                <td>${formatReportNumber(row.total)}</td>
                ${(row.values || []).map((value) => {
                  const numeric = Number(value);
                  const negative = Number.isFinite(numeric) && numeric < 0;
                  return `<td class="${negative ? "negative" : ""}">${formatReportNumber(value)}</td>`;
                }).join("")}
              </tr>
            `).join("")}
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
      <div class="workbook-report-title">
        <strong>${header.title}</strong>
        <span>${header.subtitle}</span>
        <b>${header.meta}</b>
      </div>
      <div class="financial-grid-scroll">
        <table class="financial-grid worksheet-grid ${table.presentation || ""} ${display.compacted ? "compact-report-grid" : ""}">
          <tbody>
            ${display.rows.map((row) => `
              <tr class="${row.style || "line"}">
                ${(row.cells || []).map((cell, index) => {
                  const style = cell.style || "";
                  const numeric = style.includes("number");
                  const negative = style.includes("negative");
                  const value = numeric ? formatReportNumber(cell.value) : (cell.value ?? "");
                  return `<td class="${index === 0 ? "sticky-label" : ""} ${style} ${negative ? "negative" : ""}">${escapeHtml(value)}</td>`;
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
    return [
      [state.projectData.company.name],
      [state.projectData.project.name],
      [table.reportTitle || selected.sheetName],
      [`Figures in ${table.currency || reportingCurrency()}`],
      [],
      headers,
      ...table.rows.map((row) => [row.label, row.percent, row.total, ...(row.values || [])]),
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

function downloadSelectedReport() {
  const selected = selectedReportSnapshot();
  if (!selected) return;
  const url = `/api/projects/${PROJECT_ID}/report-pdf?sheetName=${encodeURIComponent(selected.sheetName)}&download=1`;
  window.location.href = url;
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
  qs("#reportPdfFrame").src = `/api/projects/${PROJECT_ID}/report-pdf?sheetName=${encodeURIComponent(selected.sheetName)}`;
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
        <button class="secondary-button cpo-refresh-button" type="button" ${loading ? "disabled" : ""}>${loading ? "Refreshing..." : "Refresh"}</button>
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
          <button class="secondary-button cpo-refresh-button" type="button">Refresh</button>
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
  const [analysis, projectData] = await Promise.all([
    requestJson("./public/workbook-analysis.json"),
    requestJson(`/api/projects/${PROJECT_ID}`),
  ]);
  state.analysis = analysis;
  state.projectData = projectData;
  renderMetrics();
  loadLocalCpoOverviewPanel();
  renderDependencies();
  renderManagementConsole();
  renderInputs();
  renderReports();
  renderFundingChart();
  renderChecks();
  renderMarketTicker();
  bindNavigation();
}

init().catch((error) => {
  document.body.innerHTML = `<main style="padding: 24px; font-family: sans-serif"><h1>Unable to load workbook analysis</h1><p>${error.message}</p></main>`;
});
