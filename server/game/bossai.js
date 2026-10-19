// Kỹ năng boss: vận công (vùng cảnh báo hiện dưới đất) rồi mới gây sát thương, người chơi có thể né hoặc lướt.
// Mỗi boss có bộ chiêu riêng (data/bossskills.js). Máu dưới 30%: nổi giận, ra chiêu nhanh hơn.
const { BOSS_SKILLS, BOSS_SK } = require('../data/bossskills');
const { MONSTERS } = require('../data/monsters');
const { TILE, isSolidAt } = require('../data/maps');
const U = require('./util');

const PR = 14;   // bán kính thân người chơi khi xét trúng
const D2R = Math.PI / 180;
let castSeq = 1;

class BossAI {
  constructor(world) { this.w = world; }

  init(mon, now) {
    const list = BOSS_SKILLS[mon.tpl.id] || BOSS_SKILLS._default;
    mon.skills = list.map(id => BOSS_SK[id]).filter(Boolean);
    mon.skillI = U.randInt(0, mon.skills.length - 1);
    mon.nextSkill = now + 2500;
    mon.pending = [];
  }
  // trả về true khi boss đang vận công (đứng yên, không đánh thường)
  update(mon, m, target, now) {
    if (!mon.skills) this.init(mon, now);
    if (!mon.enraged && mon.hp < mon.maxHp * 0.3) {
      mon.enraged = true;
      this.w.fx(mon.mapId, { t: 'benrage', id: mon.id, x: mon.x, y: mon.y });
      for (const p of m.players) this.w.toast(p, `🔥 ${mon.tpl.name} nổi giận! Ra chiêu dồn dập hơn`, 'error');
    }
    if (mon.castUntil > now) return true;
    if (!target || now < mon.nextSkill || U.dist(target, mon) > 520) return false;
    const sk = mon.skills[mon.skillI++ % mon.skills.length];
    const wind = this.cast(mon, m, target, sk, now, sk.windup * (mon.enraged ? 0.85 : 1));
    mon.nextSkill = now + wind + U.rand(2600, 3800) * (mon.enraged ? 0.6 : 1);
    return true;
  }

  // ---------- tạo vùng đánh ----------
  shapes(mon, target, sk) {
    const ox = mon.x, oy = mon.y, a = Math.atan2(target.y - oy, target.x - ox), out = [];
    const line = (x, y, ang, at = 0, extra = {}) => out.push(Object.assign({ k: 'line', x, y, a: ang, len: sk.len, w: sk.w, at }, extra));
    switch (sk.pattern) {
      case 'circle': out.push({ k: 'circle', x: target.x, y: target.y, r: sk.r, at: 0 }); break;
      case 'self': out.push({ k: 'circle', x: ox, y: oy, r: sk.r, at: 0 }); break;
      case 'ring': out.push({ k: 'ring', x: ox, y: oy, r1: sk.r1, r2: sk.r2, at: 0 }); break;
      case 'line': line(ox, oy, a); break;
      case 'dash': line(ox, oy, a, 0, { dash: 1 }); break;
      case 'cone': out.push({ k: 'cone', x: ox, y: oy, a, r: sk.r, arc: sk.arc * D2R, at: 0 }); break;
      case 'fan': for (let i = 0; i < sk.n; i++) line(ox, oy, a + (i - (sk.n - 1) / 2) * (sk.spreadDeg * D2R) / Math.max(1, sk.n - 1)); break;
      case 'star': for (let i = 0; i < sk.n; i++) line(ox, oy, a + (sk.rot || 0) * D2R + i * Math.PI * 2 / sk.n); break;
      case 'parallel': {
        const nx = -Math.sin(a), ny = Math.cos(a);
        for (let i = 0; i < sk.n; i++) { const o = (i - (sk.n - 1) / 2) * sk.gap; line(ox + nx * o, oy + ny * o, a, i * sk.stagger); }
        break;
      }
      case 'multi': {
        const ps = [...this.w.maps[mon.mapId].players].filter(p => !p.dead && U.dist(p, mon) < 560);
        for (let i = 0; i < sk.n; i++) {
          const p = ps.length ? ps[i % ps.length] : target, rr = i < ps.length ? 0 : sk.spread;   // vòng đầu nhắm thẳng từng người
          const ang = Math.random() * Math.PI * 2, d = Math.random() * rr;
          out.push({ k: 'circle', x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d, r: sk.r, at: i * (sk.stagger || 0) });
        }
        break;
      }
      case 'waves':
        sk.rings.forEach(([r1, r2], i) => out.push(r1 > 0 ? { k: 'ring', x: ox, y: oy, r1, r2, at: i * sk.stagger } : { k: 'circle', x: ox, y: oy, r: r2, at: i * sk.stagger }));
        break;
    }
    return out;
  }
  cast(mon, m, target, sk, now, wind) {
    const shapes = this.shapes(mon, target, sk), id = castSeq++;
    for (const s of shapes) { s.at += wind; mon.pending.push({ s, due: now + s.at, sk, id }); }
    const last = Math.max(...shapes.map(s => s.at));
    mon.castUntil = now + last + 250;
    this.w.fx(mon.mapId, { t: 'bcast', id: mon.id, name: sk.name, color: sk.color, vfx: sk.vfx, wind, shapes });
    if (sk.pull) for (const p of m.players) {   // hút người chơi về phía boss
      if (p.dead || U.dist(p, mon) > (sk.r || 260) + 120) continue;
      const nx = p.x + (mon.x - p.x) * sk.pull, ny = p.y + (mon.y - p.y) * sk.pull;
      if (!isSolidAt(m.def, nx, ny)) { p.x = nx; p.y = ny; p.socket.emit('pos', { x: nx, y: ny, dash: 1 }); }
    }
    if (sk.summon) this.summon(mon, m, sk);
    return wind;
  }
  summon(mon, m, sk) {
    const pool = { pb2_boss: 'pb2_thi_binh', pb3_boss: 'pb3_ma_lang' }[mon.tpl.id] || (m.def.spawns[0] && m.def.spawns[0].mon);
    const tpl = pool && MONSTERS[pool];
    if (!tpl) return;
    for (let i = 0; i < sk.summon; i++) {
      const pos = this.w.randomSpotNear(m.def, mon.x / TILE, mon.y / TILE, 2);
      const s = this.w.spawnMonster(mon.mapId, tpl, { x: mon.x / TILE, y: mon.y / TILE, r: 3 }, { pos, noElite: true });
      s.robber = true;   // quái gọi ra: chết là mất, không hồi sinh
      this.w.fx(mon.mapId, { t: 'aura', x: pos.x, y: pos.y, color: sk.color });
    }
  }

