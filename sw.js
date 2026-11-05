// The namepicker's service worker, so it can be installed and works offline. Its
// scope is /namepicker/ only; the rest of the site is left alone.
//
// No version is written here: the deploy links CSS/JS as file?v=<content hash>
// (scripts/version-assets.js), so the worker reads the links out of index.html
// and caches exactly those URLs. The page is fetched network first, so a new
// version shows as soon as there's a connection; its assets then get cached and
// the old ones dropped.
//
// Kill switch: if this ever caches something wrong, set KILL to true and deploy.
// Browsers check sw.js for changes on every visit, and the new one then clears
// the cache, unregisters itself and reloads the open tabs from the network.

const KILL = false;

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

const CACHE = 'namepicker-v1';
const NETWORK_WAIT_MS = 4000;
const PAGE = new URL('./', sw.location.href).href;
// Not linked from the HTML's <link>/<script> tags, but needed offline.
const EXTRA = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/comic-neue-400.woff2', 'fonts/comic-neue-700.woff2'];

// The page's local CSS/JS, with their ?v= if the deploy added one: the same links
// scripts/version-assets.js rewrites.
function assetUrls(html, base) {
  const urls = [...html.matchAll(/\b(?:href|src)="([^"#:]+\.(?:css|js)(?:\?[^"#]*)?)"/g)]
    .map(m => m[1])
    .filter(url => !url.startsWith('//'));
  return [...new Set([...urls, ...EXTRA])].map(url => new URL(url, base).href);
}

// Cache the page's current assets and drop everything else but the page itself.
async function syncAssets(html) {
  const cache = await caches.open(CACHE);
  const urls = assetUrls(html, PAGE);
  const cached = new Set((await cache.keys()).map(r => r.url));
  await Promise.all(urls.filter(url => !cached.has(url)).map(url => cache.add(url)));
  const keep = new Set([PAGE, ...urls]);
  await Promise.all([...cached].filter(url => !keep.has(url)).map(url => cache.delete(url)));
}

async function fetchPage() {
  const res = await fetch(PAGE, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${PAGE}: ${res.status}`);
  return res;
}

async function precache() {
  const res = await fetchPage();
  await syncAssets(await res.clone().text());
  await (await caches.open(CACHE)).put(PAGE, res);
}

// The network's answer, or the cached copy offline or when the network hasn't
// answered in NETWORK_WAIT_MS (a bad connection). A late answer still arrives,
// and whatever `network` does with it (updating the cache) still happens.
async function networkFirst(network, key) {
  const slow = new Promise(resolve => setTimeout(resolve, NETWORK_WAIT_MS))
    .then(async () => (await caches.match(key)) || network);
  try {
    return await Promise.race([network, slow]);
  } catch (err) {
    const cached = await caches.match(key);
    if (cached) return cached;
    throw err;
  }
}

// Network first, so a new version is used right away; its assets are then cached.
/** @param {FetchEvent} event */
function page(event) {
  return networkFirst(fetch(event.request).then(res => {
    if (res.ok && res.headers.get('content-type')?.includes('text/html')) {
      const copy = res.clone();
      event.waitUntil((async () => {
        const html = await copy.clone().text();
        await (await caches.open(CACHE)).put(PAGE, copy);
        await syncAssets(html);
      })().catch(() => {}));
    }
    return res;
  }), PAGE);
}

// A versioned URL never changes, so the cache is enough. Without ?v= (the preview,
// a local server) take the network first and keep the copy for offline use.
async function asset(request) {
  if (new URL(request.url).searchParams.has('v')) {
    const cached = await caches.match(request);
    if (cached) return cached;
  }
  return networkFirst(fetch(request).then(res => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
    }
    return res;
  }), request);
}

async function kill() {
  await Promise.all((await caches.keys()).filter(k => k.startsWith('namepicker-')).map(k => caches.delete(k)));
  await sw.registration.unregister();
  for (const client of await sw.clients.matchAll({ type: 'window' })) client.navigate(client.url);
}

sw.addEventListener('install', event => {
  sw.skipWaiting();
  if (!KILL) event.waitUntil(precache());
});

sw.addEventListener('activate', event => {
  event.waitUntil(KILL ? kill() : (async () => {
    const old = (await caches.keys()).filter(k => k.startsWith('namepicker-') && k !== CACHE);
    await Promise.all(old.map(k => caches.delete(k)));
    await sw.clients.claim();
  })());
});

sw.addEventListener('fetch', event => {
  if (KILL) return;
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== sw.location.origin) return;
  if (request.mode === 'navigate') {
    if (url.pathname === new URL(PAGE).pathname || url.pathname.endsWith('/namepicker/index.html')) {
      event.respondWith(page(event));
    }
    return;
  }
  if (url.pathname.startsWith(new URL(PAGE).pathname)) event.respondWith(asset(request));
});
