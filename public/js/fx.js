// Hiệu ứng kỹ năng phát sáng: hạt sáng, cộng sáng (additive), sóng xung kích, tia sét, cột sáng...
(function () {
  const parts = [];
  let entityById = () => null;
  let flash = null;
  let lastT = performance.now();
  const R = Math.random;
  const ease = p => 1 - Math.pow(1 - p, 3);

  function emit(n, x, y, o = {}) {
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
    if (parts.length > 900) parts.splice(0, parts.length - 900);
  }
  function glowDot(ctx, x, y, r, color, a = 1, soft) {
    const g = Sprites.glow(color, r, soft);
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.drawImage(g, x - g.width / 2, y - g.height / 2);
  }
  function glowPath(ctx, draw, color, w, a = 1) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const passes = [[w * 3.2, 0.16, color], [w * 1.7, 0.35, color], [w * 0.9, 0.8, color], [Math.max(1, w * 0.35), 0.9, '#ffffff']];
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
    const sx = (f.t === 'dash') ? f.x : (src ? src.x : f.x), sy = (f.t === 'dash') ? f.y : (src ? src.y : f.y);
    const tx = tgt ? tgt.x : (f.tx != null ? f.tx : f.x), ty = tgt ? tgt.y : (f.ty != null ? f.ty : f.y);
    return { sx, sy, tx, ty, src };
  }
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
  function runeCircle(ctx, x, y, r, c, a, rot, spokes = 8) {
    flat(ctx, x, y, () => {
      ctx.rotate(rot);
      glowPath(ctx, () => ctx.arc(0, 0, r, 0, TAU), c, 3, a);
      glowPath(ctx, () => ctx.arc(0, 0, r * 0.78, 0, TAU), c, 2, a * 0.8);
      for (let i = 0; i < spokes; i++) {
        const an = i / spokes * TAU;
        glowPath(ctx, () => { ctx.moveTo(Math.cos(an) * r * 0.78, Math.sin(an) * r * 0.78); ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); }, c, 2, a);
        glowPath(ctx, () => ctx.arc(Math.cos(an + 0.4) * r * 0.89, Math.sin(an + 0.4) * r * 0.89, r * 0.05, 0, TAU), c, 1.5, a);
      }
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
    ice:   { body: '#9ee8ff', light: '#ffffff', dark: '#3a7ab0', glow: '#bff0ff', eye: '#5af0ff', spike: '#e8fbff' }
  };
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
          if (Math.random() < 0.9) emit(2, hx, hy, { angle: a + Math.PI, spread: 0.8, speed: 80, life: 500, size: 5, color: el === 'water' ? '#ffffff' : pal.light });
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


  // ===== Hình chiêu thức (assets/fx.png, vẽ bởi tools/fxsheet.py), tô màu theo chiêu =====
  const SHEET = { img: null, meta: null, tint: {} };
  (function loadSheet() {
    const im = new Image(); im.onload = () => { SHEET.img = im; }; im.src = '/assets/fx.png';
    fetch('/assets/fx.json').then(r => r.json()).then(m => { SHEET.meta = m; }).catch(() => {});
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
  const PROJ = new Set(['dart', 'bolt', 'dartfan', 'beam', 'dragon']);
  const MELEE = new Set(['slash', 'slash2', 'palm', 'dash', 'bite']);
  const AOE = new Set(['ring', 'net', 'swords', 'taiji', 'lotus', 'poison', 'tornado', 'nova', 'meteor', 'pillar', 'storm', 'blades', 'lightning']);
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
    if (sigOnly) { if (M.aoe) aoeMotif(ctx, M.aoe, p, tx, ty, r, c); return; }
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

  // Bắn hạt khi hiệu ứng bắt đầu
  function spawn(f) {
    const { sx, sy, tx, ty } = pos(f);
    if (SIG[f.t]) { f.dur = SIG[f.t].dur; SIG[f.t].spawn(f, { sx, sy, tx, ty }); return; }
    const c = f.color || '#fff', r = f.r || 140;
    const body = ty - 28;
    const travel = f.dur * 0.85;
    switch (f.t) {
      case 'slash': case 'slash2': case 'palm':
        emit(f.t === 'palm' ? 18 : 12, tx, body, { speed: 160, life: 380, size: 4, color: c, drag: 3 }); break;
      case 'bite': emit(6, tx, body, { speed: 90, life: 300, size: 3, color: '#ff5050' }); break;
      case 'dart': case 'bolt': case 'dartfan': case 'beam':
        emit(10, tx, body, { speed: 140, life: 350, size: 3.5, color: c, delay: travel, drag: 3 }); break;
      case 'dragon':
        emit(26, tx, body, { speed: 200, life: 500, size: 5, color: c, delay: travel, drag: 3 }); break;
      case 'lightning':
        emit(16, tx, body, { speed: 180, life: 350, size: 3, color: c, drag: 4 }); break;
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
    for (const f of G.fx) {
      const p = Math.max(0, (now - f.t0) / f.dur);
      const { sx, sy, tx, ty, src } = pos(f);
      const c = f.color || '#fff', r = f.r || 140;
      const bx = sx, by = sy - 28, ex = tx, ey = ty - 28;
      if (SIG[f.t]) { SIG[f.t].draw(ctx, f, p, { sx, sy, tx, ty, src }); if (!/dragon$/.test(f.t)) spriteLayer(ctx, f, p, { sx, sy, tx, ty, bx, by, ex, ey, src, r, c }, true); continue; }
      switch (f.t) {
        case 'slash': case 'slash2': case 'bite': {
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
            for (let k = 4; k >= 0; k--) glowDot(ctx, px - Math.cos(a) * k * 9, py - Math.sin(a) * k * 9, (f.t === 'bolt' ? 18 : 12) - k * 2, c, (q < 1 ? 1 : 0) * (1 - k * 0.18));
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
          glowPath(ctx, () => { ctx.moveTo(bx, by); ctx.lineTo(ex, ey); }, c, 10 * (1 - p) + 2, 1 - p * 0.7);
          glowDot(ctx, ex, ey, 40, c, 1 - p);
          break;
        }
        case 'lightning': {
          if (!f.zig || R() < 0.35) f.zig = zig(ex + 10, ey - 230, ex, ey, 9, 34);
          glowPath(ctx, () => f.zig.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)), c, 3, 1 - p);
          glowDot(ctx, ex, ey, 44, c, 1 - p);
          break;
        }
        case 'storm': {
          ground(ctx, ex, ty, r, c, (1 - p) * 0.5);
          f.bolts = f.bolts || Array.from({ length: 7 }, (_, i) => ({ x: ex + (R() - 0.5) * r, y: ty + (R() - 0.5) * r * 0.45, t: i / 9 }));
          for (const b of f.bolts) {
            const lp = (p - b.t) / 0.25;
            if (lp < 0 || lp > 1) continue;
            const z = zig(b.x + 8, b.y - 240, b.x, b.y - 8, 8, 30);
            glowPath(ctx, () => z.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)), c, 3, 1 - lp);
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
            glowPath(ctx, () => { ctx.moveTo(px, yy - 34); ctx.lineTo(px, yy); }, c, 4, lp < 1 ? 1 : 1 - (p - 0.5) * 2);
            if (lp >= 1) glowDot(ctx, px, gy, 26, c, 1 - p);
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
          glowPath(ctx, () => { ctx.moveTo(f.x, f.y - 28); ctx.lineTo(ex, ey); }, c, 12 * (1 - p) + 2, 1 - p);
          const a = Math.atan2(ey - (f.y - 28), ex - f.x);
          glowPath(ctx, () => ctx.arc(ex, ey, 34, a - 1.2, a - 1.2 + 2.4 * ease(p)), '#ffffff', 5, 1 - p);
          glowDot(ctx, ex, ey, 50, c, 1 - p);
          if (f.r) glowPath(ctx, () => ctx.ellipse(tx, ty, f.r * ease(p), f.r * ease(p) * 0.45, 0, 0, Math.PI * 2), c, 5, 1 - p);
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
      glowDot(ctx, q.x, q.y, q.size * 3, q.color, a);
    }
    ctx.restore();
  }

  window.FX = {
    init(fn) { entityById = fn; },
    spawn, draw, emit, glowDot, sprite: fxSprite,
    flash(now) { if (!flash) return null; const p = (now - flash.t0) / flash.dur; if (p > 1) { flash = null; return null; } return p < 0 ? null : { color: flash.color, a: 0.35 * (1 - p) }; }
  };
})();
