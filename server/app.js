const fs = require('fs');
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
const { isOwner, ADMIN_EMAILS } = require('./owner');

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
app.set('trust proxy', 1); // chạy sau proxy (Render, Nginx...) để lấy đúng IP người chơi
app.use(express.json({ limit: '200kb' }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false }, pingInterval: 10000, pingTimeout: 20000 });

const world = new World(io, db);
const features = new Features(world, db);
world.party = new (require('./game/party').Party)(world);
world.dungeon = new (require('./game/dungeon').Dungeon)(world);
world.sect = new (require('./game/sect').Sect)(world);
world.daihoi = new (require('./game/daihoi').DaiHoi)(world, features, db);
const { Social } = require('./game/social');
const social = new Social(world, features, db);
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
  return { id: u.id, name: u.name, username: u.username || null, owner: isOwner(u), email: u.email, avatar: u.avatar, hasChar: !!u.character, character: u.character ? { name: u.character.name, cls: u.character.cls, level: u.character.level } : null };
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
    if (pl.email) user.email = pl.email;
    if (isOwner(user)) { user.isAdmin = true; user.banned = false; } // chủ server luôn có quyền, không thể bị khóa
    if (user.banned) return res.status(403).json({ error: 'Tài khoản đã bị khóa' + (user.banReason ? ': ' + user.banReason : '') });
    db.markDirty();
    res.json({ token: createSession(user.id), user: publicUser(user) });
  } catch (e) {
    res.status(401).json({ error: 'Xác thực Google thất bại' });
  }
});

// Đăng nhập thử nghiệm (CHỈ bật khi ALLOW_DEV_LOGIN=1, dùng cho môi trường phát triển)
// ---------- Đăng ký / đăng nhập bằng tài khoản & mật khẩu ----------
const USERNAME_RE = /^[a-zA-Z0-9_]{4,20}$/;
const findByUsername = name => { const l = String(name || '').toLowerCase(); return Object.values(db.data.users).find(u => u.username && u.username.toLowerCase() === l); };

