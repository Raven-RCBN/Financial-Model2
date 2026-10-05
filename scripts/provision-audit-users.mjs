// One-time administrator provisioning. Input contains names/emails only; credentials never enter Git.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {hashAuditPassword} from '../audit/audit-permissions.mjs';
const [directoryPath,projectId,inputPath,handoverPath]=process.argv.slice(2);
if(!directoryPath||!projectId||!inputPath||!handoverPath)throw new Error('Usage: node scripts/provision-audit-users.mjs DIRECTORY PROJECT INPUT_JSON PRIVATE_HANDOVER');
const requested=JSON.parse(await fs.readFile(inputPath,'utf8'));
let directories={};try{directories=JSON.parse(await fs.readFile(directoryPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const users=directories[projectId]||[],created=[],updated=[];
const lines=['AgIntel Audit — private initial account handover','Keep this file private. Do not commit it or send it to a shared channel.','Web and APK use the same username/password. Administrator login is unchanged.',''];
for(const item of requested){
 if(!item.name||['admin','finance'].includes(item.name.toLowerCase())||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email||''))throw new Error('Invalid or reserved account in input');
 if(Object.entries(directories).some(([project,list])=>project!==projectId&&list.some(user=>user.name===item.name)))throw new Error('Username already belongs to another project: '+item.name);
 let user=users.find(user=>user.name===item.name);
 if(!user){const password=randomBytes(18).toString('base64url');user={id:randomUUID(),name:item.name,email:item.email.toLowerCase(),status:'Active',auditPermissions:{create:false,recommend:false,respond:true},credential:hashAuditPassword(password)};users.push(user);created.push(item.name);lines.push(`Username: ${item.name}`,`Email: ${item.email}`,`Initial password: ${password}`,'');}
 else lines.push(`Existing account retained: ${item.name} (password unchanged)`,'');
 if(item.name==='milo'){user.status='Active';user.auditPermissions={create:true,recommend:true,respond:true};updated.push('milo: all Audit roles, no admin');}
}
directories[projectId]=users;
await fs.mkdir(path.dirname(handoverPath),{recursive:true,mode:0o700});
// Refuse to overwrite an earlier password handover on retry.
await fs.writeFile(handoverPath,lines.join('\n')+'\n',{mode:0o600,flag:'wx'});
try{await fs.copyFile(directoryPath,directoryPath+'.before-import-'+Date.now());}catch(e){if(e.code!=='ENOENT')throw e;}
const temp=directoryPath+'.provision-'+process.pid;
await fs.writeFile(temp,JSON.stringify(directories,null,2)+'\n',{mode:0o600});await fs.rename(temp,directoryPath);
console.log(JSON.stringify({created,updated,total:users.length,handover:handoverPath}));
