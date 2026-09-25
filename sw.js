const CACHE='tgr-rota-offline-v1';
const CORE=['./','./index.html'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(self.clients.claim());
});

async function cachedIgnoringSearch(request){
  const cache=await caches.open(CACHE);
  return cache.match(request,{ignoreSearch:true});
}

async function rangeFromCachedPMTiles(request){
  const cached=await cachedIgnoringSearch(request);
  if(!cached) return null;
  const range=request.headers.get('range');
  if(!range) return cached;
  const buf=await cached.arrayBuffer();
  const size=buf.byteLength;
  const m=/bytes=(\d+)-(\d*)/.exec(range);
  if(!m) return cached;
  const start=Number(m[1]);
  const end=m[2] ? Math.min(Number(m[2]),size-1) : size-1;
  if(start>=size || end<start){
    return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  }
  return new Response(buf.slice(start,end+1),{
    status:206,
    headers:{
      'Content-Type':'application/octet-stream',
      'Content-Range':`bytes ${start}-${end}/${size}`,
      'Accept-Ranges':'bytes',
      'Content-Length':String(end-start+1)
    }
  });
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);

  // O PMTiles precisa responder a Range mesmo quando o arquivo completo está no cache.
  if(url.origin===self.location.origin && url.pathname.endsWith('/mapa_tgr_200km.pmtiles')){
    event.respondWith((async()=>{
      try{
        // Online: mantém exatamente o comportamento já funcional do GitHub Pages.
        return await fetch(req);
      }catch(e){
        const offline=await rangeFromCachedPMTiles(req);
        if(offline) return offline;
        throw e;
      }
    })());
    return;
  }

  // Navegação: rede primeiro; sem internet, abre o index salvo.
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{return await fetch(req);}catch(e){
        return (await caches.open(CACHE)).match('./index.html') || Response.error();
      }
    })());
    return;
  }

  // Dados e bibliotecas: rede primeiro, cache como reserva offline.
  event.respondWith((async()=>{
    try{
      const net=await fetch(req);
      if(net && (net.ok || net.type==='opaque')){
        const cache=await caches.open(CACHE);
        cache.put(req,net.clone()).catch(()=>{});
      }
      return net;
    }catch(e){
      const cached=await cachedIgnoringSearch(req);
      if(cached) return cached;
      throw e;
    }
  })());
});
