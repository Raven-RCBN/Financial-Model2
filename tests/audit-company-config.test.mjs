import test from 'node:test';import assert from 'node:assert/strict';
import {companyProfiles,saveCompanyProfile,companyReportSettings,validateCompanyFields} from '../standalone-audit/company-config.mjs';
import {auditIdentity,auditUserInCompany,validateAuditAssignees} from '../audit/audit-permissions.mjs';
const base={company:{name:'OBAN'},project:{id:'p',name:'OBAN estate',settings:{auditCompanies:['OBAN','Octavus'],auditSetup:{years:['2025','2024'],departments:['Mill'],areas:['SOP']},auditReport:{auditClientName:'OBAN',auditLocation:'Nigeria'},auditReportsByYear:{2024:{auditReportTitle:'OBAN 2024'}}}}};
const patch={newCompany:false,reportYear:'2025',companyProfile:{name:'Octavus',projectName:'Octavus estate',auditSetup:{years:['2025','2026'],departments:['Stores'],areas:['Inventory']},auditReport:{auditReportTitle:'Octavus 2025',auditLocation:'Malaysia'},editedReports:{2026:{auditReportTitle:'Octavus 2026',auditLocation:'Malaysia'}}}};
test('profiles preserve old setup without sharing report identity; saves isolate company and report years',()=>{
 const p=companyProfiles(base);assert.equal(p.OBAN.auditReport.auditLocation,'Nigeria');assert.equal(p.Octavus.auditReport.auditLocation,undefined);
 const c=saveCompanyProfile(base,patch);assert.deepEqual(c.project.settings.auditCompanyProfiles.OBAN,p.OBAN);
 assert.equal(companyReportSettings(c,'Octavus','2025').auditReportTitle,'Octavus 2025');assert.equal(companyReportSettings(c,'Octavus','2026').auditReportTitle,'Octavus 2026');assert.equal(companyReportSettings(c,'OBAN','2024').auditReportTitle,'OBAN 2024');assert.equal(base.project.settings.auditCompanyProfiles,undefined);
 assert.throws(()=>saveCompanyProfile(c,{...patch,newCompany:true}),/already exists/);
 assert.throws(()=>saveCompanyProfile(c,{...patch,companyProfile:{...patch.companyProfile,auditReport:{auditIssueDate:'2026-02-30'}}}),/valid report dates/);
 validateCompanyFields(c,{status:'Draft',entity:'Octavus'});assert.throws(()=>validateCompanyFields(c,{status:'Open',entity:'Octavus',auditYear:'2025',department:'Mill',area:'Inventory'}),/department/);
});
test('legacy users retain all companies; selected-company assignment requires respondent permission',()=>{
 const legacy={name:'old',email:'old@example.test',status:'Active',auditPermissions:{respond:true}};
 const scoped={...legacy,name:'scope',email:'scope@example.test',companyScope:'selected',companies:['Octavus']};
 assert.equal(auditIdentity({userId:'old'},[legacy]).companyScope,'all');assert(auditUserInCompany(legacy,'OBAN'));assert(!auditUserInCompany(scoped,'OBAN'));assert(auditUserInCompany(scoped,'Octavus'));
 const p={actions:[{owner:'scope',email:scoped.email}]};assert.throws(()=>validateAuditAssignees(p,[scoped],[],{company:'OBAN'}),/this company/);validateAuditAssignees(p,[scoped],[],{company:'Octavus'});
 assert.throws(()=>validateAuditAssignees(p,[{...scoped,auditPermissions:{}}],[],{company:'Octavus'}),/respondent permission/);
});
