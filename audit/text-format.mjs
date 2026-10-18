// Formatting is optional metadata over plain text, never executable HTML.
export function normalizeTextStyles(text, styles) {
  const length=Array.from(String(text || '')).length;
  return (Array.isArray(styles)?styles:[]).slice(0,5000).filter(s=>s && Number.isInteger(s.start) && Number.isInteger(s.end) && s.start>=0 && s.end>s.start && s.start<length).map(s=>({start:s.start,end:Math.min(s.end,length),bold:s.bold===true,italic:s.italic===true,underline:s.underline===true})).filter(s=>s.bold||s.italic||s.underline);
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderStyledText(text, styles=[]) {
  const chars=Array.from(String(text || '')),runs=normalizeTextStyles(text,styles);
  const points=[...new Set([0,chars.length,...runs.flatMap(r=>[r.start,r.end])])].sort((a,b)=>a-b);
  return points.slice(0,-1).map((start,i)=>{
    const end=points[i+1],active=runs.filter(r=>r.start<=start && r.end>=end),tags=[['bold','b'],['italic','i'],['underline','u']].filter(([key])=>active.some(r=>r[key])).map(([,tag])=>tag);
    return tags.map(t=>`<${t}>`).join('')+escape(chars.slice(start,end).join('')).replace(/\n/g,'<br>')+tags.slice().reverse().map(t=>`</${t}>`).join('');
  }).join('');
}