app.post('/api/auth/register', (req, res) => {
  if (rateLimited('reg:' + req.ip, 5)) return res.status(429).json({ error: 'Bạn đăng ký quá nhiều lần, thử lại sau 1 phút' });
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Tên tài khoản 4-20 ký tự, chỉ gồm chữ không dấu, số và dấu _' });
  if (password.length < 6 || password.length > 64) return res.status(400).json({ error: 'Mật khẩu từ 6 đến 64 ký tự' });
  if (findByUsername(username)) return res.status(409).json({ error: 'Tên tài khoản đã có người dùng' });
  const id = db.newId();
  const user = db.data.users[id] = { id, username, pass: db.hashPassword(password), email: '', name: username, avatar: '', createdAt: Date.now(), lastLogin: Date.now(), banned: false, muted: false };
  db.log('user', `Đăng ký tài khoản mới: ${username}`);
  db.markDirty();
  res.json({ token: createSession(user.id), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  if (rateLimited('login:' + req.ip, 10)) return res.status(429).json({ error: 'Đăng nhập sai quá nhiều lần, thử lại sau 1 phút' });
  const user = findByUsername(req.body.username);
  if (!user || !user.pass || !db.verifyPassword(String(req.body.password || ''), user.pass)) return res.status(401).json({ error: 'Sai tên tài khoản hoặc mật khẩu' });
  if (user.banned) return res.status(403).json({ error: 'Tài khoản đã bị khóa' + (user.banReason ? ': ' + user.banReason : '') });
  user.lastLogin = Date.now();
  db.markDirty();
  res.json({ token: createSession(user.id), user: publicUser(user) });
});

app.post('/api/auth/password', (req, res) => {
  const user = userFromToken((req.headers.authorization || '').replace('Bearer ', ''));
  if (!user || !user.pass) return res.status(401).json({ error: 'Không hỗ trợ' });
  if (!db.verifyPassword(String(req.body.oldPassword || ''), user.pass)) return res.status(400).json({ error: 'Mật khẩu cũ không đúng' });
  const np = String(req.body.newPassword || '');
  if (np.length < 6 || np.length > 64) return res.status(400).json({ error: 'Mật khẩu mới từ 6 đến 64 ký tự' });
  user.pass = db.hashPassword(np);
  db.markDirty();
  res.json({ ok: true });
});

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
    for (const m of [...Object.values(MONSTERS), ...Object.values(BOSSES)]) mons[m.id] = { name: m.name, lv: m.lv, sprite: m.sprite, color: m.color, boss: !!m.boss, el: m.el, art: m.art, size: m.size, world: m.world };
    mons.chest = { name: 'Bảo Rương', lv: 1, sprite: 'chest', color: '#ffd700' };
    for (const [id, m] of Object.entries(require('./game/daihoi').DH_MONS)) mons[id] = { name: m.name, lv: m.lv, sprite: m.sprite, color: m.color, boss: !!m.boss, el: 'kim', art: m.art };
    const maps = {};
    for (const id in MAPS) {
      if (MAPS[id].instance) continue;   // bản đồ phó bản tạm thời
      const m = MAPS[id], boss = Object.values(BOSSES).find(b => b.map === id);
      maps[id] = { name: m.name, lv: m.lv, pvp: m.pvp, safe: m.safe, theme: m.theme, minLv: m.minLv, tourney: m.tourney, town: m.town, sect: m.sect, duel: !!m.duelArena,
        portals: m.portals.map(p => ({ to: p.to, side: p.side })), boss: boss ? boss.name : null, mons: [...new Set((m.spawns || []).map(s => s[0]))] };
    }
    const npcs = {};
    for (const id in NPCS) npcs[id] = { name: NPCS[id].name, sprite: NPCS[id].sprite, color: NPCS[id].color };
    const E = require('./data/enhance');
    const M = require('./data/mounts');
    const mountExp = {};
    for (let l = 1; l <= M.MOUNT_MAX; l++) mountExp[l] = M.mountExpNext(l);
    gamedataCache = { enhance: { max: E.ENHANCE_MAX, safe: E.ENHANCE_SAFE, rate: E.ENHANCE_RATE, cost: Array.from({ length: 15 }, (_, p) => [0, 1, 2, 3, 4, 5, 6].map(t => E.enhanceCost(p, t))) },
      skillMax: require('./data/skillbooks').SKILL_MAX,
      branchFreeLv: require('./data/branches').BRANCH_FREE_LV, dragons: require('./data/dragons').DRAGONS, mounts: M.MOUNTS, mountMax: M.MOUNT_MAX, mountExp, classes: CLASSES, story: require('./data/story'), gems: require('./data/gems').clientConfig(), attrs: require('./data/attrs').ATTRS, attrSuggest: require('./data/attrs').ATTR_SUGGEST, attrPerLv: require('./data/attrs').ATTR_PER_LEVEL, items: ITEMS, rarity: RARITY, slots: Object.fromEntries(Object.entries(SLOTS).map(([k, v]) => [k, v.name])), monsters: mons, maps, npcs,
      elements: require('./data/affixes').ELEMENTS, affixes: Object.fromEntries(Object.entries(require('./data/affixes').AFFIX).map(([k, a]) => [k, { name: a.name, text: a.text }])), khac: require('./data/affixes').KHAC };
  }
  // nén gzip một lần rồi giữ lại (dữ liệu ~260KB -> ~40KB)
  if (!gamedataGz) gamedataGz = require('zlib').gzipSync(JSON.stringify(gamedataCache), { level: 9 });
  res.set('Cache-Control', 'no-cache');
  if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) res.set({ 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }).type('json').send(gamedataGz);
  else res.json(gamedataCache);
});
let gamedataGz = null;

app.get('/api/leaderboard', (req, res) => {
  if (!features.lb.level) features.computeLeaderboard();
  res.json(features.lb);
});

adminRoutes(app, { db, world, features, io, rateLimited });

