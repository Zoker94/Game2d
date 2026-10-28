// Đại Hội Võ Lâm phía người chơi: bảng NPC (vào / rời, luật, phần thưởng), bảng điểm khi ở lôi đài,
// sàn lôi đài + cờ, điểm bay lên khi ghi điểm.
(function () {
  const $ = id => document.getElementById(id);
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  let st = null, skew = 0, npc = null;
  const inMap = () => G.map && G.map.id === 'dai_hoi';

  // ---------- bảng NPC ----------
  function open(d) { npc = d; UI.openPanel('daihoi'); }
  UI.registerPanel('daihoi', '⚔️ Đại Hội Võ Lâm', body => {
    const d = (npc && npc.daihoi) || {};
    const mc = d.mc;
    const left = d.until ? Math.max(0, Math.round((d.until - Date.now()) / 60000)) : 0;
    let html = `<div class="dh-hero"><div class="dh-emb">⚔️</div><div class="grow"><h3>Đại Hội Võ Lâm</h3>
      <div class="small">"${UI.esc((npc && npc.talk) || '')}"</div>
      <div class="dh-state ${d.active ? 'on' : ''}">${d.active ? `🔥 ĐANG DIỄN RA · còn ${left} phút` : '⏳ Khai mạc 20:30 Chủ Nhật hằng tuần (30 phút)'}</div></div></div>`;
    html += `<div class="dh-mc">👑 Võ Lâm Minh Chủ: ${mc ? `<b>${UI.esc(mc.name)}</b> <span class="small muted">(${fmt(mc.pts)} điểm · còn ${Math.max(1, Math.ceil((mc.until - Date.now()) / 86400000))} ngày)</span>` : '<span class="muted">Chưa có – hãy là người đầu tiên!</span>'}</div>`;
    html += d.inMap ? `<button class="btn" id="dh-leave">🏯 Rời Đại Hội về Tương Dương</button>`
      : `<button class="btn primary big" id="dh-enter" ${G.me.level < d.minLv ? 'disabled' : ''}>⚔️ Vào lôi đài Đại Hội</button>${G.me.level < d.minLv ? `<div class="warn small">Cần cấp ${d.minLv}</div>` : ''}`;
    html += `<div class="card"><h4>📜 Luật thi đấu</h4>
      <div class="small">• Trong giờ Đại Hội, lôi đài là vùng <b>hỗn chiến tự do</b> (trừ người cùng bang). Ngoài giờ là nơi an toàn để tụ họp.</div>
      <div class="small">• Hạ người chơi: <b>+3 điểm</b>, cộng thêm tới +6 nếu chặn được chuỗi liên trảm của đối thủ.</div>
      <div class="small">• Hạ <b>Đại Hội Hộ Pháp</b>: +1 điểm. Giữa trận, <b>Thiên Hạ Đệ Nhất Cao Thủ</b> xuất hiện giữa lôi đài: kẻ hạ hắn +20 điểm.</div>
      <div class="small">• Tử trận không mất kinh nghiệm, có thể hồi sinh tại chỗ hoặc về thành rồi vào lại.</div></div>
      <div class="card"><h4>🎁 Phần thưởng</h4>
      <div class="small">🥇 Hạng 1: <b>Danh hiệu Võ Lâm Minh Chủ 7 ngày</b> + 200 💎 + 50.000 💰 + 3 Rương Thủ Lĩnh</div>
      <div class="small">🥈 Hạng 2: 120 💎 + 30.000 💰 + 2 Rương Thủ Lĩnh · 🥉 Hạng 3: 80 💎 + 20.000 💰 + 1 Rương Thủ Lĩnh</div>
      <div class="small">Hạng 4-10: 30 💎 + 10.000 💰 + 2 Rương Bí Ẩn · Có điểm: 3.000 💰 + 1 Rương Bí Ẩn</div></div>`;
    body.innerHTML = html;
    const en = $('dh-enter'); if (en) en.onclick = () => { emit('daihoi', { op: 'enter' }); UI.closePanel(); };
    const lv = $('dh-leave'); if (lv) lv.onclick = () => { emit('daihoi', { op: 'leave' }); UI.closePanel(); };
  });

  // ---------- bảng điểm trên màn hình ----------
  function hud() {
    let h = $('dh-hud');
    if (!inMap() || !st) { if (h) h.remove(); return; }
    if (!h) { h = document.createElement('div'); h.id = 'dh-hud'; $('screen-game').appendChild(h); }
    let html;
    if (st.active) {
      const left = Math.max(0, Math.round((st.until - (Date.now() + skew)) / 1000));
      const me = st.me || {};
      html = `<div class="dh-h">⚔️ Đại Hội Võ Lâm <span>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span></div>
        <div class="dh-top">${(st.top || []).map(([n, p, s], i) => `<div class="${n === G.me.name ? 'me' : ''}"><i>${['🥇', '🥈', '🥉', '4', '5'][i]}</i><b>${UI.esc(n)}</b>${s >= 3 ? `<em>🔥${s}</em>` : ''}<span>${p}</span></div>`).join('') || '<div class="muted">Chưa ai ghi điểm</div>'}</div>
        <div class="dh-me">Bạn: <b>${me.pts || 0}</b> điểm${me.rank ? ` · hạng ${me.rank}/${st.n}` : ''} · ${me.kills || 0} hạ${me.streak >= 2 ? ` · 🔥${me.streak} liên trảm` : ''}</div>
        ${st.boss ? '<div class="dh-boss">👹 Thiên Hạ Đệ Nhất Cao Thủ đang ở giữa lôi đài!</div>' : ''}`;
    } else if (st.final) {
      html = `<div class="dh-h">🏆 Kết quả Đại Hội</div><div class="dh-top">${st.final.map(([n, p], i) => `<div><i>${i + 1}</i><b>${UI.esc(n)}</b><span>${p}</span></div>`).join('') || '<div class="muted">Không ai ghi điểm</div>'}</div>
        <div class="dh-me">👑 Minh Chủ: <b>${UI.esc(st.mc || '—')}</b></div>`;
    } else {
      html = `<div class="dh-h">🏯 Đại Hội Võ Lâm</div><div class="dh-me">Khai mạc 20:30 Chủ Nhật hằng tuần.<br>👑 Minh Chủ: <b>${UI.esc(st.mc || 'chưa có')}</b></div>`;
    }
    if (h._h !== html) { h.innerHTML = html; h._h = html; }
  }
  setInterval(hud, 500);

  // ---------- sàn lôi đài, cờ, biểu ngữ ----------
  function drawGround(ctx, now) {
    if (!inMap()) return;
    const cx = (G.map.w / 2 | 0) * 64 + 32, cy = (G.map.h / 2 | 0) * 64 + 32;
    const R = 5.2 * 64, active = st && st.active;
    ctx.save();
    // bục đá bát giác nhiều tầng
    const oct = (r, fill, stroke, lw) => {
      ctx.beginPath();
      for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.78; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 3; ctx.stroke(); }
    };
    oct(R + 18, 'rgba(60,40,30,.55)', 'rgba(20,10,6,.8)', 4);
    oct(R, 'rgba(150,40,30,.42)', active ? 'rgba(255,200,80,.95)' : 'rgba(220,170,80,.7)', 4);
    oct(R * 0.62, null, 'rgba(255,220,140,.35)', 2);
    // chữ 武 giữa sàn
    ctx.font = 'bold 120px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = active ? `rgba(255,210,120,${0.22 + Math.sin(now / 400) * 0.06})` : 'rgba(255,210,120,.14)';
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.78); ctx.fillText('武', 0, 0); ctx.restore();
    // 8 cột cờ
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 8 + k * Math.PI / 4, x = cx + Math.cos(a) * (R + 10), y = cy + Math.sin(a) * (R + 10) * 0.78;
      ctx.fillStyle = '#3a2414'; ctx.fillRect(x - 2, y - 70, 4, 70);
      ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.arc(x, y - 71, 3, 0, Math.PI * 2); ctx.fill();
      const wv = Math.sin(now / 260 + k) * 4, col = ['#c02020', '#e0a020', '#2060c0', '#20a050'][k % 4];
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + 2, y - 68); ctx.quadraticCurveTo(x + 16, y - 66 + wv, x + 30, y - 64 + wv * 1.4); ctx.lineTo(x + 30, y - 44 + wv * 1.4); ctx.quadraticCurveTo(x + 16, y - 46 + wv, x + 2, y - 48); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,.9)'; ctx.font = 'bold 12px serif'; ctx.fillText('武', x + 15, y - 56 + wv);
    }
    ctx.restore();
  }

  // ---------- sự kiện từ server ----------
  function onState(d) { st = d; if (d.now) skew = d.now - Date.now(); hud(); }
  function onFlags(d) {
    if (!G.map || G.map.id !== d.id) return;
    G.map.safe = d.safe; G.map.pvp = d.pvp;
    const sp = document.querySelector('#map-name span');
    if (sp) { sp.className = d.pvp ? 'pvp' : d.safe ? 'safe' : 'muted'; sp.textContent = d.pvp ? '[PK]' : d.safe ? '[An toàn]' : ''; }
    UI.toast(d.pvp ? '⚔️ Lôi đài mở – hỗn chiến bắt đầu!' : '🏯 Lôi đài đã đóng, trở lại an toàn', d.pvp ? 'error' : 'info');
  }
  function onPts(d) {
    Overhead.add(G.self.x, G.self.y - 92, `+${d.n} điểm`, 'status', '#ffd84a');
    GameAudio.sfx('coin', 0);
  }
  window.DaiHoi = { open, drawGround, onState, onFlags, onPts };
})();
