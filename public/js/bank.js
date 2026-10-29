// Tiền Trang – kho cất đồ và ngân lượng
(function () {
  const $ = id => document.getElementById(id);
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const esc = s => UI.esc(s);
  const fmt = n => (n || 0).toLocaleString('vi-VN');
  const BANK = 60;
  const cell = (s, key) => { const it = G.data.items[s.id]; if (!it) return ''; return `<div class="slot r-${it.rarity}" data-${key}="${s.uid}">${UI.plusRing(s.plus | 0)}<img src="${UI.iconUrl(s.id)}" class="ic" width="36" height="36">${s.qty > 1 ? `<span class="q">${s.qty}</span>` : ''}${s.plus ? `<span class="plus">+${s.plus}</span>` : ''}${it.type === 'equip' ? UI.brBadge(s) + UI.gemDots(it, s) + UI.lvBadge(s.id) : ''}</div>`; };
  const askQty = s => {
    if (s.qty <= 1) return 1;
    const n = Math.floor(+prompt(`Số lượng ${G.data.items[s.id].name} (tối đa ${s.qty}):`, s.qty) || 0);
    return n > 0 ? Math.min(n, s.qty) : 0;
  };
  UI.registerPanel('bank', '🏦 Tiền Trang', body => {
    const me = G.me, b = me.bank || { items: [], gold: 0 };
    const inv = me.inv.filter(s => G.data.items[s.id]);
    body.innerHTML = `<div class="bank">
      <div class="bank-gold"><div>💰 Trong túi <b>${fmt(me.gold)}</b></div><div>🏦 Trong kho <b>${fmt(b.gold)}</b></div>
        <div class="row"><input id="bk-v" type="number" min="1" placeholder="Số lượng" style="width:110px">
        <button class="btn small green" id="bk-in">Gửi vào</button><button class="btn small" id="bk-out">Rút ra</button></div></div>
      <h4 class="sk-title">🏦 Kho đồ (${b.items.length}/${BANK}) <span class="small muted">– bấm để rút</span></h4>
      <div class="bank-grid">${b.items.map(s => cell(s, 'bk')).join('') || '<span class="muted small">Kho trống</span>'}</div>
      <h4 class="sk-title">🎒 Túi đồ (${me.inv.length}) <span class="small muted">– bấm để cất</span></h4>
      <div class="bank-grid">${inv.map(s => cell(s, 'iv')).join('') || '<span class="muted small">Túi trống</span>'}</div>
      <p class="small muted">Trang bị cất vào kho giữ nguyên cường hóa, hệ ngũ hành và hiệu ứng đặc biệt. Chỉ dùng được khi đứng gần Thủ Kho trong thành.</p></div>`;
    const v = () => Math.max(0, Math.floor(+$('bk-v').value || 0));
    $('bk-in').onclick = () => { const n = v(); if (n) emit('bank', { op: 'gold', v: n }); };
    $('bk-out').onclick = () => { const n = v(); if (n) emit('bank', { op: 'gold', v: -n }); };
    const bind = (key, list, op) => body.querySelectorAll(`[data-${key}]`).forEach(el => {
      const s = list.find(x => x.uid === el.dataset[key]);
      if (!s) return;
      el.onmouseenter = ev => UI.itemTip(ev, s.id, s.plus || 0, s); el.onmouseleave = () => UI.hideTip();
      el.onclick = () => { UI.hideTip(); const n = askQty(s); if (n) { emit('bank', { op, uid: s.uid, qty: n }); G.sfx('click'); } };
    });
    bind('bk', b.items, 'take');
    bind('iv', inv, 'put');
  });
})();
