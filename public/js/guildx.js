// Bảng Bang hội: tab 📜 Nhiệm vụ bang và 👹 Boss bang (máy chủ: server/game/guildx.js)
(function () {
  const emit = d => G.socket && G.socket.emit('guildx', d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const esc = s => UI.esc(String(s == null ? '' : s));
  let data = null, asked = 0;
  const rw = r => [r.exp ? fmt(r.exp) + ' KN' : '', r.gold ? fmt(r.gold) + ' 💰' : '', ...(r.items || []).map(([id, q]) => `${(G.data.items[id] || {}).name || id} x${q}`)].filter(Boolean).join(' · ');
  function html(tab) {
    if (!data || Date.now() - asked > 3000) { asked = Date.now(); emit({ op: 'view' }); }
    if (!data) return '<p class="muted">Đang tải...</p>';
    if (tab === 'gquest') {
      const q = data.quest, c = q.cur, done = c && c.have >= c.need;
      let h = `<div class="card"><h4>📜 Nhiệm vụ bang <span class="small muted">(${q.n}/${q.max} hôm nay)</span></h4>
        <div class="small muted">Mỗi nhiệm vụ: thưởng cá nhân + <b>quỹ bang</b> + <b>cống hiến bang</b>. Nhiệm vụ thứ ${q.max} thưởng gấp đôi kèm Rương Bí Ẩn.</div>`;
      if (c) h += `<div class="sect-q ${done ? 'done' : ''}">${done ? '✅' : '➤'} ${esc(c.text)} ${c.type !== 'gold' && c.need > 1 ? `<b>(${c.have}/${c.need})</b>` : ''}</div>
          <div class="small">🎁 ${rw(q.preview)} · quỹ bang +${fmt(q.preview.fund)} · cống hiến +${q.preview.contrib}</div>
          <div class="row" style="justify-content:flex-start;gap:6px;margin-top:6px">${done ? '<button class="btn primary" data-gx="submit">🎁 Trả nhiệm vụ</button>' : c.type === 'gold' ? `<button class="btn primary" data-gx="pay">💰 Nộp ${fmt(c.need)} lượng</button>` : ''}<button class="btn small" data-gx="abandon">Huỷ</button></div>`;
      else if (q.n >= q.max) h += '<p class="small">Hôm nay đã làm đủ nhiệm vụ bang. Mai quay lại nhé!</p>';
      else h += '<button class="btn primary" data-gx="accept">📜 Nhận nhiệm vụ bang</button>';
      return h + '</div>';
    }
    const b = data.boss; if (!b) return '';
    const mgr = b.role === 'leader' || b.role === 'elder';
    let h = `<div class="card gx-boss"><h4>👹 Boss bang – Kim Luân Pháp Vương</h4>
      <div class="small">Triệu hồi tại <b>Bang Hội Lãnh Địa</b>: bang cấp ${b.need}+, ${fmt(b.cost)} quỹ bang, mỗi ngày 1 lần. Chỉ thành viên bang mình đánh được boss. 20 phút không hạ thì boss bỏ đi.</div>
      <div class="small">Hạ được: quỹ bang +200.000; người góp sức nhận ngân lượng, top 1 hai Rương Thủ Lĩnh, top 2-3 một Rương Thủ Lĩnh, còn lại Rương Bí Ẩn + đá cường hoá.</div>`;
    if (b.alive) h += `<div class="gx-hp"><i style="width:${(b.hp / Math.max(1, b.max) * 100).toFixed(1)}%"></i><span>${fmt(b.hp)} / ${fmt(b.max)} · còn ${Math.ceil(b.left / 60000)} phút</span></div>
        ${b.top.length ? '<div class="small">' + b.top.map(([n, v], i) => `${i + 1}. ${esc(n)} – ${fmt(v)}`).join(' · ') + '</div>' : ''}`;
    h += '<div class="row" style="justify-content:flex-start;gap:6px;margin-top:6px">';
    if (b.alive) h += '<button class="btn primary" data-gx="go">⚔️ Tới Lãnh Địa đánh Boss</button>';
    else if (b.today) h += '<span class="small muted">Hôm nay bang đã triệu hồi Boss.</span><button class="btn small" data-gx="go">Tới Lãnh Địa</button>';
    else if (mgr) h += `<button class="btn primary" data-gx="summon" ${b.level < b.need || b.fund < b.cost ? 'disabled' : ''}>👹 Triệu hồi Boss bang (${fmt(b.cost)} quỹ)</button>${b.level < b.need ? `<span class="warn small">Bang cần cấp ${b.need}</span>` : b.fund < b.cost ? '<span class="warn small">Quỹ bang chưa đủ</span>' : ''}`;
    else h += '<span class="small muted">Chờ Bang chủ / Trưởng lão triệu hồi Boss bang.</span>';
    return h + '</div></div>';
  }
  function bind(body) {
    body.querySelectorAll('[data-gx]').forEach(b => b.onclick = () => {
      const op = b.dataset.gx;
      if (op === 'summon') return G.modal('Triệu hồi Boss bang? Trừ 100.000 quỹ bang, cả bang có 20 phút để hạ.', [{ t: 'Triệu hồi', cls: 'primary', fn: () => emit({ op }) }, { t: 'Thôi' }]);
      if (op === 'go') UI.closePanel();
      emit({ op });
    });
  }
  function onData(d) { data = d; if (UI.panelName() === 'guild') UI.refreshPanel(); }
  function onBoss(d) {
    G.modal(`👹 Boss bang đã được triệu hồi tại Bang Hội Lãnh Địa! Tới ngay?`, [{ t: '⚔️ Tới ngay', cls: 'primary', fn: () => emit({ op: 'go' }) }, { t: 'Để sau' }]);
  }
  window.GuildX = { html, bind, onData, onBoss };
})();
