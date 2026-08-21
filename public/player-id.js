(function () {
  "use strict";

  const KEY = "bh21_social_user";

  function numericId() {
    let id = localStorage.getItem(KEY) || "";
    if (!/^\d{8}$/.test(id)) {
      id = String(Math.floor(10000000 + Math.random() * 90000000));
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  function copyId() {
    const id = numericId();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(id).then(() => notify("Player ID copied")).catch(() => fallbackCopy(id));
    } else fallbackCopy(id);
  }

  function fallbackCopy(text) {
    const input = document.createElement("textarea");
    input.value = text; input.style.position = "fixed"; input.style.opacity = "0";
    document.body.appendChild(input); input.focus(); input.select();
    try { document.execCommand("copy"); notify("Player ID copied"); }
    catch (_) { notify("Copy failed. Select your Player ID manually."); }
    input.remove();
  }

  function notify(message) {
    if (typeof window.showToast === "function") window.showToast(message);
    else {
      const toast = document.getElementById("toast");
      if (toast) { toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 1800); }
    }
  }

  function setup() {
    const id = numericId();
    const value = document.getElementById("bh-my-id");
    if (value) value.textContent = id;
    if (document.getElementById("bh-copy-player-id")) return;
    const idLine = document.querySelector(".bh-social-id");
    if (!idLine) return;
    const button = document.createElement("button");
    button.id = "bh-copy-player-id"; button.className = "btn btn-secondary"; button.type = "button";
    button.textContent = "Copy ID"; button.style.marginBottom = "14px";
    button.addEventListener("click", copyId); idLine.insertAdjacentElement("afterend", button);
  }

  function boot() {
    setup();
    const observer = new MutationObserver(setup);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
