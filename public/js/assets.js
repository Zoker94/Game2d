// Ảnh asset vẽ tay (public/assets). Có ảnh thì dùng ảnh, chưa có thì dùng sprite vẽ thủ tục cũ.
(function () {
  const BASE = '/assets/';
  // Nhân vật (vẽ bởi tools/rig2.py): ô gốc 144x144, chân ở (72, 128). Khung trả về là canvas 144 nhưng mọi chỗ vẽ
  // thu về 96x96 (x2/3, chân (48, 86)) để giữ chi tiết trên màn hình mật độ cao. Mỗi môn phái có các lớp ghép:
  //   chars/<cls>.json          hàng của từng động tác (đứng, đi, chạy, đánh, ra chiêu, trúng đòn, ngã, cưỡi...)
  //   chars/<cls>_a0..a3.png    thân theo kiểu áo (vải / giáp da / giáp sắt / thần giáp)
  //   chars/<cls>_am1..am3.png  phần kim loại của áo (xám) -> tô màu theo phẩm chất
  //   chars/<cls>_w0..w2.png    vũ khí (thường / tinh luyện / thần binh), đã trừ sẵn chỗ bị thân che
  //   chars/<cls>_h1..h3.png    mũ, _hm1..hm3 kim loại mũ;  _fxu / _fxo hiệu ứng dưới / trên nhân vật
  // Mỗi động tác có 3 hàng liên tiếp: nhìn xuống, nhìn lên, nhìn phải (trái = lật).
  const CLASSES = ['thieulam', 'ngudoc', 'thienvuong', 'caibang', 'vodang', 'ngamy', 'thuyyen', 'conlon', 'duongmon'];
  const SRC = 144, CELL = 96, FOOT_X = 48, FOOT_Y = 86;
  const STATE_ANIM = { idle: 'idle', walk: 'walk', run: 'run', atk: 'attack', cast: 'cast', hurt: 'hurt', dead: 'death',
                       ride: 'ride', ride_atk: 'ride_attack', ride_cast: 'ride_cast', ride_hurt: 'ride_hurt' };
  // Quái / boss: thêm tên quái (id trong server/data/monsters.js) vào đây khi có ảnh
  // public/assets/monsters/<id>.png (ảnh nền trong suốt, chân nhân vật ở đáy ảnh).
  const MONSTERS = [];

  const imgs = {}, META = {};
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
  for (const c of CLASSES) {
    jobs.push(fetch(BASE + 'chars/' + c + '.json').then(r => r.ok ? r.json() : null).then(j => { if (j) META[c] = j; }).catch(() => { }));
    jobs.push(need(c + '_a0') || loading[c + '_a0']);
    if (c !== 'caibang') jobs.push(need(c + '_w0') || loading[c + '_w0']);
  }
  // biểu tượng vật phẩm vẽ mới (tools/icons.py)
  let ICONS = null;
  jobs.push(Promise.all([load('icons.png'), fetch(BASE + 'icons.json').then(r => r.ok ? r.json() : null).catch(() => null)]).then(([im, j]) => { if (im && j) ICONS = { im, j }; }));
  for (const n of MONSTERS) jobs.push(load('monsters/' + n + '.png').then(im => { if (im) imgs['m:' + n] = im; }));
  const ready = Promise.all(jobs);

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
  const cache = {};
  let cacheN = 0;
  const put = (k, v) => { if (++cacheN > 1400) { for (const key in cache) delete cache[key]; cacheN = 0; } return (cache[k] = v); };
  const has = cls => !!(imgs[cls + '_a0'] && META[cls]);
  function layerOf(cls, name) { const m = META[cls]; return m && m.layers.indexOf(name) >= 0 ? need(cls + '_' + name) : null; }
  // (hàng, cột) của khung: trạng thái game -> động tác trong sheet; ngã = khung cuối của động tác ngã
  function cellOf(cls, dir, state, i) {
    const m = META[cls], a = m.anims[STATE_ANIM[state] || 'idle'] || m.anims.idle;
    const col = state === 'dead' ? a.n - 1 : ((i % a.n) + a.n) % a.n;
    return [a.row + (dir === 0 ? 0 : dir === 3 ? 1 : 2), col];
  }
  function frameCount(cls, state) { const m = META[cls], a = m && m.anims[STATE_ANIM[state]]; return a ? a.n : 1; }
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
  // tô màu phẩm chất lên lớp kim loại xám (chế độ hòa 'color': giữ sáng tối, lấy sắc màu phẩm chất)
  const [tcv, tcx] = mk(SRC, SRC);
  function tinted(im, sx, sy, color) {
    tcx.globalCompositeOperation = 'source-over'; tcx.clearRect(0, 0, SRC, SRC);
    tcx.drawImage(im, sx, sy, SRC, SRC, 0, 0, SRC, SRC);
    tcx.globalCompositeOperation = 'color'; tcx.fillStyle = color; tcx.fillRect(0, 0, SRC, SRC);
    tcx.globalCompositeOperation = 'destination-in'; tcx.drawImage(im, sx, sy, SRC, SRC, 0, 0, SRC, SRC);
    tcx.globalCompositeOperation = 'source-over';
    return tcv;
  }
  // quầng sáng vũ khí theo phẩm chất (tô màu lớp vũ khí của khung hình rồi loang ra xung quanh)
  function weaponGlow(cls, dir, state, i, color, ap) {
    if (state === 'dead' || !has(cls)) return null;
    const w = lookOf(ap).w;
    const im = layerOf(cls, 'w' + w) || imgs[cls + '_w0'];
    if (!im) return null;
    const key = 'wg:' + cls + w + ':' + dir + ':' + state + ':' + i + ':' + color;
    if (cache[key]) return cache[key];
    const [row, col] = cellOf(cls, dir, state, i);
    const [m, mx] = mk(SRC, SRC);
    if (dir === 1) { mx.translate(SRC, 0); mx.scale(-1, 1); }
    mx.drawImage(im, col * SRC, row * SRC, SRC, SRC, 0, 0, SRC, SRC);
    mx.setTransform(1, 0, 0, 1, 0, 0);
    mx.globalCompositeOperation = 'source-in'; mx.fillStyle = color; mx.fillRect(0, 0, SRC, SRC);
    const [c, x] = mk(SRC, SRC);
    for (const [dx, dy, a] of [[-3, 0, 0.3], [3, 0, 0.3], [0, -3, 0.3], [0, 3, 0.3], [-2, -2, 0.5], [2, 2, 0.5], [2, -2, 0.5], [-2, 2, 0.5], [0, 0, 0.5]]) { x.globalAlpha = a; x.drawImage(m, dx, dy); }
    return put(key, c);
  }
  // dir: 0 xuống, 1 trái, 2 phải, 3 lên; state: idle | walk | run | atk | cast | hurt | dead | ride | ride_atk | ride_cast | ride_hurt
  // Trả về canvas 144x144 (vẽ ra 96x96 tại x-48, y-86).
  function charFrame(cls, dir, state, i, ap) {
    const L = lookOf(ap);
    const body = layerOf(cls, 'a' + L.a), base = imgs[cls + '_a0'];
    const wpn = layerOf(cls, 'w' + L.w) || imgs[cls + '_w0'] || null;
    const helm = L.h ? layerOf(cls, 'h' + L.h) : null;
    const metal = L.a && L.ar ? layerOf(cls, 'am' + L.a) : null, hmetal = L.h && L.hr ? layerOf(cls, 'hm' + L.h) : null;
    const fxu = layerOf(cls, 'fxu'), fxo = layerOf(cls, 'fxo');
    const key = cls + ':' + dir + ':' + state + ':' + i + ':' + (body ? L.a + '.' + L.ar + (metal ? 'm' : '') : 'x') + ':' + (wpn ? L.w : 'x') + ':' + (helm ? L.h + '.' + L.hr + (hmetal ? 'm' : '') : 0) + (fxo ? 'f' : '');
    if (cache[key]) return cache[key];
    const [row, col] = cellOf(cls, dir, state, i), sx = col * SRC, sy = row * SRC;
    const [c, x] = mk(SRC, SRC);
    if (!state.startsWith('ride')) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(72, 128, state === 'dead' ? 33 : 19, 6, 0, 0, Math.PI * 2); x.fill(); }
    if (dir === 1) { x.translate(SRC, 0); x.scale(-1, 1); }
    const put2 = im => { if (im) x.drawImage(im, sx, sy, SRC, SRC, 0, 0, SRC, SRC); };
    put2(fxu); put2(body || base);
    if (metal) x.drawImage(tinted(metal, sx, sy, METAL[L.ar]), 0, 0);
    put2(wpn);
    if (helm) { put2(helm); if (hmetal) x.drawImage(tinted(hmetal, sx, sy, METAL[L.hr]), 0, 0); }
    put2(fxo);
    // ảnh chưa tải xong thì không lưu bộ nhớ đệm để lần sau vẽ đúng
    if (!body || (L.w && wpn === imgs[cls + '_w0'] && !imgs[cls + '_w' + L.w]) || (L.h && !helm) || (L.a && L.ar && !metal) || (L.h && L.hr && !hmetal) || (!fxo && META[cls] && META[cls].layers.indexOf('fxo') >= 0)) return c;
    return put(key, c);
  }
  // ----- người cưỡi: sheet có sẵn động tác ngồi yên (cưỡi, đánh, ra chiêu, trúng đòn khi cưỡi); hông ở y = 66 (ô 96) -----
  function riderFrame(cls, dir, state, i, ap) {
    const st = state === 'atk' ? 'ride_atk' : state === 'cast' ? 'ride_cast' : state === 'hurt' ? 'ride_hurt' : 'ride';
    return charFrame(cls, dir, st, i, ap);
  }
  // ----- thú cưỡi (ảnh tools/mounts2.py): ô 192 vẽ ra x2/3, nhìn ngang quay phải, kèm điểm yên (hông người cưỡi) từng khung -----
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
    // thú làm từ sheet riêng (tools/spriteup.py) có cỡ ô, số khung, hàng, điểm chân riêng trong MOUNT_META.per[id]
    const M = (MOUNT_META.per && MOUNT_META.per[id]) || MOUNT_META;
    const seats = MOUNT_META.seats && MOUNT_META.seats[id];
    if (!view || !seats || !seats[view]) view = 'side';
    const [fs, fn] = M.frames[moving ? 'run' : 'idle'];
    const k = Math.floor(t / (moving ? (M.runMs || 95) : (M.idleMs || 700))) % fn;
    const col = fs + k, [cw, ch] = M.cell;
    const rows = (M.rows && M.rows[view]) || [0];
    const s = M.scale || 1;   // thú vẽ mới (tools/mounts2.py): ô 192 thu về x2/3
    const foot = view === 'side' ? M.foot : (M.footFB || M.foot);
    const seat = seats ? seats[view][col] : MOUNT_META.seat[id][col];
    return {
      img: mountImgs[id], sx: col * cw, cw, ch, dw: cw * s, dh: ch * s, k, view,
      sy: rows[0] * ch, fy: rows[1] != null ? rows[1] * ch : -1,
      foot: [foot[0] * s, foot[1] * s], seat: [seat[0] * s, seat[1] * s]
    };
  }
  // ----- cây cối / bụi / đá / nấm cho map cỏ (ảnh tools/nature.py): [x, y, w, h, gốc x, gốc y] -----
  let NATURE = null;
  Promise.all([load('nature.png'), fetch(BASE + 'nature.json').then(r => r.ok ? r.json() : null).catch(() => null)])
    .then(([im, j]) => { if (im && j) NATURE = { im, j }; });
  // bộ cây cối / nông sản / xương rồng / chậu cảnh cắt từ tileset (tools/flora.py), cùng định dạng
  let FLORA = null;
  Promise.all([load('flora.png'), fetch(BASE + 'flora.json').then(r => r.ok ? r.json() : null).catch(() => null)])
    .then(([im, j]) => { if (im && j) FLORA = { im, j }; });
  function nature(name) {
    let A = NATURE, r = NATURE && NATURE.j[name];
    if (!r && FLORA) { A = FLORA; r = FLORA.j[name]; }
    return r ? { img: A.im, sx: r[0], sy: r[1], w: r[2], h: r[3], ax: r[4], ay: r[5] } : null;
  }
  // ----- quái vật (ảnh tools/monsters.py) -----
  // 'side': nhìn ngang quay phải (game tự lật), cột đứng4 đi6 đánh4 trúng1 chết1
  // 'rig' : quái hình người 4 hướng như nhân vật (hàng xuống / lên / phải, hàng 3 cột 0 là ngã)
  let MON_META = null;
  fetch(BASE + 'monsters.json').then(r => r.ok ? r.json() : null).then(j => { MON_META = j; }).catch(() => { });
  const monImgs = {}, monLoading = {};
  const MON_N = { idle: 4, walk: 6, atk: 4, cast: 4, hurt: 1, dead: 1 };
  // quái sự kiện mượn hình vẽ có sẵn (G.data.monsters[id].art)
  const artOf = id => (window.G && G.data && G.data.monsters && G.data.monsters[id] && G.data.monsters[id].art) || id;
  function monsterFrame(id, state, i, dir) {
    id = artOf(id);
    const m = MON_META && MON_META.mon[id];
    if (!m) return null;
    const img = monImgs[id];
    if (!img) {
      if (!monLoading[id]) monLoading[id] = load('monsters/' + id + '.png').then(im => { if (im) monImgs[id] = im; });
      return null;
    }
    let row = 0, col;
    if (m.k === 'rig') {
      if (state === 'dead') { row = 3; col = 0; }
      else { row = dir === 0 ? 0 : dir === 3 ? 1 : 2; col = MON_META.frames.rig[state] + (i % MON_N[state]); }
    } else {
      if (state === 'cast') state = 'atk';
      col = MON_META.frames.side[state] + (i % MON_N[state]);
    }
    return { img, sx: col * m.w, sy: row * m.h, w: m.w, h: m.h, fx: m.fx, fy: m.fy, top: m.top, half: m.half, rig: m.k === 'rig' };
  }
  // ----- NPC vẽ mới (tools/npcs2.py): hàng 0 nhìn xuống, hàng 1 nhìn nghiêng; 4 khung đứng thở -----
  let NPC_META = null; const npcImgs = {}, npcLoading = {};
  fetch(BASE + 'npcs.json').then(r => r.ok ? r.json() : null).then(j => { NPC_META = j; }).catch(() => { });
  function npcFrame(id, i, side) {
    if (!NPC_META || NPC_META.ids.indexOf(id) < 0) return null;
    const img = npcImgs[id];
    if (!img) { if (!npcLoading[id]) npcLoading[id] = load('npcs/' + id + '.png').then(im => { if (im) npcImgs[id] = im; }); return null; }
    const c = NPC_META.cell, k = NPC_META.scale || 1;   // NPC vẽ mới: ô 144 thu về x2/3 cho cân với nhân vật
    return { img, sx: (i % 4) * c, sy: side ? c : 0, w: c, h: c, dw: c * k, dh: c * k, fx: NPC_META.foot[0] * k, fy: NPC_META.foot[1] * k, k };
  }
  function monsterReady(id) { id = artOf(id); return !!(MON_META && MON_META.mon[id]); }
  function monsterTop(id) { id = artOf(id); const m = MON_META && MON_META.mon[id]; return m && monImgs[id] ? m.top : 0; }
  // ảnh đại diện lấy khuôn mặt làm tâm (mũ cao như nón lá, mũ giáp bị cắt bớt phần chóp)
  function avatar(cls, size, ap) {
    size = size || 64;
    const f = charFrame(cls, 0, 'idle', 0, ap);
    const [c, x] = mk(size, size);
    x.imageSmoothingEnabled = true;
    x.drawImage(f, 72 - 17, 17, 34, 34, 0, 0, size, size);
    return c;
  }

  const procPlayer = Sprites.playerSprite;
  // tương thích chỗ cũ: frame > 0 khi đang đi; atk: true/'atk'/'skill'/'hurt'/'dead'
  Sprites.playerSprite = function (cls, colors, dir, frame, atk, ap) {
    if (!has(cls)) return procPlayer.call(this, cls, colors, dir, frame, !!atk, ap);
    const state = atk === 'skill' ? 'cast' : atk === true ? 'atk' : typeof atk === 'string' ? atk : frame > 0 ? 'walk' : 'idle';
    return charFrame(cls, dir, state, frame || 0, ap);
  };

  const procIcon = Sprites.itemIcon;
  const GEAR_ICON = new Set(['weapon', 'w_sword', 'w_saber', 'w_staff', 'w_mace', 'w_dart', 'w_dual', 'w_glove', 'w_talisman', 'helmet', 'armor', 'boots', 'ring', 'amulet']);
  Sprites.itemIcon = function (icon, rarity, rcolor, tier) {
    if (!ICONS) return procIcon.apply(this, arguments);
    let key = icon;
    if (GEAR_ICON.has(icon)) key = icon + ':' + (tier >= 4 ? 2 : tier >= 2 ? 1 : 0) + ':' + (typeof rarity === 'string' ? rarity : 'common');
    const i = ICONS.j.i[key];
    if (i == null) return procIcon.apply(this, arguments);
    const ck = 'ic:' + key;
    if (cache[ck]) return cache[ck];
    const n = ICONS.j.size, cols = ICONS.j.cols;
    const [c, x] = mk(n, n);
    x.drawImage(ICONS.im, (i % cols) * n, Math.floor(i / cols) * n, n, n, 0, 0, n, n);
    return (cache[ck] = c);
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
  // ảnh vẽ bằng tools/skillicons.py: public/assets/skills/<mã chiêu>.png (Long Ấn: dr_fire / dr_water / dr_ice)
  function skillIconUrl(cls, s) {
    return s && s.id ? BASE + 'skills/' + s.id + '.png' : null;
  }
  function skillIconHTML(cls, s) {
    const url = skillIconUrl(cls, s);
    if (!url) return '';
    return `<i class="sk-img" style="background-image:url('${url}');--skc:${s.color || '#ffd76a'}"></i>`;
  }

  window.Assets = { ready, imgs, has, nature, charFrame, frameCount, SRC, riderFrame, mountFrame, monsterFrame, monsterReady, monsterTop, npcFrame, weaponGlow, avatar, lookOf, CELL, FOOT_X, FOOT_Y, CLASSES, MONSTERS, skillIconUrl, skillIconHTML };
})();
