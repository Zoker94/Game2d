// Client chính: đăng nhập, kết nối, hiển thị thế giới, di chuyển, chiến đấu, tự động đánh.
(function () {
  const $ = id => document.getElementById(id);
  const TILE = 64;

  const G = window.G = {
    data: null, config: null, socket: null, token: localStorage.getItem('vl_token'), user: null,
    me: null, you: null, map: null, solid: new Set(),
    players: new Map(), monsters: new Map(), drops: new Map(),
    self: { x: 0, y: 0, dir: 0, moving: false, atkUntil: 0 },
    fx: [], floats: [], target: null, moveTo: null, npcGoal: null,
    cds: {}, pending: {}, auto: false, events: null, daily: null, inGame: false,
    settings: Object.assign({ names: true, sound: true, shake: true }, JSON.parse(localStorage.getItem('vl_settings') || '{}'))
  };
  G.saveSettings = () => localStorage.setItem('vl_settings', JSON.stringify(G.settings));

  // ================== Màn hình ==================
  function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id)); }
  function loading(on, text) { $('loading').classList.toggle('hidden', !on); if (text) $('loading-text').textContent = text; }
  G.modal = function (text, buttons = [{ t: 'OK' }]) {
    $('modal-text').textContent = text;
    const box = $('modal-btns'); box.innerHTML = '';
    buttons.forEach(b => { const el = document.createElement('button'); el.className = 'btn ' + (b.cls || ''); el.textContent = b.t; el.onclick = () => { $('modal-msg').classList.add('hidden'); b.fn && b.fn(); }; box.appendChild(el); });
    $('modal-msg').classList.remove('hidden');
  };

  async function api(path, opts = {}) {
    const res = await fetch(path, { method: opts.body ? 'POST' : 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, G.token ? { Authorization: 'Bearer ' + G.token } : {}), body: opts.body ? JSON.stringify(opts.body) : undefined });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Lỗi kết nối');
    return j;
  }

  async function boot() {
    loading(true, 'Đang tải dữ liệu giang hồ...');
    try {
      [G.config, G.data] = await Promise.all([api('/api/config'), api('/api/gamedata')]);
    } catch (e) { loading(false); G.modal('Không thể kết nối máy chủ. Vui lòng thử lại.', [{ t: 'Tải lại', fn: () => location.reload() }]); return; }
    $('online-count').textContent = G.config.online;
    loading(false);
    if (G.token) {
      try { const r = await api('/api/me'); G.user = r.user; connect(); return; }
      catch (e) { G.token = null; localStorage.removeItem('vl_token'); }
    }
    showLogin();
  }

  function showLogin() {
    show('screen-login');
    if (G.config.maintenance) $('login-msg').textContent = '⚠ Máy chủ đang bảo trì.';
    if (G.config.devLogin) $('login-dev').classList.remove('hidden');
    if (!G.config.googleClientId) {
      $('login-google').innerHTML = '<p class="small warn">Máy chủ chưa cấu hình GOOGLE_CLIENT_ID.</p>';
      return;
    }
    const init = () => {
      if (!window.google || !google.accounts) return setTimeout(init, 200);
      google.accounts.id.initialize({ client_id: G.config.googleClientId, callback: onGoogle, ux_mode: 'popup', auto_select: false });
      google.accounts.id.renderButton($('login-google'), { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'vi' });
    };
    init();
  }
  async function onGoogle(resp) {
    loading(true, 'Đang xác thực Google...');
    try {
      const r = await api('/api/auth/google', { body: { credential: resp.credential } });
      loginOk(r);
    } catch (e) { $('login-msg').textContent = e.message; }
    loading(false);
  }
  function loginOk(r) {
    G.token = r.token; G.user = r.user;
    localStorage.setItem('vl_token', r.token);
    connect();
  }
  $('dev-btn').onclick = async () => {
    try { loginOk(await api('/api/auth/dev', { body: { name: $('dev-name').value } })); } catch (e) { $('login-msg').textContent = e.message; }
  };
  $('logout-btn').onclick = logout;
  async function logout() {
    try { await api('/api/auth/logout', { body: {} }); } catch (e) { }
    localStorage.removeItem('vl_token');
    location.reload();
  }
  G.logout = logout;

  // ================== Tạo nhân vật ==================
  let selCls = 'thieulam', previewT = 0;
  function showCreate() {
    show('screen-create');
    const grid = $('class-grid');
    grid.innerHTML = '';
    for (const [id, cl] of Object.entries(G.data.classes)) {
      const card = document.createElement('div');
      card.className = 'class-card' + (id === selCls ? ' sel' : '');
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
      cv.getContext('2d').drawImage(Sprites.playerSprite(id, cl.colors, 0, 0), 0, 0);
      card.appendChild(cv);
      card.insertAdjacentHTML('beforeend', `<b>${cl.name}</b><small>${cl.role}</small>`);
      card.onclick = () => { selCls = id; showCreate(); };
      grid.appendChild(card);
    }
    const cl = G.data.classes[selCls];
    $('class-name').textContent = cl.name;
    $('class-role').textContent = `${cl.role} · Vũ khí: ${cl.weapon} · Tầm đánh: ${cl.range >= 200 ? 'Xa' : 'Gần'}`;
    $('class-desc').textContent = cl.desc;
    const b = cl.base;
    $('class-stats').innerHTML = `<div>❤️ ${b.hp}</div><div>💧 ${b.mp}</div><div>⚔️ ${b.atk}</div><div>🛡️ ${b.def}</div><div>💥 ${b.crit}%</div><div>👟 ${b.spd}</div>`;
    $('class-skills').innerHTML = cl.skills.map(s => `<div>⭐ <b>${s.name}</b> <span class="muted">(Cấp ${s.lv}${s.mp ? ', ' + s.mp + ' MP' : ''})</span></div>`).join('');
  }
  function animPreview() {
    previewT++;
    const f = Math.floor(previewT / 10) % 4;
    const dir = Math.floor(previewT / 80) % 4;
    for (const [cvId, cls] of [['class-preview', selCls], ['enter-preview', G.user && G.user.character && G.user.character.cls]]) {
      const cv = $(cvId);
      if (!cls || !cv.offsetParent) continue;
      const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 128, 128);
      ctx.drawImage(Sprites.playerSprite(cls, G.data.classes[cls].colors, [0, 1, 3, 2][dir], f), 0, 0, 128, 128);
    }
    if (!G.inGame) requestAnimationFrame(animPreview);
  }
  $('create-btn').onclick = () => G.socket.emit('createChar', { name: $('char-name').value.trim(), cls: selCls });

  function showEnter() {
    show('screen-enter');
    const c = G.user.character;
    $('enter-name').textContent = c.name;
    $('enter-info').textContent = `${G.data.classes[c.cls].name} · Cấp ${c.level}`;
  }
  $('enter-btn').onclick = async () => {
    await Input.goLandscape();
    enterGame();
  };
  function enterGame() {
    G.inGame = true;
    Input.inGame = true;
    show('screen-game');
    Input.applyLayout();
    G.socket.emit('enter');
    UI.initHud();
    requestAnimationFrame(loop);
  }

  // ================== Kết nối ==================
  function connect() {
    if (G.socket) return;
    loading(true, 'Đang kết nối...');
    const s = G.socket = io({ auth: { token: G.token }, transports: ['websocket', 'polling'] });
    s.on('connect', () => loading(false));
    s.on('connect_error', err => {
      loading(false);
      const m = err.message;
      if (m === 'auth') { localStorage.removeItem('vl_token'); G.token = null; s.close(); G.socket = null; showLogin(); }
      else if (m === 'banned') { s.close(); G.modal('Tài khoản của bạn đã bị khóa.', [{ t: 'Đăng xuất', fn: logout }]); }
      else if (m === 'maintenance') { s.close(); G.modal('Máy chủ đang bảo trì, vui lòng quay lại sau.', [{ t: 'Thử lại', fn: () => location.reload() }]); }
    });
    s.on('disconnect', reason => {
      if (reason === 'io server disconnect') return;
      if (G.inGame) loading(true, 'Mất kết nối, đang kết nối lại...');
    });
    s.io.on('reconnect', () => { loading(false); });
    s.on('hello', d => {
      G.user = d.user;
      if (G.inGame) { if (d.user.hasChar) s.emit('enter'); return; }
      if (!d.user.hasChar) showCreate(); else showEnter();
      requestAnimationFrame(animPreview);
    });
    s.on('kicked', d => { G.inGame = false; s.close(); G.modal(d.reason || 'Bạn đã bị ngắt kết nối', [{ t: 'Tải lại', fn: () => location.reload() }]); });
    s.on('init', onInit);
    s.on('snap', onSnap);
    s.on('leave', id => G.players.delete(id));
    s.on('me', d => { G.me = d; UI.updateHud(); $('dead-overlay').classList.toggle('hidden', !d.dead); });
    s.on('pos', d => { G.self.x = d.x; G.self.y = d.y; G.moveTo = null; });
    s.on('fx', onFx);
    s.on('dmg', onDmg);
    s.on('gain', d => {
      if (d.exp) addFloat(G.self.x, G.self.y - 90, `+${d.exp} KN`, '#ffe48a', 13);
      if (d.gold) addFloat(G.self.x + 20, G.self.y - 74, `+${d.gold} 💰`, '#ffd700', 12);
    });
    s.on('dead', d => {
      $('dead-msg').textContent = `Bạn đã bị ${d.by} đánh trọng thương.${d.lost ? ' Mất ' + d.lost + ' kinh nghiệm.' : ''}`;
      $('dead-overlay').classList.remove('hidden');
      G.auto && setAuto(false);
      sfx('die');
    });
    s.on('cd', d => { const sk = mySkills()[d.idx]; if (sk) { G.cds[d.idx] = { until: performance.now() + d.until, total: d.until }; } G.pending[d.idx] = 0; });
    s.on('toast', d => UI.toast(d.text, d.type));
    s.on('notice', d => G.modal((d.type === 'admin' ? '📢 Thông báo từ quản trị viên:\n' : '') + d.text));
    s.on('chat', d => UI.chatMsg(d));
    s.on('events', d => { G.events = d; UI.onEvents(d); });
    s.on('daily', d => { G.daily = d; UI.updateDaily(); });
    s.on('dropAdd', d => G.drops.set(d.id, d));
    s.on('dropDel', id => G.drops.delete(id));
    s.on('npc', d => UI.openNpc(d));
    s.on('guild', d => UI.onGuild(d));
    s.on('lb', d => UI.onLeaderboard(d));
    s.on('eventPanel', d => UI.onEventPanel(d));
    s.on('wheelResult', d => UI.onWheel(d));
    s.on('enhanceResult', () => UI.refreshPanel());
    s.on('online', d => UI.onOnline(d));
  }
  $('respawn-btn').onclick = () => { G.socket.emit('respawn'); $('dead-overlay').classList.add('hidden'); };

  // ================== Dữ liệu thế giới ==================
  let minimapBase = null;
  function onInit(d) {
    G.you = d.you; G.map = d.map; G.solid = new Set(d.solid);
    G.self.x = d.x; G.self.y = d.y; G.moveTo = null; G.npcGoal = null; G.target = null;
    G.players.clear(); G.monsters.clear(); G.drops.clear(); G.fx = [];
    d.drops.forEach(x => G.drops.set(x.id, x));
    const m = d.map;
    $('map-name').innerHTML = `${m.name} <span class="${m.pvp ? 'pvp' : m.safe ? 'safe' : 'muted'}">${m.pvp ? '[PK]' : m.safe ? '[An toàn]' : '[Cấp ' + m.lv + ']'}</span>`;
    // nền minimap
    const cv = document.createElement('canvas'); cv.width = m.w * 3; cv.height = m.h * 3;
    const ctx = cv.getContext('2d');
    const COL = { 0: '#4f8f33', 1: '#a07a45', 2: '#2d6fb5', 3: '#1f5a22', 4: '#666', 5: '#d9b876', 6: '#e8eef4', 7: '#888', 8: '#3a2c25', 9: '#3a7a2a', 10: '#5a9e3a', 11: '#3a2a35', 12: '#d13a0a', 13: '#bfe3f5', 14: '#2e8b57', 15: '#8b1a1a', 16: '#1f5e3a', 17: '#2a1a14' };
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { ctx.fillStyle = COL[m.tiles[y * m.w + x]] || '#000'; ctx.fillRect(x * 3, y * 3, 3, 3); }
    m.portals.forEach(p => { ctx.fillStyle = '#7fd4ff'; ctx.fillRect(p.x * 3 - 2, p.y * 3 - 2, 7, 7); });
    minimapBase = cv;
    UI.closePanel();
    sfx('portal');
  }

  function onSnap(d) {
    const now = performance.now();
    const seenP = new Set();
    for (const p of d.p) {
      seenP.add(p.i);
      if (p.i === G.you) {
        G.selfSnap = p;
        if (G.me) { G.me.hp = p.h; }
        continue;
      }
      let e = G.players.get(p.i);
      if (!e) { e = { x: p.x, y: p.y }; G.players.set(p.i, e); }
      Object.assign(e, { id: p.i, name: p.n, cls: p.c, tx: p.x, ty: p.y, dir: p.d, moving: p.m, hp: p.h, maxHp: p.H, level: p.l, guild: p.g, dead: p.a, gm: p.v, seen: now });
    }
    for (const id of G.players.keys()) if (!seenP.has(id)) G.players.delete(id);
    const seenM = new Set();
    for (const m of d.m) {
      seenM.add(m.i);
      let e = G.monsters.get(m.i);
      if (!e) { e = { x: m.x, y: m.y, born: now }; G.monsters.set(m.i, e); }
      Object.assign(e, { id: m.i, type: m.t, tx: m.x, ty: m.y, dir: m.d, moving: m.m, hp: m.h, maxHp: m.H, boss: m.b, event: m.e });
      if (m.d === 1 || m.d === 2) e.face = m.d;
    }
    for (const id of G.monsters.keys()) if (!seenM.has(id)) { G.monsters.delete(id); if (G.target === id) G.target = null; }
  }

  function entityById(id) {
    if (id === G.you) return G.self;
    return G.players.get(id) || G.monsters.get(id);
  }

  function onFx(d) {
    const now = performance.now();
    const src = d.from && entityById(d.from);
    if (src && d.from !== G.you) src.atkUntil = now + 220;
    const dur = { levelup: 1200, death: 500, aura: 700, heal: 700, ring: 450, net: 450, poison: 600, swords: 500, taiji: 600, storm: 600, lightning: 300 }[d.t] || 260;
    G.fx.push(Object.assign({ t0: now, dur }, d));
    if (d.t === 'levelup') sfx('level');
    else if (d.from === G.you) sfx('hit');
  }
  function onDmg(d) {
    const e = entityById(d.id);
    if (!e) return;
    const x = e.x + (Math.random() * 30 - 15), y = e.y - 70;
    if (d.k === 'heal') addFloat(x, y, '+' + d.v, '#4ade80', 15);
    else if (d.k === 'mana') addFloat(x, y, '+' + d.v, '#6bb0ff', 15);
    else if (d.k === 'crit') addFloat(x, y, d.v + '!', '#ffcc00', 22, true);
    else if (d.k === 'dot') addFloat(x, y, d.v, '#9acd32', 13);
    else if (d.id === G.you) { addFloat(x, y, '-' + d.v, '#ff5050', 16); if (G.settings.shake) shake = 4; }
    else addFloat(x, y, d.v, '#ffffff', 15);
    e.hitAt = performance.now();
  }
  function addFloat(x, y, text, color, size, bold) { G.floats.push({ x, y, text, color, size, bold, t0: performance.now() }); if (G.floats.length > 80) G.floats.shift(); }

  // ================== Âm thanh (WebAudio đơn giản) ==================
  let actx = null;
  function sfx(kind) {
    if (!G.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      const t = actx.currentTime;
      const conf = { hit: [220, 120, 0.06, 'square'], level: [440, 880, 0.5, 'triangle'], portal: [300, 600, 0.25, 'sine'], die: [200, 60, 0.6, 'sawtooth'], pick: [700, 1000, 0.08, 'triangle'], click: [500, 500, 0.03, 'square'] }[kind] || [400, 400, 0.05, 'sine'];
      o.type = conf[3]; o.frequency.setValueAtTime(conf[0], t); o.frequency.exponentialRampToValueAtTime(conf[1], t + conf[2]);
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + conf[2]);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + conf[2]);
    } catch (e) { }
  }
  G.sfx = sfx;

  // ================== Kỹ năng / hành động ==================
  function mySkills() { return G.me ? G.data.classes[G.me.cls].skills : []; }
  G.mySkills = mySkills;
  function skillReady(i) { const c = G.cds[i]; return !c || c.until <= performance.now(); }
  G.skillReady = skillReady;

  function useSkill(i) {
    if (!G.me || G.me.dead || !G.map) return;
    const sk = mySkills()[i];
    if (!sk) return;
    if (G.me.level < sk.lv) { if (i > 0) UI.toast(`Cần cấp ${sk.lv} để dùng ${sk.name}`, 'error'); return; }
    if (!skillReady(i)) return;
    const now = performance.now();
    if (G.pending[i] && now - G.pending[i] < 300) return;
    if (i === 0 || (sk.type !== 'buff' && sk.type !== 'heal')) {
      if (G.map.safe) { if (i > 0 || !G._safeWarn || now - G._safeWarn > 3000) { UI.toast('Không thể giao chiến trong thành', 'error'); G._safeWarn = now; } return; }
      const t = validTarget() || pickTarget(Math.max(sk.range || 0, G.data.classes[G.me.cls].range) + 40);
      if (!t && (sk.type === 'single' || sk.type === 'dot')) {
        // không có mục tiêu: chạy tới quái gần nhất trong 350px
        const near = nearestEnemy(350);
        if (near) { G.target = near.id; G.chase = { id: near.id, skill: i }; }
        return;
      }
    }
    G.pending[i] = now;
    G.self.atkUntil = now + 220;
    G.socket.emit('skill', { idx: i, target: G.target });
  }
  G.useSkill = useSkill;

  function enemies() {
    const list = [];
    for (const m of G.monsters.values()) list.push(m);
    if (G.map && G.map.pvp) for (const p of G.players.values()) if (!p.dead && !(G.me.guild && p.guild && p.guild === G.me.guild.name)) list.push(p);
    return list;
  }
  function nearestEnemy(range, exclude) {
    let best = null, bd = range;
    for (const e of enemies()) {
      if (e.id === exclude) continue;
      const d = Math.hypot(e.x - G.self.x, e.y - G.self.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function validTarget() {
    if (!G.target) return null;
    const e = G.monsters.get(G.target) || (G.map.pvp && G.players.get(G.target));
    if (!e || e.dead) { G.target = null; return null; }
    return e;
  }
  function pickTarget(range) {
    const t = nearestEnemy(range);
    if (t) G.target = t.id;
    return t;
  }
  function cycleTarget() {
    const list = enemies().map(e => ({ e, d: Math.hypot(e.x - G.self.x, e.y - G.self.y) })).filter(x => x.d < 600).sort((a, b) => a.d - b.d);
    if (!list.length) { G.target = null; return; }
    const i = list.findIndex(x => x.e.id === G.target);
    G.target = list[(i + 1) % list.length].e.id;
  }
  function interact() {
    if (!G.map) return;
    let best = null, bd = TILE * 3;
    for (const n of G.map.npcs) {
      const d = Math.hypot((n.x + 0.5) * TILE - G.self.x, (n.y + 0.5) * TILE - G.self.y);
      if (d < bd) { bd = d; best = n; }
    }
    if (best) G.socket.emit('npc', { id: best.id });
    else UI.toast('Không có NPC ở gần', 'error');
  }
  function setAuto(on) {
    G.auto = on;
    const b = $('btn-auto');
    b.classList.toggle('on', on);
    b.textContent = on ? '🤖 Tự động: BẬT' : '🤖 Tự động: TẮT';
    if (on && G.map && G.map.safe) UI.toast('Hãy ra bãi luyện công để dùng tự động đánh', 'error');
    G.autoHome = on ? { x: G.self.x, y: G.self.y } : null;
  }
  G.setAuto = setAuto;
  $('btn-auto').onclick = () => setAuto(!G.auto);

  Input.on('skill', i => { G.moveTo = null; useSkill(i); });
  Input.on('potion', k => G.socket && G.socket.emit('quickUse', { kind: k }));
  Input.on('target', cycleTarget);
  Input.on('interact', interact);
  Input.on('auto', () => setAuto(!G.auto));
  Input.on('panel', n => UI.togglePanel(n));
  Input.on('escape', () => UI.closePanel());
  Input.on('chat', () => UI.focusChat());
  Input.on('joymove', () => { G.moveTo = null; G.npcGoal = null; G.chase = null; });
  Input.on('toast', t => UI.toast(t));
  Input.on('resize', resize);

  // ================== Nhấp/chạm vào màn hình ==================
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1, zoom = 1, cam = { x: 0, y: 0 }, shake = 0;
  function resize() {
    const s = Input.size();
    W = s.w; H = s.h;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    zoom = Math.max(0.55, Math.min(2, Math.min(W / (TILE * 18), H / (TILE * 10))));
  }
  window.addEventListener('load', resize); resize();

  function screenToWorld(cx, cy) {
    const p = Input.toLocal(cx, cy);
    return { x: p.x / zoom + cam.x, y: p.y / zoom + cam.y };
  }
  canvas.addEventListener('pointerdown', e => {
    if (!G.map) return;
    const w = screenToWorld(e.clientX, e.clientY);
    // NPC
    for (const n of G.map.npcs) {
      const nx = (n.x + 0.5) * TILE, ny = (n.y + 0.5) * TILE;
      if (Math.abs(w.x - nx) < 30 && w.y > ny - 70 && w.y < ny + 12) {
        G.npcGoal = n; G.moveTo = { x: nx, y: ny + 40 }; return;
      }
    }
    // Quái / người chơi
    let best = null, bd = 48;
    for (const e2 of [...G.monsters.values(), ...G.players.values()]) {
      const r = e2.boss ? 70 : 40;
      const d = Math.hypot(w.x - e2.x, w.y - (e2.y - (e2.boss ? 50 : 26)));
      if (d < Math.max(bd, r) && d < r) { bd = d; best = e2; }
    }
    if (best) {
      G.target = best.id;
      if (G.monsters.has(best.id) || (G.map.pvp)) { if (!Input.isTouch || e.detail >= 1) G.chase = { id: best.id, skill: 0 }; }
      return;
    }
    if (!Input.isTouch) { G.moveTo = { x: w.x, y: w.y }; G.chase = null; G.npcGoal = null; G.clickMark = { x: w.x, y: w.y, t0: performance.now() }; }
  });

  // ================== Vòng lặp chính ==================
  let last = performance.now(), lastSend = 0, lastSent = { x: 0, y: 0, m: false }, frameT = 0, lastMini = 0, stuckT = 0;

  function solidAt(x, y) {
    const m = G.map;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
    return G.solid.has(m.tiles[ty * m.w + tx]);
  }
  function blocked(x, y) { return solidAt(x - 12, y - 6) || solidAt(x + 12, y - 6) || solidAt(x - 12, y + 6) || solidAt(x + 12, y + 6) || solidAt(x, y); }

  function update(dt) {
    Input.pollGamepad();
    const now = performance.now();
    const s = G.self;
    if (!G.me || !G.map) return;
    const dead = G.me.dead;
    let v = dead ? { x: 0, y: 0 } : Input.vector();
    const manual = Math.hypot(v.x, v.y) > 0.01;
    if (manual) { G.moveTo = null; G.npcGoal = null; G.chase = null; }

    // Đuổi theo mục tiêu để đánh
    if (!manual && G.chase && !dead) {
      const t = G.monsters.get(G.chase.id) || G.players.get(G.chase.id);
      if (!t || t.dead) G.chase = null;
      else {
        const sk = mySkills()[G.chase.skill] || mySkills()[0];
        const range = (sk.range || G.data.classes[G.me.cls].range) * 0.85;
        const d = Math.hypot(t.x - s.x, t.y - s.y);
        if (d > range) G.moveTo = { x: t.x, y: t.y, chase: true };
        else { G.moveTo = null; useSkill(G.chase.skill); if (G.chase.skill !== 0) G.chase.skill = 0; }
      }
    }
    if (G.auto && !manual && !dead) autoPlay(now);
    if ((Input.attackHeld || Input.padAttack) && !dead) useSkill(0);

    if (!manual && G.moveTo) {
      const dx = G.moveTo.x - s.x, dy = G.moveTo.y - s.y, d = Math.hypot(dx, dy);
      if (d < 8) { G.moveTo = null; }
      else v = { x: dx / d, y: dy / d };
    }
    if (G.npcGoal) {
      const nx = (G.npcGoal.x + 0.5) * TILE, ny = (G.npcGoal.y + 0.5) * TILE;
      if (Math.hypot(nx - s.x, ny - s.y) < TILE * 2) { G.socket.emit('npc', { id: G.npcGoal.id }); G.npcGoal = null; G.moveTo = null; v = { x: 0, y: 0 }; }
    }
    const moving = Math.hypot(v.x, v.y) > 0.01;
    if (moving) {
      const spd = (G.me.stats.spd || 150) * dt;
      const nx = s.x + v.x * spd, ny = s.y + v.y * spd;
      const ox = s.x, oy = s.y;
      if (!blocked(nx, ny)) { s.x = nx; s.y = ny; }
      else if (!blocked(nx, s.y)) s.x = nx;
      else if (!blocked(s.x, ny)) s.y = ny;
      else if (Math.abs(v.x) > Math.abs(v.y)) { // trượt quanh góc
        if (!blocked(nx, s.y - spd)) s.y -= spd; else if (!blocked(nx, s.y + spd)) s.y += spd;
      } else { if (!blocked(s.x - spd, ny)) s.x -= spd; else if (!blocked(s.x + spd, ny)) s.x += spd; }
      if (Math.abs(v.x) > Math.abs(v.y)) s.dir = v.x > 0 ? 2 : 1; else s.dir = v.y > 0 ? 0 : 3;
      const movedD = Math.hypot(s.x - ox, s.y - oy);
      if (movedD < spd * 0.2) { stuckT += dt; if (stuckT > 0.8 && G.moveTo) { G.moveTo = null; G.chase = null; if (G.auto) G.autoBlacklist = { id: G.target, until: now + 4000 }; G.target = G.auto ? null : G.target; } }
      else stuckT = 0;
    } else stuckT = 0;
    // Quay mặt về mục tiêu khi đánh
    const t = G.target && (G.monsters.get(G.target) || G.players.get(G.target));
    if (t && s.atkUntil > now) { const dx = t.x - s.x, dy = t.y - s.y; s.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3); }
    s.moving = moving;

    // Gửi vị trí 15 lần/giây
    if (now - lastSend > 66 && (Math.abs(s.x - lastSent.x) > 0.5 || Math.abs(s.y - lastSent.y) > 0.5 || moving !== lastSent.m || now - lastSend > 1000)) {
      G.socket.emit('move', { x: Math.round(s.x * 10) / 10, y: Math.round(s.y * 10) / 10, d: s.dir, m: moving ? 1 : 0 });
      lastSend = now; lastSent = { x: s.x, y: s.y, m: moving };
    }

    // Nội suy thực thể khác
    const k = Math.min(1, dt * 10);
    for (const e of G.players.values()) { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; }
    for (const e of G.monsters.values()) { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; }
  }

  // Tự động đánh quái (auto)
  function autoPlay(now) {
    const me = G.me, s = G.self;
    if (G.map.safe) return;
    const st = me.stats;
    if (!G._autoPot || now - G._autoPot > 800) {
      if (me.hp < st.maxHp * 0.45) { G.socket.emit('quickUse', { kind: 'hp' }); G._autoPot = now; }
      else if (me.mp < st.maxMp * 0.2) { G.socket.emit('quickUse', { kind: 'mp' }); G._autoPot = now; }
    }
    let t = validTarget();
    const home = G.autoHome || s;
    if (t && Math.hypot(t.x - home.x, t.y - home.y) > 900) t = null;
    if (!t) {
      let best = null, bd = 700;
      for (const e of G.monsters.values()) {
        if (G.autoBlacklist && G.autoBlacklist.id === e.id && G.autoBlacklist.until > now) continue;
        if (Math.hypot(e.x - home.x, e.y - home.y) > 900) continue;
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d < bd) { bd = d; best = e; }
      }
      t = best;
      G.target = t ? t.id : null;
    }
    if (!t) {
      if (Math.hypot(home.x - s.x, home.y - s.y) > 60) G.moveTo = { x: home.x, y: home.y };
      return;
    }
    const skills = mySkills();
    // ưu tiên buff -> kỹ năng mạnh -> đánh thường
    const order = [3, 2, 1, 0];
    for (const i of order) {
      const sk = skills[i];
      if (!sk || me.level < sk.lv || !skillReady(i) || me.mp < sk.mp) continue;
      if (sk.type === 'buff') { if (!me.buffs.some(b => b.name === sk.name)) { useSkill(i); return; } continue; }
      if (sk.type === 'heal') { if (me.hp < st.maxHp * 0.6) { useSkill(i); return; } continue; }
      const range = (sk.type === 'aoe' && !sk.range ? sk.radius : (sk.range || G.data.classes[me.cls].range)) * 0.85;
      const d = Math.hypot(t.x - s.x, t.y - s.y);
      if (d > range) { if (i === 0) G.moveTo = { x: t.x, y: t.y }; continue; }
      G.moveTo = null;
      useSkill(i);
      return;
    }
  }

  // ================== Vẽ ==================
  function draw(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0810';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!G.map || !G.me) return;
    const m = G.map, s = G.self;
    const vw = W / zoom, vh = H / zoom;
    cam.x = Math.max(0, Math.min(m.w * TILE - vw, s.x - vw / 2));
    cam.y = Math.max(0, Math.min(m.h * TILE - vh, s.y - vh / 2 - 20));
    if (m.w * TILE < vw) cam.x = (m.w * TILE - vw) / 2;
    if (m.h * TILE < vh) cam.y = (m.h * TILE - vh) / 2;
    let sx = 0, sy = 0;
    if (shake > 0) { sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake; shake *= 0.85; if (shake < 0.5) shake = 0; }
    const sc = zoom * DPR;
    ctx.setTransform(sc, 0, 0, sc, Math.round((-cam.x + sx) * sc), Math.round((-cam.y + sy) * sc));
    ctx.imageSmoothingEnabled = false;

    const x0 = Math.max(0, Math.floor(cam.x / TILE)), y0 = Math.max(0, Math.floor(cam.y / TILE));
    const x1 = Math.min(m.w - 1, Math.ceil((cam.x + vw) / TILE)), y1 = Math.min(m.h - 1, Math.ceil((cam.y + vh) / TILE));
    const tf = Math.floor(now / 500);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = m.tiles[y * m.w + x];
      ctx.drawImage(Sprites.groundTile(t, x, y, tf), x * TILE, y * TILE);
    }
    // Cổng
    for (const p of m.portals) {
      const px = (p.x + 0.5) * TILE, py = (p.y + 0.5) * TILE;
      ctx.drawImage(Sprites.portalSprite(Math.floor(now / 120)), px - 32, py - 72);
      label(px, py - 78, '➜ ' + p.toName, '#9fe3ff', 11);
    }
    // Vật phẩm rơi
    for (const d of G.drops.values()) {
      const bob = Math.sin(now / 300 + d.x) * 3;
      const col = { common: '#ffffff', rare: '#4fa3ff', epic: '#c060ff', legendary: '#ff9b2f' }[d.rarity];
      if (d.rarity !== 'common') { ctx.fillStyle = col + '55'; ctx.beginPath(); ctx.ellipse(d.x, d.y + 6, 18, 6, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.drawImage(Sprites.itemIcon(d.icon, d.rarity), d.x - 16, d.y - 20 + bob, 32, 32);
      if (d.rarity === 'epic' || d.rarity === 'legendary') { ctx.fillStyle = col; ctx.fillRect(d.x - 1, d.y - 60 + bob, 2, 40); }
    }
    // Dấu nhấp chuột
    if (G.clickMark && now - G.clickMark.t0 < 500) { const a = 1 - (now - G.clickMark.t0) / 500; ctx.strokeStyle = `rgba(255,215,106,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(G.clickMark.x, G.clickMark.y, 14 * (1.5 - a), 6 * (1.5 - a), 0, 0, Math.PI * 2); ctx.stroke(); }

    // Thực thể sắp xếp theo y
    const list = [];
    for (let y = Math.max(0, y0 - 1); y <= Math.min(m.h - 1, y1 + 2); y++) for (let x = x0; x <= x1; x++) {
      const t = m.tiles[y * m.w + x];
      if (Sprites.TALL.has(t)) list.push({ y: (y + 1) * TILE - 2, k: 'tall', t, tx: x, ty: y });
    }
    for (const n of m.npcs) list.push({ y: (n.y + 0.5) * TILE + 20, k: 'npc', n });
    for (const e of G.monsters.values()) if (inView(e)) list.push({ y: e.y, k: 'mon', e });
    for (const e of G.players.values()) if (inView(e)) list.push({ y: e.y, k: 'pl', e });
    list.push({ y: s.y, k: 'self' });
    list.sort((a, b) => a.y - b.y);

    // vòng chọn mục tiêu
    const tgt = G.target && (G.monsters.get(G.target) || G.players.get(G.target));
    if (tgt) {
      ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 2;
      const rr = tgt.boss ? 44 : 22;
      ctx.beginPath(); ctx.ellipse(tgt.x, tgt.y + 2, rr, rr * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    }

    const frameOf = (moving, seed) => moving ? Math.floor(now / 140 + (seed || 0)) % 4 : 0;
    for (const it of list) {
      if (it.k === 'tall') {
        const img = Sprites.tallTile(it.t, it.tx, it.ty);
        ctx.drawImage(img, it.tx * TILE, (it.ty + 1) * TILE - img.height);
      } else if (it.k === 'npc') {
        const n = it.n, nx = (n.x + 0.5) * TILE, ny = (n.y + 0.5) * TILE;
        const img = Sprites.npcSprite(n.sprite, n.color, Math.floor(now / 600) % 2 ? 0 : 0);
        ctx.drawImage(img, nx - 32, ny - 44);
        label(nx, ny - 50, n.name, '#7fffd4', 12, true);
        const tut = G.me && G.me.tutorial;
        if (tut && !tut.done && ((tut.type === 'talk' && tut.npc === n.id) || (tut.type === 'buy' && n.action === 'shop') || (tut.type === 'daily' && n.id === 'su_gia'))) {
          const by = Math.sin(now / 200) * 4;
          label(nx, ny - 72 + by, '❗', '#ffd700', 22);
        }
      } else if (it.k === 'mon') {
        drawMonster(it.e, now);
      } else if (it.k === 'pl') {
        const e = it.e;
        if (e.dead) ctx.globalAlpha = 0.4;
        const img = Sprites.playerSprite(e.cls, G.data.classes[e.cls].colors, e.dir, frameOf(e.moving, e.x / 50), e.atkUntil > now);
        ctx.drawImage(img, Math.round(e.x - 32), Math.round(e.y - 58));
        ctx.globalAlpha = 1;
        if (G.settings.names) {
          label(e.x, e.y - 66, (e.gm ? '[GM] ' : '') + e.name + ' Lv' + e.level, e.gm ? '#ff6060' : (G.map.pvp ? '#ff9b8a' : '#ffffff'), 12, true);
          if (e.guild) label(e.x, e.y - 80, '«' + e.guild + '»', '#7fb8ff', 10);
        }
        hpBar(e.x, e.y - 62, 40, e.hp / e.maxHp, '#4ade80');
      } else if (it.k === 'self') {
        const me = G.me;
        if (me.dead) ctx.globalAlpha = 0.4;
        const img = Sprites.playerSprite(me.cls, G.data.classes[me.cls].colors, s.dir, frameOf(s.moving), s.atkUntil > now);
        ctx.drawImage(img, Math.round(s.x - 32), Math.round(s.y - 58));
        ctx.globalAlpha = 1;
        if (G.settings.names) {
          label(s.x, s.y - 66, (me.admin ? '[GM] ' : '') + me.name, '#ffd76a', 12, true);
          if (me.guild) label(s.x, s.y - 80, '«' + me.guild.name + '»', '#7fb8ff', 10);
        }
        hpBar(s.x, s.y - 62, 40, me.hp / me.stats.maxHp, '#ff5050');
      }
    }

    drawFx(now);
    // chữ nổi
    G.floats = G.floats.filter(f => now - f.t0 < 1100);
    for (const f of G.floats) {
      const p = (now - f.t0) / 1100;
      ctx.globalAlpha = 1 - p * p;
      label(f.x, f.y - p * 40, f.text, f.color, f.size * (f.bold ? (1 + Math.max(0, 0.3 - p)) : 1), true);
    }
    ctx.globalAlpha = 1;

    // Mũi tên hướng dẫn tân thủ
    drawGuideArrow(now);
    // Khung mục tiêu
    UI.updateTarget(tgt);
    if (now - lastMini > 200) { lastMini = now; drawMinimap(); }
  }

  function inView(e) { return e.x > cam.x - 150 && e.x < cam.x + W / zoom + 150 && e.y > cam.y - 150 && e.y < cam.y + H / zoom + 200; }

  function drawMonster(e, now) {
    const info = G.data.monsters[e.type] || { sprite: 'wolf', color: '#888', name: '?' };
    const frame = e.moving ? Math.floor(now / 160 + e.x / 70) % 4 : Math.floor(now / 500) % 2;
    const img = Sprites.monsterSprite(e.type, info, frame, e.dir);
    const scale = e.boss ? 2 : 1;
    const flip = info.sprite !== 'bandit' && (e.face || 2) === 1;
    const hit = e.hitAt && now - e.hitAt < 120;
    ctx.save();
    ctx.translate(Math.round(e.x), Math.round(e.y));
    if (e.boss) {
      const g = ctx.createRadialGradient(0, -30, 10, 0, -30, 90);
      g.addColorStop(0, 'rgba(255,40,40,0.35)'); g.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -30, 90, 0, Math.PI * 2); ctx.fill();
    }
    if (e.born && now - e.born < 300) ctx.globalAlpha = (now - e.born) / 300;
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -32 * scale, -58 * scale, 64 * scale, 64 * scale);
    if (hit) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(img, -32 * scale, -58 * scale, 64 * scale, 64 * scale); }
    ctx.restore();
    const top = e.boss ? -130 : -62;
    if (e.event) { label(e.x, e.y + top - 6, info.name, '#ffd700', 12, true); return; }
    const lvDiff = G.me ? info.lv - G.me.level : 0;
    const col = e.boss ? '#ff4040' : lvDiff > 5 ? '#ff7070' : lvDiff < -8 ? '#9a9a9a' : '#ffe9a8';
    if (G.settings.names || e.boss || G.target === e.id) label(e.x, e.y + top - 6, `${e.boss ? '👑 ' : ''}${info.name} Lv${info.lv}`, col, e.boss ? 14 : 11, true);
    hpBar(e.x, e.y + top, e.boss ? 90 : 40, e.hp / e.maxHp, e.boss ? '#ff3030' : '#e5484d');
  }

  function label(x, y, text, color, size = 12, outline) {
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (outline !== false) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(text, x, y); }
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function hpBar(x, y, w, r, col) {
    r = Math.max(0, Math.min(1, r || 0));
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w * r, 4);
  }

  function drawFx(now) {
    G.fx = G.fx.filter(f => now - f.t0 < f.dur);
    for (const f of G.fx) {
      const p = (now - f.t0) / f.dur;
      const src = f.from ? entityById(f.from) : null;
      const sx = src ? src.x : f.x, sy = (src ? src.y : f.y) - 28;
      const tgt = f.to ? entityById(f.to) : null;
      const tx = tgt ? tgt.x : (f.tx != null ? f.tx : f.x), ty = (tgt ? tgt.y : (f.ty != null ? f.ty : f.y)) - 28;
      const col = f.color || '#fff';
      ctx.save();
      switch (f.t) {
        case 'slash': case 'slash2': case 'bite': case 'palm': {
          ctx.globalAlpha = 1 - p;
          ctx.strokeStyle = col; ctx.lineWidth = f.t === 'palm' ? 8 : 5;
          const a = Math.atan2(ty - sy, tx - sx);
          ctx.beginPath(); ctx.arc(tx, ty, 26 + p * 10, a - 1.2 + p, a + 0.6 + p); ctx.stroke();
          if (f.t === 'slash2') { ctx.beginPath(); ctx.arc(tx, ty, 20 + p * 10, a + 0.6 - p, a + 2 - p); ctx.stroke(); }
          if (f.t === 'palm') { ctx.fillStyle = col; ctx.globalAlpha = (1 - p) * 0.5; ctx.beginPath(); ctx.arc(tx, ty, 20 + p * 20, 0, Math.PI * 2); ctx.fill(); }
          break;
        }
        case 'dart': case 'bolt': case 'dartfan': case 'dragon': {
          const n = f.t === 'dartfan' ? 5 : 1;
          for (let i = 0; i < n; i++) {
            const off = (i - (n - 1) / 2) * 0.15;
            const a = Math.atan2(ty - sy, tx - sx) + off;
            const len = Math.hypot(tx - sx, ty - sy);
            const px = sx + Math.cos(a) * len * p, py = sy + Math.sin(a) * len * p;
            ctx.fillStyle = col;
            if (f.t === 'dragon') { ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.fillRect(px - 4, py - 4, 8, 8); ctx.globalAlpha = 0.4; ctx.fillRect(px - Math.cos(a) * 16 - 3, py - Math.sin(a) * 16 - 3, 6, 6); }
          }
          break;
        }
        case 'beam': {
          ctx.globalAlpha = 1 - p; ctx.strokeStyle = col; ctx.lineWidth = 14 * (1 - p) + 2; ctx.shadowColor = col; ctx.shadowBlur = 16;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
          break;
        }
        case 'lightning': case 'storm': {
          const strikes = f.t === 'storm' ? 6 : 1;
          ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.globalAlpha = 1 - p;
          for (let k = 0; k < strikes; k++) {
            const cx = tx + (strikes > 1 ? Math.cos(k * 1.1 + f.t0) * (f.r || 100) * 0.6 : 0), cy = ty + (strikes > 1 ? Math.sin(k * 1.7 + f.t0) * (f.r || 100) * 0.35 : 0);
            ctx.beginPath(); let yy = cy - 220; ctx.moveTo(cx, yy);
            while (yy < cy) { yy += 22; ctx.lineTo(cx + (Math.random() - 0.5) * 24, Math.min(yy, cy)); }
            ctx.stroke();
          }
          if (f.t === 'storm') { ctx.globalAlpha = (1 - p) * 0.3; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(tx, ty + 28, f.r, f.r * 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
          break;
        }
        case 'ring': case 'net': case 'poison': case 'swords': case 'taiji': {
          const r = (f.r || 120) * (0.3 + p * 0.7);
          ctx.globalAlpha = (1 - p) * 0.9;
          ctx.strokeStyle = col; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.ellipse(tx, ty + 28, r, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = (1 - p) * 0.25; ctx.fillStyle = col; ctx.fill();
          if (f.t === 'swords' || f.t === 'taiji') {
            ctx.globalAlpha = 1 - p; ctx.fillStyle = col;
            for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + p * 4; ctx.fillRect(tx + Math.cos(a) * r - 3, ty + 28 + Math.sin(a) * r * 0.45 - 12, 6, 24); }
          }
          if (f.t === 'poison') { ctx.globalAlpha = 1 - p; ctx.fillStyle = '#7cfc00'; for (let i = 0; i < 10; i++) { const a = i * 2.4; ctx.beginPath(); ctx.arc(tx + Math.cos(a) * r * 0.7, ty + 28 + Math.sin(a) * r * 0.3 - p * 30, 5, 0, Math.PI * 2); ctx.fill(); } }
          break;
        }
        case 'aura': case 'heal': {
          ctx.globalAlpha = 1 - p;
          ctx.fillStyle = col;
          for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + p * 3; ctx.fillRect(sx + Math.cos(a) * 28 - 2, sy + 30 - p * 70 - (i % 3) * 10, 4, 4); }
          ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(sx, sy + 30, 30 + p * 10, 12, 0, 0, Math.PI * 2); ctx.stroke();
          if (f.t === 'heal' && f.r) { ctx.globalAlpha = (1 - p) * 0.25; ctx.beginPath(); ctx.ellipse(sx, sy + 30, f.r, f.r * 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
          break;
        }
        case 'levelup': {
          const x = src ? src.x : f.x, y = src ? src.y : f.y;
          ctx.globalAlpha = 1 - p;
          const g = ctx.createLinearGradient(0, y - 160, 0, y);
          g.addColorStop(0, 'rgba(255,215,0,0)'); g.addColorStop(1, 'rgba(255,215,0,0.7)');
          ctx.fillStyle = g; ctx.fillRect(x - 30, y - 160, 60, 160);
          label(x, y - 100 - p * 30, 'LEVEL UP!', '#ffd700', 18, true);
          break;
        }
        case 'death': {
          ctx.globalAlpha = 1 - p; ctx.fillStyle = '#ddd';
          for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * p * 40, f.y - 26 + Math.sin(a) * p * 24, 6 * (1 - p) + 1, 0, Math.PI * 2); ctx.fill(); }
          break;
        }
      }
      ctx.restore();
    }
  }

  function drawGuideArrow(now) {
    const tut = G.me && G.me.tutorial;
    if (!tut || tut.done || tut.complete) return;
    let goal = null;
    const m = G.map;
    if (tut.type === 'talk' || tut.type === 'buy' || tut.type === 'daily') {
      const npcId = tut.type === 'talk' ? tut.npc : tut.type === 'buy' ? 'duoc_diem' : 'su_gia';
      const n = m.npcs.find(x => x.id === npcId);
      if (n) goal = { x: (n.x + 0.5) * TILE, y: (n.y + 0.5) * TILE };
      else { const p = m.portals.find(x => x.to === 'tuong_duong') || m.portals[0]; if (p) goal = { x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE }; }
    } else if (tut.type === 'map' || tut.type === 'kill') {
      const target = tut.type === 'map' ? tut.map : (tut.n && G.data.monsters[tut.mon] && G.data.monsters[tut.mon].lv < 5 ? 'ngoai_o' : 'ngoai_o');
      if (m.id !== target) { const p = m.portals.find(x => x.to === target) || m.portals.find(x => x.side === 'E') || m.portals[0]; if (p) goal = { x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE }; }
    }
    if (!goal) return;
    const s = G.self;
    const d = Math.hypot(goal.x - s.x, goal.y - s.y);
    if (d < 120) return;
    const a = Math.atan2(goal.y - s.y, goal.x - s.x);
    const r = 70 + Math.sin(now / 200) * 6;
    ctx.save();
    ctx.translate(s.x + Math.cos(a) * r, s.y - 26 + Math.sin(a) * r);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd700'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  const mini = $('minimap'), mctx = mini.getContext('2d');
  function drawMinimap() {
    if (!minimapBase) return;
    const m = G.map;
    const mw = mini.width, mh = mini.height;
    mctx.imageSmoothingEnabled = false;
    mctx.fillStyle = '#000'; mctx.fillRect(0, 0, mw, mh);
    // thu nhỏ vừa khung, giữ tỉ lệ
    const sc = Math.min(mw / m.w, mh / m.h);
    const ox = (mw - m.w * sc) / 2, oy = (mh - m.h * sc) / 2;
    mctx.drawImage(minimapBase, ox, oy, m.w * sc, m.h * sc);
    const pt = (x, y, col, r) => { mctx.fillStyle = col; mctx.fillRect(ox + x / TILE * sc - r / 2, oy + y / TILE * sc - r / 2, r, r); };
    for (const n of m.npcs) pt((n.x + 0.5) * TILE, (n.y + 0.5) * TILE, '#7fffd4', 3);
    for (const e of G.monsters.values()) pt(e.x, e.y, e.boss ? '#ff00ff' : e.event ? '#ffd700' : '#ff4040', e.boss ? 6 : 2);
    for (const e of G.players.values()) pt(e.x, e.y, '#4fa3ff', 3);
    pt(G.self.x, G.self.y, '#ffffff', 4);
    mctx.strokeStyle = 'rgba(255,255,255,.5)';
    mctx.strokeRect(ox + cam.x / TILE * sc, oy + cam.y / TILE * sc, W / zoom / TILE * sc, H / zoom / TILE * sc);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try { update(dt); draw(now); UI.frame(now); } catch (e) { console.error(e); }
    if (G.inGame) requestAnimationFrame(loop);
  }

  G.show = show;
  boot();
})();
