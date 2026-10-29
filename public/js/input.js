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
  // [mã, tên, sự kiện, tham số, phím mặc định (tối đa 2), nút tay cầm mặc định (số nút, hoặc tổ hợp "giữ+bấm" như '4+0' = LB+A)]
  const ACTIONS = [
    ['up', 'Đi lên', null, null, ['KeyW', 'ArrowUp']], ['down', 'Đi xuống', null, null, ['KeyS', 'ArrowDown']],
    ['left', 'Đi sang trái', null, null, ['KeyA', 'ArrowLeft']], ['right', 'Đi sang phải', null, null, ['KeyD', 'ArrowRight']],
    ['attack', 'Đánh thường', 'skill', 0, ['Digit1', 'Space'], 0],
    ['slot1', 'Ô kỹ năng 1', 'slot', 1, ['Digit2'], 2], ['slot2', 'Ô kỹ năng 2', 'slot', 2, ['Digit3'], 3], ['slot3', 'Ô kỹ năng 3', 'slot', 3, ['Digit4'], 1],
    ['slot4', 'Ô kỹ năng 4', 'slot', 4, ['Digit5'], 6], ['slot5', 'Ô kỹ năng 5', 'slot', 5, ['Digit6'], 7], ['slot6', 'Ô kỹ năng 6', 'slot', 6, ['Digit7'], '4+1'],
    ['slot7', 'Ô kỹ năng 7', 'slot', 7, ['Digit8'], '4+3'], ['slot8', 'Ô kỹ năng 8', 'slot', 8, ['Digit9'], '5+2'],
    ['dodge', 'Khinh công', 'dodge', null, ['ShiftLeft', 'KeyQ'], '4+0'],
    ['hp', 'Bình máu', 'potion', 'hp', ['KeyZ'], 4], ['mp', 'Bình nội lực', 'potion', 'mp', ['KeyX'], 5],
    ['target', 'Đổi mục tiêu', 'target', null, ['Tab'], 11], ['interact', 'Nói chuyện / nhặt đồ', 'interact', null, ['KeyF'], '4+2'],
    ['auto', 'Bật / tắt tự động', 'auto', null, ['KeyR'], 9], ['mount', 'Cưỡi thú', 'mount', null, ['KeyT'], 10],
    ['meditate', 'Ngồi thiền', 'meditate', null, ['KeyY'], '5+0'], ['recall', 'Về thành', 'recall', null, ['KeyH'], '5+1'],
    ['inventory', 'Túi đồ', 'panel', 'inventory', ['KeyI'], 8], ['character', 'Nhân vật', 'panel', 'character', ['KeyC']],
    ['skills', 'Võ công', 'panel', 'skills', ['KeyK']], ['quests', 'Nhiệm vụ', 'panel', 'quests', ['KeyJ']],
    ['mountp', 'Thú cưỡi', 'panel', 'mount', ['KeyM']], ['guild', 'Bang hội', 'panel', 'guild', ['KeyG']],
    ['friends', 'Bạn bè', 'panel', 'friends', ['KeyB']], ['events', 'Sự kiện', 'panel', 'events', ['KeyO']],
    ['leaderboard', 'Xếp hạng', 'panel', 'leaderboard', ['KeyL']], ['giftcode', 'Gift code', 'panel', 'giftcode', ['KeyU']],
    ['tlist', 'Danh sách mục tiêu', 'tlist', null, ['KeyV'], '5+3'], ['bigmap', 'Bản đồ', 'bigmap', null, ['KeyN']],
    ['chat', 'Mở khung chat', 'chat', null, ['Enter']],
    ['keyspanel', 'Mở Cài đặt phím', 'panel', 'keys', [], '8+9']
  ];
  const ACT = Object.fromEntries(ACTIONS.map(a => [a[0], a]));
  // nút tay cầm: số (nút đơn) hoặc chuỗi "giữ+bấm" (tổ hợp); mỗi hành động tối đa 2 nút
  const padList = v => (Array.isArray(v) ? v : v == null ? [] : [v]).filter(x => x != null && x !== '').slice(0, 2);
  const defaults = () => ({ keys: Object.fromEntries(ACTIONS.map(a => [a[0], a[4].slice()])), pad: Object.fromEntries(ACTIONS.map(a => [a[0], padList(a[5])])) });
  let binds = defaults(), KEYMAP = {}, PADMAP = {}, PCOMBO = {}, MODS = new Set(), PADUSED = new Set();
  try {   // cấu hình đã lưu (thiếu hành động mới thì lấy mặc định; bản cũ lưu 1 nút dạng số)
    const sv = JSON.parse(localStorage.getItem('vl_keybind') || 'null');
    if (sv) for (const id in ACT) { if (Array.isArray(sv.keys && sv.keys[id])) binds.keys[id] = sv.keys[id].slice(0, 2); if (sv.pad && id in sv.pad && (sv.pv || sv.pad[id] != null)) binds.pad[id] = padList(sv.pad[id]); }
  } catch (e) { }
  function rebuild() {
    KEYMAP = { Escape: ['escape'] };   // Esc luôn để đóng bảng, không cho gán
    PADMAP = {}; PCOMBO = {}; MODS = new Set(); PADUSED = new Set();
    for (const [id, , ev, arg] of ACTIONS) {
      if (!ev) continue;
      for (const c of binds.keys[id] || []) KEYMAP[c] = [ev, arg, id];
      for (const v of binds.pad[id] || []) {
        if (typeof v === 'string' && v.includes('+')) { const [m, k] = v.split('+').map(Number); PCOMBO[v] = [ev, arg, id]; MODS.add(m); PADUSED.add(m); PADUSED.add(k); }
        else { PADMAP[+v] = [ev, arg, id]; PADUSED.add(+v); }
      }
    }
    Input.bindVer = (Input.bindVer || 0) + 1;
  }
  const KEY_NAME = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl', ControlRight: 'Ctrl phải', AltLeft: 'Alt', AltRight: 'Alt phải', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', CapsLock: 'Caps' };
  const keyName = c => !c ? '' : KEY_NAME[c] || (c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : c.startsWith('Numpad') ? 'Num ' + c.slice(6) : c);
  const PAD_NAME = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'D↑', 'D↓', 'D←', 'D→', 'Home'];
  const padName = v => v == null || v === '' ? '' : typeof v === 'string' && v.includes('+') ? v.split('+').map(i => PAD_NAME[+i] || 'Nút ' + i).join('+') : PAD_NAME[+v] || 'Nút ' + v;
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
        if (v != null) for (const o in binds.pad) { const k = binds.pad[o].indexOf(v); if (k >= 0 && !(o === id && k === i)) { binds.pad[o].splice(k, 1); if (o !== id) moved = ACT[o][1]; } }
        const arr = (binds.pad[id] || []).slice(); if (v != null) arr[i] = v; else arr.splice(i, 1);
        binds.pad[id] = arr.filter(x => x != null).slice(0, 2);
      }
      try { localStorage.setItem('vl_keybind', JSON.stringify(Object.assign({ pv: 2 }, binds))); } catch (e) { }
      rebuild(); emit('bindsChanged');
      return moved;
    },
    reset() { binds = defaults(); try { localStorage.removeItem('vl_keybind'); } catch (e) { } rebuild(); emit('bindsChanged'); },
    label(id) { const k = (binds.keys[id] || []).map(keyName).join('/'); return k || padName((binds.pad[id] || [])[0]); },
    capture: null,       // hàm nhận mã phím kế tiếp (bảng cài đặt phím đang chờ)
    padCapture: null,    // hàm nhận nút / tổ hợp tay cầm kế tiếp
    padNav: null         // bảng cài đặt phím đang mở: điều khiển bảng bằng tay cầm (lên / xuống / A / B / X)
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
  // gốc toạ độ của vùng joystick (toạ độ bố cục, không bị ảnh hưởng khi xoay ngang): vòng joystick nằm trong vùng này,
  // nên phải trừ đi gốc vùng thì tâm vòng mới trùng đúng chỗ ngón tay chạm
  function zoneOrigin() {
    let x = 0, y = 0, el = zone;
    while (el && el !== document.body) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return { x, y };
  }
  function joyStart(e) {
    for (const t of e.changedTouches) {
      if (joyId !== null) break;
      joyId = t.identifier;
      const p = Input.toLocal(t.clientX, t.clientY), o = zoneOrigin();
      const bw = base.offsetWidth;
      R = bw * 0.4;
      base.style.left = (p.x - o.x - bw / 2) + 'px';
      base.style.top = (p.y - o.y - bw / 2) + 'px';
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
  hold(document.getElementById('btn-jh'), () => emit('skill', 9));
  hold(document.getElementById('btn-hp'), () => emit('potion', 'hp'));
  hold(document.getElementById('btn-mp'), () => emit('potion', 'mp'));
  hold(document.getElementById('btn-target'), () => emit('target'));
  hold(document.getElementById('btn-mount'), () => emit('mount'));
  hold(document.getElementById('btn-med'), () => emit('meditate'));
  hold(document.getElementById('btn-dodge'), () => emit('dodge'));
  hold(document.getElementById('btn-pick'), () => emit('pickup'));

  // ---------- Tay cầm (Gamepad) ----------
  // Nút đơn bấm là ra. Tổ hợp "giữ+bấm" (vd LB+A): nút giữ nếu cũng có việc riêng thì việc đó chạy khi THẢ ra mà chưa
  // bấm tổ hợp nào. Nút D-pad chưa gán việc gì thì dùng để di chuyển (như cần gạt trái).
  const prevBtn = {}, modDown = {}, comboUsed = {};
  let cap = null, navRep = 0, navDir = 0;
  Input.pollGamepad = function () {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) { this.pad.x = 0; this.pad.y = 0; this.pad.connected = false; return; }
    this.pad.connected = true;
    const n = gp.buttons.length, b = i => gp.buttons[i] && gp.buttons[i].pressed;
    let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
    if (Math.hypot(x, y) < 0.2) { x = 0; y = 0; }
    const dp = i => b(i) && !PADUSED.has(i);
    if (dp(14)) x = -1; if (dp(15)) x = 1; if (dp(12)) y = -1; if (dp(13)) y = 1;
    this.pad.x = x; this.pad.y = y;
    const edges = [], ups = [];
    for (let i = 0; i < n; i++) { const pr = b(i); if (pr && !prevBtn[i]) edges.push(i); else if (!pr && prevBtn[i]) ups.push(i); prevBtn[i] = pr; }
    // bảng cài đặt phím chờ nút: đợi thả hết nút, rồi bấm 1 nút (thả ra = nút đơn) hoặc giữ nút đó bấm thêm nút khác (= tổ hợp)
    if (Input.binds.padCapture) {
      this.pad.x = 0; this.pad.y = 0; this.padAttack = false;
      if (!cap) cap = { armed: false, first: null };
      if (!cap.armed) { let any = false; for (let i = 0; i < n; i++) if (b(i)) any = true; if (!any) cap.armed = true; return; }
      let res = null;
      if (cap.first == null) { if (edges.length) cap.first = edges[0]; }
      else if (edges.length) res = cap.first + '+' + edges[0];
      else if (ups.includes(cap.first)) res = cap.first;
      if (res != null) { const f = Input.binds.padCapture; Input.binds.padCapture = null; cap = null; f(res); }
      return;
    }
    cap = null;
    // bảng cài đặt phím đang mở: tay cầm điều khiển bảng, không ra chiêu
    if (Input.binds.padNav) {
      this.pad.x = 0; this.pad.y = 0; this.padAttack = false;
      const dy = b(12) || y < -0.5 ? -1 : b(13) || y > 0.5 ? 1 : 0, dx = b(14) || x < -0.5 ? -1 : b(15) || x > 0.5 ? 1 : 0, d = dy * 10 + dx, now = performance.now();
      if (d && (d !== navDir || now > navRep)) { navRep = now + (d !== navDir ? 380 : 140); Input.binds.padNav(dy ? (dy < 0 ? 'up' : 'down') : (dx < 0 ? 'left' : 'right')); }
      navDir = d;
      for (const i of edges) if (i === 0 || i === 1 || i === 2) Input.binds.padNav(i === 0 ? 'ok' : i === 1 ? 'back' : 'clear');
      return;
    }
    let modHeld = false;
    for (const m of MODS) if (b(m)) { modHeld = true; break; }
    for (const i of edges) {
      let combo = null;
      for (const m of MODS) if (m !== i && b(m) && PCOMBO[m + '+' + i]) { combo = PCOMBO[m + '+' + i]; comboUsed[m] = true; break; }
      if (combo) { emit(combo[0], combo[1]); continue; }
      if (MODS.has(i)) { modDown[i] = true; comboUsed[i] = false; continue; }   // nút giữ: chờ thả mới chạy việc riêng
      if (PADMAP[i]) emit(PADMAP[i][0], PADMAP[i][1]);
    }
    for (const i of ups) {
      if (MODS.has(i) && modDown[i] && !comboUsed[i] && PADMAP[i]) emit(PADMAP[i][0], PADMAP[i][1]);
      modDown[i] = false;
    }
    // giữ nút đánh thường: đánh liên tục (không tính khi đang giữ nút tổ hợp)
    this.padAttack = !modHeld && (binds.pad.attack || []).some(v => typeof v === 'number' && b(v));
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
  // ---------- Nhập chữ khi màn hình đang xoay ngang bằng CSS (iOS, lối tắt màn hình chính) ----------
  // Bàn phím hệ thống vẫn dựng đứng nên chữ trong ô nhập bị nằm ngang. Chạm vào ô nhập: mở khung nhập dựng đứng
  // phía trên bàn phím (nằm ngoài #app nên không bị xoay), gõ tới đâu chép ngược vào ô gốc tới đó.
  // Ô nằm trong form (đăng nhập, đăng ký) thì hiện đủ các ô của form để điền liền một lượt.
  const TYPE_OK = /^(text|password|number|search|email|tel|url)$/;
  let typeOv = null;
  function closeTypeOv(submit) {
    if (!typeOv) return;
    const { el, form, last } = typeOv; typeOv = null;
    el.remove();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (!submit) return;
    if (form) { if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); }
    else last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  }
  function openTypeOv(t) {
    const form = t.closest('form');
    const vis = x => !x.disabled && !x.readOnly && x.offsetParent !== null && (x.tagName === 'TEXTAREA' || TYPE_OK.test(x.type || 'text'));
    const fields = form ? [...form.querySelectorAll('input, textarea')].filter(vis) : [t];
    if (!fields.includes(t)) fields.unshift(t);
    const el = document.createElement('div'); el.id = 'type-ov';
    el.innerHTML = '<div class="tov-box"></div>';
    const box = el.firstChild, mirrors = [];
    fields.forEach((src, i) => {
      const m = document.createElement(src.tagName === 'TEXTAREA' ? 'textarea' : 'input');
      if (m.tagName === 'INPUT') m.type = src.type || 'text';
      for (const a of ['maxlength', 'min', 'max', 'step', 'inputmode', 'autocomplete', 'autocapitalize', 'spellcheck', 'name']) if (src.hasAttribute(a)) m.setAttribute(a, src.getAttribute(a));
      m.placeholder = src.placeholder || ''; m.value = src.value; m.enterKeyHint = i < fields.length - 1 ? 'next' : (form || src.id === 'chat-input' ? 'send' : 'done');
      m.oninput = () => { src.value = m.value; src.dispatchEvent(new Event('input', { bubbles: true })); };
      m.onchange = () => src.dispatchEvent(new Event('change', { bubbles: true }));
      m.onkeydown = e => {
        if (e.key !== 'Enter' || m.tagName === 'TEXTAREA') return;
        e.preventDefault();
        if (i < fields.length - 1) mirrors[i + 1].focus(); else closeTypeOv(true);
      };
      if (src.placeholder) { const l = document.createElement('label'); l.textContent = src.placeholder; box.appendChild(l); }
      box.appendChild(m); mirrors.push(m);
    });
    const row = document.createElement('div'); row.className = 'tov-row';
    row.innerHTML = `<button type="button" class="btn small">Đóng</button><button type="button" class="btn small primary">${form ? 'Xác nhận' : 'Xong'}</button>`;
    const tipL = document.createElement('p'); tipL.className = 'tov-tip';
    tipL.textContent = '📱 Muốn gõ phím ngang? Tắt "Khoá xoay màn hình" (vuốt mở Trung tâm điều khiển → bấm biểu tượng ổ khoá 🔒) rồi xoay ngang điện thoại: game và bàn phím sẽ cùng nằm ngang.';
    row.children[0].onclick = () => closeTypeOv(false);
    row.children[1].onclick = () => closeTypeOv(!!form || t.id === 'chat-input');
    box.appendChild(row); box.appendChild(tipL);
    el.addEventListener('pointerdown', e => { if (e.target === el) closeTypeOv(false); });
    document.body.appendChild(el);
    typeOv = { el, form, last: fields[fields.length - 1] };
    t.blur();
    const m = mirrors[fields.indexOf(t)];
    m.focus();   // gọi ngay trong lượt chạm để iOS chịu mở bàn phím
    try { const n = m.value.length; if (m.type !== 'number' && m.type !== 'email') m.setSelectionRange(n, n); } catch (e) { }
  }
  document.addEventListener('focusin', e => {
    const t = e.target;
    if (!Input.rotated || typeOv || !t || t.closest('#type-ov')) return;
    if (!(t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && TYPE_OK.test(t.type || 'text')))) return;
    openTypeOv(t);
  });
  Input.closeTypeOv = closeTypeOv;
  const relayout = () => setTimeout(() => Input.applyLayout(), 60);
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  if (screen.orientation) screen.orientation.addEventListener && screen.orientation.addEventListener('change', relayout);
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('contextmenu', e => { if (Input.inGame) e.preventDefault(); });

  window.Input = Input;
})();
