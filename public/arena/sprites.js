// Sprite pixel vẽ bằng code: ghép hình cơ bản (ellipse, capsule, tam giác) trên lưới pixel,
// tự đổ bóng theo hướng sáng trên-trái và tự viền tối quanh hình.
'use strict';

const Spr = (() => {
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
  const shade = (c, t) => (t > 0 ? mix(c, '#ffffff', t) : mix(c, '#140c24', -t));
  const LX = -0.55, LY = -0.83; // hướng tới nguồn sáng

  class Painter {
    constructor(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); }
    set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c; }
    get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : null; }
    // tô vùng theo hàm inside(x,y) -> vector pháp tuyến (hoặc null), đổ bóng theo pháp tuyến
    fill(x0, y0, x1, y1, fn, c, sh = 1) {
      const lt = shade(c, 0.28), dk = shade(c, -0.3);
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const n = fn(x + 0.5, y + 0.5);
        if (!n) continue;
        const d = n[0] * LX + n[1] * LY;
        this.set(x, y, !sh ? c : d > 0.62 ? lt : d < -0.42 ? dk : c);
      }
    }
    ell(cx, cy, rx, ry, c, sh) {
      this.fill(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => {
        const nx = (x - cx) / rx, ny = (y - cy) / ry;
        return nx * nx + ny * ny <= 1 ? [nx, ny] : null;
      }, c, sh);
    }
    cap(ax, ay, bx, by, r, c, sh) { // capsule: đoạn thẳng có độ dày
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
      this.fill(Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r, (x, y) => {
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
        const nx = (x - ax - dx * t) / r, ny = (y - ay - dy * t) / r;
        return nx * nx + ny * ny <= 1 ? [nx, ny] : null;
      }, c, sh);
    }
    poly(pts, c) {
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      this.fill(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (x, y) => {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside ? [0, 0] : null;
      }, c, 0);
    }
    tri(ax, ay, bx, by, cx, cy, c) { this.poly([[ax, ay], [bx, by], [cx, cy]], c); }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
    // chỉ vẽ lên pixel đã có (họa tiết, sọc)
    over(x, y, c) { if (this.get(x, y)) this.set(x, y, c); }
    toCanvas(outline = true) {
      const { w, h } = this, out = this.px.slice();
      if (outline) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (this.px[y * w + x]) continue;
        const nb = this.get(x, y + 1) || this.get(x, y - 1) || this.get(x - 1, y) || this.get(x + 1, y);
        if (nb) out[y * w + x] = mix(nb, '#100a1c', 0.78);
      }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'), id = g.createImageData(w, h);
      out.forEach((c, i) => { if (!c) return; const [r, gg, b] = hex(c); id.data.set([r, gg, b, 255], i * 4); });
      g.putImageData(id, 0, 0);
      return cv;
    }
  }

  const K = '#1c1a24', WH = '#ffffff';

  // ---- Từng loài (hướng mặt sang phải) ----
  const DRAW = {
    pikachu: { s: 20, f(p) {
      const Y = '#f8d030', B = '#a86a28';
      p.poly([[7, 15], [3, 13], [5, 12], [1, 8], [3, 7], [0, 2], [6, 6], [4, 8], [7, 10], [5, 11], [9, 13]], Y);
      p.cap(7, 15, 6, 13, 1.2, B);
      p.ell(10.5, 14.5, 4.5, 4, Y);
      p.ell(8.5, 18.4, 1.9, 1.1, Y); p.ell(12.8, 18.4, 1.9, 1.1, Y);
      p.cap(8.5, 6.5, 5, 0.8, 1.4, Y); p.cap(6, 2.5, 5, 0.8, 1.1, K);
      p.cap(14, 6, 17.5, 1, 1.4, Y); p.cap(16.5, 2.5, 17.5, 1, 1.1, K);
      p.ell(11.2, 8.8, 5.5, 4.4, Y);
      p.rect(9, 8, 1, 2, K); p.rect(13, 8, 1, 2, K); p.set(9, 8, '#5a4a40');
      p.rect(6, 10, 2, 2, '#e83828'); p.rect(15, 10, 2, 1, '#e83828');
      p.set(11, 10, '#7a3020');
      p.cap(9, 13, 8, 14.5, .8, Y); p.cap(13, 13, 14, 14.5, .8, Y);
      p.over(9, 15, B); p.over(10, 16, B);
    } },
    charizard: { s: 32, f(p) {
      const O = '#f08838', B = '#f8d8a0', W = '#2a7aa0';
      p.tri(12, 15, 2, 3, 7, 19, shade(O, -0.15)); p.tri(11, 15, 4, 6, 7, 17, shade(W, -0.2));
      p.cap(10, 25, 4.5, 22, 2.2, O); p.cap(4.5, 22, 3, 17.5, 1.6, O);
      p.ell(3, 14, 2.2, 3.2, '#f83818', 0); p.ell(3, 14.8, 1.2, 2, '#f8d030', 0);
      p.ell(12, 28.6, 3, 2.2, O); p.ell(19.5, 28.6, 3, 2.2, O);
      p.ell(15.5, 21.5, 6.5, 7, O);
      p.ell(17.8, 22.5, 3.6, 5.5, B);
      p.cap(18.5, 15.5, 20.5, 11, 2.6, O);
      p.cap(19.5, 7, 16.5, 3.5, 1, O);
      p.ell(22, 9, 4.6, 3.6, O); p.ell(25.6, 10.3, 3, 2.2, O);
      p.set(23, 8, K); p.set(23, 9, K); p.set(22, 8, WH); p.rect(26, 11, 2, 1, shade(O, -0.45));
      p.cap(20.5, 19, 22.5, 21, 1, O);
      p.tri(19, 15, 30, 1, 27, 18, O); p.tri(20.5, 14.5, 28, 4, 26, 15.5, W);
    } },
    venusaur: { s: 34, f(p) {
      const T = '#62b4a8', D = '#3e8a7c', G = '#3ca040', P = '#f87890';
      p.ell(9, 29, 3, 2.5, T); p.ell(21, 29.5, 3, 2.5, T);
      p.ell(15, 24, 11, 6, T);
      p.ell(7, 17.5, 7, 3, G); p.ell(23.5, 17.5, 7, 3, G); p.ell(15, 15, 6.5, 3.5, G);
      p.ell(15, 15.5, 3, 2, '#8a5a30');
      p.ell(9.5, 11, 4.5, 3, P); p.ell(20.5, 11, 4.5, 3, P); p.ell(15, 8.5, 4, 3.2, P); p.ell(15, 12.5, 4.5, 2, P);
      p.ell(15, 11, 2, 1.4, '#f8e8a8', 0);
      [[8, 10], [10, 12], [20, 10], [22, 12], [14, 7], [16, 7]].forEach(([x, y]) => p.over(x, y, '#fff0f0'));
      p.ell(27, 23, 5, 4, T); p.tri(24, 20, 26, 19, 24, 17, T); p.tri(28, 19.5, 30, 20, 30, 17.5, T);
      p.rect(28, 22, 1, 2, '#c02828'); p.set(30, 25, D);
      [[10, 24], [13, 26], [18, 25], [8, 22]].forEach(([x, y]) => p.over(x, y, D));
      p.ell(25, 29.5, 3, 2.4, T); p.ell(13.5, 30, 3, 2.2, T);
    } },
    blastoise: { s: 32, f(p) {
      const Bl = '#6890e8', Sh = '#a86a30', Cr = '#f0e0a8', Gy = '#b8bac8';
      p.ell(13, 18.5, 9.6, 10.4, Cr); p.ell(12.2, 18.5, 8.3, 9.4, Sh);
      p.cap(7.5, 9.5, 13, 6.5, 2.3, Gy); p.set(13, 6, K); p.set(14, 6, K);
      p.ell(13, 28.6, 3.5, 2.4, Bl); p.ell(21, 28.6, 3.5, 2.4, Bl);
      p.ell(18, 19.5, 6.4, 8, Bl);
      p.ell(19.6, 20.5, 3.8, 6, Cr);
      for (const y of [17, 20, 23]) for (let x = 17; x < 23; x++) p.over(x, y, shade(Cr, -0.2));
      p.ell(22, 10, 5, 4, Bl); p.tri(18, 7, 19.5, 4, 21, 7, Bl);
      p.set(24, 9, '#3a2010'); p.set(24, 10, '#3a2010'); p.set(23, 9, WH);
      p.rect(24, 12, 3, 1, shade(Bl, -0.5));
      p.cap(22.5, 17, 25.5, 20, 1.6, Bl);
      p.cap(16, 8, 21.5, 5.5, 2.1, Gy); p.set(22, 5, K); p.set(22, 6, K);
    } },
    snorlax: { s: 36, f(p) {
      const Dk = '#30697e', Cr = '#f0e2bc';
      p.ell(6.5, 19.5, 3.2, 5, Dk); p.ell(30.5, 19.5, 3.2, 5, Dk);
      p.ell(18, 21.5, 13.5, 11.5, Dk);
      p.ell(18, 10, 9, 6.5, Dk);
      p.tri(10, 7, 12, 1, 15, 5, Dk); p.tri(21, 5, 24, 1, 26, 7, Dk);
      p.ell(19, 23.5, 10, 8.8, Cr);
      p.ell(18.5, 11.2, 6.5, 4, Cr);
      p.rect(15, 10, 3, 1, '#203040'); p.rect(20, 10, 3, 1, '#203040');
      p.rect(17, 13, 3, 1, '#8a4a38'); p.set(16, 12, '#8a4a38'); p.set(20, 12, '#8a4a38');
      p.set(15, 14, WH); p.set(21, 14, WH);
      p.ell(10.5, 32, 4.6, 3.2, Cr); p.ell(26, 32, 4.6, 3.2, Cr);
      p.ell(10.5, 32.3, 2, 1.4, '#a07850', 0); p.ell(26, 32.3, 2, 1.4, '#a07850', 0);
    } },
    lapras: { s: 34, f(p) {
      const Lb = '#58a8e0', Cr = '#f0e6c0', Gs = '#a8a0b8', Kn = '#6a6084';
      p.ell(7.5, 28.5, 4, 2, Lb);
      p.ell(15, 25, 11, 6, Lb);
      p.ell(17, 27.5, 8, 3, Cr);
      p.ell(13, 21, 9, 5, Gs);
      [[8, 19], [12.5, 17.8], [17, 19], [10.5, 22], [15, 22]].forEach(([x, y]) => p.ell(x, y, 1.3, 1.3, Kn, 0));
      p.cap(22, 23, 25.5, 9, 2.6, Lb); p.cap(24.5, 22, 27, 11, 1.2, Cr, 0);
      p.ell(26, 7, 4.6, 3.6, Lb); p.cap(24, 4, 23.5, 0.8, 0.9, '#d8e8f0');
      p.tri(21.5, 5, 22.5, 2, 24, 4.5, Lb);
      p.rect(27, 6, 1, 2, K); p.rect(29, 9, 2, 1, shade(Lb, -0.5));
      p.ell(23.5, 29.5, 4.2, 2, Lb);
    } },
    typhlosion: { s: 32, f(p) {
      const Nv = '#2e4a6e', Cr = '#f6dea0', F1 = '#f83818', F2 = '#f8c828';
      p.ell(13, 8.5, 3.2, 4, F1, 0); p.ell(10.5, 12.5, 3, 3.4, F1, 0); p.ell(15.5, 5, 2.6, 3.2, F1, 0);
      p.ell(13, 9.5, 1.8, 2.4, F2, 0); p.ell(10.8, 13, 1.6, 2, F2, 0); p.ell(15.5, 6, 1.4, 2, F2, 0);
      p.ell(13.2, 18.5, 6.6, 9, Nv);
      p.ell(16.3, 20.5, 5.8, 8.2, Cr);
      p.ell(12.5, 28.6, 3, 2.2, Cr); p.ell(19.5, 28.6, 3, 2.2, Cr);
      p.ell(21, 10.5, 5, 4, Cr); p.ell(19.5, 8.6, 4.2, 2.6, Nv); p.ell(25.3, 11.6, 2.5, 2, Cr);
      p.rect(22, 10, 2, 1, '#b02020'); p.rect(26, 12, 2, 1, shade(Cr, -0.45));
      p.cap(20.5, 19, 23.5, 21.5, 1.3, Cr);
    } },
    feraligatr: { s: 34, f(p) {
      const Bu = '#3a70c8', Ye = '#e8d070', Rd = '#d03838';
      p.cap(10, 27, 3, 30.5, 2.4, Bu);
      p.tri(8, 14, 11.5, 12, 10.5, 17.5, Rd); p.tri(6.5, 19, 10, 17, 10, 22.5, Rd); p.tri(4.5, 24, 9, 22, 9, 27, Rd);
      p.ell(14, 21, 6.5, 9, Bu);
      p.ell(16.6, 22, 3.6, 7, Ye);
      for (const y of [18, 21, 24, 27]) for (let x = 14; x < 21; x++) p.over(x, y, shade(Ye, -0.22));
      p.ell(11, 30.3, 3.2, 2.4, Bu); p.ell(18.5, 30.3, 3.2, 2.4, Bu);
      p.tri(15, 6, 18.5, 5.5, 13.5, 1.5, Rd);
      p.ell(20, 9, 5.4, 4, Bu); p.ell(25.5, 8.8, 5.6, 2.2, Bu);
      p.ell(24.5, 13.2, 5, 1.8, Bu);
      p.ell(25, 11.3, 4.6, 1, '#c02848', 0);
      [22, 25, 28].forEach(x => p.set(x, 11, WH));
      p.rect(21, 7, 1, 2, '#c02020'); p.set(20, 7, WH);
      p.cap(19, 18, 23.5, 17, 1.4, Bu); p.set(25, 16, WH); p.set(25, 18, WH);
    } },
    meganium: { s: 32, f(p) {
      const Gl = '#98d070', Pk = '#e85870', Yl = '#f8e070';
      p.ell(10, 28.6, 2.6, 2.3, Gl); p.ell(18, 28.8, 2.6, 2.3, Gl);
      p.tri(6, 24, 3, 22, 7, 21, Gl);
      p.ell(13, 24, 7, 5, Gl);
      p.cap(16, 20, 19.5, 10, 2, Gl);
      p.ell(12.5, 18.5, 3, 2.5, Pk); p.ell(22, 18.5, 3, 2.5, Pk); p.ell(17, 16.5, 3.2, 2, Pk); p.ell(17, 21, 3.6, 2, Pk);
      p.set(12, 18, Yl); p.set(22, 18, Yl); p.set(17, 16, Yl); p.set(17, 21, Yl);
      p.ell(21.5, 8.5, 4.5, 3.8, Gl);
      p.cap(19.5, 5.5, 17.5, 0.8, 0.7, Gl); p.cap(22, 5, 23, 0.8, 0.7, Gl);
      p.rect(23, 7, 1, 2, K); p.set(25, 10, shade(Gl, -0.5));
      p.ell(21, 28.8, 2.6, 2.3, Gl);
    } },
    ampharos: { s: 30, f(p) {
      const Ya = '#f6d040', Wh = '#f4f4f0', Rg = '#e83838';
      p.cap(8, 24, 3, 20, 2, Ya); [[6, 22], [4, 21], [5, 23]].forEach(([x, y]) => p.over(x, y, K));
      p.ell(2.6, 18.5, 2.1, 2.1, Rg);
      p.ell(14, 20, 7, 8, Ya);
      p.ell(15.6, 21, 4, 5.5, Wh);
      p.ell(11, 28, 2.8, 2, Ya); p.ell(18, 28, 2.8, 2, Ya);
      p.cap(15, 7, 11.5, 2, 1.3, Ya); p.cap(20.5, 6, 23.5, 1, 1.3, Ya);
      [[12, 3], [13, 5], [22, 2], [21, 4]].forEach(([x, y]) => p.over(x, y, K));
      p.ell(18, 10, 5, 4.5, Ya);
      p.ell(18.5, 6.2, 1.3, 1.3, Rg, 0);
      p.rect(19, 10, 1, 2, K); p.set(22, 12, shade(Ya, -0.5));
      for (let x = 11; x < 20; x++) p.over(x, 15, K);
      p.cap(19.5, 18, 22, 20.5, 1.2, Ya);
    } },
    tyranitar: { s: 36, f(p) {
      const Gt = '#68a060', Bb = '#9ab0d0', Dg = '#3e7046';
      p.cap(10, 28.5, 3, 32.5, 3, Gt);
      p.tri(8, 12, 12, 10, 10.5, 16.5, Dg); p.tri(6, 17, 10, 15, 9.5, 21.5, Dg); p.tri(4, 22.5, 8.5, 20.5, 8.5, 26.5, Dg);
      p.ell(12, 31.6, 3.8, 3, Gt); p.ell(21, 31.6, 3.8, 3, Gt);
      p.ell(16, 22, 8, 10, Gt);
      p.poly([[19, 14], [23, 21.5], [19, 30], [15, 21.5]], Bb); p.ell(19, 21.5, 1.4, 2, '#405070', 0);
      p.tri(14.5, 13.5, 18, 13, 14.5, 8.5, Dg);
      p.ell(22, 9, 5, 4, Gt); p.ell(26.5, 11, 3.5, 2, Gt);
      p.tri(19, 6, 22.5, 5.5, 17.5, 0.8, Dg);
      p.rect(23, 8, 2, 1, '#d02020'); p.rect(27, 12, 2, 1, shade(Gt, -0.5));
      p.cap(21.5, 18, 26, 21, 1.8, Gt); p.set(27, 21, WH); p.set(27, 23, WH);
    } },
    espeon: { s: 28, f(p) {
      const Li = '#e4aee4', Rg = '#d83050';
      p.cap(7, 17.5, 3, 13, 1, Li); p.cap(3, 13, 1, 8.5, 0.9, Li); p.cap(3, 13, 0.8, 16.5, 0.9, Li);
      p.cap(9.5, 19, 9, 24.5, 1, shade(Li, -0.12)); p.cap(17, 19, 17, 24.5, 1, shade(Li, -0.12));
      p.ell(13, 17.5, 6.5, 3.5, Li);
      p.cap(11.5, 19, 12, 24.5, 1, Li); p.cap(19, 18.5, 19.5, 24.5, 1, Li);
      p.cap(17, 16, 19, 12, 1.7, Li);
      p.tri(16, 9.5, 18.5, 7.5, 14, 1, Li); p.tri(19.5, 7, 22.5, 7.5, 22.5, 0.5, Li);
      p.ell(20, 10, 4, 3.3, Li); p.ell(23, 11.2, 2, 1.5, Li);
      p.set(20, 7, Rg); p.set(21, 7, Rg);
      p.rect(21, 9, 1, 2, '#601070'); p.set(24, 12, shade(Li, -0.5));
    } },
  };

  // ---- Huấn luyện viên ----
  function trainer(kind, back) {
    const p = new Painter(16, 22);
    const skin = '#f8c8a0', hair = '#262430';
    const cfg = kind === 'red'
      ? { cap: '#e03030', patch: '#f8f8f8', jacket: '#e03030', shirt: '#2a2a34', pants: '#3858a8', shoe: '#c02828' }
      : { cap: '#f8c030', patch: '#282830', jacket: '#d83030', shirt: '#f8c030', pants: '#e0d4a0', shoe: '#4060c0' };
    p.rect(4, 15, 3, 5, cfg.pants); p.rect(9, 15, 3, 5, cfg.pants);
    p.rect(4, 20, 3, 1, cfg.shoe); p.rect(9, 20, 3, 1, cfg.shoe);
    p.rect(3, 10, 10, 6, cfg.jacket);
    if (!back) p.rect(7, 10, 2, 5, cfg.shirt);
    p.rect(2, 11, 1, 4, cfg.jacket); p.rect(13, 11, 1, 4, cfg.jacket);
    p.set(2, 15, skin); p.set(13, 15, skin);
    p.rect(4, 5, 8, 5, back ? hair : skin);
    p.rect(3, 5, 1, 3, hair); p.rect(12, 5, 1, 3, hair);
    if (!back) { p.rect(5, 7, 1, 1, K); p.rect(10, 7, 1, 1, K); p.rect(7, 9, 2, 1, '#d89070'); }
    p.ell(8, 3.5, 5, 2.6, cfg.cap, 0);
    p.rect(3, 5, 10, 1, shade(cfg.cap, -0.25));
    if (!back) p.rect(6, 2, 4, 2, cfg.patch);
    return p.toCanvas();
  }

  function pokeball(open) {
    const p = new Painter(8, 8);
    p.ell(4, 4, 3.5, 3.5, '#e83838');
    for (let y = 4; y < 8; y++) for (let x = 0; x < 8; x++) p.over(x, y, '#f4f4f4');
    for (let x = 0; x < 8; x++) p.over(x, 4, '#202020');
    p.set(3, 4, '#ffffff'); p.set(4, 4, '#ffffff');
    if (open) { p.set(3, 4, '#ffff80'); p.set(4, 4, '#ffff80'); }
    return p.toCanvas();
  }

  function flipped(cv) {
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
    const g = c.getContext('2d'); g.translate(cv.width, 0); g.scale(-1, 1); g.drawImage(cv, 0, 0);
    return c;
  }
  function tinted(cv, color) {
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
    const g = c.getContext('2d'); g.drawImage(cv, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  const cache = {};
  function mon(id) {
    if (cache[id]) return cache[id];
    const d = DRAW[id];
    const p = new Painter(d.s, d.s); d.f(p);
    const r = p.toCanvas();
    const l = flipped(r);
    // tìm khung bao thật để căn chân xuống đất
    const g = r.getContext('2d'), data = g.getImageData(0, 0, d.s, d.s).data;
    let top = d.s, bot = 0;
    for (let y = 0; y < d.s; y++) for (let x = 0; x < d.s; x++) if (data[(y * d.s + x) * 4 + 3]) { top = Math.min(top, y); bot = Math.max(bot, y); }
    return (cache[id] = { r, l, wr: tinted(r, '#ffffff'), wl: tinted(l, '#ffffff'), s: d.s, top, bot });
  }
  const trainers = {};
  function trainerSpr(kind) {
    return trainers[kind] || (trainers[kind] = { front: trainer(kind, false), back: trainer(kind, true) });
  }
  const balls = { closed: null, open: null };
  function ball(open) { const k = open ? 'open' : 'closed'; return balls[k] || (balls[k] = pokeball(open)); }

  // vẽ sprite vừa khít vào 1 canvas nhỏ (ảnh đại diện)
  function drawFit(canvas, id, pad = 1) {
    const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, canvas.width, canvas.height);
    const m = mon(id), sc = Math.max(1, Math.floor((canvas.width - pad * 2) / m.s));
    g.drawImage(m.r, (canvas.width - m.s * sc) / 2, (canvas.height - m.s * sc) / 2, m.s * sc, m.s * sc);
  }

  return { mon, trainerSpr, ball, drawFit, mix, shade, Painter };
})();
