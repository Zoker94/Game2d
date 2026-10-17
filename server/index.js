const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { OAuth2Client } = require('google-auth-library');

const db = require('./db');
const { CLASSES } = require('./data/classes');
const { ITEMS, RARITY, SLOTS } = require('./data/items');
const { MONSTERS, BOSSES } = require('./data/monsters');
const { MAPS } = require('./data/maps');
const { NPCS } = require('./data/npcs');
const { World } = require('./game/world');
const { Features } = require('./game/features');
const U = require('./game/util');
const adminRoutes = require('./admin');

const PORT = process.env.PORT || 3000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const ALLOW_DEV_LOGIN = process.argv.includes('--dev') || /^(1|true|yes)$/i.test(process.env.ALLOW_DEV_LOGIN || '');
const ADMIN_USER = process.env.ADMIN_USER || 'zoker941';
const ADMIN_PASS = process.env.ADMIN_PASS || 'huongchi1';
const SESSION_MS = 30 * 86400e3;

db.load();
// Tạo tài khoản quản trị mặc định
if (!db.data.admins[ADMIN_USER]) {
  db.data.admins[ADMIN_USER] = db.hashPassword(ADMIN_PASS);
  db.log('admin', `Khởi tạo tài khoản quản trị ${ADMIN_USER}`);
  db.markDirty();
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false }, pingInterval: 10000, pingTimeout: 20000 });

const world = new World(io, db);
const features = new Features(world, db);
world.start();

// ---------------- Hỗ trợ xác thực ----------------
function createSession(userId) {
  const token = db.newToken();
  db.data.sessions[token] = { userId, exp: Date.now() + SESSION_MS };
  db.markDirty();
  return token;
}
function userFromToken(token) {
  const s = token && db.data.sessions[token];
  if (!s) return null;
  if (s.exp < Date.now()) { delete db.data.sessions[token]; return null; }
  return db.data.users[s.userId] || null;
}
function cleanupSessions() {
  const now = Date.now();
  for (const [t, s] of Object.entries(db.data.sessions)) if (s.exp < now) delete db.data.sessions[t];
  for (const [t, s] of Object.entries(db.data.adminSessions)) if (s.exp < now) delete db.data.adminSessions[t];
}
const loginHits = new Map();
function rateLimited(ip, max = 20) {
  const now = Date.now();
  const rec = loginHits.get(ip) || { n: 0, reset: now + 60000 };
  if (now > rec.reset) { rec.n = 0; rec.reset = now + 60000; }
  rec.n++;
  loginHits.set(ip, rec);
  return rec.n > max;
}
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, avatar: u.avatar, hasChar: !!u.character, character: u.character ? { name: u.character.name, cls: u.character.cls, level: u.character.level } : null };
}

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// ---------------- API công khai ----------------
app.get('/api/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID, devLogin: ALLOW_DEV_LOGIN, motd: db.data.config.motd, maintenance: db.data.config.maintenance, online: world.players.size });
});

app.post('/api/auth/google', async (req, res) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Thử lại sau ít phút' });
  if (!googleClient) return res.status(500).json({ error: 'Máy chủ chưa cấu hình GOOGLE_CLIENT_ID' });
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: String(req.body.credential || ''), audience: GOOGLE_CLIENT_ID });
    const pl = ticket.getPayload();
    if (!pl || !pl.sub) throw new Error('invalid');
    if (pl.email && pl.email_verified === false) return res.status(403).json({ error: 'Email Google chưa xác minh' });
    let user = Object.values(db.data.users).find(u => u.googleId === pl.sub);
    if (!user) {
      const id = db.newId();
      user = db.data.users[id] = { id, googleId: pl.sub, email: pl.email || '', name: pl.name || 'Hiệp khách', avatar: pl.picture || '', createdAt: Date.now(), banned: false, muted: false };
      db.log('user', `Tài khoản mới liên kết Google: ${user.email}`);
    }
    user.lastLogin = Date.now();
    if (user.banned) return res.status(403).json({ error: 'Tài khoản đã bị khóa' + (user.banReason ? ': ' + user.banReason : '') });
    db.markDirty();
    res.json({ token: createSession(user.id), user: publicUser(user) });
  } catch (e) {
    res.status(401).json({ error: 'Xác thực Google thất bại' });
  }
});

// Đăng nhập thử nghiệm (CHỈ bật khi ALLOW_DEV_LOGIN=1, dùng cho môi trường phát triển)
app.post('/api/auth/dev', (req, res) => {
  if (!ALLOW_DEV_LOGIN) return res.status(404).json({ error: 'Không hỗ trợ' });
  const key = String(req.body.name || '').trim().slice(0, 30);
  if (!key) return res.status(400).json({ error: 'Nhập tên' });
  const gid = 'dev:' + key.toLowerCase();
  let user = Object.values(db.data.users).find(u => u.googleId === gid);
  if (!user) {
    const id = db.newId();
    user = db.data.users[id] = { id, googleId: gid, email: key + '@dev.local', name: key, avatar: '', createdAt: Date.now(), banned: false, muted: false };
  }
  if (user.banned) return res.status(403).json({ error: 'Tài khoản đã bị khóa' });
  user.lastLogin = Date.now();
  db.markDirty();
  res.json({ token: createSession(user.id), user: publicUser(user) });
});

