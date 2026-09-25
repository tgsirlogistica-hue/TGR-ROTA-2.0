const CACHE='tgr-offline-v1';
const MAPA='mapa_tgr_200km.pmtiles';
const APP=[
  './','./index.html','./mapa_tgr_200km.pmtiles',
  'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.js',
  'https://unpkg.com/pmtiles@4.3.0/dist/pmtiles.js'
];

self.addEventListener('install',e=>e.waitUntil(
  caches.open(CACHE).then(c=>Promise.allSettled(APP.map(u=>c.add(u)))).then(()=>self.skipWaiting())
));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));

self.addEventListener('message',e=>{
  if(e.data?.acao!=='cacheMapa')return;
  const porta=e.ports&&e.ports[0];
  e.waitUntil((async()=>{
    try{
      const r=await fetch(MAPA,{cache:'reload'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const total=Number(r.headers.get('content-length'))||0;
      if(!r.body)throw new Error('O navegador não forneceu fluxo de download.');
      const reader=r.body.getReader();
      const partes=[];
      let baixado=0;
      let ultimo=performance.now(), ultimoBytes=0;
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        partes.push(value);
        baixado+=value.byteLength;
        const agora=performance.now();
        if(agora-ultimo>=250){
          const velocidade=(baixado-ultimoBytes)/((agora-ultimo)/1000);
          porta?.postMessage({tipo:'progresso',baixado,total,velocidade});
          ultimo=agora; ultimoBytes=baixado;
        }
      }
      porta?.postMessage({tipo:'progresso',baixado,total,velocidade:0});
      const blob=new Blob(partes,{type:r.headers.get('content-type')||'application/octet-stream'});
      const headers=new Headers(r.headers);
      headers.set('Content-Length',String(blob.size));
      const resposta=new Response(blob,{status:200,statusText:'OK',headers});
      const c=await caches.open(CACHE);
      await c.put(MAPA,resposta);
      porta?.postMessage({ok:true});
    }catch(err){porta?.postMessage({erro:String(err.message||err)})}
  })());
});

self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  const ehMapa=u.pathname.endsWith('/'+MAPA);
  if(ehMapa && e.request.headers.has('range')){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE);
      let full=await c.match(MAPA,{ignoreSearch:true});
      if(!full){
        try{full=await fetch(MAPA); if(full.ok)await c.put(MAPA,full.clone());}
        catch(_){}
      }
      if(!full)return fetch(e.request);
      const blob=await full.blob();
      const m=/bytes=(\d+)-(\d*)/.exec(e.request.headers.get('range')||'');
      if(!m)return full;
      const start=Number(m[1]), end=m[2]?Number(m[2]):blob.size-1;
      const part=blob.slice(start,end+1);
      return new Response(part,{status:206,statusText:'Partial Content',headers:{
        'Content-Type':'application/octet-stream',
        'Content-Length':String(part.size),
        'Content-Range':`bytes ${start}-${end}/${blob.size}`,
        'Accept-Ranges':'bytes'
      }});
    })());
    return;
  }
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const cached=await c.match(e.request,{ignoreSearch:true});
    if(cached)return cached;
    try{
      const r=await fetch(e.request);
      if(e.request.method==='GET' && r.ok)c.put(e.request,r.clone());
      return r;
    }catch(err){
      if(e.request.mode==='navigate')return (await c.match('./index.html')) || Response.error();
      throw err;
    }
  })());
});
