// Phó bản: bản đồ riêng cho từng tổ đội (hoặc một mình). 3 đợt quái rồi boss, có giới hạn thời gian và số lượt mỗi ngày.
// Đi tổ đội dễ hơn: quái chỉ mạnh lên 35% máu cho mỗi người thêm, trong khi mỗi người được buff
// "Đồng Tâm Hiệp Lực" +8% công / thủ cho mỗi đồng đội (tối đa +40%) và thưởng kinh nghiệm +10% mỗi người.
const { MAPS, TILE, generateInstance } = require('../data/maps');
const { MONSTERS } = require('../data/monsters');
const { equipId, tierOfLv, DROP_SLOTS } = require('../data/items');
const U = require('./util');

const DUNGEONS = {
  hac_phong: {
    name: 'Hắc Phong Sơn Trại', minLv: 15, maxLv: 34, lv: '15-34', rLv: 22, theme: 'ruins', w: 46, h: 24, seed: 501, time: 15 * 60000, daily: 3, party: '1-3 người',
    desc: 'Sơn trại thổ phỉ hoành hành quanh Tương Dương. Quét sạch lâu la, hạ Trại Chủ để đoạt kho báu.',
    waves: [[['pb1_lau_la', 8]], [['pb1_lau_la', 6], ['pb1_dao_thu', 5]], [['pb1_dao_thu', 6], ['pb1_ho_phap', 2]]], boss: 'pb1_boss', knb: 5
  },
  co_mo: {
    name: 'Cổ Mộ Huyền Cung', minLv: 35, maxLv: 59, lv: '35-59', rLv: 42, theme: 'tomb', w: 46, h: 24, seed: 503, time: 18 * 60000, daily: 3, party: '2-4 người',
    desc: 'Huyền Cung dưới lòng đất đầy thi binh và oán hồn canh giữ. Kẻ phá được Thi Vương sẽ nhận bảo vật mộ thất.',
    waves: [[['pb2_thi_binh', 9]], [['pb2_thi_binh', 6], ['pb2_oan_hon', 6]], [['pb2_oan_hon', 6], ['pb2_mo_tuong', 3]]], boss: 'pb2_boss', knb: 10
  },
  ma_cung: {
    name: 'Huyết Ma Cung', minLv: 60, maxLv: 84, lv: '60-84', rLv: 68, theme: 'demon', w: 46, h: 24, seed: 507, time: 20 * 60000, daily: 2, party: '3-6 người',
    desc: 'Sào huyệt của Huyết Ma Giáo. Thần lang, hộ pháp và Huyết Ma Cung Chủ – chỉ tổ đội mạnh mới mong toàn mạng trở ra.',
    waves: [[['pb3_ma_ve', 9]], [['pb3_ma_ve', 6], ['pb3_ma_lang', 7]], [['pb3_ma_lang', 6], ['pb3_ho_phap', 3]]], boss: 'pb3_boss', knb: 20
  },
  thien_cung: {
    name: 'Thiên Cung Bí Cảnh', minLv: 85, maxLv: 104, lv: '85-104', rLv: 95, theme: 'snow', w: 48, h: 24, seed: 509, time: 22 * 60000, daily: 2, party: '3-6 người',
    desc: 'Cõi tiên trên mây, thần binh và thần thú canh giữ Kiếm Đế. Chỉ những cao thủ đã vượt Huyết Ma Cung mới được bước vào.',
    waves: [[['pb4_than_binh', 9]], [['pb4_than_binh', 6], ['pb4_tien_nu', 6]], [['pb4_tien_nu', 6], ['pb4_than_thu', 3]]], boss: 'pb4_boss', knb: 30
  },
  luyen_nguc: {
    name: 'Cửu U Luyện Ngục', minLv: 105, maxLv: 120, lv: '105-120', rLv: 113, theme: 'demon', w: 48, h: 24, seed: 511, time: 25 * 60000, daily: 2, party: '4-6 người',
    desc: 'Tầng sâu nhất của Cửu U. Ma lang, quỷ tướng, ma hồn và Luyện Ngục Vương – thử thách tối thượng của võ lâm.',
    waves: [[['pb5_ma_lang', 10]], [['pb5_ma_lang', 6], ['pb5_quy_tuong', 6]], [['pb5_quy_tuong', 6], ['pb5_ma_hon', 3]]], boss: 'pb5_boss', knb: 45
  }
};
for (const id in DUNGEONS) {
  const d = DUNGEONS[id];
  d.id = id;
  for (const w of d.waves) for (const [m] of w) if (!MONSTERS[m]) throw new Error('Thiếu quái phó bản ' + m);
  if (!MONSTERS[d.boss]) throw new Error('Thiếu boss phó bản ' + d.boss);
  d.exp = Math.round(U.expNext(d.rLv) * 0.25);
  d.gold = d.rLv * d.rLv * 8;
}
const BUFF_ID = 'pb_dongtam';
const VM_RATE = { hac_phong: 0.12, co_mo: 0.16, ma_cung: 0.2, thien_cung: 0.24, luyen_nguc: 0.28 };
const CLOSE_MS = 60000;   // vượt ải xong: 60 giây để nhặt đồ rồi tự đưa ra

