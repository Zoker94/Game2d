// Ảnh asset vẽ tay (public/assets). Có ảnh thì dùng ảnh, chưa có thì dùng sprite vẽ thủ tục cũ.
(function () {
  const BASE = '/assets/';
  // Nhân vật: idle = đứng/đi, atk = khi ra chiêu, back = quay lưng (đi lên)
  const CHAR = {
    vodang:     { idle: 'vodang_1', atk: 'vodang_0' },
    thieulam:   { idle: 'thieulam_0', back: 'thieulam_1' },
    ngudoc:     { idle: 'ngudoc_0', atk: 'ngudoc_1' },
    duongmon:   { idle: 'duongmon_0', atk: 'dm_bow', side: 'duongmon_1' },
    thuyyen:    { idle: 'thuyyen_0' },
    ngamy:      { idle: 'thuyyen_1' },
    conlon:     { idle: 'conlon_0', atk: 'conlon_1' },
    thienvuong: { idle: 'thienvuong_0', atk: 'tv_halb', elite: 'thienvuong_1' },
    caibang:    { idle: 'caibang_0', atk: 'caibang_1' }
  };
  // Ảnh nhìn sang trái (mặc định ảnh nhìn sang phải) -> lật khi đi sang phải
  const FACE_LEFT = { vodang_0: 1, tv_halb: 1 };
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
  const charNames = new Set();
  for (const c of Object.values(CHAR)) for (const k of ['idle', 'atk', 'back', 'side', 'elite']) if (c[k]) charNames.add(c[k]);
  const jobs = [];
  for (const n of charNames) jobs.push(load('chars/' + n + '.png').then(im => { if (im) imgs['c:' + n] = im; }));
  for (const n of MONSTERS) jobs.push(load('monsters/' + n + '.png').then(im => { if (im) imgs['m:' + n] = im; }));
  const ready = Promise.all(jobs);

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
  // nhịp bước chân 8 khung: nhấc chân trái / phải và nhún người
  const LIFT_L = [0, 2, 3, 2, 0, 0, 0, 0], LIFT_R = [0, 0, 0, 0, 0, 2, 3, 2], BOB = [0, -1, -1, -1, 0, -1, -1, -1];
  const cache = {};
  function charFrame(name, flip, frame, atk) {
    const key = name + ':' + (flip ? 1 : 0) + ':' + frame + ':' + (atk ? 1 : 0);
    if (cache[key]) return cache[key];
    const im = imgs['c:' + name];
    const [c, x] = mk(64, 64);
    // bóng dưới chân
    x.fillStyle = 'rgba(0,0,0,0.28)'; x.beginPath(); x.ellipse(32, 60, 13, 3.5, 0, 0, Math.PI * 2); x.fill();
    if (flip) { x.translate(64, 0); x.scale(-1, 1); }
    const f = frame % 8, legY = 50, bob = BOB[f];
    const lunge = atk ? 2 : 0;
    // thân trên
    x.drawImage(im, 0, 0, 64, legY, lunge, bob, 64, legY);
    // hai chân: nửa trái / nửa phải nhấc lên xen kẽ
    x.drawImage(im, 0, legY, 32, 64 - legY, lunge, legY - LIFT_L[f] + Math.min(0, bob), 32, 64 - legY);
    x.drawImage(im, 32, legY, 32, 64 - legY, 32 + lunge, legY - LIFT_R[f] + Math.min(0, bob), 32, 64 - legY);
    return (cache[key] = c);
  }

  const procPlayer = Sprites.playerSprite;
  Sprites.playerSprite = function (cls, colors, dir, frame, atk, ap) {
    const def = CHAR[cls];
    if (!def) return procPlayer.apply(this, arguments);
    let name = def.idle;
    if (def.elite && ap && ap[3] >= 4) name = def.elite; // áo giáp bậc cao: đổi sang bộ giáp vàng
    if (atk && def.atk) name = def.atk;
    else if (dir === 3 && def.back) name = def.back;
    else if ((dir === 1 || dir === 2) && def.side) name = def.side;
    if (!imgs['c:' + name]) name = def.idle;
    if (!imgs['c:' + name]) return procPlayer.apply(this, arguments);
    const faceLeft = !!FACE_LEFT[name];
    const flip = dir === 1 ? !faceLeft : dir === 2 ? faceLeft : false;
    return charFrame(name, flip, frame || 0, atk);
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

  window.Assets = { ready, imgs, CHAR, SKILL_ICON, MONSTERS, skillIconUrl, skillIconHTML };
})();
