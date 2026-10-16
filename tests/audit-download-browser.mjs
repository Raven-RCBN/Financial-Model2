import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.AUDIT_TEST_URL||'http://127.0.0.1:4187';
if(new URL(base).hostname!=='127.0.0.1')throw Error('Synthetic localhost fixture only');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext({acceptDownloads:true});
 await context.request.post(base+'/login',{form:{userid:'mobile.milo',password:'MobileTest-Only-2026'}});
 const api=base+'/api/projects/project_opsl_15000ha_development/';
 const year=String(new Date().getFullYear());
 for(let i=0;i<6;i++){
  const res=await context.request.post(api+'audit-entries',{data:{id:crypto.randomUUID(),entity:'Training Plantation',auditYear:year,department:'Plantation',area:'SOP compliance',priority:'Medium',finding:'Synthetic download finding '+(i+1),impact:'Fictional test data',actions:[]}});
  assert.equal(res.status(),201,await res.text());
 }
 const page=await context.newPage();await page.goto(base+'/app');await page.locator('[data-audit-panel=report]').click();
 assert.equal(await page.locator('#printAuditReport').count(),0);
 const button=page.getByRole('button',{name:'Download report PDF',exact:true});await button.waitFor();
 const downloadPromise=page.waitForEvent('download');await button.click();const download=await downloadPromise;
 assert.equal(download.suggestedFilename(),`audit-report-${year}.pdf`);assert.equal(await download.failure(),null);
 await download.saveAs('/tmp/audit-pdf-fix/download-test.pdf');
 await page.locator('#auditDownloadStatus').filter({hasText:'Downloaded Training Plantation'}).waitFor();
 assert.equal(await button.isEnabled(),true);
 await page.route('**/audit-pdf?*',route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'No findings for this company and report year.'})}));
 await button.click();await page.locator('#auditDownloadStatus').filter({hasText:'No findings for this company and report year.'}).waitFor();assert.equal(await button.isEnabled(),true);
 await page.unroute('**/audit-pdf?*');
 await page.route('**/audit-pdf?*',route=>route.fulfill({status:200,contentType:'text/html',body:'Sign in'}));
 await button.click();await page.locator('#auditDownloadStatus').filter({hasText:'The server did not return a PDF.'}).waitFor();assert.equal(await button.isEnabled(),true);
 console.log('PASS: print removed; actual browser PDF download, all six findings beyond page size, filename, visible server errors, invalid response rejection and button recovery.');
}finally{await browser.close();}
