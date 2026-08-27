/* Black Hole 21 — single shared Socket.IO connection. */
(function () {
  "use strict";

  const BACKEND_URL = "https://black-hole-21.onrender.com";
  const nativeIo = window.io;
  let shared = null;

  function status(state, detail) {
    const el = document.querySelector("#connection-status");
    const text = document.querySelector("#conn-text");
    if (el) {
      el.classList.remove("connected", "connecting", "reconnecting", "disconnected");
      el.classList.add(state);
    }
    if (text) {
      text.textContent = state === "connected"
        ? "Connected"
        : state === "reconnecting"
          ? "Reconnecting…"
          : state === "disconnected"
            ? "Connection error"
            : "Connecting…";
    }
    if (detail) console.error("[BH21]", detail);
  }

  window.__BH21_SOCKET_URL = BACKEND_URL;
  window.addEventListener("error", e => console.error("[BH21 JS ERROR]", e.error || e.message));
  window.addEventListener("unhandledrejection", e => console.error("[BH21 PROMISE ERROR]", e.reason));

  if (typeof nativeIo !== "function") {
    status("disconnected", "Socket.IO client missing");
    return;
  }

  function createSocket() {
    if (shared) return shared;

    // IMPORTANT: do not connect while app.js is still installing its
    // listeners. The previous implementation connected immediately in
    // this config file, which could fire `connect` before app.js attached
    // its handler and then app.js reset the indicator back to Connecting.
    shared = nativeIo(BACKEND_URL, {
      path: "/socket.io/",
      transports: ["polling", "websocket"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
      autoConnect: false,
      forceNew: false,
      multiplex: true
    });

    window.__bh21Socket = shared;

    shared.on("connect", () => {
      status("connected");
      console.log("[BH21] CONNECTED", shared.id);
    });
    shared.on("connect_error", e => {
      status("disconnected", e && (e.message || e));
    });
    shared.on("disconnect", reason => {
      if (reason !== "io client disconnect") status("reconnecting", reason);
    });
    shared.io.on("reconnect_attempt", () => status("reconnecting"));
    shared.io.on("reconnect", () => status("connected"));
    shared.io.on("reconnect_failed", () => status("disconnected"));

    // Let app.js finish attaching its listeners first.
    setTimeout(() => {
      if (shared && !shared.connected && !shared.active) {
        status("connecting");
        shared.connect();
      }
    }, 0);

    return shared;
  }

  // app.js calls io() with no URL. Return the one socket that always targets
  // the real backend. We intentionally do not create it until app.js asks
  // for it, preventing the connect-event race that caused the stuck UI.
  window.io = function () {
    return createSocket();
  };
})();