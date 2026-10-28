// Thách đấu (tỷ võ 1-1) phía người chơi: lời mời, đếm ngược, thanh trạng thái + nút xin thua,
// vòng đấu vẽ trên mặt đất (cả người xem cũng thấy), bảng kết quả.
(function () {
  const $ = id => document.getElementById(id);
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const rings = new Map();   // "a|b" -> vòng đấu trên bản đồ hiện tại
  let st = null, skew = 0, reqTimer = null;

  function request(e) { emit('duel', { op: 'request', id: e.id }); }

  function onReq(d) {
    if (Social.blocked(d.name)) return emit('duel', { op: 'decline' });
    G.modal(`⚔️ ${d.name} (${d.cls} · Cấp ${d.level} · Lực chiến ${Number(d.power || 0).toLocaleString('vi-VN')}) muốn thách đấu với bạn!\nTỷ võ không mất kinh nghiệm, không tăng sát khí. Cạn máu hoặc bước ra khỏi vòng là thua.`, [
      { t: '⚔️ Nhận lời', cls: 'primary', fn: () => { clearTimeout(reqTimer); emit('duel', { op: 'accept' }); } },
      { t: 'Từ chối', fn: () => { clearTimeout(reqTimer); emit('duel', { op: 'decline' }); } }]);
    clearTimeout(reqTimer);
    reqTimer = setTimeout(() => { if ($('modal-text').textContent.startsWith('⚔️ ' + d.name)) $('modal-msg').classList.add('hidden'); }, d.ttl || 20000);
    G.sfx && G.sfx('rare');
  }

  function hud() {
    let h = $('duel-hud');
    if (!st) { if (h) h.remove(); return; }
    if (!h) {
      h = document.createElement('div'); h.id = 'duel-hud';
      h.innerHTML = '<div class="dh-t"></div><div class="dh-time"></div><button class="btn small red" id="duel-giveup">🏳 Xin thua</button>';
      $('screen-game').appendChild(h);
      $('duel-giveup').onclick = e => { e.stopPropagation(); G.modal('Xin thua trận tỷ võ này?', [{ t: '🏳 Xin thua', cls: 'primary', fn: () => emit('duel', { op: 'surrender' }) }, { t: 'Đánh tiếp' }]); };
    }
    const now = Date.now() + skew;
    const left = Math.max(0, Math.ceil((st.until - now) / 1000));
    const t = `⚔️ Tỷ võ với <b>${UI.esc(st.name)}</b>`;
    const tm = st.st === 'count' ? 'Chuẩn bị...' : `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const q = h.querySelector('.dh-t'); if (q.innerHTML !== t) q.innerHTML = t;
    const w = h.querySelector('.dh-time'); if (w.textContent !== tm) w.textContent = tm;
    h.classList.toggle('warn', st.st === 'fight' && left <= 15);
    // cảnh báo sắp ra khỏi vòng
    const s = G.self, d = Math.hypot(s.x - st.cx, (s.y - st.cy) / (st.ry || 1));
    h.classList.toggle('edge', d > st.r * 0.82);
  }
  // chữ lớn giữa màn hình: 3, 2, 1, Giao đấu! / Thắng / Thua
  function banner(text, cls, ms) {
    let b = $('duel-banner');
    if (!b) { b = document.createElement('div'); b.id = 'duel-banner'; $('screen-game').appendChild(b); }
    b.className = cls || ''; b.innerHTML = text;
    void b.offsetWidth; b.classList.add('show');
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), ms || 900);
  }
  let lastCount = 0;
  setInterval(() => {
    if (!st) return;
    hud();
    if (st.st === 'count') {
      const n = Math.ceil((st.at - (Date.now() + skew)) / 1000);
      if (n > 0 && n !== lastCount) { lastCount = n; banner(String(n), 'count', 800); G.sfx && G.sfx('click'); }
    }
  }, 100);

  function onDuel(d) {
    if (d.st === 'end') {
      st = null; hud();
      const title = d.res === 'win' ? '🏆 CHIẾN THẮNG' : d.res === 'lose' ? '💢 THẤT BẠI' : '🤝 HÒA';
      banner(`${title}<small>${UI.esc(d.reason || '')}</small><small>Thành tích tỷ võ: ${d.win} thắng · ${d.lose} thua</small>`, d.res, 3200);
      G.sfx && G.sfx(d.res === 'win' ? 'level' : 'hurt');
      if (G.target === (G._duelWith || null)) G.target = null;
      G._duelWith = null;
      return;
    }
    skew = d.now - Date.now();
    const was = st && st.st;
    st = d;
    G._duelWith = d.with;
    if (d.st === 'count' && was !== 'count') { lastCount = 0; G.target = d.with; }
    if (d.st === 'fight' && was !== 'fight') { banner('⚔️ GIAO ĐẤU!', 'go', 1000); G.target = d.with; G.sfx && G.sfx('crit'); }
    hud();
  }
  function onRing(r) {
    const k = r.a + '|' + r.b;
    if (r.on) rings.set(k, r); else rings.delete(k);
  }

  // vòng đấu dưới chân (vẽ trong toạ độ thế giới, trước nhân vật)
  function draw(ctx, now) {
    if (!rings.size) return;
    for (const r of rings.values()) {
      ctx.save();
      ctx.translate(r.cx, r.cy); ctx.scale(1, 0.62);
      const mine = st && (r.a === G._duelWith || r.b === G._duelWith);
      const g = ctx.createRadialGradient(0, 0, r.r * 0.7, 0, 0, r.r);
      g.addColorStop(0, 'rgba(255,80,40,0)'); g.addColorStop(1, mine ? 'rgba(255,80,40,.22)' : 'rgba(255,180,60,.14)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r.r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = mine ? 'rgba(255,90,50,.9)' : 'rgba(255,190,80,.7)';
      ctx.setLineDash([18, 10]); ctx.lineDashOffset = -now / 40;
      ctx.beginPath(); ctx.arc(0, 0, r.r, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // 4 cột cờ quanh vòng
      ctx.restore();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4, x = r.cx + Math.cos(a) * r.r, y = r.cy + Math.sin(a) * r.r * 0.62;
        ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 1.5, y - 34, 3, 34);
        const wv = Math.sin(now / 200 + i) * 3;
        ctx.fillStyle = mine ? '#e83a2a' : '#e8a02a';
        ctx.beginPath(); ctx.moveTo(x + 1.5, y - 34); ctx.lineTo(x + 18, y - 30 + wv); ctx.lineTo(x + 1.5, y - 24); ctx.closePath(); ctx.fill();
      }
    }
  }
  // người đang đấu với mình: đánh được kể cả trong thành
  function isFoe(e) { return !!(st && st.st === 'fight' && e && e.id === st.with); }
  function fighting() { return !!(st && st.st === 'fight'); }
  function clearRings() { rings.clear(); }

  window.Duel = { request, onReq, onDuel, onRing, draw, isFoe, fighting, clearRings, get active() { return !!st; }, get state() { return st; } };
})();
