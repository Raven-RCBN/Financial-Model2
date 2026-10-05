import test from 'node:test';import assert from 'node:assert/strict';
import {reportListing,selectedCompany} from '../standalone-audit/report-data.mjs';
import {mergeSourceRecords} from '../standalone-audit/scripts/import-source-reports.mjs';
import {normalizeAuditEntry,auditSeedEntries2025} from '../audit/audit-store.mjs';
import {actionsFor,applyAuditWrite} from '../audit/audit-permissions.mjs';
const context={company:{name:'OBAN'},project:{settings:{auditCompanies:['OBAN','Other company']}}};
test('company filtering and summaries cover every matching record across pages',()=>{
 const entries=[...Array.from({length:8},(_,i)=>({id:String(i),entity:'OBAN',auditYear:'2025',department:'Mill',priority:'High',finding:'Observation',actions:[],status:'Open',sourceReport:{issue:i+1}})),{id:'other',entity:'Other company',auditYear:'2025',finding:'Other',actions:[]}];
 const result=reportListing(entries,context,new URLSearchParams({company:'OBAN',auditYear:'2025',pageSize:'5'}));assert.equal(result.total,8);assert.equal(result.items.length,5);assert.equal(result.summary.total,8);assert.equal(result.summary.high,8);assert.equal(result.yearCounts['2025'],8);
 assert.throws(()=>selectedCompany(context,'Unregistered'),/Select a company/);
});
test('import preserves field records and workflow history and is idempotent',()=>{
 const incoming={id:'source1',entity:'OBAN',finding:'Complete source finding',sourceReport:{year:'2025'},actions:[],status:'Open'};
 const action={id:'a',description:'Follow up',responses:[{id:'r',text:'In progress'}]};
 const existing=[{...incoming,actions:[action],status:'In progress',mobileOperations:[{id:'receipt'}]},{...auditSeedEntries2025[0],actions:[]},{id:'field',entity:'Other company',finding:'Retain field observation'}];
 const first=mergeSourceRecords(existing,[incoming]);assert.equal(first.archived.length,1);assert(first.entries.some(e=>e.id==='field'));assert.deepEqual(first.entries.find(e=>e.id==='source1').actions,[action]);
 const second=mergeSourceRecords(first.entries,[incoming]);assert.deepEqual(second.entries,first.entries);
 const changedSeed={...auditSeedEntries2025[0],finding:'User edited observation'};assert.equal(mergeSourceRecords([changedSeed],[incoming]).preserved,1);
});
test('issued narrative stays intact and does not create a fabricated assigned action',()=>{
 const entry=normalizeAuditEntry({id:'imported',sourceReport:{originalRecommendation:'Original recommendation',managementResponse:'Source response'},finding:'Issued finding',impact:'',recommendation:'',actions:[],capturedAt:''},'p');
 assert.equal(entry.impact,'');assert.equal(entry.capturedAt,'');assert.equal(entry.sourceReport.managementResponse,'Source response');assert.deepEqual(actionsFor(entry),[]);
 const changed=applyAuditWrite({userId:'admin',admin:true,recommend:true},{operation:'add-action',action:{description:'New follow-up',owner:'Owner',email:'owner@example.test',dueDate:'2026-12-31'}},entry);
 assert.equal(changed.actions.length,1);assert.deepEqual(changed.sourceReport,entry.sourceReport);
});
