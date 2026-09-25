const CACHE='tgr-rota-offline-v2';
const PM='mapa_tgr_200km.pmtiles';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});

function rangeResponse(full,range){
  return full.arrayBuffer().then(buf=>{
    const size=buf.byteLength; const m=/bytes=(\\d+)-(\\d*)/.exec(range||'');
    if(!m)return new Response(buf,{status:200,headers:full.headers});
    const start=Number(m[1]); let end=m[2]?Number(m[2]):size-1; end=Math.min(end,size-1);
    if(start>=size||start>end)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
    const slice=buf.slice(start,end+1); const h=new Headers(full.headers);
    h.set('Content-Range',`bytes ${start}-${end}/${size}`);h.set('Content-Length',String(slice.byteLength));h.set('Accept-Ranges','bytes');
    return new Response(slice,{status:206,statusText:'Partial Content',headers:h});
  });
}
self.addEventListener('fetch',e=>{
  const req=e.request; const url=new URL(req.url);
  if(req.method!=='GET')return;
  if(url.pathname.endsWith('/'+PM)){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE); const key=new Request(new URL('./'+PM,self.registration.scope).href);
      const saved=await c.match(key,{ignoreSearch:true});
      if(saved){const r=req.headers.get('range');return r?rangeResponse(saved.clone(),r):saved;}
      try{return await fetch(req);}catch(_){return new Response('Mapa offline ainda não foi baixado.',{status:503});}
    })());return;
  }
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    // Navegação offline sempre volta ao index salvo.
    if(req.mode==='navigate'){try{const net=await fetch(req);return net;}catch(_){return (await c.match(new Request(new URL('./index.html',self.registration.scope).href),{ignoreSearch:true}))||Response.error();}}
    // Para dados e bibliotecas: rede primeiro; se cair, cache ignorando querystring.
    try{return await fetch(req);}catch(_){const hit=await c.match(req,{ignoreSearch:true});return hit||Response.error();}
  })());
});
