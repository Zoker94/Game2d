// Ảnh asset vẽ tay (public/assets). Có ảnh thì dùng ảnh, chưa có thì dùng sprite vẽ thủ tục cũ.
(function () {
  const BASE = '/assets/';
  // Nhân vật: góc nghiêng (nhìn sang phải) – đi bộ x2, chạy, nhảy, đánh thường, kỹ năng, trúng đòn, ngã, đứng;
  // góc trước (f) và sau (b) – đứng (fi/bi) + 4 khung bước chân
  const CLASSES = ['thieulam', 'ngudoc', 'thienvuong', 'caibang', 'vodang', 'ngamy', 'thuyyen', 'conlon', 'duongmon'];
  const POSES = ['walk0', 'walk1', 'run', 'jump', 'atk', 'skill', 'hurt', 'dead', 'idle',
    'fi', 'f0', 'f1', 'f2', 'f3', 'bi', 'b0', 'b1', 'b2', 'b3'];
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
  for (const c of CLASSES) for (const p of POSES) jobs.push(load('chars/' + c + '_' + p + '.png').then(im => { if (im) imgs['c:' + c + '_' + p] = im; }));
  for (const n of MONSTERS) jobs.push(load('monsters/' + n + '.png').then(im => { if (im) imgs['m:' + n] = im; }));
  // chân dung môn phái (màn chọn môn phái, khung avatar)
  const portraits = {};
  for (const c of CLASSES) jobs.push(load('portraits/' + c + '.png').then(im => { if (im) portraits[c] = im; }));
  const ready = Promise.all(jobs);

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
  // chu kỳ đi 8 khung: 2 khung bước + nhún người
  const WALK = ['walk0', 'walk0', 'walk0', 'walk0', 'walk1', 'walk1', 'walk1', 'walk1'], BOB = [0, -1, -1, 0, 0, -1, -1, 0];
  const cache = {};
  function charFrame(cls, pose, flip, bob) {
    const key = cls + ':' + pose + ':' + (flip ? 1 : 0) + ':' + bob;
    if (cache[key]) return cache[key];
    const im = imgs['c:' + cls + '_' + pose];
    const [c, x] = mk(im.width, 64);
    if (pose !== 'dead') { x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(im.width / 2, 61, 12, 3.5, 0, 0, Math.PI * 2); x.fill(); }
    if (flip) { x.translate(im.width, 0); x.scale(-1, 1); }
    x.drawImage(im, 0, bob);
    return (cache[key] = c);
  }
  const has = cls => !!imgs['c:' + cls + '_idle'];

  const procPlayer = Sprites.playerSprite;
  // atk: false | true | 'atk' | 'skill' | 'hurt' | 'dead' | 'run'
  Sprites.playerSprite = function (cls, colors, dir, frame, atk, ap) {
    if (!has(cls)) return procPlayer.call(this, cls, colors, dir, frame, atk === true || atk === 'atk' || atk === 'skill', ap);
    frame = frame || 0;
    let pose, bob = 0;
    if (atk === true) pose = 'atk';
    else if (typeof atk === 'string') pose = atk;
    else if (dir === 0 || dir === 3) {
      const v = dir === 0 ? 'f' : 'b';
      pose = frame > 0 ? v + (Math.floor((frame - 1) / 2) % 4) : v + 'i';
    }
    else if (frame > 0) { pose = WALK[(frame - 1) % 8]; bob = BOB[(frame - 1) % 8]; }
    else pose = 'idle';
    if (!imgs['c:' + cls + '_' + pose]) pose = 'idle';
    return charFrame(cls, pose, dir === 1, bob);
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

  window.Assets = { ready, imgs, has, portraits, CLASSES, SKILL_ICON, MONSTERS, skillIconUrl, skillIconHTML };
})();
