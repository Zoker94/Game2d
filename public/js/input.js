// Điều khiển: bàn phím, joystick ảo cảm ứng, tay cầm (Gamepad API), xoay ngang trên mobile.
(function () {
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
  if (isTouch) document.body.classList.add('touch');

  const app = document.getElementById('app');
  const listeners = {};
  const emit = (ev, ...a) => (listeners[ev] || []).forEach(f => f(...a));

  const Input = {
    isTouch,
    rotated: false,
    inGame: false,
    keys: {},
    joy: { x: 0, y: 0, active: false },
    pad: { x: 0, y: 0, connected: false },
    attackHeld: false,
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    emit,
    toLocal(cx, cy) { return this.rotated ? { x: cy, y: window.innerWidth - cx } : { x: cx, y: cy }; },
    size() { return { w: app.clientWidth, h: app.clientHeight }; },
    typing() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'); },
    vector() {
      let x = 0, y = 0;
      const k = this.keys;
      if (!this.typing()) {
        if (k.KeyA || k.ArrowLeft) x -= 1; if (k.KeyD || k.ArrowRight) x += 1;
        if (k.KeyW || k.ArrowUp) y -= 1; if (k.KeyS || k.ArrowDown) y += 1;
      }
      if (this.joy.active) { x += this.joy.x; y += this.joy.y; }
      x += this.pad.x; y += this.pad.y;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      return { x, y };
    }
  };

  // ---------- Bàn phím ----------
  const KEYMAP = { Digit1: ['skill', 0], Space: ['skill', 0], Digit2: ['slot', 1], Digit3: ['slot', 2], Digit4: ['slot', 3], Digit5: ['slot', 4], Digit6: ['slot', 5], Digit7: ['slot', 6], KeyT: ['mount'], ShiftLeft: ['dodge'], ShiftRight: ['dodge'], KeyQ: ['dodge'],
    KeyZ: ['potion', 'hp'], KeyX: ['potion', 'mp'], Tab: ['target'], KeyF: ['interact'], KeyR: ['auto'],
    KeyI: ['panel', 'inventory'], KeyC: ['panel', 'character'], KeyJ: ['panel', 'quests'], KeyG: ['panel', 'guild'], KeyB: ['panel', 'friends'],
    KeyO: ['panel', 'events'], KeyL: ['panel', 'leaderboard'], KeyM: ['panel', 'mount'], KeyK: ['panel', 'skills'], Escape: ['escape'], Enter: ['chat'] };
  window.addEventListener('keydown', e => {
    if (!Input.inGame) return;
    if (Input.typing()) {
      if (e.code === 'Escape') document.activeElement.blur();
      return;
    }
    Input.keys[e.code] = true;
    const m = KEYMAP[e.code];
    if (m) { e.preventDefault(); if (!e.repeat || m[0] === 'skill') emit(m[0], m[1]); }
    if (e.code === 'Space') Input.attackHeld = true;
  });
  window.addEventListener('keyup', e => { Input.keys[e.code] = false; if (e.code === 'Space') Input.attackHeld = false; });
  window.addEventListener('blur', () => { Input.keys = {}; Input.attackHeld = false; });

  // ---------- Joystick ảo ----------
  const zone = document.getElementById('joy-zone');
  const base = document.getElementById('joy-base');
  const knob = document.getElementById('joy-knob');
  let joyId = null, cx = 0, cy = 0, R = 52;
  const baseDefault = () => { base.style.left = ''; base.style.top = ''; base.style.bottom = ''; };
  function joyStart(e) {
    for (const t of e.changedTouches) {
      if (joyId !== null) break;
      joyId = t.identifier;
      const p = Input.toLocal(t.clientX, t.clientY);
      const bw = base.offsetWidth;
      R = bw * 0.4;
      base.style.left = (p.x - bw / 2) + 'px';
      base.style.top = (p.y - bw / 2) + 'px';
      base.style.bottom = 'auto';
      cx = p.x; cy = p.y;
      Input.joy.active = true;
      joyMoveTo(p.x, p.y);
    }
    e.preventDefault();
  }
  function joyMoveTo(x, y) {
    let dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    const kw = knob.offsetWidth, bw = base.offsetWidth;
    knob.style.left = (bw / 2 - kw / 2 + dx) + 'px';
    knob.style.top = (bw / 2 - kw / 2 + dy) + 'px';
    const n = Math.min(1, d / R);
    if (n < 0.18) { Input.joy.x = 0; Input.joy.y = 0; }
    else { Input.joy.x = dx / R; Input.joy.y = dy / R; }
    if (n > 0.18) emit('joymove');
  }
  function joyMove(e) {
    for (const t of e.changedTouches) if (t.identifier === joyId) { const p = Input.toLocal(t.clientX, t.clientY); joyMoveTo(p.x, p.y); }
    e.preventDefault();
  }
  function joyEnd(e) {
    for (const t of e.changedTouches) if (t.identifier === joyId) {
      joyId = null; Input.joy = { x: 0, y: 0, active: false };
      knob.style.left = ''; knob.style.top = ''; baseDefault();
    }
  }
  zone.addEventListener('touchstart', joyStart, { passive: false });
  zone.addEventListener('touchmove', joyMove, { passive: false });
  zone.addEventListener('touchend', joyEnd);
  zone.addEventListener('touchcancel', joyEnd);

  // ---------- Nút hành động cảm ứng ----------
  const hold = (el, down, up) => {
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture && el.setPointerCapture(e.pointerId); down(); });
    const end = () => up && up();
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  };
  hold(document.getElementById('btn-attack'), () => { Input.attackHeld = true; emit('skill', 0); }, () => { Input.attackHeld = false; });
  document.querySelectorAll('.act.sk').forEach(b => hold(b, () => emit('slot', +b.dataset.sk)));
  hold(document.getElementById('btn-hp'), () => emit('potion', 'hp'));
  hold(document.getElementById('btn-mp'), () => emit('potion', 'mp'));
  hold(document.getElementById('btn-target'), () => emit('target'));
  hold(document.getElementById('btn-mount'), () => emit('mount'));
  hold(document.getElementById('btn-dodge'), () => emit('dodge'));

  // ---------- Tay cầm (Gamepad) ----------
  const prevBtn = {};
  const PADMAP = { 0: ['skill', 0], 2: ['slot', 1], 3: ['slot', 2], 1: ['slot', 3], 4: ['potion', 'hp'], 5: ['potion', 'mp'], 6: ['slot', 4], 7: ['slot', 5], 8: ['panel', 'inventory'], 9: ['auto'], 10: ['mount'], 11: ['target'] };
  Input.pollGamepad = function () {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) { this.pad.x = 0; this.pad.y = 0; this.pad.connected = false; return; }
    this.pad.connected = true;
    let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
    if (Math.hypot(x, y) < 0.2) { x = 0; y = 0; }
    const b = i => gp.buttons[i] && gp.buttons[i].pressed;
    if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
    this.pad.x = x; this.pad.y = y;
    this.padAttack = b(0);
    for (const i in PADMAP) {
      const pressed = b(+i);
      if (pressed && !prevBtn[i]) emit(PADMAP[i][0], PADMAP[i][1]);
      prevBtn[i] = pressed;
    }
  };
  window.addEventListener('gamepadconnected', e => emit('toast', `🎮 Đã kết nối tay cầm: ${e.gamepad.id.slice(0, 30)}`));

  // ---------- Xoay ngang ----------
  Input.applyLayout = function () {
    const portrait = window.innerHeight > window.innerWidth;
    const should = isTouch && portrait; // điện thoại dọc: luôn xoay ngang từ màn hình đầu tiên
    this.rotated = should;
    if (should) {
      app.classList.add('rotated');
      app.style.width = window.innerHeight + 'px';
      app.style.height = window.innerWidth + 'px';
    } else {
      app.classList.remove('rotated');
      app.style.width = window.innerWidth + 'px';
      app.style.height = window.innerHeight + 'px';
    }
    document.body.classList.toggle('short', (should ? window.innerWidth : window.innerHeight) <= 430);
    emit('resize');
  };
  Input.goLandscape = async function () {
    if (isTouch) {
      const tmo = (pr) => Promise.race([pr, new Promise(r => setTimeout(r, 1200))]);   // trình duyệt treo lời gọi thì bỏ qua
      try {
        const el = document.documentElement;
        if (!document.fullscreenElement && el.requestFullscreen) await tmo(el.requestFullscreen({ navigationUI: 'hide' }));
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } catch (e) { /* trình duyệt không hỗ trợ */ }
      try { if (screen.orientation && screen.orientation.lock) await tmo(screen.orientation.lock('landscape')); } catch (e) { /* iOS: dùng xoay bằng CSS */ }
    }
    this.applyLayout();
  };
  Input.toggleFullscreen = async function () {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await document.documentElement.requestFullscreen(); if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {}); }
    } catch (e) { }
    setTimeout(() => this.applyLayout(), 200);
  };
  const relayout = () => setTimeout(() => Input.applyLayout(), 60);
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  if (screen.orientation) screen.orientation.addEventListener && screen.orientation.addEventListener('change', relayout);
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('contextmenu', e => { if (Input.inGame) e.preventDefault(); });

  window.Input = Input;
})();
