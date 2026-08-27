/* Black Hole 21 - reliable Socket.IO bootstrap for web + Capacitor. */
(function () {
  "use strict";

  const BACKEND_URL = "https://black-hole-21.onrender.com";
  const client = window.io;
  let socket = null;

  if (typeof client !== "function") {
    console.error("[socket] Socket.IO client did not load");
    const el = document.querySelector("#conn-text");
    if (el) el.textContent = "Connection error";
    return;
  }

  function createSocket() {
    if (socket) return socket;

    socket = client(BACKEND_URL, {
      path: "/socket.io/",
      transports: ["websocket", "polling"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
      autoConnect: true,
      withCredentials: false
    });

    window.__bh21Socket = socket;

    socket.on("connect", function () {
      console.log("[socket] CONNECTED", socket.id, BACKEND_URL);
    });
    socket.on("connect_error", function (err) {
      console.error("[socket] CONNECT_ERROR", err && err.message, err);
    });
    socket.on("disconnect", function (reason) {
      console.warn("[socket] DISCONNECTED", reason);
    });

    return socket;
  }

  // app.js uses io(). Always return this same socket. The previous
  // forceNew=true setup could create competing connections and leave the UI
  // listening to a different socket than the one actually connected.
  window.io = function blackHoleIo() {
    return createSocket();
  };

  window.__BH21_SOCKET_URL = BACKEND_URL;
})();