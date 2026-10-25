import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAuditWrite,validateAuditAssignees} from '../audit/audit-permissions.mjs';
import {normalizeAuditEntry} from '../audit/audit-store.mjs';
import {enrollNotifications,notificationJobs} from '../standalone-audit/notifications.mjs';
const actor={userId:'creator',create:true,recommend:true,email:'creator@example.test'};
const now=new Date('2026-10-23T09:00:00Z'),options={drafts:true,lockFinalized:true,now};
const directories={p:[{name:'Estate manager',email:'owner@example.test',status:'Active',companyScope:'selected',companies:['ORE']},{name:'creator',email:actor.email,status:'Active'},{name:'assignee',email:'assignee@example.test',status:'Active',auditPermissions:{respond:true},companyScope:'selected',companies:['ORE']}]};
const action={id:'a',description:'Repair the drain',owner:'assignee',email:'assignee@example.test',dueDate:'2026-10-25',status:'Open'};
function finalize(ownerEmail='OWNER@example.test') {
 const draft=normalizeAuditEntry(applyAuditWrite(actor,{id:'item',status:'Draft',entity:'ORE',auditYear:'2026',owner:'Estate manager',ownerEmail,finding:'Blocked drain',actions:[action]},null,options),'p');
 const finalized=applyAuditWrite(actor,{operation:'save-draft',status:'Open',baseUpdatedAt:draft.updatedAt},draft,options);
 return normalizeAuditEntry(enrollNotifications(finalized,draft,actor,now),'p');
}
test('owner contact survives draft normalization/edit/finalization; incomplete drafts remain allowed',()=>{
 const draft=applyAuditWrite(actor,{status:'Draft',ownerEmail:'unfinished'},null,options);
 assert.equal(normalizeAuditEntry(draft,'p').ownerEmail,'unfinished');
 assert.throws(()=>applyAuditWrite(actor,{operation:'save-draft',status:'Open',finding:'test',baseUpdatedAt:draft.updatedAt},draft,options),/valid responsible owner email/);
 assert.throws(()=>applyAuditWrite(actor,{finding:'test',ownerEmail:'bad-address'},null,options),/valid responsible owner email/);
 const e=finalize();assert.equal(e.owner,'Estate manager');assert.equal(e.ownerEmail,'owner@example.test');
 assert.equal(finalize('').ownerEmail,'');
});
test('owner gets finalization, reminder and due emails with full content and unchanged existing recipient keys',()=>{
 const e=finalize();
 for(const [type,at,expected] of [['assigned',now,['assignee@example.test','owner@example.test']],['reminder',now,['assignee@example.test','creator@example.test','owner@example.test']],['due',new Date('2026-10-25T09:00:00Z'),['assignee@example.test','creator@example.test','owner@example.test']]]) {
  const jobs=notificationJobs([e],directories,'',at).filter(j=>j.type===type);
  assert.deepEqual(jobs.map(j=>j.to).sort(),expected);
  assert(jobs.every(j=>j.text.includes('Responsible owner: Estate manager')&&j.text.includes('Responsible owner email: owner@example.test')&&j.text.includes('Repair the drain')&&j.html.includes('owner@example.test')));
  const old=notificationJobs([{...e,ownerEmail:''}],directories,'',at).filter(j=>j.type===type);
  for(const job of old)assert.equal(jobs.find(j=>j.to===job.to).key,job.key);
 }
 const duplicate=notificationJobs([{...e,owner:'assignee',ownerEmail:'ASSIGNEE@example.test'}],directories,'',now).filter(j=>j.type==='reminder');
 assert.equal(duplicate.length,2);
 assert.equal(notificationJobs([{...e,status:'Draft'}],directories,'',now).length,0);
 assert.equal(notificationJobs([{...e,status:'Closed'}],directories,'',now).length,0);
 assert.equal(notificationJobs([e],directories,'',new Date('2026-10-24T09:00:00Z')).filter(j=>j.type==='reminder').length,0);
 assert.throws(()=>applyAuditWrite({userId:'owner',email:e.ownerEmail,respond:true},{operation:'reply',actionId:e.actions[0].id,text:'Reply',status:'Open'},e,options),/Only the assigned respondent/);
});
test('reopened and refinalized notices include owner while retaining recipient deduplication',()=>{
 const e=finalize();
 for(const type of ['reopened','refinalized']){
  const entry={...e,status:type==='reopened'?'Draft':'Open',lifecycleNotice:{type,revision:type,at:e.actions[0].assignedAt,assignees:[{name:action.owner,email:action.email}]}};
  const jobs=notificationJobs([entry],directories,'',now).filter(j=>j.type===type);
  assert.deepEqual(jobs.map(j=>j.to).sort(),['assignee@example.test','creator@example.test','owner@example.test']);
 }
});

