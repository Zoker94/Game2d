// Nhiệm vụ môn phái: Trưởng Môn giao tối đa 10 nhiệm vụ mỗi ngày (diệt quái, diệt tinh anh, đưa thư, vượt phó bản).
// Xong việc quay về báo Trưởng Môn để nhận kinh nghiệm, ngân lượng và điểm cống hiến; mỗi nhiệm vụ thứ 10 thưởng thêm.
// Điểm cống hiến đổi đồ ở Hộ Pháp Môn Phái; tổng cống hiến quyết định cấp bậc (mỗi bậc +2% công / thủ / sinh lực).
// Hoạt động môn phái khác:
// - Tuần tra sơn môn (1 lần / ngày, nhận ở Trưởng Môn): đi qua 4 cột mốc canh gác trong bản đồ môn phái -> cống hiến + KN.
// - Tọa thiền truyền công: ngồi thiền cạnh Truyền Công Trưởng Lão ở phái mình, mỗi phút +1 cống hiến + KN (tối đa 30 / ngày).
// - Thủ Hộ Sơn Môn (19:30 hằng ngày, 12 phút; GM: /event thuHo): Ma Giáo đánh vào mọi môn phái theo từng đợt, phút 8 Ma Giáo
//   Hộ Pháp xuất hiện. Đệ tử bổn môn diệt địch ghi điểm; hạ Hộ Pháp là giữ được sơn môn – cả phái được thưởng thêm.
const { MAPS, MAP_DEFS } = require('../data/maps');
const { MONSTERS } = require('../data/monsters');
const { NPCS } = require('../data/npcs');
const { CLASSES } = require('../data/classes');
const { ITEMS } = require('../data/items');
const { SECT_MAP, SECT_RANKS, SECT_DAILY, SECT_SHOP, sectRank } = require('../data/sect');
const U = require('./util');

const PATROL_PTS = [[0.2, 0.3], [0.8, 0.3], [0.8, 0.78], [0.2, 0.78]];   // vị trí cột mốc tuần tra (tỉ lệ theo kích thước bản đồ)
const MED_MAX = 30, DEF_MIN = 12, DEF_BOSS_AT = 8, DEF_H = 19, DEF_M = 30;
const FIELD = [...new Set(Object.values(MAP_DEFS).flatMap(d => (d.spawns || []).map(s => s[0])))].filter(id => MONSTERS[id] && !MONSTERS[id].static);
const mapOfMon = id => Object.keys(MAP_DEFS).find(k => (MAP_DEFS[k].spawns || []).some(s => s[0] === id));
// nơi đưa thư: thành chủ các thành (theo cấp) hoặc trưởng môn phái khác
const LETTERS = [
  { npc: 'truong_lao', map: 'tuong_duong', lv: 1 },
  { npc: 'thanh_chu_thanh_do', map: 'thanh_do', lv: 20 },
  { npc: 'thanh_chu_lan_chau', map: 'lan_chau', lv: 30 },
  { npc: 'thanh_chu_long_mon', map: 'long_mon', lv: 55 }
];

