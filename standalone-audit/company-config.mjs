import {auditCompanies} from './report-data.mjs';
const reject=message=>{throw Object.assign(new Error(message),{statusCode:400});};
export const reportKeys=['auditReportTitle','auditClientName','auditLocation','auditPreparedBy','auditPeriodStart','auditPeriodEnd','auditIssueDate','auditConfidentiality'];
export function companyProfiles(context){
 const settings=context.project.settings || {};
 return Object.fromEntries(auditCompanies(context).map(name=>{
  const primary=name===context.company.name;
  return [name,settings.auditCompanyProfiles?.[name] || {name,projectName:primary?context.project.name:name,auditSetup:structuredClone(settings.auditSetup || {years:['2026','2025','2024'],departments:['General'],areas:['SOP compliance']}),auditReport:primary?structuredClone(settings.auditReport || {}):{auditClientName:name,auditPreparedBy:settings.auditReport?.auditPreparedBy || 'Agrinexus International',auditConfidentiality:'Private & Confidential'},auditReportsByYear:primary?structuredClone(settings.auditReportsByYear || {}):{}}];
 }));
}
export function companyReportSettings(context,company,year){
 const p=companyProfiles(context)[company];
 return {auditReportTitle:`${year} Internal Audit Report`,auditLocation:'',auditPeriodStart:'',auditPeriodEnd:'',auditIssueDate:'',auditPreparedBy:'Agrinexus International',auditConfidentiality:'Private & Confidential',...p?.auditReport,...p?.auditReportsByYear?.[year],auditClientName:company};
}
export function saveCompanyProfile(context,patch){
 const p=patch.companyProfile;if(!p || typeof p!=='object')reject('Provide company details.');
 const name=String(p.name || '').trim();if(!name || name.length>200 || ['__proto__','constructor','prototype'].includes(name))reject('Provide a valid company name.');
 const profiles=companyProfiles(context);
 if(patch.newCompany && Object.hasOwn(profiles,name))reject('This company already exists. Select it to edit its details.');
 if(!patch.newCompany && !Object.hasOwn(profiles,name))reject('Select an existing company or choose Add company.');
 const projectName=String(p.projectName || '').trim();if(!projectName)reject('Project / estate name is required.');
 const auditSetup={};for(const key of ['years','departments','areas']){
  const list=p.auditSetup?.[key];if(!Array.isArray(list) || !list.length || list.length>250 || list.some(v=>typeof v!=='string'||!v.trim()||v.length>200))reject('Provide report years, departments and audit areas for this company.');
  auditSetup[key]=[...new Set(list.map(v=>v.trim()))];
 }
 if(auditSetup.years.some(y=>!/^\d{4}$/.test(y)))reject('Report years must have four digits.');
 const year=String(patch.reportYear || '');if(!auditSetup.years.includes(year))reject('Choose a report year from this company’s setup.');
 const cleanReport=raw=>{
  const report={};for(const key of reportKeys){const value=String(raw?.[key] || '').trim();if(value.length>500)reject('Report settings must be under 500 characters per field.');if(['auditPeriodStart','auditPeriodEnd','auditIssueDate'].includes(key)&&value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))reject('Enter valid report dates.');report[key]=value;}
  if(report.auditPeriodStart&&report.auditPeriodEnd&&report.auditPeriodEnd<report.auditPeriodStart)reject('Report period end cannot precede its start.');
  return {...report,auditClientName:name};
 };
 const report=cleanReport(p.auditReport),editedReports={};
 for(const [y,r] of Object.entries(p.editedReports || {})){if(!auditSetup.years.includes(y))reject('Every edited report year must be in the company setup.');editedReports[y]=cleanReport(r);}

 report.auditClientName=name;
 const old=profiles[name] || {};
 profiles[name]={name,projectName,auditSetup,auditReport:old.auditReport || {auditPreparedBy:report.auditPreparedBy,auditConfidentiality:report.auditConfidentiality},auditReportsByYear:{...old.auditReportsByYear,...editedReports,[year]:report}};
 return {...context,project:{...context.project,settings:{...context.project.settings,auditCompanies:[...new Set([...auditCompanies(context),name])],auditCompanyProfiles:profiles}}};
}
export function validateCompanyFields(context,entry){
 const profile=context.project.settings?.auditCompanyProfiles?.[entry.entity];
 if(!profile || entry.status==='Draft')return;
 for(const [field,list] of [['auditYear','years'],['department','departments'],['area','areas']])if(!profile.auditSetup[list].includes(String(entry[field] || '')))reject(`Select ${field==='auditYear'?'a report year':field==='department'?'a department':'an audit area'} configured for this company.`);
}
