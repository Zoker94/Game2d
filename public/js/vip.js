// Bảng 👑 Đặc Quyền: VIP theo tổng nạp, Thẻ Tháng, Tích Nạp / Tích Tiêu tuần (máy chủ: server/game/vip.js)
(function () {
  const emit = d => G.socket && G.socket.emit('vip', d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const esc = s => UI.esc(String(s == null ? '' : s));
  let data = null, tab = 'vip';
  const IT = id => (G.data.items[id] || { name: id });
  const rw = r => {
    if (!r) return '';
    const p = [];
    if (r.knb) p.push(`💎 ${fmt(r.knb)} Nguyên Bảo`);
    if (r.gold) p.push(`💰 ${fmt(r.gold)}`);
    for (const [id, n] of r.items || []) p.push(`<span class="vp-it"><img src="${UI.iconUrl(id)}" width="16" height="16">${esc(IT(id).name)} x${n}</span>`);
    return p.join(' · ');
  };
  const left = ms => { const d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000); return d ? `${d} ngày ${h} giờ` : `${h} giờ`; };

  UI.registerPanel('vip', '👑 Đặc Quyền', body => {
    const d = data;
    if (!d) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    const tabs = [['vip', '👑 VIP'], ['mcard', '🎫 Thẻ Tháng'], ['top', '💎 Tích Nạp'], ['spend', '💸 Tích Tiêu']];
    let h = `<div class="tabs">${tabs.map(([k, t]) => `<button class="tab ${tab === k ? 'on' : ''}" data-vt="${k}">${t}</button>`).join('')}</div>`;
    if (tab === 'vip') {
      const v = d.vip, pct = v.next ? Math.min(100, Math.round(v.total / v.next * 100)) : 100;
      h += `<div class="card vp-hero"><div class="vp-lv">VIP ${v.lv}</div><div class="grow">Tổng nạp: <b>${fmt(v.total)}đ</b>${v.next ? ` · cần <b>${fmt(v.next)}đ</b> lên VIP ${v.lv + 1}` : ' · đã đạt VIP cao nhất'}
        <div class="vp-bar"><i style="width:${pct}%"></i></div><div class="small muted">Giảm giá Kỳ Trân Các: <b>${v.disc}%</b> · huy hiệu V${v.lv || '–'} ở kênh chat</div></div></div>`;
      h += v.gift ? `<div class="card"><h4>🎁 Quà VIP ${v.lv} mỗi ngày</h4><div class="small">${rw(v.gift)}</div>
        <button class="btn ${v.giftGot ? '' : 'primary'}" data-vop="vipGift" ${v.giftGot ? 'disabled' : ''}>${v.giftGot ? '✅ Hôm nay đã nhận' : 'Nhận quà hôm nay'}</button></div>`
        : `<div class="card"><p class="small">Nạp bất kỳ số tiền nào (từ ${fmt(v.req[1])}đ) để lên <b>VIP 1</b>: giảm giá Kỳ Trân Các và nhận quà mỗi ngày.</p><button class="btn primary" data-topup="1">💳 Nạp Nguyên Bảo</button></div>`;
      h += `<div class="card"><h4>Bảng đặc quyền VIP</h4><div class="list">${v.perks.slice(1).map(x => `<div class="li ${x.l === v.lv ? 'vp-me' : ''}"><b style="width:52px">VIP ${x.l}</b><div class="grow small">Tổng nạp ${fmt(v.req[x.l])}đ · giảm ${x.disc}%<div class="sub">Quà ngày: ${rw(x.gift)}</div></div></div>`).join('')}</div></div>`;
    } else if (tab === 'mcard') {
      const m = d.mcard;
      h += `<div class="card"><h4>🎫 Thẻ Tháng – 300 💎</h4><p class="small">Kích hoạt ${m.days} ngày (mua thêm thì cộng dồn). Mỗi ngày nhận: ${rw(m.gift)}.<br>Tổng ${m.days} ngày: <b>${fmt(m.gift.knb * m.days)} Nguyên Bảo</b> + ${m.days} Rương Bí Ẩn.</p>
        ${m.left ? `<div>Còn lại: <b>${left(m.left)}</b></div><button class="btn ${m.got ? '' : 'primary'}" data-vop="mcard" ${m.got ? 'disabled' : ''}>${m.got ? '✅ Hôm nay đã nhận' : 'Nhận quà hôm nay'}</button>`
          : '<div class="small muted">Chưa kích hoạt – mua Thẻ Tháng ở Kỳ Trân Các (Tương Dương) rồi bấm Sử dụng trong túi đồ.</div>'}</div>`;
    } else {
      const a = tab === 'top' ? d.top : d.spend, sp = tab === 'spend';
      const end = new Date(d.weekEnd);
      h += `<div class="card"><h4>${sp ? '💸 Tích Tiêu tuần' : '💎 Tích Nạp tuần'}</h4><div class="small muted">${sp ? 'Tính Nguyên Bảo đã tiêu (Kỳ Trân Các, thêm lượt, hồi sinh…).' : 'Tính số Nguyên Bảo nạp được trong tuần.'} Làm mới lúc ${end.toLocaleString('vi-VN', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}.</div>
        <div style="margin:6px 0">Tuần này: <b style="color:#ffd76a">${fmt(a.n)} 💎</b></div><div class="list">${a.list.map(x => `<div class="li"><b style="width:70px">${fmt(x.n)} 💎</b><div class="grow small">${rw(x.r)}</div>
          ${x.got ? '<button class="btn small" disabled>✅ Đã nhận</button>' : `<button class="btn small ${x.ok ? 'primary' : ''}" data-acc="${x.i}" ${x.ok ? '' : 'disabled'}>${x.ok ? 'Nhận' : `${fmt(Math.max(0, x.n - a.n))} nữa`}</button>`}</div>`).join('')}</div>
        ${sp ? '' : '<button class="btn primary" data-topup="1" style="margin-top:6px">💳 Nạp Nguyên Bảo</button>'}</div>`;
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-vt]').forEach(b => b.onclick = () => { tab = b.dataset.vt; UI.refreshPanel(); });
    body.querySelectorAll('[data-vop]').forEach(b => b.onclick = () => emit({ op: b.dataset.vop }));
    body.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => emit({ op: 'acc', k: tab, i: +b.dataset.acc }));
    body.querySelectorAll('[data-topup]').forEach(b => b.onclick = () => window.Topup && Topup.open());
  }, () => emit({ op: 'view' }));

  function bind(s) { s.on('vip', d => { data = d; if (UI.panelName() === 'vip') UI.refreshPanel(); }); }
  window.Vip = { bind, open: t => { if (t) tab = t; UI.openPanel('vip'); } };
})();
