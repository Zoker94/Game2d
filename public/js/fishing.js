// Câu cá & nấu ăn phía người chơi: nút 🎣 khi đứng sát mép nước (có Cần Câu), dây câu + phao, "Cá cắn câu!" → Giật cần,
// câu liên tục, tab 🍲 Nấu ăn ở Đầu Bếp Tửu Lâu.
(function () {
  const $ = id => document.getElementById(id);
  const emit = d => G.socket && G.socket.emit('fish', d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const WATER = 2, T = 64;
  let btn = null, st = null, lines = new Map(), loop = false, cookData = null, cookHost = null, biteAt = 0;
  try { loop = localStorage.getItem('vl_fish_loop') === '1'; } catch (e) { }
  const have = id => G.me && G.me.inv.some(x => x.id === id);
  const itemOf = x => G.data.items[x.id] || {};
  const hasRod = () => G.me && G.me.inv.some(x => (itemOf(x).effect || {}).rod);
  const hasBait = () => G.me && G.me.inv.some(x => (itemOf(x).effect || {}).bait);
  // có ô nước trong ~1,7 ô quanh nhân vật (khớp máy chủ)
  function nearWater() {
    const m = G.map, s = G.self; if (!m || !s || !m.tiles) return false;
    const tx = Math.floor(s.x / T), ty = Math.floor(s.y / T);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= m.w || y >= m.h || m.tiles[y * m.w + x] !== WATER) continue;
      if (Math.hypot((x + 0.5) * T - s.x, (y + 0.5) * T - s.y) < T * 1.75) return true;
    }
    return false;
  }
  const NO_FISH = () => G.map && /^(tong_kim|cong_thanh|hoa_son_ld|dai_hoi|ty_vo_dai)$/.test(G.map.id);

  function onBtn(e) {
    e.stopPropagation();
    if (!st || st.st === 'off') return emit({ op: 'cast' });
    if (st.st === 'bite') return emit({ op: 'hook' });
    emit({ op: 'stop' });   // đang chờ: thu cần
  }
  function ui() {
    if (!btn) {
      btn = document.createElement('div'); btn.id = 'fish-ui'; btn.className = 'hidden';
      btn.innerHTML = '<button id="btn-fish"></button><label class="fish-loop"><input type="checkbox" id="fish-loop"> Câu liên tục</label>';
      btn.addEventListener('pointerdown', e => e.stopPropagation());
      ($('screen-game') || document.body).appendChild(btn);
      $('btn-fish').onclick = onBtn;
      $('fish-loop').checked = loop;
      $('fish-loop').onchange = e => { loop = e.target.checked; try { localStorage.setItem('vl_fish_loop', loop ? '1' : '0'); } catch (x) { } };
      window.addEventListener('keydown', e => {
        if (e.code !== 'Space' || !st || !Input.inGame || Input.typing()) return;
        if (st.st === 'bite') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) emit({ op: 'hook' }); }
        else if (st.st === 'fight') { e.preventDefault(); e.stopImmediatePropagation(); game.hold = true; }
      }, true);
      window.addEventListener('keyup', e => { if (e.code === 'Space' && game.on) { e.preventDefault(); game.hold = false; } }, true);
    }
    const active = st && st.st !== 'off';
    const show = !!(G.inGame !== false && G.me && !G.me.dead && !NO_FISH() && !game.on && (active || (hasRod() && nearWater())));
    btn.classList.toggle('hidden', !show);
    if (!show) return;
    const b = $('btn-fish');
    const lbl = !active ? `🎣 Câu cá${hasBait() ? '' : ' (hết mồi)'}${staLeft != null ? ` · thể lực ${staLeft}` : ''}${rodInfo ? ` · bền ${rodInfo.dur}/${rodInfo.max}` : ''}` : st.st === 'bite' ? '❗ GIẬT CẦN!' : '⏳ Chờ cá… (bấm để thu cần)';
    if (b._l !== lbl) { b.textContent = lbl; b._l = lbl; }
    b.className = !active ? '' : st.st === 'bite' ? 'bite' : 'wait';
  }
  setInterval(() => { try { ui(); } catch (e) { } }, 150);

  // ---------- minigame kéo cá (mô phỏng chung public/js/fishsim.js, máy chủ chạy lại để kiểm tra) ----------
  let staLeft = null, tiredWarned = 0, rodInfo = null;
  const game = { on: false, hold: false };
  function gameStart(d) {
    let el = $('fish-game');
    if (!el) {
      el = document.createElement('div'); el.id = 'fish-game';
      el.innerHTML = '<div class="fg-t">🎣 KÉO CÁ!</div><div class="fg-pw"></div><canvas width="300" height="600" style="width:150px;height:300px"></canvas><div class="fg-h">Giữ chuột / chạm / Space để kéo vạch lên – nhả để chìm.<br>Giữ vạch trong vùng cá tới khi đầy thanh.</div>';
      ($('screen-game') || document.body).appendChild(el);
      const down = e => { e.preventDefault(); e.stopPropagation(); game.hold = true; }, up = e => { e.preventDefault(); game.hold = false; };
      el.addEventListener('pointerdown', down); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      el.addEventListener('contextmenu', e => e.preventDefault());
    }
    el.classList.remove('hidden');
    // sức cá so với sức cần: cần yếu hơn thì cảnh báo đỏ
    const pw = el.querySelector('.fg-pw'), weak = d.lv && d.rp && d.lv > d.rp;
    pw.innerHTML = d.lv ? `Sức cá <b style="color:${d.lv >= 4 ? '#ff7a5a' : '#ffd76a'}">${'★'.repeat(d.lv)}</b> · Cần <b style="color:#7fd0ff">${'★'.repeat(d.rp || 1)}</b>${weak ? '<br><span class="fg-weak">⚠ Cần yếu – cá rất khó kéo, dễ gãy cần!</span>' : ''}${d.big ? '<br><span class="fg-big">🦈 CÁ DỮ!</span>' : ''}` : '';
    Object.assign(game, { on: true, hold: false, sim: FishSim.init(d.seed, d.g, d.mod), g: d.g, n: 0, inputs: [], last: false, acc: 0, t0: performance.now(), prev: performance.now(), el, cv: el.querySelector('canvas') });
    requestAnimationFrame(gameLoop);
  }
  function gameLoop(now) {
    if (!game.on) return;
    game.acc += Math.min(0.25, (now - game.prev) / 1000); game.prev = now;
    while (game.acc >= FishSim.DT && !game.sim.done) {
      game.acc -= FishSim.DT;
      if (game.hold !== game.last) { game.inputs.push((game.n + 1) * FishSim.DT * 1000); game.last = game.hold; }   // thời điểm đổi giữ / nhả theo bước mô phỏng
      FishSim.step(game.sim, game.hold); game.n++;
    }
    gameDraw(now);
    if (game.sim.done) return gameEnd();
    requestAnimationFrame(gameLoop);
  }
  function gameEnd() {
    game.on = false;
    emit({ op: 'fight', inputs: game.inputs, steps: game.n, ok: game.sim.done === 1 });
    setTimeout(() => { if (!game.on && game.el) game.el.classList.add('hidden'); }, game.sim.done === 1 ? 500 : 700);
    if (game.sim.done === 1) GameAudio.sfx('coin');
  }
  // vẽ minigame (canvas 2x cho nét): cột nước có tia nắng, bọt, rong; vùng cá phát sáng + con cá; lưỡi câu treo dây;
  // ống tiến độ thuỷ tinh có chất lỏng sóng sánh; ra khỏi vùng cá: viền đỏ nháy, gần đầy: ống sáng rực
  const GCOL = { c: ['#e8c070', '#a07a30'], r: ['#9ad870', '#4a7a30'], e: ['#7ac8ff', '#2a6ab0'], l: ['#ffd040', '#c07a10'] };
  function rr(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }
  function gameDraw(now) {
    const cv = game.cv, x = cv.getContext('2d'), S = game.sim;
    x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, 150, 300);
    const top = 14, H = 252, bx = 18, bw = 74, inZ = S.inZ, warn = !inZ && S.t > 1.5;
    // ---- khung cột nước: viền đồng + nền nước sâu dần
    rr(x, bx - 6, top - 6, bw + 12, H + 12, 10); x.fillStyle = '#2a1a0a'; x.fill();
    const fr = x.createLinearGradient(bx - 6, 0, bx + bw + 6, 0); fr.addColorStop(0, '#8a5a20'); fr.addColorStop(0.5, '#f0c870'); fr.addColorStop(1, '#8a5a20');
    x.lineWidth = 3; x.strokeStyle = warn && Math.floor(now / 120) % 2 ? '#ff4a3a' : fr; x.stroke();
    x.save(); rr(x, bx, top, bw, H, 6); x.clip();
    const wg = x.createLinearGradient(0, top, 0, top + H); wg.addColorStop(0, '#3a9ad0'); wg.addColorStop(0.45, '#14588a'); wg.addColorStop(1, '#04182a');
    x.fillStyle = wg; x.fillRect(bx, top, bw, H);
    x.globalCompositeOperation = 'lighter';   // tia nắng chéo lay động
    for (let i = 0; i < 4; i++) {
      const ox = bx + ((i * 23 + now / 60) % (bw + 40)) - 20, g = x.createLinearGradient(0, top, 0, top + H * 0.75);
      g.addColorStop(0, 'rgba(180,230,255,.22)'); g.addColorStop(1, 'rgba(180,230,255,0)');
      x.fillStyle = g; x.beginPath(); x.moveTo(ox, top); x.lineTo(ox + 9, top); x.lineTo(ox + 24, top + H * 0.75); x.lineTo(ox + 12, top + H * 0.75); x.closePath(); x.fill();
    }
    x.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 3; i++) {   // rong dưới đáy đung đưa
      const sx = bx + 10 + i * 24, sw = Math.sin(now / 500 + i * 1.7) * 5;
      x.strokeStyle = i % 2 ? '#2a7a4a' : '#3a9a5a'; x.lineWidth = 3; x.lineCap = 'round';
      x.beginPath(); x.moveTo(sx, top + H); x.quadraticCurveTo(sx + sw, top + H - 22, sx - sw * 0.6, top + H - 40 - i * 6); x.stroke();
    }
    x.fillStyle = '#6a5a3a'; x.beginPath(); x.ellipse(bx + bw / 2, top + H + 4, bw * 0.7, 10, 0, 0, Math.PI * 2); x.fill();   // cát đáy
    for (let i = 0; i < 10; i++) {   // bọt khí bay lên lắc lư
      const ph = ((now / 2600) + i * 0.137) % 1, bxx = bx + 6 + ((i * 29) % (bw - 12)) + Math.sin(now / 300 + i) * 3, byy = top + H - ph * H;
      x.strokeStyle = `rgba(210,240,255,${0.65 * (1 - ph)})`; x.lineWidth = 1; x.beginPath(); x.arc(bxx, byy, 1.4 + (i % 3), 0, Math.PI * 2); x.stroke();
    }
    // ---- vùng cá: viên nang phát sáng (xanh trong vùng, nhạt khi ra ngoài)
    const z = S.z != null ? S.z : 0.5, zw = S.S.d.w, zy = top + (1 - z - zw / 2) * H, zh = zw * H;
    const zc = inZ ? 'rgba(90,255,150,' : 'rgba(120,230,170,';
    const zg = x.createLinearGradient(0, zy, 0, zy + zh); zg.addColorStop(0, zc + '0.15)'); zg.addColorStop(0.5, zc + (inZ ? '0.5)' : '0.3)')); zg.addColorStop(1, zc + '0.15)');
    rr(x, bx + 4, zy, bw - 8, zh, Math.min(14, zh / 2)); x.fillStyle = zg; x.fill();
    x.lineWidth = inZ ? 2 : 1.4; x.strokeStyle = inZ ? '#8affb8' : 'rgba(150,255,190,.6)'; x.shadowColor = '#5aff9a'; x.shadowBlur = inZ ? 10 : 0; x.stroke(); x.shadowBlur = 0;
    // ---- con cá trong vùng: thân thoi, vây, đuôi quẫy, mắt; màu theo nhóm cá
    const fy = top + (1 - z) * H, wig = Math.sin(now / 70) * 4, col = GCOL[game.g] || GCOL.c, tail = Math.sin(now / 55) * 0.5;
    x.save(); x.translate(bx + bw / 2 + wig, fy); x.scale(game.g === 'l' || game.g === 'e' ? 1.25 : 1, game.g === 'l' || game.g === 'e' ? 1.25 : 1);
    x.save(); x.translate(12, 0); x.rotate(tail); x.fillStyle = col[1]; x.beginPath(); x.moveTo(0, 0); x.lineTo(10, -7); x.quadraticCurveTo(7, 0, 10, 7); x.closePath(); x.fill(); x.restore();
    const fg = x.createLinearGradient(0, -7, 0, 7); fg.addColorStop(0, col[0]); fg.addColorStop(1, col[1]);
    x.fillStyle = fg; x.beginPath(); x.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1; x.stroke();
    x.fillStyle = col[1]; x.beginPath(); x.moveTo(-4, -6); x.lineTo(3, -12); x.lineTo(6, -5); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.25)'; for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(-2 + k * 4, 0, 3.5, -1, 1); x.stroke(); }
    x.fillStyle = '#fff'; x.beginPath(); x.arc(-9, -2, 2.4, 0, Math.PI * 2); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.arc(-9.6, -2, 1.2, 0, Math.PI * 2); x.fill();
    if (game.g === 'l') { x.fillStyle = '#fff'; for (let k = 0; k < 3; k++) { const a = now / 200 + k * 2.1; x.fillRect(Math.cos(a) * 18, Math.sin(a) * 10, 1.5, 1.5); } }
    x.restore();
    // ---- lưỡi câu: dây từ mặt nước xuống, lưỡi móc + phao nhỏ; giữ nút thì sáng vàng
    const my = top + (1 - S.m) * H, hx = bx + bw / 2 - 26;
    x.strokeStyle = 'rgba(240,240,240,.8)'; x.lineWidth = 1; x.beginPath(); x.moveTo(hx, top); x.lineTo(hx, my - 6); x.stroke();
    x.fillStyle = game.hold ? '#ffd040' : '#e83a2a'; x.beginPath(); x.arc(hx, my - 9, 4, Math.PI, 0); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(hx, my - 9, 4, 0, Math.PI); x.fill();
    x.strokeStyle = game.hold ? '#fff6c0' : '#d8d8e0'; x.lineWidth = 2; x.beginPath(); x.moveTo(hx, my - 5); x.lineTo(hx, my + 4); x.arc(hx + 4, my + 4, 4, Math.PI, Math.PI * 0.15, true); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(bx, my - 1, bw, 2);   // vạch ngang mờ chỉ độ sâu lưỡi
    x.restore();   // hết vùng cắt cột nước
    // ---- ống tiến độ thuỷ tinh
    const tx = 110, tw = 22, ty = top, th = H, pr = Math.max(0, Math.min(1, S.prog));
    rr(x, tx - 4, ty - 4, tw + 8, th + 8, 12); x.fillStyle = '#2a1a0a'; x.fill(); x.lineWidth = 2.5; x.strokeStyle = fr; x.stroke();
    x.save(); rr(x, tx, ty, tw, th, 9); x.clip();
    x.fillStyle = '#06121c'; x.fillRect(tx, ty, tw, th);
    const ly = ty + th * (1 - pr), lg = x.createLinearGradient(0, ty + th, 0, ty);
    lg.addColorStop(0, '#e8443a'); lg.addColorStop(0.45, '#ffc040'); lg.addColorStop(0.8, '#7aff7a'); lg.addColorStop(1, '#3ae0a0');
    x.fillStyle = lg; x.beginPath(); x.moveTo(tx, ly);
    for (let k = 0; k <= 6; k++) x.lineTo(tx + k * tw / 6, ly + Math.sin(now / 160 + k) * 1.8);   // mặt chất lỏng sóng sánh
    x.lineTo(tx + tw, ty + th); x.lineTo(tx, ty + th); x.closePath(); x.fill();
    for (let k = 0; k < 4; k++) { const ph = ((now / 1400) + k * 0.25) % 1, yy = ty + th - ph * (th * pr); if (yy > ly) { x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.arc(tx + 6 + (k * 5) % 12, yy, 1.3, 0, Math.PI * 2); x.fill(); } }
    if (pr > 0.8) { x.globalCompositeOperation = 'lighter'; x.fillStyle = `rgba(120,255,160,${0.15 + 0.15 * Math.sin(now / 90)})`; x.fillRect(tx, ty, tw, th); x.globalCompositeOperation = 'source-over'; }
    x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(tx + 3, ty + 4, 3, th - 8);   // vệt sáng thuỷ tinh
    x.restore();
    x.strokeStyle = 'rgba(255,230,160,.5)'; x.lineWidth = 1; for (const k of [0.25, 0.5, 0.75]) { x.beginPath(); x.moveTo(tx - 4, ty + th * k); x.lineTo(tx + 2, ty + th * k); x.stroke(); }   // vạch chia
    x.font = '900 13px "Be Vietnam Pro", sans-serif'; x.textAlign = 'center'; x.lineWidth = 3; x.strokeStyle = '#000';
    const pt = Math.round(pr * 100) + '%'; x.strokeText(pt, tx + tw / 2, ty + th + 18); x.fillStyle = pr > 0.8 ? '#7aff9a' : pr < 0.25 ? '#ff7a6a' : '#ffe070'; x.fillText(pt, tx + tw / 2, ty + th + 18);
    x.font = '700 9px "Be Vietnam Pro", sans-serif'; x.fillStyle = inZ ? '#8affb8' : '#ff9a8a';
    x.strokeText(inZ ? 'ĐANG KÉO' : 'CÁ GIÃY!', bx + bw / 2, ty + th + 18); x.fillText(inZ ? 'ĐANG KÉO' : 'CÁ GIÃY!', bx + bw / 2, ty + th + 18);
  }
  // ---------- bảng "Câu được!" giữa màn hình: hình cá to, tên theo màu độ hiếm, cân nặng, kỷ lục – đứng yên ~3,5 giây cho kịp đọc ----------
  let cardEl = null, cardTimer = 0;
  const RN = { common: 'Thường', rare: 'Hiếm', epic: 'Quý', legendary: 'Huyền thoại' };
  function catchCard(d, it, col) {
    if (!cardEl) { cardEl = document.createElement('div'); cardEl.id = 'fish-card'; ($('screen-game') || document.body).appendChild(cardEl); }
    clearTimeout(cardTimer);
    const junk = d.id === 'fish_junk', rar = it.rarity || 'common';
    cardEl.className = 'show r-' + rar + (d.rec ? ' rec' : '');
    cardEl.innerHTML = `<div class="fc-h">${d.treasure ? '💰 VỚT ĐƯỢC BẢO VẬT!' : junk ? '😅 CÂU PHẢI RÁC…' : '🎣 CÂU ĐƯỢC!'}</div>
      <img src="${UI.iconUrl(d.id)}" width="72" height="72">
      <div class="fc-n" style="color:${col}">${UI.esc(it.name || '')}</div>
      <div class="fc-s">${!junk && !d.treasure ? `<span>${RN[rar] || ''}</span>` : ''}${d.kg ? `<b>⚖ ${d.kg} cân</b>` : ''}</div>
      ${d.rec ? '<div class="fc-rec">🏆 KỶ LỤC MỚI!</div>' : ''}`;
    void cardEl.offsetWidth;
    cardTimer = setTimeout(() => { cardEl.className = cardEl.className.replace('show', 'hide'); }, 3500);
  }
  // ---------- chế độ tập trung khi cá cắn câu / đang kéo cá ----------
  // rung máy liên tục, màn hình giật nhẹ theo nhịp, 2 dải đen trượt vào trên dưới + viền tối nhịp đập quanh mép màn hình
  let focusEl = null, focusTimer = 0, focusMode = null;
  function focus(mode) {
    if (mode === focusMode) return;
    focusMode = mode;
    clearInterval(focusTimer); focusTimer = 0;
    if (!focusEl) { focusEl = document.createElement('div'); focusEl.id = 'fish-focus'; focusEl.innerHTML = '<i class="ff-t"></i><i class="ff-b"></i><i class="ff-v"></i>'; ($('screen-game') || document.body).appendChild(focusEl); }
    focusEl.className = mode ? 'on ' + mode : '';
    if (!mode) { try { navigator.vibrate && navigator.vibrate(0); } catch (e) { } return; }
    const beat = () => {
      const bite = focusMode === 'bite';
      try { navigator.vibrate && navigator.vibrate(bite ? [160, 70, 160] : 90); } catch (e) { }
      if (G.rumble) G.rumble(bite ? 3.2 : 1.6, bite ? 260 : 180);
    };
    beat(); focusTimer = setInterval(beat, mode === 'bite' ? 480 : 700);
  }
  function onFish(d) {
    focus(d.st === 'bite' ? 'bite' : d.st === 'fight' ? 'fight' : null);
    if (d.st === 'wait') { st = d; if (d.sta != null) staLeft = d.sta; if (d.rod) rodInfo = { id: d.rod, dur: d.dur, max: d.max }; if (d.tired && Date.now() - tiredWarned > 600000) { tiredWarned = Date.now(); UI.toast('😮‍💨 Câu liền quá lâu – cá hiếm ít dần. Nghỉ 10 phút để hồi sức.', 'info'); } return ui(); }
    if (d.st === 'fight') { st = Object.assign({}, st, { st: 'fight' }); gameStart(d); return ui(); }
    if (d.st === 'bite') {
      st = Object.assign({}, st, { st: 'bite' }); biteAt = performance.now();
      if (G.self) Overhead.add(G.self.x, G.self.y - 96, '❗ Cá cắn câu!', 'status', '#ffe060');
      GameAudio.sfx('click'); if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) { }
      return ui();
    }
    if (d.st === 'off') { st = null; if (!game.on && game.el) game.el.classList.add('hidden'); return ui(); }
    st = null;
    if (d.st === 'broke') {
      game.on = false; if (game.el) game.el.classList.add('hidden'); rodInfo = null;
      if (lastLine) snaps.push({ id: G.you, wx: lastLine.wx, wy: lastLine.wy, rod: lastLine.rod, t0: performance.now() });
      const rn = (G.data.items[d.rod] || {}).name || 'Cần câu', fn = d.fish ? (G.data.items[d.fish] || {}).name : '';
      if (G.self) Overhead.add(G.self.x, G.self.y - 96, `💥 GÃY ${rn.toUpperCase()}!${fn ? ' ' + fn + ' thoát mất' : ''}`, 'status', '#ff6a4a');
      UI.toast(`💥 ${rn} bị gãy!${d.left ? ` Còn ${d.left} cây cùng loại.` : ' Mua cần mới ở Đầu Bếp Tửu Lâu.'}`, 'error');
      GameAudio.sfx('enhFail'); if (G.shakeScreen) G.shakeScreen(4);
    }
    if (d.st === 'miss') { game.on = false; if (game.el) game.el.classList.add('hidden'); if (G.self) Overhead.add(G.self.x, G.self.y - 90, d.why === 'early' ? 'Giật sớm quá – cá bỏ đi' : d.why === 'late' ? 'Giật chậm – cá đã nhả mồi' : `${d.fish && G.data.items[d.fish] ? G.data.items[d.fish].name : 'Cá'} giãy thoát mất…`, 'status', '#a0b4c8'); }
    if (d.st === 'got') {
      if (lastLine) reel(G.you, lastLine.wx, lastLine.wy, d.id);
      const it = G.data.items[d.id] || {}, col = { legendary: '#ffb347', epic: '#d08cff', rare: '#7fbfff' }[it.rarity] || '#e8f4ff';
      catchCard(d, it, col);
      GameAudio.sfx(it.rarity === 'legendary' || it.rarity === 'epic' || d.treasure ? 'enhOk' : 'coin');
      if (it.rarity === 'legendary' && G.shakeScreen) G.shakeScreen(6);
    }
    if (loop) setTimeout(() => { if (!st && hasBait() && hasRod() && nearWater() && G.me && !G.me.dead) emit({ op: 'cast' }); }, 1300);
    ui();
  }
  let lastLine = null;
  const gone = new Map();   // dây vừa thu (máy chủ báo thu cần trước, báo cá câu được sau)
  function onLine(d) {
    const cur = lines.get(d.id) || gone.get(d.id);
    if (d.id === G.you && cur) lastLine = cur;
    if (d.off) {
      if (d.got && d.id !== G.you && cur) reel(d.id, cur.wx, cur.wy, d.got);
      if (d.snap && d.id !== G.you && cur) snaps.push({ id: d.id, wx: cur.wx, wy: cur.wy, rod: cur.rod, t0: performance.now() });
      if (lines.has(d.id)) { gone.set(d.id, lines.get(d.id)); setTimeout(() => gone.delete(d.id), 3000); }
      lines.delete(d.id);
    }
    else if (d.bite && cur) cur.bite = 1;
    else { lines.set(d.id, { wx: d.wx, wy: d.wy, t: performance.now(), rod: d.rod || 'can_cau' }); if (d.id === G.you) lastLine = lines.get(d.id); }
  }

  // ---------- vẽ cần câu ----------
  // Cần trúc thuôn: gốc ở tay, ngọn chếch lên về phía mặt nước. Độ oằn (bend 0..1) kéo ngọn về phía phao:
  // chờ cá oằn nhẹ, cá cắn câu oằn mạnh + rung, lúc kéo cá lên oằn ngược lên trên.
  const reels = [];   // cảnh kéo cá khỏi mặt nước
  const qp = (a, c, b, t) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
  // 5 kiểu cần: màu thân xen kẽ, đốt / khoen, tay cầm, guồng, dây, hiệu ứng riêng (tua, sương băng, hào quang rồng)
  const RS = {
    can_cau:  { out: '#2a1a0e', a: '#c8a050', b: '#b48a3e', base: '#6a3a1e', node: '#7a5a26', every: 4, grip: '#b8282a', reel: ['#2a1a0e', '#8a6a3a', '#e8e0c8'], guide: '#d8d8e0', line: 'rgba(245,245,245,.85)', w: 4.6 },
    can_cau2: { out: '#100804', a: '#4a3426', b: '#3a2618', base: '#1a0e08', node: '#c8c8d0', every: 3, band: 1, grip: '#8a1a1a', reel: ['#202028', '#7a7a88', '#d8d8e8'], guide: '#e0e0e8', line: 'rgba(240,240,240,.9)', w: 4.9 },
    can_cau3: { out: '#1e0a26', a: '#8a4a9a', b: '#6a2a7a', base: '#3a1a4a', node: '#4ae0a0', every: 4, jade: 1, grip: '#e8c040', reel: ['#1a4a3a', '#3ab88a', '#d0fff0'], guide: '#e8c040', line: 'rgba(230,255,240,.9)', w: 4.8, tassel: '#e83a3a' },
    can_cau4: { out: '#0a1a2a', a: '#b8dcf8', b: '#8ab8e0', base: '#2a4a6a', node: '#ffffff', every: 5, grip: '#3a6ab8', reel: ['#1a2a40', '#8ab8e0', '#ffffff'], guide: '#e8f8ff', line: 'rgba(210,240,255,.95)', w: 4.8, glow: '#7ac8ff', frost: 1 },
    can_cau5: { out: '#3a1800', a: '#ffd860', b: '#e8a020', base: '#7a3a00', node: '#ff3a2a', every: 3, scale: 1, grip: '#8a1a1a', reel: ['#5a2a00', '#ffc030', '#ff4a2a'], guide: '#fff0a0', line: 'rgba(255,220,100,.95)', w: 5.1, glow: '#ffc040', dragon: 1 }
  };
  function rod(ctx, e, tx, ty, bend, now, pull, rid, broken) {
    const S = RS[rid] || RS.can_cau;
    const dir = tx >= e.x ? 1 : -1, L = 78;
    const B = { x: e.x + dir * 12, y: e.y - 34 };                       // tay cầm
    const T0 = { x: B.x + dir * L * 0.62, y: B.y - L * 0.78 };          // ngọn khi thẳng
    // ngọn bị kéo về phía phao (pull = hướng kéo), giữ chiều dài gần đúng
    const px = pull ? pull.x : tx, py = pull ? pull.y : ty;
    const dx = px - T0.x, dy = py - T0.y, dl = Math.hypot(dx, dy) || 1;
    const T = { x: T0.x + dx / dl * L * 0.55 * bend, y: T0.y + dy / dl * L * 0.55 * bend };
    const Cc = { x: B.x + (T0.x - B.x) * 0.55, y: B.y + (T0.y - B.y) * 0.55 };   // điểm uốn giữ gần thân thẳng -> thân cong dần về ngọn
    const N = 22, NE = broken ? Math.round(N * 0.55) : N;   // gãy: chỉ còn khúc gốc
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(B.x + 4, e.y - 2); ctx.lineTo(T.x + 10, e.y + 4); ctx.stroke();
    if (S.glow) {   // hào quang quanh thân (cần băng / cần rồng)
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = S.glow; ctx.globalAlpha = 0.18 + 0.1 * Math.sin(now / 300); ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(B.x, B.y); for (let k = 1; k <= NE; k++) { const q = qp(B, Cc, T, k / N); ctx.lineTo(q.x, q.y); } ctx.stroke(); ctx.restore();
    }
    let prev = B;
    for (let k = 1; k <= NE; k++) {
      const t = k / N, p = qp(B, Cc, T, t), w = S.w - (S.w - 1.2) * t;
      ctx.strokeStyle = S.out; ctx.lineWidth = w + 1.6; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      prev = p;
    }
    prev = B;
    for (let k = 1; k <= NE; k++) {
      const t = k / N, p = qp(B, Cc, T, t), w = S.w - (S.w - 1.2) * t;
      ctx.strokeStyle = t < 0.2 ? S.base : k % 2 ? S.a : S.b; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      if (t >= 0.2 && k % S.every === 0) {
        if (S.band) { ctx.strokeStyle = S.node; ctx.lineWidth = 1.6; const nx = -(p.y - prev.y), ny = p.x - prev.x, nl = Math.hypot(nx, ny) || 1; ctx.beginPath(); ctx.moveTo(p.x - nx / nl * w * 0.7, p.y - ny / nl * w * 0.7); ctx.lineTo(p.x + nx / nl * w * 0.7, p.y + ny / nl * w * 0.7); ctx.stroke(); }   // đai sắt
        else { ctx.fillStyle = S.node; ctx.beginPath(); ctx.arc(p.x, p.y, w * (S.jade ? 0.75 : 0.62), 0, Math.PI * 2); ctx.fill(); if (S.jade || S.scale) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(p.x - 0.8, p.y - 1.2, 1, 1); } }   // đốt / ngọc / hồng ngọc
      }
      if (S.scale && t >= 0.2 && k % 2 === 0) { ctx.strokeStyle = 'rgba(122,58,0,.55)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(p.x, p.y, w * 0.45, 0.2, 2.6); ctx.stroke(); }   // vảy rồng
      prev = p;
    }
    if (broken) {   // khúc gãy văng ra: mảnh vụn nhọn
      ctx.fillStyle = S.a; for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(prev.x + dir * (4 + i * 3), prev.y - 2 + i * 3); ctx.rotate(i * 0.9); ctx.fillRect(-2, -0.7, 4, 1.4); ctx.restore(); }
    }
    for (let k = 1; k <= 3; k++) { const p = qp(B, Cc, T, k * 0.05); ctx.strokeStyle = S.grip; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(p.x - 3, p.y - 1); ctx.lineTo(p.x + 3, p.y + 1); ctx.stroke(); }   // cán quấn dây
    if (S.tassel) { ctx.strokeStyle = S.tassel; ctx.lineWidth = 1.2; const sw = Math.sin(now / 300) * 2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(B.x, B.y + 1); ctx.quadraticCurveTo(B.x + i * 2 + sw, B.y + 6, B.x + i * 3 + sw * 1.5, B.y + 11); ctx.stroke(); } ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.arc(B.x, B.y + 1, 1.6, 0, Math.PI * 2); ctx.fill(); }
    const R = qp(B, Cc, T, 0.22), spin = pull ? now / 40 : 0;   // guồng + tay quay
    ctx.fillStyle = S.reel[0]; ctx.beginPath(); ctx.arc(R.x - dir * 4, R.y + 3, 5.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = S.reel[1]; ctx.beginPath(); ctx.arc(R.x - dir * 4, R.y + 3, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = S.reel[2]; ctx.beginPath(); ctx.arc(R.x - dir * 4, R.y + 3, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = S.reel[0]; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(R.x - dir * 4, R.y + 3); ctx.lineTo(R.x - dir * 4 + Math.cos(spin) * 5, R.y + 3 + Math.sin(spin) * 5); ctx.stroke();
    if (!broken) {
      const guides = [0.45, 0.68, 0.86].map(t => qp(B, Cc, T, t));
      ctx.strokeStyle = S.guide; ctx.lineWidth = 1;
      for (const g of guides) { ctx.beginPath(); ctx.arc(g.x, g.y + 2, 1.6, 0, Math.PI * 2); ctx.stroke(); }
      ctx.strokeStyle = S.line; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(R.x - dir * 4, R.y + 3);
      for (const g of guides) ctx.lineTo(g.x, g.y + 2);
      ctx.lineTo(T.x, T.y); ctx.stroke();
      if (S.dragon) {   // đầu rồng vàng ở ngọn + đốm sáng bay quanh
        ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.arc(T.x, T.y, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffe8a0'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(T.x - 1, T.y - 2); ctx.lineTo(T.x - 3, T.y - 5); ctx.moveTo(T.x + 1, T.y - 2); ctx.lineTo(T.x + 2, T.y - 5); ctx.stroke();
        ctx.fillStyle = '#ff2a1a'; ctx.fillRect(T.x - 0.5, T.y - 0.8, 1.2, 1.2);
        for (let i = 0; i < 5; i++) { const q = qp(B, Cc, T, 0.3 + ((now / 1600 + i * 0.2) % 0.7)); const a = now / 200 + i; ctx.fillStyle = i % 2 ? '#fff6c0' : '#ffc030'; ctx.fillRect(q.x + Math.cos(a) * 5, q.y + Math.sin(a) * 5, 1.5, 1.5); }
      }
      if (S.frost) for (let i = 0; i < 5; i++) {   // tinh thể băng lấp lánh dọc thân
        const q = qp(B, Cc, T, 0.25 + i * 0.15), tw = Math.max(0, Math.sin(now / 250 + i * 1.7));
        if (tw > 0.3) { ctx.fillStyle = `rgba(230,250,255,${tw})`; ctx.fillRect(q.x - 2, q.y - 0.5, 4, 1); ctx.fillRect(q.x - 0.5, q.y - 2, 1, 4); }
      }
    }
    ctx.restore();
    return T;
  }
  const snaps = [];   // cảnh gãy cần (vài giây)
  function draw(ctx, now) {
    for (const [id, l0] of lines) {
      const e0 = id === G.you ? G.self : G.players.get(id);
      if (!e0) { lines.delete(id); continue; }
      // 2.5D chéo: đổi người câu và phao sang toạ độ chiếu (cần, dây, phao vẽ đứng thẳng đúng chỗ)
      let e = e0, l = l0;
      if (G.iso && G.iso.on()) { const a = G.iso.xy(e0.x, e0.y), w = G.iso.xy(l0.wx, l0.wy); e = Object.create(e0); e.x = a.x; e.y = a.y; l = Object.create(l0); l.wx = w.x; l.wy = w.y; }
      const bite = id === G.you ? !!(st && (st.st === 'bite' || st.st === 'fight')) : !!l.bite;
      const ph = l.ph || (l.ph = (String(id).split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 7) % 1000) / 100);   // pha dao động riêng mỗi người
      const bob = bite ? 7 + Math.sin(now / 38) * 3.5 : Math.sin(now / 420 + ph) * 2;
      const fx = l.wx + (bite ? Math.sin(now / 90) * 6 : 0), fy = l.wy + bob;
      // oằn: chờ cá 0.12 (thở nhẹ), cá cắn 0.62 ± rung
      const bend = bite ? 0.62 + Math.sin(now / 47) * 0.12 + Math.sin(now / 13) * 0.03 : 0.12 + Math.sin(now / 900 + ph) * 0.03;
      const T = rod(ctx, e, l.wx, l.wy, bend, now, bite ? { x: fx, y: fy + 40 } : null, id === G.you && st && st.rod ? st.rod : l.rod);
      ctx.save();
      // dây câu: chờ cá thì võng xuống; cá cắn thì căng gần như thẳng, rung nhẹ
      ctx.strokeStyle = bite ? 'rgba(255,255,255,.95)' : 'rgba(240,240,240,.7)'; ctx.lineWidth = bite ? 1.3 : 1;
      ctx.beginPath(); ctx.moveTo(T.x, T.y);
      if (bite) ctx.quadraticCurveTo((T.x + fx) / 2 + Math.sin(now / 25) * 2, (T.y + fy) / 2 + 4, fx, fy - 2);
      else ctx.quadraticCurveTo((T.x + fx) / 2, Math.max(T.y, fy) + 26, fx, fy - 4);
      ctx.stroke();
      // gợn nước, phao
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(fx, l.wy + 3, bite ? 14 + Math.sin(now / 60) * 4 : 9, bite ? 5 : 3, 0, 0, Math.PI * 2); ctx.fill();
      if (bite) {
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1;
        for (const k of [0, 0.5]) { const r = ((now / 600 + k) % 1); ctx.globalAlpha = 1 - r; ctx.beginPath(); ctx.ellipse(fx, l.wy + 3, 10 + r * 26, 4 + r * 9, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.globalAlpha = 1;
        for (let k = 0; k < 3; k++) { const a = now / 120 + k * 2.1; ctx.fillStyle = 'rgba(220,240,255,.8)'; ctx.fillRect(fx + Math.cos(a) * 10, l.wy - 2 - Math.abs(Math.sin(a * 1.7)) * 8, 2, 2); }   // bọt nước bắn
      } else {
        ctx.fillStyle = '#e83a2a'; ctx.beginPath(); ctx.arc(fx, fy - 4, 4, Math.PI, 0); ctx.fill();   // phao đỏ trắng
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx, fy - 4, 4, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#2a1a0e'; ctx.fillRect(fx - 0.5, fy - 12, 1, 5);
      }
      ctx.restore();
      if (bite) { ctx.save(); ctx.font = '900 26px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffe040'; const y = e.y - 120 + Math.sin(now / 80) * 3; ctx.strokeText('!', e.x, y); ctx.fillText('!', e.x, y); ctx.restore(); }
    }
    // kéo cá lên: cá vọt khỏi mặt nước theo đường cong về phía tay, cần oằn ngược lên rồi duỗi dần
    for (let i = reels.length - 1; i >= 0; i--) {
      const r = reels[i], k = (now - r.t0) / 750;
      const e = r.id === G.you ? G.self : G.players.get(r.id);
      if (k >= 1 || !e) { reels.splice(i, 1); continue; }
      const ease = 1 - Math.pow(1 - k, 2);
      const hx = e.x + (r.wx >= e.x ? 30 : -30), hy = e.y - 70;
      const fx = r.wx + (hx - r.wx) * ease, fy = r.wy + (hy - r.wy) * ease - Math.sin(ease * Math.PI) * 60;
      const T = rod(ctx, e, r.wx, r.wy, 0.5 * (1 - ease) + 0.1, now, { x: fx, y: fy }, r.rod);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(T.x, T.y); ctx.lineTo(fx, fy - 6); ctx.stroke();
      if (k < 0.25) { ctx.fillStyle = 'rgba(220,240,255,.85)'; for (let j = 0; j < 6; j++) { const a = j * 1.05; ctx.fillRect(r.wx + Math.cos(a) * (6 + k * 60), r.wy - k * 50 * Math.abs(Math.sin(a)), 2, 2); } }   // nước bắn tung
      ctx.translate(fx, fy); ctx.rotate(Math.sin(now / 50) * 0.6 + (r.wx < e.x ? 0 : Math.PI)); if (r.big) ctx.scale(2.4, 2.4);   // cá sấu / cá mập: to gấp đôi
      ctx.fillStyle = r.col; ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(13, -4); ctx.lineTo(13, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-6, -2, 2, 2);
      ctx.restore();
    }
  }
  function drawSnaps(ctx, now) {
    for (let i = snaps.length - 1; i >= 0; i--) {
      const s2 = snaps[i], k = (now - s2.t0) / 1400, e = s2.id === G.you ? G.self : G.players.get(s2.id);
      if (k >= 1 || !e) { snaps.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = 1 - k * 0.6;
      rod(ctx, e, s2.wx, s2.wy, 0.05, now, null, s2.rod, true);
      // khúc ngọn văng xuống nước, dây đứt bay phất phơ
      const dir = s2.wx >= e.x ? 1 : -1, fx = e.x + dir * (60 + k * 40), fy = e.y - 90 + k * k * 140;
      const S = RS[s2.rod] || RS.can_cau;
      ctx.translate(fx, fy); ctx.rotate(k * 8 * dir); ctx.strokeStyle = S.a; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
      ctx.strokeStyle = S.line; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(14, 0); ctx.quadraticCurveTo(24, 10 * Math.sin(now / 80), 30, 4); ctx.stroke();
      ctx.restore();
      if (k < 0.15) { ctx.fillStyle = '#fff'; ctx.font = '900 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💥', e.x + dir * 50, e.y - 100); }
    }
  }
  function reel(id, wx, wy, itemId) {
    const it = G.data.items[itemId] || {}, ln = lines.get(id) || gone.get(id) || (id === G.you ? lastLine : null);
    const col = itemId === 'fish_junk' ? '#5a4a3a' : { legendary: '#ffc030', epic: '#6ab8ff', rare: '#8ab070' }[it.rarity] || '#c8a050';
    reels.push({ id, wx, wy, t0: performance.now(), col, rod: ln && ln.rod, big: /^(croc|shark|shark_k)$/.test(it.icon || '') });
  }

  // ---------- 🍲 Nấu ăn (tab ở Đầu Bếp Tửu Lâu) ----------
  let cookTab = 'cook', topData = null;
  const STARS = n => '★'.repeat(n);
  const GN = { c: 'Thường', r: 'Hiếm', e: 'Quý', l: 'Huyền thoại', j: 'Rác' };
  function cookHtml() {
    const d = cookData; if (!d) return '<p class="muted">Đang tải...</p>';
    let h = `<div class="ck-tabs">${[['cook', '🍲 Nấu ăn'], ['sell', '💰 Bán cá'], ['gear', '🎣 Đồ câu'], ['top', '🏆 Thánh Câu']].map(([k, n]) => `<button class="btn small ${cookTab === k ? 'primary' : ''}" data-ckt="${k}">${n}</button>`).join('')}</div>`;
    if (cookTab === 'top') {
      const t = topData;
      if (!t) return h + '<p class="muted">Đang tải bảng Thánh Câu…</p>';
      const MED = ['🥇', '🥈', '🥉'], rc = id => (G.data.items[id] || {}).rarity || 'common';
      h += `<div class="ft-head">🏆 THÁNH CÂU CÁ 🏆<div class="small">Xếp theo con cá quý nhất từng câu được (độ hiếm trước, cùng loại thì nặng hơn đứng trên)</div></div>
        ${t.me ? `<div class="small ft-me">Bạn: hạng <b>${t.me.rank}</b> · <img src="${UI.iconUrl(t.me.id)}" width="16" height="16"> ${UI.esc((G.data.items[t.me.id] || {}).name || '')} <b>${t.me.kg} cân</b></div>` : '<div class="small muted ft-me">Bạn chưa có tên trên bảng – câu được con cá đầu tiên là có hạng.</div>'}
        <div class="ft-list">${t.rows.length ? t.rows.map(r => `<div class="ft-row ${r.rank <= 3 ? 'top' + r.rank : ''} ${r.me ? 'me' : ''}"><span class="ft-rk">${MED[r.rank - 1] || r.rank}</span><b class="ft-nm">${UI.esc(r.name)}</b>
          <span class="ft-fish"><img src="${UI.iconUrl(r.id)}" width="22" height="22"><span class="r-${rc(r.id)}-t">${UI.esc((G.data.items[r.id] || {}).name || '')}</span></span><b class="ft-kg">${r.kg} cân</b><span class="small muted">${fmt(r.n)} lần câu</span></div>`).join('') : '<p class="small muted">Chưa ai câu được cá.</p>'}</div>
        <h5>📜 Kỷ lục từng loại cá (con nặng nhất máy chủ)</h5>
        <div class="ft-rec">${t.rec.map(r => `<div class="ft-rc ${r.me ? 'me' : ''}"><img src="${UI.iconUrl(r.id)}" width="26" height="26"><div><b class="r-${rc(r.id)}-t">${UI.esc(r.name)}</b>
          <div class="sub">${r.holder ? `👑 ${UI.esc(r.holder)} · <b>${r.kg} cân</b>` : '<span class="muted">Chưa ai câu được</span>'}${r.mine && !r.me ? ` · bạn: ${r.mine}` : ''}</div></div></div>`).join('')}</div>`;
      return h;
    }
    if (cookTab === 'sell') {
      const list = (d.fish || []).filter(f => f.have > 0), total = list.reduce((a, f) => a + f.have * f.sell, 0), common = list.filter(f => f.g === 'c').reduce((a, f) => a + f.have * f.sell, 0);
      h += `<div class="small muted">Đầu Bếp thu mua cá tươi. Giá theo loại cá (bán cho cửa hàng khác chỉ được ~15%).</div>
        ${common ? `<button class="btn primary" data-sell="all">Bán hết cá thường (+${fmt(common)} 💰)</button>` : ''}
        <div class="list">${list.length ? list.map(f => `<div class="li ck-row"><img src="${UI.iconUrl(f.id)}" class="ic" width="32" height="32"><div class="grow"><b class="r-${(G.data.items[f.id] || {}).rarity || 'common'}-t">${UI.esc(f.name)}</b> <span class="small muted">x${f.have} · ${GN[f.g]}</span>
          <div class="sub">${fmt(f.sell)} lượng / con · tổng ${fmt(f.sell * f.have)}</div></div><button class="btn small" data-sell="${f.id}" data-n="1">Bán 1</button><button class="btn small primary" data-sell="${f.id}">Bán hết</button></div>`).join('') : '<p class="small muted">Chưa có cá trong túi.</p>'}</div>
        ${total ? `<div class="small">Tổng giá trị cá trong túi: <b>${fmt(total)}</b> lượng</div>` : ''}`;
    } else if (cookTab === 'gear') {
      h += `<div class="small muted">Cần càng mạnh kéo cá to càng dễ – cá khoẻ hơn sức cần thì vùng cá rất hẹp, cá vọt nhanh và dễ <b>gãy cần</b>. Độ bền giảm theo sức cá mỗi lần kéo; gần hết bền rất dễ gãy. Mồi tốt: cá hiếm nhiều hơn, cắn nhanh hơn, cá ngậm chặt hơn. Cá sấu, cá mập chỉ mê <b>mồi thịt / cá sống</b>.</div>
        <h5>Cần câu</h5><div class="list">${d.rods.map(r => `<div class="li ck-row ${r.on ? 'ck-on' : ''}"><img src="${UI.iconUrl(r.id)}" class="ic" width="34" height="34"><div class="grow"><b class="r-${(G.data.items[r.id] || {}).rarity || 'common'}-t">${UI.esc(r.name)}</b> <span class="small" style="color:#7fd0ff">sức ${STARS(r.p)}</span>
          <div class="sub">${r.have ? `Có ${r.have} cây · độ bền <b style="color:${r.dur / r.max < 0.25 ? '#ff7a5a' : '#4ade80'}">${r.dur}/${r.max}</b>` : `<span class="muted">Chưa có · giá ${fmt(r.price)} 💰 (tab Mua)</span>`}</div>
          ${r.have ? `<div class="ck-dur"><i style="width:${Math.round(r.dur / r.max * 100)}%;background:${r.dur / r.max < 0.25 ? '#ff6a4a' : '#4ade80'}"></i></div>` : ''}</div>
          ${r.have ? (r.on ? '<span class="small ok-t">✔ Đang dùng</span>' : `<button class="btn small primary" data-rod="${r.id}">Dùng</button>`) : ''}</div>`).join('')}</div>
        <h5>Mồi câu</h5><div class="list">${d.baits.map(b => `<div class="li ck-row ${b.on ? 'ck-on' : ''}"><img src="${UI.iconUrl(b.id)}" class="ic" width="32" height="32"><div class="grow"><b>${UI.esc(b.name)}</b> <span class="small muted">${b.have ? 'x' + b.have : 'chưa có'} · ${fmt(b.price)} 💰</span><div class="sub">${UI.esc(b.desc)}</div></div>
          ${b.have ? (b.on ? '<span class="small ok-t">✔ Đang dùng</span>' : `<button class="btn small primary" data-bait="${b.id}">Dùng</button>`) : ''}</div>`).join('')}</div>
        <h5>Các loại cá</h5><div class="ck-fishes">${(d.fish || []).filter(f => f.g !== 'j').map(f => `<div class="ck-f"><img src="${UI.iconUrl(f.id)}" width="28" height="28"><div><b class="r-${(G.data.items[f.id] || {}).rarity || 'common'}-t">${UI.esc(f.name)}</b><div class="sub">${GN[f.g]} · sức ${STARS(f.lv)}${f.pred ? ' · 🦈 cá dữ' : ''}${f.tier ? ` · bãi cấp ${f.tier}+` : ''}</div></div></div>`).join('')}</div>`;
    } else {
      h += `<div class="small muted">Mỗi món cần <b>đủ từng loại cá</b> – phải câu nhiều loại để phối. Ăn (Sử dụng trong túi đồ) để nhận hiệu quả; ăn thêm cùng món cộng dồn thời gian (tối đa 8 giờ), ăn món khác thì thay món cũ.</div>`;
      if (d.food) h += `<div class="card ck-cur">🍲 Đang hưởng: <b>${UI.esc(d.food.name)}</b> · còn ${Math.ceil((d.food.until - Date.now()) / 60000)} phút</div>`;
      h += '<div class="list">' + d.dishes.map(x => {
        const can = x.need.every(n => n.have >= n.q) && G.me.gold >= x.gold;
        const max = Math.max(0, Math.min(10, ...x.need.map(n => Math.floor(n.have / n.q)), Math.floor(G.me.gold / x.gold)));
        return `<div class="li ck-row"><img src="${UI.iconUrl(x.id)}" class="ic" width="36" height="36"><div class="grow"><b class="r-${(G.data.items[x.id] || {}).rarity || 'common'}-t">${UI.esc(x.name)}</b> <span class="small" style="color:#4ade80">${UI.esc(x.buff)} · ${x.min} phút</span>
          <div class="sub ck-need">${x.need.map(n => `<span class="${n.have >= n.q ? 'ok-t' : 'warn'}"><img src="${UI.iconUrl(n.k)}" width="16" height="16">${UI.esc(n.name)} ${n.have}/${n.q}</span>`).join('')} <span>${fmt(x.gold)} 💰</span></div></div>
          <button class="btn small ${can ? 'primary' : ''}" data-cook="${x.id}" ${can ? '' : 'disabled'}>Nấu</button>${max > 1 ? `<button class="btn small" data-cook="${x.id}" data-n="${max}">Nấu ${max}</button>` : ''}</div>`;
      }).join('') + '</div>';
      h += `<div class="card"><h4>🎣 Sổ câu cá · đã câu ${fmt(d.fishN)} lần</h4>${d.best.length ? '<div class="small">' + d.best.map(b => `${UI.esc(b.name)}: <b>${b.kg} cân</b>`).join(' · ') + '</div>' : '<div class="small muted">Chưa câu được con nào. Mua cần + mồi ở tab Mua, ra sông hồ đứng sát mép nước rồi bấm 🎣.</div>'}
        <div class="small muted" style="margin-top:4px">Bãi luyện cấp cao và ban đêm dễ ra cá hiếm. Cá sấu (bãi cấp 2+), cá mập (bãi cấp 4+), Cự Sa Vương (bãi cấp 5+). Thể lực câu 300 lần / ngày.</div></div>`;
    }
    return h;
  }
  function renderCook() {
    if (!cookHost || !cookHost.isConnected) return;
    cookHost.innerHTML = cookHtml();
    cookHost.querySelectorAll('[data-cook]').forEach(b => b.onclick = () => emit({ op: 'cook', id: b.dataset.cook, n: +b.dataset.n || 1 }));
    cookHost.querySelectorAll('[data-ckt]').forEach(b => b.onclick = () => { cookTab = b.dataset.ckt; if (cookTab === 'top') emit({ op: 'top' }); renderCook(); });
    cookHost.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => emit({ op: 'sell', id: b.dataset.sell, n: +b.dataset.n || 0 }));
    cookHost.querySelectorAll('[data-rod]').forEach(b => b.onclick = () => emit({ op: 'rod', id: b.dataset.rod }));
    cookHost.querySelectorAll('[data-bait]').forEach(b => b.onclick = () => emit({ op: 'bait', id: b.dataset.bait }));
  }
  function mountCook(el, d) { cookHost = el; if (d && d.cook) cookData = d.cook; renderCook(); emit({ op: 'cookView' }); }
  function onCook(d) { cookData = d; renderCook(); }

  function bind(s) {
    s.on('fish', onFish);
    s.on('fishLine', onLine);
    s.on('cook', onCook);
    s.on('fishTop', d => { topData = d; if (cookTab === 'top') renderCook(); });
    s.on('init', () => { lines.clear(); st = null; });
  }
  const drawAll = (ctx, now) => { draw(ctx, now); drawSnaps(ctx, now); };
  window.Fishing = { bind, draw: drawAll, mountCook, get state() { return st; } };
})();
