import assert from 'node:assert/strict';import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.STANDALONE_TEST_URL;if(new URL(base).hostname!=='127.0.0.1')throw new Error('Synthetic local server only');
const password=fs.readFileSync(process.env.STANDALONE_TEST_ADMIN_FILE,'utf8').match(/Initial password: (.+)/)[1];
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];let queries=0;page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/audit-entries?'))queries++;});
 await page.goto(base+'/login');await page.getByLabel('Username',{exact:true}).fill('admin');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('#auditFinding').waitFor();assert.equal(queries,0,'Entry needs no report fetch');
 await page.locator('[data-audit-panel=report]').click();await page.locator('.audit-finding-card').first().waitFor();assert.equal(queries,1);assert.equal(await page.locator('iframe').count(),0);assert(!/source report|original report|issued report/i.test(await page.locator('#auditWorkspace').innerText()));
 const start=performance.now();await page.locator('[data-audit-panel=entry]').click();await page.locator('#auditFinding').waitFor();await page.locator('[data-audit-panel=report]').click();await page.locator('.audit-finding-card').first().waitFor();assert.equal(queries,1,'Warm panel switches reuse the page');
 const switchMs=performance.now()-start;
 // Delay the other company, then select OBAN while that earlier request is still pending.
 let release;const gate=new Promise(r=>release=r);let observed;const seen=new Promise(r=>observed=r);
 await page.route('**/audit-entries?**',async route=>{if(route.request().url().includes('Octavus')){observed();await gate;}await route.continue();});
 await page.locator('#auditEntity').selectOption('Octavus Plantation Ltd');await seen;await page.locator('#auditEntity').selectOption('JB FARMS OBAN Plantation');await page.locator('.audit-finding-card').first().waitFor();release();await page.waitForResponse(r=>r.url().includes('Octavus'));await page.waitForTimeout(200);
 assert.equal(await page.locator('#auditEntity').inputValue(),'JB FARMS OBAN Plantation');assert.equal(await page.locator('.audit-summary-grid > div b').first().innerText(),'22');
 const url=base+'/api/projects/project_opsl_15000ha_development/audit-entries?auditYear=2025&company=JB%20FARMS%20OBAN%20Plantation';
 const r=await ctx.request.get(url,{headers:{'Accept-Encoding':'gzip'}});assert.equal(r.headers()['content-encoding'],'gzip');const data=await r.body();const compressed=Number(r.headers()['content-length']);assert(compressed<data.length/2);
 assert.equal((await ctx.request.get(url,{headers:{'If-None-Match':r.headers().etag}})).status(),304);
 const anon=await browser.newContext();assert.equal((await anon.request.get(url,{headers:{'If-None-Match':r.headers().etag}})).status(),401);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({warmRoundTripMs:Math.round(switchMs),plainBytes:data.length,gzipBytes:compressed,staleCompanyRequest:'ignored',entryQueries:0,authenticated304:'passed',anonymousCacheDenied:true}));
}finally{await browser.close();}
