/* Jugnu offline worker: keeps the app, PDF tool and fonts on the phone after the first visit,
   and receives text or voice notes shared from WhatsApp (Share > Jugnu). */
const CACHE='jugnu-v65';
const SHARE='jugnu-share';
const MODELS='jugnu-models'; // big voice model files: kept across app updates
const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const CDN=['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&family=Noto+Naskh+Arabic:wght@400;600;700&family=Sora:wght@400;600;700&display=swap'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all([
  c.addAll(CORE).catch(()=>{}),
  ...CDN.map(u=>fetch(u,{mode:'no-cors'}).then(r=>c.put(u,r)).catch(()=>{}))
])).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==SHARE&&k!==MODELS&&!/transformers/.test(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
async function takeShare(req){
  try{const fd=await req.formData();const c=await caches.open(SHARE);
    const text=[fd.get('title'),fd.get('text'),fd.get('url')].filter(Boolean).join(' ').trim();
    await c.put('./__share/text',new Response(text,{headers:{'content-type':'text/plain; charset=utf-8'}}));
    const f=fd.get('audio');
    if(f&&typeof f!=='string'&&f.size)await c.put('./__share/audio',new Response(f,{headers:{'content-type':f.type||'audio/ogg','x-name':encodeURIComponent(f.name||'voice.opus')}}));
    else await c.delete('./__share/audio');
  }catch(e){}
  return Response.redirect('./index.html?shared=1',303);
}
self.addEventListener('fetch',e=>{
  const req=e.request;const u=new URL(req.url);
  if(req.method==='POST'&&u.pathname.endsWith('/share-target')){e.respondWith(takeShare(req));return;}
  if(req.method!=='GET')return;
  if(req.mode==='navigate'&&/admin\.html$/.test(u.pathname))return; // dashboard: always live, never cached
  if(req.mode==='navigate'){ // newest app when online, saved app when offline
    e.respondWith(fetch(req,{cache:'no-store'}).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',cp));}return r;}).catch(()=>caches.match('./index.html',{ignoreSearch:true}).then(r=>r||caches.match('./'))));return;}
  if((u.origin===location.origin&&u.pathname.indexOf('/models/')>=0)||u.hostname==='cdn.jsdelivr.net'){ // voice model + its runtime: download once, then offline
    e.respondWith(caches.open(MODELS).then(c=>c.match(req).then(hit=>hit||fetch(req).then(r=>{if(r&&r.ok)c.put(req,r.clone());return r;}))));return;}
  if(u.origin===location.origin||/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)$/.test(u.hostname)){
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r&&(r.ok||r.type==='opaque')){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return r;})));}
});
