// Bia Chỉ Dẫn Giang Hồ (máy chủ: server/data/guide.js): cẩm nang A–Z, chọn mục bên trái, tìm nhanh theo chữ (VD "đá khảm", "di thư")
(function () {
  let box = null, list = [], cur = 0;
  const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();
  const strip = h => h.replace(/<[^>]+>/g, ' ');
  function close() { if (box) box.remove(); box = null; }
  function render(q) {
    const nav = box.querySelector('.gd-nav'), body = box.querySelector('.gd-body');
    const words = fold(q || '').split(/\s+/).filter(Boolean);
    const hit = list.map((s, i) => [s, i]).filter(([s]) => !words.length || words.every(w => fold(s.title + ' ' + strip(s.html)).includes(w)));
    if (words.length && hit.length && !hit.some(([, i]) => i === cur)) cur = hit[0][1];
    nav.innerHTML = hit.map(([s, i]) => `<button data-i="${i}" class="${i === cur ? 'on' : ''}">${s.icon} ${UI.esc(s.title)}</button>`).join('') || '<p class="muted small">Không tìm thấy</p>';
    nav.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { cur = +b.dataset.i; render(box.querySelector('.gd-q').value); body.scrollTop = 0; });
    const s = list[cur];
    body.innerHTML = hit.length ? `<h3>${s.icon} ${UI.esc(s.title)}</h3>${s.html}` : '';
    if (words.length) for (const w of words) body.querySelectorAll('li, p').forEach(el => { if (fold(el.textContent).includes(w)) el.classList.add('gd-hit'); });
  }
  function open(d) {
    close(); list = d.guide || []; cur = 0;
    box = document.createElement('div'); box.id = 'guide';
    box.innerHTML = `<div class="gd-box"><div class="gd-h"><b>🪧 ${UI.esc(d.name || 'Bia Chỉ Dẫn Giang Hồ')}</b><input class="gd-q" type="search" placeholder="🔍 Tìm: đá khảm, di thư, boss, áp tiêu…" autocomplete="off"><button class="gd-x" title="Đóng">✕</button></div>
      <div class="gd-main"><div class="gd-nav"></div><div class="gd-body"></div></div></div>`;
    document.body.appendChild(box);
    box.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === box) close(); });
    box.querySelector('.gd-x').onclick = close;
    const q = box.querySelector('.gd-q'); q.oninput = () => render(q.value);
    render('');
  }
  window.Guide = { open, close };
  window.addEventListener('keydown', e => { if (box && e.key === 'Escape' && !(e.target && e.target.classList && e.target.classList.contains('gd-q') && e.target.value)) close(); });
})();