test('owner selection is company-scoped and checked again before alerts',()=>{
 const e=finalize();
 assert.doesNotThrow(()=>validateAuditAssignees({...e,owner:'Typed department head'},directories.p,[],{...options,company:'ORE'}));
 assert.throws(()=>validateAuditAssignees({...e,ownerEmail:'external@example.test'},directories.p,[],{...options,company:'ORE'}),/active responsible owner/);
 assert.throws(()=>validateAuditAssignees({...e},directories.p,[],{...options,company:'OBAN'}),/active responsible owner/);
 const inactive={p:directories.p.map(u=>u.name===e.owner?{...u,status:'Inactive'}:u)};
 assert(!notificationJobs([e],inactive,'',now).some(j=>j.to===e.ownerEmail));
});

test('one independently named owner receives every recommendation alert on each action deadline',()=>{
 const e=finalize();
 e.owner='Typed department head';
 const second={...e.actions[0],id:'b',owner:'second-assignee',email:'second@example.test',description:'Replace safety signs',dueDate:'2026-10-27'};
 e.actions.push(second);
 const users={p:[...directories.p,{name:second.owner,email:second.email,status:'Active',auditPermissions:{respond:true},companyScope:'selected',companies:['ORE']}]};
 assert.doesNotThrow(()=>validateAuditAssignees({...e},users.p,[],{...options,company:'ORE'}));
 for(const [type,date,ids] of [['assigned','2026-10-23',['a','b']],['reminder','2026-10-23',['a']],['reminder','2026-10-25',['b']],['due','2026-10-25',['a']],['due','2026-10-27',['b']]]){
  const jobs=notificationJobs([e],users,'',new Date(`${date}T09:00:00Z`)).filter(j=>j.type===type&&j.to===e.ownerEmail);
  assert.deepEqual(jobs.map(j=>j.actionId).sort(),ids);
  for(const job of jobs){
   const a=e.actions.find(a=>a.id===job.actionId);
   assert(job.text.includes(a.description));assert(job.text.includes(a.email));assert(job.text.includes(a.dueDate));
   assert(job.text.includes('Responsible owner: Typed department head'));
  }
 }
});

test('second independent owner persists and gets every alert with deduplication and company validation',()=>{
 const users={p:[...directories.p,{name:'Deputy',email:'deputy@example.test',status:'Active',companyScope:'selected',companies:['ORE']}]};
 const e=normalizeAuditEntry({...finalize(),owner2:'Manually typed deputy',owner2Email:'deputy@example.test'},'p');
 assert.equal(e.owner2,'Manually typed deputy');assert.equal(e.owner2Email,'deputy@example.test');
 const edited=applyAuditWrite(actor,{operation:'save-draft',baseUpdatedAt:e.updatedAt,owner2:'Deputy name',owner2Email:'deputy@example.test'},{...e,status:'Draft',createdBy:actor.userId},options);
 assert.equal(edited.owner2,'Deputy name');assert.equal(edited.owner2Email,'deputy@example.test');
 assert.doesNotThrow(()=>validateAuditAssignees({...e},users.p,[],{...options,company:'ORE'}));
 assert.throws(()=>validateAuditAssignees({...e,owner2Email:'other@example.test'},users.p,[],{...options,company:'ORE'}),/active responsible owner/);
 for(const [type,at] of [['assigned',now],['reminder',now],['due',new Date('2026-10-25T09:00:00Z')]]){
  const jobs=notificationJobs([e],users,'',at).filter(j=>j.type===type);
  assert(jobs.some(j=>j.to===e.ownerEmail));assert(jobs.some(j=>j.to===e.owner2Email));
  assert(jobs.every(j=>j.text.includes('Owner 2: Manually typed deputy')));
  const duplicate=notificationJobs([{...e,owner2Email:e.ownerEmail}],users,'',at).filter(j=>j.type===type&&j.to===e.ownerEmail);
  assert.equal(duplicate.length,1);
 }
 for(const type of ['reopened','refinalized']){
  const item={...e,lifecycleNotice:{type,revision:type,at:e.actions[0].assignedAt,assignees:[]}};
  assert(notificationJobs([item],users,'',now).some(j=>j.type===type&&j.to===e.owner2Email));
 }
});
