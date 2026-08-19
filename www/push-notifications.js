(() => {
  "use strict";

  const BACKEND_URL = "https://black-hole-21.onrender.com/api/push/register";
  const log = (...args) => console.log("[push]", ...args);
  const error = (...args) => console.error("[push]", ...args);
  let started = false;

  const register = async () => {
    if (started) return;

    try {
      if (!window.Capacitor?.isNativePlatform?.()) return;

      const nativePlugin =
        window.CapacitorPushNotifications?.PushNotifications ||
        window.Capacitor?.Plugins?.PushNotifications;

      if (!nativePlugin) {
        error("PushNotifications plugin is not available yet; retrying...");
        setTimeout(register, 500);
        return;
      }

      started = true;

      await nativePlugin.addListener("registration", async (token) => {
        const fcmToken = token?.value;
        if (!fcmToken) {
          error("registration event contained no FCM token");
          return;
        }

        // Debugging only: this is an FCM device token, never a Firebase
        // service-account private key or credential.
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
      started = false;
      error("native push setup failed:", e);
      setTimeout(register, 2000);
    }
  };

  // MainActivity injects this file only into the Android WebView. The
  // browser version never executes this registration path.
  register();
})();
