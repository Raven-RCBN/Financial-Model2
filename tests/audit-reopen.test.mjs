import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {applyAuditWrite} from '../audit/audit-permissions.mjs';
import {normalizeAuditEntry} from '../audit/audit-store.mjs';
import {enrollNotifications,notificationJobs,notificationWorker} from '../standalone-audit/notifications.mjs';
const creator={userId:'creator',email:'creator@example.test',create:true,recommend:true};
const admin={...creator,userId:'admin',admin:true};
const owner={userId:'owner',email:'owner@example.test',respond:true};
const options={drafts:true,lockFinalized:true,now:new Date('2026-10-17T02:00:00Z')};
const entry={id:'test',projectId:'p',status:'Closed',entity:'Training',createdBy:'creator',creatorEmail:creator.email,updatedAt:'2026-10-16T00:00:00Z',finding:'Synthetic finding',observationImages:[{url:'/photo.png'}],actions:[{id:'a',description:'Recommendation',owner:'owner',email:owner.email,dueDate:'2026-11-01',status:'Closed',responses:[{id:'reply',text:'Completed earlier',author:'owner',createdAt:'2026-10-16T00:00:00Z',images:[{url:'/audit/uploads/test.png'}]}]}]};
const directories={p:[{name:'creator',email:creator.email,status:'Active'},{name:'owner',email:owner.email,status:'Active'}]};
const reopen=(existing=entry)=>applyAuditWrite(admin,{operation:'reopen-draft',baseUpdatedAt:existing.updatedAt},existing,options);
function enrolled(existing=entry){return normalizeAuditEntry(enrollNotifications(reopen(existing),existing,admin,options.now),'p');}
test('admin-only reopen checks source and concurrency, keeps original creator and evidence',()=>{
 for(const who of [creator,owner])assert.throws(()=>applyAuditWrite(who,{operation:'reopen-draft',baseUpdatedAt:entry.updatedAt},entry,options),e=>e.statusCode===403);
 assert.throws(()=>reopen({...entry,sourceReport:{issue:1}}),/Imported/);
 assert.throws(()=>reopen({...entry,status:'Draft'}),/already/);
 assert.throws(()=>applyAuditWrite(admin,{operation:'reopen-draft',baseUpdatedAt:'stale'},entry,options),e=>e.statusCode===409);
 const draft=enrolled();assert.equal(draft.status,'Draft');assert.equal(draft.createdBy,'creator');assert.equal(draft.actions[0].responses[0].text,'Completed earlier');assert.equal(draft.observationImages.length,1);
 assert.throws(()=>applyAuditWrite(owner,{operation:'reply',actionId:'a',text:'Changed',status:'Closed'},draft,options),/draft creator/);
 const edited=applyAuditWrite(creator,{operation:'save-draft',baseUpdatedAt:draft.updatedAt,status:'Open',finding:'Updated',actions:draft.actions.map(a=>({...a,responses:[]}))},draft,options);
 assert.equal(edited.actions[0].responses.length,1);assert.equal(edited.actions[0].responses[0].images.length,1);
 assert.throws(()=>applyAuditWrite(creator,{operation:'save-draft',baseUpdatedAt:draft.updatedAt,actions:[]},draft,options),/history cannot/);
});
test('reopening and refinalizing email both parties, preserve ledger keys on edits, and reject injected notices',()=>{
 const draft=enrolled();const jobs=notificationJobs([draft],directories,'',options.now);
 assert.equal(jobs.length,2);assert.deepEqual(new Set(jobs.map(j=>j.to)),new Set([creator.email,owner.email]));assert(jobs.every(j=>j.type==='reopened'));
 const edit=enrollNotifications(applyAuditWrite(creator,{operation:'save-draft',baseUpdatedAt:draft.updatedAt,finding:'Changed'},draft,options),draft,creator,options.now);
 assert.deepEqual(notificationJobs([edit],directories,'',options.now).map(j=>j.key),jobs.map(j=>j.key));
 const final=enrollNotifications(applyAuditWrite(creator,{operation:'save-draft',baseUpdatedAt:edit.updatedAt,status:'Open'},edit,options),edit,creator,options.now);
 const finalJobs=notificationJobs([final],directories,'',options.now);assert.equal(finalJobs.length,2);assert(finalJobs.every(j=>j.type==='refinalized'));assert.notEqual(finalJobs[0].key,jobs[0].key);
 const reassign=structuredClone(final);reassign.actions[0].description='Updated recommendation';enrollNotifications(reassign,final,admin,new Date('2026-10-18T00:00:00Z'));assert.equal(notificationJobs([reassign],directories,'',options.now).filter(j=>j.type==='assigned').length,1);
 const injected=enrollNotifications({...entry,reopenedAt:'fake',lifecycleNotice:draft.lifecycleNotice},null,creator);assert.equal(injected.lifecycleNotice,null);assert.equal(injected.reopenedAt,'');
});
test('reopen emails retry once and remain deduplicated after worker restart',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'audit-reopen-mail-'));let time=options.now,fail=true;const sent=[];
 try{
 await fs.writeFile(path.join(dir,'audit-entries.json'),JSON.stringify([enrolled()]));await fs.writeFile(path.join(dir,'audit-users.json'),JSON.stringify(directories));
 const settings={enabled:()=>true,now:()=>time,send:async job=>{if(fail){fail=false;throw Error('Offline');}sent.push(job);}};
 await notificationWorker(dir,settings).run();assert.equal(sent.length,1);
 time=new Date(time.getTime()+16*60000);await notificationWorker(dir,settings).run();assert.equal(sent.length,2);
 await notificationWorker(dir,settings).run();assert.equal(sent.length,2);assert.equal(new Set(sent.map(j=>j.key)).size,2);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