class Sect {
  constructor(world) { this.w = world; this.def = null; this._pp = {}; }
  // cột mốc tuần tra của một bản đồ môn phái (chỗ đi được gần vị trí đặt sẵn)
  patrolPts(mapId) {
    if (this._pp[mapId]) return this._pp[mapId];
    const m = MAPS[mapId], { TILE } = require('../data/maps'), set = new Set(m.walkable);
    const pts = PATROL_PTS.map(([fx, fy]) => {
      const tx = Math.floor(m.w * fx), ty = Math.floor(m.h * fy); let best = null, bd = 1e9;
      for (const i of set) { const x = i % m.w, y = (i / m.w) | 0, d = (x - tx) ** 2 + (y - ty) ** 2; if (d < bd) { bd = d; best = [x, y]; } }
      return [(best[0] + 0.5) * TILE, (best[1] + 0.5) * TILE];
    });
    return (this._pp[mapId] = pts);
  }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }
  data(p) {
    const c = p.c, day = U.vnDay();
    if (!c.sect) c.sect = { day, n: 0, cur: null, pts: 0, total: 0 };
    if (c.sect.day !== day) { c.sect.day = day; c.sect.n = 0; c.sect.patrol = null; c.sect.med = 0; }
    return c.sect;
  }
  // cộng cống hiến (tăng cả tổng để thăng cấp bậc)
  addPts(p, n, why) {
    const d = this.data(p), before = sectRank(p.c);
    d.pts += n; d.total += n; p.dirtyMe = true;
    const after = sectRank(p.c);
    if (after > before) { this.w.recalc(p); this.toast(p, `🎖️ Thăng cấp môn phái: ${SECT_RANKS[after][1]} (+${after * 2}% công / thủ / sinh lực)`, 'reward'); this.w.features.announce(`🎖️ ${p.c.name} được thăng làm ${SECT_RANKS[after][1]} của ${CLASSES[p.c.cls].name}!`); }
    if (why) this.toast(p, `🏮 ${why}: +${n} cống hiến`, 'reward');
  }
  inOwnSect(p) { return p.mapId === SECT_MAP[p.c.cls]; }

  // ---------- Tuần tra sơn môn ----------
  patrolStart(p) {
    const d = this.data(p);
    if (d.patrol) return this.toast(p, d.patrol.done ? 'Hôm nay đã tuần tra xong rồi' : 'Đang tuần tra – đi qua các cột mốc 🚩 trong sơn môn', 'error');
    if (p.c.level < 5) return this.toast(p, 'Cần cấp 5', 'error');
    d.patrol = { hit: [false, false, false, false], done: false };
    this.toast(p, '🚩 Nhận nhiệm vụ Tuần tra sơn môn: đi qua 4 cột mốc canh gác (cờ 🚩 trên bản đồ môn phái)', 'reward');
  }
  patrolHit(p, i) {
    const d = this.data(p), pt = d.patrol;
    if (!pt || pt.done || !this.inOwnSect(p) || !(i >= 0 && i < 4) || pt.hit[i]) return;
    const [x, y] = this.patrolPts(p.mapId)[i];
    if (Math.hypot(p.x - x, p.y - y) > 110) return;
    pt.hit[i] = true; p.dirtyMe = true;
    this.toast(p, `🚩 Đã kiểm tra cột mốc ${pt.hit.filter(Boolean).length}/4`, 'info');
    if (pt.hit.every(Boolean)) {
      pt.done = true;
      this.w.giveReward(p, { exp: Math.round(U.expNext(p.c.level) * 0.03 + 300), gold: p.c.level * 200 }, '🚩 Tuần tra sơn môn');
      this.addPts(p, 25, 'Tuần tra sơn môn');
    }
  }

  // ---------- Thủ Hộ Sơn Môn ----------
  onMinute(mod) {
    if (mod === DEF_H * 60 + DEF_M - 5) this.w.features.announce('🏯 5 phút nữa Ma Giáo sẽ tấn công các môn phái! Đệ tử mau về sơn môn (Xa Phu đưa về phái mình miễn phí) – sự kiện Thủ Hộ Sơn Môn.');
    if (mod >= DEF_H * 60 + DEF_M && mod < DEF_H * 60 + DEF_M + 5 && !this.def && this._defRan !== U.vnDay()) this.w.features.startEvent('thuHo', DEF_MIN - (mod - DEF_H * 60 - DEF_M));
  }
  defStart(minutes) {
    if (this.def) return false;
    this._defRan = U.vnDay();
    const now = Date.now();
    this.def = { until: now + minutes * 60000, start: now, bossAt: now + Math.min(DEF_BOSS_AT, Math.max(1, minutes - 3)) * 60000, wave: 0, nextWave: now, pts: {}, boss: {}, won: {} };
    this.w.features.announce(`🏯 THỦ HỘ SƠN MÔN! Ma Giáo đang đánh vào các môn phái trong ${minutes} phút. Đệ tử về bảo vệ sơn môn, diệt địch lấy cống hiến!`);
    return true;
  }
  // kẻ địch theo cấp đệ tử đang ở sơn môn (mượn hình Ma Giáo Binh / Thiên Ma Giáo Chủ)
  defTpl(lv, boss) {
    const { BOSSES } = require('../data/monsters');
    const base = boss ? BOSSES.boss_ma : MONSTERS.ma_binh;
    const k = boss ? 40 : 1;
    const hp = Math.round((40 + lv * 14 + lv * lv * 0.9) * k * (boss ? 1 : 1.4)), atk = Math.round((6 + lv * 3.6) * (boss ? 1.5 : 1)), def = Math.round(2 + lv * 1.8);
    return Object.assign({}, base, { lv, hp, atk, def, exp: Math.round((8 + lv * lv * 0.9) * (boss ? 10 : 1.2)), gold: 0, aggro: true, respawn: 999999, sectDef: true });
  }
  defWave(now) {
    const ev = this.def; ev.wave++;
    for (const cls in SECT_MAP) {
      const mid = SECT_MAP[cls], m = this.w.maps[mid];
      const mem = [...m.players].filter(p => p.c.cls === cls && !p.dead);
      if (!mem.length) continue;
      const lv = Math.round(mem.reduce((a, p) => a + p.c.level, 0) / mem.length), n = Math.min(12, 3 + mem.length * 2), d = m.def;
      const alive = [...m.monsters.values()].filter(x => x.event === 'sectdef' && !x.dead).length;
      for (let i = 0; i < n && alive + i < 30; i++) {
        const pos = this.w.randomSpotNear(d, d.w / 2 + U.rand(-10, 10), d.h - 6 + U.rand(-2, 2), 2);   // tràn vào từ cổng núi phía Nam
        const mon = this.w.spawnMonster(mid, this.defTpl(lv, false), { x: Math.floor(pos.x / 64), y: Math.floor(pos.y / 64), r: 6 }, { pos, event: 'sectdef' });
        mon.sectCls = cls;
      }
      if (!ev.bossUp && now >= ev.bossAt && !ev.boss[cls]) {
        const pos = this.w.randomSpotNear(d, d.w / 2, d.h / 2 + 4, 2);
        const b = this.w.spawnMonster(mid, this.defTpl(lv + 5, true), { x: Math.floor(pos.x / 64), y: Math.floor(pos.y / 64), r: 4 }, { pos, event: 'sectdef' });
        b.sectCls = cls; b.sectBoss = true; ev.boss[cls] = b;
        this.w.features.announce('👹 Ma Giáo Hộ Pháp đã xông vào sơn môn! Hạ hắn để giữ vững môn phái!', 'map:' + mid);
      }
    }
    if (now >= ev.bossAt) ev.bossUp = true;
  }
  onDefKill(mon, killer) {
    const ev = this.def; if (!ev || !killer || !killer.c) return;
    if (killer.c.cls !== mon.sectCls) return;
    ev.pts[killer.userId] = (ev.pts[killer.userId] || 0) + (mon.sectBoss ? 40 : 2);
    if (mon.sectBoss) {
      ev.won[mon.sectCls] = true;
      this.w.features.announce(`🏯 ${killer.c.name} hạ Ma Giáo Hộ Pháp – ${CLASSES[mon.sectCls].name} đã giữ vững sơn môn!`);
    }
  }
  defEnd() {
    const ev = this.def; if (!ev) return;
    this.def = null;
    for (const cls in SECT_MAP) { const m = this.w.maps[SECT_MAP[cls]]; for (const [id, x] of m.monsters) if (x.event === 'sectdef') m.monsters.delete(id); }
    for (const [uid, pts] of Object.entries(ev.pts)) {
      const p = this.w.players.get(uid); if (!p) continue;
      const won = ev.won[p.c.cls], cg = Math.min(150, Math.round(pts * 1.5)) + (won ? 50 : 0);
      if (pts < 4) continue;
      this.w.giveReward(p, { exp: Math.round(U.expNext(p.c.level) * Math.min(0.15, pts / 600)), items: won ? [['lucky_chest', 1]] : [] }, `🏯 Thủ Hộ Sơn Môn${won ? ' (giữ vững sơn môn)' : ''}`);
      this.addPts(p, cg, 'Thủ Hộ Sơn Môn');
    }
    const ok = Object.keys(ev.won).map(c => CLASSES[c].name);
    this.w.features.announce(`🏯 Thủ Hộ Sơn Môn kết thúc! ${ok.length ? 'Giữ vững sơn môn: ' + ok.join(', ') : 'Không môn phái nào hạ được Ma Giáo Hộ Pháp.'}`);
  }
  tick(now) {
    const ev = this.def;
    if (ev) {
      if (now >= ev.until) return this.w.features.stopEvent('thuHo');
      if (now >= ev.nextWave) { ev.nextWave = now + 60000; this.defWave(now); }
    }
    // tọa thiền truyền công: mỗi phút +1 cống hiến khi ngồi thiền cạnh Truyền Công Trưởng Lão ở phái mình
    if (now - (this._medT || 0) < 60000) return;
    this._medT = now;
    for (const p of this.w.players.values()) {
      if (!p.med || !this.inOwnSect(p) || !this.w.nearNpc(p, 'truyen_cong')) continue;
      const d = this.data(p);
      if ((d.med || 0) >= MED_MAX) continue;
      d.med = (d.med || 0) + 1;
      this.w.gainExp(p, Math.max(1, Math.round(U.expNext(p.c.level) * 0.004)), true);
      this.addPts(p, 1, d.med === MED_MAX ? `Tọa thiền truyền công (đủ ${MED_MAX} phút hôm nay)` : null);
    }
  }
  member(p, npcId) { const n = NPCS[npcId]; return n && n.sect === p.c.cls; }

  // ---------- giao nhiệm vụ ----------
  makeQuest(p) {
    const L = p.c.level, r = Math.random();
    if (L >= 15 && r < 0.12) return { type: 'dungeon', need: 1, have: 0, text: 'Vượt qua 1 phó bản bất kỳ (gặp Phó Bản Sứ Giả trong thành)' };
    if (L >= 12 && r < 0.3) return { type: 'elite', need: 1, have: 0, text: 'Hạ 1 quái ⭐ Tinh Anh ở bất kỳ bãi luyện công nào' };
    if (r < 0.5) {
      const opts = LETTERS.filter(x => L >= x.lv).map(x => ({ ...x, name: NPCS[x.npc].name, mapName: MAPS[x.map].name }));
      for (const cls in SECT_MAP) if (cls !== p.c.cls) opts.push({ npc: 'chuong_mon_' + cls, map: SECT_MAP[cls], name: NPCS['chuong_mon_' + cls].name, mapName: MAPS[SECT_MAP[cls]].name });
      const t = opts[U.randInt(0, opts.length - 1)];
      return { type: 'letter', need: 1, have: 0, npc: t.npc, map: t.map, text: `Đưa thư của Trưởng Môn tới ${t.name} (${t.mapName})` };
    }
    let pool = FIELD.filter(id => MONSTERS[id].lv <= L + 3 && MONSTERS[id].lv >= L - 8);
    if (!pool.length) pool = FIELD.slice().sort((a, b) => Math.abs(MONSTERS[a].lv - L) - Math.abs(MONSTERS[b].lv - L)).slice(0, 3);
    const mon = pool[U.randInt(0, pool.length - 1)], need = U.randInt(15, 25), mid = mapOfMon(mon);
    return { type: 'kill', mon, need, have: 0, map: mid, text: `Tiêu diệt ${need} ${MONSTERS[mon].name}${mid ? ` (${MAPS[mid].name})` : ''}` };
  }
  reward(p, q, nth) {
    const L = p.c.level;
    const pts = { kill: 10, elite: 15, letter: 12, dungeon: 30 }[q.type] || 10;
    const r = { exp: Math.round(U.expNext(L) * 0.012 + 200), gold: Math.round(L * L * 2 + 300), pts, items: [] };
    if (nth % SECT_DAILY === 0) { r.exp *= 3; r.gold *= 2; r.pts += 30; r.items.push(['lucky_chest', 1], [L >= 25 ? 'stone2' : 'stone', L >= 25 ? 1 : 3]); }   // nhiệm vụ thứ 10
    return r;
  }

  // ---------- giao diện Trưởng Môn ----------
  view(p, npcId) {
    const d = this.data(p), rk = sectRank(p.c), next = SECT_RANKS[rk + 1];
    const npc = NPCS[npcId] || {};
    return {
      npc: npcId, sect: npc.sect, sectName: CLASSES[npc.sect] ? CLASSES[npc.sect].name : '', member: npc.sect === p.c.cls, mySect: CLASSES[p.c.cls].name,
      rank: rk, rankName: SECT_RANKS[rk][1], next: next ? { at: next[0], name: next[1] } : null, total: d.total, pts: d.pts, bonus: rk * 2,
      n: d.n, max: SECT_DAILY, cur: d.cur, preview: d.cur ? this.reward(p, d.cur, d.n + 1) : null,
      ranks: SECT_RANKS.map(([at, name], i) => ({ at, name, bonus: i * 2 })),
      patrol: d.patrol || null, med: d.med || 0, medMax: MED_MAX, def: { at: `${DEF_H}:${String(DEF_M).padStart(2, '0')}`, on: !!this.def }
    };
  }
  action(p, a) {
    if (!a) return;
    const near = id => this.w.nearNpc(p, id);
    if (a.op === 'shop') { if (!near('sect_ho_phap')) return; return p.socket.emit('sectShop', this.shopView(p)); }
    if (a.op === 'buy') return this.buy(p, a.id, a.qty);
    if (a.op === 'patrolHit') return this.patrolHit(p, a.i | 0);
    const npcId = 'chuong_mon_' + p.c.cls;
    if (a.op === 'view') { const id = a.npc && near(a.npc) ? a.npc : npcId; return p.socket.emit('sect', this.view(p, id)); }
    if (!near(npcId)) return this.toast(p, 'Hãy về gặp Trưởng Môn bổn phái', 'error');
    const d = this.data(p);
    if (a.op === 'patrol') this.patrolStart(p);
    else if (a.op === 'accept') {
      if (d.cur) return this.toast(p, 'Ngươi đang có nhiệm vụ chưa xong', 'error');
      if (d.n >= SECT_DAILY) return this.toast(p, `Hôm nay đã làm đủ ${SECT_DAILY} nhiệm vụ môn phái, mai quay lại nhé`, 'error');
      d.cur = this.makeQuest(p);
      this.toast(p, `📜 Nhiệm vụ môn phái: ${d.cur.text}`, 'reward');
    } else if (a.op === 'submit') {
      if (!d.cur || d.cur.have < d.cur.need) return this.toast(p, 'Nhiệm vụ chưa hoàn thành', 'error');
      d.n++;
      const r = this.reward(p, d.cur, d.n);
      d.cur = null; d.pts += r.pts;
      if (this.w.guildx) this.w.guildx.progress(p, 'sect');
      const before = sectRank(p.c); d.total += r.pts;
      this.w.giveReward(p, { exp: r.exp, gold: r.gold, items: r.items }, `📜 Nhiệm vụ môn phái ${d.n}/${SECT_DAILY} (+${r.pts} cống hiến)`, { bind: true });
      const after = sectRank(p.c);
      if (after > before) { this.w.recalc(p); this.toast(p, `🎖️ Thăng cấp môn phái: ${SECT_RANKS[after][1]} (+${after * 2}% công / thủ / sinh lực)`, 'reward'); this.w.features.announce(`🎖️ ${p.c.name} được thăng làm ${SECT_RANKS[after][1]} của ${CLASSES[p.c.cls].name}!`); }
    } else if (a.op === 'abandon') {
      if (!d.cur) return;
      d.cur = null; this.toast(p, 'Đã hủy nhiệm vụ môn phái');
    }
    this.w.db.markDirty(); p.dirtyMe = true;
    p.socket.emit('sect', this.view(p, npcId));
  }

  // ---------- tiến độ ----------
  progress(p, n) {
    const d = p.c.sect, q = d && d.cur;
    if (!q || q.have >= q.need) return;
    q.have = Math.min(q.need, q.have + n);
    p.dirtyMe = true;
    if (q.have >= q.need) this.toast(p, `✅ Xong nhiệm vụ môn phái! Về báo Trưởng Môn (${MAPS[SECT_MAP[p.c.cls]].name}) để nhận thưởng`, 'reward');
  }
  onKill(p, mon) {
    const q = p.c.sect && p.c.sect.cur;
    if (!q) return;
    if (q.type === 'kill' && (mon.base || mon.tpl).id === q.mon) this.progress(p, 1);
    else if (q.type === 'elite' && mon.tpl.elite) this.progress(p, 1);
  }
  onTalk(p, npcId) {
    const q = p.c.sect && p.c.sect.cur;
    if (q && q.type === 'letter' && q.have < q.need && npcId === q.npc) { this.toast(p, `✉️ Đã trao thư cho ${NPCS[npcId].name}`); this.progress(p, 1); }
  }
  onDungeon(p) { const q = p.c.sect && p.c.sect.cur; if (q && q.type === 'dungeon') this.progress(p, 1); }
  meView(p) {
    const d = p.c.sect || {}, rk = sectRank(p.c);
    const today = d.day === U.vnDay(), pt = today && d.patrol && !d.patrol.done ? d.patrol : null;
    return { rank: rk, rankName: SECT_RANKS[rk][1], pts: d.pts || 0, cur: d.cur || null, n: today ? d.n : 0, max: SECT_DAILY, map: SECT_MAP[p.c.cls],
      patrol: pt ? { hit: pt.hit, pts: this.patrolPts(SECT_MAP[p.c.cls]) } : null, def: !!this.def };
  }

  // ---------- cửa hàng cống hiến ----------
  shopView(p) {
    const d = this.data(p), rk = sectRank(p.c);
    return { pts: d.pts, rank: rk, rankName: SECT_RANKS[rk][1], items: SECT_SHOP.map(x => ({ ...x, rankName: SECT_RANKS[x.rank][1], ok: rk >= x.rank })) };
  }
  buy(p, id, qty) {
    if (!this.w.nearNpc(p, 'sect_ho_phap')) return this.toast(p, 'Hãy gặp Hộ Pháp Môn Phái', 'error');
    const it = SECT_SHOP.find(x => x.id === id);
    if (!it || !ITEMS[id]) return;
    qty = U.clamp(qty | 0 || 1, 1, 99);
    const d = this.data(p);
    if (sectRank(p.c) < it.rank) return this.toast(p, `Cần cấp bậc ${SECT_RANKS[it.rank][1]}`, 'error');
    if (d.pts < it.cost * qty) return this.toast(p, 'Không đủ điểm cống hiến', 'error');
    d.pts -= it.cost * qty;
    this.w.giveItem(p, id, qty, 0, true);   // đổi ở NPC môn phái: đồ khoá
    this.toast(p, `Đổi ${ITEMS[id].name} x${qty} (−${it.cost * qty} cống hiến)`, 'reward');
    this.w.db.markDirty();
    p.socket.emit('sectShop', this.shopView(p));
  }
}

module.exports = { Sect };