  // ---------- xét trúng ----------
  hit(s, p) {
    const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy);
    if (s.k === 'circle') return d <= s.r + PR;
    if (s.k === 'ring') return d >= s.r1 - PR && d <= s.r2 + PR;
    if (s.k === 'line') {
      const t = dx * Math.cos(s.a) + dy * Math.sin(s.a), q = Math.abs(-dx * Math.sin(s.a) + dy * Math.cos(s.a));
      return t >= -PR && t <= s.len + PR && q <= s.w / 2 + PR;
    }
    if (s.k === 'cone') {
      if (d > s.r + PR) return false;
      let da = Math.atan2(dy, dx) - s.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      return Math.abs(da) <= s.arc / 2 || d < PR * 2;
    }
    return false;
  }
  resolve(mon, m, now) {
    const due = mon.pending.filter(x => x.due <= now);
    if (!due.length) return;
    mon.pending = mon.pending.filter(x => x.due > now);
    const hitSet = new Set();
    for (const { s, sk, id } of due) {
      if (mon.dead) break;
      if (s.dash) {   // lao tới cuối đường (dừng trước vật cản)
        let L = s.len;
        while (L > 0 && isSolidAt(m.def, s.x + Math.cos(s.a) * L, s.y + Math.sin(s.a) * L)) L -= 20;
        mon.x = s.x + Math.cos(s.a) * L; mon.y = s.y + Math.sin(s.a) * L;
      }
      this.w.fx(mon.mapId, { t: 'bhit', id: mon.id, vfx: sk.vfx, color: sk.color, s });
      const mult = s.mult || sk.mult;
      for (const p of m.players) {
        const key = id + ':' + p.userId + ':' + s.at;
        if (p.dead || hitSet.has(key) || !this.hit(s, p)) continue;
        hitSet.add(key);
        if (p.dodgeUntil > now) continue;   // đang lướt: né được
        const { dmg } = this.w.calcDamage(mon.tpl.atk, 0, p.stats.def, mult * (mon.enraged ? 1.15 : 1), 0.45);
        this.w.applyDamage(p, dmg, mon, 'hurt');
        const st = s.st || sk.st;
        if (st && !p.dead) this.w.applyStatus(p, st[0], st[1], mon);
        if (sk.drain) mon.hp = Math.min(mon.maxHp, mon.hp + dmg * sk.drain);
      }
      // chiêu nối tiếp sau phát cuối cùng
      if (sk.then && !mon.pending.some(x => x.id === id)) {
        const t2 = Object.assign({}, sk, sk.then, { then: null, name: sk.name, id: sk.id + '_2' });
        const tgt = (mon.target && this.w.players.get(mon.target)) || [...m.players][0];
        if (tgt) { const w2 = this.cast(mon, m, tgt, t2, now, t2.delay || 400); mon.nextSkill = Math.max(mon.nextSkill, now + w2 + 1500); }
      }
    }
  }
}

module.exports = { BossAI };
