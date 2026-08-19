(() => {
  "use strict";

  const BACKEND_URL = "https://black-hole-21.onrender.com/api/push/register";
  const log = (...args) => console.log("[push]", ...args);
  const error = (...args) => console.error("[push]", ...args);

  const register = async () => {
    try {
      const nativePlugin =
        window.CapacitorPushNotifications?.PushNotifications ||
        window.Capacitor?.Plugins?.PushNotifications;

      if (!nativePlugin) {
        error("PushNotifications plugin is not available in the native WebView");
        return;
      }

      await nativePlugin.addListener("registration", async (token) => {
        const fcmToken = token?.value;
        if (!fcmToken) {
          error("registration event contained no FCM token");
          return;
        }

        log("FCM registration token:", fcmToken);

        try {
          const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: fcmToken }),
          });
          const body = await response.json().catch(() => null);
          if (!response.ok) {
            error("backend token registration failed:", response.status, body);
            return;
          }
          log("FCM token registered with backend:", body);
        } catch (requestError) {
          error("backend token registration request failed:", requestError);
        }
      });

      await nativePlugin.addListener("registrationError", (registrationError) => {
        error("FCM registration error:", registrationError?.error || registrationError);
      });

      await nativePlugin.addListener("pushNotificationReceived", (notification) => {
        log("push notification received:", notification?.title || "(no title)");
      });

      let permission = await nativePlugin.checkPermissions();
      log("notification permission before request:", permission.receive);

      if (permission.receive !== "granted") {
        permission = await nativePlugin.requestPermissions();
        log("notification permission after request:", permission.receive);
      }

      if (permission.receive !== "granted") {
        error("notification permission was not granted; FCM registration skipped");
        return;
      }

      log("permission granted; calling PushNotifications.register()");
      await nativePlugin.register();
      log("PushNotifications.register() completed; waiting for registration event");
    } catch (e) {
      error("native push setup failed:", e);
    }
  };

  // The native MainActivity injects this file only for Android builds.
  // Keeping it out of www/index.html means the browser build is unchanged.
  if (window.Capacitor?.isNativePlatform?.()) {
    register();
  }
})();
