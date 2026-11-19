import test from 'node:test';import assert from 'node:assert/strict';
import {reopenAction,preserveActionHistory,canReopenActions,assertNoImplicitReopen} from '../standalone-audit/action-reopen.mjs';
import {applyDeadlineStatus} from '../standalone-audit/deadline-status.mjs';
import {normalizeAuditEntry} from '../audit/audit-store.mjs';
const now=new Date('2026-11-19T12:00:00Z'),milo={userId:'milo'};
const users=['alice','bob'].map(name=>({id:name,name,email:name+'@example.test',status:'Active',auditPermissions:{respond:true}}));
const entry={id:'e',projectId:'p',entity:'Estate',status:'Open',timeZone:'Africa/Lagos',updatedAt:'v1',finding:'Finding',actions:[{id:'a',description:'Repair drain',owner:'alice',email:'alice@example.test',dueDate:'2026-11-18',status:'Open',responses:[{id:'r',text:'Earlier response',author:'alice',images:[{url:'/audit/uploads/p/fix.jpg',description:'Evidence'}]}]}]};
const patch={actionId:'a',baseUpdatedAt:'v1',owner:'alice',email:'alice@example.test',dueDate:'2026-11-21',reason:'Response does not show a complete repair.'};
test('only Milo reopens with same or different eligible respondent; history, replies and photos survive normalization',()=>{
 for(const owner of ['alice','bob']){
  const reopened=reopenAction(milo,{...patch,owner,email:owner+'@example.test'},entry,users,[],now);
  assert.equal(reopened.status,'Open');assert.equal(reopened.actions[0].status,'Open');assert.equal(reopened.actions[0].owner,owner);
  assert.deepEqual(reopened.actions[0].responses,entry.actions[0].responses);
  const history=reopened.actions[0].reopenHistory;assert.deepEqual(history.map(e=>e.type),['auto-closed','reopened']);
  assert.equal(history[0].actor,'system');assert.equal(history[1].actor,'milo');assert.equal(history[1].from.owner,'alice');assert.equal(history[1].to.owner,owner);assert.equal(history[1].reason,patch.reason);
  assert.deepEqual(normalizeAuditEntry(reopened).actions[0].reopenHistory,history);
  const closed=applyDeadlineStatus(reopened,new Date('2026-11-22T12:00:00Z'));assert.equal(closed.status,'Closed');assert.equal(closed.actions[0].reopenHistory.length,3);
  assert.strictEqual(applyDeadlineStatus(closed,new Date('2026-11-22T13:00:00Z')),closed);
 }
 for(const actor of [{userId:'admin',admin:true},{userId:'other',recommend:true},{userId:'alice',respond:true}]){assert(!canReopenActions(actor));assert.throws(()=>reopenAction(actor,patch,entry,users,[],now),{statusCode:403});}
});
test('reopening validates revision, new date, reason and company-scoped active respondent',()=>{
 for(const change of [{baseUpdatedAt:'old'},{dueDate:'2026-11-18'},{dueDate:'2026-02-30'},{reason:''},{owner:'outsider',email:'outsider@example.test'}])assert.throws(()=>reopenAction(milo,{...patch,...change},entry,users,[],now));
 const restricted=[{...users[0],companyScope:'selected',companies:['Different']}];assert.throws(()=>reopenAction(milo,patch,entry,restricted,[],now),{statusCode:400});
 assert.throws(()=>reopenAction(milo,patch,entry,[{...users[0],auditPermissions:{respond:false}}],[],now),{statusCode:400});
 const forged={actions:[{id:'a',reopenHistory:[{actor:'spoof'}]}]};const closed=applyDeadlineStatus(entry,now);preserveActionHistory(forged,closed);assert.deepEqual(forged.actions[0].reopenHistory,closed.actions[0].reopenHistory);
});

test('legacy editing and refinalization cannot bypass the reopening history operation',()=>{
 const closed=applyDeadlineStatus(entry,now);
 const edited={...closed,status:'Open',actions:closed.actions.map(a=>({...a,dueDate:'2026-11-21'}))};
 for(const actor of [milo,{userId:'admin',admin:true},{userId:'alice'}])assert.throws(()=>assertNoImplicitReopen(actor,closed,edited,now),{statusCode:403});
 assert.doesNotThrow(()=>assertNoImplicitReopen(milo,closed,{...edited,status:'Draft'},now));
 assert.throws(()=>assertNoImplicitReopen({userId:'admin',admin:true},{...closed,status:'Draft'},edited,now),{statusCode:403});
 assert.doesNotThrow(()=>assertNoImplicitReopen({userId:'alice'},closed,closed,now));
});