app.get('/api/me', (req, res) => {
  const u = userFromToken((req.headers.authorization || '').replace('Bearer ', ''));
  if (!u) return res.status(401).json({ error: 'Phiên đăng nhập hết hạn' });
  res.json({ user: publicUser(u) });
});

app.post('/api/auth/logout', (req, res) => {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  delete db.data.sessions[t];
  db.markDirty();
  res.json({ ok: true });
});

let gamedataCache = null;
app.get('/api/gamedata', (req, res) => {
  if (!gamedataCache) {
    const mons = {};
    for (const m of [...Object.values(MONSTERS), ...Object.values(BOSSES)]) mons[m.id] = { name: m.name, lv: m.lv, sprite: m.sprite, color: m.color, boss: !!m.boss };
    mons.chest = { name: 'Bảo Rương', lv: 1, sprite: 'chest', color: '#ffd700' };
    const maps = {};
    for (const id in MAPS) maps[id] = { name: MAPS[id].name, lv: MAPS[id].lv, pvp: MAPS[id].pvp, safe: MAPS[id].safe };
    const npcs = {};
    for (const id in NPCS) npcs[id] = { name: NPCS[id].name, sprite: NPCS[id].sprite, color: NPCS[id].color };
    const E = require('./data/enhance');
    const M = require('./data/mounts');
    const mountExp = {};
    for (let l = 1; l <= M.MOUNT_MAX; l++) mountExp[l] = M.mountExpNext(l);
    gamedataCache = { enhance: { max: E.ENHANCE_MAX, safe: E.ENHANCE_SAFE, rate: E.ENHANCE_RATE, cost: Array.from({ length: 15 }, (_, p) => [0, 1, 2, 3, 4, 5, 6].map(t => E.enhanceCost(p, t))) },
      mounts: M.MOUNTS, mountMax: M.MOUNT_MAX, mountExp, classes: CLASSES, items: ITEMS, rarity: RARITY, slots: Object.fromEntries(Object.entries(SLOTS).map(([k, v]) => [k, v.name])), monsters: mons, maps, npcs };
  }
  res.json(gamedataCache);
});

app.get('/api/leaderboard', (req, res) => {
  if (!features.lb.level) features.computeLeaderboard();
  res.json(features.lb);
});

adminRoutes(app, { db, world, features, io, rateLimited });

app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h', extensions: ['html'] }));

// ---------------- Socket.IO ----------------
io.use((socket, next) => {
  const user = userFromToken(socket.handshake.auth && socket.handshake.auth.token);
  if (!user) return next(new Error('auth'));
  if (user.banned) return next(new Error('banned'));
  if (db.data.config.maintenance && !user.isAdmin) return next(new Error('maintenance'));
  socket.user = user;
  next();
});

const NAME_RE = /^[\p{L}\p{N}_]{3,14}$/u;

