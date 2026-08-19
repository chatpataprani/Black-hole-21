/* Black Hole 21 web FCM service worker. No private Firebase credentials live here. */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = "https://black-hole-21.onrender.com/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })
  );
});

importScripts("https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBkqB_t3LeWON0XZTQnrbStZsXKxkzVAhg",
  authDomain: "black-hole-21.firebaseapp.com",
  projectId: "black-hole-21",
  storageBucket: "black-hole-21.firebasestorage.app",
  messagingSenderId: "8258393999",
  appId: "1:8258393999:web:291ffec222a173f7d71dfa",
  measurementId: "G-E8NGTPHHEZ"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || "Black Hole 21", {
    body: notification.body || "You have a new message.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "black-hole-21-broadcast",
    renotify: true,
    data: payload.data || {}
  });
});
