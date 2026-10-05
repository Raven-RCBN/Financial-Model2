import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {indexedReportListing,runQueryWorker,allStandaloneEntries} from '../standalone-audit/query-store.mjs';
test('large indexed queries paginate, aggregate, isolate companies and invalidate after writes',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'audit-index-test-'));
 try{
 const context={company:{name:'OBAN'},project:{id:'p',settings:{auditCompanies:['OBAN','Second']}}};
 const rows=Array.from({length:12020},(_,i)=>({id:'r'+String(i).padStart(5,'0'),projectId:'p',entity:i<12000?'OBAN':'Second',auditYear:'2025',department:i%2?'Mill':'Fleet',priority:i%2?'High':'Low',status:i%3?'Open':'Closed',finding:i===11999?'Last unique record':'Observation '+i,capturedAt:'2025-01-01',actions:i%2?[{status:'Open'}]:[]}));
 const file=path.join(dir,'audit-entries.json');await fs.writeFile(file,JSON.stringify(rows));
 const params=new URLSearchParams({company:'OBAN',auditYear:'2025',pageSize:'5',page:'2400'});
 const started=performance.now(),result=await indexedReportListing(dir,context,params);
 assert.equal(result.total,12000);assert.equal(result.items.length,5);assert.equal(result.items.at(-1).id,'r11999');assert.equal(result.summary.high,6000);assert.equal(result.summary.openActions,6000);assert.equal(result.summary.departments.reduce((n,[,d])=>n+d.total,0),12000);
 const warmStart=performance.now();assert.strictEqual(await indexedReportListing(dir,context,params),result);const warm=performance.now()-warmStart;
 const query={auditYear:'2025',department:'Mill',pageSize:'5000'};const plan=await runQueryWorker({dataDir:dir,projectId:'p',fallbackCompany:'OBAN',company:'OBAN',query,explain:true});assert.equal(plan.pageSize,100);assert.equal(plan.total,6000);assert(plan.queryPlan.some(r=>r.join(' ').includes('company_year_department')));
 const found=await indexedReportListing(dir,context,new URLSearchParams({company:'OBAN',q:'Last unique'}));assert.equal(found.total,1);
 const other=await indexedReportListing(dir,context,new URLSearchParams({company:'Second'}));assert.equal(other.total,20);assert(other.items.every(e=>e.entity==='Second'));
 assert.equal((await allStandaloneEntries(path.join(dir,'audit-context.json'),'p')).length,12020);
 rows.push({...rows[0],id:'new',entity:'OBAN'});await fs.writeFile(file+'.tmp',JSON.stringify(rows));await fs.rename(file+'.tmp',file);
 const [a,b]=await Promise.all([indexedReportListing(dir,context,params),indexedReportListing(dir,context,new URLSearchParams({company:'OBAN',status:'Closed'}))]);assert.equal(a.total,12001);assert.equal(b.total,4001);
 await assert.rejects(indexedReportListing(dir,context,new URLSearchParams({company:'Unknown'})),/Select a company/);
 console.log(JSON.stringify({records:rows.length,coldAndChecksMs:Math.round(performance.now()-started),cachedQueryMs:Math.round(warm*100)/100,indexUsed:'company_year_department'}));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
