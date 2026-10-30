// API trang quản trị (admin panel). Mọi route /api/admin/* (trừ login) yêu cầu token quản trị.
const { ITEMS } = require('./data/items');
const { CLASSES } = require('./data/classes');
const { MAPS } = require('./data/maps');
const { BOSSES } = require('./data/monsters');
const { EVENT_INFO } = require('./game/features');
const U = require('./game/util');
const { isOwner } = require('./owner');

module.exports = function adminRoutes(app, { db, world, features, io, rateLimited }) {
  const SESSION_MS = 12 * 3600e3;

  function auth(req, res, next) {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    const s = db.data.adminSessions[t];
    if (!s || s.exp < Date.now()) return res.status(401).json({ error: 'Chưa đăng nhập quản trị' });
    if (s.userId) { // phiên mở từ trong game bằng tài khoản Google chủ server
      const u = db.data.users[s.userId];
      if (!isOwner(u)) return res.status(401).json({ error: 'Không có quyền quản trị' });
      req.admin = u.email; req.isOwner = true;
    } else {
      if (!db.data.admins[s.username] || db.data.config.disablePasswordAdmin) return res.status(401).json({ error: 'Chưa đăng nhập quản trị' });
      req.admin = s.username; req.isOwner = false;
    }
    next();
  }
  const act = (req, text) => db.log('admin', `[${req.admin}] ${text}`);

  app.post('/api/admin/login', (req, res) => {
    if (rateLimited('admin:' + req.ip, 10)) return res.status(429).json({ error: 'Đăng nhập sai quá nhiều lần, thử lại sau 1 phút' });
    if (db.data.config.disablePasswordAdmin) return res.status(403).json({ error: 'Đăng nhập quản trị bằng mật khẩu đã bị chủ server tắt. Hãy vào game bằng tài khoản Google chủ server và gõ /admin' });
    const { username, password } = req.body || {};
    const rec = db.data.admins[String(username || '')];
    if (!rec || !db.verifyPassword(String(password || ''), rec)) {
      db.log('security', `Đăng nhập quản trị thất bại: ${String(username).slice(0, 30)} từ ${req.ip}`);
      return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
    }
    const token = db.newToken();
    db.data.adminSessions[token] = { username, exp: Date.now() + SESSION_MS };
    db.log('admin', `${username} đăng nhập trang quản trị từ ${req.ip}`);
    db.markDirty();
    res.json({ token, username, owner: false });
  });

  app.get('/api/admin/whoami', auth, (req, res) => res.json({ name: req.admin, owner: req.isOwner, storage: db.usingDatabase ? 'postgres' : 'file' }));

  app.post('/api/admin/logout', auth, (req, res) => {
    delete db.data.adminSessions[(req.headers.authorization || '').replace('Bearer ', '')];
    res.json({ ok: true });
  });

  app.post('/api/admin/password', auth, (req, res) => {
    const { oldPassword, newPassword } = req.body || {};
    if (!db.verifyPassword(String(oldPassword || ''), db.data.admins[req.admin])) return res.status(400).json({ error: 'Mật khẩu cũ không đúng' });
    if (String(newPassword || '').length < 6) return res.status(400).json({ error: 'Mật khẩu mới tối thiểu 6 ký tự' });
    db.data.admins[req.admin] = db.hashPassword(String(newPassword));
    act(req, 'Đổi mật khẩu quản trị');
    db.markDirty();
    res.json({ ok: true });
  });

  // ----- Tổng quan -----
  app.get('/api/admin/stats', auth, (req, res) => {
    const users = Object.values(db.data.users);
    const chars = users.filter(u => u.character);
    const byClass = {};
    for (const u of chars) byClass[u.character.cls] = (byClass[u.character.cls] || 0) + 1;
    const byMap = {};
    for (const p of world.players.values()) byMap[p.mapId] = (byMap[p.mapId] || 0) + 1;
    const dayAgo = Date.now() - 86400e3;
    res.json({
      online: world.players.size, peakOnline: db.data.stats.peakOnline || 0,
      users: users.length, characters: chars.length, banned: users.filter(u => u.banned).length,
      newToday: users.filter(u => u.createdAt > dayAgo).length, activeToday: users.filter(u => (u.lastLogin || 0) > dayAgo).length,
      guilds: Object.keys(db.data.guilds).length,
      totalGold: chars.reduce((s, u) => s + (u.character.gold || 0), 0),
      totalKnb: chars.reduce((s, u) => s + (u.character.knb || 0), 0),
      avgLevel: chars.length ? +(chars.reduce((s, u) => s + u.character.level, 0) / chars.length).toFixed(1) : 0,
      byClass: Object.fromEntries(Object.entries(byClass).map(([k, v]) => [CLASSES[k].name, v])),
      byMap: Object.fromEntries(Object.entries(byMap).map(([k, v]) => [MAPS[k].name, v])),
      uptime: Math.round(process.uptime()), memory: Math.round(process.memoryUsage().rss / 1048576), storage: db.usingDatabase ? 'postgres' : 'file',
      events: features.eventsView()
    });
  });

  // ----- Người chơi -----
  const userRow = u => ({
    id: u.id, email: u.email || (u.username ? '(tài khoản) ' + u.username : ''), username: u.username || '', gname: u.name, createdAt: u.createdAt, lastLogin: u.lastLogin, banned: !!u.banned, banReason: u.banReason || '',
    muted: u.muted === true || (u.muted && u.muted > Date.now()) ? u.muted : false, isGM: !!u.isAdmin, online: world.players.has(u.id),
    character: u.character ? { name: u.character.name, cls: u.character.cls, clsName: CLASSES[u.character.cls].name, level: u.character.level, gold: u.character.gold, knb: u.character.knb, map: u.character.map, power: u.character.power, kills: u.character.kills } : null
  });
  app.get('/api/admin/users', auth, (req, res) => {
    const q = String(req.query.q || '').toLowerCase();
    const filter = String(req.query.filter || '');
    let list = Object.values(db.data.users);
    if (q) list = list.filter(u => (u.email || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q) || (u.character && u.character.name.toLowerCase().includes(q)) || u.id === q);
    if (filter === 'online') list = list.filter(u => world.players.has(u.id));
    if (filter === 'banned') list = list.filter(u => u.banned);
    list.sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));
    res.json({ total: list.length, users: list.slice(0, 200).map(userRow) });
  });
  app.get('/api/admin/users/:id', auth, (req, res) => {
    const u = db.data.users[req.params.id];
    if (!u) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ ...userRow(u), full: u.character || null });
  });

  function withUser(req, res, fn) {
    const u = db.data.users[req.params.id];
    if (!u) return res.status(404).json({ error: 'Không tìm thấy người chơi' });
    const p = world.players.get(u.id);
    const r = fn(u, p);
    if (p) { world.recalc(p); p.dirtyMe = true; }
    db.markDirty();
    res.json(r || { ok: true, user: userRow(u) });
  }

  app.post('/api/admin/users/:id/update', auth, (req, res) => withUser(req, res, (u, p) => {
    const c = u.character;
    const b = req.body || {};
    if (c) {
      if (b.level != null) { c.level = U.clamp(b.level | 0, 1, U.MAX_LEVEL); c.exp = 0; }
      if (b.gold != null) c.gold = Math.max(0, Math.floor(+b.gold));
      if (b.knb != null) c.knb = Math.max(0, Math.floor(+b.knb));
      if (b.addGold) c.gold = Math.max(0, c.gold + Math.floor(+b.addGold));
      if (b.addKnb) c.knb = Math.max(0, c.knb + Math.floor(+b.addKnb));
      if (b.addExp && p) world.gainExp(p, +b.addExp, true); else if (b.addExp) c.exp += Math.floor(+b.addExp);
      if (b.name && b.name !== c.name) {
        const lower = String(b.name).toLowerCase();
        if (Object.values(db.data.users).some(x => x !== u && x.character && x.character.name.toLowerCase() === lower)) return { error: 'Tên đã tồn tại' };
        c.name = String(b.name).slice(0, 14);
      }
      if (b.addAttr) world.grantPoints(c, 'attr', b.addAttr);   // tặng điểm tiềm năng / võ học để người chơi tự cộng
      if (b.addSp) world.grantPoints(c, 'sp', b.addSp);
      if (b.heal && p) { c.hp = p.stats.maxHp; c.mp = p.stats.maxMp; p.dead = false; }
    }
    if (b.isGM != null) u.isAdmin = !!b.isGM;
    act(req, `Cập nhật người chơi ${c ? c.name : u.email}: ${JSON.stringify(b)}`);
    if (p) world.toast(p, 'Tài khoản của bạn vừa được quản trị viên cập nhật', 'info');
  }));

  app.post('/api/admin/users/:id/ban', auth, (req, res) => withUser(req, res, (u, p) => {
    if (isOwner(u) && req.body.banned) return { error: 'Không thể khóa tài khoản chủ server' };
    u.banned = !!req.body.banned;
    u.banReason = String(req.body.reason || '').slice(0, 200);
    if (u.banned) {
      for (const [t, s] of Object.entries(db.data.sessions)) if (s.userId === u.id) delete db.data.sessions[t];
      if (p) { p.socket.emit('kicked', { reason: 'Tài khoản bị khóa: ' + u.banReason }); world.removePlayer(p); p.socket.disconnect(true); }
    }
    act(req, `${u.banned ? 'Khóa' : 'Mở khóa'} ${u.character ? u.character.name : u.email} ${u.banReason}`);
  }));

  app.post('/api/admin/users/:id/reset-password', auth, (req, res) => withUser(req, res, (u) => {
    const np = String(req.body.password || '');
    if (!u.username) return { error: 'Tài khoản này đăng nhập bằng Google, không có mật khẩu' };
    if (np.length < 6) return { error: 'Mật khẩu tối thiểu 6 ký tự' };
    u.pass = db.hashPassword(np);
    for (const [t, s] of Object.entries(db.data.sessions)) if (s.userId === u.id) delete db.data.sessions[t];
    act(req, `Đặt lại mật khẩu cho tài khoản ${u.username}`);
  }));

  app.post('/api/admin/users/:id/mute', auth, (req, res) => withUser(req, res, (u, p) => {
    const mins = +req.body.minutes || 0;
    u.muted = mins > 0 ? Date.now() + mins * 60000 : false;
    if (p) world.toast(p, mins > 0 ? `Bạn bị cấm chat ${mins} phút` : 'Bạn đã được mở chat', mins > 0 ? 'error' : 'info');
    act(req, `${mins > 0 ? 'Cấm chat ' + mins + ' phút' : 'Mở chat'} ${u.character ? u.character.name : u.email}`);
  }));

  app.post('/api/admin/users/:id/kick', auth, (req, res) => withUser(req, res, (u, p) => {
    if (isOwner(u) && !req.isOwner) return { error: 'Không thể kick chủ server' };
    if (p) { p.socket.emit('kicked', { reason: String(req.body.reason || 'Bị quản trị viên mời ra khỏi game') }); world.removePlayer(p); p.socket.disconnect(true); }
    act(req, `Kick ${u.character ? u.character.name : u.email}`);
  }));

  app.post('/api/admin/users/:id/give', auth, (req, res) => withUser(req, res, (u, p) => {
    const { itemId, qty = 1, plus = 0 } = req.body || {};
    if (!ITEMS[itemId] || !u.character) return { error: 'Vật phẩm không hợp lệ' };
    const q = U.clamp(qty | 0, 1, 9999);
    if (p) world.giveItem(p, itemId, q, U.clamp(plus | 0, 0, 15));
    else if (!U.addItem(u.character, itemId, q, U.clamp(plus | 0, 0, 15))) return { error: 'Túi đồ người chơi đã đầy' };
    if (p) world.toast(p, `Quản trị viên tặng bạn ${ITEMS[itemId].name} x${q}`, 'reward');
    act(req, `Tặng ${ITEMS[itemId].name} x${q} cho ${u.character.name}`);
  }));

  app.post('/api/admin/users/:id/remove-item', auth, (req, res) => withUser(req, res, (u) => {
    if (!u.character) return { error: 'Không có nhân vật' };
    const { uid, slot } = req.body || {};
    if (slot) delete u.character.equip[slot];
    else U.removeByUid(u.character, uid, (u.character.inv.find(x => x.uid === uid) || {}).qty || 1);
    act(req, `Xóa vật phẩm của ${u.character.name}`);
  }));

  app.post('/api/admin/users/:id/teleport', auth, (req, res) => withUser(req, res, (u, p) => {
    const map = req.body.map;
    if (!MAPS[map]) return { error: 'Bản đồ không hợp lệ' };
    if (p) { p.dead = false; if (p.c.hp <= 0) p.c.hp = p.stats.maxHp; world.teleport(p, map); }
    else if (u.character) { u.character.map = map; u.character.x = 0; u.character.y = 0; }
    act(req, `Dịch chuyển ${u.character ? u.character.name : ''} tới ${MAPS[map].name}`);
  }));

  app.post('/api/admin/users/:id/reset-char', auth, (req, res) => withUser(req, res, (u, p) => {
    if (isOwner(u) && !req.isOwner) return { error: 'Không thể xóa nhân vật chủ server' };
    if (p) { p.socket.emit('kicked', { reason: 'Nhân vật đã bị xóa bởi quản trị viên' }); world.removePlayer(p); p.socket.disconnect(true); }
    if (u.character && u.character.guildId) {
      const g = db.data.guilds[u.character.guildId];
      if (g) { delete g.members[u.id]; if (g.leader === u.id) { const next = Object.keys(g.members)[0]; if (next) { g.leader = next; g.members[next] = 'leader'; } else delete db.data.guilds[g.id]; } }
    }
    act(req, `Xóa nhân vật ${u.character ? u.character.name : ''} (${u.email})`);
    u.character = null;
  }));

  app.delete('/api/admin/users/:id', auth, (req, res) => {
    const u = db.data.users[req.params.id];
    if (!u) return res.status(404).json({ error: 'Không tìm thấy' });
    if (isOwner(u)) return res.status(403).json({ error: 'Không thể xóa tài khoản chủ server' });
    const p = world.players.get(u.id);
    if (p) { p.socket.emit('kicked', { reason: 'Tài khoản đã bị xóa' }); world.removePlayer(p); p.socket.disconnect(true); }
    if (u.character && u.character.guildId && db.data.guilds[u.character.guildId]) delete db.data.guilds[u.character.guildId].members[u.id];
    for (const [t, s] of Object.entries(db.data.sessions)) if (s.userId === u.id) delete db.data.sessions[t];
    delete db.data.users[u.id];
    act(req, `Xóa tài khoản ${u.email}`);
    db.markDirty();
    res.json({ ok: true });
  });

  // ----- Thông báo -----
  app.post('/api/admin/broadcast', auth, (req, res) => {
    const text = String(req.body.text || '').slice(0, 300);
    if (!text) return res.status(400).json({ error: 'Nội dung trống' });
    features.announce('📢 [Quản Trị] ' + text);
    if (req.body.popup) io.emit('notice', { text, type: 'admin' });
    act(req, `Thông báo: ${text}`);
    res.json({ ok: true });
  });

  // ----- Cấu hình -----
  app.get('/api/admin/config', auth, (req, res) => res.json(db.data.config));
  app.post('/api/admin/config', auth, (req, res) => {
    const c = db.data.config, b = req.body || {};
    for (const k of ['expRate', 'dropRate', 'goldRate']) if (b[k] != null) c[k] = U.clamp(+b[k] || 1, 0.1, 100);
    if (b.vipDropBase != null) c.vipDropBase = U.clamp(+b.vipDropBase || 0, 0, 1);
    if (b.motd != null) c.motd = String(b.motd).slice(0, 300);
    if (b.maintenance != null) {
      c.maintenance = !!b.maintenance;
      if (c.maintenance) for (const p of [...world.players.values()]) if (!p.user.isAdmin) { p.socket.emit('kicked', { reason: 'Máy chủ đang bảo trì' }); world.removePlayer(p); p.socket.disconnect(true); }
    }
    if (b.autoEvents != null) c.autoEvents = !!b.autoEvents;
    if (b.serverMode === 'test' || b.serverMode === 'open') c.serverMode = b.serverMode;   // Open Test: NPC bán thêm rương mở đồ; Open chính thức: không bán
    if (b.disablePasswordAdmin != null) {
      if (!req.isOwner) return res.status(403).json({ error: 'Chỉ chủ server (tài khoản Google) mới được thay đổi mục này' });
      c.disablePasswordAdmin = !!b.disablePasswordAdmin;
      if (c.disablePasswordAdmin) for (const [t, s] of Object.entries(db.data.adminSessions)) if (!s.userId) delete db.data.adminSessions[t];
    }
    act(req, `Cập nhật cấu hình ${JSON.stringify(b)}`);
    db.markDirty();
    res.json(c);
  });

  // ----- Boss & sự kiện -----
  app.get('/api/admin/events', auth, (req, res) => res.json({ ...features.eventsView(), info: EVENT_INFO, bossList: Object.values(BOSSES).map(b => ({ id: b.id, name: b.name, lv: b.lv, map: MAPS[b.map].name, every: b.every, offset: b.offset })) }));
  app.post('/api/admin/boss/spawn', auth, (req, res) => {
    const ok = features.spawnBoss(req.body.id);
    act(req, `Triệu hồi boss ${req.body.id}`);
    res.json(ok ? { ok } : { error: 'Boss đang tồn tại hoặc không hợp lệ' });
  });
  app.post('/api/admin/boss/kill', auth, (req, res) => {
    const b = features.bosses[req.body.id];
    if (!b) return res.json({ error: 'Boss không tồn tại' });
    world.maps[b.mon.mapId].monsters.delete(b.mon.id);
    delete features.bosses[req.body.id];
    features.broadcastEvents();
    act(req, `Xóa boss ${req.body.id}`);
    res.json({ ok: true });
  });
  app.post('/api/admin/event/start', auth, (req, res) => {
    const ok = features.startEvent(req.body.key, U.clamp(+req.body.minutes || 30, 1, 1440));
    act(req, `Bắt đầu sự kiện ${req.body.key}`);
    res.json(ok ? { ok } : { error: 'Sự kiện đang diễn ra hoặc không hợp lệ' });
  });
  app.post('/api/admin/event/stop', auth, (req, res) => {
    const ok = features.stopEvent(req.body.key);
    act(req, `Dừng sự kiện ${req.body.key}`);
    res.json(ok ? { ok } : { error: 'Sự kiện không diễn ra' });
  });

  // ----- Bang hội -----
  app.get('/api/admin/guilds', auth, (req, res) => res.json(Object.values(db.data.guilds).map(g => features.guildView(g, true))));
  app.post('/api/admin/guilds/:id/disband', auth, (req, res) => {
    const g = db.data.guilds[req.params.id];
    if (!g) return res.status(404).json({ error: 'Không tìm thấy' });
    features.disbandGuild(g.id);
    act(req, `Giải tán bang ${g.name}`);
    res.json({ ok: true });
  });
  app.post('/api/admin/guilds/:id/update', auth, (req, res) => {
    const g = db.data.guilds[req.params.id];
    if (!g) return res.status(404).json({ error: 'Không tìm thấy' });
    if (req.body.level != null) g.level = U.clamp(req.body.level | 0, 1, 6);
    if (req.body.fund != null) g.fund = Math.max(0, +req.body.fund | 0);
    if (req.body.name) g.name = String(req.body.name).slice(0, 16);
    if (req.body.notice != null) g.notice = String(req.body.notice).slice(0, 200);
    for (const uid in g.members) { const p = world.players.get(uid); if (p) world.recalc(p); }
    act(req, `Sửa bang ${g.name}`);
    db.markDirty();
    res.json({ ok: true });
  });

  // ----- Gift code -----
  app.get('/api/admin/giftcodes', auth, (req, res) => res.json(Object.entries(db.data.giftcodes).map(([code, g]) => ({ code, ...g, used: g.usedBy.length, usedBy: undefined }))));
  app.post('/api/admin/giftcodes', auth, (req, res) => {
    const b = req.body || {};
    const code = String(b.code || '').trim().toUpperCase() || Math.random().toString(36).slice(2, 10).toUpperCase();
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return res.status(400).json({ error: 'Mã 3-24 ký tự A-Z, 0-9' });
    const items = (b.items || []).filter(x => ITEMS[x[0]]).map(([id, q]) => [id, U.clamp(q | 0, 1, 9999)]);
    db.data.giftcodes[code] = {
      reward: { gold: Math.max(0, +b.gold | 0), knb: Math.max(0, +b.knb | 0), exp: Math.max(0, +b.exp | 0), items },
      maxUses: Math.max(0, +b.maxUses | 0), exp: b.days ? Date.now() + b.days * 86400e3 : 0, usedBy: [], created: Date.now(),
      pub: !!b.pub, note: String(b.note || '').slice(0, 80), minLv: U.clamp(+b.minLv | 0, 0, U.MAX_LEVEL)
    };
    act(req, `Tạo gift code ${code}`);
    db.markDirty();
    res.json({ ok: true, code });
  });
  app.delete('/api/admin/giftcodes/:code', auth, (req, res) => {
    delete db.data.giftcodes[req.params.code];
    act(req, `Xóa gift code ${req.params.code}`);
    db.markDirty();
    res.json({ ok: true });
  });

  // ----- Nhật ký -----
  app.get('/api/admin/logs', auth, (req, res) => {
    const type = req.query.type;
    let l = db.data.logs;
    if (type) l = l.filter(x => x.type === type);
    res.json(l.slice(-300).reverse());
  });
  app.get('/api/admin/chatlogs', auth, (req, res) => {
    const q = String(req.query.q || '').toLowerCase();
    let l = db.data.chatLogs;
    if (q) l = l.filter(x => (x.from || '').toLowerCase().includes(q) || (x.text || '').toLowerCase().includes(q));
    res.json(l.slice(-300).reverse());
  });

  // ----- Dọn dẹp dữ liệu -----
  app.get('/api/admin/cleanup', auth, (req, res) => res.json(world.cleanup.preview(Math.max(1, +req.query.days || 180))));
  app.post('/api/admin/cleanup', auth, (req, res) => {
    const C = world.cleanup, b = req.body || {}, days = Math.max(0, +b.days || 0);
    let n = 0, what = '';
    if (b.what === 'logs') { n = C.clearLogs('logs', days); what = `nhật ký hệ thống${days ? ` cũ hơn ${days} ngày` : ''}`; }
    else if (b.what === 'chat') { n = C.clearLogs('chatLogs', days); what = `nhật ký chat${days ? ` cũ hơn ${days} ngày` : ''}`; }
    else if (b.what === 'nochar') { n = C.purgeList(C.find('nochar', 1)); what = 'tài khoản không có nhân vật (tạo hơn 1 ngày)'; }
    else if (b.what === 'inactive') { if (days < 7) return res.json({ error: 'Số ngày không online tối thiểu là 7' }); n = C.purgeList(C.find('inactive', days)); what = `tài khoản không online ${days} ngày`; }
    else if (b.what === 'auto') { db.data.config.autoCleanDays = Math.max(0, Math.min(3650, +b.days | 0)); db.markDirty(); act(req, `Đặt tự dọn tài khoản sau ${db.data.config.autoCleanDays || 'tắt'} ngày`); return res.json({ ok: true }); }
    else return res.json({ error: 'Không rõ thao tác' });
    act(req, `Dọn dẹp: xoá ${n} ${what}`);
    db.log('admin', `[${req.admin}] Dọn dẹp: xoá ${n} ${what}`);
    res.json({ ok: true, n });
  });

  // ----- Dữ liệu tham chiếu -----
  app.get('/api/admin/items', auth, (req, res) => res.json(Object.values(ITEMS).map(i => ({ id: i.id, name: i.name, type: i.type, rarity: i.rarity, lv: i.lv, slot: i.slot, price: i.price,
    icon: i.icon, tier: i.tier, stats: i.stats, desc: i.desc, set: i.set }))));
  // ---- Cửa hàng NPC: sửa danh sách hàng và giá (server/game/shops.js) ----
  const SHOPS = require('./game/shops');
  app.get('/api/admin/shops', auth, (req, res) => res.json(SHOPS.adminList(db)));
  app.post('/api/admin/shops/:npc', auth, (req, res) => {
    const id = req.params.npc;
    if (!SHOPS.DEF[id]) return res.status(400).json({ error: 'NPC không bán đồ' });
    const cfg = db.data.config, shops = cfg.shops || (cfg.shops = {});
    if (req.body.reset) { delete shops[id]; act(req, `Khôi phục cửa hàng mặc định của ${id}`); }
    else {
      const clean = (arr, k) => (Array.isArray(arr) ? arr : []).slice(0, 300).filter(x => x && ITEMS[x.id]).map(x => ({ id: x.id, [k]: Math.max(0, Math.round(+x[k] || 0)) }));
      const gold = clean(req.body.gold, 'price').map(x => ({ id: x.id, price: x.price || ITEMS[x.id].price }));
      const knb = clean(req.body.knb, 'knb').filter(x => x.knb > 0);
      shops[id] = { gold, knb };
      act(req, `Sửa cửa hàng ${id}: ${gold.length} món bán bằng lượng, ${knb.length} món bằng Nguyên Bảo`);
    }
    SHOPS.apply(db); db.markDirty();
    res.json({ ok: true, list: SHOPS.adminList(db) });
  });
  // tỉ lệ cường hoá (không ghi nhật ký quản trị)
  const ENH = require('./data/enhance');
  const enhView = () => ({ rate: ENH.ENHANCE_RATE, def: ENH.DEFAULT_RATE, safe: ENH.ENHANCE_SAFE, max: ENH.ENHANCE_MAX, custom: Array.isArray(db.data.config.enhanceRate),
    cost: Array.from({ length: ENH.ENHANCE_MAX }, (_, p) => ENH.enhanceCost(p, 0)) });
  app.get('/api/admin/enhance', auth, (req, res) => res.json(enhView()));
  app.post('/api/admin/enhance', auth, (req, res) => {
    const cfg = db.data.config;
    if (req.body.reset) delete cfg.enhanceRate;
    else {
      const r = req.body.rate;
      if (!Array.isArray(r) || r.length !== ENH.ENHANCE_MAX) return res.status(400).json({ error: 'Dữ liệu tỉ lệ không hợp lệ' });
      cfg.enhanceRate = r.map(v => Math.round(Math.min(1, Math.max(0, +v || 0)) * 10000) / 10000);
    }
    ENH.applyRates(cfg.enhanceRate);
    io.emit('enhRate', ENH.ENHANCE_RATE);
    db.markDirty();
    res.json({ ok: true, ...enhView() });
  });
  app.get('/api/admin/maps', auth, (req, res) => res.json(Object.values(MAPS).filter(m => world.maps[m.id]).map(m => ({ id: m.id, name: m.name + (m.base ? ' · Khu ' + m.ch : m.chs ? ' · Khu 1' : ''), lv: m.lv, online: world.maps[m.id].players.size, monsters: [...world.maps[m.id].monsters.values()].filter(x => !x.dead).length }))));
  app.post('/api/admin/save', auth, (req, res) => { db.markDirty(); db.save(); act(req, 'Lưu dữ liệu thủ công'); res.json({ ok: true }); });
};
