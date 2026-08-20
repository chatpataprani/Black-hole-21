(function () {
  "use strict";

  const NAME_KEY = "bh21_player_name";
  const LOGO_KEY = "bh21_custom_logo";

  function getName() {
    return (localStorage.getItem(NAME_KEY) || "").trim();
  }

  function saveName(name) {
    const clean = String(name || "").trim().slice(0, 20);
    if (!clean) return false;
    localStorage.setItem(NAME_KEY, clean);
    document.querySelectorAll("#create-name, #join-name").forEach((el) => { el.value = clean; });
    return true;
  }

  function injectStyles() {
    if (document.getElementById("profile-settings-style")) return;
    const style = document.createElement("style");
    style.id = "profile-settings-style";
    style.textContent = `
      #bh21-name-modal, #bh21-logo-modal { position:fixed; inset:0; z-index:10000; display:none; align-items:center; justify-content:center; padding:20px; background:rgba(0,0,0,.78); backdrop-filter:blur(12px); }
      #bh21-name-modal.open, #bh21-logo-modal.open { display:flex; }
      .bh21-profile-card { width:min(430px,100%); padding:28px; border:1px solid rgba(255,255,255,.12); border-radius:24px; background:rgba(17,18,29,.98); box-shadow:0 24px 80px rgba(0,0,0,.55); color:#fff; }
      .bh21-profile-card h2 { margin:0 0 8px; font-size:1.55rem; }
      .bh21-profile-card p { margin:0 0 18px; opacity:.72; line-height:1.5; }
      .bh21-profile-card .text-input { width:100%; box-sizing:border-box; margin-bottom:14px; }
      .bh21-profile-actions { display:flex; gap:10px; flex-wrap:wrap; }
      .bh21-profile-actions .btn { flex:1; min-width:120px; }
      .bh21-logo-preview { width:120px; height:120px; margin:0 auto 18px; border-radius:24px; object-fit:cover; display:block; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); }
      .bh21-logo-upload { display:block; width:100%; box-sizing:border-box; margin:0 0 14px; padding:14px; border:1px dashed rgba(255,255,255,.2); border-radius:14px; text-align:center; cursor:pointer; }
      .bh21-logo-upload input { display:none; }
      #screen-settings .bh21-profile-row { display:flex; align-items:center; justify-content:space-between; gap:16px; }
      #screen-settings .bh21-profile-value { max-width:55%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; opacity:.65; }
      #custom-game-logo { width:96px; height:96px; object-fit:cover; border-radius:24px; display:block; margin:0 auto 16px; border:1px solid rgba(255,255,255,.14); box-shadow:0 12px 40px rgba(0,0,0,.35); }
      .bh21-logo-active .hero-mark { display:none !important; }
    `;
    document.head.appendChild(style);
  }

  function addModal(id, html) {
    if (document.getElementById(id)) return document.getElementById(id);
    const el = document.createElement("div");
    el.id = id;
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }

  function addNameModal() {
    const modal = addModal("bh21-name-modal", `
      <div class="bh21-profile-card" role="dialog" aria-modal="true" aria-labelledby="bh21-name-title">
        <h2 id="bh21-name-title">What's your name?</h2>
        <p>This name is saved on this device and won't be asked again. You can change it later in Settings.</p>
        <input id="bh21-name-input" class="text-input" maxlength="20" autocomplete="name" placeholder="Enter your name" />
        <div class="bh21-profile-actions"><button id="bh21-name-save" class="btn btn-primary">Continue</button></div>
      </div>`);
    const input = modal.querySelector("#bh21-name-input");
    modal.querySelector("#bh21-name-save").addEventListener("click", () => {
      if (saveName(input.value)) {
        modal.classList.remove("open");
        showToastSafe("Name saved");
      } else {
        input.focus();
        input.setCustomValidity("Please enter a name");
        input.reportValidity();
      }
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") modal.querySelector("#bh21-name-save").click(); });
    return modal;
  }

  function addLogoModal() {
    const modal = addModal("bh21-logo-modal", `
      <div class="bh21-profile-card" role="dialog" aria-modal="true" aria-labelledby="bh21-logo-title">
        <h2 id="bh21-logo-title">Change game logo</h2>
        <p>Choose an image from your phone. This changes the logo inside the game on this device.</p>
        <img id="bh21-logo-preview" class="bh21-logo-preview" alt="Logo preview" />
        <label class="bh21-logo-upload">Tap to choose an image<input id="bh21-logo-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
        <div class="bh21-profile-actions"><button id="bh21-logo-reset" class="btn btn-ghost">Reset</button><button id="bh21-logo-close" class="btn btn-secondary">Done</button></div>
      </div>`);
    const input = modal.querySelector("#bh21-logo-input");
    const preview = modal.querySelector("#bh21-logo-preview");
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) { showToastSafe("Image is too large (max 8 MB)"); input.value = ""; return; }
      const reader = new FileReader();
      reader.onload = () => compressLogo(reader.result).then((dataUrl) => { localStorage.setItem(LOGO_KEY, dataUrl); applyLogo(dataUrl); preview.src = dataUrl; showToastSafe("Logo changed"); }).catch(() => showToastSafe("Couldn't use that image"));
      reader.readAsDataURL(file);
    });
    modal.querySelector("#bh21-logo-reset").addEventListener("click", () => { localStorage.removeItem(LOGO_KEY); applyLogo(""); preview.src = ""; showToastSafe("Logo reset"); });
    modal.querySelector("#bh21-logo-close").addEventListener("click", () => modal.classList.remove("open"));
    return modal;
  }

  function compressLogo(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const size = 512;
        const scale = Math.min(size / img.width, size / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", .88));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function applyLogo(dataUrl) {
    document.body.classList.toggle("bh21-logo-active", !!dataUrl);
    let img = document.getElementById("custom-game-logo");
    if (!img) {
      img = document.createElement("img");
      img.id = "custom-game-logo";
      img.alt = "Game logo";
      const homeMark = document.querySelector("#screen-home .hero-mark");
      if (homeMark) homeMark.parentNode.insertBefore(img, homeMark.nextSibling);
    }
    img.style.display = dataUrl ? "block" : "none";
    if (dataUrl) img.src = dataUrl;
    document.querySelectorAll(".bh21-custom-logo-preview").forEach((el) => { el.src = dataUrl || ""; el.style.display = dataUrl ? "block" : "none"; });
  }

  function addSettingsRows() {
    const list = document.querySelector("#screen-settings .settings-list");
    if (!list || document.getElementById("bh21-name-row")) return;
    const nameRow = document.createElement("div");
    nameRow.id = "bh21-name-row";
    nameRow.className = "setting-row bh21-profile-row";
    nameRow.innerHTML = `<span class="setting-label">👤 Name <span class="bh21-profile-value" id="bh21-name-value"></span></span><button class="btn btn-ghost" id="bh21-change-name">Change</button>`;
    const logoRow = document.createElement("div");
    logoRow.id = "bh21-logo-row";
    logoRow.className = "setting-row bh21-profile-row";
    logoRow.innerHTML = `<span class="setting-label">🎨 Game logo</span><button class="btn btn-ghost" id="bh21-change-logo">Upload</button>`;
    list.append(nameRow, logoRow);
    updateNameLabel();
    document.getElementById("bh21-change-name").addEventListener("click", () => {
      const modal = addNameModal();
      const input = modal.querySelector("#bh21-name-input");
      input.value = getName();
      modal.classList.add("open");
      setTimeout(() => { input.focus(); input.select(); }, 50);
    });
    document.getElementById("bh21-change-logo").addEventListener("click", () => {
      const modal = addLogoModal();
      const saved = localStorage.getItem(LOGO_KEY) || "";
      modal.querySelector("#bh21-logo-preview").src = saved;
      modal.classList.add("open");
    });
  }

  function updateNameLabel() {
    const el = document.getElementById("bh21-name-value");
    if (el) el.textContent = getName() || "Not set";
  }

  function showToastSafe(message) {
    if (typeof window.showToast === "function") window.showToast(message);
    else {
      const toast = document.getElementById("toast");
      if (toast) { toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2200); }
    }
    updateNameLabel();
  }

  function fillNames() {
    const name = getName();
    if (!name) return;
    document.querySelectorAll("#create-name, #join-name").forEach((el) => { el.value = name; });
  }

  function boot() {
    injectStyles();
    const name = getName();
    if (!name) {
      const modal = addNameModal();
      modal.classList.add("open");
      setTimeout(() => modal.querySelector("#bh21-name-input").focus(), 100);
    }
    fillNames();
    applyLogo(localStorage.getItem(LOGO_KEY) || "");
    addSettingsRows();
    const observer = new MutationObserver(() => { fillNames(); addSettingsRows(); });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("storage", () => { fillNames(); updateNameLabel(); applyLogo(localStorage.getItem(LOGO_KEY) || ""); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
