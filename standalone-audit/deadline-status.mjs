import {entryTimeZone} from './timezone.mjs';

// Deadline closure is administrative; it does not certify corrective work complete.
export function applyDeadlineStatus(entry, now = new Date()) {
  if (entry.status === 'Draft' || entry.sourceReport || !entry.actions?.length) return entry;
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:entryTimeZone(entry),year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const expired = action => /^\d{4}-\d{2}-\d{2}$/.test(action.dueDate || '') && Number.isFinite(Date.parse(action.dueDate)) && action.dueDate < today;
  const actions = entry.actions.map(action => {
    const status = expired(action) ? 'Closed' : 'Open';
    return action.status === status ? action : {...action,status};
  });
  const status = actions.every(expired) ? 'Closed' : 'Open';
  if (status === entry.status && actions.every((a,i)=>a===entry.actions[i])) return entry;
  return {...entry,actions,status,updatedAt:now.toISOString()};
}
