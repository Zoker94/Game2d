// Chọi gà – Trường Gà ở Tương Dương (NPC Chủ Trường Gà, action 'cockfight').
// - Có gà: nhận 1 con Gà Điều miễn phí lần đầu; mua Trứng Gà Chọi / Trứng Gà Quý rồi Sử dụng để ấp (nở ngẫu nhiên giống + sao tư chất).
//   Tối đa 6 con trong chuồng; phóng sinh để lấy lại chỗ (được ít ngân lượng theo cấp).
// - Nuôi: cho ăn Thóc (hồi thể lực, thêm kinh nghiệm), luyện gà (tốn ngân lượng, chờ 10 phút), cấp 1-30; chỉ số theo giống × sao.
//   Thể lực tối đa 100, mỗi trận tốn 20, tự hồi 1 điểm / 3 phút.
// - Đấu: Đấu tập với gà NPC 5 hạng (15 trận / ngày, thắng có ngân lượng + kinh nghiệm);
//   Thách đấu người chơi đang online (có thể đặt cược ngân lượng, người thắng nhận 90% tổng cược, 10% là phí trường gà) – tính điểm Sư Kê (ELO).
// - Trận đấu do máy chủ tính (hạt giống ngẫu nhiên), máy khách chiếu lại từng đòn bằng sprite.
const U = require('./util');
const R = require('../data/roosters');
const { isOwner } = require('../owner');

const ENERGY_MAX = 100, FIGHT_COST = 20, REGEN_MS = 3 * 60000, TRAIN_MS = 10 * 60000, PVE_DAILY = 15, INVITE_MS = 30000, FEE = 0.1;

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pickW = (obj, r) => { const e = Object.entries(obj); let x = r * e.reduce((a, [, w]) => a + w, 0); for (const [k, w] of e) if ((x -= w) < 0) return k; return e[e.length - 1][0]; };

