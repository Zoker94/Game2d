// Câu cá & nấu ăn.
// - Đứng sát mép nước (sông, hồ ở mọi bản đồ, kể cả thành và khu VIP), có Cần Câu + Mồi Câu: bấm 🎣 Câu cá (hoặc dùng Cần Câu).
//   Chờ 5-12 giây phao chìm ("Cá cắn câu!") thì bấm Giật cần trong 1,6 giây, rồi chơi minigame KÉO CÁ (giữ để kéo vạch,
//   nhả cho chìm, giữ vạch trong vùng cá tới khi đầy thanh). Giật sớm, chậm hay để cá sổng đều mất mồi.
//   Di chuyển hoặc bị đánh thì thu cần (không mất mồi). Không có tự giật cần (kể cả có Vé Treo Máy).
// - Chống câu tự động (4 lớp):
//   1. Minigame kéo cá: máy khách gửi lên dãy thời điểm giữ / nhả, máy chủ chạy lại mô phỏng (public/js/fishsim.js)
//      với seed của mình để xác nhận, đối chiếu thời gian thật.
//   2. Phản xạ "không giống người": giật cần nhanh hơn 150ms, hoặc 12 lần gần nhất đều tăm tắp (độ lệch < 40ms) -> hỏi mã.
//   3. Mã xác nhận ngẫu nhiên mỗi 20-50 lần câu (ảnh máy chủ vẽ, server/game/capimg.js). Sai 3 lần / quá 30 giây: cấm câu 30 phút.
//   4. Thể lực câu: 300 lần thả câu / ngày; câu liền một mạch quá 60 lần thì tỉ lệ cá hiếm giảm dần (nghỉ 10 phút thì hồi).
// - Cá theo cấp bãi: bãi cao, ban đêm dễ ra cá hiếm hơn. Có rác, có rương báu. Mỗi con có cân nặng – lưu kỷ lục.
// - Nấu ăn ở Đầu Bếp Tửu Lâu (Tương Dương): món ăn cộng kinh nghiệm / công / thủ / máu trong 30-90 phút (mỗi lúc 1 món).
//   Mỗi món cần đủ từng loại cá cụ thể (phải phối nhiều loại cá). Cá bán lại cho Đầu Bếp (tab Bán cá).
// - 5 loại cần câu (sức 1..5, có độ bền) và 5 loại mồi (server/data/fish.js):
//   cần yếu hơn sức cá thì minigame rất khó (vùng cá hẹp, cá vọt nhanh) và dễ gãy cần; gần hết độ bền cũng dễ gãy.
//   Mồi tốt tăng tỉ lệ cá hiếm, cắn nhanh hơn, ít rác; cá dữ (cá sấu, cá mập) chỉ mê mồi thịt / cá mồi sống.
const U = require('./util');
const { MAPS, TILE } = require('../data/maps');
const { ITEMS } = require('../data/items');

const WATER = 2;
const { FISH, RODS, BAITS, DISHES } = require('../data/fish');
const FOOD_MAX = 8 * 3600e3;   // món ăn cộng dồn tối đa 8 giờ
const WAIT = [5000, 12000], BITE_MS = 1600;
const SIM = require('../../public/js/fishsim');
const STA_MAX = 300, SESS_FREE = 60, CAP_TIME = 30000, BAN_MS = 30 * 60000, RT_MIN = 150;
const BY_G = g => Object.keys(FISH).filter(id => FISH[id].g === g);
const ROD_IDS = Object.keys(RODS), BAIT_IDS = Object.keys(BAITS);
const NO_FISH = m => m.tongkim || m.siege || m.hoason || m.tourney || m.duelArena || m.id === 'dai_hoi';

