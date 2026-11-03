// Popup chào mừng khi vào game (máy chủ: server/game/welcome.js – sửa nội dung ở trang quản trị › Cấu hình server).
// Tiêu đề vàng chạy ánh kim, khung lụa đỏ, đèn lồng; khối "X2 NẠP LẦN ĐẦU" có tia sáng xoay + chữ nhảy; gift code tân thủ bấm nhận luôn.
(function () {
  const esc = s => UI.esc(String(s == null ? '' : s));
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const KEY = 'vl_welcome_hide';
  let el = null;
  const today = () => new Date().toISOString().slice(0, 10);
  const hidden = () => { try { return localStorage.getItem(KEY) === today(); } catch (e) { return false; } };

  function rewardText(r) {
    if (!r) return '';
    const parts = [];
    if (r.knb) parts.push(`<b class="wc-knb">💎 ${fmt(r.knb)} Nguyên Bảo</b>`);
    if (r.gold) parts.push(`<b class="wc-gold">💰 ${fmt(r.gold)} ngân lượng</b>`);
    for (const [id, n] of r.items || []) { const it = G.data.items[id]; if (it) parts.push(`<span class="wc-it"><img src="${UI.iconUrl(id)}" width="18" height="18">${esc(it.name)} x${n}</span>`); }
    return parts.join('');
  }
  function close() {
    if (!el) return;
    try { if (el.querySelector('#wc-hide').checked) localStorage.setItem(KEY, today()); } catch (e) { }
    const e = el; el = null; e.classList.add('out'); setTimeout(() => e.remove(), 350);
  }
  function show(d) {
    if (el || hidden()) return;
    el = document.createElement('div'); el.className = 'wc';
    const lantern = i => `<i class="wc-lan" style="left:${8 + i * 21}%;animation-delay:${-i * 0.7}s"></i>`;
    el.innerHTML = `<div class="wc-box">
      ${[0, 1, 2, 3, 4].map(lantern).join('')}
      <button class="wc-x" title="Đóng">✕</button>
      <div class="wc-title">${esc(d.title)}</div>
      ${d.sub ? `<div class="wc-sub">${esc(d.sub)}</div>` : ''}
      ${d.x2On ? `<div class="wc-x2 ${d.x2 ? '' : 'used'}"><div class="wc-rays"></div>
        <div class="wc-x2-big"><span>X</span><span>2</span></div>
        <div class="wc-x2-t">${d.x2 ? 'NẠP LẦN ĐẦU – NHẬN GẤP ĐÔI NGUYÊN BẢO' : 'Bạn đã nhận ưu đãi x2 nạp lần đầu'}</div>
        ${d.x2 ? `<div class="wc-x2-s">Nạp 20.000đ nhận <s>40</s> <b>80 💎</b> · nạp 100.000đ nhận <s>200</s> <b>400 💎</b><br>Chỉ áp dụng cho lần nạp đầu tiên của mỗi nhân vật!</div>
        <button class="wc-go">💎 NẠP NGAY – NHẬN X2</button>` : ''}</div>` : ''}
      ${d.gift ? `<div class="wc-gift"><div class="wc-gh">🎁 GIFT CODE TÂN THỦ</div>
        <div class="wc-code"><span>${esc(d.gift.code)}</span><button class="wc-copy">Chép</button></div>
        <div class="wc-rw">${rewardText(d.gift.reward)}</div>
        <button class="btn primary wc-claim" ${d.gift.used ? 'disabled' : ''}>${d.gift.used ? '✔ Đã nhận' : '🎁 Nhận quà ngay'}</button></div>` : ''}
      ${d.features && d.features.length ? `<div class="wc-feat"><div class="wc-fh">✨ ĐIỂM NỔI BẬT CỦA MÁY CHỦ</div><ul>${d.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
      <label class="wc-hide"><input type="checkbox" id="wc-hide"> Không hiện lại hôm nay</label>
    </div>`;
    document.body.appendChild(el);
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.querySelector('.wc-x').onclick = close;
    el.onclick = e => { if (e.target === el) close(); };
    const go = el.querySelector('.wc-go'); if (go) go.onclick = () => { close(); if (window.Topup) Topup.open(); };
    const cp = el.querySelector('.wc-copy'); if (cp) cp.onclick = () => { try { navigator.clipboard.writeText(d.gift.code); cp.textContent = 'Đã chép'; } catch (e) { } };
    const cl = el.querySelector('.wc-claim'); if (cl) cl.onclick = () => { if (cl.disabled) return; cl.disabled = true; cl.textContent = '✔ Đã nhận'; G.socket.emit('giftcode', { code: d.gift.code }); };
    try { GameAudio.sfx('level'); } catch (e) { }
  }
  window.Welcome = { bind(s) { s.on('welcome', show); }, show, close };
})();
