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
      el.innerHTML = '<div class="fg-t">🎣 KÉO CÁ!</div><div class="fg-pw"></div><canvas width="120" height="250"></canvas><div class="fg-h">Giữ chuột / chạm / Space để kéo vạch lên – nhả để chìm.<br>Giữ vạch trong vùng cá tới khi đầy thanh.</div>';
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
  function gameDraw(now) {
    const x = game.cv.getContext('2d'), S = game.sim, H = 230, top = 10, bx = 30, bw = 40;
    x.clearRect(0, 0, 120, 250);
    // ống nước
    const g = x.createLinearGradient(0, top, 0, top + H); g.addColorStop(0, '#2a6a9a'); g.addColorStop(1, '#0a2238');
    x.fillStyle = '#05121e'; x.fillRect(bx - 3, top - 3, bw + 6, H + 6); x.fillStyle = g; x.fillRect(bx, top, bw, H);
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(180,230,255,.25)'; const yy = top + ((now / 20 + i * 41) % H); x.fillRect(bx + 6 + (i * 7) % 28, top + H - (yy - top), 2, 2); }   // bọt
    // vùng cá
    const z = S.z != null ? S.z : 0.5, zw = S.S.d.w, zy = top + (1 - z - zw / 2) * H;
    x.fillStyle = S.inZ ? 'rgba(90,240,130,.55)' : 'rgba(90,240,130,.32)'; x.fillRect(bx, zy, bw, zw * H);
    x.strokeStyle = '#7dffa0'; x.lineWidth = 1.5; x.strokeRect(bx + 0.5, zy + 0.5, bw - 1, zw * H - 1);
    // con cá trong vùng
    const fy = top + (1 - z) * H, wig = Math.sin(now / 70) * 3;
    x.save(); x.translate(bx + bw / 2 + wig, fy); x.fillStyle = { c: '#d8b060', r: '#8ab070', e: '#6ab8ff', l: '#ffc030' }[game.g] || '#d8b060';
    x.beginPath(); x.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.moveTo(9, 0); x.lineTo(16, -5); x.lineTo(16, 5); x.closePath(); x.fill();
    x.fillStyle = '#000'; x.fillRect(-7, -2, 2, 2); x.restore();
    // vạch của người chơi (lưỡi câu)
    const my = top + (1 - S.m) * H;
    x.fillStyle = '#fff'; x.fillRect(bx - 8, my - 2, bw + 16, 4); x.fillStyle = game.hold ? '#ffd040' : '#e83a2a'; x.fillRect(bx - 12, my - 5, 8, 10);
    // thanh tiến độ
    x.fillStyle = '#05121e'; x.fillRect(86, top - 3, 16, H + 6);
    const pg = x.createLinearGradient(0, top + H, 0, top); pg.addColorStop(0, '#e8443a'); pg.addColorStop(0.5, '#ffd040'); pg.addColorStop(1, '#4ade80');
    x.fillStyle = pg; x.fillRect(89, top + H * (1 - S.prog), 10, H * S.prog);
    x.fillStyle = '#fff'; x.font = 'bold 10px sans-serif'; x.textAlign = 'center'; x.fillText(Math.round(S.prog * 100) + '%', 94, top + H + 12 > 250 ? 248 : top + H + 12);
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
    for (const [id, l] of lines) {
      const e = id === G.you ? G.self : G.players.get(id);
      if (!e) { lines.delete(id); continue; }
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
  let cookTab = 'cook';
  const STARS = n => '★'.repeat(n);
  const GN = { c: 'Thường', r: 'Hiếm', e: 'Quý', l: 'Huyền thoại', j: 'Rác' };
  function cookHtml() {
    const d = cookData; if (!d) return '<p class="muted">Đang tải...</p>';
    let h = `<div class="ck-tabs">${[['cook', '🍲 Nấu ăn'], ['sell', '💰 Bán cá'], ['gear', '🎣 Đồ câu']].map(([k, n]) => `<button class="btn small ${cookTab === k ? 'primary' : ''}" data-ckt="${k}">${n}</button>`).join('')}</div>`;
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
    cookHost.querySelectorAll('[data-ckt]').forEach(b => b.onclick = () => { cookTab = b.dataset.ckt; renderCook(); });
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
    s.on('init', () => { lines.clear(); st = null; });
  }
  const drawAll = (ctx, now) => { draw(ctx, now); drawSnaps(ctx, now); };
  window.Fishing = { bind, draw: drawAll, mountCook, get state() { return st; } };
})();
