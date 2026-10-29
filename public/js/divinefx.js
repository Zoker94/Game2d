// Hiệu ứng mặc Thần Binh (đồ đỏ): vòng ánh sáng tím cuộn tròn dưới chân, các dải sáng xoắn ốc cuộn từ chân lên người.
// n = số món Thần Binh đang mặc (1-5): càng nhiều món càng nhiều dải xoắn, vòng càng sáng. Phần sau lưng vẽ trước nhân vật, phần trước vẽ sau.
(function () {
  const H = 64, RX = 24, RY = 8;
  function ring(ctx, x, y, t, n) {
    const a0 = t / 900, k = 0.55 + 0.45 * Math.sin(t / 420), str = 0.55 + n * 0.09;
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 2, x, y, RX + 12);   // quầng tím loang dưới chân
    g.addColorStop(0, `rgba(150,50,255,${0.38 * str})`); g.addColorStop(0.65, `rgba(120,30,230,${0.22 * str})`); g.addColorStop(1, 'rgba(90,20,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, RX + 12, RY + 5, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 3; i++) {   // vòng ngoài: ba cung tím xoay (nét rộng mờ + lõi sáng)
      const s = a0 + i * Math.PI * 2 / 3;
      ctx.lineWidth = 4; ctx.strokeStyle = `rgba(140,40,255,${0.45 * str})`; ctx.beginPath(); ctx.ellipse(x, y, RX, RY, 0, s, s + 1.5); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(230,180,255,${(0.6 + 0.4 * k) * str})`; ctx.beginPath(); ctx.ellipse(x, y, RX, RY, 0, s + 0.1, s + 1.4); ctx.stroke();
    }
    ctx.lineWidth = 1; ctx.strokeStyle = `rgba(190,120,255,${0.75 * str})`; ctx.setLineDash([3, 4]); ctx.lineDashOffset = t / 30;   // vòng trong xoay ngược
    ctx.beginPath(); ctx.ellipse(x, y, RX * 0.62, RY * 0.62, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 6; i++) {   // sáu ấn chú sáng trên vòng
      const a = -a0 * 1.3 + i * Math.PI / 3, px = x + Math.cos(a) * RX * 0.82, py = y + Math.sin(a) * RY * 0.82;
      ctx.fillStyle = `rgba(150,60,255,${0.7 * str})`; ctx.fillRect(Math.round(px) - 2, Math.round(py) - 1, 4, 3);
      ctx.fillStyle = `rgba(250,230,255,${0.95 * str})`; ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
    }
    ctx.restore();
  }
  // các dải xoắn: dải sáng tím liền mạch cuộn từ chân lên người theo hình xoắn ốc, thu hẹp dần khi lên cao
  function strands(ctx, x, y, t, n, front) {
    const N = n >= 5 ? 3 : n >= 3 ? 2 : 1, SEG = 34, LEN = 0.55;
    ctx.save(); ctx.lineCap = 'round';
    for (let s = 0; s < N; s++) {
      const off = s * Math.PI * 2 / N, head = (t / 2400 + s / N) % 1;   // đầu dải chạy từ chân lên đỉnh rồi lặp lại
      let prev = null;
      for (let i = 0; i <= SEG; i++) {
        const f = head - (i / SEG) * LEN;   // dọc theo thân dải, từ đầu về đuôi
        if (f < 0) break;
        const h = f * H, a = off + f * Math.PI * 3.6 + t / 1600, r = 1 - f * 0.4;
        const pt = [x + Math.cos(a) * RX * r, y - h + Math.sin(a) * RY * r, Math.sin(a) > 0];
        if (prev && prev[2] === front && pt[2] === front) {
          const fade = (1 - i / SEG) * Math.sin(Math.min(1, f * 1.15) * Math.PI);
          ctx.lineWidth = 4; ctx.strokeStyle = `rgba(140,40,255,${0.35 * fade})`; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(pt[0], pt[1]); ctx.stroke();
          ctx.lineWidth = 1.6; ctx.strokeStyle = `rgba(235,200,255,${0.95 * fade})`; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(pt[0], pt[1]); ctx.stroke();
        }
        prev = pt;
      }
    }
    ctx.restore();
  }
  // tia sáng nhỏ bắn lên từ vòng (đủ bộ 5 món)
  function sparks(ctx, x, y, t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const life = (t / 1300 + i / 6) % 1, a = i * 1.7 + Math.floor(t / 1300 + i / 6) * 2.3;
      ctx.fillStyle = `rgba(230,180,255,${1 - life})`;
      ctx.fillRect(Math.round(x + Math.cos(a) * RX * 0.9), Math.round(y + Math.sin(a) * RY * 0.9 - life * 46), 1, 3);
    }
    ctx.restore();
  }
  window.DivineFX = {
    under(ctx, x, y, t, n) { if (!n) return; ring(ctx, x, y + 2, t, n); strands(ctx, x, y, t, n, false); },
    over(ctx, x, y, t, n) { if (!n) return; strands(ctx, x, y, t, n, true); if (n >= 5) sparks(ctx, x, y, t); },
    count(equip, items) { let n = 0; for (const k in equip || {}) { const e = equip[k], it = e && items[e.id]; if (it && it.rarity === 'divine') n++; } return n; }
  };
})();
