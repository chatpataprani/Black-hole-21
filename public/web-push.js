/* Browser FCM integration for Black Hole 21. Android native builds use native FCM registration instead. */
"use strict";

const BLACK_HOLE_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBkqB_t3LeWON0XZTQnrbStZsXKxkzVAhg",
  authDomain: "black-hole-21.firebaseapp.com",
  projectId: "black-hole-21",
  storageBucket: "black-hole-21.firebasestorage.app",
  messagingSenderId: "8258393999",
  appId: "1:8258393999:web:291ffec222a173f7d71dfa",
  measurementId: "G-E8NGTPHHEZ"
};

const BLACK_HOLE_VAPID_KEY = "BMcAsuyx-7Pmkb0al9bebFDGTbH2_7ZgCSEAulpYxGDfaA30gBXM_funlSY5-ZquGumX1OhE7ChbVfSngkGpZw0";
let webMessaging = null;
let webServiceWorker = null;
let webPushReady = false;

async function setupWebPush() {
  if (!window.isSecureContext) throw new Error("Browser notifications require HTTPS.");
  if (!window.Notification || !navigator.serviceWorker) throw new Error("This browser does not support push notifications.");

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;

  if (!firebase.apps.length) firebase.initializeApp(BLACK_HOLE_FIREBASE_CONFIG);
  webMessaging = firebase.messaging();
  webServiceWorker = registration;

  webMessaging.onMessage(async (payload) => {
    console.log("[web-push] foreground message received", payload);
    if (Notification.permission !== "granted") return;
    const notification = payload.notification || {};
    await registration.showNotification(notification.title || "Black Hole 21", {
      body: notification.body || "You have a new message.",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "black-hole-21-broadcast",
      renotify: true,
      data: payload.data || {}
    });
  });

  return { messaging: webMessaging, registration };
}

async function enableBlackHoleWebPush() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was " + permission + ".");

  const { messaging, registration } = webPushReady
    ? { messaging: webMessaging, registration: webServiceWorker }
    : await setupWebPush();

  const token = await messaging.getToken({
    vapidKey: BLACK_HOLE_VAPID_KEY,
    serviceWorkerRegistration: registration
  });
  if (!token) throw new Error("Firebase returned no browser registration token.");

  console.log("[web-push] FCM registration token:", token);
  const response = await fetch("/api/push/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, platform: "web" })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error("Push token registration failed: HTTP " + response.status);
  }

  webPushReady = true;
  try { localStorage.setItem("bh21_web_push_enabled", "1"); } catch (e) {}
  return { token, subscriberCount: result.subscriberCount };
}

async function disableBlackHoleWebPush() {
  try {
    if (!webMessaging) return;
    const token = await webMessaging.getToken({
      vapidKey: BLACK_HOLE_VAPID_KEY,
      serviceWorkerRegistration: webServiceWorker
    });
    if (token) {
      await fetch("/api/push/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
    }
    await webMessaging.deleteToken();
  } finally {
    webPushReady = false;
    try { localStorage.removeItem("bh21_web_push_enabled"); } catch (e) {}
  }
}

window.blackHoleWebPush = {
  enable: enableBlackHoleWebPush,
  disable: disableBlackHoleWebPush
};
