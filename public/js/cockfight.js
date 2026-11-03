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
  // Đấu trường: nền vẽ sẵn một lần ra canvas phụ (trời hoàng hôn, núi xa, mái đình, khán đài, rào tre, sân cát có quây chiếu),
  // mỗi khung chỉ vẽ phần động: khán giả nhún nhảy / hò reo, đèn lồng đung đưa, đuốc lửa, gà, bụi, tia va chạm, bảng máu.
  const W = 760, H = 420, GY = 330, DPR = 2, HOME = [W / 2 - 170, W / 2 + 170];
  function rng(s) { return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hx = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  function shade(c, k, to = '#2a1420') { const a = hx(c), b = hx(to); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`; }
  function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  function layer(fn) { const c = document.createElement('canvas'); c.width = W * DPR; c.height = H * DPR; const x = c.getContext('2d'); x.scale(DPR, DPR); fn(x, rng(1234)); return c; }
  let BG = null;
  function buildBg() {
    // ---- lớp sau: trời, mặt trời, mây, núi, khán đài ----
    const back = layer((x, R) => {
      const sky = x.createLinearGradient(0, 0, 0, 215);
      [[0, '#24183f'], [0.3, '#5e2e62'], [0.55, '#c25a5e'], [0.78, '#f39a58'], [1, '#ffd890']].forEach(s => sky.addColorStop(...s));
      x.fillStyle = sky; x.fillRect(0, 0, W, 215);
      for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,240,220,${0.3 + R() * 0.5})`; x.fillRect(R() * W, R() * 60, 1.2, 1.2); }   // sao sớm
      const sg = x.createRadialGradient(540, 150, 8, 540, 150, 170); sg.addColorStop(0, 'rgba(255,240,170,.9)'); sg.addColorStop(0.3, 'rgba(255,190,110,.35)'); sg.addColorStop(1, 'rgba(255,150,90,0)');
      x.fillStyle = sg; x.fillRect(300, 0, 460, 215);
      x.save(); x.beginPath(); x.arc(540, 150, 38, 0, Math.PI * 2); x.clip();
      const sd = x.createLinearGradient(0, 112, 0, 188); sd.addColorStop(0, '#fff8d0'); sd.addColorStop(1, '#ffb060'); x.fillStyle = sd; x.fillRect(500, 110, 80, 80);
      x.fillStyle = 'rgba(240,120,90,.75)'; for (let k = 0; k < 5; k++) x.fillRect(500, 152 + k * 7, 80, 1.5 + k * 0.7);   // vạch ngang kiểu điểm ảnh
      x.restore();
      for (let i = 0; i < 9; i++) {   // mây dải
        const cy = 30 + R() * 100, cx = R() * W, w = 70 + R() * 140, hh = 5 + R() * 6;
        x.fillStyle = cy < 70 ? 'rgba(150,80,130,.55)' : 'rgba(255,170,130,.5)'; rr(x, cx, cy, w, hh, hh / 2); x.fill();
        x.fillStyle = cy < 70 ? 'rgba(220,140,170,.45)' : 'rgba(255,220,170,.6)'; rr(x, cx + 8, cy - 2, w * 0.6, hh * 0.6, hh / 3); x.fill();
      }
      const ridge = (base, amp, col, step, seed) => { const r = rng(seed); x.fillStyle = col; x.beginPath(); x.moveTo(0, 215); let y = base; for (let px = 0; px <= W + step; px += step) { y = Math.max(base - amp, Math.min(base, y + (r() - 0.5) * amp * 0.6)); x.lineTo(px, y); } x.lineTo(W, 215); x.fill(); };
      ridge(150, 50, '#8a4870', 18, 3); ridge(165, 40, '#5e2e56', 14, 9);
      // chùa trên núi
      x.fillStyle = '#3e1e3c'; x.fillRect(140, 128, 10, 18); x.fillRect(132, 136, 26, 3); x.fillRect(135, 128, 20, 3); x.fillRect(138, 121, 14, 3); x.fillRect(144, 114, 2, 7);
      x.fillStyle = '#2e1830'; for (let i = 0; i < 5; i++) { const bx = 230 + i * 17 + R() * 6, by = 70 + R() * 30; x.fillRect(bx, by, 2, 1); x.fillRect(bx - 2, by - 1, 2, 1); x.fillRect(bx + 2, by - 1, 2, 1); }   // chim
      // khán đài gỗ 3 bậc
      const st = x.createLinearGradient(0, 140, 0, 215); st.addColorStop(0, '#3a2016'); st.addColorStop(1, '#22120c'); x.fillStyle = st; x.fillRect(0, 150, W, 65);
      for (const y of [152, 174, 196]) { x.fillStyle = '#7a4c2a'; x.fillRect(0, y, W, 4); x.fillStyle = '#a06a3a'; x.fillRect(0, y, W, 1); x.fillStyle = '#1a0c06'; x.fillRect(0, y + 4, W, 2); }
    });
    // ---- lớp trước: rào tre, cột đình, mái, biển hiệu, đất, sân đấu ----
    const front = layer((x, R) => {
      // nền đất
      const gd = x.createLinearGradient(0, 230, 0, H); gd.addColorStop(0, '#5e3c20'); gd.addColorStop(1, '#3e2612'); x.fillStyle = gd; x.fillRect(0, 230, W, H - 230);
      for (let i = 0; i < 1800; i++) { const v = R(); x.fillStyle = v < 0.5 ? 'rgba(30,16,6,.35)' : 'rgba(150,110,60,.3)'; x.fillRect(R() * W, 232 + R() * (H - 232), 1 + (R() < 0.2), 1); }
      // rào tre
      for (let px = -4, i = 0; px < W + 10; px += 13, i++) {
        const top = 196 + R() * 8, c = ['#8fa844', '#a6bc58', '#76902f', '#b8c46a'][i % 4], w = 10;
        x.fillStyle = shade(c, 0.35); x.fillRect(px, top, w, 250 - top);
        x.fillStyle = c; x.fillRect(px + 1, top, w - 3, 250 - top);
        x.fillStyle = 'rgba(255,255,220,.35)'; x.fillRect(px + 2, top, 2, 250 - top);
        x.fillStyle = shade(c, 0.5); x.beginPath(); x.moveTo(px, top); x.lineTo(px + w, top - 4); x.lineTo(px + w, top); x.fill();   // vát đầu
        for (let ny = top + 10 + R() * 8; ny < 246; ny += 16 + R() * 6) { x.fillStyle = shade(c, 0.45); x.fillRect(px, ny, w, 2); x.fillStyle = 'rgba(255,255,220,.3)'; x.fillRect(px, ny + 2, w, 1); }
      }
      for (const ry of [212, 234]) {   // thanh ngang + dây buộc
        x.fillStyle = '#5a6a22'; x.fillRect(0, ry, W, 7); x.fillStyle = '#9ab048'; x.fillRect(0, ry + 1, W, 3); x.fillStyle = 'rgba(255,255,210,.35)'; x.fillRect(0, ry + 1, W, 1);
        for (let px = 1; px < W; px += 13) { x.fillStyle = '#6a4220'; x.fillRect(px + 2, ry - 1, 5, 9); x.fillStyle = '#a0703a'; x.fillRect(px + 3, ry, 1, 7); x.fillRect(px + 5, ry, 1, 7); }
      }
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 248, W, 6);
      // sân đấu: quây chiếu phía sau
      const cx = W / 2, cy = GY, rx = 332, ry = 80, wallH = 22;
      x.save(); x.beginPath(); x.ellipse(cx, cy - wallH, rx, ry, 0, Math.PI, 0); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI, true); x.lineTo(cx - rx, cy - wallH); x.closePath(); x.clip();
      for (let yy = cy - ry - wallH; yy < cy + 4; yy += 4) for (let xx = cx - rx; xx < cx + rx; xx += 8) { const o = ((yy / 4) & 1) * 4; x.fillStyle = ((xx + o) / 8 & 1) ? '#c89a58' : '#a07440'; x.fillRect(xx + o, yy, 8, 4); x.fillStyle = 'rgba(60,30,10,.25)'; x.fillRect(xx + o, yy + 3, 8, 1); }
      const ws = x.createLinearGradient(0, cy - ry - wallH, 0, cy); ws.addColorStop(0, 'rgba(255,220,150,.15)'); ws.addColorStop(1, 'rgba(30,15,5,.5)'); x.fillStyle = ws; x.fillRect(cx - rx, cy - ry - wallH, rx * 2, ry + wallH);
      x.restore();
      x.strokeStyle = '#f0d090'; x.lineWidth = 2; x.beginPath(); x.ellipse(cx, cy - wallH, rx, ry, 0, Math.PI, 0); x.stroke();
      for (let k = 1; k < 12; k++) { const a = Math.PI + k / 12 * Math.PI, px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry; x.fillStyle = '#5a3418'; x.fillRect(px - 3, py - wallH - 6, 6, wallH + 6); x.fillStyle = '#8a5a30'; x.fillRect(px - 3, py - wallH - 6, 2, wallH + 6); x.fillStyle = '#c03020'; x.fillRect(px - 4, py - wallH - 9, 8, 4); }
      // mặt sân cát
      x.save(); x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.clip();
      const sand = x.createRadialGradient(cx, cy - 10, 20, cx, cy, rx); sand.addColorStop(0, '#ecd09a'); sand.addColorStop(0.6, '#cfa86a'); sand.addColorStop(1, '#9a7442');
      x.fillStyle = sand; x.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
      for (let i = 0; i < 1400; i++) { x.fillStyle = R() < 0.55 ? 'rgba(120,80,40,.3)' : 'rgba(255,245,210,.45)'; x.fillRect(cx - rx + R() * rx * 2, cy - ry + R() * ry * 2, 1, 1); }
      for (let i = 0; i < 40; i++) { const px = cx - rx + R() * rx * 2, py = cy - ry + R() * ry * 2, a = R() * Math.PI; x.strokeStyle = R() < 0.5 ? '#f0d070' : '#c8a040'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 7, py + Math.sin(a) * 3); x.stroke(); }   // rơm
      for (let i = 0; i < 14; i++) { x.strokeStyle = 'rgba(110,70,30,.25)'; x.lineWidth = 2; x.beginPath(); x.ellipse(cx - 200 + R() * 400, cy - 40 + R() * 80, 14 + R() * 20, 3, 0, R() * 3, R() * 3 + 2); x.stroke(); }   // vết cào
      x.strokeStyle = 'rgba(255,248,220,.5)'; x.lineWidth = 2; x.setLineDash([10, 8]); x.beginPath(); x.ellipse(cx, cy, 110, 28, 0, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
      x.fillStyle = 'rgba(255,248,220,.55)'; for (const hx0 of HOME) { x.fillRect(hx0 - 22, cy + 18, 44, 3); }
      const vg = x.createRadialGradient(cx, cy, rx * 0.5, cx, cy, rx); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,20,5,.35)'); x.fillStyle = vg; x.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
      x.restore();
      // quây chiếu phía trước (thấp)
      const fH = 12;
      x.save(); x.beginPath(); x.ellipse(cx, cy - fH, rx, ry, 0, 0, Math.PI); x.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); x.closePath(); x.clip();
      for (let yy = cy; yy < cy + ry + 4; yy += 4) for (let xx = cx - rx; xx < cx + rx; xx += 8) { const o = ((yy / 4) & 1) * 4; x.fillStyle = ((xx + o) / 8 & 1) ? '#d0a460' : '#a87c46'; x.fillRect(xx + o, yy, 8, 4); }
      x.restore();
      x.strokeStyle = '#f8dc9c'; x.lineWidth = 2; x.beginPath(); x.ellipse(cx, cy - fH, rx, ry, 0, 0.05, Math.PI - 0.05); x.stroke();
      x.strokeStyle = '#3a2210'; x.beginPath(); x.ellipse(cx, cy + 1, rx, ry, 0, 0, Math.PI); x.stroke();
      // cột đình sơn son hai bên + mái ngói
      for (const px of [0, W - 22]) {
        const cg = x.createLinearGradient(px, 0, px + 22, 0); cg.addColorStop(0, '#4a0e0a'); cg.addColorStop(0.35, '#a8281a'); cg.addColorStop(1, '#3a0a06');
        x.fillStyle = cg; x.fillRect(px, 30, 22, 300); x.fillStyle = '#d8a040'; x.fillRect(px, 300, 22, 5); x.fillRect(px, 60, 22, 3);
        x.fillStyle = '#5a4a40'; x.fillRect(px - 4, 325, 30, 12); x.fillStyle = '#8a7a6a'; x.fillRect(px - 4, 325, 30, 3);
      }
      x.fillStyle = '#2a1414'; x.fillRect(0, 0, W, 22);
      for (let px = -8, i = 0; px < W + 8; px += 16, i++) { const g = x.createLinearGradient(0, 4, 0, 24); g.addColorStop(0, '#7a3a2a'); g.addColorStop(1, '#3a1810'); x.fillStyle = g; x.beginPath(); x.arc(px + 8, 14, 9, 0, Math.PI); x.lineTo(px, 4); x.lineTo(px + 16, 4); x.fill(); x.fillStyle = 'rgba(255,190,140,.35)'; x.fillRect(px + 3, 15, 10, 1); }
      const bm = x.createLinearGradient(0, 22, 0, 34); bm.addColorStop(0, '#b0301e'); bm.addColorStop(1, '#5a1008'); x.fillStyle = bm; x.fillRect(0, 22, W, 12);
      x.fillStyle = '#e8b448'; x.fillRect(0, 22, W, 2); x.fillRect(0, 33, W, 1.5);
      for (let px = 40; px < W; px += 80) { x.fillStyle = '#e8b448'; x.beginPath(); x.arc(px, 28, 3, 0, Math.PI * 2); x.fill(); }
      for (const [px, s] of [[0, 1], [W, -1]]) { x.fillStyle = '#2a1414'; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + s * 60, 0); x.quadraticCurveTo(px + s * 10, 10, px, 46); x.fill(); x.strokeStyle = '#e8b448'; x.lineWidth = 2; x.beginPath(); x.moveTo(px + s * 58, 1); x.quadraticCurveTo(px + s * 12, 10, px + s * 2, 44); x.stroke(); }   // đầu đao cong
      // biển hiệu treo
      x.strokeStyle = '#3a2010'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(300, 34); x.lineTo(290, 90); x.moveTo(460, 34); x.lineTo(470, 90); x.stroke();
      const pl = x.createLinearGradient(0, 88, 0, 118); pl.addColorStop(0, '#a01c10'); pl.addColorStop(1, '#5a0c06');
      rr(x, 276, 88, 208, 30, 4); x.fillStyle = pl; x.fill(); x.strokeStyle = '#ffd36a'; x.lineWidth = 2.5; x.stroke(); rr(x, 281, 92, 198, 22, 2); x.strokeStyle = 'rgba(255,211,106,.5)'; x.lineWidth = 1; x.stroke();
      x.font = '900 17px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 4; x.strokeStyle = '#3a0602'; x.strokeText('ĐẤU TRƯỜNG GÀ', 380, 104);
      const tg = x.createLinearGradient(0, 94, 0, 112); tg.addColorStop(0, '#fff6c0'); tg.addColorStop(1, '#ffb030'); x.fillStyle = tg; x.fillText('ĐẤU TRƯỜNG GÀ', 380, 104);
      // cột đuốc
      for (const px of [52, W - 52]) { x.fillStyle = '#3a2010'; x.fillRect(px - 3, 168, 6, 160); x.fillStyle = '#6a4020'; x.fillRect(px - 3, 168, 2, 160); for (let yy = 180; yy < 210; yy += 4) { x.fillStyle = '#b08850'; x.fillRect(px - 4, yy, 8, 2); } x.fillStyle = '#4a4a50'; x.beginPath(); x.moveTo(px - 12, 160); x.lineTo(px + 12, 160); x.lineTo(px + 5, 172); x.lineTo(px - 5, 172); x.fill(); x.fillStyle = '#8a8a90'; x.fillRect(px - 12, 160, 24, 2); }
    });
    const vig = layer(x => { const g = x.createRadialGradient(W / 2, H * 0.55, 180, W / 2, H * 0.55, 520); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,6,0,.6)'); x.fillStyle = g; x.fillRect(0, 0, W, H); });
    // khán giả: 3 hàng, mỗi người có màu áo, nón lá / khăn đóng / tóc, một số cầm cờ
    const R = rng(77), crowd = [], skins = ['#f2c494', '#dcaa78', '#be8a5a', '#a8744a'], shirts = ['#a83228', '#2a5a8a', '#3a7a3a', '#c89030', '#5a3a7a', '#e8e0c8', '#4a4a52', '#b85a20', '#1e6a6a', '#8a2a5a'];
    [[154, 25, 0.82, 0.5], [176, 23, 0.92, 0.3], [198, 21, 1.02, 0.12]].forEach(([y, n, s, dk]) => {
      for (let i = 0; i < n; i++) crowd.push({ x: 30 + (i + 0.2 + R() * 0.6) * (W - 60) / n, y, s, dk, skin: shade(skins[R() * 4 | 0], dk), shirt: shade(shirts[R() * shirts.length | 0], dk), hat: R() * 4 | 0, ph: R() * 6.28, sp: 0.8 + R() * 0.6, flag: R() < 0.12 ? shade(['#e83020', '#ffd040'][R() * 2 | 0], dk) : null, side: R() < 0.5 ? 0 : 1 });
    });
    BG = { back: back, front: front, vig: vig, crowd: crowd };
  }
  function drawCrowd(x, now, hype) {
    for (const c of BG.crowd) {
      const s = c.s, ex = hype > 0, amp = ex ? 3 + hype * 4 : 0.8, bob = -Math.abs(Math.sin(now / (ex ? 110 : 420) * c.sp + c.ph)) * amp;
      const by = c.y + 4 + bob, bw = 14 * s, bh = 18 * s, hy = by - bh - 5 * s;
      x.fillStyle = c.shirt; rr(x, c.x - bw / 2, by - bh, bw, bh + 6, 4 * s); x.fill();
      x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(c.x - 1, by - bh + 3, 2, bh);
      const up = ex && (Math.sin(now / 180 + c.ph) > -0.3);
      if (up) { x.fillStyle = c.shirt; for (const sd of [-1, 1]) { const ax = c.x + sd * bw * 0.45, wv = Math.sin(now / 90 + c.ph + sd) * 2; x.fillRect(ax - 1.5 * s, hy - 10 * s + wv, 3 * s, 14 * s); x.fillStyle = c.skin; x.fillRect(ax - 2 * s, hy - 13 * s + wv, 4 * s, 4 * s); x.fillStyle = c.shirt; } }
      if (c.flag) { const fx = c.x + (c.side ? 1 : -1) * bw * 0.55, top = hy - (up ? 26 : 16) * s, wv = Math.sin(now / (ex ? 80 : 300) + c.ph) * 4; x.fillStyle = '#5a3a1a'; x.fillRect(fx - 0.7, top, 1.4, by - top - 6); x.fillStyle = c.flag; x.beginPath(); x.moveTo(fx, top); x.lineTo(fx + 12 * s, top + 3 + wv * 0.5); x.lineTo(fx, top + 8 * s); x.fill(); }
      x.fillStyle = c.skin; x.beginPath(); x.arc(c.x, hy, 5.5 * s, 0, Math.PI * 2); x.fill();
      if (c.hat === 1) { x.fillStyle = shade('#e8d8a0', c.dk); x.beginPath(); x.moveTo(c.x - 10 * s, hy - 1 * s); x.lineTo(c.x, hy - 11 * s); x.lineTo(c.x + 10 * s, hy - 1 * s); x.fill(); x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(c.x - 10 * s, hy - 1.5 * s, 20 * s, 1); }
      else if (c.hat === 2) { x.fillStyle = shade('#1a1a2a', c.dk * 0.3); x.beginPath(); x.ellipse(c.x, hy - 3.5 * s, 6.5 * s, 3.5 * s, 0, 0, Math.PI * 2); x.fill(); }
      else { x.fillStyle = shade('#1a120c', c.dk * 0.3); x.beginPath(); x.arc(c.x, hy - 1.5 * s, 5.6 * s, Math.PI * 1.05, Math.PI * 1.95); x.fill(); }
      if (c.dk < 0.2) { x.fillStyle = '#1a0c06'; x.fillRect(c.x - 2.5, hy, 1.4, 1.4); x.fillRect(c.x + 1.2, hy, 1.4, 1.4); if (ex) x.fillRect(c.x - 1, hy + 2.6, 2, 1.6); }
    }
  }
  function drawLanterns(x, now) {
    for (const [lx, len, ph] of [[96, 66, 0], [236, 52, 1.7], [524, 52, 3.1], [664, 66, 4.4]]) {
      const a = Math.sin(now / 900 + ph) * 0.08;
      x.save(); x.translate(lx, 34); x.rotate(a);
      x.strokeStyle = '#2a1408'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, len); x.stroke();
      const g = x.createRadialGradient(0, len + 14, 2, 0, len + 14, 46); g.addColorStop(0, 'rgba(255,170,80,.45)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.fillRect(-46, len - 32, 92, 92); x.globalCompositeOperation = 'source-over';
      x.fillStyle = '#2a1408'; x.fillRect(-6, len, 12, 3); x.fillRect(-6, len + 26, 12, 3);
      const lg = x.createLinearGradient(-11, 0, 11, 0); lg.addColorStop(0, '#901808'); lg.addColorStop(0.45, '#ff4a2a'); lg.addColorStop(1, '#800e04');
      x.fillStyle = lg; x.beginPath(); x.ellipse(0, len + 15, 11, 12, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(80,0,0,.5)'; for (const k of [-5, 0, 5]) { x.beginPath(); x.ellipse(0, len + 15, Math.abs(k) ? 7 : 0.5, 12, 0, 0, Math.PI * 2); x.stroke(); }
      x.fillStyle = '#ffd040'; x.fillRect(-1, len + 29, 2, 8); x.fillRect(-3, len + 35, 6, 3);
      x.restore();
    }
  }
  function drawTorch(x, px, now) {
    const f = Math.sin(now / 60 + px) * 0.5 + Math.sin(now / 37 + px * 2) * 0.5;
    x.save(); x.globalCompositeOperation = 'lighter';
    const g = x.createRadialGradient(px, 148, 4, px, 148, 120 + f * 8); g.addColorStop(0, 'rgba(255,170,60,.55)'); g.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = g; x.fillRect(px - 130, 20, 260, 260);
    for (const [col, w, h] of [['rgba(255,80,20,.9)', 11, 30], ['rgba(255,170,40,.95)', 8, 22], ['rgba(255,240,170,1)', 4, 12]]) {
      x.fillStyle = col; x.beginPath(); x.moveTo(px - w, 160); x.quadraticCurveTo(px - w * 0.9, 160 - h * 0.6, px + f * 3, 160 - h - f * 4); x.quadraticCurveTo(px + w * 0.9, 160 - h * 0.6, px + w, 160); x.fill();
    }
    for (let i = 0; i < 4; i++) { const u = ((now / 900 + i * 0.25 + px) % 1); x.fillStyle = `rgba(255,${200 - u * 100 | 0},60,${1 - u})`; x.fillRect(px + Math.sin(u * 9 + i) * 8, 150 - u * 70, 2, 2); }
    x.restore();
  }
  const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH;
  function tinted(ctx, breed, row, col, px, py, sc, flip, col2, k, alpha) {
    const im = img(breed); if (!im) return;
    const t = tmp.getContext('2d'); t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, CW, CH); t.drawImage(im, col * CW, row * CH, CW, CH, 0, 0, CW, CH);
    t.globalCompositeOperation = 'source-atop'; t.globalAlpha = k; t.fillStyle = col2; t.fillRect(0, 0, CW, CH); t.globalAlpha = 1;
    ctx.save(); ctx.translate(Math.round(px), Math.round(py)); if (flip) ctx.scale(-1, 1); if (alpha != null) ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, -FX * sc, -FY * sc, CW * sc, CH * sc); ctx.restore();
  }
  function plate(x, i, S, hp, m, lag, now, t) {
    const w = 292, h = 68, sl = (1 - Math.min(1, t / 520)) ** 3 * 330, bx = i ? W - 12 - w + sl : 12 - sl, by = 8, rc = RC[S.rar] || '#e8e0d0';
    x.save();
    x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 10; rr(x, bx, by, w, h, 10);
    const bg = x.createLinearGradient(0, by, 0, by + h); bg.addColorStop(0, 'rgba(58,28,12,.95)'); bg.addColorStop(1, 'rgba(18,8,4,.95)'); x.fillStyle = bg; x.fill(); x.shadowBlur = 0;
    const bd = x.createLinearGradient(bx, 0, bx + w, 0); bd.addColorStop(0, '#a8742a'); bd.addColorStop(0.5, '#ffe08a'); bd.addColorStop(1, '#a8742a'); x.strokeStyle = bd; x.lineWidth = 2.5; x.stroke();
    rr(x, bx + 4, by + 4, w - 8, h - 8, 7); x.strokeStyle = 'rgba(255,220,140,.18)'; x.lineWidth = 1; x.stroke();
    // khung chân dung
    const px = i ? bx + w - 64 : bx + 6, py = by + 6, ps = 56;
    rr(x, px, py, ps, ps, 8); const pg = x.createRadialGradient(px + ps / 2, py + ps / 2, 4, px + ps / 2, py + ps / 2, 40); pg.addColorStop(0, shade(rc, 0.45, '#000000')); pg.addColorStop(1, '#100804'); x.fillStyle = pg; x.fill();
    x.save(); x.clip(); const fl = !!i; frame(x, S.breed, 0, Math.floor(now / 200 + i * 3) % 6, px + ps / 2 + (fl ? 36 : -36) * 0.95, py + ps / 2 + 80, 2.4, fl); x.restore();
    rr(x, px, py, ps, ps, 8); x.strokeStyle = rc; x.lineWidth = 2.5; x.stroke();
    if (S.rar === 'legendary' || S.rar === 'epic') { x.globalAlpha = 0.5 + Math.sin(now / 250) * 0.4; x.strokeStyle = '#fff'; x.lineWidth = 1; rr(x, px - 2, py - 2, ps + 4, ps + 4, 9); x.stroke(); x.globalAlpha = 1; }
    x.fillStyle = '#1a0c04'; x.beginPath(); x.arc(i ? px + 4 : px + ps - 4, py + ps - 4, 11, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#ffd36a'; x.lineWidth = 1.5; x.stroke();
    x.font = '900 11px "Be Vietnam Pro", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffe9a8'; x.fillText(S.lv, i ? px + 4 : px + ps - 4, py + ps - 3.5);
    // chữ
    const tx = i ? px - 8 : px + ps + 8, al = i ? 'right' : 'left'; x.textAlign = al; x.textBaseline = 'alphabetic';
    x.font = '900 15px "Be Vietnam Pro", sans-serif'; x.lineWidth = 3; x.strokeStyle = '#000'; x.strokeText(S.name, tx, by + 23); x.fillStyle = '#fff'; x.fillText(S.name, tx, by + 23);
    x.font = '700 11px "Be Vietnam Pro", sans-serif'; const line2 = `${S.bname || ''}`; x.fillStyle = rc; x.fillText(line2, tx, by + 37);
    const lw = x.measureText(line2).width; x.fillStyle = '#ffd040'; x.font = '11px sans-serif'; x.fillText('★'.repeat(S.stars), i ? tx - lw - 6 : tx + lw + 6, by + 37);
    x.font = '10px "Be Vietnam Pro", sans-serif'; x.fillStyle = '#c8b088'; x.textAlign = i ? 'left' : 'right'; x.fillText('🏠 ' + S.owner, i ? bx + 12 : bx + w - 12, by + 23);
    // thanh máu
    const hw = w - 84, hx0 = i ? bx + 10 : px + ps + 8, hy0 = by + 45, hh = 13, f = Math.max(0, hp / m), lf = Math.max(0, lag / m);
    rr(x, hx0 - 1, hy0 - 1, hw + 2, hh + 2, 4); x.fillStyle = '#000'; x.fill();
    rr(x, hx0, hy0, hw, hh, 3); x.fillStyle = '#2a0606'; x.fill();
    x.save(); rr(x, hx0, hy0, hw, hh, 3); x.clip();
    const seg = (fr, fill) => { const ww = hw * fr; x.fillStyle = fill; x.fillRect(i ? hx0 + hw - ww : hx0, hy0, ww, hh); };
    seg(lf, '#fff0b8');
    const hc = f > 0.5 ? ['#2a9a3a', '#7aee6a'] : f > 0.25 ? ['#c07a10', '#ffd040'] : ['#9a1a10', '#ff5a3a'];
    const hg = x.createLinearGradient(0, hy0, 0, hy0 + hh); hg.addColorStop(0, hc[1]); hg.addColorStop(1, hc[0]); seg(f, hg);
    x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(hx0, hy0 + 1, hw, 4);
    x.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 1; k < 10; k++) x.fillRect(hx0 + hw * k / 10, hy0, 1, hh);
    if (f < 0.25 && f > 0) { x.fillStyle = `rgba(255,60,40,${0.25 + Math.sin(now / 90) * 0.2})`; x.fillRect(hx0, hy0, hw, hh); }
    x.restore();
    x.font = '800 10px "Be Vietnam Pro", sans-serif'; x.textAlign = 'center'; x.lineWidth = 3; x.strokeStyle = '#000'; const ht = `${Math.max(0, Math.round(hp))} / ${m}`; x.strokeText(ht, hx0 + hw / 2, hy0 + 10); x.fillStyle = '#fff'; x.fillText(ht, hx0 + hw / 2, hy0 + 10);
    x.restore();
  }
  function vsBadge(x, now, t, step, n) {
    const s = Math.min(1, t / 400), p = 1 + Math.sin(now / 220) * 0.05;
    x.save(); x.translate(W / 2, 54); x.scale(s * p, s * p);
    const g = x.createRadialGradient(0, 0, 6, 0, 0, 60); g.addColorStop(0, 'rgba(255,120,40,.7)'); g.addColorStop(1, 'rgba(255,60,20,0)'); x.fillStyle = g; x.fillRect(-60, -60, 120, 120);
    x.save(); x.rotate(now / 3000); x.strokeStyle = 'rgba(255,220,120,.6)'; x.lineWidth = 2; for (let k = 0; k < 8; k++) { x.rotate(Math.PI / 4); x.beginPath(); x.moveTo(26, 0); x.lineTo(34, 0); x.stroke(); } x.restore();
    x.rotate(Math.PI / 4); const dg = x.createLinearGradient(-20, -20, 20, 20); dg.addColorStop(0, '#e8402a'); dg.addColorStop(1, '#5a0a06'); x.fillStyle = dg; x.fillRect(-19, -19, 38, 38); x.strokeStyle = '#ffd36a'; x.lineWidth = 3; x.strokeRect(-19, -19, 38, 38); x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 1; x.strokeRect(-14, -14, 28, 28); x.rotate(-Math.PI / 4);
    x.font = 'italic 900 22px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 4; x.strokeStyle = '#3a0400'; x.strokeText('VS', 0, 1); const tg = x.createLinearGradient(0, -10, 0, 10); tg.addColorStop(0, '#fffbe0'); tg.addColorStop(1, '#ffb030'); x.fillStyle = tg; x.fillText('VS', 0, 1);
    x.restore();
    if (step >= 0 && step < n) { x.save(); x.font = '800 11px "Be Vietnam Pro", sans-serif'; x.textAlign = 'center'; const tx = `LƯỢT ${step + 1}`; rr(x, W / 2 - 34, 122, 68, 17, 8); x.fillStyle = 'rgba(20,8,2,.85)'; x.fill(); x.strokeStyle = '#c89040'; x.lineWidth = 1; x.stroke(); x.fillStyle = '#ffe9a8'; x.fillText(tx, W / 2, 134); x.restore(); }
  }
  function fight(d) {
    if (UI.panelName() === 'cockfight') UI.closePanel();
    if (!BG) buildBg();
    const el = document.createElement('div'); el.id = 'cf-arena';
    el.innerHTML = `<div class="cfa-box"><canvas width="${W * DPR}" height="${H * DPR}"></canvas><button class="btn small cfa-skip">Bỏ qua ⏭</button><div class="cfa-res"></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('pointerdown', e => e.stopPropagation());
    const cv = el.querySelector('canvas');
    const now0 = performance.now();
    A = { d, el, cv, t0: now0, hp: [d.A.st.hp, d.B.st.hp], max: [d.A.st.hp, d.B.st.hp], lag: [d.A.st.hp, d.B.st.hp], nums: [], step: -1, stepT: 0, shake: 0, shakeK: 6, done: false, feathers: [], dust: [], sparks: [], flash: [0, 0], cheer: now0 + 1400, cheerK: 0.6, koDust: false };
    el.querySelector('.cfa-skip').onclick = () => { A.step = d.ev.length; A.stepT = performance.now() - 2000; A.hp = d.ev.length ? d.ev[d.ev.length - 1].h.slice() : A.hp; };
    requestAnimationFrame(loop);
    try { GameAudio.sfx('bossHorn'); } catch (e) { }
  }
  const STEP = 950, INTRO = 1300;
  function puff(x0, y0, n, big) { for (let i = 0; i < n; i++) A.dust.push({ x: x0 + (Math.random() - 0.5) * 30, y: y0 - Math.random() * 4, vx: (Math.random() - 0.5) * (big ? 120 : 60), vy: -10 - Math.random() * 25, r: (big ? 8 : 5) + Math.random() * 5, t0: performance.now(), life: 500 + Math.random() * 300 }); }
  function loop(now) {
    if (!A) return;
    const d = A.d, x = A.cv.getContext('2d');
    // nhịp trận: vào trận -> từng đòn -> kết
    const t = now - A.t0;
    if (t > INTRO && A.step < d.ev.length && now - A.stepT >= STEP) { A.step++; A.stepT = now; if (A.step < d.ev.length) onEvent(d.ev[A.step], now); }
    const fin = A.step >= d.ev.length && t > INTRO;
    if (fin && !A.done && now - A.stepT > 300) { A.done = true; A.doneT = now; A.cheer = now + 2600; A.cheerK = 1; result(); }
    for (const i of [0, 1]) A.lag[i] += (A.hp[i] - A.lag[i]) * (A.lag[i] > A.hp[i] ? 0.035 : 1);
    const sh = A.shake > now ? (Math.random() - 0.5) * A.shakeK : 0;
    x.setTransform(DPR, 0, 0, DPR, sh * DPR, sh * 0.5 * DPR);
    x.imageSmoothingEnabled = true;
    // nền + khán giả + rào/sân
    x.drawImage(BG.back, -8, -6, W + 16, H + 12);
    drawCrowd(x, now, A.cheer > now ? A.cheerK : 0);
    x.drawImage(BG.front, -8, -6, W + 16, H + 12);
    drawTorch(x, 52, now); drawTorch(x, W - 52, now);
    drawLanterns(x, now);
    // vị trí gà
    const sc = 3, ease = u => 1 - (1 - u) ** 3;
    const pos = [{ x: HOME[0], y: GY, row: 0, col: Math.floor(now / 160) % 6, flip: false, ghost: 0 }, { x: HOME[1], y: GY, row: 0, col: Math.floor(now / 160 + 3) % 6, flip: true, ghost: 0 }];
    if (t < 900) for (const i of [0, 1]) { const u = t / 900; pos[i].x = HOME[i] + (i ? 1 : -1) * (1 - ease(u)) * 320; pos[i].row = 1; pos[i].col = Math.floor(now / 70) % 6; }
    if (A.step >= 0 && A.step < d.ev.length) {
      const e = d.ev[A.step], k = (now - A.stepT) / STEP, a = e.a, b = 1 - a, dir = a === 0 ? 1 : -1;
      if (e.k === 'stunned') { pos[a].col = 0; pos[a].x += Math.sin(now / 40) * 2; drawStars(x, pos[a].x, GY - 150, now); }
      else {
        if (k < 0.32) { const u = k / 0.32; pos[a].row = 1; pos[a].col = Math.floor(u * 6) % 6; pos[a].x = HOME[a] + dir * u * 200; pos[a].ghost = dir; }
        else if (k < 0.7) { const u = (k - 0.32) / 0.38; pos[a].row = 2; pos[a].col = Math.min(5, Math.floor(u * 6)); pos[a].x = HOME[a] + dir * 200; pos[a].y = GY - Math.sin(u * Math.PI) * 50; }
        else { const u = (k - 0.7) / 0.3; pos[a].row = 1; pos[a].col = 5 - Math.floor(u * 5); pos[a].x = HOME[a] + dir * 200 * (1 - u); }
        if (k > 0.45 && k < 0.85) {
          if (e.k === 'dodge') { pos[b].x = HOME[b] + dir * Math.sin((k - 0.45) / 0.4 * Math.PI) * 40; pos[b].ghost = dir * 0.6; }
          else { pos[b].row = 3; pos[b].col = 0; pos[b].x = HOME[b] + dir * Math.sin((k - 0.45) / 0.4 * Math.PI) * 18; }
        }
      }
    }
    if (fin && A.done) {   // kết: con thua văng ra -> rơi -> đập đất -> gục -> bất tỉnh; con thắng ưỡn ngực
      const L = 1 - d.win, Wn = d.win, u = Math.min(1, (now - A.doneT) / 1400), dir = L === 0 ? -1 : 1;
      pos[L].row = 3; pos[L].col = u < 0.15 ? 1 : u < 0.35 ? 2 : u < 0.55 ? 3 : u < 0.8 ? 4 : 5;
      pos[L].x = HOME[L] + dir * u * 90; pos[L].y = GY - Math.sin(Math.min(1, u / 0.55) * Math.PI) * 60;
      if (u >= 0.55 && !A.koDust) { A.koDust = true; puff(pos[L].x, GY, 14, true); A.shake = now + 220; A.shakeK = 8; }
      pos[Wn].row = 0; pos[Wn].col = 3;
      // hào quang chiến thắng
      const wu = Math.min(1, (now - A.doneT) / 600);
      x.save(); x.globalCompositeOperation = 'lighter'; x.translate(pos[Wn].x, GY - 90); x.rotate(now / 2500);
      for (let k = 0; k < 12; k++) { x.rotate(Math.PI / 6); x.fillStyle = `rgba(255,210,90,${0.16 * wu})`; x.beginPath(); x.moveTo(0, 0); x.lineTo(150, -14); x.lineTo(150, 14); x.fill(); }
      x.restore();
      if (u >= 1) drawStars(x, pos[L].x, GY - 40, now);
    }
    for (const i of [0, 1]) {   // bóng + gà (Kim Kê có hào quang vàng, trúng đòn chớp trắng)
      const p = pos[i], br = i ? d.B.breed : d.A.breed, air = GY - p.y;
      x.fillStyle = `rgba(20,8,0,${0.38 - air / 300})`; x.beginPath(); x.ellipse(p.x, GY + 2, 46 - air / 4, 9 - air / 20, 0, 0, Math.PI * 2); x.fill();
      if (br === 'kim_ke') { x.save(); x.globalCompositeOperation = 'lighter'; const g = x.createRadialGradient(p.x, p.y - 90, 10, p.x, p.y - 90, 110); g.addColorStop(0, 'rgba(255,220,90,.45)'); g.addColorStop(1, 'rgba(255,200,60,0)'); x.fillStyle = g; x.fillRect(p.x - 120, p.y - 210, 240, 240); x.restore(); }
      if (p.ghost) for (const [o, al] of [[34, 0.18], [18, 0.32]]) frame(x, br, p.row, p.col, p.x - p.ghost * o, p.y, sc, p.flip, al);
      const fl = now - A.flash[i];
      if (fl < 160) tinted(x, br, p.row, p.col, p.x, p.y, sc, p.flip, '#ffffff', 0.85 * (1 - fl / 160));
      else if (fin && i === 1 - d.win && now - A.doneT > 1400) tinted(x, br, p.row, p.col, p.x, p.y, sc, p.flip, '#302838', 0.35);
      else frame(x, br, p.row, p.col, p.x, p.y, sc, p.flip);
    }
    // bụi, tia va chạm, lông bay, số sát thương
    A.dust = A.dust.filter(p => now - p.t0 < p.life);
    for (const p of A.dust) { const u = (now - p.t0) / p.life, s = p.r * (1 + u * 1.6); x.fillStyle = `rgba(230,200,150,${0.55 * (1 - u)})`; x.beginPath(); x.arc(p.x + p.vx * u, p.y + p.vy * u, s, 0, Math.PI * 2); x.fill(); }
    A.sparks = A.sparks.filter(p => now - p.t0 < 280);
    for (const p of A.sparks) {
      const u = (now - p.t0) / 280, R1 = (p.big ? 30 : 18) + u * (p.big ? 70 : 40);
      x.save(); x.globalCompositeOperation = 'lighter'; x.translate(p.x, p.y);
      x.strokeStyle = `rgba(255,${p.big ? 120 : 230},${p.big ? 60 : 160},${1 - u})`; x.lineWidth = 3 * (1 - u) + 1;
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + p.r; x.beginPath(); x.moveTo(Math.cos(a) * R1 * 0.45, Math.sin(a) * R1 * 0.45); x.lineTo(Math.cos(a) * R1, Math.sin(a) * R1); x.stroke(); }
      x.fillStyle = `rgba(255,255,230,${0.9 * (1 - u)})`; x.beginPath(); x.arc(0, 0, (p.big ? 18 : 11) * (1 - u * 0.5), 0, Math.PI * 2); x.fill();
      x.strokeStyle = `rgba(255,255,255,${0.6 * (1 - u)})`; x.lineWidth = 2; x.beginPath(); x.ellipse(0, 0, R1 * 1.1, R1 * 0.7, 0, 0, Math.PI * 2); x.stroke();
      x.restore();
    }
    A.feathers = A.feathers.filter(f => now - f.t0 < 1100);
    for (const f of A.feathers) { const u = (now - f.t0) / 1100; x.save(); x.globalAlpha = 1 - u; x.translate(f.x + f.vx * u + Math.sin(u * 10 + f.r) * 6, f.y + f.vy * u + u * u * 90); x.rotate(Math.sin(u * 8 + f.r) * 1.2); x.fillStyle = f.c; x.beginPath(); x.ellipse(0, 0, 7, 2.4, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(-7, 0); x.lineTo(7, 0); x.stroke(); x.restore(); }
    A.nums = A.nums.filter(n => now - n.t0 < 1100);
    for (const n of A.nums) {
      const u = (now - n.t0) / 1100, pop = u < 0.12 ? 0.6 + u / 0.12 * 0.6 : 1.2 - Math.min(0.2, (u - 0.12) * 1.2);
      x.save(); x.globalAlpha = 1 - u * u; x.translate(n.x, n.y - u * 55); x.scale(pop, pop);
      x.font = `900 ${n.big ? 32 : 24}px "Be Vietnam Pro", sans-serif`; x.textAlign = 'center'; x.lineJoin = 'round'; x.lineWidth = 6; x.strokeStyle = '#1a0400'; x.strokeText(n.t, 0, 0);
      const g = x.createLinearGradient(0, -20, 0, 6); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, n.c); g.addColorStop(1, n.c); x.fillStyle = g; x.fillText(n.t, 0, 0); x.restore();
    }
    x.drawImage(BG.vig, 0, 0, W, H);
    // bảng máu, VS, lượt
    for (const i of [0, 1]) plate(x, i, i ? d.B : d.A, A.hp[i], A.max[i], A.lag[i], now, t);
    vsBadge(x, now, t, A.step, d.ev.length);
    if (t < INTRO + 200) {   // băng rôn VÀO TRẬN
      const u = t / (INTRO + 200), s = u < 0.15 ? 2.2 - u / 0.15 * 1.2 : 1, al = u > 0.8 ? (1 - u) / 0.2 : 1;
      x.save(); x.globalAlpha = al;
      const bw = Math.min(1, u / 0.12) * W; const rb = x.createLinearGradient(0, 180, 0, 230); rb.addColorStop(0, 'rgba(160,20,10,.0)'); rb.addColorStop(0.2, 'rgba(160,20,10,.85)'); rb.addColorStop(0.8, 'rgba(90,8,4,.85)'); rb.addColorStop(1, 'rgba(90,8,4,0)');
      x.fillStyle = rb; x.fillRect(W / 2 - bw / 2, 178, bw, 54); x.fillStyle = '#ffd36a'; x.fillRect(W / 2 - bw / 2, 186, bw, 1.5); x.fillRect(W / 2 - bw / 2, 223, bw, 1.5);
      x.translate(W / 2, 206); x.scale(s, s); x.font = 'italic 900 34px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 6; x.strokeStyle = '#3a0400'; x.strokeText('VÀO TRẬN!', 0, 0);
      const tg = x.createLinearGradient(0, -16, 0, 16); tg.addColorStop(0, '#fffbe0'); tg.addColorStop(1, '#ffa020'); x.fillStyle = tg; x.fillText('VÀO TRẬN!', 0, 0);
      x.restore();
    }
    if (!A.closed) requestAnimationFrame(loop);
  }
  function drawStars(x, cx, cy, now) { for (let i = 0; i < 5; i++) { const a = now / 280 + i * Math.PI * 2 / 5; x.fillStyle = i % 2 ? '#ffe060' : '#fff'; x.font = '18px sans-serif'; x.textAlign = 'center'; x.fillText('✦', cx + Math.cos(a) * 30, cy + Math.sin(a) * 9); } }
  function onEvent(e, now) {
    const b = 1 - e.a, bx = HOME[b], dir = e.a === 0 ? 1 : -1;
    if (e.k !== 'stunned') puff(HOME[e.a], GY, 4);
    setTimeout(() => {
      if (!A) return;
      const tn = performance.now();
      A.hp = e.h.slice();
      if (e.k === 'dodge') { A.nums.push({ t: 'NÉ!', x: bx, y: 180, c: '#9ad8ff', t0: tn }); puff(bx, GY, 3); try { GameAudio.sfx('whoosh'); } catch (er) { } return; }
      if (e.k === 'stunned') { A.nums.push({ t: 'CHOÁNG', x: HOME[e.a], y: 160, c: '#ffe060', t0: tn }); return; }
      const crit = e.k === 'crit';
      A.nums.push({ t: (crit ? 'CHÍ MẠNG -' : '-') + e.d, x: bx, y: 180, c: crit ? '#ff4a2a' : '#ffe8c0', big: crit, t0: tn });
      if (e.k === 'double') A.nums.push({ t: 'LIÊN HOÀN!', x: bx, y: 130, c: '#ffd040', t0: tn });
      if (e.heal) A.nums.push({ t: '+' + e.heal, x: HOME[e.a], y: 190, c: '#4ade80', t0: tn });
      if (e.stun) A.nums.push({ t: 'KIM QUANG CHẤN!', x: W / 2, y: 160, c: '#ffd040', big: true, t0: tn });
      A.flash[b] = tn; A.sparks.push({ x: bx - dir * 30, y: GY - 80, t0: tn, big: crit, r: Math.random() * 6 });
      const fc = (e.a ? A.d.A : A.d.B).breed, pal = { ga_chuoi: ['#c89838', '#ecc860'], ga_xam: ['#7a7a86', '#a8a8b4'], ga_o: ['#16161e', '#3a3a5a'], ga_nhan: ['#e8e2d8', '#ffffff'], ga_tia: ['#8a2060', '#e04a7a'], hac_phuong: ['#22222e', '#c82020'], kim_ke: ['#f0c030', '#ffb030'] }[fc] || ['#8a2a14', '#f0a030'];
      for (let i = 0; i < (crit ? 14 : 6); i++) A.feathers.push({ x: bx, y: GY - 80, vx: (Math.random() - 0.5) * 200 + dir * 60, vy: -40 - Math.random() * 90, r: Math.random() * 6, c: [pal[0], pal[1], '#1a1a1a'][i % 3], t0: tn });
      if (crit) { A.shake = tn + 300; A.shakeK = 10; A.cheer = tn + 1100; A.cheerK = 1; } else if (Math.random() < 0.5) { A.cheer = tn + 600; A.cheerK = 0.45; }
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
