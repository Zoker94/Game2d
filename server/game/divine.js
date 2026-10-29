// Thần Binh & boss triệu hồi: gom 100 Mảnh Lệnh (rơi ở quái cấp 50+, tinh anh, boss) ghép thành Triệu Hồi Lệnh,
// dùng ở bãi luyện để gọi 1 trong 3 boss (500 triệu máu, toàn máy chủ được báo). Boss chết: người ra đòn kết liễu được
// nhặt đồ trước 8 giây; tỉ lệ thấp rơi 1 món Thần Binh đúng bộ của boss.
const U = require('./util');
const { MAPS, baseOf } = require('../data/maps');
const { ITEMS, DIVINE_SETS } = require('../data/items');
const { SUMMON_BOSSES } = require('../data/monsters');
const { GEM_KEYS, gemId } = require('../data/gems');

const FRAG_NEED = 100, STAY = 60 * 60000, OWN_MS = 8000, MAX_ALIVE = 3;
const PIECE_CHANCE = () => 0.03 + Math.random() * 0.02;   // tỉ lệ rơi 1 món Thần Binh mỗi lần hạ boss: 3–5%
const SET_KEYS = Object.keys(DIVINE_SETS);
const DV_SLOTS = ['helmet', 'armor', 'pants', 'boots', 'gloves'];
const bossOfSet = sk => Object.values(SUMMON_BOSSES).find(b => b.set === sk);

class Divine {
  constructor(world) { this.w = world; this.alive = new Map(); }   // id quái -> { mon, until }
  randFrag() { return `dv_frag_${SET_KEYS[Math.floor(Math.random() * SET_KEYS.length)]}`; }

