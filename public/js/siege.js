// Công Thành Chiến phía người chơi: bảng Thành Quan (báo danh / vào trận / bang giữ thành), bảng tình hình khi ở Lâm An Thành,
// Long Ấn (trụ ngọc rồng vàng giữa nội thành), nội thành lát đá có cờ, thông báo chiếm Long Ấn.
(function () {
  const $ = id => document.getElementById(id);
  const emit = d => G.socket && G.socket.emit('siege', d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const MAP = 'cong_thanh';
  let st = null, npc = null, skew = 0;
  const inMap = () => G.map && G.map.id === MAP;
  const left = t => { const s = Math.max(0, Math.round((t - (Date.now() + skew)) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const dur = ms => { const m = Math.round(ms / 60000), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60); return d ? `${d} ngày ${h} giờ` : h ? `${h} giờ ${m % 60} phút` : `${m} phút`; };

  // ---------- bảng NPC ----------
  function open(d) { npc = d; UI.openPanel('siege'); }
  function onNpc(h) { if (npc) { npc.siege = h; UI.openPanel('siege'); } }
  UI.registerPanel('siege', '🏯 Công Thành Chiến', body => {
    const d = (npc && npc.siege) || {}, g = d.myGuild, own = d.owner;
    let html = `<div class="dh-hero ct-hero"><div class="dh-emb">🏯</div><div class="grow"><h3>Lâm An Thành</h3>
      <div class="small">"${UI.esc((npc && npc.talk) || '')}"</div>
      <div class="dh-state ${d.active ? 'on' : ''}">${d.active ? `🔥 ĐANG CÔNG THÀNH · còn ${left(d.until)}` : `⏳ Thứ 6 hằng tuần 20:30 · còn ${dur(d.startIn || 0)}`}</div></div></div>`;
    html += `<div class="card ct-own"><h4>👑 Chủ thành hiện tại</h4>${own ? `<div class="ct-own-n">🏯 ${UI.esc(own.name)}${own.mine ? ' <span class="ok-t small">(bang bạn)</span>' : ''}</div>
      <div class="small muted">Giữ thành thêm ${dur(own.until - Date.now())} · đã thu ${fmt(own.tax)} lượng thuế vào quỹ bang</div>` : '<div class="small muted">Thành đang vô chủ – bang nào giữ được Long Ấn tới hết giờ sẽ làm chủ!</div>'}</div>`;
    html += '<div class="row" style="gap:6px;flex-wrap:wrap;margin:6px 0">';
    if (!g) html += '<span class="warn small">Bạn cần gia nhập bang hội để tham gia Công Thành Chiến.</span>';
    else if (d.active) html += g.inBattle ? `<button class="btn primary big" data-ct="join" ${G.me.level < d.minLv ? 'disabled' : ''}>⚔️ Vào Lâm An Thành</button>` : '<span class="warn small">Bang bạn không có tên trong trận này.</span>';
    else if (g.registered) html += `<span class="ok-t small">✅ Bang ${UI.esc(g.name)} đã có tên trong trận Công Thành tuần này${own && own.mine ? ' (thủ thành)' : ''}.</span>`;
    else if (g.role === 'leader' || g.role === 'elder') html += `<button class="btn primary" data-ct="reg" ${g.fund < d.fee ? 'disabled' : ''}>📜 Báo danh cho bang (${fmt(d.fee)} quỹ bang)</button><span class="small muted">Quỹ bang: ${fmt(g.fund)}</span>`;
    else html += '<span class="small muted">Chỉ Bang chủ / Trưởng lão báo danh được.</span>';
    html += `</div>${g && G.me.level < d.minLv ? `<div class="warn small">Cần cấp ${d.minLv} để vào trận</div>` : ''}`;
    html += `<div class="card"><h4>📜 Bang đã báo danh (${(d.reg || []).length})</h4><div class="small">${(d.reg || []).map(r => `<span class="ct-chip ${r.mine ? 'me' : ''}">${UI.esc(r.name)}</span>`).join(' ') || '<span class="muted">Chưa có bang nào</span>'}</div></div>`;
    html += `<div class="card"><h4>⚔️ Luật công thành</h4>
      <div class="small">• Thứ 6 20:30 – 21:00. Bang chủ / Trưởng lão báo danh trước giờ khai chiến. Bang đang giữ thành tự động thủ thành.</div>
      <div class="small">• Thành viên cấp ${d.minLv}+ của bang tham chiến vào trận qua Thành Quan. Khác bang đánh nhau tự do, cùng bang không đánh nhau.</div>
      <div class="small">• Giữa nội thành có <b style="color:#ffd040">Long Ấn</b>: bang nào phá được thì chiếm Long Ấn (Long Ấn hồi đầy máu, có khiên 8 giây). Long Ấn bắn sét kẻ địch đứng gần.</div>
      <div class="small">• Bang giữ Long Ấn hồi sinh trong nội thành, bang khác hồi sinh ở ngoại thành. Tử trận không mất kinh nghiệm.</div>
      <div class="small">• Hết giờ, bang đang giữ Long Ấn làm <b>chủ thành 7 ngày</b>: +10% kinh nghiệm cho cả bang, 30% thuế chợ & giao dịch toàn máy chủ vào quỹ bang, huy hiệu 🏯 cạnh tên bang.</div></div>
      <div class="card"><h4>🎁 Phần thưởng</h4><div class="small">Bang chiếm thành: mỗi người 100.000 lượng, 20 Nguyên Bảo, 2 Rương Thủ Lĩnh, 2 Thiên Tinh Thạch (Bang chủ thêm 100 Nguyên Bảo), quỹ bang +300.000.<br>Bang khác tham chiến: 20.000 lượng, Rương Bí Ẩn, 5 Huyền Tinh Thạch.</div></div>`;
    if (d.last) html += `<div class="card"><h4>🏆 Trận gần nhất</h4><div class="small">${d.last.win ? `Bang <b>${UI.esc(d.last.win)}</b> chiếm thành` : 'Không bang nào giữ được thành'}${(d.last.top || []).length ? ' · ' + d.last.top.map(t => `${UI.esc(t.name)} (giữ ${Math.round(t.hold / 60)}′, ${t.kills} hạ)`).join(' · ') : ''}</div></div>`;
    body.innerHTML = html;
    body.querySelectorAll('[data-ct]').forEach(b => b.onclick = () => { emit({ op: b.dataset.ct }); if (b.dataset.ct === 'join') UI.closePanel(); });
  });

  // ---------- bảng tình hình trong trận ----------
  function hud() {
    let h = $('ct-hud');
    if (!inMap() || !st) { if (h) h.remove(); return; }
    if (!h) {
      h = document.createElement('div'); h.id = 'ct-hud'; h.className = 'ct-hud'; $('screen-game').appendChild(h);
      h.addEventListener('pointerdown', e => e.stopPropagation());
      h.addEventListener('click', e => { const t = e.target.closest('[data-cth]'); if (!t) return; if (t.dataset.cth === 'leave') G.modal('Rời Lâm An Thành về Tương Dương?', [{ t: 'Rời', cls: 'red', fn: () => emit({ op: 'leave' }) }, { t: 'Ở lại' }]); else h.classList.toggle('min'); });
      if (Input.isTouch) h.classList.add('min');
    }
    let html;
    if (st.active) {
      const s = st.seal, pct = s ? Math.max(0, s.hp / s.max * 100) : 0, me = st.me || {};
      html = `<div class="tk-h"><span>🏯 Công Thành</span><b>${left(st.until)}</b><button class="hs-x" data-cth="min">▾</button></div>
        <div class="ct-holder ${st.mine ? 'me' : ''}">🐉 Long Ấn: ${st.holder ? `<b>${UI.esc(st.holder)}</b>${st.mine ? ' (bang bạn – trấn thủ!)' : ''}` : '<span class="muted">vô chủ</span>'}</div>
        <div class="ct-bar ${s && s.sh ? 'sh' : ''}"><i style="width:${pct.toFixed(1)}%"></i><span>${s && s.sh ? '🛡️ Khiên ' + Math.ceil(s.sh / 1000) + 's' : fmt(s && s.hp) + ' / ' + fmt(s && s.max)}</span></div>
        <div class="ct-gl">${(st.guilds || []).map(g => `<div class="${g.me ? 'me' : ''}"><span>${UI.esc(g.name)}</span><i>👥${g.n}</i><i>⚔️${g.kills}</i><i>⏱${Math.floor(g.hold / 60)}′${String(g.hold % 60).padStart(2, '0')}</i></div>`).join('')}</div>
        <div class="tk-me">Bạn: ${me.kills || 0} hạ / ${me.deaths || 0} chết · ${fmt(me.dmg)} sát thương Long Ấn${me.caps ? ` · 🐉 x${me.caps}` : ''}</div>
        <div class="hs-btns"><button class="btn small" data-cth="leave">🏯 Rời thành</button></div>`;
    } else if (st.final) {
      html = `<div class="tk-h"><span>🏆 Kết quả Công Thành</span><button class="hs-x" data-cth="min">▾</button></div>
        <div class="tk-me">${st.win ? `Bang <b style="color:#ffd040">${UI.esc(st.win)}</b> làm chủ Lâm An Thành!` : 'Thành vẫn vô chủ.'}</div>
        <div class="hs-btns"><button class="btn small" data-cth="leave">🏯 Về Tương Dương</button></div>`;
    } else html = `<div class="tk-h"><span>🏯 Lâm An Thành</span><button class="hs-x" data-cth="min">▾</button></div><div class="tk-me muted">Công Thành Chiến: Thứ 6 20:30.</div><div class="hs-btns"><button class="btn small" data-cth="leave">🏯 Về Tương Dương</button></div>`;
    if (h._h !== html) { h.innerHTML = html; h._h = html; }
  }
  setInterval(hud, 500);

  // ---------- nội thành & Long Ấn ----------
  const K = { x0: 18, y0: 12, x1: 38, y1: 32 };
  function drawGround(ctx, now) {
    if (!inMap()) return;
    ctx.save();
    ctx.fillStyle = 'rgba(255,200,80,.06)';
    ctx.fillRect((K.x0 + 1) * 64, (K.y0 + 1) * 64, (K.x1 - K.x0 - 1) * 64, (K.y1 - K.y0 - 1) * 64);
    const cx = (G.map.w >> 1) * 64 + 32, cy = (G.map.h >> 1) * 64 + 32;   // vòng trận pháp quanh Long Ấn
    ctx.translate(cx, cy); ctx.scale(1, 0.5);
    ctx.strokeStyle = 'rgba(255,210,90,.45)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, BOLT_R, 0, Math.PI * 2); ctx.stroke();
    ctx.rotate(now / 4000); ctx.setLineDash([18, 14]); ctx.strokeStyle = 'rgba(255,170,40,.35)';
    ctx.beginPath(); ctx.arc(0, 0, BOLT_R - 22, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  const BOLT_R = 260;
  // Long Ấn: bệ đá, trụ ngọc, ấn vàng hình rồng cuộn trên đỉnh, phát sáng (đổi màu khi có khiên)
  function drawSeal(ctx, e, now) {
    const sh = st && st.seal && st.seal.sh > 0, hit = e.hitAt && now - e.hitAt < 120;
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y));
    const glow = ctx.createRadialGradient(0, -70, 6, 0, -70, 90);
    glow.addColorStop(0, sh ? 'rgba(120,200,255,.55)' : `rgba(255,210,90,${0.4 + Math.sin(now / 300) * 0.1})`); glow.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -70, 90, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 2, 44, 12, 0, 0, Math.PI * 2); ctx.fill();
    // bệ đá 2 tầng
    ctx.fillStyle = '#6a645a'; ctx.fillRect(-40, -14, 80, 16); ctx.fillStyle = '#8a8274'; ctx.fillRect(-40, -16, 80, 4);
    ctx.fillStyle = '#5a554c'; ctx.fillRect(-30, -28, 60, 14); ctx.fillStyle = '#7a7366'; ctx.fillRect(-30, -30, 60, 4);
    // trụ ngọc
    const g = ctx.createLinearGradient(-12, 0, 12, 0); g.addColorStop(0, '#2a6a4a'); g.addColorStop(0.5, '#6ad8a0'); g.addColorStop(1, '#1e5038');
    ctx.fillStyle = g; ctx.fillRect(-12, -96, 24, 68);
    ctx.strokeStyle = '#d8a030'; ctx.lineWidth = 3; for (const y of [-92, -60, -34]) { ctx.beginPath(); ctx.moveTo(-13, y); ctx.lineTo(13, y); ctx.stroke(); }
    // ấn vàng trên đỉnh
    const bob = Math.sin(now / 500) * 3;
    ctx.translate(0, -118 + bob);
    ctx.fillStyle = hit ? '#fff4c0' : '#e0a628'; ctx.strokeStyle = '#7a4a08'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(-20, -6, 40, 26); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hit ? '#fff' : '#ffd860';
    ctx.beginPath(); ctx.moveTo(-16, -6); ctx.quadraticCurveTo(-18, -26, 0, -28); ctx.quadraticCurveTo(18, -26, 16, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a0320c'; ctx.font = 'bold 16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('龍', 0, 8);
    if (sh) { ctx.strokeStyle = `rgba(140,210,255,${0.6 + Math.sin(now / 120) * 0.3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    // tên + bang giữ
    const holder = st && st.active ? st.holder : null;
    ctx.save(); ctx.font = '800 12px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
    const t1 = '🐉 Long Ấn Thành Trì', t2 = holder ? `«${holder}»` : 'vô chủ';
    ctx.strokeText(t1, e.x, e.y - 168); ctx.fillStyle = '#ffd860'; ctx.fillText(t1, e.x, e.y - 168);
    ctx.font = '700 11px "Be Vietnam Pro", sans-serif'; ctx.strokeText(t2, e.x, e.y - 154); ctx.fillStyle = holder ? '#9fd0ff' : '#aaa'; ctx.fillText(t2, e.x, e.y - 154);
    ctx.restore();
  }

  function onState(d) { st = d; if (d.now) skew = d.now - Date.now(); hud(); }
  function onCap(d) { UI.toast(`🐉 Bang ${d.g} đã chiếm Long Ấn!`, 'info'); if (G.shakeScreen) G.shakeScreen(6); GameAudio.sfx('enhOk'); }
  function onCall(d) {
    if (inMap()) return;
    G.modal(`🏯 Công Thành Chiến đã khai chiến! Bang ${d.g} của bạn có tên trong trận. Đến Thành Quan Lâm An ở Tương Dương để vào thành?`, [{ t: 'Tới Thành Quan', cls: 'primary', fn: () => QuestNav.go({ map: 'tuong_duong', npc: 'ct_thanh_quan' }) }, { t: 'Để sau' }]);
  }
  window.Siege = { open, onNpc, onState, onCap, onCall, drawGround, drawSeal };
})();
