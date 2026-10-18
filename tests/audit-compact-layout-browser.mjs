import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base='http://127.0.0.1:4187',api=base+'/api/projects/project_opsl_15000ha_development/audit-entries';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.request.post(base+'/login',{form:{userid:'admin',password:'MobileTest-Only-2026'}});
 const finding=Array.from({length:16},(_,i)=>`Paragraph ${i+1}. Sample observations to verify scrolling without truncating the report text.`).join('\n\n');
 const response=await context.request.post(api,{data:{id:crypto.randomUUID(),status:'Draft',entity:'Training Plantation',auditYear:'2026',finding,findingStyles:[{start:0,end:9,bold:true},{start:10,end:17,italic:true},{start:18,end:30,underline:true}]}});
 assert.equal(response.status(),201);const entry=(await response.json()).entry;
 try {
  const page=await context.newPage();await page.goto(base+'/app');
  const editor=page.locator('[data-editor-for=auditFinding]');await editor.fill(finding);
  assert(await editor.evaluate(el=>el.scrollHeight>el.clientHeight&&el.clientHeight<=220));
  await page.locator('[data-audit-panel=report]').click();
  const card=page.locator('.audit-finding-card').filter({has:page.locator(`[data-edit-audit-draft="${entry.id}"]`)});
  const text=card.locator('.audit-report-text').first();await text.waitFor();
  assert(await text.evaluate(el=>el.scrollHeight>el.clientHeight&&el.clientHeight<=220&&getComputedStyle(el).overflowY==='auto'));
  for(const tag of ['b','i','u'])assert.equal(await text.locator(tag).count(),1);
  await text.focus();await page.keyboard.press('PageDown');
  await page.waitForFunction(el=>el.scrollTop>0,await text.elementHandle());
  await card.scrollIntoViewIfNeeded();await page.screenshot({path:'/Users/admin/Documents/Audit/artifacts/local-formatting-preview-20261018/scrolling-report.png'});
  await page.emulateMedia({media:'print'});assert.equal(await text.evaluate(el=>getComputedStyle(el).maxHeight),'none');
  console.log('PASS: long editor and View & Report text scroll, B/I/U display, keyboard scrolling, full unbounded print text.');
 } finally {assert.equal((await context.request.delete(api,{data:{id:entry.id,baseUpdatedAt:entry.updatedAt}})).status(),200);}
} finally {await browser.close();}
