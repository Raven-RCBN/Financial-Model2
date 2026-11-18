import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {assignedIssueScope,canViewIssue} from '../standalone-audit/issue-access.mjs';

test('assigned visibility covers owners and recommendations, excludes drafts and empty emails',()=>{
 const actor={email:' A@example.test '};
 assert(canViewIssue(actor,{ownerEmail:'a@example.test'}));
 assert(canViewIssue(actor,{owner2Email:'A@example.test'}));
 assert(canViewIssue(actor,{actions:[{email:'a@example.test'}]}));
 assert(!canViewIssue(actor,{ownerEmail:'a@example.test',status:'Draft'}));
 assert(!canViewIssue({email:''},{actions:[{email:''}]}));
 for(const role of ['admin','create','recommend'])assert.equal(assignedIssueScope({[role]:true}),null);
});

test('HTTP lists, cards, years, exact links, evidence, mobile and PDF payload enforce assignment',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'audit-assigned-'));
 const secret='synthetic-assignment-test-secret-only';
 const actor=name=>({name,email:name+'@example.test',status:'Active',credential:{salt:name},auditPermissions:{respond:true,...(name==='author'?{create:true}:{})}});
 const context={company:{name:'OBAN'},project:{id:'p',settings:{auditCompanies:['OBAN','Other'],auditSourceReports:{2024:{companyName:'OBAN',sha256:'synthetic'}}}}};
 const row=(id,email,extra={})=>({id,projectId:'p',entity:'OBAN',auditYear:'2024',status:'Open',department:id,priority:'High',finding:id,actions:[{id:'action',email,status:'Open'}],...extra});
 const rows=[row('alice-only','alice@example.test',{photoUrl:'/audit/uploads/p/alice.jpg',sourceReport:{issue:1,pages:[1]}}),row('bob-only','bob@example.test',{auditYear:'2025',photoUrl:'/audit/uploads/p/bob.jpg'}),row('owner-only','',{owner2Email:'alice@example.test'}),row('draft','alice@example.test',{status:'Draft'}),row('other-company','alice@example.test',{entity:'Other'})];
 await Promise.all(Object.entries({'audit-context.json':context,'audit-users.json':{p:['alice','bob','author'].map(actor)},'admin-user.json':{name:'admin',credential:{salt:'admin'}},'audit-entries.json':rows}).map(([file,data])=>fs.writeFile(path.join(dir,file),JSON.stringify(data))));
 await fs.mkdir(path.join(dir,'uploads/p'),{recursive:true});
 await fs.writeFile(path.join(dir,'uploads/p/alice.jpg'),'alice evidence');await fs.writeFile(path.join(dir,'uploads/p/bob.jpg'),'bob evidence');
 // Capture the exact renderer input; query workers still execute the real SQLite implementation.
 const python=path.join(dir,'python');await fs.writeFile(python,'#!/bin/sh\ncase "$1" in\n*query_index.py) exec python3 "$@";;\n*) exec python3 -c \'import sys,json; print(json.dumps(json.load(sys.stdin)))\';;\nesac\n');await fs.chmod(python,0o700);
 const port=43000+Math.floor(Math.random()*10000),base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['standalone-audit/server.mjs'],{cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,AUDIT_DATA_DIR:dir,AUDIT_SESSION_SECRET:secret,PYTHON:python,PORT:String(port)}});
 try{
 await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('fixture exited');})]);
 const request=(name,url,body)=>{const payload=Buffer.from(JSON.stringify({userId:name,authVersion:name,expiresAt:Date.now()+60000})).toString('base64url');const sig=crypto.createHmac('sha256',secret).update(payload).digest('base64url');return fetch(base+url,{method:body?'POST':'GET',headers:{cookie:'audit_session='+payload+'.'+sig,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});};
 const api='/api/projects/p/';
 const listing=async(name,query='')=>(await request(name,api+'audit-entries?company=OBAN&'+query)).json();
 const alice=await listing('alice');assert.equal(alice.total,2);assert.equal(alice.summary.total,2);assert.equal(alice.summary.high,2);assert.equal(alice.summary.departments.length,2);assert.deepEqual(alice.yearCounts,{'2024':2});
 assert.equal((await listing('bob')).total,1);assert.equal((await listing('alice')).total,2); // cached queries never cross users
 assert.equal((await listing('alice','entryId=bob-only')).total,0);
 assert.equal((await listing('alice','q=bob')).total,0);
 assert.equal((await listing('author')).total,4);assert.equal((await listing('admin')).total,4);
 assert.equal((await request('alice','/audit/uploads/p/alice.jpg')).status,200);
 assert.equal((await request('alice','/audit/uploads/p/bob.jpg')).status,403);
 assert.equal((await request('alice',api+'audit-source-report?company=OBAN&auditYear=2024')).status,403);
 const pdf=await request('alice',api+'audit-pdf',{auditYear:'2024',company:'OBAN'});assert.equal(pdf.status,200);const payload=await pdf.json();assert.deepEqual(payload.entries.map(e=>e.id).sort(),['alice-only','owner-only']);assert.equal(payload.sourceReport,null);assert.equal(payload.sourceDirectory,null);
 assert.equal((await request('alice',api+'audit-pdf',{auditYear:'2025',company:'OBAN'})).status,400);
 const proof={name:'completed-fix.png',description:'Fixed drain; water now flows freely.',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='};
 const saved=await request('alice',api+'audit-entries',{id:'alice-only',operation:'reply',actionId:'action',text:'Fixed issue with photo evidence',status:'Open',images:[proof]});assert.equal(saved.status,201);
 const refreshed=await listing('alice');const reply=refreshed.items.find(e=>e.id==='alice-only').actions[0].responses.at(-1);assert.equal(reply.text,'Fixed issue with photo evidence');assert.equal(reply.images.length,1);assert.equal(reply.images[0].description,proof.description);assert(reply.images[0].url.startsWith('/audit/uploads/p/'));assert(!reply.images[0].dataUrl);
 assert.equal((await request('alice',reply.images[0].url)).status,200);assert.equal((await request('bob',reply.images[0].url)).status,403);
 const withProof=await(await request('alice',api+'audit-pdf',{auditYear:'2024',company:'OBAN'})).json();assert.equal(withProof.entries.find(e=>e.id==='alice-only').actions[0].responses.at(-1).images[0].url,reply.images[0].url);assert.equal(withProof.entries.find(e=>e.id==='alice-only').actions[0].responses.at(-1).images[0].description,proof.description);
 for(const endpoint of ['audit-entries','audit-sync'])assert.equal((await request('alice',api+endpoint,endpoint==='audit-sync'?{patch:{id:'bob-only'}}:{id:'bob-only',operation:'reply'})).status,403);
 }finally{if(child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}await fs.rm(dir,{recursive:true,force:true});}
});
