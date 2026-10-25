import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {entryTimeZone,locationTimeZone,fallbackTimeZone} from './timezone.mjs';
import {auditToday,auditUserInCompany} from '../audit/audit-permissions.mjs';
import {renderStyledText} from '../audit/text-format.mjs';
const email = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
export const workflowOptions = {drafts:true,lockFinalized:true,timeZone:fallbackTimeZone};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mailLabels={assigned:'New audit item finalized and assigned',reminder:'Audit recommendation due in 2 days',due:'Audit recommendation due today',reopened:'Audit item reopened as draft',refinalized:'Updated audit item finalized'};
export function notificationContent(entry,actions,type,timeZone) {
  const label=mailLabels[type],company=entry.entity || 'Not recorded';
  const details=[['Company',company],['Report year',entry.auditYear || 'Not recorded'],['Audit item',entry.id],['Department',entry.department || 'Not recorded'],['Audit area',entry.area || 'Not recorded'],['Location',entry.location || 'Not recorded'],['Priority',entry.priority || 'Not recorded'],['Item status',entry.status],['Created by',entry.createdBy || 'Not recorded'],['Responsible owner',entry.owner || 'Not recorded'],['Responsible owner email',entry.ownerEmail || 'Not recorded'],...(entry.owner2 || entry.owner2Email ? [['Owner 2',entry.owner2 || 'Not recorded'],['Owner 2 email',entry.owner2Email || 'Not recorded']] : [])];
  const finding=entry.finding || 'Not recorded',impact=entry.impact || 'Not recorded';
  const instruction=type==='reopened'?'The creator can revise the draft. Assigned-user corrective-action updates are paused until it is finalized again.':'Review this company and report year in View & Report. Record the corrective action taken and upload supporting evidence. Responsible-person updates lock after the due date in the timezone shown; an administrator can extend the deadline.';
  const target=new URLSearchParams({company:entry.entity || '',year:String(entry.auditYear || ''),item:entry.id});
  if(actions.length===1 && actions[0].id)target.set('action',actions[0].id);
  const link='https://audit.agrinexus.ai/app?'+target.toString();
  const actionDetails=actions.map((a,i)=>({heading:`Recommendation ${i+1}`,description:a.description || 'Not recorded',rows:[['Responsible person',a.owner || 'Not assigned'],['Responsible email',a.email || 'Not assigned'],['Due date',a.dueDate ? `${a.dueDate} (${timeZone})` : 'Not set'],['Action status',a.status || 'Open']],styles:a.descriptionStyles}));
  const evidence=(entry.observationImages||[]).length || Number(Boolean(entry.photoUrl || entry.photoDataUrl));
  const text=[label,details.map(([k,v])=>`${k}: ${v}`).join('\n'),`Observations / Findings:\n${finding}`,`Impact:\n${impact}`,...actionDetails.map(a=>`${a.heading}:\n${a.description}\n${a.rows.map(([k,v])=>`${k}: ${v}`).join('\n')}`),`Evidence images: ${evidence}. View photos in the signed-in webapp.`,instruction,link].join('\n\n');
  const rows=items=>items.map(([k,v])=>`<tr><th align="left" style="padding:6px 14px 6px 0;vertical-align:top">${escapeHtml(k)}</th><td style="padding:6px 0">${escapeHtml(v)}</td></tr>`).join('');
  const html=`<!doctype html><html><body style="font-family:Arial,sans-serif;color:#214d34;line-height:1.5"><main style="max-width:720px;margin:auto;padding:24px"><h1 style="font-size:22px">${escapeHtml(label)}</h1><table>${rows(details)}</table><h2 style="font-size:18px">Observations / Findings</h2><div>${renderStyledText(finding,entry.findingStyles)}</div><h2 style="font-size:18px">Impact</h2><div>${renderStyledText(impact,entry.impactStyles)}</div>${actionDetails.map(a=>`<section style="border-top:1px solid #dce7db;margin-top:20px"><h2 style="font-size:18px">${a.heading}</h2><div>${renderStyledText(a.description,a.styles)}</div><table>${rows(a.rows)}</table></section>`).join('')}<p>Evidence images: ${evidence}. View photos in the signed-in webapp.</p><p>${escapeHtml(instruction)}</p><p><a href="${escapeHtml(link)}">Open Audit — View &amp; Report</a></p></main></body></html>`;
  const subjectLabel=type==='reminder'?'REMINDER':type==='due'?'DUE TODAY':label;
  return {subject:`${subjectLabel} — ${company} — ${entry.auditYear || 'Year not recorded'}`.replace(/[\r\n]+/g,' '),text,html};
}
// Validate the configured IANA zone at startup, rather than fail during a write.
auditToday(new Date(), workflowOptions.timeZone);
export function enrollNotifications(entry, existing, actor, now = new Date()) {
  entry.timeZone = existing?.status !== 'Draft' && existing ? entryTimeZone(existing) : locationTimeZone(entry.geo);
  entry.creatorEmail = existing?.creatorEmail || (entry.createdBy === actor.userId ? actor.email : '') || '';
  entry.finalizedAt = existing?.finalizedAt || (entry.status !== 'Draft' ? now.toISOString() : '');
  // Lifecycle metadata is server-owned; never accept caller-supplied notices.
  entry.reopenedAt = existing?.reopenedAt || '';
  entry.reopenedBy = existing?.reopenedBy || '';
  entry.lifecycleNotice = existing?.lifecycleNotice || null;
  const reopening=existing && existing.status!=='Draft' && entry.status==='Draft' && actor.admin;
  const refinalizing=existing?.status==='Draft' && existing.reopenedAt && entry.status!=='Draft';
  if(reopening){entry.reopenedAt=now.toISOString();entry.reopenedBy=actor.userId;}
  if(reopening || refinalizing){
    entry.lifecycleNotice={revision:randomUUID(),type:reopening?'reopened':'refinalized',at:now.toISOString(),assignees:((reopening?existing.actions:entry.actions) || []).map(a=>({name:a.owner,email:a.email}))};
  }
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
    const timeZone=entry.timeZone || (entry.geo ? entryTimeZone(entry) : fallbackZone),today=auditToday(now,timeZone);
    const users=directories[entry.projectId] || [];
    const creator=users.find(u=>u.name === entry.createdBy && u.status === 'Active');
    const creatorEmail=creator?.email || (entry.createdBy === 'admin' ? adminEmail : '') || entry.creatorEmail;
    const ownerEmails=[entry.ownerEmail,entry.owner2Email].filter(Boolean).map(address=>users.find(u=>u.status==='Active' && String(u.email).toLowerCase()===String(address).toLowerCase() && auditUserInCompany(u,entry.entity))?.email).filter(Boolean);
    const notice=entry.lifecycleNotice;
    if(notice?.revision && ['reopened','refinalized'].includes(notice.type)){
      const recipients=[...ownerEmails,creatorEmail,...(notice.assignees || []).filter(a=>users.some(u=>u.name===a.name && u.status==='Active' && String(u.email).toLowerCase()===String(a.email).toLowerCase() && auditUserInCompany(u,entry.entity))).map(a=>a.email)];
      for(const to of new Set(recipients.filter(email).map(v=>v.toLowerCase()))){
        const key=createHash('sha256').update(JSON.stringify([entry.projectId,entry.id,notice.revision,notice.type,to])).digest('hex');
        jobs.push({key,to,type:notice.type,entryId:entry.id,...notificationContent(entry,entry.actions || [],notice.type,timeZone)});
      }
    }
    if(entry.status === 'Draft')continue;
    for(const action of entry.actions || []){
      if(!action.notificationRevision || !action.assignedAt || !email(action.email))continue;
      const assignee=users.find(u=>u.name===action.owner && u.status==='Active' && u.email.toLowerCase()===action.email.toLowerCase());
      if(!assignee || !auditUserInCompany(assignee,entry.entity))continue;
      const types=notice?.type==='refinalized' && action.assignedAt===notice.at ? [] : ['assigned'];
      const days=Math.round((Date.parse(action.dueDate)-Date.parse(today))/86400000);
      if(entry.status!=='Closed' && action.status!=='Closed'){
        if(days===2)types.push('reminder');
        if(days===0)types.push('due');
      }
      for(const type of types){
        // Do not send stale assignment emails after the deadline.
        if(type==='assigned' && (days<0 || action.status==='Closed' || entry.status==='Closed'))continue;
        const recipients=[...new Set((type==='assigned' ? [action.email,...ownerEmails] : [action.email,creatorEmail,...ownerEmails]).filter(email).map(v=>v.toLowerCase()))];
        for(const to of recipients){
          const key=createHash('sha256').update(JSON.stringify([entry.projectId,entry.id,action.id,action.notificationRevision,type,to])).digest('hex');
          jobs.push({key,to,entryId:entry.id,actionId:action.id,type,...notificationContent(entry,[action],type,timeZone)});
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
        const fresh=current.find(j=>j.key===job.key);
        if(!fresh)continue;
        try{await send(fresh);ledger[job.key]={sentAt:now().toISOString(),type:fresh.type,entryId:fresh.entryId,actionId:fresh.actionId || ''};lastError='';}
        catch{ledger[job.key]={retryAt:new Date(now().getTime()+15*60000).toISOString(),type:job.type};lastError='Email delivery failed; retry scheduled.';}
        await save(ledger);
      }
      lastRun=now().toISOString();
    }catch{lastError='Email queue could not be processed; check private server configuration.';}
    finally{busy=false;}
  }
  return {run,status:()=>({configured:enabled(),lastRun,lastError,timeZone:workflowOptions.timeZone,adminEmailConfigured:email(process.env.AUDIT_ADMIN_EMAIL)})};
}
