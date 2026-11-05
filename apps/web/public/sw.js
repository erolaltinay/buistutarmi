/* global self, caches */
// Saha sayacının çevrimdışı yedeği (SPEC-architecture §5.4). Bağlantı varken her şey ağdan gelir; bu dosya yalnız
// ağ hatasında, sayaç açılırken saklanan kopyayı verir. Önbelleğe kendisi yazmaz (lib/offline.ts yazar).
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const page = request.mode === 'navigate' && url.pathname.includes('/projects/');
  if (!page && !url.pathname.startsWith('/_next/static/')) return;
  event.respondWith(
    fetch(request).catch(async () => (await caches.match(request, { ignoreVary: true })) ?? Response.error()),
  );
});
