import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.resolve(process.argv[2]||path.join(repo,'outputs/audit-release'));
await fs.mkdir(out,{recursive:false});
for(const name of ['server.mjs','app.js','styles.css','index.html'])await fs.copyFile(path.join(repo,'standalone-audit',name),path.join(out,name));
let server=await fs.readFile(path.join(out,'server.mjs'),'utf8');server=server.replaceAll("'../audit/","'./audit/");await fs.writeFile(path.join(out,'server.mjs'),server);
for(const name of ['audit-permissions.mjs','audit-store.mjs','mobile-sync.mjs','render_audit_pdf.py']){await fs.mkdir(path.join(out,'audit'),{recursive:true});await fs.copyFile(path.join(repo,'audit',name),path.join(out,'audit',name));}
// Standalone store must never inherit FM2's Mongo configuration.
const storeFile=path.join(out,'audit/audit-store.mjs');let store=await fs.readFile(storeFile,'utf8');store=store.replace('process.env.FM2_MONGODB_URI || process.env.MONGODB_URI','process.env.AUDIT_MONGODB_URI');store=store.replace('  } catch {\n    return [];\n  }','  } catch (error) {\n    if (error.code !== "ENOENT") throw error;\n    return [];\n  }');
store=store.replace('  } catch {\n    existing = [];\n  }','  } catch (error) {\n    if (error.code !== "ENOENT") throw error;\n    existing = [];\n  }');
store=store.replace('  await fs.writeFile(file, JSON.stringify([...others, ...entries], null, 2) + "\\n");','  const temp = file + ".tmp";\n  await fs.writeFile(temp, JSON.stringify([...others, ...entries], null, 2) + "\\n", {mode:0o600});\n  await fs.rename(temp,file);');
await fs.writeFile(storeFile,store);
for(const dir of ['audit/evidence','audit/source-reports','mobile/web'])await fs.cp(path.join(repo,dir),path.join(out,dir),{recursive:true});
await fs.mkdir(path.join(out,'public'));for(const name of await fs.readdir(path.join(repo,'public')))if(/^[\w.-]+\.(png|jpe?g|webp|svg)$/i.test(name))await fs.copyFile(path.join(repo,'public',name),path.join(out,'public',name));
await fs.cp(path.join(repo,'standalone-audit/deploy'),path.join(out,'deploy'),{recursive:true});
await fs.cp(path.join(repo,'standalone-audit/scripts'),path.join(out,'scripts'),{recursive:true});
const init=path.join(out,'scripts/init-instance.mjs');await fs.writeFile(init,(await fs.readFile(init,'utf8')).replace("'../../audit/","'../audit/"));
await fs.writeFile(path.join(out,'package.json'),JSON.stringify({name:'agintel-standalone-audit',version:'0.2.0',private:true,type:'module',scripts:{start:'node server.mjs'},engines:{node:'>=20'}},null,2)+'\n');
await fs.copyFile(path.join(repo,'standalone-audit/deploy/start.sh'),path.join(out,'start.sh'));
await fs.chmod(path.join(out,'start.sh'),0o755);
console.log('Standalone code-only release: '+out);
