import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAuditWrite} from '../audit/audit-permissions.mjs';
import {prepareMobileWrite,findingFields} from '../audit/mobile-sync.mjs';
import {workflowOptions} from '../standalone-audit/notifications.mjs';
const creator={userId:'creator',email:'creator@example.test',create:true,recommend:true,respond:true};
const owner={...creator,userId:'owner',email:'owner@example.test'};
const admin={...creator,userId:'admin',admin:true};
const options={...workflowOptions,now:new Date('2026-10-13T00:00:00Z')};
const action={id:'action',description:'Improve drainage',owner:'owner',email:owner.email,dueDate:'2099-01-01',responses:[{text:'Spoofed before finalization'}]};
const makeDraft=()=>applyAuditWrite(creator,{id:'finding',status:'Draft',finding:'Blocked drain',actions:[action]},null,options);
const finalize=d=>applyAuditWrite(creator,{id:d.id,operation:'save-draft',status:'Open',baseUpdatedAt:d.updatedAt},d,options);
test('corrective actions cannot be submitted in draft; finalization preserves recommendation and clears injected replies',()=>{
 const d=makeDraft();assert.deepEqual(d.actions[0].responses,[]);
 assert.throws(()=>applyAuditWrite(owner,{operation:'reply',actionId:d.actions[0].id,text:'Done',status:'Closed'},d,options),{statusCode:403});
 const e=finalize(d);assert.equal(e.status,'Open');assert.equal(e.actions[0].description,action.description);
});
test('finalized item locks creator and multirole assignee on web and mobile, but permits assigned corrective action',()=>{
 const e=finalize(makeDraft());const id=e.actions[0].id;
 for(const who of [creator,owner])for(const patch of [{operation:'update-action',actionId:id,action},{operation:'add-action',action},{operation:'save-draft',status:'Draft'}])assert.throws(()=>applyAuditWrite(who,{id:e.id,...patch},e,options),{statusCode:403});
 const patch={id:e.id,operation:'reply',actionId:id,text:'Drain cleared',status:'Closed'};
 assert.throws(()=>applyAuditWrite(creator,patch,e,options),{statusCode:403});
 const result=applyAuditWrite(owner,patch,e,options);assert.equal(result.actions[0].responses[0].text,'Drain cleared');assert.equal(result.finding,e.finding);assert.equal(result.actions[0].description,action.description);
 const base=Object.fromEntries(findingFields.map(k=>[k,String(e[k]||'')]));
 assert.throws(()=>prepareMobileWrite(owner,{operationId:'locked-mobile-edit-123',base,patch:{id:e.id,operation:'update-finding',...base,finding:'Changed'}},e,options),{statusCode:403});
 const op={operationId:'assigned-mobile-reply-123',base:{status:'Open',responseDueDate:''},patch};const mobile=prepareMobileWrite(owner,op,e,options);assert.equal(mobile.entry.actions[0].responses.length,1);assert.equal(prepareMobileWrite(owner,op,mobile.entry,options).duplicate,true);
 assert.equal(applyAuditWrite(admin,{id:e.id,operation:'update-action',actionId:id,action:{...action,description:'Admin correction'}},e,options).actions[0].description,'Admin correction');
});
