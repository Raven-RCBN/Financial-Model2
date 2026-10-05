import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {auditSeedEntries2024,auditSeedEntries2025} from '../../audit/audit-store.mjs';
const seeds=new Map([...auditSeedEntries2024,...auditSeedEntries2025].map(e=>[e.id,e]));
export function mergeSourceRecords(existing,incoming){
 const seedFields=['finding','impact','recommendation','owner','dueDate','status','department','priority'];
 const archived=[],preserved=[];
 for(const e of existing){const seed=seeds.get(e.id);if(seed&&seedFields.every(k=>String(e[k]||'')===String(seed[k]||''))&&!e.actions?.length&&!e.mobileOperations?.length)archived.push(e);else preserved.push(e);}
 const map=new Map(preserved.map(e=>[e.id,e]));
 for(const e of incoming){const old=map.get(e.id);if(old&&!old.sourceReport)throw new Error('Incoming report ID collides with a field finding');map.set(e.id,{...e,...(old?{actions:old.actions||[],status:old.status,mobileOperations:old.mobileOperations||[],createdBy:old.createdBy,capturedAt:old.capturedAt,updatedAt:old.updatedAt}:{})});}
 return {entries:[...map.values()],archived,preserved:preserved.filter(e=>!incoming.some(i=>i.id===e.id)).length};
}
const atomic=async(file,value)=>{const tmp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600});await fs.rename(tmp,file);};
export async function importSourceReports(dataDir,packageDir){
 const data=JSON.parse(await fs.readFile(path.join(packageDir,'import.json'),'utf8'));
 if(data.schemaVersion!==1||data.entries.length!==44||Object.keys(data.reports).sort().join(',')!=='2024,2025')throw new Error('Invalid report package');
 const entryFile=path.join(dataDir,'audit-entries.json'),contextFile=path.join(dataDir,'audit-context.json');
 const originalEntries=JSON.parse(await fs.readFile(entryFile,'utf8')),originalContext=JSON.parse(await fs.readFile(contextFile,'utf8'));
 for(const e of data.entries)if(e.projectId!==originalContext.project.id||e.entity!==data.companyName||!e.sourceReport)throw new Error('Report project/company mismatch');
 for(const [year,r] of Object.entries(data.reports)){const raw=await fs.readFile(path.join(packageDir,'reports',year,'original.pdf'));if(crypto.createHash('sha256').update(raw).digest('hex')!==r.sha256)throw new Error('Source PDF checksum mismatch');}
 const merged=mergeSourceRecords(originalEntries,data.entries),context=structuredClone(originalContext);
 const oldCompany=context.company.name;
 context.company.name=data.companyName;context.project.name=data.projectName;
 const settings=context.project.settings||={};
 settings.auditCompanies=[...new Set([data.companyName,...(settings.auditCompanies||[]),oldCompany,...merged.entries.map(e=>e.entity).filter(Boolean)])];
 settings.auditSourceReports=data.reports;settings.auditReportsByYear=Object.fromEntries(Object.entries(data.reports).map(([y,r])=>[y,r.settings]));
 settings.auditReport={...settings.auditReport,...data.reports['2025'].settings};
 settings.auditSetup={...settings.auditSetup,years:[...new Set(['2024','2025',...(settings.auditSetup?.years||[])])].sort(),departments:[...new Set([...data.entries.map(e=>e.department),...(settings.auditSetup?.departments||[])])],areas:settings.auditSetup?.areas?.length?settings.auditSetup.areas:['Source report audit issue','SOP compliance']};
 // Records with no company keep their previous context; imported OBAN records are explicit.
 for(const e of merged.entries)if(!e.entity)e.entity=oldCompany;
 const backup=path.join(path.dirname(dataDir),'backups','before-report-import-'+Date.now());await fs.mkdir(backup,{recursive:true,mode:0o700});
 await atomic(path.join(backup,'audit-entries.json'),originalEntries);await atomic(path.join(backup,'audit-context.json'),originalContext);await atomic(path.join(backup,'superseded-sample-entries.json'),merged.archived);
 await fs.mkdir(path.join(dataDir,'reports'),{recursive:true,mode:0o700});
 for(const year of Object.keys(data.reports)){const dest=path.join(dataDir,'reports',year);await fs.cp(path.join(packageDir,'reports',year),dest,{recursive:true});await fs.chmod(dest,0o700);for(const name of await fs.readdir(dest))await fs.chmod(path.join(dest,name),0o600);}
 const pending=path.join(dataDir,'report-import.pending.json');await atomic(pending,{backup});
 try{await atomic(entryFile,merged.entries);await atomic(contextFile,context);await fs.unlink(pending);}catch(e){await atomic(entryFile,originalEntries);await atomic(contextFile,originalContext);await fs.unlink(pending);throw e;}
 return {importedSections:data.entries.length,byYear:{2024:22,2025:22},preservedAdditionalRecords:merged.preserved,supersededSamples:merged.archived.length,totalRecords:merged.entries.length,backup};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const [dir,pkg]=process.argv.slice(2);console.log(JSON.stringify(await importSourceReports(dir,pkg)));}