class Cockfight {
  constructor(world, features, db) { this.w = world; this.f = features; this.db = db; world.cockfight = this; this.invites = new Map(); }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }

  // ---------- gà ----------
  newRooster(breed, stars, lv = 1) { return { id: U.newUid(), breed, stars, lv, exp: 0, name: R.BREEDS[breed].name, en: ENERGY_MAX, enAt: Date.now(), win: 0, loss: 0, elo: 1000, trainAt: 0 }; }
  stats(r, tac) {
    const B = R.BREEDS[r.breed], k = 0.94 + r.stars * 0.03, g = 0.92 + r.stars * 0.04, T = R.TACTICS[tac] || R.TACTICS.can, o = {};
    for (const s of ['hp', 'atk', 'spd', 'def']) o[s] = Math.round((B.base[s] * k + B.grow[s] * g * (r.lv - 1)) * (s === 'hp' ? 1 : T[s] || 1));
    return o;
  }
  energy(r) {   // hồi thể lực theo thời gian
    const now = Date.now(), gain = Math.floor((now - (r.enAt || now)) / REGEN_MS);
    if (gain > 0) { r.en = Math.min(ENERGY_MAX, (r.en || 0) + gain); r.enAt = (r.enAt || now) + gain * REGEN_MS; }
    if (r.en >= ENERGY_MAX) r.enAt = now;
    return r.en;
  }
  coop(c) { return c.roosters || (c.roosters = []); }
  sel(c) { const L = this.coop(c); return L.find(r => r.id === c.roosterSel) || L[0] || null; }
  addExp(r, n) {
    if (r.lv >= R.MAX_LV) return false;
    r.exp += n; let up = false;
    while (r.lv < R.MAX_LV && r.exp >= R.expNeed(r.lv)) { r.exp -= R.expNeed(r.lv); r.lv++; up = true; }
    if (r.lv >= R.MAX_LV) r.exp = 0;
    return up;
  }
  hatch(p, egg) {
    const E = R.EGGS[egg]; if (!E) return;
    const c = p.c;
    if (this.coop(c).length >= R.MAX_HAVE) return this.toast(p, `Chuồng đã đủ ${R.MAX_HAVE} con – phóng sinh bớt ở Chủ Trường Gà (Tương Dương)`, 'error');
    if (!U.countItem(c, egg)) return;
    U.removeItemById(c, egg, 1);
    const rar = pickW(E.rar, Math.random()), list = R.RAR_GROUP[rar], breed = list[U.randInt(0, list.length - 1)];
    let x = Math.random() * E.stars.reduce((a, b) => a + b, 0), stars = 5;
    for (let i = 0; i < 5; i++) if ((x -= E.stars[i]) < 0) { stars = i + 1; break; }
    const r = this.newRooster(breed, stars);
    this.coop(c).push(r); if (!c.roosterSel) c.roosterSel = r.id;
    p.dirtyMe = true; this.db.markDirty();
    p.socket.emit('cfHatch', { r: this.rv(r) });
    this.toast(p, `🐣 Trứng nở ra ${R.BREEDS[breed].name} ${'★'.repeat(stars)}!`, 'reward');
    if (rar === 'legendary' || (rar === 'epic' && stars >= 4)) this.f.brag(`🐓 ${c.name} ấp nở được ${R.BREEDS[breed].name} ${'★'.repeat(stars)}!`);
  }
  rv(r, full = true) {   // dữ liệu gà gửi máy khách
    const B = R.BREEDS[r.breed];
    return { id: r.id, breed: r.breed, bname: B.name, rar: B.rar, name: r.name, lv: r.lv, exp: r.exp, need: R.expNeed(r.lv), stars: r.stars,
      en: full ? this.energy(r) : undefined, win: r.win, loss: r.loss, elo: r.elo, st: this.stats(r), skn: B.skn, skd: B.skd,
      train: Math.max(0, (r.trainAt || 0) + TRAIN_MS - Date.now()) };
  }

  // ---------- thao tác ----------
  near(p) { return this.w.nearNpc(p, 'chu_truong_ga'); }
  action(p, d) {
    if (!d) return;
    const c = p.c;
    if (d.op === 'view') return this.send(p);
    if (d.op === 'accept' || d.op === 'decline') return this.answer(p, d.op === 'accept');
    if (d.op === 'top') return p.socket.emit('cfTop', this.top());
    if (['free', 'buy', 'release', 'pve', 'challenge'].includes(d.op) && !this.near(p)) return this.toast(p, 'Hãy đến Chủ Trường Gà ở Tương Dương', 'error');
    const r = this.coop(c).find(x => x.id === d.id) || this.sel(c);
    if (d.op === 'free') {
      if (c.roosterFree) return this.toast(p, 'Bạn đã nhận gà miễn phí rồi', 'error');
      if (this.coop(c).length >= R.MAX_HAVE) return this.toast(p, 'Chuồng đã đầy', 'error');
      const g = this.newRooster('ga_dieu', 2); this.coop(c).push(g); c.roosterSel = g.id; c.roosterFree = 1;
      this.toast(p, '🐓 Nhận Gà Điều ★★ miễn phí! Cho ăn, luyện rồi đấu tập để lên cấp.', 'reward');
    } else if (d.op === 'select' && r) { c.roosterSel = r.id; }
    else if (d.op === 'rename' && r) { const n = String(d.name || '').replace(/[<>]/g, '').trim().slice(0, 16); if (n) r.name = n; }
    else if (d.op === 'feed' && r) {
      if (!U.countItem(c, 'thoc')) return this.toast(p, 'Hết Thóc – mua ở Chủ Trường Gà', 'error');
      if (this.energy(r) >= ENERGY_MAX && r.lv >= R.MAX_LV) return this.toast(p, 'Gà đã no và đạt cấp tối đa', 'error');
      U.removeItemById(c, 'thoc', 1); r.en = Math.min(ENERGY_MAX, r.en + 40); const up = this.addExp(r, 15);
      this.toast(p, `🌾 ${r.name} ăn ngon lành: +40 thể lực, +15 kinh nghiệm${up ? ` – lên cấp ${r.lv}!` : ''}`, 'reward');
    } else if (d.op === 'train' && r) {
      const left = (r.trainAt || 0) + TRAIN_MS - Date.now();
      if (left > 0) return this.toast(p, `Gà đang nghỉ sau buổi luyện – ${Math.ceil(left / 60000)} phút nữa`, 'error');
      if (r.lv >= R.MAX_LV) return this.toast(p, 'Gà đã đạt cấp tối đa', 'error');
      const cost = 1000 + r.lv * 300;
      if (c.gold < cost) return this.toast(p, `Cần ${cost.toLocaleString('vi-VN')} lượng`, 'error');
      c.gold -= cost; r.trainAt = Date.now(); const up = this.addExp(r, 60 + r.lv * 4);
      this.toast(p, `💪 Luyện ${r.name}: +${60 + r.lv * 4} kinh nghiệm${up ? ` – lên cấp ${r.lv}!` : ''} (−${cost.toLocaleString('vi-VN')} lượng)`, 'reward');
    } else if (d.op === 'release' && r) {
      const gold = 500 + r.lv * r.lv * 40;
      this.coop(c).splice(this.coop(c).indexOf(r), 1); if (c.roosterSel === r.id) c.roosterSel = (this.coop(c)[0] || {}).id || null;
      c.gold += gold; this.toast(p, `🕊 Đã phóng sinh ${r.name} (+${gold.toLocaleString('vi-VN')} lượng)`, 'info');
    } else if (d.op === 'buy') {
      const id = String(d.item || ''), n = U.clamp(d.n | 0 || 1, 1, 50), price = id === 'thoc' ? 300 : R.EGGS[id] ? R.EGGS[id].price : 0;
      if (!price) return;
      if (c.gold < price * n) return this.toast(p, 'Không đủ ngân lượng', 'error');
      if (!U.addItem(c, id, n)) return this.toast(p, 'Túi đồ đầy', 'error');
      c.gold -= price * n; this.toast(p, `Đã mua ${R.EGGS[id] ? R.EGGS[id].name : 'Thóc'} x${n}`, 'reward');
    } else if (d.op === 'pve') return this.pve(p, r, d.tier | 0, String(d.tac || 'can'));
    else if (d.op === 'challenge') return this.challenge(p, r, String(d.name || ''), d.stake | 0, String(d.tac || 'can'));
    p.dirtyMe = true; this.db.markDirty();
    this.send(p);
  }
  send(p) {
    const c = p.c, today = U.vnDay(), pv = c.cfDay === today ? c.cfPve || 0 : 0;
    p.socket.emit('cockfight', {
      list: this.coop(c).map(r => this.rv(r)), sel: (this.sel(c) || {}).id || null, free: !c.roosterFree, max: R.MAX_HAVE,
      thoc: U.countItem(c, 'thoc'), eggs: Object.fromEntries(Object.keys(R.EGGS).map(k => [k, U.countItem(c, k)])),
      shop: [{ id: 'thoc', name: 'Thóc', price: 300, desc: '+40 thể lực, +15 kinh nghiệm cho gà' }, ...Object.entries(R.EGGS).map(([id, e]) => ({ id, name: e.name, price: e.price, desc: `Nở ngẫu nhiên: thường ${e.rar.common}% · hiếm ${e.rar.rare}% · quý ${e.rar.epic}% · huyền thoại ${e.rar.legendary}%` }))],
      tiers: R.TIERS.map(t => ({ name: t.name, lv: t.lv, gold: t.gold, exp: t.exp })), tactics: Object.entries(R.TACTICS).map(([k, t]) => ({ k, name: t.name })),
      pve: PVE_DAILY - pv, cost: FIGHT_COST, gold: c.gold
    });
  }

  // ---------- trận đấu (máy chủ tính, trả nhật ký từng đòn) ----------
  sim(A, B, seed) {
    const r = rng(seed), F = [A, B].map(x => ({ ...x, hp: x.st.hp, max: x.st.hp, gauge: 0, stun: 0 })), ev = [];
    const sk = i => R.BREEDS[F[i].breed].skill;
    if (sk(0) === 'phithan' && sk(1) !== 'phithan') F[0].gauge = 100; else if (sk(1) === 'phithan' && sk(0) !== 'phithan') F[1].gauge = 100;
    for (let step = 0; step < 400 && ev.length < 60 && F[0].hp > 0 && F[1].hp > 0; step++) {
      for (const f of F) f.gauge += f.st.spd;
      const i = F[0].gauge >= 100 && (F[0].gauge > F[1].gauge || (F[0].gauge === F[1].gauge && r() < 0.5)) ? 0 : F[1].gauge >= 100 ? 1 : -1;
      if (i < 0) continue;
      const a = F[i], d = F[1 - i]; a.gauge -= 100;
      if (sk(i) === 'benbi' && a.hp < a.max) a.hp = Math.min(a.max, a.hp + Math.round(a.max * 0.03));
      if (a.stun) { a.stun = 0; ev.push({ a: i, k: 'stunned', h: [F[0].hp, F[1].hp] }); continue; }
      const hits = sk(i) === 'lienhoan' && r() < 0.18 ? 2 : 1;
      for (let h = 0; h < hits && d.hp > 0; h++) {
        let dodge = 0.08 + (d.st.spd - a.st.spd) * 0.004 + (sk(1 - i) === 'nedon' ? 0.1 : 0) + (sk(1 - i) === 'phithan' ? 0.06 : 0);
        dodge = Math.max(0.02, Math.min(0.3, dodge));
        if (r() < dodge) { ev.push({ a: i, k: 'dodge', h: [F[0].hp, F[1].hp] }); continue; }
        const crit = r() < 0.1 + (sk(i) === 'thietcuoc' ? 0.12 : 0) + (sk(i) === 'hacphong' ? 0.06 : 0);
        let dmg = a.st.atk * 1.5 * (0.6 + r() * 0.8) * (1 - d.st.def / (d.st.def + 60));
        if (crit) dmg *= sk(i) === 'hacphong' ? 2.3 : 1.8;
        dmg = Math.max(1, Math.round(dmg)); d.hp = Math.max(0, d.hp - dmg);
        let heal = 0; if (sk(i) === 'huyetkich') { heal = Math.round(dmg * 0.25); a.hp = Math.min(a.max, a.hp + heal); }
        const stun = sk(i) === 'kimquang' && d.hp > 0 && r() < 0.15; if (stun) d.stun = 1;
        ev.push({ a: i, k: crit ? 'crit' : h ? 'double' : 'hit', d: dmg, heal: heal || undefined, stun: stun || undefined, h: [F[0].hp, F[1].hp] });
      }
    }
    const win = F[0].hp <= 0 ? 1 : F[1].hp <= 0 ? 0 : (F[0].hp / F[0].max >= F[1].hp / F[1].max ? 0 : 1);
    return { ev, win };
  }
  side(r, owner, tac) { return { name: r.name, owner, breed: r.breed, lv: r.lv, stars: r.stars, st: this.stats(r, tac), tac }; }
  pve(p, r, tier, tac) {
    const c = p.c, T = R.TIERS[tier]; if (!T || !r) return this.toast(p, 'Chưa có gà', 'error');
    const today = U.vnDay(); if (c.cfDay !== today) { c.cfDay = today; c.cfPve = 0; }
    if (c.cfPve >= PVE_DAILY) return this.toast(p, `Hôm nay đã đấu tập đủ ${PVE_DAILY} trận`, 'error');
    if (this.energy(r) < FIGHT_COST) return this.toast(p, `${r.name} mệt rồi (thể lực ${r.en}/${ENERGY_MAX}) – cho ăn Thóc hoặc chờ hồi`, 'error');
    const list = R.RAR_GROUP[T.rar], foe = this.newRooster(list[U.randInt(0, list.length - 1)], T.stars, T.lv); foe.name = T.name;
    r.en -= FIGHT_COST; c.cfPve++;
    const A = this.side(r, c.name, tac), B = this.side(foe, 'Trường Gà', 'can'), seed = (Math.random() * 4294967296) >>> 0, res = this.sim(A, B, seed);
    const won = res.win === 0, gold = won ? T.gold : Math.round(T.gold * 0.1), exp = won ? T.exp : Math.round(T.exp * 0.3);
    c.gold += gold; const up = this.addExp(r, exp); won ? r.win++ : r.loss++;
    p.dirtyMe = true; this.db.markDirty();
    p.socket.emit('cfFight', { A, B, ev: res.ev, win: res.win, me: 0, reward: { gold, exp, up: up ? r.lv : 0 } });
    this.send(p);
  }

  // ---------- thách đấu người chơi ----------
  challenge(p, r, name, stake, tac) {
    const c = p.c;
    if (!r) return this.toast(p, 'Chưa có gà', 'error');
    const o = [...this.w.players.values()].find(x => x.c.name.toLowerCase() === name.toLowerCase() && !x.offline);
    if (!o || o === p) return this.toast(p, 'Không tìm thấy người chơi đang online', 'error');
    stake = U.clamp(stake, 0, 5000000);
    if (c.gold < stake) return this.toast(p, 'Không đủ ngân lượng để đặt cược', 'error');
    if (this.energy(r) < FIGHT_COST) return this.toast(p, `${r.name} mệt rồi – cho ăn Thóc hoặc chờ hồi`, 'error');
    if (!this.sel(o.c)) return this.toast(p, `${o.c.name} chưa có gà chọi`, 'error');
    this.invites.set(o.userId, { from: p.userId, rid: r.id, stake, tac, at: Date.now() });
    o.socket.emit('cfInvite', { from: c.name, stake, r: this.rv(r, false), ms: INVITE_MS });
    this.toast(p, `📨 Đã gửi lời thách đấu tới ${o.c.name}${stake ? ` (cược ${stake.toLocaleString('vi-VN')} lượng)` : ''}`, 'info');
  }
  answer(p, ok) {
    const inv = this.invites.get(p.userId); this.invites.delete(p.userId);
    if (!inv || Date.now() - inv.at > INVITE_MS) return;
    const q = this.w.players.get(inv.from);
    if (!q) return this.toast(p, 'Người thách đấu đã rời game', 'error');
    if (!ok) return this.toast(q, `${p.c.name} từ chối lời thách đấu chọi gà`, 'info');
    const ra = this.coop(q.c).find(x => x.id === inv.rid), rb = this.sel(p.c);
    if (!ra || !rb) return;
    if (this.energy(ra) < FIGHT_COST || this.energy(rb) < FIGHT_COST) { this.toast(p, 'Một trong hai con gà không đủ thể lực', 'error'); return this.toast(q, 'Một trong hai con gà không đủ thể lực', 'error'); }
    if (q.c.gold < inv.stake || p.c.gold < inv.stake) { this.toast(p, 'Một bên không đủ ngân lượng cược', 'error'); return this.toast(q, 'Một bên không đủ ngân lượng cược', 'error'); }
    q.c.gold -= inv.stake; p.c.gold -= inv.stake; ra.en -= FIGHT_COST; rb.en -= FIGHT_COST;
    const A = this.side(ra, q.c.name, inv.tac), B = this.side(rb, p.c.name, 'can'), res = this.sim(A, B, (Math.random() * 4294967296) >>> 0);
    const W = res.win === 0 ? q : p, Wr = res.win === 0 ? ra : rb, Lr = res.win === 0 ? rb : ra, pot = Math.floor(inv.stake * 2 * (1 - FEE));
    W.c.gold += pot;
    const ex = 1 / (1 + Math.pow(10, (Lr.elo - Wr.elo) / 400)), dk = Math.round(32 * (1 - ex));
    Wr.elo += dk; Lr.elo = Math.max(0, Lr.elo - dk); Wr.win++; Lr.loss++;
    this.addExp(Wr, 80); this.addExp(Lr, 30);
    for (const [pl, me] of [[q, 0], [p, 1]]) {
      pl.dirtyMe = true;
      pl.socket.emit('cfFight', { A, B, ev: res.ev, win: res.win, me, pvp: 1, reward: { gold: res.win === me ? pot : 0, stake: inv.stake, elo: res.win === me ? dk : -dk } });
    }
    this.db.markDirty();
    if (inv.stake >= 100000) this.f.announce(`🐓 Trận chọi gà lớn: ${Wr.name} của ${W.c.name} thắng, ôm trọn ${pot.toLocaleString('vi-VN')} lượng!`);
  }
  // ---------- xếp hạng Sư Kê ----------
  top() {
    const rows = [];
    for (const u of Object.values(this.db.data.users)) {
      if (!u.character || u.banned || u.isAdmin || isOwner(u)) continue;
      for (const r of u.character.roosters || []) if (r.win + r.loss > 0) rows.push({ owner: u.character.name, name: r.name, breed: r.breed, lv: r.lv, stars: r.stars, elo: r.elo, win: r.win, loss: r.loss });
    }
    return rows.sort((a, b) => b.elo - a.elo || b.win - a.win).slice(0, 30);
  }
  tick(now) { for (const [k, v] of this.invites) if (now - v.at > INVITE_MS) this.invites.delete(k); }
}

module.exports = { Cockfight };
