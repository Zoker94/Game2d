// Thú cưng (Linh Thú) – bản chính thức. Thú cưng đi / bay theo sau chủ; máy chủ báo "petatk" (đánh thường / kỹ năng)
// thì lao tới mục tiêu, "petfire" (Hồng Long dùng kỹ năng) thì bay tới phun lửa. Loài có '*' trong mã hiển thị = phẩm chất Hiếm (hào quang).
// Hình: public/assets/pets/<loài>.png + .json. Hồng Long có nhiều khung; các loài khác 1 khung mỗi tư thế, chuyển động làm bằng code.
(function () {
  const V = window.AV ? '?v=' + window.AV : '';
  const PETS = {
    hong_long: { fly: 1, fireX: 0.83, glow: '#ff8a30' },
    fauna:     { fly: 1, glow: '#9effa0' },
    fauna2:    { glow: '#7cff8a' },   // Mộc Linh Hộ Vệ (tiến hoá của Tiên Mộc Linh): đi bộ cầm giáo
    gears:     { glow: '#8fd0ff' },
    arcana:    { glow: '#d29cff' },
    ember:     { glow: '#ffa040' }
  };
  const res = {};
  for (const id in PETS) {
    const r = res[id] = { img: new Image(), meta: null };
    r.img.src = `/assets/pets/${id}.png${V}`;
    fetch(`/assets/pets/${id}.json${V}`).then(x => x.json()).then(j => { r.meta = j; }).catch(() => { });
  }
  const ready = id => res[id] && res[id].meta && res[id].img.complete && res[id].img.naturalWidth;
  const states = new Map();   // id chủ -> trạng thái thú cưng
  const FIRE_MS = 6 * 85, FIRE_HOLD = 260, ACT_MS = 650;

  function ownerOf(id) { return id === G.you ? G.self : G.players.get(id); }
  function petCode(id) { const ap = id === G.you ? G.me && G.me.ap : (G.players.get(id) || {}).ap; return ap && ap[10] || ''; }

  function step(id, e, now) {
    const code = petCode(id), pid = code.replace('*', ''), rare = code.endsWith('*');
    if (!pid || !PETS[pid] || !ready(pid)) { states.delete(id); return null; }
    const P = PETS[pid];
    let s = states.get(id);
    const face = e.lastH === 1 || e.dir === 1 ? 1 : (e.lastH === 2 || e.dir === 2 ? 2 : (s ? s.ownerFace : 2));
    if (!s || s.pid !== pid || Math.hypot(s.x - e.x, s.y - e.y) > 900) s = { pid, x: e.x - 60, y: e.y, alt: P.fly ? 30 : 0, face: 2, t: now, still: now, ownerFace: 2, ox: e.x, oy: e.y };
    s.rare = rare;
    const dt = Math.min(0.05, (now - s.t) / 1000); s.t = now;
    s.ownerFace = face;
    if (Math.abs(e.x - s.ox) + Math.abs(e.y - s.oy) > 1) s.still = now;
    s.ox = e.x; s.oy = e.y;
    const meta = res[pid].meta, CW = meta.w;
    const fire = s.fire && now - s.fire.t0 < FIRE_MS + FIRE_HOLD ? s.fire : null;
    const act = s.act && now - s.act.t0 < ACT_MS ? s.act : null;
    let tx, ty, talt;
    if (fire) {   // Hồng Long: bay tới chỗ để luồng lửa (mép phải khung) rơi đúng mục tiêu
      s.face = fire.tx >= e.x ? 2 : 1;
      const off = (P.fireX - 0.5) * CW;
      tx = fire.tx + (s.face === 2 ? -off : off); ty = fire.ty; talt = 0;
    } else if (act && act.to) {   // lao tới cạnh mục tiêu rồi quay về
      s.face = act.tx >= s.x ? 2 : 1;
      const k = (now - act.t0) / ACT_MS, near = k < 0.6;
      tx = near ? act.tx + (act.tx >= e.x ? -26 : 26) : e.x + (face === 1 ? 1 : -1) * 52;
      ty = near ? act.ty : e.y - 4; talt = P.fly ? 14 : 0;
    } else {
      const behind = face === 1 ? 1 : -1;   // đứng sau lưng chủ
      tx = e.x + behind * 52; ty = e.y - 4;
      const resting = now - s.still > 1400 && Math.hypot(s.x - tx, s.y - ty) < 30;
      talt = P.fly ? (resting && pid === 'hong_long' ? 0 : 26 + Math.sin(now / 380 + id.length) * 5) : 0;
    }
    const kk = 1 - Math.exp(-dt * (fire || act ? 14 : 5));
    const vx = (tx - s.x) * kk, vy = (ty - s.y) * kk;
    s.x += vx; s.y += vy;
    s.speed = Math.hypot(vx, vy) / Math.max(dt, 0.001);
    // hướng mặt (hình gốc quay sang phải, quay trái thì lật): đang di chuyển theo hướng đi, đứng yên quay cùng hướng chủ
    if (!fire && !act) s.face = Math.abs(vx) > 0.4 ? (vx > 0 ? 2 : 1) : face;
    s.alt += Math.max(-70 * dt, Math.min(70 * dt, talt - s.alt));
    s.fireNow = fire; s.actNow = act;
    states.set(id, s);
    return s;
  }

  function collect(list, now) {
    if (!G.me) return;
    const ids = [G.you, ...G.players.keys()];
    for (const id of ids) {
      const pe = id !== G.you && G.players.get(id);
      if (pe && pe.lod) continue;   // chỗ đông: người ở xa không vẽ thú cưng
      const e = ownerOf(id);
      if (!e) continue;
      const s = step(id, e, now);
      if (s) list.push({ y: s.y + 2, k: 'pet', s });
    }
  }

  function aura(ctx, s, now, glow) {   // hào quang thú cưng Hiếm
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const a = 0.35 + Math.sin(now / 300) * 0.12;
    FX.glowDot(ctx, s.x, s.y - s.alt - 30, 46, glow, a, true);
    ctx.restore();
    if (Math.random() < 0.12) FX.emit(1, s.x + (Math.random() - 0.5) * 50, s.y - s.alt - 10 - Math.random() * 50, { speed: 10, vy: -25, life: 700, size: 2.5, color: glow, drag: 1 });
  }

  function drawDragon(ctx, s, r, now) {
    const meta = r.meta, CW = meta.w;
    let row, idx;
    if (s.fireNow) { row = meta.rows.special; idx = Math.min(row.n - 1, Math.floor((now - s.fireNow.t0) / 85)); }
    else if (s.alt > 24) { row = meta.rows.flight; idx = Math.floor(now / 110) % row.n; }
    else if (s.alt > 2) { row = meta.rows.takeoff; idx = Math.min(row.n - 1, Math.floor(s.alt / 34 * row.n)); }
    else if (s.speed > 25) { row = meta.rows.walk; idx = Math.floor(now / 110) % row.n; }
    else { row = meta.rows.idle; idx = Math.floor(now / 170) % row.n; }
    ctx.save();
    ctx.translate(Math.round(s.x), Math.round(s.y - (s.fireNow ? 0 : s.alt)));
    if (s.face === 1) ctx.scale(-1, 1);
    ctx.drawImage(r.img, idx * CW, row.y, CW, row.h, -CW / 2, -row.h, CW, row.h);
    ctx.restore();
    if (s.fireNow && idx >= 3) {   // lửa bùng ở mục tiêu
      const f = s.fireNow;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      FX.glowDot(ctx, f.tx, f.ty - 6, 40, PETS.hong_long.glow, 0.55, true);
      ctx.restore();
      if (Math.random() < 0.6) FX.emit(2, f.tx, f.ty - 4, { speed: 50, vy: -60, life: 500, size: 3.5, color: Math.random() < 0.5 ? '#ffb030' : '#ff5a10', drag: 1.5 });
    }
  }

  // loài 1 khung / tư thế: nhún, nghiêng, co giãn bằng code
  function drawSimple(ctx, s, r, now) {
    const meta = r.meta, CW = meta.w, act = s.actNow;
    let key = 'idle', bob = 0, sx = 1, sy = 1, rot = 0;
    if (act) {
      const k = (now - act.t0) / ACT_MS;
      key = act.sk ? 'skill' : 'atk';
      if (k > 0.25 && k < 0.6) { sx = 1.08; sy = 0.94; }
    } else if (s.speed > 25) {
      key = 'move'; bob = Math.abs(Math.sin(now / 90)) * 4; rot = Math.sin(now / 90) * 0.05;
    } else if (now - s.still > 6000 && !PETS[s.pid].fly) {
      key = 'rest';
    } else {
      sy = 1 + Math.sin(now / 420) * 0.025; sx = 2 - sy;
    }
    if (key === 'move' && meta.rows.run && s.speed > 140) key = 'run';
    const row = meta.rows[key] || meta.rows.idle;
    // nhiều khung (hình cắt từ bộ chuyển động): đòn đánh / kỹ năng chạy theo tiến độ, nghỉ chạy 1 lần rồi giữ khung cuối
    let idx = 0;
    if (row.n > 1) {
      if (act) idx = Math.min(row.n - 1, Math.floor((now - act.t0) / ACT_MS * row.n * 1.2));
      else if (key === 'rest') idx = Math.min(row.n - 1, Math.floor((now - s.still - 6000) / 400));
      else idx = Math.floor(now / (key === 'idle' ? 200 : key === 'run' ? 90 : 120)) % row.n;
      if (meta.multi) { sx = sy = 1; if (key !== 'move' && key !== 'run') rot = 0; bob = key === 'move' || key === 'run' ? bob * 0.4 : 0; }
    }
    ctx.save();
    ctx.translate(Math.round(s.x), Math.round(s.y - s.alt - bob));
    if (s.face === 1) ctx.scale(-1, 1);
    ctx.rotate(rot); ctx.scale(sx, sy);
    ctx.drawImage(r.img, idx * CW, row.y, CW, row.h, -CW / 2, -row.h, CW, row.h);
    ctx.restore();
    if (act) {
      const g = PETS[s.pid].glow, k = (now - act.t0) / ACT_MS;
      if (act.sk && k > 0.3 && k < 0.75) {   // kỹ năng: bùng sáng ở mục tiêu (hồi máu: quanh chủ)
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        FX.glowDot(ctx, act.tx, act.ty - 16, act.to ? 44 : 56, g, 0.5, true);
        ctx.restore();
        if (Math.random() < 0.7) FX.emit(2, act.tx + (Math.random() - 0.5) * 30, act.ty - 10, { speed: 45, vy: -50, life: 550, size: 3, color: g, drag: 1.4 });
      } else if (!act.sk && act.to && k > 0.35 && k < 0.5 && Math.random() < 0.6) FX.emit(1, act.tx, act.ty - 14, { speed: 40, vy: -20, life: 300, size: 2.5, color: g, drag: 2 });
    }
  }

  function draw(ctx, it, now) {
    const s = it.s, r = res[s.pid], P = PETS[s.pid];
    if (!s.fireNow) {   // bóng dưới đất, nhỏ dần khi bay cao
      const sh = Math.max(0.35, 1 - s.alt / 60);
      ctx.fillStyle = `rgba(0,0,0,${0.25 * sh})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 24 * sh, 6 * sh, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (s.rare) aura(ctx, s, now, P.glow);
    if (r.meta.simple) drawSimple(ctx, s, r, now); else drawDragon(ctx, s, r, now);
  }

  function onFx(d) {
    if (d.t !== 'petfire' && d.t !== 'petatk') return;
    const s = states.get(d.id), now = performance.now();
    if (s && d.t === 'petfire') s.fire = { t0: now, tx: d.x, ty: d.y };
    if (s && d.t === 'petatk') s.act = { t0: now, tx: d.x, ty: d.y, to: d.to || null, sk: !!d.sk };
    if (d.id === G.you || (G.self && Math.hypot(d.x - G.self.x, d.y - G.self.y) < 700)) {
      if (d.t === 'petfire') GameAudio.sfx('fire', 200);
      else if (d.sk && window.G && G.sfx) G.sfx('click');
    }
  }
  function bind(s) { s.on('fx', onFx); }

  // icon vật phẩm thú cưng lấy từ khung của hình
  const procIcon = Sprites.itemIcon, iconCache = {};
  function petIcon(id) {
    if (iconCache[id]) return iconCache[id];
    if (!ready(id)) return null;
    const r = res[id], m = r.meta, row = m.simple ? m.rows.idle : m.rows.flight, CW = m.w, n = 96;
    const c = document.createElement('canvas'); c.width = c.height = n;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(n / 2, n / 2, 4, n / 2, n / 2, n / 2); g.addColorStop(0, PETS[id].glow + '99'); g.addColorStop(1, PETS[id].glow + '00');
    x.fillStyle = g; x.fillRect(0, 0, n, n);
    const sc = Math.min(n / CW, n / row.h) * 0.92;
    x.drawImage(r.img, m.simple ? 0 : 4 * CW, row.y, CW, row.h, (n - CW * sc) / 2, (n - row.h * sc) / 2, CW * sc, row.h * sc);
    return (iconCache[id] = c);
  }
  Sprites.itemIcon = function (icon, rarity, rcolor, tier) {
    if (typeof icon === 'string' && icon.startsWith('pet:')) return petIcon(icon.slice(4)) || procIcon.call(this, 'chest_gold', rarity, rcolor, tier);
    return procIcon.apply(this, arguments);
  };
  window.Pet = { collect, draw, bind, ready, icon: petIcon };
})();
