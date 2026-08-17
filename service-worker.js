const CACHE_NAME = 'gaugefields-lite-subsetjulia-v31';
const CACHEABLE_PATHS = new Set([
  '',
  'index.html',
  'styles.css',
  'app.js',
  'simulation-worker.js',
  'simulation-worker-runtime.js',
  'result-contract.mjs',
  'outreach-guide.mjs',
  'i18n.mjs',
  'manifest.webmanifest',
  'favicon.svg',
  'THIRD_PARTY_NOTICES.txt',
  'gaugefields-lite.bundle.jl',
  'gaugefields-lite-su2.repl.jl',
  'gaugefields-lite-su3.repl.jl',
  'vendor/subset_julia/subset_julia_vm_web.js',
  'vendor/subset_julia/subset_julia_vm_web_bg.wasm',
].map(path => new URL(path, self.registration.scope).pathname));

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('gaugefields-lite-') && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !CACHEABLE_PATHS.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok) {
        try {
          await cache.put(request, response.clone());
        } catch (cacheError) {
          // A cache quota or write failure must not discard a valid network
          // response, especially for the large SubsetJulia WASM artifact.
          console.warn('GaugeFieldsLite offline cache write failed:', cacheError);
        }
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached !== undefined) return cached;
      throw error;
    }
  })());
});
