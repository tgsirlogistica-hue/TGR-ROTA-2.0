const CACHE='tgr-offline-v4';
const PM='./mapa_tgr_200km.pmtiles';
const SHELL=['./','./index.html',
'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.js',
'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css',
'https://unpkg.com/pmtiles@4.3.0/dist/pmtiles.js'];

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const c=await caches.open(CACHE);
  await Promise.allSettled(SHELL.map(x=>c.add(x)));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('tgr-offline-')&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
 })());
});

async function pmResponse(req){
 const c=await caches.open(CACHE);
 const full=await c.match(PM);
 if(!full) return fetch(req);
 const range=req.headers.get('range');
 if(!range) return full;
 const ab=await full.arrayBuffer();
 const m=/bytes=(\d+)-(\d*)/.exec(range);
 if(!m)return new Response(null,{status:416});
 const start=Number(m[1]),end=m[2]?Math.min(Number(m[2]),ab.byteLength-1):ab.byteLength-1;
 if(start>=ab.byteLength)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${ab.byteLength}`}});
 const part=ab.slice(start,end+1);
 return new Response(part,{status:206,headers:{
  'Content-Type':'application/octet-stream','Accept-Ranges':'bytes',
  'Content-Range':`bytes ${start}-${end}/${ab.byteLength}`,'Content-Length':String(part.byteLength)
 }});
}

self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);
 if(u.pathname.endsWith('/mapa_tgr_200km.pmtiles')){event.respondWith(pmResponse(event.request));return}
 event.respondWith((async()=>{
  const c=await caches.open(CACHE);
  const cached=await c.match(event.request);
  if(cached)return cached;
  try{return await fetch(event.request)}catch(e){
   if(event.request.mode==='navigate')return (await c.match('./index.html'))||(await c.match('./'));
   throw e;
  }
 })());
});