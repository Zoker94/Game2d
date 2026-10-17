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
  chatLogs: [],
  stats: { created: Date.now(), peakOnline: 0 }
});

let data = defaults();
let dirty = false;

function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      const d = defaults();
      data = Object.assign(d, raw);
      data.config = Object.assign(d.config, raw.config || {});
    }
  } catch (e) {
    console.error('[db] load failed, starting fresh:', e.message);
    data = defaults();
  }
  return data;
}

function save() {
  if (!dirty) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, FILE);
    dirty = false;
  } catch (e) { console.error('[db] save failed:', e.message); }
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
  if (data.logs.length > 2000) data.logs.splice(0, data.logs.length - 2000);
  dirty = true;
}

const newId = () => crypto.randomBytes(8).toString('hex');
const newToken = () => crypto.randomBytes(24).toString('hex');

module.exports = {
  get data() { return data; },
  load, save, markDirty, hashPassword, verifyPassword, log, newId, newToken
};
