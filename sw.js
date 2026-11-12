const CACHE="ff-money-tracker-v1";
const CORE=["./","./index.html","./manifest.webmanifest","./assets/css/style.css","./assets/js/config.js","./assets/js/app.js","./assets/icon.svg"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET" || url.origin!==location.origin) return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    const copy=response.clone(); caches.open(CACHE).then(c=>c.put(event.request,copy)); return response;
  })));
});