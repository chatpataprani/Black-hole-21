/* Black Hole 21 - reliable Socket.IO connection configuration. */
(function () {
  "use strict";

  const originalIo = window.io;
  if (typeof originalIo !== "function") {
    console.error("[socket] Socket.IO client was not loaded before connection-config.js");
    return;
  }

  const BACKEND_URL = "https://black-hole-21.onrender.com";

  function setStatus(message) {
    const el = document.querySelector("#conn-text");
    if (el) el.textContent = message;
  }

  window.io = function configuredIo(_url, options) {
    const opts = Object.assign({}, options || {}, {
      path: "/socket.io/",
      transports: ["polling"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      withCredentials: false,
    });

    const socket = originalIo(BACKEND_URL, opts);
    window.__bh21Socket = socket;

    socket.on("connect", () => {
      console.info("[socket] connected", socket.id);
      setStatus("Connected");
      window.dispatchEvent(new CustomEvent("bh21-socket-connected", {
        detail: { id: socket.id, target: BACKEND_URL }
      }));
    });

    socket.on("connect_error", (err) => {
      const message = err && err.message ? err.message : "Connection failed";
      console.error("[socket] connection error:", message, err);
      setStatus("Connection error");
      window.dispatchEvent(new CustomEvent("bh21-socket-error", {
        detail: { message }
      }));
    });

    socket.on("disconnect", (reason) => {
      console.warn("[socket] disconnected:", reason);
      setStatus("Reconnecting…");
    });

    return socket;
  };
})();