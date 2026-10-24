import test from 'node:test';import assert from 'node:assert/strict';
import {applyDeadlineStatus} from '../standalone-audit/deadline-status.mjs';
const entry={status:'Open',timeZone:'Africa/Lagos',actions:[{id:'a',status:'Open',dueDate:'2026-10-24'},{id:'b',status:'Open',dueDate:'2026-10-26'}]};
test('due date inclusive, recommendations close independently, overall after latest deadline',()=>{
 assert.equal(applyDeadlineStatus(entry,new Date('2026-10-24T22:59:59Z')),entry);
 let e=applyDeadlineStatus(entry,new Date('2026-10-24T23:00:00Z'));
 assert.deepEqual(e.actions.map(a=>a.status),['Closed','Open']);assert.equal(e.status,'Open');
 e=applyDeadlineStatus(e,new Date('2026-10-26T23:00:00Z'));assert.equal(e.status,'Closed');
 assert.equal(applyDeadlineStatus(e,new Date('2026-10-27T12:00:00Z')),e);
});
test('drafts/imports untouched; missing dates do not auto-close; extension reopens',()=>{
 for(const e of [{...entry,status:'Draft'},{...entry,sourceReport:{issue:1}}])assert.equal(applyDeadlineStatus(e,new Date('2030-01-01')),e);
 assert.equal(applyDeadlineStatus({...entry,actions:[{status:'Open'}]},new Date('2030-01-01')).status,'Open');
 const e={...entry,status:'Closed',actions:[{status:'Closed',dueDate:'2026-11-01'}]};
 assert.equal(applyDeadlineStatus(e,new Date('2026-10-27')).status,'Open');
});
test('captured timezone controls midnight; early status changes remain Open',()=>{
 const e={...entry,status:'In progress',timeZone:'Asia/Kuala_Lumpur',actions:[{status:'Closed',dueDate:'2026-10-24',responses:[{text:'done'}]}]};
 const before=applyDeadlineStatus(e,new Date('2026-10-24T15:59:59Z'));assert.equal(before.status,'Open');assert.equal(before.actions[0].status,'Open');assert.equal(before.actions[0].responses.length,1);
 assert.equal(applyDeadlineStatus(e,new Date('2026-10-24T16:00:00Z')).status,'Closed');
});
