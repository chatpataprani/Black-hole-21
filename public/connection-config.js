/* Black Hole 21 - Socket.IO bootstrap. Keep this synchronous and tiny. */
(function () {
  "use strict";

  const BACKEND_URL = "https://black-hole-21.onrender.com";
  const client = window.io;

  if (typeof client !== "function") {
    console.error("[socket] Socket.IO client did not load");
    const el = document.querySelector("#conn-text");
    if (el) el.textContent = "Connection error";
    return;
  }

  // app.js calls io() without arguments. Redirect that call to the real
  // backend without document.write, dynamic scripts, or a second client.
  window.io = function blackHoleIo(_ignoredUrl, suppliedOptions) {
    const options = Object.assign({}, suppliedOptions || {}, {
      path: "/socket.io/",
      transports: ["polling", "websocket"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      forceNew: true,
      withCredentials: false,
    });

    const socket = client(BACKEND_URL, options);
    window.__bh21Socket = socket;

    socket.on("connect_error", (err) => {
      console.error("[socket] connect_error:", err && err.message, err);
    });

    return socket;
  };

  window.__BH21_SOCKET_URL = BACKEND_URL;
})();
