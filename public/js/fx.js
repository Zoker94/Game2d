// Hiệu ứng kỹ năng phát sáng: hạt sáng, cộng sáng (additive), sóng xung kích, tia sét, cột sáng...
(function () {
  const parts = [];
  let entityById = () => null;
  let flash = null;
  let lastT = performance.now();
  const R = Math.random;
  const ease = p => 1 - Math.pow(1 - p, 3);

  function emit(n, x, y, o = {}) {
    const q = (window.G && G.gfx && G.gfx.fx) || 1;   // đồ họa thấp: bớt hạt
    if (q < 1) { n *= q; n = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); if (!n) return; }
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const a = o.angle != null ? o.angle + (R() - 0.5) * (o.spread == null ? Math.PI * 2 : o.spread) : R() * Math.PI * 2;
      const sp = (o.speed == null ? 60 : o.speed) * (0.4 + R() * 0.8);
      const jx = o.jitter || 0, jy = o.jitterY == null ? jx : o.jitterY;
      parts.push({
        x: x + (R() - 0.5) * jx * 2, y: y + (R() - 0.5) * jy * 2,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * (o.flat || 1) + (o.vy || 0), ay: o.grav || 0,
        life: (o.life || 600) * (0.6 + R() * 0.6), t0: now + (o.delay || 0) + (o.delayRand || 0) * R(),
        size: (o.size || 4) * (0.6 + R() * 0.8), color: o.color || '#fff', drag: o.drag || 0
      });
    }
    const cap = q < 1 || lean ? 160 : 320;   // giới hạn hạt sáng (PK đông người rất dễ vượt)
    if (parts.length > cap) parts.splice(0, parts.length - cap);
  }
  function glowDot(ctx, x, y, r, color, a = 1, soft) {
    const g = Sprites.glow(color, r, soft);
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.drawImage(g, x - g.width / 2, y - g.height / 2);
  }
  function glowPath(ctx, draw, color, w, a = 1) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // 2 lớp (quầng màu + lõi trắng) thay cho 4 lớp: nhìn gần như nhau mà nhẹ gấp đôi
    const passes = [[w * 2.2, 0.3, color], [Math.max(1, w * 0.45), 0.9, '#ffffff']];
    for (const [lw, al, c] of passes) { ctx.globalAlpha = al * a; ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); draw(); ctx.stroke(); }
  }
  function ground(ctx, x, y, r, color, a) {
    ctx.globalAlpha = a;
    const g = Sprites.glow(color, r);
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.45); ctx.drawImage(g, -g.width / 2, -g.height / 2); ctx.restore();
  }
  function pos(f) {
    const src = f.from ? entityById(f.from) : null;
    const tgt = f.to ? entityById(f.to) : null;
    const d = DASHES.has(f.t);   // chiêu lướt: điểm xuất phát là chỗ đứng cũ
    const sx = d ? f.x : (src ? src.x : f.x), sy = d ? f.y : (src ? src.y : f.y);
    const tx = tgt ? tgt.x : (f.tx != null ? f.tx : f.x), ty = tgt ? tgt.y : (f.ty != null ? f.ty : f.y);
    return { sx, sy, tx, ty, src };
  }
  const DASHES = new Set(['dash', 'staffleap', 'shadowdash', 'petaldash', 'swordrider', 'lightningdash', 'drunkdash']);
  function zig(x0, y0, x1, y1, seg, amp) {
    const pts = [[x0, y0]];
    for (let i = 1; i < seg; i++) { const t = i / seg; pts.push([x0 + (x1 - x0) * t + (R() - 0.5) * amp, y0 + (y1 - y0) * t + (R() - 0.5) * amp * 0.4]); }
    pts.push([x1, y1]);
    return pts;
  }

  // ===== Hiệu ứng diện rộng đặc trưng từng môn phái =====
  const TAU = Math.PI * 2;
  function poly(ctx, pts) { pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); }
  function flat(ctx, x, y, fn) { ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.45); fn(); ctx.restore(); }
  // vòng phù văn: vẽ sẵn thành ảnh (theo màu, bán kính làm tròn 10px, số nan) rồi chỉ xoay + ép dẹt + chép mỗi khung
  const runeCache = new Map();
  function runeSprite(r, c, spokes) {
    const rr = Math.max(10, Math.round(r / 10) * 10), k = c + rr + ':' + spokes;
    let cv = runeCache.get(k);
    if (cv) return cv;
    const S = rr * 2 + 24;
    cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'); g.translate(S / 2, S / 2); g.globalCompositeOperation = 'lighter';
    glowPath(g, () => g.arc(0, 0, rr, 0, TAU), c, 3, 1);
    glowPath(g, () => g.arc(0, 0, rr * 0.78, 0, TAU), c, 2, 0.8);
    for (let i = 0; i < spokes; i++) {
      const an = i / spokes * TAU;
      glowPath(g, () => { g.moveTo(Math.cos(an) * rr * 0.78, Math.sin(an) * rr * 0.78); g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }, c, 2, 1);
      glowPath(g, () => g.arc(Math.cos(an + 0.4) * rr * 0.89, Math.sin(an + 0.4) * rr * 0.89, rr * 0.05, 0, TAU), c, 1.5, 1);
    }
    cv._r = rr;
    if (runeCache.size > 60) runeCache.clear();
    runeCache.set(k, cv);
    return cv;
  }
  function runeCircle(ctx, x, y, r, c, a, rot, spokes = 8) {
    if (a <= 0.01) return;
    const cv = runeSprite(r, c, spokes), k = r / cv._r;
    flat(ctx, x, y, () => {
      ctx.rotate(rot); ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(cv, -cv.width / 2 * k, -cv.height / 2 * k, cv.width * k, cv.height * k);
    });
  }
  function setFlash(f, c, delay, dur) { if (f.from === window.G.you) flash = { color: c, t0: performance.now() + delay, dur }; }

  const SIG = {
    // Thiếu Lâm – Sư Tử Hống: sóng âm vàng dồn dập
    lionroar: {
      dur: 850,
      spawn(f, o) { emit(30, o.sx, o.sy - 30, { speed: (f.r || 150) * 1.6, life: 500, size: 4, color: f.color, flat: 0.5, drag: 2 }); },
      draw(ctx, f, p, o) {
        runeCircle(ctx, o.sx, o.sy, 46, f.color, 1 - p, p * 3, 6);
        for (let k = 0; k < 4; k++) {
          const lp = (p - k * 0.12) / 0.6;
          if (lp < 0 || lp > 1) continue;
          const rr = 30 + ease(lp) * (f.r || 150);
          glowPath(ctx, () => ctx.ellipse(o.sx, o.sy - 20, rr, rr * 0.5, 0, 0, TAU), f.color, 6 - k, 1 - lp);
        }
        glowDot(ctx, o.sx, o.sy - 40, 50, f.color, (1 - p) * 0.8);
      }
    },
    // Thiếu Lâm – Như Lai Thần Chưởng: bàn tay Phật khổng lồ
    buddha: {
      dur: 1400,
      spawn(f, o) {
        emit(70, o.tx, o.ty - 10, { speed: (f.r || 190) * 1.8, life: 700, size: 6, color: f.color, flat: 0.45, drag: 2.2, delay: 520 });
        emit(40, o.tx, o.ty - 10, { speed: 40, vy: -180, life: 1000, size: 5, color: '#fff6c8', jitter: 60, jitterY: 15, delay: 520, delayRand: 400 });
        setFlash(f, '#ffe680', 520, 500);
      },
      draw(ctx, f, p, o) {
        const r = f.r || 190, impact = 0.38;
        runeCircle(ctx, o.tx, o.ty, r * (p < impact ? 0.5 + p : 1), f.color, Math.min(1, p * 3) * (1 - Math.max(0, p - 0.7) / 0.3), -p * 2, 12);
        if (p < impact + 0.2) {
          const q = Math.min(1, p / impact);
          const cx = o.tx, cy = o.ty - 60 - (1 - ease(q)) * 260, s = 1.6 + (1 - q) * 0.6;
          const a = p < impact ? 0.95 : 1 - (p - impact) / 0.2;
          ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
          ctx.globalAlpha = a * 0.85; ctx.fillStyle = f.color;
          ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-26, -10, 52, 44, 12) : ctx.rect(-26, -10, 52, 44); ctx.fill();
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-24 + i * 13, -48 + Math.abs(i - 1.5) * 6, 10, 42, 5) : ctx.rect(-24 + i * 13, -48, 10, 42); ctx.fill(); }
          ctx.beginPath(); ctx.ellipse(-32, 6, 8, 18, -0.6, 0, TAU); ctx.fill();
          ctx.globalAlpha = a; glowDot(ctx, 0, 0, 90, f.color, a * 0.8);
          ctx.restore();
        }
        if (p >= impact) {
          const q = (p - impact) / (1 - impact);
          glowDot(ctx, o.tx, o.ty - 30, 60 + q * r, '#fff3a0', (1 - q) * 0.9);
          glowPath(ctx, () => ctx.ellipse(o.tx, o.ty, r * ease(q) * 1.1, r * ease(q) * 0.5, 0, 0, TAU), f.color, 7, 1 - q);
          const g = ctx.createLinearGradient(0, o.ty - 380, 0, o.ty);
          g.addColorStop(0, Sprites.hexA(f.color, 0)); g.addColorStop(1, Sprites.hexA('#fff8d0', 0.7 * (1 - q)));
          ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(o.tx - 50, o.ty - 380, 100, 380);
        }
      }
    },
    // Thiên Vương – Bát Phương Phong Vũ: chùy xoáy lửa quanh thân
    whirl: {
      dur: 800,
      spawn(f, o) { emit(40, o.sx, o.sy - 20, { speed: (f.r || 140) * 1.5, life: 500, size: 4, color: f.color, flat: 0.5, drag: 2.5, delayRand: 400 }); },
      draw(ctx, f, p, o) {
        const r = (f.r || 140) * (0.4 + ease(p) * 0.6);
        flat(ctx, o.sx, o.sy - 10, () => {
          for (let k = 0; k < 3; k++) {
            const a0 = p * 16 + k * TAU / 3;
            glowPath(ctx, () => ctx.arc(0, 0, r, a0, a0 + 1.6), f.color, 9, 1 - p);
            glowPath(ctx, () => ctx.arc(0, 0, r * 0.7, a0 + 0.6, a0 + 1.8), '#ffd060', 5, 1 - p);
          }
        });
        ground(ctx, o.sx, o.sy, r, f.color, (1 - p) * 0.5);
      }
    },
    // Thiên Vương – Thiên Băng Địa Liệt: mặt đất nứt toác phun dung nham
    quake: {
      dur: 1200,
      spawn(f, o) {
        const r = f.r || 180;
        f.cracks = Array.from({ length: 9 }, (_, i) => { const a = i / 9 * TAU + R() * 0.3; return zig(0, 0, Math.cos(a) * r, Math.sin(a) * r * 0.45, 7, 26); });
        f.erupt = Array.from({ length: 10 }, () => { const a = R() * TAU, d = r * (0.3 + R() * 0.7); return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.45, t: 0.2 + R() * 0.4 }; });
        for (const e of f.erupt) emit(10, o.tx + e.x, o.ty + e.y, { speed: 80, vy: -200, grav: 380, life: 800, size: 5, color: R() < 0.5 ? '#ffb030' : f.color, delay: e.t * f.dur });
        emit(50, o.tx, o.ty, { speed: r * 1.6, life: 600, size: 5, color: '#ffa040', flat: 0.45, drag: 2.5 });
        setFlash(f, '#ff6020', 0, 400);
      },
      draw(ctx, f, p, o) {
        const q = Math.min(1, p / 0.35), fade = 1 - Math.max(0, p - 0.6) / 0.4;
        ctx.save(); ctx.translate(o.tx, o.ty);
        for (const c of f.cracks || []) {
          const n = Math.max(2, Math.round(c.length * q));
          glowPath(ctx, () => poly(ctx, c.slice(0, n)), f.color, 4, fade);
        }
        ctx.restore();
        glowDot(ctx, o.tx, o.ty - 10, 50 + q * 60, '#ff8a2a', fade * 0.7);
        for (const e of f.erupt || []) {
          const lp = (p - e.t) / 0.35;
          if (lp < 0 || lp > 1) continue;
          const h = 120 * Math.sin(lp * Math.PI);
          const g = ctx.createLinearGradient(0, o.ty + e.y - h, 0, o.ty + e.y);
          g.addColorStop(0, Sprites.hexA('#ffd060', 0)); g.addColorStop(1, Sprites.hexA('#ff5010', 0.9));
          ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(o.tx + e.x - 10, o.ty + e.y - h, 20, h);
          glowDot(ctx, o.tx + e.x, o.ty + e.y, 34, '#ff7020', 1 - lp);
        }
      }
    },
    // Đường Môn – Vạn Tiễn Xuyên Vân: mưa tên từ trời
    arrowrain: {
      dur: 1300,
      spawn(f, o) {
        const r = f.r || 200;
        f.arrows = Array.from({ length: 46 }, () => { const a = R() * TAU, d = r * Math.sqrt(R()); return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.45, t: R() * 0.6 }; });
        for (const a of f.arrows) emit(3, o.tx + a.x, o.ty + a.y, { speed: 70, life: 300, size: 3, color: f.color, delay: (a.t + 0.18) * f.dur });
      },
      draw(ctx, f, p, o) {
        const r = f.r || 200;
        runeCircle(ctx, o.tx, o.ty, r, f.color, Math.min(1, p * 4) * (1 - Math.max(0, p - 0.75) / 0.25), p, 16);
        for (const a of f.arrows || []) {
          const lp = (p - a.t) / 0.18;
          if (lp < 0) continue;
          const gx = o.tx + a.x, gy = o.ty + a.y;
          if (lp <= 1) {
            const x = gx + 70 * (1 - lp), y = gy - 260 * (1 - lp);
            glowPath(ctx, () => { ctx.moveTo(x + 14, y - 52); ctx.lineTo(x, y); }, f.color, 2.5, 1);
          } else if (lp < 3) {
            ctx.globalAlpha = 1 - (lp - 1) / 2; ctx.strokeStyle = '#e8fff0'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(gx + 4, gy - 14); ctx.lineTo(gx, gy); ctx.stroke();
          }
        }
      }
    },
    // Ngũ Độc – Vạn Cổ Thực Tâm: đầm độc với khí độc lượn
    toxic: {
      dur: 1300,
      spawn(f, o) { const r = f.r || 140; emit(50, o.tx, o.ty - 8, { speed: 18, vy: -50, life: 1100, size: 6, color: R() < 0.3 ? '#c050ff' : f.color, jitter: r * 0.8, jitterY: r * 0.35, delayRand: 600 }); },
      draw(ctx, f, p, o) {
        const r = (f.r || 140) * (0.5 + ease(Math.min(1, p * 2)) * 0.5), fade = 1 - Math.max(0, p - 0.65) / 0.35;
        ground(ctx, o.tx, o.ty, r * 1.3, f.color, 0.65 * fade);
        ground(ctx, o.tx + 20, o.ty + 6, r * 0.7, '#a040ff', 0.35 * fade);
        glowPath(ctx, () => ctx.ellipse(o.tx, o.ty, r, r * 0.45, 0, 0, TAU), f.color, 3, fade);
        for (let k = 0; k < 7; k++) {
          const a = k / 7 * TAU + p * 5;
          for (let j = 0; j < 6; j++) {
            const aa = a - j * 0.18;
            glowDot(ctx, o.tx + Math.cos(aa) * r * 0.75, o.ty - 26 - Math.sin(p * 8 + k) * 14 + Math.sin(aa) * r * 0.3, 16 - j * 2, k % 3 ? f.color : '#c060ff', fade * (1 - j * 0.15));
          }
        }
      }
    },
    // Ngũ Độc – Thiên Độc Vạn Xà: bầy rắn độc cuộn xoáy
    swarm: {
      dur: 1400,
      spawn(f, o) { const r = f.r || 200; emit(60, o.tx, o.ty - 10, { speed: 20, vy: -40, life: 1200, size: 5, color: f.color, jitter: r * 0.8, jitterY: r * 0.35, delayRand: 700 }); setFlash(f, '#60ff40', 200, 400); },
      draw(ctx, f, p, o) {
        const r = f.r || 200, fade = 1 - Math.max(0, p - 0.7) / 0.3;
        ground(ctx, o.tx, o.ty, r * 1.2, f.color, 0.55 * fade);
        for (let s = 0; s < 6; s++) {
          const base = s / 6 * TAU + p * (s % 2 ? 4 : -4);
          const rr = r * (0.35 + 0.55 * Math.abs(Math.sin(p * 3 + s)));
          for (let j = 0; j < 14; j++) {
            const a = base - j * 0.12, wv = Math.sin(p * 20 + j * 0.8) * 10;
            const x = o.tx + Math.cos(a) * (rr + wv), y = o.ty - 14 + Math.sin(a) * (rr + wv) * 0.45;
            glowDot(ctx, x, y, j === 0 ? 22 : 15 - j * 0.6, j === 0 ? '#eaff60' : (s % 2 ? f.color : '#40c020'), fade * (1 - j * 0.05));
          }
        }
        glowDot(ctx, o.tx, o.ty - 30, 70, f.color, fade * 0.5);
      }
    },
    // Nga My – Phổ Độ Chúng Sinh: đài sen nở rộ, ánh Phật quang
    holylotus: {
      dur: 1500,
      spawn(f, o) {
        const r = f.r || 220;
        emit(50, o.sx, o.sy - 40, { speed: 20, vy: 30, life: 1400, size: 6, color: '#ffc0e0', jitter: r, jitterY: 80, delayRand: 800 });
        emit(40, o.sx, o.sy - 10, { speed: 30, vy: -130, life: 1100, size: 5, color: '#fff0c0', jitter: 50, jitterY: 10, delayRand: 600 });
        setFlash(f, '#ffd0ee', 200, 500);
      },
      draw(ctx, f, p, o) {
        const r = f.r || 220, open = ease(Math.min(1, p * 1.6)), fade = 1 - Math.max(0, p - 0.7) / 0.3;
        ground(ctx, o.sx, o.sy, r * 1.1, f.color, 0.5 * fade);
        flat(ctx, o.sx, o.sy, () => {
          for (const [n, len, rot, col] of [[10, r * 0.95, 0, f.color], [8, r * 0.65, 0.3, '#ffd6ec'], [6, r * 0.38, 0.1, '#ffffff']]) {
            for (let i = 0; i < n; i++) {
              const a = i / n * TAU + rot + p * 0.6;
              ctx.save(); ctx.rotate(a); ctx.translate(len * 0.5 * open, 0);
              ctx.globalAlpha = 0.55 * fade; ctx.fillStyle = col;
              ctx.beginPath(); ctx.ellipse(0, 0, len * 0.5 * open, len * 0.16, 0, 0, TAU); ctx.fill();
              ctx.restore();
            }
          }
          glowDot(ctx, 0, 0, 50, '#ffe070', fade);
        });
        const g = ctx.createLinearGradient(0, o.sy - 360, 0, o.sy);
        g.addColorStop(0, Sprites.hexA('#ffffff', 0)); g.addColorStop(1, Sprites.hexA('#ffe0f0', 0.55 * fade));
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(o.sx - 40 * open, o.sy - 360, 80 * open, 360);
      }
    },
    // Thúy Yên – Băng Phong Vạn Lý: gai băng trồi lên, tuyết bay
    frost: {
      dur: 1200,
      spawn(f, o) {
        const r = f.r || 180;
        f.spikes = Array.from({ length: 22 }, (_, i) => { const a = i / 22 * TAU + R() * 0.2, d = r * (0.35 + R() * 0.65); return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.45, h: 30 + R() * 40, t: (d / r) * 0.3 }; });
        emit(60, o.sx, o.sy - 30, { speed: r * 1.5, life: 900, size: 4, color: '#e8fbff', flat: 0.5, drag: 1.8 });
        setFlash(f, '#c8f4ff', 100, 400);
      },
      draw(ctx, f, p, o) {
        const r = f.r || 180, fade = 1 - Math.max(0, p - 0.65) / 0.35;
        ground(ctx, o.sx, o.sy, r * 1.15, f.color, 0.55 * fade);
        glowPath(ctx, () => ctx.ellipse(o.sx, o.sy, r * ease(Math.min(1, p * 2)), r * ease(Math.min(1, p * 2)) * 0.45, 0, 0, TAU), '#e8fbff', 4, fade);
        for (const s of f.spikes || []) {
          const lp = Math.min(1, Math.max(0, (p - s.t) / 0.15));
          if (lp <= 0) continue;
          const x = o.sx + s.x, y = o.sy + s.y, h = s.h * ease(lp);
          ctx.globalAlpha = 0.75 * fade; ctx.fillStyle = f.color;
          ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x, y - h); ctx.lineTo(x + 8, y); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 0.9 * fade; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x, y - h); ctx.lineTo(x + 2, y); ctx.closePath(); ctx.fill();
          glowDot(ctx, x, y - h, 14, '#ffffff', fade * lp);
        }
      }
    },
    // Cái Bang – Phi Long Tại Thiên: rồng vàng lượn quanh rồi bổ xuống
    dragonring: {
      dur: 1250,
      spawn(f, o) { emit(50, o.sx, o.sy - 20, { speed: (f.r || 150) * 1.7, life: 600, size: 5, color: f.color, flat: 0.5, drag: 2.2, delay: 900 }); },
      draw(ctx, f, p, o) {
        const r = f.r || 150;
        ground(ctx, o.sx, o.sy, r, f.color, 0.4 * (1 - p));
        const q = Math.min(1, p / 0.75);
        for (let j = 18; j >= 0; j--) {
          const tq = Math.max(0, q - j * 0.02);
          const a = tq * TAU * 1.6, rr = r * (1 - tq * 0.6), h = 20 + tq * 70;
          const x = o.sx + Math.cos(a) * rr, y = o.sy - h + Math.sin(a) * rr * 0.45;
          glowDot(ctx, x, y, j === 0 ? 34 : 24 - j * 0.9, j === 0 ? '#fff4b0' : (j % 3 ? f.color : '#ff9020'), (q < 1 ? 1 : 1 - (p - 0.75) / 0.25) * (1 - j * 0.04));
        }
        if (p > 0.72) { const e = (p - 0.72) / 0.28; glowDot(ctx, o.sx, o.sy - 30, 40 + e * r, f.color, 1 - e); glowPath(ctx, () => ctx.ellipse(o.sx, o.sy, r * e, r * e * 0.45, 0, 0, TAU), f.color, 6, 1 - e); }
      }
    },
    // Võ Đang – Thiên Địa Vô Cực: bát quái trận xoay
    bagua: {
      dur: 1300,
      spawn(f, o) { const r = f.r || 200; emit(60, o.tx, o.ty - 6, { speed: r * 1.5, life: 700, size: 4, color: f.color, flat: 0.45, drag: 2, delay: 300 }); setFlash(f, '#e0ecff', 300, 400); },
      draw(ctx, f, p, o) {
        const r = (f.r || 200) * (0.5 + ease(Math.min(1, p * 2)) * 0.5), fade = 1 - Math.max(0, p - 0.7) / 0.3;
        ground(ctx, o.tx, o.ty, r * 1.1, f.color, 0.45 * fade);
        flat(ctx, o.tx, o.ty, () => {
          ctx.rotate(p * 2.5);
          const oct = Array.from({ length: 9 }, (_, i) => [Math.cos(i / 8 * TAU) * r, Math.sin(i / 8 * TAU) * r]);
          glowPath(ctx, () => poly(ctx, oct), f.color, 4, fade);
          for (let i = 0; i < 8; i++) {
            const a = (i + 0.5) / 8 * TAU, cx = Math.cos(a) * r * 0.8, cy = Math.sin(a) * r * 0.8;
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(a + Math.PI / 2);
            for (let k = 0; k < 3; k++) {
              const broken = (i >> k) & 1;
              if (broken) { glowPath(ctx, () => { ctx.moveTo(-14, k * 8 - 8); ctx.lineTo(-4, k * 8 - 8); ctx.moveTo(4, k * 8 - 8); ctx.lineTo(14, k * 8 - 8); }, f.color, 2.5, fade); }
              else glowPath(ctx, () => { ctx.moveTo(-14, k * 8 - 8); ctx.lineTo(14, k * 8 - 8); }, f.color, 2.5, fade);
            }
            ctx.restore();
          }
          const tr = r * 0.4;
          ctx.rotate(-p * 6);
          glowPath(ctx, () => ctx.arc(0, 0, tr, 0, TAU), '#ffffff', 3, fade);
          glowPath(ctx, () => { ctx.arc(0, -tr / 2, tr / 2, Math.PI / 2, -Math.PI / 2, true); ctx.arc(0, tr / 2, tr / 2, -Math.PI / 2, Math.PI / 2); }, '#ffffff', 3, fade);
        });
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * TAU + p * 3, lp = Math.min(1, p * 2);
          glowPath(ctx, () => { ctx.moveTo(o.tx, o.ty - 30); ctx.lineTo(o.tx + Math.cos(a) * r * lp, o.ty - 30 + Math.sin(a) * r * 0.45 * lp); }, f.color, 2, fade * 0.7);
        }
      }
    },
    // Cái Bang – Hàng Long Thập Bát Chưởng: ba rồng vàng lớn bay theo đường chưởng
    hanglong: {
      dur: 1100,
      spawn(f, o) {
        const n = 10;
        for (let i = 1; i <= n; i++) emit(6, o.sx + (o.tx - o.sx) * i / n, o.sy - 28 + (o.ty - o.sy) * i / n, { speed: 120, life: 500, size: 5, color: f.color, delay: i / n * f.dur * 0.6, drag: 2.5 });
        setFlash(f, '#ffe680', 150, 400);
      },
      draw(ctx, f, p, o) {
        const bx = o.sx, by = o.sy - 28, ex = o.tx, ey = o.ty - 28, a = Math.atan2(ey - by, ex - bx), len = Math.hypot(ex - bx, ey - by);
        const nx = -Math.sin(a), ny = Math.cos(a);
        glowDot(ctx, bx + Math.cos(a) * 30, by + Math.sin(a) * 30, 60, f.color, Math.max(0, 1 - p * 2));
        for (let d = 0; d < 3; d++) {
          const q = Math.min(1, Math.max(0, (p - d * 0.12) / 0.6));
          if (q <= 0) continue;
          const fade = q < 1 ? 1 : Math.max(0, 1 - (p - d * 0.12 - 0.6) / 0.25);
          const off = (d - 1) * 26;
          for (let k = 22; k >= 0; k--) {
            const tq = Math.max(0, q - k * 0.025), wv = Math.sin(tq * 12 + k * 0.5 + d) * 16 + off;
            const x = bx + Math.cos(a) * len * tq + nx * wv, y = by + Math.sin(a) * len * tq + ny * wv;
            glowDot(ctx, x, y, k === 0 ? 46 : 32 - k, k === 0 ? '#fff6c0' : (k % 4 === 0 ? '#ff9020' : f.color), fade * (1 - k * 0.035));
          }
        }
        if (p > 0.55) { const e = (p - 0.55) / 0.45; glowDot(ctx, ex, ey, 50 + e * 80, f.color, 1 - e); }
      }
    },
    // Côn Lôn – Cửu Thiên Huyền Lôi: mây đen, sét đánh dồn dập
    thunder: {
      dur: 1500,
      spawn(f, o) {
        const r = f.r || 210;
        f.bolts = Array.from({ length: 14 }, (_, i) => ({ x: (R() - 0.5) * r * 1.8, y: (R() - 0.5) * r * 0.8, t: 0.15 + i * 0.05 }));
        for (const b of f.bolts) emit(10, o.tx + b.x, o.ty + b.y - 6, { speed: 160, life: 350, size: 3, color: f.color, delay: b.t * f.dur, drag: 3 });
        setFlash(f, '#e0c8ff', 250, 900);
      },
      draw(ctx, f, p, o) {
        const r = f.r || 210, fade = 1 - Math.max(0, p - 0.8) / 0.2, cy = o.ty - 250;
        ctx.save(); ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 9; i++) {
          ctx.globalAlpha = 0.5 * fade * Math.min(1, p * 5);
          ctx.fillStyle = i % 2 ? '#2a1c3a' : '#3a2a50';
          ctx.beginPath(); ctx.ellipse(o.tx + (i - 4) * r * 0.22, cy + Math.sin(i * 2) * 14, r * 0.3, 34, 0, 0, TAU); ctx.fill();
        }
        ctx.restore();
        ground(ctx, o.tx, o.ty, r * 1.1, f.color, 0.5 * fade);
        glowPath(ctx, () => ctx.ellipse(o.tx, o.ty, r, r * 0.45, 0, 0, TAU), f.color, 3, fade * (0.6 + R() * 0.4));
        for (const b of f.bolts || []) {
          const lp = (p - b.t) / 0.12;
          if (lp < 0 || lp > 1) continue;
          const z = zig(o.tx + b.x * 0.4, cy + 20, o.tx + b.x, o.ty + b.y - 6, 10, 40);
          glowPath(ctx, () => poly(ctx, z), f.color, 4, 1 - lp);
          glowDot(ctx, o.tx + b.x, o.ty + b.y - 6, 50, f.color, 1 - lp);
        }
      }
    }
  };

  // ===== Long Ấn: rồng nguyên tố bay vòng rồi lao xuống =====
  const DRAGON_PAL = {
    fire:  { body: '#ff5a1a', light: '#ffd040', dark: '#a01808', glow: '#ff6a20', eye: '#fff36a', spike: '#ffb030' },
    water: { body: '#2fa8ff', light: '#c0f0ff', dark: '#0a3a90', glow: '#3ab8ff', eye: '#ffffff', spike: '#8ad8ff' },
    ice:   { body: '#9ee8ff', light: '#ffffff', dark: '#3a7ab0', glow: '#bff0ff', eye: '#5af0ff', spike: '#e8fbff' },
    thunder: { body: '#a070ff', light: '#fff4a0', dark: '#3a1a8a', glow: '#c89aff', eye: '#fffbe0', spike: '#ffe060' },
    shadow:  { body: '#3a0a2a', light: '#ff5a8a', dark: '#0a0208', glow: '#e0306a', eye: '#ff2040', spike: '#8a1a4a' }
  };
  // tia sét gấp khúc từ trời xuống (x, y): dùng cho Lôi Long
  function boltPts(x, y, h, seed) {
    const pts = []; let px = x + Math.sin(seed * 7.3) * 30;
    for (let i = 0; i <= 8; i++) { const t = i / 8; px += (Math.sin(seed * 13.1 + i * 2.7) * 18) * (1 - t * 0.6); pts.push([i === 8 ? x : px, y - h * (1 - t)]); }
    return pts;
  }
  function drawBolt(ctx, pts, col, a, w) {
    glowPath(ctx, () => { ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); }, col, w * 3, a * 0.6);
    glowPath(ctx, () => { ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); }, '#ffffff', w, a);
  }
  function bez(p0, p1, p2, t) { const u = 1 - t; return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]; }
  function drawDragon(ctx, o, q, pal, fade, now) {
    const side = o.tx >= o.sx ? 1 : -1;
    const P0 = [o.sx - 220 * side, o.sy - 170], P1 = [(o.sx + o.tx) / 2 + 40 * side, Math.min(o.sy, o.ty) - 300], P2 = [o.tx, o.ty - 24];
    const N = 26, pts = [];
    for (let k = 0; k < N; k++) {
      const t = Math.max(0, Math.min(1, q - k * 0.028));
      const [x, y] = bez(P0, P1, P2, t);
      const w = Math.sin(t * 18 - k * 0.55 + now / 90) * (8 + k * 0.5);
      pts.push([x, y + w, t]);
    }
    // thân & vảy (từ đuôi tới đầu)
    for (let k = N - 1; k >= 1; k--) {
      const [x, y] = pts[k], [x2, y2] = pts[k - 1];
      const r = Math.max(4, 20 - k * 0.6);
      glowDot(ctx, x, y, r * 2.6, pal.glow, fade * 0.55, true);
      ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = fade;
      ctx.fillStyle = k % 2 ? pal.body : pal.dark; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.light; ctx.globalAlpha = fade * 0.7; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.35, r * 0.45, 0, TAU); ctx.fill();
      if (k % 3 === 0) { // gai lưng
        const a = Math.atan2(y2 - y, x2 - x) - Math.PI / 2;
        ctx.globalAlpha = fade; ctx.fillStyle = pal.spike; ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.6 - Math.cos(a + 1.57) * 4, y + Math.sin(a) * r * 0.6 - Math.sin(a + 1.57) * 4);
        ctx.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12));
        ctx.lineTo(x + Math.cos(a) * r * 0.6 + Math.cos(a + 1.57) * 4, y + Math.sin(a) * r * 0.6 + Math.sin(a + 1.57) * 4); ctx.fill();
      }
      if (k === N - 1) { ctx.fillStyle = pal.spike; ctx.globalAlpha = fade; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 14 * side, y - 10); ctx.lineTo(x - 10 * side, y + 8); ctx.fill(); }
      ctx.restore();
    }
    // đầu rồng
    const [hx, hy] = pts[0], [nx, ny] = pts[2];
    const a = Math.atan2(hy - ny, hx - nx);
    glowDot(ctx, hx, hy, 70, pal.glow, fade * 0.8, true);
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = fade; ctx.translate(hx, hy); ctx.rotate(a);
    ctx.strokeStyle = pal.spike; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6, -10); ctx.quadraticCurveTo(-22, -26, -34, -24); ctx.moveTo(-6, 10); ctx.quadraticCurveTo(-22, 26, -34, 24); ctx.stroke(); // sừng
    ctx.fillStyle = pal.body; ctx.beginPath(); ctx.ellipse(0, 0, 26, 16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.moveTo(10, 4); ctx.lineTo(34, 10 + Math.sin(now / 80) * 3); ctx.lineTo(8, 14); ctx.fill(); // hàm dưới
    ctx.fillStyle = pal.body; ctx.beginPath(); ctx.moveTo(8, -12); ctx.lineTo(36, -2); ctx.lineTo(8, 4); ctx.fill(); // mõm
    ctx.fillStyle = pal.light; ctx.beginPath(); ctx.ellipse(-4, -6, 10, 4, -0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(14 + i * 5, 3); ctx.lineTo(16 + i * 5, 8); ctx.lineTo(18 + i * 5, 3); ctx.fill(); }
    ctx.strokeStyle = pal.light; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(30, -4); ctx.bezierCurveTo(40, -18, 50, 4, 62, -10 + Math.sin(now / 100) * 6); ctx.stroke(); // râu
    ctx.beginPath(); ctx.moveTo(30, 6); ctx.bezierCurveTo(42, 18, 50, 2, 60, 16 + Math.cos(now / 100) * 6); ctx.stroke();
    ctx.restore();
    glowDot(ctx, hx + Math.cos(a) * 4 - Math.sin(a) * -6, hy + Math.sin(a) * 4 + Math.cos(a) * -6, 14, pal.eye, fade);
    return [hx, hy, a];
  }
  function dragonSkill(el, dur, impact) {
    const pal = DRAGON_PAL[el];
    return {
      dur,
      spawn(f, o) {
        const r = f.r || 190, d = impact * dur;
        f.trailT = 0;
        if (el === 'fire') {
          f.flames = Array.from({ length: 14 }, (_, i) => ({ a: i / 14 * TAU, d: r * (0.55 + R() * 0.45), h: 70 + R() * 70, t: R() * 0.15 }));
          emit(70, o.tx, o.ty - 10, { speed: r * 1.7, life: 700, size: 6, color: pal.body, flat: 0.5, drag: 2, delay: d });
          emit(60, o.tx, o.ty - 10, { speed: 30, vy: -140, life: 1100, size: 5, color: R() < 0.5 ? pal.light : pal.body, jitter: r * 0.8, jitterY: r * 0.35, delay: d, delayRand: 500 });
          setFlash(f, '#ff7020', d, 450);
        } else if (el === 'water') {
          for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; emit(8, o.tx + Math.cos(a) * r * 0.5, o.ty + Math.sin(a) * r * 0.22, { angle: -Math.PI / 2, spread: 0.9, speed: 260, grav: 600, life: 900, size: 5, color: R() < 0.4 ? '#ffffff' : pal.body, delay: d + i * 15 }); }
          emit(60, o.tx, o.ty - 8, { speed: r * 1.8, life: 700, size: 5, color: pal.light, flat: 0.45, drag: 2, delay: d });
          setFlash(f, '#40b0ff', d, 450);
        } else if (el === 'thunder') {
          // 7 tia sét giáng xuống rải trong vùng, lần lượt từng tia
          f.bolts = Array.from({ length: 7 }, (_, i) => { const a = R() * TAU, dd = i ? r * (0.25 + R() * 0.7) : 0; return { x: Math.cos(a) * dd, y: Math.sin(a) * dd * 0.45, t: i * 0.06 + R() * 0.03, seed: R() * 100 }; });
          emit(70, o.tx, o.ty - 10, { speed: r * 1.8, life: 600, size: 4, color: R() < 0.5 ? pal.light : pal.glow, flat: 0.45, drag: 2.2, delay: d });
          emit(40, o.tx, o.ty - 20, { speed: 60, vy: -120, life: 900, size: 3, color: '#ffffff', jitter: r * 0.8, jitterY: r * 0.35, delay: d, delayRand: 400 });
          setFlash(f, '#e8d8ff', d, 380);
        } else if (el === 'shadow') {
          // linh hồn bị hút từ rìa vùng về người ra chiêu
          f.souls = Array.from({ length: 12 }, (_, i) => { const a = i / 12 * TAU + R() * 0.3, dd = r * (0.5 + R() * 0.5); return { x: Math.cos(a) * dd, y: Math.sin(a) * dd * 0.45, t: R() * 0.25, w: 0.8 + R() * 0.6 }; });
          emit(60, o.tx, o.ty - 10, { speed: r * 1.4, life: 900, size: 6, color: R() < 0.6 ? '#1a0412' : pal.light, flat: 0.45, drag: 1.6, delay: d });
          setFlash(f, '#5a0a2a', d, 520);
        } else {
          f.spikes = Array.from({ length: 26 }, (_, i) => { const a = i / 26 * TAU + R() * 0.2, dd = r * (0.25 + R() * 0.75); return { x: Math.cos(a) * dd, y: Math.sin(a) * dd * 0.45, h: 40 + R() * 60, t: (dd / r) * 0.12 }; });
          emit(80, o.tx, o.ty - 20, { speed: r * 1.6, life: 1000, size: 4, color: '#ffffff', flat: 0.5, drag: 1.6, delay: d });
          emit(40, o.tx, o.ty - 120, { speed: 30, vy: 40, life: 1400, size: 5, color: '#e8fbff', jitter: r, jitterY: 60, delay: d, delayRand: 600 });
          setFlash(f, '#c8f4ff', d, 500);
        }
      },
      draw(ctx, f, p, o) {
        const r = f.r || 190, now = performance.now();
        const q = Math.min(1, p / impact);
        // vòng phép dưới mục tiêu báo trước
        runeCircle(ctx, o.tx, o.ty, r, pal.glow, Math.min(1, p * 3) * (1 - Math.max(0, p - 0.8) / 0.2), p * 2, 12);
        if (p < impact + 0.12) {
          const fade = p < impact ? 1 : 1 - (p - impact) / 0.12;
          const [hx, hy, a] = drawDragon(ctx, o, q, pal, fade, now);
          if (Math.random() < 0.9) emit(2, hx, hy, { angle: a + Math.PI, spread: 0.8, speed: 80, life: 500, size: 5, color: el === 'water' ? '#ffffff' : el === 'shadow' ? (Math.random() < 0.5 ? '#12030c' : pal.light) : pal.light });
          if (el === 'thunder' && Math.random() < 0.35) {   // tia điện nhỏ quanh thân rồng
            const ex = hx + (Math.random() - 0.5) * 90, ey = hy + (Math.random() - 0.5) * 60;
            drawBolt(ctx, [[hx, hy], [(hx + ex) / 2 + (Math.random() - 0.5) * 20, (hy + ey) / 2 + (Math.random() - 0.5) * 20], [ex, ey]], pal.glow, fade, 1.6);
          }
        }
        if (p >= impact) {
          const e = (p - impact) / (1 - impact), fade = 1 - e;
          glowDot(ctx, o.tx, o.ty - 30, 60 + e * r * 1.2, pal.glow, fade * 0.9);
          ground(ctx, o.tx, o.ty, r * 1.2, pal.body, fade * 0.6);
          if (el === 'fire') {
            glowPath(ctx, () => ctx.ellipse(o.tx, o.ty, r * ease(e) * 1.1, r * ease(e) * 0.5, 0, 0, TAU), pal.body, 8, fade);
            for (const fl of f.flames || []) {
              const lp = Math.max(0, Math.min(1, (e - fl.t) / 0.4));
              const x = o.tx + Math.cos(fl.a) * fl.d * ease(lp), y = o.ty + Math.sin(fl.a) * fl.d * 0.45 * ease(lp);
              const h = fl.h * Math.sin(Math.min(1, lp * 1.5) * Math.PI * 0.5) * fade * (0.85 + Math.sin(now / 60 + fl.a * 7) * 0.15);
              const g = ctx.createLinearGradient(0, y - h, 0, y);
              g.addColorStop(0, Sprites.hexA(pal.light, 0)); g.addColorStop(0.5, Sprites.hexA(pal.body, 0.7)); g.addColorStop(1, Sprites.hexA('#fff0a0', 0.9));
              ctx.globalAlpha = 1; ctx.fillStyle = g;
              ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.quadraticCurveTo(x - 10, y - h * 0.6, x, y - h); ctx.quadraticCurveTo(x + 10, y - h * 0.6, x + 12, y); ctx.fill();
            }
          } else if (el === 'water') {
            for (let k = 0; k < 3; k++) {
              const lp = Math.max(0, (e - k * 0.12) / 0.7);
              if (lp > 1) continue;
              const rr = r * 0.3 + ease(lp) * r * 0.9;
              glowPath(ctx, () => ctx.ellipse(o.tx, o.ty - 6, rr, rr * 0.45, 0, 0, TAU), k === 0 ? '#ffffff' : pal.body, 10 - k * 3, 1 - lp);
              for (let i = 0; i < 16; i++) { const an = i / 16 * TAU + k; glowDot(ctx, o.tx + Math.cos(an) * rr, o.ty - 12 + Math.sin(an) * rr * 0.45 - Math.abs(Math.sin(now / 90 + i)) * 10, 12, '#ffffff', (1 - lp) * 0.8); }
            }
            const h = 180 * Math.sin(Math.min(1, e * 2) * Math.PI);
            const g = ctx.createLinearGradient(0, o.ty - h, 0, o.ty);
            g.addColorStop(0, Sprites.hexA('#ffffff', 0)); g.addColorStop(1, Sprites.hexA(pal.body, 0.8));
            ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(o.tx - 30, o.ty - h, 60, h);
          } else if (el === 'thunder') {
            // vòng điện lan ra + các tia sét giáng xuống
            glowPath(ctx, () => ctx.ellipse(o.tx, o.ty, r * ease(Math.min(1, e * 1.6)), r * ease(Math.min(1, e * 1.6)) * 0.45, 0, 0, TAU), pal.glow, 6, fade);
            for (const b of f.bolts || []) {
              const lp = (e - b.t) / 0.22;
              if (lp < 0 || lp > 1) continue;
              const x = o.tx + b.x, y = o.ty + b.y, fl = (1 - lp) * (0.7 + 0.3 * Math.sin(now / 25 + b.seed));
              drawBolt(ctx, boltPts(x, y, 360, b.seed + Math.floor(now / 70)), pal.glow, fl, 3);
              glowDot(ctx, x, y - 4, 40, pal.light, fl);
              ground(ctx, x, y, 34, pal.glow, fl * 0.7);
            }
            for (let i = 0; i < 10; i++) {   // hồ quang chạy trên mặt đất
              const an = i / 10 * TAU + now / 300, rr = r * (0.3 + 0.7 * ((i * 0.37 + e) % 1));
              if (Math.random() < 0.5) glowDot(ctx, o.tx + Math.cos(an) * rr, o.ty + Math.sin(an) * rr * 0.45, 10, '#ffffff', fade * 0.8);
            }
          } else if (el === 'shadow') {
            // xoáy đen nuốt hồn, linh hồn bay ngược về người ra chiêu
            ctx.save(); ctx.globalAlpha = 0.75 * fade; ctx.fillStyle = '#080206';
            ctx.beginPath(); ctx.ellipse(o.tx, o.ty, r * ease(Math.min(1, e * 2)) * 0.95, r * ease(Math.min(1, e * 2)) * 0.42, 0, 0, TAU); ctx.fill(); ctx.restore();
            for (let k = 0; k < 3; k++) {
              const rot = now / 260 * (k % 2 ? -1 : 1) + k;
              glowPath(ctx, () => { for (let i = 0; i <= 40; i++) { const t = i / 40, an = rot + t * TAU * 1.5, rr = r * (0.15 + t * 0.8) * ease(Math.min(1, e * 2)); const x = o.tx + Math.cos(an) * rr, y = o.ty + Math.sin(an) * rr * 0.45; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } }, k ? pal.glow : pal.light, 4 - k, fade * 0.8);
            }
            for (const sp of f.souls || []) {
              const lp = Math.max(0, Math.min(1, (e - sp.t) / 0.6));
              if (lp <= 0 || lp >= 1) continue;
              const x0 = o.tx + sp.x, y0 = o.ty + sp.y - 20, x1 = o.sx, y1 = o.sy - 40;
              const q = ease(lp), x = x0 + (x1 - x0) * q + Math.sin(lp * 9 + sp.w * 5) * 14, y = y0 + (y1 - y0) * q - Math.sin(lp * Math.PI) * 80 * sp.w;
              glowDot(ctx, x, y, 22, pal.glow, (1 - lp) * 0.9);
              glowDot(ctx, x, y, 7, '#ffd0e0', 1 - lp);
            }
            glowDot(ctx, o.tx, o.ty - 20, 50 + e * 40, '#ff2050', fade * 0.5);
          } else {
            glowPath(ctx, () => ctx.ellipse(o.tx, o.ty, r * ease(Math.min(1, e * 2)), r * ease(Math.min(1, e * 2)) * 0.45, 0, 0, TAU), '#ffffff', 5, fade);
            for (const sp of f.spikes || []) {
              const lp = Math.min(1, Math.max(0, (e - sp.t) / 0.12));
              if (lp <= 0) continue;
              const x = o.tx + sp.x, y = o.ty + sp.y, h = sp.h * ease(lp), fa = 1 - Math.max(0, e - 0.65) / 0.35;
              ctx.globalAlpha = 0.8 * fa; ctx.fillStyle = pal.body;
              ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 2, y - h); ctx.lineTo(x + 10, y); ctx.closePath(); ctx.fill();
              ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9 * fa;
              ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 2, y - h); ctx.lineTo(x + 2, y); ctx.closePath(); ctx.fill();
              glowDot(ctx, x - 2, y - h, 16, '#ffffff', fa * lp);
            }
          }
        }
      }
    };
  }
  SIG.firedragon = dragonSkill('fire', 1700, 0.5);
  SIG.waterdragon = dragonSkill('water', 1700, 0.5);
  SIG.icedragon = dragonSkill('ice', 1800, 0.48);
  SIG.thunderdragon = dragonSkill('thunder', 1700, 0.48);
  SIG.shadowdragon = dragonSkill('shadow', 1900, 0.46);


  // ===== Hình chiêu thức (assets/fx.png, vẽ bởi tools/fxsheet.py), tô màu theo chiêu =====
  const SHEET = { img: null, meta: null, tint: {} };
  (function loadSheet() {
    const im = new Image(); im.onload = () => { SHEET.img = im; }; im.src = '/assets/fx.png' + (window.AV ? '?v=' + window.AV : '');
    fetch('/assets/fx.json' + (window.AV ? '?v=' + window.AV : '')).then(r => r.json()).then(m => { SHEET.meta = m; }).catch(() => {});
  })();
  function tinted(name, i, color) {
    const key = name + i + color;
    if (SHEET.tint[key]) return SHEET.tint[key];
    const C = SHEET.meta.cell, [row] = SHEET.meta.fx[name];
    const cv = document.createElement('canvas'); cv.width = cv.height = C;
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(SHEET.img, i * C, row * C, C, C, 0, 0, C, C);
    x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.82; x.fillStyle = color; x.fillRect(0, 0, C, C);
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.22; x.drawImage(SHEET.img, i * C, row * C, C, C, 0, 0, C, C);
    return (SHEET.tint[key] = cv);
  }
  // vẽ 1 khung hình chiêu: p = tiến trình 0..1 (chọn khung), hoặc o.frame
  function fxSprite(ctx, name, p, x, y, o = {}) {
    if (!SHEET.img || !SHEET.meta || !SHEET.meta.fx[name]) return;
    const n = SHEET.meta.fx[name][1];
    const i = o.frame != null ? o.frame % n : Math.min(n - 1, Math.floor(Math.max(0, p) * n));
    const img = tinted(name, i, o.color || '#ffffff');
    const s = o.scale || 1, C = SHEET.meta.cell;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = o.alpha == null ? 1 : Math.max(0, Math.min(1, o.alpha));
    ctx.translate(Math.round(x), Math.round(y));
    if (o.rot) ctx.rotate(o.rot);
    if (o.flipY) ctx.scale(1, -1);
    if (o.flat) ctx.scale(1, o.flat);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, -C / 2 * s, -(o.anchor || 0.5) * C * s, C * s, C * s);
    ctx.restore();
  }
  // Biểu tượng chiêu thức riêng của từng môn phái
  const MOTIF = {
    vodang:     { proj: 'sword', aoe: 'swordrain', hit: 'sword' },
    ngamy:      { proj: 'sword', aoe: 'lotus', hit: 'lotus' },
    thuyyen:    { proj: 'snow', aoe: 'ice', hit: 'snow' },
    thieulam:   { proj: 'wan', aoe: 'wan', hit: 'wan' },
    thienvuong: { proj: 'fireball', aoe: 'flame', hit: 'fireball' },
    duongmon:   { proj: 'dart', aoe: 'dartrain', hit: 'shuriken' },
    ngudoc:     { proj: 'snake', aoe: 'skull', hit: 'skull' },
    caibang:    { proj: 'dragonhead', aoe: 'dragonhead', hit: 'palm' },
    conlon:     { proj: 'talisman', aoe: 'bagua', hit: 'lightning' }
  };
  const ROTATES = new Set(['sword', 'dart', 'fireball', 'dragonhead', 'snake', 'qi']);
  const PROJ = new Set(['dart', 'bolt', 'dartfan', 'dragon']);
  const MELEE = new Set(['slash', 'slash2', 'palm', 'dash', 'bite']);
  const AOE = new Set(['ring', 'net', 'swords', 'taiji', 'lotus', 'poison', 'tornado', 'nova', 'meteor', 'pillar', 'storm', 'blades']);
  function seeded(i) { const x = Math.sin(i * 91.7 + 13.3) * 43758.5453; return x - Math.floor(x); }
  // bay theo hướng a: hình nhìn sang trái thì lật dọc để không bị lộn ngược
  function flying(ctx, kind, x, y, a, o) {
    const rot = ROTATES.has(kind);
    fxSprite(ctx, kind, 0, x, y, Object.assign({ frame: Math.floor(performance.now() / 80), rot: rot ? a : 0, flipY: rot && Math.abs(a) > Math.PI / 2 }, o));
  }
  function aoeMotif(ctx, kind, p, x, y, r, c) {
    const fade = Math.min(1, 1.25 - p), now = performance.now();
    switch (kind) {
      case 'swordrain':   // kiếm từ trời cắm xuống
        for (let i = 0; i < 7; i++) {
          const ang = i / 7 * Math.PI * 2, d = i === 0 ? 0 : r * (0.35 + seeded(i) * 0.45);
          const gx = x + Math.cos(ang) * d, gy = y + Math.sin(ang) * d * 0.45;
          const lp = Math.min(1, Math.max(0, (p - i * 0.04) / 0.35));
          if (lp <= 0) continue;
          fxSprite(ctx, 'sword', 0, gx, gy - 14 - 220 * (1 - ease(lp)), { frame: i, rot: Math.PI / 2, color: c, scale: 1.1, alpha: fade });
          if (lp >= 1) fxSprite(ctx, 'burst', (p - i * 0.04 - 0.35) * 3, gx, gy - 6, { color: c, scale: 0.6 });
        }
        break;
      case 'wan':         // chữ Vạn vàng in xuống đất + chữ Vạn lớn bay lên
        fxSprite(ctx, 'wan', 0, x, y, { frame: Math.floor(now / 120), color: c, scale: Math.max(1.6, r / 24), flat: 0.45, alpha: fade });
        fxSprite(ctx, 'wan', 0, x, y - 40 - p * 40, { frame: Math.floor(now / 120), color: c, scale: 1.3 + p * 0.6, alpha: fade * 0.9 });
        break;
      case 'lotus':
        fxSprite(ctx, 'lotus', p * 1.3, x, y - 4, { color: c, scale: Math.max(1.6, r / 28), alpha: fade });
        for (let i = 0; i < 5; i++) { const ang = i / 5 * Math.PI * 2 + p; fxSprite(ctx, 'lotus', p * 1.3 - 0.1, x + Math.cos(ang) * r * 0.6, y + Math.sin(ang) * r * 0.27 - 4, { color: c, scale: 0.8, alpha: fade }); }
        break;
      case 'ice':
        for (let i = 0; i < 6; i++) { const ang = i / 6 * Math.PI * 2, d = i ? r * 0.55 : 0; fxSprite(ctx, 'ice', p * 1.4 - i * 0.05, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.45 - 20, { color: c, scale: i ? 0.9 : 1.4, alpha: fade }); }
        fxSprite(ctx, 'snow', 0, x, y - 60, { frame: Math.floor(now / 90), color: c, scale: 1.2 + p, alpha: fade });
        break;
      case 'flame':
        for (let i = 0; i < 7; i++) { const ang = i / 7 * Math.PI * 2, d = i ? r * (0.4 + seeded(i) * 0.4) : 0; fxSprite(ctx, 'flame', p * 1.2, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.45, { color: c, scale: i ? 1 : 1.6, anchor: 0.9, alpha: fade }); }
        break;
      case 'dartrain':    // mưa phi đao
        for (let i = 0; i < 12; i++) {
          const ang = seeded(i) * Math.PI * 2, d = Math.sqrt(seeded(i + 50)) * r;
          const gx = x + Math.cos(ang) * d, gy = y + Math.sin(ang) * d * 0.45;
          const lp = Math.min(1, Math.max(0, (p - seeded(i + 9) * 0.3) / 0.3));
          if (lp <= 0 || lp >= 1) continue;
          fxSprite(ctx, 'dart', 0, gx + 40 * (1 - lp), gy - 180 * (1 - lp), { rot: Math.PI / 2 + 0.2, color: c, scale: 0.9 });
        }
        fxSprite(ctx, 'shuriken', 0, x, y - 30, { frame: Math.floor(now / 50), color: c, scale: 1.6, alpha: fade });
        break;
      case 'skull':
        fxSprite(ctx, 'skull', p, x, y - 26, { color: c, scale: Math.max(1.5, r / 40), alpha: fade });
        for (let i = 0; i < 4; i++) { const ang = i / 4 * Math.PI * 2 + p * 2; flying(ctx, 'snake', x + Math.cos(ang) * r * 0.6, y + Math.sin(ang) * r * 0.27, ang + Math.PI / 2, { color: c, scale: 0.8, alpha: fade }); }
        break;
      case 'dragonhead':
        flying(ctx, 'dragonhead', x - r * 0.8 + r * 1.6 * ease(Math.min(1, p * 1.4)), y - 40, 0, { color: c, scale: 2.2, alpha: fade });
        break;
      case 'bagua':
        fxSprite(ctx, 'bagua', 0, x, y, { frame: Math.floor(now / 100), color: c, scale: Math.max(1.6, r / 24), flat: 0.45, alpha: fade });
        for (let i = 0; i < 3; i++) {
          const lp = (p - i * 0.18) / 0.25; if (lp < 0 || lp > 1) continue;
          const ang = seeded(i + 3) * Math.PI * 2, d = r * 0.5;
          fxSprite(ctx, 'lightning', 0, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.45, { frame: i, color: c, scale: 2, anchor: 0.95, alpha: 1 - lp });
        }
        break;
    }
  }
  function spriteLayer(ctx, f, p, g, sigOnly) {
    const { sx, sy, tx, ty, bx, by, ex, ey, src, r, c } = g;
    const a = Math.atan2(ey - by, ex - bx), now = performance.now();
    const cls = src && (src.cls || (src === window.G.self && window.G.me ? window.G.me.cls : null));
    const M = MOTIF[cls] || { proj: 'qi', aoe: null, hit: 'burst' };
    if (sigOnly) { if (M.aoe && !lean) aoeMotif(ctx, M.aoe, p, tx, ty, r, c); return; }   // máy yếu / đang nặng: bỏ hình nền môn phái phía sau chiêu
    if (MELEE.has(f.t)) {
      if (f.t !== 'palm' || cls !== 'caibang')
        fxSprite(ctx, 'slash', p * 1.3, ex, ey, { rot: a, color: f.t === 'bite' ? '#ff5050' : c, scale: f.t === 'bite' ? 0.8 : f.t === 'dash' ? 1.6 : 1.15, alpha: 1.2 - p });
      if (f.t === 'slash2') fxSprite(ctx, 'slash', p * 1.3 - 0.15, ex, ey, { rot: a + Math.PI, color: c, alpha: 1.1 - p });
      if (f.t === 'bite') return;
      if (M.hit === 'sword') {   // mũi kiếm đâm tới
        const q = Math.min(1, p / 0.35);
        flying(ctx, 'sword', ex - Math.cos(a) * 30 * (1 - q), ey - Math.sin(a) * 30 * (1 - q), a, { color: c, scale: 0.9, alpha: 1.2 - p });
      } else if (M.hit === 'palm' || f.t === 'palm') {
        const q = Math.min(1, p / 0.45);
        fxSprite(ctx, 'palm', 0, bx + (ex - bx) * ease(q), by + (ey - by) * ease(q), { frame: Math.floor(now / 80), rot: a, flipY: Math.abs(a) > Math.PI / 2, color: c, scale: 0.9 + q * 0.5, alpha: p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4 });
      } else if (M.hit === 'lightning') {
        fxSprite(ctx, 'lightning', 0, ex, ey + 24, { frame: Math.floor(now / 60), color: c, scale: 1.4, anchor: 0.95, alpha: 1 - p });
      } else {
        flying(ctx, M.hit, ex, ey - 6 - p * 10, a, { color: c, scale: 0.5 + ease(Math.min(1, p * 2)) * 0.5, alpha: 1.2 - p });
      }
      if (p > 0.3) fxSprite(ctx, 'burst', (p - 0.3) / 0.7, ex, ey, { color: c, scale: 0.8 });
      return;
    }
    if (PROJ.has(f.t)) {
      const n = f.t === 'dartfan' ? 5 : 1, travel = f.t === 'beam' ? 0.5 : 0.85, q = Math.min(1, p / travel), len = Math.hypot(ex - bx, ey - by);
      const big = f.t === 'beam' || f.t === 'dragon';
      for (let i = 0; i < n; i++) {
        const aa = a + (i - (n - 1) / 2) * 0.16;
        if (q < 1) flying(ctx, M.proj, bx + Math.cos(aa) * len * q, by + Math.sin(aa) * len * q, aa, { color: c, scale: big ? 1.6 : 0.95 });
      }
      if (q >= 1) {
        const ep = (p - travel) / (1 - travel);
        fxSprite(ctx, 'burst', ep, ex, ey, { color: c, scale: big ? 1.4 : 0.9 });
        if (M.hit !== 'sword' && M.hit !== 'palm' && M.hit !== 'lightning') flying(ctx, M.hit, ex, ey - 8, a, { color: c, scale: 0.7 + ep * 0.4, alpha: 1 - ep });
      }
      return;
    }
    if (AOE.has(f.t)) {
      if (f.t === 'taiji') fxSprite(ctx, 'taiji', 0, ex, ty - 4, { frame: Math.floor(now / 90), color: c, scale: r / 26, flat: 0.45, alpha: 1 - p });
      if (f.t === 'tornado') fxSprite(ctx, 'tornado', 0, ex, ty, { frame: Math.floor(now / 70), color: c, scale: 2.4, anchor: 0.9, alpha: p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.7) / 0.3) });
      if (f.t === 'ring' || f.t === 'net' || f.t === 'nova') fxSprite(ctx, 'shock', p, ex, ty, { color: c, scale: r / 26 });
      if (f.t === 'blades') {
        for (let i = 0; i < 4; i++) { const aa = i / 4 * Math.PI * 2 + p * 6; fxSprite(ctx, 'slash', p, bx + Math.cos(aa) * (20 + r * 0.5 * ease(p)), sy - 20 + Math.sin(aa) * (10 + r * 0.25 * ease(p)), { rot: aa, color: c, scale: 0.9 }); }
      }
      if (M.aoe) aoeMotif(ctx, M.aoe, p, f.t === 'blades' ? sx : tx, f.t === 'blades' ? sy : ty, r, c);
      else if (f.t === 'poison') fxSprite(ctx, 'skull', p, ex, ty - 20, { color: c, scale: 1.4, alpha: 1.2 - p });
      return;
    }
    if (f.t === 'aura' || f.t === 'heal') {
      const x = src ? src.x : f.x, y = src ? src.y : f.y;
      if (f.t === 'aura') fxSprite(ctx, 'aura', 0, x, y, { frame: Math.floor(now / 90), color: c, scale: 1.4, anchor: 0.92, alpha: 1 - p });
      else fxSprite(ctx, 'lotus', p * 1.4, x, y - 4, { color: '#8dffb0', scale: 1.6, alpha: 1.2 - p });
      // biểu tượng môn phái hiện trên đầu khi vận công
      const em = cls === 'vodang' ? 'taiji' : M.hit === 'palm' ? 'dragonhead' : M.hit;
      if (em && em !== 'burst') fxSprite(ctx, em, 0, x, y - 92 - p * 16, { frame: Math.floor(now / 100), color: c, scale: 0.8, alpha: Math.min(1, (1 - p) * 1.6) });
    }
  }

  // ===== Chiêu hình ảnh: binh khí, hình nhân, linh thú (ánh sáng chỉ để điểm xuyết) =====
  const cl = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const seg = (p, a, b) => cl((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const FR = (ms = 90) => Math.floor(performance.now() / ms);
  const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
  function spr(ctx, name, x, y, o) { fxSprite(ctx, name, 0, x, y, o); }
  // hình hướng phải quay theo góc a; quay sang trái thì lật dọc cho khỏi lộn ngược
  function rspr(ctx, name, x, y, a, o) { fxSprite(ctx, name, 0, x, y, Object.assign({ rot: a, flipY: Math.cos(a) < 0 }, o)); }
  // hình bay từ (x0,y0) tới (x1,y1) theo q, kèm n bóng mờ phía sau
  function fly(ctx, name, x0, y0, x1, y1, q, o = {}, n = 3, gap = 0.07) {
    const a = Math.atan2(y1 - y0, x1 - x0), al = o.alpha == null ? 1 : o.alpha;
    for (let k = n; k >= 0; k--) {
      const t = q - k * gap; if (t < 0 || t > 1) continue;
      rspr(ctx, name, lerp(x0, x1, t), lerp(y0, y1, t), a, Object.assign({}, o, { alpha: al * (k ? 0.4 * (1 - k / (n + 1)) : 1) }));
    }
  }
  // vung binh khí quanh điểm tựa (px,py) từ góc a0 tới a1, kèm 2 bóng mờ
  function swing(ctx, name, px, py, a0, a1, q, len, c, al = 1) {
    const s = len / 56;
    for (let k = 2; k >= 0; k--) {
      const t = Math.max(0, q - k * 0.1), a = a0 + (a1 - a0) * ease(t);
      rspr(ctx, name, px + Math.cos(a) * len * 0.5, py + Math.sin(a) * len * 0.5, a, { color: c, scale: s, alpha: al * (k ? 0.35 / k : 1) });
    }
  }
  function boom(ctx, x, y, q, c, s = 1) {   // nổ va chạm: sao nổ + quầng sáng nhỏ
    if (q <= 0 || q >= 1) return;
    glowDot(ctx, x, y, 30 * s, c, (1 - q) * 0.6);
    fxSprite(ctx, 'burst', q, x, y, { color: c, scale: s });
  }
  function shock(ctx, x, y, q, c, r) {   // sóng chấn: vòng nhỏ dùng hình, vòng lớn vẽ nét mảnh (hình phóng to bị vỡ hạt)
    if (q <= 0 || q >= 1) return;
    if (r <= 60) { fxSprite(ctx, 'shock', q, x, y, { color: c, scale: r / 30, anchor: 0.625 }); return; }
    const rr = r * (0.2 + 0.8 * ease(q));
    glowPath(ctx, () => ctx.ellipse(x, y, rr, rr * 0.45, 0, 0, TAU), c, 1 + 3 * (1 - q), 1 - q);
  }
  const WEAPON = { thieulam: 'staff', caibang: 'staff', thienvuong: 'hammer', thuyyen: 'blade', ngudoc: 'blade' };
  function clsOf(src) { return src && (src.cls || (src === window.G.self && window.G.me ? window.G.me.cls : null)); }
  function crack(ctx, x, y, q, c, s, al = 1) { if (q > 0) fxSprite(ctx, 'crack', Math.min(0.99, q * 1.3), x, y, { color: c, scale: s, flat: 0.5, alpha: al }); }
  function figure(ctx, name, x, y, frame, c, s, al) {   // hình nhân đứng (chân tại y) + hào quang sau lưng
    glowDot(ctx, x, y - 32 * s, 40 * s, c, al * 0.45, true);
    fxSprite(ctx, name, 0, x, y, { frame, color: c, scale: s, anchor: 0.97, alpha: al });
  }
  function hop(x0, y0, x1, y1, t, h) { return [lerp(x0, x1, t), lerp(y0, y1, t) - Math.sin(Math.PI * t) * h]; }
  function clouds(ctx, x, y, r, a) {   // mây đen vần vũ
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 9; i++) {
      ctx.globalAlpha = 0.5 * a; ctx.fillStyle = i % 2 ? '#2a1c3a' : '#3a2a50';
      ctx.beginPath(); ctx.ellipse(x + (i - 4) * r * 0.22, y + Math.sin(i * 2) * 14, r * 0.3, 34, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function ringPts(n, r, rnd) {   // n điểm rải trong vòng tròn dẹt bán kính r
    return Array.from({ length: n }, (_, i) => { const a = i / n * TAU + (rnd ? R() * 0.5 : 0), d = rnd ? r * (0.3 + R() * 0.7) : r; return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.45, a }; });
  }
  const AHEAD = (o) => Math.atan2(o.ty - o.sy, o.tx - o.sx);

  Object.assign(SIG, {
    // Võ Đang – Vô Ngã Vô Kiếm: kiếm bay vòng quanh thân rồi lần lượt phóng theo đường chiêu
    orbitswords: {
      dur: 1150, own: true,
      spawn(f, o) {
        f.n = f.ult ? 11 : 8;
        for (let i = 0; i < f.n; i += 2) emit(5, o.tx, o.ty - 28, { speed: 150, life: 380, size: 3.5, color: f.color, delay: (0.56 + i * 0.045) * 1150, drag: 3 });
      },
      draw(ctx, f, p, o) {
        const n = f.n || 8, c = f.color, cx = o.sx, cy = o.sy - 34, ex = o.tx, ey = o.ty - 28;
        const a = Math.atan2(ey - cy, ex - cx), nx = -Math.sin(a), ny = Math.cos(a), spin = p * 10;
        ground(ctx, o.sx, o.sy, 70, c, 0.35 * (1 - seg(p, 0.5, 0.8)));
        for (let i = 0; i < n; i++) {
          const th = i / n * TAU + spin, app = seg(p, i * 0.015, i * 0.015 + 0.12);
          const ox = cx + Math.cos(th) * 80 * app, oy = cy + Math.sin(th) * 32 * app + Math.sin(p * 20 + i * 1.7) * 7;   // nhấp nhô nhẹ
          const t0 = 0.34 + i * 0.045, q = seg(p, t0, t0 + 0.2), off = (i - (n - 1) / 2) * 7;
          const x1 = ex + nx * off, y1 = ey + ny * off, aim = Math.atan2(y1 - oy, x1 - ox);
          if (q <= 0) {   // bay vòng: mũi kiếm theo chiều xoay, sắp phóng thì quay mũi về mục tiêu
            const tang = Math.atan2(Math.cos(th) * 32, -Math.sin(th) * 80);
            const turn = seg(p, t0 - 0.08, t0);
            rspr(ctx, 'sword', ox, oy, tang + wrapA(aim - tang) * turn, { color: c, frame: i, scale: 1, alpha: app });
          } else if (q < 1) {
            const x = lerp(ox, x1, q * q), y = lerp(oy, y1, q * q);
            glowPath(ctx, () => { ctx.moveTo(x - Math.cos(aim) * 46, y - Math.sin(aim) * 46); ctx.lineTo(x, y); }, c, 2, 0.5);
            for (let k = 2; k >= 0; k--) { const t = Math.max(0, q - k * 0.08); rspr(ctx, 'sword', lerp(ox, x1, t * t), lerp(oy, y1, t * t), aim, { color: c, frame: i, scale: 1.05, alpha: k ? 0.3 / k : 1 }); }
          } else boom(ctx, x1, y1, seg(p, t0 + 0.2, t0 + 0.42), c, 0.7);
        }
      }
    },

    // ===== Thiếu Lâm / Cái Bang – côn bổng =====
    staffhit: {
      dur: 420, own: true,
      spawn(f, o) { emit(10, o.tx, o.ty - 28, { speed: 150, life: 350, size: 4, color: f.color, delay: 160, drag: 3 }); },
      draw(ctx, f, p, o) {
        const a = AHEAD(o), len = Math.max(70, Math.min(110, Math.hypot(o.tx - o.sx, o.ty - o.sy) + 20)), q = seg(p, 0, 0.45);
        swing(ctx, 'staff', o.sx, o.sy - 34, a - 1.7, a + 0.25, q, len, f.color, 1 - seg(p, 0.6, 1));
        boom(ctx, o.tx, o.ty - 28, seg(p, 0.38, 1), f.color, 0.8);
        shock(ctx, o.tx, o.ty, seg(p, 0.4, 1), f.color, 30);
      }
    },
    // Bát Cẩu Triều Đầu: bổng chọc liên hoàn từ nhiều hướng
    staffcombo: {
      dur: 750, own: true,
      spawn(f, o) { for (let i = 0; i < 4; i++) emit(6, o.tx, o.ty - 30, { speed: 150, life: 320, size: 4, color: f.color, delay: (0.12 + i * 0.18) * 750, drag: 3 }); },
      draw(ctx, f, p, o) {
        const a = AHEAD(o), c = f.color, ex = o.tx, ey = o.ty - 30;
        for (let i = 0; i < 4; i++) {
          const q = seg(p, i * 0.18, i * 0.18 + 0.2), aa = a + [-0.5, 0.45, -0.2, 0.15][i];
          if (q <= 0 || q >= 1) continue;
          const reach = Math.sin(Math.PI * q) * 40, bx = ex - Math.cos(aa) * (70 - reach), by = ey - Math.sin(aa) * (70 - reach) + (i - 1.5) * 8;
          rspr(ctx, 'staff', bx, by, aa, { color: c, scale: 1.2, alpha: 1 });
          rspr(ctx, 'staff', bx - Math.cos(aa) * 18, by - Math.sin(aa) * 18, aa, { color: c, scale: 1.2, alpha: 0.3 });
          boom(ctx, ex + (i - 1.5) * 6, ey + (i - 1.5) * 8, seg(p, i * 0.18 + 0.08, i * 0.18 + 0.4), c, 0.6);
        }
        if (p > 0.7) spr(ctx, 'palm', ex, ey - 6, { color: c, scale: 0.6 + seg(p, 0.7, 1) * 0.5, alpha: 1 - seg(p, 0.75, 1), frame: FR(80) });
      }
    },
    // Hoành Tảo Thiên Quân / Thiên Hạ Vô Cẩu: côn quét tròn quanh thân
    staffsweep: {
      dur: 900, own: true,
      spawn(f, o) { emit(30, o.sx, o.sy - 6, { speed: (f.r || 120) * 1.4, life: 500, size: 4, color: '#d8c8a0', flat: 0.45, drag: 2.5, delay: 250 }); },
      draw(ctx, f, p, o) {
        const r = f.r || 120, c = f.color, q = seg(p, 0, 0.7), cx = o.sx, cy = o.sy - 20;
        flat(ctx, cx, cy, () => {   // côn quay trong mặt phẳng đất nên bị dẹt theo phối cảnh
          for (let k = 4; k >= 0; k--) {
            const t = Math.max(0, q - k * 0.03), th = -Math.PI / 2 + t * TAU * 1.5;
            rspr(ctx, 'staff', Math.cos(th) * r * 0.5, Math.sin(th) * r * 0.5, th, { color: c, scale: r / 56, alpha: (k ? 0.28 * (1 - k / 5) : 1) * (1 - seg(p, 0.75, 1)) });
          }
        });
        shock(ctx, cx, o.sy, seg(p, 0.25, 0.85), c, r);
        shock(ctx, cx, o.sy, seg(p, 0.45, 1), c, r * 0.7);
      }
    },
    // La Hán Trận: bốn hư ảnh La Hán hiện quanh thân, cùng nện côn xuống
    arhats: {
      dur: 1300, own: true,
      spawn(f, o) {
        const r = (f.r || 150) * 0.62;
        f.pos = [[-r, 0], [r, 0], [-r * 0.45, -r * 0.5], [r * 0.45, -r * 0.5]].sort((A, B) => A[1] - B[1]);
        for (const [x, y] of f.pos) emit(10, o.sx + x + 28, o.sy + y, { speed: 110, life: 500, size: 4, color: f.color, flat: 0.5, drag: 2.5, delay: 600 });
        setFlash(f, '#ffe080', 600, 350);
      },
      draw(ctx, f, p, o) {
        const c = f.color, r = f.r || 150, fade = 1 - seg(p, 0.8, 1);
        fxSprite(ctx, 'wan', 0, o.sx, o.sy, { frame: FR(120), color: c, scale: r / 40, flat: 0.45, alpha: 0.3 * fade * seg(p, 0, 0.2) });
        for (const [x, y] of f.pos || []) {
          const app = seg(p, 0, 0.25), slam = p > 0.46 ? 1 : 0, s = 1.45;
          const fx = o.sx + x, fy = o.sy + y + (1 - ease(app)) * 20;
          figure(ctx, 'arhat', fx, fy, slam, c, s, app * fade * 0.92);
          const hx = fx + 28 * s, hy = fy - 2;
          crack(ctx, hx, hy, seg(p, 0.46, 0.7), c, 1.1, fade);
          boom(ctx, hx, hy - 6, seg(p, 0.46, 0.8), c, 0.9);
          shock(ctx, hx, hy, seg(p, 0.48, 0.9), c, 50);
        }
      }
    },
    // Phong Ma Trượng: tung người lên, côn khổng lồ giáng xuống nứt đất
    staffleap: {
      dur: 950, own: true,
      spawn(f, o) {
        emit(36, o.tx, o.ty - 6, { speed: 200, life: 600, size: 5, color: '#d8c090', flat: 0.5, drag: 2.5, delay: 380 });
        emit(16, o.tx, o.ty - 10, { speed: 60, vy: -220, grav: 500, life: 700, size: 4, color: f.color, jitter: 40, jitterY: 10, delay: 380 });
        setFlash(f, '#ffd080', 380, 300);
      },
      draw(ctx, f, p, o) {
        const c = f.color, r = f.r || 110, q = seg(p, 0, 0.3);
        if (q < 1) {   // côn xoay theo đường vồng
          for (let k = 3; k >= 0; k--) {
            const t = Math.max(0, q - k * 0.07), [x, y] = hop(o.sx, o.sy - 40, o.tx, o.ty - 150, t, 90);
            spr(ctx, 'staff', x, y, { rot: t * 9, color: c, scale: 1.4, alpha: k ? 0.3 / k : 1 });
          }
        } else {
          const d = seg(p, 0.3, 0.4), s = 2.4, fade = 1 - seg(p, 0.7, 1);
          spr(ctx, 'staff', o.tx, o.ty - 32 * s - 120 * (1 - d) + 6, { rot: Math.PI / 2, color: c, scale: s, alpha: fade });
          if (d < 1) glowPath(ctx, () => { ctx.moveTo(o.tx, o.ty - 260); ctx.lineTo(o.tx, o.ty - 120 * (1 - d) - 60); }, c, 3, 0.4);
          crack(ctx, o.tx, o.ty, seg(p, 0.4, 0.75), c, r / 36, fade);
          boom(ctx, o.tx, o.ty - 8, seg(p, 0.4, 0.75), c, 1.3);
          shock(ctx, o.tx, o.ty, seg(p, 0.4, 0.9), c, r);
        }
      }
    },
    // Kim Cang Phục Ma: côn vàng khổng lồ dựng lên rồi đập dọc theo đường chiêu
    giantstaff: {
      dur: 1600, own: true,
      spawn(f, o) {
        const n = 8;
        for (let i = 1; i <= n; i++) emit(8, lerp(o.sx, o.tx, i / n), lerp(o.sy, o.ty, i / n) - 6, { speed: 140, life: 600, size: 5, color: i % 2 ? f.color : '#fff0b0', flat: 0.5, drag: 2.5, delay: 0.5 * 1600 + i * 25 });
        setFlash(f, '#ffe070', 800, 450);
      },
      draw(ctx, f, p, o) {
        const c = f.color, a = AHEAD(o), len = Math.hypot(o.tx - o.sx, o.ty - o.sy), s = len / 56;
        const rise = seg(p, 0, 0.3), sw = seg(p, 0.3, 0.5), fade = 1 - seg(p, 0.8, 1);
        const th = -Math.PI / 2 + wrapA(a + Math.PI / 2) * (sw * sw);
        const px = o.sx, py = o.sy - 30 - (1 - sw) * 30;
        const L = len * (0.4 + 0.6 * ease(rise)) * 0.5;
        fxSprite(ctx, 'wan', 0, o.sx, o.sy - 150, { frame: FR(120), color: c, scale: 1.6, alpha: rise * (1 - sw) });
        glowDot(ctx, px + Math.cos(th) * L, py + Math.sin(th) * L, 90 + sw * 60, c, 0.35 * fade, true);
        for (let k = sw > 0 && sw < 1 ? 3 : 0; k >= 0; k--) {
          const t = Math.max(0, sw - k * 0.12), tk = -Math.PI / 2 + wrapA(a + Math.PI / 2) * t * t;
          rspr(ctx, 'staff', px + Math.cos(tk) * L, py + Math.sin(tk) * L, tk, { color: c, scale: s * (0.4 + 0.6 * ease(rise)), alpha: (k ? 0.25 / k : 1) * fade });
        }
        for (let i = 1; i <= 5; i++) {
          const t = i / 5, x = lerp(o.sx, o.tx, t), y = lerp(o.sy, o.ty, t), tq = seg(p, 0.5 + t * 0.06, 0.8 + t * 0.06);
          crack(ctx, x, y, tq, c, 1.3, fade);
          boom(ctx, x, y - 10, tq, c, 1.1);
        }
        shock(ctx, o.tx, o.ty, seg(p, 0.55, 0.95), c, 90);
      }
    },

    // ===== Thiên Vương – lửa =====
    fireball: {
      dur: 600, own: true,
      spawn(f, o) { emit(14, o.tx, o.ty - 28, { speed: 150, life: 450, size: 5, color: R() < 0.5 ? '#ffd040' : f.color, delay: 360, drag: 2.5 }); },
      draw(ctx, f, p, o) {
        const q = seg(p, 0, 0.6), c = f.color, x0 = o.sx, y0 = o.sy - 32, x1 = o.tx, y1 = o.ty - 28;
        if (q < 1) {
          fly(ctx, 'fireball', x0, y0, x1, y1, q, { color: c, scale: 1.2, frame: FR(70) }, 3, 0.08);
          if (R() < 0.6) emit(1, lerp(x0, x1, q), lerp(y0, y1, q), { speed: 30, vy: -40, life: 380, size: 4, color: '#ffb030' });
        }
        const e = seg(p, 0.6, 1);
        if (e > 0) { fxSprite(ctx, 'flame', e, x1, o.ty + 2, { color: c, scale: 1.1, anchor: 0.9, alpha: 1 - e }); boom(ctx, x1, y1, e, '#ffc040', 1); }
      }
    },
    // Hỏa Diệm Đao Khí: đao lửa lớn bay theo đường chiêu, để lại vệt lửa cháy
    flameblade: {
      dur: 900, own: true,
      spawn(f, o) { for (let i = 1; i <= 6; i++) emit(5, lerp(o.sx, o.tx, i / 6), lerp(o.sy, o.ty, i / 6) - 14, { speed: 40, vy: -90, life: 500, size: 5, color: '#ffb030', delay: i / 6 * 500 }); },
      draw(ctx, f, p, o) {
        const c = f.color, a = AHEAD(o), q = seg(p, 0, 0.6), x0 = o.sx, y0 = o.sy - 30, x1 = o.tx, y1 = o.ty - 30;
        for (let i = 1; i <= 6; i++) {   // lửa cháy dọc đường
          const t = i / 6, lp = seg(p, t * 0.55, t * 0.55 + 0.45);
          if (lp > 0 && lp < 1) fxSprite(ctx, 'flame', lp, lerp(o.sx, o.tx, t), lerp(o.sy, o.ty, t), { color: c, scale: 0.8, anchor: 0.9, alpha: 1 - lp * 0.6 });
        }
        if (q < 1) {
          const x = lerp(x0, x1, q), y = lerp(y0, y1, q);
          fxSprite(ctx, 'qi', 0, x + Math.cos(a) * 26, y + Math.sin(a) * 26, { frame: FR(70), rot: a, flipY: Math.cos(a) < 0, color: '#ffb040', scale: 1.8, alpha: 0.8 });
          fly(ctx, 'blade', x0, y0, x1, y1, q, { color: c, scale: 1.7 }, 2, 0.06);
          glowDot(ctx, x, y, 50, c, 0.5);
        }
        boom(ctx, x1, y1, seg(p, 0.6, 1), '#ffc040', 1.2);
      }
    },
    // Liệt Diễm Phần Thiên: các cột lửa phun lên quanh mục tiêu
    firepillar: {
      dur: 1200, own: true,
      spawn(f, o) {
        const r = f.r || 140;
        f.cols = [{ x: 0, y: 0, t: 0.04, s: 1.5 }].concat(ringPts(5, r * 0.65, true).map((k, i) => ({ x: k.x, y: k.y, t: 0.12 + i * 0.07, s: 1 })));
        for (const k of f.cols) emit(7, o.tx + k.x, o.ty + k.y - 20, { speed: 40, vy: -170, life: 700, size: 5, color: R() < 0.5 ? '#ffd040' : f.color, delay: k.t * 1200, jitter: 14 });
        setFlash(f, '#ff6020', 80, 350);
      },
      draw(ctx, f, p, o) {
        const c = f.color, r = f.r || 140;
        ground(ctx, o.tx, o.ty, r * 1.1, c, 0.5 * (1 - seg(p, 0.7, 1)));
        for (const k of f.cols || []) {
          const q = seg(p, k.t, k.t + 0.6); if (q <= 0 || q >= 1) continue;
          const x = o.tx + k.x, y = o.ty + k.y, h = Math.sin(Math.PI * Math.min(1, q * 1.4)) * (q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3), s = k.s;
          for (let j = 0; j < 4; j++) fxSprite(ctx, 'flame', 0, x + Math.sin(FR(60) + j) * 3, y - j * 40 * s * h, { frame: FR(70) + j + k.t * 10, color: j ? c : '#ffc040', scale: s * (1.8 - j * 0.35) * (0.4 + 0.6 * h), anchor: 0.9, alpha: h * (1 - j * 0.15) });
          glowDot(ctx, x, y - 10, 34 * s, '#ff9030', h * 0.6);
        }
      }
    },
    // Chiến Thần Giáng Thế: tướng giáp khổng lồ hiện sau lưng, vung kích chém quanh
    warspirit: {
      dur: 1350, own: true,
      spawn(f, o) { emit(40, o.sx, o.sy - 10, { speed: (f.r || 140) * 1.5, life: 600, size: 5, color: f.color, flat: 0.5, drag: 2.2, delay: 700 }); setFlash(f, '#ff5020', 700, 350); },
      draw(ctx, f, p, o) {
        const c = f.color, r = f.r || 140, app = seg(p, 0, 0.3), fade = 1 - seg(p, 0.8, 1), slash = seg(p, 0.5, 0.75);
        figure(ctx, 'warlord', o.sx, o.sy - 30 - (1 - ease(app)) * 30, p > 0.5 ? 1 : 0, c, 2.5, app * fade * 0.85);
        if (slash > 0) {
          flat(ctx, o.sx, o.sy - 10, () => fxSprite(ctx, 'slash', slash, 0, 0, { color: '#ffb040', scale: r / 26, rot: -Math.PI / 2 }));
          fxSprite(ctx, 'slash', slash, o.sx, o.sy - 60, { color: c, scale: r / 34, rot: -0.4, alpha: 1 - slash });
        }
        for (const k of ringPts(8, r * 0.8)) {
          const q = seg(p, 0.55, 1);
          if (q > 0 && q < 1) fxSprite(ctx, 'flame', q, o.sx + k.x, o.sy + k.y, { color: c, scale: 0.9, anchor: 0.9, alpha: 1 - q });
        }
        shock(ctx, o.sx, o.sy, seg(p, 0.52, 1), c, r);
      }
    },
    // Hỏa Phượng Liêu Nguyên: phượng hoàng lửa vỗ cánh bay theo đường chiêu
    firephoenix: {
      dur: 1700, own: true,
      spawn(f, o) {
        for (let i = 1; i <= 8; i++) emit(6, lerp(o.sx, o.tx, i / 8), lerp(o.sy, o.ty, i / 8) - 20, { speed: 50, vy: -110, life: 800, size: 6, color: i % 2 ? '#ffd040' : f.color, delay: (0.18 + i / 8 * 0.5) * 1700, jitter: 20 });
        emit(50, o.tx, o.ty - 20, { speed: 220, life: 700, size: 6, color: '#ffb030', flat: 0.5, drag: 2.2, delay: 0.72 * 1700 });
        setFlash(f, '#ff8020', 1200, 450);
      },
      draw(ctx, f, p, o) {
        const c = f.color, a = AHEAD(o), rise = seg(p, 0, 0.18), q = seg(p, 0.18, 0.72), fade = 1 - seg(p, 0.85, 1);
        const x0 = o.sx, y0 = o.sy - 60, x1 = o.tx, y1 = o.ty - 50;
        for (let i = 1; i <= 7; i++) {   // lửa cháy lại trên đường bay
          const t = i / 7, lp = seg(p, 0.18 + t * 0.54, 0.6 + t * 0.4);
          if (lp > 0 && lp < 1) fxSprite(ctx, 'flame', lp, lerp(o.sx, o.tx, t), lerp(o.sy, o.ty, t) + (i % 2 ? 10 : -10), { color: c, scale: 1.1, anchor: 0.9, alpha: 1 - lp * 0.5 });
        }
        if (p < 0.78) {
          const x = q > 0 ? lerp(x0, x1, ease(q)) : x0, y = q > 0 ? lerp(y0, y1, ease(q)) + Math.sin(q * 9) * 10 : o.sy - 20 - 40 * ease(rise);
          const s = 2.4 + rise * 0.8, al = Math.min(rise * 2, 1) * (1 - seg(p, 0.72, 0.78));
          glowDot(ctx, x, y, 110, '#ff8020', al * 0.6, true);
          for (let k = 2; k >= 1; k--) { const t = Math.max(0, q - k * 0.06); rspr(ctx, 'phoenix', lerp(x0, x1, ease(t)), lerp(y0, y1, ease(t)), a, { color: '#ffb040', scale: s, frame: FR(90) + k, alpha: al * 0.3 / k }); }
          rspr(ctx, 'phoenix', x, y, a, { color: c, scale: s, frame: FR(90), alpha: al });
          if (R() < 0.7) emit(2, x - Math.cos(a) * 60, y - Math.sin(a) * 60, { angle: a + Math.PI, spread: 0.9, speed: 90, life: 500, size: 5, color: R() < 0.5 ? '#ffd040' : c });
        }
        const e = seg(p, 0.72, 1);
        if (e > 0) {
          boom(ctx, x1, y1 + 20, e, '#ffc040', 2);
          shock(ctx, o.tx, o.ty, e, c, 120);
          for (const k of ringPts(6, 70)) fxSprite(ctx, 'flame', e, o.tx + k.x, o.ty + k.y, { color: c, scale: 1.2, anchor: 0.9, alpha: fade });
        }
      }
    },

    // ===== Đường Môn – cơ quan hỏa khí =====
    bomb: {
      dur: 650, own: true,
      spawn(f, o) {
        emit(16, o.tx, o.ty - 20, { speed: 170, life: 450, size: 5, color: R() < 0.5 ? '#ffd040' : f.color, delay: 390, drag: 2.5 });
        emit(8, o.tx, o.ty - 20, { speed: 30, vy: -50, life: 800, size: 7, color: '#806050', delay: 400, jitter: 14 });
      },
      draw(ctx, f, p, o) {
        const q = seg(p, 0, 0.6), c = f.color;
        if (q < 1) { const [x, y] = hop(o.sx, o.sy - 34, o.tx, o.ty - 24, q, 60); spr(ctx, 'bomb', x, y, { frame: FR(60), rot: q * 8, color: c, scale: 1 }); }
        const e = seg(p, 0.6, 1);
        if (e > 0) { boom(ctx, o.tx, o.ty - 22, e, '#ffc040', 1.3); fxSprite(ctx, 'flame', e, o.tx, o.ty, { color: c, scale: 0.9, anchor: 0.9, alpha: 1 - e }); }
      }
    },
    // Loạn Hoàn Kích: ném cả chùm hỏa lôi đạn nổ khắp vùng
    bombs: {
      dur: 1100, own: true,
      spawn(f, o) {
        f.pts = [{ x: 0, y: 0 }].concat(ringPts(5, (f.r || 110) * 0.7, true)).map((k, i) => Object.assign(k, { t: i * 0.06 }));
        for (const k of f.pts) emit(8, o.tx + k.x, o.ty + k.y - 18, { speed: 150, life: 450, size: 5, color: R() < 0.5 ? '#ffd040' : f.color, delay: (k.t + 0.45) * 1100, drag: 2.5 });
      },
      draw(ctx, f, p, o) {
        const c = f.color;
        for (const k of f.pts || []) {
          const q = seg(p, k.t, k.t + 0.45), gx = o.tx + k.x, gy = o.ty + k.y;
          if (q < 1 && q > 0) { const [x, y] = hop(o.sx, o.sy - 34, gx, gy - 16, q, 90); spr(ctx, 'bomb', x, y, { frame: FR(60), rot: q * 10, color: c, scale: 0.8 }); }
          const e = seg(p, k.t + 0.45, k.t + 0.75);
          boom(ctx, gx, gy - 18, e, '#ffc040', 1.1);
          if (e > 0 && e < 1) fxSprite(ctx, 'flame', e, gx, gy + 2, { color: c, scale: 0.8, anchor: 0.9, alpha: 1 - e });
        }
      }
    },
    // Địa Diệm Hỏa: địa lôi cắm xuống, nháy đèn rồi phun lửa
    mine: {
      dur: 1400, own: true,
      spawn(f, o) {
        f.pts = ringPts(4, (f.r || 130) * 0.6, true).concat([{ x: 0, y: 0 }]).map((k, i) => Object.assign(k, { t: i * 0.05 }));
        for (const k of f.pts) emit(10, o.tx + k.x, o.ty + k.y - 12, { speed: 40, vy: -180, life: 650, size: 5, color: R() < 0.5 ? '#ffd040' : f.color, delay: (0.4 + k.t) * 1400, jitter: 10 });
        setFlash(f, '#ff6020', 560, 300);
      },
      draw(ctx, f, p, o) {
        const c = f.color;
        ground(ctx, o.tx, o.ty, (f.r || 130), c, 0.35 * seg(p, 0.35, 0.5) * (1 - seg(p, 0.8, 1)));
        for (const k of f.pts || []) {
          const gx = o.tx + k.x, gy = o.ty + k.y, d = seg(p, k.t * 0.5, k.t * 0.5 + 0.15), e = seg(p, 0.4 + k.t, 0.95);
          if (e <= 0) spr(ctx, 'mine', gx, gy - 4 - (1 - d) * 80, { frame: FR(110), color: c, scale: 0.75, alpha: d });
          else if (e < 1) {
            for (let j = 0; j < 2; j++) fxSprite(ctx, 'flame', e, gx, gy - j * 30 * (1 - e), { frame: FR(70) + j, color: j ? c : '#ffc040', scale: 1.2 - j * 0.3, anchor: 0.9, alpha: 1 - e * 0.7 });
            boom(ctx, gx, gy - 10, e * 2, '#ffc040', 1);
          }
        }
      }
    },
    // Băng Tâm Tiên Lôi: lôi băng ném tới, nổ thành gai băng đóng băng mục tiêu
    icemine: {
      dur: 1000, own: true,
      spawn(f, o) { emit(30, o.tx, o.ty - 20, { speed: 170, life: 700, size: 4, color: R() < 0.5 ? '#ffffff' : f.color, delay: 520, drag: 2.2 }); setFlash(f, '#c8f4ff', 520, 300); },
      draw(ctx, f, p, o) {
        const c = f.color, q = seg(p, 0, 0.4);
        if (q < 1) { const [x, y] = hop(o.sx, o.sy - 34, o.tx, o.ty - 6, q, 70); spr(ctx, 'mine', x, y, { frame: FR(80), rot: q * 6, color: c, scale: 0.75 }); }
        else if (p < 0.52) spr(ctx, 'mine', o.tx, o.ty - 4, { frame: FR(50), color: c, scale: 0.75 });
        const e = seg(p, 0.52, 1), fade = 1 - seg(p, 0.85, 1);
        if (e > 0) {
          for (const k of ringPts(5, 26)) spr(ctx, 'icespike', o.tx + k.x, o.ty + k.y + 4, { color: c, scale: 0.8 * ease(seg(e, 0, 0.3)), anchor: 1, alpha: fade, rot: k.x * 0.006 });
          spr(ctx, 'icespike', o.tx, o.ty + 6, { color: '#e8fbff', scale: 1.2 * ease(seg(e, 0, 0.3)), anchor: 1, alpha: fade });
          boom(ctx, o.tx, o.ty - 26, e, '#ffffff', 1.1);
        }
      }
    },
    // Cửu Cung Phi Tinh: chín phi tinh cơ quan xếp cửu cung trên trời, lần lượt rơi nổ
    starfall: {
      dur: 1800, own: true,
      spawn(f, o) {
        const r = (f.r || 200) * 0.55;
        f.st = Array.from({ length: 9 }, (_, i) => ({ gx: ((i % 3) - 1) * r, gy: (Math.floor(i / 3) - 1) * r * 0.45, t: 0.3 + [4, 0, 2, 6, 8, 1, 5, 3, 7][i] * 0.05 }));
        for (const s of f.st) emit(10, o.tx + s.gx, o.ty + s.gy - 14, { speed: 170, life: 500, size: 5, color: R() < 0.5 ? '#ffffff' : f.color, delay: (s.t + 0.14) * 1800, drag: 2.5 });
        setFlash(f, '#fff0a0', 0.44 * 1800, 400);
      },
      draw(ctx, f, p, o) {
        const c = f.color, r = f.r || 200, fade = 1 - seg(p, 0.85, 1);
        runeCircle(ctx, o.tx, o.ty, r, c, seg(p, 0, 0.2) * fade * 0.7, p * 1.5, 9);
        for (const s of f.st || []) {
          const gx = o.tx + s.gx, gy = o.ty + s.gy, sky = gy - 200 + s.gy * 0.4;
          const app = seg(p, 0, 0.25), q = seg(p, s.t, s.t + 0.14);
          if (q < 1) {
            const x = gx - 60 * (1 - q), y = q > 0 ? lerp(sky, gy - 14, q * q) : sky;
            if (q > 0) glowPath(ctx, () => { ctx.moveTo(x - 30, y - 90); ctx.lineTo(x, y); }, c, 2, 0.5);
            spr(ctx, 'flystar', x, y, { frame: FR(50), rot: p * 8, color: c, scale: 0.75 + app * 0.2, alpha: app });
          }
          const e = seg(p, s.t + 0.14, s.t + 0.45);
          boom(ctx, gx, gy - 14, e, '#fff0a0', 1.3);
          shock(ctx, gx, gy, e, c, 46);
        }
      }
    },

    // ===== Ngũ Độc – huyết đao =====
    bladehit: {
      dur: 420, own: true,
      spawn(f, o) { emit(10, o.tx, o.ty - 28, { speed: 150, life: 350, size: 4, color: f.color, delay: 150, drag: 3 }); },
      draw(ctx, f, p, o) {
        const a = AHEAD(o), len = Math.max(64, Math.min(96, Math.hypot(o.tx - o.sx, o.ty - o.sy))), q = seg(p, 0, 0.4);
        swing(ctx, 'blade', o.sx, o.sy - 36, a - 1.5, a + 0.6, q, len, f.color, 1 - seg(p, 0.6, 1));
        fxSprite(ctx, 'slash', seg(p, 0.2, 0.9), o.tx, o.ty - 28, { rot: a, color: f.color, alpha: 1 - seg(p, 0.5, 1) });
        boom(ctx, o.tx, o.ty - 28, seg(p, 0.35, 1), f.color, 0.7);
      }
    },
    // U Minh Độc Đao: song đao chém chéo chữ thập, độc khí đầu lâu bốc lên
    bladecross: {
      dur: 750, own: true,
      spawn(f, o) { emit(16, o.tx, o.ty - 28, { speed: 30, vy: -60, life: 800, size: 5, color: R() < 0.5 ? '#8fe03a' : f.color, jitter: 18, delay: 300 }); },
      draw(ctx, f, p, o) {
        const c = f.color, ex = o.tx, ey = o.ty - 30, a = AHEAD(o);
        for (const [sd, t0] of [[1, 0], [-1, 0.14]]) {
          const q = seg(p, t0, t0 + 0.3), b = a + sd * 0.8;
          if (q > 0 && q < 1) swing(ctx, 'blade', ex - Math.cos(b) * 56, ey - Math.sin(b) * 56 - sd * 30, b - sd * 1.2, b + sd * 0.9, q, 84, c, 1 - seg(q, 0.7, 1));
          fxSprite(ctx, 'slash', seg(p, t0 + 0.1, t0 + 0.55), ex, ey, { rot: a + sd * Math.PI / 4 + Math.PI / 2, color: c, scale: 1.3 });
        }
        boom(ctx, ex, ey, seg(p, 0.3, 0.7), c, 0.9);
        const s = seg(p, 0.35, 1);
        if (s > 0) spr(ctx, 'skullhead', ex, ey - 20 - s * 40, { color: '#8fe03a', scale: 0.6 + s * 0.3, alpha: (1 - s) * 0.85 });
      }
    },
    // Bách Độc Toàn Phong: đao xoáy quanh thân cuốn theo độc vụ
    poisonwhirl: {
      dur: 1100, own: true,
      spawn(f, o) { emit(40, o.sx, o.sy - 20, { speed: 30, vy: -40, life: 1000, size: 6, color: R() < 0.4 ? '#c050ff' : f.color, jitter: (f.r || 130) * 0.7, jitterY: (f.r || 130) * 0.3, delayRand: 500 }); },
      draw(ctx, f, p, o) {
        const c = f.color, r = (f.r || 130) * (0.35 + ease(p) * 0.65), fade = 1 - seg(p, 0.75, 1);
        ground(ctx, o.sx, o.sy, r * 1.2, c, 0.5 * fade);
        for (let i = 0; i < 6; i++) {
          const th = i / 6 * TAU + p * 12, x = o.sx + Math.cos(th) * r * 0.8, y = o.sy - 24 + Math.sin(th) * r * 0.36;
          fxSprite(ctx, 'skull', (p + i * 0.13) % 1, o.sx + Math.cos(th + 0.5) * r * 0.6, o.sy - 30 + Math.sin(th + 0.5) * r * 0.27, { color: i % 2 ? c : '#b050ff', scale: 0.9, alpha: fade * 0.7 });
          rspr(ctx, 'blade', x, y, th + Math.PI / 2, { color: '#e8a0ff', scale: 0.9, alpha: fade });
          rspr(ctx, 'blade', o.sx + Math.cos(th - 0.25) * r * 0.8, o.sy - 24 + Math.sin(th - 0.25) * r * 0.36, th - 0.25 + Math.PI / 2, { color: c, scale: 0.9, alpha: fade * 0.3 });
        }
      }
    },
    // Quỷ Ảnh Truy Hồn: chuỗi quỷ ảnh lao tới, chém chữ thập tại đích
    shadowdash: {
      dur: 800, own: true,
      spawn(f, o) { emit(20, o.tx, o.ty - 28, { speed: 160, life: 450, size: 4, color: f.color, delay: 300, drag: 3 }); },
      draw(ctx, f, p, o) {
        const c = f.color, a = AHEAD(o), n = 5;
        for (let i = 0; i < n; i++) {
          const t = (i + 1) / (n + 1), lp = seg(p, t * 0.35, t * 0.35 + 0.4);
          if (lp <= 0 || lp >= 1) continue;
          rspr(ctx, 'lunge', lerp(o.sx, o.tx, t), lerp(o.sy, o.ty, t) - 30, Math.cos(a) < 0 ? Math.PI : 0, { color: i % 2 ? c : '#5a2a80', scale: 1.1, alpha: (1 - lp) * 0.8 });
        }
        const e = seg(p, 0.35, 0.9);
        if (e > 0 && e < 1) for (const sd of [1, -1]) fxSprite(ctx, 'slash', e, o.tx, o.ty - 30, { rot: a + sd * 0.8, color: c, scale: 1.4 });
        boom(ctx, o.tx, o.ty - 30, seg(p, 0.4, 0.9), c, 1);
        const s = seg(p, 0.45, 1);
        if (s > 0) spr(ctx, 'skullhead', o.tx, o.ty - 60 - s * 30, { color: c, scale: 0.7, alpha: (1 - s) * 0.7 });
      }
    },
    // Vạn Cổ Ma Đao: ma đao khổng lồ chém từ trời xuống, đầu lâu tung ra bốn phía
    demonblade: {
      dur: 1700, own: true,
      spawn(f, o) {
        emit(60, o.sx, o.sy - 10, { speed: (f.r || 170) * 1.6, life: 700, size: 6, color: R() < 0.5 ? '#c040ff' : f.color, flat: 0.5, drag: 2, delay: 0.4 * 1700 });
        emit(30, o.sx, o.sy - 20, { speed: 20, vy: -60, life: 1200, size: 7, color: '#40104a', jitter: 80, jitterY: 30, delay: 0.4 * 1700, delayRand: 400 });
        setFlash(f, '#a020ff', 0.4 * 1700, 450);
      },
      draw(ctx, f, p, o) {
        const c = f.color, r = f.r || 170, d = seg(p, 0.1, 0.4), fade = 1 - seg(p, 0.82, 1), s = 4.2;
        ground(ctx, o.sx, o.sy, r * 1.2, '#6010a0', 0.6 * seg(p, 0, 0.3) * fade);
        runeCircle(ctx, o.sx, o.sy, r, c, seg(p, 0, 0.3) * fade * 0.7, -p * 2, 6);
        // đao dựng mũi xuống, rơi từ trời và cắm vào đất
        const by = o.sy + 10 - 32 * s * 0.9 - (1 - d * d) * 260, rot = Math.PI / 2 + (1 - d) * 0.5;
        glowDot(ctx, o.sx, by, 120, c, seg(p, 0, 0.2) * fade * 0.5, true);
        spr(ctx, 'blade', o.sx + (1 - d) * 40, by, { rot, color: c, scale: s, alpha: seg(p, 0, 0.12) * fade });
        crack(ctx, o.sx, o.sy, seg(p, 0.4, 0.7), c, r / 40, fade);
        shock(ctx, o.sx, o.sy, seg(p, 0.4, 0.85), c, r);
        boom(ctx, o.sx, o.sy - 10, seg(p, 0.4, 0.7), c, 1.8);
        const e = seg(p, 0.42, 1);
        if (e > 0) for (let i = 0; i < 7; i++) {
          const th = i / 7 * TAU + e * 2.5, rr = r * ease(e) * 0.95;
          spr(ctx, 'skullhead', o.sx + Math.cos(th) * rr, o.sy - 30 + Math.sin(th) * rr * 0.45 - Math.sin(e * Math.PI) * 40, { color: i % 2 ? c : '#ff60c0', scale: 0.9, alpha: (1 - e) });
        }
      }
    },

    // ===== Nga My / Võ Đang – kiếm =====
    swordhit: {
      dur: 400, own: true,
      spawn(f, o) { emit(8, o.tx, o.ty - 28, { speed: 140, life: 320, size: 3.5, color: f.color, delay: 150, drag: 3 }); },
      draw(ctx, f, p, o) {
        const a = AHEAD(o), len = Math.max(60, Math.min(90, Math.hypot(o.tx - o.sx, o.ty - o.sy))), q = seg(p, 0, 0.4);
        swing(ctx, 'sword', o.sx, o.sy - 36, a + 1.3, a - 0.5, q, len, f.color, 1 - seg(p, 0.6, 1));
        fxSprite(ctx, 'slash', seg(p, 0.15, 0.9), o.tx, o.ty - 28, { rot: a + Math.PI, flipY: true, color: f.color, alpha: 1 - seg(p, 0.5, 1) });
        boom(ctx, o.tx, o.ty - 28, seg(p, 0.35, 1), f.color, 0.6);
      }
    },
    // Tam Hoa Tụ Đỉnh: ba nhát kiếm đâm, ba đóa hoa nở trên đỉnh đầu mục tiêu
    flowerthrust: {
      dur: 800, own: true,
      spawn(f, o) { emit(8, o.tx, o.ty - 40, { speed: 90, vy: -30, life: 800, size: 3.5, color: '#ffc0e0', jitter: 20, delay: 300, drag: 1.5 }); },
      draw(ctx, f, p, o) {
        const c = f.color, a = AHEAD(o), ex = o.tx, ey = o.ty - 30;
        for (let i = 0; i < 3; i++) {
          const q = seg(p, i * 0.13, i * 0.13 + 0.25), aa = a + (i - 1) * 0.35;
          if (q > 0 && q < 1) {
            const reach = Math.sin(Math.PI * q);
            rspr(ctx, 'sword', ex - Math.cos(aa) * (60 - reach * 30), ey - Math.sin(aa) * (60 - reach * 30), aa, { color: c, alpha: 1 });
          }
          const b = seg(p, i * 0.13 + 0.15, i * 0.13 + 0.85);
          if (b > 0 && b < 1) fxSprite(ctx, 'lotus', b * 1.2, ex + (i - 1) * 24, ey - 46 + Math.abs(i - 1) * 8 - b * 10, { color: c, scale: 0.9, alpha: 1 - seg(b, 0.6, 1) });
        }
        boom(ctx, ex, ey, seg(p, 0.1, 0.6), c, 0.8);
      }
    },
    // Kiếm Vũ: vòng phi kiếm xoay quanh thân, lan rộng
    swordwhirl: {
      dur: 1000, own: true,
      spawn(f, o) { emit(24, o.sx, o.sy - 24, { speed: (f.r || 130) * 1.4, life: 500, size: 4, color: f.color, flat: 0.5, drag: 2.5, delay: 200 }); },
      draw(ctx, f, p, o) {
        const c = f.color, r = (f.r || 130) * (0.3 + ease(seg(p, 0, 0.6)) * 0.7), fade = 1 - seg(p, 0.75, 1);
        const cls = o.src && (o.src.cls || (o.src === window.G.self && window.G.me ? window.G.me.cls : null));
        if (cls === 'vodang') fxSprite(ctx, 'taiji', 0, o.sx, o.sy, { frame: FR(90), color: c, scale: r / 30, flat: 0.45, alpha: 0.28 * fade });
        for (let i = 0; i < 8; i++) {
          const th = i / 8 * TAU + p * 9, x = o.sx + Math.cos(th) * r, y = o.sy - 26 + Math.sin(th) * r * 0.45;
          const tang = Math.atan2(Math.cos(th) * 0.45, -Math.sin(th));
          rspr(ctx, 'sword', o.sx + Math.cos(th - 0.2) * r, o.sy - 26 + Math.sin(th - 0.2) * r * 0.45, tang - 0.1, { color: c, frame: i, scale: 0.85, alpha: fade * 0.3 });
          rspr(ctx, 'sword', x, y, tang, { color: c, frame: i, scale: 0.85, alpha: fade });
          if (cls === 'ngamy') fxSprite(ctx, 'petal', 0, x - Math.cos(th) * 20, y + 10, { frame: FR(120) + i, rot: th * 2, color: '#ffc0e0', scale: 0.7, alpha: fade });
        }
      }
    },
    // Phi Hoa Truy Ảnh: cánh hoa cuốn theo bóng kiếm lướt tới
    petaldash: {
      dur: 850, own: true,
      spawn(f, o) { emit(12, o.tx, o.ty - 30, { speed: 130, life: 800, size: 3.5, color: R() < 0.5 ? '#ffd0e8' : f.color, drag: 1.5, delay: 300 }); },
      draw(ctx, f, p, o) {
        const c = f.color, a = AHEAD(o), fade = 1 - seg(p, 0.75, 1);
        for (let i = 0; i < 14; i++) {
          const t = i / 14, lp = seg(p, t * 0.35, t * 0.35 + 0.55);
          if (lp <= 0 || lp >= 1) continue;
          const sw = Math.sin(t * 9 + p * 6) * 22;
          fxSprite(ctx, 'petal', 0, lerp(o.sx, o.tx, t) - Math.sin(a) * sw, lerp(o.sy, o.ty, t) - 30 + Math.cos(a) * sw * 0.5 + lp * 20, { frame: FR(100) + i, rot: lp * 6 + i, color: i % 3 ? c : '#ffffff', scale: 0.8, alpha: 1 - lp });
        }
        for (let i = 1; i <= 3; i++) { const t = i / 4, lp = seg(p, t * 0.3, t * 0.3 + 0.35); if (lp > 0 && lp < 1) rspr(ctx, 'lunge', lerp(o.sx, o.tx, t), lerp(o.sy, o.ty, t) - 30, Math.cos(a) < 0 ? Math.PI : 0, { color: c, scale: 1.1, alpha: (1 - lp) * 0.6 }); }
        const e = seg(p, 0.35, 1);
        if (e > 0) fxSprite(ctx, 'lotus', e * 1.2, o.tx, o.ty - 4, { color: c, scale: 1.3, flat: 0.6, alpha: fade });
        boom(ctx, o.tx, o.ty - 30, seg(p, 0.35, 0.8), c, 0.9);
      }
    },
    // Vạn Hoa Kiếm Trận: vòng kiếm hoa xoay trên không rồi cắm xuống, sen lớn nở
    flowerswords: {
      dur: 1800, own: true,
      spawn(f, o) {
        const r = f.r || 190;
        f.sw = Array.from({ length: 12 }, (_, i) => { const a = i / 12 * TAU, d = r * (0.35 + (i % 3) * 0.22); return { a, gx: Math.cos(a) * d, gy: Math.sin(a) * d * 0.45, t: 0.42 + i * 0.025 }; });
        emit(26, o.tx, o.ty - 120, { speed: 30, vy: 40, life: 1500, size: 4, color: '#ffc8e4', jitter: r, jitterY: 50, delayRand: 900 });
        setFlash(f, '#ffc0e0', 0.6 * 1800, 400);
      },
      draw(ctx, f, p, o) {
        const c = f.color, r = f.r || 190, fade = 1 - seg(p, 0.85, 1), app = seg(p, 0, 0.25), spin = p * 6;
        ground(ctx, o.tx, o.ty, r, c, 0.45 * fade * app);
        for (const s of f.sw || []) {
          const th = s.a + spin, ox = o.tx + Math.cos(th) * r * 0.7 * app, oy = o.ty - 170 + Math.sin(th) * r * 0.3 * app;
          const q = seg(p, s.t, s.t + 0.14), gx = o.tx + s.gx, gy = o.ty + s.gy;
          if (q <= 0) {
            fxSprite(ctx, 'petal', 0, ox + Math.cos(th + 0.6) * 24, oy + 8, { frame: FR(110), rot: th * 3, color: '#ffd0e8', scale: 0.8, alpha: app });
            spr(ctx, 'sword', ox, oy, { rot: Math.PI / 2 - Math.cos(th) * 0.4, color: c, frame: 1, scale: 0.9, alpha: app });
          } else if (q < 1) fly(ctx, 'sword', ox, oy, gx, gy - 24, q * q, { color: c, frame: 1, scale: 1 }, 2, 0.1);
          else {
            const e = seg(p, s.t + 0.14, s.t + 0.5);
            spr(ctx, 'sword', gx, gy - 22, { rot: Math.PI / 2, color: c, frame: 1, alpha: fade });
            if (e > 0 && e < 1) fxSprite(ctx, 'lotus', e * 1.3, gx, gy - 4, { color: c, scale: 0.7, alpha: 1 - e * 0.5 });
          }
        }
        const b = seg(p, 0.65, 1);
        if (b > 0) fxSprite(ctx, 'lotus', b * 1.2, o.tx, o.ty, { color: c, scale: r / 30, flat: 0.5, alpha: fade });
      }
    },

    // ===== Thúy Yên – băng =====
    icebolt: {
      dur: 520, own: true,
      spawn(f, o) { emit(12, o.tx, o.ty - 28, { speed: 140, life: 450, size: 3.5, color: R() < 0.5 ? '#ffffff' : f.color, delay: 300, drag: 3 }); },
      draw(ctx, f, p, o) {
        const c = f.color, q = seg(p, 0, 0.58), x0 = o.sx, y0 = o.sy - 32, x1 = o.tx, y1 = o.ty - 28;
        if (q < 1) {
          for (const off of [-0.1, 0, 0.1]) {
            const a = Math.atan2(y1 - y0, x1 - x0) + off * (1 - q), L = Math.hypot(x1 - x0, y1 - y0) * q;
            rspr(ctx, 'dart', x0 + Math.cos(a) * L, y0 + Math.sin(a) * L, a, { color: off ? c : '#ffffff', scale: off ? 0.8 : 1 });
          }
          spr(ctx, 'snow', lerp(x0, x1, q - 0.08), lerp(y0, y1, q - 0.08), { frame: FR(70), color: c, scale: 0.4, alpha: 0.7 });
        }
        const e = seg(p, 0.58, 1);
        if (e > 0) { fxSprite(ctx, 'ice', e * 1.3, x1, o.ty - 6, { color: c, scale: 0.8, alpha: 1 - seg(e, 0.6, 1) }); boom(ctx, x1, y1, e, '#ffffff', 0.7); }
      }
    },
    // Hàn Băng Kiếm Khí: ba luồng kiếm khí băng, gai băng trồi theo vệt
    iceblades: {
      dur: 900, own: true,
      spawn(f, o) { for (let i = 1; i <= 6; i++) emit(4, lerp(o.sx, o.tx, i / 6), lerp(o.sy, o.ty, i / 6) - 10, { speed: 60, life: 500, size: 3.5, color: '#ffffff', delay: i / 6 * 450 }); },
      draw(ctx, f, p, o) {
        const c = f.color, a = AHEAD(o), x0 = o.sx, y0 = o.sy - 30, x1 = o.tx, y1 = o.ty - 30;
        for (let i = 1; i <= 7; i++) {
          const t = i / 7, lp = seg(p, t * 0.5, t * 0.5 + 0.4);
          if (lp > 0 && lp < 1) spr(ctx, 'icespike', lerp(o.sx, o.tx, t) + (i % 2 ? 8 : -8), lerp(o.sy, o.ty, t) + 4, { color: c, scale: 0.55 * ease(seg(lp, 0, 0.25)), anchor: 1, alpha: 1 - seg(lp, 0.6, 1) });
        }
        for (let k = 0; k < 3; k++) {
          const q = seg(p, k * 0.08, k * 0.08 + 0.55);
          if (q > 0 && q < 1) fxSprite(ctx, 'qi', 0, lerp(x0, x1, q), lerp(y0, y1, q) + (k - 1) * 12, { frame: FR(70) + k, rot: a, flipY: Math.cos(a) < 0, color: k === 1 ? '#ffffff' : c, scale: 1.3 });
        }
        spr(ctx, 'snow', x1, y1, { frame: FR(80), color: c, scale: 0.9, alpha: seg(p, 0.55, 0.7) * (1 - seg(p, 0.8, 1)) });
      }
    },
    // Tuyết Ảnh Phiêu Linh: bão bông tuyết xoáy rơi trong vùng
    blizzard: {
      dur: 1300, own: true,
      spawn(f, o) { const r = f.r || 140; emit(50, o.tx, o.ty - 120, { speed: 30, vy: 90, life: 1100, size: 4, color: '#ffffff', jitter: r, jitterY: 40, delayRand: 700 }); },
      draw(ctx, f, p, o) {
        const c = f.color, r = f.r || 140, fade = 1 - seg(p, 0.8, 1), app = seg(p, 0, 0.2);
        ground(ctx, o.tx, o.ty, r * 1.1, c, 0.5 * fade * app);
        fxSprite(ctx, 'snow', 0, o.tx, o.ty - 150, { frame: FR(90), rot: p * 3, color: c, scale: 1.8, alpha: app * fade });
        for (let i = 0; i < 14; i++) {
          const ph = (p * 1.6 + seeded(i)) % 1, th = seeded(i + 7) * TAU + p * 4, d = r * (0.2 + seeded(i + 3) * 0.8);
          const x = o.tx + Math.cos(th) * d, y = o.ty + Math.sin(th) * d * 0.45 - 140 * (1 - ph);
          spr(ctx, 'snow', x, y, { frame: i, rot: ph * 6 + i, color: i % 3 ? c : '#ffffff', scale: 0.35 + seeded(i + 11) * 0.3, alpha: fade * app * Math.min(1, (1 - ph) * 4) });
        }
        for (let k = 0; k < 2; k++) {
          const th = p * 8 + k * Math.PI;
          glowPath(ctx, () => ctx.ellipse(o.tx, o.ty - 30 - k * 30, r * 0.8, r * 0.25, 0, th, th + 1.8), '#ffffff', 2, fade * 0.5);
        }
      }
    },
    // Băng Liên Phong Ấn: sen băng nở dưới chân, cột băng bọc lấy mục tiêu
    icelotus: {
      dur: 1150, own: true,
      spawn(f, o) { emit(30, o.tx, o.ty - 30, { speed: 120, life: 800, size: 4, color: R() < 0.5 ? '#ffffff' : f.color, drag: 2, delay: 400 }); setFlash(f, '#c8f4ff', 300, 300); },
      draw(ctx, f, p, o) {
        const c = f.color, fade = 1 - seg(p, 0.8, 1), b = seg(p, 0, 0.4), e = seg(p, 0.3, 0.55);
        fxSprite(ctx, 'lotus', b * 1.2, o.tx, o.ty, { color: c, scale: 2, flat: 0.55, alpha: fade });
        if (e > 0) {
          for (const k of ringPts(6, 30)) spr(ctx, 'icespike', o.tx + k.x, o.ty + k.y + 4, { color: c, scale: 0.9 * ease(e), anchor: 1, rot: k.x * 0.008, alpha: fade * 0.9 });
          spr(ctx, 'snow', o.tx, o.ty - 100, { frame: FR(90), color: '#ffffff', scale: 0.8, alpha: fade * e });
        }
        boom(ctx, o.tx, o.ty - 30, seg(p, 0.3, 0.7), '#ffffff', 1);
      }
    },
    // Thiên Sơn Tuyết Lở: gai băng khổng lồ trồi lên khắp vùng thành từng đợt
    iceshards: {
      dur: 1800, own: true,
      spawn(f, o) {
        const r = f.r || 210;
        f.sp = Array.from({ length: 18 }, (_, i) => { const a = i * 2.39996, d = r * Math.sqrt((i + 0.5) / 18); return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.45, s: 1.3 + R() * 0.9 - d / r * 0.5, t: 0.12 + d / r * 0.3 }; }).sort((A, B) => A.y - B.y);
        for (const s of f.sp) emit(4, o.tx + s.x, o.ty + s.y - 20, { speed: 120, life: 600, size: 4, color: '#ffffff', delay: s.t * 1800, drag: 2 });
        emit(26, o.tx, o.ty - 150, { speed: 30, vy: 60, life: 1500, size: 4, color: '#e8fbff', jitter: r, jitterY: 60, delayRand: 900 });
        setFlash(f, '#c8f4ff', 200, 600);
      },
      draw(ctx, f, p, o) {
        const c = f.color, r = f.r || 210, fade = 1 - seg(p, 0.82, 1);
        ground(ctx, o.tx, o.ty, r * 1.15, c, 0.55 * fade);
        for (const s of f.sp || []) {
          const q = seg(p, s.t, s.t + 0.1); if (q <= 0) continue;
          const x = o.tx + s.x, y = o.ty + s.y;
          spr(ctx, 'icespike', x, y + 6, { color: s.s > 1.8 ? '#ffffff' : c, scale: s.s * ease(q), anchor: 1, alpha: fade });
          boom(ctx, x, y - 6, seg(p, s.t, s.t + 0.25), '#ffffff', 0.6);
        }
        shock(ctx, o.tx, o.ty, seg(p, 0.1, 0.5), '#ffffff', r);
      }
    },

    // ===== Cái Bang – túy quyền, đả cẩu bổng =====
    drunkdash: {
      dur: 950, own: true,
      spawn(f, o) { emit(24, o.tx, o.ty - 30, { speed: 140, vy: -60, grav: 400, life: 600, size: 4, color: '#ffe8a0', delay: 420 }); },
      draw(ctx, f, p, o) {
        const c = f.color, a = AHEAD(o), q = seg(p, 0, 0.45);
        for (let i = 0; i < 4; i++) {   // thân lộn vòng (túy bát tiên)
          const t = (i + 1) / 5, lp = seg(p, t * 0.4, t * 0.4 + 0.3);
          if (lp > 0 && lp < 1) spr(ctx, 'lunge', lerp(o.sx, o.tx, t), lerp(o.sy, o.ty, t) - 30 - Math.sin(t * Math.PI) * 20, { rot: t * TAU * 1.5 * Math.sign(Math.cos(a) || 1), color: c, scale: 1.15, alpha: (1 - lp) * 0.85 });
        }
        if (q < 1) { const [x, y] = hop(o.sx, o.sy - 40, o.tx, o.ty - 40, q, 80); spr(ctx, 'gourd', x, y, { rot: q * 12, color: c, scale: 1.05 }); }
        const e = seg(p, 0.45, 1);
        if (e > 0) {
          swing(ctx, 'staff', o.tx - Math.cos(a) * 40, o.ty - 70, -Math.PI / 2 - 0.6, 0.4, seg(e, 0, 0.4), 80, c, 1 - e);
          boom(ctx, o.tx, o.ty - 30, e, c, 1);
          spr(ctx, 'gourd', o.tx + Math.cos(a) * 20 * e, o.ty - 40 - e * 40, { rot: 1.5 + e * 6, color: c, scale: 0.7, alpha: 1 - e });
        }
      }
    },
    // Đả Cẩu Thần Bổng: tám bổng ảnh xoay như chong chóng rồi nện tỏa ra bốn phía
    staffstorm: {
      dur: 1700, own: true,
      spawn(f, o) {
        emit(60, o.sx, o.sy - 6, { speed: (f.r || 170) * 1.6, life: 700, size: 5, color: R() < 0.5 ? '#e8d8a0' : f.color, flat: 0.5, drag: 2.2, delay: 0.62 * 1700 });
        setFlash(f, '#ffe080', 0.62 * 1700, 400);
      },
      draw(ctx, f, p, o) {
        const c = f.color, r = f.r || 170, fade = 1 - seg(p, 0.85, 1), app = seg(p, 0, 0.2), out = seg(p, 0.45, 0.62);
        fxSprite(ctx, 'staff', 0, o.sx, o.sy - 130, { rot: p * 30, color: c, scale: 2.2, alpha: app * (1 - out) });
        glowDot(ctx, o.sx, o.sy - 130, 80, c, 0.4 * app * (1 - out), true);
        for (let i = 0; i < 8; i++) {
          const th = i / 8 * TAU + p * 7, d = r * (0.35 + 0.55 * ease(out)), x = o.sx + Math.cos(th) * d, y = o.sy + Math.sin(th) * d * 0.45;
          if (out < 1) spr(ctx, 'staff', x, y - 50 + out * 30, { rot: p * 26 + i, color: c, scale: 1.2, alpha: app });
          else {
            const e = seg(p, 0.62, 0.9), gx = o.sx + Math.cos(i / 8 * TAU + 0.62 * 7) * r * 0.9, gy = o.sy + Math.sin(i / 8 * TAU + 0.62 * 7) * r * 0.9 * 0.45;
            spr(ctx, 'staff', gx, gy - 36, { rot: Math.PI / 2, color: c, scale: 1.2, alpha: fade });
            crack(ctx, gx, gy, e, c, 1.2, fade);
            boom(ctx, gx, gy - 8, e, c, 0.9);
          }
        }
        shock(ctx, o.sx, o.sy, seg(p, 0.62, 1), c, r);
      }
    },

    // ===== Võ Đang – Thái Cực Kiếm =====
    // Tam Hoàn Sáo Nguyệt: ba vòng nguyệt bay tới vây quanh mục tiêu rồi siết lại
    moonrings: {
      dur: 900, own: true,
      spawn(f, o) { emit(18, o.tx, o.ty - 30, { speed: 140, life: 450, size: 4, color: f.color, delay: 600, drag: 3 }); },
      draw(ctx, f, p, o) {
        const c = f.color;
        for (let k = 0; k < 3; k++) {
          const q = seg(p, k * 0.08, k * 0.08 + 0.35), hy = o.ty - 14 - k * 20;
          if (q <= 0) continue;
          const sq = 1 - seg(p, 0.6, 0.75) * 0.6, al = 1 - seg(p, 0.75, 1);
          if (q < 1) spr(ctx, 'moonring', lerp(o.sx, o.tx, ease(q)), lerp(o.sy - 34, hy, ease(q)), { rot: q * 10, color: c, scale: 0.9, alpha: al });
          else spr(ctx, 'moonring', o.tx, hy, { rot: p * 8 + k, color: k === 1 ? '#ffffff' : c, scale: 1.15 * sq, flat: 0.4, alpha: al });
        }
        boom(ctx, o.tx, o.ty - 34, seg(p, 0.62, 1), c, 1);
      }
    },
    // Nhân Kiếm Hợp Nhất: người hóa thành cự kiếm lao tới, kiếm nhỏ tỏa ra khi trúng
    swordrider: {
      dur: 800, own: true,
      spawn(f, o) { emit(20, o.tx, o.ty - 28, { speed: 180, life: 450, size: 4, color: f.color, delay: 280, drag: 3 }); },
      draw(ctx, f, p, o) {
        const c = f.color, q = seg(p, 0, 0.35), x0 = o.sx, y0 = o.sy - 34, x1 = o.tx, y1 = o.ty - 30, a = AHEAD(o);
        if (q < 1) {
          fly(ctx, 'sword', x0, y0, x1, y1, ease(q), { color: c, scale: 2.2 }, 4, 0.08);
          glowPath(ctx, () => { const x = lerp(x0, x1, ease(q)), y = lerp(y0, y1, ease(q)); ctx.moveTo(lerp(x0, x, 0.4), lerp(y0, y, 0.4)); ctx.lineTo(x, y); }, c, 3, 0.45);
        }
        const e = seg(p, 0.35, 1);
        if (e > 0) {
          boom(ctx, x1, y1, e, c, 1.3);
          for (let i = 0; i < 6; i++) { const th = a + (i - 2.5) * 0.5 + Math.PI * (i % 2), d = 20 + ease(e) * 70; rspr(ctx, 'sword', x1 + Math.cos(th) * d, y1 + Math.sin(th) * d * 0.6, th, { color: c, frame: i, scale: 0.7, alpha: 1 - e }); }
        }
      }
    },
    // Vạn Kiếm Quy Tông: hàng chục phi kiếm tụ trên trời rồi trút xuống như mưa
    tenthousand: {
      dur: 1900, own: true,
      spawn(f, o) {
        const r = f.r || 200, n = 32;
        f.sw = Array.from({ length: n }, (_, i) => { const a = i * 2.39996, d = r * Math.sqrt((i + 0.5) / n); return { a, d, gx: Math.cos(a) * d, gy: Math.sin(a) * d * 0.45, t: 0.42 + seeded(i) * 0.3 }; });
        for (let i = 0; i < n; i += 3) emit(4, o.tx + f.sw[i].gx, o.ty + f.sw[i].gy - 10, { speed: 120, life: 400, size: 3.5, color: f.color, delay: (f.sw[i].t + 0.08) * 1900, drag: 3 });
        setFlash(f, '#e0ecff', 0.5 * 1900, 500);
      },
      draw(ctx, f, p, o) {
        const c = f.color, r = f.r || 200, fade = 1 - seg(p, 0.85, 1), sky = o.ty - 240;
        runeCircle(ctx, o.tx, o.ty, r, c, seg(p, 0.1, 0.3) * fade * 0.6, p * 1.2, 8);
        glowDot(ctx, o.tx, sky, 110, c, 0.35 * seg(p, 0.05, 0.3) * (1 - seg(p, 0.5, 0.75)), true);
        (f.sw || []).forEach((s, i) => {
          const g = seg(p, i * 0.008, i * 0.008 + 0.3);   // tụ về: từ vòng xoáy rộng thu vào đội hình trên trời
          if (g <= 0) return;
          const th = s.a + (1 - g) * 3, rr = s.d * 0.7 + (1 - ease(g)) * 160;
          const fx = o.tx + Math.cos(th) * rr, fy = sky + Math.sin(th) * rr * 0.3;
          const q = seg(p, s.t, s.t + 0.1), gx = o.tx + s.gx, gy = o.ty + s.gy;
          if (q <= 0) spr(ctx, 'sword', fx, fy, { rot: lerp(th + Math.PI / 2, Math.PI / 2, ease(g)), color: c, frame: i, scale: 0.8, alpha: g });
          else if (q < 1) fly(ctx, 'sword', fx, fy, gx, gy - 22, q * q, { color: c, frame: i, scale: 0.9 }, 2, 0.12);
          else {
            spr(ctx, 'sword', gx, gy - 20, { rot: Math.PI / 2, color: c, frame: i, scale: 0.8, alpha: fade });
            boom(ctx, gx, gy - 6, seg(p, s.t + 0.1, s.t + 0.3), c, 0.6);
          }
        });
      }
    },

    // ===== Côn Lôn – Lôi Đình Kiếm =====
    thunderslash: {
      dur: 700, own: true,
      spawn(f, o) { emit(16, o.tx, o.ty - 28, { speed: 180, life: 350, size: 3, color: f.color, delay: 200, drag: 4 }); setFlash(f, '#f0e0ff', 200, 200); },
      draw(ctx, f, p, o) {
        const c = f.color, a = AHEAD(o), len = Math.max(60, Math.min(90, Math.hypot(o.tx - o.sx, o.ty - o.sy)));
        swing(ctx, 'sword', o.sx, o.sy - 36, a - 1.6, a + 0.5, seg(p, 0, 0.35), len, c, 1 - seg(p, 0.5, 0.8));
        fxSprite(ctx, 'slash', seg(p, 0.15, 0.8), o.tx, o.ty - 28, { rot: a, color: c, scale: 1.3 });
        for (let k = 0; k < 2; k++) {
          const lp = seg(p, 0.25 + k * 0.2, 0.45 + k * 0.2);
          if (lp > 0 && lp < 1) { fxSprite(ctx, 'lightning', 0, o.tx + (k ? 12 : -10), o.ty + 6, { frame: FR(50) + k, color: k ? '#ffffff' : c, scale: 2.4, anchor: 0.97, alpha: 1 - lp }); glowDot(ctx, o.tx, o.ty - 10, 40, c, (1 - lp) * 0.6); }
        }
      }
    },
    // Phong Lôi Kiếm Trận: kiếm xoay quanh thân, mỗi kiếm dẫn sét đánh xuống
    thunderring: {
      dur: 1100, own: true,
      spawn(f, o) { const r = f.r || 130; for (let i = 0; i < 6; i++) emit(6, o.sx + Math.cos(i) * r * 0.7, o.sy + Math.sin(i) * r * 0.3, { speed: 150, life: 350, size: 3, color: f.color, delay: (0.3 + i * 0.07) * 1100, drag: 4 }); },
      draw(ctx, f, p, o) {
        const c = f.color, r = (f.r || 130) * (0.4 + 0.6 * ease(seg(p, 0, 0.4))), fade = 1 - seg(p, 0.8, 1);
        ground(ctx, o.sx, o.sy, r * 1.1, c, 0.4 * fade);
        for (let i = 0; i < 6; i++) {
          const th = i / 6 * TAU + p * 6, x = o.sx + Math.cos(th) * r * 0.8, y = o.sy + Math.sin(th) * r * 0.36;
          spr(ctx, 'sword', x, y - 60, { rot: Math.PI / 2, color: c, frame: i, scale: 0.85, alpha: fade });
          const lp = seg(p, 0.3 + i * 0.07, 0.45 + i * 0.07);
          if (lp > 0 && lp < 1) { fxSprite(ctx, 'lightning', 0, x, y + 4, { frame: FR(40) + i, color: i % 2 ? '#ffffff' : c, scale: 2.2, anchor: 0.97, alpha: 1 - lp }); boom(ctx, x, y - 6, lp, c, 0.7); }
        }
      }
    },
    // Thiểm Điện Bộ: hóa thành tia chớp, bóng người lóe dọc đường, sét giáng tại đích
    lightningdash: {
      dur: 650, own: true,
      spawn(f, o) { emit(20, o.tx, o.ty - 28, { speed: 200, life: 350, size: 3, color: f.color, delay: 200, drag: 4 }); setFlash(f, '#fff8c0', 150, 200); },
      draw(ctx, f, p, o) {
        const c = f.color, a = AHEAD(o), len = Math.hypot(o.tx - o.sx, o.ty - o.sy);
        for (let i = 0; i < 3; i++) {   // tia chớp nối các bóng người
          const lp = seg(p, i * 0.06, i * 0.06 + 0.35); if (lp <= 0 || lp >= 1) continue;
          const t = i / 3, x = lerp(o.sx, o.tx, t + 1 / 6), y = lerp(o.sy, o.ty, t + 1 / 6) - 30;
          fxSprite(ctx, 'lightning', 0, x, y, { frame: FR(40) + i, rot: a - Math.PI / 2, color: i % 2 ? '#ffffff' : c, scale: len / 3 / 60, alpha: 1 - lp });
          rspr(ctx, 'lunge', lerp(o.sx, o.tx, t + 0.3), lerp(o.sy, o.ty, t + 0.3) - 30, Math.cos(a) < 0 ? Math.PI : 0, { color: c, scale: 1.1, alpha: (1 - lp) * 0.7 });
        }
        const e = seg(p, 0.25, 0.75);
        if (e > 0 && e < 1) fxSprite(ctx, 'lightning', 0, o.tx, o.ty + 6, { frame: FR(40), color: c, scale: 2.2, anchor: 0.97, alpha: 1 - e });
        boom(ctx, o.tx, o.ty - 26, seg(p, 0.25, 0.8), c, 1.1);
      }
    },
    // Lôi Thần Giáng Thế: Lôi Thần hiện trên đầu giữa mây đen, nện búa giáng sét khắp nơi
    thundergod: {
      dur: 1900, own: true,
      spawn(f, o) {
        const r = f.r || 190;
        f.bolts = ringPts(10, r * 0.75, true).map((b, i) => Object.assign(b, { t: 0.35 + i * 0.045 }));
        for (const b of f.bolts) emit(6, o.sx + b.x, o.sy + b.y - 6, { speed: 160, life: 350, size: 3, color: f.color, delay: b.t * 1900, drag: 3 });
        setFlash(f, '#e0c8ff', 0.35 * 1900, 900);
      },
      draw(ctx, f, p, o) {
        const c = f.color, r = f.r || 190, app = seg(p, 0, 0.25), fade = 1 - seg(p, 0.85, 1);
        clouds(ctx, o.sx, o.sy - 270, r, app * fade);
        ground(ctx, o.sx, o.sy, r * 1.1, c, 0.45 * fade);
        const gx = o.sx, gy = o.sy - 90 - (1 - ease(app)) * 60, hit = p > 0.35 && Math.floor(p * 14) % 2 === 0;
        figure(ctx, 'thundergod', gx, gy, hit ? 1 : 0, c, 2.6, app * fade * 0.9);
        for (const b of f.bolts || []) {
          const lp = seg(p, b.t, b.t + 0.12); if (lp <= 0 || lp >= 1) continue;
          const x = o.sx + b.x, y = o.sy + b.y;
          fxSprite(ctx, 'lightning', 0, x, y + 6, { frame: FR(40) + (b.a * 3 | 0), color: lp < 0.3 ? '#ffffff' : c, scale: 2.4, anchor: 0.97, alpha: 1 - lp });
          crack(ctx, x, y, lp, c, 0.9, 1 - lp);
          boom(ctx, x, y - 6, lp, c, 0.9);
        }
        shock(ctx, o.sx, o.sy, seg(p, 0.35, 0.75), c, r);
      }
    }
  });

  const DUR2 = { dash: 600, beam: 650, lightning: 520 };
  // Bắn hạt khi hiệu ứng bắt đầu
  function spawn(f) {
    const { sx, sy, tx, ty } = pos(f);
    if (SIG[f.t]) { f.dur = SIG[f.t].dur; SIG[f.t].spawn(f, { sx, sy, tx, ty }); return; }
    const c = f.color || '#fff', r = f.r || 140;
    const body = ty - 28;
    if (DUR2[f.t]) f.dur = DUR2[f.t];   // chiêu cũ vẽ lại bằng hình cần thêm chút thời gian
    const travel = f.dur * (f.t === 'beam' ? 0.45 : 0.85);
    switch (f.t) {
      case 'slash': case 'slash2': case 'palm':
        emit(f.t === 'palm' ? 18 : 12, tx, body, { speed: 160, life: 380, size: 4, color: c, drag: 3 }); break;
      case 'bite': emit(6, tx, body, { speed: 90, life: 300, size: 3, color: '#ff5050' }); break;
      case 'dart': case 'bolt': case 'dartfan': case 'beam':
        emit(10, tx, body, { speed: 140, life: 350, size: 3.5, color: c, delay: travel, drag: 3 }); break;
      case 'dragon':
        emit(26, tx, body, { speed: 200, life: 500, size: 5, color: c, delay: travel, drag: 3 }); break;
      case 'lightning':
        emit(16, tx, body, { speed: 180, life: 350, size: 3, color: c, drag: 4, delay: f.dur * 0.35 }); break;
      case 'storm':
        for (let i = 0; i < 6; i++) emit(8, tx + (R() - 0.5) * r, ty + (R() - 0.5) * r * 0.45 - 10, { speed: 140, life: 350, size: 3, color: c, delay: i * 110 });
        break;
      case 'ring': case 'net': case 'swords': case 'taiji': case 'lotus':
        emit(36, tx, ty - 6, { speed: r * 1.4, life: 500, size: 4, color: c, flat: 0.45, drag: 2.5 });
        if (f.t === 'lotus') emit(24, tx, ty - 30, { speed: 40, vy: -50, life: 900, size: 5, color: '#ffc0e0', jitter: r * 0.6, jitterY: r * 0.25 });
        break;
      case 'poison':
        emit(40, tx, ty - 10, { speed: 20, vy: -45, life: 1000, size: 6, color: c, jitter: r * 0.7, jitterY: r * 0.3, delayRand: 300 }); break;
      case 'tornado':
        emit(50, tx, ty - 20, { speed: 60, vy: -110, life: 900, size: 4, color: c, jitter: 40, jitterY: 10, delayRand: 600 }); break;
      case 'nova':
        emit(80, tx, ty - 24, { speed: r * 2.2, life: 700, size: 6, color: c, flat: 0.6, drag: 2.2 });
        emit(30, tx, ty - 24, { speed: 80, vy: -120, life: 900, size: 5, color: '#fff', jitter: r * 0.5, jitterY: r * 0.2 });
        if (f.from === window.G.you) flash = { color: c, t0: performance.now(), dur: 380 };
        break;
      case 'meteor':
        f.meteors = Array.from({ length: 8 }, (_, i) => ({ ox: (R() - 0.5) * r * 1.4, oy: (R() - 0.5) * r * 0.6, d: i * 90 }));
        for (const m of f.meteors) emit(14, tx + m.ox, ty + m.oy - 8, { speed: 160, life: 450, size: 5, color: c, flat: 0.6, delay: m.d + 380, drag: 3 });
        if (f.from === window.G.you) flash = { color: c, t0: performance.now() + 400, dur: 500 };
        break;
      case 'pillar':
        emit(50, tx, ty - 10, { speed: 40, vy: -160, life: 900, size: 5, color: c, jitter: 40, jitterY: 10, delayRand: 500 });
        emit(40, tx, ty - 6, { speed: (f.r || 180) * 1.5, life: 600, size: 5, color: c, flat: 0.45, delay: 200, drag: 2.5 });
        if (f.from === window.G.you) flash = { color: c, t0: performance.now() + 150, dur: 450 };
        break;
      case 'blades': emit(30, sx, sy - 24, { speed: (f.r || 130) * 1.6, life: 450, size: 4, color: c, flat: 0.6, drag: 2.5 }); break;
      case 'dash': {
        const n = 18;
        for (let i = 0; i < n; i++) emit(1, sx + (tx - sx) * i / n, sy - 28 + (ty - sy) * i / n, { speed: 20, life: 450, size: 6, color: c });
        emit(16, tx, body, { speed: 180, life: 380, size: 4, color: c, drag: 3 });
        break;
      }
      case 'aura': emit(36, sx, sy - 10, { speed: 15, vy: -90, life: 900, size: 4, color: c, jitter: 22, jitterY: 6, delayRand: 500 }); break;
      case 'heal': emit(40, sx, sy - 10, { speed: 15, vy: -70, life: 1000, size: 4, color: '#7dff9a', jitter: (f.r || 120) * 0.7, jitterY: (f.r || 120) * 0.3, delayRand: 400 }); break;
      case 'levelup': if (!f.small) emit(60, sx, sy - 10, { speed: 30, vy: -150, life: 1200, size: 5, color: '#ffd700', jitter: 26, jitterY: 6, delayRand: 600 });
        else emit(24, sx, sy - 30, { speed: 120, life: 600, size: 4, color: '#ffd700', drag: 2 });
        break;
      case 'death': emit(f.small ? 10 : 14, f.x, f.y - 24, { speed: 70, life: 500, size: 6, color: f.small ? '#ffffff' : '#bbbbbb', drag: 2 }); break;
    }
  }

  function draw(ctx, now) {
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    const G = window.G;
    G.fx = G.fx.filter(f => now - f.t0 < f.dur);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // giới hạn hiệu ứng vẽ cùng lúc: chiêu của mình / đánh vào mình luôn vẽ đủ; chiêu người khác chỉ vẽ đủ khi chưa đông,
    // còn lại vẽ gọn (đốm sáng nhỏ tại điểm trúng) để PK đông người không giật
    // tự điều chỉnh: thời gian vẽ hiệu ứng trung bình các khung trước quá cao -> vẽ gọn hơn (máy khỏe vẫn vẽ đủ)
    const heavy = fxCost > 6, veryHeavy = fxCost > 10;
    const tStart = performance.now();
    let others = 0;
    const FULL_OTHERS = veryHeavy ? 0 : (heavy || (G.gfx && G.gfx.lowFx)) ? 2 : 5;
    lean = heavy || !!(G.gfx && G.gfx.lowFx);
    for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f._lite = false; if (f.from !== G.you && f.to !== G.you && (SIG[f.t] || f.t !== 'levelup') && ++others > FULL_OTHERS) f._lite = true; }
    for (const f of G.fx) {
      const p = Math.max(0, (now - f.t0) / f.dur);
      if (f._lite) { const q = pos(f); glowDot(ctx, q.tx, q.ty - 28, 26, f.color || '#fff', (1 - p) * 0.55); continue; }
      const { sx, sy, tx, ty, src } = pos(f);
      const c = f.color || '#fff', r = f.r || 140;
      const bx = sx, by = sy - 28, ex = tx, ey = ty - 28;
      if (SIG[f.t]) { SIG[f.t].draw(ctx, f, p, { sx, sy, tx, ty, src }); if (!/dragon$/.test(f.t) && !SIG[f.t].own) spriteLayer(ctx, f, p, { sx, sy, tx, ty, bx, by, ex, ey, src, r, c }, true); continue; }
      switch (f.t) {
        case 'slash': case 'slash2': {
          // binh khí môn phái (côn, chùy, đao, kiếm) vung qua mục tiêu; đòn 2 vung ngược lại
          const a = Math.atan2(ey - by, ex - bx), wp = WEAPON[clsOf(src)] || 'sword';
          const len = Math.max(56, Math.min(96, Math.hypot(ex - bx, ey - by) + 10));
          swing(ctx, wp, bx, by - 6, a - 1.5, a + 0.5, seg(p, 0, 0.45), len, c, 1 - seg(p, 0.6, 1));
          if (f.t === 'slash2') swing(ctx, wp, bx, by - 6, a + 1.5, a - 0.5, seg(p, 0.15, 0.6), len * 0.9, c, 1 - seg(p, 0.7, 1));
          glowDot(ctx, ex, ey, 22, c, (1 - p) * 0.5);
          break;
        }
        case 'bite': {
          const a = Math.atan2(ey - by, ex - bx);
          const rad = f.t === 'bite' ? 18 : 30;
          const a0 = a - 1.4, a1 = a0 + 2.6 * ease(Math.min(1, p * 1.6));
          const col = f.t === 'bite' ? '#ff4040' : c;
          glowPath(ctx, () => ctx.arc(ex, ey, rad, a0, a1), col, f.t === 'bite' ? 3 : 5, 1 - p);
          if (f.t === 'slash2') glowPath(ctx, () => ctx.arc(ex, ey, rad - 6, a + 1.4, a + 1.4 - 2.6 * ease(Math.min(1, p * 1.6)), true), col, 4, 1 - p);
          glowDot(ctx, ex, ey, 26, col, (1 - p) * 0.6);
          break;
        }
        case 'palm': {
          glowDot(ctx, ex, ey, 30 + p * 40, c, 1 - p);
          glowPath(ctx, () => ctx.ellipse(ex, ey, 14 + p * 36, (14 + p * 36) * 0.8, 0, 0, Math.PI * 2), c, 4, 1 - p);
          break;
        }
        case 'dart': case 'bolt': case 'dartfan': {
          const n = f.t === 'dartfan' ? 5 : 1, q = Math.min(1, p / 0.85);
          for (let i = 0; i < n; i++) {
            const off = (i - (n - 1) / 2) * 0.16, a = Math.atan2(ey - by, ex - bx) + off, len = Math.hypot(ex - bx, ey - by);
            const px = bx + Math.cos(a) * len * q, py = by + Math.sin(a) * len * q;
            if (q >= 1) continue;
            for (let k = 2; k >= 0; k--) glowDot(ctx, px - Math.cos(a) * k * 10, py - Math.sin(a) * k * 10, (f.t === 'bolt' ? 12 : 8) - k * 2, c, 0.6 * (1 - k * 0.3));   // vệt sáng nhỏ điểm xuyết
            // Bạo Vũ Lê Hoa: cánh hoa lê bay theo từng mũi châm
            if (f.t === 'dartfan') fxSprite(ctx, 'petal', 0, px - Math.cos(a) * 22 + Math.sin(q * 12 + i) * 6, py - Math.sin(a) * 22 + Math.cos(q * 12 + i) * 6, { frame: FR(100) + i, rot: q * 9 + i, color: '#ffffff', scale: 0.55, alpha: 0.9 });
          }
          if (q >= 1) glowDot(ctx, ex, ey, 36, c, 1 - (p - 0.85) / 0.15);
          break;
        }
        case 'dragon': {
          const q = Math.min(1, p / 0.85), a = Math.atan2(ey - by, ex - bx), len = Math.hypot(ex - bx, ey - by);
          for (let k = 12; k >= 0; k--) {
            const tq = Math.max(0, q - k * 0.035), wv = Math.sin((tq * 10) + k * 0.6) * 10;
            const px = bx + Math.cos(a) * len * tq - Math.sin(a) * wv, py = by + Math.sin(a) * len * tq + Math.cos(a) * wv;
            glowDot(ctx, px, py, (k === 0 ? 34 : 24 - k * 1.4), k === 0 ? '#fff6c0' : c, (q < 1 ? 1 : 1 - (p - 0.85) / 0.15) * (1 - k * 0.06));
          }
          break;
        }
        case 'beam': {
          // Truy Tâm Tiễn: mũi tên lớn xé gió (vòng gió xoáy quanh thân tên) lao tới rồi cắm vào mục tiêu
          const a = Math.atan2(ey - by, ex - bx), q = seg(p, 0, 0.45);
          if (q < 1) {
            const x = lerp(bx, ex, q), y = lerp(by, ey, q);
            glowPath(ctx, () => { ctx.moveTo(lerp(bx, x, 0.6), lerp(by, y, 0.6)); ctx.lineTo(x, y); }, c, 2, 0.5);
            for (let k = 1; k <= 3; k++) { const t = q - k * 0.06; if (t > 0) fxSprite(ctx, 'shock', 0.35, lerp(bx, ex, t), lerp(by, ey, t), { rot: a + Math.PI / 2, color: c, scale: 0.55, anchor: 0.625, alpha: 0.8 - k * 0.2 }); }
            fly(ctx, 'arrow', bx, by, ex, ey, q, { color: c, scale: 1.5 }, 2, 0.06);
          } else {
            const e = seg(p, 0.45, 1);
            rspr(ctx, 'arrow', ex - Math.cos(a) * 22, ey - Math.sin(a) * 22, a, { color: c, scale: 1.2, alpha: 1 - e });
            boom(ctx, ex, ey, e, c, 1.2);
          }
          break;
        }
        case 'lightning': {
          // Lôi Phù: lá bùa bay tới trên đầu mục tiêu rồi dẫn sét giáng xuống, bát quái in dưới chân
          const q = seg(p, 0, 0.35);
          if (q < 1) { const [x, y] = hop(bx, by, ex, ey - 64, q, 40); spr(ctx, 'talisman', x, y, { frame: FR(60), color: c, scale: 1 }); }
          else {
            const e = seg(p, 0.35, 1);
            spr(ctx, 'talisman', ex, ey - 70 - e * 10, { frame: FR(60), color: c, scale: 1, alpha: 1 - e });
            fxSprite(ctx, 'lightning', 0, ex, ty + 4, { frame: FR(50), color: e < 0.3 ? '#ffffff' : c, scale: 2, anchor: 0.97, alpha: 1 - e });
            fxSprite(ctx, 'bagua', 0, ex, ty, { frame: FR(100), color: c, scale: 1.2, flat: 0.45, alpha: (1 - e) * 0.8 });
            glowDot(ctx, ex, ey, 34, c, (1 - e) * 0.6);
          }
          break;
        }
        case 'storm': {
          ground(ctx, ex, ty, r, c, (1 - p) * 0.5);
          f.bolts = f.bolts || Array.from({ length: 7 }, (_, i) => ({ x: ex + (R() - 0.5) * r, y: ty + (R() - 0.5) * r * 0.45, t: i / 9 }));
          for (const b of f.bolts) {
            const lp = (p - b.t) / 0.25;
            if (lp < 0 || lp > 1) continue;
            fxSprite(ctx, 'lightning', 0, b.x, b.y, { frame: FR(50) + (b.t * 9 | 0), color: lp < 0.3 ? '#ffffff' : c, scale: 2.4, anchor: 0.97, alpha: 1 - lp });
            glowDot(ctx, b.x, b.y - 8, 40, c, 1 - lp);
          }
          break;
        }
        case 'ring': case 'net': {
          const rr = r * (0.25 + ease(p) * 0.75);
          ground(ctx, ex, ty, rr * 1.1, c, (1 - p) * 0.55);
          glowPath(ctx, () => ctx.ellipse(ex, ty, rr, rr * 0.45, 0, 0, Math.PI * 2), c, 5, 1 - p);
          glowPath(ctx, () => ctx.ellipse(ex, ty, rr * 0.7, rr * 0.7 * 0.45, 0, 0, Math.PI * 2), c, 3, (1 - p) * 0.7);
          if (f.t === 'net') for (let i = -3; i <= 3; i++) {
            glowPath(ctx, () => { ctx.moveTo(ex + i * rr / 3.5, ty - rr * 0.42); ctx.lineTo(ex + i * rr / 3.5, ty + rr * 0.42); }, c, 1.5, (1 - p) * 0.8);
            glowPath(ctx, () => { ctx.moveTo(ex - rr, ty + i * rr * 0.12); ctx.lineTo(ex + rr, ty + i * rr * 0.12); }, c, 1.5, (1 - p) * 0.8);
          }
          break;
        }
        case 'poison': {
          ground(ctx, ex, ty, r * 1.2, c, (1 - p) * 0.6);
          glowPath(ctx, () => ctx.ellipse(ex, ty, r, r * 0.45, 0, 0, Math.PI * 2), c, 3, (1 - p) * 0.8);
          break;
        }
        case 'swords': {
          ground(ctx, ex, ty, r, c, (1 - p) * 0.5);
          for (let i = 0; i < 10; i++) {
            const a = i / 10 * Math.PI * 2, d = r * (0.3 + (i % 3) * 0.25);
            const px = ex + Math.cos(a) * d, gy = ty + Math.sin(a) * d * 0.45;
            const lp = Math.min(1, Math.max(0, (p - i * 0.03) / 0.45));
            const yy = gy - 260 * (1 - ease(lp));
            spr(ctx, 'sword', px, yy - 20, { rot: Math.PI / 2, color: c, frame: i, alpha: lp < 1 ? 1 : 1 - (p - 0.5) * 2 });   // phi kiếm cắm xuống
            if (lp >= 1) glowDot(ctx, px, gy, 18, c, 1 - p);
          }
          break;
        }
        case 'taiji': {
          const rr = r * (0.4 + ease(Math.min(1, p * 2)) * 0.6), rot = p * 6;
          ctx.save(); ctx.translate(ex, ty); ctx.scale(1, 0.45); ctx.rotate(rot);
          glowPath(ctx, () => ctx.arc(0, 0, rr, 0, Math.PI * 2), c, 5, 1 - p);
          glowPath(ctx, () => { ctx.arc(0, -rr / 2, rr / 2, Math.PI / 2, -Math.PI / 2, true); ctx.arc(0, rr / 2, rr / 2, -Math.PI / 2, Math.PI / 2); }, c, 4, 1 - p);
          for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; glowDot(ctx, Math.cos(a) * rr * 1.15, Math.sin(a) * rr * 1.15, 16, c, 1 - p); }
          ctx.restore();
          ground(ctx, ex, ty, rr, c, (1 - p) * 0.4);
          break;
        }
        case 'lotus': {
          const rr = r * (0.3 + ease(p) * 0.7);
          ground(ctx, ex, ty, rr, c, (1 - p) * 0.5);
          for (let i = 0; i < 10; i++) {
            const a = i / 10 * Math.PI * 2 + p * 3;
            ctx.save(); ctx.translate(ex + Math.cos(a) * rr, ty - 20 + Math.sin(a) * rr * 0.45); ctx.rotate(a + Math.PI / 2);
            ctx.globalAlpha = 1 - p; ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, 6, 14, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            glowDot(ctx, ex + Math.cos(a) * rr, ty - 20 + Math.sin(a) * rr * 0.45, 18, c, (1 - p) * 0.7);
          }
          break;
        }
        case 'blades': {
          const rr = 30 + ease(p) * (r - 30);
          for (let i = 0; i < 6; i++) {
            const a = i / 6 * Math.PI * 2 + p * 9;
            const px = bx + Math.cos(a) * rr, py = sy - 20 + Math.sin(a) * rr * 0.5;
            glowPath(ctx, () => ctx.arc(px, py, 12, a, a + 2.2), c, 4, 1 - p);
          }
          ground(ctx, bx, sy, rr, c, (1 - p) * 0.4);
          break;
        }
        case 'tornado': {
          ground(ctx, ex, ty, r * 0.9, c, (1 - p) * 0.5);
          const fade = p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.7) / 0.3);
          for (let k = 0; k < 46; k++) {
            const h = k / 46, a = h * 14 - p * 22, w = 14 + h * 46;
            glowDot(ctx, ex + Math.cos(a) * w, ty - 6 - h * 170 + Math.sin(a) * w * 0.3, 10 + h * 6, c, fade * 0.85);
          }
          break;
        }
        case 'nova': {
          const rr = r * ease(p) * 1.3;
          glowDot(ctx, ex, ey, 40 + rr, c, (1 - p) * 0.9);
          glowPath(ctx, () => ctx.ellipse(ex, ty, rr, rr * 0.45, 0, 0, Math.PI * 2), c, 7, 1 - p);
          glowPath(ctx, () => ctx.ellipse(ex, ty, rr * 0.6, rr * 0.27, 0, 0, Math.PI * 2), '#ffffff', 4, (1 - p) * 0.8);
          break;
        }
        case 'meteor': {
          ground(ctx, ex, ty, r, c, Math.min(1, p * 3) * (1 - p) * 0.6);
          for (const m of f.meteors || []) {
            const lp = ((now - f.t0) - m.d) / 380;
            const gx = ex + m.ox, gy = ty + m.oy;
            if (lp < 0) continue;
            if (lp <= 1) {
              const px = gx + 160 * (1 - lp), py = gy - 330 * (1 - lp) - 8;
              glowPath(ctx, () => { ctx.moveTo(px + 50, py - 100); ctx.lineTo(px, py); }, c, 6, 0.8);
              glowDot(ctx, px, py, 30, '#fff3c0', 1);
            } else {
              const ep = (lp - 1) / 0.9;
              if (ep < 1) { glowDot(ctx, gx, gy - 10, 30 + ep * 50, c, 1 - ep); glowPath(ctx, () => ctx.ellipse(gx, gy, 10 + ep * 50, (10 + ep * 50) * 0.45, 0, 0, Math.PI * 2), c, 4, 1 - ep); }
            }
          }
          break;
        }
        case 'pillar': {
          const w = 70 * Math.sin(Math.min(1, p * 1.2) * Math.PI);
          const g = ctx.createLinearGradient(0, ty - 420, 0, ty);
          g.addColorStop(0, Sprites.hexA(c, 0)); g.addColorStop(0.6, Sprites.hexA(c, 0.55)); g.addColorStop(1, Sprites.hexA('#ffffff', 0.9));
          ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(ex - w / 2, ty - 420, w, 420);
          ctx.fillStyle = Sprites.hexA('#ffffff', 0.6); ctx.fillRect(ex - w / 6, ty - 420, w / 3, 420);
          ground(ctx, ex, ty, (f.r || 180) * (0.5 + p * 0.6), c, (1 - p) * 0.8);
          glowPath(ctx, () => ctx.ellipse(ex, ty, (f.r || 180) * ease(p), (f.r || 180) * ease(p) * 0.45, 0, 0, Math.PI * 2), c, 5, 1 - p);
          break;
        }
        case 'dash': {
          // lướt: chuỗi bóng người dọc đường, binh khí môn phái giáng vào mục tiêu
          const a = Math.atan2(ey - (f.y - 28), ex - f.x), cls = clsOf(src), wp = WEAPON[cls] || 'sword', fade = 1 - seg(p, 0.7, 1);
          glowPath(ctx, () => { ctx.moveTo(f.x, f.y - 28); ctx.lineTo(ex, ey); }, c, 3, (1 - p) * 0.5);
          for (let i = 1; i <= 4; i++) {
            const t = i / 5, lp = seg(p, t * 0.25, t * 0.25 + 0.4);
            if (lp > 0 && lp < 1) rspr(ctx, 'lunge', lerp(f.x, ex, t), lerp(f.y - 28, ey, t), Math.cos(a) < 0 ? Math.PI : 0, { color: c, scale: 1.1, alpha: (1 - lp) * 0.65 });
          }
          const q = seg(p, 0.1, 0.45);
          if (cls === 'thienvuong') {
            if (q < 1) fly(ctx, 'fireball', lerp(f.x, ex, 0.5), lerp(f.y - 28, ey, 0.5), ex, ey, q, { color: c, scale: 1.4, frame: FR(70) });
            else fxSprite(ctx, 'flame', seg(p, 0.45, 1), ex, ty, { color: c, scale: 1.2, anchor: 0.9, alpha: fade });
          } else if (wp === 'staff' && cls !== 'caibang') {   // Vi Đà Xử: chày giáng thẳng xuống, nứt đất
            spr(ctx, 'staff', ex, ty - 50 - 80 * (1 - ease(q)), { rot: Math.PI / 2, color: c, scale: 1.4, alpha: fade });
            crack(ctx, ex, ty, seg(p, 0.45, 0.8), c, 1.6, fade);
          } else if (wp === 'blade') {
            for (const sd of [1, -1]) swing(ctx, 'blade', ex - Math.cos(a) * 34, ey - 8 * sd, a - sd * 1.4, a + sd * 0.5, q, 64, c, fade);
          } else if (cls !== 'caibang') swing(ctx, 'sword', ex - Math.cos(a) * 40, ey, a - 1.3, a + 0.5, q, 64, c, fade);
          if (f.r) glowPath(ctx, () => ctx.ellipse(tx, ty, f.r * ease(p), f.r * ease(p) * 0.45, 0, 0, Math.PI * 2), c, 3, (1 - p) * 0.7);
          break;
        }
        case 'aura': {
          const x = src ? src.x : f.x, y = src ? src.y : f.y;
          ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.45); ctx.rotate(p * 4);
          glowPath(ctx, () => ctx.arc(0, 0, 40, 0, Math.PI * 2), c, 3, 1 - p);
          glowPath(ctx, () => ctx.arc(0, 0, 30, 0, Math.PI * 2), c, 2, 1 - p);
          for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; glowPath(ctx, () => { ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); ctx.lineTo(Math.cos(a) * 42, Math.sin(a) * 42); }, c, 2, 1 - p); }
          ctx.restore();
          const g = ctx.createLinearGradient(0, y - 120, 0, y);
          g.addColorStop(0, Sprites.hexA(c, 0)); g.addColorStop(1, Sprites.hexA(c, 0.5 * (1 - p)));
          ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(x - 26, y - 120, 52, 120);
          break;
        }
        case 'heal': {
          const x = src ? src.x : f.x, y = src ? src.y : f.y, rr = (f.r || 120) * (0.3 + ease(p) * 0.7);
          ground(ctx, x, y, rr, '#7dff9a', (1 - p) * 0.55);
          glowPath(ctx, () => ctx.ellipse(x, y, rr, rr * 0.45, 0, 0, Math.PI * 2), '#9dffb0', 3, 1 - p);
          for (let i = 0; i < 5; i++) {
            const cx = x + Math.cos(i * 1.3) * rr * 0.5, cy = y - 30 - p * 60 - i * 8;
            glowPath(ctx, () => { ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6); }, '#7dff9a', 2.5, 1 - p);
          }
          break;
        }
        case 'levelup': {
          const x = src ? src.x : f.x, y = src ? src.y : f.y;
          if (f.small) { glowDot(ctx, x, y - 30, 30 + p * 40, '#ffd700', 1 - p); break; }
          const g = ctx.createLinearGradient(0, y - 220, 0, y);
          g.addColorStop(0, 'rgba(255,215,0,0)'); g.addColorStop(1, `rgba(255,215,0,${0.7 * (1 - p)})`);
          ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(x - 34, y - 220, 68, 220);
          ground(ctx, x, y, 70, '#ffd700', 1 - p);
          break;
        }
        case 'death': {
          glowDot(ctx, f.x, f.y - 24, 30, f.small ? '#ffffff' : '#999999', (1 - p) * 0.4);
          break;
        }
      }
      spriteLayer(ctx, f, p, { sx, sy, tx, ty, bx, by, ex, ey, src, r, c });
    }
    // hạt sáng
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      const age = now - q.t0;
      if (age < 0) continue;
      if (age > q.life) { parts.splice(i, 1); continue; }
      if (q.drag) { const k = Math.max(0, 1 - q.drag * dt); q.vx *= k; q.vy *= k; }
      q.vy += q.ay * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const a = 1 - age / q.life;
      if (q.size < 2.6) { ctx.globalAlpha = a; ctx.fillStyle = q.color; ctx.fillRect(q.x - 1, q.y - 1, 2, 2); }   // hạt nhỏ: chấm vuông, khỏi vẽ quầng
      else glowDot(ctx, q.x, q.y, q.size * 3, q.color, a);
    }
    ctx.restore();
    fxCost = fxCost * 0.9 + (performance.now() - tStart) * 0.1;
  }
  let fxCost = 0, lean = false;   // thời gian vẽ hiệu ứng (ms, trung bình trượt); lean: bỏ lớp hình nền môn phái

  window.FX = {
    init(fn) { entityById = fn; },
    spawn, draw, emit, glowDot, sprite: fxSprite,
    flash(now) { if (!flash) return null; const p = (now - flash.t0) / flash.dur; if (p > 1) { flash = null; return null; } return p < 0 ? null : { color: flash.color, a: 0.35 * (1 - p) }; }
  };
})();
