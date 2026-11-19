// Synthetic localhost fixture only. Never reads production records or credentials.
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {once} from 'node:events';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'audit-draft-browser-')),projectId='project_opsl_15000ha_development',secret='synthetic-browser-secret-do-not-use-live';
const year=String(new Date().getFullYear()),company='Synthetic estate';
const entry={id:'test-issue',projectId,entity:company,auditYear:year,department:'Maintenance',area:'Drain',finding:'Blocked drain',impact:'Flooding',status:'Open',updatedAt:'fixture-revision',actions:[{id:'a',description:'Clear the drain',owner:'alice',email:'alice@example.test',dueDate:'2099-12-31',status:'Open',responses:[]}]};
const files={'audit-context.json':{company:{name:company},project:{id:projectId,name:'Synthetic audit',settings:{auditCompanies:[company],auditSetup:{years:[year],departments:['Maintenance'],areas:['Drain']}}}},'audit-users.json':{[projectId]:[{name:'alice',email:'alice@example.test',status:'Active',credential:{salt:'fixture'},auditPermissions:{respond:true}}]},'admin-user.json':{name:'admin',credential:{salt:'admin'}},'audit-entries.json':[entry]};
await Promise.all(Object.entries(files).map(([name,value])=>fs.writeFile(path.join(dir,name),JSON.stringify(value))));
const port=43000+Math.floor(Math.random()*10000),base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['standalone-audit/server.mjs'],{cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,PORT:String(port),AUDIT_DATA_DIR:dir,AUDIT_SESSION_SECRET:secret}});
let browser;
try{
 await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('fixture exited');})]);
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext();const payload=Buffer.from(JSON.stringify({userId:'alice',authVersion:'fixture',expiresAt:Date.now()+600000})).toString('base64url');await context.addCookies([{name:'audit_session',value:payload+'.'+crypto.createHmac('sha256',secret).update(payload).digest('base64url'),url:base}]);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/app');const editor=()=>page.getByRole('textbox',{name:'Corrective action taken',exact:true});await editor().fill('Drain partly cleared');
 const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 await page.locator('[data-reply-files]').setInputFiles({name:'fix.png',mimeType:'image/png',buffer:photo});await page.locator('[data-reply-photo-description]').fill('Drain before final clearing');
 const save=async name=>{const response=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/audit-entries'));await page.getByRole('button',{name,exact:true}).click();assert((await response).ok());await page.getByRole('button',{name,exact:true}).waitFor({state:'visible'});};
 await save('Save draft');await page.reload();assert.equal(await editor().innerText(),'Drain partly cleared');assert.equal(await page.locator('[data-reply-photo-description]').inputValue(),'Drain before final clearing');assert.equal(await page.locator('.audit-action-reply').count(),0);
 await editor().fill('Drain completely cleared');await save('Submit response');await page.locator('.audit-action-reply').waitFor();assert((await page.locator('.audit-action-reply').innerText()).includes('Drain completely cleared'));
 await page.getByRole('button',{name:'Edit response',exact:true}).click();assert.equal(await editor().innerText(),'Drain completely cleared');await editor().fill('Drain cleared and tested');await page.locator('[data-reply-photo-description]').fill('Water flowing freely');await save('Save draft');await page.reload();assert.equal(await editor().innerText(),'Drain cleared and tested');assert.equal(await page.locator('[data-reply-photo-description]').inputValue(),'Water flowing freely');
 await save('Submit response');await page.waitForFunction(()=>document.querySelector('.audit-action-reply')?.textContent.includes('Drain cleared and tested'));assert.equal(await page.locator('.audit-action-reply').count(),1);assert((await page.locator('.audit-action-reply').innerText()).includes('Water flowing freely'));assert.deepEqual(errors,[]);
 // Replace the original photo with two new photos, then reopen the saved draft.
 await page.getByRole('button',{name:'Edit response',exact:true}).click();
 await page.getByRole('button',{name:'Remove photo',exact:true}).click();
 await page.locator('[data-reply-files]').setInputFiles([{name:'after-fix.png',mimeType:'image/png',buffer:photo},{name:'tested-fix.png',mimeType:'image/png',buffer:photo}]);
 await page.locator('[data-reply-photo-description="0"]').fill('Replacement photo');await page.locator('[data-reply-photo-description="1"]').fill('Second fix photo');
 await save('Save draft');await page.reload();assert.equal(await page.locator('[data-reply-photo-description]').count(),2);assert.equal(await page.locator('[data-reply-photo-description="1"]').inputValue(),'Second fix photo');
 await save('Submit response');await page.waitForFunction(()=>document.querySelector('.audit-action-reply')?.textContent.includes('Second fix photo'));assert.equal(await page.locator('.audit-action-reply').count(),1);
 // Expire only this isolated fixture and verify UI plus direct API enforcement.
 const file=path.join(dir,'audit-entries.json');const stored=JSON.parse(await fs.readFile(file,'utf8'));
 stored[0].actions[0].dueDate='2000-01-01';stored[0].updatedAt='expired-fixture-revision';
 await fs.writeFile(file+'.tmp',JSON.stringify(stored));await fs.rename(file+'.tmp',file);
 await page.reload();await page.getByText('Updates are locked after the due date. Ask an administrator to extend the deadline.',{exact:true}).waitFor();
 assert.equal(await page.locator('.audit-action-reply-form').count(),0);assert.equal(await page.getByRole('button',{name:'Edit response',exact:true}).count(),0);
 const before=await fs.readFile(file,'utf8'),reply=stored[0].actions[0].responses[0];
 for(const operation of ['save-reply-draft','submit-reply','reply']){
  const denied=await context.request.post(base+'/api/projects/'+projectId+'/audit-entries',{data:{id:entry.id,actionId:'a',replyId:reply.id,baseUpdatedAt:stored[0].updatedAt,operation,text:'Forbidden change',status:'Open',images:[]}});
  assert.equal(denied.status(),403);assert.match((await denied.json()).message,/due date/i);
 }
 const mobile=await context.request.post(base+'/api/projects/'+projectId+'/audit-sync',{data:{operationId:crypto.randomUUID(),base:{},patch:{id:entry.id,operation:'reply',actionId:'a',text:'Forbidden mobile change',status:'Open',images:[]}}});assert.equal(mobile.status(),403);
 assert.equal(await fs.readFile(file,'utf8'),before);assert.deepEqual(errors,[]);
 console.log('PASS: draft and submitted edits persist; original photo removed and two replacements saved; expired UI hides controls; direct draft/submit/reply/mobile calls return403; records unchanged');

}finally{await browser?.close();if(child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}await fs.rm(dir,{recursive:true,force:true});}
