// Hoa Sơn Luận Kiếm phía người chơi: bảng NPC (ghi danh, lên núi, luật, thưởng), bảng theo dõi giải trên đỉnh núi,
// chế độ "Xem thi đấu" (camera theo trận đang đấu, chuyển trận bằng ◀ ▶) hoặc "Tự do" (tự điều khiển nhân vật đi xem),
// 5 vòng đài vẽ trên sân.
(function () {
  const $ = id => document.getElementById(id);
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const MAP = 'hoa_son_ld';
  let st = null, npc = null, skew = 0, watch = false, idx = 0, lastSelf = null;
  const inMap = () => G.map && G.map.id === MAP;
  const until = t => {
    const s = Math.max(0, Math.round((t - (Date.now() + skew)) / 1000));
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return d ? `${d} ngày ${h} giờ` : h ? `${h} giờ ${m} phút` : `${m}:${String(s % 60).padStart(2, '0')}`;
  };
  const MEDAL = ['🥇', '🥈', '🥉'];

  // ---------- bảng NPC ----------
  function open(d) { npc = d; UI.openPanel('hoason'); }
  function onNpc(h) { if (npc) { npc.hoason = h; UI.openPanel('hoason'); } }   // ghi danh / huỷ xong: vẽ lại bảng
  UI.registerPanel('hoason', '⛰️ Hoa Sơn Luận Kiếm', body => {
    const d = (npc && npc.hoason) || {};
    const lowLv = G.me.level < d.minLv;
    let html = `<div class="dh-hero hs-hero"><div class="dh-emb">⛰️</div><div class="grow"><h3>Hoa Sơn Luận Kiếm</h3>
      <div class="small">"${UI.esc((npc && npc.talk) || '')}"</div>
      <div class="dh-state ${d.running ? 'on' : ''}">${d.running ? '🔥 ĐANG THI ĐẤU – lên núi để xem!' : `⏳ Khai mạc 20:00 Thứ 7 hằng tuần · còn ${until(d.next)}`}</div></div></div>`;
    html += `<div class="dh-mc hs-mc">⚔️ Hoa Sơn Kiếm Thánh: ${d.champ ? `<b>${UI.esc(d.champ.name)}</b> <span class="small muted">(còn ${Math.max(1, Math.ceil((d.champ.until - Date.now()) / 86400000))} ngày)</span>` : '<span class="muted">Chưa có ai đăng đỉnh</span>'}</div>`;
    html += '<div class="row" style="gap:6px;flex-wrap:wrap">';
    if (!d.running) html += d.reg ? `<button class="btn" id="hs-unreg">✖ Huỷ ghi danh</button>` : `<button class="btn primary big" id="hs-reg" ${lowLv ? 'disabled' : ''}>📜 Ghi danh thi đấu</button>`;
    html += d.inMap ? `<button class="btn" id="hs-leave">🏯 Xuống núi về Tương Dương</button>` : `<button class="btn ${d.running ? 'primary big' : ''}" id="hs-enter">⛰️ Lên đỉnh Hoa Sơn${d.running ? ' xem thi đấu' : ''}</button>`;
    html += '</div>';
    if (lowLv && !d.running) html += `<div class="warn small">Cần cấp ${d.minLv} để ghi danh (ai cũng lên núi xem được)</div>`;
    if (d.reg) html += `<div class="ok-t small">✅ Bạn đã ghi danh. Hãy online lúc 20:00 Thứ 7 – vắng mặt tới lượt đấu sẽ bị xử thua.</div>`;
    html += `<div class="card"><h4>📜 Luật thi đấu</h4>
      <div class="small">• Ghi danh cả tuần (cấp ${d.minLv}+, tối đa ${d.maxReg} người), đóng lúc khai mạc. Khai mạc, máy sẽ đưa các đấu thủ lên núi.</div>
      <div class="small">• Đấu loại trực tiếp <b>1 chọi 1</b>: thua là bị loại, thắng vào vòng sau cho tới khi còn một người. Vòng đầu đánh song song ở 4 đài phụ; Tranh Hạng Ba và <b>Chung Kết</b> ở đài chính.</div>
      <div class="small">• Mỗi trận tối đa 2 phút 30: cạn máu (không chết, không mất gì) hoặc bước ra khỏi vòng là thua; hết giờ ai còn nhiều % máu hơn thắng. Có thể xin thua.</div>
      <div class="small">• Người ngoài lên núi xem: chọn <b>👁 Xem thi đấu</b> (camera theo trận) hoặc <b>🕹 Tự do</b> (tự đi lại quanh các đài).</div></div>
      <div class="card"><h4>🎁 Phần thưởng</h4>
      <div class="small">🥇 Vô địch: <b>Danh hiệu Hoa Sơn Kiếm Thánh 7 ngày</b> + 300 💎 + 80.000 💰 + 3 Rương Thủ Lĩnh + 30 Huyền Tinh Thạch</div>
      <div class="small">🥈 Á quân: 180 💎 + 50.000 💰 + 2 Rương Thủ Lĩnh + 20 Huyền Tinh Thạch</div>
      <div class="small">🥉 Hạng Ba: 100 💎 + 30.000 💰 + 1 Rương Thủ Lĩnh + 10 Huyền Tinh Thạch · Tham gia: 5.000 💰 + 1 Rương Bí Ẩn</div></div>`;
    if (d.last && d.last.top) html += `<div class="card"><h4>🏆 Giải gần nhất (${d.last.total} đấu thủ)</h4><div class="small">${d.last.top.map((n, i) => n ? `${MEDAL[i]} ${UI.esc(n)}` : '').filter(Boolean).join(' · ')}</div></div>`;
    html += `<div class="card"><h4>📋 Đã ghi danh (${d.nReg || 0}/${d.maxReg || 64})</h4><div class="small hs-reglist">${(d.regList || []).map(([n, lv, c]) => `<span>${UI.esc(n)} <i>Lv${lv} ${UI.esc(c)}</i></span>`).join('') || '<span class="muted">Chưa có ai</span>'}</div></div>`;
    body.innerHTML = html;
    const b = (id, fn) => { const e = $(id); if (e) e.onclick = fn; };
    b('hs-reg', () => emit('hoason', { op: 'reg' }));
    b('hs-unreg', () => emit('hoason', { op: 'unreg' }));
    b('hs-enter', () => { emit('hoason', { op: 'enter' }); UI.closePanel(); });
    b('hs-leave', () => { emit('hoason', { op: 'leave' }); UI.closePanel(); });
  });

  // ---------- chế độ xem ----------
  function setWatch(on, quiet) {
    watch = !!on; lastSelf = null;
    if (!quiet) UI.toast(watch ? '👁 Chế độ Xem thi đấu: camera theo trận đang đấu (◀ ▶ để đổi trận)' : '🕹 Chế độ Tự do: tự điều khiển nhân vật đi xem', 'info');
    G._camSnap = true; hud(true);
  }
  // điểm camera nhìn vào khi đang xem thi đấu (null = theo nhân vật như thường)
  function camFocus() {
    if (!watch || !inMap() || !st || !st.running || (window.Duel && Duel.active)) return null;
    const live = st.live || [];
    if (!live.length) return null;
    const m = live[((idx % live.length) + live.length) % live.length];
    const a = G.players.get(m.ai), b = G.players.get(m.bi);
    if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return { x: m.cx, y: m.cy };
  }
  // tự chạy nhân vật trong chế độ xem: chuyển sang Tự do
  setInterval(() => {
    if (!watch || !inMap() || !G.self) return;
    const p = { x: G.self.x, y: G.self.y };
    if (lastSelf && Math.hypot(p.x - lastSelf.x, p.y - lastSelf.y) > 24 && !(window.Duel && Duel.active)) setWatch(false);
    else lastSelf = p;
  }, 300);

  // ---------- bảng theo dõi trên núi ----------
  function hud(force) {
    let h = $('hs-hud');
    if (!inMap() || !st) { if (h) h.remove(); if (!inMap()) { watch = false; lastSelf = null; } return; }
    if (!h) {
      h = document.createElement('div'); h.id = 'hs-hud'; $('screen-game').appendChild(h);
      h.addEventListener('pointerdown', e => e.stopPropagation());
      h.addEventListener('click', e => {
        const t = e.target.closest('[data-hs]'); if (!t) return;
        const k = t.dataset.hs;
        if (k === 'watch') setWatch(true); else if (k === 'free') setWatch(false);
        else if (k === 'prev') { idx--; G._camSnap = true; hud(true); } else if (k === 'next') { idx++; G._camSnap = true; hud(true); }
        else if (k === 'leave') emit('hoason', { op: 'leave' });
        else if (k === 'min') { h.classList.toggle('min'); }
        else if (k.startsWith('m')) { idx = +k.slice(1); setWatch(true, true); }
      });
    }
    let html = `<div class="dh-h">⛰️ Hoa Sơn Luận Kiếm <button class="hs-x" data-hs="min">▾</button></div>`;
    if (st.running) {
      const live = st.live || [], cur = live.length ? ((idx % live.length) + live.length) % live.length : -1;
      html += `<div class="hs-ph">${UI.esc(st.label || '')}${st.phase === 'prep' || st.phase === 'break' || (!live.length && st.at > Date.now() + skew) ? ` · bắt đầu sau ${until(st.at)}` : ''} <span class="muted">· ${st.total} đấu thủ</span></div>`;
      if (window.Duel && Duel.active) html += `<div class="hs-me ok-t">⚔️ Bạn đang thi đấu – cố lên!</div>`;
      else if (st.mine === 'in') html += `<div class="hs-me ok-t">⚔️ Bạn đang ở trong giải – chờ tới lượt sẽ được đưa lên đài</div>`;
      else if (st.mine === 'out') html += `<div class="hs-me muted">Bạn đã dừng bước. Ở lại cổ vũ nhé!</div>`;
      html += `<div class="hs-live">${live.map((m, i) => `<div class="${i === cur && watch ? 'on' : ''}" data-hs="m${i}"><i>${m.slot ? 'Đài ' + m.slot : 'Đài chính'}</i><b>${UI.esc(m.a)}</b> ⚔ <b>${UI.esc(m.b)}</b></div>`).join('') || '<div class="muted">Đang chờ trận kế tiếp…</div>'}</div>`;
      if (st.queue && st.queue.length) html += `<div class="hs-q small muted">Kế tiếp: ${st.queue.slice(0, 3).map(([a, b]) => `${UI.esc(a)} – ${UI.esc(b)}`).join(' · ')}${st.queue.length > 3 ? ' …' : ''}</div>`;
      if (st.log && st.log.length) html += `<div class="hs-log">${st.log.slice(0, 3).map(l => `<div>• ${UI.esc(l)}</div>`).join('')}</div>`;
      html += `<div class="hs-btns"><button class="btn small ${watch ? 'primary' : ''}" data-hs="watch">👁 Xem thi đấu</button><button class="btn small ${!watch ? 'primary' : ''}" data-hs="free">🕹 Tự do</button>${watch && live.length > 1 ? '<button class="btn small" data-hs="prev">◀</button><button class="btn small" data-hs="next">▶</button>' : ''}</div>`;
    } else {
      if (st.finalTop) html += `<div class="hs-top">${st.finalTop.map((n, i) => n ? `<div>${MEDAL[i]} <b>${UI.esc(n)}</b></div>` : '').join('')}</div>`;
      html += `<div class="hs-me">⚔️ Kiếm Thánh: <b>${UI.esc(st.champ || 'chưa có')}</b><br><span class="small muted">Giải kế tiếp: 20:00 Thứ 7 · còn ${until(st.next)} · ${st.nReg} người đã ghi danh</span></div>`;
    }
    html += `<div class="hs-btns"><button class="btn small" data-hs="leave">🏯 Xuống núi</button></div>`;
    if (force || h._h !== html) { h.innerHTML = html; h._h = html; }
    // đang đấu: thu gọn bảng cho đỡ che màn hình; đấu xong mở lại
    const fighting = !!(window.Duel && Duel.active);
    if (fighting !== h._fight) { h._fight = fighting; h.classList.toggle('min', fighting); }
  }
  setInterval(() => hud(), 500);

  // ---------- 5 vòng đài trên sân ----------
  function rings() {
    const W = G.map.w * 64, H = G.map.h * 64;
    return [{ cx: W / 2, cy: H * 0.52, r: 300 }, { cx: W * 0.24, cy: H * 0.3, r: 230 }, { cx: W * 0.76, cy: H * 0.3, r: 230 }, { cx: W * 0.24, cy: H * 0.76, r: 230 }, { cx: W * 0.76, cy: H * 0.76, r: 230 }];
  }
  function drawGround(ctx, now) {
    if (!inMap()) return;
    const live = new Set(((st && st.live) || []).map(m => m.slot));
    rings().forEach((R, i) => {
      ctx.save();
      ctx.translate(R.cx, R.cy); ctx.scale(1, 0.62);
      // bục đá tròn hai tầng
      ctx.fillStyle = 'rgba(40,46,60,.55)'; ctx.beginPath(); ctx.arc(0, 10, R.r + 26, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(0, 0, R.r * 0.2, 0, 0, R.r + 14);
      g.addColorStop(0, i ? 'rgba(170,180,196,.55)' : 'rgba(196,186,150,.6)'); g.addColorStop(1, 'rgba(110,118,136,.6)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R.r + 14, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = live.has(i) ? `rgba(255,${190 + Math.sin(now / 200) * 40},80,.95)` : 'rgba(230,236,245,.55)';
      ctx.beginPath(); ctx.arc(0, 0, R.r + 14, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(0, 0, R.r * 0.55, 0, Math.PI * 2); ctx.stroke();
      // chữ 劍 giữa đài
      ctx.font = `bold ${i ? 90 : 130}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = live.has(i) ? 'rgba(255,220,140,.32)' : 'rgba(255,255,255,.16)'; ctx.fillText('劍', 0, 0);
      ctx.restore();
      // biển tên đài
      const lbl = i ? 'ĐÀI ' + i : 'ĐÀI CHÍNH';
      ctx.font = 'bold 13px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
      const ty = R.cy - (R.r + 14) * 0.62 - 10, w = ctx.measureText(lbl).width + 16;
      ctx.fillStyle = 'rgba(20,24,34,.8)'; ctx.fillRect(R.cx - w / 2, ty - 11, w, 18);
      ctx.fillStyle = live.has(i) ? '#ffd778' : '#dfe8f5'; ctx.fillText(lbl, R.cx, ty + 3);
    });
  }

  function onState(d) {
    const wasRunning = st && st.running;
    st = d; if (d.now) skew = d.now - Date.now();
    if (d.running && !wasRunning && inMap() && !(window.Duel && Duel.active)) setWatch(true, true);   // giải bắt đầu: tự bật xem
    hud();
  }
  window.HoaSon = { open, onNpc, onState, drawGround, camFocus, get watching() { return watch; } };
})();
