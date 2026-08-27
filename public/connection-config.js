/* Black Hole 21 — single shared Socket.IO connection. */
(function () {
  "use strict";
  const BACKEND_URL = "https://black-hole-21.onrender.com";
  const nativeIo = window.io;
  function status(state, detail) {
    const el = document.querySelector("#connection-status");
    const text = document.querySelector("#conn-text");
    if (el) { el.classList.remove("connected","connecting","reconnecting","disconnected"); el.classList.add(state); }
    if (text) text.textContent = state === "connected" ? "Connected" : state === "reconnecting" ? "Reconnecting…" : state === "disconnected" ? "Connection error" : "Connecting…";
    if (detail) console.error("[BH21]", detail);
  }
  window.__BH21_SOCKET_URL = BACKEND_URL;
  window.addEventListener("error", e => console.error("[BH21 JS ERROR]", e.error || e.message));
  window.addEventListener("unhandledrejection", e => console.error("[BH21 PROMISE ERROR]", e.reason));
  if (typeof nativeIo !== "function") {
    status("disconnected", "Socket.IO client missing");
    return;
  }
  let shared = null;
  function createSocket() {
    if (shared) return shared;
    shared = nativeIo(BACKEND_URL, {
      path: "/socket.io/",
      transports: ["polling", "websocket"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
      autoConnect: true,
      forceNew: false,
      multiplex: true
    });
    window.__bh21Socket = shared;
    status("connecting");
    shared.on("connect", () => { status("connected"); console.log("[BH21] CONNECTED", shared.id); });
    shared.on("connect_error", e => status("disconnected", e && e.message));
    shared.on("disconnect", r => { if (r !== "io client disconnect") status("reconnecting", r); });
    shared.io.on("reconnect_attempt", () => status("reconnecting"));
    shared.io.on("reconnect", () => status("connected"));
    return shared;
  }
  // app.js calls io() with no URL. Keep that API but force it to return
  // the one connection targeting Render instead of accidentally connecting
  // to the Capacitor/local origin.
  window.io = function () { return createSocket(); };
  createSocket();
})();