/* Black Hole 21 — single shared Socket.IO connection. */
(function () {
  "use strict";
  const BACKEND_URL = "https://black-hole-21.onrender.com";
  function status(state, detail) {
    const el = document.querySelector("#connection-status");
    const text = document.querySelector("#conn-text");
    if (el) { el.classList.remove("connected","connecting","reconnecting","disconnected"); el.classList.add(state); }
    if (text) text.textContent = state === "connected" ? "Connected" : state === "reconnecting" ? "Reconnecting…" : state === "disconnected" ? "Connection error" : "Connecting…";
    if (detail) console.error("[BH21]", detail);
  }
  window.addEventListener("error", e => console.error("[BH21 JS ERROR]", e.error || e.message));
  window.addEventListener("unhandledrejection", e => console.error("[BH21 PROMISE ERROR]", e.reason));
  function boot() {
    if (window.__bh21Socket) return;
    if (typeof window.io !== "function") { status("disconnected", "Socket.IO client missing"); return; }
    const s = window.io(BACKEND_URL, { path: "/socket.io/", transports: ["polling","websocket"], upgrade: true, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 5000, timeout: 30000, autoConnect: true, forceNew: false, multiplex: true });
    window.__bh21Socket = s;
    window.__BH21_SOCKET_URL = BACKEND_URL;
    status("connecting");
    s.on("connect", () => { status("connected"); console.log("[BH21] CONNECTED", s.id); });
    s.on("connect_error", e => status("disconnected", e && e.message));
    s.on("disconnect", r => { if (r !== "io client disconnect") status("reconnecting", r); });
    s.io.on("reconnect_attempt", () => status("reconnecting"));
    s.io.on("reconnect", () => status("connected"));
  }
  if (typeof window.io === "function") boot(); else window.addEventListener("load", boot, { once: true });
})();