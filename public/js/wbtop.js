// Bảng Top sát thương boss thế giới: hiện khi đứng trong bản đồ có boss thế giới đang sống (máy chủ gửi 'wbTop' mỗi 1,5 giây).
// Bấm tiêu đề để thu gọn / mở. Không nhận tin quá 4 giây (rời bản đồ, boss chết) thì tự ẩn.
(function () {
  let box = null, last = 0, mini = false;
  try { const v = localStorage.getItem('vl_wbmini'); mini = v == null ? !!(window.Input && Input.isTouch) : v === '1'; } catch (e) { }   // điện thoại: mặc định thu gọn
  const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
  function ensure() {
    if (box) return box;
    box = document.createElement('div'); box.id = 'wb-top';
    box.innerHTML = '<div class="wb-h"><b>🌍 Top sát thương</b><span class="wb-n"></span><i class="wb-t">▾</i></div><div class="wb-hp"><i></i><span></span></div><ol class="wb-l"></ol><div class="wb-me"></div>';
    box.querySelector('.wb-h').onclick = () => { mini = !mini; try { localStorage.setItem('vl_wbmini', mini ? '1' : '0'); } catch (e) { } box.classList.toggle('mini', mini); };
    box.classList.toggle('mini', mini);
    const host = document.getElementById('screen-game') || document.body;
    host.appendChild(box);
    return box;
  }
  function onTop(d) {
    const b = ensure(); last = performance.now();
    b.classList.remove('hidden');
    b.querySelector('.wb-n').textContent = `${d.name} · ${d.n} người`;
    const pct = d.maxHp ? d.hp / d.maxHp : 0;
    b.querySelector('.wb-hp i').style.width = (pct * 100).toFixed(1) + '%';
    b.querySelector('.wb-hp span').textContent = `${fmt(d.hp)} / ${fmt(d.maxHp)} · ${(pct * 100).toFixed(1)}%`;
    const me = G.me && G.me.name;
    b.querySelector('.wb-l').innerHTML = d.top.map(([n, dmg, p], i) =>
      `<li class="${n === me ? 'me' : ''} r${i + 1}"><span class="wb-r">${i + 1}</span><span class="wb-nm">${UI.esc(n)}</span><span class="wb-d">${fmt(dmg)}</span><span class="wb-p">${p}%</span></li>`).join('') || '<li class="muted">Chưa ai gây sát thương</li>';
    b.querySelector('.wb-me').innerHTML = d.me ? `Bạn: hạng <b>${d.me[0]}</b> · ${fmt(d.me[1])} (${d.me[2]}%)` : 'Bạn chưa gây sát thương';
  }
  setInterval(() => { if (box && performance.now() - last > 4000) box.classList.add('hidden'); }, 1000);
  window.WBTop = { onTop };
})();