let seq = 1;

class Dungeon {
  constructor(world) {
    this.w = world;
    this.inst = new Map();   // mapId -> phiên phó bản
  }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }
  entries(p, did) {
    const day = U.vnDay(), c = p.c;
    if (!c.pb || c.pb.d !== day) c.pb = { d: day, n: {} };
    return DUNGEONS[did].daily - (c.pb.n[did] || 0);
  }
  of(p) { return this.inst.get(p.mapId) || null; }

  // ---------- bảng NPC ----------
  view(p) {
    const pt = this.w.party && this.w.party.of(p);
    return {
      list: Object.values(DUNGEONS).map(d => ({ id: d.id, name: d.name, minLv: d.minLv, maxLv: d.maxLv, lv: d.lv, party: d.party, desc: d.desc, left: this.entries(p, d.id), daily: d.daily,
        min: Math.round(d.time / 60000), exp: d.exp, gold: d.gold, knb: d.knb })),
      party: pt ? { n: pt.members.length, leader: pt.leader === p.userId } : null
    };
  }
  action(p, d) {
    if (!d) return;
    if (d.op === 'list') { if (!this.w.nearNpc(p, 'pho_ban')) return; return p.socket.emit('dungeonList', this.view(p)); }
    if (d.op === 'enter') return this.open(p, d.id);
    if (d.op === 'leave') return this.leave(p);
  }

  // ---------- vào phó bản ----------
  open(p, did) {
    const def = DUNGEONS[did];
    if (!def) return;
    if (!this.w.nearNpc(p, 'pho_ban')) return this.toast(p, 'Hãy đến gặp Phó Bản Sứ Giả', 'error');
    if (this.of(p)) return;
    if (p.c.level < def.minLv) return this.toast(p, `Cần đạt cấp ${def.minLv}`, 'error');
    if (p.c.level > def.maxLv) return this.toast(p, `Cấp ${p.c.level} đã quá cao cho ${def.name} (cấp ${def.lv}) – hãy vào phó bản cấp cao hơn`, 'error');
    if (this.entries(p, did) <= 0) return this.toast(p, `Hôm nay bạn đã hết lượt ${def.name}`, 'error');
    const pt = this.w.party && this.w.party.of(p);
    if (pt && pt.leader !== p.userId) return this.toast(p, 'Chỉ đội trưởng mới mở được phó bản cho cả đội', 'error');
    // đồng đội cùng bản đồ, đủ cấp, còn lượt thì vào cùng
    const members = [p];
    if (pt) for (const uid of pt.members) {
      const q = this.w.players.get(uid);
      if (!q || q === p) continue;
      if (q.mapId !== p.mapId || q.dead) { this.toast(p, `${q.c.name} không ở cùng bản đồ nên không vào cùng`, 'error'); continue; }
      if (q.c.level < def.minLv) { this.toast(p, `${q.c.name} chưa đủ cấp ${def.minLv}`, 'error'); continue; }
      if (q.c.level > def.maxLv) { this.toast(p, `${q.c.name} cấp quá cao cho phó bản này (tối đa ${def.maxLv})`, 'error'); continue; }
      if (this.entries(q, did) <= 0) { this.toast(p, `${q.c.name} đã hết lượt hôm nay`, 'error'); continue; }
      members.push(q);
    }
    const home = MAPS[p.mapId].town ? p.mapId : this.w.homeOf(p);
    const mapId = `pb_${did}_${seq++}`;
    const map = generateInstance(mapId, { name: def.name, theme: def.theme, w: def.w, h: def.h, seed: def.seed, lv: def.lv, tier: Math.min(8, Math.floor(def.rLv / 10)), home });
    MAPS[mapId] = map;
    this.w.maps[mapId] = { def: map, players: new Set(), monsters: new Map(), drops: new Map() };
    // điểm vào ở mép trái, các đợt quái tiến dần sang phải, boss ở cuối
    const cy = map.center.y;
    const near = (fx) => {
      const tx = Math.round(map.w * fx), ty = cy + Math.round(Math.sin(tx / 5) * 2);   // giữa hành lang
      let best = null, bd = 1e9;
      for (const i of map.walkable) { const x = i % map.w, y = (i / map.w) | 0, dd = Math.abs(x - tx) * 1 + Math.abs(y - ty) * 1.5; if (dd < bd) { bd = dd; best = { x, y }; } }
      return best || map.center;
    };
    const n = members.length;
    const I = {
      id: mapId, def, map, n, stage: 0, left: 0, total: 0, start: near(0.06), spots: [near(0.3), near(0.5), near(0.68), near(0.88)],
      startAt: Date.now(), endAt: Date.now() + def.time, done: false, fail: false, closeAt: 0, members: new Set(members.map(q => q.userId)),
      hpMul: 1 + 0.35 * (n - 1), buff: Math.min(0.4, 0.08 * (n - 1))
    };
    this.inst.set(mapId, I);
    for (const q of members) {
      q.c.pb.n[did] = (q.c.pb.n[did] || 0) + 1;
      q.c.pbReturn = home;
      if (q.recall) this.w.cancelRecall(q);
      const pos = this.w.randomSpotNear(map, I.start.x + 0.5, I.start.y + 0.5, 1);
      this.w.enterMap(q, mapId, pos.x, pos.y);
      if (I.buff > 0) {
        q.buffs = q.buffs.filter(b => b.id !== BUFF_ID);
        q.buffs.push({ id: BUFF_ID, name: `Đồng Tâm Hiệp Lực +${Math.round(I.buff * 100)}%`, until: I.endAt + CLOSE_MS, aura: 'ring', color: '#9effb0', atk: I.buff, def: I.buff });
        this.w.recalc(q);
      }
      this.toast(q, `⚔️ Vào phó bản ${def.name}${n > 1 ? ` cùng ${n - 1} đồng đội – Đồng Tâm Hiệp Lực +${Math.round(I.buff * 100)}% công/thủ` : ''}`, 'reward');
    }
    this.w.db.markDirty();
    this.spawnStage(I);
  }
  spawnStage(I) {
    const def = I.def, boss = I.stage >= def.waves.length;
    const list = boss ? [[def.boss, 1]] : def.waves[I.stage];
    const sp = I.spots[Math.min(I.stage, 3)];
    I.left = 0;
    for (const [mid, cnt] of list) {
      for (let k = 0; k < cnt; k++) {
        const pos = this.w.randomSpotNear(I.map, sp.x + 0.5, sp.y + 0.5, boss ? 1 : 3);
        const mon = this.w.spawnMonster(I.id, MONSTERS[mid], { x: sp.x, y: sp.y, r: boss ? 2 : 4 }, { pos, noElite: true });
        mon.inst = I.id;
        mon.maxHp = mon.hp = Math.round(mon.tpl.hp * I.hpMul);
        I.left++;
      }
    }
    I.total = I.left;
    if (boss) this.say(I, `👹 ${MONSTERS[def.boss].name} xuất hiện!`, 'error');
    else if (I.stage > 0) this.say(I, `⚔️ Đợt ${I.stage + 1}/${def.waves.length} kéo tới!`);
    this.sync(I);
  }
  say(I, text, k) { for (const q of this.w.maps[I.id].players) this.toast(q, text, k || 'info'); }

  onKill(mon) {
    const I = this.inst.get(mon.inst);
    if (!I || I.done || I.fail) return;
    I.left = Math.max(0, I.left - 1);
    if (I.left > 0) return this.sync(I);
    if (I.stage >= I.def.waves.length) return this.complete(I);
    I.stage++;
    setTimeout(() => { if (this.inst.get(I.id) === I && !I.fail) this.spawnStage(I); }, 2500);
    this.sync(I);
  }
  complete(I) {
    I.done = true; I.closeAt = Date.now() + CLOSE_MS;
    const def = I.def, players = [...this.w.maps[I.id].players], n = players.length;
    const tier = tierOfLv(def.rLv), mult = 1 + 0.1 * Math.max(0, n - 1);
    const fast = Date.now() - I.startAt < def.time * 0.5;   // vượt nhanh hơn nửa thời gian: thưởng thêm
    for (const q of players) {
      const r = Math.random(), rar = r < 0.02 ? 'legendary' : r < 0.35 ? 'epic' : 'rare';
      const items = [[equipId(DROP_SLOTS[U.randInt(0, DROP_SLOTS.length - 1)], tier, rar), 1], ['boss_chest', 1], ['stone', 3 + (fast ? 2 : 0)]];
      if (Math.random() < 0.35) items.push(['stone2', 1]);
      if (Math.random() < 0.2) items.push(['mount_stone', 1]);
      if (fast) items.push(['lucky_chest', 1]);
      // Boss phó bản: có tỉ lệ rơi 1 Võ Mục Tàn Quyển ngẫu nhiên 1-7 (phó bản càng cao tỉ lệ càng cao: 12% → 28%, thần tốc +5%);
      // quyển Thất (Truyền Kỳ) hiếm gấp 3 lần quyển khác
      if (Math.random() < VM_RATE[def.id] + (fast ? 0.05 : 0)) {
        let k = Math.random() * 19, i = 0;
        while (i < 6 && (k -= 3) >= 0) i++;
        items.push(['vm_tq' + (i + 1), 1]);
        if (i === 6) this.w.features.brag(`📜 ${q.c.name} nhận được Võ Mục Tàn Quyển · Thất từ ${MONSTERS[def.boss].name}!`);
      }
      if (this.w.sect) this.w.sect.onDungeon(q);
      this.w.giveReward(q, { exp: Math.round(def.exp * mult), gold: Math.round(def.gold * mult), knb: def.knb, items }, `🏆 Vượt ${def.name}${fast ? ' (thần tốc)' : ''}`);
    }
    this.w.features.announce(`🏆 ${players.map(q => q.c.name).join(', ')} đã vượt phó bản ${def.name}!`);
    this.sync(I);
  }
  sync(I) {
    const goal = I.done || I.fail ? null : I.spots[Math.min(I.stage, 3)];
    const v = {
      id: I.def.id, name: I.def.name, stage: I.stage, stages: I.def.waves.length + 1, left: I.left, total: I.total, endAt: I.endAt, now: Date.now(),
      done: I.done, fail: I.fail, closeAt: I.closeAt, buff: I.buff, n: I.n, goal: goal && { x: (goal.x + 0.5) * TILE, y: (goal.y + 0.5) * TILE },
      boss: I.stage >= I.def.waves.length ? MONSTERS[I.def.boss].name : null
    };
    for (const q of this.w.maps[I.id].players) q.socket.emit('dungeon', v);
  }

  // ---------- rời / chết / thoát game ----------
  leave(p, viaRecall) {
    const I = this.of(p);
    if (!I) return;
    const home = MAPS[I.map.home] ? I.map.home : 'tuong_duong';
    this.w.teleport(p, home);   // enterMap gọi onExit
    if (!viaRecall) this.toast(p, `Đã rời ${I.def.name}`);
  }
  onExit(p, fromMapId) {   // gọi khi người chơi rời bản đồ phó bản bằng bất kỳ cách nào
    if (!this.inst.has(fromMapId)) return;
    p.buffs = p.buffs.filter(b => b.id !== BUFF_ID); this.w.recalc(p);
    p.c.pbReturn = null;
    p.socket.emit('dungeon', null);
  }
  onRespawn(p) {
    const I = this.of(p);
    if (!I) return false;
    p.c.hp = Math.round(p.stats.maxHp * 0.5); p.c.mp = Math.round(p.stats.maxMp * 0.5);
    p.weakUntil = 0; p.dodgeUntil = Date.now() + 3000;
    p.socket.emit('revived', { here: false });
    const pos = this.w.randomSpotNear(I.map, I.start.x + 0.5, I.start.y + 0.5, 1);
    p.x = pos.x; p.y = pos.y; p.socket.emit('pos', { x: p.x, y: p.y });
    this.toast(p, 'Bạn đứng dậy ở điểm vào phó bản (50% máu)');
    p.dirtyMe = true;
    return true;
  }
  onQuit(p) { p.buffs = p.buffs.filter(b => b.id !== BUFF_ID); }

  tick(now) {
    for (const I of this.inst.values()) {
      const m = this.w.maps[I.id];
      if (!m) { this.inst.delete(I.id); continue; }
      if (!I.done && !I.fail && now > I.endAt) {
        I.fail = true; I.closeAt = now + 8000;
        this.say(I, `⌛ Hết giờ! Vượt ${I.def.name} thất bại.`, 'error');
        this.sync(I);
      }
      if ((I.done || I.fail) && now > I.closeAt) for (const q of [...m.players]) this.leave(q, true);
      if (m.players.size === 0 && now - I.startAt > 5000) this.destroy(I);
    }
  }
  destroy(I) {
    this.inst.delete(I.id);
    delete this.w.maps[I.id];
    delete MAPS[I.id];
  }
}

module.exports = { Dungeon, DUNGEONS };
