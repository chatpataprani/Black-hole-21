/* Black Hole 21 - reliable Socket.IO connection configuration. */
(function () {
  "use strict";

  const BACKEND_URL = "https://black-hole-21.onrender.com";
  const CLIENT_URL = BACKEND_URL + "/socket.io/socket.io.js";

  // The CDN client can be blocked by an ad blocker, WebView policy, flaky
  // network, or an Android WebView. The app must still have a Socket.IO
  // client available. Because this file is loaded while index.html is being
  // parsed, document.write() lets us synchronously load the same client from
  // our own backend before app.js executes.
  if (typeof window.io !== "function") {
    try {
      document.write('<script src="' + CLIENT_URL + '"><\\/script>');
    } catch (e) {
      console.error("[socket] failed to load fallback Socket.IO client", e);
    }
  }

  const originalIo = window.io;
  if (typeof originalIo !== "function") {
    console.error("[socket] Socket.IO client was not loaded");
    const status = document.querySelector("#conn-text");
    if (status) status.textContent = "Connection error";
    return;
  }

  function setStatus(message) {
    const el = document.querySelector("#conn-text");
    if (el) el.textContent = message;
  }

  window.io = function configuredIo(_url, options) {
    const opts = Object.assign({}, options || {}, {
      path: "/socket.io/",
      transports: ["polling", "websocket"],
      upgrade: true,
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
