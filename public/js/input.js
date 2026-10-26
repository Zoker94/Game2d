// Điều khiển: bàn phím, joystick ảo cảm ứng, tay cầm (Gamepad API), xoay ngang trên mobile.
(function () {
  // giao diện điện thoại hay máy tính: theo thiết bị trỏ CHÍNH (máy tính có màn cảm ứng / bút nhưng dùng chuột vẫn là giao diện máy tính).
  // Người chơi có thể ép chọn trong Cài đặt (vl_ui: auto | pc | mobile).
  let uiPref = 'auto'; try { uiPref = localStorage.getItem('vl_ui') || 'auto'; } catch (e) {}
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const autoTouch = mobileUA || matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(any-pointer: fine)').matches);
  const isTouch = uiPref === 'mobile' || (uiPref !== 'pc' && autoTouch);
  if (isTouch) document.body.classList.add('touch');
  // tự nhận ra đang dùng chuột trên giao diện điện thoại: hỏi một lần có muốn chuyển sang giao diện máy tính
  if (isTouch && uiPref === 'auto') {
    let mv = 0;
    const onMouse = e => {
      if (e.pointerType !== 'mouse' || ++mv < 25) return;
      window.removeEventListener('pointermove', onMouse);
      if (window.G && G.modal) G.modal('Bạn đang dùng chuột – chuyển sang giao diện máy tính cho gọn?\n(Có thể đổi lại trong Cài đặt → Giao diện)', [
        { t: '🖥️ Chuyển', cls: 'primary', fn: () => { try { localStorage.setItem('vl_ui', 'pc'); } catch (e2) {} location.reload(); } },
        { t: 'Giữ nguyên', fn: () => { try { localStorage.setItem('vl_ui', 'mobile'); } catch (e2) {} } }]);
    };
    window.addEventListener('pointermove', onMouse);
  }

  const app = document.getElementById('app');
  const listeners = {};
  const emit = (ev, ...a) => (listeners[ev] || []).forEach(f => f(...a));

  const Input = {
    isTouch, uiPref,
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
        const on = id => (binds.keys[id] || []).some(c => k[c]);
        if (on('left')) x -= 1; if (on('right')) x += 1;
        if (on('up')) y -= 1; if (on('down')) y += 1;
      }
      if (this.joy.active) { x += this.joy.x; y += this.joy.y; }
      x += this.pad.x; y += this.pad.y;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      return { x, y };
    }
  };

  // ---------- Gán phím (bàn phím + tay cầm) – người chơi tự đổi trong Cài đặt → Cài đặt phím ----------
  // [mã, tên, sự kiện, tham số, phím mặc định (tối đa 2), nút tay cầm mặc định]
  const ACTIONS = [
    ['up', 'Đi lên', null, null, ['KeyW', 'ArrowUp']], ['down', 'Đi xuống', null, null, ['KeyS', 'ArrowDown']],
    ['left', 'Đi sang trái', null, null, ['KeyA', 'ArrowLeft']], ['right', 'Đi sang phải', null, null, ['KeyD', 'ArrowRight']],
    ['attack', 'Đánh thường', 'skill', 0, ['Digit1', 'Space'], 0],
    ['slot1', 'Ô kỹ năng 1', 'slot', 1, ['Digit2'], 2], ['slot2', 'Ô kỹ năng 2', 'slot', 2, ['Digit3'], 3], ['slot3', 'Ô kỹ năng 3', 'slot', 3, ['Digit4'], 1],
    ['slot4', 'Ô kỹ năng 4', 'slot', 4, ['Digit5'], 6], ['slot5', 'Ô kỹ năng 5', 'slot', 5, ['Digit6'], 7], ['slot6', 'Ô kỹ năng 6', 'slot', 6, ['Digit7']],
    ['slot7', 'Ô kỹ năng 7', 'slot', 7, ['Digit8']], ['slot8', 'Ô kỹ năng 8', 'slot', 8, ['Digit9']],
    ['dodge', 'Khinh công', 'dodge', null, ['ShiftLeft', 'KeyQ']],
    ['hp', 'Bình máu', 'potion', 'hp', ['KeyZ'], 4], ['mp', 'Bình nội lực', 'potion', 'mp', ['KeyX'], 5],
    ['target', 'Đổi mục tiêu', 'target', null, ['Tab'], 11], ['interact', 'Nói chuyện / nhặt đồ', 'interact', null, ['KeyF']],
    ['auto', 'Bật / tắt tự động', 'auto', null, ['KeyR'], 9], ['mount', 'Cưỡi thú', 'mount', null, ['KeyT'], 10],
    ['meditate', 'Ngồi thiền', 'meditate', null, ['KeyY']], ['recall', 'Về thành', 'recall', null, ['KeyH']],
    ['inventory', 'Túi đồ', 'panel', 'inventory', ['KeyI'], 8], ['character', 'Nhân vật', 'panel', 'character', ['KeyC']],
    ['skills', 'Võ công', 'panel', 'skills', ['KeyK']], ['quests', 'Nhiệm vụ', 'panel', 'quests', ['KeyJ']],
    ['mountp', 'Thú cưỡi', 'panel', 'mount', ['KeyM']], ['guild', 'Bang hội', 'panel', 'guild', ['KeyG']],
    ['friends', 'Bạn bè', 'panel', 'friends', ['KeyB']], ['events', 'Sự kiện', 'panel', 'events', ['KeyO']],
    ['leaderboard', 'Xếp hạng', 'panel', 'leaderboard', ['KeyL']], ['giftcode', 'Gift code', 'panel', 'giftcode', ['KeyU']],
    ['tlist', 'Danh sách mục tiêu', 'tlist', null, ['KeyV']], ['bigmap', 'Bản đồ', 'bigmap', null, ['KeyN']],
    ['chat', 'Mở khung chat', 'chat', null, ['Enter']]
  ];
  const ACT = Object.fromEntries(ACTIONS.map(a => [a[0], a]));
  const defaults = () => ({ keys: Object.fromEntries(ACTIONS.map(a => [a[0], a[4].slice()])), pad: Object.fromEntries(ACTIONS.map(a => [a[0], a[5] == null ? null : a[5]])) });
  let binds = defaults(), KEYMAP = {}, PADMAP = {};
  try {   // cấu hình đã lưu (thiếu hành động mới thì lấy mặc định)
    const sv = JSON.parse(localStorage.getItem('vl_keybind') || 'null');
    if (sv) for (const id in ACT) { if (Array.isArray(sv.keys && sv.keys[id])) binds.keys[id] = sv.keys[id].slice(0, 2); if (sv.pad && id in sv.pad) binds.pad[id] = sv.pad[id]; }
  } catch (e) { }
  function rebuild() {
    KEYMAP = { Escape: ['escape'] };   // Esc luôn để đóng bảng, không cho gán
    PADMAP = {};
    for (const [id, , ev, arg] of ACTIONS) {
      if (!ev) continue;
      for (const c of binds.keys[id] || []) KEYMAP[c] = [ev, arg, id];
      if (binds.pad[id] != null) PADMAP[binds.pad[id]] = [ev, arg, id];
    }
    Input.bindVer = (Input.bindVer || 0) + 1;
  }
  const KEY_NAME = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl', ControlRight: 'Ctrl phải', AltLeft: 'Alt', AltRight: 'Alt phải', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', CapsLock: 'Caps' };
  const keyName = c => !c ? '' : KEY_NAME[c] || (c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : c.startsWith('Numpad') ? 'Num ' + c.slice(6) : c);
  const PAD_NAME = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'D↑', 'D↓', 'D←', 'D→', 'Home'];
  const padName = i => i == null ? '' : PAD_NAME[i] || 'Nút ' + i;
  Input.binds = {
    ACTIONS, keyName, padName,
    get: () => binds,
    // gán phím / nút; trùng với hành động khác thì gỡ khỏi hành động đó (trả về tên hành động bị gỡ)
    set(id, kind, i, v) {
      let moved = null;
      if (kind === 'key') {
        if (v) for (const o in binds.keys) { const k = binds.keys[o].indexOf(v); if (k >= 0 && !(o === id && k === i)) { binds.keys[o].splice(k, 1); if (o !== id) moved = ACT[o][1]; } }
        const arr = binds.keys[id] = (binds.keys[id] || []).slice(); if (v) arr[i] = v; else arr.splice(i, 1);
        binds.keys[id] = arr.filter(Boolean).slice(0, 2);
      } else {
        if (v != null) for (const o in binds.pad) if (o !== id && binds.pad[o] === v) { binds.pad[o] = null; moved = ACT[o][1]; }
        binds.pad[id] = v;
      }
      try { localStorage.setItem('vl_keybind', JSON.stringify(binds)); } catch (e) { }
      rebuild(); emit('bindsChanged');
      return moved;
    },
    reset() { binds = defaults(); try { localStorage.removeItem('vl_keybind'); } catch (e) { } rebuild(); emit('bindsChanged'); },
    label(id) { const k = (binds.keys[id] || []).map(keyName).join('/'); return k || padName(binds.pad[id]); },
    capture: null,       // hàm nhận mã phím kế tiếp (bảng cài đặt phím đang chờ)
    padCapture: null     // hàm nhận nút tay cầm kế tiếp
  };
  rebuild();

  // ---------- Bàn phím ----------
  // bảng cài đặt phím đang chờ: bắt phím trước mọi xử lý khác (pha capture), không để phím đó kích hoạt hành động
  window.addEventListener('keydown', e => {
    if (!Input.binds.capture) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const f = Input.binds.capture; Input.binds.capture = null; f(e.code);
  }, true);
  window.addEventListener('keydown', e => {
    if (!Input.inGame) return;
    if (Input.typing()) {
      if (e.code === 'Escape') document.activeElement.blur();
      return;
    }
    Input.keys[e.code] = true;
    const m = KEYMAP[e.code];
    if (m) { e.preventDefault(); if (!e.repeat || m[0] === 'skill') emit(m[0], m[1]); }
    if (m && m[2] === 'attack') Input.attackHeld = true;   // giữ phím đánh thường: đánh liên tục
  });
  window.addEventListener('keyup', e => { Input.keys[e.code] = false; const m = KEYMAP[e.code]; if (m && m[2] === 'attack') Input.attackHeld = false; });
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
  hold(document.getElementById('btn-med'), () => emit('meditate'));
  hold(document.getElementById('btn-dodge'), () => emit('dodge'));
  hold(document.getElementById('btn-pick'), () => emit('pickup'));

  // ---------- Tay cầm (Gamepad) ----------
  const prevBtn = {};
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
    if (Input.binds.padCapture) {   // bảng cài đặt phím đang chờ một nút tay cầm
      for (let i = 0; i < gp.buttons.length; i++) { const pr = b(i); if (pr && !prevBtn[i]) { const f = Input.binds.padCapture; Input.binds.padCapture = null; prevBtn[i] = pr; f(i); return; } prevBtn[i] = pr; }
      this.pad.x = 0; this.pad.y = 0; return;
    }
    this.padAttack = binds.pad.attack != null && b(binds.pad.attack);
    for (let i = 0; i < gp.buttons.length; i++) {
      const pressed = b(i);
      if (pressed && !prevBtn[i] && PADMAP[i]) emit(PADMAP[i][0], PADMAP[i][1]);
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
