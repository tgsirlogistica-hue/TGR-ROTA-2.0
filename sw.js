const CACHE='tgr-offline-v2', MAPA='./mapa_tgr_200km.pmtiles';
const SHELL=['./','./index.html',
'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css',
'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.js',
'https://unpkg.com/pmtiles@4.3.0/dist/pmtiles.js'];

self.addEventListener('install',e=>e.waitUntil(
 caches.open(CACHE).then(c=>Promise.allSettled(SHELL.map(u=>c.add(u)))).then(()=>self.skipWaiting())
));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));

async function rangeFromCached(req){
 const c=await caches.open(CACHE);
 const full=await c.match(MAPA,{ignoreSearch:true});
 if(!full)return null;
 const range=req.headers.get('range');
 if(!range)return full;
 const blob=await full.blob();
 const m=/bytes=(\d+)-(\d*)/.exec(range);
 if(!m)return full;
 const start=Number(m[1]), end=m[2]?Math.min(Number(m[2]),blob.size-1):blob.size-1;
 if(start>=blob.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${blob.size}`}});
 const part=blob.slice(start,end+1);
 return new Response(part,{status:206,headers:{
  'Content-Type':'application/octet-stream','Content-Length':String(part.size),
  'Content-Range':`bytes ${start}-${end}/${blob.size}`,'Accept-Ranges':'bytes'
 }});
}

self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(u.pathname.endsWith('/mapa_tgr_200km.pmtiles')){
  e.respondWith((async()=> (await rangeFromCached(e.request)) || fetch(e.request))());
  return;
 }
 e.respondWith((async()=>{
  const c=await caches.open(CACHE), hit=await c.match(e.request,{ignoreSearch:true});
  if(hit)return hit;
  try{const r=await fetch(e.request); if(e.request.method==='GET'&&r.ok)c.put(e.request,r.clone()); return r;}
  catch(err){if(e.request.mode==='navigate')return (await c.match('./index.html'))||Response.error(); throw err;}
 })());
});