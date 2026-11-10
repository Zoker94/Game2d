// Giao diện "Neon Huyền Cơ": 2 bình tròn Máu / Nội lực (chất lỏng gợn sóng, vòng đo % phát sáng) ở hai bên phía dưới
// + khoác lại màu neon cho khung nhân vật, bản đồ nhỏ, nút chiêu, cần điều khiển, thanh kinh nghiệm.
// Mặc định bật ở mọi server (vl_hud = 'neon'); 'neonpx' = bản pixel (không dùng); 'classic' = giao diện cũ.
(function () {
  'use strict';
  let pref = null; try { pref = localStorage.getItem('vl_hud'); } catch (e) { }
  const mode = pref === 'neon' || pref === 'neonpx' ? pref : pref !== 'classic' ? 'neon' : null;   // mọi server (Tương Dương, Tô Châu) dùng giao diện Neon
  const on = !!mode, PX = mode === 'neonpx';
  const HudNeon = window.HudNeon = { on, px: PX, set() { } };
  if (!on) return;

  const COL = { hp: ['#ff8ac8', '#ff2e7a', '#5a0030'], mp: ['#a8faff', '#19c3ff', '#04306a'] };
  const C = 2 * Math.PI * 53;
  function svg(kind) {
    const c = COL[kind], id = 'nx' + kind;
    return `<svg viewBox="0 0 120 120" aria-hidden="true"><defs>
      <linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".45" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient>
      <radialGradient id="${id}g" cx=".35" cy=".28" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".35" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <clipPath id="${id}c"><circle cx="60" cy="60" r="44"/></clipPath>
      <filter id="${id}f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <circle cx="60" cy="60" r="48" fill="rgba(8,12,36,.88)"/>
      <g clip-path="url(#${id}c)"><path class="w2" fill="${c[0]}" opacity=".5"/><path class="w1" fill="url(#${id}l)"/>
        <g class="bub" fill="#fff" opacity=".55"><circle r="1.6"/><circle r="1.1"/><circle r="2"/><circle r="1.3"/></g></g>
      <circle cx="60" cy="60" r="44" fill="url(#${id}g)"/><ellipse cx="44" cy="40" rx="12" ry="7" fill="#fff" opacity=".45" transform="rotate(-35 44 40)"/>
      <circle cx="60" cy="60" r="45.5" fill="none" stroke="${c[1]}" stroke-width="1.2"/>
      <circle cx="60" cy="60" r="53" fill="none" stroke="${c[1]}" stroke-opacity=".2" stroke-width="5"/>
      <circle class="gauge" cx="60" cy="60" r="53" fill="none" stroke="${c[0]}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" transform="rotate(-90 60 60)" filter="url(#${id}f)"/>
      <g class="spin"><circle cx="60" cy="60" r="58.5" fill="none" stroke="${c[0]}" stroke-width="1.2" stroke-dasharray="6 10" opacity=".8"/></g></svg>
      <div class="nx-val"><b></b><small></small><em>${kind === 'hp' ? 'SINH LỰC' : 'NỘI LỰC'}</em></div>`;
  }
  const orbs = {};
  function build() {
    const hud = document.getElementById('hud'); if (!hud || orbs.hp) return;
    document.body.classList.add('hud-neon'); if (PX) document.body.classList.add('hud-px');
    for (const k of ['hp', 'mp']) {
      const el = document.createElement('div'); el.className = 'nx-orb ' + k; el.id = 'nx-' + k; el.innerHTML = svg(k);
      if (PX) {   // bản pixel: bình vẽ bằng điểm ảnh trên canvas nhỏ rồi phóng to giữ nét vuông
        el.querySelector('svg').remove();
        const cv = document.createElement('canvas'); cv.width = cv.height = PXN; cv.className = 'nx-px'; el.insertBefore(cv, el.firstChild);
        hud.appendChild(el);
        orbs[k] = { el, cv, g: cv.getContext('2d'), img: null, b: el.querySelector('.nx-val b'), sm: el.querySelector('.nx-val small'), lv: 1, target: 1, cur: -1, max: -1, ph: k === 'hp' ? 0 : 2.5, kind: k };
        continue;
      }
      hud.appendChild(el);
      const s = el.querySelector('svg');
      orbs[k] = { el, w1: s.querySelector('.w1'), w2: s.querySelector('.w2'), bub: [...s.querySelectorAll('.bub circle')], gauge: s.querySelector('.gauge'), spin: s.querySelector('.spin'),
        b: el.querySelector('.nx-val b'), sm: el.querySelector('.nx-val small'), lv: 1, target: 1, cur: -1, max: -1, ph: k === 'hp' ? 0 : 2.5 };
    }
    // hiệu ứng quanh giao diện: 4 góc khung, vạch sáng chạy theo viền trên / dưới, hạt sáng bay lên ở 2 mép
    const fx = document.createElement('div'); fx.id = 'nx-fx'; fx.setAttribute('aria-hidden', 'true');
    fx.innerHTML = '<div class="c tl"></div><div class="c tr"></div><div class="c bl"></div><div class="c br"></div><div class="edge t"></div><div class="edge b"></div><div class="side l"></div><div class="side r"></div>' +
      Array.from({ length: 10 }, (_, i) => `<i style="left:${i < 5 ? 1 + i * 1.6 : 91 + (i - 5) * 1.6}%;animation-duration:${5 + (i * 7) % 5}s;animation-delay:${(i * 1.3) % 6}s"></i>`).join('');
    hud.insertBefore(fx, hud.firstChild);
    layout(); addEventListener('resize', () => setTimeout(layout, 60)); setInterval(layout, 1500);
    requestAnimationFrame(frame);
  }

  // ---- vị trí: điện thoại kẹp giữa cần điều khiển và cụm chiêu; máy tính đặt trên 2 đầu thanh kỹ năng ----
  function rectIn(el, app, rot) {
    const r = el.getBoundingClientRect(), a = app.getBoundingClientRect();
    if (!rot) return { l: r.left - a.left, t: r.top - a.top, r: r.right - a.left, b: r.bottom - a.top };
    return { l: r.top - a.top, t: a.right - r.right, r: r.bottom - a.top, b: a.right - r.left };   // #app.rotated: xoay 90°
  }
  function layout() {
    const hud = document.getElementById('hud'), app = document.getElementById('app') || hud; if (!hud || !orbs.hp) return;
    const rot = app.classList.contains('rotated'), W = rot ? app.offsetHeight || innerHeight : hud.offsetWidth, H = rot ? app.offsetWidth || innerWidth : hud.offsetHeight;
    const touch = document.body.classList.contains('touch');
    const hp = orbs.hp.el, mp = orbs.mp.el;
    if (touch) {
      const S = Math.round(Math.max(64, Math.min(88, H * .22)));
      const joy = document.getElementById('joy-base'), acts = [...document.querySelectorAll('#action-pad .act')].filter(a => a.offsetWidth);
      const jr = joy && joy.offsetWidth ? rectIn(joy, hud, rot) : { r: W * .2 };
      const padL = acts.length ? Math.min(...acts.map(a => rectIn(a, hud, rot).l)) : W * .72;
      const l = Math.round(jr.r + 8), r = Math.round(W - padL + 6);
      // khung chat thu gọn (giữa dưới) nằm vừa khe giữa 2 bình
      const gapL = l + S + 6, gapR = W - Math.max(r, 8) - S - 6;
      document.body.style.setProperty('--nx-chat-l', Math.round((gapL + gapR) / 2) + 'px');
      document.body.style.setProperty('--nx-chat-w', Math.max(150, Math.min(280, gapR - gapL)) + 'px');
      Object.assign(hp.style, { width: S + 'px', height: S + 'px', left: l + 'px', right: 'auto', bottom: '14px' });
      Object.assign(mp.style, { width: S + 'px', height: S + 'px', right: Math.max(r, 8) + 'px', left: 'auto', bottom: '14px' });
    } else {
      const S = 104, sb = document.getElementById('skillbar');
      if (!sb || !sb.offsetWidth) return;
      const r = rectIn(sb, hud, rot), bottom = Math.round(H - r.t + 6);
      // đặt ngay trên 2 đầu thanh kỹ năng (không đè khung chat bên trái)
      Object.assign(hp.style, { width: S + 'px', height: S + 'px', left: Math.round(r.l + 4) + 'px', right: 'auto', bottom: bottom + 'px' });
      Object.assign(mp.style, { width: S + 'px', height: S + 'px', left: 'auto', right: Math.round(W - r.r + 4) + 'px', bottom: bottom + 'px' });
    }
  }

  const fmt = n => Math.max(0, Math.round(n)).toLocaleString('vi-VN');
  HudNeon.set = function (hp, hpMax, mp, mpMax) {
    if (!orbs.hp) build(); if (!orbs.hp) return;
    for (let [k, v, m] of [['hp', hp, hpMax], ['mp', mp, mpMax]]) {
      const o = orbs[k]; m = Math.max(1, m || 1); v = Math.max(0, Math.min(m, v || 0));
      o.target = v / m;
      if (o.cur !== Math.round(v) || o.max !== m) { o.cur = Math.round(v); o.max = m; o.b.textContent = Math.round(v / m * 100) + '%'; o.sm.textContent = fmt(v) + ' / ' + fmt(m); }
      if (k === 'hp') o.el.classList.toggle('low', v / m < .3 && v > 0);
    }
  };
  function wave(y, t, amp, ph, k) {
    let d = `M0 ${y.toFixed(1)}`;
    for (let x = 0; x <= 120; x += 8) d += ` L${x} ${(y + Math.sin(x / 120 * Math.PI * 2 * k + t * 2.2 + ph) * amp).toFixed(1)}`;
    return d + ' L120 130 L0 130 Z';
  }
  let last = 0, acc = 0;
  // ---- bình pixel: 40x40 điểm ảnh, chất lỏng sóng theo cột, mặt nước sáng, bọt khí, vòng đo % dạng đốt sáng ----
  const PXN = 40, PC = { hp: [[255, 138, 200], [255, 46, 122], [150, 10, 70], [70, 0, 40]], mp: [[168, 250, 255], [25, 195, 255], [10, 110, 200], [4, 40, 106]] };
  function drawPx(o, t) {
    const N = PXN, c = N / 2 - .5, g = o.g;
    if (!o.img) o.img = g.createImageData(N, N);
    const d = o.img.data, P = PC[o.kind], lv = o.lv, R = 15.2, top = c - R, surf = top + (1 - lv) * (2 * R);
    const segs = 28, lit = Math.round(lv * segs);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4, dx = x - c, dy = y - c, r = Math.hypot(dx, dy);
      let col = null, a = 255;
      if (r <= R) {
        const wy = surf + Math.round(Math.sin(x * .55 + t * 3.2 + o.ph) * 1.2 + Math.sin(x * .23 - t * 2.1) * .8);
        if (y >= wy) {
          const depth = (y - wy) / (2 * R);
          col = y - wy < 1 ? P[0] : depth < .35 ? P[1] : depth < .7 ? P[2] : P[3];
          if (((x + y) & 1) && depth > .32 && depth < .38) col = P[1];   // dải chuyển màu kiểu dither
          if (((x + y) & 1) && depth > .67 && depth < .73) col = P[2];
          const bub = (k) => { const bx = Math.round(c - 8 + k * 6 + Math.sin(t * 2 + k) * 1.2), by = Math.round(c + R - ((t * (4 + k * 1.5) + k * 7) % (c + R - wy))); return x === bx && y === by && lv > .08; };
          if (bub(0) || bub(1) || bub(2)) col = [255, 255, 255];
        } else { col = ((x + y) % 4 === 0) ? [18, 26, 70] : [8, 12, 36]; }
        if ((dx + 6) ** 2 + (dy + 8) ** 2 < 6 && dx < -2) col = [255, 255, 255];   // ánh kính
        else if (r > R - 1.1) col = [P[1][0] * .5 + 40, P[1][1] * .5 + 40, P[1][2] * .5 + 40];   // viền trong
      } else if (r <= R + 1.4) col = [6, 8, 24];
      else if (r <= R + 4.4) {   // vòng đo: các đốt sáng theo %
        let ang = Math.atan2(dx, -dy); if (ang < 0) ang += Math.PI * 2;
        const sg = Math.floor(ang / (Math.PI * 2) * segs), gap = (ang / (Math.PI * 2) * segs) % 1 > .78;
        if (gap) col = null; else if (sg < lit) col = r > R + 3.2 ? P[1] : P[0]; else col = [30, 40, 90];
        if (col && sg < lit && sg === lit - 1 && (t * 4 | 0) % 2) col = [255, 255, 255];   // đốt cuối nhấp nháy
      }
      if (col) { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = a; } else d[i + 3] = 0;
    }
    g.putImageData(o.img, 0, 0);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(.1, (now - last) / 1000); last = now; acc += dt;
    if (acc < (PX ? 1 / 12 : 1 / 30)) return;   // 30 khung/giây đủ mượt; bản pixel 12 khung/giây cho đúng chất pixel, đỡ tốn pin
    const step = acc; acc = 0; const t = now / 1000;
    for (const k in orbs) {
      const o = orbs[k];
      o.lv += (o.target - o.lv) * Math.min(1, step * 5);
      if (o.cv) { drawPx(o, t); continue; }
      const y = 104 - 88 * o.lv, slosh = Math.min(4, Math.abs(o.target - o.lv) * 40) + 1.4;
      o.w1.setAttribute('d', wave(y, t, slosh, o.ph, 1.5));
      o.w2.setAttribute('d', wave(y - 2, t * 1.3, slosh * 1.2, o.ph + 2, 1.1));
      o.bub.forEach((c, i) => { const p = (t * (.25 + i * .07) + i * .31) % 1; c.setAttribute('cx', (34 + i * 16 + Math.sin(t * 2 + i) * 3).toFixed(1)); c.setAttribute('cy', (104 - (104 - y) * p).toFixed(1)); c.setAttribute('opacity', p < .95 && o.lv > .06 ? .55 : 0); });
      o.gauge.setAttribute('stroke-dashoffset', (C * (1 - o.lv)).toFixed(1));
      o.spin.setAttribute('transform', `rotate(${((t * 25) % 360).toFixed(1)} 60 60)`);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
