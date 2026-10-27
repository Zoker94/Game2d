// Thú cưng (bản thử nghiệm: Hồng Long Ấu Thú). Rồng bay theo sau chủ, chủ đứng yên một lúc thì đáp xuống đất
// nằm nghỉ; khi máy chủ báo "petfire" thì lao tới phía trên mục tiêu và phun lửa xuống (khớp hoạt ảnh SPECIAL).
(function () {
  const PETS = { hong_long: { src: '/assets/pets/hong_long.png' + (window.AV ? '?v=' + window.AV : ''), meta: '/assets/pets/hong_long.json' + (window.AV ? '?v=' + window.AV : ''), fireX: 0.83, glow: '#ff8a30' } };
  const res = {};
  for (const id in PETS) {
    const r = res[id] = { img: new Image(), meta: null };
    r.img.src = PETS[id].src;
    fetch(PETS[id].meta).then(x => x.json()).then(j => { r.meta = j; }).catch(() => { });
  }
  const ready = id => res[id] && res[id].meta && res[id].img.complete && res[id].img.naturalWidth;
  const states = new Map();   // id chủ -> trạng thái thú cưng
  const FIRE_MS = 6 * 85, FIRE_HOLD = 260;

  function ownerOf(id) { return id === G.you ? G.self : G.players.get(id); }
  function petIdOf(id) { const ap = id === G.you ? G.me && G.me.ap : (G.players.get(id) || {}).ap; return ap && ap[10] || ''; }

  function step(id, e, now) {
    const pid = petIdOf(id);
    if (!pid || !ready(pid)) { states.delete(id); return null; }
    let s = states.get(id);
    const face = e.lastH === 1 || e.dir === 1 ? 1 : (e.lastH === 2 || e.dir === 2 ? 2 : (s ? s.ownerFace : 2));
    if (!s || s.pid !== pid || Math.hypot(s.x - e.x, s.y - e.y) > 900) s = { pid, x: e.x - 60, y: e.y, alt: 30, face: 2, t: now, still: now, ownerFace: 2, ox: e.x, oy: e.y };
    const dt = Math.min(0.05, (now - s.t) / 1000); s.t = now;
    s.ownerFace = face;
    if (Math.abs(e.x - s.ox) + Math.abs(e.y - s.oy) > 1) s.still = now;
    s.ox = e.x; s.oy = e.y;
    const meta = res[pid].meta, CW = meta.w;
    const fire = s.fire && now - s.fire.t0 < FIRE_MS + FIRE_HOLD ? s.fire : null;
    let tx, ty, talt;
    if (fire) {   // bay tới chỗ để luồng lửa (mép phải khung) rơi đúng mục tiêu
      s.face = fire.tx >= e.x ? 2 : 1;
      const off = (PETS[pid].fireX - 0.5) * CW;
      tx = fire.tx + (s.face === 2 ? -off : off); ty = fire.ty; talt = 0;
    } else {
      const behind = face === 1 ? 1 : -1;   // đứng sau lưng chủ
      tx = e.x + behind * 58; ty = e.y - 4;
      const resting = now - s.still > 1400 && Math.hypot(s.x - tx, s.y - ty) < 30;
      talt = resting ? 0 : 34 + Math.sin(now / 380 + id.length) * 4;
    }
    const k = 1 - Math.exp(-dt * (fire ? 16 : 5));
    const vx = (tx - s.x) * k, vy = (ty - s.y) * k;
    s.x += vx; s.y += vy;
    s.speed = Math.hypot(vx, vy) / Math.max(dt, 0.001);
    if (!fire && Math.abs(vx) > 0.4) s.face = vx > 0 ? 2 : 1;
    s.alt += Math.max(-70 * dt, Math.min(70 * dt, talt - s.alt));
    s.fireNow = fire;
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

  function draw(ctx, it, now) {
    const s = it.s, r = res[s.pid], meta = r.meta, CW = meta.w;
    let row, idx;
    if (s.fireNow) { row = meta.rows.special; idx = Math.min(row.n - 1, Math.floor((now - s.fireNow.t0) / 85)); }
    else if (s.alt > 24) { row = meta.rows.flight; idx = Math.floor(now / 110) % row.n; }
    else if (s.alt > 2) { row = meta.rows.takeoff; idx = Math.min(row.n - 1, Math.floor(s.alt / 34 * row.n)); }
    else if (s.speed > 25) { row = meta.rows.walk; idx = Math.floor(now / 110) % row.n; }
    else { row = meta.rows.idle; idx = Math.floor(now / 170) % row.n; }
    // bóng dưới đất, nhỏ dần khi bay cao
    if (!s.fireNow) {
      const sh = Math.max(0.35, 1 - s.alt / 60);
      ctx.fillStyle = `rgba(0,0,0,${0.25 * sh})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 30 * sh, 7 * sh, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    ctx.translate(Math.round(s.x), Math.round(s.y - (s.fireNow ? 0 : s.alt)));
    if (s.face === 1) ctx.scale(-1, 1);
    ctx.drawImage(r.img, idx * CW, row.y, CW, row.h, -CW / 2, -row.h, CW, row.h);
    ctx.restore();
    if (s.fireNow && idx >= 3) {   // lửa bùng ở mục tiêu
      const f = s.fireNow;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      FX.glowDot(ctx, f.tx, f.ty - 6, 40, PETS[s.pid].glow, 0.55, true);
      ctx.restore();
      if (Math.random() < 0.6) FX.emit(2, f.tx, f.ty - 4, { speed: 50, vy: -60, life: 500, size: 3.5, color: Math.random() < 0.5 ? '#ffb030' : '#ff5a10', drag: 1.5 });
    }
  }

  function onFx(d) {
    if (d.t !== 'petfire') return;
    const s = states.get(d.id);
    if (s) s.fire = { t0: performance.now(), tx: d.x, ty: d.y };
    if (d.id === G.you || (G.self && Math.hypot(d.x - G.self.x, d.y - G.self.y) < 700)) GameAudio.sfx('fire', 200);
  }
  function bind(s) { s.on('fx', onFx); }

  // icon vật phẩm thú cưng lấy từ khung đầu của hình
  const procIcon = Sprites.itemIcon, iconCache = {};
  Sprites.itemIcon = function (icon, rarity, rcolor, tier) {
    if (typeof icon === 'string' && icon.startsWith('pet:')) {
      const id = icon.slice(4);
      if (iconCache[id]) return iconCache[id];
      if (ready(id)) {
        const r = res[id], row = r.meta.rows.flight, CW = r.meta.w, n = 96;
        const c = document.createElement('canvas'); c.width = c.height = n;
        const x = c.getContext('2d');
        const g = x.createRadialGradient(n / 2, n / 2, 4, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,150,60,.55)'); g.addColorStop(1, 'rgba(255,90,20,0)');
        x.fillStyle = g; x.fillRect(0, 0, n, n);
        const sc = Math.min(n / CW, n / row.h) * 0.95;
        x.drawImage(r.img, 4 * CW, row.y, CW, row.h, (n - CW * sc) / 2, (n - row.h * sc) / 2, CW * sc, row.h * sc);
        return (iconCache[id] = c);
      }
      return procIcon.call(this, 'chest_gold', rarity, rcolor, tier);
    }
    return procIcon.apply(this, arguments);
  };
  window.Pet = { collect, draw, bind, ready };
})();
