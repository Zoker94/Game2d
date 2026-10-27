// Nhiệm vụ môn phái: Trưởng Môn giao tối đa 10 nhiệm vụ mỗi ngày (diệt quái, diệt tinh anh, đưa thư, vượt phó bản).
// Xong việc quay về báo Trưởng Môn để nhận kinh nghiệm, ngân lượng và điểm cống hiến; mỗi nhiệm vụ thứ 10 thưởng thêm.
// Điểm cống hiến đổi đồ ở Hộ Pháp Môn Phái; tổng cống hiến quyết định cấp bậc (mỗi bậc +2% công / thủ / sinh lực).
const { MAPS, MAP_DEFS } = require('../data/maps');
const { MONSTERS } = require('../data/monsters');
const { NPCS } = require('../data/npcs');
const { CLASSES } = require('../data/classes');
const { ITEMS } = require('../data/items');
const { SECT_MAP, SECT_RANKS, SECT_DAILY, SECT_SHOP, sectRank } = require('../data/sect');
const U = require('./util');

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
  constructor(world) { this.w = world; }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }
  data(p) {
    const c = p.c, day = U.vnDay();
    if (!c.sect) c.sect = { day, n: 0, cur: null, pts: 0, total: 0 };
    if (c.sect.day !== day) { c.sect.day = day; c.sect.n = 0; }
    return c.sect;
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
      ranks: SECT_RANKS.map(([at, name], i) => ({ at, name, bonus: i * 2 }))
    };
  }
  action(p, a) {
    if (!a) return;
    const near = id => this.w.nearNpc(p, id);
    if (a.op === 'shop') { if (!near('sect_ho_phap')) return; return p.socket.emit('sectShop', this.shopView(p)); }
    if (a.op === 'buy') return this.buy(p, a.id, a.qty);
    const npcId = 'chuong_mon_' + p.c.cls;
    if (a.op === 'view') { const id = a.npc && near(a.npc) ? a.npc : npcId; return p.socket.emit('sect', this.view(p, id)); }
    if (!near(npcId)) return this.toast(p, 'Hãy về gặp Trưởng Môn bổn phái', 'error');
    const d = this.data(p);
    if (a.op === 'accept') {
      if (d.cur) return this.toast(p, 'Ngươi đang có nhiệm vụ chưa xong', 'error');
      if (d.n >= SECT_DAILY) return this.toast(p, `Hôm nay đã làm đủ ${SECT_DAILY} nhiệm vụ môn phái, mai quay lại nhé`, 'error');
      d.cur = this.makeQuest(p);
      this.toast(p, `📜 Nhiệm vụ môn phái: ${d.cur.text}`, 'reward');
    } else if (a.op === 'submit') {
      if (!d.cur || d.cur.have < d.cur.need) return this.toast(p, 'Nhiệm vụ chưa hoàn thành', 'error');
      d.n++;
      const r = this.reward(p, d.cur, d.n);
      d.cur = null; d.pts += r.pts;
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
    return { rank: rk, rankName: SECT_RANKS[rk][1], pts: d.pts || 0, cur: d.cur || null, n: d.day === U.vnDay() ? d.n : 0, max: SECT_DAILY, map: SECT_MAP[p.c.cls] };
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
