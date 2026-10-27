// Bảng công cụ GM cho tài khoản quản trị: bật / tắt tàng hình, miễn PK, hồi đầy, đi nhanh tới bản đồ,
// danh sách người chơi đang online (tới chỗ / kéo về / kick) để tiện theo dõi. Mọi thao tác gửi lệnh "/..." qua chat,
// máy chủ kiểm tra quyền (features.adminCommand).
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => UI.esc(String(s == null ? '' : s));
  const cmd = t => G.socket && G.socket.emit('chat', { ch: 'world', text: t });
  let list = null, q = '', listAt = 0;

  function refresh() { listAt = Date.now(); cmd('/gmlist'); }
  UI.registerPanel('gm', '👁️ Công cụ GM', body => {
    const g = (G.me && G.me.gm) || {};
    const maps = Object.entries(G.data.maps || {}).filter(([, m]) => !m.duel).map(([id, m]) => `<option value="${id}" ${G.map && G.map.id === id ? 'selected' : ''}>${esc(m.name)}${m.lv ? ' · ' + esc(m.lv) : ''}</option>`).join('');
    const rows = (list || []).filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()));
    body.innerHTML = `
      <div class="gm-tg">
        <button class="btn ${g.hide ? 'primary' : ''}" data-gm="/an">${g.hide ? '👻 Tàng hình: BẬT' : '👻 Tàng hình: tắt'}</button>
        <button class="btn ${g.safe ? 'primary' : ''}" data-gm="/mienpk">${g.safe ? '🛡️ Miễn PK: BẬT' : '🛡️ Miễn PK: tắt'}</button>
        <button class="btn" data-gm="/heal">❤️ Hồi đầy</button>
      </div>
      <div class="small muted">Tàng hình: người chơi không thấy bạn trên bản đồ / danh sách online, quái không đánh bạn. Miễn PK: người chơi (kể cả đồ sát) không đánh được bạn. Tài khoản quản trị không lên bảng xếp hạng.</div>
      <div class="gm-row"><select id="gm-map">${maps}</select><button class="btn small green" id="gm-tp">🚀 Tới bản đồ</button></div>
      <div class="gm-row"><input id="gm-q" placeholder="🔍 Tìm người chơi" value="${esc(q)}"><button class="btn small" id="gm-ref">🔄 Làm mới</button></div>
      <div class="list gm-list">${list ? rows.map(p => `<div class="li"><div class="grow"><b>${esc(p.name)}</b>${p.me ? ' <span class="small muted">(bạn)</span>' : ''}${p.hide ? ' <span class="small">👻</span>' : ''}${p.off ? ' <span class="small muted">· treo máy</span>' : ''}
        <div class="sub">Cấp ${p.lv} · ${esc(p.map)}${p.pk >= 3 ? ` · <span style="color:#ff5050">☠ Sát khí ${p.pk}</span>` : p.pk ? ` · Sát khí ${p.pk}` : ''}</div></div>
        ${p.me ? '' : `<button class="btn small" data-go="${esc(p.name)}" title="Dịch chuyển tới chỗ người này">🏃 Tới</button><button class="btn small" data-pull="${esc(p.name)}" title="Kéo người này tới chỗ bạn">🧲 Kéo</button><button class="btn small red" data-kick="${esc(p.name)}">👢</button>`}</div>`).join('') || '<p class="muted">Không có ai.</p>' : '<p class="muted">Đang tải...</p>'}</div>
      <div class="small muted">${list ? list.length + ' người online' : ''}</div>`;
    body.querySelectorAll('[data-gm]').forEach(b => b.onclick = () => cmd(b.dataset.gm));
    $('gm-tp').onclick = () => cmd('/tp ' + $('gm-map').value);
    $('gm-ref').onclick = refresh;
    const inp = $('gm-q');
    inp.oninput = () => { q = inp.value; const pos = inp.selectionStart; UI.refreshPanel(); const n = $('gm-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } };
    body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => cmd('/goto ' + b.dataset.go));
    body.querySelectorAll('[data-pull]').forEach(b => b.onclick = () => cmd('/keo ' + b.dataset.pull));
    body.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => G.modal(`Mời ${b.dataset.kick} ra khỏi game?`, [{ t: 'Kick', cls: 'red', fn: () => cmd('/kick ' + b.dataset.kick) }, { t: 'Huỷ' }]));
  }, () => { if (!list || Date.now() - listAt > 5000) refresh(); });

  let bound = false, lastG = '';
  window.GM = {
    // gọi mỗi lần nhận 'me': hiện nút GM cho quản trị viên, vẽ lại bảng khi đổi trạng thái
    sync() {
      const me = G.me, btn = $('btn-gm');
      if (!btn || !me) return;
      btn.classList.toggle('hidden', !me.gm);
      if (me.gm && !bound) { bound = true; btn.onclick = () => UI.togglePanel('gm'); }
      const k = JSON.stringify(me.gm || {});
      if (k !== lastG) { lastG = k; btn.classList.toggle('on', !!(me.gm && (me.gm.hide || me.gm.safe))); if (UI.panelName() === 'gm') UI.refreshPanel(); }
    },
    onList(d) { list = Array.isArray(d) ? d : []; if (UI.panelName() === 'gm') UI.refreshPanel(); }
  };
})();
