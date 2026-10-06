import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
export function auditIdentity(session, users = []) {
  const user = users.find(user => user.name === session?.userId);
  const admin = session?.role === "admin";
  const active = user && user.status === "Active";
  return { userId: session?.userId || "", email: active ? String(user.email || "").toLowerCase() : "", admin,
    create: admin || Boolean(active && user.auditPermissions?.create),
    recommend: admin || Boolean(active && user.auditPermissions?.recommend),
    respond: admin || Boolean(active && user.auditPermissions?.respond) };
}
function reject(message, statusCode = 403) { throw Object.assign(new Error(message), {statusCode}); }
function validDate(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function validateAction(action) {
  if (!action || !String(action.description || "").trim() || !String(action.owner || "").trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(action.email || "") || !validDate(action.dueDate)) reject("Each action requires a description, responsible person, valid email and due date.", 400);
  if (action.responseDueDate && !validDate(action.responseDueDate)) reject("Invalid follow-up due date.", 400);
}
export function actionsFor(entry) {
  if (entry.sourceReport) return entry.actions || [];
  if (entry.actions?.length) return entry.actions;
  if (!entry.recommendation || entry.recommendation === "Corrective action pending assignment.") return [];
  return [{id: "legacy", description: entry.recommendation, owner: entry.owner || "", email: "", dueDate: entry.dueDate || "", status: entry.status || "Open", responses: []}];
}
function responseImages(images=[]){
  if(!Array.isArray(images)||images.length>8)reject('An action update supports up to 8 photos.',400);
  return images.map(image=>{
    if(!image||typeof image.dataUrl!=='string'||!/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(image.dataUrl)||image.dataUrl.length>4*1024*1024)reject('Use JPEG, PNG or WebP photos up to 3 MB each.',400);
    return {dataUrl:image.dataUrl,name:String(image.name||'Action evidence').slice(0,200),description:String(image.description||'').slice(0,2000)};
  });
}
export function applyAuditWrite(identity, patch, existing) {
  if (!identity.userId) reject("Sign in to update audits.");
  const now = new Date().toISOString();
  if (patch.operation === "reply") {
    if (!existing) reject("Finding not found.", 404);
    const actions = actionsFor(existing);
    const action = actions.find(action => action.id === patch.actionId);
    if (!action) reject("Action not found.", 404);
    if (!identity.admin && (!identity.respond || !identity.email || identity.email !== String(action.email).toLowerCase())) reject("Only the assigned respondent can reply to this action.");
    if (!String(patch.text || "").trim()) reject("Response is required.", 400);
    if (patch.dueDate && !validDate(patch.dueDate)) reject("Invalid follow-up due date.", 400);
    if (!["Open", "In progress", "Closed"].includes(patch.status)) reject("Invalid action status.", 400);
    const updated = actions.map(item => item.id !== action.id ? item : {...item, status: patch.status, responseDueDate: patch.dueDate || "", responses: [...(item.responses || []), {id: randomUUID(), text: patch.text.trim(), author: identity.userId, email: identity.email, dueDate: patch.dueDate || "", createdAt: now, status: patch.status, images: responseImages(patch.images)}]});
    return {...existing, actions: updated, status: updated.every(action => action.status === "Closed") ? "Closed" : updated.some(action => action.status !== "Open") ? "In progress" : "Open", updatedAt: now};
  }
  if (patch.operation === "update-action") {
    if (!identity.recommend) reject("Corrective action permission is required.");
    if (!existing) reject("Finding not found.", 404);
    validateAction(patch.action);
    const actions = actionsFor(existing);
    if (!actions.some(action => action.id === patch.actionId)) reject("Action not found.", 404);
    const updated = actions.map(action => action.id !== patch.actionId ? action : {...action, description: patch.action.description, owner: patch.action.owner, email: patch.action.email, dueDate: patch.action.dueDate});
    return {...existing, actions: updated, recommendation: updated.map(action => action.description).join("\n\n"), updatedAt: now};
  }
  if (patch.operation === "add-action") {
    if (!identity.recommend) reject("Corrective action permission is required.");
    if (!existing) reject("Finding not found.", 404);
    validateAction(patch.action);
    const action = {...patch.action, id: randomUUID(), status: "Open", responses: []};
    const actions = [...actionsFor(existing), action];
    return {...existing, actions, recommendation: actions.map(action => action.description).join("\n\n"), status: "Open", updatedAt: now};
  }
  if (existing) reject("Use the action or response controls to update this finding.");
  if (!identity.create) reject("Audit creator permission is required.");
  if ((patch.actions?.length || patch.recommendation && patch.recommendation !== "Corrective action pending assignment.") && !identity.recommend) reject("Corrective action permission is required.");
  const actions = (patch.actions || []).map(action => { validateAction(action); return {...action, id: randomUUID(), responses: [], status: "Open"}; });
  return {...patch, actions, projectId: undefined, status: "Open", createdBy: identity.userId, capturedAt: now, updatedAt: now};
}

export function hashAuditPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 256) reject("Audit passwords must contain 12–256 characters.", 400);
  const salt = randomBytes(16).toString("hex");
  return {salt, hash: scryptSync(password, salt, 64).toString("hex")};
}
export function verifyAuditPassword(password, credential) {
  if (typeof password !== "string" || password.length > 256 || !credential?.salt || !credential?.hash) return false;
  const expected = Buffer.from(credential.hash, "hex");
  const actual = scryptSync(password, credential.salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function auditApiAllowed(session, pathname, method) {
  if (session?.role !== "audit") return true;
  if (pathname === "/api/session") return method === "GET";
  const match = pathname.match(/^\/api\/projects\/([^/]+)\/(audit-context|audit-access|audit-entries|audit-pdf|audit-sync)$/);
  if (!match || !session.projectIds?.includes(match[1])) return false;
  return match[2] === "audit-context" || match[2] === "audit-access" ? method === "GET" : match[2] === "audit-entries" ? ["GET", "POST"].includes(method) : method === "POST";
}

// Assignment options expose only the active Audit directory, never FM2 accounts or credentials.
export function auditAssignees(users, reservedNames = []) {
  const excluded = new Set(['admin', ...reservedNames].map(name => String(name).toLowerCase()));
  return users.filter(user => user.status === 'Active' && !excluded.has(String(user.name).toLowerCase()))
    .map(({id,name,email,auditPermissions}) => ({id,name,email,canRespond:Boolean(auditPermissions?.respond)}));
}
export function validateAuditAssignees(patch, users, reservedNames = []) {
  const choices = auditAssignees(users,reservedNames);
  const actions = ['add-action','update-action'].includes(patch.operation) ? [patch.action] : !patch.operation ? (patch.actions || []) : [];
  for (const action of actions) {
    const user = choices.find(user => user.name === action?.owner && user.email.toLowerCase() === String(action?.email || '').toLowerCase());
    if (!user) reject('Select an active responsible person from the Audit User Directory (excluding administrators). Refresh the directory if it has changed.',400);
    action.owner = user.name;
    action.email = user.email;
  }
}
