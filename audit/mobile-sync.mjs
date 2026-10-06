import { createHash } from 'node:crypto';
import { applyAuditWrite, actionsFor } from './audit-permissions.mjs';
export const findingFields = ['finding','impact','department','area','priority','location','reference','auditYear'];
export const actionFields = ['description','owner','email','dueDate'];
const pick = (obj, fields) => Object.fromEntries(fields.map(key => [key, String(obj?.[key] || '')]));
const reject = (message, statusCode) => { throw Object.assign(new Error(message), {statusCode}); };
export function prepareMobileWrite(actor, request, existing, options = {}) {
  const {operationId, patch, base} = request;
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(operationId || '') || !patch || typeof patch !== 'object') reject('Invalid mobile operation.',400);
  if (typeof patch.id !== 'string' || !patch.id.trim() || patch.id.length > 150) reject('Finding ID is required.',400);
  if (patch.newImages && !Array.isArray(patch.newImages)) reject('Invalid evidence photos.',400);
  const digest = createHash('sha256').update(JSON.stringify(patch)).digest('hex');
  const receipt = existing?.mobileOperations?.find(item => item.id === operationId && item.userId === actor.userId);
  if (receipt) {
    if (receipt.digest !== digest) reject('This operation ID was already used for a different change.',409);
    return {entry:existing, duplicate:true};
  }
  let authorized;
  if (patch.operation === 'update-finding' && existing?.status === 'Draft' && options.drafts) {
    reject('Reopen this draft in the webapp to edit or finalize it.',409);
  }
  if (patch.operation === 'update-finding') {
    if (!existing) reject('Finding not found.',404);
    if (!actor.admin && (!actor.create || existing.createdBy !== actor.userId)) reject('Only the finding creator can update observations.',403);
    if (JSON.stringify(pick(existing,findingFields)) !== JSON.stringify(pick(base,findingFields))) reject('The observation changed on another device. Review the latest version before retrying.',409);
    if (!String(patch.finding || '').trim()) reject('Observation is required.',400);
    authorized = {...existing,...pick(patch,findingFields),geo:patch.geo || existing.geo,observationImages:[...(existing.observationImages||[]),...(patch.newImages||[])],updatedAt:new Date().toISOString()};
  } else {
    if (patch.operation === 'update-action') {
      const current = actionsFor(existing || {}).find(action=>action.id===patch.actionId);
      if (JSON.stringify(pick(current,actionFields)) !== JSON.stringify(pick(base,actionFields))) reject('This corrective action changed on another device. Review it before retrying.',409);
    }
    if (patch.operation === 'reply') {
      const current = actionsFor(existing || {}).find(action=>action.id===patch.actionId);
      if (current && (current.status !== base?.status || (current.responseDueDate||'') !== (base?.responseDueDate||'')) && (patch.status !== current.status || (patch.dueDate||'') !== (current.responseDueDate||''))) reject('The action status or follow-up date changed. Review the latest response before retrying.',409);
    }
    authorized = applyAuditWrite(actor,patch,existing,options);
    if (patch.operation === 'add-action' && /^[a-f0-9-]{36}$/.test(patch.action?.id || '')) authorized.actions.at(-1).id = patch.action.id;
    if (!existing && Array.isArray(patch.actions)) authorized.actions.forEach((action,i)=>{if(/^[a-f0-9-]{36}$/.test(patch.actions[i]?.id||''))action.id=patch.actions[i].id;});
  }
  if ((authorized.observationImages?.length||0)>12) reject('A finding supports up to 12 evidence photos.',400);
  authorized.mobileOperations = [...(existing?.mobileOperations||[]),{id:operationId,userId:actor.userId,digest}];
  return {entry:authorized,duplicate:false};
}
