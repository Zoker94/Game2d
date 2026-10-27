// Công cụ GM cho tài khoản quản trị (gộp chung với "Bay" dịch chuyển nhanh): một nút 👁️ GM ở hàng nút cạnh bản đồ mini
// (phím `), mở hộp 3 thẻ: ⚙️ GM (tàng hình, miễn PK, hồi đầy) · 🗺️ Bản đồ (bay tới bản đồ bất kỳ) ·
// 👥 Người chơi (tới chỗ / kéo về / kick; chủ server tặng điểm). Mọi thao tác gửi lệnh "/..." qua chat,
// máy chủ kiểm tra quyền (features.adminCommand).
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => UI.esc(String(s == null ? '' : s));
  const cmd = t => G.socket && G.socket.emit('chat', { ch: 'world', text: t });
  const click = () => G.sfx && G.sfx('click');
  let tab = 'gm', pins = [], pinDraft = '', list = null, listAt = 0, q = '', ptsN = 100;

  const box = () => $('tp-box');
  function refresh() { listAt = Date.now(); cmd('/gmlist'); }
  function open() {
    if (box()) { box().remove(); return; }
    const b = document.createElement('div'); b.id = 'tp-box';
    b.innerHTML = `<div class="tp-h">👁️ Công cụ GM <span class="tp-x">✕</span></div>
      <div class="tp-tabs"><button data-tab="gm">⚙️ GM</button><button data-tab="map">🗺️ Bản đồ</button><button data-tab="pl">👥 Người chơi</button><button data-tab="pin">📌 Thông báo</button></div>
      <input class="tp-q" placeholder="Tìm tên..." maxlength="20"><div class="tp-list"></div>`;
    $('screen-game').appendChild(b);
    b.querySelector('.tp-x').onclick = () => b.remove();
    b.querySelectorAll('[data-tab]').forEach(t => t.onclick = () => { tab = t.dataset.tab; if (tab === 'pl') refresh(); if (tab === 'pin') cmd('/dsghim q'); render(); });
    const inp = b.querySelector('.tp-q'); inp.value = q;
    inp.oninput = () => { q = inp.value; render(); };
    inp.onkeydown = e => e.stopPropagation();
    if (tab === 'pl' && (!list || Date.now() - listAt > 5000)) refresh();
    render();
    setTimeout(() => document.addEventListener('pointerdown', function off(ev) {
      if (!b.isConnected) return document.removeEventListener('pointerdown', off, true);
      if (!b.contains(ev.target) && !ev.target.closest('#btn-gm') && !ev.target.closest('#modal-msg')) { b.remove(); document.removeEventListener('pointerdown', off, true); }
    }, true), 0);
  }
  const lvNum = lv => parseInt(lv, 10) || 0;
  function render() {
    const b = box(); if (!b) return;
    b.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
    b.querySelector('.tp-q').style.display = tab === 'gm' || tab === 'pin' ? 'none' : '';
    const el = b.querySelector('.tp-list'), f = q.trim().toLowerCase();
    if (tab === 'gm') {
      const g = (G.me && G.me.gm) || {};
      el.innerHTML = `<div class="gm-tg">
          <button class="btn ${g.hide ? 'primary' : ''}" data-gm="/an">👻 Tàng hình: ${g.hide ? 'BẬT' : 'tắt'}</button>
          <button class="btn ${g.safe ? 'primary' : ''}" data-gm="/mienpk">🛡️ Miễn PK: ${g.safe ? 'BẬT' : 'tắt'}</button>
          <button class="btn" data-gm="/heal">❤️ Hồi đầy</button></div>
        <div class="gm-note">Tàng hình: người chơi không thấy bạn trên bản đồ / danh sách online, quái không đánh bạn (ra chiêu thì hiệu ứng vẫn hiện). Miễn PK: người chơi, kể cả đồ sát, không đánh được bạn. Tài khoản quản trị không lên bảng xếp hạng. Phím <b>\`</b> mở / đóng hộp này.</div>`;
      el.querySelectorAll('[data-gm]').forEach(x => x.onclick = () => { cmd(x.dataset.gm); click(); });
    } else if (tab === 'pin') {
      el.innerHTML = `<div class="gm-pin"><textarea class="gm-pin-in" maxlength="200" rows="2" placeholder="Nội dung thông báo..."></textarea>
          <button class="btn primary" data-pin>📌 Ghim</button></div>
        <div class="gm-note">Chữ nhỏ chạy trên cùng màn hình của mọi người chơi, lặp lại <b>mỗi 5 phút</b> cho tới khi bạn bấm Tắt (vẫn giữ khi máy chủ khởi động lại). Tối đa 5 thông báo. Lệnh chat: /ghim · /boghim · /dsghim</div>` +
        (pins.length ? pins.map(x => `<div class="tp-pl"><div><b style="color:#ffef3a">📌 ${esc(x.text)}</b><small>${esc(x.by)} · ${new Date(x.at).toLocaleString('vi-VN')}</small></div><button class="btn small red" data-unpin="${esc(x.id)}">Tắt</button></div>`).join('') +
          (pins.length > 1 ? '<button class="btn small red" data-unpin="all" style="margin-top:4px">Tắt tất cả</button>' : '') : '<p class="muted small">Chưa có thông báo ghim nào</p>');
      const ta = el.querySelector('.gm-pin-in'); ta.value = pinDraft;
      ta.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
      ta.oninput = () => { pinDraft = ta.value; };
      const send = () => { const t = ta.value.replace(/\s+/g, ' ').trim(); if (!t) return; cmd('/ghim ' + t); pinDraft = ''; ta.value = ''; click(); };
      el.querySelector('[data-pin]').onclick = send;
      el.querySelectorAll('[data-unpin]').forEach(x => x.onclick = () => { cmd('/boghim ' + x.dataset.unpin); click(); });
    } else if (tab === 'map') {
      const maps = Object.entries(G.data.maps).filter(([id, m]) => !m.duel && (!f || m.name.toLowerCase().includes(f) || id.includes(f)))
        .sort((a, c) => (!!a[1].sect - !!c[1].sect) || (!!c[1].town - !!a[1].town) || lvNum(a[1].lv) - lvNum(c[1].lv));
      el.innerHTML = maps.map(([id, m]) => `<button class="tp-it ${G.map && G.map.id === id ? 'cur' : ''}" data-map="${id}"><b>${esc(m.name)}</b><small>${m.sect ? 'Môn phái' : m.town ? 'Thành' : 'Cấp ' + esc(m.lv)}${m.pvp ? ' · PK' : ''}${m.boss ? ' · 👹' : ''}</small></button>`).join('') || '<p class="muted small">Không có bản đồ phù hợp</p>';
      el.querySelectorAll('[data-map]').forEach(x => x.onclick = () => { cmd('/tp ' + x.dataset.map); b.remove(); click(); });
    } else {
      if (!list) { el.innerHTML = '<p class="muted small">Đang tải...</p>'; return; }
      const owner = !!(G.me && G.me.owner), arr = list.filter(p => !f || p.name.toLowerCase().includes(f));
      el.innerHTML = (owner ? `<div class="tp-pts">Số điểm tặng <input type="number" class="tp-ptn" value="${ptsN}" step="10"> <small>⭐ tiềm năng · 📖 võ học · số âm để thu lại</small></div>` : '') +
        `<div class="tp-pts"><small>${list.length} người online</small><button class="btn small" data-ref>🔄 Làm mới</button></div>` +
        (arr.map(p => `<div class="tp-pl"><div><b>${esc(p.name)}</b>${p.me ? ' <small style="display:inline">(bạn)</small>' : ''}${p.hide ? ' 👻' : ''}
          <small>${esc(G.data.classes[p.cls] ? G.data.classes[p.cls].name : p.cls)} · Cấp ${p.lv} · ${esc(p.map)}${p.off ? ' · treo máy' : ''}${p.pk >= 3 ? ` · <span style="color:#ff5050">☠ Sát khí ${p.pk}</span>` : p.pk ? ` · Sát khí ${p.pk}` : ''}</small></div>
          ${p.me ? '' : `<button class="btn small" data-goto="${esc(p.name)}" title="Bay tới chỗ người này">Đến</button><button class="btn small" data-keo="${esc(p.name)}" title="Kéo người này tới chỗ bạn">Kéo</button><button class="btn small red" data-kick="${esc(p.name)}" title="Kick">👢</button>`}
          ${owner ? `<button class="btn small" data-pts="tiemnang" data-n="${esc(p.name)}" title="Tặng điểm tiềm năng">⭐+</button><button class="btn small" data-pts="kynang" data-n="${esc(p.name)}" title="Tặng điểm võ học">📖+</button>` : ''}</div>`).join('') || '<p class="muted small">Không có ai</p>');
      const ptn = el.querySelector('.tp-ptn');
      if (ptn) { ptn.onkeydown = e => e.stopPropagation(); ptn.oninput = () => { ptsN = Math.trunc(+ptn.value) || 0; }; }
      el.querySelector('[data-ref]').onclick = () => { refresh(); click(); };
      el.querySelectorAll('[data-pts]').forEach(x => x.onclick = () => { if (ptsN) { cmd(`/${x.dataset.pts} ${x.dataset.n} ${ptsN}`); click(); } });
      el.querySelectorAll('[data-goto]').forEach(x => x.onclick = () => { cmd('/goto ' + x.dataset.goto); b.remove(); });
      el.querySelectorAll('[data-keo]').forEach(x => x.onclick = () => { cmd('/keo ' + x.dataset.keo); click(); });
      el.querySelectorAll('[data-kick]').forEach(x => x.onclick = () => G.modal(`Mời ${x.dataset.kick} ra khỏi game?`, [{ t: 'Kick', cls: 'red', fn: () => cmd('/kick ' + x.dataset.kick) }, { t: 'Huỷ' }]));
    }
  }

  // nút 👁️ GM ở hàng nút cạnh bản đồ mini (chỗ nút "Bay" cũ)
  function ensure() {
    if (!G.inGame || !G.me) return;
    const row = $('qb-row'); if (!row) return;
    let btn = $('btn-gm');
    if (G.me.gm && !btn) {
      btn = document.createElement('button'); btn.id = 'btn-gm'; btn.className = 'qb sq'; btn.title = 'Công cụ GM: tàng hình, miễn PK, bay tới bản đồ / người chơi (phím `)';
      btn.innerHTML = '<i>👁️</i><span>GM</span>'; btn.onclick = e => { e.stopPropagation(); open(); };
      row.insertBefore(btn, row.firstChild);
    } else if (!G.me.gm && btn) { btn.remove(); if (box()) box().remove(); }
    if (btn && btn.isConnected) btn.classList.toggle('on', !!(G.me.gm && (G.me.gm.hide || G.me.gm.safe)));
  }
  setInterval(ensure, 500);
  document.addEventListener('keydown', ev => {
    if (!G.inGame || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    if (ev.code === 'Backquote' && G.me && G.me.gm) open();
  });

  let lastG = '';
  window.GM = {
    open,
    // gọi mỗi lần nhận 'me': đổi trạng thái tàng hình / miễn PK thì vẽ lại, nút sáng lên khi đang bật
    sync() {
      const me = G.me; if (!me) return;
      const k = JSON.stringify(me.gm || {});
      if (k === lastG) return;
      lastG = k;
      const btn = $('btn-gm'); if (btn) btn.classList.toggle('on', !!(me.gm && (me.gm.hide || me.gm.safe)));
      if (box() && tab === 'gm') render();
    },
    onPins(d) { pins = Array.isArray(d) ? d : []; if (box() && tab === 'pin') render(); },
    onList(d) { list = Array.isArray(d) ? d : []; if (box() && tab === 'pl') render(); }
  };
})();
