import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base='http://127.0.0.1:4187',api=base+'/api/projects/project_opsl_15000ha_development/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const login=async userid=>{const c=await browser.newContext({acceptDownloads:true});await c.request.post(base+'/login',{form:{userid,password:'MobileTest-Only-2026'}});return c;};
 const creator=await login('mobile.milo'),admin=await login('admin'),owner=await login('mobile.owner');
 const page=await creator.newPage();await page.goto(base+'/app');await page.locator('[data-audit-panel=entry]').click();
 await page.locator('[data-editor-for="auditFinding"]').fill('Synthetic sixteen photo draft');await page.locator('#auditStatus').selectOption('Draft');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=60;c.height=40;c.getContext('2d').fillRect(0,0,60,40);return c.toDataURL().split(',')[1];});
 await page.locator('#auditObservationImageInput').setInputFiles(Array.from({length:16},(_,i)=>({name:`photo-${i+1}.png`,mimeType:'image/png',buffer:Buffer.from(png,'base64')})));
 await page.waitForFunction(()=>document.querySelectorAll('[data-observation-image-index]').length===16);
 for(let i=0;i<16;i++)await page.locator('[data-editor-for="caption"]').nth(i).fill(`Evidence number ${i+1}`);
 await page.locator('#saveAuditEntry').click();await page.locator('[data-edit-audit-draft]').waitFor();
 const list=async ctx=>(await(await ctx.request.get(api+'audit-entries?company=Training%20Plantation&limit=100')).json()).items;
 let draft=(await list(creator)).find(e=>e.finding==='Synthetic sixteen photo draft');assert(draft);assert.equal(draft.observationImages.length,16);
 assert.equal(await page.locator('.audit-finding-card img').count(),16);
 await page.locator(`[data-edit-audit-draft="${draft.id}"]`).click();assert.equal(await page.locator('[data-observation-image-index]').count(),16);
 await page.locator('[data-editor-for="auditFinding"]').fill('Edited sixteen photo draft');await page.locator('#saveAuditEntry').click();await page.locator('[data-edit-audit-draft]').waitFor();
 draft=(await list(creator)).find(e=>e.id===draft.id);assert.equal(draft.finding,'Edited sixteen photo draft');assert.equal(draft.observationImages.length,16);
 assert.equal((await owner.request.delete(api+'audit-entries',{data:{id:draft.id,baseUpdatedAt:draft.updatedAt}})).status(),403);
 await page.locator(`[data-edit-audit-draft="${draft.id}"]`).click();page.once('dialog',d=>d.dismiss());await page.locator('#deleteAuditDraft').click();assert((await list(creator)).some(e=>e.id===draft.id));
 page.once('dialog',d=>d.accept());await page.locator('#deleteAuditDraft').click();await page.waitForResponse(r=>r.request().method()==='GET' && r.url().includes('audit-entries'));
 assert(!(await list(creator)).some(e=>e.id===draft.id));assert.equal((await creator.request.post(api+'audit-entries',{data:{...draft,operation:'save-draft',baseUpdatedAt:draft.updatedAt}})).status(),404);
 // Separate finalized synthetic record reuses evidence references retained by draft deletion.
 const created=await creator.request.post(api+'audit-entries',{data:{...draft,id:crypto.randomUUID(),status:'Open',actions:[{description:'Review all photos',owner:'mobile.owner',email:'owner@example.test',dueDate:'2099-01-01'}]}});assert.equal(created.status(),201,await created.text());let final=(await created.json()).entry;
 const pdf=await creator.request.post(api+'audit-pdf?company=Training%20Plantation&year='+final.auditYear,{data:{}});assert.equal(pdf.status(),200,await pdf.text());await fs.mkdir('/tmp/audit-draft-photo-fix',{recursive:true});await fs.writeFile('/tmp/audit-draft-photo-fix/sixteen-photos.pdf',await pdf.body());
 assert.equal((await creator.request.post(api+'audit-entries',{data:{id:final.id,operation:'reopen-draft',baseUpdatedAt:final.updatedAt}})).status(),403);
 assert.equal((await admin.request.delete(api+'audit-entries',{data:{id:final.id,baseUpdatedAt:final.updatedAt}})).status(),409);
 const ap=await admin.newPage();await ap.goto(base+'/app');await ap.locator('[data-audit-panel=report]').click();await ap.locator(`[data-reopen-audit="${final.id}"]`).waitFor();ap.once('dialog',d=>d.accept());await ap.locator(`[data-reopen-audit="${final.id}"]`).click();await ap.locator(`[data-edit-audit-draft="${final.id}"]`).waitFor();
 const reopened=(await list(admin)).find(e=>e.id===final.id);assert.equal(reopened.status,'Draft');assert.equal(reopened.lifecycleNotice.type,'reopened');assert.equal(reopened.createdBy,'mobile.milo');
 assert.equal((await owner.request.post(api+'audit-entries',{data:{id:final.id,operation:'reply',actionId:final.actions[0].id,text:'Cannot reply during draft',status:'Closed'}})).status(),403);
 await page.reload();await page.locator('[data-audit-panel=report]').click();await page.locator(`[data-edit-audit-draft="${final.id}"]`).click();await page.locator('#auditStatus').selectOption('Open');await page.locator('#saveAuditEntry').click();await page.locator('.audit-finding-card').filter({hasText:final.finding}).first().waitFor();
 final=(await list(creator)).find(e=>e.id===final.id);assert.equal(final.status,'Open');assert.equal(final.lifecycleNotice.type,'refinalized');assert.equal(final.observationImages.length,16);
 assert.equal(await page.locator('[data-edit-audit-draft],[data-reopen-audit]').count(),0);
 console.log('PASS browser: 16 uploaded photos retained across save/edit/report/PDF; draft delete cancel/confirm and stale-save denial; admin-only reopen, creator refinalization, paused replies, lifecycle notices.');
}finally{await browser.close();}
