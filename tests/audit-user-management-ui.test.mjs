import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../standalone-audit/app.js',import.meta.url),'utf8');
test('delegated user manager sees Edit and can populate the user form',()=>{
 const elements=Object.fromEntries(['id','name','email','status','password','create','recommend','respond','companySetup','manageUsers','companyScope'].map(k=>[k,{value:k==='companyScope'?'all':'',focus(){}}]));
 const target={innerHTML:''},form={elements,querySelectorAll:()=>[]},edit={dataset:{editAuditUser:'u1'}},extra={};
 const scope={state:{currentSession:{role:'audit'},auditUsers:[{id:'u1',name:'Test user',email:'test@example.test',status:'Active',auditPermissions:{respond:true}}]},auditPermission:key=>key==='manageUsers',escapeHtml:String,qs:s=>s==='#auditUserDirectory'?target:s==='#auditUserForm'?form:extra,qsa:s=>s==='[data-edit-audit-user]'?[edit]:[]};
 vm.createContext(scope);vm.runInContext(source.slice(source.indexOf('function renderAuditDirectory()'),source.indexOf('function filenameFromDisposition')),scope);
 scope.renderAuditDirectory();assert(target.innerHTML.includes('data-edit-audit-user="u1"'));assert.equal(typeof edit.onclick,'function');edit.onclick();assert.equal(elements.email.value,'test@example.test');assert.equal(elements.respond.checked,true);
 scope.auditPermission=()=>false;scope.renderAuditDirectory();assert.equal(target.innerHTML,'');
});
