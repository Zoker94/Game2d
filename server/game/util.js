const { CLASSES } = require('../data/classes');
const { ITEMS } = require('../data/items');

const MAX_LEVEL = 99;
const INV_SIZE = 48;

const expNext = L => Math.round(50 * Math.pow(L, 1.8) + 50);
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
    expBuffUntil: 0, created: Date.now(), playTime: 0, power: 0,
    quickHp: 'hp1', quickMp: 'mp1'
  };
  addItem(c, 'weapon_0_common', 1);
  addItem(c, 'hp1', 5);
  addItem(c, 'mp1', 5);
  addItem(c, 'scroll_town', 1);
  return c;
}

function isStack(id) { const it = ITEMS[id]; return it && it.type !== 'equip'; }

function addItem(c, id, qty = 1, plus = 0) {
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
  for (let i = 0; i < qty; i++) c.inv.push({ uid: newUid(), id, qty: 1, plus });
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
function calcStats(c, buffs = [], guildLevel = 0) {
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
  for (const slot in c.equip) {
    const e = c.equip[slot];
    const it = e && ITEMS[e.id];
    if (!it) continue;
    const m = 1 + (e.plus || 0) * 0.12;
    for (const k in it.stats) {
      const v = it.stats[k] * (k === 'crit' || k === 'spd' ? 1 : m);
      if (k === 'hp') s.maxHp += v; else if (k === 'mp') s.maxMp += v; else s[k] += v;
    }
  }
  if (guildLevel > 0) { s.atk *= 1 + guildLevel * 0.02; s.def *= 1 + guildLevel * 0.02; s.maxHp *= 1 + guildLevel * 0.02; }
  for (const b of buffs) {
    if (b.atk) s.atk *= 1 + b.atk;
    if (b.def) s.def *= 1 + b.def;
    if (b.spd) s.spd *= 1 + b.spd;
    if (b.crit) s.crit += b.crit;
    if (b.regen) s.regen += b.regen;
  }
  s.spd = Math.min(s.spd, 260);
  s.crit = Math.min(s.crit, 75);
  for (const k of ['maxHp', 'maxMp', 'atk', 'def']) s[k] = Math.round(s[k]);
  s.crit = Math.round(s.crit * 10) / 10;
  s.power = Math.round(s.atk * 3 + s.def * 2 + s.maxHp / 4 + s.maxMp / 8 + s.crit * 12);
  return s;
}

module.exports = {
  MAX_LEVEL, INV_SIZE, expNext, vnDate, vnDay, vnMinuteOfDay, rand, randInt, dist, clamp, newUid,
  newCharacter, addItem, freeSlots, countItem, removeItemById, removeByUid, calcStats, isStack
};