  // ghép 50 mảnh -> 1 lệnh triệu hồi
  useFrag(p, uid, sk) {
    const c = p.c, have = U.countItem(c, `dv_frag_${sk}`);
    if (have < FRAG_NEED) return this.w.toast(p, `Cần ${FRAG_NEED} Mảnh ${DIVINE_SETS[sk].name} Lệnh để ghép (đang có ${have})`, 'error');
    if (U.freeSlots(c) < 1 && !c.inv.some(x => x.id === `dv_token_${sk}`)) return this.w.toast(p, 'Túi đồ đầy', 'error');
    U.removeItemById(c, `dv_frag_${sk}`, FRAG_NEED);
    this.w.giveItem(p, `dv_token_${sk}`, 1);
    this.w.toast(p, `🔥 Đã ghép ${DIVINE_SETS[sk].name} Triệu Hồi Lệnh! Dùng ở bãi luyện công để gọi Boss.`, 'reward');
    p.dirtyMe = true; this.w.db.markDirty();
  }
  // dùng lệnh triệu hồi
  summon(p, uid, sk) {
    const w = this.w, def = MAPS[p.mapId], tpl = bossOfSet(sk);
    if (!tpl) return;
    if (!def || def.safe || def.town || def.instance || def.duelArena || def.tourney || def.hoason || def.market || def.gemMine || p.mapId === 'tong_kim' || !(def.spawns || []).length)
      return w.toast(p, 'Chỉ triệu hồi được ở bãi luyện công có quái', 'error');
    if (p.dead) return;
    for (const a of this.alive.values()) if (!a.mon.dead && a.mon.mapId === p.mapId) return w.toast(p, 'Bản đồ này đang có Boss triệu hồi, hạ nó trước đã', 'error');
    if ([...this.alive.values()].filter(a => !a.mon.dead).length >= MAX_ALIVE) return w.toast(p, `Toàn máy chủ đang có ${MAX_ALIVE} Boss triệu hồi, chờ một con bị hạ rồi thử lại`, 'error');
    U.removeByUid(p.c, uid, 1);
    const pos = { x: p.x + 90, y: p.y };
    const mon = w.spawnMonster(p.mapId, tpl, { x: Math.floor(p.x / 48), y: Math.floor(p.y / 48), r: 2 }, { pos, noElite: true });
    mon.summoner = p.c.name;
    this.alive.set(mon.id, { mon, until: Date.now() + STAY });
    const where = MAPS[baseOf(p.mapId)].name + (def.chs > 1 || /#/.test(p.mapId) ? '' : '');
    w.features.announce(`⚔️ ${p.c.name} đã triệu hồi Boss ${tpl.name} (500 triệu sinh lực) tại ${where}! Ai ra đòn kết liễu sẽ được nhặt đồ trước – có cơ hội rơi Thần Binh!`);
    w.io.emit('notice', { text: `⚔️ ${p.c.name} triệu hồi Boss ${tpl.name} tại ${where}!`, type: 'boss' });
    w.fx(p.mapId, { t: 'levelup', id: mon.id, x: pos.x, y: pos.y });
    w.db.log('boss', `${p.c.name} triệu hồi ${tpl.name} tại ${p.mapId}`);
    p.dirtyMe = true; w.db.markDirty();
  }

  // boss triệu hồi chết: đồ rơi quanh xác, người kết liễu nhặt trước 8 giây
  onKill(mon, killer) {
    const w = this.w, tpl = mon.tpl, S = DIVINE_SETS[tpl.set];
    this.alive.delete(mon.id);
    const owner = killer && killer.c ? killer.userId : null, drops = [];
    let piece = null;
    if (Math.random() < PIECE_CHANCE() * (w.db.data.config.dropRate || 1)) { piece = `dv_${tpl.set}_${DV_SLOTS[Math.floor(Math.random() * DV_SLOTS.length)]}`; drops.push(piece); }
    for (let k = 0; k < 3; k++) drops.push('boss_chest');
    for (let k = 0, n = U.randInt(3, 5); k < n; k++) drops.push('stone2');
    for (let k = 0; k < 2; k++) drops.push(gemId(GEM_KEYS[Math.floor(Math.random() * GEM_KEYS.length)], Math.random() < 0.25 ? 4 : 3));
    for (let k = 0, n = U.randInt(5, 10); k < n; k++) drops.push(this.randFrag());
    if (Math.random() < 0.5) drops.push('mount_stone');
    drops.forEach((id, i) => {
      const a = (i / drops.length) * Math.PI * 2, rr = 40 + (i % 3) * 22;
      w.createDrop(mon.mapId, mon.x + Math.cos(a) * rr, mon.y + Math.sin(a) * rr * 0.7, id, 1, owner, 0, OWN_MS);
    });
    const kn = killer && killer.c ? killer.c.name : 'Ai đó';
    w.features.announce(`👑 ${kn} đã ra đòn kết liễu Boss ${tpl.name}!${piece ? ` 🔴 Thần Binh [${ITEMS[piece].name}] rơi ra – ${kn} được nhặt trước 8 giây!` : ''}`);
    if (piece) w.io.emit('notice', { text: `🔴 Boss ${tpl.name} rơi Thần Binh [${ITEMS[piece].name}]!`, type: 'boss' });
    w.db.log('boss', `${tpl.name} bị ${kn} hạ${piece ? ', rơi ' + piece : ''}`);
  }

  // mảnh lệnh rơi ở quái thường / tinh anh cấp 50+
  mobDrops(tpl, drops, r = Math.random) {
    if (tpl.lv < 50) return;
    if (r() < (tpl.elite ? 0.04 : 1 / 700)) drops.push(this.randFrag());
  }
  // boss dã ngoại / boss thế giới: mảnh cho người góp nhiều sát thương
  bossFrags(mon, ranking) {
    const tpl = mon.tpl;
    if (tpl.summon || tpl.lv < 40) return;
    ranking.slice(0, tpl.world ? 10 : 3).forEach(([uid], i) => {
      const p = this.w.players.get(uid);
      if (!p) return;
      const n = tpl.world ? (i === 0 ? 15 : i < 3 ? 10 : 5) : (i === 0 ? 6 : 3);
      const sk = SET_KEYS[Math.floor(Math.random() * SET_KEYS.length)];
      this.w.giveReward(p, { items: [[`dv_frag_${sk}`, n]] }, `Boss ${tpl.name}`);
    });
  }

  tick(now) {
    for (const [id, a] of this.alive) {
      if (a.mon.dead) { this.alive.delete(id); continue; }
      if (now < a.until) continue;
      const m = this.w.maps[a.mon.mapId];
      if (m) m.monsters.delete(id);
      this.alive.delete(id);
      this.w.features.announce(`💨 Boss ${a.mon.tpl.name} do ${a.mon.summoner} triệu hồi đã biến mất sau 60 phút.`);
    }
  }
}
module.exports = { Divine, FRAG_NEED };
