import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {actionLocked,applyAuditWrite} from '../audit/audit-permissions.mjs';
import {normalizeTextStyles} from '../audit/text-format.mjs';
const fail=(message,statusCode=403)=>{throw Object.assign(new Error(message),{statusCode});};
const draftPath=(root,project,entry,action,user)=>path.join(root,'response-drafts',createHash('sha256').update(JSON.stringify([project,entry,action,user])).digest('hex')+'.json');
export async function loadResponseDraft(root,project,entry,action,user){
 try{return JSON.parse(await fs.readFile(draftPath(root,project,entry,action,user),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}
}
export async function writeResponseDraft(root,project,entry,action,user,draft){
 const file=draftPath(root,project,entry,action,user);await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
 const temp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(draft),{mode:0o600});await fs.rename(temp,file);
}
export async function removeResponseDraft(root,project,entry,action,user){await fs.rm(draftPath(root,project,entry,action,user),{force:true});}
export function prepareResponse(actor,patch,entry,stored,options={}){
 if(!entry)fail('Finding not found.',404);
 if(entry.status==='Draft')fail('The finding must be finalized before responding.',409);
 const action=(entry.actions||[]).find(a=>a.id===patch.actionId);
 if(!action)fail('Recommendation not found.',404);
 if(!actor.admin&&(!actor.respond||!actor.email||actor.email.toLowerCase()!==String(action.email||'').toLowerCase()))fail('Only the assigned respondent can update this response.');
 if(!actor.admin&&actionLocked(action,options))fail('The due date has passed. Ask an administrator to extend it.');
 if((patch.draftVersion||'')!==(stored?.version||''))fail('Your draft changed in another window. Reload before saving.',409);
 if(patch.baseUpdatedAt!==entry.updatedAt)fail('This issue changed. Reload before saving your response.',409);
 const replyId=String(patch.replyId||'');
 const original=replyId?(action.responses||[]).find(r=>r.id===replyId):null;
 if(replyId&&!original)fail('Response not found.',404);
 if(original&&!actor.admin&&(original.author!==actor.userId||original.email.toLowerCase()!==actor.email.toLowerCase()))fail('You can edit only your own response.');
 const text=String(patch.text||'').trim();
 const permitted=new Set((original?.images||[]).map(i=>i.url).filter(Boolean));
 if(!Array.isArray(patch.images)||patch.images.length>8)fail('Use up to 8 photos per response.',400);
 const images=patch.images.map(image=>{
  if(!image||typeof image!=='object')fail('Invalid response image.',400);
  const result={name:String(image.name||'Action evidence').slice(0,200),description:String(image.description||'').slice(0,2000)};
  if(image.dataUrl){if(typeof image.dataUrl!=='string'||!/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(image.dataUrl)||image.dataUrl.length>4*1024*1024)fail('Use JPEG, PNG or WebP photos up to 3 MB each.',400);return {...result,dataUrl:image.dataUrl};}
  if(!permitted.has(image.url))fail('Existing photos must belong to the response you are editing.');
  return {...result,url:image.url};
 });
 const now=(options.now||new Date()).toISOString();
 const draft={version:randomUUID(),replyId,text,textStyles:normalizeTextStyles(text,patch.textStyles),dueDate:String(patch.dueDate||''),images,savedAt:now};
 // Reuse the established reply validator, identity, deadline and date rules.
 const validated=applyAuditWrite(actor,{operation:'reply',actionId:action.id,text:text||'Draft response',textStyles:draft.textStyles,dueDate:draft.dueDate,status:action.status||'Open',images:[]},entry,options);
 if(patch.operation==='save-reply-draft')return {draft};
 if(!text)fail('Describe the corrective action before submitting.',400);
 const added=validated.actions.find(a=>a.id===action.id).responses.at(-1);
 const reply={...added,images,...(original?{id:original.id,createdAt:original.createdAt,author:original.author,email:original.email}:{})};
 const actions=validated.actions.map(a=>a.id!==action.id?a:{...a,responses:original?(action.responses||[]).map(r=>r.id===replyId?reply:r):[...(action.responses||[]),reply]});
 return {entry:{...validated,actions}};
}
