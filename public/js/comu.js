// Cổ Mộ Bí Cảnh (server/game/comu.js): bảng hỏi 60 giây khi phát hiện lối vào + khung đếm ngược 30 phút trong Cổ Mộ.
(function () {
  let st = null, skew = 0, offer = null;
  const emit = (e, d) => G.socket.emit(e, d);
  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  function showOffer(d) {
    const old = document.getElementById('comu-offer');
    if (old) old.remove();
    offer = d;
    if (!d) return;
    const end = performance.now() + Math.max(0, d.until - d.now);
    const el = document.createElement('div'); el.id = 'comu-offer';
    el.innerHTML = `<div class="cm-card"><div class="cm-ico">🪦</div><div class="cm-t">Phát hiện lối vào ${UI.esc(d.name)}!</div>
      <div class="cm-x">Giữa lúc luyện công, bạn thấy một khe đá tỏa âm khí dẫn xuống cổ mộ bị lãng quên. Bên trong quái <b>yếu hơn</b> nhưng cho <b>nhiều kinh nghiệm và ngân lượng</b>.<br>Cổ Mộ chỉ mở <b>${d.life} phút</b>, mỗi ngày gặp <b>1 lần</b>.</div>
      <div class="cm-bar"><i></i></div>
      <div class="cm-row"><button class="btn primary" data-cm="enter">🪦 Vào Cổ Mộ <b class="cm-n">60</b></button><button class="btn" data-cm="skip">Bỏ qua</button></div></div>`;
    document.body.appendChild(el);
    el.querySelectorAll('[data-cm]').forEach(b => b.onclick = e => { e.stopPropagation(); emit('comu', { op: b.dataset.cm }); el.remove(); offer = null; });
    const total = Math.max(1, end - performance.now());
    const t = setInterval(() => {
      if (!el.isConnected) return clearInterval(t);
      const left = Math.max(0, end - performance.now());
      el.querySelector('.cm-n').textContent = Math.ceil(left / 1000);
      el.querySelector('.cm-bar i').style.width = (left / total * 100) + '%';
      el.classList.toggle('hurry', left < 10000);
      if (left <= 0) { clearInterval(t); el.remove(); offer = null; }
    }, 200);
    if (window.GameAudio && GameAudio.sfx) try { GameAudio.sfx('enhOk'); } catch (e) { }
  }
  function hud() {
    let h = document.getElementById('comu-hud');
    if (!st) { if (h) h.remove(); return; }
    if (!h) {
      h = document.createElement('div'); h.id = 'comu-hud'; document.getElementById('screen-game').appendChild(h);
      h.onclick = e => { if (e.target.closest('[data-cmleave]')) G.modal('Rời Cổ Mộ? Lối vào sẽ khép lại, hôm nay không vào lại được.', [{ t: 'Rời', cls: 'primary', fn: () => emit('comu', { op: 'leave' }) }, { t: 'Ở lại' }]); };
    }
    const left = Math.max(0, Math.round((st.endAt - (Date.now() + skew)) / 1000));
    const html = `<div class="cm-hh">🪦 ${UI.esc(st.name)}<button data-cmleave>Rời</button></div><div class="cm-tm ${left < 120 ? 'warn' : ''}">⏳ Lối ra khép sau <b>${mmss(left)}</b></div><div class="cm-tip">Quái yếu · KN ×2,5 · con nào cũng rơi bạc</div>`;
    if (h._h !== html) { h.innerHTML = html; h._h = html; }
  }
  setInterval(hud, 500);
  function bind(s) {
    s.on('comuOffer', d => showOffer(d));
    s.on('comu', d => { st = d; if (d && d.now) skew = d.now - Date.now(); hud(); });
  }
  window.Comu = { bind, get state() { return st; } };
})();
