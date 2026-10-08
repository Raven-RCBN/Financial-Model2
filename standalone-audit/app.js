const auditPageCache = new Map();
let auditRenderVersion = 0;
// Audit-only frontend extracted for independent deployment.
const state={projectData: null,
selectedAuditPanel: "entry",
auditYear: "2025",
auditEntity: "",
currentSession: null,
auditEntries: null,
auditPage: 1,
auditPageSize: 5,
auditTotal: 0,
auditSummaryData: null,
auditYearCounts: {},
auditBackend: "",
auditLoading: false,
auditSearch: "",
auditStatusFilter: "",
auditSearchTimer: null,
auditDraftImage: null,
auditDraftImageName: "",
auditObservationImages: [],
auditDraftFields: {},
auditEditingDraft: null,
auditDraftGeo: null,
auditCameraOpen: false,
auditCameraStream: null,
auditCameraError: ""};
const PROJECT_ID = "project_opsl_15000ha_development";
const AUDIT_ENTITY_STORAGE_KEY = "audit.standaloneEntity.v1";
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
const DEFAULT_AUDIT_YEARS = ["2030", "2029", "2028", "2027", "2026", "2025", "2024"];
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
const DEFAULT_BRAND_LOGO = "./public/agrinexus-logo.jpeg?v=4";
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

function readImageFileAsCappedDataUrl(file, maxDimension = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Image could not be prepared."));
        return;
      }
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      readFileAsDataUrl(file).then(resolve).catch(reject);
    };
    image.src = objectUrl;
  });
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

