// Cốt truyện chính: theo dõi tiến độ từng người, phát hội thoại, sinh boss cốt truyện riêng.
const U = require('./util');
const { PROLOGUE, CHAPTERS, CH1_V1_MAP } = require('../data/story');
const { MAPS, TILE, isSolidAt, baseOf } = require('../data/maps');
const { MONSTERS, BOSSES } = require('../data/monsters');
const { NPCS } = require('../data/npcs');
const { ITEMS } = require('../data/items');

// bước hướng dẫn cần tới NPC nào
const STEP_NPC = { buy: 'duoc_diem', daily: 'su_gia' };
// NPC nằm ở bản đồ nào (để chỉ đường)
const NPC_MAP = {};
for (const [mid, m] of Object.entries(MAPS)) for (const n of m.npcs) if (!NPC_MAP[n.id]) NPC_MAP[n.id] = mid;

class Story {
  constructor(world) { this.w = world; this.elites = new Set(); }

  state(c) {
    if (!c.story) c.story = { ch: 0, st: 0, n: 0, seen: false, done: false, v: 2 };
    const s = c.story;
    if (!s.v) {   // tiến độ trước khi gộp hướng dẫn tân thủ vào chương 1
      if (!s.done && s.ch === 0) s.st = CH1_V1_MAP[s.st] != null ? CH1_V1_MAP[s.st] : s.st;
      s.v = 2;
    }
    return s;
  }
  step(c) {
    const s = this.state(c);
    if (s.done) return null;
    const ch = CHAPTERS[s.ch];
    return ch ? ch.steps[s.st] : null;
  }
  targetMap(step) {
    if (!step) return null;
    if (step.type === 'talk') return step.map || NPC_MAP[step.npc] || 'tuong_duong';
    if (step.type === 'buy' || step.type === 'daily') return NPC_MAP[STEP_NPC[step.type]] || 'tuong_duong';
    if (step.type === 'map' || step.type === 'elite') return step.map;
    if (step.type === 'kill') {   // bản đồ có loại quái này
      for (const [mid, m] of Object.entries(MAPS)) if ((m.spawns || []).some(sp => step.mons.includes(sp.mon))) return mid;
    }
    return null;
  }
  view(p) {
    const c = p.c, s = this.state(c), step = this.step(c);
    if (s.done || !step) return { done: true, ch: CHAPTERS.length, total: CHAPTERS.length };
    const tm = this.targetMap(step);
    const need = step.type === 'kill' ? step.n : step.type === 'level' ? step.n : 1;
    const have = step.type === 'level' ? c.level : s.n;
    return {
      ch: s.ch, st: s.st, steps: CHAPTERS[s.ch].steps.length, total: CHAPTERS.length, chName: CHAPTERS[s.ch].name,
      type: step.type, text: step.text, hint: step.hint || null, tut: !!step.tut, have: Math.min(have, need), need, npc: step.npc || STEP_NPC[step.type] || null, mons: step.mons || null,
      map: tm, mapName: tm ? MAPS[tm].name : null, next: tm && tm !== baseOf(p.mapId) ? this.w.escort.nextMap(p.mapId, tm) : null,
      eid: p.storyElite && !p.storyElite.dead ? p.storyElite.id : null, seen: !!s.seen
    };
  }
  scene(p, lines, title, kind) {
    if (lines && lines.length) p.socket.emit('storyScene', { title: title || null, lines, kind: kind || 'talk' });
  }
  // gọi khi người chơi vào game
  onJoin(p) {
    const s = this.state(p.c);
    if (!s.seen && !s.done && s.ch === 0 && s.st === 0) p.socket.emit('storyScene', { title: PROLOGUE.title, lines: PROLOGUE.lines.map(t => ['n', t]), kind: 'prologue' });
    this.check(p);
  }
  action(p, d) {
    if (!d) return;
    if (d.op === 'seen') { this.state(p.c).seen = true; p.dirtyMe = true; }
  }

