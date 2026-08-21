/* Black Hole 21 - shared Socket.IO connection configuration. */
(function () {
  "use strict";

  const originalIo = window.io;
  if (typeof originalIo !== "function") {
    console.error("[socket] Socket.IO client was not loaded before connection-config.js");
    return;
  }

  const BACKEND_URL = "https://black-hole-21.onrender.com";

  window.io = function configuredIo(url, options) {
    const opts = Object.assign({
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    }, options || {});

    const socket = originalIo(BACKEND_URL, opts);
    socket.on("connect_error", (err) => {
      console.error("[socket] connection error:", err && err.message ? err.message : err);
    });
    socket.on("connect", () => {
      console.info("[socket] connected:", socket.id);
    });
    socket.on("disconnect", (reason) => {
      console.warn("[socket] disconnected:", reason);
    });
    return socket;
  };
})();