function normalizeAuditList(values, fallback = []) {
  const seen = new Set();
  const source = Array.isArray(values) && values.some((value) => String(value || "").trim()) ? values : fallback;
  return source
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeAuditYears(values) {
  const configured = Array.isArray(values) ? values : [];
  return normalizeAuditList(configured, DEFAULT_AUDIT_YEARS)
    .filter((year) => /^\d{4}$/.test(year))
    .sort((a, b) => Number(b) - Number(a));
}

function normalizeAuditSetup(setup = {}) {
  return {
    years: normalizeAuditYears(setup.years),
    departments: normalizeAuditList(setup.departments, AUDIT_DEPARTMENTS),
    areas: normalizeAuditList(setup.areas, AUDIT_AREAS),
  };
}

function auditSetupSettings() {
  return normalizeAuditSetup(selectedCompanyProfile().auditSetup || projectSettings().auditSetup || {});
}

function auditYears() {
  return auditSetupSettings().years;
}

function auditDepartments() {
  return auditSetupSettings().departments;
}

function auditAreas() {
  return auditSetupSettings().areas;
}

function selectedCompanyProfile(name = auditEntityValue()) {
  return projectSettings().auditCompanyProfiles?.[name] || {};
}
function auditReportSettings(year = state.auditYear || "2025") {
  const profile=selectedCompanyProfile();
  return {auditReportTitle:`${year} Internal Audit Report`,auditClientName:auditEntityValue(),auditLocation:'',auditPreparedBy:'Agrinexus International',auditPeriodStart:'',auditPeriodEnd:'',auditIssueDate:'',auditConfidentiality:'Private & Confidential',...profile.auditReport,...profile.auditReportsByYear?.[year],auditClientName:auditEntityValue()};
}

function auditPermission(key) {
  return state.currentSession?.role === "admin" || Boolean(state.auditIdentity?.[key]);
}

function auditActionLocked(action, entry) {
  return Boolean(action.dueDate && action.dueDate < new Intl.DateTimeFormat('en-CA',{timeZone:entry?.timeZone || state.auditEntries?.find(e=>(e.actions||[]).some(a=>a.id===action.id))?.timeZone || 'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
}
function canReplyToAuditAction(action) {
  if (auditActionLocked(action) && state.currentSession?.role !== 'admin') return false;
  return state.currentSession?.role === "admin" || (auditPermission("respond") && state.auditIdentity?.email && state.auditIdentity.email.toLowerCase() === String(action.email || "").toLowerCase());
}

async function saveAuditUserPermissions() {
  const result = await requestJson(`/api/projects/${PROJECT_ID}/audit-access`, {method: "PUT", body: JSON.stringify({users: state.auditUsers || []})});
  state.auditUsers = result.users;
  state.auditIdentity = result.identity;
  state.auditAssignees = result.assignees || [];
}

function canAccessAudit() {
  return Boolean(state.currentSession?.userId);
}

function reportingCurrency() {
  return projectSettings().reportingCurrency || "USD";
}

function formatNumber(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "");
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 4,
  }).format(number);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function auditSetupFromDom() {
  return {
    years: qsa("#managementAuditYearChips [data-audit-setup-value]").map((chip) => chip.dataset.auditSetupValue),
    departments: qsa("#managementAuditDepartmentChips [data-audit-setup-value]").map((chip) => chip.dataset.auditSetupValue),
    areas: qsa("#managementAuditAreaChips [data-audit-setup-value]").map((chip) => chip.dataset.auditSetupValue),
  };
}

function setAuditSetup(setup) {
  state.projectData.project.settings ||= {};
  state.projectData.project.settings.auditSetup = normalizeAuditSetup(setup);
}

function renderAuditSetupChips(containerId, values, type) {
  const target = qs(containerId);
  if (!target) return;
  target.innerHTML = values
    .map((value) => `
      <span class="audit-setup-chip">
        <span data-audit-setup-value="${escapeHtml(value)}">${escapeHtml(value)}</span>
        <button type="button" data-audit-setup-remove="${escapeHtml(type)}" data-audit-setup-item="${escapeHtml(value)}" aria-label="Remove ${escapeHtml(value)}">&times;</button>
      </span>
    `)
    .join("");
}

function renderManagementAuditSetup() {
  const setup = auditSetupSettings();
  renderAuditSetupChips("#managementAuditYearChips", setup.years, "years");
  renderAuditSetupChips("#managementAuditDepartmentChips", setup.departments, "departments");
  renderAuditSetupChips("#managementAuditAreaChips", setup.areas, "areas");
  qsa("[data-audit-setup-add]").forEach((button) => {
    button.onclick = () => addAuditSetupValue(button.dataset.auditSetupAdd);
  });
  qsa("[data-audit-setup-remove]").forEach((button) => {
    button.onclick = () => removeAuditSetupValue(button.dataset.auditSetupRemove, button.dataset.auditSetupItem);
  });
}

function addAuditSetupValue(type) {
  const inputMap = {
    years: "#managementAuditYearInput",
    departments: "#managementAuditDepartmentInput",
    areas: "#managementAuditAreaInput",
  };
  const input = qs(inputMap[type]);
  const status = qs("#managementConsoleStatus");
  const value = String(input?.value || "").trim();
  if (!value) {
    if (status) status.textContent = "Enter a value before adding it to audit setup.";
    return;
  }
  if (type === "years" && !/^\d{4}$/.test(value)) {
    if (status) status.textContent = "Audit year must be a 4-digit year.";
    return;
  }
  const setup = auditSetupSettings();
  const next = {
    ...setup,
    [type]: normalizeAuditList([value, ...(setup[type] || [])], type === "years" ? DEFAULT_AUDIT_YEARS : []),
  };
  if (type === "years") next.years = normalizeAuditYears(next.years);
  setAuditSetup(next);
  if (input) input.value = "";
  if (status) status.textContent = "Audit setup updated. Save to publish these master data changes.";
  renderManagementAuditSetup();
  renderAudit();
}

function removeAuditSetupValue(type, value) {
  const setup = auditSetupSettings();
  const fallback = {
    years: DEFAULT_AUDIT_YEARS,
    departments: AUDIT_DEPARTMENTS,
    areas: AUDIT_AREAS,
  }[type] || [];
  const nextValues = (setup[type] || []).filter((item) => item !== value);
  setAuditSetup({ ...setup, [type]: nextValues.length ? nextValues : fallback });
  const status = qs("#managementConsoleStatus");
  if (status) status.textContent = "Audit setup updated. Save to publish these master data changes.";
  if (type === "years" && !auditYears().includes(String(state.auditYear))) {
    state.auditYear = auditYears()[0] || "2025";
  }
  renderManagementAuditSetup();
  renderAudit();
}

function renderAuditDirectory() {
  const target = qs("#auditUserDirectory");
  if (!target) return;
  if (state.currentSession?.role !== "admin") { target.innerHTML = ""; return; }
  const users = state.auditUsers || [];
  target.innerHTML = users.map(user => `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${[["companySetup", "Company setup"], ["create", "Audit creator"], ["recommend", "Corrective action author"], ["respond", "Assigned respondent"]].filter(([key]) => user.auditPermissions?.[key]).map(([, label]) => escapeHtml(label)).join("<br>") || "No permissions"}</td><td>${user.companyScope==='selected'?escapeHtml((user.companies||[]).join(", ")):"All companies"}</td><td>${escapeHtml(user.status)}</td><td><button class="secondary-button" data-edit-audit-user="${escapeHtml(user.id)}">Edit</button> <button class="secondary-button" data-delete-audit-user="${escapeHtml(user.id)}">Remove</button></td></tr>`).join("") || '<tr><td colspan="6">No audit users assigned. Add an audit user below.</td></tr>';
  const form = qs("#auditUserForm");
  form.onsubmit = async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const name = values.name.trim();
    const email = values.email.trim();
    if (!name || !email) return;
    const feedback = qs("#auditDirectoryStatus");
    if (users.some(user => user.name === name && user.id !== values.id)) { feedback.textContent = "This audit username is already assigned."; return; }
    const companyScope=values.companyScope==='all'?'all':'selected';
    const companies=values.companyScope.startsWith('company:')?[values.companyScope.slice(8)]:Array.from(form.querySelectorAll('[name="companies"]:checked')).map(input=>input.value);
    if(companyScope==='selected'&&!companies.length){feedback.textContent='Select at least one company or choose All companies.';return;}
    const user = {companyScope,companies:companyScope==='selected'?companies:[],id: values.id || crypto.randomUUID(), name, email, ...(values.password ? {password: values.password} : {}), status: values.status, auditPermissions: {companySetup: values.companySetup === "on", create: values.create === "on", recommend: values.recommend === "on", respond: values.respond === "on"}};
    const previous = structuredClone(users);
    state.auditUsers = [...users.filter(item => item.id !== user.id), user];
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    try { await saveAuditUserPermissions(); form.reset(); form.elements.id.value = ""; feedback.textContent = "Audit user and roles saved."; renderAuditDirectory(); }
    catch (error) { state.auditUsers = previous; feedback.textContent = error.message; }
    finally { submit.disabled = false; }
  };
  form.elements.companyScope.onchange=()=>{
    const value=form.elements.companyScope.value;
    if(value.startsWith('company:'))form.querySelectorAll('[name="companies"]').forEach(input=>input.checked=input.value===value.slice(8));
    qs('#auditUserCompanies').hidden=value!=='selected';
  };
  form.elements.companyScope.onchange();
  qs("#cancelAuditUserEdit").onclick = () => { form.reset(); form.elements.id.value = "";form.elements.companyScope.onchange(); };
  qsa("[data-edit-audit-user]").forEach(button => button.onclick = () => {
    const user = users.find(item => item.id === button.dataset.editAuditUser);
    for (const key of ["id", "name", "email", "status"]) form.elements[key].value = user[key] || "";
    for (const key of ["create", "recommend", "respond", "companySetup"]) form.elements[key].checked = Boolean(user.auditPermissions?.[key]);
    form.elements.companyScope.value=user.companyScope==='selected'?(user.companies?.length===1?'company:'+user.companies[0]:'selected'):'all';
    form.querySelectorAll('[name="companies"]').forEach(input=>input.checked=(user.companies||[]).includes(input.value));
    qs('#auditUserCompanies').hidden=form.elements.companyScope.value!=='selected';
    form.elements.password.value = "";
    form.elements.name.focus();
  });
  qsa("[data-delete-audit-user]").forEach(button => button.onclick = async () => {
    const previous = structuredClone(users);
    state.auditUsers = users.filter(user => user.id !== button.dataset.deleteAuditUser);
    button.disabled = true;
    try { await saveAuditUserPermissions(); renderAuditDirectory(); }
    catch (error) { state.auditUsers = previous; qs("#auditDirectoryStatus").textContent = error.message; button.disabled = false; }
  });
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

function auditQueryKey(){const q=new URLSearchParams({page:String(state.auditPage),pageSize:String(state.auditPageSize),auditYear:String(state.auditYear),company:auditEntityValue()});if(state.auditStatusFilter)q.set('status',state.auditStatusFilter);if(state.auditSearch.trim())q.set('q',state.auditSearch.trim());return q.toString();}
async function loadAuditEntries() {
  if (!canAccessAudit()) return [];
  state.auditLoading = true;
  const params = new URLSearchParams({
    page: String(state.auditPage),
    pageSize: String(state.auditPageSize),
    auditYear: String(state.auditYear),
    company: auditEntityValue(),
  });
  if (state.auditStatusFilter) params.set("status",state.auditStatusFilter);
  if (state.auditSearch.trim()) params.set("q", state.auditSearch.trim());
  try {
    const key=params.toString(),cached=auditPageCache.get(key);
    const result = cached && Date.now()-cached.at<15000 ? cached.data : await requestJson(`/api/projects/${PROJECT_ID}/audit-entries?${key}`);
    auditPageCache.delete(key);auditPageCache.set(key,{data:result,at:cached && Date.now()-cached.at<15000?cached.at:Date.now()});
    while(auditPageCache.size>12)auditPageCache.delete(auditPageCache.keys().next().value);
    if(key!==auditQueryKey())return [];
    state.auditEntries = Array.isArray(result.items) ? result.items : [];
    state.auditTotal = Number(result.total || state.auditEntries.length);
    state.auditSummaryData = result.summary || null;
    state.auditYearCounts = result.yearCounts && typeof result.yearCounts === "object" ? result.yearCounts : {};
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

function renderAuditObservationImages(images = []) {
  const items = Array.isArray(images) ? images.filter((item) => item?.dataUrl || item?.url) : [];
  if (!items.length) return "";
  return `
    <div class="audit-observation-report-images">
      ${items.map((item, index) => `
        <figure>
          <img src="${escapeHtml(item.dataUrl || item.url)}" alt="Observation image ${index + 1}" />
          <figcaption>${escapeHtml(item.description || item.name || `Observation image ${index + 1}`)}</figcaption>
        </figure>
      `).join("")}
    </div>
  `;
}

function auditDateLabel(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function auditSummary(entries) {
  if(state.auditSummaryData){const s=state.auditSummaryData;return [['Audit issues',String(s.total),'All matching records'],['High priority',String(s.high),'Critical and high risk'],['Departments',String(s.departments.length),'All matching records'],['Evidence',String(s.evidence),'Supporting evidence'],['Open actions',String(s.openActions),'Assigned follow-up actions']];}
  const departments = new Set(entries.map((entry) => entry.department).filter(Boolean));
  const highCount = entries.filter((entry) => ["critical", "high"].includes(String(entry.priority).toLowerCase())).length;
  const evidenceCount = entries.filter((entry) => entry.photoDataUrl || entry.photoUrl || entry.photoName || entry.observationImages?.length).length;
  const openCount = entries.filter((entry) => String(entry.status || "").toLowerCase() !== "closed").length;
  return [
    ["Findings", entries.length.toLocaleString(), "Captured observations"],
    ["High priority", highCount.toLocaleString(), "Critical and high risk"],
    ["Departments", departments.size.toLocaleString(), "Covered by report"],
    ["Evidence", evidenceCount.toLocaleString(), "Supporting evidence"],
    ["Open actions", openCount.toLocaleString(), "Pending closure"],
  ];
}

function auditDepartmentRows(entries) {
  if(state.auditSummaryData)return state.auditSummaryData.departments;
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

function auditOptions(options, selected, counts = null) {
  return options.map((option) => {
    const total = counts ? Number(counts[option] || 0) : 0;
    const selectedAttr = option === selected ? " selected" : "";
    const dataAttr = counts ? ` data-has-report="${total > 0 ? "1" : "0"}"` : "";
    const styleAttr = total > 0 ? ' style="background:#edf5ee;color:#145a25;font-weight:400;"' : "";
    return `<option${selectedAttr}${dataAttr}${styleAttr}>${escapeHtml(option)}</option>`;
  }).join("");
}

function auditYearHasReport(year) {
  return Number(state.auditYearCounts?.[String(year)] || 0) > 0;
}

function auditCompanyNames(){return projectSettings().auditCompanies || [state.projectData?.company?.name].filter(Boolean);}
function auditEntityValue(){
  const companies=auditCompanyNames();
  if(!companies.includes(state.auditEntity))state.auditEntity=state.projectData?.company?.name || companies[0] || '';
  return state.auditEntity;
}
function updateAuditEntity(value){
 state.auditEntity=auditCompanyNames().includes(value)?value:state.projectData.company.name;
 state.auditYearCounts={};
 const setup=auditSetupSettings();if(!setup.years.includes(state.auditYear))state.auditYear=setup.years[0];
 if(!setup.departments.includes(state.auditDraftFields.department))state.auditDraftFields.department='';
 if(!setup.areas.includes(state.auditDraftFields.area))state.auditDraftFields.area='';
 const users=companyAssignees();
 for(const action of state.auditDraftFields.actions || [])if(!users.some(u=>u.name===action.owner&&u.email===action.email)){action.owner='';action.email='';}
}
function renderAuditEntityCard(){return `<article class="panel audit-context-panel"><label class="field"><span>Company / estate</span><select id="auditEntity">${auditCompanyNames().map(name=>`<option value="${escapeHtml(name)}" ${name===auditEntityValue()?'selected':''}>${escapeHtml(name)}</option>`).join('')}</select></label><p>Data entry and reports use this company. Administrators can add companies in Audit management.</p></article>`;}
function sourceReportForSelection(){const report=projectSettings().auditSourceReports?.[state.auditYear];return report?.companyName===auditEntityValue()?report:null;}
function renderSourceDetails(entry){
 if(!entry.sourceReport)return '';
 const r=entry.sourceReport;
 return `<section class="audit-source-details"><div><b>Management response</b><p class="multiline-text">${escapeHtml(r.managementResponse||'No response recorded.')}</p></div><p><b>Timeline:</b> ${escapeHtml(r.timeline||'Not specified')}</p>${r.tables?.length?`<details><summary>Supporting tables (${r.tables.length})</summary>${r.tables.map(t=>`<div class="audit-table-scroll"><table class="audit-table"><tbody>${t.rows.map(row=>`<tr>${row.map(cell=>`<td class="multiline-text">${escapeHtml(cell||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('')}</details>`:''}</section>`;
}

function auditActionTiming(action) {
  if (action.status === "Closed") return { label: "Closed", tone: "closed" };
  if (!action.dueDate) return { label: "No due date", tone: "pending" };
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((Date.parse(`${action.dueDate}T00:00:00Z`) - today) / 86400000);
  if (days < 0) return { label: `Overdue by ${-days} day${days === -1 ? "" : "s"}`, tone: "overdue" };
  if (days <= 7) return { label: days === 0 ? "Due today" : `Due in ${days} days`, tone: "soon" };
  return { label: "On track", tone: "pending" };
}

function auditActionsFor(entry) {
  if(entry.sourceReport)return entry.actions||[];
  if (!entry.actions?.length && (!entry.recommendation || entry.recommendation === "Corrective action pending assignment.")) return [];
  return entry.actions?.length ? entry.actions : [{ id: "legacy", description: entry.recommendation || "", owner: entry.owner || "", email: "", dueDate: entry.dueDate || "", status: entry.status || "Open", responses: [] }];
}

function readAuditActionDrafts() {
  return Array.from(document.querySelectorAll("[data-audit-action-draft]")).map((card) => {
    const value = (key) => card.querySelector(`[data-action-field="${key}"]`)?.value.trim() || "";
    return { id: card.dataset.auditActionDraft, description: value("description"), owner: value("owner"), email: value("email"), dueDate: value("dueDate"), status: value("status"), response: value("response"), responseDueDate: value("responseDueDate") };
  });
}

function companyAssignees(company = auditEntityValue()) {
  return (state.auditAssignees || []).filter(user=>user.canRespond && (user.companyScope!=='selected' || user.companies?.includes(company)));
}
function renderAuditAssignee(action = {}, draft = false, company = auditEntityValue()) {
  const users = companyAssignees(company);
  const match = users.find(user => user.name === action.owner && user.email === action.email);
  const ownerAttrs = draft ? 'data-action-field="owner"' : 'name="owner"';
  const emailAttrs = draft ? 'data-action-field="email"' : 'name="email"';
  return `<label class="field"><span>Responsible person</span><select data-audit-assignee ${ownerAttrs} required><option value="">${users.length ? 'Select an Audit user' : 'Add an active user in Audit User Directory'}</option>${users.map(user => `<option value="${escapeHtml(user.name)}" data-email="${escapeHtml(user.email)}" ${match?.id === user.id ? 'selected' : ''}>${escapeHtml(user.name)} · ${escapeHtml(user.email)}</option>`).join('')}</select>${action.owner && !match ? `<small>Previous assignment: ${escapeHtml(action.owner)}. Select an active Audit user to save changes.</small>` : ''}</label><label class="field"><span>Responsible person’s email</span><input ${emailAttrs} type="email" value="${escapeHtml(match?.email || '')}" readonly required /></label>`;
}

function renderAuditActionDraft(action, index) {
  const input = (label, key, type = "text", required = true) => `<label class="field"><span>${label}</span><input data-action-field="${key}" type="${type}" value="${escapeHtml(action[key] || "")}" ${required ? "required" : ""} /></label>`;
  return `<section class="audit-action-card" data-audit-action-draft="${escapeHtml(action.id)}">
    <header><b>Corrective action ${index + 1}</b>${index ? '<button type="button" class="secondary-button" data-remove-audit-action>Remove action</button>' : ""}</header>
    <div class="audit-action-grid">
      <label class="field audit-action-description"><span>Corrective action</span><textarea data-action-field="description" rows="3" required placeholder="State the action and evidence required for closure.">${escapeHtml(action.description || "")}</textarea></label>
      ${renderAuditAssignee(action, true)}${input("Action due date", "dueDate", "date")}
      <label class="field"><span>Initial action status</span><input data-action-field="status" value="Open" readonly /></label>
    </div>
    <p>After saving, the assignee can add progress updates and photos under Assignee updates in View &amp; Report.</p>
  </section>`;
}

function auditUpdateTime(value){return value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'long'}).format(new Date(value)):'';}

function renderAuditActionTracking(entry) {
  if(entry.status==='Draft')return `<section class="audit-action-tracking"><p>Draft — editable until finalized. No assignment emails are sent and this item is excluded from PDF reports.</p>${auditPermission('create') && (state.currentSession?.role==='admin' || entry.createdBy===state.currentSession?.userId)?`<button type="button" class="primary-button" data-edit-audit-draft="${escapeHtml(entry.id)}">Edit draft</button>`:''}</section>`;
  return `<section class="audit-action-tracking"><h4>Corrective action monitoring</h4>${auditActionsFor(entry).map((action, index) => {
    const timing = auditActionTiming(action);
    const followup = action.responseDueDate ? auditActionTiming({dueDate: action.responseDueDate, status: action.status}) : null;
    return `<section class="audit-action-card audit-action-${timing.tone}">
      <header><b>Action ${index + 1}</b><span class="audit-action-badge">${escapeHtml(timing.label)}</span></header>
      <p class="multiline-text">${escapeHtml(action.description)}</p>
      <div class="audit-response-row"><span><b>Responsible person</b>${escapeHtml(action.owner || "Unassigned")}</span><span><b>Email</b>${escapeHtml(action.email || "Not assigned")}</span><span><b>Action due date</b>${auditDateLabel(action.dueDate)} · ${escapeHtml(entry.timeZone || "Africa/Lagos")}</span><span><b>Status</b>${escapeHtml(action.status || "Open")}</span></div>
      ${auditPermission("recommend") && (!auditActionLocked(action) || state.currentSession?.role === "admin") ? `<details><summary>Edit corrective action / assignment</summary><form class="audit-update-action-form" data-entry-id="${escapeHtml(entry.id)}" data-action-id="${escapeHtml(action.id)}"><div class="audit-action-grid">
        <label class="field audit-action-description"><span>Corrective action</span><textarea name="description" required>${escapeHtml(action.description)}</textarea></label>
        ${renderAuditAssignee(action,false,entry.entity || auditEntityValue())}
        <label class="field"><span>Action due date</span><input name="dueDate" type="date" value="${escapeHtml(action.dueDate || "")}" required /></label>
      </div><div class="audit-action-form-footer"><span role="status"></span><button type="submit" class="secondary-button">Save action changes</button></div></form></details>` : ""}
      <h4>Assignee updates</h4>
      ${action.responseDueDate ? `<p class="audit-action-badge audit-action-${followup.tone}">Follow-up due: ${auditDateLabel(action.responseDueDate)} · ${escapeHtml(followup.label)}</p>` : ""}
      ${(action.responses || []).map(reply => `<div class="audit-action-reply"><b>${escapeHtml(reply.author || "Recorded response")}</b><small>${escapeHtml(reply.email || "")} · ${escapeHtml(auditUpdateTime(reply.createdAt))} · Follow-up due: ${auditDateLabel(reply.dueDate)}</small><p class="multiline-text">${escapeHtml(reply.text)}</p>${reply.status?`<p>Status: ${escapeHtml(reply.status)}</p>`:""}${renderAuditObservationImages(reply.images||[])}</div>`).join("") || "<p>No updates recorded yet.</p>"}
      ${canReplyToAuditAction(action) ? `<form class="audit-action-reply-form" data-entry-id="${escapeHtml(entry.id)}" data-action-id="${escapeHtml(action.id)}">
        <p class="audit-update-note">Updating as ${escapeHtml(state.currentSession.userId)}. Date and time are recorded automatically when you save.</p>
        <div class="audit-action-grid">
          <label class="field"><span>Response / follow-up due date</span><input name="dueDate" type="date" value="${escapeHtml(action.responseDueDate || "")}" /></label>
          <label class="field"><span>Action status</span><select name="status">${["Open", "In progress", "Closed"].map(status => `<option ${status === action.status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
          <label class="field audit-action-description"><span>Progress update</span><textarea name="text" rows="2" required></textarea></label>
          <div class="field audit-action-description audit-update-photos"><span>Photo evidence (up to 8 photos)</span><div class="audit-update-photo-actions"><button type="button" class="secondary-button" data-reply-upload>Upload photos</button><button type="button" class="secondary-button" data-reply-camera>Take photo</button></div><input type="file" accept="image/jpeg,image/png,image/webp" multiple data-reply-files aria-label="Upload action photos" hidden /><input type="file" accept="image/*" capture="environment" data-reply-camera-file hidden /><small data-reply-photo-count>No photos selected</small><div data-reply-previews class="audit-observation-images"></div></div>
        </div><div class="audit-action-form-footer"><span role="status" class="audit-reply-status"></span><button class="primary-button" type="submit">Save update</button></div>
      </form>` : auditActionLocked(action) ? "<p>Updates are locked after the due date. Ask an administrator to extend the deadline.</p>" : "<p>Replies are limited to the assigned respondent and administrators.</p>"}
    </section>`;
  }).join("")}
  ${auditPermission("recommend") ? `<form class="audit-add-action-form" data-entry-id="${escapeHtml(entry.id)}"><h4>Add corrective action</h4><div class="audit-action-grid">
  <label class="field audit-action-description"><span>Recommendation / corrective action</span><textarea name="description" required></textarea></label>
  ${renderAuditAssignee({},false,entry.entity || auditEntityValue())}
  <label class="field"><span>Action due date</span><input name="dueDate" type="date" required /></label>
  </div><div class="audit-action-form-footer"><span role="status"></span><button class="primary-button" type="submit">Save corrective action</button></div></form>` : ""}</section>`;
}

function captureAuditDraftFields() {
  const valueFrom = (selector, fallback = "") => {
    const element = qs(selector);
    return element ? element.value : fallback;
  };
  state.auditDraftFields = {
    actions: readAuditActionDrafts(),
    department: valueFrom("#auditDepartment", state.auditDraftFields.department || ""),
    area: valueFrom("#auditArea", state.auditDraftFields.area || ""),
    priority: valueFrom("#auditPriority", state.auditDraftFields.priority || ""),
    status: valueFrom("#auditStatus", state.auditDraftFields.status || ""),
    location: valueFrom("#auditLocation", state.auditDraftFields.location || ""),
    owner: valueFrom("#auditOwner", state.auditDraftFields.owner || ""),
    dueDate: valueFrom("#auditDueDate", state.auditDraftFields.dueDate || ""),
    reference: valueFrom("#auditReference", state.auditDraftFields.reference || ""),
    finding: valueFrom("#auditFinding", state.auditDraftFields.finding || ""),
    impact: valueFrom("#auditImpact", state.auditDraftFields.impact || ""),
    recommendation: valueFrom("#auditRecommendation", state.auditDraftFields.recommendation || ""),
  };
}

function renderAuditObservationImageCards(images = []) {
  if (!images.length) return "";
  return `
    <div class="audit-observation-images" id="auditObservationImages">
      ${images.map((item, index) => `
        <article class="audit-observation-image-card" data-observation-image-index="${index}">
          <img src="${escapeHtml(item.dataUrl || item.url)}" alt="Observation attachment ${index + 1}" />
          <label>
            <span>Description</span>
            <textarea class="audit-observation-image-description" data-observation-image-description="${index}" rows="2" placeholder="Describe what this image shows.">${escapeHtml(item.description || "")}</textarea>
          </label>
          <button type="button" class="audit-remove-observation-image" data-remove-observation-image="${index}">Remove</button>
        </article>
      `).join("")}
    </div>
  `;
}

function renderAuditEntry(entries) {
  const today = new Date().toISOString().slice(0, 10);
  const latest = entries[0];
  const geo = state.auditDraftGeo;
  const image = state.auditDraftImage;
  const observationImages = state.auditObservationImages || [];
  const draft = state.auditDraftFields || {};
  return `
    <div class="audit-workspace">
      <article class="panel audit-form-panel">
        <header>
          <div>
            <span class="eyebrow">Data Entry</span>
            <h3>${state.auditEditingDraft ? "Edit saved draft" : "Mobile field audit form"}</h3>${state.auditNotifications?.configured === false ? '<p role="status">Email delivery is awaiting setup. Finalized assignments will be queued until email is configured.</p>' : ""}<p>Draft: save with any fields incomplete. Select Open and save to finalize and notify assigned users. Deadlines use the captured data-entry location; without location, Nigeria time applies.</p>
          </div>
        </header>
        <div class="audit-form-grid">
          <label class="field">
            <span>Report year</span>
            <select id="auditEntryYear" class="${auditYearHasReport(state.auditYear) ? "audit-year-has-report" : ""}">
              ${auditOptions(auditYears(), String(state.auditYear), state.auditYearCounts)}
            </select>
          </label>
          <label class="field">
            <span>Department</span>
            <select id="auditDepartment">${auditOptions(auditDepartments(), draft.department || auditDepartments()[0] || "Mill Department")}</select>
          </label>
          <label class="field">
            <span>Audit area</span>
            <select id="auditArea">${auditOptions(auditAreas(), draft.area || auditAreas()[0] || "SOP compliance")}</select>
          </label>
          <label class="field">
            <span>Priority</span>
            <select id="auditPriority">
              ${["High", "Medium", "Low", "Critical"].map((option) => `<option ${option === (draft.priority || "High") ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Status</span>
            <select id="auditStatus">
              ${["Draft", "Open"].map((option) => `<option ${option === (draft.status || "Draft") ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Division, block, or location</span>
            <input id="auditLocation" value="${escapeHtml(draft.location || "")}" placeholder="Example: 2019 Block A6, mill line, main store" />
          </label>
          <label class="field">
            <span>Responsible owner</span>
            <input id="auditOwner" value="${escapeHtml(draft.owner || "")}" placeholder="Department HOD or action owner" />
          </label>
          <label class="field">
            <span>Target closure date</span>
            <input id="auditDueDate" type="date" value="${escapeHtml(draft.dueDate || "")}" />
          </label>
          <label class="field">
            <span>Reference / asset tag</span>
            <input id="auditReference" value="${escapeHtml(draft.reference || "")}" placeholder="Optional asset, invoice, block, or SOP reference" />
          </label>
          <label class="field wide audit-observation-field">
            <span>Observations / Findings</span>
            <div class="audit-observation-composer">
              <textarea id="auditFinding" rows="4" placeholder="Write the audit issue observed in the field.">${escapeHtml(draft.finding || "")}</textarea>
              <div class="audit-observation-dropzone ${observationImages.length ? "has-image" : ""}" id="auditObservationDropzone" tabindex="0" role="button" aria-label="Add images inside observation or finding">
                <div>
                  <b>${observationImages.length ? "Add more observation images" : "Drop images here"}</b>
                  <span>Drag images from desktop into this observation, or click to choose.</span>
                </div>
              </div>
              <input class="audit-file-input" id="auditObservationImageInput" type="file" accept="image/*" multiple />
              ${renderAuditObservationImageCards(observationImages)}
            </div>
          </label>
          <label class="field wide">
            <span>Impact</span>
            <textarea id="auditImpact" rows="3" placeholder="Describe operational, financial, safety, compliance, or quality impact.">${escapeHtml(draft.impact || "")}</textarea>
          </label>
          ${auditPermission("recommend") ? `<section class="audit-actions-editor">
            <h4>Recommendation / Corrective actions</h4>
            <p>Assign a responsible person, email and due date to each action. Record responses below each action.</p>
            ${(draft.actions?.length ? draft.actions : [{id: crypto.randomUUID(), description: draft.recommendation || "", status: "Open"}]).map(renderAuditActionDraft).join("")}
            <button type="button" class="secondary-button" id="addAuditAction">Add corrective action</button>
          </section>` : '<p class="field wide">The corrective action author will add recommendations after this finding is saved.</p>'}
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
            <button class="primary-button" id="saveAuditEntry"><span class="mini-icon">sv</span> ${draft.status === "Open" ? "Finalize audit item" : "Save draft"}</button>
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
  const reportEntity = auditEntityValue(entries);
  const auditPeriod = `${auditDateLabel(settings.auditPeriodStart)} to ${auditDateLabel(settings.auditPeriodEnd)}`;
  return `
    <div class="audit-report-layout">
      <article class="panel audit-report-panel">
        <header>
          <div>
            <span class="eyebrow">Report</span>
            <h3>${escapeHtml(auditEntityValue())} — Audit report ${escapeHtml(state.auditYear)}</h3>
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
            <select id="auditReportYear" class="${auditYearHasReport(state.auditYear) ? "audit-year-has-report" : ""}">
              ${auditOptions(auditYears(), String(state.auditYear), state.auditYearCounts)}
            </select>
          </label>
          <label>
            <span>Search findings</span>
            <input id="auditSearch" value="${escapeHtml(state.auditSearch)}" placeholder="Department, issue, or location" />
          </label>
          <label>
            <span>Item status</span><select id="auditStatusFilter">${["","Draft","Open","In progress","Closed"].map(v=>`<option value="${v}" ${v===state.auditStatusFilter?"selected":""}>${v||"All statuses"}</option>`).join("")}</select></label><label><span>Rows</span>
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
                      <span>Audit Issue ${entry.sourceReport?.issue || ((state.auditPage-1)*state.auditPageSize+index+1)}: ${escapeHtml(entry.department)}</span>
                      <h5>${escapeHtml(entry.sourceReport ? "Audit observation" : (entry.area || "Audit observation"))}</h5>
                    </div>
                    <b class="risk ${auditPriorityClass(entry.priority)}">${escapeHtml(entry.priority)}</b>
                  </header>
                  <div class="audit-finding-body">
                    <div><b>Observations / Findings</b><span class="multiline-text">${escapeHtml(entry.finding || (entry.status === "Draft" ? "Untitled draft" : ""))}</span></div>
                    ${renderAuditObservationImages(entry.observationImages)}
                    <div><b>Impact</b><span class="multiline-text">${escapeHtml(entry.impact||'Not recorded.')}</span></div>
                    <div><b>Recommendation</b><span class="multiline-text">${escapeHtml(entry.sourceReport?.originalRecommendation||entry.recommendation||'Not recorded.')}</span></div>
                    <div class="audit-response-row">
                      <span><b>Entity / Company</b>${escapeHtml(entry.entity || entry.companyName || reportEntity || "-")}</span>
                      <span><b>Owner</b>${escapeHtml(entry.owner || "-")}</span>
                      <span><b>Timeline</b>${auditDateLabel(entry.dueDate)}</span>
                      <span><b>Status</b><em class="risk ${auditStatusClass(entry.status)}">${escapeHtml(entry.status || "Open")}</em></span>
                    </div>
                    ${renderSourceDetails(entry)}
                    ${renderAuditActionTracking(entry)}
                    <div class="audit-evidence-row">
                      ${entry.photoDataUrl || entry.photoUrl ? `<img src="${escapeHtml(entry.photoDataUrl || entry.photoUrl)}" alt="Audit evidence" />` : `<div class="audit-photo-token">${escapeHtml(entry.photoName || "Evidence pending")}</div>`}
                      <span>${escapeHtml(entry.location || "Location pending")}</span>
                      ${renderAuditMapProof(entry.geo)}
                      <span>${escapeHtml(entry.sourceReport ? `Audit Issue ${entry.sourceReport.issue}` : (entry.reference || "Field entry"))}</span>
                    </div>
                  </div>
                </article>
              `).join("")}
            </div>
          </section>
          <footer>Agrinexus International · Audit findings and corrective actions · Private &amp; Confidential</footer>
        </div>
      </article>
    </div>
  `;
}

function resetAuditDraft() {
  stopAuditCamera();
  state.auditDraftImage = null;
  state.auditDraftImageName = "";
  state.auditObservationImages = [];
  state.auditDraftFields = {};
  state.auditEditingDraft = null;
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

function updateAuditObservationDropzoneLabel() {
  const observationImages = state.auditObservationImages || [];
  const dropzone = qs("#auditObservationDropzone");
  if (!dropzone) return;
  dropzone.classList.toggle("has-image", observationImages.length > 0);
  const label = dropzone.querySelector("b");
  if (label) label.textContent = observationImages.length ? "Add more observation images" : "Drop images here";
}

function bindAuditObservationImageControls() {
  qsa("[data-observation-image-description]").forEach((field) => {
    field.addEventListener("input", () => updateAuditObservationImageDescription(Number(field.dataset.observationImageDescription), field.value));
  });
  qsa("[data-remove-observation-image]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      removeAuditObservationImage(Number(button.dataset.removeObservationImage));
      refreshAuditObservationImageSection();
    });
  });
}

function refreshAuditObservationImageSection() {
  const existing = qs("#auditObservationImages");
  const input = qs("#auditObservationImageInput");
  const html = renderAuditObservationImageCards(state.auditObservationImages || []);
  if (!html) {
    if (existing) existing.remove();
  } else if (existing) {
    existing.outerHTML = html;
  } else {
    input?.insertAdjacentHTML("afterend", html);
  }
  updateAuditObservationDropzoneLabel();
  bindAuditObservationImageControls();
  if (input) input.value = "";
}

async function addAuditObservationImages(files) {
  captureAuditDraftFields();
  const status = qs("#auditSaveStatus");
  const imageFiles = Array.from(files || []).filter((file) => /^image\//i.test(file.type));
  if (!imageFiles.length) {
    if (status) status.textContent = "Please drop or choose image files for the observation.";
    return;
  }
  if (status) status.textContent = "Preparing observation image...";
  const additions = await Promise.all(imageFiles.map(async (file) => ({
    id: `obs_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    dataUrl: await readImageFileAsCappedDataUrl(file, 960, 0.78),
    name: file.name || "Observation image",
    description: "",
  })));
  state.auditObservationImages = [...(state.auditObservationImages || []), ...additions];
  refreshAuditObservationImageSection();
  if (status) status.textContent = `${additions.length} observation image${additions.length === 1 ? "" : "s"} added.`;
}

function updateAuditObservationImageDescription(index, description) {
  const item = state.auditObservationImages?.[index];
  if (item) item.description = String(description || "");
}

function removeAuditObservationImage(index) {
  captureAuditDraftFields();
  state.auditObservationImages = (state.auditObservationImages || []).filter((_, itemIndex) => itemIndex !== index);
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
  captureAuditDraftFields();
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
  captureAuditDraftFields();
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

async function downloadAuditPdf(printReport = false) {
  const printWindow=printReport?window.open("about:blank","_blank"):null;
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
        auditEntity: auditEntityValue(),
        reportSettings: auditReportSettings(),
        brandingLogoUrl: brandLogoUrl(),
      }),
    });
    if (!response.ok) throw new Error(`PDF generation failed: ${response.status}`);
    const blob = await response.blob();
    const issueDate = auditReportSettings().auditIssueDate || new Date().toISOString().slice(0, 10);
    const fallbackName = `oban-audit-report-${issueDate}.pdf`;
    if(printWindow){const pdfUrl=URL.createObjectURL(blob);printWindow.location.href=pdfUrl;setTimeout(()=>URL.revokeObjectURL(pdfUrl),120000);}else downloadBlob(filenameFromDisposition(response.headers.get("Content-Disposition"), fallbackName), blob);
  } catch (error) {
    printWindow?.close();window.alert(error.message || "Audit PDF could not be generated.");
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

async function replyPhoto(file){
 if(!/^image\//.test(file.type))throw new Error('Select an image file.');
 const dataUrl=await readFileAsDataUrl(file),image=new Image();image.src=dataUrl;await image.decode();
 const scale=Math.min(1,1600/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
 return {dataUrl:canvas.toDataURL('image/jpeg',0.82),name:file.name||'Action photo.jpg',description:''};
}
function bindReplyPhotos(){
 document.querySelectorAll('.audit-action-reply-form').forEach(form=>{
 const feedback=form.querySelector('.audit-reply-status');form._replyImages=[];
 const preview=()=>{feedback.textContent=form._replyImages.length?'Photos ready to save with your update.':'';form.querySelector('[data-reply-photo-count]').textContent=form._replyImages.length?`${form._replyImages.length} of 8 photos selected`:'No photos selected';form.querySelector('[data-reply-previews]').innerHTML=form._replyImages.map((im,i)=>`<figure><img src="${im.dataUrl}" alt="Action evidence ${i+1}" /><figcaption>${escapeHtml(im.name)}</figcaption><button type="button" data-remove-reply-photo="${i}">Remove photo</button></figure>`).join('');form.querySelectorAll('[data-remove-reply-photo]').forEach(b=>b.onclick=()=>{form._replyImages.splice(Number(b.dataset.removeReplyPhoto),1);preview();});};
 const add=async files=>{if(form._readingPhotos)return;form._readingPhotos=true;try{if(form._replyImages.length+files.length>8)throw new Error('Use up to 8 photos per update.');const images=await Promise.all(Array.from(files,replyPhoto));form._replyImages.push(...images);preview();feedback.textContent='Photos ready to save with your update.';}catch(e){feedback.textContent=e.message;}finally{form._readingPhotos=false;}};
 form.querySelectorAll('[data-reply-files],[data-reply-camera-file]').forEach(input=>input.onchange=()=>{add(input.files);input.value='';});
 form.querySelector('[data-reply-upload]').onclick=()=>form.querySelector('[data-reply-files]').click();
 form.querySelector('[data-reply-camera]').onclick=async()=>{
  if(!navigator.mediaDevices?.getUserMedia){form.querySelector('[data-reply-camera-file]').click();return;}
  const dialog=document.createElement('dialog');dialog.className='audit-update-camera';dialog.innerHTML='<p>Take action evidence photo</p><video autoplay playsinline muted></video><div><button type="button" data-capture>Capture photo</button><button type="button" data-close>Cancel</button></div><p role="status">Starting camera…</p>';document.body.append(dialog);dialog.showModal();let stream;
  const close=()=>{stream?.getTracks().forEach(t=>t.stop());dialog.remove();};dialog.querySelector('[data-close]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
  try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});if(!dialog.isConnected){close();return;}const video=dialog.querySelector('video');video.srcObject=stream;await video.play();dialog.querySelector('[role=status]').textContent='';dialog.querySelector('[data-capture]').onclick=async()=>{if(!video.videoWidth)return;const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));await add([new File([blob],'Action photo.jpg',{type:'image/jpeg'})]);close();};}
  catch(e){close();feedback.textContent='Camera unavailable. Use Upload action photos or the device camera picker.';form.querySelector('[data-reply-camera-file]').click();}
 };
 });
}

function bindAuditEvents() {
  const draftStatus=qs('#auditStatus');
  const syncDraftRequirements=()=>{
    const isDraft=draftStatus?.value==='Draft';
    document.querySelectorAll('[data-audit-action-draft] [data-action-field]').forEach(input=>{input.required=!isDraft && ['description','owner','email','dueDate'].includes(input.dataset.actionField);});
    const button=qs('#saveAuditEntry');if(button)button.textContent=isDraft?'Save draft':'Finalize audit item';
    document.querySelectorAll('[data-action-field="status"]').forEach(input=>input.value=isDraft?'Draft':'Open');
  };
  if(draftStatus){syncDraftRequirements();draftStatus.addEventListener('change',syncDraftRequirements);}
  document.querySelectorAll('[data-edit-audit-draft]').forEach(button=>button.addEventListener('click',()=>{
    const entry=state.auditEntries.find(e=>e.id===button.dataset.editAuditDraft);
    if(!entry)return;
    resetAuditDraft();state.auditEditingDraft=structuredClone(entry);state.auditDraftFields=structuredClone(entry);
    state.auditObservationImages=structuredClone(entry.observationImages || []);state.auditDraftGeo=entry.geo;
    state.auditDraftImage=entry.photoDataUrl || entry.photoUrl || null;state.auditDraftImageName=entry.photoName || '';
    state.auditYear=entry.auditYear;state.auditEntity=entry.entity;state.selectedAuditPanel='entry';renderAudit();
  }));
  document.querySelectorAll(".audit-add-action-form, .audit-update-action-form").forEach(form => form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      await requestJson(`/api/projects/${PROJECT_ID}/audit-entries`, {method: "POST", body: JSON.stringify({id: form.dataset.entryId, operation: form.dataset.actionId ? "update-action" : "add-action", actionId: form.dataset.actionId, action: Object.fromEntries(new FormData(form))})});
      renderAudit();
    } catch (error) { form.querySelector('[role="status"]').textContent = error.message; button.disabled = false; }
  }));
  bindClick("#addAuditAction", () => {
    captureAuditDraftFields();
    state.auditDraftFields.actions.push({id: crypto.randomUUID(), status: "Open"});
    renderAudit();
  });
  document.querySelectorAll("[data-remove-audit-action]").forEach(button => button.addEventListener("click", () => {
    const id = button.closest("[data-audit-action-draft]").dataset.auditActionDraft;
    captureAuditDraftFields();
    state.auditDraftFields.actions = state.auditDraftFields.actions.filter(action => action.id !== id);
    renderAudit();
  }));
  document.querySelectorAll(".audit-action-reply-form").forEach(form => form.addEventListener("submit", async event => {
    event.preventDefault();
    const feedback = form.querySelector(".audit-reply-status");
    const button = form.querySelector('button[type="submit"]');
    const values = Object.fromEntries(new FormData(form));
    if(form._readingPhotos){feedback.textContent='Wait for photos to finish loading.';return;}
    values.images=form._replyImages||[];
    if (!values.text.trim()) { feedback.textContent = "Enter a respondent and response."; return; }
    const entry = state.auditEntries.find(item => item.id === form.dataset.entryId);
    if (!entry) return;
    button.disabled = true;
    try {
      await requestJson(`/api/projects/${PROJECT_ID}/audit-entries`, {method: "POST", credentials: "same-origin", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id: entry.id, operation: "reply", actionId: form.dataset.actionId, ...values})});
      renderAudit();
    } catch (error) { feedback.textContent = error.message || "Response could not be saved."; button.disabled = false; }
  }));

  bindReplyPhotos();

  qsa("#auditTabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.auditPanel === state.selectedAuditPanel);
    button.onclick = () => {
      state.selectedAuditPanel = button.dataset.auditPanel || "entry";
      showScreen('audit');
    };
  });

  bindEvent("#auditUploadInput", "change", (event) => handleAuditPhotoSelection(event, "upload"));
  bindEvent("#auditCameraInput", "change", (event) => handleAuditPhotoSelection(event, "camera"));
  bindEvent("#auditObservationImageInput", "change", (event) => addAuditObservationImages(event.target.files));
  const observationDropzone = qs("#auditObservationDropzone");
  if (observationDropzone) {
    observationDropzone.addEventListener("click", () => qs("#auditObservationImageInput")?.click());
    observationDropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        qs("#auditObservationImageInput")?.click();
      }
    });
    ["dragenter", "dragover"].forEach((eventName) => {
      observationDropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        observationDropzone.classList.add("drag-over");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      observationDropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        observationDropzone.classList.remove("drag-over");
      });
    });
    observationDropzone.addEventListener("drop", (event) => addAuditObservationImages(event.dataTransfer?.files));
  }
  bindAuditObservationImageControls();
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
  bindEvent("#auditEntity", "change", async event => {if(state.selectedAuditPanel==='entry')captureAuditDraftFields();updateAuditEntity(event.target.value);state.auditPage=1;state.auditSearch='';await renderAudit();});
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
  bindEvent("#auditStatusFilter","change",event=>{state.auditStatusFilter=event.target.value;state.auditPage=1;renderAudit();});
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
    const isDraft = qs("#auditStatus")?.value === "Draft";
    const status = qs("#auditSaveStatus");
    if (!isDraft && !finding) {
      if (status) status.textContent = "Observation / Finding is required before saving.";
      return;
    }
    const actionInputs = Array.from(document.querySelectorAll("[data-audit-action-draft] input, [data-audit-action-draft] textarea, [data-audit-action-draft] select"));
    if (!isDraft && actionInputs.some(input => !input.reportValidity())) return;
    const actions = readAuditActionDrafts();
    if (!isDraft && actions.some(action => !action.description || !action.owner || !action.email || !action.dueDate)) {
      if (status) status.textContent = "Complete the corrective action, responsible person, email and due date for each action.";
      return;
    }
    const entry = {
      actions: actions.map(({response, ...action}) => ({...action, responses: response ? [{id: crypto.randomUUID(), text: response, author: action.owner, email: action.email, dueDate: action.responseDueDate, createdAt: new Date().toISOString()}] : []})),
      id: state.auditEditingDraft?.id || `audit_${crypto.randomUUID()}`,
      ...(state.auditEditingDraft ? {operation:"save-draft",baseUpdatedAt:state.auditEditingDraft.updatedAt} : {}),
      auditYear: qs("#auditEntryYear")?.value || state.auditYear,
      entity: auditEntityValue(),
      department: qs("#auditDepartment")?.value || "Unassigned",
      area: qs("#auditArea")?.value || "SOP compliance",
      priority: qs("#auditPriority")?.value || "High",
      status: isDraft ? "Draft" : "Open",
      location: qs("#auditLocation")?.value.trim() || "",
      owner: qs("#auditOwner")?.value.trim() || "",
      dueDate: qs("#auditDueDate")?.value || "",
      reference: qs("#auditReference")?.value.trim() || "",
      finding,
      observationImages: (state.auditObservationImages || []).map((item) => ({
        dataUrl: item.dataUrl,
        url: item.url,
        name: item.name,
        description: item.description || "",
      })),
      impact: qs("#auditImpact")?.value.trim() || "",
      recommendation: actions.map(action => action.description).join("\n\n") || "Corrective action pending assignment.",
      geo: state.auditDraftGeo,
      photoDataUrl: state.auditDraftImage?.startsWith("data:") ? state.auditDraftImage : "",
      photoUrl: state.auditDraftImage?.startsWith("/") ? state.auditDraftImage : "",
      photoName: state.auditDraftImageName,
      source: "Field entry",
      capturedAt: new Date().toISOString(),
    };
    try {
      qs("#saveAuditEntry").disabled=true;
      if(!entry.geo && navigator.geolocation){
        if(status)status.textContent='Checking data-entry location…';
        entry.geo=await new Promise(resolve=>{
          const timer=setTimeout(()=>resolve(null),4500);
          navigator.geolocation.getCurrentPosition(p=>{clearTimeout(timer);resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy});},()=>{clearTimeout(timer);resolve(null);},{timeout:4000,maximumAge:60000});
        });
      }
      if (status) status.textContent = "Saving finding...";
      await requestJson(`/api/projects/${PROJECT_ID}/audit-entries`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      state.auditPage = 1;
      resetAuditDraft();
      state.selectedAuditPanel="report";state.auditStatusFilter=isDraft?"Draft":"";state.auditSearch="";
      if (status) status.textContent = isDraft ? "Draft saved." : "Audit finalized.";
      renderAudit();
    } catch (error) {
      if (status) status.textContent = error.message || "Finding could not be saved.";
      if(qs("#saveAuditEntry"))qs("#saveAuditEntry").disabled=false;
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

  bindClick("#printAuditReport", () => downloadAuditPdf(true));
  bindClick("#downloadAuditReport", () => downloadAuditPdf(false));
}

async function renderAudit() {
  const version=++auditRenderVersion;
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
  if (!auditPermission("create")) state.selectedAuditPanel = "report";
  let entries=[];
  if(state.selectedAuditPanel==='report'){
    const cached=auditPageCache.get(auditQueryKey());
    if(!cached || Date.now()-cached.at>=15000){workspace.innerHTML=renderAuditEntityCard([])+'<article class="panel empty-state" role="status"><strong>Loading findings…</strong></article>';bindAuditEvents();}
    entries=await loadAuditEntries();
    if(version!==auditRenderVersion)return;
  }
  workspace.innerHTML = `
    ${renderAuditEntityCard(entries)}
    ${state.selectedAuditPanel === "report" ? renderAuditReport(entries) : renderAuditEntry(entries)}
  `;
  bindAuditEvents();
  applyBrandingLogo();
}

document.addEventListener('change', event => {
  if (!event.target.matches('[data-audit-assignee]')) return;
  const scope = event.target.closest('[data-audit-action-draft], form');
  const input = scope?.querySelector('[data-action-field="email"], input[name="email"]');
  if (input) input.value = event.target.selectedOptions[0]?.dataset.email || '';
});

async function requestJson(url, options={}) {
  const response=await fetch(url,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});
  const data=await response.json();
  if(response.ok && options.method && !['GET','HEAD'].includes(options.method.toUpperCase()))auditPageCache.clear();
  if(!response.ok){if(response.status===401)location.href='/login';throw new Error(data.message||`Request failed: ${response.status}`);}
  return data;
}
function auditEntries(){return state.auditEntries||[];}
function saveAuditEntries(entries){state.auditEntries=entries;}
function showScreen(name){
  const admin=name==='admin'&&auditPermission('companySetup');
  qs('#adminWorkspace').hidden=!admin;qs('#audit').hidden=admin;
  qsa('[data-screen]').forEach(button=>button.classList.toggle('active',button.dataset.screen===(admin?'admin':'audit')));
  if(admin)renderStandaloneAdmin();else renderAudit().catch(error=>qs('#auditWorkspace').textContent=error.message);
}
function renderStandaloneAdmin(){
  if(!auditPermission('companySetup'))return;
  if(state.currentSession.role!=='admin'){qs('#adminWorkspace').innerHTML='<div class="page-head"><div><h2>Company setup</h2><p>Manage company details, audit options and report settings.</p></div></div><section id="companySettingsPanel"></section>';renderCompanySettings();return;}
  const settings=projectSettings();const report=auditReportSettings();const setup=auditSetupSettings();
  const field=(name,label,value)=>`<label class="field"><span>${label}</span><input name="${name}" value="${escapeHtml(value||'')}" /></label>`;
  qs('#adminWorkspace').innerHTML=`<div class="page-head"><div><span class="eyebrow">Administrator</span><h2>Audit management</h2><p>Manage Audit users, roles, project details and report settings.</p><p>Email: ${state.auditNotifications?.configured ? "Configured" : "Awaiting SMTP setup"}. Administrator creator reminders: ${state.auditNotifications?.adminEmailConfigured ? "Configured" : "Administrator email required"}. Deadlines use the captured entry location; fallback: Nigeria (Africa/Lagos).</p></div></div>
  <article class="mc-panel user-directory-panel">
                      <header><div><span class="eyebrow">Audit Users &amp; Roles</span><h3>Audit User Directory</h3></div><span class="status-pill">Admin only</span></header>
                      <p class="audit-directory-note">Manage audit assignments in this standalone Audit workspace. Administrators have all audit permissions. Create dedicated Audit sign-in accounts here. Audit users can access only the Audit module. Set a password when adding a user; leave it blank when editing to keep the current password.</p>
                      <div class="directory-scroll" tabindex="0" role="region" aria-label="Audit user directory"><table class="permission-table user-directory"><thead><tr><th>Sign-in username</th><th>Email</th><th>Audit roles</th><th>Companies</th><th>Status</th><th>Actions</th></tr></thead><tbody id="auditUserDirectory"></tbody></table></div>
                      <form id="auditUserForm" class="audit-directory-form">
                        <h4>Add / edit audit user</h4><input type="hidden" name="id" />
                        <div class="audit-action-grid">
                          <label class="field"><span>Sign-in username</span><input name="name" required /></label>
                          <label class="field"><span>Email</span><input name="email" type="email" required /></label>
                          <label class="field"><span>Password (new or reset)</span><input name="password" type="password" minlength="12" maxlength="256" autocomplete="new-password" /></label>
                          <label class="field"><span>Status</span><select name="status"><option>Active</option><option>Inactive</option></select></label>
                        </div>
                        <div class="audit-user-company-scope"><label class="field"><span>Company access</span><select name="companyScope"><option value="all">All companies</option>${auditCompanyNames().map(name=>`<option value="company:${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}<option value="selected">Multiple companies…</option></select></label><fieldset id="auditUserCompanies" hidden><legend>Select the companies this user can access</legend>${auditCompanyNames().map(name=>`<label class="audit-permission-option"><input type="checkbox" name="companies" value="${escapeHtml(name)}" /> ${escapeHtml(name)}</label>`).join('')}</fieldset></div>
                        <fieldset><legend>Audit roles — select one or more</legend>
                          <label class="audit-permission-option"><input type="checkbox" name="companySetup" /> Company setup — manage company details, audit options and reports</label>
                          <label class="audit-permission-option"><input type="checkbox" name="create" /> Audit creator — create observations and findings</label>
                          <label class="audit-permission-option"><input type="checkbox" name="recommend" /> Corrective action author — add actions, owners and due dates</label>
                          <label class="audit-permission-option"><input type="checkbox" name="respond" /> Assigned respondent — reply and update status on actions assigned to their email</label>
                        </fieldset>
                        <div class="audit-action-form-footer"><span></span><button class="primary-button" type="submit">Save audit user</button> <button class="secondary-button" type="button" id="cancelAuditUserEdit">Clear</button></div>
                        <p id="auditDirectoryStatus" role="status"></p>
                      </form>
                    </article>
  <section id="companySettingsPanel"></section>`;
  renderAuditDirectory();
  renderCompanySettings();
}
const companyReportFields=[['auditReportTitle','Report title'],['auditClientName','Audited company'],['auditLocation','Location'],['auditPreparedBy','Prepared by'],['auditPeriodStart','Period start'],['auditPeriodEnd','Period end'],['auditIssueDate','Issue date'],['auditConfidentiality','Confidentiality']];
let companyEditor=null;
function startCompanyEditor(name, isNew=false){
 const year=String(new Date().getFullYear());
 const p=isNew?{name:'',projectName:'',auditSetup:{years:[year],departments:['General'],areas:['SOP compliance']},auditReport:{auditPreparedBy:'Agrinexus International',auditConfidentiality:'Private & Confidential'},auditReportsByYear:{}}:structuredClone(projectSettings().auditCompanyProfiles[name]);
 companyEditor={profile:p,isNew,year:p.auditSetup.years.includes(state.auditYear)?state.auditYear:p.auditSetup.years[0],dirtyReports:{}};
 renderCompanySettings();
}
function captureCompanyEditor(){
 const form=qs('#auditSettingsForm');if(!form)return;
 const values=Object.fromEntries(new FormData(form)),p=companyEditor.profile;
 p.name=values.companyName.trim();p.projectName=values.projectName.trim();
 p.auditSetup=Object.fromEntries(['years','departments','areas'].map(key=>[key,values[key].split('\n').map(v=>v.trim()).filter(Boolean)]));
 companyEditor.dirtyReports[companyEditor.year]=Object.fromEntries(companyReportFields.map(([key])=>[key,values[key] || '']));
}
function renderCompanySettings(){
 if(!companyEditor){startCompanyEditor(auditEntityValue());return;}
 const {profile:p,isNew,year}=companyEditor;
 const report={auditReportTitle:`${year} Internal Audit Report`,...p.auditReport,...p.auditReportsByYear?.[year],...companyEditor.dirtyReports[year],auditClientName:p.name};
 const field=(key,label,value,type='text',readonly=false)=>`<label class="field"><span>${label}</span><input name="${key}" type="${type}" value="${escapeHtml(value||'')}" ${readonly?'readonly':''} /></label>`;
 qs('#companySettingsPanel').innerHTML=`<article class="panel audit-company-panel"><header><div><span class="eyebrow">Company setup</span><h3>Companies &amp; audit details</h3><p>Maintain each company’s audit options and report details separately.</p></div></header>
 <div class="audit-company-picker"><label class="field"><span>Select company to configure</span><select id="companySettingsSelect">${isNew?'<option value="">New company</option>':''}${auditCompanyNames().map(name=>`<option ${name===p.name?'selected':''}>${escapeHtml(name)}</option>`).join('')}</select></label><button type="button" class="secondary-button" id="addAuditCompany" ${state.auditIdentity?.companyScope==='selected'&&!state.auditIdentity?.admin?'hidden':''}>Add company</button></div>
 <form id="auditSettingsForm">
 <section class="audit-settings-section"><h4>Company details</h4><div class="audit-settings-grid">${field('companyName','Company name',p.name,'text',!isNew)}${field('projectName','Project / estate name',p.projectName)}</div>${!isNew?'<p class="field-hint">Company names stay linked to their existing audit records. Use Add company to create another company.</p>':''}</section>
 <section class="audit-settings-section"><h4>Data Entry options</h4><p>One option per line. These dropdown choices apply only to this company.</p><div class="audit-settings-grid audit-settings-three">${[['years','Report years'],['departments','Departments'],['areas','Audit areas']].map(([key,label])=>`<label class="field"><span>${label}</span><textarea name="${key}" rows="6" required>${escapeHtml(p.auditSetup[key].join('\n'))}</textarea></label>`).join('')}</div></section>
 <section class="audit-settings-section"><div class="audit-settings-heading"><div><h4>Report details</h4><p>Saved separately for each company and report year.</p></div><label class="field"><span>Report year to configure</span><select id="companyReportYear">${[...new Set([...p.auditSetup.years,year])].map(y=>`<option ${y===year?'selected':''}>${escapeHtml(y)}</option>`).join('')}</select></label></div><div class="audit-settings-grid">${companyReportFields.map(([key,label])=>field(key,label,report[key],['auditPeriodStart','auditPeriodEnd','auditIssueDate'].includes(key)?'date':'text',key==='auditClientName')).join('')}</div></section>
 <div class="audit-action-form-footer audit-company-save"><p id="settingsStatus" role="status"></p><button class="primary-button" type="submit">${isNew?'Create company':'Save company settings'}</button></div></form></article>`;
 qs('#companySettingsSelect').onchange=event=>startCompanyEditor(event.target.value);
 qs('#addAuditCompany').onclick=()=>startCompanyEditor('',true);
 qs('#companyReportYear').onchange=event=>{const next=event.target.value;captureCompanyEditor();companyEditor.year=next;renderCompanySettings();};
 qs('#auditSettingsForm [name=years]').onchange=()=>{
  captureCompanyEditor();
  const years=companyEditor.profile.auditSetup.years;
  companyEditor.dirtyReports=Object.fromEntries(Object.entries(companyEditor.dirtyReports).filter(([y])=>years.includes(y)));
  if(years.length&&!years.includes(companyEditor.year))companyEditor.year=years[0];
  renderCompanySettings();
 };
 qs('#auditSettingsForm [name=companyName]').oninput=event=>qs('#auditSettingsForm [name=auditClientName]').value=event.target.value;
 qs('#auditSettingsForm').onsubmit=async event=>{
  event.preventDefault();captureCompanyEditor();const button=event.target.querySelector('[type=submit]');button.disabled=true;
  try{
   const result=await requestJson(`/api/projects/${PROJECT_ID}/audit-settings`,{method:'PUT',body:JSON.stringify({newCompany:companyEditor.isNew,reportYear:companyEditor.year,companyProfile:{...companyEditor.profile,auditReport:companyEditor.dirtyReports[companyEditor.year],editedReports:companyEditor.dirtyReports}})});
   state.projectData=result;companyEditor.isNew=false;companyEditor.profile=structuredClone(result.project.settings.auditCompanyProfiles[companyEditor.profile.name]);companyEditor.dirtyReports={};
   if(companyEditor.profile.name===auditEntityValue())updateAuditEntity(auditEntityValue());
   const savedName=companyEditor.profile.name;renderStandaloneAdmin();qs('#settingsStatus').textContent=`Settings saved for ${savedName}.`;
  }catch(error){qs('#settingsStatus').textContent=error.message;button.disabled=false;}
 };
}
async function init(){
 state.currentSession=await requestJson('/api/session');
 state.projectData=await requestJson(`/api/projects/${PROJECT_ID}/audit-context`);
 const access=await requestJson(`/api/projects/${PROJECT_ID}/audit-access`);
 state.auditNotifications=access.notifications;state.auditIdentity=access.identity;state.auditUsers=access.users||[];state.auditAssignees=access.assignees||[];
 qs('#sessionUser').value=state.currentSession.userId;
 qs('#adminMenu').hidden=!auditPermission('companySetup');
 if(state.currentSession.role!=='admin')qs('#adminMenu').textContent='Company setup';
 qsa('[data-screen]').forEach(button=>button.onclick=()=>showScreen(button.dataset.screen));
 qsa('[data-audit-panel]').forEach(button=>{button.hidden=button.dataset.auditPanel==='entry'&&!auditPermission('create');button.onclick=()=>{state.selectedAuditPanel=button.dataset.auditPanel;showScreen('audit');};});
 state.selectedAuditPanel=auditPermission('create')?'entry':'report';
 updateAuditEntity(auditEntityValue());
 await renderAudit();
}
init().catch(error=>{qs('#auditWorkspace').textContent=error.message;});
