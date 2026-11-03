// Nạp Nguyên Bảo: chọn số tiền -> tạo đơn (mã nội dung chuyển khoản riêng) -> hiện mã QR VietQR đúng số tiền + nội dung.
// Quét bằng app ngân hàng là điền sẵn số tài khoản, số tiền, nội dung. Chủ server duyệt đơn trong trang quản trị thì cộng Nguyên Bảo.
(function () {
  const emit = d => G.socket && G.socket.emit('topup', d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const esc = s => UI.esc(String(s == null ? '' : s));
  let data = null, show = null, amt = 20000;
  const ST = { pending: ['⏳ Chờ xác nhận', '#ffd76a'], done: ['✅ Đã cộng', '#4ade80'], rejected: ['❌ Từ chối', '#ff7a7a'], cancelled: ['Đã huỷ', '#999'], expired: ['⌛ Quá hạn', '#c8a060'] };
  const qrUrl = (b, o) => `https://img.vietqr.io/image/${encodeURIComponent(b.bin)}-${encodeURIComponent(b.acc)}-compact2.png?amount=${o.amount}&addInfo=${encodeURIComponent(o.code)}&accountName=${encodeURIComponent(b.holder)}`;
  const copy = (t, what) => { try { navigator.clipboard.writeText(t); UI.toast(`Đã chép ${what}`, 'info'); } catch (e) { UI.toast(t, 'info'); } };

  UI.registerPanel('topup', '💎 Nạp Nguyên Bảo', body => {
    const d = data;
    if (!d) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    const b = d.bank, knb = a => Math.floor(a / 1000 * d.rate);
    let h = '';
    const o = show && d.orders.find(x => x.code === show);
    if (o && o.status === 'pending') {
      h += `<div class="card tp-qr"><h4>📱 Quét mã để chuyển khoản</h4>
        <img src="${qrUrl(b, o)}" alt="Mã QR chuyển khoản" width="260" height="300" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <div class="warn small" style="display:none">Không tải được ảnh mã QR – hãy chuyển khoản thủ công theo thông tin bên dưới.</div>
        <div class="tp-info">
          <div><span>Ngân hàng</span><b>${esc(b.bankName)}</b></div>
          <div><span>Số tài khoản</span><b>${esc(b.acc)}</b><button class="btn small" data-cp="acc">Chép</button></div>
          <div><span>Chủ tài khoản</span><b>${esc(b.holder)}</b></div>
          <div><span>Số tiền</span><b class="tp-amt">${fmt(o.amount)}đ</b><button class="btn small" data-cp="amt">Chép</button></div>
          <div><span>Nội dung</span><b class="tp-code">${esc(o.code)}</b><button class="btn small" data-cp="code">Chép</button></div>
          <div><span>Nhận được</span><b style="color:#7fd0ff">💎 ${fmt(o.knb)} Nguyên Bảo</b></div>
        </div>
        <div class="warn small">⚠ Ghi ĐÚNG nội dung <b>${esc(o.code)}</b> và ĐÚNG số tiền. Sai nội dung sẽ không đối chiếu được đơn.</div>
        <div class="small muted">Chuyển xong, Nguyên Bảo sẽ được cộng khi quản trị viên xác nhận (thường trong vài phút – vài giờ). Bạn sẽ nhận thông báo trong game, kể cả khi đang offline vẫn được cộng.</div>
        <div class="row" style="gap:6px;margin-top:6px"><button class="btn" data-back="1">← Chọn số tiền khác</button><button class="btn red" data-cancel="${esc(o.code)}">Huỷ đơn này</button></div></div>`;
    } else {
      h += `<div class="card"><h4>Chọn số tiền nạp</h4><div class="small muted">Tỉ lệ: <b>1.000đ = ${d.rate} Nguyên Bảo</b> · chuyển khoản ${esc(b.bankName)} qua mã QR</div>
        <div class="tp-grid">${d.presets.map(a => `<button class="tp-opt ${a === amt ? 'on' : ''}" data-a="${a}"><b>${fmt(a)}đ</b><span>💎 ${fmt(knb(a))}</span></button>`).join('')}</div>
        <div class="row" style="gap:6px;align-items:center"><label class="small">Số khác</label><input id="tp-amt" type="number" min="${d.min}" max="${d.max}" step="1000" value="${amt}" style="width:130px"> đ
          <span class="small" id="tp-knb">= 💎 ${fmt(knb(amt))}</span></div>
        <button class="btn primary big" id="tp-go" style="margin-top:8px">📱 Tạo mã QR nạp ${fmt(amt)}đ</button>
        <div class="small muted">Tối thiểu ${fmt(d.min)}đ · tối đa ${fmt(d.max)}đ mỗi đơn.</div></div>`;
    }
    h += `<div class="card"><h4>📜 Đơn nạp của bạn</h4>${d.orders.length ? '<div class="list">' + d.orders.map(x => `<div class="li tp-row"><div class="grow"><b>${esc(x.code)}</b> · ${fmt(x.amount)}đ → 💎 ${fmt(x.knb)}
        <div class="sub">${new Date(x.at).toLocaleString('vi-VN')}${x.note ? ' · ' + esc(x.note) : ''}</div></div><span style="color:${(ST[x.status] || [])[1]}">${(ST[x.status] || [x.status])[0]}</span>
        ${x.status === 'pending' ? `<button class="btn small" data-show="${esc(x.code)}">Xem QR</button>` : ''}</div>`).join('') + '</div>' : '<p class="small muted">Chưa có đơn nạp nào.</p>'}</div>`;
    body.innerHTML = h;
    body.querySelectorAll('[data-a]').forEach(x => x.onclick = () => { amt = +x.dataset.a; UI.refreshPanel(); });
    const inp = body.querySelector('#tp-amt');
    if (inp) inp.oninput = () => { amt = Math.max(0, Math.round(+inp.value || 0)); body.querySelector('#tp-knb').textContent = `= 💎 ${fmt(knb(Math.round(amt / 1000) * 1000))}`; body.querySelector('#tp-go').textContent = `📱 Tạo mã QR nạp ${fmt(Math.round(amt / 1000) * 1000)}đ`; body.querySelectorAll('.tp-opt').forEach(e => e.classList.toggle('on', +e.dataset.a === amt)); };
    const go = body.querySelector('#tp-go'); if (go) go.onclick = () => emit({ op: 'create', amount: Math.round(amt / 1000) * 1000 });
    body.querySelectorAll('[data-show]').forEach(x => x.onclick = () => { show = x.dataset.show; UI.refreshPanel(); });
    body.querySelectorAll('[data-back]').forEach(x => x.onclick = () => { show = null; UI.refreshPanel(); });
    body.querySelectorAll('[data-cancel]').forEach(x => x.onclick = () => G.modal('Huỷ đơn nạp này? (Chỉ huỷ khi bạn CHƯA chuyển tiền)', [{ t: 'Huỷ đơn', cls: 'red', fn: () => { show = null; emit({ op: 'cancel', code: x.dataset.cancel }); } }, { t: 'Không' }]));
    body.querySelectorAll('[data-cp]').forEach(x => x.onclick = () => { const k = x.dataset.cp; copy(k === 'acc' ? b.acc : k === 'amt' ? String(o.amount) : o.code, k === 'acc' ? 'số tài khoản' : k === 'amt' ? 'số tiền' : 'nội dung'); });
  }, () => { emit({ op: 'view' }); });

  function bind(s) {
    s.on('topup', d => { data = d; if (d.open) show = d.open; if (UI.panelName() === 'topup') UI.refreshPanel(); });
  }
  // bấm vào số Nguyên Bảo trên HUD để mở bảng nạp
  setTimeout(function hook() { const e = document.getElementById('hud-knb-box'); if (!e) return setTimeout(hook, 1000); e.style.cursor = 'pointer'; e.addEventListener('pointerdown', ev => ev.stopPropagation()); e.addEventListener('click', ev => { ev.stopPropagation(); UI.openPanel('topup'); }); }, 500);
  window.Topup = { bind, open: () => UI.openPanel('topup') };
})();
