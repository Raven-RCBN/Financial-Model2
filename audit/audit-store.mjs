import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const auditReportDefaultsByYear = {
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

export const auditReportDefaults = auditReportDefaultsByYear["2025"];

export const auditSeedEntries2025 = [
  {
    id: "audit_2025_mill_ffa",
    projectId: "project_opsl_15000ha_development",
    department: "Mill Department",
    area: "SOP compliance",
    priority: "Medium",
    location: "Mill process line",
    finding: "CPO FFA levels were recorded above benchmark tolerance during the audit period.",
    impact: "Out-of-range FFA readings may reduce product quality and sales value if corrective action is delayed.",
    recommendation: "Track FFA by processing batch, escalate repeated exceptions, and link readings to evacuation timing.",
    owner: "Mill Manager",
    dueDate: "2026-09-15",
    status: "Open",
    geo: { latitude: 5.925432, longitude: 8.331987, accuracy: 22 },
    photoUrl: "/audit/evidence/oban-2025-mill.jpg",
    photoName: "2025 audit evidence - Mill Department",
    source: "OBAN AUDIT REPORT 2025",
    capturedAt: "2025-10-27T09:15:00.000Z",
  },
  {
    id: "audit_2025_plantation_supervision",
    projectId: "project_opsl_15000ha_development",
    department: "Plantation - Overall",
    area: "Field maintenance",
    priority: "High",
    location: "Estate field blocks",
    finding: "Field upkeep, harvesting supervision, and documentation evidence were inconsistent across sampled blocks.",
    impact: "Weak supervision records can reduce crop recovery, delay corrective action, and affect accountability.",
    recommendation: "Introduce daily supervisor checklists with block references, photo evidence, and weekly HOD review.",
    owner: "Plantation Manager",
    dueDate: "2026-09-18",
    status: "Open",
    geo: { latitude: 5.92178, longitude: 8.32795, accuracy: 36 },
    photoUrl: "/audit/evidence/oban-2025-plantation.jpg",
    photoName: "2025 audit evidence - Plantation",
    source: "OBAN AUDIT REPORT 2025",
    capturedAt: "2025-10-28T11:20:00.000Z",
  },
  {
    id: "audit_2025_accounts_petty_cash",
    projectId: "project_opsl_15000ha_development",
    department: "Accounts Department",
    area: "Finance documents",
    priority: "High",
    location: "Accounts office",
    finding: "Petty cash vouchers and supporting documents did not consistently reconcile to sampled transactions.",
    impact: "Incomplete support weakens audit trail, cash control, and management sign-off reliability.",
    recommendation: "Require complete voucher packs, receipt matching, approval evidence, and monthly independent review.",
    owner: "Accounts Manager",
    dueDate: "2026-09-20",
    status: "In progress",
    geo: { latitude: 5.927118, longitude: 8.335204, accuracy: 18 },
    photoUrl: "/audit/evidence/oban-2025-accounts.jpg",
    photoName: "2025 audit evidence - Accounts",
    source: "OBAN AUDIT REPORT 2025",
    capturedAt: "2025-10-30T13:05:00.000Z",
  },
  {
    id: "audit_2025_fleet_logbooks",
    projectId: "project_opsl_15000ha_development",
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
    photoUrl: "/audit/evidence/oban-2025-fleet.jpg",
    photoName: "2025 audit evidence - Fleet",
    source: "OBAN AUDIT REPORT 2025",
    capturedAt: "2025-11-01T08:40:00.000Z",
  },
  {
    id: "audit_2025_nursery_waste",
    projectId: "project_opsl_15000ha_development",
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
    photoUrl: "/audit/evidence/oban-2025-nursery.jpg",
    photoName: "2025 audit evidence - Nursery",
    source: "OBAN AUDIT REPORT 2025",
    capturedAt: "2025-11-03T15:10:00.000Z",
  },
  {
    id: "audit_2025_procurement_support",
    projectId: "project_opsl_15000ha_development",
    department: "Procurement Department",
    area: "Stock and inventory",
    priority: "Medium",
    location: "Main store and procurement files",
    finding: "Several procurement samples did not have complete comparison, approval, and receiving documentation in one traceable pack.",
    impact: "Incomplete procurement support can weaken value-for-money review and inventory accountability.",
    recommendation: "Standardise procurement packs with supplier comparison, approval, GRN, and invoice matching before payment.",
    owner: "Procurement Lead",
    dueDate: "2026-09-25",
    status: "Open",
    geo: { latitude: 5.928006, longitude: 8.334112, accuracy: 29 },
    photoUrl: "/audit/evidence/oban-2025-procurement.jpg",
    photoName: "2025 audit evidence - Procurement",
    source: "OBAN AUDIT REPORT 2025",
    capturedAt: "2025-11-04T10:25:00.000Z",
  },
];

export const auditSeedEntries2024 = [
  {
    id: "audit_2024_plantation_controls",
    projectId: "project_opsl_15000ha_development",
    auditYear: "2024",
    department: "Plantation - Overall",
    area: "Field maintenance",
    priority: "High",
    location: "Sampled plantation blocks",
    finding: "Inconsistent enforcement by headpersons and supervisors, inadequate field maintenance, VOPs in most blocks, expired ID cards during muster, inconsistent fertiliser application, overgrown palm circles, delayed harvesting rounds, and unripe or empty FFB sent to the mill.",
    impact: "Weak supervision can reduce crop recovery, disrupt harvesting discipline, and increase control gaps across field operations.",
    recommendation: "Tighten supervisor checklists, enforce ID controls, track fertiliser rounds, monitor harvesting intervals, and document FFB quality exceptions by block.",
    owner: "Plantation Manager",
    dueDate: "2025-08-31",
    status: "Open",
    geo: { latitude: 5.92178, longitude: 8.32795, accuracy: 36 },
    photoUrl: "/audit/evidence/oban-2024-plantation.jpg",
    photoName: "2024 audit evidence - Plantation",
    source: "OBAN AUDIT REPORT 2024",
    capturedAt: "2024-11-21T08:30:00.000Z",
  },
  {
    id: "audit_2024_mill_effluent_kernel",
    projectId: "project_opsl_15000ha_development",
    auditYear: "2024",
    department: "Mill Department",
    area: "SOP compliance",
    priority: "High",
    location: "Mill compound and effluent ponds",
    finding: "Kernel processing and storage controls were ineffective, workforce shortage affected operations, effluent pond infrastructure was damaged, EFB distribution was delayed, and fencing around effluent areas was damaged or overgrown.",
    impact: "Mill losses, safety exposure, and waste-treatment compliance risks may increase when kernel, EFB, and effluent controls are weak.",
    recommendation: "Repair Pond 1 bank and effluent fencing, improve kernel stacking and counting, accelerate EFB evacuation, and track workforce gaps against required headcount.",
    owner: "Mill Manager",
    dueDate: "2025-08-31",
    status: "Open",
    geo: { latitude: 5.925432, longitude: 8.331987, accuracy: 22 },
    photoUrl: "/audit/evidence/oban-2024-mill.jpg",
    photoName: "2024 audit evidence - Mill Department",
    source: "OBAN AUDIT REPORT 2024",
    capturedAt: "2024-11-21T09:15:00.000Z",
  },
  {
    id: "audit_2024_fleet_logbooks",
    projectId: "project_opsl_15000ha_development",
    auditYear: "2024",
    department: "Fleet Department",
    area: "Fleet and assets",
    priority: "High",
    location: "Fleet workshop",
    finding: "Logbooks were inconsistently maintained, tractor hour meters were often non-functional, machinery usage recording was weak, traffic indicator lights were not functional on some vehicles, footwear controls were weak, and fuel efficiency reporting was unreliable.",
    impact: "Fuel usage, repairs, and asset utilisation cannot be reliably monitored without complete usage and hour records.",
    recommendation: "Repair hour meters, require daily logbook sign-off, record km/hour usage, inspect vehicle lights, enforce PPE footwear, and implement fuel efficiency reporting.",
    owner: "Fleet Supervisor",
    dueDate: "2025-09-15",
    status: "In progress",
    geo: { latitude: 5.9262, longitude: 8.3331, accuracy: 31 },
    photoUrl: "/audit/evidence/oban-2024-fleet.jpg",
    photoName: "2024 audit evidence - Fleet",
    source: "OBAN AUDIT REPORT 2024",
    capturedAt: "2024-11-21T10:10:00.000Z",
  },
  {
    id: "audit_2024_roads_bridges",
    projectId: "project_opsl_15000ha_development",
    auditYear: "2024",
    department: "Road and Bridges",
    area: "Roads and housing",
    priority: "High",
    location: "Estate roads and bridge network",
    finding: "Insufficient excavators, dozers, and vehicles delayed road and bridge repairs; drainage systems were poor, causing flooding and connectivity issues.",
    impact: "Poor access can delay crop evacuation, increase vehicle wear, and interrupt estate operations during wet conditions.",
    recommendation: "Prioritise critical drainage repairs, schedule road grading, track equipment availability, and document bridge access risks by route.",
    owner: "Roads and Bridges Lead",
    dueDate: "2025-09-20",
    status: "Open",
    geo: { latitude: 5.92922, longitude: 8.33081, accuracy: 42 },
    photoUrl: "/audit/evidence/oban-2024-plantation.jpg",
    photoName: "2024 audit evidence - Roads and Bridges",
    source: "OBAN AUDIT REPORT 2024",
    capturedAt: "2024-11-21T11:00:00.000Z",
  },
  {
    id: "audit_2024_accounts_records",
    projectId: "project_opsl_15000ha_development",
    auditYear: "2024",
    department: "Accounts Department",
    area: "Finance documents",
    priority: "High",
    location: "Accounts office",
    finding: "Bank reconciliation, fixed asset records, motorbike loan control, filing systems, supporting documents, RPV numbering, and contractor job-sheet numbering had gaps or discrepancies.",
    impact: "Incomplete finance records weaken audit trail, payment review, asset control, and management accountability.",
    recommendation: "Update reconciliation and registers, standardise voucher filing, require complete supporting documents, and close numbering gaps for RPVs and contractor job sheets.",
    owner: "Accounts Manager",
    dueDate: "2025-09-15",
    status: "In progress",
    geo: { latitude: 5.927118, longitude: 8.335204, accuracy: 18 },
    photoUrl: "/audit/evidence/oban-2024-accounts.jpg",
    photoName: "2024 audit evidence - Accounts",
    source: "OBAN AUDIT REPORT 2024",
    capturedAt: "2024-11-21T12:20:00.000Z",
  },
  {
    id: "audit_2024_security_coverage",
    projectId: "project_opsl_15000ha_development",
    auditYear: "2024",
    department: "Security Department",
    area: "Safety and PPE",
    priority: "High",
    location: "Security beats and river boundary",
    finding: "Security measures were inadequate in specific areas, river access increased exposure, some security logbooks lacked proper time-out records, fallen trees created vulnerabilities, and some posts had no attendance books.",
    impact: "Weak beat coverage and incomplete records can increase theft, unauthorised access, and delayed response risk.",
    recommendation: "Strengthen security coverage near river access, maintain attendance and time-out books at all posts, clear fallen trees, and review high-risk beats daily.",
    owner: "Chief Security Officer",
    dueDate: "2025-09-15",
    status: "Open",
    geo: { latitude: 5.93004, longitude: 8.33714, accuracy: 47 },
    photoUrl: "/audit/evidence/oban-2024-security.jpg",
    photoName: "2024 audit evidence - Security",
    source: "OBAN AUDIT REPORT 2024",
    capturedAt: "2024-11-21T13:00:00.000Z",
  },
  {
    id: "audit_2024_hra_records",
    projectId: "project_opsl_15000ha_development",
    auditYear: "2024",
    department: "HRA Department",
    area: "Workforce and attendance",
    priority: "High",
    location: "Camps and HRA office",
    finding: "Used drums, fertiliser stock, and main store surroundings lacked organisation; stock records varied between HTS, bin cards, and physical counts; loan recovery amounts varied; housing references were missing; expired ID cards and housing record gaps were observed; annual census was not completed.",
    impact: "Poor workforce and housing records can affect internal controls, salary or loan recovery, accommodation planning, and access security.",
    recommendation: "Complete annual census, assign housing reference numbers, reconcile stock and loan records, and replace expired ID cards.",
    owner: "HRA Manager",
    dueDate: "2025-09-30",
    status: "Open",
    geo: { latitude: 5.92365, longitude: 8.3367, accuracy: 28 },
    photoUrl: "/audit/evidence/oban-2024-accounts.jpg",
    photoName: "2024 audit evidence - HRA",
    source: "OBAN AUDIT REPORT 2024",
    capturedAt: "2024-11-21T13:35:00.000Z",
  },
  {
    id: "audit_2024_procurement_quotes",
    projectId: "project_opsl_15000ha_development",
    auditYear: "2024",
    department: "Procurement Department",
    area: "Stock and inventory",
    priority: "High",
    location: "Procurement files",
    finding: "Purchases lacked competitive quotations, some transactions did not follow procurement procedure, supplier participation was limited, and spare parts were delayed.",
    impact: "Overpriced or lower-quality purchases can affect cash flow and create operational delays.",
    recommendation: "Keep tender price lists, record historical purchase prices, and require at least three quotations for material purchases where practical.",
    owner: "Procurement Lead",
    dueDate: "2025-09-20",
    status: "Open",
    geo: { latitude: 5.928006, longitude: 8.334112, accuracy: 29 },
    photoUrl: "/audit/evidence/oban-2024-accounts.jpg",
    photoName: "2024 audit evidence - Procurement",
    source: "OBAN AUDIT REPORT 2024",
    capturedAt: "2024-11-21T14:05:00.000Z",
  },
  {
    id: "audit_2024_main_store_inventory",
    projectId: "project_opsl_15000ha_development",
    auditYear: "2024",
    department: "Accounts Department - Main Store",
    area: "Stock and inventory",
    priority: "High",
    location: "Main Store",
    finding: "Inventory management issues, fertiliser handling concerns, and tools or implements issued without proper record-keeping were identified.",
    impact: "Weak store records can create stock losses, reconciliation gaps, and poor accountability over issued tools.",
    recommendation: "Reconcile bin cards to physical counts, enforce issue records for tools, and segregate fertiliser handling records for review.",
    owner: "Main Store Supervisor",
    dueDate: "2025-09-25",
    status: "Open",
    geo: { latitude: 5.92784, longitude: 8.3347, accuracy: 24 },
    photoUrl: "/audit/evidence/oban-2024-accounts.jpg",
    photoName: "2024 audit evidence - Main Store",
    source: "OBAN AUDIT REPORT 2024",
    capturedAt: "2024-11-21T14:35:00.000Z",
  },
  {
    id: "audit_2024_nursery_polybags",
    projectId: "project_opsl_15000ha_development",
    auditYear: "2024",
    department: "Nursery Department",
    area: "Environmental controls",
    priority: "Medium",
    location: "Nursery store and pre-nursery",
    finding: "Plastic bag waste and used polybags were discarded behind the nursery store, substandard or torn polybags were observed, pre-nursery seedling growth was uneven, and unused fertilisers or chemicals were not returned to the Main Store.",
    impact: "Nursery hygiene, seedling quality, and chemical control can be affected without proper housekeeping and store returns.",
    recommendation: "Clear waste, standardise polybag quality checks, monitor seedling emergence, and return unused fertilisers or chemicals to the Main Store with records.",
    owner: "Nursery Manager",
    dueDate: "2025-09-20",
    status: "Open",
    geo: { latitude: 5.9246, longitude: 8.3297, accuracy: 24 },
    photoUrl: "/audit/evidence/oban-2024-nursery.jpg",
    photoName: "2024 audit evidence - Nursery",
    source: "OBAN AUDIT REPORT 2024",
    capturedAt: "2024-11-21T15:10:00.000Z",
  },
  {
    id: "audit_2024_hse_clinic_camps",
    projectId: "project_opsl_15000ha_development",
    auditYear: "2024",
    department: "HSE Department",
    area: "Safety and PPE",
    priority: "Medium",
    location: "Clinic and estate camps",
    finding: "The sickbay lacked proper lighting and basic treatment equipment, waste disposal pits were missing, rubbish disposal around camps was improper, medical inventory recording needed control, and chemical or fertiliser disposal records were weak.",
    impact: "Health service quality, sanitation, disease prevention, and environmental controls may be compromised.",
    recommendation: "Improve clinic lighting and equipment, restore quarterly fumigation, build approved waste pits, and strengthen medical and chemical inventory records.",
    owner: "HSE Manager",
    dueDate: "2025-10-15",
    status: "Open",
    geo: { latitude: 5.9221, longitude: 8.3382, accuracy: 39 },
    photoUrl: "/audit/evidence/oban-2024-hse.jpg",
    photoName: "2024 audit evidence - HSE",
    source: "OBAN AUDIT REPORT 2024",
    capturedAt: "2024-11-21T15:40:00.000Z",
  },
  {
    id: "audit_2024_it_inventory",
    projectId: "project_opsl_15000ha_development",
    auditYear: "2024",
    department: "IT Department",
    area: "Stock and inventory",
    priority: "Medium",
    location: "IT inventory and network assets",
    finding: "Frequent internet downtime, missing serial numbers, inventory discrepancies, and disorganised IT records affected asset tracking for walkie-talkies, computers, printers, routers, access points, TVs, DSTV equipment, and switches.",
    impact: "Unstable connectivity and incomplete serial records can disrupt operations and weaken IT asset traceability.",
    recommendation: "Use portable internet modems for critical locations, notify Procurement and GM of IT equipment changes, and update all IT inventory records with serial numbers.",
    owner: "IT Manager",
    dueDate: "2025-10-15",
    status: "In progress",
    geo: { latitude: 5.9259, longitude: 8.3349, accuracy: 33 },
    photoUrl: "/audit/evidence/oban-2024-it.jpg",
    photoName: "2024 audit evidence - IT",
    source: "OBAN AUDIT REPORT 2024",
    capturedAt: "2024-11-21T16:10:00.000Z",
  },
  {
    id: "audit_2024_audit_department",
    projectId: "project_opsl_15000ha_development",
    auditYear: "2024",
    department: "Audit Department",
    area: "SOP compliance",
    priority: "Medium",
    location: "Internal audit office and field activities",
    finding: "The internal audit team lacked effective communication with operations, field maintenance was unscheduled, muster roll verification was weak, audit work delegation and report organisation were limited, and expired ID cards were observed during muster.",
    impact: "Delayed reporting and weaker surveillance reduce management visibility over plantation non-compliance.",
    recommendation: "Schedule audit work from plantation programmes, require surveillance updates after field activity, run black bunch counts every four months, and educate teams on keeping employee IDs current.",
    owner: "Audit Department",
    dueDate: "2025-10-31",
    status: "Open",
    geo: { latitude: 5.9268, longitude: 8.3325, accuracy: 27 },
    photoUrl: "/audit/evidence/oban-2024-it.jpg",
    photoName: "2024 audit evidence - Audit Department",
    source: "OBAN AUDIT REPORT 2024",
    capturedAt: "2024-11-21T16:40:00.000Z",
  },
];

let mongoClientPromise = null;
let mongoUnavailableLogged = false;

function auditYearFromEntry(entry = {}) {
  if (entry.auditYear) return String(entry.auditYear);
  const source = String(entry.source || "");
  const sourceYear = source.match(/\b(20\d{2})\b/)?.[1];
  if (sourceYear) return sourceYear;
  const capturedYear = String(entry.capturedAt || entry.dueDate || "").match(/\b(20\d{2})\b/)?.[1];
  return capturedYear || "2025";
}

export function normalizeAuditEntry(entry = {}, projectId = "") {
  const now = new Date().toISOString();
  const geo = entry.geo && typeof entry.geo === "object" ? {
    latitude: Number(entry.geo.latitude),
    longitude: Number(entry.geo.longitude),
    accuracy: Number(entry.geo.accuracy || 0),
  } : null;
  return {
    id: String(entry.id || `audit_${randomUUID()}`),
    projectId: String(entry.projectId || projectId),
    auditYear: auditYearFromEntry(entry),
    department: String(entry.department || "Unassigned"),
    area: String(entry.area || "SOP compliance"),
    priority: String(entry.priority || "High"),
    status: String(entry.status || "Open"),
    location: String(entry.location || ""),
    owner: String(entry.owner || ""),
    dueDate: String(entry.dueDate || ""),
    reference: String(entry.reference || ""),
    finding: String(entry.finding || ""),
    impact: String(entry.impact || "Impact pending review."),
    recommendation: String(entry.recommendation || "Corrective action pending assignment."),
    geo: geo && Number.isFinite(geo.latitude) && Number.isFinite(geo.longitude) ? geo : null,
    photoDataUrl: typeof entry.photoDataUrl === "string" && entry.photoDataUrl.startsWith("data:image/") ? entry.photoDataUrl : "",
    photoUrl: typeof entry.photoUrl === "string" && entry.photoUrl.startsWith("/") ? entry.photoUrl : "",
    photoName: String(entry.photoName || ""),
    source: String(entry.source || "Field entry"),
    capturedAt: String(entry.capturedAt || now),
    updatedAt: String(entry.updatedAt || now),
  };
}

function auditFallbackPath(dbPath) {
  return path.join(path.dirname(dbPath), "audit-entries.json");
}

async function getMongoCollection() {
  const uri = process.env.FM2_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) return null;
  try {
    if (!mongoClientPromise) {
      const { MongoClient } = await import("mongodb");
      mongoClientPromise = MongoClient.connect(uri, {
        appName: "fm2-audit",
        serverSelectionTimeoutMS: 3000,
      });
    }
    const client = await mongoClientPromise;
    const dbName = process.env.FM2_MONGODB_DB || "financial_model2";
    return client.db(dbName).collection("audit_entries");
  } catch (error) {
    mongoClientPromise = null;
    if (!mongoUnavailableLogged) {
      console.warn(`MongoDB audit store unavailable, using local JSON fallback: ${error.message}`);
      mongoUnavailableLogged = true;
    }
    return null;
  }
}

