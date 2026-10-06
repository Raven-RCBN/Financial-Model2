import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {applyAuditWrite,validateAuditAssignees,actionLocked} from '../audit/audit-permissions.mjs';
import {normalizeAuditEntry,createAuditEntry} from '../audit/audit-store.mjs';
import {prepareMobileWrite} from '../audit/mobile-sync.mjs';
import {enrollNotifications,notificationJobs,notificationWorker} from '../standalone-audit/notifications.mjs';
const actor={userId:'creator',email:'creator@example.test',create:true,recommend:true,respond:true};
const admin={...actor,userId:'admin',admin:true};
const options={drafts:true,timeZone:'Asia/Kuala_Lumpur',now:new Date('2026-10-06T15:59:59Z')};
const action={id:'a',description:'Repair drain',owner:'owner',email:'owner@example.test',dueDate:'2026-10-06'};
const directories={p:[{name:'owner',email:action.email,status:'Active'},{name:'creator',email:actor.email,status:'Active'}]};
function open(due='2026-10-08'){const e={id:'x',projectId:'p',entity:'Test company',auditYear:'2025',finding:'Drain',createdBy:'creator',status:'Open',actions:[{...action,dueDate:due,status:'Open',responses:[]}]};return enrollNotifications(e,null,actor,options.now);}
test('empty drafts save, reload and edit; finalization requires finding and complete directory assignments',async()=>{
 process.env.AUDIT_DISABLE_SEED='1';
 let e=applyAuditWrite(actor,{id:'draft',status:'Draft',actions:[{}]},null,options);
 validateAuditAssignees(e,[],[],options);
 assert.equal(e.finding,undefined);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'audit-draft-'));
 try{e=(await createAuditEntry(path.join(dir,'context.json'),'p',e)).entry;assert.equal(e.status,'Draft');assert.equal(e.finding,'');}
 finally{await fs.rm(dir,{recursive:true,force:true});}
 const patch={...e,operation:'save-draft',baseUpdatedAt:e.updatedAt,status:'Open'};
 assert.throws(()=>applyAuditWrite(actor,patch,e,options),/Finding is required/);
 assert.throws(()=>applyAuditWrite(actor,{...patch,finding:'Drain'},e,options),/Each action requires/);
 const valid={...patch,finding:'Drain',actions:[action]};validateAuditAssignees(valid,directories.p);
 const final=applyAuditWrite(actor,valid,e,options);assert.equal(final.status,'Open');assert.equal(final.createdBy,'creator');
 assert.throws(()=>applyAuditWrite({...actor,userId:'other'},patch,e,options),/Only the draft creator/);
 assert.throws(()=>applyAuditWrite(actor,{...valid,baseUpdatedAt:'old'},e,options),e=>e.statusCode===409);
 assert.throws(()=>applyAuditWrite(actor,{id:e.id,operation:'reply'},e,options),/finalize/);
});
test('deadline is inclusive in configured timezone; server and mobile lock assignees with admin extension available',()=>{
 const e=open('2026-10-06'),respondent={...actor,userId:'owner',email:action.email};
 const patch={id:e.id,operation:'reply',actionId:'a',text:'Done',status:'Closed'};
 assert.equal(actionLocked(action,options),false);
 assert.equal(applyAuditWrite(respondent,patch,e,options).status,'Closed');
 const late={...options,now:new Date('2026-10-06T16:00:00Z')};
 assert.throws(()=>applyAuditWrite(respondent,patch,e,late),/locked/);
 assert.throws(()=>prepareMobileWrite(respondent,{operationId:'offline-overdue-12345',patch,base:{status:'Open'}},e,late),/locked/);
 assert.throws(()=>applyAuditWrite(respondent,{id:e.id,operation:'update-action',actionId:'a',action:{...action,dueDate:'2027-01-01'}},e,late),/administrator/);
 assert.equal(applyAuditWrite(admin,patch,e,late).status,'Closed');
 const extended=applyAuditWrite(admin,{id:e.id,operation:'update-action',actionId:'a',action:{...action,dueDate:'2027-01-01'}},e,late);
 assert.equal(applyAuditWrite(respondent,patch,extended,late).status,'Closed');
});
test('new assignments and exact reminder days use deduplicated recipients; draft, legacy and closed reminders are skipped',()=>{
 const e=open();
 let jobs=notificationJobs([e],directories,'',options.now);
 assert.equal(jobs.filter(j=>j.type==='assigned').length,1);assert.equal(jobs.filter(j=>j.type==='reminder').length,2);
 assert.equal(notificationJobs([e],directories,'',new Date('2026-10-08T02:00:00Z')).filter(j=>j.type==='due').length,2);
 assert.equal(notificationJobs([e],directories,'',new Date('2026-10-09T02:00:00Z')).length,0);
 assert.equal(notificationJobs([{...e,status:'Draft'}],directories,'',options.now).length,0);
 assert.equal(notificationJobs([{...e,actions:[action]}],directories,'',options.now).length,0);
 assert.equal(notificationJobs([{...e,status:'Closed'}],directories,'',options.now).filter(j=>j.type!=='assigned').length,0);
 const same=enrollNotifications(structuredClone(e),e,actor);assert.equal(same.actions[0].notificationRevision,e.actions[0].notificationRevision);
 const changed=structuredClone(e);changed.actions[0].dueDate='2026-10-10';enrollNotifications(changed,e,actor);assert.notEqual(changed.actions[0].notificationRevision,e.actions[0].notificationRevision);
 const stored=normalizeAuditEntry(e,'p');assert.equal(stored.creatorEmail,actor.email);assert.equal(stored.actions[0].notificationRevision,e.actions[0].notificationRevision);
});
test('notification delivery ledger survives restart, deduplicates and retries failures',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'audit-mail-'));let time=options.now,sent=[],fail=true;
 try{
 await fs.writeFile(path.join(dir,'audit-entries.json'),JSON.stringify([open()]));await fs.writeFile(path.join(dir,'audit-users.json'),JSON.stringify(directories));
 const send=async job=>{if(fail){fail=false;throw Error('offline');}sent.push(job.key);};
 const settings={send,enabled:()=>true,now:()=>time};let worker=notificationWorker(dir,settings);await worker.run();assert.equal(sent.length,2);
 worker=notificationWorker(dir,settings);await worker.run();assert.equal(sent.length,2);
 time=new Date(time.getTime()+16*60000);await worker.run();assert.equal(sent.length,3);assert.equal(new Set(sent).size,3);
 await worker.run();assert.equal(sent.length,3);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('captured coordinates select timezone with Nigeria fallback; finalized zone cannot be changed by replies', async()=>{
 const {locationTimeZone,entryTimeZone}=await import('../standalone-audit/timezone.mjs');
 assert.equal(locationTimeZone(null),'Africa/Lagos');assert.equal(locationTimeZone({latitude:5.92,longitude:8.33}),'Africa/Lagos');
 const malaysia=locationTimeZone({latitude:3.139,longitude:101.687});assert.equal(new Intl.DateTimeFormat('en-CA',{timeZone:malaysia,hour:'numeric',hourCycle:'h23'}).format(new Date('2026-10-06T00:00:00Z')),'08');
 const e=open();e.geo={latitude:3.139,longitude:101.687};enrollNotifications(e,null,actor);assert.equal(e.timeZone,malaysia);
 const later={...e,geo:null,timeZone:'America/New_York'};enrollNotifications(later,e,actor);assert.equal(later.timeZone,malaysia);
 assert.equal(actionLocked({...action,dueDate:'2026-10-06'},{timeZone:entryTimeZone(e),now:new Date('2026-10-06T16:00:00Z')}),true);
 assert.equal(actionLocked(action,{timeZone:'Africa/Lagos',now:new Date('2026-10-06T22:59:59Z')}),false);
 assert.equal(actionLocked(action,{timeZone:'Africa/Lagos',now:new Date('2026-10-06T23:00:00Z')}),true);
 assert.throws(()=>validateAuditAssignees({operation:'add-action',status:'Draft',action},[],[],options),/active responsible/);
});
