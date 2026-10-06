import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {entryTimeZone,locationTimeZone,fallbackTimeZone} from './timezone.mjs';
import {auditToday} from '../audit/audit-permissions.mjs';
const email = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
export const workflowOptions = {drafts:true,timeZone:fallbackTimeZone};
// Validate the configured IANA zone at startup, rather than fail during a write.
auditToday(new Date(), workflowOptions.timeZone);
export function enrollNotifications(entry, existing, actor, now = new Date()) {
  entry.timeZone = existing?.status !== 'Draft' && existing ? entryTimeZone(existing) : locationTimeZone(entry.geo);
  entry.creatorEmail = existing?.creatorEmail || (entry.createdBy === actor.userId ? actor.email : '') || '';
  entry.finalizedAt = existing?.finalizedAt || (entry.status !== 'Draft' ? now.toISOString() : '');
  entry.actions = (entry.actions || []).map(action => {
    const prior = existing?.status !== 'Draft' && existing?.actions?.find(a=>a.id === action.id);
    const changed = !prior || ['email','owner','dueDate','description'].some(k=>action[k] !== prior[k]);
    return {...action,notificationRevision:entry.status === 'Draft' ? '' : changed ? randomUUID() : prior.notificationRevision || '',assignedAt:entry.status === 'Draft' ? '' : changed ? now.toISOString() : prior.assignedAt || ''};
  });
  return entry;
}
export function notificationJobs(entries, directories, adminEmail, now = new Date(), fallbackZone = workflowOptions.timeZone) {
  const jobs=[];
  for(const entry of entries){
    if(entry.status === 'Draft')continue;
    const timeZone=entry.timeZone || (entry.geo ? entryTimeZone(entry) : fallbackZone),today=auditToday(now,timeZone);
    const users=directories[entry.projectId] || [];
    const creator=users.find(u=>u.name === entry.createdBy && u.status === 'Active');
    const creatorEmail=creator?.email || (entry.createdBy === 'admin' ? adminEmail : '') || entry.creatorEmail;
    for(const action of entry.actions || []){
      if(!action.notificationRevision || !action.assignedAt || !email(action.email))continue;
      const assignee=users.find(u=>u.name===action.owner && u.status==='Active' && u.email.toLowerCase()===action.email.toLowerCase());
      if(!assignee)continue;
      const types=['assigned'];
      const days=Math.round((Date.parse(action.dueDate)-Date.parse(today))/86400000);
      if(entry.status!=='Closed' && action.status!=='Closed'){
        if(days>0 && days<=2)types.push('reminder');
        if(days===0)types.push('due');
      }
      for(const type of types){
        // Do not send stale assignment emails after the deadline.
        if(type==='assigned' && (days<0 || action.status==='Closed' || entry.status==='Closed'))continue;
        const recipients=[...new Set((type==='assigned' ? [action.email] : [action.email,creatorEmail]).filter(email).map(v=>v.toLowerCase()))];
        for(const to of recipients){
          const key=createHash('sha256').update(JSON.stringify([entry.projectId,entry.id,action.id,action.notificationRevision,type,to])).digest('hex');
          const label=type==='assigned'?'New audit item assigned':type==='due'?'Audit action due today':'Audit action due soon';
          jobs.push({key,to,subject:`${label} — ${entry.entity || 'Audit'}`,text:`${label}\n\nCompany: ${entry.entity || ''}\nReport year: ${entry.auditYear || ''}\nFinding: ${entry.finding || ''}\nCorrective action: ${action.description}\nResponsible person: ${action.owner}\nCreated by: ${entry.createdBy}\nDue date: ${action.dueDate} (${timeZone})\n\nUpdate progress and upload evidence in View & Report:\nhttps://audit.digitalpalm.ai/app\n\nResponsible-person updates lock after the due date. An administrator can extend the deadline.`,entryId:entry.id,type});
        }
      }
    }
  }
  return jobs;
}
export function mailConfigured(env=process.env){return Boolean(env.AUDIT_SMTP_HOST && email(env.AUDIT_MAIL_FROM) && env.AUDIT_SMTP_USERNAME && env.AUDIT_SMTP_PASSWORD);}
function smtpSend(job){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.env.PYTHON || 'python3',[fileURLToPath(new URL('./send_mail.py',import.meta.url))],{stdio:['pipe','ignore','ignore']});
    const timer=setTimeout(()=>child.kill(),45000);child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('SMTP delivery failed'));});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(job));
  });
}
export function notificationWorker(dataDir,{send=smtpSend,enabled=mailConfigured,now=()=>new Date()}={}){
  let busy=false,lastError='',lastRun='';
  const ledgerFile=path.join(dataDir,'audit-email-ledger.json');
  async function save(ledger){const tmp=ledgerFile+'.tmp';await fs.writeFile(tmp,JSON.stringify(ledger),{mode:0o600});await fs.rename(tmp,ledgerFile);}
  async function run(){
    if(busy || !enabled())return;
    busy=true;
    try{
      let ledger={};try{ledger=JSON.parse(await fs.readFile(ledgerFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
      const entries=JSON.parse(await fs.readFile(path.join(dataDir,'audit-entries.json'),'utf8'));
      const directories=JSON.parse(await fs.readFile(path.join(dataDir,'audit-users.json'),'utf8'));
      const jobs=notificationJobs(entries,directories,process.env.AUDIT_ADMIN_EMAIL,now());
      for(const job of jobs){
        const prior=ledger[job.key];
        if(prior?.sentAt || prior?.retryAt && prior.retryAt > now().toISOString())continue;
        // Re-read authoritative records before each delivery, so closure/reassignment cancels queued reminders.
        const current=notificationJobs(JSON.parse(await fs.readFile(path.join(dataDir,'audit-entries.json'),'utf8')),JSON.parse(await fs.readFile(path.join(dataDir,'audit-users.json'),'utf8')),process.env.AUDIT_ADMIN_EMAIL,now());
        if(!current.some(j=>j.key===job.key))continue;
        try{await send(job);ledger[job.key]={sentAt:now().toISOString(),type:job.type};lastError='';}
        catch{ledger[job.key]={retryAt:new Date(now().getTime()+15*60000).toISOString(),type:job.type};lastError='Email delivery failed; retry scheduled.';}
        await save(ledger);
      }
      lastRun=now().toISOString();
    }catch{lastError='Email queue could not be processed; check private server configuration.';}
    finally{busy=false;}
  }
  return {run,status:()=>({configured:enabled(),lastRun,lastError,timeZone:workflowOptions.timeZone,adminEmailConfigured:email(process.env.AUDIT_ADMIN_EMAIL)})};
}
