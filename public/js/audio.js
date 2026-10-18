// Âm thanh: hiệu ứng tổng hợp bằng WebAudio + nhạc nền võ lâm (ngũ cung, đàn tranh, sáo trúc, trống).
(function () {
  let ctx = null, master, sfxBus, musicBus, reverb, noiseBuf;
  const st = { music: true, sfx: true, musicVol: 0.5, sfxVol: 0.7 };
  try { Object.assign(st, JSON.parse(localStorage.getItem('vl_audio') || '{}')); } catch (e) { }
  const save = () => { try { localStorage.setItem('vl_audio', JSON.stringify(st)); } catch (e) { } };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    // vang (reverb) nhân tạo cho không khí sơn thủy
    reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    reverb.buffer = ir;
    const rvGain = ctx.createGain(); rvGain.gain.value = 0.35;
    reverb.connect(rvGain); rvGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    applyVol();
    return true;
  }
  function applyVol() {
    if (!ctx) return;
    sfxBus.gain.value = st.sfx ? st.sfxVol * 0.6 : 0;
    musicBus.gain.setTargetAtTime(st.music ? st.musicVol * 0.35 : 0, ctx.currentTime, 0.3);
  }

  // ---------- các khối âm cơ bản ----------
  function env(g, t, a, peak, d, end = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
  function osc(type, f0, f1, t, dur, vol, bus = sfxBus, wet = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(bus); if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(reverb); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, type = 'bandpass', f0 = 1500, f1 = 0, q = 1, bus = sfxBus, wet = 0) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, 0.004, vol, dur);
    s.connect(fl); fl.connect(g); g.connect(bus); if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(reverb); }
    s.start(t); s.stop(t + dur + 0.05);
  }

  // ---------- hiệu ứng âm thanh ----------
  const last = {};
  const SFX = {
    swing: t => { noise(t, 0.16, 0.5, 'bandpass', 900, 3500, 1.2); },
    hit: t => { noise(t, 0.08, 0.6, 'lowpass', 2500, 400); osc('square', 180, 60, t, 0.09, 0.25); },
    crit: t => { noise(t, 0.12, 0.8, 'lowpass', 4000, 300); osc('sawtooth', 300, 70, t, 0.18, 0.3); osc('sine', 1200, 1800, t, 0.12, 0.15, sfxBus, 0.3); },
    hurt: t => { osc('square', 220, 110, t, 0.12, 0.25); noise(t, 0.06, 0.3, 'lowpass', 1200); },
    whoosh: t => { noise(t, 0.3, 0.45, 'bandpass', 600, 2400, 2, sfxBus, 0.2); },
    magic: t => { [880, 1175, 1568].forEach((f, i) => osc('triangle', f, f * 1.02, t + i * 0.04, 0.35, 0.12, sfxBus, 0.5)); noise(t, 0.3, 0.2, 'highpass', 3000); },
    thunder: t => { noise(t, 0.08, 0.9, 'highpass', 2000); noise(t + 0.03, 0.9, 0.8, 'lowpass', 900, 80, 0.7, sfxBus, 0.5); osc('sawtooth', 70, 35, t, 0.6, 0.3); },
    boom: t => { osc('sine', 120, 30, t, 0.8, 0.8); noise(t, 0.7, 0.7, 'lowpass', 1500, 60, 0.7, sfxBus, 0.6); },
    roar: t => { osc('sawtooth', 110, 55, t, 1.0, 0.35, sfxBus, 0.5); osc('sawtooth', 165, 70, t + 0.05, 0.9, 0.2, sfxBus, 0.5); noise(t, 1.0, 0.5, 'bandpass', 400, 200, 1.5, sfxBus, 0.5); },
    fire: t => { noise(t, 0.9, 0.6, 'lowpass', 3000, 300, 0.8, sfxBus, 0.4); osc('sawtooth', 90, 45, t, 0.7, 0.25); },
    water: t => { for (let i = 0; i < 6; i++) osc('sine', 500 + Math.random() * 900, 200, t + i * 0.05, 0.15, 0.15, sfxBus, 0.4); noise(t, 0.8, 0.5, 'lowpass', 1200, 300, 0.6, sfxBus, 0.5); },
    ice: t => { [2093, 2637, 3136, 2349].forEach((f, i) => osc('triangle', f, f, t + i * 0.06, 0.4, 0.12, sfxBus, 0.6)); noise(t, 0.5, 0.3, 'highpass', 5000); },
    heal: t => { [523, 659, 784, 1047].forEach((f, i) => osc('sine', f, f, t + i * 0.07, 0.5, 0.15, sfxBus, 0.6)); },
    buff: t => { osc('triangle', 330, 660, t, 0.4, 0.2, sfxBus, 0.5); osc('sine', 495, 990, t + 0.05, 0.4, 0.12, sfxBus, 0.5); },
    level: t => { [523, 659, 784, 1047, 1319].forEach((f, i) => osc('triangle', f, f, t + i * 0.09, 0.6, 0.22, sfxBus, 0.6)); },
    coin: t => { osc('square', 1318, 1318, t, 0.06, 0.12); osc('square', 1760, 1760, t + 0.06, 0.12, 0.12); },
    pick: t => { osc('triangle', 700, 1100, t, 0.1, 0.2); },
    rare: t => { [784, 988, 1175, 1568].forEach((f, i) => osc('triangle', f, f, t + i * 0.07, 0.7, 0.2, sfxBus, 0.7)); },
    click: t => { osc('square', 900, 700, t, 0.03, 0.08); },
    portal: t => { osc('sine', 300, 900, t, 0.5, 0.2, sfxBus, 0.6); noise(t, 0.5, 0.2, 'bandpass', 800, 3000, 3, sfxBus, 0.4); },
    die: t => { osc('sawtooth', 300, 50, t, 1.0, 0.3, sfxBus, 0.5); },
    enhOk: t => { SFX.hit(t); [784, 1047, 1319, 1568, 2093].forEach((f, i) => osc('triangle', f, f, t + 0.1 + i * 0.07, 0.6, 0.2, sfxBus, 0.7)); },
    enhFail: t => { SFX.hit(t); osc('sawtooth', 220, 80, t + 0.1, 0.5, 0.25); },
    mount: t => { [0, 0.12, 0.24].forEach(d => noise(t + d, 0.05, 0.5, 'lowpass', 800)); osc('sawtooth', 600, 300, t + 0.3, 0.4, 0.12, sfxBus, 0.4); },
    bossHorn: t => { osc('sawtooth', 146, 146, t, 1.6, 0.25, sfxBus, 0.6); osc('sawtooth', 220, 220, t, 1.6, 0.15, sfxBus, 0.6); }
  };
  function sfx(name, minGap = 40) {
    if (!st.sfx || !init() || !SFX[name]) return;
    const now = performance.now();
    if (last[name] && now - last[name] < minGap) return;
    last[name] = now;
    try { SFX[name](ctx.currentTime + 0.005); } catch (e) { }
  }

  // ---------- nhạc nền võ lâm (tạo theo thời gian thực) ----------
  // Ngũ cung Rê (D E F# A B) – âm hưởng cổ phong
  const SCALE = [0, 2, 4, 7, 9];
  const ROOT = 146.83; // D3
  const MOODS = {
    town:  { bpm: 72,  drums: 0,   flute: 0.6, pluckDensity: 0.55, drone: 0.12, base: 1 },
    field: { bpm: 96,  drums: 0.8, flute: 0.4, pluckDensity: 0.75, drone: 0.1, base: 1 },
    boss:  { bpm: 120, drums: 1,   flute: 0.2, pluckDensity: 0.85, drone: 0.16, base: 0.94 }
  };
  let mood = null, timer = null, nextT = 0, step = 0, melodyPos = 7, droneNodes = null;
  const freq = (deg, oct = 0) => { const n = Math.floor(deg / 5), d = ((deg % 5) + 5) % 5; return ROOT * Math.pow(2, (SCALE[d] + 12 * (n + oct)) / 12); };
  function pluck(f, t, vol, dur = 1.6) { // đàn tranh
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'sine';
    o.frequency.setValueAtTime(f * 1.01, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    o2.frequency.value = f * 2;
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 8, t); fl.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.3;
    o.connect(fl); o2.connect(g2); g2.connect(fl); fl.connect(g); g.connect(musicBus);
    const w = ctx.createGain(); w.gain.value = 0.5; g.connect(w); w.connect(reverb);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  function flute(f, t, dur, vol) { // sáo trúc
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = 'sine'; o.frequency.value = f;
    lfo.frequency.value = 5.2; lg.gain.value = f * 0.012; lfo.connect(lg); lg.connect(o.frequency);
    fl.type = 'lowpass'; fl.frequency.value = f * 4;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.18); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(musicBus);
    const w = ctx.createGain(); w.gain.value = 0.7; g.connect(w); w.connect(reverb);
    const br = ctx.createBufferSource(); br.buffer = noiseBuf; br.loop = true;
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = f * 2; bf.Q.value = 4;
    const bg = ctx.createGain(); bg.gain.setValueAtTime(0.0001, t); bg.gain.linearRampToValueAtTime(vol * 0.12, t + 0.1); bg.gain.linearRampToValueAtTime(0.0001, t + dur);
    br.connect(bf); bf.connect(bg); bg.connect(musicBus);
    [o, lfo, br].forEach(n => { n.start(t); n.stop(t + dur + 0.1); });
  }
  function drum(t, low, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(low ? 110 : 190, t); o.frequency.exponentialRampToValueAtTime(low ? 45 : 90, t + 0.25);
    env(g, t, 0.004, vol, low ? 0.4 : 0.18);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.5);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low ? 400 : 1800;
    const g2 = ctx.createGain(); env(g2, t, 0.002, vol * 0.4, 0.08); s.connect(f); f.connect(g2); g2.connect(musicBus); s.start(t); s.stop(t + 0.15);
  }
  function startDrone(m) {
    stopDrone();
    const t = ctx.currentTime, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(m.drone, t + 3);
    const nodes = [ROOT / 2 * m.base, ROOT * 0.75 * m.base].map((f, i) => { const o = ctx.createOscillator(); o.type = i ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = i ? 4 : 0; o.connect(g); o.start(t); return o; });
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 500;
    g.connect(fl); fl.connect(musicBus);
    droneNodes = { g, nodes };
  }
  function stopDrone() {
    if (!droneNodes) return;
    const t = ctx.currentTime;
    droneNodes.g.gain.setTargetAtTime(0.0001, t, 0.5);
    droneNodes.nodes.forEach(o => o.stop(t + 2));
    droneNodes = null;
  }
  function schedule() {
    const m = MOODS[mood];
    if (!m) return;
    const beat = 60 / m.bpm / 2; // nốt móc đơn
    while (nextT < ctx.currentTime + 0.4) {
      const t = nextT, bar = Math.floor(step / 8), pos = step % 8;
      // giai điệu đàn tranh: đi bước nhỏ trên thang ngũ cung, câu 4 ô nhịp
      if (Math.random() < m.pluckDensity || pos === 0) {
        melodyPos += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
        if (melodyPos < 3) melodyPos = 5; if (melodyPos > 13) melodyPos = 10;
        if (bar % 4 === 3 && pos >= 6) melodyPos = 5; // về chủ âm cuối câu
        pluck(freq(melodyPos) * m.base, t, pos === 0 ? 0.32 : 0.22, pos % 2 ? 1.0 : 1.6);
        if (pos === 0 || (pos === 4 && Math.random() < 0.5)) pluck(freq(melodyPos - 5) * m.base, t, 0.14, 2.2);
      }
      // sáo trúc ngân dài đầu mỗi 2 ô nhịp
      if (pos === 0 && bar % 2 === 0 && Math.random() < m.flute) flute(freq(melodyPos + 5) * m.base, t + beat, beat * 7, 0.09);
      // trống trận
      if (m.drums) {
        if (pos === 0 || pos === 4) drum(t, true, 0.35 * m.drums);
        if ((pos === 2 || pos === 6) && Math.random() < 0.6) drum(t, false, 0.18 * m.drums);
        if (mood === 'boss' && pos % 2 === 1 && Math.random() < 0.4) drum(t, false, 0.12);
      }
      nextT += beat; step++;
    }
  }
  function music(newMood) {
    if (newMood === mood) return;
    mood = newMood;
    if (!init()) return;
    if (timer) clearInterval(timer);
    if (!mood) { stopDrone(); return; }
    nextT = ctx.currentTime + 0.2; step = 0;
    startDrone(MOODS[mood]);
    timer = setInterval(schedule, 100);
  }

  // âm nền thời tiết: tiếng mưa / gió liên tục
  let amb = null;
  const AMB = { rain: [0.16, 'lowpass', 2600, 0], storm: [0.28, 'lowpass', 1800, 0], wind: [0.14, 'bandpass', 500, 1], blizzard: [0.2, 'bandpass', 700, 1], snow: [0.04, 'bandpass', 400, 1] };
  function ambience(kind) {
    if (!init()) return;
    const cfg = AMB[kind], t = ctx.currentTime;
    if (amb && amb.kind === kind) return;
    if (amb) { const a = amb; a.g.gain.setTargetAtTime(0.0001, t, 0.6); setTimeout(() => { try { a.s.stop(); a.lfo && a.lfo.stop(); } catch (e) { } }, 3000); amb = null; }
    if (!cfg) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = cfg[1]; fl.frequency.value = cfg[2]; fl.Q.value = cfg[3] ? 0.8 : 0.5;
    const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(cfg[0], t, 1.2);
    let lfo = null;
    if (cfg[3]) {   // gió: tần số dao động như từng cơn
      lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
      const lg = ctx.createGain(); lg.gain.value = cfg[2] * 0.6; lfo.connect(lg); lg.connect(fl.frequency); lfo.start();
    }
    s.connect(fl); fl.connect(g); g.connect(sfxBus); s.start();
    amb = { kind, s, g, lfo };
  }

  window.GameAudio = {
    init, sfx, music, ambience, get state() { return st; },
    set(k, v) { st[k] = v; save(); applyVol(); if (k === 'music' && v && mood) { const m = mood; mood = null; music(m); } },
    get mood() { return mood; }
  };
})();
