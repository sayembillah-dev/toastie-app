// Push-only service worker — deliberately has no `fetch` handler, so it
// never intercepts requests or caches pages/assets. That keeps it out of
// the "full offline support" scope (see docs/PWA guide); its only job is
// receiving Web Push events while the app isn't in the foreground.
//
// Registered from lib/push/push-notifications.ts. A subscription created
// against this worker is only as useful as the server side of the pipeline
// — see apps/api/src/push — which needs real VAPID keys before any
// notification actually goes out.

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
