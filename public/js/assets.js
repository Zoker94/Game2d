// Ảnh asset vẽ tay (public/assets). Có ảnh thì dùng ảnh, chưa có thì dùng sprite vẽ thủ tục cũ.
(function () {
  const BASE = '/assets/';
  // Nhân vật (vẽ bởi tools/rig.py), ô 96x96, chân ở (48, 86). Mỗi môn phái có các lớp ghép theo trang bị:
  //   chars/<cls>_a0..3.png  thân theo kiểu áo (vải / giáp da / giáp sắt / thần giáp), hàng 3 = ngã
  //   chars/<cls>_w0..2.png  lớp vũ khí (thường / tinh luyện / thần binh), chars/<cls>_h1..3.png lớp mũ
  // Phần kim loại vẽ bằng màu đánh dấu (xanh ngọc) rồi tô lại theo phẩm chất trang bị.
  // Hàng: 0 nhìn xuống, 1 nhìn lên, 2 nhìn phải (trái = lật). Cột: đứng 0-3, đi 4-9, đánh 10-13, ra chiêu 14-17, trúng đòn 18
  const CLASSES = ['thieulam', 'ngudoc', 'thienvuong', 'caibang', 'vodang', 'ngamy', 'thuyyen', 'conlon', 'duongmon'];
  const CELL = 96, FOOT_X = 48, FOOT_Y = 86;
  const ANIM = { idle: [0, 4], walk: [4, 6], atk: [10, 4], cast: [14, 4], hurt: [18, 1], ride: [19, 2] };
  // Biểu tượng võ công theo thứ tự 6 chiêu của mỗi môn phái
  const SKILL_ICON = {
    vodang:     ['vodang_i2', 'vodang_i1', 'vd_taiji2', 'vodang_i3', 'cl_swords', 'vodang_i0'],
    thieulam:   ['vodang_i1', 'thieulam_i0', 'thieulam_i2', 'thieulam_i3', 'vd_med', 'vd_aura'],
    thienvuong: ['thienvuong_i0', 'thienvuong_i3', 'thienvuong_i2', 'thienvuong_i1', 'tv_spear', 'tv_thunder'],
    duongmon:   ['duongmon_i0', 'duongmon_i1', 'duongmon_i3', 'dm_glow', 'duongmon_i2', 'dm_bow'],
    ngudoc:     ['ngudoc_i3', 'ngudoc_i0', 'ngudoc_i2', 'nd_aura1', 'ngudoc_i1', 'nd_aura2'],
    ngamy:      ['conlon_i3', 'thuyyen_i1', 'ty_sword', 'thuyyen_i0', 'ty_dance', 'thuyyen_i1'],
    thuyyen:    ['conlon_i3', 'thuyyen_i2', 'ty_moon', 'thuyyen_i0', 'ty_slash', 'thuyyen_i3'],
    conlon:     ['conlon_i0', 'conlon_i3', 'cl_swords', 'conlon_i1', 'conlon_i2', 'tv_thunder'],
    caibang:    ['caibang_i0', 'caibang_i2', 'caibang_i1', 'caibang_i3', 'cb_spear', 'vodang_i3']
  };
  // Quái / boss: thêm tên quái (id trong server/data/monsters.js) vào đây khi có ảnh
  // public/assets/monsters/<id>.png (ảnh nền trong suốt, chân nhân vật ở đáy ảnh).
  const MONSTERS = [];

  const imgs = {};
  function load(path) {
    return new Promise(res => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = () => res(null);
      im.src = BASE + path;
    });
  }
  // tải theo nhu cầu: kiểu đồ nào xuất hiện mới tải ảnh đó
  const loading = {};
  function need(key) {
    if (imgs[key] || loading[key]) return imgs[key] || null;
    loading[key] = load('chars/' + key + '.png').then(im => { if (im) imgs[key] = im; });
    return null;
  }
  const jobs = [];
  for (const c of CLASSES) { jobs.push(need(c + '_a0') || loading[c + '_a0']); if (c !== 'caibang') jobs.push(need(c + '_w0') || loading[c + '_w0']); }
  for (const n of MONSTERS) jobs.push(load('monsters/' + n + '.png').then(im => { if (im) imgs['m:' + n] = im; }));
  const ready = Promise.all(jobs);

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
  const cache = {};
  let cacheN = 0;
  const put = (k, v) => { if (++cacheN > 6000) { for (const key in cache) if (!key.startsWith('rc:')) delete cache[key]; cacheN = 0; } return (cache[k] = v); };
  const has = cls => !!imgs[cls + '_a0'];
  function cellOf(dir, state, i) {
    if (state === 'dead') return [3, 0];
    const a = ANIM[state] || ANIM.idle;
    return [dir === 0 ? 0 : dir === 3 ? 1 : 2, a[0] + (i % a[1])];
  }
  // ----- trang bị -> kiểu hình -----
  const METAL = ['#a8b0bc', '#4fa3ff', '#b060ff', '#ffb02a'];   // Thường / Hiếm / VIP / Truyền Kỳ
  // ap = [bậc vũ khí, độ hiếm vũ khí, +vũ khí, bậc áo, độ hiếm áo, +áo, bậc nón, thú cưỡi, độ hiếm nón]
  function lookOf(ap) {
    ap = ap || [];
    const at = ap[3] == null ? -1 : ap[3], ht = ap[6] == null ? -1 : ap[6], wt = ap[0] == null ? -1 : ap[0];
    return {
      a: at < 2 ? 0 : at < 4 ? 1 : at < 6 ? 2 : 3, ar: ap[4] || 0,
      h: ht < 0 ? 0 : ht < 3 ? 1 : ht < 5 ? 2 : 3, hr: ap[8] || 0,
      w: wt < 3 ? 0 : wt < 5 ? 1 : 2
    };
  }
  // tô lại phần kim loại (màu đánh dấu, sắc độ ~168) theo màu phẩm chất, giữ độ sáng tối
  function recolor(img, hex) {
    const [c, x] = mk(img.width, img.height);
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
    const cr = parseInt(hex.slice(1, 3), 16), cg = parseInt(hex.slice(3, 5), 16), cb = parseInt(hex.slice(5, 7), 16);
    for (let i = 0; i < a.length; i += 4) {
      if (!a[i + 3]) continue;
      const r = a[i], g = a[i + 1], b = a[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), dd = mx - mn;
      if (dd < mx * 0.3 || g < r) continue;
      let h = mx === g ? 60 * ((b - r) / dd + 2) : mx === b ? 60 * ((r - g) / dd + 4) : -1;
      if (Math.abs(h - 168) > 14) continue;
      const L = mx / 232, hi = Math.max(0, L - 1) * 120;
      a[i] = Math.min(255, cr * L * 1.05 + hi); a[i + 1] = Math.min(255, cg * L * 1.05 + hi); a[i + 2] = Math.min(255, cb * L * 1.05 + hi);
    }
    x.putImageData(d, 0, 0);
    return c;
  }
  function sheetFor(key, rar) {   // ảnh đã tô màu theo phẩm chất (thân áo, mũ)
    const im = need(key);
    if (!im) return null;
    const k = 'rc:' + key + ':' + rar;
    return cache[k] || (cache[k] = recolor(im, METAL[rar] || METAL[0]));
  }
  // quầng sáng vũ khí theo phẩm chất (tô màu lớp vũ khí của khung hình rồi loang ra xung quanh)
  function weaponGlow(cls, dir, state, i, color, ap) {
    if (state === 'dead') return null;
    const w = lookOf(ap).w;
    const im = need(cls + '_w' + w) || imgs[cls + '_w0'];
    if (!im) return null;
    const key = 'wg:' + cls + w + ':' + dir + ':' + state + ':' + i + ':' + color;
    if (cache[key]) return cache[key];
    const [row, col] = cellOf(dir, state, i);
    const [m, mx] = mk(CELL, CELL);
    if (dir === 1) { mx.translate(CELL, 0); mx.scale(-1, 1); }
    mx.drawImage(im, col * CELL, row * CELL, CELL, CELL, 0, 0, CELL, CELL);
    mx.setTransform(1, 0, 0, 1, 0, 0);
    mx.globalCompositeOperation = 'source-in'; mx.fillStyle = color; mx.fillRect(0, 0, CELL, CELL);
    const [c, x] = mk(CELL, CELL);
    for (const [dx, dy, a] of [[-2, 0, 0.3], [2, 0, 0.3], [0, -2, 0.3], [0, 2, 0.3], [-1, -1, 0.55], [1, 1, 0.55], [1, -1, 0.55], [-1, 1, 0.55], [0, 0, 0.5]]) { x.globalAlpha = a; x.drawImage(m, dx, dy); }
    return put(key, c);
  }
  // dir: 0 xuống, 1 trái, 2 phải, 3 lên; state: idle | walk | atk | cast | hurt | dead; ap: ngoại hình trang bị
  function charFrame(cls, dir, state, i, ap) {
    const L = lookOf(ap);
    // kiểu đồ chưa tải xong thì tạm dùng kiểu cơ bản
    const body = sheetFor(cls + '_a' + L.a, L.ar) || sheetFor(cls + '_a0', 0);
    const wpn = cls !== 'caibang' ? (need(cls + '_w' + L.w) || imgs[cls + '_w0']) : null;
    const helm = L.h ? sheetFor(cls + '_h' + L.h, L.hr) : null;
    const key = cls + ':' + dir + ':' + state + ':' + i + ':' + (body ? L.a + '.' + L.ar : 'x') + ':' + (wpn ? L.w : 'x') + ':' + (helm ? L.h + '.' + L.hr : 0);
    if (cache[key]) return cache[key];
    const [row, col] = cellOf(dir, state, i);
    const [c, x] = mk(CELL, CELL);
    if (state !== 'ride') { x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(FOOT_X, FOOT_Y, state === 'dead' ? 22 : 13, 4, 0, 0, Math.PI * 2); x.fill(); }
    if (dir === 1) { x.translate(CELL, 0); x.scale(-1, 1); }
    if (body) x.drawImage(body, col * CELL, row * CELL, CELL, CELL, 0, 0, CELL, CELL);
    if (state !== 'dead') {
      if (wpn) x.drawImage(wpn, col * CELL, row * CELL, CELL, CELL, 0, 0, CELL, CELL);
      if (helm) x.drawImage(helm, col * CELL, row * CELL, CELL, CELL, 0, 0, CELL, CELL);
    }
    // ảnh chưa tải xong thì không lưu bộ nhớ đệm để lần sau vẽ đúng
    if (!body || (L.w && wpn === imgs[cls + '_w0'] && !imgs[cls + '_w' + L.w]) || (L.h && !helm) || (L.a && !imgs[cls + '_a' + L.a])) return c;
    return put(key, c);
  }
  // ----- người cưỡi: ngồi trên yên, giữ nguyên đôi chân -----
  // Đánh / ra chiêu khi cưỡi: thân trên lấy từ khung đánh, phần chân lấy từ khung ngồi.
  const HIP_Y = 66;
  const riderCache = new WeakMap();
  function riderFrame(cls, dir, state, i, ap) {
    const legs = charFrame(cls, dir, 'ride', i % 2, ap);
    if (state !== 'atk' && state !== 'cast' && state !== 'hurt') return legs;
    const up = charFrame(cls, dir, state, i, ap);
    let m = riderCache.get(up);
    if (m && m.get(legs)) return m.get(legs);
    const [c, x] = mk(CELL, CELL);
    x.drawImage(legs, 0, HIP_Y - 4, CELL, CELL - HIP_Y + 4, 0, HIP_Y - 4, CELL, CELL - HIP_Y + 4);
    x.clearRect(0, 0, CELL, HIP_Y - 4);
    x.drawImage(up, 0, 0, CELL, HIP_Y - 1, 0, 0, CELL, HIP_Y - 1);
    if (!m) riderCache.set(up, m = new WeakMap());
    m.set(legs, c);
    return c;
  }
  // ----- thú cưỡi (ảnh tools/mounts.py): ô 128x96, nhìn ngang quay phải, kèm điểm yên từng khung -----
  let MOUNT_META = null;
  fetch(BASE + 'mounts.json').then(r => r.ok ? r.json() : null).then(j => { MOUNT_META = j; }).catch(() => { });
  const mountImgs = {}, mountLoading = {};
  // view: 'side' | 'down' | 'up'. Nhìn trước/sau có 2 lớp: back vẽ trước người cưỡi, front vẽ đè lên.
  function mountFrame(id, moving, t, view) {
    if (!MOUNT_META || !MOUNT_META.seat[id]) return null;
    if (!mountImgs[id]) {
      if (!mountLoading[id]) mountLoading[id] = load('mounts/' + id + '.png').then(im => { if (im) mountImgs[id] = im; });
      return null;
    }
    const seats = MOUNT_META.seats && MOUNT_META.seats[id];
    if (!view || !seats || !seats[view]) view = 'side';
    const [fs, fn] = MOUNT_META.frames[moving ? 'run' : 'idle'];
    const k = Math.floor(t / (moving ? 95 : 700)) % fn;
    const col = fs + k, [cw, ch] = MOUNT_META.cell;
    const rows = (MOUNT_META.rows && MOUNT_META.rows[view]) || [0];
    return {
      img: mountImgs[id], sx: col * cw, cw, ch, k, view,
      sy: rows[0] * ch, fy: rows[1] != null ? rows[1] * ch : -1,
      foot: view === 'side' ? MOUNT_META.foot : (MOUNT_META.footFB || MOUNT_META.foot),
      seat: seats ? seats[view][col] : MOUNT_META.seat[id][col]
    };
  }
  // ảnh đại diện (đầu + vai) cho khung avatar / thẻ môn phái
  function avatar(cls, size, ap) {
    size = size || 64;
    const f = charFrame(cls, 0, 'idle', 0, ap);
    const [c, x] = mk(size, size);
    x.drawImage(f, 48 - 17, 18, 34, 34, 0, 0, size, size);
    return c;
  }

  const procPlayer = Sprites.playerSprite;
  // tương thích chỗ cũ: frame > 0 khi đang đi; atk: true/'atk'/'skill'/'hurt'/'dead'
  Sprites.playerSprite = function (cls, colors, dir, frame, atk, ap) {
    if (!has(cls)) return procPlayer.call(this, cls, colors, dir, frame, !!atk, ap);
    const state = atk === 'skill' ? 'cast' : atk === true ? 'atk' : typeof atk === 'string' ? atk : frame > 0 ? 'walk' : 'idle';
    return charFrame(cls, dir, state, frame || 0, ap);
  };

  const procMonster = Sprites.monsterSprite;
  Sprites.monsterSprite = function (type, info, frame, dir) {
    const im = imgs['m:' + type];
    if (!im) return procMonster.apply(this, arguments);
    const key = 'm:' + type + ':' + (frame % 2);
    if (cache[key]) return cache[key];
    const [c, x] = mk(64, 64);
    const s = Math.min(60 / im.width, 62 / im.height), w = Math.round(im.width * s), h = Math.round(im.height * s);
    x.fillStyle = 'rgba(0,0,0,0.28)'; x.beginPath(); x.ellipse(32, 60, w * 0.3, 4, 0, 0, Math.PI * 2); x.fill();
    x.drawImage(im, 32 - w / 2, 62 - h + (frame % 2), w, h - (frame % 2));
    return (cache[key] = c);
  };

  // HTML biểu tượng kỹ năng cho nút bấm / bảng võ công
  function skillIconUrl(cls, s) {
    if (!s) return null;
    if (s.idx === 6) {
      const d = G.data && G.data.dragons && Object.values(G.data.dragons).find(x => x.id === s.id);
      const book = (d && d.book) || 'book_fire';
      const k = 'dragon:' + book;
      if (!cache[k]) cache[k] = Sprites.itemIcon(book, 3).toDataURL();
      return cache[k];
    }
    const n = SKILL_ICON[cls] && SKILL_ICON[cls][s.idx];
    return n ? BASE + 'icons/' + n + '.png' : null;
  }
  function skillIconHTML(cls, s) {
    const url = skillIconUrl(cls, s);
    if (!url) return '';
    return `<i class="sk-img" style="background-image:url('${url}');--skc:${s.color || '#ffd76a'}"></i>`;
  }

  window.Assets = { ready, imgs, has, charFrame, riderFrame, mountFrame, weaponGlow, avatar, lookOf, CELL, FOOT_X, FOOT_Y, CLASSES, SKILL_ICON, MONSTERS, skillIconUrl, skillIconHTML };
})();
