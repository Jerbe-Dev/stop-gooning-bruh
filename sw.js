/* Goon Logbook is online-only. This worker only retires older offline caches. */
self.addEventListener('install',function(e){e.waitUntil(self.skipWaiting());});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(key){return key.indexOf('clean-slate-')===0;}).map(function(key){return caches.delete(key);}));}).then(function(){return self.registration.unregister();}).then(function(){return self.clients.claim();}));});
