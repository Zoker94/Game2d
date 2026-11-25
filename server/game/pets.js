// Thú cưng (Linh Thú) – bản chính thức.
//  - c.pets: [{ uid, id, q, lv, exp, star }], c.petOn: uid thú cưng đang theo (null = nghỉ).
//  - Thú cưng đang theo: cộng thuộc tính cho chủ (U.calcStats), đánh thường mỗi 2 giây và dùng kỹ năng riêng khi chủ đang giao chiến với quái.
//  - Lên cấp: chủ hạ quái (+cấp quái kinh nghiệm), cho ăn Linh Thú Đan (+300). Cấp thú cưng không vượt cấp chủ, tối đa PET_MAX_LV.
//  - Lên sao: Linh Thú Thạch + ngân lượng (0 → 5 sao).
//  - Nguồn: mua ở Kỳ Trân Các (phẩm chất Thường), nở từ Trứng Linh Thú (Boss / sự kiện) – RARE_EGG nở ra Hiếm.
const U = require('./util');
const PT = require('../data/pets');
const { PETS } = PT;

const ATK_MS = 2000, RANGE = 320, COMBAT_MS = 3000, FOOD_EXP = 300;

class Pets {
  constructor(world) { this.w = world; world.pets = this; }
  list(c) { return c.pets || (c.pets = []); }
  active(c) { return c.petOn ? this.list(c).find(x => x.uid === c.petOn) || null : null; }
  // chuyển dữ liệu bản thử nghiệm: c.pet (đang theo) -> tắt; vật phẩm pet_* trong túi vẫn dùng để thu nhận
  migrate(c) { if (c.pet) { delete c.pet; } }
  // mã hiển thị trên người chơi (ap[10]): loài + '*' nếu Hiếm
  appear(c) { const pe = this.active(c); return pe && PETS[pe.id] ? pe.id + (pe.q === 'r' ? '*' : '') : ''; }

  add(p, id, q, why) {
    const c = p.c, L = this.list(c);
    if (!PETS[id]) return false;
    if (L.length >= PT.PET_SLOTS) { this.w.toast(p, `Chuồng thú cưng đã đầy (${PT.PET_SLOTS} con) – thả bớt ở bảng 🐾 Thú cưng`, 'error'); return false; }
    const pe = { uid: U.newUid(), id, q: q === 'r' ? 'r' : 'n', lv: 1, exp: 0, star: 0, at: Date.now() };
    L.push(pe);
    if (!c.petOn) c.petOn = pe.uid;
    this.w.toast(p, `🐾 ${why || 'Thu nhận'} ${pe.q === 'r' ? '✨ HIẾM ✨ ' : ''}${PETS[id].name}! Mở bảng 🐾 Thú cưng để triệu hồi, cho ăn, nâng sao.`, 'reward');
    if (pe.q === 'r' && this.w.features) this.w.features.brag(`🐾 ${c.name} vừa có thú cưng HIẾM [${PETS[id].name}]!`);
    this.w.recalc(p); p.dirtyMe = true; this.w.db.markDirty();
    this.send(p);
    return true;
  }
  // dùng vật phẩm pet_<loài>
  useItem(p, uid, id) {
    if (this.list(p.c).length >= PT.PET_SLOTS) return this.w.toast(p, `Chuồng thú cưng đã đầy (${PT.PET_SLOTS} con)`, 'error');
    U.removeByUid(p.c, uid, 1);
    this.add(p, id, 'n');
  }
  // ấp Trứng Linh Thú
  hatch(p, uid) {
    if (this.list(p.c).length >= PT.PET_SLOTS) return this.w.toast(p, `Chuồng thú cưng đã đầy (${PT.PET_SLOTS} con)`, 'error');
    U.removeByUid(p.c, uid, 1);
    const id = PT.rollEgg(), q = Math.random() < PT.RARE_EGG ? 'r' : 'n';
    this.w.db.log('pet', `${p.c.name} ấp trứng ra ${PETS[id].name}${q === 'r' ? ' (Hiếm)' : ''}`);
    this.add(p, id, q, '🥚 Trứng nở ra');
  }

  view(p) {
    const c = p.c, L = this.list(c);
    return {
      on: c.petOn || null, slots: PT.PET_SLOTS, maxLv: PT.PET_MAX_LV, starMax: PT.PET_STAR_MAX, food: U.countItem(c, 'pet_food'), stone: U.countItem(c, 'pet_stone'), gold: c.gold,
      pets: L.map(pe => ({ uid: pe.uid, id: pe.id, q: pe.q, lv: pe.lv, exp: pe.exp, need: PT.expNeed(pe.lv), star: pe.star | 0, own: PT.ownerStats(pe), dmg: Math.round(PT.atkK(pe) * 100), cost: PT.starCost(pe.star | 0), evo: PT.evoOf(pe.id) })),
      info: Object.fromEntries(Object.values(PETS).map(P => [P.id, { name: P.name, el: P.el, color: P.color, skill: P.skill, desc: P.desc, base: P.base || null }]))
    };
  }
  send(p) { p.socket.emit('pets', this.view(p)); }

