// Tương tác với người chơi khác: menu khi bấm vào nhân vật, xem thông tin, bạn bè, giao dịch, mời vào bang
(function () {
  const $ = id => document.getElementById(id);
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const esc = s => UI.esc(s);
  let inspectData = null, friendsData = null, tradeData = null, tradeSel = {};

  // ---------- danh sách chặn (lưu trên máy) ----------
  let blockList = [];
  try { blockList = JSON.parse(localStorage.getItem('vl_block') || '[]'); } catch (e) {}
  const blocked = name => blockList.includes(String(name || '').toLowerCase());
  function toggleBlock(name) {
    const n = name.toLowerCase();
    blockList = blocked(n) ? blockList.filter(x => x !== n) : [...blockList, n];
    try { localStorage.setItem('vl_block', JSON.stringify(blockList)); } catch (e) {}
    if (G.sendAutoSrv) G.sendAutoSrv();   // máy chủ cần danh sách chặn để tự vào tổ đội không nhận lời mời của người bị chặn
    UI.toast(blocked(n) ? `Đã chặn tin nhắn của ${name}` : `Đã bỏ chặn ${name}`, 'info');
  }

  // ---------- menu khi bấm vào người chơi ----------
  function closeMenu() { const m = $('pl-menu'); if (m) m.remove(); }
  function menu(e, clientX, clientY) {
    closeMenu();
    const p = Input.toLocal(clientX, clientY), sz = Input.size();
    const box = document.createElement('div');
    box.id = 'pl-menu';
    const myG = G.me.guild;
    const canInvite = myG && (myG.role === 'leader' || myG.role === 'elder') && !e.guild;
    const fid = G.me.friendIds && G.me.friendIds[e.name];
    const pt = Party.data, inParty = Party.has(e.id);
    const items = [
      ['👤', 'Xem thông tin', () => emit('inspect', { id: e.id })],
      fid ? ['💔', 'Hủy kết bạn', () => G.modal(`Hủy kết bằng hữu với ${e.name}?`, [{ t: 'Hủy kết bạn', cls: 'primary', fn: () => emit('friend', { op: 'remove', uid: fid }) }, { t: 'Thôi' }])]
        : ['🤝', 'Kết bạn', () => emit('friend', { op: 'add', id: e.id })],
      !inParty && (!pt || pt.leader === pt.you) ? ['👥', 'Mời vào tổ đội', () => Party.invite(e)] : null,
      ['💌', 'Trò chuyện riêng', () => UI.pmTo(e.name)],
      ['🔄', 'Giao dịch', () => emit('trade', { op: 'request', id: e.id })],
      canInvite ? ['🏯', 'Mời vào bang', () => emit('ginvite', { op: 'invite', id: e.id })] : null,
      ['🚶', G.follow === e.id ? 'Thôi đi theo' : 'Đi theo', () => { G.follow = G.follow === e.id ? null : e.id; UI.toast(G.follow ? `Đang đi theo ${e.name}` : 'Đã thôi đi theo', 'info'); }],
      !Duel.active && !(G.map && G.map.pvp) ? ['🥋', 'Thách đấu', () => Duel.request(e)] : null,
      G.map && G.map.pvp ? ['⚔️', 'Tấn công', () => { G.target = e.id; G.chase = { id: e.id, skill: 0 }; }] : null,
      ['🚫', blocked(e.name) ? 'Bỏ chặn' : 'Chặn tin nhắn', () => toggleBlock(e.name)]
    ].filter(Boolean);
    const cls = G.data.classes[e.cls];
    box.innerHTML = `<div class="pm-head"><b>${esc(e.name)}</b><small>${cls ? cls.name : ''} · Cấp ${e.level}${e.guild ? ' · «' + esc(e.guild) + '»' : ''}</small>${fid || inParty ? `<small class="pm-tags">${fid ? '<span class="fr">🤝 Bằng hữu</span>' : ''}${inParty ? '<span class="pt">👥 Đồng đội</span>' : ''}</small>` : ''}</div>` +
      items.map((it, i) => `<button data-i="${i}"><span>${it[0]}</span>${it[1]}</button>`).join('');
    $('screen-game').appendChild(box);
    const w = box.offsetWidth || 180, h = box.offsetHeight || 300;
    box.style.left = Math.max(6, Math.min(sz.w - w - 6, p.x + 10)) + 'px';
    box.style.top = Math.max(6, Math.min(sz.h - h - 6, p.y - h / 2)) + 'px';
    box.querySelectorAll('[data-i]').forEach(b => b.onclick = ev => { ev.stopPropagation(); closeMenu(); items[+b.dataset.i][2](); G.sfx('click'); });
    setTimeout(() => document.addEventListener('pointerdown', function off(ev) { if (!box.contains(ev.target)) { closeMenu(); document.removeEventListener('pointerdown', off, true); } }, true), 0);
  }

  // ---------- xem thông tin ----------
  const SLOT_ORDER = ['helmet', 'amulet', 'cloak', 'weapon', 'armor', 'gloves', 'ring', 'pants', 'ring2', 'boots'];
  UI.registerPanel('inspect', '👤 Thông Tin Đại Hiệp', body => {
    const d = inspectData;
    if (!d) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    const cls = G.data.classes[d.cls], s = d.stats;
    let html = `<div class="insp"><div class="insp-left"><canvas id="insp-cv" width="128" height="128"></canvas>
      <h3>${esc(d.name)}</h3><div class="muted small">${cls ? cls.name : ''}${cls && d.branch && cls.branches && cls.branches[d.branch] ? ' · ' + cls.branches[d.branch].kind : ''} · Cấp ${d.level}</div>
      ${d.guild ? `<div class="small" style="color:#7fb8ff">«${esc(d.guild)}» ${d.role === 'leader' ? '· Bang chủ' : d.role === 'elder' ? '· Trưởng lão' : ''}</div>` : ''}
      ${(() => { const ti = Overhead.earned(d.title); return ti || d.rank ? `<div class="small" style="font-weight:700">${ti ? `<span style="color:${ti.color}" title="${esc(ti.desc)}">【${esc(ti.name)}】</span>` : ''}${d.rank ? `${ti ? ' · ' : ''}<span style="color:#ffd84a">#${d.rank} lực chiến</span>` : ''}</div>` : ''; })()}
      <div class="insp-power">⚡ Lực chiến <b>${d.power.toLocaleString('vi-VN')}</b> <span class="small" style="color:${Overhead.relColor(d.power, G.me.stats.power).color}">(${Overhead.relColor(d.power, G.me.stats.power).tip})</span></div>
      ${d.pk >= 3 ? `<div class="small" style="color:#ff4a4a">☠ Sát khí ${d.pk}</div>` : ''}
      <div class="small muted">${d.online === false ? '<span style="color:#a8998a">⚫ Ngoại tuyến</span>' : '📍 ' + esc(d.map)} · 💀 Quái ${d.kills} · ⚔️ PK ${d.pvpKills} · 🥋 Tỷ võ ${d.duelWin || 0} thắng / ${d.duelLose || 0} thua</div></div>
      <div class="insp-right"><div class="insp-stats">
        <div>❤️ Sinh lực <b>${s.maxHp}</b></div><div>💧 Nội lực <b>${s.maxMp}</b></div>
        <div>⚔️ Tấn công <b>${s.atk}</b></div><div>🛡️ Phòng thủ <b>${s.def}</b></div>
        <div>💥 Chí mạng <b>${s.crit}%</b></div><div>👟 Tốc độ <b>${s.spd}</b></div></div>
      <h4 class="sk-title">Trang bị</h4><div class="insp-eq">`;
    for (const slot of SLOT_ORDER) {
      const e = d.equip[slot], it = e && G.data.items[e.id];
      html += `<div class="slot ${it ? 'r-' + it.rarity : ''}" ${it ? `data-eqid="${e.id}" data-plus="${e.plus}" data-slot="${slot}"` : ''}>${it ? `${UI.plusRing(e.plus | 0)}<img src="${UI.iconUrl(e.id)}" class="ic" width="36" height="36">${e.plus ? `<span class="plus">+${e.plus}</span>` : ''}${UI.brBadge(e)}${UI.gemDots(it, e)}${UI.lvBadge(e.id)}` : `<span class="lbl">${G.data.slots[slot]}</span>`}</div>`;
    }
    html += `</div>${UI.gemSummary(d.equip)}${d.mount && G.data.mounts[d.mount] ? `<div class="small">🐎 Thú cưỡi: <b class="r-${G.data.mounts[d.mount].rarity}-t">${esc(G.data.mounts[d.mount].name)}</b></div>` : ''}
      <div class="row insp-btns">
        ${UI.lbBack ? '<button class="btn small" data-act="back">◀ Bảng xếp hạng</button>' : ''}
        ${d.id == null ? '' : d.friend ? '<span class="small" style="color:#4ade80">🤝 Bằng hữu</span>' : '<button class="btn small" data-act="friend">🤝 Kết bạn</button>'}
        <button class="btn small" data-act="pm">💌 Nhắn riêng</button>${d.id == null ? '' : '<button class="btn small green" data-act="trade">🔄 Giao dịch</button>'}</div></div></div>`;
    body.innerHTML = html;
    const cv = $('insp-cv');
    if (cv && Assets.has(d.cls)) { const c = cv.getContext('2d'); c.imageSmoothingEnabled = true; c.drawImage(Assets.charFrame(d.cls, 0, 'idle', 0, (G.players.get(d.id) || {}).ap), -8, -12, 144, 144); }
    else if (cv && Assets.loadClass && !d._ld && (d._ld = 1)) Assets.loadClass(d.cls).then(() => { if (inspectData === d && UI.panelName() === 'inspect') UI.refreshPanel(); }).catch(() => {});   // người ngoại tuyến / ở xa: tải hình phái rồi vẽ lại
    body.querySelectorAll('[data-eqid]').forEach(el => { const inst = d.equip[el.dataset.slot]; el.onmouseenter = ev => UI.itemTip(ev, el.dataset.eqid, +el.dataset.plus, inst); el.onmouseleave = () => UI.hideTip(); el.onclick = ev => UI.itemTip(ev, el.dataset.eqid, +el.dataset.plus, inst); });
    body.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      if (b.dataset.act === 'friend') emit('friend', { op: 'add', id: d.id });
      if (b.dataset.act === 'pm') UI.pmTo(d.name);
      if (b.dataset.act === 'back') { UI.lbBack = false; UI.openPanel('leaderboard', { tab: UI.lbTab }); }
      if (b.dataset.act === 'trade') { emit('trade', { op: 'request', id: d.id }); UI.closePanel(); }
    });
  });

  // ---------- bạn bè ----------
  UI.registerPanel('friends', '🤝 Bằng Hữu', body => {
    const list = friendsData;
    let html = `<div class="row" style="margin-bottom:8px"><input id="fr-name" placeholder="Tên nhân vật muốn kết bạn" maxlength="14"><button class="btn small primary" id="fr-add">Kết bạn</button></div>`;
    if (!list) html += '<p class="muted">Đang tải...</p>';
    else if (!list.length) html += '<p class="muted">Chưa có bằng hữu nào. Bấm vào nhân vật người chơi khác để kết bạn!</p>';
    else html += `<p class="small muted">${list.filter(f => f.online).length}/${list.length} đang trực tuyến</p><div class="list">` + list.map(f => `<div class="li ${f.online ? 'done' : ''}">
      <div class="fr-dot ${f.online ? 'on' : ''}"></div><div class="grow"><b>${esc(f.name)}</b> <span class="small muted">${G.data.classes[f.cls] ? G.data.classes[f.cls].name : ''} · Cấp ${f.level}</span>
      <div class="sub">${f.online ? '📍 ' + esc(f.map) : 'Ngoại tuyến'}</div></div>
      ${f.online ? `<button class="btn small" data-pm="${esc(f.name)}">💌</button>` : ''}<button class="btn small red" data-rm="${f.uid}">✕</button></div>`).join('') + '</div>';
    body.innerHTML = html;
    $('fr-add').onclick = () => { const n = $('fr-name').value.trim(); if (n) emit('friend', { op: 'add', name: n }); };
    body.querySelectorAll('[data-pm]').forEach(b => b.onclick = () => UI.pmTo(b.dataset.pm));
    body.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => G.modal('Xóa người này khỏi danh sách bằng hữu?', [{ t: 'Xóa', cls: 'red', fn: () => emit('friend', { op: 'remove', uid: b.dataset.rm }) }, { t: 'Không' }]));
  }, () => { friendsData = null; emit('friend', { op: 'list' }); });

  // ---------- giao dịch ----------
  function tradeWin() {
    let w = $('trade-win');
    if (!tradeData) { if (w) w.remove(); tradeSel = {}; return; }
    if (!w) { w = document.createElement('div'); w.id = 'trade-win'; $('screen-game').appendChild(w); }
    const d = tradeData, me = d.me, th = d.them;
    const cell = x => { const it = G.data.items[x.id]; return `<div class="slot r-${it.rarity}" data-tid="${x.id}" data-plus="${x.plus}" data-tuid="${x.uid}"><img src="${UI.iconUrl(x.id)}" class="ic" width="36" height="36">${x.qty > 1 ? `<span class="q">${x.qty}</span>` : ''}${x.plus ? `<span class="plus">+${x.plus}</span>` : ''}${it.type === 'equip' ? UI.brBadge(x) + UI.gemDots(it, x) + UI.lvBadge(x.id) : ''}</div>`; };
    const side = (s, mine) => `<div class="tr-side ${s.lock ? 'locked' : ''}"><div class="tr-name">${mine ? 'Bạn đưa' : esc(s.name) + ' đưa'} ${s.ok ? '<span class="tr-ok">✔ Đã xác nhận</span>' : s.lock ? '<span class="tr-lock">🔒 Đã khóa</span>' : ''}</div>
      <div class="tr-items">${s.items.map(cell).join('') || '<span class="muted small">Chưa đặt vật phẩm</span>'}</div><div class="tr-gold">💰 ${s.gold.toLocaleString('vi-VN')} lượng</div></div>`;
    const offered = new Set(me.items.map(x => x.uid));
    const inv = G.me.inv.map(s => { const it = G.data.items[s.id]; return `<div class="slot r-${it.rarity} ${offered.has(s.uid) ? 'sel' : ''} ${it.noTrade ? 'cant' : ''}" data-inv="${s.uid}" ${it.noTrade ? 'title="Không thể giao dịch"' : ''}><img src="${UI.iconUrl(s.id)}" class="ic" width="36" height="36">${s.qty > 1 ? `<span class="q">${s.qty}</span>` : ''}${s.plus ? `<span class="plus">+${s.plus}</span>` : ''}${it.type === 'equip' ? UI.brBadge(s) + UI.gemDots(it, s) + UI.lvBadge(s.id) : ''}</div>`; }).join('');
    w.innerHTML = `<div class="tr-box"><div class="panel-head"><h3>🔄 Giao dịch với ${esc(th.name)}</h3><button id="tr-x">✕</button></div>
      <div class="tr-body"><div class="tr-sides">${side(me, true)}${side(th, false)}</div>
      ${me.lock ? '' : `<div class="small muted">Chọn vật phẩm trong túi để đưa (chọn lại để bỏ):</div><div class="tr-inv">${inv}</div>
      <div class="row"><label class="small">💰 Lượng</label><input id="tr-gold" type="number" min="0" max="${G.me.gold}" value="${me.gold}" style="width:110px"><button class="btn small" id="tr-setgold">Đặt</button></div>`}
      <div class="row tr-btns">${me.lock ? '<button class="btn small" id="tr-unlock">🔓 Mở khóa</button>' : '<button class="btn small" id="tr-lock">🔒 Khóa</button>'}
        <button class="btn small green" id="tr-ok" ${me.lock && th.lock && !me.ok ? '' : 'disabled'}>✔ Xác nhận</button><button class="btn small red" id="tr-cancel">Hủy</button></div>
      <p class="small muted">Hai bên khóa rồi cùng bấm Xác nhận thì giao dịch mới diễn ra.</p></div></div>`;
    const sendOffer = (items, gold) => emit('trade', { op: 'offer', items, gold });
    const curItems = () => me.items.map(x => ({ uid: x.uid, qty: x.qty }));
    $('tr-x').onclick = $('tr-cancel').onclick = () => emit('trade', { op: 'cancel' });
    if ($('tr-lock')) $('tr-lock').onclick = () => emit('trade', { op: 'lock' });
    if ($('tr-unlock')) $('tr-unlock').onclick = () => emit('trade', { op: 'unlock' });
    $('tr-ok').onclick = () => emit('trade', { op: 'confirm' });
    if ($('tr-setgold')) $('tr-setgold').onclick = () => sendOffer(curItems(), Math.max(0, +$('tr-gold').value || 0));
    w.querySelectorAll('[data-inv]').forEach(el => el.onclick = () => {
      const uid = el.dataset.inv, s = G.me.inv.find(x => x.uid === uid);
      if (!s) return;
      if (G.data.items[s.id].noTrade) return UI.toast(`${G.data.items[s.id].name} không thể giao dịch`, 'error');
      let items = curItems();
      if (items.some(x => x.uid === uid)) items = items.filter(x => x.uid !== uid);
      else {
        let qty = 1;
        if (s.qty > 1) { qty = Math.floor(+prompt(`Số lượng ${G.data.items[s.id].name} (tối đa ${s.qty}):`, s.qty) || 0); if (qty <= 0) return; qty = Math.min(qty, s.qty); }
        items.push({ uid, qty });
      }
      sendOffer(items, me.gold);
    });
    w.querySelectorAll('[data-tid]').forEach(el => { const inst = [...me.items, ...th.items].find(x => x.uid === el.dataset.tuid); el.onmouseenter = ev => UI.itemTip(ev, el.dataset.tid, +el.dataset.plus, inst); el.onmouseleave = () => UI.hideTip(); el.onclick = ev => UI.itemTip(ev, el.dataset.tid, +el.dataset.plus, inst); });
  }

  // ---------- sự kiện từ máy chủ ----------
  function bind(s) {
    s.on('inspect', d => { inspectData = d; UI.lbBack = UI.panelName() === 'leaderboard' || (UI.lbBack && UI.panelName() === 'inspect'); UI.openPanel('inspect'); });
    s.on('friends', d => { friendsData = d; if (UI.panelName() === 'friends') UI.refreshPanel(); });
    s.on('friendReq', d => {
      if (blocked(d.name)) return;
      G.modal(`🤝 ${d.name} (${G.data.classes[d.cls] ? G.data.classes[d.cls].name : ''} cấp ${d.level}) muốn kết bằng hữu với bạn.`, [
        { t: 'Đồng ý', cls: 'primary', fn: () => emit('friend', { op: 'accept', id: d.id }) },
        { t: 'Từ chối', fn: () => emit('friend', { op: 'decline', id: d.id }) }]);
    });
    s.on('tradeReq', d => {
      if (blocked(d.name)) return emit('trade', { op: 'decline' });
      G.modal(`🔄 ${d.name} muốn giao dịch với bạn.`, [
        { t: 'Đồng ý', cls: 'primary', fn: () => emit('trade', { op: 'accept' }) },
        { t: 'Từ chối', fn: () => emit('trade', { op: 'decline' }) }]);
    });
    s.on('guildInvite', d => G.modal(`🏯 ${d.name} mời bạn gia nhập bang «${d.guild}».`, [
      { t: 'Gia nhập', cls: 'primary', fn: () => emit('ginvite', { op: 'accept' }) },
      { t: 'Từ chối', fn: () => emit('ginvite', { op: 'decline' }) }]));
    s.on('trade', d => { tradeData = d; tradeWin(); });
    // Thẻ Đổi Tên: hỏi tên mới
    s.on('renamePrompt', d => UI.prompt('📜 Thẻ Đổi Tên', `Tên hiện tại: ${G.me.name}. Nhập tên mới (3-14 ký tự, chữ, số, dấu _):`, G.me.name, name => {
      if (!name || name === G.me.name) return;
      G.modal(`Đổi tên thành "${name}"? Thẻ Đổi Tên sẽ bị dùng hết.`, [{ t: 'Đổi tên', cls: 'primary', fn: () => emit('rename', { uid: d.uid, name }) }, { t: 'Hủy' }]);
    }));
    s.on('me', () => { if (tradeData && !(document.activeElement && document.activeElement.id === 'tr-gold')) setTimeout(tradeWin, 0); });
  }

  window.Social = { bind, menu, closeMenu, blocked, blockList: () => blockList.slice(0, 200) };
})();
