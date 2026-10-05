// Usage: node tests/mobile-browser-fixture.mjs SOURCE_DB NEW_TEMP_DIRECTORY
import fs from 'node:fs/promises';
import path from 'node:path';
import {hashAuditPassword} from '../audit/audit-permissions.mjs';
const [source,directory]=process.argv.slice(2);
if(!source||!directory)throw new Error('Supply a source database and NEW isolated temporary directory.');
await fs.mkdir(directory,{recursive:false,mode:0o700});
await fs.copyFile(source,path.join(directory,'db.json'));
const users=[['mobile.milo','milo@example.test',{create:true,recommend:true,respond:true}],['mobile.owner','owner@example.test',{create:false,recommend:false,respond:true}]].map(([name,email,auditPermissions])=>({id:name,name,email,auditPermissions,status:'Active',credential:hashAuditPassword('MobileTest-Only-2026')}));
await fs.writeFile(path.join(directory,'audit-users.json'),JSON.stringify({project_opsl_15000ha_development:users}),{mode:0o600});
console.log('Fixture ready. Start server with PORT=4187 and FM2_DB_PATH='+path.join(directory,'db.json')+'. Then run tests/mobile-browser.mjs with Playwright available.');
