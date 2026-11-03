// Tàng Bảo Đồ (máy chủ: server/game/treasure.js): bảng đọc câu đố + nút ⛏ Đào nổi khi đứng đúng chỗ (máy chủ báo, không lộ toạ độ).
(function () {
  const emit = d => G.socket.emit('treasure', d);
  const esc = s => UI.esc(String(s == null ? '' : s));
  let data = null, near = null, digEl = null, barEl = null, digTimer = 0;

  UI.registerPanel('treasure', '📜 Tàng Bảo Đồ', body => {
    const d = data;
    if (!d) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    if (!d.list.length) { body.innerHTML = '<p class="muted">Bạn chưa có Tàng Bảo Đồ hoàn chỉnh. Gom 4 Mảnh Tàng Bảo Đồ (rơi từ Boss bang) rồi Sử dụng để ghép.</p>'; return; }
    body.innerHTML = d.list.map((t, k) => `<div class="tb-paper ${near && near.i === t.i ? (near.lv >= 2 ? 'hot' : 'warm') : ''}">
        <div class="tb-h">📜 Tàng Bảo Đồ${d.list.length > 1 ? ' #' + (k + 1) : ''}</div>
        <div class="tb-clue">“${esc(t.clue)}”</div>
        <div class="tb-way">🧭 ${esc(t.way)}</div>
        <div class="tb-st">${near && near.i === t.i ? (near.lv >= 2 ? '✨ Tàng Bảo Đồ phát sáng – kho báu ngay dưới chân!' : '🔍 Bản đồ rung lên – kho báu ở rất gần đây…') : '<span class="muted">Hãy giải câu đố để tìm ra bản đồ, rồi lần theo lối đi từ mốc NPC.</span>'}</div>
        ${near && near.i === t.i && near.lv >= 2 ? '<button class="btn primary big" data-tbdig="1">⛏ Đào</button>' : ''}
      </div>`).join('') + '<div class="small muted">1 bước = 1 ô đất. Đông = phải, Tây = trái, Bắc = lên, Nam = xuống. Đào mất 3 giây, phải đứng yên.</div>';
    body.querySelectorAll('[data-tbdig]').forEach(b => b.onclick = () => { emit({ op: 'dig' }); UI.closePanel(); });
  }, () => { emit({ op: 'view' }); });

  function digBtn() {
    const show = near && near.lv >= 2;
    if (show && !digEl) {
      digEl = document.createElement('button'); digEl.id = 'tb-dig'; digEl.className = 'btn primary'; digEl.innerHTML = '⛏ Đào kho báu';
      digEl.addEventListener('pointerdown', e => e.stopPropagation());
      digEl.onclick = e => { e.stopPropagation(); emit({ op: 'dig' }); };
      document.body.appendChild(digEl);
    } else if (!show && digEl) { digEl.remove(); digEl = null; }
  }
  function onDig(d) {
    const stop = () => { if (barEl) { barEl.remove(); barEl = null; } clearTimeout(digTimer); };
    if (d.cancel) return stop();
    if (d.done) { stop(); GameAudio.sfx('enhOk'); return; }
    stop();
    barEl = document.createElement('div'); barEl.id = 'tb-bar'; barEl.innerHTML = '<span>⛏ Đang đào…</span><div><i style="animation-duration:' + (d.ms || 3000) + 'ms"></i></div>';
    document.body.appendChild(barEl);
    GameAudio.sfx('hit');
    digTimer = setTimeout(stop, (d.ms || 3000) + 1500);
  }
  function bind(s) {
    s.on('treasure', d => { data = d; if (d.near !== undefined) near = d.near; if (UI.panelName() === 'treasure') UI.refreshPanel(); else UI.openPanel('treasure'); });
    s.on('tbNear', d => {
      const was = near && near.lv; near = d; digBtn();
      if (d && d.lv !== was) UI.toast(d.lv >= 2 ? '✨ Tàng Bảo Đồ phát sáng – kho báu ngay dưới chân bạn! Bấm ⛏ Đào.' : '🔍 Tàng Bảo Đồ rung lên – kho báu ở rất gần…', 'reward');
      if (UI.panelName() === 'treasure') UI.refreshPanel();
    });
    s.on('tbDig', onDig);
  }
  window.TreasureUI = { bind };
})();
