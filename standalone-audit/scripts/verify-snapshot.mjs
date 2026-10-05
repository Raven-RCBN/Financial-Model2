import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
const dir=path.resolve(process.argv[2]);const manifest=JSON.parse(await fs.readFile(path.join(dir,'migration-manifest.json'),'utf8'));
for(const [name,hash] of Object.entries(manifest.files)){const file=path.resolve(dir,name);if(!file.startsWith(dir+path.sep))throw new Error('Invalid manifest path');if(crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')!==hash)throw new Error('Snapshot mismatch: '+name);}
const context=JSON.parse(await fs.readFile(path.join(dir,'audit-context.json'),'utf8'));
const users=JSON.parse(await fs.readFile(path.join(dir,'audit-users.json'),'utf8'))[context.project.id]||[];
const entries=JSON.parse(await fs.readFile(path.join(dir,'audit-entries.json'),'utf8'));
if(users.length!==manifest.users||entries.length!==manifest.entries)throw new Error('Record count mismatch');
if(new Set(users.map(u=>u.name)).size!==users.length)throw new Error('Duplicate usernames');
for(const user of users)if(!user.credential?.salt||!user.credential?.hash)throw new Error('Missing existing credential');
for(const entry of entries)for(const url of [entry.photoUrl,...(entry.observationImages||[]).map(i=>i.url)].filter(Boolean)){if(url.startsWith('/audit/uploads/')){const file=path.resolve(dir,'uploads',url.slice('/audit/uploads/'.length));if(!file.startsWith(path.join(dir,'uploads')+path.sep))throw new Error('Invalid media reference');await fs.access(file);}}
console.log(`Snapshot verified: ${users.length} users, ${entries.length} findings, ${Object.keys(manifest.files).length} files.`);
