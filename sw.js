const CACHE='tgr-offline-v5';
const PM='./mapa_tgr_200km.pmtiles';
const SHELL=['./','./index.html',
'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.js',
'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css',
'https://unpkg.com/pmtiles@4.3.0/dist/pmtiles.js'];

self.addEventListener('install',e=>{
 e.waitUntil((async()=>{
  const c=await caches.open(CACHE);
  await Promise.allSettled(SHELL.map(u=>c.add(u)));
  self.skipWaiting();
 })());
});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));

async function servePM(req){
 const c=await caches.open(CACHE);
 const saved=await c.match(PM);
 if(!saved)return fetch(req);
 const range=req.headers.get('range');
 if(!range)return saved;
 const ab=await saved.arrayBuffer();
 const m=/bytes=(\d+)-(\d*)/.exec(range);
 if(!m)return new Response(null,{status:416});
 const start=+m[1],end=m[2]?Math.min(+m[2],ab.byteLength-1):ab.byteLength-1;
 if(start>=ab.byteLength)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${ab.byteLength}`}});
 const part=ab.slice(start,end+1);
 return new Response(part,{status:206,headers:{
  'Content-Type':'application/octet-stream','Accept-Ranges':'bytes',
  'Content-Range':`bytes ${start}-${end}/${ab.byteLength}`,
  'Content-Length':String(part.byteLength)
 }});
}

self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(u.pathname.endsWith('/mapa_tgr_200km.pmtiles')){e.respondWith(servePM(e.request));return}
 e.respondWith((async()=>{
  const c=await caches.open(CACHE);
  const hit=await c.match(e.request);
  if(hit)return hit;
  try{
   const r=await fetch(e.request);
   if(e.request.method==='GET' && r.ok) c.put(e.request,r.clone()).catch(()=>{});
   return r;
  }catch(err){
   if(e.request.mode==='navigate') return (await c.match('./index.html'))||(await c.match('./'));
   throw err;
  }
 })());
});