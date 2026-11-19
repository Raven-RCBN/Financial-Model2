import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {prepareResponse,writeResponseDraft,loadResponseDraft} from '../standalone-audit/response-drafts.mjs';
const actor={userId:'alice',email:'alice@example.test',respond:true};
const entry={id:'e',projectId:'p',status:'Open',updatedAt:'revision-1',actions:[{id:'a',email:actor.email,status:'Open',dueDate:'2026-11-19',responses:[{id:'r',author:'alice',email:actor.email,createdAt:'2026-11-18T00:00:00Z',text:'Previously saved',images:[{url:'/audit/uploads/p/fix.jpg',description:'Old label'}]}]}]};
const options={drafts:true,lockFinalized:true,timeZone:'Asia/Kuala_Lumpur',now:new Date('2026-11-19T15:59:59Z')};
const patch={operation:'save-reply-draft',baseUpdatedAt:entry.updatedAt,actionId:'a',replyId:'r',text:'New text',images:[{url:'/audit/uploads/p/fix.jpg',description:'New label'}]};
test('response drafts persist independently and can be revised, then replace an existing reply',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'audit-reply-draft-'));
 try{
 const {draft}=prepareResponse(actor,patch,entry,null,options);assert.equal(entry.actions[0].responses[0].text,'Previously saved');
 await writeResponseDraft(dir,'p','e','a',actor.userId,draft);
 const stored=await loadResponseDraft(dir,'p','e','a',actor.userId);assert.deepEqual(stored,draft);assert.equal(await loadResponseDraft(dir,'p','e','a','bob'),null);
 assert.throws(()=>prepareResponse(actor,patch,entry,stored,options),{statusCode:409});
 const saved=prepareResponse(actor,{...patch,draftVersion:stored.version,text:'Final repair'},entry,stored,options).draft;
 const submitted=prepareResponse(actor,{...patch,operation:'submit-reply',draftVersion:saved.version,text:saved.text},entry,saved,options).entry;
 assert.equal(submitted.actions[0].responses.length,1);const reply=submitted.actions[0].responses[0];assert.equal(reply.id,'r');assert.equal(reply.createdAt,entry.actions[0].responses[0].createdAt);assert.equal(reply.text,'Final repair');assert.equal(reply.images[0].description,'New label');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('deadline is inclusive in entry timezone, with assignment, ownership and stale edit checks',()=>{
 assert(prepareResponse(actor,patch,entry,null,options).draft);
 assert.throws(()=>prepareResponse(actor,patch,entry,null,{...options,now:new Date('2026-11-19T16:00:00Z')}),{statusCode:403});
 assert.throws(()=>prepareResponse({...actor,email:'bob@example.test'},patch,entry,null,options),{statusCode:403});
 assert.throws(()=>prepareResponse({...actor,userId:'bob'},patch,entry,null,options),{statusCode:403});
 assert.throws(()=>prepareResponse(actor,{...patch,baseUpdatedAt:'old'},entry,null,options),{statusCode:409});
 assert.throws(()=>prepareResponse(actor,{...patch,images:[{url:'/audit/uploads/p/other.jpg'}]},entry,null,options),{statusCode:403});
 assert.throws(()=>prepareResponse(actor,{...patch,images:Array(9).fill({})},entry,null,options),{statusCode:400});
 assert(prepareResponse(actor,{...patch,text:''},entry,null,options).draft);
 assert.throws(()=>prepareResponse(actor,{...patch,operation:'submit-reply',text:''},entry,null,options),{statusCode:400});
});

test('save and submit accept response/photo changes through due-date end, then reject every change',()=>{
 const image={name:'replacement.png',description:'Fixed drain',dataUrl:'data:image/png;base64,iVBORw0KGgo='};
 for(const timeZone of ['Asia/Kuala_Lumpur','Africa/Lagos']){
  const boundary=timeZone==='Asia/Kuala_Lumpur'?'2026-11-19T16:00:00Z':'2026-11-19T23:00:00Z';
  const lastMoment=new Date(Date.parse(boundary)-1),after=new Date(boundary);
  for(const operation of ['save-reply-draft','submit-reply']){
   for(const images of [[],[image],[{url:'/audit/uploads/p/fix.jpg',description:'Revised label'}]]){
    const change={...patch,operation,text:'Edited response',images};
    const result=prepareResponse(actor,change,entry,null,{...options,timeZone,now:lastMoment});
    assert(result.draft||result.entry);
    assert.throws(()=>prepareResponse(actor,change,entry,null,{...options,timeZone,now:after}),{statusCode:403});
   }
  }
 }
 assert.equal(entry.actions[0].responses[0].text,'Previously saved');
 assert.equal(entry.actions[0].responses[0].images[0].description,'Old label');
});
