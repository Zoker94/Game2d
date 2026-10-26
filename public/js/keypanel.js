// Bảng Cài đặt phím: mỗi hành động 2 phím bàn phím + 1 nút tay cầm. Chạm ô rồi bấm phím / nút mới
// (Esc: huỷ, Delete / Backspace: xoá). Trùng phím thì phím đó chuyển sang hành động mới. Lưu trên máy (localStorage).
(function () {
  const B = Input.binds, esc = s => UI.esc(s);
  let wait = null;   // { id, kind, i } ô đang chờ
  function cancelWait() { wait = null; B.capture = null; B.padCapture = null; }
  function done(moved) { if (moved) UI.toast(`Phím này đã chuyển từ "${moved}" sang hành động mới`, 'info'); cancelWait(); UI.refreshPanel(); }
  UI.registerPanel('keys', '⌨️ Cài đặt phím', body => {
    const b = B.get(), pad = (navigator.getGamepads && [...navigator.getGamepads()].find(p => p && p.connected));
    const cell = (id, kind, i) => {
      const w = wait && wait.id === id && wait.kind === kind && wait.i === i;
      const v = kind === 'key' ? B.keyName((b.keys[id] || [])[i]) : B.padName(b.pad[id]);
      return `<button class="kb-cell ${w ? 'wait' : ''} ${v ? '' : 'empty'}" data-kb="${id}|${kind}|${i}">${w ? (kind === 'key' ? 'Bấm phím…' : 'Bấm nút…') : esc(v || '—')}</button>`;
    };
    body.innerHTML = `<div class="small muted" style="margin-bottom:6px">Chạm vào ô rồi bấm phím mới trên bàn phím hoặc nút trên tay cầm. <b>Esc</b> huỷ, <b>Delete</b> xoá phím. Esc luôn dùng để đóng bảng.
      ${pad ? `<br><span style="color:#4ade80">🎮 Đang kết nối: ${esc(pad.id.slice(0, 40))}</span>` : '<br>🎮 Chưa thấy tay cầm (bấm một nút bất kỳ trên tay cầm để kết nối). Cần gạt trái / D-pad luôn dùng để di chuyển.'}</div>
      <table class="kb-tbl"><tr><th>Hành động</th><th>Phím 1</th><th>Phím 2</th><th>Tay cầm</th></tr>
      ${B.ACTIONS.map(([id, name, ev]) => `<tr><td>${esc(name)}</td><td>${cell(id, 'key', 0)}</td><td>${cell(id, 'key', 1)}</td><td>${ev ? cell(id, 'pad', 0) : '<span class="muted small">cần gạt</span>'}</td></tr>`).join('')}</table>
      <div class="row" style="margin-top:8px"><button class="btn small" id="kb-reset">↺ Khôi phục mặc định</button></div>`;
    body.querySelectorAll('[data-kb]').forEach(el => el.onclick = () => {
      const [id, kind, i] = el.dataset.kb.split('|');
      cancelWait(); wait = { id, kind, i: +i };
      if (kind === 'key') B.capture = code => {
        if (code === 'Escape') { cancelWait(); return UI.refreshPanel(); }
        done(B.set(id, 'key', +i, code === 'Delete' || code === 'Backspace' ? null : code));
      };
      else {
        B.padCapture = btn => done(B.set(id, 'pad', 0, btn));
        B.capture = code => { if (code === 'Delete' || code === 'Backspace') done(B.set(id, 'pad', 0, null)); else { cancelWait(); UI.refreshPanel(); } };
      }
      UI.refreshPanel();
    });
    body.querySelector('#kb-reset').onclick = () => { cancelWait(); B.reset(); UI.toast('Đã khôi phục phím mặc định', 'info'); UI.refreshPanel(); };
  }, () => cancelWait());
  setInterval(() => { if (wait && UI.panelName() !== 'keys') cancelWait(); }, 300);   // đóng bảng giữa chừng: thôi chờ phím
})();
