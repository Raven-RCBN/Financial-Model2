import test from 'node:test';
import assert from 'node:assert/strict';
import { auditIdentity, applyAuditWrite } from '../audit/audit-permissions.mjs';
import { normalizeAuditEntry, createAuditEntry, allAuditEntries } from '../audit/audit-store.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const users = [
 {name:'creator',email:'creator@example.com',status:'Active',auditPermissions:{create:true}},
 {name:'author',email:'author@example.com',status:'Active',auditPermissions:{recommend:true}},
 {name:'owner',email:'owner@example.com',status:'Active',auditPermissions:{respond:true}},
];
const identity = name => auditIdentity({userId:name,role:'user'},users);
const action = {description:'Repair drain',owner:'Owner',email:'owner@example.com',dueDate:'2026-10-20'};
const draft = {id:'test-finding',finding:'Blocked drain',auditYear:'2030'};
const denied = fn => assert.throws(fn, error => error.statusCode === 403);
test('audit roles are separate, default deny, and inactive users lose permissions',()=>{
 assert.equal(identity('creator').create,true);
 assert.equal(identity('creator').recommend,false);
 assert.equal(identity('unknown').respond,false);
 assert.equal(auditIdentity({userId:'owner'},[{...users[2],status:'Inactive'}]).respond,false);
 assert.equal(auditIdentity({userId:'admin',role:'admin'}).recommend,true);
});
test('creator saves without actions; cannot write corrective sections',()=>{
 assert.equal(applyAuditWrite(identity('creator'),draft).createdBy,'creator');
 denied(()=>applyAuditWrite(identity('creator'),{...draft,actions:[action]}));
 denied(()=>applyAuditWrite(identity('author'),draft));
});
test('author adds an action; only assigned respondent replies with server identity',()=>{
 const finding=applyAuditWrite(identity('creator'),draft);
 const added=applyAuditWrite(identity('author'),{operation:'add-action',action},finding);
 const reply={operation:'reply',actionId:added.actions[0].id,text:'Drain cleared',status:'Closed',dueDate:'2026-10-22',author:'forged'};
 denied(()=>applyAuditWrite(identity('creator'),reply,added));
 denied(()=>applyAuditWrite({...identity('owner'),email:'other@example.com'},reply,added));
 const updated=applyAuditWrite(identity('owner'),reply,added);
 assert.equal(updated.actions[0].responses[0].author,'owner');
 assert.equal(updated.actions[0].dueDate,'2026-10-20');
 assert.equal(updated.actions[0].responseDueDate,'2026-10-22');
 assert.equal(updated.status,'Closed');
 assert.equal(added.actions[0].responses.length,0);
 denied(()=>applyAuditWrite(identity('owner'),{...updated,finding:'tampered'},updated));
});
test('multiple actions and replies survive storage reload',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'audit-workflow-'));
 try {
  const admin=auditIdentity({userId:'admin',role:'admin'});
  let entry=applyAuditWrite(admin,{...draft,actions:[action,{...action,description:'Inspect channel'}]});
  entry=applyAuditWrite(admin,{operation:'reply',actionId:entry.actions[0].id,text:'Scheduled',status:'In progress',dueDate:'2026-10-15'},entry);
  const file=path.join(dir,'db.json');
  await createAuditEntry(file,'test-project',entry);
  const saved=(await allAuditEntries(file,'test-project')).find(item=>item.id===draft.id);
  assert.equal(saved.actions.length,2);
  assert.equal(saved.actions[0].responses[0].text,'Scheduled');
  assert.equal(saved.createdBy,'admin');
  assert.deepEqual(normalizeAuditEntry({finding:'Legacy'}).actions,[]);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('invalid dates and email are rejected',()=>{
 const admin=auditIdentity({userId:'admin',role:'admin'});
 for(const invalid of [{...action,email:'bad'},{...action,dueDate:'2026-02-30'},{...action,dueDate:'2026-99-99'}]) assert.throws(()=>applyAuditWrite(admin,{...draft,actions:[invalid]}),error=>error.statusCode===400);
});
test('action authors can update legacy assignments without editing response history',()=>{
 const existing={...draft,recommendation:'Legacy action',owner:'Old owner',dueDate:'2026-10-10',status:'Open'};
 const updated=applyAuditWrite(identity('author'),{operation:'update-action',actionId:'legacy',action},existing);
 assert.equal(updated.actions[0].email,'owner@example.com');
 const replied=applyAuditWrite(identity('owner'),{operation:'reply',actionId:'legacy',text:'Working on this',status:'In progress'},updated);
 const reassigned=applyAuditWrite(identity('author'),{operation:'update-action',actionId:'legacy',action:{...action,dueDate:'2026-11-01',responses:[]}},replied);
 assert.equal(reassigned.actions[0].responses.length,1);
 assert.equal(reassigned.actions[0].status,'In progress');
 denied(()=>applyAuditWrite(identity('owner'),{operation:'update-action',actionId:'legacy',action},replied));
});

test('Audit sessions allow only audit APIs for their project', async()=>{
 const {auditApiAllowed}=await import('../audit/audit-permissions.mjs');
 const session={role:'audit',projectIds:['audit-project']};
 for(const route of ['/api/projects/audit-project','/api/projects/audit-project/inputs','/api/projects/audit-project/reports','/api/projects/audit-project/management','/api/cpo-market','/api/projects/another/audit-entries']) assert.equal(auditApiAllowed(session,route,'GET'),false,route);
 assert.equal(auditApiAllowed(session,'/api/projects/audit-project/audit-access','PUT'),false);
 for(const route of ['audit-context','audit-access','audit-entries']) assert.equal(auditApiAllowed(session,`/api/projects/audit-project/${route}`,'GET'),true);
 assert.equal(auditApiAllowed(session,'/api/projects/audit-project/audit-entries','POST'),true);
 assert.equal(auditApiAllowed({role:'admin'},'/api/projects/audit-project/management','PUT'),true);
});
test('Audit passwords are salted, verified and length validated', async()=>{
 const {hashAuditPassword,verifyAuditPassword}=await import('../audit/audit-permissions.mjs');
 const first=hashAuditPassword('test-Audit-password-123');
 const second=hashAuditPassword('test-Audit-password-123');
 assert.notEqual(first.hash,second.hash);
 assert.equal(verifyAuditPassword('test-Audit-password-123',first),true);
 assert.equal(verifyAuditPassword('wrong-password',first),false);
 assert.throws(()=>hashAuditPassword('short'),error=>error.statusCode===400);
});
