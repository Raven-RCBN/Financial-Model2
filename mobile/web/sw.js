// Browser preview caches only this public shell; all private audit data remains account-scoped in IndexedDB.
const CACHE='agintel-audit-company-v5';
const FILES=['index.html','app.js','styles.css','core.mjs','manifest.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(file=>new URL(file,self.registration.scope).href)))));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin!==location.origin||!url.pathname.startsWith('/mobile-app/')||event.request.method!=='GET')return;const name=url.pathname.split('/').pop();if(!FILES.includes(name))return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));});
