import {randomUUID} from 'node:crypto';
import {auditToday,validateAction,validateAuditAssignees} from '../audit/audit-permissions.mjs';
import {applyDeadlineStatus} from './deadline-status.mjs';
import {entryTimeZone} from './timezone.mjs';
const fail=(message,statusCode=403)=>{throw Object.assign(new Error(message),{statusCode});};
// This delegation is intentionally restricted to the existing Milo sign-in account.
export const canReopenActions=actor=>actor.userId==='milo';
export function reopenAction(actor,patch,existing,users,excluded=[],now=new Date()){
 if(!canReopenActions(actor))fail('Only Milo can reopen or reassign a closed action.');
 if(!existing)fail('Finding not found.',404);
 if(existing.status==='Draft')fail('Finalize the finding before reopening its corrective action.',409);
 if(!patch.baseUpdatedAt||patch.baseUpdatedAt!==existing.updatedAt)fail('This issue changed. Reload before reopening.',409);
 const current=applyDeadlineStatus(existing,now),action=current.actions?.find(a=>a.id===patch.actionId);
 if(!action)fail('Recommendation not found.',404);
 if(action.status!=='Closed')fail('This action is already open. Reopen is available only for closed actions.',409);
 const reason=String(patch.reason||'').trim();if(!reason||reason.length>2000)fail('Enter a reopening reason, up to 2,000 characters.',400);
 const next={...action,owner:String(patch.owner||''),email:String(patch.email||''),dueDate:String(patch.dueDate||'')};
 validateAction(next);
 if(next.dueDate<auditToday(now,entryTimeZone(existing)))fail('Choose a new due date today or later to reopen this action.',400);
 validateAuditAssignees({operation:'update-action',action:next},users,excluded,{company:existing.entity});
 const event={id:randomUUID(),type:'reopened',actor:actor.userId,at:now.toISOString(),reason,from:{status:'Closed',owner:action.owner,email:action.email,dueDate:action.dueDate},to:{status:'Open',owner:next.owner,email:next.email,dueDate:next.dueDate}};
 const actions=current.actions.map(a=>a.id===action.id?{...next,status:'Open',reopenHistory:[...(action.reopenHistory||[]),event]}:a);
 return applyDeadlineStatus({...current,actions,updatedAt:now.toISOString()},now);
}
// Never trust caller-supplied audit history, even when a draft is edited.
export function preserveActionHistory(patch,existing){
 for(const action of [...(Array.isArray(patch.actions)?patch.actions:[]),...(patch.action?[patch.action]:[])]){
  const prior=existing?.actions?.find(a=>a.id===action.id);
  if(prior?.reopenHistory)action.reopenHistory=structuredClone(prior.reopenHistory);else delete action.reopenHistory;
 }
}
// Enforce the delegation on older editing/sync routes as well as the new form.
export function assertNoImplicitReopen(actor,before,after,now=new Date()){
 if(!before||after.status==='Draft')return;
 const today=auditToday(now,entryTimeZone(before));
 for(const action of after.actions||[]){
  const prior=before.actions?.find(a=>a.id===action.id);
  const wasClosed=prior&&(prior.status==='Closed'||(/^\d{4}-\d{2}-\d{2}$/.test(prior.dueDate||'')&&prior.dueDate<today));
  if(wasClosed&&/^\d{4}-\d{2}-\d{2}$/.test(action.dueDate||'')&&action.dueDate>=today){
   fail('Closed actions must be reopened by Milo using Reopen / reassign so the reason and history are recorded.');
  }
 }
}
