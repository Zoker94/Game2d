// Môn phái phía người chơi: bảng Trưởng Môn (cấp bậc, nhiệm vụ môn phái), cửa hàng cống hiến của Hộ Pháp,
// ô nhiệm vụ môn phái trong khung theo dõi (bấm để dẫn đường).
(function () {
  const $ = id => document.getElementById(id);
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const esc = s => UI.esc(s);
  let view = null, shop = null, npc = null;

  function open(d) { npc = d; view = null; emit('sect', { op: 'view', npc: d.id }); UI.openPanel('sect'); }
  function openShop(d) { npc = d; shop = null; emit('sect', { op: 'shop' }); UI.openPanel('sectshop'); }

  UI.registerPanel('sect', '🏮 Môn Phái', body => {
    const v = view;
    if (!v) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    let html = `<div class="sect-hero"><div class="grow"><h3>${esc(npc ? npc.name : '')}</h3><div class="small">"${esc(npc ? npc.talk : '')}"</div></div></div>`;
    if (!v.member) {
      body.innerHTML = html + `<div class="card"><p>Ngươi là đệ tử <b>${esc(v.mySect)}</b>, không phải người của <b>${esc(v.sectName)}</b>.</p>
        <p class="small muted">Hãy về môn phái của mình (Xa Phu → nhóm 🏮 Môn phái, miễn phí) để nhận nhiệm vụ môn phái.</p></div>`;
      return;
    }
    const nx = v.next, pct = nx ? Math.min(100, v.total / nx.at * 100) : 100;
    html += `<div class="card sect-rank"><div class="row" style="justify-content:space-between"><b>🎖️ ${esc(v.rankName)}</b><span class="small">Cống hiến: <b>${fmt(v.pts)}</b> (tổng ${fmt(v.total)})</span></div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="small muted">${nx ? `Lên <b>${esc(nx.name)}</b> khi tổng cống hiến đạt ${fmt(nx.at)}` : 'Đã đạt cấp bậc cao nhất'} · Thưởng cấp bậc hiện tại: <b>+${v.bonus}%</b> công / thủ / sinh lực</div>
      <div class="sect-ranks">${v.ranks.map((r, i) => `<span class="${i <= v.rank ? 'on' : ''}">${esc(r.name)}<small>${fmt(r.at)}</small></span>`).join('')}</div></div>`;
    html += `<div class="card"><h4>📜 Nhiệm vụ môn phái <span class="small muted">(${v.n}/${v.max} hôm nay)</span></h4>`;
    if (v.cur) {
      const done = v.cur.have >= v.cur.need, pv = v.preview;
      html += `<div class="sect-q ${done ? 'done' : ''}">${done ? '✅' : '➤'} ${esc(v.cur.text)} ${v.cur.need > 1 ? `<b>(${v.cur.have}/${v.cur.need})</b>` : ''}</div>
        ${pv ? `<div class="small">🎁 ${fmt(pv.exp)} KN · ${fmt(pv.gold)} 💰 · <b>+${pv.pts}</b> cống hiến${pv.items.length ? ' · ' + pv.items.map(([id, q]) => `${esc(G.data.items[id] ? G.data.items[id].name : id)} x${q}`).join(', ') : ''}</div>` : ''}
        <div class="row" style="justify-content:flex-start;margin-top:6px">${done ? '<button class="btn primary" data-sq="submit">🎁 Trả nhiệm vụ</button>' : `<button class="btn small" data-sq="nav">🧭 Dẫn đường</button>`}<button class="btn small" data-sq="abandon">Hủy</button></div>`;
    } else if (v.n >= v.max) {
      html += '<p class="small">Hôm nay đã làm đủ nhiệm vụ. Mai quay lại nhé!</p>';
    } else {
      html += `<p class="small">Mỗi ngày nhận tối đa ${v.max} nhiệm vụ: diệt quái, hạ quái tinh anh, đưa thư, vượt phó bản. Nhiệm vụ thứ ${v.max} thưởng gấp ba.</p>
        <button class="btn primary" data-sq="accept">📜 Nhận nhiệm vụ</button>`;
    }
    html += `</div><div class="card small muted">Điểm cống hiến đổi bảo vật ở <b>Hộ Pháp Môn Phái</b>. Học võ công ở <b>Truyền Công Trưởng Lão</b>.</div>`;
    body.innerHTML = html;
    body.querySelectorAll('[data-sq]').forEach(b => b.onclick = () => {
      const op = b.dataset.sq;
      if (op === 'nav') { nav(v.cur); UI.closePanel(); return; }
      if (op === 'abandon') return G.modal('Hủy nhiệm vụ môn phái này?', [{ t: 'Hủy nhiệm vụ', cls: 'primary', fn: () => emit('sect', { op: 'abandon' }) }, { t: 'Thôi' }]);
      emit('sect', { op });
    });
  });

  UI.registerPanel('sectshop', '🎖️ Cửa Hàng Cống Hiến', body => {
    const v = shop;
    if (!v) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    body.innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:6px"><b>🎖️ ${esc(v.rankName)}</b><span>Cống hiến: <b style="color:#ffd86a">${fmt(v.pts)}</b></span></div>
      <div class="list">${v.items.map(x => { const it = G.data.items[x.id] || { name: x.id }; return `<div class="li ${x.ok ? '' : 'locked'}"><img src="${UI.iconUrl(x.id)}" width="32" height="32" style="image-rendering:pixelated"><div class="grow"><b>${esc(it.name)}</b><div class="sub">${x.ok ? esc(it.desc || '') : `Cần cấp bậc ${esc(x.rankName)}`}</div></div>
        <button class="btn small green" data-sb="${x.id}" ${x.ok && v.pts >= x.cost ? '' : 'disabled'}>${x.cost} 🎖️</button></div>`; }).join('')}</div>`;
    body.querySelectorAll('[data-sb]').forEach(b => b.onclick = () => emit('sect', { op: 'buy', id: b.dataset.sb, qty: 1 }));
  });

  // dẫn đường theo nhiệm vụ
  function nav(q) {
    if (!q) return;
    if (q.type === 'letter' && q.map) return QuestNav.go({ map: q.map, npc: q.npc });
    if (q.type === 'kill' && q.mon) return QuestNav.go({ map: q.map || QuestNav.mapOfMon([q.mon]), mons: [q.mon] });
    if (q.type === 'elite') { const m = QuestNav.bestField(); if (m) return QuestNav.go({ map: m, field: true }); }
    if (q.map && WorldMap.navTo(q.map, true)) return;
    if (q.map) return UI.toast(`Hãy đi Xa Phu tới ${G.data.maps[q.map] ? G.data.maps[q.map].name : 'nơi cần đến'}`, 'info');
    UI.toast(q.type === 'elite' ? 'Quái ⭐ Tinh Anh xuất hiện ngẫu nhiên ở các bãi luyện công' : 'Gặp Phó Bản Sứ Giả trong thành', 'info');
  }

  // ô nhiệm vụ môn phái trong khung theo dõi
  function tracker() {
    const s = G.me && G.me.sect;
    let box = $('sect-box');
    if (!s || !s.cur) { if (box) box.remove(); return; }
    if (!box) {
      box = document.createElement('div'); box.id = 'sect-box';
      const tut = $('tutorial-box'); tut.parentNode.insertBefore(box, tut);
      box.onclick = () => { const q = G.me.sect && G.me.sect.cur; if (q && q.have >= q.need) { UI.toast(`Về ${G.data.maps[s.map] ? G.data.maps[s.map].name : 'môn phái'} báo Trưởng Môn (Xa Phu miễn phí)`, 'info'); } else nav(q); };
    }
    const q = s.cur, done = q.have >= q.need;
    const html = `<h4>🏮 Môn phái ${s.n + 1}/${s.max} ${done ? '<span class="ok">✔ Về báo Trưởng Môn</span>' : ''}</h4><div>${esc(q.text)}${q.need > 1 ? ` <b>${q.have}/${q.need}</b>` : ''}</div>`;
    if (box._h !== html) { box.innerHTML = html; box._h = html; box.classList.toggle('done', done); }
  }
  setInterval(() => { if (G.inGame && G.me) tracker(); }, 500);

  function bind(s) {
    s.on('sect', d => { view = d; if (UI.panelName() === 'sect') UI.refreshPanel(); });
    s.on('sectShop', d => { shop = d; if (UI.panelName() === 'sectshop') UI.refreshPanel(); });
  }
  window.SectUI = { open, openShop, bind };
})();