  gainExp(p, pe, n) {
    const cap = Math.min(PT.PET_MAX_LV, p.c.level);
    if (pe.lv >= cap) { pe.exp = Math.min(pe.exp + n, PT.expNeed(pe.lv) - 1); return 0; }
    let ups = 0; pe.exp += n;
    while (pe.lv < cap && pe.exp >= PT.expNeed(pe.lv)) { pe.exp -= PT.expNeed(pe.lv); pe.lv++; ups++; }
    if (pe.lv >= cap) pe.exp = Math.min(pe.exp, PT.expNeed(pe.lv) - 1);
    if (ups) { this.w.toast(p, `🐾 ${PETS[pe.id].name} lên cấp ${pe.lv}!`, 'level'); if (pe.uid === p.c.petOn) this.w.recalc(p); }
    return ups;
  }
  onKill(p, mon) {
    const pe = this.active(p.c);
    if (!pe || !mon || !mon.tpl) return;
    if (this.gainExp(p, pe, Math.max(1, mon.tpl.lv | 0)) || Math.random() < 0.05) p.dirtyMe = true;
  }

  action(p, d) {
    if (!d) return;
    const c = p.c, w = this.w, pe = d.uid ? this.list(c).find(x => x.uid === d.uid) : null;
    if (d.op === 'view') return this.send(p);
    if (d.op === 'on') {
      if (!pe) return;
      c.petOn = c.petOn === pe.uid ? null : pe.uid;
      w.toast(p, c.petOn ? `🐾 Đã triệu hồi ${PETS[pe.id].name}` : `Đã cho ${PETS[pe.id].name} nghỉ`, c.petOn ? 'reward' : 'info');
    } else if (d.op === 'feed') {
      if (!pe) return;
      const cap = Math.min(PT.PET_MAX_LV, c.level);
      if (pe.lv >= cap) return w.toast(p, pe.lv >= PT.PET_MAX_LV ? 'Thú cưng đã đạt cấp tối đa' : `Thú cưng không vượt cấp chủ (${c.level}) – lên cấp nhân vật trước`, 'error');
      const n = Math.max(1, Math.min(+d.n | 0 || 1, U.countItem(c, 'pet_food')));
      if (U.countItem(c, 'pet_food') < 1) return w.toast(p, 'Không có Linh Thú Đan – mua ở Kỳ Trân Các', 'error');
      U.removeItemById(c, 'pet_food', n);
      this.gainExp(p, pe, FOOD_EXP * n);
      w.toast(p, `🍖 ${PETS[pe.id].name} ăn ${n} Linh Thú Đan (+${FOOD_EXP * n} kinh nghiệm)`, 'reward');
    } else if (d.op === 'star') {
      if (!pe) return;
      const s = pe.star | 0;
      if (s >= PT.PET_STAR_MAX) return w.toast(p, `Đã đạt ${PT.PET_STAR_MAX} sao`, 'error');
      const cost = PT.starCost(s);
      if (U.countItem(c, 'pet_stone') < cost.stone) return w.toast(p, `Cần ${cost.stone} Linh Thú Thạch`, 'error');
      if (c.gold < cost.gold) return w.toast(p, `Cần ${cost.gold.toLocaleString('vi-VN')} lượng`, 'error');
      U.removeItemById(c, 'pet_stone', cost.stone); c.gold -= cost.gold;
      pe.star = s + 1;
      w.toast(p, `⭐ ${PETS[pe.id].name} lên ${pe.star} sao!`, 'reward');
      if (pe.star >= 4 && w.features) w.features.brag(`⭐ ${c.name} nâng thú cưng [${PETS[pe.id].name}] lên ${pe.star} sao!`);
      if (pe.uid === c.petOn) w.recalc(p);
    } else if (d.op === 'evo') {   // tiến hoá
      const ev = pe && PT.evoOf(pe.id);
      if (!ev) return;
      if (pe.lv < ev.lv || (pe.star | 0) < ev.star) return w.toast(p, `Cần thú cưng cấp ${ev.lv} và ${ev.star} sao để tiến hoá`, 'error');
      if (U.countItem(c, 'pet_stone') < ev.stone) return w.toast(p, `Cần ${ev.stone} Linh Thú Thạch`, 'error');
      if (c.gold < ev.gold) return w.toast(p, `Cần ${ev.gold.toLocaleString('vi-VN')} lượng`, 'error');
      U.removeItemById(c, 'pet_stone', ev.stone); c.gold -= ev.gold;
      const from = PETS[pe.id].name; pe.id = ev.to;
      w.toast(p, `🌟 ${from} đã TIẾN HOÁ thành ${PETS[pe.id].name}!`, 'reward');
      if (w.features) w.features.brag(`🌟 ${c.name} tiến hoá thú cưng [${from}] thành [${PETS[pe.id].name}]!`);
      w.db.log('pet', `${c.name} tiến hoá ${from} -> ${PETS[pe.id].name}`);
    } else if (d.op === 'release') {
      if (!pe) return;
      c.pets = this.list(c).filter(x => x !== pe);
      if (c.petOn === pe.uid) c.petOn = null;
      // trả lại một phần: Linh Thú Đan theo cấp, Linh Thú Thạch theo sao
      const back = Math.floor(pe.lv / 3), st = [0, 3, 9, 21, 45, 85][pe.star | 0] >> 1;
      if (back) w.giveItem(p, 'pet_food', back, 0, true);
      if (st) w.giveItem(p, 'pet_stone', st, 0, true);
      w.toast(p, `Đã thả ${PETS[pe.id].name}${back || st ? ` – nhận lại ${back ? back + ' Linh Thú Đan' : ''}${back && st ? ', ' : ''}${st ? st + ' Linh Thú Thạch' : ''}` : ''}`, 'info');
      w.db.log('pet', `${c.name} thả ${PETS[pe.id].name} cấp ${pe.lv} ${pe.star | 0} sao`);
    } else return;
    w.recalc(p); p.dirtyMe = true; w.db.markDirty();
    this.send(p);
  }

