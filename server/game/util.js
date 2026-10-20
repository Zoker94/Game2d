const { CLASSES } = require('../data/classes');
const { scaleSkill } = require('../data/skillbooks');
const { ITEMS } = require('../data/items');
const { mountStats } = require('../data/mounts');
const { rollAffixes, elementBonus, CAP } = require('../data/affixes');
const { ATTRS } = require('../data/attrs');

// Hệ số chỉ số theo cấp cường hóa: +1..+10 mỗi cấp 12%, +11..+15 mỗi cấp 25%
const plusMult = plus => 1 + Math.min(plus, 10) * 0.12 + Math.max(0, plus - 10) * 0.25;

const MAX_LEVEL = 99;
const INV_SIZE = 48;

const expNext = L => Math.round((50 * Math.pow(L, 1.8) + 50) * (1 + L / 60));   // cấp cao cày lâu hơn
const vnDate = () => new Date(Date.now() + 7 * 3600e3);
const vnDay = () => vnDate().toISOString().slice(0, 10);
const vnMinuteOfDay = () => { const d = vnDate(); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let uidSeq = Date.now() % 1e9;
const newUid = () => (++uidSeq).toString(36);

function newCharacter(name, cls) {
  const cl = CLASSES[cls];
  const c = {
    name, cls, level: 1, exp: 0, gold: 100, knb: 0,
    hp: cl.base.hp, mp: cl.base.mp,
    map: 'tuong_duong', x: 0, y: 0,
    inv: [], equip: {},
    kills: 0, pvpKills: 0, bossKills: 0, deaths: 0,
    guildId: null,
    tutorial: { step: 0, progress: 0, done: false },
    daily: { date: null, list: [], bonusClaimed: false },
    checkin: { date: null, streak: 0 },
    wheel: { date: null, used: 0, extra: 0 },
    expBuffUntil: 0, created: Date.now(), playTime: 0, power: 0, mounts: {}, mount: null, riding: false,
    skills: {}, hotbar: [1, 2, 3, 4, 5, 6, 7, 0], spSpent: 0,
    quickHp: 'hp1', quickMp: 'mp1'
  };
  addItem(c, 'weapon_0_common', 1);
  addItem(c, 'hp1', 5);
  addItem(c, 'mp1', 5);
  addItem(c, 'scroll_town', 1);
  return c;
}

function isStack(id) { const it = ITEMS[id]; return it && it.type !== 'equip'; }

// binh khí chung -> vũ khí môn phái của nhân vật
function resolveItem(c, id) {
  const it = ITEMS[id];
  if (it && it.generic && c && c.cls && ITEMS[id + '_' + c.cls]) return id + '_' + c.cls;
  return id;
}
// gieo hệ ngũ hành / hiệu ứng cho đồ cũ chưa có, đổi binh khí chung sang vũ khí môn phái
function migrateItems(c) {
  const fix = s => {
    if (!s) return;
    const nid = resolveItem(c, s.id);
    if (nid !== s.id) s.id = nid;
    const it = ITEMS[s.id];
    if (it && it.type === 'equip' && !s.el) Object.assign(s, rollAffixes(it));
  };
  (c.inv || []).forEach(fix);
  Object.values(c.equip || {}).forEach(fix);
}

function addItem(c, id, qty = 1, plus = 0, extra = null) {
  id = resolveItem(c, id);
  const it = ITEMS[id];
  if (!it || qty <= 0) return false;
  if (isStack(id)) {
    const s = c.inv.find(x => x.id === id);
    if (s) { s.qty += qty; return true; }
    if (c.inv.length >= INV_SIZE) return false;
    c.inv.push({ uid: newUid(), id, qty });
    return true;
  }
  if (c.inv.length + qty > INV_SIZE) return false;
  for (let i = 0; i < qty; i++) c.inv.push(Object.assign({ uid: newUid(), id, qty: 1, plus }, extra || rollAffixes(it)));
  return true;
}
function freeSlots(c) { return INV_SIZE - c.inv.length; }
function countItem(c, id) { return c.inv.filter(x => x.id === id).reduce((s, x) => s + x.qty, 0); }
function removeItemById(c, id, qty) {
  if (countItem(c, id) < qty) return false;
  for (let i = c.inv.length - 1; i >= 0 && qty > 0; i--) {
    const s = c.inv[i];
    if (s.id !== id) continue;
    const take = Math.min(qty, s.qty);
    s.qty -= take; qty -= take;
    if (s.qty <= 0) c.inv.splice(i, 1);
  }
  return true;
}
function removeByUid(c, uid, qty = 1) {
  const i = c.inv.findIndex(x => x.uid === uid);
  if (i < 0 || c.inv[i].qty < qty) return null;
  const s = c.inv[i];
  s.qty -= qty;
  if (s.qty <= 0) c.inv.splice(i, 1);
  return s;
}

// Tính chỉ số nhân vật từ cấp, trang bị, bang hội và buff
function calcStats(c, buffs = [], guildLevel = 0, riding = false) {
  const cl = CLASSES[c.cls];
  const L = c.level - 1;
  const s = {
    maxHp: cl.base.hp + cl.growth.hp * L,
    maxMp: cl.base.mp + cl.growth.mp * L,
    atk: cl.base.atk + cl.growth.atk * L,
    def: cl.base.def + cl.growth.def * L,
    crit: cl.base.crit + cl.growth.crit * L,
    spd: cl.base.spd,
    regen: 0
  };
  const fx = {}, elCount = {};
  // điểm tiềm năng
  for (const k in ATTRS) {
    const n = (c.attr && c.attr[k]) | 0;
    if (!n) continue;
    for (const [sk, v] of Object.entries(ATTRS[k].per)) {
      if (sk === 'hp') s.maxHp += v * n; else if (sk === 'mp') s.maxMp += v * n;
      else if (sk === 'dodge') fx.dodge = (fx.dodge || 0) + v * n; else s[sk] += v * n;
    }
  }
  const addStat = (k, v) => { if (k === 'hp') s.maxHp += v; else if (k === 'mp') s.maxMp += v; else s[k] += v; };
  for (const slot in c.equip) {
    const e = c.equip[slot];
    const it = e && ITEMS[e.id];
    if (!it) continue;
    const m = plusMult(e.plus || 0);
    for (const k in it.stats) addStat(k, it.stats[k] * (k === 'crit' || k === 'spd' ? 1 : m));
    // ngũ hành: mỗi món cộng chỉ số theo hệ
    if (e.el) { elCount[e.el] = (elCount[e.el] || 0) + 1; const eb = elementBonus(e.el, it.tier); for (const k in eb) addStat(k, eb[k]); }
    for (const [k, v] of e.fx || []) fx[k] = (fx[k] || 0) + v;
  }
  // bộ ngũ hành: 3 món cùng hệ +6%, 5 món +12% chỉ số chính của hệ đó
  let setEl = null, setN = 0;
  for (const k in elCount) if (elCount[k] > setN) { setN = elCount[k]; setEl = k; }
  if (setN >= 3) {
    const bonus = setN >= 5 ? 0.12 : 0.06;
    if (setEl === 'kim') s.atk *= 1 + bonus; else if (setEl === 'moc') s.maxHp *= 1 + bonus;
    else if (setEl === 'thuy') { s.maxMp *= 1 + bonus; s.def *= 1 + bonus / 2; } else if (setEl === 'hoa') s.crit += bonus * 50; else if (setEl === 'tho') s.def *= 1 + bonus;
  }
  for (const k in fx) fx[k] = Math.round(Math.min(CAP[k] || 100, fx[k]) * 10) / 10;
  s.fx = fx; s.set = setN >= 3 ? { el: setEl, n: setN } : null;
  s.el = c.equip.weapon && c.equip.weapon.el || null;      // hệ tấn công
  s.del = c.equip.armor && c.equip.armor.el || null;       // hệ phòng thủ
  if (fx.regen) s.regen += fx.regen / 100;
  if (c.mount && c.mounts && c.mounts[c.mount]) {
    const ms = mountStats(c.mount, c.mounts[c.mount].lv);
    for (const k in ms) {
      if (k === 'speed') { if (riding) s.spd *= 1 + ms.speed; }
      else if (k === 'hp') s.maxHp += ms.hp; else if (k === 'mp') s.maxMp += ms.mp; else s[k] += ms[k];
    }
  }
  if (guildLevel > 0) { s.atk *= 1 + guildLevel * 0.02; s.def *= 1 + guildLevel * 0.02; s.maxHp *= 1 + guildLevel * 0.02; }
  // nội công bị động (đã học thì luôn có hiệu lực, mạnh dần theo tầng)
  const ps = cl.extra && cl.extra[1];
  const FXK = ['dodge', 'dmgred', 'lifesteal', 'reflect', 'critdmg', 'ccres'];
  if (ps && c.skills && c.skills[ps.id]) {
    const pv = scaleSkill(ps, c.skills[ps.id]).passive;
    if (pv.hp) s.maxHp *= 1 + pv.hp; if (pv.mp) s.maxMp *= 1 + pv.mp; if (pv.atk) s.atk *= 1 + pv.atk; if (pv.def) s.def *= 1 + pv.def;
    if (pv.spd) s.spd *= 1 + pv.spd; if (pv.crit) s.crit += pv.crit; if (pv.regen) s.regen += pv.regen;
    for (const k of FXK) if (pv[k]) fx[k] = Math.min(CAP[k] || 100, (fx[k] || 0) + pv[k]);
  }
  for (const b of buffs) {
    if (b.hp) s.maxHp *= 1 + b.hp;
    for (const k of FXK) if (b[k]) fx[k] = Math.min(CAP[k] || 100, (fx[k] || 0) + b[k]);
    if (b.atk) s.atk *= 1 + b.atk;
    if (b.def) s.def *= 1 + b.def;
    if (b.spd) s.spd *= 1 + b.spd;
    if (b.crit) s.crit += b.crit;
    if (b.regen) s.regen += b.regen;
  }
  // cấp bậc môn phái: +2% công / thủ / sinh lực mỗi bậc
  const sr = require('../data/sect').sectRank(c);
  if (sr) { s.atk *= 1 + sr * 0.02; s.def *= 1 + sr * 0.02; s.maxHp *= 1 + sr * 0.02; }
  // Võ Mục Di Thư: mỗi lần nghiền ngẫm +3% công / thủ / sinh lực (tối đa 5 lần)
  const vm = Math.min(5, c.vmb | 0);
  if (vm) { s.atk *= 1 + vm * 0.03; s.def *= 1 + vm * 0.03; s.maxHp *= 1 + vm * 0.03; }
  s.spd = Math.min(s.spd, 320);
  s.crit = Math.min(s.crit, 75);
  for (const k of ['maxHp', 'maxMp', 'atk', 'def']) s[k] = Math.round(s[k]);
  s.crit = Math.round(s.crit * 10) / 10;
  s.power = Math.round(s.atk * 3 + s.def * 2 + s.maxHp / 4 + s.maxMp / 8 + s.crit * 12);
  return s;
}

module.exports = {
  MAX_LEVEL, INV_SIZE, expNext, vnDate, vnDay, vnMinuteOfDay, rand, randInt, dist, clamp, newUid,
  plusMult, newCharacter, addItem, resolveItem, migrateItems, freeSlots, countItem, removeItemById, removeByUid, calcStats, isStack
};
