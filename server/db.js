// Lưu trữ dữ liệu dạng JSON (ghi nguyên tử, tự động lưu định kỳ).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'db.json');

const defaults = () => ({
  users: {},          // id -> user
  sessions: {},       // token -> { userId, exp }
  guilds: {},         // id -> guild
  admins: {},         // username -> { salt, hash }
  adminSessions: {},  // token -> { username, exp }
  giftcodes: {},      // code -> { reward, uses, maxUses, usedBy: [], exp }
  config: {
    expRate: 1, dropRate: 1, goldRate: 1,
    motd: 'Chào mừng đến với Võ Lâm Pixel! Chúc các đại hiệp hành tẩu giang hồ vui vẻ.',
    maintenance: false,
    vipDropBase: 0.004,
    autoEvents: true
  },
  logs: [],           // nhật ký quản trị / hệ thống
  stats: { created: Date.now(), peakOnline: 0 }
});

const LOG_MAX = 500;
const CHAT_LOG_MAX = 300;
// nhật ký chat chỉ giữ trong RAM, không lưu xuống DB
const chatLogs = [];

let data = defaults();
let dirty = false;
let initialized = false;

// ---------- Cơ sở dữ liệu Postgres (tùy chọn, dùng khi có DATABASE_URL) ----------
// Mỗi người chơi là 1 dòng 'u:<id>', các phần còn lại 's:<tên>'. Chỉ ghi các dòng thay đổi.
const DATABASE_URL = process.env.DATABASE_URL || '';
let pool = null;
const lastSaved = new Map();
let saving = null;

function parseLoaded(raw) {
  const d = defaults();
  const out = Object.assign(d, raw);
  out.config = Object.assign(defaults().config, raw.config || {});
  delete out.chatLogs;
  if (out.logs.length > LOG_MAX) out.logs = out.logs.slice(-LOG_MAX);
  return out;
}

async function init(opts = {}) {
  if (initialized) return data;
  if (DATABASE_URL || opts.pool) {
    if (opts.pool) pool = opts.pool;
    else {
      const { Pool } = require('pg');
      const local = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
      pool = new Pool({ connectionString: DATABASE_URL, ssl: local ? false : { rejectUnauthorized: false }, max: 4 });
    }
    await pool.query('CREATE TABLE IF NOT EXISTS vl_store (k TEXT PRIMARY KEY, v JSONB NOT NULL, updated TIMESTAMPTZ DEFAULT now())');
    const { rows } = await pool.query('SELECT k, v FROM vl_store');
    const raw = { users: {} };
    for (const r of rows) {
      const v = typeof r.v === 'string' ? JSON.parse(r.v) : r.v;
      if (r.k.startsWith('u:')) raw.users[r.k.slice(2)] = v;
      else if (r.k.startsWith('s:')) raw[r.k.slice(2)] = v;
      lastSaved.set(r.k, JSON.stringify(v));
    }
    data = parseLoaded(raw);
    console.log(`[db] Postgres: đã tải ${Object.keys(data.users).length} tài khoản`);
  } else {
    loadFile();
  }
  initialized = true;
  return data;
}

function rowsOf() {
  const m = new Map();
  for (const [id, u] of Object.entries(data.users)) m.set('u:' + id, JSON.stringify(u));
  for (const k of Object.keys(data)) if (k !== 'users') m.set('s:' + k, JSON.stringify(data[k]));
  return m;
}

async function savePg() {
  const cur = rowsOf();
  const changed = [];
  for (const [k, v] of cur) if (lastSaved.get(k) !== v) changed.push([k, v]);
  const removed = [...lastSaved.keys()].filter(k => !cur.has(k));
  if (!changed.length && !removed.length) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < changed.length; i += 100) {
      const chunk = changed.slice(i, i + 100);
      const params = [], vals = [];
      chunk.forEach(([k, v], j) => { params.push(k, v); vals.push(`($${j * 2 + 1}, $${j * 2 + 2}::jsonb, now())`); });
      await client.query(`INSERT INTO vl_store (k, v, updated) VALUES ${vals.join(',')} ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated = now()`, params);
    }
    if (removed.length) await client.query('DELETE FROM vl_store WHERE k = ANY($1)', [removed]);
    await client.query('COMMIT');
    for (const [k, v] of changed) lastSaved.set(k, v);
    for (const k of removed) lastSaved.delete(k);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}

// ---------- File JSON (mặc định) ----------
function loadFile() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(FILE)) data = parseLoaded(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch (e) {
    console.error('[db] load failed, starting fresh:', e.message);
    data = defaults();
  }
}

function load() {
  if (!initialized) { loadFile(); initialized = true; }
  return data;
}

function save() {
  if (!dirty) return saving || Promise.resolve();
  if (pool) {
    if (saving) return saving;
    dirty = false;
    saving = savePg().catch(e => { dirty = true; console.error('[db] save failed:', e.message); }).finally(() => { saving = null; });
    return saving;
  }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, FILE);
    dirty = false;
  } catch (e) { console.error('[db] save failed:', e.message); }
  return Promise.resolve();
}

// Ghi toàn bộ thay đổi còn lại (dùng khi tắt máy chủ)
async function flush() {
  if (saving) await saving;
  dirty = true;
  await save();
}

function markDirty() { dirty = true; }

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, rec) {
  if (!rec) return false;
  const h = crypto.scryptSync(password, rec.salt, 64);
  const expected = Buffer.from(rec.hash, 'hex');
  return h.length === expected.length && crypto.timingSafeEqual(h, expected);
}

function log(type, text, extra) {
  data.logs.push({ t: Date.now(), type, text, ...(extra || {}) });
  if (data.logs.length > LOG_MAX) data.logs.splice(0, data.logs.length - LOG_MAX);
  dirty = true;
}

function pushChatLog(msg) {
  chatLogs.push(msg);
  if (chatLogs.length > CHAT_LOG_MAX) chatLogs.splice(0, chatLogs.length - CHAT_LOG_MAX);
}

const newId = () => crypto.randomBytes(8).toString('hex');
const newToken = () => crypto.randomBytes(24).toString('hex');

module.exports = {
  get data() { return data; }, chatLogs, pushChatLog,
  init, load, save, flush, markDirty, get usingDatabase() { return !!pool; }, hashPassword, verifyPassword, log, newId, newToken
};
