// Các màn trước khi vào game: nền cảnh động (núi non lớp lớp, trăng, sương, hạc bay, hoa đào rơi),
// màn tạo nhân vật (chọn phái → chọn hệ Nội / Ngoại công → đặt tên) với biểu đồ ngũ giác thuộc tính, tiểu sử, võ công.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ================== Nền cảnh động ==================
  const Scene = (() => {
    const cv = $('scene-bg'), ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, layers = [], petals = [], birds = [], mist = [], t0 = performance.now(), last = 0, tint = null;
    // hạt giống ngẫu nhiên cố định: dãy núi giống nhau mỗi lần mở
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    function ridge(c, y0, amp, rough, color, pagoda, pines) {
      const g = c.getContext('2d'), w = c.width, h = c.height, pts = [];
      let y = y0, v = 0;
      for (let x = 0; x <= w + 8; x += 8) { v += (rnd() - 0.5) * rough; v *= 0.86; y += v; y = Math.max(y0 - amp, Math.min(y0 + amp * 0.5, y)); pts.push([x, y]); }
      g.fillStyle = color; g.beginPath(); g.moveTo(0, h);
      for (const [x, yy] of pts) g.lineTo(x, yy);
      g.lineTo(w, h); g.closePath(); g.fill();
      if (pagoda) {   // chùa tháp trên đỉnh cao nhất của lớp này
        let top = pts[0]; for (const p of pts) if (p[0] > w * 0.15 && p[0] < w * 0.85 && p[1] < top[1]) top = p;
        const [px, py] = top, s = h / 560;
        g.fillStyle = color;
        for (let i = 0; i < 4; i++) {
          const ww = (34 - i * 7) * s, yy = py - (i + 1) * 15 * s;
          g.fillRect(px - ww * 0.35, yy, ww * 0.7, 15 * s);
          g.beginPath(); g.moveTo(px - ww, yy + 3 * s); g.quadraticCurveTo(px, yy - 7 * s, px + ww, yy + 3 * s); g.lineTo(px + ww * 0.7, yy + 5 * s); g.lineTo(px - ww * 0.7, yy + 5 * s); g.closePath(); g.fill();
        }
        g.fillRect(px - 1.5 * s, py - 78 * s, 3 * s, 18 * s);
        // đèn cửa sổ
        g.fillStyle = 'rgba(255,190,90,.85)'; for (let i = 0; i < 3; i++) g.fillRect(px - 3 * s, py - (i + 1) * 15 * s + 6 * s, 4 * s, 5 * s);
      }
      if (pines) {   // rặng thông trên sống núi gần
        g.fillStyle = color;
        for (let k = 0; k < pts.length; k += 1 + (rnd() * 3 | 0)) {
          if (rnd() < 0.45) continue;
          const [x, yy] = pts[k], th = (14 + rnd() * 26) * pines, tw = th * 0.42;
          g.fillRect(x - 1, yy - th * 0.25, 2, th * 0.3);
          for (let j = 0; j < 3; j++) { const ty = yy - th * (0.2 + j * 0.27), ww = tw * (1 - j * 0.28); g.beginPath(); g.moveTo(x - ww, ty); g.lineTo(x, ty - th * 0.38); g.lineTo(x + ww, ty); g.closePath(); g.fill(); }
        }
      }
    }
    function build() {
      const app = $('app');
      W = app.clientWidth; H = app.clientHeight; dpr = Math.min(1.5, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
      seed = 7; layers = [];
      const cols = ['#5e4c86', '#4c3c70', '#3c2e5c', '#2e2248', '#211833'];   // nhạt hơn để nhân vật nổi rõ
      for (let i = 0; i < 5; i++) {
        const c = document.createElement('canvas'); c.width = Math.round(W * 1.15); c.height = Math.round(H);
        ridge(c, H * (0.48 + i * 0.09), H * (0.16 - i * 0.015), 9 - i, cols[i], i === 2, i >= 3 ? (i === 4 ? 1.3 : 0.8) * H / 700 : 0);
        layers.push({ c, k: 0.012 + i * 0.022 });
      }
      petals = Array.from({ length: Math.round(Math.min(60, W / 18)) }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 2 + Math.random() * 3.5, v: 12 + Math.random() * 26, sw: Math.random() * 6.28, r: Math.random() * 6.28, ember: Math.random() < 0.25 }));
      birds = Array.from({ length: 4 }, (_, i) => ({ x: -100 - i * 160, y: H * (0.16 + Math.random() * 0.14), v: 22 + Math.random() * 14, s: 0.7 + Math.random() * 0.5, ph: Math.random() * 6 }));
      mist = Array.from({ length: 6 }, (_, i) => ({ x: Math.random() * W, y: H * (0.55 + i * 0.07), w: W * (0.4 + Math.random() * 0.4), v: 4 + Math.random() * 8, a: 0.05 + Math.random() * 0.06 }));
    }
    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      if (now - last < 32) return;   // ~30 khung / giây là đủ cho nền
      const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
      const t = (now - t0) / 1000;
      const app = $('app');
      if (app.clientWidth !== W || app.clientHeight !== H) build();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // bầu trời hoàng hôn tím – đỏ
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#1c1234'); sky.addColorStop(0.38, '#46265e'); sky.addColorStop(0.62, '#94405a'); sky.addColorStop(0.78, '#e48c56'); sky.addColorStop(1, '#4e2634');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // sao
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 40; i++) { const x = (i * 97.3) % W, y = (i * 53.7) % (H * 0.4); ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 0.7 + i)); ctx.fillRect(x, y, 1.4, 1.4); }
      ctx.globalAlpha = 1;
      // trăng
      const mx = W * 0.74, my = H * 0.26, mr = Math.min(W, H) * 0.11;
      const glow = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3.2);
      glow.addColorStop(0, 'rgba(255,220,160,.42)'); glow.addColorStop(1, 'rgba(255,200,140,0)');
      ctx.fillStyle = glow; ctx.fillRect(mx - mr * 3.2, my - mr * 3.2, mr * 6.4, mr * 6.4);
      const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
      mg.addColorStop(0, '#fff6e0'); mg.addColorStop(1, '#f0c890');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.29); ctx.fill();
      ctx.fillStyle = 'rgba(200,150,110,.25)'; ctx.beginPath(); ctx.arc(mx + mr * 0.3, my + mr * 0.15, mr * 0.22, 0, 6.29); ctx.arc(mx - mr * 0.35, my - mr * 0.25, mr * 0.13, 0, 6.29); ctx.fill();
      // hạc bay
      ctx.strokeStyle = 'rgba(20,10,25,.85)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (const b of birds) {
        b.x += b.v * dt; if (b.x > W + 60) { b.x = -80; b.y = H * (0.12 + Math.random() * 0.18); }
        const f = Math.sin(t * 5 + b.ph) * 5 * b.s, s = 9 * b.s, by = b.y + Math.sin(t * 0.8 + b.ph) * 6;
        ctx.beginPath(); ctx.moveTo(b.x - s, by - f); ctx.quadraticCurveTo(b.x - s * 0.4, by - f * 0.2 - 2, b.x, by); ctx.quadraticCurveTo(b.x + s * 0.4, by - f * 0.2 - 2, b.x + s, by - f); ctx.stroke();
      }
      // núi lớp lớp (xa trôi chậm, gần trôi nhanh)
      layers.forEach((l, i) => {
        const off = ((t * l.k * 60) % (l.c.width - W)) || 0;
        ctx.drawImage(l.c, -off, 0, l.c.width, H);
        if (i === 1 || i === 3) {   // sương giữa các lớp núi
          for (const m of mist) {
            if ((i === 1) !== (m.y < H * 0.72)) continue;
            m.x += m.v * dt * 0.5; if (m.x - m.w > W) m.x = -m.w;
            const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.w * 0.5);
            g.addColorStop(0, `rgba(230,200,220,${m.a})`); g.addColorStop(1, 'rgba(230,200,220,0)');
            ctx.save(); ctx.scale(1, 0.25); ctx.fillStyle = g; ctx.fillRect(m.x - m.w * 0.5, m.y * 4 - m.w * 0.5, m.w, m.w); ctx.restore();
          }
        }
      });
      // màu môn phái phủ nhẹ khi đang chọn phái
      if (tint) { const g = ctx.createRadialGradient(W * 0.5, H * 0.62, 0, W * 0.5, H * 0.62, W * 0.55); g.addColorStop(0, tint + '33'); g.addColorStop(1, tint + '00'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      // hoa đào rơi + tàn lửa bay lên
      for (const p of petals) {
        if (p.ember) { p.y -= p.v * dt * 0.8; p.x += Math.sin(t + p.sw) * 0.3; if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; } }
        else { p.y += p.v * dt; p.x += Math.sin(t * 1.3 + p.sw) * 0.6 + 0.25; p.r += dt * 2; if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; } if (p.x > W + 10) p.x = -10; }
        ctx.save(); ctx.translate(p.x, p.y);
        if (p.ember) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + p.sw); ctx.fillStyle = '#ffb44a'; ctx.fillRect(-1, -1, 2, 2); }
        else { ctx.rotate(p.r); ctx.fillStyle = '#f7a8c0'; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 6.29); ctx.fill(); }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      // viền tối quanh màn
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.32)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    let running = false;
    return {
      start() { if (running) return; running = true; cv.style.display = ''; build(); requestAnimationFrame(frame); },
      stop() { running = false; cv.style.display = 'none'; },
      tint(c) { tint = c || null; }
    };
  })();

  // ================== Thuộc tính môn phái (ngũ giác) ==================
  const AX = [['atk', 'Tấn công'], ['def', 'Phòng thủ'], ['hp', 'Sinh lực'], ['agi', 'Thân pháp'], ['rng', 'Tầm đánh']];
  let norm = null;
  function raw(cl, br) {
    const L = 59, b = cl.base, g = cl.growth, p = (cl.branches[br].passive || {}).passive || {};
    return {
      atk: (b.atk + g.atk * L) * (1 + (p.atk || 0)) * (br === 'noi' ? 1.12 : 1),   // hệ Nội xuyên 20% phòng thủ
      def: (b.def + g.def * L) * (1 + (p.def || 0)),
      hp: (b.hp + g.hp * L) * (1 + (p.hp || 0)),
      agi: b.spd * (1 + (p.spd || 0)) * 0.5 + (b.crit + g.crit * L + (p.crit || 0)) * 2.2 + (p.dodge || 0) * 3 + (p.critdmg || 0) * 0.4,
      rng: cl.branches[br].range || cl.range || 80
    };
  }
  function buildNorm() {
    const all = [];
    for (const cl of Object.values(G.data.classes)) for (const br of Object.keys(cl.branches || {})) all.push(raw(cl, br));
    norm = {};
    for (const [k] of AX) { const vs = all.map(o => o[k]); norm[k] = [Math.min(...vs), Math.max(...vs)]; }
  }
  function score(cl, br) {
    if (!norm) buildNorm();
    const r = raw(cl, br), o = {};
    for (const [k] of AX) { const [a, b] = norm[k]; o[k] = 0.22 + 0.78 * (b > a ? (r[k] - a) / (b - a) : 0.5); }
    return o;
  }
  function radarSVG(cur, other, color) {
    const S = 220, c = S / 2, R = 74, pt = (i, v) => { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v]; };
    const poly = o => AX.map(([k], i) => pt(i, o[k]).map(n => n.toFixed(1)).join(',')).join(' ');
    let h = `<svg viewBox="0 0 ${S} ${S}" class="pg-radar">`;
    for (let r = 1; r <= 4; r++) h += `<polygon points="${AX.map((_, i) => pt(i, r / 4).join(',')).join(' ')}" class="rg ${r === 4 ? 'out' : ''}"/>`;
    AX.forEach((_, i) => { const [x, y] = pt(i, 1); h += `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" class="rl"/>`; });
    if (other) h += `<polygon points="${poly(other)}" class="rp2"/>`;
    h += `<polygon points="${poly(cur)}" class="rp" style="fill:${color}55;stroke:${color}"/>`;
    AX.forEach(([k, n], i) => {
      const [x, y] = pt(i, cur[k]); h += `<circle cx="${x}" cy="${y}" r="3.2" style="fill:${color}"/>`;
      const [lx, ly] = pt(i, 1.32);
      h += `<text x="${lx}" y="${ly}" class="rt">${n}</text><text x="${lx}" y="${ly + 12}" class="rv">${Math.round(cur[k] * 100)}</text>`;
    });
    return h + '</svg>';
  }
  function verdict(s, cl, br) {
    const off = s.atk + s.agi * 0.4, def = (s.def + s.hp) / 2 + 0.2;
    const lean = off - def > 0.22 ? ['Thiên công', 'atk'] : def - off > 0.12 ? ['Thiên thủ', 'def'] : ['Công thủ cân bằng', 'bal'];
    const rng = (cl.branches[br].range || 0) >= 200 ? 'Đánh xa' : 'Cận chiến';
    return { lean, rng };
  }

  // ================== Màn tạo nhân vật ==================
  const sel = { cls: 'thieulam', br: null };
  let ctab = 'stat';
  const NAME_A = ['Lăng', 'Tiêu', 'Mộ', 'Hàn', 'Vân', 'Phong', 'Bạch', 'Lãnh', 'Độc', 'Kiếm', 'Dạ', 'Tuyết', 'Lạc', 'Thiên', 'Huyền', 'Mặc'];
  const NAME_B = ['Phong', 'Vũ', 'Nguyệt', 'Hồn', 'Long', 'Ảnh', 'Hà', 'Sương', 'Tâm', 'Khách', 'Vân', 'Hiên', 'Trần', 'Dao', 'Linh', 'Kiếm'];
  const randName = () => { let a, b; do { a = NAME_A[Math.random() * NAME_A.length | 0]; b = NAME_B[Math.random() * NAME_B.length | 0]; } while (a === b); return a + b; };
  function brOf(cl) { return sel.br && cl.branches[sel.br] ? sel.br : cl.defBranch; }

  function renderCreate() {
    const C = G.data.classes, cl = C[sel.cls], L = (window.LORE || {})[sel.cls] || {}, br = brOf(cl), other = br === 'noi' ? 'ngoai' : 'noi';
    const color = L.color || '#ffd76a';
    Scene.tint(color);
    // lưới môn phái
    const grid = $('class-grid');
    if (!grid.dataset.built) {
      grid.dataset.built = 1;
      grid.innerHTML = Object.entries(C).map(([id, c]) => `<button class="pg-sect" data-cls="${id}" style="--sc:${(LORE[id] || {}).color || '#ffd76a'}"><canvas width="56" height="56"></canvas><b>${esc(c.name)}</b><small>${esc(c.role)}</small></button>`).join('');
      grid.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { if (sel.cls !== b.dataset.cls) { sel.cls = b.dataset.cls; sel.br = null; } G.sfx && G.sfx('click'); renderCreate(); });
    }
    grid.querySelectorAll('[data-cls]').forEach(b => {
      b.classList.toggle('on', b.dataset.cls === sel.cls);
      const cv = b.querySelector('canvas'), x = cv.getContext('2d'), id = b.dataset.cls;
      if (cv.dataset.drawn === '2') return;
      x.clearRect(0, 0, 56, 56);
      if (Assets.has(id)) { x.imageSmoothingEnabled = true; x.drawImage(Assets.charFrame(id, 0, 'idle', 0), 22 * Assets.K, 26 * Assets.K, 100 * Assets.K, 100 * Assets.K, 0, 0, 56, 56); cv.dataset.drawn = '2'; }
      else { x.imageSmoothingEnabled = false; x.drawImage(Sprites.playerSprite(id, C[id].colors, 0, 0), 0, 0, 64, 64, 0, 0, 56, 56); cv.dataset.drawn = '1'; }
    });
    // sân khấu
    $('screen-create').style.setProperty('--sc', color);
    $('class-name').textContent = cl.name;
    $('class-role').textContent = `${cl.role} · ${cl.weapon} · ${'★'.repeat(L.diff || 1)}${'☆'.repeat(3 - (L.diff || 1))} độ khó`;
    // chọn hệ
    const keys = [cl.defBranch, ...Object.keys(cl.branches).filter(k => k !== cl.defBranch)];
    $('class-branches').innerHTML = keys.map(k => {
      const b = cl.branches[k], far = (b.range || 0) >= 200;
      return `<button class="pg-br ${k === br ? 'on' : ''} br-${k}" data-br="${k}"><span class="pg-br-k">${k === 'noi' ? '🔮' : '⚔️'} ${esc(b.kind)}</span><b>${esc(b.name)}</b><small>${far ? '🏹 Đánh xa' : '🗡️ Cận chiến'}${k === cl.defBranch ? ' · gốc' : ''}</small></button>`;
    }).join('');
    $('class-branches').querySelectorAll('[data-br]').forEach(b => b.onclick = () => { sel.br = b.dataset.br; G.sfx && G.sfx('click'); renderCreate(); });
    // bảng thông tin
    document.querySelectorAll('[data-ctab]').forEach(b => b.classList.toggle('on', b.dataset.ctab === ctab));
    const s = score(cl, br), so = score(cl, other), v = verdict(s, cl, br), bb = cl.branches[br];
    let h = '';
    if (ctab === 'stat') {
      h = `<div class="pg-statwrap">${radarSVG(s, so, color)}
        <div class="pg-verdict"><span class="pg-lean ${v.lean[1]}">${v.lean[0]}</span><span class="pg-tag">${v.rng}</span><span class="pg-tag">${esc(bb.kind)}</span></div>
        <div class="pg-legend"><i style="background:${color}"></i>${esc(bb.name)} <i class="dash"></i>${esc(cl.branches[other].name)} (hệ còn lại)</div></div>
        <div class="pg-bars">${AX.map(([k, n]) => `<div class="pg-bar"><span>${n}</span><i><b style="width:${Math.round(s[k] * 100)}%;background:${color}"></b></i><em>${Math.round(s[k] * 100)}</em></div>`).join('')}</div>
        <p class="pg-style">${esc(L[br] || '')}</p>
        <p class="pg-dim">Chỉ số tính ở cấp 60, đã gồm nội công bị động của hệ. Đổi hệ sau này trong bảng Võ Công (miễn phí dưới cấp 20).</p>`;
    } else if (ctab === 'lore') {
      h = `<div class="pg-motto">“${esc(L.motto || '')}”</div><div class="pg-seat">📍 ${esc(L.seat || '')}</div><p class="pg-lore">${esc(L.lore || cl.desc)}</p>
        <div class="pg-lore2"><b>🔮 Nội công</b><p>${esc(L.noi || '')}</p><b>⚔️ Ngoại công</b><p>${esc(L.ngoai || '')}</p></div>`;
    } else {
      const ps = bb.passive;
      h = `<div class="pg-sk-h"><span class="br-tag br-${br}">${esc(bb.kind)}</span> <b>${esc(bb.name)}</b></div>` +
        bb.skills.map((sk, i) => i === 3 ? null : sk).filter(Boolean).map(sk => `<div class="pg-sk"><i style="background-image:url('/assets/skills/${sk.id}.png')"></i><div><b>${esc(sk.name)}</b>${sk.ult ? ' <span class="br-ult">Tuyệt kỹ</span>' : ''}<small>Cấp ${sk.lv}${sk.mp ? ' · ' + sk.mp + ' nội lực' : ''}${sk.cd ? ' · hồi ' + (sk.cd / 1000) + 's' : ''}${sk.type === 'aoe' ? ' · diện rộng' : sk.type === 'line' ? ' · đường thẳng' : sk.type === 'dash' ? ' · lướt' : ''}</small></div></div>`).join('') +
        (ps ? `<div class="pg-sk"><i style="background-image:url('/assets/skills/${ps.id}.png')"></i><div><b>${esc(ps.name)}</b> <span class="pg-tag">Bị động</span><small>${esc(ps.desc || '')}</small></div></div>` : '');
    }
    $('class-info').innerHTML = h;
  }
  document.querySelectorAll('[data-ctab]').forEach(b => b.onclick = () => { ctab = b.dataset.ctab; renderCreate(); });
  $('name-dice').onclick = () => { $('char-name').value = randName(); G.sfx && G.sfx('click'); };
  $('create-btn').onclick = () => {
    const name = $('char-name').value.trim();
    if (!name) { $('char-name').focus(); return UI.toast ? UI.toast('Hãy đặt tên nhân vật', 'error') : null; }
    G.socket.emit('createChar', { name, cls: sel.cls, branch: brOf(G.data.classes[sel.cls]) });
  };
  // mắt hiện mật khẩu ở màn đăng nhập
  $('li-eye').onclick = () => { const p = $('li-pass'); p.type = p.type === 'password' ? 'text' : 'password'; };

  window.Pregame = { Scene, sel, renderCreate };
  Scene.start();
})();
