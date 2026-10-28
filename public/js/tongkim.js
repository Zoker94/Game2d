// Chiến Trường Tống Kim phía người chơi: bảng Mộ Binh Quan (báo danh / luật / đổi Công Trạng), bảng điểm hai phe khi ở
// chiến trường, hậu doanh có tường cờ hai màu, điểm bay lên khi ghi điểm.
(function () {
  const $ = id => document.getElementById(id);
  const emit = d => G.socket && G.socket.emit('tongkim', d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const MAP = 'tong_kim';
  const SIDE = { song: { name: 'Tống', col: '#ff6a5a', flag: '#c8281e' }, jin: { name: 'Kim', col: '#6ab0ff', flag: '#1e50b8' } };
  const RK = ['Binh Sĩ', 'Hiệu Úy', 'Thống Lĩnh', 'Phó Tướng', 'Đại Tướng', 'Nguyên Soái'];
  let st = null, npc = null, skew = 0;
  const inMap = () => G.map && G.map.id === MAP;
  const left = t => { const s = Math.max(0, Math.round((t - (Date.now() + skew)) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  // lính cùng phe: không nhắm / không hiện là kẻ địch
  function friendly(m) {
    if (!m || !G.me || !G.me.tk || !G.data) return false;
    const d = G.data.monsters[m.type];
    return !!(d && d.tk && ((G.me.tk / 10) | 0) === (d.tk === 'song' ? 1 : 2));
  }

  // ---------- bảng NPC ----------
  let tab = 'join';
  function open(d) { npc = d; UI.openPanel('tongkim'); }
  function onNpc(h) { if (npc) { npc.tongkim = h; UI.openPanel('tongkim'); } }
  UI.registerPanel('tongkim', '🏯 Chiến Trường Tống Kim', body => {
    const d = (npc && npc.tongkim) || {};
    const startIn = Math.round((d.startIn || 0) / 60000);
    let html = `<div class="tabs"><button data-tkt="join" class="${tab === 'join' ? 'on' : ''}">⚔️ Báo danh</button><button data-tkt="shop" class="${tab === 'shop' ? 'on' : ''}">🎖️ Đổi Công Trạng</button></div>`;
    if (tab === 'join') {
      html += `<div class="dh-hero tk-hero"><div class="dh-emb">🏯</div><div class="grow"><h3>Chiến Trường Tống Kim</h3>
        <div class="small">"${UI.esc((npc && npc.talk) || '')}"</div>
        <div class="dh-state ${d.active ? 'on' : ''}">${d.active ? `🔥 ĐANG GIAO CHIẾN · còn ${left(d.until)}` : d.regOpen ? `📜 Đang mở báo danh · khai chiến sau ${startIn} phút` : `⏳ 22:00 mỗi tối · báo danh từ 21:30 (còn ${Math.floor(startIn / 60)} giờ ${startIn % 60} phút)`}</div></div></div>`;
      const low = G.me.level < d.minLv;
      html += '<div class="row" style="gap:6px;flex-wrap:wrap">';
      if (d.active) html += `<button class="btn primary big" data-tk="reg" ${low ? 'disabled' : ''}>⚔️ Vào chiến trường ngay</button>`;
      else if (d.reg) html += `<button class="btn" data-tk="unreg">✖ Huỷ báo danh</button><span class="ok-t small">✅ Đã báo danh – 22:00 máy sẽ chia phe và đưa bạn vào trận.</span>`;
      else html += `<button class="btn primary big" data-tk="reg" ${low || !d.regOpen ? 'disabled' : ''}>📜 Báo danh</button>`;
      html += `</div>${low ? `<div class="warn small">Cần cấp ${d.minLv}</div>` : ''}<div class="small muted">${d.nReg || 0} đại hiệp đã báo danh · Công Trạng của bạn: <b style="color:#ffd76a">${fmt(d.ct)}</b></div>`;
      html += `<div class="card"><h4>📜 Luật chiến trường</h4>
        <div class="small">• 22:00 – 22:35 mỗi tối, cấp ${d.minLv}+. Máy tự chia hai phe <b style="color:${SIDE.song.col}">Tống</b> – <b style="color:${SIDE.jin.col}">Kim</b> cân bằng theo lực chiến (tổ đội đi chung một phe). Đang đánh vẫn vào được, xếp vào phe yếu hơn.</div>
        <div class="small">• Hậu doanh (lát đá hai đầu bản đồ) là nơi an toàn: không bị đánh, không đánh ra được. Kẻ địch xông vào bị tháp canh bắn.</div>
        <div class="small">• Hạ người phe địch: ~10 điểm (đối thủ mạnh hơn được nhiều hơn) + thưởng chặn liên trảm. Hạ lính +1, Hiệu Úy +5. 10 phút cuối hai phe có <b>Đại Tướng</b>: hạ được thì phe mình +100, người kết liễu +30. Hạ cùng một người liên tục điểm giảm dần.</div>
        <div class="small">• Tử trận không mất gì, 6 giây sau hồi sinh ở hậu doanh. Đứng yên 3 phút bị đưa ra khỏi trận.</div>
        <div class="small">• Quân hàm theo điểm: ${d.ranks ? d.ranks.map((r, i) => `${r} (${[0, 50, 150, 300, 500, 800][i]})`).join(' → ') : ''}.</div></div>
        <div class="card"><h4>🎁 Phần thưởng</h4>
        <div class="small">Kinh nghiệm + ngân lượng + <b>Công Trạng</b> theo điểm (cần tối thiểu 20 điểm). Phe thắng +50% (hoà +20%). Top 1 / 2 / 3 mỗi phe thêm 100 / 60 / 30 Công Trạng. Đổi Công Trạng ở tab bên cạnh.</div></div>`;
      if (d.last && d.last.tot) html += `<div class="card"><h4>🏆 Trận gần nhất</h4><div class="small">Tống <b>${d.last.tot.song}</b> – <b>${d.last.tot.jin}</b> Kim · ${d.last.win ? `phe ${SIDE[d.last.win].name} thắng` : 'hoà'}${d.last.top && d.last.top.length ? ' · ' + d.last.top.map(UI.esc).join(' · ') : ''}</div></div>`;
    } else {
      html += `<div class="card"><h4>🎖️ Công Trạng: <span style="color:#ffd76a">${fmt(d.ct)}</span></h4><div class="small muted">Đồ đổi bằng Công Trạng là đồ khoá (không giao dịch / bán chợ).</div></div><div class="list tk-shop">`;
      for (const it of d.shop || []) {
        const ok = (d.ct || 0) >= it.cost;
        const ico = it.id === 'gold' ? '<span class="tk-gold">💰</span>' : `<img src="${UI.iconUrl(it.id)}" class="ic" width="32" height="32">`;
        html += `<div class="li"><div class="tk-ico">${ico}</div><div class="grow"><b>${UI.esc(it.name)}</b>${it.id !== 'gold' && it.qty > 1 ? ` x${it.qty}` : ''}<div class="small muted">${fmt(it.cost)} Công Trạng</div></div><button class="btn small ${ok ? 'primary' : ''}" data-tkbuy="${it.k}" ${ok ? '' : 'disabled'}>Đổi</button></div>`;
      }
      html += '</div>';
    }
    body.innerHTML = html;
    body.querySelectorAll('[data-tkt]').forEach(b => b.onclick = () => { tab = b.dataset.tkt; UI.openPanel('tongkim'); });
    body.querySelectorAll('[data-tk]').forEach(b => b.onclick = () => { emit({ op: b.dataset.tk }); if (d.active) UI.closePanel(); });
    body.querySelectorAll('[data-tkbuy]').forEach(b => b.onclick = () => emit({ op: 'buy', k: b.dataset.tkbuy }));
  });

  // ---------- bảng điểm trên chiến trường ----------
  function hud() {
    let h = $('tk-hud');
    if (!inMap() || !st) { if (h) h.remove(); return; }
    if (!h) {
      h = document.createElement('div'); h.id = 'tk-hud'; $('screen-game').appendChild(h);
      h.addEventListener('pointerdown', e => e.stopPropagation());
      h.addEventListener('click', e => { const t = e.target.closest('[data-tkh]'); if (!t) return; if (t.dataset.tkh === 'leave') G.modal('Rời Chiến Trường Tống Kim về Tương Dương?', [{ t: 'Rời', cls: 'red', fn: () => emit({ op: 'leave' }) }, { t: 'Ở lại' }]); else h.classList.toggle('min'); });
      if (Input.isTouch) h.classList.add('min');
    }
    let html;
    if (st.active) {
      const t = st.tot || { song: 0, jin: 0 }, sum = Math.max(1, t.song + t.jin), me = st.me || {}, side = st.side;
      html = `<div class="tk-h"><span>🏯 Tống Kim</span><b>${left(st.until)}</b><button class="hs-x" data-tkh="min">▾</button></div>
        <div class="tk-bar"><i style="width:${(t.song / sum * 100).toFixed(1)}%"></i><span class="l">Tống ${fmt(t.song)}</span><span class="r">${fmt(t.jin)} Kim</span></div>
        <div class="tk-me">${side ? `<b style="color:${SIDE[side].col}">Phe ${SIDE[side].name}</b> · ${RK[me.rank || 0]} · <b>${me.pts || 0}</b> điểm · ${me.kills || 0} hạ / ${me.deaths || 0} chết${me.streak >= 2 ? ` · 🔥${me.streak}` : ''}` : '<span class="muted">Đang xem – gặp Mộ Binh Quan để vào trận</span>'}</div>
        <div class="tk-top"><div>${(st.top && st.top.song || []).map(([n, p], i) => `<div><i>${i + 1}</i>${UI.esc(n)}<span>${p}</span></div>`).join('') || '<div class="muted">—</div>'}</div><div>${(st.top && st.top.jin || []).map(([n, p], i) => `<div><i>${i + 1}</i>${UI.esc(n)}<span>${p}</span></div>`).join('') || '<div class="muted">—</div>'}</div></div>
        <div class="tk-gen">${st.generalAt ? `⚔️ Đại Tướng xuất trận sau ${left(st.generalAt)}` : `Đại Tướng: Tống ${st.generals && st.generals.song ? '🟢' : '💀'} · Kim ${st.generals && st.generals.jin ? '🟢' : '💀'}`}</div>
        <div class="hs-btns"><button class="btn small" data-tkh="leave">🏯 Rời chiến trường</button></div>`;
    } else if (st.final) {
      const t = st.tot || {};
      html = `<div class="tk-h"><span>🏆 Kết quả Tống Kim</span><button class="hs-x" data-tkh="min">▾</button></div>
        <div class="tk-me">Tống <b>${fmt(t.song)}</b> – <b>${fmt(t.jin)}</b> Kim · ${st.win ? `<b style="color:${SIDE[st.win].col}">Phe ${SIDE[st.win].name} thắng!</b>` : 'Hoà'}</div>
        ${st.mine ? `<div class="tk-me">Bạn: ${st.mine.pts} điểm · ${st.mine.kills} hạ / ${st.mine.deaths} chết</div>` : ''}
        <div class="hs-btns"><button class="btn small" data-tkh="leave">🏯 Về Tương Dương</button></div>`;
    } else {
      html = `<div class="tk-h"><span>🏯 Chiến Trường Tống Kim</span><button class="hs-x" data-tkh="min">▾</button></div><div class="tk-me muted">Khai chiến 22:00 mỗi tối.</div><div class="hs-btns"><button class="btn small" data-tkh="leave">🏯 Về Tương Dương</button></div>`;
    }
    if (h._h !== html) { h.innerHTML = html; h._h = html; }
  }
  setInterval(hud, 500);

  // ---------- hậu doanh: nền đỏ / lam, cờ phe dọc tường ----------
  function drawGround(ctx, now) {
    if (!inMap()) return;
    const W = G.map.w * 64, H = G.map.h * 64, bw = 9 * 64;
    for (const [side, x0] of [['song', 0], ['jin', W - bw]]) {
      const S = SIDE[side];
      ctx.save();
      ctx.fillStyle = side === 'song' ? 'rgba(200,40,30,.10)' : 'rgba(30,80,200,.10)';
      ctx.fillRect(x0 + 64, 64, bw - 64, H - 128);
      const wx = side === 'song' ? bw + 32 : W - bw - 32;
      for (let y = 160; y < H - 100; y += 256) {
        if (Math.abs(y - H / 2) < 260) continue;   // cổng giữa
        ctx.fillStyle = '#3a2414'; ctx.fillRect(wx - 2, y - 70, 4, 70);
        const wv = Math.sin(now / 260 + y) * 4;
        ctx.fillStyle = S.flag; ctx.beginPath(); ctx.moveTo(wx + 2, y - 68); ctx.quadraticCurveTo(wx + 16, y - 66 + wv, wx + 30, y - 64 + wv * 1.4); ctx.lineTo(wx + 30, y - 44 + wv * 1.4); ctx.quadraticCurveTo(wx + 16, y - 46 + wv, wx + 2, y - 48); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,240,200,.95)'; ctx.font = 'bold 12px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(side === 'song' ? '宋' : '金', wx + 15, y - 56 + wv);
      }
      ctx.font = 'bold 26px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = side === 'song' ? 'rgba(255,120,100,.35)' : 'rgba(120,170,255,.35)';
      ctx.fillText(`HẬU DOANH ${S.name.toUpperCase()}`, x0 + bw / 2 + 16, H / 2 - 120);
      ctx.restore();
    }
  }

  function onState(d) { st = d; if (d.now) skew = d.now - Date.now(); hud(); }
  function onPts(d) { Overhead.add(G.self.x, G.self.y - 92, `+${d.n} điểm`, 'status', '#ffd84a'); GameAudio.sfx('coin', 0); }
  window.TongKim = { open, onNpc, onState, onPts, drawGround, friendly };
})();