io.on('connection', socket => {
  const user = socket.user;
  let player = null;

  const hello = () => socket.emit('hello', { user: publicUser(user), motd: db.data.config.motd });
  hello();

  const on = (ev, fn) => socket.on(ev, (...args) => {
    try { fn(...args); } catch (e) { console.error(`[socket ${ev}]`, e); }
  });
  const inGame = fn => (...args) => { if (player && world.players.get(user.id) === player) fn(...args); };

  on('createChar', ({ name, cls } = {}) => {
    if (user.character) return socket.emit('toast', { text: 'Tài khoản đã có nhân vật', type: 'error' });
    name = String(name || '').trim();
    if (!NAME_RE.test(name)) return socket.emit('toast', { text: 'Tên 3-14 ký tự, chỉ gồm chữ, số, dấu _', type: 'error' });
    if (!CLASSES[cls]) return socket.emit('toast', { text: 'Môn phái không hợp lệ', type: 'error' });
    const lower = name.toLowerCase();
    if (Object.values(db.data.users).some(u => u.character && u.character.name.toLowerCase() === lower)) return socket.emit('toast', { text: 'Tên nhân vật đã tồn tại', type: 'error' });
    user.character = U.newCharacter(name, cls);
    db.log('user', `Tạo nhân vật ${name} (${CLASSES[cls].name})`, { user: user.id });
    db.markDirty();
    hello();
  });

  on('enter', () => {
    if (!user.character || player) return;
    player = world.addPlayer(user, socket);
    if (user.character.guildId) socket.join('guild:' + user.character.guildId);
    features.ensureDaily(player);
    socket.emit('events', features.eventsView());
    socket.emit('daily', features.dailyView(player));
    socket.emit('chat', { ch: 'sys', from: 'Hệ Thống', text: db.data.config.motd, t: Date.now() });
    if (!user.character.tutorial.done) socket.emit('chat', { ch: 'sys', from: 'Hệ Thống', text: 'Mẹo: Làm theo khung Hướng Dẫn Tân Thủ ở góc trái để nhận quà!', t: Date.now() });
  });

  on('move', inGame(d => world.handleMove(player, d)));
  on('skill', inGame(d => world.useSkill(player, d && d.idx, d && d.target)));
  on('respawn', inGame(() => world.respawn(player)));
  on('useItem', inGame(d => world.useItem(player, d && d.uid)));
  on('quickUse', inGame(d => {
    const id = d && d.kind === 'mp' ? player.c.quickMp : player.c.quickHp;
    const pref = d && d.kind === 'mp' ? ['mp3', 'mp2', 'mp1'] : ['hp3', 'hp2', 'hp1'];
    const order = [id, ...pref].filter(x => ITEMS[x] && player.c.level >= (ITEMS[x].lv || 1));
    const s = order.map(x => player.c.inv.find(i => i.id === x)).find(Boolean);
    if (!s) return world.toast(player, 'Không còn thuốc!', 'error');
    world.useItem(player, s.uid);
  }));
  on('equip', inGame(d => world.equip(player, d && d.uid)));
  on('unequip', inGame(d => world.unequip(player, d && d.slot)));
  on('discard', inGame(d => world.discard(player, d && d.uid)));
  on('npc', inGame(d => world.talkNpc(player, d && d.id)));
  on('buy', inGame(d => world.buy(player, d || {})));
  on('sell', inGame(d => world.sell(player, d || {})));
  on('enhance', inGame(d => world.enhance(player, d || {})));
  on('mount', inGame(d => d && world.mountAction(player, d)));
  on('teleport', inGame(d => {
    if (!world.nearNpc(player, 'xa_phu')) return world.toast(player, 'Hãy gặp Xa Phu để đi xe', 'error');
    const t = require('./data/npcs').TELEPORTS.find(x => x.map === (d && d.map));
    if (!t) return;
    if (player.c.gold < t.price) return world.toast(player, 'Không đủ ngân lượng', 'error');
    if (player.c.level < (MAPS[t.map].minLv || 1)) return world.toast(player, `Cần cấp ${MAPS[t.map].minLv}`, 'error');
    player.c.gold -= t.price;
    world.teleport(player, t.map);
  }));
  on('tutorialClaim', inGame(() => world.claimTutorial(player)));
  on('daily', inGame(() => socket.emit('daily', features.dailyView(player))));
  on('dailyClaim', inGame(d => features.claimDaily(player, d && d.id)));
  on('eventPanel', inGame(() => socket.emit('eventPanel', features.eventPanel(player))));
  on('wheel', inGame(() => features.spinWheel(player)));
  on('checkin', inGame(() => features.doCheckin(player)));
  on('giftcode', inGame(d => features.redeemCode(player, d && d.code)));
  on('lantern', inGame(d => features.exchangeLantern(player, d && d.idx)));
  on('chat', inGame(d => features.chat(player, d || {})));
  on('guild', inGame(d => d && d.op ? features.guildAction(player, d) : features.guildPanel(player)));
  on('lb', inGame(() => { if (!features.lb.level) features.computeLeaderboard(); socket.emit('lb', features.lb); }));
  on('online', inGame(() => socket.emit('online', [...world.players.values()].map(p => ({ name: p.c.name, cls: p.c.cls, level: p.c.level, map: MAPS[p.mapId].name })))));
  on('setQuick', inGame(d => { if (d && ITEMS[d.id]) { if (d.kind === 'mp') player.c.quickMp = d.id; else player.c.quickHp = d.id; player.dirtyMe = true; } }));

  socket.on('disconnect', () => { if (player) world.removePlayer(player); });
});

// Lưu định kỳ
setInterval(() => {
  for (const p of world.players.values()) { p.c.x = p.x; p.c.y = p.y; p.c.map = p.mapId; }
  db.markDirty();
  db.save();
}, 15000);
setInterval(cleanupSessions, 3600e3);

function shutdown() {
  console.log('Đang lưu dữ liệu...');
  for (const p of [...world.players.values()]) world.removePlayer(p);
  db.markDirty();
  db.save();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => {
  console.log(`Võ Lâm Pixel đang chạy tại http://localhost:${PORT}`);
  console.log(`Trang quản trị: http://localhost:${PORT}/admin/`);
  if (!GOOGLE_CLIENT_ID) console.warn('⚠ Chưa đặt GOOGLE_CLIENT_ID - đăng nhập Google sẽ không hoạt động.');
  if (ALLOW_DEV_LOGIN) console.warn('⚠ ALLOW_DEV_LOGIN đang bật - chỉ dùng khi phát triển!');
});

module.exports = { app, server, world, features };
