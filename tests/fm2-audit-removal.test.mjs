import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import {hashAuditPassword} from '../audit/audit-permissions.mjs';
const source=process.env.AUDIT_CUTOVER_TEST_DB;
test('FM2 retires Audit runtime and login while preserving legacy data and finance',{skip:!source},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'fm2-removal-'));await fs.copyFile(source,path.join(dir,'db.json'));
 const users=JSON.stringify({project_opsl_15000ha_development:[{id:'test-owner',name:'audit-owner',email:'owner@example.test',status:'Active',credential:hashAuditPassword('Synthetic-Audit-2026'),auditPermissions:{create:true,recommend:true,respond:true}}]});
 await fs.writeFile(path.join(dir,'audit-users.json'),users);await fs.writeFile(path.join(dir,'audit-entries.json'),'[]');
 const base='http://127.0.0.1:43192',target='https://audit.digitalpalm.ai';
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'43192',FM2_DB_PATH:path.join(dir,'db.json'),FM2_ADMIN_PASSWORD:'Synthetic-Admin-2026',FM2_AUDIT_FREEZE:'0',FM2_AUDIT_EXTERNAL_URL:target},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(String(d).includes('running at'))resolve()});child.on('exit',c=>reject(new Error('exit '+c)));setTimeout(()=>reject(new Error('startup timeout')),10000).unref()});
  const login=await fetch(base+'/login',{method:'POST',body:new URLSearchParams({userid:'admin',password:'Synthetic-Admin-2026'}),redirect:'manual'});assert.equal(login.status,303);const headers={Cookie:login.headers.get('set-cookie').split(';')[0]};
  const oldLogin=await fetch(base+'/login',{method:'POST',body:new URLSearchParams({userid:'audit-owner',password:'Synthetic-Audit-2026'}),redirect:'manual'});assert.equal(oldLogin.status,401);
  for(const route of ['/api/projects','/api/projects/project_opsl_15000ha_development/inputs','/api/projects/project_opsl_15000ha_development/reports'])assert.equal((await fetch(base+route,{headers})).status,200);
  for(const endpoint of ['audit-access','audit-context','audit-entries','audit-seed','audit-sync','audit-pdf'])for(const method of ['GET','POST','PUT'])assert.equal((await fetch(base+'/api/projects/project_opsl_15000ha_development/'+endpoint,{headers,method})).status,410);
  for(const [route,destination]of [['/audit','/app'],['/audit.html','/app'],['/mobile-app/index.html','/mobile-app/index.html']]){const r=await fetch(base+route,{redirect:'manual'});assert.equal(r.status,307);assert.equal(r.headers.get('location'),target+destination);}
  for(const file of ['/audit/evidence/oban-2025-accounts.jpg','/audit/audit-store.mjs','/mobile/web/app.js','/standalone-audit/server.mjs','/data/audit-users.json','/data/audit-entries.json','/public/fm/audit.html'])assert.equal((await fetch(base+file,{headers})).status,404,file);
  // FM2 must remain independent even if a retained legacy directory is unreadable/corrupt.
  await fs.writeFile(path.join(dir,'audit-users.json'),'retained legacy data is not parsed');assert.equal((await fetch(base+'/api/projects',{headers})).status,200);
  assert.equal(await fs.readFile(path.join(dir,'audit-users.json'),'utf8'),'retained legacy data is not parsed');assert.equal(await fs.readFile(path.join(dir,'audit-entries.json'),'utf8'),'[]');
 }finally{child.kill();await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));await fs.rm(dir,{recursive:true,force:true})}
});