  // ---------- móc từ thế giới ----------
  on(p, type, info = {}) {
    const c = p.c, s = this.state(c), step = this.step(c);
    if (!step || step.type !== type) return false;
    if (type === 'talk') {
      if (info.npc !== step.npc) return false;
      this.scene(p, step.lines, CHAPTERS[s.ch].name);
      this.advance(p);
      return true;            // NPC này đang dùng cho cốt truyện: không mở cửa hàng lần này
    }
    if (type === 'map') { if (info.map === step.map) this.advance(p); return false; }
    if (type === 'kill') {
      if (!step.mons.includes(info.mon)) return false;
      s.n++; p.dirtyMe = true;
      if (s.n >= step.n) this.advance(p);
      return false;
    }
    if (type === 'level') { if (c.level >= step.n) this.advance(p); return false; }
    if (type === 'equip' || type === 'skill' || type === 'buy' || type === 'daily') { this.advance(p); return false; }
    return false;
  }
  // bước kế có thể đã đạt sẵn (đang đứng ở bản đồ yêu cầu / đủ cấp)
  check(p) {
    const step = this.step(p.c);
    if (!step) return;
    const t = p.c.tutorial;
    if (step.tut && t && (t.done || t.step > step.tut)) { this.advance(p, true); return; }   // đã học ở hướng dẫn tân thủ kiểu cũ
    if (step.type === 'equip' && p.c.equip.weapon) this.advance(p);
    else if (step.type === 'level' && p.c.level >= step.n) this.advance(p);
    else if (step.type === 'map' && baseOf(p.mapId) === step.map) this.advance(p);
  }
  advance(p, skip) {
    const c = p.c, s = this.state(c), ch = CHAPTERS[s.ch], step = ch.steps[s.st];
    if (!skip) {   // skip: bỏ qua bước hướng dẫn đã làm trước đây (không thoại, không thưởng)
      if (step.done) this.scene(p, step.done, ch.name);
      this.reward(p, step.reward, `Cốt truyện – ${ch.name}`);
    }
    s.st++; s.n = 0;
    if (p.storyElite) { this.removeElite(p); }
    if (s.st >= ch.steps.length) {
      this.w.features.announce(`📜 ${c.name} đã hoàn thành Chương ${s.ch + 1}: ${ch.name}!`);
      s.ch++; s.st = 0;
      if (s.ch >= CHAPTERS.length) { s.done = true; this.w.features.announce(`🏆 ${c.name} đã hoàn thành toàn bộ cốt truyện "Võ Mục Di Thư" – Tương Dương Đại Hiệp!`); p.dirtyMe = true; return; }
      const nc = CHAPTERS[s.ch];
      p.socket.emit('storyScene', { title: `Chương ${s.ch + 1}: ${nc.name}`, lines: [['n', nc.desc]], kind: 'chapter' });
    }
    const nx = this.step(c);
    if (nx && nx.intro && !(nx.tut && c.tutorial && (c.tutorial.done || c.tutorial.step > nx.tut))) this.scene(p, nx.intro, CHAPTERS[s.ch].name);
    p.dirtyMe = true;
    this.w.db.markDirty();
    setTimeout(() => this.check(p), 50);
  }
  reward(p, r, src) {
    if (!r) return;
    const out = {};
    if (r.expPct) out.exp = Math.round(U.expNext(p.c.level) * r.expPct * 0.12);
    if (r.gold) out.gold = r.gold;
    if (r.knb) out.knb = r.knb;
    if (r.items) out.items = r.items.filter(([id]) => id === '@book1' || ITEMS[id]);   // @book1: sách kỹ năng 2 của môn phái
    this.w.giveReward(p, out, src, { bind: true });
  }

  // ---------- boss cốt truyện (riêng từng người, chỉ xuất hiện khi tới đúng bước) ----------
  tick() {
    // dọn boss cốt truyện mồ côi (chủ đã thoát game / đổi bản đồ)
    for (const mon of this.elites) {
      const owner = this.w.players.get(mon.story);
      if (owner && owner.storyElite === mon && !mon.dead) continue;
      this.elites.delete(mon);
      const m = this.w.maps[mon.mapId];
      if (m && m.monsters.get(mon.id) === mon) m.monsters.delete(mon.id);
    }
    for (const p of this.w.players.values()) {
      const step = this.step(p.c);
      const el = p.storyElite;
      if (el && (el.dead || el.mapId !== p.mapId || !step || step.type !== 'elite')) { this.removeElite(p); continue; }
      if (!step || step.type !== 'elite' || baseOf(p.mapId) !== step.map || p.dead || el) continue;
      if (MAPS[p.mapId].safe) continue;
      this.spawnElite(p, step);
    }
  }
  spawnElite(p, step) {
    const base = BOSSES[step.mon] || MONSTERS[step.mon];
    if (!base) return;
    const boss = !!BOSSES[step.mon];
    const tpl = Object.assign({}, base, {
      hp: Math.round(base.hp * step.hp), atk: Math.round(base.atk * (boss ? 0.75 : 1.4)), def: Math.round(base.def * (boss ? 0.8 : 1.2)),
      exp: Math.round(base.exp * (boss ? 0.05 : 6)), gold: Math.round(base.gold * (boss ? 0.1 : 6)), respawn: 999999
    });
    const map = MAPS[p.mapId];
    let pos = null;
    for (let k = 0; k < 12 && !pos; k++) {
      const a = Math.random() * Math.PI * 2, x = p.x + Math.cos(a) * 200, y = p.y + Math.sin(a) * 160;
      if (!isSolidAt(map, x, y)) pos = { x, y };
    }
    pos = pos || { x: p.x + 60, y: p.y };
    const mon = this.w.spawnMonster(p.mapId, tpl, { x: pos.x / TILE, y: pos.y / TILE, r: 0 }, { pos, noElite: true });
    mon.story = p.userId; mon.boss = true; mon.target = p.userId; mon.maxHp = tpl.hp; mon.hp = tpl.hp;
    p.storyElite = mon; this.elites.add(mon);
    this.w.fx(p.mapId, { t: 'aura', x: pos.x, y: pos.y, color: '#ff3030' });
    p.dirtyMe = true;
  }
  removeElite(p) {
    const el = p.storyElite;
    p.storyElite = null;
    if (!el) return;
    const m = this.w.maps[el.mapId];
    if (m && m.monsters.get(el.id) === el) m.monsters.delete(el.id);
    p.dirtyMe = true;
  }
  // boss cốt truyện bị hạ (gọi từ killMonster)
  onEliteKilled(mon, killer) {
    const owner = this.w.players.get(mon.story);
    if (!owner) return;
    if (owner.storyElite === mon) owner.storyElite = null;
    const step = this.step(owner.c);
    if (step && step.type === 'elite' && owner.mapId === mon.mapId) this.advance(owner);
  }
}

Story.CHAPTERS = CHAPTERS.length;
module.exports = { Story, CHAPTERS, PROLOGUE };
