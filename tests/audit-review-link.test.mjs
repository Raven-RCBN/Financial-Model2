import test from 'node:test';
import assert from 'node:assert/strict';
import {safeAuditReturn,loginPage} from '../standalone-audit/login-page.mjs';
import {notificationContent} from '../standalone-audit/notifications.mjs';
import {indexedReportListing} from '../standalone-audit/query-store.mjs';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
test('review emails identify the item and recommendation; login retains only safe app destinations',()=>{
 const entry={id:'item&1',entity:'ORE Plantation',auditYear:'2026',status:'Open'};
 const mail=notificationContent(entry,[{id:'action/2',description:'Repair drain'}],'assigned','Africa/Lagos');
 const url=new URL(mail.text.match(/https:\/\/audit\.agrinexus\.ai\/app\?\S+/)[0]);
 assert.equal(url.searchParams.get('item'),entry.id);assert.equal(url.searchParams.get('action'),'action/2');assert.equal(url.searchParams.get('company'),entry.entity);
 assert.equal(safeAuditReturn(url.pathname+url.search),url.pathname+url.search);
 assert(loginPage('invalid',url.pathname+url.search).includes('name="next"'));
 for(const bad of ['//evil.test/app','https://evil.test/app','/logout','javascript:alert(1)'])assert.equal(safeAuditReturn(bad),'/app');
});
test('exact item filter excludes other records and cannot cross company boundaries',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'audit-link-'));
 try{
  await fs.writeFile(path.join(dir,'audit-entries.json'),JSON.stringify([{projectId:'p',entity:'ORE',id:'one',auditYear:'2026'},{projectId:'p',entity:'ORE',id:'two',auditYear:'2026'},{projectId:'p',entity:'OBAN',id:'three',auditYear:'2026'}]));
  const context={project:{id:'p'},company:{name:'ORE'}};
  const result=await indexedReportListing(dir,context,new URLSearchParams({company:'ORE',auditYear:'2026',entryId:'two'}));
  assert.deepEqual(result.items.map(e=>e.id),['two']);assert.equal(result.total,1);
  const denied=await indexedReportListing(dir,context,new URLSearchParams({company:'ORE',entryId:'three'}));assert.equal(denied.total,0);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
