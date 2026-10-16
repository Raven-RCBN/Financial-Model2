import test from 'node:test';import assert from 'node:assert/strict';
import {authorizeDraftDeletion} from '../audit/audit-permissions.mjs';
import {normalizeAuditEntry} from '../audit/audit-store.mjs';
import {prepareMobileWrite} from '../audit/mobile-sync.mjs';
const creator={userId:'creator',email:'creator@example.test',create:true,respond:true};
const draft={id:'draft',status:'Draft',createdBy:'creator',updatedAt:'2026-10-17T00:00:00Z'};
test('only creator or admin can delete an unchanged draft; finalized/source/stale/missing denied',()=>{
 assert.doesNotThrow(()=>authorizeDraftDeletion(creator,draft,draft.updatedAt));
 assert.doesNotThrow(()=>authorizeDraftDeletion({userId:'admin',admin:true},draft,draft.updatedAt));
 for(const actor of [{...creator,userId:'other'},{...creator,create:false}])assert.throws(()=>authorizeDraftDeletion(actor,draft,draft.updatedAt),{statusCode:403});
 for(const e of [{...draft,status:'Open'},{...draft,status:'Closed'},{...draft,sourceReport:{year:2025}}])assert.throws(()=>authorizeDraftDeletion({userId:'admin',admin:true},e,e.updatedAt),{statusCode:409});
 assert.throws(()=>authorizeDraftDeletion(creator,draft,'old'),{statusCode:409});
 assert.throws(()=>authorizeDraftDeletion(creator,null,draft.updatedAt),{statusCode:404});
});
test('normalization retains every observation photo including photos beyond 12',()=>{
 const photos=Array.from({length:25},(_,i)=>({url:'/audit/uploads/photo-'+i+'.jpg',name:'Photo '+i,description:'Caption '+i}));
 const e=normalizeAuditEntry({...draft,observationImages:photos});assert.equal(e.observationImages.length,25);assert.equal(e.observationImages[24].description,'Caption 24');
 assert.equal(normalizeAuditEntry(e).observationImages.length,25);
});
test('mobile replies to desktop findings with over 12 photos preserve all observation evidence',()=>{
 const photos=Array.from({length:16},(_,i)=>({url:'/audit/uploads/photo-'+i+'.jpg'}));
 const e={id:'finding',status:'Open',finding:'Finding',observationImages:photos,actions:[{id:'action',email:creator.email,status:'Open',responses:[]}]};
 const saved=prepareMobileWrite(creator,{operationId:'mobile-reply-many-photos',base:{status:'Open'},patch:{id:e.id,operation:'reply',actionId:'action',text:'Corrected',status:'Closed'}},e,{lockFinalized:true});
 assert.equal(saved.entry.observationImages.length,16);assert.equal(saved.entry.actions[0].responses.length,1);
});
