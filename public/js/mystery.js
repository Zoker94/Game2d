// Thương Nhân Bí Ẩn (0:00 – 0:30 giờ Việt Nam ở Tương Dương): 6 món hiếm đổi mỗi đêm, mỗi người mỗi món 1 lần.
(function () {
  const emit = d => G.socket && G.socket.emit('mystery', d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  let data = null, npc = null;
  UI.registerPanel('mystery', '🌙 Thương Nhân Bí Ẩn', body => {
    const d = data;
    let html = `<div class="dh-hero my-hero"><div class="dh-emb">🌙</div><div class="grow"><h3>Thương Nhân Bí Ẩn</h3><div class="small">"${UI.esc((npc && npc.talk) || '')}"</div>
      <div class="dh-state ${d && d.open ? 'on' : ''}">${d && d.open ? '🕛 Chỉ bán tới 0:30 đêm nay' : 'Đã rời đi'}</div></div></div>`;
    if (d) html += '<div class="list tk-shop">' + d.items.map(it => {
      const price = it.knb ? `${it.knb} 💎` : `${fmt(it.gold)} 💰`, can = !it.got && (it.knb ? G.me.knb >= it.knb : G.me.gold >= it.gold);
      return `<div class="li ${it.got ? 'done' : ''}"><div class="tk-ico"><img src="${UI.iconUrl(it.id)}" class="ic" width="32" height="32"></div><div class="grow"><b>${UI.esc(it.name)}</b>${it.qty > 1 ? ' x' + it.qty : ''}<div class="small muted">${price}</div></div>
        <button class="btn small ${can ? 'primary' : ''}" data-my="${it.k}" ${can && d.open ? '' : 'disabled'}>${it.got ? '✔ Đã mua' : 'Mua'}</button></div>`;
    }).join('') + '</div><div class="small muted">Hàng đổi mỗi đêm. Mỗi món mỗi người mua được 1 lần.</div>';
    body.innerHTML = html;
    body.querySelectorAll('[data-my]').forEach(b => b.onclick = () => emit({ op: 'buy', k: +b.dataset.my }));
  });
  window.Mystery = {
    open(d) { npc = d; data = d.mystery || data; UI.openPanel('mystery'); },
    onData(d) { data = d; if (UI.panelName() === 'mystery') UI.refreshPanel(); }
  };
})();
