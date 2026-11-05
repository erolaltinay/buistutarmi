// Sayaç ekranının internetsiz yeniden açılabilmesi için sayfanın ve dosyalarının kopyası (public/sw.js).
const PREFIX = 'bitm-offline-';

/** Sayaç açılırken çağrılır; başarısız olursa sayım yine çalışır, yalnız sayfa internetsiz yeniden açılmaz. */
export async function prepareOffline(): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return false;
  if (!('serviceWorker' in navigator) || !('caches' in window)) return false;
  try {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const stored = await caches.keys();
    if (!navigator.onLine) return stored.some((k) => k.startsWith(PREFIX));

    const statics = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((u) => {
        const url = new URL(u);
        return url.origin === location.origin && url.pathname.startsWith('/_next/static/');
      });
    // Önce yenisi tamamlanır, sonra eskisi silinir; yarıda kalırsa eski kopya durur.
    const name = `${PREFIX}${Date.now()}`;
    const cache = await caches.open(name);
    await cache.addAll([...new Set([location.href, ...statics])]);
    await Promise.all(stored.filter((k) => k.startsWith(PREFIX)).map((k) => caches.delete(k)));
    return true;
  } catch {
    return false;
  }
}
