// Synthetic localhost fixture; never reads production data or enables email delivery.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {hashAuditPassword} from '../../audit/audit-permissions.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'audit-mobile-synthetic-'));
const projectId='project_opsl_15000ha_development',company='Training Plantation',password='MobileTest-Only-2026';
const profile={name:company,projectName:'Offline training',auditSetup:{years:[String(new Date().getFullYear())],departments:['Plantation'],areas:['SOP compliance']},auditReport:{}};
const other='Restricted Training Plantation';
const context={company:{name:company},project:{id:projectId,name:'Offline training',settings:{auditCompanies:[company,other],auditCompanyProfiles:{[company]:profile,[other]:{...profile,name:other,projectName:other}}}}};
const users=[['mobile.milo','milo@example.test',{create:true,recommend:true,respond:true}],['mobile.owner','owner@example.test',{create:false,recommend:false,respond:true}]].map(([name,email,auditPermissions])=>({id:name,name,email,auditPermissions,status:'Active',companyScope:'all',credential:hashAuditPassword(password)}));
users.push({id:'mobile.scoped',name:'mobile.scoped',email:'scoped@example.test',status:'Active',companyScope:'selected',companies:[other],auditPermissions:{respond:true},credential:hashAuditPassword(password)});
for(const [name,data] of Object.entries({'audit-context.json':context,'audit-users.json':{[projectId]:users},'audit-entries.json':[],'admin-user.json':{name:'admin',credential:hashAuditPassword(password)}}))await fs.writeFile(path.join(directory,name),JSON.stringify(data),{mode:0o600});
// Allowlist environment variables: no inherited SMTP, database or deployment credentials.
const env={PATH:process.env.PATH,HOME:process.env.HOME,PYTHON:process.env.PYTHON||'python3',PORT:'4187',AUDIT_DATA_DIR:directory,AUDIT_SESSION_SECRET:crypto.randomBytes(48).toString('hex')};
const child=spawn(process.execPath,[path.join(root,'standalone-audit/server.mjs')],{env,stdio:'inherit'});
console.log('Synthetic mobile fixture: http://127.0.0.1:4187/mobile-app/index.html');
console.log('Test users: mobile.milo / mobile.owner. Test-only password: '+password);
console.log('Temporary data: '+directory+' (removed when stopped normally)');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',async code=>{await fs.rm(directory,{recursive:true,force:true});process.exitCode=code||0;});
