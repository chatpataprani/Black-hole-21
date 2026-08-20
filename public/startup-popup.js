(() => {
  const IMAGE = '/popup-image.svg?v=1';
  const KEY = 'black-hole-21-startup-popup-seen';
  if (window.__blackHoleStartupPopup) return;
  window.__blackHoleStartupPopup = true;

  const style = document.createElement('style');
  style.textContent = `
    #bh21-startup-popup{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;transition:opacity .22s ease}
    #bh21-startup-popup.bh21-show{opacity:1}
    #bh21-startup-popup .bh21-card{position:relative;width:min(88vw,420px);max-height:88vh;padding:10px;border:1px solid rgba(255,255,255,.14);border-radius:22px;background:#111317;box-shadow:0 24px 80px rgba(0,0,0,.65);transform:scale(.96);transition:transform .22s ease;overflow:hidden}
    #bh21-startup-popup.bh21-show .bh21-card{transform:scale(1)}
    #bh21-startup-popup img{display:block;width:100%;height:auto;max-height:72vh;object-fit:cover;border-radius:15px}
    #bh21-startup-popup .bh21-close{position:absolute;right:18px;top:18px;width:38px;height:38px;border:1px solid rgba(255,255,255,.18);border-radius:50%;background:rgba(0,0,0,.65);color:#fff;font-size:25px;line-height:1;cursor:pointer;z-index:2}
    #bh21-startup-popup .bh21-close:active{transform:scale(.94)}
    @media(max-width:600px){#bh21-startup-popup{padding:14px}#bh21-startup-popup .bh21-card{width:min(94vw,420px);padding:7px;border-radius:18px}#bh21-startup-popup img{border-radius:13px}}
  `;
  document.head.appendChild(style);

  function show() {
    const wrap = document.createElement('div');
    wrap.id = 'bh21-startup-popup';
    wrap.innerHTML = '<div class="bh21-card" role="dialog" aria-modal="true" aria-label="Black Hole 21 announcement"><button class="bh21-close" type="button" aria-label="Close">×</button><img src="' + IMAGE + '" alt="Black Hole 21 announcement"></div>';
    document.body.appendChild(wrap);
    const close = () => {
      wrap.classList.remove('bh21-show');
      setTimeout(() => wrap.remove(), 220);
    };
    wrap.querySelector('.bh21-close').addEventListener('click', close);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    document.addEventListener('keydown', function esc(e){ if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', esc); } });
    requestAnimationFrame(() => wrap.classList.add('bh21-show'));
  }

  // Show once per browser/app installation. Clear this key in browser storage to test again.
  try {
    if (localStorage.getItem(KEY) === '1') return;
    localStorage.setItem(KEY, '1');
  } catch (_) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, {once:true});
  else show();
})();
