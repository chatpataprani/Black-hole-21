/* Black Hole 21 connection recovery. Keeps the main app from getting stuck on "Connecting…" if a script error or a transient Socket.IO failure happens during startup. */
(function () {
  "use strict";
  function recover() {
    try {
      if (typeof window.io !== "function") return;
      if (window.appState && window.appState.socket && window.appState.socket.connected) return;
      if (typeof window.connectSocket === "function") window.connectSocket();
    } catch (err) {
      console.error("[connection-recovery]", err);
    }
  }
  window.addEventListener("load", function () {
    setTimeout(recover, 250);
    setTimeout(recover, 2000);
    setTimeout(recover, 5000);
  });
})();
