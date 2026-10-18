// Ảnh asset vẽ tay (public/assets). Có ảnh thì dùng ảnh, chưa có thì dùng sprite vẽ thủ tục cũ.
(function () {
  const BASE = '/assets/';
  // Nhân vật: mỗi môn phái 1 tấm ảnh chars/<cls>.png (vẽ bởi tools/rig.py), ô 96x96, chân ở (48, 86).
  // Hàng: 0 nhìn xuống, 1 nhìn lên, 2 nhìn phải (trái = lật), 3 ngã. Cột: đứng 0-3, đi 4-9, đánh 10-13, ra chiêu 14-17, trúng đòn 18
  const CLASSES = ['thieulam', 'ngudoc', 'thienvuong', 'caibang', 'vodang', 'ngamy', 'thuyyen', 'conlon', 'duongmon'];
  const CELL = 96, FOOT_X = 48, FOOT_Y = 86;
  const ANIM = { idle: [0, 4], walk: [4, 6], atk: [10, 4], cast: [14, 4], hurt: [18, 1] };
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
  const jobs = [];
  for (const c of CLASSES) jobs.push(load('chars/' + c + '.png').then(im => { if (im) imgs['c:' + c] = im; }));
  for (const n of MONSTERS) jobs.push(load('monsters/' + n + '.png').then(im => { if (im) imgs['m:' + n] = im; }));
  const ready = Promise.all(jobs);

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
  const cache = {};
  const has = cls => !!imgs['c:' + cls];
  // dir: 0 xuống, 1 trái, 2 phải, 3 lên; state: idle | walk | atk | cast | hurt | dead
  function charFrame(cls, dir, state, i) {
    const im = imgs['c:' + cls];
    const flip = dir === 1;
    const key = cls + ':' + dir + ':' + state + ':' + i;
    if (cache[key]) return cache[key];
    let row = dir === 0 ? 0 : dir === 3 ? 1 : 2, col;
    if (state === 'dead') { row = 3; col = 0; }
    else { const a = ANIM[state] || ANIM.idle; col = a[0] + (i % a[1]); }
    const [c, x] = mk(CELL, CELL);
    x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(FOOT_X, FOOT_Y, state === 'dead' ? 22 : 13, 4, 0, 0, Math.PI * 2); x.fill();
    if (flip) { x.translate(CELL, 0); x.scale(-1, 1); }
    x.drawImage(im, col * CELL, row * CELL, CELL, CELL, 0, 0, CELL, CELL);
    return (cache[key] = c);
  }
  // ảnh đại diện (đầu + vai) cho khung avatar / thẻ môn phái
  function avatar(cls, size) {
    size = size || 64;
    const key = 'av:' + cls + ':' + size;
    if (cache[key]) return cache[key];
    const [c, x] = mk(size, size);
    if (has(cls)) x.drawImage(imgs['c:' + cls], 48 - 17, 18, 34, 34, 0, 0, size, size);
    return (cache[key] = c);
  }

  const procPlayer = Sprites.playerSprite;
  // tương thích chỗ cũ: frame > 0 khi đang đi; atk: true/'atk'/'skill'/'hurt'/'dead'
  Sprites.playerSprite = function (cls, colors, dir, frame, atk, ap) {
    if (!has(cls)) return procPlayer.call(this, cls, colors, dir, frame, !!atk, ap);
    const state = atk === 'skill' ? 'cast' : atk === true ? 'atk' : typeof atk === 'string' ? atk : frame > 0 ? 'walk' : 'idle';
    return charFrame(cls, dir, state, frame || 0);
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

  window.Assets = { ready, imgs, has, charFrame, avatar, CELL, FOOT_X, FOOT_Y, CLASSES, SKILL_ICON, MONSTERS, skillIconUrl, skillIconHTML };
})();
