/* Black Hole 21 - reliable Socket.IO connection configuration. */
(function () {
  "use strict";

  const originalIo = window.io;
  if (typeof originalIo !== "function") {
    console.error("[socket] Socket.IO client was not loaded before connection-config.js");
    return;
  }

  const BACKEND_URL = "https://black-hole-21.onrender.com";
  const isCapacitor = !!(window.Capacitor || window.location.protocol === "capacitor:");

  window.io = function configuredIo(url, options) {
    const opts = Object.assign({
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
    }, options || {});

    // Web uses its own origin when the game and Socket.IO server are the
    // same deployment. Capacitor must use the public Render backend.
    const target = isCapacitor ? BACKEND_URL : (url || window.location.origin);
    const socket = originalIo(target, opts);

    socket.on("connect_error", (err) => {
      console.error("[socket] connection error:", err && err.message ? err.message : err);
      window.dispatchEvent(new CustomEvent("bh21-socket-error", {
        detail: { message: err && err.message ? err.message : "Connection failed" }
      }));
    });
    socket.on("connect", () => {
      console.info("[socket] connected:", socket.id, "target:", target);
    });
    socket.on("disconnect", (reason) => {
      console.warn("[socket] disconnected:", reason);
    });
    return socket;
  };
})();