// ---------------- File tĩnh + đánh số phiên bản (không cần xóa cache khi cập nhật) ----------------
// BUILD đổi mỗi lần mã nguồn đổi (cả giao diện lẫn máy chủ): trang HTML luôn tải mới và gắn ?v=BUILD vào mọi file JS/CSS,
// người chơi đang mở bản cũ sẽ bị chặn bằng bảng "Phiên bản mới" cho tới khi tải lại trang.
// file có ?v được lưu lâu (immutable); file khác (hình, json) trình duyệt luôn hỏi lại (ETag → 304 nếu không đổi).
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const { CHANGELOG } = require('./data/changelog');
const BUILD = (() => {
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT.slice(0, 10);
  const h = require('crypto').createHash('sha1');
  const walk = d => { for (const f of fs.readdirSync(d).sort()) { const fp = path.join(d, f), st = fs.statSync(fp); if (st.isDirectory()) walk(fp); else h.update(fp + st.size + ':' + st.mtimeMs); } };
  try { walk(PUBLIC_DIR); walk(__dirname); } catch (e) { h.update(String(Date.now())); }
  return h.digest('hex').slice(0, 10);
})();
// lịch sử cập nhật cho mục Cài đặt (người mới xem lại các bản cập nhật trước)
app.get('/api/changelog', (req, res) => { res.set('Cache-Control', 'no-cache'); res.json({ build: BUILD, list: CHANGELOG }); });
const htmlCache = {};
function sendHtml(res, file) {
  let html = htmlCache[file];
  if (!html) {
    html = fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8')
      .replace(/(src|href)="(\/[^"?#]+\.(?:js|css))"/g, `$1="$2?v=${BUILD}"`)
      .replace('<head>', `<head><script>window.BUILD=${JSON.stringify(BUILD)}</script>`);
    htmlCache[file] = html;
  }
  res.set('Cache-Control', 'no-cache').type('html').send(html);
}
app.get(['/', '/index.html'], (req, res) => sendHtml(res, 'index.html'));
app.get(['/admin', '/admin/', '/admin/index.html'], (req, res) => sendHtml(res, 'admin/index.html'));
// nén gzip file mã (js / css / json) – nén một lần, giữ trong bộ nhớ theo thời điểm sửa file
const gzCache = new Map();
app.use((req, res, next) => {
  if (req.method !== 'GET' || !/\.(js|css|json)$/.test(req.path) || !/\bgzip\b/.test(req.headers['accept-encoding'] || '')) return next();
  const fp = path.join(PUBLIC_DIR, path.normalize(decodeURIComponent(req.path)).replace(/^(\.\.[\/\\])+/, ''));
  if (!fp.startsWith(PUBLIC_DIR)) return next();
  fs.stat(fp, (err, st) => {
    if (err || !st.isFile()) return next();
    const tag = '"gz-' + st.size.toString(36) + '-' + Math.round(st.mtimeMs).toString(36) + '"';
    res.set({ 'Cache-Control': req.query.v ? 'public, max-age=31536000, immutable' : 'no-cache', ETag: tag, Vary: 'Accept-Encoding' });
    if (req.headers['if-none-match'] === tag) return res.status(304).end();
    let c = gzCache.get(fp);
    if (!c || c.tag !== tag) { c = { tag, buf: require('zlib').gzipSync(fs.readFileSync(fp), { level: 9 }) }; gzCache.set(fp, c); }
    res.set('Content-Encoding', 'gzip').type(path.extname(fp)).send(c.buf);
  });
});
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'], cacheControl: false,
  setHeaders: (res) => res.set('Cache-Control', res.req && res.req.query && res.req.query.v ? 'public, max-age=31536000, immutable' : 'no-cache')
}));

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

