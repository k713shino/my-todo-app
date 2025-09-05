/* Minimal Service Worker for notification click focus */
self.addEventListener('notificationclick', (event) => {
  const data = (event.notification && event.notification.data) || {};
  const todoId = data && data.todoId ? String(data.todoId) : null;
  event.notification && event.notification.close();

  event.waitUntil((async () => {
    const url = todoId ? `/dashboard?focus=${encodeURIComponent(todoId)}` : '/dashboard';
    try {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // 既存ウィンドウがあればフォーカス＆ページに通知
      if (clientList && clientList.length) {
        const client = clientList[0];
        try { await client.focus(); } catch {}
        try { client.postMessage({ type: 'focus-todo', todoId }); } catch {}
        return;
      }
      // 無ければ新規ウィンドウを開く
      await self.clients.openWindow(url);
    } catch (e) {
      try { await self.clients.openWindow(url); } catch {}
    }
  })());
});

self.addEventListener('install', () => { self.skipWaiting && self.skipWaiting(); });
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if (self.clients && self.clients.claim) {
      await self.clients.claim();
    }
  })());
});

