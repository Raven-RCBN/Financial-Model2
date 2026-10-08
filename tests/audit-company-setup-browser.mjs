import fs from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.STANDALONE_TEST_URL,root=process.env.STANDALONE_TEST_DATA;
if(new URL(base).hostname!=='127.0.0.1'||!root?.startsWith('/tmp/'))throw Error('Synthetic localhost fixture only');
const before=Object.fromEntries(['audit-context.json','audit-users.json'].map(n=>[n,fs.readFileSync(root+'/'+n)]));
const password=fs.readFileSync(process.env.STANDALONE_TEST_ADMIN_FILE,'utf8').match(/Initial password: (.+)/)[1],api=base+'/api/projects/project_opsl_15000ha_development/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const admin=await browser.newContext();await admin.request.post(base+'/login',{form:{userid:'admin',password}});
 const current=await(await admin.request.get(api+'audit-access')).json(),context=await(await admin.request.get(api+'audit-context')).json(),companies=context.project.settings.auditCompanies;
 const account=(name,permissions={},selected)=>({id:name,name,email:name+'@example.test',password:'Setup-Test-Only-2026',status:'Active',companyScope:selected?'selected':'all',companies:selected?[selected]:[],auditPermissions:permissions});
 const users=[...current.users,account('setup.manager',{companySetup:true}),account('setup.scoped',{companySetup:true},companies[0]),account('setup.ordinary',{respond:true}),...Array.from({length:15},(_,i)=>account('scroll.user'+i))];
 assert.equal((await admin.request.put(api+'audit-access',{data:{users}})).status(),200);
 const page=await admin.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/app');await page.locator('#adminMenu').click();
 const region=page.getByRole('region',{name:'Audit user directory'});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});assert(await region.evaluate(e=>e.scrollHeight>e.clientHeight&&e.clientHeight<=520));
  await region.evaluate(e=>e.scrollTop=e.scrollHeight);assert(await region.evaluate(e=>e.scrollTop>0));
  const header=await region.locator('th').first().boundingBox(),box=await region.boundingBox();assert(Math.abs(header.y-box.y)<3,'Header remains visible within scroll area');
 }
 await page.setViewportSize({width:1440,height:900});
 await page.locator('#auditUserDirectory tr').filter({hasText:'setup.manager@example.test'}).getByRole('button',{name:'Edit',exact:true}).click();assert(await page.locator('#auditUserForm [name=companySetup]').isChecked());
 const saved=page.waitForResponse(r=>r.url().endsWith('/audit-access')&&r.request().method()==='PUT');await page.locator('#auditUserForm').getByRole('button',{name:'Save audit user',exact:true}).click();assert.equal((await saved).status(),200);
 const login=async name=>{const ctx=await browser.newContext();await ctx.request.post(base+'/login',{form:{userid:name,password:'Setup-Test-Only-2026'}});return ctx;};
 const manager=await login('setup.manager');const access=await(await manager.request.get(api+'audit-access')).json();assert.equal(access.identity.companySetup,true);assert.equal(access.identity.admin,false);assert.deepEqual(access.users,[]);
 for(const endpoint of ['audit-access','audit-branding'])assert.equal((await manager.request.put(api+endpoint,{data:{users:[],dataUrl:''}})).status(),403);
 assert.equal((await manager.request.post(api+'audit-source-import',{data:{packageName:'test'}})).status(),403);
 const mp=await manager.newPage();mp.on('pageerror',e=>errors.push(e.message));await mp.goto(base+'/app');await mp.getByRole('button',{name:'Company setup',exact:true}).click();assert.equal(await mp.locator('#auditUserForm').count(),0);assert.equal(await mp.locator('#auditUserDirectory').count(),0);await mp.locator('#companySettingsSelect').selectOption(companies[0]);
 await mp.locator('#auditSettingsForm [name=projectName]').fill('Delegated company settings test');
 const settingsSaved=mp.waitForResponse(r=>r.url().endsWith('/audit-settings')&&r.request().method()==='PUT');await mp.getByRole('button',{name:'Save company settings',exact:true}).click();assert.equal((await settingsSaved).status(),200);await mp.locator('#settingsStatus').getByText('Settings saved for '+companies[0]+'.',{exact:true}).waitFor();assert.equal(await mp.locator('#auditUserForm').count(),0);
 const latest=await(await manager.request.get(api+'audit-context')).json();assert.equal(latest.project.settings.auditCompanyProfiles[companies[0]].projectName,'Delegated company settings test');
 const p=latest.project.settings.auditCompanyProfiles[companies[0]],patch={companyProfile:{...p,auditReport:p.auditReportsByYear?.[p.auditSetup.years[0]]||p.auditReport},reportYear:p.auditSetup.years[0]};
 assert.equal((await manager.request.put(api+'audit-settings',{data:{...patch,newCompany:true,companyProfile:{...patch.companyProfile,name:'Delegated new company'}}})).status(),200);
 const scoped=await login('setup.scoped');const scopedSave=await scoped.request.put(api+'audit-settings',{data:patch});assert.equal(scopedSave.status(),200);assert.deepEqual((await scopedSave.json()).project.settings.auditCompanies,[companies[0]]);
 assert.equal((await scoped.request.put(api+'audit-settings',{data:{...patch,companyProfile:{...patch.companyProfile,name:companies[1]}}})).status(),403);
 assert.equal((await scoped.request.put(api+'audit-settings',{data:{...patch,newCompany:true,companyProfile:{...patch.companyProfile,name:'Forbidden company'}}})).status(),403);
 assert.equal((await manager.request.put(api+'audit-settings',{data:{companyName:'Bypass',projectName:'Bypass'}})).status(),403);
 const ordinary=await login('setup.ordinary');assert.equal((await ordinary.request.put(api+'audit-settings',{data:patch})).status(),403);
 assert.deepEqual(errors,[]);console.log('Directory scrolling/sticky headers at desktop/mobile, delegated setup save/create, hidden directory, admin endpoint denials, selected-company isolation and ordinary-user denial passed.');
}finally{await browser.close();for(const [name,bytes] of Object.entries(before))fs.writeFileSync(root+'/'+name,bytes);}
