import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {enrollNotifications,notificationJobs,notificationWorker} from '../standalone-audit/notifications.mjs';
const actor={userId:'creator',email:'creator@example.test'};
const users={p:[{name:'creator',email:actor.email,status:'Active'},{name:'owner',email:'owner@example.test',status:'Active',companyScope:'selected',companies:['JB FARMS ORE Plantation']}]};
const now=new Date('2026-10-18T08:00:00Z');
function entry(){return enrollNotifications({id:'item',projectId:'p',entity:'JB FARMS ORE Plantation',auditYear:'2025',department:'Mill',area:'Safety',location:'Access road',priority:'High',createdBy:'creator',finding:'Repair <drain>\nSecond paragraph',findingStyles:[{start:0,end:6,bold:true}],impact:'Access restricted',status:'Open',actions:[{id:'a',description:'Clear channel\nUpload evidence',descriptionStyles:[{start:0,end:5,underline:true}],owner:'owner',email:'owner@example.test',dueDate:'2026-10-20',status:'Open'}]},null,actor,now);}
test('all alert types use the record company, full text, recommendation, assignee and deadline; HTML is escaped',()=>{
 const e=entry();const jobs=notificationJobs([e],users,'',now);
 assert.equal(jobs.filter(j=>j.type==='assigned').length,1);
 assert.equal(jobs.filter(j=>j.type==='reminder').length,2);
 for(const job of jobs){
  assert.match(job.subject,/JB FARMS ORE Plantation.*2025/);
  for(const content of [e.entity,e.finding,e.impact,e.actions[0].description,'2026-10-20 (Africa/Lagos)','Department: Mill','Responsible email: owner@example.test'])assert(job.text.includes(content));
  assert(job.html.includes('<b>Repair</b>'));assert(job.html.includes('&lt;drain&gt;'));assert(!job.html.includes('<drain>'));assert(job.html.includes('<u>Clear</u>'));
 }
 for(const type of ['reopened','refinalized']){
  const changed={...e,status:type==='reopened'?'Draft':'Open',lifecycleNotice:{type,revision:type,at:e.actions[0].assignedAt,assignees:[{name:'owner',email:'owner@example.test'}]}};
  const lifecycle=notificationJobs([changed],users,'',now).filter(j=>j.type===type);
  assert.equal(lifecycle.length,2);assert(lifecycle.every(j=>j.text.includes(e.actions[0].description)&&j.text.includes('2026-10-20')));
 }
 assert.equal(notificationJobs([{...e,entity:'Other company'}],users,'',now).length,0);
});
test('reminders occur two days before and on due day in entry timezone, not one day before or after closing',()=>{
 const e=entry();
 assert.equal(notificationJobs([e],users,'',new Date('2026-10-19T12:00:00Z')).filter(j=>j.type==='reminder').length,0);
 assert.equal(notificationJobs([e],users,'',new Date('2026-10-19T23:00:00Z')).filter(j=>j.type==='due').length,2);
 assert.equal(notificationJobs([e],users,'',new Date('2026-10-20T23:00:00Z')).length,0);
 assert.equal(notificationJobs([{...e,status:'Draft'}],users,'',now).length,0);
 assert.equal(notificationJobs([{...e,status:'Closed'}],users,'',now).length,0);
});
test('worker uses freshly reread content and preserves sent ledger keys across template updates',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'audit-email-content-'));const sent=[];const e=entry();
 try {
  await fs.writeFile(path.join(dir,'audit-entries.json'),JSON.stringify([e]));await fs.writeFile(path.join(dir,'audit-users.json'),JSON.stringify(users));
  const settings={enabled:()=>true,now:()=>now,send:async job=>{sent.push(job);if(sent.length===1){e.finding='Updated current finding';await fs.writeFile(path.join(dir,'audit-entries.json'),JSON.stringify([e]));}}};
  await notificationWorker(dir,settings).run();assert.equal(sent.length,3);assert(sent[1].text.includes('Updated current finding'));assert(sent[2].text.includes('Updated current finding'));
  await notificationWorker(dir,settings).run();assert.equal(sent.length,3);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
