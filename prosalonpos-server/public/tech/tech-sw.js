/**
 * tech-sw.js — Service Worker for Tech Phone Push Notifications
 *
 * Handles:
 *   - push event → show native OS notification
 *   - notificationclick → focus/open the tech phone app
 *
 * Installed by TechNotifications.jsx after user grants permission.
 * Served from /tech/tech-sw.js so its scope covers /tech/* URLs.
 */

// ── Push event — server sends a notification payload ──
self.addEventListener('push', function(event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'ProSalonPOS', body: event.data ? event.data.text() : 'New notification' };
  }

  var title = data.title || 'ProSalonPOS';
  var options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'prosalonpos-default',
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || null,
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification click — open or focus the tech phone app ──
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var targetUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If the app is already open, focus it
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('/tech') !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Activate — immediately take control ──
self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
