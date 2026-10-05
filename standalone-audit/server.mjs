import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {allAuditEntries,createAuditEntry,listAuditEntries,auditReportDefaults} from '../audit/audit-store.mjs';
import {auditIdentity,auditAssignees,validateAuditAssignees,applyAuditWrite,hashAuditPassword,verifyAuditPassword} from '../audit/audit-permissions.mjs';
import {prepareMobileWrite} from '../audit/mobile-sync.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const assetRoot=existsSync(path.join(__dirname,'audit'))?__dirname:path.dirname(__dirname);
const dataDir=path.resolve(process.env.AUDIT_DATA_DIR || path.join(__dirname,'runtime'));
const auditUsersPath=path.join(dataDir,'audit-users.json');
const dbPath=path.join(dataDir,'audit-context.json');
const auditUploadDir=path.join(dataDir,'uploads');
const authSecret=process.env.AUDIT_SESSION_SECRET;
if(!authSecret||authSecret.length<32)throw new Error('Set an independent AUDIT_SESSION_SECRET of at least 32 characters.');
const port=Number(process.env.PORT||4188),pythonPath=process.env.PYTHON||'python3';
const authCookieName='audit_session',sessionTtlMs=12*60*60*1000;
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.pdf':'application/pdf'};
let queue=Promise.resolve();
const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode});};
async function readJson(file){return JSON.parse(await fs.readFile(file,'utf8'));}
async function atomicJson(file,value){await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});const tmp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600});await fs.rename(tmp,file);}
function send(req,res,status,value,type='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});res.end(Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value));}
const forbidden=(req,res,message='Administrator permission required.')=>send(req,res,403,{message});
const badRequest=(req,res,message)=>send(req,res,400,{message});
const notFound=(req,res)=>send(req,res,404,{message:'Not found'});
async function bodyText(req){let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>40*1024*1024)fail('Request exceeds 40 MB.',413);parts.push(chunk);}return Buffer.concat(parts).toString('utf8');}
async function bodyJson(req){try{return JSON.parse(await bodyText(req)||'{}');}catch(e){if(e.statusCode)throw e;fail('Invalid JSON.');}}
function cookieOptions(req,age=sessionTtlMs/1000){return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${req.headers['x-forwarded-proto']==='https'?'; Secure':''}`;}
function signature(value){return crypto.createHmac('sha256',authSecret).update(value).digest('base64url');}
function equal(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function userById(userId,directories,admin){if(admin.name===userId)return {...admin,userId,role:'admin'};for(const [projectId,users] of Object.entries(directories)){const user=users.find(u=>u.name===userId&&u.status==='Active'&&u.credential);if(user)return {...user,userId,role:'audit',projectIds:[projectId]};}return null;}
function sessionFor(req,directories,admin){try{const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(authCookieName+'='));if(!cookie)return null;const [payload,sig]=cookie.slice(authCookieName.length+1).split('.');if(!equal(sig,signature(payload)))return null;const token=JSON.parse(Buffer.from(payload,'base64url'));const user=userById(token.userId,directories,admin);if(!user||token.expiresAt<=Date.now()||token.authVersion!==user.credential.salt)return null;return {userId:user.userId,role:user.role,projectIds:user.projectIds,expiresAt:token.expiresAt};}catch{return null;}}
function loginPage(error=''){return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>AgIntel Audit login</title><link rel="stylesheet" href="/mobile-app/styles.css"></head><body><main class="main"><section class="login card"><div class="mark">a</div><div class="eyebrow">AgIntel Audit</div><h1>Sign in to Audit</h1><p>Independent audit management and field capture.</p>${error?'<p role="alert">Invalid username or password.</p>':''}<form method="post" action="/login"><label class="field"><span>Username</span><input name="userid" autocomplete="username" required></label><label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label><button class="primary wide">Sign in</button></form><p><a href="/mobile-app/index.html">Open mobile &amp; offline workspace</a></p></section></main></body></html>`;}
async function asset(req,res,file){try{return send(req,res,200,await fs.readFile(file),mime[path.extname(file)]||'application/octet-stream');}catch(e){if(e.code==='ENOENT')return notFound(req,res);throw e;}}
const mobileFiles=new Set(['index.html','app.js','styles.css','core.mjs','manifest.json','sw.js']);
async function handle(req,res){
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/healthz')return send(req,res,200,{service:'audit',status:'ok'});
 if(url.pathname.startsWith('/mobile-app/')&&req.method==='GET'){const name=url.pathname.slice(12)||'index.html';if(!mobileFiles.has(name))return notFound(req,res);return asset(req,res,path.join(assetRoot,'mobile/web',name));}
 const [directories,admin,context]=await Promise.all([readJson(auditUsersPath),readJson(path.join(dataDir,'admin-user.json')),readJson(dbPath)]);
 const session=sessionFor(req,directories,admin);
 if(url.pathname==='/logout'){res.setHeader('Set-Cookie',`${authCookieName}=; ${cookieOptions(req,0)}`);res.writeHead(303,{Location:'/login'});return res.end();}
 if(url.pathname==='/login'){
  if(req.method==='GET')return send(req,res,200,loginPage(),'text/html');
  if(req.method!=='POST')return notFound(req,res);
  const form=new URLSearchParams(await bodyText(req));const user=userById(form.get('userid'),directories,admin);
  if(!user||!verifyAuditPassword(form.get('password'),user.credential))return send(req,res,401,loginPage('invalid'),'text/html');
  const payload=Buffer.from(JSON.stringify({userId:user.userId,authVersion:user.credential.salt,expiresAt:Date.now()+sessionTtlMs})).toString('base64url');
  res.setHeader('Set-Cookie',`${authCookieName}=${payload}.${signature(payload)}; ${cookieOptions(req)}`);res.writeHead(303,{Location:'/app'});return res.end();
 }
 if(!session){if(url.pathname.startsWith('/api/'))return send(req,res,401,{message:'Authentication required'});res.writeHead(303,{Location:'/login'});return res.end();}
 if(url.pathname==='/api/session')return send(req,res,200,session);
 if(['/','/app','/audit'].includes(url.pathname)&&req.method==='GET')return asset(req,res,path.join(__dirname,'index.html'));
 if(['/app.js','/styles.css'].includes(url.pathname)&&req.method==='GET')return asset(req,res,path.join(__dirname,url.pathname.slice(1)));
 if(/^\/public\/[a-zA-Z0-9_.-]+\.(png|jpe?g|webp|svg)$/.test(url.pathname))return asset(req,res,existsSync(path.join(dataDir,'branding',path.basename(url.pathname)))?path.join(dataDir,'branding',path.basename(url.pathname)):path.join(assetRoot,url.pathname));
 const projectId=context.project.id;
 if(session.role!=='admin'&&!session.projectIds?.includes(projectId))return forbidden(req,res,'Audit project access required.');
 if(url.pathname.startsWith('/audit/uploads/')){
  const prefix='/audit/uploads/'+safeFileSegment(projectId)+'/';
  if(!url.pathname.startsWith(prefix)||!/^[-a-zA-Z0-9_./]+$/.test(url.pathname)||url.pathname.includes('..'))return forbidden(req,res);
  return asset(req,res,path.join(auditUploadDir,url.pathname.slice('/audit/uploads/'.length)));
 }
 if(/^\/audit\/evidence\/[-a-zA-Z0-9_]+\.(png|jpe?g|webp)$/.test(url.pathname)){
  const entries=await allAuditEntries(dbPath,projectId);
  if(!entries.some(e=>e.photoUrl===url.pathname||e.observationImages?.some(i=>i.url===url.pathname)))return forbidden(req,res);
  return asset(req,res,path.join(assetRoot,url.pathname));
 }
 const match=url.pathname.match(/^\/api\/projects\/([^/]+)\/(audit-context|audit-access|audit-entries|audit-sync|audit-settings|audit-branding|audit-pdf)$/);
 if(!match||match[1]!==projectId)return notFound(req,res);
 const child=match[2],payload=context;
 const auditActor=auditIdentity(session,directories[projectId]||[]);
 if(child==='audit-branding'){
  if(!auditActor.admin)return forbidden(req,res);
  if(req.method!=='PUT')return notFound(req,res);
  const patch=await bodyJson(req);const match=String(patch.dataUrl||'').match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if(!match)fail('Choose a PNG, JPG or WebP logo.');
  const buffer=Buffer.from(match[2],'base64');if(buffer.length>3*1024*1024||buffer.length<12)fail('Logo must be smaller than 3 MB.');
  const valid=match[1]==='png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?buffer[0]===255&&buffer[1]===216:buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP';
  if(!valid)fail('Invalid image format.');
  await fs.mkdir(path.join(dataDir,'branding'),{recursive:true,mode:0o700});const name='audit-brand-logo.'+match[1];await fs.writeFile(path.join(dataDir,'branding',name),buffer,{mode:0o600});
  context.project.settings||={};context.project.settings.brandingLogoUrl='/public/'+name+'?v='+Date.now();await atomicJson(dbPath,context);return send(req,res,200,context);
 }
 if(child==='audit-settings'){
  if(!auditActor.admin)return forbidden(req,res);
  if(req.method!=='PUT')return notFound(req,res);
  const patch=await bodyJson(req);if(!String(patch.companyName||'').trim()||!String(patch.projectName||'').trim())fail('Company and project names are required.');
  if(!patch.auditSetup||['years','departments','areas'].some(key=>!Array.isArray(patch.auditSetup[key])||!patch.auditSetup[key].length||patch.auditSetup[key].some(v=>typeof v!=='string'||!v.trim())))fail('Provide report years, departments and audit areas.');
  if(patch.auditSetup.years.some(year=>!/^\d{4}$/.test(year)))fail('Report years must have four digits.');
  context.company.name=patch.companyName.trim();context.project.name=patch.projectName.trim();context.project.settings={...context.project.settings,auditSetup:patch.auditSetup,auditReport:patch.auditReport||{}};
  await atomicJson(dbPath,context);return send(req,res,200,context);
 }
 if(child==='audit-pdf'){
  if(req.method!=='POST')return notFound(req,res);
  const patch=await bodyJson(req),year=String(patch.auditYear||'');
  const entries=await allAuditEntries(dbPath,projectId,year);
  const result=spawnSync(pythonPath,[path.join(assetRoot,'audit/render_audit_pdf.py'),dbPath,projectId],{input:JSON.stringify({entries,reportSettings:{...auditReportDefaults,...context.project.settings?.auditReport,...patch.reportSettings},brandingLogoUrl:context.project.settings?.brandingLogoUrl}),maxBuffer:40*1024*1024,env:{...process.env,AUDIT_UPLOAD_ROOT:auditUploadDir,AUDIT_BRAND_ROOT:path.join(dataDir,'branding')}});
  if(result.status!==0)throw new Error('Audit PDF could not be generated. Check server PDF dependencies.');
  res.setHeader('Content-Disposition',`attachment; filename="audit-report-${year.replace(/[^0-9]/g,'')||'all'}.pdf"`);return send(req,res,200,result.stdout,'application/pdf');
 }
   let auditDirectories = directories;
  const auditUsers = auditDirectories[projectId] || [];

  if (child === "audit-context" && req.method === "GET") {
    const settings = payload.project.settings || {};
    return send(req, res, 200, {company: {name: payload.company.name}, project: {id: projectId, name: payload.project.name, settings: {auditSetup: settings.auditSetup, auditReport: settings.auditReport, brandingLogoUrl: settings.brandingLogoUrl}}}, "application/json; charset=utf-8", {cacheControl: "no-store"});
  }
  if (child === "audit-access") {
    if (!auditActor.userId) return forbidden(req, res);
    if (req.method === "GET") return send(req, res, 200, {users: auditActor.admin ? auditUsers.map(({credential, ...user}) => user) : [], identity: auditActor, assignees: auditAssignees(auditUsers, [{userId:admin.name}].map(user => user.userId))}, "application/json; charset=utf-8", {cacheControl: "no-store"});
    if (req.method !== "PUT") return notFound(req, res);
    if (!auditActor.admin) return forbidden(req, res, "Only administrators can assign audit permissions.");
    const patch = await bodyJson(req);
    if (!Array.isArray(patch.users) || new Set(patch.users.map(user => String(user?.name || "").trim())).size !== patch.users.length) return badRequest(req, res, "Provide users with unique sign-in usernames.");
    if (patch.users.some(user => !user || typeof user.name !== "string" || !user.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email || ""))) return badRequest(req, res, "A username and valid email are required for each audit user.");
    const otherUsers = Object.entries(auditDirectories).filter(([id]) => id !== projectId).flatMap(([, users]) => users);
    const users = [];
    for (const user of patch.users) {
      user.name = user.name.trim();
      if ([{userId:admin.name}].some(account => account.userId === user.name) || otherUsers.some(account => account.name === user.name)) return badRequest(req, res, "Audit usernames must be separate from administrator and other project accounts.");
      const existing = auditUsers.find(item => item.id === user.id && item.name === user.name);
      let credential = existing?.credential;
      try { if (user.password) credential = hashAuditPassword(user.password); }
      catch (error) { return badRequest(req, res, error.message); }
      if (!credential) return badRequest(req, res, "Set a password of at least 12 characters for each new Audit account.");
      users.push({id: String(user.id), name: user.name.trim(), email: String(user.email).trim().toLowerCase(), status: user.status === "Active" ? "Active" : "Inactive", credential, auditPermissions: {create: user.auditPermissions?.create === true, recommend: user.auditPermissions?.recommend === true, respond: user.auditPermissions?.respond === true}});
    }
    auditDirectories[projectId] = users;
    await atomicJson(auditUsersPath,auditDirectories);

    return send(req, res, 200, {users: users.map(({credential, ...user}) => user), identity: auditIdentity(session, users), assignees: auditAssignees(users, [{userId:admin.name}].map(user => user.userId))});
  }
  if (child === "audit-sync" && req.method === "POST") {
    try {
      const request = await bodyJson(req);
      const existing = (await allAuditEntries(dbPath, projectId)).find(entry => entry.id === request.patch?.id);
      const prepared = prepareMobileWrite(auditActor, request, existing);
      if (prepared.duplicate) return send(req,res,200,{entry:prepared.entry,duplicate:true},"application/json; charset=utf-8",{cacheControl:"no-store"});
      validateAuditAssignees(request.patch, auditUsers, [{userId:admin.name}].map(user => user.userId));
      const persisted = await persistAuditEntryImages(projectId, prepared.entry);
      const result = await createAuditEntry(dbPath,projectId,persisted);
      return send(req,res,200,result,"application/json; charset=utf-8",{cacheControl:"no-store"});
    } catch(error) {
      if ([400,403,404,409].includes(error.statusCode)) return send(req,res,error.statusCode,{message:error.message},"application/json; charset=utf-8",{cacheControl:"no-store"});
      throw error;
    }
  }
  if (child === "audit-entries") {
    if (!session) return forbidden(req, res, "Audit access requires a signed-in user.");
    if (req.method === "GET") {
      return send(req, res, 200, await listAuditEntries(dbPath, projectId, {
        page: url.searchParams.get("page"),
        pageSize: url.searchParams.get("pageSize"),
        q: url.searchParams.get("q") || "",
        department: url.searchParams.get("department") || "",
        status: url.searchParams.get("status") || "",
        auditYear: url.searchParams.get("auditYear") || "",
      }), "application/json; charset=utf-8", { cacheControl: "no-store" });
    }
    if (req.method === "POST") {
      try {
        const patch = await bodyJson(req);
        const existing = (await allAuditEntries(dbPath, projectId)).find(entry => entry.id === patch.id);
        validateAuditAssignees(patch, auditUsers, [{userId:admin.name}].map(user => user.userId));
        const authorized = applyAuditWrite(auditActor, patch, existing);
        const persistedPatch = await persistAuditEntryImages(projectId, authorized);
        const result = await createAuditEntry(dbPath, projectId, persistedPatch);
        return send(req, res, 201, result, "application/json; charset=utf-8", { cacheControl: "no-store" });
      } catch (error) {
        if ([400, 403, 404].includes(error.statusCode)) return send(req, res, error.statusCode, {message: error.message});
        throw error;
      }
    }
    return notFound(req, res);
  }

 return notFound(req,res);
}
function safeFileSegment(value, fallback = "item") {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || fallback;
}
function imageExtension(mimeType = "") {
  const type = String(mimeType).toLowerCase();
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}
async function saveAuditDataUrlImage(dataUrl, projectId, auditYear, name = "audit-image") {
  const match = String(dataUrl || "").match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return "";
  const buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (!buffer.length) return "";
  const yearSegment = safeFileSegment(auditYear || "undated", "undated");
  const projectSegment = safeFileSegment(projectId || "project", "project");
  const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const nameSegment = safeFileSegment(path.parse(name || "audit-image").name, "audit-image");
  const ext = imageExtension(match[1]);
  const fileName = `${Date.now()}-${hash}-${nameSegment}.${ext}`;
  const relativeUrl = `/audit/uploads/${projectSegment}/${yearSegment}/${fileName}`;
  const absolute = path.join(auditUploadDir, relativeUrl.slice("/audit/uploads/".length));
  if (!absolute.startsWith(auditUploadDir)) throw new Error("Audit upload path is invalid");
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, buffer);
  return relativeUrl;
}
async function persistAuditEntryImages(projectId, entry = {}) {
  const auditYear = entry.auditYear || "";
  const next = { ...entry };
  if (typeof next.photoDataUrl === "string" && next.photoDataUrl.startsWith("data:image/")) {
    const photoUrl = await saveAuditDataUrlImage(next.photoDataUrl, projectId, auditYear, next.photoName || "field-photo");
    if (photoUrl) {
      next.photoUrl = photoUrl;
      delete next.photoDataUrl;
    }
  }
  if (Array.isArray(next.observationImages)) {
    next.observationImages = await Promise.all(next.observationImages.map(async (item, index) => {
      if (!item || typeof item !== "object") return item;
      if (typeof item.dataUrl === "string" && item.dataUrl.startsWith("data:image/")) {
        const url = await saveAuditDataUrlImage(item.dataUrl, projectId, auditYear, item.name || `observation-${index + 1}`);
        return {
          url,
          name: String(item.name || `Observation image ${index + 1}`),
          description: String(item.description || ""),
        };
      }
      return item;
    }));
  }
  return next;
}
const server=http.createServer((req,res)=>{
 const pending=queue.then(()=>handle(req,res));queue=pending.catch(()=>{});
 pending.catch(error=>{if(!res.headersSent)send(req,res,error.statusCode||500,{message:error.statusCode?error.message:'Audit service error. Please retry or contact the administrator.'});else res.end();console.error(error.statusCode||500,error.message);});
});
await Promise.all(['audit-context.json','audit-users.json','audit-entries.json','admin-user.json'].map(file=>readJson(path.join(dataDir,file))));
server.listen(port,'127.0.0.1',()=>console.log(`Standalone Audit listening on 127.0.0.1:${port}`));