// gói tin có chuỗi hoặc khoá trùng tên thuộc tính của Object.prototype: tra bảng ITEMS[x], ROUTES[x]… sẽ ra hàm / prototype
const PROTO_NAMES = new Set(Object.getOwnPropertyNames(Object.prototype));
function protoKey(v, depth) {
  if (typeof v === 'string') return PROTO_NAMES.has(v);
  if (!v || typeof v !== 'object' || depth > 4) return false;
  if (Array.isArray(v)) { for (let i = 0; i < v.length && i < 300; i++) if (protoKey(v[i], depth + 1)) return true; return false; }
  for (const k of Object.keys(v)) if (PROTO_NAMES.has(k) || protoKey(v[k], depth + 1)) return true;
  return false;
}
io.on('connection', socket => {
  const user = socket.user;
  let player = null;

  const hello = () => socket.emit('hello', { user: publicUser(user), motd: db.data.config.motd, build: BUILD, news: CHANGELOG[0] || null });
  hello();

  const on = (ev, fn) => socket.on(ev, (...args) => {
    if (args.some(a => protoKey(a, 0))) return;   // chặn khoá kiểu "__proto__", "constructor"… (làm hỏng dữ liệu / sập máy chủ)
    try { fn(...args); } catch (e) { console.error(`[socket ${ev}]`, e); }
    if (player && player.c && !Number.isFinite(player.c.gold)) { console.error(`[socket ${ev}] vàng không hợp lệ, đặt lại 0`); player.c.gold = 0; }
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
    social.notifyFriends(player, true);
    if (user.character.guildId) socket.join('guild:' + user.character.guildId);
    features.ensureDaily(player);
    socket.emit('events', features.eventsView());
    socket.emit('daily', features.dailyView(player));
    socket.emit('chat', { ch: 'sys', from: 'Hệ Thống', text: db.data.config.motd, t: Date.now() });
    if (isOwner(user)) {
      socket.emit('chat', { ch: 'sys', from: 'Hệ Thống', text: '🛡️ Bạn là chủ server. Gõ /admin để mở trang quản trị, /help để xem lệnh.', t: Date.now() });
      if (!db.usingDatabase) socket.emit('notice', { text: '⚠ CẢNH BÁO: Máy chủ chưa cấu hình DATABASE_URL. Dữ liệu đang lưu vào file tạm và SẼ MẤT mỗi lần cập nhật / khởi động lại trên Render. Hãy thêm DATABASE_URL (Neon) trong Render → Environment.', type: 'admin' });
    }
    world.story.onJoin(player);
    world.autoSrv.greet(player);
    if (!user.character.tutorial.done) socket.emit('chat', { ch: 'sys', from: 'Hệ Thống', text: 'Mẹo: Làm theo khung Hướng Dẫn Tân Thủ ở góc trái để nhận quà!', t: Date.now() });
  });

  on('move', inGame(d => world.handleMove(player, d)));
  on('skill', inGame(d => world.useSkill(player, d && d.idx, d && d.target)));
  on('respawn', inGame(d => world.respawn(player, d && d.mode)));
  on('dodge', inGame(d => world.dodge(player, d)));
  on('story', inGame(d => world.story.action(player, d)));
  on('pickup', inGame(d => world.pickupItem(player, d && typeof d.id === 'string' ? d.id : null)));
  on('useItem', inGame(d => world.useItem(player, d && d.uid, d && d.n)));
  on('quickUse', inGame(d => {
    const kind = d && d.kind === 'mp' ? 'mp' : 'hp';
    if (!world.quickUse(player, kind, d && d.auto)) { if (d && d.auto) socket.emit('noPot', { kind }); else world.toast(player, 'Không còn thuốc!', 'error'); }
  }));
  on('equip', inGame(d => world.equip(player, d && d.uid)));
  on('unequip', inGame(d => world.unequip(player, d && d.slot)));
  on('discard', inGame(d => world.discard(player, d && d.uid)));
  on('discardMany', inGame(d => world.discardMany(player, d && d.uids)));
  on('sortInv', inGame(() => world.sortInv(player)));
  on('npc', inGame(d => world.talkNpc(player, d && d.id)));
  on('buy', inGame(d => world.buy(player, d || {})));
  on('bank', inGame(d => world.bankOp(player, d)));
  on('pkMode', inGame(d => world.setPkMode(player, d && d.mode)));
  on('escort', inGame(d => world.escort.action(player, d)));
  on('sell', inGame(d => world.sell(player, d || {})));
  on('attr', inGame(d => world.attrAction(player, d)));
  on('meditate', inGame(() => world.toggleMeditate(player)));
  on('autoSrv', inGame(d => world.autoSrv.setState(player, d)));   // trạng thái tự động để máy chủ treo hộ khi rời trang
  on('away', inGame(d => world.autoSrv.setAway(player, d && d.v)));
  on('meFull', inGame(() => { player._meSent = null; player.dirtyMe = true; }));   // client mất bản cũ: gửi lại đủ
  on('party', inGame(d => world.party.action(player, d)));
  on('recall', inGame(() => world.startRecall(player)));
  on('rename', inGame(d => world.renameChar(player, d)));
  on('dungeon', inGame(d => world.dungeon.action(player, d)));
  on('sect', inGame(d => world.sect.action(player, d)));
  on('daihoi', inGame(d => {
    if (!d) return;
    if (d.op === 'enter' && world.nearNpc(player, 'dh_su_gia')) world.daihoi.enter(player);
    else if (d.op === 'leave' && player.mapId === 'dai_hoi') world.daihoi.leave(player);
    else if (d.op === 'view') world.daihoi.sync(player);
  }));
  on('sellMany', inGame(d => world.sellMany(player, d && d.uids)));
  on('enhance', inGame(d => world.enhance(player, d || {})));
  on('gem', inGame(d => world.gems.action(player, d)));
  on('inherit', inGame(d => world.inherit(player, d || {})));
  on('flipBranch', inGame(d => world.flipBranch(player, d || {})));
  on('changeClass', inGame(d => world.changeClass(player, d || {})));
  on('mount', inGame(d => d && world.mountAction(player, d)));
  on('dragon', inGame(d => d && world.selectDragon(player, d.el)));
  on('skillOp', inGame(d => d && world.skillAction(player, d)));
  on('adminPanel', () => features.openAdminPanel(user, socket));
  on('teleport', inGame(d => {
    if (!world.nearNpc(player, 'xa_phu')) return world.toast(player, 'Hãy gặp Xa Phu để đi xe', 'error');
    let t = require('./data/npcs').TELEPORTS.find(x => x.map === (d && d.map));
    const sm = require('./data/sect').SECT_MAP;
    if (!t && d && Object.values(sm).includes(d.map)) t = { map: d.map, price: sm[player.c.cls] === d.map ? 0 : 300 };   // bản đồ môn phái
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
  on('giftcodes', inGame(() => socket.emit('giftcodes', features.giftView(player))));
  on('lantern', inGame(d => features.exchangeLantern(player, d && d.idx)));
  on('chat', inGame(d => features.chat(player, d || {})));
  on('guild', inGame(d => d && d.op ? features.guildAction(player, d) : features.guildPanel(player)));
  on('lb', inGame(() => { if (!features.lb.level) features.computeLeaderboard(); socket.emit('lb', features.lb); }));
  on('online', inGame(() => socket.emit('online', [...world.players.values()].map(p => ({ name: p.c.name, cls: p.c.cls, level: p.c.level, map: MAPS[p.mapId].name })))));
  on('setQuick', inGame(d => { if (d && ITEMS[d.id]) { if (d.kind === 'mp') player.c.quickMp = d.id; else player.c.quickHp = d.id; player.dirtyMe = true; } }));

  on('inspect', inGame(d => d && social.inspect(player, d.id)));
  on('friend', inGame(d => d && social.friend(player, d)));
  on('trade', inGame(d => d && social.trade(player, d)));
  on('duel', inGame(d => world.duel.action(player, d)));
  on('ginvite', inGame(d => d && social.guildInvite(player, d)));

  socket.on('disconnect', () => {
    if (!player) return;
    social.leave(player);
    // đang bật tự động ở bãi luyện: máy chủ giữ nhân vật lại treo hộ (tối đa 8 giờ), vào lại là nhận lại
    if (world.players.get(user.id) === player && world.autoSrv.canOffline(player)) world.autoSrv.goOffline(player);
    else world.removePlayer(player);
  });
});

// Lưu định kỳ
setInterval(() => {
  for (const p of world.players.values()) { p.c.x = p.x; p.c.y = p.y; p.c.map = p.mapId; }
  db.markDirty();
  db.save();
}, 15000);
setInterval(cleanupSessions, 3600e3);

// Giữ máy chủ miễn phí (Render) không bị ngủ: tự gọi địa chỉ công khai mỗi 10 phút
const KEEP_AWAKE_URL = process.env.KEEP_AWAKE_URL || process.env.RENDER_EXTERNAL_URL;
if (KEEP_AWAKE_URL && process.env.KEEP_AWAKE !== '0') {
  setInterval(() => { fetch(KEEP_AWAKE_URL.replace(/\/$/, '') + '/api/config').catch(() => {}); }, 10 * 60000);
}

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Đang lưu dữ liệu...');
  for (const p of [...world.players.values()]) world.removePlayer(p);
  try { await db.flush(); } catch (e) { console.error(e); }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => {
  console.log(`Võ Lâm Pixel đang chạy tại http://localhost:${PORT}`);
  console.log(`Trang quản trị: http://localhost:${PORT}/admin/`);
  console.log('Chủ server (Google):', ADMIN_EMAILS.join(', '));
  console.log(db.usingDatabase ? 'Lưu dữ liệu: Postgres (DATABASE_URL)' : 'Lưu dữ liệu: file ' + (process.env.DATA_DIR || 'data/') + 'db.json');
  if (!GOOGLE_CLIENT_ID) console.warn('⚠ Chưa đặt GOOGLE_CLIENT_ID - đăng nhập Google sẽ không hoạt động.');
  if (ALLOW_DEV_LOGIN) console.warn('⚠ ALLOW_DEV_LOGIN đang bật - chỉ dùng khi phát triển!');
});

module.exports = { app, server, world, features };
