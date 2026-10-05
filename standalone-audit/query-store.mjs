import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {selectedCompany} from './report-data.mjs';
const script=fileURLToPath(new URL('./query_index.py',import.meta.url));
const cache=new Map(),pending=new Map();let cacheBytes=0;
export function runQueryWorker(args,python=process.env.PYTHON||'python3'){
 return new Promise((resolve,reject)=>{const child=spawn(python,[script],{stdio:['pipe','pipe','pipe']}),parts=[];let size=0;const timer=setTimeout(()=>child.kill(),60000);child.stdout.on('data',chunk=>{size+=chunk.length;if(size>40*1024*1024)child.kill();else parts.push(chunk);});child.stderr.resume();child.on('error',reject);child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(new Error('Audit query index could not be read.'));try{resolve(JSON.parse(Buffer.concat(parts)));}catch(e){reject(e);}});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(args));});
}
export async function indexedReportListing(dataDir,context,params){
 const company=selectedCompany(context,params.get('company')),stat=await fs.stat(path.join(dataDir,'audit-entries.json'));
 const query=Object.fromEntries(['auditYear','department','status','q','page','pageSize'].map(k=>[k,params.get(k)||'']).filter(([,v])=>v));
 const key=JSON.stringify([dataDir,context.project.id,context.company.name,company,stat.ino,stat.size,stat.mtimeMs,query]);
 if(cache.has(key))return cache.get(key).value;
 if(pending.has(key))return pending.get(key);
 const work=(async()=>{
 const value=await runQueryWorker({dataDir,projectId:context.project.id,fallbackCompany:context.company.name,company,query});
 const bytes=Buffer.byteLength(JSON.stringify(value));cache.set(key,{value,bytes});cacheBytes+=bytes;
 while(cache.size>100||cacheBytes>24*1024*1024){const oldest=cache.keys().next().value;cacheBytes-=cache.get(oldest).bytes;cache.delete(oldest);}
 return value;
 })();pending.set(key,work);
 try{return await work;}finally{pending.delete(key);}
}
// Export and write lookups must never silently truncate at the listing page limit.
export async function allStandaloneEntries(dbPath,projectId,year=''){
 const rows=JSON.parse(await fs.readFile(path.join(path.dirname(dbPath),'audit-entries.json'),'utf8'));
 return rows.filter(e=>e.projectId===projectId&&(!year||String(e.auditYear)===String(year)));
}
