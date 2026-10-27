// Bảng Cài đặt phím: mỗi hành động 2 phím bàn phím + 2 nút tay cầm. Chạm ô rồi bấm phím / nút mới
// (Esc: huỷ, Delete / Backspace: xoá). Tay cầm: bấm 1 nút rồi thả = nút đơn; giữ 1 nút rồi bấm thêm nút khác = tổ hợp (vd LB+A).
// Trùng phím thì phím đó chuyển sang hành động mới. Lưu trên máy (localStorage).
// Chơi bằng tay cầm: Back+Start mở bảng; D-pad / cần gạt chọn ô, A gán, X xoá, B đóng.
(function () {
  const B = Input.binds, esc = s => UI.esc(s);
  const COLS = [['key', 0], ['key', 1], ['pad', 0], ['pad', 1]];
  let wait = null;          // { id, kind, i } ô đang chờ
  let fr = 0, fc = 2;       // ô đang chọn bằng tay cầm (hàng, cột) – mặc định cột Tay cầm 1
  function cancelWait() { wait = null; B.capture = null; B.padCapture = null; }
  function done(moved) { if (moved) UI.toast(`Nút này đã chuyển từ "${moved}" sang hành động mới`, 'info'); cancelWait(); UI.refreshPanel(); }
  function start(id, kind, i) {
    cancelWait(); wait = { id, kind, i };
    if (kind === 'key') B.capture = code => {
      if (code === 'Escape') { cancelWait(); return UI.refreshPanel(); }
      done(B.set(id, 'key', i, code === 'Delete' || code === 'Backspace' ? null : code));
    };
    else {
      B.padCapture = v => done(B.set(id, 'pad', i, v));
      B.capture = code => { if (code === 'Delete' || code === 'Backspace') done(B.set(id, 'pad', i, null)); else { cancelWait(); UI.refreshPanel(); } };
    }
    UI.refreshPanel();
  }
  // điều khiển bảng bằng tay cầm
  function nav(cmd) {
    if (wait) return;
    const ids = B.ACTIONS.map(a => a[0]);
    if (cmd === 'up') fr = Math.max(0, fr - 1);
    else if (cmd === 'down') fr = Math.min(ids.length - 1, fr + 1);
    else if (cmd === 'left') fc = Math.max(0, fc - 1);
    else if (cmd === 'right') fc = Math.min(3, fc + 1);
    else if (cmd === 'back') return UI.closePanel();
    else {
      const id = ids[fr], [kind, i] = COLS[fc];
      if (kind === 'pad' && !B.ACTIONS[fr][2]) return;   // di chuyển: luôn là cần gạt / D-pad
      if (cmd === 'ok') return start(id, kind, i);
      if (cmd === 'clear') { B.set(id, kind, i, null); return UI.refreshPanel(); }
    }
    UI.refreshPanel();
    const f = document.querySelector('.kb-cell.focus'); if (f) f.scrollIntoView({ block: 'nearest' });
  }
  UI.registerPanel('keys', '⌨️ Cài đặt phím', body => {
    const b = B.get(), pad = (navigator.getGamepads && [...navigator.getGamepads()].find(p => p && p.connected));
    const cell = (r, id, kind, i) => {
      const w = wait && wait.id === id && wait.kind === kind && wait.i === i;
      const v = kind === 'key' ? B.keyName((b.keys[id] || [])[i]) : B.padName((b.pad[id] || [])[i]);
      const foc = pad && !wait && r === fr && COLS[fc][0] === kind && COLS[fc][1] === i;
      return `<button class="kb-cell ${w ? 'wait' : ''} ${foc ? 'focus' : ''} ${v ? '' : 'empty'}" data-kb="${id}|${kind}|${i}">${w ? (kind === 'key' ? 'Bấm phím…' : 'Bấm nút…') : esc(v || '—')}</button>`;
    };
    body.innerHTML = `<div class="small muted" style="margin-bottom:6px">Chạm vào ô rồi bấm phím mới trên bàn phím hoặc nút trên tay cầm. <b>Esc</b> huỷ, <b>Delete</b> xoá. Esc luôn dùng để đóng bảng.
      <br>🎮 Tay cầm: bấm 1 nút rồi thả = gán nút đơn; <b>giữ 1 nút rồi bấm thêm nút khác</b> = gán tổ hợp (vd <b>LB+A</b>) – nút giữ nếu có việc riêng sẽ chạy khi thả ra. Nút D-pad chưa gán việc gì thì dùng để đi.
      ${pad ? `<br><span style="color:#4ade80">🎮 Đang kết nối: ${esc(pad.id.slice(0, 40))}</span> – <b>D-pad</b> chọn ô, <b>A</b> gán, <b>X</b> xoá, <b>B</b> đóng. Mở bảng này bằng tay cầm: <b>${esc(B.padName((b.pad.keyspanel || [])[0]) || 'chưa gán')}</b>.` : '<br>🎮 Chưa thấy tay cầm (bấm một nút bất kỳ trên tay cầm để kết nối). Cần gạt trái luôn dùng để di chuyển.'}</div>
      <table class="kb-tbl"><tr><th>Hành động</th><th>Phím 1</th><th>Phím 2</th><th>Tay cầm 1</th><th>Tay cầm 2</th></tr>
      ${B.ACTIONS.map(([id, name, ev], r) => `<tr><td>${esc(name)}</td><td>${cell(r, id, 'key', 0)}</td><td>${cell(r, id, 'key', 1)}</td>${ev ? `<td>${cell(r, id, 'pad', 0)}</td><td>${cell(r, id, 'pad', 1)}</td>` : '<td colspan="2"><span class="muted small">cần gạt / D-pad</span></td>'}</tr>`).join('')}</table>
      <div class="row" style="margin-top:8px"><button class="btn small" id="kb-reset">↺ Khôi phục mặc định</button></div>`;
    body.querySelectorAll('[data-kb]').forEach(el => el.onclick = () => { const [id, kind, i] = el.dataset.kb.split('|'); start(id, kind, +i); });
    body.querySelector('#kb-reset').onclick = () => { cancelWait(); B.reset(); UI.toast('Đã khôi phục phím mặc định', 'info'); UI.refreshPanel(); };
  }, () => { cancelWait(); B.padNav = nav; });
  // đóng bảng giữa chừng: thôi chờ phím, trả tay cầm về điều khiển nhân vật
  setInterval(() => { if (UI.panelName() !== 'keys') { if (wait) cancelWait(); B.padNav = null; } }, 200);
})();
