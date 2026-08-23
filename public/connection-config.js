/* Black Hole 21 - deterministic Socket.IO bootstrap. */
(function () {
  "use strict";

  const BACKEND_URL = "https://black-hole-21.onrender.com";
  const CLIENT_URL = BACKEND_URL + "/socket.io/socket.io.js";

  function setStatus(text) {
    const el = document.querySelector("#conn-text");
    if (el) el.textContent = text;
  }

  // Always use the Socket.IO client served by the same backend version.
  // Do not depend on a CDN or on the APK/WebView origin.
  if (typeof window.io !== "function") {
    document.write('<script src="' + CLIENT_URL + '"><\\/script>');
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