  // mỗi tick (gọi ~4 lần / giây): thú cưng đánh quái chủ đang đánh
  tick(p, now) {
    const c = p.c, pe = this.active(c);
    if (!pe || p.dead || now < (p.petNext || 0) || now - (p.lastHitMon || 0) > COMBAT_MS) return;
    const P = PETS[pe.id], w = this.w, m = w.maps[p.mapId];
    if (!P || !m) return;
    let t = p.target && m.monsters.get(p.target);
    if (!t || t.dead || U.dist(t, p) > RANGE) {
      t = null; let bd = RANGE;
      for (const mon of m.monsters.values()) {
        if (mon.dead || (mon.target !== p.userId && !mon.dmgBy.has(p.userId))) continue;
        const dd = U.dist(mon, p); if (dd < bd) { bd = dd; t = mon; }
      }
    }
    p.petNext = now + ATK_MS;
    const sk = P.skill, useSk = now >= (p.petCd || 0);
    if (useSk) p.petCd = now + sk.cd;
    if (useSk && sk.k === 'heal') {   // hồi máu chủ (không cần mục tiêu)
      const amt = Math.round(p.stats.maxHp * (sk.v + 0.01 * (pe.star | 0)) * PT.qK(pe.q));
      w.fx(p.mapId, { t: 'petatk', id: p.id, sk: 1, x: p.x, y: p.y });
      setTimeout(() => {
        if (p.dead) return;
        p.c.hp = Math.min(p.stats.maxHp, p.c.hp + amt); p.dirtyMe = true;
        w.io.to('map:' + p.mapId).emit('dmg', { id: p.id, v: amt, k: 'heal' });
      }, 400);
      return;
    }
    if (!t) return;
    const k = PT.atkK(pe) * (useSk ? sk.v : 1);
    w.fx(p.mapId, { t: useSk && pe.id === 'hong_long' ? 'petfire' : 'petatk', id: p.id, to: t.id, x: t.x, y: t.y, sk: useSk ? 1 : 0 });
    setTimeout(() => {
      if (t.dead || p.mapId !== t.mapId || p.dead) return;
      const hit = mon => {
        const { dmg, crit } = w.calcDamage(p.stats.atk * k, p.stats.crit, mon.tpl.def, 1, 0.3);
        w.applyDamage(mon, Math.round(dmg), p, crit ? 'crit' : 'hit');
        if (!useSk || mon.dead) return;
        if (sk.stun) w.applyStatus(mon, 'stun', sk.stun, p);
        if (sk.burn) w.applyStatus(mon, 'burn', sk.burn, p);
      };
      hit(t);
      if (useSk && sk.k === 'aoe') {
        let n = 1;
        for (const mon of m.monsters.values()) {
          if (n >= sk.n) break;
          if (mon === t || mon.dead || mon.cart || U.dist(mon, t) > sk.r) continue;
          hit(mon); n++;
        }
      }
    }, useSk ? 450 : 300);
  }
}

module.exports = { Pets };
