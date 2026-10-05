// Read-only export from FM2. Never writes or deletes the source database or uploads.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const [sourceData,sourceApp,out]=process.argv.slice(2);
if(!sourceData||!sourceApp||!out)throw new Error('Usage: export-data.mjs FM2_DATA_DIR FM2_APP_DIR NEW_SNAPSHOT_DIR');
await fs.mkdir(out,{recursive:false,mode:0o700});
const db=JSON.parse(await fs.readFile(path.join(sourceData,'plantation-financial-model.db.json'),'utf8'));
const id='project_opsl_15000ha_development',project=db.projects.find(p=>p.id===id),company=db.companies.find(c=>c.id===project?.companyId);
if(!project||!company)throw new Error('Audit project not found.');
const directories=JSON.parse(await fs.readFile(path.join(sourceData,'audit-users.json'),'utf8'));
const entries=JSON.parse(await fs.readFile(path.join(sourceData,'audit-entries.json'),'utf8')).filter(e=>e.projectId===id);
const settings=Object.fromEntries(['auditSetup','auditReport','brandingLogoUrl'].filter(k=>project.settings?.[k]!==undefined).map(k=>[k,project.settings[k]]));
const context={company:{id:company.id,name:company.name},project:{id,companyId:company.id,name:project.name,settings}};
for(const [name,value] of Object.entries({'audit-context.json':context,'audit-users.json':{[id]:directories[id]||[]},'audit-entries.json':entries}))await fs.writeFile(path.join(out,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});
const segment=id.toLowerCase().replace(/[^a-z0-9]+/g,'-');
try{await fs.cp(path.join(sourceApp,'audit/uploads',segment),path.join(out,'uploads',segment),{recursive:true,errorOnExist:true});}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.mkdir(path.join(out,'branding'),{mode:0o700});
for(const name of await fs.readdir(path.join(sourceApp,'public'))){if(/^[\w.-]+\.(png|jpe?g|webp|svg)$/i.test(name))await fs.copyFile(path.join(sourceApp,'public',name),path.join(out,'branding',name));}
const manifest={exportedAt:new Date().toISOString(),projectId:id,users:(directories[id]||[]).length,entries:entries.length,files:{}};
async function walk(dir,relative=''){for(const item of await fs.readdir(dir,{withFileTypes:true})){if(item.isSymbolicLink())throw new Error('Unexpected symlink in export');const rel=path.join(relative,item.name),file=path.join(dir,item.name);if(item.isDirectory())await walk(file,rel);else manifest.files[rel]=crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');}}
await walk(out);await fs.writeFile(path.join(out,'migration-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({exported:out,users:manifest.users,entries:manifest.entries,files:Object.keys(manifest.files).length}));
