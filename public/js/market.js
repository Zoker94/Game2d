// Chợ Phiên (server/game/market.js): vẽ gian hàng của người chơi trên bản đồ chợ, bấm vào gian hàng để xem & mua;
// Quản Lý Chợ: mua Lệnh Bài Bán Hàng, mở / quản lý gian hàng của mình (bày đồ từ túi, đặt giá, thu đồ, dẹp hàng).
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => UI.esc(String(s == null ? '' : s));
  const money = n => (n || 0).toLocaleString('vi-VN');
  const emit = d => G.socket && G.socket.emit('market', d);
  const plain = (id, plus) => { const it = G.data.items[UI.resolveId(id)]; return (it ? it.name : id) + (plus ? ' +' + plus : ''); };   // tên chữ thường (hộp xác nhận, gợi ý)
  let stalls = [], cur = null, pick = null;

  // ---------- vẽ gian hàng ----------
  let tent = null;
  function tentSprite() {
    if (tent) return tent;
    const c = document.createElement('canvas'); c.width = 96; c.height = 84;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(48, 78, 40, 7, 0, 0, 6.3); x.fill();
    x.fillStyle = '#6b4423'; x.fillRect(10, 30, 5, 46); x.fillRect(81, 30, 5, 46);          // cột
    x.fillStyle = '#8a5a2b'; x.fillRect(6, 54, 84, 18); x.fillStyle = '#5e3b1c'; x.fillRect(6, 70, 84, 4);   // quầy
    x.fillStyle = '#a8763c'; x.fillRect(6, 54, 84, 3);
    for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#f3e7c9' : '#c0392b'; x.beginPath(); x.moveTo(4 + i * 14.7, 30); x.lineTo(4 + (i + 1) * 14.7, 30); x.lineTo(4 + (i + 1) * 14.7, 14); x.lineTo(4 + i * 14.7, 14); x.fill(); }   // mái sọc
    x.fillStyle = '#8e2a1e'; x.beginPath(); x.moveTo(2, 14); x.lineTo(48, 2); x.lineTo(94, 14); x.closePath(); x.fill();
    for (let i = 0; i < 7; i++) { x.fillStyle = i % 2 ? '#f3e7c9' : '#c0392b'; x.beginPath(); x.arc(9 + i * 13, 31, 6.5, 0, Math.PI); x.fill(); }   // diềm
    const col = ['#4fa3ff', '#c060ff', '#ffb02a', '#4ade80', '#ff6a6a'];
    for (let i = 0; i < 5; i++) { x.fillStyle = col[i]; x.fillRect(16 + i * 14, 46, 9, 8); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(16 + i * 14, 46, 9, 2); }   // hàng hoá
    return (tent = c);
  }
  function collect(list) {
    if (!G.map || G.map.id !== 'cho_phien') return;
    for (const s of stalls) list.push({ y: s.y + 10, k: 'stall', s });
  }
  function draw(ctx, s, label) {
    ctx.drawImage(tentSprite(), s.x - 48, s.y - 70);
    label(s.x, s.y - 76, '🏪 ' + s.name, '#ffe08a', 11, true);
    label(s.x, s.y - 62, `${s.seller} · ${s.n} món`, '#cfe0da', 10, true);
  }
  function hit(wx, wy) {
    if (!G.map || G.map.id !== 'cho_phien') return null;
    for (const s of stalls) if (Math.abs(wx - s.x) < 44 && wy > s.y - 80 && wy < s.y + 10) return s;
    return null;
  }

  // ---------- bảng gian hàng ----------
  function box() {
    let b = $('mk-box');
    if (b) return b;
    b = document.createElement('div'); b.id = 'mk-box';
    b.innerHTML = '<div class="mk-h"><b class="mk-t"></b><span class="mk-x">✕</span></div><div class="mk-body"></div>';
    b.querySelector('.mk-x').onclick = close;
    ($('screen-game') || document.body).appendChild(b);
    return b;
  }
  function close() { const b = $('mk-box'); if (b) b.remove(); cur = null; pick = null; }
  function row(it, act) {
    return `<div class="mk-it" data-k="${it.k}"><img src="${UI.iconUrl(it.id)}" class="ic" width="34" height="34" data-tip="${it.k}">
      <div class="mk-nm"><b>${UI.itemName(it.id, it.plus)}</b><small>x${it.qty} · <span class="mk-pr">${money(it.price)}</span> lượng / cái</small></div>${act}</div>`;
  }
  function bindTips(el, items) {
    el.querySelectorAll('[data-tip]').forEach(im => {
      const it = items.find(x => String(x.k) === im.dataset.tip);
      if (it) im.onmouseenter = e => UI.itemTip(e, it.id, it.plus, it);
    });
  }
  function render() {
    const d = cur, b = box(), body = b.querySelector('.mk-body');
    if (!d) return;
    const tokens = G.me ? G.me.inv.filter(x => x.id === 'stall_token').reduce((a, x) => a + x.qty, 0) : 0;
    if (d.none) {   // chưa có gian hàng
      b.querySelector('.mk-t').textContent = '🏪 Gian hàng của tôi';
      body.innerHTML = `<p class="small">Mở gian hàng ở chỗ bạn đang đứng trong Chợ Phiên, bày bán đồ cho người chơi khác trong <b>24 giờ</b> – thoát game hàng vẫn bán, tiền bán tự cộng vào nhân vật (thuế chợ 5%).</p>
        <div class="mk-row"><input class="mk-name" maxlength="24" placeholder="Tên gian hàng (tuỳ chọn)"><button class="btn primary" data-open ${tokens && G.map.id === 'cho_phien' ? '' : 'disabled'}>🏪 Mở gian hàng</button></div>
        <p class="small ${tokens ? 'muted' : 'warn'}">Lệnh Bài Bán Hàng trong túi: <b>${tokens}</b>${tokens ? '' : ' – mua ở Quản Lý Chợ (20.000 lượng) hoặc Kỳ Trân Các (10 Nguyên Bảo)'}${G.map.id !== 'cho_phien' ? ' · Hãy đến Chợ Phiên (Xa Phu) để mở' : ''}</p>
        <button class="btn" data-buytoken>Mua Lệnh Bài Bán Hàng (20.000 lượng)</button>`;
      const nm = body.querySelector('.mk-name'); nm.onkeydown = e => e.stopPropagation();
      body.querySelector('[data-open]').onclick = () => emit({ op: 'open', name: nm.value });
      body.querySelector('[data-buytoken]').onclick = () => G.socket.emit('buy', { npc: 'quan_cho', id: 'stall_token', qty: 1 });
      return;
    }
    b.querySelector('.mk-t').textContent = (d.mine ? '🏪 ' : '🛒 ') + d.name;
    if (!d.mine) {   // gian hàng người khác: mua
      body.innerHTML = `<p class="small muted">Chủ gian hàng: <b>${esc(d.seller)}</b> · Ngân lượng của bạn: <b style="color:#ffd76a">${money(G.me && G.me.gold)}</b></p>` +
        (d.items.map(it => row(it, `<div class="mk-act">${it.qty > 1 ? `<input type="number" class="mk-q" min="1" max="${it.qty}" value="1">` : ''}<button class="btn small primary" data-buy="${it.k}">Mua</button></div>`)).join('') || '<p class="muted small">Gian hàng đã bán hết.</p>');
      body.querySelectorAll('.mk-q').forEach(q => q.onkeydown = e => e.stopPropagation());
      body.querySelectorAll('[data-buy]').forEach(btn => btn.onclick = () => {
        const it = d.items.find(x => String(x.k) === btn.dataset.buy), q = btn.parentNode.querySelector('.mk-q'), n = q ? Math.max(1, Math.min(it.qty, q.value | 0)) : 1;
        G.modal(`Mua ${plain(it.id, it.plus)} x${n} với giá ${money(it.price * n)} lượng?`, [{ t: 'Mua', cls: 'primary', fn: () => emit({ op: 'buy', uid: d.uid, k: it.k, qty: n }) }, { t: 'Huỷ' }]);
      });
      bindTips(body, d.items);
      return;
    }
    // gian hàng của mình
    const left = Math.max(0, d.until - Date.now()), h = Math.floor(left / 3600000), m = Math.floor(left / 60000) % 60;
    const bag = (G.me ? G.me.inv : []).filter(x => x.id !== 'stall_token');
    body.innerHTML = `<p class="small">${d.live ? `Đang mở · còn <b>${h} giờ ${m} phút</b>` : '<span class="warn">Đã hết hạn – thu đồ về túi rồi dùng Lệnh Bài mới để mở lại</span>'} · Đã bán <b>${d.sold}</b> món, thu <b style="color:#ffd76a">${money(d.earned)}</b> lượng</p>` +
      (d.items.map(it => row(it, `<button class="btn small" data-rm="${it.k}">Thu về</button>`)).join('') || '<p class="muted small">Chưa bày món nào.</p>') +
      (d.live ? `<div class="mk-sub">Bày thêm đồ từ túi (${d.items.length}/12)</div>
        <div class="mk-bag">${bag.map(s => `<img src="${UI.iconUrl(s.id)}" class="ic ${pick === s.uid ? 'sel' : ''}" width="34" height="34" data-uid="${s.uid}" title="${esc(plain(s.id, s.plus))} x${s.qty}">`).join('') || '<span class="muted small">Túi trống</span>'}</div>
        ${pick ? (() => { const s = bag.find(x => x.uid === pick); return s ? `<div class="mk-row"><b class="small">${UI.itemName(s.id, s.plus)}</b>${s.qty > 1 ? `<input type="number" class="mk-aq" min="1" max="${s.qty}" value="${s.qty}" title="Số lượng">` : ''}<input type="number" class="mk-ap" min="1" placeholder="Giá / cái (lượng)"><button class="btn small primary" data-add>Bày bán</button></div>` : ''; })() : ''}` : '') +
      `<div class="mk-row" style="margin-top:8px"><button class="btn small red" data-close>${d.live ? 'Dẹp gian hàng (đồ về túi)' : 'Thu hết đồ về túi'}</button></div>`;
    body.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => emit({ op: 'remove', k: +btn.dataset.rm }));
    body.querySelectorAll('[data-uid]').forEach(im => im.onclick = () => { pick = im.dataset.uid; render(); });
    body.querySelectorAll('input').forEach(q => q.onkeydown = e => e.stopPropagation());
    const add = body.querySelector('[data-add]');
    if (add) add.onclick = () => {
      const q = body.querySelector('.mk-aq'), pr = +body.querySelector('.mk-ap').value;
      if (!(pr >= 1)) return UI.toast('Nhập giá bán', 'error');
      emit({ op: 'add', uid: pick, qty: q ? +q.value : 1, price: pr }); pick = null;
    };
    const cl = body.querySelector('[data-close]');
    if (cl) cl.onclick = () => G.modal('Dẹp gian hàng? Đồ chưa bán sẽ về túi.', [{ t: 'Dẹp', cls: 'red', fn: () => emit({ op: 'close' }) }, { t: 'Huỷ' }]);
    bindTips(body, d.items);
  }

  window.Market = {
    collect, draw, hit,
    onStalls(list) { stalls = Array.isArray(list) ? list : []; },
    onStall(d) { cur = d; render(); },
    openStall(s) { emit({ op: s.uid === (G.user && G.user.id) ? 'mine' : 'view', uid: s.uid }); },
    openNpc(d) { cur = d.market || { mine: true, none: true }; render(); if (d.talk) UI.toast(d.talk, 'info'); },
    refresh() { if (cur && $('mk-box')) render(); }
  };
})();
