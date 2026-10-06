import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.STANDALONE_TEST_URL;if(new URL(base).hostname!=='127.0.0.1')throw Error('Synthetic data only');
const api=base+'/api/projects/project_opsl_15000ha_development/';
const password=fs.readFileSync(process.env.STANDALONE_TEST_ADMIN_FILE,'utf8').match(/Initial password: (.+)/)[1];
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const ctx=await browser.newContext({permissions:['geolocation'],geolocation:{latitude:3.139,longitude:101.687}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await ctx.request.post(base+'/login',{form:{userid:'admin',password}});await page.goto(base+'/app');await page.locator('#auditEntity').selectOption('Octavus Plantation Ltd');
 assert.equal(await page.locator('#auditStatus').inputValue(),'Draft');assert.equal(await page.locator('[data-audit-action-draft] [required]').count(),0);
 let saved=page.waitForResponse(r=>r.url().endsWith('/audit-entries')&&r.request().method()==='POST');await page.getByRole('button',{name:'Save draft',exact:true}).click();let response=await saved;assert.equal(response.status(),201);let entry=(await response.json()).entry;assert.equal(entry.status,'Draft');assert.equal(entry.finding,'');assert.equal(new Intl.DateTimeFormat('en-CA',{timeZone:entry.timeZone,hour:'numeric',hourCycle:'h23'}).format(new Date('2026-10-06T00:00:00Z')),'08');const id=entry.id;
 await page.locator(`[data-edit-audit-draft="${id}"]`).click();await page.locator('#auditFinding').fill('Draft browser workflow '+id);await page.locator('#auditObservationImageInput').setInputFiles({name:'draft-photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});await page.locator('#auditObservationImages img').waitFor();
 saved=page.waitForResponse(r=>r.url().endsWith('/audit-entries')&&r.request().method()==='POST');await page.getByRole('button',{name:'Save draft',exact:true}).click();response=await saved;entry=(await response.json()).entry;assert.equal(entry.id,id);assert(entry.observationImages[0].url);const photoUrl=entry.observationImages[0].url;
 await page.reload();await page.locator('#auditEntity').selectOption('Octavus Plantation Ltd');await page.getByRole('button',{name:'View & Report',exact:true}).click();await page.locator(`[data-edit-audit-draft="${id}"]`).click();assert.equal(await page.locator('#auditObservationImages img').getAttribute('src'),photoUrl);
 await page.locator('#auditStatus').selectOption('Open');assert((await page.locator('[data-audit-action-draft] [required]').count())>0);await page.getByRole('button',{name:'Finalize audit item',exact:true}).click();assert.equal(await page.locator('#auditStatus').inputValue(),'Open');
 const denied=await ctx.request.post(api+'audit-entries',{data:{...entry,operation:'save-draft',baseUpdatedAt:entry.updatedAt,status:'Open'}});assert.equal(denied.status(),400);
 await page.locator('[data-action-field="description"]').fill('Repair drain and upload evidence');await page.locator('[data-action-field="owner"]').selectOption('mobile.owner');await page.locator('[data-action-field="dueDate"]').fill('2026-12-31');
 saved=page.waitForResponse(r=>r.url().endsWith('/audit-entries')&&r.request().method()==='POST');await page.getByRole('button',{name:'Finalize audit item',exact:true}).click();response=await saved;assert.equal(response.status(),201);entry=(await response.json()).entry;assert.equal(entry.id,id);assert.equal(entry.status,'Open');assert.equal(entry.observationImages[0].url,photoUrl);assert(entry.actions[0].notificationRevision);assert.equal(await page.locator(`[data-edit-audit-draft="${id}"]`).count(),0);
 const draftOnly=await ctx.request.post(api+'audit-entries',{data:{id:'pdf-draft-'+id,status:'Draft',auditYear:'2099',entity:'Octavus Plantation Ltd'}});assert.equal(draftOnly.status(),201);assert.equal((await draftOnly.json()).entry.timeZone,'Africa/Lagos');
 const draftPdf=await ctx.request.post(api+'audit-pdf',{data:{auditYear:'2099',company:'Octavus Plantation Ltd'}});assert.equal(draftPdf.status(),400,'PDF excludes unfinalized drafts');
 const duplicate=await ctx.request.post(api+'audit-entries',{data:{...entry,status:'Draft'}});assert.equal(duplicate.status(),403);
 // Use past deadlines to verify the actual API, not only UI hiding.
 let old=await ctx.request.post(api+'audit-entries',{data:{id:'late-'+id,finding:'Overdue lock integration',entity:'Octavus Plantation Ltd',auditYear:'2025',actions:[{description:'Late action',owner:'mobile.owner',email:entry.actions[0].email,dueDate:'2020-01-01'}]}});assert.equal(old.status(),201);old=(await old.json()).entry;
 const user=await browser.newContext();await user.request.post(base+'/login',{form:{userid:'mobile.owner',password:'MobileTest-Only-2026'}});const patch={id:old.id,operation:'reply',actionId:old.actions[0].id,text:'Late update',status:'Closed'};
 assert.equal((await user.request.post(api+'audit-entries',{data:patch})).status(),403);
 assert.equal((await user.request.post(api+'audit-sync',{data:{operationId:'late-sync-'+Date.now(),patch,base:{status:'Open'}}})).status(),403);
 assert.equal((await ctx.request.post(api+'audit-entries',{data:patch})).status(),201);
 await page.getByRole('button',{name:'Data Entry',exact:true}).click();await page.setViewportSize({width:390,height:900});assert.equal(await page.locator('#auditStatus').inputValue(),'Draft');assert(await page.getByRole('button',{name:'Save draft',exact:true}).isVisible());
 assert.deepEqual(errors,[]);console.log('Blank draft, required-on-Open validation, reopen/photo preservation, stable ID, finalize, overdue HTTP/mobile denial, admin override and mobile-width UI passed.');
}finally{await browser.close();}