async function readFallbackEntries(dbPath, projectId) {
  const file = auditFallbackPath(dbPath);
  try {
    const entries = JSON.parse(await fs.readFile(file, "utf8"));
    return Array.isArray(entries)
      ? entries.filter((entry) => entry.projectId === projectId).map((entry) => normalizeAuditEntry(entry, projectId))
      : [];
  } catch {
    return [];
  }
}

async function writeFallbackEntries(dbPath, projectId, entries) {
  const file = auditFallbackPath(dbPath);
  let existing = [];
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    if (Array.isArray(parsed)) existing = parsed;
  } catch {
    existing = [];
  }
  const others = existing.filter((entry) => entry.projectId !== projectId);
  await fs.writeFile(file, JSON.stringify([...others, ...entries], null, 2) + "\n");
}

export async function seedAuditEntries(dbPath, projectId, auditYear = "") {
  const seedSource = [
    ...auditSeedEntries2025,
    ...auditSeedEntries2024,
  ];
  const seed = seedSource
    .map((entry) => normalizeAuditEntry(entry, projectId))
    .filter((entry) => !auditYear || entry.auditYear === String(auditYear));
  const collection = await getMongoCollection();
  if (collection) {
    for (const entry of seed) {
      await collection.updateOne({ id: entry.id, projectId }, { $setOnInsert: entry }, { upsert: true });
    }
    return { backend: "mongodb", seeded: seed.length };
  }
  const current = await readFallbackEntries(dbPath, projectId);
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of seed) byId.set(entry.id, byId.get(entry.id) || entry);
  await writeFallbackEntries(dbPath, projectId, Array.from(byId.values()));
  return { backend: "json", seeded: seed.length };
}

