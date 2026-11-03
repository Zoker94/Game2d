// Chọi gà phía người chơi (máy chủ: server/game/cockfight.js). Ảnh: public/assets/rooster/<giống>.png
//   4 hàng × 6 khung, ô 48×64, chân ở (24, 60), quay phải: 0 đứng thở · 1 chạy lao · 2 bật nhảy đá · 3 trúng đòn → bất tỉnh.
// - Bảng Trường Gà (NPC Chủ Trường Gà, Tương Dương): Chuồng gà · Đấu tập · Thách đấu · Mua · Sư Kê
// - Màn xem trận: sân đất có hàng rào tre, hai con gà lao vào đá nhau theo nhật ký máy chủ gửi, số sát thương, chí mạng,
//   né, choáng; con thua văng ra, rơi, đập đất, gục rồi bất tỉnh (sao bay); con thắng ưỡn ngực gáy.
// - Hai con gà mổ thóc cạnh Chủ Trường Gà cho dễ nhận ra.
(function () {
  const emit = d => G.socket && G.socket.emit('cockfight', d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const esc = s => UI.esc(String(s == null ? '' : s));
  const CW = 48, CH = 64, FX = 24, FY = 60;
  const imgs = {};
  const RC = { common: '#e8e0d0', rare: '#7fbfff', epic: '#d08cff', legendary: '#ffb347' };
  function img(b) { if (!imgs[b]) { const i = new Image(); i.src = '/assets/rooster/' + b + '.png'; imgs[b] = i; } return imgs[b].complete && imgs[b].naturalWidth ? imgs[b] : null; }
  // vẽ 1 khung tại (x, y = chân), sc = phóng, flip = quay trái
  function frame(ctx, breed, row, col, x, y, sc, flip, alpha) {
    const im = img(breed); if (!im) return;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (flip) ctx.scale(-1, 1);
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, col * CW, row * CH, CW, CH, -FX * sc, -FY * sc, CW * sc, CH * sc);
    ctx.restore();
  }
  let data = null, tab = 'coop', tac = 'can', topData = null;

  // ---------- bảng Trường Gà ----------
  UI.registerPanel('cockfight', '🐓 Trường Gà', body => {
    const d = data;
    if (!d) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    const tabs = [['coop', '🐓 Chuồng gà'], ['pve', '⚔️ Đấu tập'], ['pvp', '🤝 Thách đấu'], ['shop', '🛒 Mua'], ['top', '🏆 Sư Kê']];
    let h = `<div class="cf-tabs">${tabs.map(([k, n]) => `<button class="btn small ${tab === k ? 'primary' : ''}" data-cft="${k}">${n}</button>`).join('')}</div>`;
    const sel = d.list.find(x => x.id === d.sel);
    if (tab === 'coop') {
      if (d.free) h += `<div class="card cf-free">🎁 Lần đầu tới Trường Gà? <button class="btn primary" data-cfo="free">Nhận 1 Gà Điều miễn phí</button></div>`;
      h += `<div class="small muted">Chuồng ${d.list.length}/${d.max} · Thóc: <b>${d.thoc}</b> · Thể lực hồi 1 điểm / 3 phút, mỗi trận tốn ${d.cost}. Có trứng trong túi thì Sử dụng để ấp nở.</div>`;
      h += d.list.length ? '<div class="cf-list">' + d.list.map(r => `<div class="cf-card ${r.id === d.sel ? 'on' : ''}" style="--rc:${RC[r.rar]}">
          <canvas class="cf-cv" data-b="${r.breed}" width="96" height="112"></canvas>
          <div class="cf-info"><div><b class="cf-nm">${esc(r.name)}</b> <span class="cf-st">${'★'.repeat(r.stars)}</span></div>
            <div class="small" style="color:${RC[r.rar]}">${esc(r.bname)} · Cấp ${r.lv}</div>
            <div class="cf-bar"><i style="width:${r.lv >= 30 ? 100 : Math.round(r.exp / r.need * 100)}%;background:#7aa8ff"></i><span>KN ${r.lv >= 30 ? 'MAX' : r.exp + '/' + r.need}</span></div>
            <div class="cf-bar"><i style="width:${r.en}%;background:${r.en < 20 ? '#ff6a4a' : '#4ade80'}"></i><span>Thể lực ${r.en}/100</span></div>
            <div class="small cf-stats">❤ ${r.st.hp} · ⚔ ${r.st.atk} · 💨 ${r.st.spd} · 🛡 ${r.st.def}</div>
            <div class="small"><b style="color:#ffd76a">${esc(r.skn)}</b>: ${esc(r.skd)}</div>
            <div class="small muted">Thắng ${r.win} · Thua ${r.loss} · Sư Kê ${r.elo}</div>
            <div class="cf-btns">${r.id === d.sel ? '<span class="small ok-t">✔ Đang ra trận</span>' : `<button class="btn small primary" data-cfo="select" data-id="${r.id}">Chọn ra trận</button>`}
              <button class="btn small" data-cfo="feed" data-id="${r.id}" ${d.thoc ? '' : 'disabled'}>🌾 Cho ăn</button>
              <button class="btn small" data-cfo="train" data-id="${r.id}" ${r.train ? 'disabled' : ''}>💪 ${r.train ? 'Nghỉ ' + Math.ceil(r.train / 60000) + 'p' : 'Luyện (' + fmt(1000 + r.lv * 300) + ')'}</button>
              <button class="btn small" data-cfo="rename" data-id="${r.id}">✏️</button><button class="btn small" data-cfo="release" data-id="${r.id}">🕊</button></div></div></div>`).join('') + '</div>'
        : '<p class="muted">Chuồng trống. Nhận gà miễn phí hoặc mua trứng ở tab Mua.</p>';
    } else if (tab === 'pve' || tab === 'pvp') {
      h += sel ? `<div class="card cf-sel"><canvas class="cf-cv" data-b="${sel.breed}" width="96" height="112"></canvas><div><b>${esc(sel.name)}</b> ${'★'.repeat(sel.stars)} · Cấp ${sel.lv}<div class="small">Thể lực ${sel.en}/100 · ❤ ${sel.st.hp} ⚔ ${sel.st.atk} 💨 ${sel.st.spd} 🛡 ${sel.st.def}</div></div></div>` : '<p class="warn">Chưa có gà – nhận ở tab Chuồng gà.</p>';
      h += `<div class="small">Chiến thuật: ${d.tactics.map(t => `<button class="btn small ${tac === t.k ? 'primary' : ''}" data-tac="${t.k}">${t.name}</button>`).join(' ')}</div>
        <div class="small muted">Tấn công: +15% công −10% thủ · Phòng thủ: +18% thủ −10% công · Tốc chiến: +15% tốc −5% công thủ.</div>`;
      if (tab === 'pve') h += `<div class="small">Còn <b>${d.pve}</b> trận đấu tập hôm nay.</div><div class="list">${d.tiers.map((t, i) => `<div class="li"><div class="grow"><b>${esc(t.name)}</b> <span class="small muted">gà cấp ${t.lv}</span><div class="sub">Thắng: +${fmt(t.gold)} lượng, +${t.exp} kinh nghiệm cho gà</div></div><button class="btn small primary" data-pve="${i}" ${sel && d.pve > 0 ? '' : 'disabled'}>Đấu</button></div>`).join('')}</div>`;
      else h += `<div class="card"><h4>🤝 Thách đấu người chơi đang online</h4>
          <div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><input id="cf-name" placeholder="Tên nhân vật" style="width:150px"><input id="cf-stake" type="number" min="0" step="1000" placeholder="Cược (lượng)" style="width:130px">
          <button class="btn primary" id="cf-go" ${sel ? '' : 'disabled'}>Gửi lời thách đấu</button></div>
          <div class="small muted">Hai bên cùng đặt số tiền cược, người thắng nhận 90% tổng cược (10% phí trường gà). Thắng / thua đổi điểm Sư Kê. Người được mời có 30 giây để nhận lời.</div></div>`;
    } else if (tab === 'shop') {
      h += `<div class="small">Ngân lượng: <b>${fmt(d.gold)}</b></div><div class="list">${d.shop.map(s => `<div class="li"><img src="${UI.iconUrl(s.id)}" class="ic" width="32" height="32"><div class="grow"><b>${esc(s.name)}</b> <span class="small">${fmt(s.price)} 💰</span><div class="sub">${esc(s.desc)}</div></div>
          <button class="btn small" data-buy="${s.id}" data-n="1">Mua 1</button><button class="btn small" data-buy="${s.id}" data-n="${s.id === 'thoc' ? 10 : 5}">Mua ${s.id === 'thoc' ? 10 : 5}</button></div>`).join('')}</div>
        <div class="small muted">Trứng mua xong nằm trong túi đồ – Sử dụng để ấp nở. Gà nở ra có sao tư chất 1-5: càng nhiều sao lớn càng mạnh.</div>`;
    } else if (tab === 'top') {
      const t = topData;
      h += `<div class="ft-head">🏆 SƯ KÊ – GÀ CHỌI MẠNH NHẤT 🏆<div class="small">Xếp theo điểm Sư Kê (thắng / thua khi thách đấu người chơi)</div></div>`;
      h += !t ? '<p class="muted">Đang tải…</p>' : t.length ? '<div class="ft-list">' + t.map((r, i) => `<div class="ft-row ${i < 3 ? 'top' + (i + 1) : ''}"><span class="ft-rk">${['🥇', '🥈', '🥉'][i] || i + 1}</span><b class="ft-nm">${esc(r.name)}</b><span class="small">${esc(r.owner)} · ${'★'.repeat(r.stars)} cấp ${r.lv}</span><b class="ft-kg">${r.elo}</b><span class="small muted">${r.win}T ${r.loss}B</span></div>`).join('') + '</div>' : '<p class="small muted">Chưa có trận thách đấu nào.</p>';
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-cft]').forEach(b => b.onclick = () => { tab = b.dataset.cft; if (tab === 'top') emit({ op: 'top' }); UI.refreshPanel(); });
    body.querySelectorAll('[data-tac]').forEach(b => b.onclick = () => { tac = b.dataset.tac; UI.refreshPanel(); });
    body.querySelectorAll('[data-cfo]').forEach(b => b.onclick = () => {
      const op = b.dataset.cfo, id = b.dataset.id;
      if (op === 'rename') { const n = prompt('Đặt tên cho gà (tối đa 16 ký tự):'); if (n) emit({ op, id, name: n }); return; }
      if (op === 'release') return G.modal('Phóng sinh con gà này? Không lấy lại được (được ít ngân lượng theo cấp).', [{ t: 'Phóng sinh', cls: 'red', fn: () => emit({ op, id }) }, { t: 'Thôi' }]);
      emit({ op, id });
    });
    body.querySelectorAll('[data-pve]').forEach(b => b.onclick = () => emit({ op: 'pve', tier: +b.dataset.pve, tac }));
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => emit({ op: 'buy', item: b.dataset.buy, n: +b.dataset.n }));
    const go = body.querySelector('#cf-go'); if (go) go.onclick = () => emit({ op: 'challenge', name: body.querySelector('#cf-name').value.trim(), stake: +body.querySelector('#cf-stake').value || 0, tac });
    animCards(body);
  }, () => emit({ op: 'view' }));

  // gà trong thẻ thở nhẹ (khung đứng 0-5)
  let cardTimer = 0;
  function animCards(body) {
    clearInterval(cardTimer);
    const draw = () => {
      const cvs = body.querySelectorAll('.cf-cv'); if (!cvs.length || !body.isConnected) return clearInterval(cardTimer);
      const k = Math.floor(performance.now() / 260) % 6;
      cvs.forEach(cv => { const x = cv.getContext('2d'); x.clearRect(0, 0, 96, 112); x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(48, 104, 26, 5, 0, 0, Math.PI * 2); x.fill(); frame(x, cv.dataset.b, 0, k, 48, 106, 1.6); });
    };
    draw(); cardTimer = setInterval(draw, 130);
  }

  // ---------- màn xem trận ----------
  let A = null;
  function fight(d) {
    if (UI.panelName() === 'cockfight') UI.closePanel();
    const el = document.createElement('div'); el.id = 'cf-arena';
    el.innerHTML = `<div class="cfa-box"><canvas width="760" height="420"></canvas><button class="btn small cfa-skip">Bỏ qua ⏭</button><div class="cfa-res"></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('pointerdown', e => e.stopPropagation());
    const cv = el.querySelector('canvas');
    A = { d, el, cv, t0: performance.now(), hp: [d.A.st.hp, d.B.st.hp], max: [d.A.st.hp, d.B.st.hp], nums: [], step: -1, stepT: 0, shake: 0, done: false, feathers: [] };
    el.querySelector('.cfa-skip').onclick = () => { A.step = d.ev.length; A.stepT = performance.now() - 2000; A.hp = d.ev.length ? d.ev[d.ev.length - 1].h.slice() : A.hp; };
    requestAnimationFrame(loop);
    try { GameAudio.sfx('bossHorn'); } catch (e) { }
  }
  const STEP = 950, INTRO = 1300;
  function loop(now) {
    if (!A) return;
    const d = A.d, x = A.cv.getContext('2d'), W = 760, H = 420, GY = 330;
    // nhịp trận: vào trận -> từng đòn -> kết
    const t = now - A.t0;
    if (t > INTRO && A.step < d.ev.length && now - A.stepT >= STEP) { A.step++; A.stepT = now; if (A.step < d.ev.length) onEvent(d.ev[A.step], now); }
    const fin = A.step >= d.ev.length && t > INTRO;
    if (fin && !A.done && now - A.stepT > 300) { A.done = true; A.doneT = now; result(); }
    // nền: trời chiều, hàng rào tre, sân đất tròn
    const sky = x.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#f8c070'); sky.addColorStop(0.45, '#e89048'); sky.addColorStop(0.46, '#7a5a2a'); sky.addColorStop(1, '#4a3418');
    x.setTransform(1, 0, 0, 1, 0, 0);
    const sh = A.shake > now ? (Math.random() - 0.5) * 10 : 0; x.translate(sh, sh * 0.5);
    x.fillStyle = sky; x.fillRect(-10, -10, W + 20, H + 20);
    x.fillStyle = 'rgba(60,40,20,.35)'; for (let i = 0; i < 24; i++) { const hx = i * 34 + 6, hh = 40 + (i % 3) * 8; x.fillRect(hx, 150 - hh, 22, hh); x.beginPath(); x.arc(hx + 11, 150 - hh, 11, Math.PI, 0); x.fill(); }   // đám đông mờ
    x.fillStyle = '#6a8a3a'; for (let i = 0; i < W; i += 26) { x.fillRect(i, 160, 8, 40); x.fillStyle = i % 52 ? '#7a9a44' : '#5a7a30'; }   // hàng rào tre
    x.fillStyle = '#5a7a30'; x.fillRect(0, 168, W, 5); x.fillRect(0, 186, W, 5);
    const ring = x.createRadialGradient(W / 2, GY, 30, W / 2, GY, 360); ring.addColorStop(0, '#c8a060'); ring.addColorStop(1, '#8a6a38');
    x.fillStyle = ring; x.beginPath(); x.ellipse(W / 2, GY, 340, 95, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#f0e0b0'; x.lineWidth = 3; x.setLineDash([12, 10]); x.beginPath(); x.ellipse(W / 2, GY, 300, 80, 0, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
    // vị trí gà
    const home = [W / 2 - 170, W / 2 + 170], sc = 3;
    const pos = [{ x: home[0], y: GY, row: 0, col: Math.floor(now / 160) % 6, flip: false, alpha: 1 }, { x: home[1], y: GY, row: 0, col: Math.floor(now / 160 + 3) % 6, flip: true, alpha: 1 }];
    if (A.step >= 0 && A.step < d.ev.length) {
      const e = d.ev[A.step], k = (now - A.stepT) / STEP, a = e.a, b = 1 - a, dir = a === 0 ? 1 : -1;
      if (e.k === 'stunned') { pos[a].col = 0; drawStars(x, pos[a].x, GY - 150, now); }
      else {
        if (k < 0.32) { const u = k / 0.32; pos[a].row = 1; pos[a].col = Math.floor(u * 6) % 6; pos[a].x = home[a] + dir * u * 200; }
        else if (k < 0.7) { const u = (k - 0.32) / 0.38; pos[a].row = 2; pos[a].col = Math.min(5, Math.floor(u * 6)); pos[a].x = home[a] + dir * 200; pos[a].y = GY - Math.sin(u * Math.PI) * 50; }
        else { const u = (k - 0.7) / 0.3; pos[a].row = 1; pos[a].col = 5 - Math.floor(u * 5); pos[a].x = home[a] + dir * 200 * (1 - u); }
        if (k > 0.45 && k < 0.85) {
          if (e.k === 'dodge') pos[b].x = home[b] + dir * Math.sin((k - 0.45) / 0.4 * Math.PI) * 40;
          else { pos[b].row = 3; pos[b].col = 0; pos[b].x = home[b] + dir * Math.sin((k - 0.45) / 0.4 * Math.PI) * 18; }
        }
      }
    }
    if (fin) {   // kết: con thua văng ra -> rơi -> đập đất -> gục -> bất tỉnh; con thắng ưỡn ngực
      const L = 1 - d.win, Wn = d.win, u = Math.min(1, (now - A.doneT) / 1400), dir = L === 0 ? -1 : 1;
      pos[L].row = 3; pos[L].col = u < 0.15 ? 1 : u < 0.35 ? 2 : u < 0.55 ? 3 : u < 0.8 ? 4 : 5;
      pos[L].x = home[L] + dir * u * 90; pos[L].y = GY - Math.sin(Math.min(1, u / 0.55) * Math.PI) * 60;
      pos[Wn].row = 0; pos[Wn].col = 3;
      if (u >= 1) drawStars(x, pos[L].x, GY - 40, now);
    }
    for (const i of [0, 1]) {   // bóng + gà (Kim Kê có hào quang vàng)
      const p = pos[i], br = i ? d.B.breed : d.A.breed;
      x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(p.x, GY + 2, 50, 10, 0, 0, Math.PI * 2); x.fill();
      if (br === 'kim_ke') { x.save(); x.globalCompositeOperation = 'lighter'; const g = x.createRadialGradient(p.x, p.y - 90, 10, p.x, p.y - 90, 110); g.addColorStop(0, 'rgba(255,220,90,.45)'); g.addColorStop(1, 'rgba(255,200,60,0)'); x.fillStyle = g; x.fillRect(p.x - 120, p.y - 210, 240, 240); x.restore(); }
      frame(x, br, p.row, p.col, p.x, p.y, sc, p.flip);
    }
    // lông bay, số sát thương
    A.feathers = A.feathers.filter(f => now - f.t0 < 900);
    for (const f of A.feathers) { const u = (now - f.t0) / 900; x.save(); x.globalAlpha = 1 - u; x.translate(f.x + f.vx * u, f.y + f.vy * u + u * u * 60); x.rotate(u * 6 + f.r); x.fillStyle = f.c; x.fillRect(-5, -2, 10, 4); x.restore(); }
    A.nums = A.nums.filter(n => now - n.t0 < 1000);
    for (const n of A.nums) { const u = (now - n.t0) / 1000; x.save(); x.globalAlpha = 1 - u * u; x.font = `900 ${n.big ? 34 : 26}px "Be Vietnam Pro", sans-serif`; x.textAlign = 'center'; x.lineWidth = 5; x.strokeStyle = '#000'; x.fillStyle = n.c; x.strokeText(n.t, n.x, n.y - u * 50); x.fillText(n.t, n.x, n.y - u * 50); x.restore(); }
    // thanh máu + tên
    for (const i of [0, 1]) {
      const S = i ? d.B : d.A, bx = i ? W - 330 : 30, hp = A.hp[i], m = A.max[i];
      x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(bx, 18, 300, 54);
      x.font = '900 16px "Be Vietnam Pro", sans-serif'; x.textAlign = i ? 'right' : 'left'; x.fillStyle = '#fff';
      x.fillText(`${S.name} ${'★'.repeat(S.stars)}  Cấp ${S.lv}`, i ? bx + 292 : bx + 8, 38);
      x.font = '12px "Be Vietnam Pro", sans-serif'; x.fillStyle = '#e8d8b0'; x.fillText(S.owner, i ? bx + 292 : bx + 8, 52);
      x.fillStyle = '#3a0a0a'; x.fillRect(bx + 8, 58, 284, 9);
      const hg = x.createLinearGradient(bx, 0, bx + 284, 0); hg.addColorStop(0, '#ff4a3a'); hg.addColorStop(1, '#ffc040');
      x.fillStyle = hg; const wv = 284 * Math.max(0, hp / m); x.fillRect(i ? bx + 8 + 284 - wv : bx + 8, 58, wv, 9);
    }
    x.font = '900 30px Georgia, serif'; x.textAlign = 'center'; x.fillStyle = '#fff6c0'; x.strokeStyle = '#5a1a00'; x.lineWidth = 5;
    if (t < INTRO) { x.globalAlpha = Math.min(1, t / 300); x.strokeText('VÀO TRẬN!', W / 2, 130); x.fillText('VÀO TRẬN!', W / 2, 130); x.globalAlpha = 1; }
    else x.fillText('VS', W / 2, 50);
    if (!A.closed) requestAnimationFrame(loop);
  }
  function drawStars(x, cx, cy, now) { for (let i = 0; i < 4; i++) { const a = now / 300 + i * Math.PI / 2; x.fillStyle = i % 2 ? '#ffe060' : '#fff'; x.font = '18px sans-serif'; x.fillText('✦', cx + Math.cos(a) * 30, cy + Math.sin(a) * 9); } }
  function onEvent(e, now) {
    const b = 1 - e.a, W = 760, bx = b === 0 ? W / 2 - 170 : W / 2 + 170;
    setTimeout(() => {
      if (!A) return;
      A.hp = e.h.slice();
      if (e.k === 'dodge') { A.nums.push({ t: 'NÉ!', x: bx, y: 170, c: '#9ad8ff', t0: performance.now() }); try { GameAudio.sfx('whoosh'); } catch (er) { } return; }
      if (e.k === 'stunned') { A.nums.push({ t: 'CHOÁNG', x: e.a === 0 ? W / 2 - 170 : W / 2 + 170, y: 150, c: '#ffe060', t0: performance.now() }); return; }
      const crit = e.k === 'crit';
      A.nums.push({ t: (crit ? 'CHÍ MẠNG -' : '-') + e.d, x: bx, y: 170, c: crit ? '#ff4a2a' : '#fff', big: crit, t0: performance.now() });
      if (e.k === 'double') A.nums.push({ t: 'LIÊN HOÀN!', x: bx, y: 120, c: '#ffd040', t0: performance.now() });
      if (e.heal) A.nums.push({ t: '+' + e.heal, x: e.a === 0 ? W / 2 - 170 : W / 2 + 170, y: 180, c: '#4ade80', t0: performance.now() });
      if (e.stun) A.nums.push({ t: 'KIM QUANG CHẤN!', x: W / 2, y: 110, c: '#ffd040', big: true, t0: performance.now() });
      for (let i = 0; i < (crit ? 10 : 5); i++) A.feathers.push({ x: bx, y: 250, vx: (Math.random() - 0.5) * 160, vy: -40 - Math.random() * 80, r: Math.random() * 6, c: ['#8a2a14', '#f0a030', '#1a1a1a'][i % 3], t0: performance.now() });
      if (crit) A.shake = performance.now() + 280;
      try { GameAudio.sfx(crit ? 'crit' : 'hit'); } catch (er) { }
    }, STEP * 0.5);
  }
  function result() {
    const d = A.d, won = d.win === d.me, r = d.reward || {}, box = A.el.querySelector('.cfa-res');
    box.className = 'cfa-res show ' + (won ? 'win' : 'lose');
    box.innerHTML = `<div class="cfa-t">${won ? '🏆 THẮNG TRẬN!' : '💔 THUA TRẬN'}</div>
      <div>${d.pvp ? (won ? `Ôm trọn <b>${fmt(r.gold)}</b> lượng · Sư Kê +${r.elo}` : `Mất ${fmt(r.stake)} lượng cược · Sư Kê ${r.elo}`) : `+${fmt(r.gold)} lượng · +${r.exp} kinh nghiệm cho gà${r.up ? ` · lên cấp ${r.up}!` : ''}`}</div>
      <button class="btn primary cfa-close">Đóng</button>`;
    box.querySelector('.cfa-close').onclick = close;
    try { GameAudio.sfx(won ? 'enhOk' : 'enhFail'); } catch (e) { }
  }
  function close() { if (!A) return; A.closed = true; A.el.remove(); A = null; if (G.npcPanelReopen) G.npcPanelReopen(); }

  // ---------- lời thách đấu, gà nở ----------
  function invite(d) {
    G.modal(`🐓 ${d.from} thách đấu chọi gà với bạn!\nGà của họ: ${d.r.name} (${d.r.bname} ${'★'.repeat(d.r.stars)}, cấp ${d.r.lv})${d.stake ? `\nTiền cược: ${fmt(d.stake)} lượng mỗi bên – người thắng nhận ${fmt(Math.floor(d.stake * 1.8))}` : ''}\nGà của bạn đang chọn sẽ ra trận. Có 30 giây để trả lời.`,
      [{ t: '⚔️ Nhận lời', cls: 'primary', fn: () => emit({ op: 'accept' }) }, { t: 'Từ chối', fn: () => emit({ op: 'decline' }) }]);
  }
  function hatch(d) {
    const r = d.r, el = document.createElement('div'); el.className = 'cf-hatch';
    el.innerHTML = `<div class="cfh-box" style="--rc:${RC[r.rar]}"><div class="cfh-t">🐣 TRỨNG NỞ!</div><canvas width="192" height="200"></canvas><div class="cfh-n" style="color:${RC[r.rar]}">${esc(r.bname)}</div><div class="cfh-s">${'★'.repeat(r.stars)}</div><div class="small">${esc(r.skn)}: ${esc(r.skd)}</div><button class="btn primary">Tuyệt vời!</button></div>`;
    document.body.appendChild(el);
    const cv = el.querySelector('canvas'), t0 = performance.now();
    const tick = () => { if (!el.isConnected) return; const x = cv.getContext('2d'); x.clearRect(0, 0, 192, 200); frame(x, r.breed, 0, Math.floor((performance.now() - t0) / 170) % 6, 96, 190, 2.9); requestAnimationFrame(tick); };
    tick(); el.querySelector('button').onclick = () => el.remove();
  }
  // ---------- gà mổ thóc cạnh Chủ Trường Gà ----------
  function drawWorld(ctx, now) {
    if (!G.map || G.map.id !== 'tuong_duong') return;
    const n = G.map.npcs.find(x => x.id === 'chu_truong_ga'); if (!n) return;
    const bx = (n.x + 0.5) * 64, by = (n.y + 0.5) * 64;
    [['ga_dieu', -46, 20, false, 0], ['ga_o', 50, 26, true, 2]].forEach(([b, dx, dy, flip, ph]) => {
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(bx + dx, by + dy, 13, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      frame(ctx, b, 0, Math.floor(now / 220 + ph) % 6, bx + dx, by + dy, 0.62, flip);
    });
  }
  function bind(s) {
    s.on('cockfight', d => { data = d; if (UI.panelName() === 'cockfight') UI.refreshPanel(); else if (G._cfOpen) { G._cfOpen = 0; UI.openPanel('cockfight'); } });
    s.on('cfTop', d => { topData = d; if (UI.panelName() === 'cockfight') UI.refreshPanel(); });
    s.on('cfFight', fight);
    s.on('cfInvite', invite);
    s.on('cfHatch', hatch);
  }
  window.Cockfight = { bind, drawWorld, open: () => { G._cfOpen = 1; emit({ op: 'view' }); }, frame };
})();
