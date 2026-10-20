/* Shared DOM helpers, persistence and icons used by all views. */
(function (root) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var STORE_KEY = 'espresso-kompass-v1';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'class') n.className = v;
      else if (k === 'style') n.setAttribute('style', v);
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return n;
  }

  function svg(tag, attrs, children) {
    var n = document.createElementNS(SVG_NS, tag);
    for (var k in attrs || {}) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function fmt(n, digits) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '–';
    return Number(n).toLocaleString('de-DE', { maximumFractionDigits: digits == null ? 1 : digits });
  }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2800);
  }

  function load() {
    try { var raw = localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function save(state) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep in memory */ }
  }

  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not allowed */ }
  }

  /*
   * Haptic "clicks" in three strengths (same approach as the wine app):
   * Android vibrates for different lengths; iPhone Safari has no vibration API,
   * but toggling a hidden <input switch> plays the system tick. iOS only allows
   * that directly inside a tap or touch-end, which is what releaseTick is for.
   */
  var lastTick = 0, iosSwitch = null;
  function isIOS() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function iosTick() {
    if (!iosSwitch) {
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.id = 'ek-haptic-switch';
      var label = document.createElement('label');
      label.htmlFor = input.id;
      [input, label].forEach(function (n) {
        n.setAttribute('aria-hidden', 'true');
        n.tabIndex = -1;
        n.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:0';
      });
      document.body.appendChild(input);
      document.body.appendChild(label);
      iosSwitch = label;
    }
    iosSwitch.click();
  }
  function tick(kind) {
    kind = kind || 'minor';
    var now = performance.now();
    if (now - lastTick < 28 && kind === 'minor') return;
    lastTick = now;
    try {
      if ('vibrate' in navigator) { navigator.vibrate(kind === 'major' ? 22 : kind === 'medium' ? 12 : 5); return; }
    } catch (e) { return; }
    if (isIOS()) {
      iosTick();
      if (kind === 'major') setTimeout(iosTick, 70);
    }
  }
  function releaseTick(kind) {
    if ('vibrate' in navigator || !isIOS()) return;
    iosTick();
    if (kind === 'major') setTimeout(iosTick, 70);
  }

  // Short beep for step changes in the brew timer. Only after a user gesture.
  var audioCtx = null;
  function beep(freq) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = freq || 880;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.26);
    } catch (e) { /* audio unavailable */ }
  }

  // Line icons, 24×24, stroke = currentColor.
  var ICONS = {
    espresso: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3c0 1.5 1.5 1.5 1.5 3M11.5 3c0 1.5 1.5 1.5 1.5 3"/><path d="M4 21h14"/>',
    brew: '<path d="M6 4h12l-4 8v6h-4v-6z"/><path d="M9 21h6"/><path d="M12 12v2"/>',
    cafe: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><path d="M9 9h5v2a2.5 2.5 0 0 1-5 0z"/><path d="M14 9.5h.8a1 1 0 0 1 0 2H14"/>',
    beans: '<ellipse cx="12" cy="12" rx="6" ry="8.5" transform="rotate(-30 12 12)"/><path d="M9 6.5c3 2.5 3 8.5 6 11"/>',
    learn: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    aeropress: '<rect x="7" y="7" width="10" height="13" rx="1"/><path d="M9 3h6v4H9z"/><path d="M12 3V1.5"/><path d="M7 12h10"/><path d="M5 20h14"/>',
    frenchpress: '<rect x="6" y="6" width="10" height="15" rx="1.5"/><path d="M16 9h2a1.5 1.5 0 0 1 1.5 1.5V15a1.5 1.5 0 0 1-1.5 1.5h-2"/><path d="M11 6V2"/><path d="M8.5 2h5"/><path d="M6 11h10"/>',
    v60: '<path d="M4 6h16l-6 9h-4z"/><path d="M9 15l-1 3h8l-1-3"/><path d="M5 21h14"/>',
    chemex: '<path d="M6 3h12l-4.5 8L18 21H6l4.5-10z"/><path d="M9.5 9.5h5"/>',
    moka: '<path d="M8 3h8l1 6H7z"/><path d="M7 9h10l-2 3 2 9H7l2-9z"/><path d="M17 5l2.5 2"/><path d="M12 3V1.5"/>',
    coldbrew: '<path d="M7 4h10v15a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/><path d="M7 8h10"/><rect x="9.5" y="11" width="4" height="4" rx=".8" transform="rotate(12 11.5 13)"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    locate: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.5-4.5"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.5M8.2 13.2l7.6 4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 8h8v8H8z"/>',
    wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.3 4.3M14.1 14.1l4.3 4.3M18.4 5.6l-4.3 4.3M9.9 14.1l-4.3 4.3"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'
  };
  function icon(name, cls) {
    var s = '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
    var wrap = document.createElement('span');
    wrap.innerHTML = s;
    return wrap.firstChild;
  }

  root.UI = { $: $, $$: $$, el: el, svg: svg, fmt: fmt, toast: toast, load: load, save: save, vibrate: vibrate, tick: tick, releaseTick: releaseTick, beep: beep, icon: icon, ICONS: ICONS };
})(this);
