// Phó bản phía người chơi: bảng chọn phó bản ở Phó Bản Sứ Giả, khung tiến độ (đợt quái, thời gian, buff tổ đội),
// mũi tên chỉ tới đợt quái hiện tại.
(function () {
  const $ = id => document.getElementById(id);
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  let list = null, npc = null, st = null, skew = 0;

  // ---------- bảng NPC ----------
  function open(d) { npc = d; list = null; emit('dungeon', { op: 'list' }); UI.openPanel('dungeon'); }
  UI.registerPanel('dungeon', '🗝️ Phó Bản', body => {
    if (!list) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    const pt = list.party;
    let html = `<div class="pb-intro"><b>"${UI.esc((npc && npc.talk) || '')}"</b>
      <div class="small">${pt ? (pt.leader ? `👥 Bạn là đội trưởng – <b>${pt.n} người</b> cùng bản đồ sẽ vào cùng.` : '👥 Chỉ đội trưởng mới mở được phó bản cho cả đội.') : '👤 Đang đi một mình. Lập tổ đội (bấm vào người chơi → Mời vào tổ đội) để vượt ải dễ hơn.'}</div>
      <div class="small muted">Đi tổ đội: mỗi đồng đội +8% công/thủ (tối đa +40%), quái chỉ thêm 35% máu cho mỗi người, thưởng kinh nghiệm +10% mỗi người.</div></div>`;
    html += list.list.map(d => {
      const lock = G.me.level < d.minLv, over = d.maxLv && G.me.level > d.maxLv, none = d.left <= 0;
      return `<div class="pb-card ${lock ? 'locked' : ''}"><div class="pb-h"><b>${UI.esc(d.name)}</b><span class="small">Cấp ${d.lv} · ${UI.esc(d.party)} · ${d.min} phút</span></div>
        <div class="small">${UI.esc(d.desc)}</div>
        <div class="small pb-rw">🎁 ${fmt(d.exp)} KN · ${fmt(d.gold)} 💰 · ${d.knb} 💎 · 1 trang bị hiếm/VIP/Truyền Kỳ · Rương Thủ Lĩnh · Huyền Tinh Thạch · có cơ hội rơi Võ Mục Tàn Quyển</div>
        <div class="row" style="justify-content:space-between;align-items:center;margin-top:5px"><span class="small ${none ? 'warn' : ''}">Lượt hôm nay: ${d.left}/${d.daily}</span>
          <button class="btn small primary" data-pb="${d.id}" ${lock || over || none || (pt && !pt.leader) ? 'disabled' : ''}>${lock ? `🔒 Cần cấp ${d.minLv}` : over ? `⛔ Quá cấp (tối đa ${d.maxLv})` : pt && pt.leader ? `⚔️ Dẫn đội vào (${pt.n})` : '⚔️ Vào phó bản'}</button></div></div>`;
    }).join('');
    body.innerHTML = html;
    body.querySelectorAll('[data-pb]').forEach(b => b.onclick = () => { emit('dungeon', { op: 'enter', id: b.dataset.pb }); UI.closePanel(); });
  });

  // ---------- khung tiến độ ----------
  function hud() {
    let h = $('pb-hud');
    if (!st) { if (h) h.remove(); return; }
    if (!h) { h = document.createElement('div'); h.id = 'pb-hud'; $('screen-game').appendChild(h); h.onclick = e => { if (e.target.closest('[data-pbleave]')) G.modal('Rời phó bản? (không hoàn lại lượt)', [{ t: 'Rời', cls: 'primary', fn: () => emit('dungeon', { op: 'leave' }) }, { t: 'Ở lại' }]); }; }
    const now = Date.now() + skew;
    const left = Math.max(0, Math.round(((st.done || st.fail ? st.closeAt : st.endAt) - now) / 1000));
    const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const pips = Array.from({ length: st.stages }, (_, i) => `<i class="${i < st.stage || st.done ? 'ok' : i === st.stage ? 'cur' : ''}">${i === st.stages - 1 ? '👹' : i + 1}</i>`).join('');
    let line;
    if (st.done) line = `<div class="pb-ok">🏆 Vượt ải thành công! Tự rời sau ${mmss}</div>`;
    else if (st.fail) line = `<div class="pb-fail">⌛ Thất bại – rời sau ${mmss}</div>`;
    else line = `<div class="pb-st">${st.boss ? `👹 <b>${UI.esc(st.boss)}</b>` : `Đợt ${st.stage + 1}: còn <b>${st.left}</b>/${st.total} quái`}</div><div class="pb-t ${left < 60 ? 'warn' : ''}">⏳ ${mmss}</div>`;
    const html = `<div class="pb-hh">🗝️ ${UI.esc(st.name)}<button data-pbleave title="Rời phó bản">Rời</button></div><div class="pb-pips">${pips}</div>${line}${st.buff > 0 ? `<div class="pb-buff">👥 Đồng Tâm Hiệp Lực +${Math.round(st.buff * 100)}% (${st.n} người)</div>` : ''}`;
    if (h._h !== html) { h.innerHTML = html; h._h = html; }
  }
  setInterval(hud, 500);

  // mũi tên tới đợt quái hiện tại
  function drawArrow(ctx, now) {
    if (!st || !st.goal || st.done || st.fail || !G.map || !G.map.id.startsWith('pb_')) return;
    const g = st.goal, s = G.self, d = Math.hypot(g.x - s.x, g.y - s.y);
    if (d < 200) return;
    const a = Math.atan2(g.y - s.y, g.x - s.x), r = 64 + Math.sin(now / 200) * 5;
    ctx.save();
    ctx.translate(s.x + Math.cos(a) * r, s.y - 26 + Math.sin(a) * r); ctx.rotate(a);
    ctx.fillStyle = st.boss ? '#ff4030' : '#c890ff'; ctx.strokeStyle = '#1a0a20'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function bind(s) {
    s.on('dungeonList', d => { list = d; if (UI.panelName() === 'dungeon') UI.refreshPanel(); });
    s.on('dungeon', d => { st = d; if (d && d.now) skew = d.now - Date.now(); hud(); });
  }
  window.Dungeon = { open, bind, drawArrow, get state() { return st; } };
})();