export async function listAuditEntries(dbPath, projectId, { page = 1, pageSize = 10, q = "", department = "", status = "", auditYear = "" } = {}) {
  await seedAuditEntries(dbPath, projectId, auditYear);
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.min(5000, Math.max(1, Number(pageSize) || 10));
  const filters = {
    projectId,
    ...(auditYear ? { auditYear: String(auditYear) } : {}),
    ...(department ? { department } : {}),
    ...(status ? { status } : {}),
  };
  const collection = await getMongoCollection();
  let items;
  let backend = "json";
  if (collection) {
    backend = "mongodb";
    const mongoFilters = { ...filters };
    if (q) {
      mongoFilters.$or = [
        { finding: { $regex: q, $options: "i" } },
        { department: { $regex: q, $options: "i" } },
        { location: { $regex: q, $options: "i" } },
      ];
    }
    const total = await collection.countDocuments(mongoFilters);
    items = await collection
      .find(mongoFilters, { projection: { _id: 0 } })
      .sort({ capturedAt: -1, id: 1 })
      .skip((normalizedPage - 1) * normalizedPageSize)
      .limit(normalizedPageSize)
      .toArray();
    return { backend, page: normalizedPage, pageSize: normalizedPageSize, total, items };
  }
  items = await readFallbackEntries(dbPath, projectId);
  if (auditYear) items = items.filter((entry) => entry.auditYear === String(auditYear));
  if (department) items = items.filter((entry) => entry.department === department);
  if (status) items = items.filter((entry) => entry.status === status);
  if (q) {
    const needle = q.toLowerCase();
    items = items.filter((entry) => [entry.finding, entry.department, entry.location].some((value) => String(value).toLowerCase().includes(needle)));
  }
  items = items.sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)) || a.id.localeCompare(b.id));
  const total = items.length;
  const start = (normalizedPage - 1) * normalizedPageSize;
  return { backend, page: normalizedPage, pageSize: normalizedPageSize, total, items: items.slice(start, start + normalizedPageSize) };
}

export async function allAuditEntries(dbPath, projectId, auditYear = "") {
  const result = await listAuditEntries(dbPath, projectId, { page: 1, pageSize: 5000, auditYear });
  return result.items;
}

export async function createAuditEntry(dbPath, projectId, entry) {
  await seedAuditEntries(dbPath, projectId, entry.auditYear || "");
  const normalized = normalizeAuditEntry(entry, projectId);
  if (!normalized.finding.trim()) {
    const error = new Error("Observation / Finding is required");
    error.statusCode = 400;
    throw error;
  }
  const collection = await getMongoCollection();
  if (collection) {
    await collection.updateOne({ id: normalized.id, projectId }, { $set: normalized }, { upsert: true });
    return { backend: "mongodb", entry: normalized };
  }
  const current = await readFallbackEntries(dbPath, projectId);
  await writeFallbackEntries(dbPath, projectId, [normalized, ...current.filter((item) => item.id !== normalized.id)]);
  return { backend: "json", entry: normalized };
}
