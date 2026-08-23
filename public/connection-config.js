/* Black Hole 21 - deterministic Socket.IO bootstrap. */
(function () {
  "use strict";

  const BACKEND_URL = "https://black-hole-21.onrender.com";
  const CLIENT_URL = BACKEND_URL + "/socket.io/socket.io.js";

  function setStatus(text) {
    const el = document.querySelector("#conn-text");
    if (el) el.textContent = text;
  }

  // index.html may have loaded a CDN copy first. Replace it with the exact
  // client served by the Socket.IO server so client/server versions cannot
  // drift and the Android WebView never depends on a third-party CDN.
  const cdnIo = window.io;
  window.io = undefined;
  document.write('<script src="' + CLIENT_URL + '"><\\/script>');

  if (typeof window.io !== "function") {
    // Restore the CDN copy only as a last-resort fallback.
    window.io = cdnIo;
  }

  if (typeof window.io !== "function") {
    console.error("[socket] Socket.IO client failed to load from", CLIENT_URL);
    setStatus("Connection error");
    return;
  }

  const serverIo = window.io;

  window.io = function blackHoleIo(_ignoredUrl, suppliedOptions) {
    const options = Object.assign({}, suppliedOptions || {}, {
      path: "/socket.io/",
      transports: ["polling"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      forceNew: true,
      withCredentials: false
    });

    const socket = serverIo(BACKEND_URL, options);
    window.__bh21Socket = socket;

    socket.on("connect", function () {
      console.info("[socket] connected", socket.id);
      setStatus("Connected");
    });

    socket.on("connect_error", function (err) {
      console.error("[socket] connect_error", err && err.message, err);
      setStatus("Connection error");
    });

    socket.on("disconnect", function (reason) {
      console.warn("[socket] disconnected", reason);
      if (reason !== "io client disconnect") setStatus("Reconnecting…");
    });

    return socket;
  };
})();
