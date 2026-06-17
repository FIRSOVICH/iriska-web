self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'Ириска 🍬';
  const body = data.body || 'Новое сообщение';
  const chatId = data.data?.chatId;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      vibrate: [200, 100, 200],
      data: { chatId },
      tag: chatId || 'iriska',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  const url = chatId ? `/?chat=${chatId}` : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wcs) => {
      for (const wc of wcs) {
        if (wc.url.includes(self.location.origin)) {
          wc.focus();
          wc.postMessage({ type: 'OPEN_CHAT', chatId });
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
