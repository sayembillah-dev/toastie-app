// Push-only service worker. Registered app-wide (see
// components/pwa-service-worker.tsx) mainly because Chrome on Android
// requires a registered service worker before it will offer "Install app" —
// iOS Safari's "Add to Home Screen" has no such requirement.
//
// A subscription created against this worker is only as useful as the
// server side of the pipeline — see apps/api/src/push — which needs real
// VAPID keys before any notification actually goes out.

// No-op: satisfies Chrome's install criteria (a registered SW with a fetch
// handler) without calling `respondWith`, so every request still falls
// through to the network untouched — no caching, no offline support. See
// docs/PWA guide's "Extending your PWA" section for adding real caching.
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Toastie', body: event.data.text() };
  }

  const { title = 'Toastie', body, icon, url } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
