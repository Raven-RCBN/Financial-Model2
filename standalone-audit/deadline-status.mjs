import {randomUUID} from 'node:crypto';
import {entryTimeZone} from './timezone.mjs';

// Deadline closure is administrative; it does not certify corrective work complete.
export function applyDeadlineStatus(entry, now = new Date()) {
  if (entry.status === 'Draft' || !entry.actions?.length) return entry;
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:entryTimeZone(entry),year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const expired = action => /^\d{4}-\d{2}-\d{2}$/.test(action.dueDate || '') && Number.isFinite(Date.parse(action.dueDate)) && action.dueDate < today;
  const actions = entry.actions.map(action => {
    const status = expired(action) ? 'Closed' : 'Open';
    if(action.status===status)return action;
    const history=status==='Closed'?[...(action.reopenHistory||[]),{id:randomUUID(),type:'auto-closed',actor:'system',at:now.toISOString(),reason:'Due date passed',from:{status:action.status,owner:action.owner||'',email:action.email||'',dueDate:action.dueDate},to:{status:'Closed',owner:action.owner||'',email:action.email||'',dueDate:action.dueDate}}]:action.reopenHistory;
    return {...action,status,...(history?{reopenHistory:history}:{})};
  });
  const status = actions.every(expired) ? 'Closed' : 'Open';
  if (status === entry.status && actions.every((a,i)=>a===entry.actions[i])) return entry;
  return {...entry,actions,status,updatedAt:now.toISOString()};
}
