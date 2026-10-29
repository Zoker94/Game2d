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
  // đủ bộ 5 món: mỗi 5 giây một vụ nổ vàng dưới chân – chớp sáng, sóng xung kích lan rộng, đất nứt toả ra, đá văng
  const PERIOD = 5000, LIFE = 1500, REACH = 210;
  const rnd = s => { s = Math.sin(s * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  function blastPhase(t, seed) { const p = (t + seed * 1733) % PERIOD; return { f: p / LIFE, k: Math.floor((t + seed * 1733) / PERIOD) }; }
  function blastUnder(ctx, x, y, t, seed) {
    const { f, k } = blastPhase(t, seed);
    if (f >= 1) return;
    const e = 1 - Math.pow(1 - f, 3);   // nhanh rồi chậm
    ctx.save();
    // vết nứt: 9 đường gấp khúc toả ra, viền tối, lõi sáng như dung nham, mờ dần
    const al = f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85;
    for (let i = 0; i < 9; i++) {
      const a0 = (i / 9) * Math.PI * 2 + rnd(k * 9 + i) * 0.5, len = (90 + rnd(k * 13 + i) * 70) * Math.min(1, f * 4);
      ctx.beginPath(); ctx.moveTo(x, y);
      let px = x, py = y;
      for (let j = 1; j <= 5; j++) {
        const a = a0 + (rnd(k * 31 + i * 7 + j) - 0.5) * 0.7, d = len * j / 5;
        px = x + Math.cos(a) * d; py = y + Math.sin(a) * d * 0.42; ctx.lineTo(px, py);
        if (j === 3 && rnd(k + i * 3) > 0.45) { ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a + 0.9) * 22, py + Math.sin(a + 0.9) * 9); ctx.moveTo(px, py); }
      }
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(40,22,8,${0.85 * al})`; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = `rgba(255,${150 + Math.round(60 * (1 - f))},40,${0.9 * al})`; ctx.lineWidth = 1.4; ctx.stroke();
    }
    // quầng vàng loé sáng dưới chân
    ctx.globalCompositeOperation = 'lighter';
    if (f < 0.5) {
      const r = 40 + e * 80, g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, `rgba(255,250,200,${0.9 * (1 - f * 2)})`); g.addColorStop(0.4, `rgba(255,200,60,${0.6 * (1 - f * 2)})`); g.addColorStop(1, 'rgba(255,140,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    }
    // hai vòng sóng xung kích lan rộng
    for (const [lag, w] of [[0, 5], [0.12, 2.5]]) {
      const ff = Math.max(0, f - lag) / (1 - lag); if (ff <= 0) continue;
      const ee = 1 - Math.pow(1 - ff, 3), r = 20 + ee * REACH;
      ctx.strokeStyle = `rgba(255,${210 - Math.round(ff * 60)},80,${(1 - ff) * 0.9})`; ctx.lineWidth = w * (1 - ff) + 1;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // bụi đất cuộn theo sóng
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, r = 30 + e * REACH * 0.85;
      ctx.fillStyle = `rgba(150,120,80,${0.35 * (1 - f)})`;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.42, 4 + e * 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function blastOver(ctx, x, y, t, seed) {
    const { f, k } = blastPhase(t, seed);
    if (f >= 1) return;
    ctx.save();
    if (f < 0.25) {   // cột sáng vàng phụt lên
      const a = 1 - f / 0.25; ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, y - 120, 0, y); g.addColorStop(0, 'rgba(255,220,100,0)'); g.addColorStop(1, `rgba(255,240,170,${0.75 * a})`);
      ctx.fillStyle = g; ctx.fillRect(x - 16 - f * 30, y - 120, 32 + f * 60, 120);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (let i = 0; i < 14; i++) {   // đá văng theo đường parabol
      const a = rnd(k * 17 + i) * Math.PI * 2, sp = 60 + rnd(k * 5 + i) * 120, h = 40 + rnd(k * 3 + i) * 60;
      const px = x + Math.cos(a) * sp * f, py = y + Math.sin(a) * sp * f * 0.42 - (h * 4 * f * (1 - f));
      ctx.fillStyle = i % 3 ? '#6a5236' : '#ffc040';
      const sz = i % 3 ? 3 : 2; ctx.globalAlpha = 1 - f;
      ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, sz, sz);
    }
    ctx.restore();
  }
  let lastSelfBlast = -1;
  window.DivineFX = {
    blastUnder, blastOver,
    // gọi mỗi khung cho chính mình: rung nhẹ màn hình đúng lúc nổ
    selfShake(t, seed) { const { f, k } = blastPhase(t, seed); if (f < 0.05 && k !== lastSelfBlast) { lastSelfBlast = k; if (G.rumble) G.rumble(5, 320); } },
    under(ctx, x, y, t, dv, seed) { if (!dv) return; const n = dv % 10; if (dv >= 10) blastUnder(ctx, x, y + 2, t, seed || 0); ring(ctx, x, y + 2, t, n); strands(ctx, x, y, t, n, false); },
    over(ctx, x, y, t, dv, seed) { if (!dv) return; const n = dv % 10; strands(ctx, x, y, t, n, true); if (n >= 5) sparks(ctx, x, y, t); if (dv >= 10) blastOver(ctx, x, y, t, seed || 0); },
    // số món Thần Binh đang mặc, +10 nếu đủ 5 món cùng một bộ (trùng server/game/world.js divineCount)
    count(equip, items) { let n = 0; const sets = {}; for (const k in equip || {}) { const e = equip[k], it = e && items[e.id]; if (it && it.rarity === 'divine') { n++; sets[it.set] = (sets[it.set] || 0) + 1; } } return n + (Object.values(sets).some(v => v >= 5) ? 10 : 0); }
  };
})();
