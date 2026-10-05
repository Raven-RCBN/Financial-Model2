export const PROJECT='project_opsl_15000ha_development';
export const FINDING_FIELDS=['finding','impact','department','area','priority','location','reference','auditYear'];
export const ACTION_FIELDS=['description','owner','email','dueDate'];
export const snapshot=(obj,keys)=>Object.fromEntries(keys.map(key=>[key,String(obj?.[key]||'')]));
export const actionsFor=entry=>entry.sourceReport?(entry.actions||[]):entry.actions?.length?entry.actions:(!entry.recommendation||entry.recommendation==='Corrective action pending assignment.'?[]:[{id:'legacy',description:entry.recommendation,owner:entry.owner||'',email:'',dueDate:entry.dueDate||'',status:entry.status||'Open',responses:[]}]);
export function applyLocal(entries,op,user){
 const next=structuredClone(entries),p=op.patch;let entry=next.find(e=>e.id===p.id);
 if(!p.operation){if(!entry)next.unshift({...p,createdBy:user,actions:p.actions||[],status:'Open',capturedAt:new Date().toISOString()});return next;}
 if(!entry)return next;
 entry.actions=actionsFor(entry);
 if(p.operation==='update-finding')Object.assign(entry,snapshot(p,FINDING_FIELDS),{observationImages:[...(entry.observationImages||[]),...(p.newImages||[])]});
 if(p.operation==='add-action'&&!entry.actions.some(a=>a.id===p.action.id))entry.actions.push({...p.action,status:'Open',responses:[]});
 const action=entry.actions.find(a=>a.id===p.actionId);
 if(p.operation==='update-action'&&action)Object.assign(action,p.action);
 if(p.operation==='reply'&&action){action.responses=[...(action.responses||[]),{id:op.operationId,text:p.text,author:user,dueDate:p.dueDate,createdAt:op.createdAt}];action.status=p.status;action.responseDueDate=p.dueDate;}
 if(entry.actions.length)entry.status=entry.actions.every(a=>a.status==='Closed')?'Closed':entry.actions.some(a=>a.status!=='Open')?'In progress':'Open';
 return next;
}
export function projected(workspace,user){return (workspace.operations||[]).reduce((entries,op)=>applyLocal(entries,op,user),structuredClone(workspace.entries||[]));}
export function timing(action){if(action.status==='Closed')return {tone:'closed',label:'Closed'};if(!action.dueDate)return {tone:'neutral',label:'No due date'};const today=new Date();today.setHours(0,0,0,0);const days=Math.round((new Date(action.dueDate+'T00:00:00')-today)/86400000);return days<0?{tone:'overdue',label:'Overdue'}:days<=7?{tone:'due',label:days===0?'Due today':'Due soon'}:{tone:'neutral',label:'On track'};}
