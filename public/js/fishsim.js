// Minigame kéo cá – mô phỏng tất định dùng chung cho máy khách (chơi thời gian thực) và máy chủ (chạy lại để kiểm tra).
// Thanh dọc 0..1: vùng xanh (con cá) chạy lên xuống theo mẫu sinh từ seed; vạch của người chơi: giữ nút thì kéo lên,
// nhả thì chìm xuống. Vạch nằm trong vùng xanh thì thanh tiến độ tăng, ra ngoài thì giảm. Đầy = câu được, cạn = cá sổng.
// inputs: thời điểm (ms tính từ lúc bắt đầu) đổi trạng thái giữ / nhả, phần tử đầu là lúc bắt đầu giữ.
(function (root) {
  const DT = 1 / 60, MAX_T = 20;
  const PHY = { up: 6, down: 5, damp: 0.88, zs: 0.32 };   // lực kéo khi giữ, lực chìm khi nhả, độ hãm, biên độ cá
  // độ khó theo nhóm cá: c thường, r hiếm, e quý, l huyền thoại (rác / rương báu như cá thường)
  const DIFF = {
    c: { w: 0.32, spd: 0.70, gain: 0.34, loss: 0.18 },
    r: { w: 0.27, spd: 0.95, gain: 0.31, loss: 0.21 },
    e: { w: 0.23, spd: 1.20, gain: 0.29, loss: 0.23 },
    l: { w: 0.20, spd: 1.45, gain: 0.27, loss: 0.25 }
  };
  function rng(seed) {   // mulberry32
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // mod: { rod: sức cần − sức cá (âm = cần yếu hơn cá), grip: độ ngậm mồi } – cần yếu kéo cá khoẻ: vùng cá hẹp, cá vọt nhanh, tụt thanh nhanh
  function adjust(base, mod) {
    if (!mod) return base;
    const k = Math.max(-4, Math.min(3, mod.rod || 0)), gp = mod.grip || 0;
    return {
      w: Math.max(0.09, Math.min(0.42, base.w * (k < 0 ? 1 + k * 0.14 : 1 + k * 0.08))),
      spd: base.spd * (k < 0 ? 1 - k * 0.13 : 1 - k * 0.05),
      gain: base.gain * (1 + gp) * (k < 0 ? 1 + k * 0.08 : 1 + k * 0.04),
      loss: base.loss * (k < 0 ? 1 - k * 0.22 : 1 - k * 0.07)
    };
  }
  function make(seed, g, mod) {
    const d = adjust(DIFF[g] || DIFF.c, mod), r = rng(seed);
    // 3 sóng sin + các cú "vọt" ngẫu nhiên: cá lúc lững lờ, lúc giật mạnh
    const waves = [0, 1, 2].map(i => ({ f: (0.6 + r() * 0.9) * d.spd * (i + 1) * 0.8, p: r() * 6.283, a: [0.55, 0.3, 0.15][i] }));
    const darts = []; let t = 0.8 + r();
    while (t < MAX_T) { darts.push({ t, d: (r() - 0.5) * 0.9 * d.spd, len: 0.25 + r() * 0.35 }); t += (1.6 + r() * 1.6) / d.spd; }
    return { d, waves, darts };
  }
  function zoneAt(S, t) {
    let z = 0;
    for (const w of S.waves) z += Math.sin(t * w.f + w.p) * w.a;
    let off = 0;
    for (const k of S.darts) { if (t < k.t) break; const u = Math.min(1, (t - k.t) / k.len); off += k.d * (u < 1 ? Math.sin(u * Math.PI / 2) : 1); off *= 0.6; }
    const half = S.d.w / 2;
    return Math.max(half, Math.min(1 - half, 0.5 + z * PHY.zs + off));
  }
  // một bước mô phỏng (dùng cho cả chạy thật lẫn chạy lại)
  const GRACE = 1.5;   // 1,5 giây đầu không bị tụt tiến độ (kịp kéo vạch tới chỗ cá)
  function init(seed, g, mod) { return { S: make(seed, g, mod), t: 0, m: 0.3, v: 0, prog: 0.35, done: 0 }; }
  function step(st, hold) {
    if (st.done) return st;
    st.v += (hold ? PHY.up : -PHY.down) * DT; st.v *= PHY.damp;
    st.m += st.v * DT;
    if (st.m < 0) { st.m = 0; st.v = Math.max(0, st.v) * 0.3; }
    if (st.m > 1) { st.m = 1; st.v = Math.min(0, st.v) * 0.3; }
    st.t += DT;
    const z = zoneAt(st.S, st.t), inZ = Math.abs(st.m - z) < st.S.d.w / 2;
    st.z = z; st.inZ = inZ;
    st.prog += (inZ ? st.S.d.gain : st.t < GRACE ? 0 : -st.S.d.loss) * DT;
    if (st.prog >= 1) { st.prog = 1; st.done = 1; }       // câu được
    else if (st.prog <= 0 || st.t >= MAX_T) { st.prog = Math.max(0, st.prog); st.done = -1; }   // sổng
    return st;
  }
  // chạy lại từ danh sách thời điểm đổi giữ / nhả -> { ok, t, steps }
  function replay(seed, g, inputs, mod) {
    const st = init(seed, g, mod); let i = 0, hold = false, n = 0;
    while (!st.done && n < MAX_T / DT + 5) {
      const ms = (n + 1) * DT * 1000;
      while (i < inputs.length && inputs[i] <= ms) { hold = !hold; i++; }
      step(st, hold); n++;
    }
    return { ok: st.done === 1, t: st.t, steps: n };
  }
  const api = { DT, MAX_T, DIFF, PHY, init, step, replay, zoneAt, adjust };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FishSim = api;
})(typeof window !== 'undefined' ? window : this);
