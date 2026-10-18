import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.AUDIT_TEST_URL||'http://127.0.0.1:4187';if(new URL(base).hostname!=='127.0.0.1')throw Error('Synthetic localhost only');
const api=base+'/api/projects/project_opsl_15000ha_development/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const creator=await browser.newContext();await creator.request.post(base+'/login',{form:{userid:'mobile.milo',password:'MobileTest-Only-2026'}});
 const page=await creator.newPage();await page.goto(base+'/app');await page.locator('[data-audit-panel=entry]').click();
 const preview=page.getByRole('group',{name:'Corrective action — assigned user only'}).first();await preview.waitFor();
 assert(await preview.getByRole('textbox').isDisabled());assert(await preview.getByRole('button',{name:'Upload photos'}).isDisabled());assert(await page.locator('[data-editor-for=description]').first().isEditable());
 const draftResponse=await creator.request.post(api+'audit-entries',{data:{id:crypto.randomUUID(),status:'Draft',entity:'Training Plantation',auditYear:String(new Date().getFullYear()),department:'Plantation',area:'SOP compliance',finding:'Recommendation workflow check',actions:[{description:'Improve drainage',owner:'mobile.owner',email:'owner@example.test',dueDate:'2099-01-01'}]}});assert.equal(draftResponse.status(),201);const draft=(await draftResponse.json()).entry;
 const owner=await browser.newContext();await owner.request.post(base+'/login',{form:{userid:'mobile.owner',password:'MobileTest-Only-2026'}});
 const reply={id:draft.id,operation:'reply',actionId:draft.actions[0].id,text:'Drain cleared',status:'Closed'};
 assert.equal((await owner.request.post(api+'audit-entries',{data:reply})).status(),403);
 const finalized=await creator.request.post(api+'audit-entries',{data:{...draft,operation:'save-draft',status:'Open',baseUpdatedAt:draft.updatedAt}});assert.equal(finalized.status(),201);
 for(const ctx of [creator,owner])assert.equal((await ctx.request.post(api+'audit-entries',{data:{id:draft.id,operation:'update-action',actionId:draft.actions[0].id,action:{...draft.actions[0],description:'Attempted edit'}}})).status(),403);
 await page.locator('[data-audit-panel=report]').click();await page.reload();await page.locator('[data-audit-panel=report]').click();await page.getByText('Recommendation workflow check',{exact:true}).first().waitFor();
 assert.equal(await page.locator('.audit-update-action-form,.audit-add-action-form,.audit-action-reply-form').count(),0);
 const op=await owner.newPage();await op.goto(base+'/app');await op.locator('[data-audit-panel=report]').click();
 const form=op.locator(`.audit-action-reply-form[data-entry-id="${draft.id}"]`);await form.waitFor();assert.equal(await op.locator('.audit-update-action-form,.audit-add-action-form').count(),0);
 await form.locator('[data-editor-for=text]').fill('Drain cleared and inspected');
 await form.locator('[name=status]').selectOption('Closed');
 await form.locator('[data-reply-files]').setInputFiles({name:'proof.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});await form.locator('[data-reply-previews] img').waitFor();
 await form.getByRole('button',{name:'Save update'}).click();await op.locator('.audit-action-reply').filter({hasText:'Drain cleared and inspected'}).waitFor();
 const data=await(await owner.request.get(api+'audit-entries?company=Training%20Plantation')).json();const entry=data.items.find(e=>e.id===draft.id);
 assert.equal(entry.finding,draft.finding);assert.equal(entry.actions[0].description,'Improve drainage');assert.equal(entry.actions[0].responses[0].author,'mobile.owner');assert.equal(entry.actions[0].responses[0].images.length,1);assert(entry.actions[0].responses[0].createdAt);
 console.log('PASS: visible locked draft section; editable recommendation; pre-finalization reply denied; finalized creator/assignee edits denied; assigned corrective action with photo and automatic timestamp saved.');
} finally {await browser.close();}
