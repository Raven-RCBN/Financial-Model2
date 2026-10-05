// Synthetic local server only. Production-host requests are intercepted and sent to loopback.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
assert.ok(process.env.AUDIT_CUTOVER_TEST_DB,'Provide a synthetic AUDIT_CUTOVER_TEST_DB');
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'fm2-freeze-browser-'));
await fs.copyFile(process.env.AUDIT_CUTOVER_TEST_DB,path.join(fixture,'db.json'));
const port=43191, origin='https://fm2.digitalpalm.ai', base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port),FM2_DB_PATH:path.join(fixture,'db.json'),FM2_ADMIN_USER:'admin',FM2_ADMIN_PASSWORD:'Synthetic-Admin-2026',FM2_AUTH_USER:'finance',FM2_AUTH_PASSWORD:'Synthetic-Finance-2026',FM2_AUDIT_FREEZE:'1',FM2_AUDIT_EXTERNAL_URL:'',FM2_MONGODB_URI:'',MONGODB_URI:''},stdio:['ignore','pipe','pipe']});
let browser;
try{
  await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(String(d).includes('running at'))resolve()});child.on('exit',c=>reject(new Error('Server exited '+c)));setTimeout(()=>reject(new Error('Startup timeout')),10000).unref()});
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const [user,password] of [['finance','Synthetic-Finance-2026'],['admin','Synthetic-Admin-2026']]){
    const context=await browser.newContext(), auditRequests=[], errors=[];
    const login=await fetch(base+'/login?returnTo=/app',{method:'POST',body:new URLSearchParams({userid:user,password}),redirect:'manual'});
    assert.equal(login.status,303);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin)return route.abort();
      if(url.pathname.includes('/audit-'))auditRequests.push(url.pathname);
      if((url.pathname.startsWith('/api/cpo-market') || url.pathname.endsWith('/market-ticker')))return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic market unavailable"}'});
      const response=await route.fetch({url:base+url.pathname+url.search,headers:{...route.request().headers(),cookie},maxRedirects:0});
      await route.fulfill({response});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/app');
    await page.waitForFunction(()=>document.querySelector('#metrics')?.children.length>0,{},{timeout:10000}).catch(async error=>{console.error({url:page.url(),text:(await page.locator('body').innerText()).slice(0,800),errors,auditRequests});throw error;});
    await page.waitForFunction(()=>document.querySelector('#sessionUser')?.value);
    assert.equal(await page.locator('#sessionUser').inputValue(),user);
    assert.equal(await page.locator('body').innerText().then(t=>t.includes('Unable to load workbook analysis')),false);
    await page.locator('[data-view=inputs]').click();assert.ok(await page.locator('#inputs.active').isVisible());
    await page.locator('[data-view=dashboards]').click();assert.ok(await page.locator('#dashboards.active').isVisible());
    await page.locator('[data-view=management]').click();assert.ok(await page.locator('#management.active').isVisible());
    assert.equal(await page.locator('[data-view=audit]').isVisible(),false);
    for(const element of await page.locator('[data-management-tab="audit-users"],.management-audit-setup,label:has(input[id^="managementAudit"])').all())assert.equal(await element.isVisible(),false);
    const session=await page.evaluate(()=>fetch('/api/session').then(r=>r.json()));
    assert.equal(session.auditWritesFrozen,true);assert.equal(session.auditExternalUrl,'');
    assert.deepEqual(auditRequests,[],'Finance startup must not call frozen Audit APIs');
    assert.deepEqual(errors,[]);
    for(const method of ['GET','POST','PUT'])assert.equal((await fetch(base+'/api/projects/project_opsl_15000ha_development/audit-access',{method})).status,503);
    await context.unrouteAll({behavior:'wait'});await context.close();
  }
  console.log('PASS: finance and admin initialize on production hostname during freeze, financial navigation works, Audit controls hidden, no Audit requests, legacy APIs remain 503.');
}finally{await browser?.close();child.kill();await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));await fs.rm(fixture,{recursive:true,force:true});}