class Fishing {
  constructor(world, features, db) {
    this.w = world; this.f = features; this.db = db;
    world.fishing = this;
  }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }
  // ô nước gần nhất trong bán kính ~1,7 ô quanh người chơi
  waterNear(p) {
    const m = MAPS[p.mapId]; if (!m || !m.tiles) return null;
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    let best = null, bd = 1e9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= m.w || y >= m.h || m.tiles[y * m.w + x] !== WATER) continue;
      const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE, d = Math.hypot(cx - p.x, cy - p.y);
      if (d < bd) { bd = d; best = { x: cx, y: cy }; }
    }
    return best && bd < TILE * 1.75 ? best : null;
  }

  // ---------- câu ----------
  action(p, d) {
    if (!d) return;
    if (d.op === 'cast') return this.cast(p);
    if (d.op === 'hook') return this.hook(p);
    if (d.op === 'fight') return this.fightEnd(p, d);
    if (d.op === 'stop') return this.stop(p, true);
    if (d.op === 'cook') return this.cook(p, String(d.id || ''), d.n);
    if (d.op === 'cookView') return p.socket.emit('cook', this.cookView(p));
    if (d.op === 'top') return this.w.nearNpc(p, 'dau_bep') ? p.socket.emit('fishTop', this.top(p)) : this.toast(p, 'Bảng Thánh Câu chỉ xem được ở Đầu Bếp Tửu Lâu', 'error');
    if (d.op === 'sell') return this.sell(p, String(d.id || ''), d.n);
    if (d.op === 'rod') return this.selectRod(p, String(d.id || ''));
    if (d.op === 'bait') return this.selectBait(p, String(d.id || ''));
  }
  // cần / mồi đang dùng: chọn sẵn (còn trong túi) hoặc cần tốt nhất / mồi rẻ nhất đang có
  rodOf(c) { if (c.rodSel && RODS[c.rodSel] && U.countItem(c, c.rodSel)) return c.rodSel; for (let i = ROD_IDS.length - 1; i >= 0; i--) if (U.countItem(c, ROD_IDS[i])) return ROD_IDS[i]; return null; }
  baitOf(c) { if (c.baitSel && BAITS[c.baitSel] && U.countItem(c, c.baitSel)) return c.baitSel; return BAIT_IDS.find(id => U.countItem(c, id)) || null; }
  durOf(c, id) { const d = c.rodDur && c.rodDur[id]; return d == null ? RODS[id].dur : d; }
  selectRod(p, id) {
    if (!RODS[id] || !U.countItem(p.c, id)) return;
    p.c.rodSel = id; p.dirtyMe = true;
    this.toast(p, `🎣 Đang dùng ${RODS[id].name} (sức ${'★'.repeat(RODS[id].p)}, bền ${this.durOf(p.c, id)}/${RODS[id].dur})`, 'info');
    p.socket.emit('cook', this.cookView(p));
  }
  selectBait(p, id) {
    if (!BAITS[id] || !U.countItem(p.c, id)) return;
    p.c.baitSel = id; p.dirtyMe = true;
    this.toast(p, `🪱 Đang dùng mồi ${BAITS[id].name}`, 'info');
    p.socket.emit('cook', this.cookView(p));
  }
  cast(p, rodId) {
    const c = p.c;
    if (rodId && RODS[rodId] && U.countItem(c, rodId)) c.rodSel = rodId;   // dùng cần trong túi = chọn cần đó
    if (p.dead) return;
    if (p.fishing) return;
    const def = this.w.maps[p.mapId].def;
    if (NO_FISH(def)) return this.toast(p, 'Không câu cá được ở đây', 'error');
    const rod = this.rodOf(c), bait = this.baitOf(c);
    if (!rod) return this.toast(p, 'Cần có cần câu (Đầu Bếp Tửu Lâu ở Tương Dương bán)', 'error');
    if (!bait) return this.toast(p, 'Hết mồi câu (Đầu Bếp Tửu Lâu ở Tương Dương bán)', 'error');
    const wt = this.waterNear(p);
    if (!wt) return this.toast(p, 'Hãy đứng sát mép nước để câu', 'error');
    if (Date.now() - (p.lastCombat || 0) < 3000) return this.toast(p, 'Đang giao chiến, chưa câu được', 'error');
    const now = Date.now();
    if ((c.fishBan || 0) > now) return this.toast(p, `🚫 Bị cấm câu cá do không qua kiểm tra chống tự động – còn ${Math.ceil((c.fishBan - now) / 60000)} phút`, 'error');
    if (p.fishCap) return this.capAsk(p, true);   // còn mã xác nhận chưa trả lời
    if (p.fishCapDue) return this.capAsk(p);
    const sta = this.sta(c);
    if (sta.n >= STA_MAX) return this.toast(p, `😮‍💨 Hết thể lực câu hôm nay (${STA_MAX} lần). Mai câu tiếp nhé!`, 'error');
    sta.n++;
    const ss = c.fishSess && now - c.fishSess.last < 10 * 60000 ? c.fishSess : (c.fishSess = { n: 0 });
    ss.n++; ss.last = now;
    const wait = Math.round(U.randInt(WAIT[0], WAIT[1]) * BAITS[bait].wait);
    p.fishing = { st: 'wait', x: p.x, y: p.y, wx: wt.x, wy: wt.y, biteAt: now + wait, end: 0, rod, bait };
    p.dirtyMe = true;
    p.socket.emit('fish', { st: 'wait', wx: wt.x, wy: wt.y, sta: STA_MAX - sta.n, tired: ss.n > SESS_FREE, rod, bait, dur: this.durOf(c, rod), max: RODS[rod].dur });
    this.w.io.to('map:' + p.mapId).emit('fishLine', { id: p.id, wx: wt.x, wy: wt.y, rod });
  }
  stop(p, quiet) {
    if (!p.fishing) return;
    p.fishing = null;
    p.socket.emit('fish', { st: 'off' });
    this.w.io.to('map:' + p.mapId).emit('fishLine', { id: p.id, off: 1 });
    if (!quiet) this.toast(p, '🎣 Đã thu cần', 'info');
  }
  // di chuyển xa chỗ câu / bị đánh: thu cần, không mất mồi
  onMove(p) { const f = p.fishing; if (f && Math.hypot(p.x - f.x, p.y - f.y) > 24) this.stop(p); }
  onHurt(p) { if (p.fishing) this.stop(p); }
  useBait(p) { const f = p.fishing, b = f && f.bait && U.countItem(p.c, f.bait) ? f.bait : this.baitOf(p.c); if (b) U.removeItemById(p.c, b, 1); p.dirtyMe = true; }
  sta(c) { const s = c.fishSta && c.fishSta.day === U.vnDay() ? c.fishSta : (c.fishSta = { day: U.vnDay(), n: 0 }); return s; }
  // giật cần: đo thời gian phản xạ rồi vào minigame kéo cá (nhóm cá đã chọn sẵn – cá càng hiếm càng khó kéo)
  hook(p) {
    const f = p.fishing; if (!f) return;
    const now = Date.now();
    if (f.st === 'wait') { this.useBait(p); this.stop(p, true); return p.socket.emit('fish', { st: 'miss', why: 'early' }); }
    if (f.st !== 'bite') return;
    this.reaction(p, now - f.bitSent);
    const B = BAITS[f.bait] || BAITS.moi_cau, R = RODS[f.rod] || RODS.can_cau;
    f.g = this.roll(p, B);
    f.fish = f.g === 'junk' || f.g === 'treasure' ? null : this.pick(p, f.g, B);
    const dg = f.fish ? FISH[f.fish].g : 'c', lv = f.fish ? FISH[f.fish].lv : 1;
    f.lv = lv; f.mod = { rod: R.p - lv, grip: B.grip };
    f.st = 'fight'; f.dg = dg; f.seed = (Math.random() * 4294967296) >>> 0; f.fightAt = now; f.end = now + (SIM.MAX_T + 6) * 1000;
    p.socket.emit('fish', { st: 'fight', seed: f.seed, g: dg, mod: f.mod, lv, rp: R.p, big: f.fish && FISH[f.fish].pred ? 1 : 0 });
  }
  // kết thúc minigame: chạy lại mô phỏng bằng seed của máy chủ để xác nhận
  fightEnd(p, d) {
    const f = p.fishing; if (!f || f.st !== 'fight') return;
    const now = Date.now(), inputs = Array.isArray(d.inputs) ? d.inputs.slice(0, 600).map(Number) : [];
    let ok = inputs.every((t, i) => Number.isFinite(t) && t >= 0 && (i === 0 || t >= inputs[i - 1]));
    const r = ok ? SIM.replay(f.seed, f.dg, inputs, f.mod) : { ok: false, t: 0, steps: 0 };
    const elapsed = (now - f.fightAt) / 1000;
    // thời gian thật phải khớp thời gian mô phỏng (không thể "tua nhanh"); cho trễ mạng tối đa 4 giây
    if (!(r.steps === (d.steps | 0)) || elapsed < r.t - 0.35 || elapsed > r.t + 4) ok = false;
    if (ok && r.ok && !d.ok) ok = false;
    this.useBait(p);
    this.stop(p, true);
    // cần câu: hao bền theo sức cá; cá khoẻ hơn cần / gần hết bền thì có thể gãy (cá thoát)
    if (f.rod && RODS[f.rod] && U.countItem(p.c, f.rod) && ok) {
      const R = RODS[f.rod], c = p.c; c.rodDur = c.rodDur || {};
      const left = this.durOf(c, f.rod) - (f.lv || 1);
      const brk = left <= 0 || Math.random() < Math.pow(1 - Math.max(0, left) / R.dur, 2) * 0.12 + Math.max(0, (f.lv || 1) - R.p) * 0.07;
      if (brk) {
        U.removeItemById(c, f.rod, 1); delete c.rodDur[f.rod]; p.dirtyMe = true; this.db.markDirty();
        this.w.io.to('map:' + p.mapId).emit('fishLine', { id: p.id, off: 1, snap: 1 });
        return p.socket.emit('fish', { st: 'broke', rod: f.rod, fish: f.fish, left: U.countItem(c, f.rod) });
      }
      c.rodDur[f.rod] = left;
    }
    if (!ok || !r.ok) {
      if (r.ok && !ok) this.db.log('fish', `${p.c.name}: kết quả kéo cá không khớp mô phỏng (bỏ qua)`);
      return p.socket.emit('fish', { st: 'miss', why: 'escape', fish: f.fish, lv: f.lv });
    }
    const got = this.land(p, f.g, f.fish);
    if (got && this.w.guildx && /^fish_/.test(got) && got !== 'fish_junk') this.w.guildx.progress(p, 'fish');
    if (got) this.w.io.to('map:' + p.mapId).emit('fishLine', { id: p.id, off: 1, got });
    const c = p.c;   // mã xác nhận ngẫu nhiên mỗi 20-50 lần câu được
    if (c.fishCapIn == null) c.fishCapIn = U.randInt(20, 50);
    if (--c.fishCapIn <= 0) p.fishCapDue = 'random';
  }
  // ---------- phản xạ & mã xác nhận ----------
  reaction(p, rt) {
    if (!(rt >= 0)) return;
    const a = p.fishRt || (p.fishRt = []);
    a.push(rt); if (a.length > 12) a.shift();
    if (rt < RT_MIN) p.fishFast = (p.fishFast || 0) + 1;
    let sus = (p.fishFast || 0) >= 2;
    if (a.length >= 12) { const m = a.reduce((x, y) => x + y, 0) / a.length, sd = Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length); if (sd < 40) sus = true; }
    if (sus && !p.fishCapDue) { p.fishCapDue = 'reflex'; this.db.log('fish', `${p.c.name}: phản xạ câu cá bất thường (${a.slice(-5).join(', ')} ms)`); }
  }
  capAsk(p, again) {
    const now = Date.now();
    if (!p.fishCap || !again) {
      const { code, img } = require('./capimg').make();
      p.fishCap = { code, img, until: now + CAP_TIME, tries: p.fishCap ? p.fishCap.tries : 0, why: p.fishCapDue || 'random' };
    }
    p.socket.emit('captcha', { kind: 'fish', img: p.fishCap.img, left: Math.max(1000, p.fishCap.until - now) });
  }
  capAnswer(p, d) {
    const cap = p.fishCap; if (!cap) return;
    const now = Date.now();
    if (now > cap.until) return this.capFail(p);
    if (String(d && d.code || '') === cap.code) {
      p.fishCap = null; p.fishCapDue = null; p.fishFast = 0; p.fishRt = []; p.c.fishCapIn = U.randInt(20, 50);
      return p.socket.emit('captcha', { ok: 1, kind: 'fish' });
    }
    if (++cap.tries >= 3) return this.capFail(p);
    p.fishCap = null; p.fishCapDue = cap.why; this.capAsk(p); p.fishCap.tries = cap.tries; p.fishCap.until = cap.until;
    p.socket.emit('toast', { text: `Sai mã xác nhận (còn ${3 - cap.tries} lần)`, type: 'error' });
  }
  capFail(p) {
    const why = p.fishCap && p.fishCap.why;
    p.fishCap = null; p.fishCapDue = null; p.fishFast = 0; p.fishRt = [];
    p.c.fishBan = Date.now() + BAN_MS; p.dirtyMe = true; this.db.markDirty();
    this.stop(p, true);
    p.socket.emit('captcha', { close: 1 });
    this.toast(p, '🚫 Không qua kiểm tra chống câu tự động – bị cấm câu cá 30 phút', 'error');
    this.db.log('fish', `${p.c.name} bị cấm câu cá 30 phút (không qua mã xác nhận, lý do hỏi: ${why})`);
  }
  tick(now) {
    for (const p of this.w.players.values()) {
      const f = p.fishing; if (!f) continue;
      if (p.dead || !this.w.players.has(p.userId)) { p.fishing = null; continue; }
      if (f.st === 'wait' && now >= f.biteAt) {
        f.st = 'bite'; f.end = now + BITE_MS; f.bitSent = now;
        p.socket.emit('fish', { st: 'bite', ms: BITE_MS });
        this.w.io.to('map:' + p.mapId).emit('fishLine', { id: p.id, bite: 1 });   // người xung quanh thấy cần oằn
      } else if ((f.st === 'bite' || f.st === 'fight') && now > f.end) {   // không giật kịp / bỏ dở minigame
        this.useBait(p); this.stop(p, true); p.socket.emit('fish', { st: 'miss', why: f.st === 'bite' ? 'late' : 'escape' });
      }
    }
    for (const p of this.w.players.values()) if (p.fishCap && now > p.fishCap.until) this.capFail(p);   // mã xác nhận quá giờ
    // món ăn hết hạn: tính lại chỉ số
    if (now - (this._ft || 0) > 10000) {
      this._ft = now;
      for (const p of this.w.players.values()) if (p._foodOn && !(p.c.food && p.c.food.until > now)) { p._foodOn = false; this.w.recalc(p); this.toast(p, '🍲 Hiệu quả món ăn đã hết', 'info'); }
    }
  }
  // kéo cá lên: bảng tỉ lệ theo cấp bãi (tier) và ban đêm
  roll(p, B) {
    B = B || BAITS.moi_cau;
    const def = this.w.maps[p.mapId].def, tier = def.tier || 0, night = this.w.night && this.w.night.isNight();
    const ss = p.c.fishSess, tired = ss && ss.n > SESS_FREE ? Math.max(0.35, 1 - (ss.n - SESS_FREE) / 200) : 1;   // câu liền quá lâu: cá hiếm giảm
    const k = (night ? 1.5 : 1) * tired;
    const tbl = [['junk', 7 * B.junk], ['treasure', 2.5], ['c', 68], ['r', (14 + tier * 2) * k * B.boost.r], ['e', (2 + tier * 0.6) * k * B.boost.e], ['l', (0.25 + tier * 0.08) * k * B.boost.l]];
    let r = Math.random() * tbl.reduce((a, x) => a + x[1], 0), g = 'c';
    for (const [kk, w] of tbl) if ((r -= w) < 0) { g = kk; break; }
    return g;
  }
  // chọn con cá cụ thể trong nhóm: theo cấp bãi (cá chỉ có ở bãi cao) và mồi (cá dữ mê mồi thịt / cá sống)
  pick(p, g, B) {
    const tier = this.w.maps[p.mapId].def.tier || 0;
    let pool = BY_G(g).filter(id => !FISH[id].tier || tier >= FISH[id].tier);
    if (!pool.length) pool = BY_G(g).filter(id => !FISH[id].tier);
    const wt = id => FISH[id].pred ? B.pred : (B.pred >= 4 ? 0.5 : 1);   // mồi thịt: cá thường ít cắn
    let r = Math.random() * pool.reduce((a, id) => a + wt(id), 0);
    for (const id of pool) if ((r -= wt(id)) < 0) return id;
    return pool[0];
  }
  land(p, g, fid) {
    const c = p.c; g = g || this.roll(p);
    c.fishN = (c.fishN || 0) + 1;
    if (g === 'junk') { this.w.giveItem(p, 'fish_junk', 1); p.socket.emit('fish', { st: 'got', id: 'fish_junk' }); return 'fish_junk'; }
    if (g === 'treasure') {
      const GEMS = ['ruby', 'emerald', 'sapphire', 'topaz', 'amethyst'], x = Math.random();
      const id = x < 0.45 ? 'stone' : x < 0.75 ? `gem_${GEMS[U.randInt(0, 4)]}_${Math.random() < 0.75 ? 1 : 2}` : x < 0.95 ? 'lucky_chest' : 'boss_chest';
      this.w.giveItem(p, id, id === 'stone' ? U.randInt(2, 4) : 1);
      p.socket.emit('fish', { st: 'got', id, treasure: 1 });
      if (id === 'boss_chest') this.f.brag(`🎣 ${c.name} câu được Rương Thủ Lĩnh dưới đáy ${MAPS[p.mapId].name}!`);
      return 'fish_junk';
    }
    const id = fid || this.pick(p, g, BAITS.moi_cau), fd = FISH[id];
    const kg = Math.round((fd.kg[0] + Math.pow(Math.random(), 2.2) * (fd.kg[1] - fd.kg[0])) * 10) / 10;
    this.w.giveItem(p, id, 1);
    const best = c.fishBest || (c.fishBest = {});
    const rec = !best[id] || kg > best[id];
    if (rec) best[id] = kg;
    p.dirtyMe = true; this.db.markDirty();
    p.socket.emit('fish', { st: 'got', id, kg, rec });
    if (g === 'l') this.f.brag(`🐉 ${c.name} câu được ${ITEMS[id].name} nặng ${kg} cân tại ${MAPS[p.mapId].name}!`);
    else if (fd.pred) this.f.brag(`🦈 ${c.name} kéo được ${ITEMS[id].name} nặng ${kg} cân tại ${MAPS[p.mapId].name}!`);
    else if (g === 'e' && kg >= 20) this.f.brag(`🎣 ${c.name} câu được ${ITEMS[id].name} ${kg} cân!`);
    return id;
  }

  // ---------- nấu ăn ----------
  have(c, key) { return key.length === 1 ? BY_G(key).reduce((a, id) => a + U.countItem(c, id), 0) : U.countItem(c, key); }
  take(c, key, n) {
    if (key.length !== 1) return U.removeItemById(c, key, n);
    for (const id of BY_G(key)) {   // cá thường / hiếm: dùng con rẻ trước
      const k = Math.min(n, U.countItem(c, id)); if (k) { U.removeItemById(c, id, k); n -= k; }
      if (!n) break;
    }
  }
  cook(p, id, n) {
    const r = DISHES[id]; if (!r) return;
    if (!this.w.nearNpc(p, 'dau_bep')) return this.toast(p, 'Hãy đến gặp Đầu Bếp Tửu Lâu', 'error');
    n = U.clamp(n | 0 || 1, 1, 10);
    const c = p.c;
    for (const [k, q] of r.need) if (this.have(c, k) < q * n) return this.toast(p, 'Không đủ nguyên liệu', 'error');
    if (c.gold < r.gold * n) return this.toast(p, `Cần ${(r.gold * n).toLocaleString('vi-VN')} lượng`, 'error');
    if (!U.addItem(c, id, n)) return this.toast(p, 'Túi đồ đầy', 'error');
    for (const [k, q] of r.need) this.take(c, k, q * n);
    c.gold -= r.gold * n;
    p.dirtyMe = true; this.db.markDirty();
    this.toast(p, `🍲 Nấu xong ${ITEMS[id].name} x${n}`, 'reward');
    p.socket.emit('cook', this.cookView(p));
  }
  // ăn (dùng vật phẩm món ăn): thay món đang có
  eat(p, id) {
    const r = DISHES[id]; if (!r) return false;
    const now = Date.now(), cur = p.c.food && p.c.food.until > now ? p.c.food : null;
    if (cur && cur.id === id) {   // cùng món: cộng dồn thời gian (tối đa 8 giờ)
      if (cur.until - now >= FOOD_MAX - 60000) { this.toast(p, `🍲 ${ITEMS[id].name} đã cộng dồn tối đa 8 giờ`, 'error'); return false; }
      cur.until = Math.min(now + FOOD_MAX, cur.until + r.min * 60000);
    } else p.c.food = { id, until: now + r.min * 60000 };   // món khác: thay món cũ
    const left = Math.round((p.c.food.until - now) / 60000);
    p._foodOn = true; this.w.recalc(p); p.dirtyMe = true;
    this.toast(p, `🍲 Đã ăn ${ITEMS[id].name}: ${this.buffText(r.buff)} – còn ${left >= 60 ? Math.floor(left / 60) + ' giờ ' + (left % 60) + ' phút' : left + ' phút'}${cur && cur.id !== id ? ` (thay ${ITEMS[cur.id].name})` : ''}`, 'reward');
    return true;
  }
  buffText(b) { return [b.exp ? `+${Math.round(b.exp * 100)}% kinh nghiệm` : '', b.atk ? `+${Math.round(b.atk * 100)}% công` : '', b.def ? `+${Math.round(b.def * 100)}% thủ` : '', b.hp ? `+${Math.round(b.hp * 100)}% máu tối đa` : ''].filter(Boolean).join(', '); }
  // buff món ăn đưa vào tính chỉ số (world.recalc) và kinh nghiệm (world.expMultiplier)
  foodBuff(c) { const f = c.food; if (!f || f.until <= Date.now() || !DISHES[f.id]) return null; const b = DISHES[f.id].buff; return { name: ITEMS[f.id].name, until: f.until, atk: b.atk || 0, def: b.def || 0, hp: b.hp || 0 }; }
  expMul(c) { const f = c.food; return f && f.until > Date.now() && DISHES[f.id] ? 1 + (DISHES[f.id].buff.exp || 0) : 1; }
  // ---------- 🏆 Thánh Câu: xếp hạng theo con cá quý nhất (độ hiếm rồi cân nặng) + kỷ lục cân nặng từng loại cá ----------
  // tính từ c.fishBest của mọi nhân vật (tài khoản quản trị không xếp hạng), nhớ 30 giây
  top(p) {
    const now = Date.now();
    if (!this._top || now - this._top.at > 30000) {
      const { isOwner } = require('../owner'), GR = { c: 1, r: 2, e: 3, l: 4 };
      const users = Object.values(this.db.data.users).filter(u => u.character && !u.banned && !u.isAdmin && !isOwner(u) && !u.streamer && u.character.fishBest);
      const rec = {}, rows = [];
      for (const u of users) {
        const c = u.character; let best = null;
        for (const [id, kg] of Object.entries(c.fishBest)) {
          const f = FISH[id]; if (!f) continue;
          if (!rec[id] || kg > rec[id].kg) rec[id] = { name: c.name, kg, uid: u.id };
          const sc = GR[f.g] * 1e6 + f.lv * 1e4 + kg;   // cá hiếm hơn đứng trên, cùng hạng thì nặng hơn đứng trên
          if (!best || sc > best.sc) best = { id, kg, sc };
        }
        if (best) rows.push({ uid: u.id, name: c.name, cls: c.cls, id: best.id, kg: best.kg, sc: best.sc, n: c.fishN || 0 });
      }
      rows.sort((a, b) => b.sc - a.sc);
      this._top = { at: now, rows, rec };
    }
    const T = this._top, mine = T.rows.findIndex(r => r.uid === p.userId);
    return {
      rows: T.rows.slice(0, 30).map((r, i) => ({ rank: i + 1, name: r.name, cls: r.cls, id: r.id, kg: r.kg, n: r.n, me: r.uid === p.userId })),
      me: mine >= 0 ? { rank: mine + 1, id: T.rows[mine].id, kg: T.rows[mine].kg } : null,
      rec: Object.keys(FISH).map(id => ({ id, name: FISH[id].name, g: FISH[id].g, holder: T.rec[id] ? T.rec[id].name : null, kg: T.rec[id] ? T.rec[id].kg : 0, me: T.rec[id] && T.rec[id].uid === p.userId, mine: (p.c.fishBest || {})[id] || 0 }))
    };
  }
  // bán cá cho Đầu Bếp: id cụ thể hoặc 'all' (mọi loại cá, chừa lại cá đang thiếu cho món nào? – không, bán hết loại được chọn)
  sell(p, id, n) {
    if (!this.w.nearNpc(p, 'dau_bep')) return this.toast(p, 'Hãy đến gặp Đầu Bếp Tửu Lâu để bán cá', 'error');
    const c = p.c, ids = id === 'all' ? Object.keys(FISH).filter(k => FISH[k].g === 'c') : FISH[id] || id === 'fish_junk' ? [id] : [];
    let gold = 0, cnt = 0;
    for (const k of ids) {
      const have = U.countItem(c, k); if (!have) continue;
      const q = id === 'all' ? have : U.clamp(n | 0 || have, 1, have), price = k === 'fish_junk' ? 5 : FISH[k].sell;
      U.removeItemById(c, k, q); gold += price * q; cnt += q;
    }
    if (!cnt) return this.toast(p, 'Không có cá để bán', 'error');
    c.gold += gold; p.dirtyMe = true; this.db.markDirty();
    this.toast(p, `💰 Bán ${cnt} con cá được ${gold.toLocaleString('vi-VN')} lượng`, 'reward');
    p.socket.emit('cook', this.cookView(p));
  }
  cookView(p) {
    const c = p.c, fishName = k => k === 'c' ? 'Cá thường bất kỳ' : k === 'r' ? 'Cá hiếm bất kỳ' : (ITEMS[k] || {}).name || k;
    const rod = this.rodOf(c), bait = this.baitOf(c);
    return {
      dishes: Object.entries(DISHES).map(([id, r]) => ({ id, name: ITEMS[id].name, gold: r.gold, min: r.min, buff: this.buffText(r.buff),
        need: r.need.map(([k, q]) => ({ k, name: fishName(k), q, have: this.have(c, k) })) })),
      fish: Object.entries(FISH).map(([id, f]) => ({ id, name: f.name, g: f.g, lv: f.lv, sell: f.sell, have: U.countItem(c, id), pred: f.pred || 0, tier: f.tier || 0 })).concat([{ id: 'fish_junk', name: 'Giày Rách', g: 'j', lv: 0, sell: 5, have: U.countItem(c, 'fish_junk') }]),
      rods: ROD_IDS.map(id => ({ id, name: RODS[id].name, p: RODS[id].p, max: RODS[id].dur, dur: this.durOf(c, id), have: U.countItem(c, id), price: RODS[id].price, on: id === rod })),
      baits: BAIT_IDS.map(id => ({ id, name: BAITS[id].name, have: U.countItem(c, id), price: BAITS[id].price, desc: BAITS[id].desc, on: id === bait })),
      food: c.food && c.food.until > Date.now() ? { id: c.food.id, until: c.food.until, name: ITEMS[c.food.id].name } : null,
      fishN: c.fishN || 0, best: Object.entries(c.fishBest || {}).map(([id, kg]) => ({ id, name: ITEMS[id].name, kg })).sort((a, b) => b.kg - a.kg)
    };
  }
}

module.exports = { Fishing, FISH, DISHES, RODS, BAITS };
