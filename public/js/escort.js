// Chế độ PK (Luyện công / Đeo cờ PK / Đồ sát), cờ PK sau lưng, xe tiêu và bảng Long Môn Tiêu Cục.
(function () {
  const $ = id => document.getElementById(id);
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const fmt = n => (n || 0).toLocaleString('vi-VN');
  const PK_MODES = [
    { icon: '☮️', name: 'Luyện công', desc: 'Không đánh người chơi khác. Chỉ người bật Đồ sát mới đánh được bạn.', color: '#7fd88a' },
    { icon: '🚩', name: 'Đeo cờ PK', desc: 'Đánh được người cũng đeo cờ hoặc đang Đồ sát, và có thể cướp xe tiêu.', color: '#ff9a3a' },
    { icon: '☠️', name: 'Đồ sát', desc: 'Đánh được tất cả mọi người (trừ bang hội, người dưới cấp 10). Ai cũng có thể đánh bạn. Giết người luyện công sẽ tăng sát khí.', color: '#ff4040' }
  ];
  const TIER = { dong: { name: 'Tiêu Đồng', color: '#d08a4a' }, bac: { name: 'Tiêu Bạc', color: '#dfe4f0' }, vang: { name: 'Tiêu Vàng', color: '#ffd23f' } };

  // ---------- luật PK phía client (giống server, để chọn mục tiêu) ----------
  function canHarm(e) {
    const me = G.me;
    if (!me || !e || e.dead || !G.map) return false;
    if (window.Duel && Duel.isFoe(e)) return true;   // đang tỷ võ với nhau
    if (G.map.safe) return false;
    if (me.guild && e.guild && e.guild === me.guild.name) return false;
    if (G.map.pvp) return true;
    if (me.level < 10 || e.level < 10) return false;
    if (e.rb) return true;   // kẻ cướp tiêu bị truy nã
    const ma = me.pkMode | 0, mb = e.pm | 0;
    return ma === 2 || mb === 2 || (ma === 1 && mb === 1);
  }
  function canHitCart(c) {
    const me = G.me;
    if (!me || !c || !G.map || G.map.safe || c.u === G.you) return false;
    if (me.level < 10 || !((me.pkMode | 0) >= 1)) return false;
    if (me.guild && c.g && c.g === me.guild.name) return false;
    return true;
  }

  // ---------- cờ PK cắm sau lưng ----------
  function drawFlag(ctx, x, y, top, face, mode, now) {
    if (!mode) return;
    const back = face === 2 ? -1 : face === 1 ? 1 : -1;
    const px = x + back * 13, py0 = y - 30, py1 = top - 22;
    ctx.save();
    ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, py0); ctx.lineTo(px, py1); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(px, py1 - 1, 2, 0, Math.PI * 2); ctx.fill();
    // lá cờ phấp phới
    const w = 28, h = 19, dir = back;   // bay về phía sau lưng
    ctx.beginPath(); ctx.moveTo(px, py1 + 1);
    for (let i = 0; i <= 6; i++) { const t = i / 6; ctx.lineTo(px + dir * w * t, py1 + 1 + Math.sin(now / 140 + t * 4) * 2 * t); }
    for (let i = 6; i >= 0; i--) { const t = i / 6; ctx.lineTo(px + dir * w * t * (mode === 1 ? 1 : 1), py1 + 1 + h * (mode === 1 ? 1 - t * 0.5 : 1) + Math.sin(now / 140 + t * 4) * 2 * t); }
    ctx.closePath();
    ctx.fillStyle = mode === 2 ? '#141018' : '#d82020'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = mode === 2 ? '#ff3030' : '#ffe9a0'; ctx.stroke();
    ctx.font = 'bold 11px Be Vietnam Pro, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = mode === 2 ? '#ff4040' : '#fff';
    ctx.fillText(mode === 2 ? '☠' : 'PK', px + dir * 11, py1 + 9 + Math.sin(now / 140 + 2) * 1);
    ctx.restore();
  }

  // ---------- xe tiêu ----------
  const cartCache = {};
  function cartSprite(tier, view, wheel) {
    const key = tier + view + wheel;
    if (cartCache[key]) return cartCache[key];
    const cv = document.createElement('canvas'); cv.width = 80; cv.height = 80;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    const P = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const tc = TIER[tier].color, wood = '#7a4a22', woodD = '#4a2a12', cloth = '#a01818';
    const flag = (fx, fy) => {
      P(fx, fy, 2, 34, woodD);
      c.fillStyle = '#c81c1c'; c.beginPath(); c.moveTo(fx + 2, fy + 1); c.lineTo(fx + 22, fy + 5); c.lineTo(fx + 2, fy + 15); c.closePath(); c.fill();
      c.strokeStyle = tc; c.lineWidth = 1; c.stroke();
      c.font = 'bold 9px Be Vietnam Pro, system-ui, sans-serif'; c.fillStyle = tc; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('镖', fx + 9, fy + 8);
    };
    if (view === 'side') {
      flag(14, 14);
      P(10, 46, 58, 8, wood); P(10, 52, 58, 2, woodD); P(66, 48, 12, 2, woodD);     // sàn xe + càng
      P(14, 30, 22, 16, cloth); P(14, 30, 22, 3, '#c83030'); P(24, 30, 2, 16, tc);  // hòm phủ vải
      P(38, 34, 26, 12, '#8a5a2a'); P(38, 34, 26, 2, '#b07a3a'); P(50, 34, 2, 12, tc); P(38, 39, 26, 1, tc);
      P(42, 26, 16, 8, cloth); P(49, 26, 2, 8, tc);
      for (const wx of [24, 54]) {
        c.fillStyle = woodD; c.beginPath(); c.arc(wx, 58, 9, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#8a5a2a'; c.beginPath(); c.arc(wx, 58, 7, 0, Math.PI * 2); c.fill();
        c.strokeStyle = woodD; c.lineWidth = 1.5;
        for (let k = 0; k < 4; k++) { const a = wheel * 0.4 + k * Math.PI / 4; c.beginPath(); c.moveTo(wx - Math.cos(a) * 7, 58 - Math.sin(a) * 7); c.lineTo(wx + Math.cos(a) * 7, 58 + Math.sin(a) * 7); c.stroke(); }
        P(wx - 1, 57, 3, 3, tc);
      }
    } else {
      // nhìn trước / sau: thân xe vuông, hai bánh hai bên
      flag(view === 'down' ? 54 : 22, 6);
      P(18, 42, 44, 12, wood); P(18, 52, 44, 2, woodD);
      P(22, 26, 36, 16, cloth); P(22, 26, 36, 3, '#c83030'); P(39, 26, 2, 16, tc); P(22, 33, 36, 1, tc);
      P(28, 18, 24, 8, '#8a5a2a'); P(39, 18, 2, 8, tc);
      for (const wx of [14, 62]) { P(wx, 44, 5, 18, woodD); P(wx + 1, 46, 3, 14, '#8a5a2a'); P(wx + 1, 50 + (wheel % 2) * 4, 3, 2, woodD); }
      if (view === 'down') { P(30, 54, 3, 14, woodD); P(47, 54, 3, 14, woodD); }   // càng xe hướng về phía người xem
    }
    // viền tối
    const im = c.getImageData(0, 0, 80, 80), d = im.data, out = new Uint8ClampedArray(d);
    for (let y = 1; y < 79; y++) for (let x = 1; x < 79; x++) {
      const i = (y * 80 + x) * 4;
      if (d[i + 3]) continue;
      if (d[i + 7] || d[i - 1] || d[i + 323] || d[i - 317]) { out[i] = 24; out[i + 1] = 14; out[i + 2] = 30; out[i + 3] = 255; }
    }
    c.putImageData(new ImageData(out, 80, 80), 0, 0);
    return (cartCache[key] = cv);
  }
  function drawHorse(ctx, x, y, view, flip, moving, now, layer) {
    const f = Assets.mountFrame('ngua_nau', moving, now, view);
    if (!f) return;
    const [fx, fy] = f.foot;
    const sy = layer === 'front' ? f.fy : f.sy;
    if (sy < 0) return;
    ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(f.img, f.sx, sy, f.cw, f.ch, -fx, -fy, f.dw, f.dh);
    ctx.restore();
  }
  // vẽ xe tiêu (ngựa kéo); trả về y đỉnh để vẽ tên
  function drawCart(ctx, e, now, label, hpBar, targeted) {
    const view = e.dir === 0 ? 'down' : e.dir === 3 ? 'up' : 'side';
    if (e.dir === 1 || e.dir === 2) e.face = e.dir;
    const fl = view === 'side' && e.face === 1;
    const wheel = e.moving ? Math.floor(now / 90) % 8 : 0;
    const x = Math.round(e.x), y = Math.round(e.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y, view === 'side' ? 40 : 26, 8, 0, 0, Math.PI * 2); ctx.fill();
    const spr = cartSprite(e.t, view, wheel);
    const drawBody = (bx, by) => {
      ctx.save(); ctx.translate(bx, by); if (fl) ctx.scale(-1, 1);
      ctx.drawImage(spr, -40, -66); ctx.restore();
    };
    if (view === 'side') {
      const hx = x + (fl ? -54 : 54);
      drawBody(x, y);
      drawHorse(ctx, hx, y, 'side', fl, e.moving, now);
    } else if (view === 'down') {
      drawBody(x, y);
      drawHorse(ctx, x, y + 34, 'down', false, e.moving, now, 'back'); drawHorse(ctx, x, y + 34, 'down', false, e.moving, now, 'front');
    } else {
      drawHorse(ctx, x, y - 34, 'up', false, e.moving, now, 'back'); drawHorse(ctx, x, y - 34, 'up', false, e.moving, now, 'front');
      drawBody(x, y);
    }
    const top = y - 76;
    const T = TIER[e.t] || TIER.dong;
    label(x, top - 10, `🛒 ${T.name} · ${e.o}`, T.color, 12, true);
    hpBar(x, top - 2, 56, e.hp / e.maxHp, canHitCart(e) ? '#ff5050' : '#ffb030');
    return top;
  }

  // ---------- nút chọn chế độ PK ----------
  function pkButton() {
    let b = $('btn-pk');
    const wrap = $('quick-btns');
    if (!b && wrap) {
      b = document.createElement('button'); b.id = 'btn-pk'; b.className = 'qb';
      wrap.insertBefore(b, wrap.firstChild);
      b.onclick = ev => { ev.stopPropagation(); pkMenu(); };
    }
    if (!b || !G.me) return;
    const m = PK_MODES[G.me.pkMode | 0];
    const html = `<i>${m.icon}</i><span>${m.name}</span>`;
    if (b.innerHTML !== html) { b.innerHTML = html; b.style.color = m.color; b.title = 'Chế độ PK: ' + m.name + ' (phím P)'; b.classList.toggle('pk-on', (G.me.pkMode | 0) > 0); }
  }
  function pkMenu() {
    let box = $('pk-menu');
    if (box) { box.remove(); return; }
    box = document.createElement('div'); box.id = 'pk-menu';
    const cur = G.me.pkMode | 0;
    box.innerHTML = `<div class="pk-h">Chế độ PK<span class="pk-x" data-close>✕</span></div><div class="pk-opts">` + PK_MODES.map((m, i) => `<button data-pk="${i}" class="${i === cur ? 'on' : ''}"><b style="color:${m.color}">${m.icon} ${m.name}</b><small>${m.desc}</small></button>`).join('') + '</div>' +
      `<div class="pk-f small">Bản đồ an toàn (trong thành) không thể giao chiến. Đổi xuống chế độ thấp hơn cần 10 giây không giao chiến.</div>`;
    $('screen-game').appendChild(box);
    box.querySelector('[data-close]').onclick = () => box.remove();
    box.querySelectorAll('[data-pk]').forEach(el => el.onclick = () => { emit('pkMode', { mode: +el.dataset.pk }); box.remove(); G.sfx && G.sfx('click'); });
    setTimeout(() => document.addEventListener('pointerdown', function off(ev) { if (!box.contains(ev.target) && !ev.target.closest('#btn-pk')) { box.remove(); document.removeEventListener('pointerdown', off, true); } }, true), 0);
  }
  document.addEventListener('keydown', ev => {
    if (ev.code !== 'KeyP' || !G.inGame || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    pkMenu();
  });

  // ---------- Long Môn Tiêu Cục ----------
  let npcData = null;
  function open(d) { npcData = d; UI.openPanel('escort'); }
  UI.registerPanel('escort', '🛒 Long Môn Tiêu Cục', body => {
    const d = npcData || {}, me = G.me, es = me.escort || {};
    let html = `<p class="muted">"${UI.esc(d.talk || 'Hộ tống xe tiêu tới Phân Đà để nhận thưởng.')}"</p>`;
    if (es.id) {
      const left = Math.max(0, Math.round((es.until - Date.now()) / 1000));
      html += `<div class="esc-cur"><h4>Đang áp ${UI.esc(es.name)}</h4>
        <div>🎯 Giao tới: <b>Phân Đà Tiêu Cục – ${UI.esc(es.destName)}</b></div>
        <div>📍 Xe đang ở: ${UI.esc(es.mapName)} · ❤ ${fmt(es.hp)}/${fmt(es.maxHp)} · ⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</div>
        <button class="btn small red" id="esc-cancel">Huỷ chuyến tiêu (mất cọc)</button></div>`;
    } else {
      html += `<div class="small muted">Hôm nay còn <b>${es.left ?? 3}</b> lượt áp tiêu. Xe tiêu đi theo bạn và chỉ qua cổng khi đi cùng bạn. Thoát game hoặc quá giờ là mất tiêu.</div><div class="list">` +
        (d.routes || []).map(r => {
          const T = TIER[r.k] || {};
          const lock = me.level < r.lv;
          return `<div class="li esc-route"><div class="grow"><b style="color:${T.color}">🛒 ${r.name}</b> <span class="small ${lock ? 'warn' : 'muted'}">Cấp ${r.lv}+</span>
            <div class="sub">Tới <b>${UI.esc(r.destName)}</b> trong ${r.time} phút · Cọc ${fmt(r.deposit)} 💰</div>
            <div class="sub" style="color:#ffd84a">Thưởng tới ${fmt(r.gold)} 💰 + kinh nghiệm + Huyền Tinh${r.knb ? ' + ' + r.knb + ' 💎' : ''}</div></div>
            <button class="btn small green" data-esc="${r.k}" ${lock ? 'disabled' : ''}>Nhận tiêu</button></div>`;
        }).join('') + '</div>';
    }
    html += `<div class="esc-rob"><b>⚔️ Cướp tiêu</b>
      <div class="small">• Dọc đường có <b>Cướp Tiêu Tặc</b> phục kích, đánh vào xe.</div>
      <div class="small">• Người <b>đeo cờ PK</b> hoặc <b>đồ sát</b> có thể đánh xe tiêu của người khác. Xe bị phá sẽ văng <b>Rương Tiêu</b> và ngân lượng ra đất: kẻ phá xe được ưu tiên nhặt 8 giây, sau đó ai nhanh tay thì được.</div>
      <div class="small">• Kẻ cướp bị <b>truy nã 5 phút</b>: ai cũng đánh được, hạ được nhận tiền thưởng.</div>
      <div class="small">• Khi xe bị cướp, chủ xe và cả bang hội được báo để tới tiếp ứng. Xe bị Cướp Tiêu Tặc phá thì chủ xe được ưu tiên nhặt lại rương.</div>
      <div class="small">• Xe càng lành lặn khi giao thì thưởng càng cao.</div></div>`;
    body.innerHTML = html;
    body.querySelectorAll('[data-esc]').forEach(b => b.onclick = () => emit('escort', { op: 'start', tier: b.dataset.esc }));
    if ($('esc-cancel')) $('esc-cancel').onclick = () => { if (confirm('Huỷ chuyến tiêu? Bạn sẽ mất tiền cọc.')) emit('escort', { op: 'cancel' }); };
  });

  // ---------- khung theo dõi chuyến tiêu ----------
  function wanted() {
    let h = $('wanted-hud');
    const until = G.me && G.me.robUntil, left = until ? Math.round((until - Date.now()) / 1000) : 0;
    if (left <= 0) { if (h) h.remove(); return; }
    if (!h) { h = document.createElement('div'); h.id = 'wanted-hud'; $('screen-game').appendChild(h); }
    h.textContent = `💰 Bạn đang bị truy nã vì cướp tiêu – ai cũng có thể đánh bạn (${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')})`;
  }
  function hud() {
    wanted();
    let h = $('escort-hud');
    const es = G.me && G.me.escort;
    if (!es || !es.id) { if (h) h.remove(); return; }
    if (!h) { h = document.createElement('div'); h.id = 'escort-hud'; $('screen-game').appendChild(h); h.onclick = () => UI.openPanel('escort'); }
    const left = Math.max(0, Math.round((es.until - Date.now()) / 1000));
    const T = TIER[es.tier] || {};
    const away = G.map && es.map !== (G.map.key || G.map.id);
    const nextName = es.next && G.map && (G.map.portals.find(p => p.to === es.next) || {}).toName;
    const step = away ? `<span class="warn">⚠ Xe đang ở ${UI.esc(es.mapName)} – hãy quay lại!</span>`
      : es.map === es.dest ? '➡ Đưa xe tới Phân Đà Tiêu Cục' : `➡ Đi qua cổng: <b>${UI.esc(nextName || es.next || '')}</b>`;
    const pct = Math.max(0, Math.min(100, es.hp / es.maxHp * 100));
    const html = `<div><b style="color:${T.color}">🛒 ${UI.esc(es.name)}</b> → ${UI.esc(es.destName)} <span class="${left < 120 ? 'warn' : 'muted'}">⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span></div>
      <div class="esc-bar"><i style="width:${pct}%"></i></div><div class="small">${step}</div>`;
    if (h.innerHTML !== html) h.innerHTML = html;
  }
  // mũi tên dẫn đường: tới xe (nếu bỏ xa), tới cổng kế tiếp, hoặc tới Phân Đà
  function goal() {
    const es = G.me && G.me.escort;
    if (!es || !es.id || !G.map) return null;
    const s = G.self, m = G.map;
    if (es.map === m.id) {
      const cart = G.carts.get(es.id);
      if (cart && Math.hypot(cart.x - s.x, cart.y - s.y) > 380) return { x: cart.x, y: cart.y, col: '#ff9a3a' };
      if (m.id === es.dest) { const n = m.npcs.find(x => x.id === 'tieu_cuc_pd'); if (n) return { x: (n.x + 0.5) * 64, y: (n.y + 0.5) * 64, col: '#7fffd4' }; }
      const p = m.portals.find(x => x.to === es.next);
      if (p) return { x: (p.x + 0.5) * 64, y: (p.y + 0.5) * 64, col: '#ffd23f' };
    } else {
      // xe ở bản đồ khác: chỉ cổng về phía xe
      const p = m.portals.find(x => x.to === es.map);
      if (p) return { x: (p.x + 0.5) * 64, y: (p.y + 0.5) * 64, col: '#ff5050' };
    }
    return null;
  }
  function drawArrow(ctx, now) {
    const g = goal();
    if (!g) return;
    const s = G.self, d = Math.hypot(g.x - s.x, g.y - s.y);
    if (d < 110) return;
    const a = Math.atan2(g.y - s.y, g.x - s.x), r = 84 + Math.sin(now / 220) * 5;
    ctx.save();
    ctx.translate(s.x + Math.cos(a) * r, s.y - 26 + Math.sin(a) * r); ctx.rotate(a);
    ctx.fillStyle = g.col; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-7, -9); ctx.lineTo(-2, 0); ctx.lineTo(-7, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.rotate(-a); ctx.font = '12px Be Vietnam Pro, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🛒', 0, -16);
    ctx.restore();
  }

  setInterval(() => { if (G.inGame && G.me) { pkButton(); hud(); } }, 400);

  window.Escort = { canHarm, canHitCart, drawFlag, drawCart, open, drawArrow, PK_MODES };
})();
