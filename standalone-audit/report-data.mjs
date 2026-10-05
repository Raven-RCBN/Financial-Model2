export function auditCompanies(context) {
  return [...new Set([context.company.name, ...(context.project.settings?.auditCompanies || [])].filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()))];
}
export function selectedCompany(context, requested) {
  const name=String(requested || context.company.name).trim();
  if(!auditCompanies(context).includes(name))throw Object.assign(new Error('Select a company from the Audit company directory.'),{statusCode:400});
  return name;
}
export function companyEntries(entries, context, company) {
  return entries.filter(e=>(e.entity || context.company.name)===company);
}
export function reportListing(entries, context, query) {
  const company=selectedCompany(context,query.get('company'));
  const scope=companyEntries(entries,context,company);
  const year=query.get('auditYear')||'';
  const yearCounts=scope.reduce((o,e)=>(o[e.auditYear]=(o[e.auditYear]||0)+1,o),{});
  let items=scope.filter(e=>!year||e.auditYear===year);
  const q=(query.get('q')||'').toLowerCase(),department=query.get('department'),status=query.get('status');
  if(q)items=items.filter(e=>[e.finding,e.department,e.location,e.reference,e.impact,e.recommendation,e.sourceReport?.managementResponse].some(v=>String(v||'').toLowerCase().includes(q)));
  if(department)items=items.filter(e=>e.department===department);
  if(status)items=items.filter(e=>e.status===status);
  items.sort((a,b)=>(a.sourceReport?.issue||10000)-(b.sourceReport?.issue||10000)||String(b.capturedAt).localeCompare(a.capturedAt)||a.id.localeCompare(b.id));
  const total=items.length,pageSize=Math.min(5000,Math.max(1,Number(query.get('pageSize'))||10));
  const page=Math.min(Math.max(1,Math.ceil(total/pageSize)),Math.max(1,Number(query.get('page'))||1));
  const summary={total,high:0,evidence:0,openActions:0,departments:[]};
  const departments=new Map();
  for(const e of items){const high=['High','Critical'].includes(e.priority),open=e.status!=='Closed';summary.high+=Number(high);summary.evidence+=Number(Boolean(e.sourceReport||e.photoUrl||e.photoDataUrl||e.observationImages?.length));summary.openActions+=(e.actions||[]).filter(a=>a.status!=='Closed').length;
    const d=departments.get(e.department)||{total:0,high:0,medium:0,low:0,open:0};d.total++;d.high+=Number(high);d.medium+=Number(e.priority==='Medium');d.low+=Number(e.priority==='Low');d.open+=Number(open);departments.set(e.department,d);
  }
  summary.departments=[...departments.entries()];
  return {backend:'json',company,page,pageSize,total,yearCounts,summary,items:items.slice((page-1)*pageSize,page*pageSize)};
}
