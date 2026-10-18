// Hào quang khi đang có buff chủ động: mỗi loại một hiệu ứng riêng quanh người.
// list: [[kiểu, màu], ...]; layer 'under' vẽ dưới nhân vật (vòng sáng mặt đất, chuông, phía sau),
// 'over' vẽ đè lên (hạt bay, tia sét, cánh hoa phía trước).
(function () {
  const TAU = Math.PI * 2;
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  // hạt cố định theo thời gian (không cần lưu trạng thái)
  function rise(ctx, x, y, now, col, n, h, spd, size, seed) {
    for (let i = 0; i < n; i++) {
      const t = ((now / spd + i / n + seed) % 1);
      const px = x + Math.sin(i * 2.4 + seed * 7) * 16 + Math.sin(now / 300 + i) * 2;
      ctx.fillStyle = rgba(col, (1 - t) * 0.9);
      ctx.beginPath(); ctx.arc(px, y - t * h, size * (1 - t * 0.5), 0, TAU); ctx.fill();
    }
  }
  function ground(ctx, x, y, col, now, r) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.36);
    const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
    g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.75, rgba(col, 0.35)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.rotate(now / 900);
    ctx.strokeStyle = rgba(col, 0.75); ctx.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(0, 0, r * 0.82, i * TAU / 6, i * TAU / 6 + 0.55); ctx.stroke(); }
    ctx.restore();
  }
  function draw(ctx, x, y, list, now, layer, lift) {
    if (!list || !list.length) return;
    const by = y - (lift || 0);            // chân nhân vật (khi cưỡi thú thì nâng lên)
    const cy = by - 36;                    // ngực
    ctx.save();
    for (const [kind, col0] of list) {
      const col = col0 || '#ffd76a';
      if (layer === 'under') {
        ground(ctx, x, y, col, now, kind === 'taiji' || kind === 'lotus' ? 34 : 28);
        if (kind === 'bell') {   // chuông vàng hộ thể
          const a = 0.22 + Math.sin(now / 260) * 0.06;
          ctx.fillStyle = rgba(col, a); ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - 26, by + 2); ctx.quadraticCurveTo(x - 26, by - 52, x - 10, by - 66); ctx.quadraticCurveTo(x, by - 74, x + 10, by - 66);
          ctx.quadraticCurveTo(x + 26, by - 52, x + 26, by + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = rgba('#ffffff', 0.35); ctx.beginPath(); ctx.moveTo(x - 16, by - 50); ctx.quadraticCurveTo(x - 18, by - 30, x - 18, by - 8); ctx.stroke();
          for (const yy of [-20, -44]) { ctx.strokeStyle = rgba(col, 0.55); ctx.beginPath(); ctx.ellipse(x, by + yy, 24 - (yy < -30 ? 5 : 0), 4, 0, 0, TAU); ctx.stroke(); }
        } else if (kind === 'taiji') {
          if (window.FX && FX.sprite) FX.sprite(ctx, 'taiji', 0, x, y - 2, { frame: Math.floor(now / 90), color: col, scale: 0.9, alpha: 0.55, flat: 0.4 });
        } else if (kind === 'lotus') {   // đài sen dưới chân
          ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.4); ctx.rotate(now / 1600);
          for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.fillStyle = rgba(i % 2 ? col : '#ffe0f0', 0.55); ctx.beginPath(); ctx.ellipse(18, 0, 13, 6, 0, 0, TAU); ctx.fill(); }
          ctx.restore();
        } else if (kind === 'dragon' || kind === 'ice' || kind === 'shadow') {
          drawOrbit(ctx, x, cy, kind, col, now, true);
        }
      } else {
        if (kind === 'ring') rise(ctx, x, by - 4, now, col, 8, 60, 1100, 2.2, 0.1);
        else if (kind === 'flame') {   // lửa giận bốc quanh người
          for (let i = 0; i < 9; i++) {
            const a = i / 9 * TAU + now / 700, rx = Math.cos(a) * 18, front = Math.sin(a) > 0;
            if (!front) continue;
            const h = 22 + Math.sin(now / 90 + i * 1.7) * 8;
            const fx = x + rx, fy = by + Math.sin(a) * 5;
            const g = ctx.createLinearGradient(fx, fy, fx, fy - h);
            g.addColorStop(0, rgba('#ffe060', 0.85)); g.addColorStop(0.4, rgba(col, 0.7)); g.addColorStop(1, rgba(col, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(fx - 5, fy); ctx.quadraticCurveTo(fx - 4, fy - h * 0.6, fx + Math.sin(now / 120 + i) * 3, fy - h); ctx.quadraticCurveTo(fx + 5, fy - h * 0.5, fx + 5, fy); ctx.fill();
          }
          rise(ctx, x, by - 10, now, '#ffb040', 6, 60, 700, 1.8, 0.4);
        } else if (kind === 'poison') {
          for (let i = 0; i < 7; i++) {
            const t = ((now / 1300 + i / 7) % 1), px = x + Math.sin(i * 3.1) * 18, py = by - 6 - t * 58, r = 2 + t * 3;
            ctx.strokeStyle = rgba(col, 0.9 * (1 - t)); ctx.fillStyle = rgba(col, 0.25 * (1 - t)); ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill(); ctx.stroke();
          }
          ctx.fillStyle = rgba(col, 0.18); ctx.beginPath(); ctx.ellipse(x, by - 30, 22, 34, 0, 0, TAU); ctx.fill();
        } else if (kind === 'lotus') {
          for (let i = 0; i < 5; i++) {   // cánh hoa bay lên
            const t = ((now / 1800 + i / 5) % 1), a = i * 1.3 + now / 900;
            ctx.save(); ctx.translate(x + Math.cos(a) * 20, by - 4 - t * 60); ctx.rotate(a);
            ctx.fillStyle = rgba(col, 0.85 * (1 - t)); ctx.beginPath(); ctx.ellipse(0, 0, 4, 2, 0, 0, TAU); ctx.fill(); ctx.restore();
          }
        } else if (kind === 'thunder') {   // tia sét chập chờn quanh người
          const seed = Math.floor(now / 80);
          ctx.strokeStyle = rgba('#ffffff', 0.9); ctx.lineWidth = 1.5;
          for (let k = 0; k < 2; k++) {
            const r = (n) => { const v = Math.sin(seed * 12.9898 + n * 78.233 + k * 31.7) * 43758.5453; return v - Math.floor(v); };
            if (r(0) < 0.35) continue;
            const a = r(1) * TAU, sx = x + Math.cos(a) * 20, sy = cy + Math.sin(a) * 26;
            ctx.beginPath(); ctx.moveTo(sx, sy);
            let px = sx, py = sy;
            for (let j = 1; j < 5; j++) { px += (r(j + 2) - 0.5) * 12; py += 6 + r(j + 9) * 4; ctx.lineTo(px, py); }
            ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
          }
          rise(ctx, x, by - 4, now, col, 6, 64, 900, 1.8, 0.7);
        } else if (kind === 'dragon' || kind === 'ice' || kind === 'shadow') {
          drawOrbit(ctx, x, cy, kind, col, now, false);
        } else if (kind === 'bell') {
          rise(ctx, x, by - 4, now, '#fff0a0', 5, 70, 1400, 1.6, 0.2);
        } else if (kind === 'taiji') {
          rise(ctx, x, by - 4, now, col, 7, 70, 1200, 2, 0.5);
        }
      }
    }
    ctx.restore();
  }
  // vật thể bay vòng quanh người: nửa sau vẽ dưới nhân vật, nửa trước vẽ đè lên
  function drawOrbit(ctx, x, cy, kind, col, now, back) {
    const n = kind === 'dragon' ? 14 : 6;
    for (let i = 0; i < n; i++) {
      const a = now / (kind === 'dragon' ? 520 : 800) + i * (kind === 'dragon' ? 0.32 : TAU / n);
      const z = Math.sin(a);
      if ((z < 0) !== back) continue;
      const px = x + Math.cos(a) * 24, py = cy + z * 8 + (kind === 'dragon' ? Math.sin(a * 2) * 10 - i * 1.2 : Math.sin(now / 400 + i) * 4);
      if (kind === 'ice') {
        ctx.save(); ctx.translate(px, py); ctx.rotate(a);
        ctx.fillStyle = rgba('#e8faff', 0.9); ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(2.5, 0); ctx.lineTo(0, 6); ctx.lineTo(-2.5, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      } else if (kind === 'shadow') {
        ctx.fillStyle = rgba(col, 0.35); ctx.beginPath(); ctx.ellipse(px, py, 7, 3.5, a, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba('#0a1a10', 0.35); ctx.beginPath(); ctx.ellipse(px - Math.cos(a) * 5, py, 5, 2.5, a, 0, TAU); ctx.fill();
      } else {   // rồng vàng: chuỗi vảy cuộn quanh người, đầu rồng to hơn
        const r = i === n - 1 ? 4.5 : 3.2 - i * 0.12;
        ctx.fillStyle = rgba(i === n - 1 ? '#fff4b0' : col, 0.85); ctx.beginPath(); ctx.arc(px, py, Math.max(1.2, r), 0, TAU); ctx.fill();
      }
    }
  }
  window.Auras = { draw };
})();
