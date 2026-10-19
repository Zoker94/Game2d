// Đi lại nhanh: Hồi Thành Phù (nút 🏠 / phím H) niệm phép rồi về thành gần nhất, thanh niệm phép giữa màn hình.
(function () {
  const $ = id => document.getElementById(id);
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  let cast = null;

  function bar() {
    let b = $('recall-bar');
    if (!cast) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'recall-bar'; b.innerHTML = '<div class="rb-t"></div><div class="rb-p"><i></i></div>'; $('screen-game').appendChild(b); }
    const k = Math.min(1, (performance.now() - cast.t0) / cast.ms);
    b.querySelector('.rb-t').textContent = `🏠 Đang niệm Hồi Thành Phù → ${cast.to}`;
    b.querySelector('i').style.width = (k * 100) + '%';
    if (k < 1) requestAnimationFrame(bar);
  }
  function onRecall(d) {
    if (d.cancel) { cast = null; bar(); UI.toast(`Niệm phép bị gián đoạn${d.why ? ': ' + d.why : ''}`, 'error'); return; }
    if (d.done) { cast = null; bar(); GameAudio.sfx('portal'); return; }
    cast = { ms: d.ms, to: d.to, t0: performance.now() };
    GameAudio.sfx('magic');
    bar();
  }
  // vòng sáng quanh người đang niệm phép (mọi người cùng thấy)
  function onFx(d) {
    if (d.t !== 'recall') return;
    const end = performance.now() + d.ms;
    const tick = () => {
      if (performance.now() > end) return;
      const e = d.id === G.you ? G.self : G.players.get(d.id);
      if (!e) return;
      const a = Math.random() * Math.PI * 2;
      FX.emit(1, e.x + Math.cos(a) * 26, e.y - 4 + Math.sin(a) * 9, { speed: 4, vy: -55, life: 700, size: 3, color: Math.random() < 0.5 ? '#9ef0ff' : '#ffe9a0' });
      setTimeout(tick, 60);
    };
    tick();
  }
  function use() {
    if (!G.me || G.me.dead) return;
    if (!G.me.inv.some(x => x.id === 'scroll_town')) return UI.toast('Hết Hồi Thành Phù! Mua ở Tạp Hóa (trong thành) hoặc Thương Nhân Lưu Động.', 'error');
    emit('recall');
  }
  function count() {
    const b = $('btn-recall');
    if (!b || !G.me) return;
    const n = G.me.inv.filter(x => x.id === 'scroll_town').reduce((a, x) => a + x.qty, 0);
    const el = b.querySelector('.qb-n');
    if (el._n !== n) { el.textContent = n; el._n = n; b.classList.toggle('empty', !n); }
  }
  function bind(s) {
    s.on('recall', onRecall);
    s.on('fx', onFx);
    s.on('me', () => setTimeout(count, 0));
  }
  document.addEventListener('DOMContentLoaded', () => { const b = $('btn-recall'); if (b) b.onclick = e => { e.stopPropagation(); use(); }; });
  Input.on('recall', use);
  window.Travel = { bind, use };
})();
