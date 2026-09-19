// Firebase Cloud Messaging Service Worker for TableFlow Web
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker context if configuration is available
const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForTableFlowWebNotifications",
  authDomain: "tableflow.firebaseapp.com",
  projectId: "tableflow",
  storageBucket: "tableflow.appspot.com",
  messagingSenderId: "878569392531",
  appId: "1:878569392531:web:abcdef123456"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    const notificationTitle = payload.notification?.title || 'TableFlow Alert';
    const notificationOptions = {
      body: payload.notification?.body || 'You have an update regarding your table or order.',
      icon: '/icons/Icon-192.png',
      badge: '/favicon.png',
      data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  console.warn('[firebase-messaging-sw.js] Service worker running in offline/standby mode:', e.message);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
