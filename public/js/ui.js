// Giao diện: HUD, trò chuyện, thông báo, các bảng chức năng.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (n || 0).toLocaleString('vi-VN');
  const STAT_NAME = { atk: 'Tấn công', def: 'Phòng thủ', hp: 'Sinh lực', mp: 'Nội lực', crit: 'Chí mạng', spd: 'Tốc độ' };
  const ROLE_NAME = { leader: 'Bang chủ', elder: 'Trưởng lão', member: 'Thành viên' };
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);

  let panel = null;           // tên bảng đang mở
  let panelState = {};        // trạng thái phụ (tab, item chọn...)
  let npcData = null;
  let lastDailyHtml = '';

  const UI = window.UI = {};

  function iconCanvas(itemId, plus) {
    const it = G.data.items[itemId];
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
    if (it) cv.getContext('2d').drawImage(Sprites.itemIcon(it.icon, it.rarity), 0, 0);
    return cv;
  }
  function iconHtml(itemId) { const c = iconCanvas(itemId); return `<img src="${c.toDataURL()}" width="32" height="32" style="image-rendering:pixelated">`; }
  const iconUrlCache = {};
  function iconUrl(itemId) { return iconUrlCache[itemId] || (iconUrlCache[itemId] = iconCanvas(itemId).toDataURL()); }
  function itemName(id, plus) { const it = G.data.items[id]; return `<span class="r-${it.rarity}-t">${esc(it.name)}${plus ? ' +' + plus : ''}</span>`; }
  function statsHtml(it, plus) {
    if (!it.stats) return '';
    return Object.entries(it.stats).map(([k, v]) => {
      const val = (k === 'crit' || k === 'spd') ? v : Math.round(v * plusMult(plus || 0));
      return `<div class="st">${STAT_NAME[k]}: +${val}${k === 'crit' ? '%' : ''}</div>`;
    }).join('');
  }
  const plusMult = p => 1 + Math.min(p, 10) * 0.12 + Math.max(0, p - 10) * 0.25;
  function itemDesc(id, plus) {
    const it = G.data.items[id];
    const rar = G.data.rarity[it.rarity];
    return `<h4>${itemName(id, plus)}</h4>
      <div class="muted small">${it.type === 'equip' ? G.data.slots[it.slot] + ' · ' : ''}<span style="color:${rar.color}">${rar.name}</span> · Yêu cầu cấp ${it.lv || 1}</div>
      ${statsHtml(it, plus)}${it.desc ? `<div class="small">${esc(it.desc)}</div>` : ''}
      <div class="small muted">Giá bán: ${fmt(Math.floor(it.price * 0.3 * (1 + (plus || 0) * 0.2)))} lượng</div>`;
  }

  // ================= HUD =================
  UI.updateMusicBtn = () => { const b = $('btn-music'); if (b) { b.textContent = GameAudio.state.music ? '🎵' : '🔇'; b.title = GameAudio.state.music ? 'Tắt nhạc nền' : 'Bật nhạc nền'; } };
  UI.initHud = function () {
    document.querySelectorAll('#menu-buttons button').forEach(b => b.onclick = () => UI.togglePanel(b.dataset.panel));
    $('panel-close').onclick = UI.closePanel;
    $('panel').addEventListener('pointerdown', e => { if (e.target.id === 'panel') UI.closePanel(); });
    // chat
    $('chat-form').onsubmit = e => {
      e.preventDefault();
      const text = $('chat-input').value.trim();
      if (!text) { $('chat-input').blur(); return; }
      let ch = $('chat-ch').value, to = $('chat-to').value.trim(), t = text;
      const m = text.match(/^\/(w|m|pm)\s+(\S+)\s+(.+)/i);
      if (m) { ch = 'pm'; to = m[2]; t = m[3]; }
      emit('chat', { ch, text: t, to });
      $('chat-input').value = '';
      if (Input.isTouch) $('chat-input').blur();
    };
    $('chat-ch').onchange = () => $('chat-to').classList.toggle('hidden', $('chat-ch').value !== 'pm');
    document.querySelectorAll('#chat-tabs button[data-ch]').forEach(b => b.onclick = () => {
      document.querySelectorAll('#chat-tabs button[data-ch]').forEach(x => x.classList.toggle('on', x === b));
      chatFilter = b.dataset.ch; renderChat();
      if (b.dataset.ch !== 'all' && b.dataset.ch !== 'pm') { $('chat-ch').value = b.dataset.ch; $('chat-to').classList.add('hidden'); }
    });
    $('chat-tabs').addEventListener('click', e => { if ($('chat').classList.contains('collapsed') && e.target.id !== 'chat-toggle') $('chat-toggle').click(); });
    $('btn-music').onclick = () => { GameAudio.set('music', !GameAudio.state.music); UI.updateMusicBtn(); };
    UI.updateMusicBtn();
    $('chat-toggle').onclick = () => { $('chat').classList.toggle('collapsed'); $('chat-toggle').textContent = $('chat').classList.contains('collapsed') ? '▴' : '▾'; };
    if (Input.isTouch) $('chat').classList.add('collapsed'), $('chat-toggle').textContent = '▴';
    $('chat-log').addEventListener('click', e => {
      const n = e.target.dataset && e.target.dataset.name;
      if (n) { $('chat-ch').value = 'pm'; $('chat-to').value = n; $('chat-to').classList.remove('hidden'); $('chat-input').focus(); }
    });
    $('tutorial-box').onclick = () => { const t = G.me && G.me.tutorial; if (t && t.complete) emit('tutorialClaim'); else UI.openPanel('quests'); };
    $('daily-box').onclick = () => UI.openPanel('quests', { tab: 'daily' });
    if (Input.isTouch) document.body.classList.add('show-tracker');
    buildSkillButtons();
  };

  let builtFor = null;
  const SLOT_KEYS = ['2', '3', '4', '5', '6', '7'];
  function buildSkillButtons() {
    if (!G.me) return;
    const skills = G.mySkills();
    const hb = G.me.hotbar || [1, 2, 3, 4, 5, 6];
    const bkey = G.me.cls + ':' + (G.me.dragon || '') + ':' + hb.join(',') + ':' + skills.map(s => s && s.learned ? s.slv : 0).join(',');
    if (builtFor === bkey) return;
    builtFor = bkey;
    const bar = $('skillbar');
    bar.innerHTML = '';
    const mk = (s, key, onclick, slot) => {
      const d = document.createElement('div');
      if (!s) { d.className = 'skill empty'; d.innerHTML = `<span class="key">${key}</span><span class="small muted">Trống</span>`; d.onclick = () => UI.openPanel('skills'); bar.appendChild(d); return; }
      d.className = 'skill' + (s.idx === 6 ? ' dragon el-' + s.el : '') + (s.learned ? '' : ' unlearned'); d.dataset.idx = s.idx;
      d.innerHTML = `<span class="key">${key}</span>${esc(s.name)}<span class="mpc">${s.mp || ''}</span>${s.slv > 1 ? `<span class="slv">${s.slv}</span>` : ''}<div class="cdo"></div><div class="cdt"></div>`;
      d.onclick = onclick;
      d.onmouseenter = e => tip(e, `<b>${esc(s.name)}</b>${s.learned ? ` · Tầng ${s.slv}` : ' · <span style="color:#ff9b8a">Chưa học</span>'}<br>Cấp ${s.lv} · ${s.mp} MP · Hồi ${s.cd / 1000}s<br>${skillDesc(s)}`);
      d.onmouseleave = hideTip;
      bar.appendChild(d);
    };
    mk(skills[0], '1/␣', () => G.useSkill(0));
    hb.forEach((idx, n) => mk(idx ? skills[idx] : null, SLOT_KEYS[n], () => G.useSlot(n + 1)));
    for (const k of ['hp', 'mp']) {
      const d = document.createElement('div');
      d.className = 'skill'; d.id = 'pot-' + k;
      d.innerHTML = `<span class="key">${k === 'hp' ? 'Z' : 'X'}</span>${k === 'hp' ? '❤️' : '💧'}<span class="cnt"></span>`;
      d.style.fontSize = '22px';
      d.onclick = () => emit('quickUse', { kind: k });
      bar.appendChild(d);
    }
    document.querySelectorAll('.act.sk').forEach(b => {
      const idx = hb[+b.dataset.sk - 1], s = idx ? skills[idx] : null;
      b.dataset.idx = s ? s.idx : '';
      b.classList.toggle('empty', !s);
      b.style.display = s ? '' : 'none';
      b.classList.toggle('unlearned', !!s && !s.learned);
      b.classList.toggle('dragon', !!s && s.idx === 6);
      b.innerHTML = s ? `${esc(s.name)}<div class="cdo"></div><div class="cdt"></div>` : '<span class="muted">+</span>';
    });
  }
  function skillDesc(s) {
    const t = { single: 'Tấn công đơn mục tiêu', aoe: `Sát thương diện rộng (bán kính ${s.radius})`, line: 'Tấn công theo đường thẳng', buff: 'Tăng cường bản thân', heal: 'Hồi máu bản thân và đồng đội xung quanh', dot: 'Gây độc theo thời gian', dash: 'Lướt tới mục tiêu, sát thương lan quanh điểm đáp' }[s.type] || '';
    return `${t}${s.mult ? ' · x' + s.mult + ' sát thương' : ''}`;
  }

  UI.updateHud = function () {
    const me = G.me;
    if (!me) return;
    buildSkillButtons();
    const st = me.stats;
    setBar(document.querySelector('#hud-status .bar.hp'), me.hp, st.maxHp);
    setBar(document.querySelector('#hud-status .bar.mp'), me.mp, st.maxMp);
    $('hud-name').textContent = me.name;
    $('hud-class').textContent = G.data.classes[me.cls].name;
    $('hud-level').textContent = me.level;
    $('hud-gold').textContent = fmt(me.gold);
    $('hud-knb').textContent = fmt(me.knb);
    const ep = me.expNext ? me.exp / me.expNext : 0;
    $('exp-bar').querySelector('i').style.width = (ep * 100).toFixed(2) + '%';
    $('exp-bar').querySelector('span').textContent = `Cấp ${me.level} · KN ${fmt(me.exp)}/${fmt(me.expNext)} (${(ep * 100).toFixed(1)}%)`;
    if (UI._avatarCls !== me.cls) {
      UI._avatarCls = me.cls;
      const c = $('hud-avatar').getContext('2d'); c.imageSmoothingEnabled = false;
      c.clearRect(0, 0, 64, 64); c.drawImage(Sprites.playerSprite(me.cls, G.data.classes[me.cls].colors, 0, 0), 0, 0);
    }
    // khóa kỹ năng
    G.mySkills().forEach((s, i) => {
      const locked = !s.learned || me.level < s.lv;
      document.querySelectorAll(`#skillbar .skill[data-idx="${i}"], .act.sk[data-idx="${i}"]`).forEach(el => el.classList.toggle('locked', locked));
    });
    const cnt = k => me.inv.filter(x => x.id.startsWith(k)).reduce((s, x) => s + x.qty, 0);
    const hpc = cnt('hp'), mpc = cnt('mp');
    const ph = $('pot-hp'), pm = $('pot-mp');
    if (ph) ph.querySelector('.cnt').textContent = hpc;
    if (pm) pm.querySelector('.cnt').textContent = mpc;
    $('btn-hp').innerHTML = `❤️<span class="cnt">${hpc}</span>`;
    $('btn-mp').innerHTML = `💧<span class="cnt">${mpc}</span>`;
    updateTutorial();
    if (panel === 'inventory' || panel === 'character' || panel === 'mount' || panel === 'skills' || (panel === 'npc' && npcData)) UI.refreshPanel(true);
  };
  function setBar(el, v, max) {
    if (!el) return;
    el.querySelector('i').style.width = Math.max(0, Math.min(100, v / max * 100)) + '%';
    el.querySelector('span').textContent = `${fmt(Math.max(0, Math.round(v)))}/${fmt(max)}`;
  }

  function updateTutorial() {
    const t = G.me.tutorial, box = $('tutorial-box');
    if (!t || t.done) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const prog = t.type === 'kill' ? ` (${t.progress}/${t.n})` : t.type === 'level' ? ` (${G.me.level}/${t.n})` : '';
    const html = `<h4>📖 Hướng dẫn tân thủ ${t.step + 1}/${t.total}</h4><div>${esc(t.text)}${prog}</div>${t.complete ? '<button class="btn small green claim">Nhận thưởng</button>' : ''}`;
    if (box._h !== html) { box.innerHTML = html; box._h = html; }
    box.classList.toggle('pulse', !!t.complete);
  }

  UI.updateDaily = function () {
    const d = G.daily;
    if (!d) return;
    const done = d.list.filter(q => q.claimed).length;
    const html = `<h4>📅 Nhiệm vụ ngày (${done}/${d.list.length})</h4>` + d.list.filter(q => !q.claimed).slice(0, 3).map(q =>
      `<div class="q ${q.done ? 'done' : ''}"><span>${esc(q.text)}</span><b>${q.done ? '✔' : q.progress + '/' + q.n}</b></div>`).join('') +
      (d.list.some(q => q.done && !q.claimed) ? '<div class="small" style="color:#ffd76a">Có phần thưởng chờ nhận!</div>' : '');
    if (html !== lastDailyHtml) { $('daily-box').innerHTML = html; lastDailyHtml = html; }
    if (panel === 'quests') UI.refreshPanel(true);
  };

  UI.updateTarget = function (t) {
    const f = $('target-frame');
    if (!t) { f.classList.add('hidden'); return; }
    f.classList.remove('hidden');
    let name;
    if (t.type) { const info = G.data.monsters[t.type] || {}; name = `${t.boss ? '👑 ' : ''}${info.name} (Cấp ${info.lv})`; }
    else name = `${t.name} (Cấp ${t.level})`;
    f.classList.toggle('boss', !!t.boss);
    const n = f.querySelector('.t-name');
    if (n.textContent !== name) n.textContent = name;
    setBar(f.querySelector('.bar'), t.hp, t.maxHp);
  };

  UI.frame = function (now) {
    // hồi chiêu
    G.mySkills().forEach((s, i) => {
      const cd = G.skillCd(i);
      const r = cd ? Math.max(0, (cd.until - now) / cd.total) : 0;
      const txt = cd && cd.until > now && cd.total > 1000 ? Math.ceil((cd.until - now) / 1000) : '';
      for (const el of document.querySelectorAll(`#skillbar .skill[data-idx="${i}"], .act.sk[data-idx="${i}"]`)) {
        const o = el.querySelector('.cdo'), t = el.querySelector('.cdt');
        if (o) o.style.height = (r * 100) + '%';
        if (t && t.textContent != txt) t.textContent = txt;
      }
    });
    if (!UI._lastBuff || now - UI._lastBuff > 500) {
      UI._lastBuff = now;
      const me = G.me;
      if (me) {
        const parts = [];
        const t = Date.now();
        if (me.expBuffUntil > t) parts.push(`📗 x2 KN ${Math.ceil((me.expBuffUntil - t) / 60000)}p`);
        if (G.events) for (const e of G.events.list) if (e.active && e.key !== 'quiz') parts.push(`${e.icon} ${e.name}`);
        for (const b of me.buffs) if (b.until > t) parts.push(`✨ ${b.name} ${Math.ceil((b.until - t) / 1000)}s`);
        const h = parts.map(p => `<span>${esc(p)}</span>`).join('');
        if ($('buff-line')._h !== h) { $('buff-line').innerHTML = h; $('buff-line')._h = h; }
      }
      if (panel === 'events' && panelState.tab !== 'wheel') updateCountdowns();
    }
  };

  // ================= Thông báo / chat =================
  UI.toast = function (text, type = 'info') {
    const box = $('toasts');
    const d = document.createElement('div');
    d.className = 'toast ' + type;
    d.textContent = text;
    box.appendChild(d);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => d.remove(), 3100);
    if (type === 'item:epic' || type === 'item:legendary') GameAudio.sfx('rare');
    else if (type.startsWith('item')) G.sfx('pick');
    else if (type === 'level') GameAudio.sfx('level');
  };
  UI.announce = function (text) {
    const box = $('announce');
    const d = document.createElement('div');
    d.className = 'a'; d.textContent = text;
    box.innerHTML = ''; box.appendChild(d);
    setTimeout(() => d.remove(), 14000);
  };
  const chatLog = [];
  let chatFilter = 'all';
  const CH_NAME = { world: 'Thế giới', map: 'Bản đồ', guild: 'Bang', pm: 'Mật', sys: 'Hệ thống' };
  UI.chatMsg = function (m) {
    chatLog.push(m);
    if (chatLog.length > 200) chatLog.shift();
    if (m.ch === 'sys' && /Boss|xuất hiện|Sự kiện|nhặt được|quay trúng|Đố Vui|Quản Trị|Top/.test(m.text)) UI.announce(m.text);
    if (chatFilter === 'all' || chatFilter === m.ch || (m.ch === 'sys')) appendChat(m);
    if (m.ch === 'pm' && m.from !== (G.me && G.me.name)) UI.toast(`💌 ${m.from}: ${m.text}`, 'info');
  };
  function appendChat(m) {
    const log = $('chat-log');
    const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 20;
    const d = document.createElement('div');
    d.className = 'm ' + m.ch;
    const who = m.ch === 'sys' ? '' : `<span class="from ${m.admin ? 'gm' : ''}" data-name="${esc(m.from)}">${m.admin ? '[GM] ' : ''}${esc(m.from)}${m.ch === 'pm' && m.to ? ' → ' + esc(m.to) : ''}:</span> `;
    d.innerHTML = `<span class="ch">[${CH_NAME[m.ch] || m.ch}]</span>${who}${esc(m.text)}`;
    log.appendChild(d);
    while (log.children.length > 150) log.firstChild.remove();
    if (atBottom) log.scrollTop = log.scrollHeight;
  }
  function renderChat() { $('chat-log').innerHTML = ''; chatLog.filter(m => chatFilter === 'all' || m.ch === chatFilter || m.ch === 'sys').forEach(appendChat); }
  UI.focusChat = function () { $('chat').classList.remove('collapsed'); $('chat-input').focus(); };

  UI.onEvents = function (d) {
    const anyActive = d.list.some(e => e.active) || d.bosses.some(b => b.alive);
    $('event-dot').classList.toggle('hidden', !anyActive);
    if (panel === 'events') UI.refreshPanel(true);
  };

  function tip(e, html) { const t = $('tooltip'); t.innerHTML = html; t.classList.remove('hidden'); const p = Input.toLocal(e.clientX, e.clientY); t.style.left = Math.min(p.x + 12, Input.size().w - 250) + 'px'; t.style.top = Math.max(0, p.y - 80) + 'px'; }
  function hideTip() { $('tooltip').classList.add('hidden'); }

  // ================= Bảng chức năng =================
  const TITLES = { inventory: '🎒 Túi Đồ & Trang Bị', character: '🧍 Thông Tin Nhân Vật', quests: '📜 Nhiệm Vụ', guild: '🏯 Bang Hội', events: '🎉 Sự Kiện & Hoạt Động', leaderboard: '🏆 Bảng Xếp Hạng', settings: '⚙️ Cài Đặt', mount: '🐎 Thú Cưỡi', skills: '📖 Võ Công', npc: '' , online: '👥 Người Chơi Trực Tuyến' };
  UI.togglePanel = function (name) { if (panel === name) UI.closePanel(); else UI.openPanel(name); };
  UI.openPanel = function (name, state) {
    panel = name;
    panelState = Object.assign({}, state || {});
    $('panel').classList.remove('hidden');
    $('panel-title').textContent = TITLES[name] || '';
    if (name === 'guild') emit('guild');
    if (name === 'leaderboard') emit('lb');
    if (name === 'events') emit('eventPanel');
    if (name === 'quests') emit('daily');
    if (name === 'online') emit('online');
    UI.refreshPanel();
    G.sfx('click');
  };
  UI.closePanel = function () { panel = null; npcData = null; $('panel').classList.add('hidden'); hideTip(); };
  UI.refreshPanel = function (soft) {
    if (!panel || !G.me) return;
    const body = $('panel-body');
    const scroll = body.scrollTop;
    // không vẽ lại khi người dùng đang gõ
    if (soft && body.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    const fn = { inventory: renderInventory, character: renderCharacter, quests: renderQuests, guild: renderGuild, events: renderEvents, leaderboard: renderLeaderboard, settings: renderSettings, npc: renderNpc, online: renderOnline, mount: renderMount, skills: renderSkills }[panel];
    if (fn) fn(body);
    body.scrollTop = scroll;
  };
  function tabs(list, cur, key = 'tab') {
    return `<div class="tabs">${list.map(([k, n]) => `<button data-${key}="${k}" class="${k === cur ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  }
  function bindTabs(body, key = 'tab') {
    body.querySelectorAll(`[data-${key}]`).forEach(b => b.onclick = () => { panelState[key] = b.dataset[key]; panelState.sel = null; UI.refreshPanel(); });
  }

  // ---------- Túi đồ ----------
  function invGrid(body, opts = {}) {
    const me = G.me;
    const slotsOrder = ['helmet', 'amulet', 'weapon', 'armor', 'ring', 'boots'];
    let html = '<div class="inv-wrap">';
    if (!opts.noEquip) {
      html += '<div class="equip-grid">';
      for (const s of slotsOrder) {
        const e = me.equip[s];
        const it = e && G.data.items[e.id];
        html += `<div class="slot ${it ? 'r-' + it.rarity : ''} ${panelState.sel === 'eq:' + s ? 'sel' : ''}" data-eq="${s}">${it ? `<img src="${iconUrl(e.id)}" width="32" height="32" style="image-rendering:pixelated">${e.plus ? `<span class="plus">+${e.plus}</span>` : ''}` : `<span class="lbl">${G.data.slots[s]}</span>`}</div>`;
      }
      html += '</div>';
    }
    html += '<div class="inv-grid">';
    const inv = opts.filter ? me.inv.filter(opts.filter) : me.inv;
    for (const s of inv) {
      const it = G.data.items[s.id];
      const cant = it.lv > me.level;
      html += `<div class="slot r-${it.rarity} ${cant ? 'cant' : ''} ${panelState.sel === s.uid ? 'sel' : ''}" data-uid="${s.uid}"><img src="${iconUrl(s.id)}" width="32" height="32" style="image-rendering:pixelated">${s.qty > 1 ? `<span class="q">${s.qty}</span>` : ''}${s.plus ? `<span class="plus">+${s.plus}</span>` : ''}</div>`;
    }
    for (let i = me.inv.length; i < 48 && !opts.filter; i++) html += '<div class="slot" style="opacity:.35"></div>';
    html += '</div></div>';
    return html;
  }
  function selectedItem() {
    const me = G.me, sel = panelState.sel;
    if (!sel) return null;
    if (sel.startsWith('eq:')) { const slot = sel.slice(3); const e = me.equip[slot]; return e ? { equipped: true, slot, uid: e.uid, id: e.id, plus: e.plus, qty: 1 } : null; }
    const s = me.inv.find(x => x.uid === sel);
    return s ? Object.assign({ equipped: false }, s) : null;
  }
  function renderInventory(body) {
    const me = G.me;
    let html = `<div class="small muted" style="margin-bottom:6px">💰 ${fmt(me.gold)} lượng · 💎 ${fmt(me.knb)} Nguyên Bảo · Túi ${me.inv.length}/48 · Lực chiến <b style="color:#ffd76a">${fmt(me.stats.power)}</b></div>`;
    html += invGrid(body);
    html += itemActions();
    body.innerHTML = html;
    bindInv(body);
  }
  function itemActions(ctx = {}) {
    const s = selectedItem();
    if (!s) return '<div class="item-detail muted small">Chọn một vật phẩm để xem chi tiết. Chạm 2 lần để dùng/trang bị nhanh.</div>';
    const it = G.data.items[s.id];
    let btns = '';
    if (s.equipped) btns += `<button class="btn small" data-act="unequip">Tháo</button>`;
    else if (it.type === 'equip') btns += `<button class="btn small green" data-act="equip">Trang bị</button>`;
    else if (it.type === 'use') btns += `<button class="btn small green" data-act="use">Sử dụng</button>`;
    if (!s.equipped && (s.id.startsWith('hp') || s.id.startsWith('mp'))) btns += `<button class="btn small" data-act="quick">Đặt thuốc nhanh</button>`;
    if (ctx.shop && !s.equipped) btns += `<button class="btn small" data-act="sell">Bán (${fmt(Math.floor(it.price * 0.3 * (1 + (s.plus || 0) * 0.2)) * s.qty)})</button>`;
    let extra = '';
    if (ctx.enhance && it.type === 'equip') extra = enhanceBox(s, it);
    if (!s.equipped) btns += `<button class="btn small" data-act="discard">Vứt bỏ</button>`;
    return `<div class="item-detail">${itemDesc(s.id, s.plus)}${s.qty > 1 ? `<div class="small">Số lượng: ${s.qty}</div>` : ''}<div class="row" style="justify-content:flex-start;margin-top:6px">${btns}</div>${extra}</div>`;
  }
  let lastTap = { id: null, t: 0 };
  function enhanceBox(s, it) {
    const E = G.data.enhance, plus = s.plus || 0, me = G.me;
    if (plus >= E.max) return `<div class="enh-box"><b style="color:#ff5050">✦ Đã đạt cường hóa tối đa +${E.max} ✦</b></div>`;
    const cost = E.cost[plus][it.tier], rate = Math.round(E.rate[plus] * 100);
    const have = id => me.inv.filter(x => x.id === id).reduce((a, x) => a + x.qty, 0);
    const risky = plus >= E.safe, ins = have('insure');
    const ok = have('stone') >= cost.stone && have('stone2') >= cost.stone2 && me.gold >= cost.gold && (!risky || !panelState.insure || ins > 0);
    const bar = Array.from({ length: E.max }, (_, i) => `<i class="${i < plus ? 'on' : ''} ${i >= E.safe ? 'risk' : ''}"></i>`).join('');
    const nextStats = it.stats ? Object.entries(it.stats).filter(([k]) => k !== 'crit' && k !== 'spd').map(([k, v]) => `${STAT_NAME[k]} ${Math.round(v * plusMult(plus))} → <b style="color:#4ade80">${Math.round(v * plusMult(plus + 1))}</b>`).join(' · ') : '';
    return `<div class="enh-box">
      <div class="enh-bar">${bar}</div>
      <div class="small">+${plus} → <b style="color:#ffd76a">+${plus + 1}</b> · Tỉ lệ thành công: <b style="color:${rate >= 60 ? '#4ade80' : rate >= 20 ? '#ffd76a' : '#ff5050'}">${rate}%</b></div>
      <div class="small">${nextStats}</div>
      <div class="small">Cần: <span class="${have('stone') >= cost.stone ? '' : 'warn'}">Huyền Tinh Thạch ${have('stone')}/${cost.stone}</span>${cost.stone2 ? ` · <span class="${have('stone2') >= cost.stone2 ? '' : 'warn'}">Thiên Tinh Thạch ${have('stone2')}/${cost.stone2}</span>` : ''} · <span class="${me.gold >= cost.gold ? '' : 'warn'}">${fmt(cost.gold)} lượng</span></div>
      ${risky ? `<label class="small enh-ins"><input type="checkbox" id="enh-insure" ${panelState.insure ? 'checked' : ''}> Dùng Bảo Hiểm Phù (còn ${ins}) — ${panelState.insure ? '<span style="color:#4ade80">thất bại sẽ giữ nguyên cấp</span>' : '<span class="warn">⚠ KHÔNG bảo hiểm: thất bại sẽ rớt về +1!</span>'}</label>` : `<div class="small muted">Dưới +${E.safe}: thất bại không mất cấp.</div>`}
      <button class="btn primary" data-act="enhance" ${ok ? '' : 'disabled'}>🔨 Cường hóa +${plus + 1}</button>
      ${panelState.enhRes ? `<div class="enh-res ${panelState.enhRes}">${{ ok: '✨ THÀNH CÔNG!', fail: '💢 Thất bại', insured: '🛡️ Thất bại – Bảo hiểm đã giữ cấp', drop: '💥 Thất bại – rớt về +1' }[panelState.enhRes]}</div>` : ''}
    </div>`;
  }
  UI.onEnhance = function (d) { panelState.enhRes = d.result; UI.refreshPanel(); setTimeout(() => { panelState.enhRes = null; }, 2500); };

  function bindInv(body, ctx = {}) {
    const ins = body.querySelector('#enh-insure');
    if (ins) ins.onchange = () => { panelState.insure = ins.checked; UI.refreshPanel(); };
    body.querySelectorAll('[data-uid],[data-eq]').forEach(el => el.onclick = () => {
      const id = el.dataset.uid || ('eq:' + el.dataset.eq);
      const now = Date.now();
      if (lastTap.id === id && now - lastTap.t < 350) {
        if (el.dataset.eq) emit('unequip', { slot: el.dataset.eq });
        else emit('useItem', { uid: el.dataset.uid });
        panelState.sel = null;
      } else panelState.sel = id;
      lastTap = { id, t: now };
      UI.refreshPanel();
    });
    body.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const s = selectedItem(); if (!s) return;
      const a = b.dataset.act;
      if (a === 'equip') emit('equip', { uid: s.uid });
      if (a === 'use') emit('useItem', { uid: s.uid });
      if (a === 'unequip') emit('unequip', { slot: s.slot });
      if (a === 'quick') emit('setQuick', { kind: s.id.startsWith('mp') ? 'mp' : 'hp', id: s.id });
      if (a === 'sell') emit('sell', { uid: s.uid, qty: s.qty });
      if (a === 'enhance') { emit('enhance', { uid: s.uid, npc: npcData && npcData.id, insure: !!panelState.insure }); return; }
      if (a === 'discard') { G.modal(`Vứt bỏ ${G.data.items[s.id].name}?`, [{ t: 'Vứt', cls: 'primary', fn: () => emit('discard', { uid: s.uid }) }, { t: 'Hủy' }]); return; }
      if (a !== 'enhance') panelState.sel = null;
    });
  }

  // ---------- Nhân vật ----------
  function renderCharacter(body) {
    const me = G.me, st = me.stats, cl = G.data.classes[me.cls];
    body.innerHTML = `
      <div class="npc-head"><canvas width="64" height="64" id="char-cv"></canvas><div><h3 style="margin:0;color:#ffd76a">${esc(me.name)}</h3>
      <div>${cl.name} · ${cl.role} · Cấp ${me.level}</div><div class="small muted">${me.guild ? 'Bang: ' + esc(me.guild.name) + ' (' + ROLE_NAME[me.guild.role] + ')' : 'Chưa gia nhập bang hội'}</div></div></div>
      <div class="stat-grid">
        <div>Lực chiến <b>${fmt(st.power)}</b></div><div>Sinh lực <b>${fmt(me.hp)}/${fmt(st.maxHp)}</b></div><div>Nội lực <b>${fmt(me.mp)}/${fmt(st.maxMp)}</b></div>
        <div>Tấn công <b>${fmt(st.atk)}</b></div><div>Phòng thủ <b>${fmt(st.def)}</b></div><div>Chí mạng <b>${st.crit}%</b></div>
        <div>Tốc độ <b>${Math.round(st.spd)}</b></div><div>Kinh nghiệm <b>${fmt(me.exp)}/${fmt(me.expNext)}</b></div><div>Tầm đánh <b>${cl.range}</b></div>
        <div>Quái đã diệt <b>${fmt(me.kills)}</b></div><div>Hạ người chơi <b>${fmt(me.pvpKills)}</b></div><div>Boss đã đánh <b>${fmt(me.bossKills)}</b></div>
      </div>
      <h4 style="color:#ffd76a">Võ công</h4>
      <div class="list">${cl.skills.map((s, i) => `<div class="li ${me.level >= s.lv ? 'done' : ''}"><div class="grow"><b>${i + 1}. ${esc(s.name)}</b> ${me.level < s.lv ? `<span class="warn small">(Mở ở cấp ${s.lv})</span>` : ''}<div class="sub">${skillDesc(s)} · ${s.mp} MP · Hồi ${s.cd / 1000}s</div></div></div>`).join('')}</div>
      <h4 style="color:#ffd76a">🐉 Long Ấn (phím 7)</h4>
      <div class="list">${Object.entries(G.data.dragons).map(([el, d]) => {
        const has = me.dragons && me.dragons[el], on = me.dragon === el;
        return `<div class="li ${has ? 'done' : ''}"><img src="${iconUrl(d.book)}" width="32" height="32" style="image-rendering:pixelated"><div class="grow"><b class="dr-${el}">${esc(d.name)}</b>${on ? ' <span style="color:#4ade80">● Đang dùng</span>' : ''}<div class="sub">${esc(d.desc)} · ${d.mp} MP · Hồi ${d.cd / 1000}s · Cần cấp ${d.lv}</div></div>
          ${has ? (on ? '' : `<button class="btn small green" data-dragon="${el}">Dùng</button>`) : '<span class="small muted">Chưa học<br>(Bí kíp: Boss, Kỳ Trân Các, Hoa Đăng)</span>'}</div>`;
      }).join('')}</div>`;
    body.querySelectorAll('[data-dragon]').forEach(b => b.onclick = () => emit('dragon', { el: b.dataset.dragon }));
    const c = $('char-cv').getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(Sprites.playerSprite(me.cls, cl.colors, 0, 0), 0, 0);
  }

  // ---------- Nhiệm vụ ----------
  function rewardText(r) {
    if (!r) return '';
    const p = [];
    if (r.exp) p.push(fmt(r.exp) + ' KN'); if (r.gold) p.push(fmt(r.gold) + ' lượng'); if (r.knb) p.push(r.knb + ' 💎');
    for (const [id, q] of r.items || []) p.push(`${G.data.items[id] ? G.data.items[id].name : id} x${q}`);
    return p.join(', ');
  }
  function renderQuests(body) {
    const tab = panelState.tab || (G.me.tutorial.done ? 'daily' : 'tutorial');
    let html = tabs([['tutorial', '📖 Tân thủ'], ['daily', '📅 Hàng ngày']], tab);
    if (tab === 'tutorial') {
      const t = G.me.tutorial;
      if (t.done) html += '<p>Bạn đã hoàn thành toàn bộ hướng dẫn tân thủ. Chúc đại hiệp sớm danh chấn giang hồ!</p>';
      else {
        const prog = t.type === 'kill' ? `${t.progress}/${t.n}` : t.type === 'level' ? `${G.me.level}/${t.n}` : (t.complete ? '1/1' : '0/1');
        html += `<div class="card"><h4>Bước ${t.step + 1}/${t.total}</h4><p>${esc(t.text)}</p><div class="small">Tiến độ: ${prog}</div><div class="small" style="color:#ffd76a">Thưởng: ${rewardText(t.reward)}</div>
          ${t.complete ? '<button class="btn green" id="tut-claim">Nhận thưởng</button>' : ''}</div>
          <div class="card small"><h4>Mẹo chơi</h4>
          <div>• Di chuyển: WASD/phím mũi tên (PC), joystick ảo (mobile), hoặc tay cầm.</div>
          <div>• Đánh: phím 1/Space, kỹ năng 2-4. Z/X dùng thuốc. Tab đổi mục tiêu. F nói chuyện NPC.</div>
          <div>• Nhấn nút 🤖 Tự động (R) để tự đánh quái quanh khu vực.</div>
          <div>• Nhấp vào NPC để trò chuyện, mua đồ. Đồ VIP (tím/cam) rơi từ quái và Boss!</div></div>`;
      }
    } else {
      const d = G.daily;
      if (!d) html += '<p class="muted">Đang tải...</p>';
      else {
        html += '<div class="list">' + d.list.map(q => `<div class="li ${q.done ? 'done' : ''}"><div class="grow"><b>${esc(q.text)}</b><div class="sub">Thưởng: ${rewardText(q.reward)}</div><div class="progress"><i style="width:${q.progress / q.n * 100}%"></i></div></div>
          <div>${q.claimed ? '<span class="muted">Đã nhận</span>' : q.done ? `<button class="btn small green" data-claim="${q.id}">Nhận</button>` : `${q.progress}/${q.n}`}</div></div>`).join('') + '</div>';
        const allDone = d.list.every(q => q.claimed);
        html += `<div class="card" style="margin-top:8px"><h4>🎁 Thưởng hoàn thành tất cả</h4><div class="small">${rewardText(d.bonus)}</div>${d.bonusClaimed ? '<span class="muted">Đã nhận</span>' : `<button class="btn small green" data-claim="bonus" ${allDone ? '' : 'disabled'}>Nhận</button>`}</div>
          <p class="small muted">Nhiệm vụ làm mới lúc 0:00 mỗi ngày (giờ Việt Nam).</p>`;
      }
    }
    body.innerHTML = html;
    bindTabs(body);
    const tc = $('tut-claim'); if (tc) tc.onclick = () => emit('tutorialClaim');
    body.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => emit('dailyClaim', { id: b.dataset.claim }));
  }

  // ---------- Bang hội ----------
  let guildData = null;
  UI.onGuild = function (d) { guildData = d; if (panel === 'guild') UI.refreshPanel(); };
  function renderGuild(body) {
    const d = guildData;
    if (!d) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    if (!d.mine) {
      body.innerHTML = `<div class="card"><h4>Thành lập bang hội</h4><div class="small muted">Yêu cầu cấp 10 và ${fmt(d.cost)} lượng. Bang hội tăng chỉ số cho thành viên theo cấp bang.</div>
        <div class="row" style="justify-content:flex-start;margin-top:6px"><input id="g-name" placeholder="Tên bang (3-16 ký tự)" maxlength="16"><button class="btn primary" id="g-create">Lập bang</button></div></div>
        <h4 style="color:#ffd76a">Danh sách bang hội</h4>
        <div class="list">${(d.list || []).map(g => `<div class="li"><div class="grow"><b>${esc(g.name)}</b> <span class="small">Cấp ${g.level}</span><div class="sub">Bang chủ: ${esc(g.leader)} · ${g.count}/${g.max} thành viên · Quỹ ${fmt(g.fund)}</div></div><button class="btn small" data-apply="${g.id}">Xin gia nhập</button></div>`).join('') || '<p class="muted">Chưa có bang hội nào. Hãy là người đầu tiên!</p>'}</div>`;
      $('g-create').onclick = () => emit('guild', { op: 'create', name: $('g-name').value });
      body.querySelectorAll('[data-apply]').forEach(b => b.onclick = () => emit('guild', { op: 'apply', id: b.dataset.apply }));
      return;
    }
    const g = d.mine, role = d.myRole, mgr = role === 'leader' || role === 'elder';
    const tab = panelState.tab || 'info';
    let html = tabs([['info', 'Thông tin'], ['members', `Thành viên (${g.count})`], ...(mgr ? [['requests', `Đơn xin (${g.requests.length})`]] : [])], tab);
    if (tab === 'info') {
      html += `<div class="card"><h4>🏯 ${esc(g.name)} — Cấp ${g.level}</h4>
        <div class="small">Bang chủ: ${esc(g.leader)} · Thành viên: ${g.count}/${g.max}</div>
        <div class="small">Quỹ bang: ${fmt(g.fund)} ${g.next ? `/ ${fmt(g.next)} để lên cấp ${g.level + 1}` : '(tối đa)'}</div>
        ${g.next ? `<div class="progress"><i style="width:${Math.min(100, g.fund / g.next * 100)}%"></i></div>` : ''}
        <div class="small" style="color:#9ae6b4">Phúc lợi: +${g.level * 2}% Tấn công, Phòng thủ, Sinh lực cho mọi thành viên</div></div>
        <div class="card"><h4>📢 Thông báo bang</h4><p>${esc(g.notice)}</p>${mgr ? `<div class="row" style="justify-content:flex-start"><input id="g-notice" maxlength="200" placeholder="Thông báo mới" style="flex:1"><button class="btn small" id="g-notice-btn">Cập nhật</button></div>` : ''}</div>
        <div class="card"><h4>💰 Cống hiến</h4><div class="row" style="justify-content:flex-start"><input id="g-donate" type="number" min="100" step="100" value="1000" style="width:120px"><button class="btn small green" id="g-donate-btn">Cống hiến lượng</button></div></div>
        <div class="row">${role === 'leader' ? '<button class="btn small primary" id="g-disband">Giải tán bang</button>' : ''}<button class="btn small" id="g-leave">Rời bang</button><button class="btn small" id="g-chat">Chat bang</button></div>`;
    } else if (tab === 'members') {
      html += `<table class="tbl"><tr><th>Tên</th><th>Môn phái</th><th>Cấp</th><th>Chức vụ</th><th>Cống hiến</th><th></th></tr>${g.members.map(m => `<tr><td>${m.online ? '🟢' : '⚫'} ${esc(m.name)}</td><td>${G.data.classes[m.cls].name}</td><td>${m.level}</td><td>${ROLE_NAME[m.role]}</td><td>${fmt(m.contrib)}</td><td>
        ${m.uid !== d.myId && role === 'leader' ? `${m.role === 'member' ? `<button class="btn small" data-op="promote" data-uid="${m.uid}">↑</button>` : `<button class="btn small" data-op="demote" data-uid="${m.uid}">↓</button>`}<button class="btn small" data-op="transfer" data-uid="${m.uid}" title="Nhường chức">👑</button>` : ''}
        ${m.uid !== d.myId && mgr && m.role !== 'leader' && !(m.role === 'elder' && role !== 'leader') ? `<button class="btn small" data-op="kick" data-uid="${m.uid}">✕</button>` : ''}</td></tr>`).join('')}</table>`;
    } else {
      html += `<div class="list">${g.requests.map(r => `<div class="li"><div class="grow"><b>${esc(r.name)}</b><div class="sub">${G.data.classes[r.cls].name} · Cấp ${r.level}</div></div><button class="btn small green" data-op="accept" data-uid="${r.uid}">Duyệt</button><button class="btn small" data-op="reject" data-uid="${r.uid}">Từ chối</button></div>`).join('') || '<p class="muted">Không có đơn xin gia nhập.</p>'}</div>`;
    }
    body.innerHTML = html;
    bindTabs(body);
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    on('g-notice-btn', () => emit('guild', { op: 'notice', text: $('g-notice').value }));
    on('g-donate-btn', () => emit('guild', { op: 'donate', amount: +$('g-donate').value }));
    on('g-leave', () => G.modal('Bạn chắc chắn muốn rời bang?', [{ t: 'Rời bang', cls: 'primary', fn: () => emit('guild', { op: 'leave' }) }, { t: 'Hủy' }]));
    on('g-disband', () => G.modal('Giải tán bang hội? Hành động không thể hoàn tác!', [{ t: 'Giải tán', cls: 'primary', fn: () => emit('guild', { op: 'disband' }) }, { t: 'Hủy' }]));
    on('g-chat', () => { UI.closePanel(); $('chat-ch').value = 'guild'; UI.focusChat(); });
    body.querySelectorAll('[data-op]').forEach(b => b.onclick = () => {
      const send = () => emit('guild', { op: b.dataset.op, uid: b.dataset.uid });
      if (b.dataset.op === 'transfer' || b.dataset.op === 'kick') G.modal(b.dataset.op === 'kick' ? 'Trục xuất thành viên này?' : 'Nhường chức bang chủ cho thành viên này?', [{ t: 'Đồng ý', cls: 'primary', fn: send }, { t: 'Hủy' }]);
      else send();
    });
  }

  // ---------- Sự kiện ----------
  let evPanel = null, wheelAngle = 0, wheelSpinning = false;
  UI.onEventPanel = function (d) { evPanel = d; if (panel === 'events' && !wheelSpinning) UI.refreshPanel(); };
  function mmss(ms) { ms = Math.max(0, ms); const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000); return m >= 60 ? `${Math.floor(m / 60)}g${m % 60}p` : `${m}:${String(s).padStart(2, '0')}`; }
  function updateCountdowns() {
    document.querySelectorAll('[data-until]').forEach(el => { el.textContent = mmss(+el.dataset.until - Date.now()); });
  }
  function renderEvents(body) {
    const tab = panelState.tab || 'events';
    let html = tabs([['events', '🎉 Sự kiện'], ['boss', '👑 Boss'], ['wheel', '🎡 Vòng quay'], ['checkin', '📆 Điểm danh'], ['lantern', '🏮 Đổi Hoa Đăng'], ['code', '🎁 Gift code']], tab);
    const ev = G.events;
    if (tab === 'events') {
      html += '<div class="list">' + (ev ? ev.list.map(e => `<div class="li ${e.active ? 'done' : ''}"><div style="font-size:24px">${e.icon}</div><div class="grow"><b>${esc(e.name)}</b> ${e.active ? `<span style="color:#4ade80">● Đang diễn ra · còn <span data-until="${e.until}"></span></span>` : '<span class="muted">Chưa diễn ra</span>'}
        <div class="sub">${esc(e.desc)}</div>
        ${e.q ? `<div style="color:#ffd76a">❓ ${esc(e.q)}</div>` : ''}${e.chests != null ? `<div class="small">Còn ${e.chests} Bảo Rương</div>` : ''}
        ${e.top ? `<div class="small">${e.top.slice(0, 5).map((t, i) => `${i + 1}. ${esc(t.name)} (${t.n})`).join(' · ') || 'Chưa có ai'}</div>` : ''}</div></div>`).join('') : '') + '</div>';
    } else if (tab === 'boss') {
      html += '<table class="tbl"><tr><th>Boss</th><th>Cấp</th><th>Bản đồ</th><th>Trạng thái</th></tr>' + (ev ? ev.bosses.map(b => `<tr><td>👑 ${esc(b.name)}</td><td>${b.lv}</td><td>${esc(b.mapName)}</td><td>${b.alive ? `<span style="color:#ff6060">Đang xuất hiện! (${Math.round(b.hp / b.maxHp * 100)}% máu)</span>` : `Xuất hiện sau ~${b.next} phút`}</td></tr>`).join('') : '') + '</table><p class="small muted">Boss xuất hiện theo giờ cố định, tồn tại 25 phút. Top 3 sát thương nhận Rương Thủ Lĩnh + Nguyên Bảo. Boss rơi nhiều đồ Hiếm/VIP/Truyền Kỳ!</p>';
    } else if (tab === 'wheel') {
      const w = evPanel && evPanel.wheel;
      html += `<div class="wheel-wrap"><canvas id="wheel-canvas" width="480" height="480"></canvas><div><p>Lượt miễn phí hôm nay: <b>${w ? w.free : '-'}</b><br>Lượt thêm (vé): <b>${w ? w.extra : '-'}</b></p><button class="btn primary big" id="wheel-spin" ${wheelSpinning ? 'disabled' : ''}>QUAY</button><p class="small muted">Mua Vé Vòng Quay tại Tạp Hóa hoặc Kỳ Trân Các.</p><p id="wheel-res" style="color:#ffd76a"></p></div></div>`;
    } else if (tab === 'checkin') {
      const c = evPanel && evPanel.checkin;
      if (c) html += `<div class="card"><h4>Điểm danh 7 ngày liên tiếp</h4><div class="checkin-row">${c.rewards.map((r, i) => `<div class="${i < c.streak ? 'got' : ''} ${(!c.done && i === c.streak % 7) ? 'today' : ''}"><b>Ngày ${i + 1}</b><br>${rewardText(r)}</div>`).join('')}</div>
        <div class="row" style="margin-top:8px"><button class="btn green" id="checkin-btn" ${c.done ? 'disabled' : ''}>${c.done ? 'Đã điểm danh hôm nay' : 'Điểm danh'}</button></div></div>`;
    } else if (tab === 'lantern') {
      const l = evPanel;
      html += `<p>Bạn có <b>${l ? l.tokens : 0}</b> 🏮 Hoa Đăng. Hoa Đăng rơi từ quái khi diễn ra Lễ Hội Hoa Đăng.</p><div class="list">${l ? l.lantern.map((x, i) => `<div class="li"><div class="grow"><b>${esc(x.name)}</b><div class="sub">Cần ${x.cost} Hoa Đăng</div></div><button class="btn small green" data-lantern="${i}" ${l.tokens >= x.cost ? '' : 'disabled'}>Đổi</button></div>`).join('') : ''}</div>`;
    } else if (tab === 'code') {
      html += `<div class="card"><h4>Nhập Gift Code</h4><div class="row" style="justify-content:flex-start"><input id="gc-input" placeholder="Nhập mã quà tặng" maxlength="24" style="text-transform:uppercase"><button class="btn green" id="gc-btn">Nhận quà</button></div><p class="small muted">Theo dõi fanpage/thông báo để nhận gift code từ quản trị viên.</p></div>`;
    }
    body.innerHTML = html;
    bindTabs(body);
    updateCountdowns();
    if (tab === 'wheel') { drawWheel(); const b = $('wheel-spin'); if (b) b.onclick = () => { if (!wheelSpinning) emit('wheel'); }; }
    const ci = $('checkin-btn'); if (ci) ci.onclick = () => emit('checkin');
    const gc = $('gc-btn'); if (gc) gc.onclick = () => emit('giftcode', { code: $('gc-input').value });
    body.querySelectorAll('[data-lantern]').forEach(b => b.onclick = () => emit('lantern', { idx: +b.dataset.lantern }));
  }
  const WHEEL_COLORS = ['#b8322a', '#d4a020', '#2a6ab8', '#7a2ab8', '#2a8a3a', '#b86a2a', '#2aa8a8', '#a82a6a', '#ff9b2f', '#555'];
  function drawWheel() {
    const cv = $('wheel-canvas');
    if (!cv || !evPanel) return;
    const ctx = cv.getContext('2d'), prizes = evPanel.wheel.prizes, n = prizes.length, R = 220, C = 240;
    ctx.clearRect(0, 0, 480, 480);
    ctx.save(); ctx.translate(C, C); ctx.rotate(wheelAngle);
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 3; ctx.stroke();
      ctx.save(); ctx.rotate((a0 + a1) / 2); ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'right'; ctx.fillText(prizes[i], R - 14, 6); ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.arc(C, C, 26, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(C + R - 10, C); ctx.lineTo(C + R + 18, C - 14); ctx.lineTo(C + R + 18, C + 14); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
  }
  UI.onWheel = function (d) {
    if (panel !== 'events') UI.openPanel('events', { tab: 'wheel' });
    panelState.tab = 'wheel';
    if (evPanel) evPanel.wheel = d.state;
    wheelSpinning = true;
    UI.refreshPanel();
    const n = evPanel.wheel.prizes.length;
    // mũi chỉ ở góc 0 (bên phải): xoay để tâm ô idx trùng góc 0
    const target = -((d.idx + 0.5) / n) * Math.PI * 2;
    const end = target - Math.PI * 2 * 6;
    const t0 = performance.now(), dur = 4000;
    const startNorm = wheelAngle % (Math.PI * 2);
    const total = (end - startNorm);
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      wheelAngle = startNorm + total * e;
      drawWheel();
      if (p < 1 && panel === 'events') requestAnimationFrame(step);
      else { wheelSpinning = false; wheelAngle = target; const r = $('wheel-res'); if (r) r.textContent = '🎉 ' + d.name; UI.refreshPanel(); }
    };
    requestAnimationFrame(step);
  };

  // ---------- Bảng xếp hạng ----------
  let lbData = null;
  UI.onLeaderboard = function (d) { lbData = d; if (panel === 'leaderboard') UI.refreshPanel(); };
  function renderLeaderboard(body) {
    const tab = panelState.tab || 'level';
    const tabsList = [['level', 'Cấp độ'], ['power', 'Lực chiến'], ['gold', 'Phú hộ'], ['kills', 'Săn quái'], ['pvp', 'PK'], ['boss', 'Săn Boss'], ['guild', 'Bang hội']];
    let html = tabs(tabsList, tab);
    if (!lbData) html += '<p class="muted">Đang tải...</p>';
    else if (tab === 'guild') {
      html += `<table class="tbl"><tr><th>#</th><th>Bang hội</th><th>Cấp</th><th>Bang chủ</th><th>Thành viên</th><th>Quỹ</th></tr>${lbData.guild.map((g, i) => `<tr><td class="rank-${i + 1}">${i + 1}</td><td>${esc(g.name)}</td><td>${g.level}</td><td>${esc(g.leader)}</td><td>${g.count}</td><td>${fmt(g.fund)}</td></tr>`).join('')}</table>`;
    } else {
      const col = { level: 'Cấp', power: 'Lực chiến', gold: 'Ngân lượng', kills: 'Quái', pvp: 'Hạ gục', boss: 'Boss' }[tab];
      html += `<table class="tbl"><tr><th>#</th><th>Nhân vật</th><th>Môn phái</th><th>Bang</th><th>${col}</th></tr>${(lbData[tab] || []).map((r, i) => `<tr class="${G.me && r.name === G.me.name ? 'me' : ''}"><td class="rank-${i + 1}">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td>${esc(r.name)} <span class="muted small">Lv${r.level}</span></td><td>${G.data.classes[r.cls].name}</td><td>${esc(r.guild)}</td><td>${fmt(r.v)}</td></tr>`).join('')}</table>`;
    }
    html += '<p class="small muted">Cập nhật mỗi 30 giây.</p>';
    body.innerHTML = html;
    bindTabs(body);
  }

  // ---------- Cài đặt ----------
  function renderSettings(body) {
    const s = G.settings;
    const pad = navigator.getGamepads && [...navigator.getGamepads()].find(p => p && p.connected);
    body.innerHTML = `
      <div class="card"><h4>Hiển thị & âm thanh</h4>
        <label><input type="checkbox" data-set="names" ${s.names ? 'checked' : ''}> Hiện tên nhân vật/quái</label><br>
        <label><input type="checkbox" id="au-music" ${GameAudio.state.music ? 'checked' : ''}> 🎵 Nhạc nền võ lâm</label> <input type="range" id="au-mvol" min="0" max="1" step="0.05" value="${GameAudio.state.musicVol}" style="width:110px;vertical-align:middle"><br>
        <label><input type="checkbox" id="au-sfx" ${GameAudio.state.sfx ? 'checked' : ''}> 🔊 Âm thanh hiệu ứng</label> <input type="range" id="au-svol" min="0" max="1" step="0.05" value="${GameAudio.state.sfxVol}" style="width:110px;vertical-align:middle"><br>
        <label><input type="checkbox" data-set="shake" ${s.shake ? 'checked' : ''}> Rung màn hình khi bị đánh</label>
        <div class="row" style="justify-content:flex-start;margin-top:6px"><button class="btn small" id="set-fs">⛶ Toàn màn hình</button><button class="btn small" id="set-online">👥 Người chơi online</button></div></div>
      <div class="card small"><h4>Điều khiển</h4>
        <div><b>PC:</b> WASD/mũi tên di chuyển · Nhấp chuột để đi/chọn mục tiêu · 1/Space đánh · 2–7 các ô kỹ năng (tự gán trong bảng Võ Công, phím K) · Z/X thuốc · T cưỡi thú · Tab đổi mục tiêu · F nói chuyện NPC · R tự động · Enter chat · I/C/M/J/G/O/L mở bảng · Esc đóng</div>
        <div><b>Mobile:</b> Joystick trái để di chuyển · Nút ⚔️ (giữ để đánh liên tục) · 3 nút kỹ năng · ❤️💧 thuốc · 🎯 đổi mục tiêu · Chạm NPC/quái để tương tác</div>
        <div><b>Tay cầm:</b> Cần trái/D-pad di chuyển · A đánh · X/Y/B kỹ năng · LB/RB thuốc · LT đổi mục tiêu · RT nói chuyện NPC · Back mở túi · Start tự động ${pad ? `<br><span style="color:#4ade80">🎮 Đã kết nối: ${esc(pad.id.slice(0, 40))}</span>` : '<br><span class="muted">Chưa phát hiện tay cầm (nhấn một nút bất kỳ để kết nối)</span>'}</div></div>
      <div class="card"><h4>Tài khoản</h4>
        <div class="small muted">${G.user && G.user.username ? 'Tài khoản: <b>' + esc(G.user.username) + '</b>' : 'Đăng nhập bằng Google: ' + esc(G.user && G.user.email)}</div>
        ${G.user && G.user.username ? `<div class="row" style="justify-content:flex-start;margin-top:6px"><input id="pw-old" type="password" placeholder="Mật khẩu cũ" style="width:130px"><input id="pw-new" type="password" placeholder="Mật khẩu mới" style="width:130px"><button class="btn small" id="pw-change">Đổi mật khẩu</button></div>` : ''}
        <button class="btn small primary" id="set-logout" style="margin-top:6px">Đăng xuất</button></div>`;
    body.querySelectorAll('[data-set]').forEach(c => c.onchange = () => { G.settings[c.dataset.set] = c.checked; G.saveSettings(); });
    $('set-fs').onclick = () => Input.toggleFullscreen();
    $('au-music').onchange = e => { GameAudio.set('music', e.target.checked); UI.updateMusicBtn(); };
    $('au-sfx').onchange = e => GameAudio.set('sfx', e.target.checked);
    $('au-mvol').oninput = e => GameAudio.set('musicVol', +e.target.value);
    $('au-svol').oninput = e => { GameAudio.set('sfxVol', +e.target.value); GameAudio.sfx('coin', 150); };
    $('set-online').onclick = () => UI.openPanel('online');
    $('set-logout').onclick = () => G.logout();
    const pc = $('pw-change');
    if (pc) pc.onclick = async () => {
      const r = await fetch('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + G.token }, body: JSON.stringify({ oldPassword: $('pw-old').value, newPassword: $('pw-new').value }) });
      const j = await r.json().catch(() => ({}));
      UI.toast(r.ok ? 'Đã đổi mật khẩu' : (j.error || 'Lỗi'), r.ok ? 'reward' : 'error');
      if (r.ok) { $('pw-old').value = ''; $('pw-new').value = ''; }
    };
  }

  let onlineData = null;
  UI.onOnline = function (d) { onlineData = d; if (panel === 'online') UI.refreshPanel(); };
  // ---------- Võ công: học, nâng cấp, gán nút ----------
  function renderSkills(body) {
    const me = G.me, skills = G.mySkills(), max = G.data.skillMax || 10;
    const hb = me.hotbar || [1, 2, 3, 4, 5, 6];
    const BOOK_PRICE = [0, 300, 2500, 12000, 50000, 180000];
    const upCost = (idx, lv) => ({ sp: lv, gold: Math.round(400 * lv * lv * ((idx === 6 ? 5 : idx) + 1)) });
    let html = `<div class="sk-head"><div>📜 Điểm võ học: <b style="color:#ffd76a">${me.sp}</b> <span class="small muted">(mỗi cấp nhân vật +1 điểm)</span></div><div class="small muted">Sách võ công bán tại <b>Tàng Kinh Các</b> – Tương Dương</div></div>`;
    html += '<h4 class="sk-title">⌨️ Gán nút kỹ năng</h4><div class="sk-slots">';
    const learnedList = skills.filter(s => s && s.idx > 0 && s.learned);
    for (let n = 0; n < 6; n++) {
      html += `<label class="sk-slot"><span class="key">${Input.isTouch ? 'Nút ' + (n + 1) : 'Phím ' + SLOT_KEYS[n]}</span><select data-slot="${n}"><option value="0">— Trống —</option>${learnedList.map(s => `<option value="${s.idx}" ${hb[n] === s.idx ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>`;
    }
    html += '</div><h4 class="sk-title">📖 Võ học môn phái</h4><div class="list">';
    skills.forEach((s, i) => {
      if (!s) return;
      const lvOk = me.level >= s.lv;
      const nextS = s.learned && s.slv < max ? G.scaleSkill(i === 6 ? G.data.dragons[me.dragon] : G.data.classes[me.cls].skills[i], s.slv + 1) : null;
      const cost = upCost(i, s.slv);
      const effect = s.mult ? `Sát thương x${s.mult}${nextS ? ` → <b style="color:#4ade80">x${nextS.mult}</b>` : ''}` : s.heal ? `Hồi ${Math.round(s.heal * 100)}%${nextS ? ` → <b style="color:#4ade80">${Math.round(nextS.heal * 100)}%</b>` : ''}` : s.buff ? `Hiệu lực ${Math.round(s.buff.dur / 1000)}s${nextS ? ` → <b style="color:#4ade80">${Math.round(nextS.buff.dur / 1000)}s</b>` : ''}` : '';
      let right;
      if (!s.learned) right = `<div class="sk-need"><span class="warn small">Chưa học</span><br><span class="small muted">Sách ${fmt(BOOK_PRICE[i])} lượng${lvOk ? '' : ' · cần cấp ' + s.lv}</span></div>`;
      else if (s.slv >= max) right = '<span class="small" style="color:#ff9b2f">✦ Đại thành ✦</span>';
      else right = `<button class="btn small green" data-up="${i}" ${me.sp >= cost.sp && me.gold >= cost.gold ? '' : 'disabled'}>Nâng tầng ${s.slv + 1}<br><span class="small">${cost.sp} điểm · ${fmt(cost.gold)} lượng</span></button>`;
      html += `<div class="li sk-row ${s.learned ? 'done' : ''}"><div class="sk-ico ${i === 6 ? 'dragon' : ''}">${i === 0 ? '⚔️' : i === 6 ? '🐉' : ['', '①', '②', '③', '④', '⑤'][i]}</div><div class="grow"><b>${esc(s.name)}</b> ${s.learned ? `<span class="sk-lv">Tầng ${s.slv}/${max}</span>` : ''} ${lvOk ? '' : `<span class="warn small">(cấp ${s.lv})</span>`}
        <div class="sub">${skillDesc(s)} · ${s.mp} MP · Hồi ${s.cd / 1000}s</div><div class="sub">${effect}</div>
        ${s.learned ? `<div class="sk-bar">${Array.from({ length: max }, (_, k) => `<i class="${k < s.slv ? 'on' : ''}"></i>`).join('')}</div>` : ''}</div>${right}</div>`;
    });
    html += '</div>';
    if (!skills[6]) html += '<p class="small muted">🐉 Long Ấn (rồng lửa / nước / băng) học bằng Bí Kíp từ Boss, Kỳ Trân Các hoặc đổi Hoa Đăng.</p>';
    body.innerHTML = html;
    body.querySelectorAll('[data-slot]').forEach(sel => sel.onchange = () => {
      const bar = hb.slice();
      const v = +sel.value, n = +sel.dataset.slot;
      const dup = bar.indexOf(v);
      if (v && dup >= 0 && dup !== n) bar[dup] = bar[n]; // đổi chỗ nếu đã gán ở ô khác
      bar[n] = v;
      emit('skillOp', { op: 'hotbar', bar });
    });
    body.querySelectorAll('[data-up]').forEach(b => b.onclick = () => emit('skillOp', { op: 'upgrade', idx: +b.dataset.up }));
  }

  function mountStats(id, lv) {
    const m = G.data.mounts[id], out = {};
    for (const k of new Set([...Object.keys(m.stats), ...Object.keys(m.growth)])) out[k] = Math.round(((m.stats[k] || 0) + (m.growth[k] || 0) * (lv - 1)) * 10) / 10;
    out.speed = m.speed + Math.floor(lv / 10) * 0.02;
    return out;
  }
  function renderMount(body) {
    const me = G.me, owned = me.mounts || {}, all = G.data.mounts;
    const sel = panelState.sel && owned[panelState.sel] ? panelState.sel : (me.mount || Object.keys(owned)[0]);
    const food = me.inv.filter(x => x.id === 'mount_food').reduce((a, x) => a + x.qty, 0);
    const blood = me.inv.filter(x => x.id === 'mount_stone').reduce((a, x) => a + x.qty, 0);
    let html = '<div class="mount-list">';
    for (const [id, m] of Object.entries(all)) {
      const o = owned[id];
      html += `<div class="mount-card ${o ? '' : 'locked'} ${id === sel ? 'sel' : ''}" data-mount="${id}"><canvas width="96" height="72" data-mcv="${id}"></canvas><b class="r-${m.rarity}-t">${esc(m.name)}</b><small>${o ? 'Cấp ' + o.lv : 'Chưa sở hữu'}</small>${id === me.mount ? '<span class="tagm">Đang dùng</span>' : ''}</div>`;
    }
    html += '</div>';
    if (sel && owned[sel]) {
      const m = all[sel], o = owned[sel], st = mountStats(sel, o.lv), need = G.data.mountExp[o.lv];
      const isBreak = o.lv % 10 === 0 && o.lv < G.data.mountMax && o.exp >= need;
      html += `<div class="card"><h4>${esc(m.name)} · Cấp ${o.lv}/${G.data.mountMax} ${'★'.repeat(Math.floor(o.lv / 10))}</h4>
        <div class="stat-grid"><div>Tốc độ khi cưỡi <b>+${Math.round(st.speed * 100)}%</b></div>${Object.entries(st).filter(([k]) => k !== 'speed').map(([k, v]) => `<div>${STAT_NAME[k]} <b>+${v}</b></div>`).join('')}</div>
        <div class="small" style="margin-top:6px">Kinh nghiệm: ${o.exp}/${need}</div><div class="progress"><i style="width:${Math.min(100, o.exp / need * 100)}%"></i></div>
        <div class="row" style="justify-content:flex-start;margin-top:8px">
          ${sel !== me.mount ? `<button class="btn small" data-mop="select">Chọn làm thú cưỡi</button>` : `<button class="btn small ${me.riding ? '' : 'green'}" data-mop="ride">${me.riding ? 'Xuống thú (T)' : 'Cưỡi ngay (T)'}</button>`}
          ${o.lv >= G.data.mountMax ? '<span class="small">Đã đạt cấp tối đa</span>' : isBreak
            ? `<button class="btn small primary" data-mop="break">⚡ Đột phá (${o.lv / 10} Long Huyết Thạch, ${fmt(o.lv * 2000)} lượng) — còn ${blood}</button>`
            : `<button class="btn small green" data-mop="feed" data-n="1">Cho ăn x1</button><button class="btn small green" data-mop="feed" data-n="10">x10</button><span class="small">Mã Linh Đan: ${food} · ${fmt(50 * o.lv)} lượng/lần</span>`}
        </div><p class="small muted">Chỉ số thú cưỡi luôn được cộng khi chọn; tốc độ chỉ tăng khi đang cưỡi. Mỗi 10 cấp cần đột phá bằng Long Huyết Thạch (rơi từ Boss, quái cấp 20+).</p></div>`;
    } else {
      html += '<div class="card"><p>Bạn chưa có thú cưỡi. Hãy đến <b>Mã Phu Lão Trương</b> ở Tương Dương để mua Ngựa Nâu, hoặc săn Boss / mở Kỳ Trân Các để có thú cưỡi hiếm như Bạch Hổ, Hỏa Kỳ Lân, Thanh Long!</p></div>';
    }
    body.innerHTML = html;
    body.querySelectorAll('[data-mcv]').forEach(cv => { const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(Sprites.mountSprite(cv.dataset.mcv, all[cv.dataset.mcv], 0), 0, 0); });
    body.querySelectorAll('[data-mount]').forEach(el => el.onclick = () => { if (owned[el.dataset.mount]) { panelState.sel = el.dataset.mount; UI.refreshPanel(); } });
    body.querySelectorAll('[data-mop]').forEach(b => b.onclick = () => emit('mount', { op: b.dataset.mop, id: sel, n: +b.dataset.n || 1 }));
  }

  function renderOnline(body) {
    if (!onlineData) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    body.innerHTML = `<p>${onlineData.length} người chơi trực tuyến</p><table class="tbl"><tr><th>Tên</th><th>Môn phái</th><th>Cấp</th><th>Vị trí</th><th></th></tr>${onlineData.map(p => `<tr><td>${esc(p.name)}</td><td>${G.data.classes[p.cls].name}</td><td>${p.level}</td><td>${esc(p.map)}</td><td><button class="btn small" data-pm="${esc(p.name)}">💌</button></td></tr>`).join('')}</table>`;
    body.querySelectorAll('[data-pm]').forEach(b => b.onclick = () => { UI.closePanel(); $('chat-ch').value = 'pm'; $('chat-to').value = b.dataset.pm; $('chat-to').classList.remove('hidden'); UI.focusChat(); });
  }

  // ---------- NPC ----------
  UI.openNpc = function (d) {
    if (d.action === 'tutorial' && !G.me.tutorial.done) { UI.openPanel('quests', { tab: 'tutorial' }); return; }
    if (d.action === 'guild') { UI.openPanel('guild'); return; }
    if (d.action === 'event') { UI.openPanel('events', { tab: 'checkin' }); UI.toast(d.talk); return; }
    if (d.action === 'quest') { UI.openPanel('quests', { tab: 'daily' }); return; }
    npcData = d;
    panel = 'npc';
    panelState = { tab: d.shop ? 'buy' : d.knbShop ? 'knb' : 'talk' };
    $('panel').classList.remove('hidden');
    $('panel-title').textContent = d.name;
    UI.refreshPanel();
  };
  function renderNpc(body) {
    const d = npcData;
    if (!d) return;
    const tab = panelState.tab;
    let html = `<div class="npc-head"><canvas width="64" height="64" id="npc-cv"></canvas><p>"${esc(d.talk)}"</p></div>`;
    const tl = [];
    if (d.shop) tl.push(['buy', '🛒 Mua'], ['sell', '💰 Bán']);
    if (d.knbShop) tl.push(['knb', '💎 Kỳ Trân'], ['sell', '💰 Bán']);
    if (d.enhance) tl.push(['enhance', '🔨 Cường hóa']);
    if (tl.length) html += tabs(tl, tab);
    if (tab === 'buy' || tab === 'knb') {
      const list = tab === 'buy' ? d.shop.map(x => ({ id: x.id, price: x.price })) : d.knbShop.map(x => ({ id: x.id, knb: x.knb }));
      html += `<div class="small muted">💰 ${fmt(G.me.gold)} · 💎 ${fmt(G.me.knb)}</div><div class="list">` + list.map(x => {
        const it = G.data.items[x.id];
        const cant = it.lv > G.me.level;
        const stats = it.stats ? Object.entries(it.stats).map(([k, v]) => `${STAT_NAME[k]} +${v}`).join(', ') : (it.desc || '');
        return `<div class="li"><img src="${iconUrl(x.id)}" width="32" height="32" style="image-rendering:pixelated"><div class="grow">${itemName(x.id)} <span class="small ${cant ? 'warn' : 'muted'}">Cấp ${it.lv || 1}</span><div class="sub">${esc(stats)}</div></div>
          ${it.type !== 'equip' ? `<input type="number" min="1" max="999" value="${it.type === 'use' && x.price < 100 ? 10 : 1}" style="width:58px" data-qty="${x.id}">` : ''}
          <button class="btn small ${tab === 'knb' ? 'primary' : 'green'}" data-buy="${x.id}">${x.knb ? x.knb + ' 💎' : fmt(x.price) + ' 💰'}</button></div>`;
      }).join('') + '</div>';
    } else if (tab === 'sell') {
      html += '<div class="small muted">Chọn vật phẩm để bán (30% giá gốc)</div>' + invGrid(body, { noEquip: true }) + itemActions({ shop: true });
    } else if (tab === 'enhance') {
      html += '<div class="small muted">Chọn trang bị (kể cả đang mặc) để cường hóa, tối đa +15. Từ +10 trở lên nếu thất bại mà không có Bảo Hiểm Phù sẽ rớt về +1. Huyền Tinh Thạch: ' + G.me.inv.filter(x => x.id === 'stone').reduce((s, x) => s + x.qty, 0) + '</div>' +
        invGrid(body, { filter: s => G.data.items[s.id].type === 'equip' }) + itemActions({ enhance: true });
    } else if (d.teleports) {
      html += '<div class="list">' + d.teleports.map(t => `<div class="li"><div class="grow"><b>${esc(t.name)}</b><div class="sub">Cấp ${t.lv}${t.minLv > 1 ? ' · Yêu cầu cấp ' + t.minLv : ''}</div></div><button class="btn small green" data-tp="${t.map}" ${G.map.id === t.map ? 'disabled' : ''}>${t.price ? fmt(t.price) + ' 💰' : 'Miễn phí'}</button></div>`).join('') + '</div>';
    }
    body.innerHTML = html;
    const c = $('npc-cv').getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(Sprites.npcSprite(d.sprite, d.color, 0), 0, 0);
    bindTabs(body);
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const q = body.querySelector(`[data-qty="${b.dataset.buy}"]`);
      emit('buy', { npc: d.id, id: b.dataset.buy, qty: q ? +q.value : 1, knb: tab === 'knb' });
    });
    body.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => emit('teleport', { map: b.dataset.tp }));
    if (tab === 'sell' || tab === 'enhance') bindInv(body, { shop: tab === 'sell', enhance: tab === 'enhance' });
  }
})();
