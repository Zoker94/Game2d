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
  // Đua Top Tuần: đếm ngược tới 00:00 Thứ 2, phần thưởng, 4 bảng top 3 + hạng của mình
  const MEDAL = ['🥇', '🥈', '🥉'];
  const short = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'tr' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : fmt(n);
  function raceHtml(r) {
    const rw = r.reward, itemN = (x, id) => ((x.items || []).find(i => i[0] === id) || [0, 0])[1];
    return `<div class="wc-race"><div class="wc-rh">🏆 ĐUA TOP TUẦN 🏆</div>
      <div class="wc-cd">Kết thúc sau <b id="wc-cd">…</b> · trao thưởng tự động 00:00 Thứ 2</div>
      <div class="wc-rwd"><span>🥇 <b>${rw[0].knb}💎</b> + ${itemN(rw[0], 'boss_chest')} Rương Thủ Lĩnh + ${itemN(rw[0], 'stone2')} Thiên Tinh Thạch</span><span>🥈 <b>${rw[1].knb}💎</b></span><span>🥉 <b>${rw[2].knb}💎</b></span><span>Top 4–10: <b>${rw[3].knb}💎</b></span></div>
      <div class="wc-boards">${r.boards.map(b => `<div class="wc-bd"><div class="wc-bt">${b.icon} ${esc(b.name)}</div>
        ${[0, 1, 2].map(i => b.top[i] ? `<div class="wc-row r${i}"><span>${MEDAL[i]} ${esc(b.top[i][0])}</span><b>${short(b.top[i][1])}</b></div>` : `<div class="wc-row empty"><span>${MEDAL[i]} Đang chờ anh hùng…</span></div>`).join('')}
        <div class="wc-me">${b.me ? `Bạn: hạng <b>${b.me}</b>` : 'Bạn chưa lọt bảng'} · ${short(b.mine)} ${esc(b.unit)}</div></div>`).join('')}</div>
      <div class="small wc-note">Mỗi bảng thưởng top 10. Cấp độ & Lực chiến tính theo hiện tại, Săn Boss & Nạp tuần tính trong tuần.</div></div>`;
  }
  function tickCd(end) {
    const e = el && el.querySelector('#wc-cd'); if (!e) return;
    const s = Math.max(0, Math.floor((end - Date.now()) / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    e.textContent = `${d ? d + ' ngày ' : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    setTimeout(() => tickCd(end), 1000);
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
      ${d.race ? raceHtml(d.race) : ''}
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
    if (d.race) tickCd(d.race.endsAt);
    try { GameAudio.sfx('level'); } catch (e) { }
  }
  window.Welcome = { bind(s) { s.on('welcome', show); }, show, close };
})();
