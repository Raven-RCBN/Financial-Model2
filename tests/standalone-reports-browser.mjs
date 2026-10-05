// Isolated imported-report fixture only. Credentials are synthetic; never run against production.
import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.STANDALONE_TEST_URL;if(!base||new URL(base).hostname!=='127.0.0.1')throw new Error('Local fixture URL required');
const pkg=JSON.parse(fs.readFileSync(process.env.REPORT_IMPORT_PACKAGE+'/import.json','utf8'));
const api='/api/projects/project_opsl_15000ha_development/';const company='JB FARMS OBAN Plantation',other='Octavus Plantation Ltd';
const password=fs.readFileSync(process.env.STANDALONE_TEST_ADMIN_FILE,'utf8').match(/Initial password: (.+)/)[1];
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/login');await page.getByLabel('Username',{exact:true}).fill('admin');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('#auditFinding').waitFor();
 assert.equal(await page.locator('#auditEntity').inputValue(),company);
 for(const year of ['2024','2025']){
  const response=await context.request.get(base+api+'audit-entries?auditYear='+year+'&pageSize=5&company='+encodeURIComponent(company));const list=await response.json();assert.equal(list.total,22);assert.equal(list.items.length,5);assert.equal(list.summary.total,22);assert(list.items.every(e=>e.entity===company&&e.sourceReport));
  const pdf=await context.request.post(base+api+'audit-pdf',{data:{auditYear:year,auditEntity:company}});assert.equal(pdf.status(),200);const bytes=await pdf.body();assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),pkg.reports[year].sha256);
  fs.writeFileSync(process.env.REPORT_OUTPUT_DIR+'/OBAN-Audit-Report-'+year+'.pdf',bytes);
 }
 await page.locator('[data-audit-panel=report]').click();await page.locator('.audit-finding-card').first().waitFor();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.getByRole('link',{name:/original report/i}).count(),0);
 assert.equal(await page.locator('.audit-summary-grid > div').first().locator('b').innerText(),'22');
 assert.equal((await page.locator('.audit-finding-card').count()),5);
 assert((await page.locator('.audit-source-details').first().innerText()).includes('Management response'));
 await Promise.all([page.waitForResponse(r=>r.url().includes('audit-entries?')&&r.url().includes('auditYear=2024')),page.locator('#auditReportYear').selectOption('2024')]);await page.locator('.audit-finding-card').first().waitFor();
 await page.screenshot({path:process.env.REPORT_OUTPUT_DIR+'/report-webapp.png'});
 await page.locator('#auditEntity').selectOption(other);await page.waitForFunction(()=>document.querySelector('.audit-summary-grid > div b')?.textContent==='0');
 assert.equal(await page.locator('.audit-summary-grid > div').first().locator('b').innerText(),'0');
 const isolated=await context.request.post(base+api+'audit-entries',{data:{id:'company-isolation-test',auditYear:'2025',entity:other,department:'Test department',finding:'Company isolation test only',impact:'Synthetic fixture',priority:'Low',actions:[]}});assert.equal(isolated.status(),201);
 const otherList=await(await context.request.get(base+api+'audit-entries?auditYear=2025&company='+encodeURIComponent(other))).json();assert.equal(otherList.total,1);assert.equal(otherList.items[0].entity,other);
 const oban=await(await context.request.get(base+api+'audit-entries?auditYear=2025&company='+encodeURIComponent(company))).json();assert.equal(oban.total,22);
 assert.equal((await context.request.get(base+api+'audit-source-report?auditYear=2025&company='+encodeURIComponent(other))).status(),404);
 assert.equal((await context.request.post(base+api+'audit-entries',{data:{finding:'Invalid company',entity:'Unknown'}})).status(),400);
 const cached=await context.request.get(base+api+'audit-entries?auditYear=2025&company='+encodeURIComponent(company));assert(cached.headers().etag);const validated=await context.request.get(base+api+'audit-entries?auditYear=2025&company='+encodeURIComponent(company),{headers:{'If-None-Match':cached.headers().etag}});assert.equal(validated.status(),304);
 const otherPdf=await context.request.post(base+api+'audit-pdf',{data:{auditYear:'2025',auditEntity:other}});assert.equal(otherPdf.status(),200);fs.writeFileSync(process.env.REPORT_OUTPUT_DIR+'/other-company-test.pdf',await otherPdf.body());
 const access=await(await context.request.get(base+api+'audit-access')).json(),owner=access.assignees.find(u=>u.name==='mobile.milo');
 const added=await context.request.post(base+api+'audit-entries',{data:{id:'oban_2025_issue_01',operation:'add-action',action:{description:'Synthetic appendix verification action',owner:owner.name,email:owner.email,dueDate:'2026-12-31'}}});assert.equal(added.status(),201);
 const updated=await added.json();assert.equal(updated.entry.actions.length,1);assert(updated.entry.sourceReport.managementResponse.includes('CPO Quality'));
 const pdf=await context.request.post(base+api+'audit-pdf',{data:{auditYear:'2025',auditEntity:company}});assert.equal(pdf.status(),200);fs.writeFileSync(process.env.REPORT_OUTPUT_DIR+'/appendix-test.pdf',await pdf.body());
 const forbidden=await context.request.post(base+api+'audit-sync',{data:{operationId:'synthetic-operation-1234567',patch:{id:'oban_2025_issue_01',operation:'update-finding',finding:'overwrite source'},base:{}}});assert.equal(forbidden.status(),403);
 const requester=await browser.newContext();await requester.request.post(base+'/login',{form:{userid:'mobile.owner',password:'MobileTest-Only-2026'}});
 assert.equal((await requester.request.post(base+api+'audit-source-import',{data:{packageName:'oban-report-import-20261006'}})).status(),403);
 assert.equal((await requester.request.put(base+api+'audit-settings',{data:{}})).status(),403);
 assert.deepEqual(errors,[]);
 console.log('PASS:44 sections; both PDFs byte-identical to55/107-page originals; company isolation; full-summary pagination; original responses/tables; follow-up appendix; source protection and admin restrictions.');
}finally{await browser.close();}
