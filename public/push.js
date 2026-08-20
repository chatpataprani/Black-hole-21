"use strict";

(() => {
  const ENDPOINT = "https://black-hole-21.onrender.com/api/push/register";
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBkqB_t3LeWON0XZTQnrbStZsXKxkzVAhg",
    authDomain: "black-hole-21.firebaseapp.com",
    projectId: "black-hole-21",
    storageBucket: "black-hole-21.firebasestorage.app",
    messagingSenderId: "8258393999",
    appId: "1:8258393999:web:291ffec222a173f7d71dfa",
    measurementId: "G-E8NGTPHHEZ",
  };
  const VAPID_KEY = "BMcAsuyx-7Pmkb0al9bebFDGTbH2_7ZgCSEAulpYxGDfaA30gBXM_funlSY5-ZquGumX1OhE7ChbVfSngkGpZw0";

  const toast = (message) => {
    if (typeof window.showToast === "function") return window.showToast(message);
    const el = document.querySelector("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._pushToastTimer);
    el._pushToastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  };

  // Never fall back to the browser Notification API inside the APK.
  // Capacitor exposes the native bridge in the WebView; localhost/capacitor
  // is only a secondary signal for older Capacitor builds.
  const isNative = () => {
    try {
      if (window.Capacitor?.isNativePlatform?.()) return true;
      if (window.Capacitor?.getPlatform?.() === "android") return true;
    } catch (_) {}
    return (location.protocol === "capacitor:" || location.hostname === "localhost")
      && /Android/i.test(navigator.userAgent);
  };

  async function registerToken(token, platform) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token, platform }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || `Token registration failed (HTTP ${response.status})`);
    }
    console.log(`[push] ${platform} token registered; subscribers=${result.subscriberCount}`);
  }

  function setSetting(value) {
    try {
      const raw = localStorage.getItem("bh21_settings");
      const settings = raw ? JSON.parse(raw) : {};
      settings.notifications = value;
      localStorage.setItem("bh21_settings", JSON.stringify(settings));
    } catch (_) {}
    const toggle = document.querySelector("#toggle-notifications");
    if (toggle) toggle.setAttribute("aria-checked", String(value));
  }

  async function nativePush() {
    const plugin = window.Capacitor?.Plugins?.PushNotifications;
    if (!plugin) {
      console.error("[push] Capacitor PushNotifications plugin is unavailable in this APK");
      throw new Error("Android push plugin is unavailable. Install the latest APK.");
    }

    let permission = await plugin.checkPermissions();
    if (permission.receive !== "granted") permission = await plugin.requestPermissions();
    if (permission.receive !== "granted") throw new Error("Notification permission was not granted.");

    await plugin.addListener("registration", async (token) => {
      try {
        await registerToken(token.value, "android");
        setSetting(true);
        toast("Notifications enabled.");
      } catch (error) {
        console.error("[push] Android token registration failed:", error);
        toast(`Notifications failed: ${error.message}`);
      }
    });

    await plugin.addListener("registrationError", (error) => {
      console.error("[push] Android registration error:", error);
      toast(`Notifications failed: ${error?.error || "FCM registration error"}`);
    });

    await plugin.register();
  }

  const loadScript = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load Firebase SDK: ${src}`));
    document.head.appendChild(s);
  });

  async function browserPush() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      throw new Error("This browser does not support push notifications.");
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Notification permission was not granted.");

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    await loadScript("https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js");
    if (!window.firebase.apps.length) window.firebase.initializeApp(FIREBASE_CONFIG);
    const messaging = window.firebase.messaging();
    const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) throw new Error("Firebase returned an empty FCM token.");
    await registerToken(token, "web");

    messaging.onMessage((payload) => {
      const n = payload.notification || {};
      navigator.serviceWorker.ready.then((sw) => sw.showNotification(n.title || "Black Hole 21", {
        body: n.body || "You have a new message.",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "black-hole-21-broadcast",
        renotify: true,
        data: payload.data || {},
      }));
    });

    setSetting(true);
    toast("Notifications enabled.");
  }

  async function enable() {
    try {
      if (isNative()) await nativePush();
      else await browserPush();
    } catch (error) {
      console.error("[push] setup failed:", error);
      setSetting(false);
      toast(`Notifications failed: ${error.message}`);
    }
  }

  function installHandler() {
    const original = document.querySelector("#toggle-notifications");
    if (!original) return;
    const toggle = original.cloneNode(true);
    original.replaceWith(toggle);
    toggle.addEventListener("click", () => {
      const next = toggle.getAttribute("aria-checked") !== "true";
      if (!next) {
        setSetting(false);
        toast("Notifications turned off in settings.");
        return;
      }
      toggle.setAttribute("aria-checked", "true");
      enable();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installHandler, { once: true });
  } else {
    installHandler();
  }
})();
