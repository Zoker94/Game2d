// Client chính: đăng nhập, kết nối, hiển thị thế giới, di chuyển, chiến đấu, tự động đánh.
(function () {
  const $ = id => document.getElementById(id);
  const TILE = 64;

  const G = window.G = {
    data: null, config: null, socket: null, token: localStorage.getItem('vl_token'), user: null,
    me: null, you: null, map: null, solid: new Set(),
    players: new Map(), monsters: new Map(), drops: new Map(), carts: new Map(), corpses: [], ghosts: [], dash: null, dodge: { ch: 3, mx: 3, until: 0, total: 5000, at: 0 },
    self: { x: 0, y: 0, dir: 0, moving: false, atkUntil: 0 },
    fx: [], floats: [], target: null, moveTo: null, npcGoal: null,
    cds: {}, pending: {}, auto: false, events: null, daily: null, inGame: false,
    settings: Object.assign({ names: true, sound: true, shake: true, autoUpdate: true }, JSON.parse(localStorage.getItem('vl_settings') || '{}')),
    autoCfg: (() => { try { return JSON.parse(localStorage.getItem('vl_auto') || '{}'); } catch (e) { return {}; } })()
  };
  G.saveSettings = () => localStorage.setItem('vl_settings', JSON.stringify(G.settings));
  // tự vào lại game sau khi tải lại vì máy chủ có bản mới (Cài đặt → Tự vào game khi có bản mới): { auto: đang bật Tự động }
  let reEnter = null;
  try { reEnter = JSON.parse(sessionStorage.getItem('vl_reenter') || 'null'); sessionStorage.removeItem('vl_reenter'); } catch (e) { }
  if (reEnter && !(Date.now() - (reEnter.t || 0) < 120000)) reEnter = null;   // cờ cũ quá 2 phút: bỏ

  // ================== Màn hình ==================
  function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id)); }
  function loading(on, text) { $('loading').classList.toggle('hidden', !on); if (text) $('loading-text').textContent = text; }
  G.modal = function (text, buttons = [{ t: 'OK' }]) {
    $('modal-text').textContent = text;
    const box = $('modal-btns'); box.innerHTML = '';
    buttons.forEach(b => { const el = document.createElement('button'); el.className = 'btn ' + (b.cls || ''); el.textContent = b.t; el.onclick = () => { $('modal-msg').classList.add('hidden'); b.fn && b.fn(); }; box.appendChild(el); });
    $('modal-msg').classList.remove('hidden');
  };

  async function api(path, opts = {}) {
    const res = await fetch(path, { method: opts.body ? 'POST' : 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, G.token ? { Authorization: 'Bearer ' + G.token } : {}), body: opts.body ? JSON.stringify(opts.body) : undefined });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Lỗi kết nối');
    return j;
  }

  // tải lại dữ liệu game (máy chủ vừa cập nhật thêm quái / vật phẩm / bản đồ mà trang chưa tải lại)
  let dataRefreshAt = 0;
  G.refreshData = async function (force) {
    const now = Date.now();
    if (!force && now - dataRefreshAt < 15000) return;
    dataRefreshAt = now;
    try { const d = await api('/api/gamedata?t=' + now); if (d && d.monsters) G.data = d; } catch (e) { }
  };

  // ================== Màn hình tải ==================
  const TIPS = [
    'Mẹo: Nhấn nút 🤖 Tự động để nhân vật tự đánh quái quanh khu vực.',
    'Mẹo: Từ +10 trở lên, cường hóa thất bại mà không có Bảo Hiểm Phù sẽ rớt về +1!',
    'Mẹo: Boss xuất hiện theo giờ, có cơ hội rơi trang bị Truyền Kỳ cho người gây sát thương cao nhất.',
    'Mẹo: Thú cưỡi tăng tốc độ di chuyển và chỉ số. Cho ăn Mã Linh Đan để lên cấp.',
    'Mẹo: Long Ấn (phím 7) – rồng lửa, rồng nước, rồng băng – môn phái nào cũng học được.',
    'Mẹo: Điểm danh mỗi ngày và quay Vòng Quay May Mắn miễn phí tại Lễ Quan.',
    'Mẹo: Gia nhập bang hội để nhận thêm tấn công, phòng thủ và sinh lực.',
    'Mẹo: Đồ VIP (tím) và Truyền Kỳ (cam) rơi từ quái và Boss với tỉ lệ thấp.',
    'Mẹo: Hoàn thành Hướng Dẫn Tân Thủ để nhận vũ khí hiếm và Nguyên Bảo.'
  ];
  let splashT = 0, splashRun = true, tipI = Math.floor(Math.random() * TIPS.length);
  function splashProgress(pct, text) {
    $('splash-fill').style.width = pct + '%';
    $('splash-pct').textContent = Math.round(pct) + '%';
    if (text) $('splash-text').textContent = text;
  }
  function splashAnim() {
    if (!splashRun) return;
    splashT++;
    const cv = $('splash-run'), c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, cv.width, cv.height);
    if (G.data && Sprites.playerSprite) {
      const ids = Object.keys(G.data.classes);
      ids.forEach((id, i) => {
        const x = ((i * 64 + splashT * 1.6) % (cv.width + 64)) - 64;
        if (Assets.has(id, true)) c.drawImage(Assets.charFrame(id, 2, 'run', Math.floor(splashT / 3 + i)), Math.round(x) - 16, -12, 96, 96);
        else c.drawImage(Sprites.playerSprite(id, G.data.classes[id].colors, 2, Math.floor(splashT / 8 + i) % 4, false), Math.round(x), 8);
      });
    }
    if (splashT % 200 === 1) { $('splash-tip').textContent = TIPS[tipI++ % TIPS.length]; }
    requestAnimationFrame(splashAnim);
  }
  // Vẽ trước sprite để vào game không bị giật
  async function boot() {
    Input.applyLayout();
    requestAnimationFrame(splashAnim);
    splashProgress(5, 'Đang kết nối máy chủ...');
    try {
      G.config = await api('/api/config');
      splashProgress(25, 'Đang tải dữ liệu giang hồ...');
      G.data = await api('/api/gamedata');
    } catch (e) { G.modal('Không thể kết nối máy chủ. Vui lòng thử lại.', [{ t: 'Tải lại', fn: () => location.reload() }]); return; }
    $('online-count').textContent = G.config.online;
    // phông chữ: đợi tối đa 1,5 giây để chữ vẽ trên canvas (tên, số sát thương) dùng đúng phông ngay từ đầu
    if (document.fonts && document.fonts.load) {
      await Promise.race([Promise.all(['500 12px "Be Vietnam Pro"', '600 12px "Be Vietnam Pro"', '700 12px "Be Vietnam Pro"', '800 12px "Be Vietnam Pro"', '700 20px "Playfair Display"'].map(f => document.fonts.load(f, 'Võ Lâm').catch(() => {}))), new Promise(r => setTimeout(r, 1500))]);
      document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => Overhead.clearText && Overhead.clearText());
    }
    splashProgress(40, 'Đang tải hình ảnh...');
    await Assets.ready;
    splashProgress(92);
    splashProgress(95, 'Đang kiểm tra phiên đăng nhập...');
    let hasSession = false;
    if (G.token) {
      try { const r = await api('/api/me'); G.user = r.user; hasSession = true; }
      catch (e) { G.token = null; localStorage.removeItem('vl_token'); }
    }
    splashProgress(100, hasSession ? `Chào mừng trở lại, ${G.user.username || G.user.name}!` : 'Sẵn sàng!');
    const go = async () => {
      splashRun = false;
      await Input.goLandscape();
      if (hasSession) connect(); else showLogin();
    };
    if (!Input.isTouch || (reEnter && hasSession)) { setTimeout(go, 350); return; }   // tự vào lại sau cập nhật: không chờ chạm
    // Điện thoại: cần một lần chạm để bật toàn màn hình & khóa xoay ngang
    $('splash-start').classList.remove('hidden');
    const scr = $('screen-splash');
    scr.classList.add('ready');
    const once = () => { scr.removeEventListener('click', once); go(); };
    scr.addEventListener('click', once);
  }

  // ================== Đăng nhập / đăng ký ==================
  function setAuthTab(tab) {
    document.querySelectorAll('[data-auth]').forEach(b => b.classList.toggle('on', b.dataset.auth === tab));
    $('form-login').classList.toggle('hidden', tab !== 'login');
    $('form-register').classList.toggle('hidden', tab !== 'register');
    $('login-msg').textContent = '';
  }
  document.querySelectorAll('[data-auth]').forEach(b => b.onclick = () => setAuthTab(b.dataset.auth));
  $('li-show').onchange = () => { $('li-pass').type = $('li-show').checked ? 'text' : 'password'; };
  $('form-login').onsubmit = async e => {
    e.preventDefault();
    const username = $('li-user').value.trim(), password = $('li-pass').value;
    if (!username || !password) { $('login-msg').textContent = 'Nhập tên tài khoản và mật khẩu'; return; }
    loading(true, 'Đang đăng nhập...');
    try { loginOk(await api('/api/auth/login', { body: { username, password } })); }
    catch (err) { $('login-msg').textContent = err.message; }
    loading(false);
  };
  $('form-register').onsubmit = async e => {
    e.preventDefault();
    const username = $('rg-user').value.trim(), password = $('rg-pass').value;
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) { $('login-msg').textContent = 'Tên tài khoản 4-20 ký tự, chỉ gồm chữ không dấu, số và dấu _'; return; }
    if (password.length < 6) { $('login-msg').textContent = 'Mật khẩu tối thiểu 6 ký tự'; return; }
    if (password !== $('rg-pass2').value) { $('login-msg').textContent = 'Mật khẩu nhập lại không khớp'; return; }
    loading(true, 'Đang tạo tài khoản...');
    try { loginOk(await api('/api/auth/register', { body: { username, password } })); }
    catch (err) { $('login-msg').textContent = err.message; }
    loading(false);
  };

  function showLogin() {
    show('screen-login');
    if (G.config.maintenance) $('login-msg').textContent = '⚠ Máy chủ đang bảo trì.';
    if (G.config.devLogin) $('login-dev').classList.remove('hidden');
    if (!G.config.googleClientId) { $('google-wrap').classList.add('hidden'); return; }
    const init = () => {
      if (!window.google || !google.accounts) return setTimeout(init, 200);
      google.accounts.id.initialize({ client_id: G.config.googleClientId, callback: onGoogle, ux_mode: 'popup', auto_select: false });
      google.accounts.id.renderButton($('login-google'), { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'vi' });
    };
    init();
  }
  async function onGoogle(resp) {
    loading(true, 'Đang xác thực Google...');
    try {
      const r = await api('/api/auth/google', { body: { credential: resp.credential } });
      loginOk(r);
    } catch (e) { $('login-msg').textContent = e.message; }
    loading(false);
  }
  function loginOk(r) {
    G.token = r.token; G.user = r.user;
    localStorage.setItem('vl_token', r.token);
    connect();
  }
  $('dev-btn').onclick = async () => {
    try { loginOk(await api('/api/auth/dev', { body: { name: $('dev-name').value } })); } catch (e) { $('login-msg').textContent = e.message; }
  };
  $('logout-btn').onclick = logout;
  async function logout() {
    try { await api('/api/auth/logout', { body: {} }); } catch (e) { }
    localStorage.removeItem('vl_token');
    location.reload();
  }
  G.logout = logout;

  // ================== Tạo nhân vật (giao diện ở pregame.js) ==================
  let previewT = 0, createLoad = null;
  function showCreate() {
    show('screen-create');
    try { const last = localStorage.getItem('vl_cls'); if (last && G.data.classes[last] && !showCreate.done) Pregame.sel.cls = last; } catch (e) { }
    showCreate.done = true;
    // màn tạo nhân vật cần hình cả 9 phái: tải lúc này rồi vẽ lại một lần
    if (!createLoad) createLoad = Promise.all(Assets.CLASSES.map(c => Assets.loadClass(c))).then(() => { if ($('screen-create').classList.contains('active')) Pregame.renderCreate(); });
    Pregame.renderCreate();
  }
  function animPreview() {
    previewT++;
    const f = Math.floor(previewT / 10) % 4;
    const dir = Math.floor(previewT / 80) % 4;
    for (const [cvId, cls] of [['class-preview', Pregame.sel.cls], ['enter-preview', G.user && G.user.character && G.user.character.cls]]) {
      const cv = $(cvId);
      if (!cls || !cv.offsetParent) continue;
      const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 160, 160);
      if (Assets.has(cls)) {
        // xem trước: đứng – chạy xuống – chạy chéo – chạy ngang – đi ngang – đánh – ra chiêu
        const ph = Math.floor(previewT / 90) % 7, k = previewT % 90;
        const img = ph === 0 ? Assets.charFrame(cls, 0, 'idle', Math.floor(previewT / 12))
          : ph === 1 ? Assets.charFrame(cls, 0, 'run', Math.floor(previewT / 3))
          : ph === 2 ? Assets.charFrame(cls, 4, 'run', Math.floor(previewT / 3))
          : ph === 3 ? Assets.charFrame(cls, 2, 'run', Math.floor(previewT / 3))
          : ph === 4 ? Assets.charFrame(cls, 2, 'walk', Math.floor(previewT / 4))
          : Assets.charFrame(cls, 2, ph === 5 ? 'atk' : 'cast', Math.min(Assets.frameCount(cls, ph === 5 ? 'atk' : 'cast') - 1, Math.floor(k / 90 * 1.4 * Assets.frameCount(cls, ph === 5 ? 'atk' : 'cast'))));
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, -10, -15, 180, 180);
      } else ctx.drawImage(Sprites.playerSprite(cls, G.data.classes[cls].colors, [0, 1, 3, 2][dir], f), 0, 0, 160, 160);
    }
    if (!G.inGame) requestAnimationFrame(animPreview);
  }

  function showEnter() {
    show('screen-enter');
    const c = G.user.character;
    $('enter-name').textContent = c.name;
    const cl = G.data.classes[c.cls], b = cl.branches && cl.branches[c.branch || cl.defBranch], col = (window.LORE && LORE[c.cls] && LORE[c.cls].color) || '#ffd76a';
    $('enter-info').innerHTML = `<b style="color:${col}">${UI.esc(cl.name)}</b>${b ? ' · ' + UI.esc(b.kind) + ' – ' + UI.esc(b.name) : ''} · Cấp ${c.level}`;
    $('screen-enter').style.setProperty('--sc', col); Pregame.Scene.tint(col);
  }
  $('enter-btn').onclick = async () => {
    await Input.goLandscape();
    enterGame();
  };
  function enterGame() {
    Pregame.Scene.stop();   // tắt nền cảnh động của các màn trước khi vào game
    G.inGame = true;
    Input.inGame = true;
    show('screen-game');
    Input.applyLayout();
    G.socket.emit('enter');
    UI.initHud();
    requestAnimationFrame(loop);
  }

  // ================== Kết nối ==================
  function connect() {
    if (G.socket) return;
    loading(true, 'Đang kết nối...');
    GameAudio.init();
    const s = G.socket = io({ auth: { token: G.token }, transports: ['websocket', 'polling'] });
    function showUpdateGate(news) {
      if (document.getElementById('update-gate')) return;
      s.close();   // ngắt khỏi máy chủ: bản cũ không được chơi tiếp
      G.inGame = false; loading(false);
      const items = news && news.items && news.items.length
        ? `<div class="ug-news"><div class="ug-sub">Nội dung cập nhật${news.date ? ' ' + UI.esc(news.date) : ''}:</div><ul>${news.items.map(t => `<li>${UI.esc(t)}</li>`).join('')}</ul></div>` : '';
      const g = document.createElement('div'); g.id = 'update-gate';
      g.innerHTML = `<div class="ug-box"><div class="ug-icon">🎉</div><h2>Võ Lâm Pixel đã có phiên bản mới!</h2>
        <p>Máy chủ vừa cập nhật. Vui lòng tải lại trang để tiếp tục chơi.</p>${items}
        <button class="btn primary ug-btn">🔄 Tải lại để chơi tiếp</button></div>`;
      const wasAuto = !!G.auto;
      const reload = () => { if (G.settings.autoUpdate) try { sessionStorage.setItem('vl_reenter', JSON.stringify({ auto: wasAuto, t: Date.now() })); } catch (e) { } location.reload(); };
      g.querySelector('.ug-btn').onclick = reload;
      // chặn mọi thao tác bàn phím phía sau, Enter / Space = tải lại
      document.addEventListener('keydown', e => { e.stopImmediatePropagation(); e.preventDefault(); if (e.code === 'Enter' || e.code === 'Space') reload(); }, true);
      document.body.appendChild(g);
      if (G.settings.autoUpdate) {   // tự tải lại và vào lại game sau vài giây (giữ trạng thái Tự động)
        let n = 8;
        const p = document.createElement('p'); p.className = 'ug-auto';
        const cancel = document.createElement('button'); cancel.className = 'btn small'; cancel.textContent = 'Huỷ tự vào';
        const tick = () => { p.firstChild.textContent = `⏳ Tự tải lại và vào game sau ${n} giây${wasAuto ? ' (giữ Tự động)' : ''} `; };
        p.appendChild(document.createTextNode('')); p.appendChild(cancel);
        g.querySelector('.ug-btn').before(p); tick();
        const iv = setInterval(() => { if (--n <= 0) { clearInterval(iv); reload(); } else tick(); }, 1000);
        cancel.onclick = () => { clearInterval(iv); p.remove(); };
      }
    }
    s.on('connect', () => { loading(false); if (G.pStatic) G.pStatic.clear(); });   // kết nối mới: máy chủ gửi lại phần tĩnh của người chơi
    s.on('connect_error', err => {
      loading(false);
      const m = err.message;
      if (m === 'auth') { localStorage.removeItem('vl_token'); G.token = null; s.close(); G.socket = null; showLogin(); }
      else if (m === 'banned') { s.close(); G.modal('Tài khoản của bạn đã bị khóa.', [{ t: 'Đăng xuất', fn: logout }]); }
      else if (m === 'maintenance') { s.close(); G.modal('Máy chủ đang bảo trì, vui lòng quay lại sau.', [{ t: 'Thử lại', fn: () => location.reload() }]); }
    });
    s.on('disconnect', reason => {
      if (reason === 'io server disconnect') return;
      if (G.inGame) loading(true, 'Mất kết nối, đang kết nối lại...');
    });
    s.io.on('reconnect', () => { loading(false); });
    s.on('hello', d => {
      // máy chủ đã cập nhật bản mới: chặn chơi tiếp, bắt buộc tải lại trang để nhận bản mới
      if (d.build && window.BUILD && d.build !== window.BUILD) { showUpdateGate(d.news); return; }
      G.user = d.user;
      try { if (d.user.character) localStorage.setItem('vl_cls', d.user.character.cls); } catch (e) { }
      if (G.inGame) { if (d.user.hasChar) s.emit('enter'); return; }
      if (!d.user.hasChar) showCreate(); else { showEnter(); if (reEnter) { const ra = reEnter; reEnter = null; G._reAuto = !!ra.auto; enterGame(); } }
      requestAnimationFrame(animPreview);
    });
    s.on('kicked', d => { G.inGame = false; s.close(); G.modal(d.reason || 'Bạn đã bị ngắt kết nối', [{ t: 'Tải lại', fn: () => location.reload() }]); });
    s.on('init', d => { Market.onStalls([]); onInit(d); });   // đổi bản đồ: xoá gian hàng (máy chủ gửi lại nếu là Chợ Phiên)
    s.on('snap', onSnap);
    s.on('leave', id => G.players.delete(id));
    s.on('storyScene', d => Story.show(d));
    s.on('giftcodes', d => Gift.onView(d));
    s.on('duelReq', d => Duel.onReq(d));
    s.on('daihoi', d => DaiHoi.onState(d));
    s.on('hoason', d => HoaSon.onState(d));
    s.on('hoasonNpc', d => HoaSon.onNpc(d));
    s.on('tongkim', d => TongKim.onState(d));
    s.on('tongkimNpc', d => TongKim.onNpc(d));
    s.on('tongkimPts', d => TongKim.onPts(d));
    s.on('gmList', d => GM.onList(d));
    s.on('pin', d => UI.pin(d));
    s.on('pinOff', id => UI.pinOff(id));
    s.on('pinList', d => GM.onPins(d));
    s.on('wbTop', d => WBTop.onTop(d));
    s.on('stalls', d => Market.onStalls(d));
    s.on('stall', d => Market.onStall(d));
    s.on('mapFlags', d => DaiHoi.onFlags(d));
    s.on('daihoiPts', d => DaiHoi.onPts(d));
    s.on('duel', d => Duel.onDuel(d));
    s.on('duelRing', d => Duel.onRing(d));
    s.on('giftResult', d => Gift.onResult(d));
    s.on('me', d => { if (d._k) { if (!G.me) return s.emit('meFull'); for (const k of d._k) d[k] = G.me[k]; delete d._k; }   // phần không đổi: giữ bản cũ
      if (G.me && d.riding !== G.me.riding) GameAudio.sfx('mount'); G.me = d; if (d.pvp) G.pvpUntil = performance.now() + 8000; UI.updateHud(); if (window.GM) GM.sync(); $('dead-overlay').classList.toggle('hidden', !d.dead); });
    s.on('pos', d => { const far = Math.hypot(d.x - G.self.x, d.y - G.self.y) > 64; G.self.x = d.x; G.self.y = d.y; if (far || d.dash) G.moveTo = null; });   // lệch ít: giữ đích đang đi tới
    s.on('weather', w => Weather.set(w));
    s.on('pickClass', d => UI.pickClass(d));
    s.on('classChanged', d => UI.classChanged(d));
    s.on('cartGone', id => { G.carts.delete(id); if (G.target === id) G.target = null; });
    s.on('fx', onFx);
    s.on('ultHit', onUltHit);
    s.on('dmg', onDmg);
    s.on('gain', d => {
      if (d.exp) addFloat(G.self.x, G.self.y - 90, d.party ? `+${d.exp} KN 👥` : `+${d.exp} KN`, d.party ? '#9effb0' : '#ffe48a', 13);
      if (d.gold) { addFloat(G.self.x + 20, G.self.y - 74, `+${d.gold} 💰`, '#ffd700', 12); GameAudio.sfx('coin', 90); }
    });
    s.on('dead', d => {
      $('dead-msg').textContent = `${d.by && d.by !== '?' ? `Bạn đã bị ${d.by} đánh trọng thương.` : 'Bạn đã bị trọng thương.'}${d.lost ? ' Mất ' + d.lost + ' kinh nghiệm.' : ''}`;
      const c = d.cost || { gold: 0, knb: 0 }, me = G.me || {};
      $('revive-gold').textContent = c.gold ? `${c.gold.toLocaleString('vi-VN')} 💰` : 'Miễn phí (tân thủ)';
      $('revive-here').classList.toggle('poor', (me.gold || 0) < c.gold);
      $('revive-knb').textContent = `Hoặc hồi sinh tại chỗ bằng ${c.knb} 💎 Nguyên Bảo`;
      $('revive-knb').classList.toggle('hidden', (me.gold || 0) >= c.gold);
      $('dead-overlay').classList.remove('hidden');
      G.auto && setAuto(false);
      sfx('die');
    });
    s.on('revived', d => {
      $('dead-overlay').classList.add('hidden');
      if (d.here) GameAudio.sfx('heal');
      else UI.toast('🩸 Trọng thương: sinh lực hồi phục chậm trong 45 giây', 'error');
    });
    s.on('cd', d => { const sk = mySkills()[d.idx]; if (sk) { G.cds[sk.id] = G.cds[d.idx] = { until: performance.now() + d.until, total: d.until, id: sk.id }; } G.pending[d.idx] = 0; });
    s.on('toast', d => UI.toast(d.text, d.type));
    s.on('notice', d => G.modal((d.type === 'admin' ? '📢 Thông báo từ quản trị viên:\n' : '') + d.text));
    // chọn khu: mỗi bản đồ luyện công có 5 khu, mỗi khu tối đa 10 người
    s.on('channels', d => showChannels(d));
    function showChannels(d) {
      if (!d || !d.list.length) return UI.toast('Bản đồ này không chia khu', 'info');
      G.modal(`${d.name} – chọn khu (mỗi khu tối đa ${d.list[0].cap} người)`, d.list.map(c => ({ t: `${c.cur ? '📍 ' : ''}Khu ${c.ch} · ${c.n}/${c.cap}${c.n >= c.cap ? ' (đầy)' : ''}`, fn: () => { if (!c.cur) G.socket.emit('channel', { ch: c.ch }); } })).concat([{ t: 'Đóng' }]));
    }
    s.on('autoSrvReport', r => {
      const why = r.why === 'dead' ? ' Nhân vật bị hạ gục nên đã dừng.' : r.why === 'time' ? ' Đã đủ 8 giờ nên tự dừng.' : '';
      const text = `🤖 Máy chủ đã treo máy hộ ${r.mins} phút${r.offline ? ' lúc bạn thoát' : ''}: hạ ${r.kills} quái, ${r.gold >= 0 ? '+' : ''}${(r.gold || 0).toLocaleString('vi-VN')} lượng${r.lv > 0 ? `, lên ${r.lv} cấp (cấp ${r.lvNow})` : ''}.${why}`;
      UI.toast(text, 'reward'); UI.chatMsg({ ch: 'sys', from: 'Hệ Thống', text, t: Date.now() });
    });
    s.on('chat', d => {
      if (d.pid && Social.blocked(d.from)) return;
      UI.chatMsg(d);
      if (d.ch === 'sys' && /Boss .* đã xuất hiện/.test(d.text)) GameAudio.sfx('bossHorn', 2000);
      const e = d.pid && d.ch !== 'pm' && entityById(d.pid);   // hiện bong bóng trên đầu người nói
      if (e) e.bubble = { text: d.text, ch: d.ch, t0: performance.now(), dur: Math.min(9000, 4000 + d.text.length * 60) };
    });
    s.on('status', d => {
      const e = entityById(d.id); if (!e) return;
      const now = performance.now();
      (e.stLocal = e.stLocal || {})[d.k] = now + d.ms;
      const st = Overhead.ST[d.k];
      if (st) Overhead.add(e.x, e.y - 70, st.name, 'status', st.color);
      if (d.id === G.you && (d.k === 'stun' || d.k === 'freeze')) { G.moveTo = null; G.chase = null; }
    });
    Social.bind(s);
    Party.bind(s);
    Travel.bind(s);
    Dungeon.bind(s);
    SectUI.bind(s);
    Pet.bind(s);
    BossFX.bind(s);
    s.on('events', d => { G.events = d; UI.onEvents(d); });
    s.on('daily', d => { G.daily = d; UI.updateDaily(); });
    s.on('dropAdd', d => { if (d.om) d.ownUntil = performance.now() + d.om; G.drops.set(d.id, d); });
    s.on('noPot', d => { const now = performance.now(); if (!G.noPot[d.kind] || G.noPot[d.kind] < now) UI.toast(d.kind === 'mp' ? '⚠️ Hết bình nội lực! Hãy mua thêm ở Hiệu Thuốc.' : '⚠️ Hết bình máu! Hãy mua thêm ở Hiệu Thuốc.', 'error'); G.noPot[d.kind] = now + 20000; });
    s.on('dropDel', id => G.drops.delete(id));
    s.on('npc', d => { if (d.action === 'channel') return showChannels(d.channels); UI.openNpc(d); });   // Bia Chuyển Khu: mở thẳng bảng chọn khu
    s.on('renameFreeUsed', () => UI.renameFreeUsed());
    s.on('guild', d => UI.onGuild(d));
    s.on('lb', d => UI.onLeaderboard(d));
    s.on('eventPanel', d => UI.onEventPanel(d));
    s.on('wheelResult', d => UI.onWheel(d));
    s.on('sold', () => GameAudio.sfx('coin', 0));
    s.on('enhanceResult', d => { UI.onEnhance(d); GameAudio.sfx(d.result === 'ok' ? 'enhOk' : 'enhFail'); });
    s.on('castLock', d => { G.castLockUntil = performance.now() + (d.ms || 0); });
    s.on('gemResult', d => { UI.onGem(d); GameAudio.sfx(d.ok ? 'enhOk' : 'enhFail'); });
    s.on('online', d => UI.onOnline(d));
    s.on('adminToken', d => (G._adminWin && !G._adminWin.closed) ? (G._adminWin.location.href = '/admin/?t=' + d.token, G._adminWin = null) : G.modal('🛡️ Trang quản trị đã sẵn sàng (phiên 12 giờ).', [
      { t: 'Mở Admin Panel', cls: 'primary', fn: () => { const w = window.open('/admin/#t=' + d.token, '_blank'); if (!w) location.href = '/admin/#t=' + d.token; } },
      { t: 'Đóng' }]));
  }
  $('respawn-btn').onclick = () => G.socket.emit('respawn', { mode: 'town' });
  $('revive-here').onclick = () => G.socket.emit('respawn', { mode: 'here' });
  $('revive-knb').onclick = () => G.socket.emit('respawn', { mode: 'here_knb' });

  // ================== Dữ liệu thế giới ==================
  let minimapBase = null;
  function onInit(d) {
    G.you = d.you; G.map = d.map; G.solid = new Set(d.solid);
    G.self.x = d.x; G.self.y = d.y; G.moveTo = null; G.npcGoal = null; G.target = null; Duel.clearRings();
    G.players.clear(); G.monsters.clear(); G.drops.clear(); G.carts.clear(); G.fx = []; G.corpses = [];
    WorldArt.setMap(d.map); G._camSnap = true;
    d.drops.forEach(x => { if (x.om) x.ownUntil = performance.now() + x.om; G.drops.set(x.id, x); });
    const m = d.map;
    $('map-name').innerHTML = `${m.name} <span class="${m.pvp ? 'pvp' : m.safe ? 'safe' : 'muted'}">${m.pvp ? '[PK]' : m.safe ? '[An toàn]' : '[Cấp ' + m.lv + ']'}</span>${m.chs > 1 ? ` <b id="ch-tag" title="Đổi khu">Khu ${m.ch} ▾</b>` : ''}`;
    const ct = $('ch-tag'); if (ct) ct.onclick = e => { e.stopPropagation(); G.socket.emit('channels'); };
    Weather.set(m.weather, WorldArt.theme, true);
    // nền minimap
    const cv = document.createElement('canvas'); cv.width = m.w * 3; cv.height = m.h * 3;
    const ctx = cv.getContext('2d');
    const COL = { 0: '#4f8f33', 1: '#a07a45', 2: '#2d6fb5', 3: '#1f5a22', 4: '#666', 5: '#d9b876', 6: '#e8eef4', 7: '#888', 8: '#3a2c25', 9: '#3a7a2a', 10: '#5a9e3a', 11: '#3a2a35', 12: '#d13a0a', 13: '#bfe3f5', 14: '#2e8b57', 15: '#8b1a1a', 16: '#1f5e3a', 17: '#2a1a14' };
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { ctx.fillStyle = COL[m.tiles[y * m.w + x]] || '#000'; ctx.fillRect(x * 3, y * 3, 3, 3); }
    m.portals.forEach(p => { ctx.fillStyle = '#7fd4ff'; ctx.fillRect(p.x * 3 - 2, p.y * 3 - 2, 7, 7); });
    minimapBase = cv; G.mapBase = cv;
    UI.closePanel(); if (window.BigMap) BigMap.close(); if (window.WorldMap) { WorldMap.close(); WorldMap.onEnterMap(); } if (window.QuestNav) QuestNav.onEnterMap();
    sfx('portal');
    mapLoading(m);
    if (G._reAuto) { G._reAuto = false; setTimeout(() => { if (!G.auto) setAuto(true); }, 1500); }   // vào lại sau cập nhật: bật lại Tự động như trước
    if (document.hidden && G.auto) setTimeout(() => { if (document.hidden) setAway(true); }, 2000);   // tải lại khi đang tắt màn / ẩn trang: giao máy chủ treo hộ luôn
    sendAutoSrv();   // vào lại / đổi map: báo lại máy chủ trạng thái và cài đặt tự động (cả khi đang tắt: tự vào tổ đội cần cài đặt này)
  }
  // màn hình chờ chuyển bản đồ: tải sẵn ảnh nhân vật phái mình, ảnh quái trên bản đồ, dựng sẵn nền quanh nhân vật
  const MAP_TIPS = ['Đứng yên trong thành 30 giây sẽ tự ngồi thiền, hồi phục nhanh và lĩnh ngộ kinh nghiệm.', 'Bảng Võ Công → Hệ phái: chọn Nội công hoặc Ngoại công.',
    'Tuyệt kỹ (chiêu cấp 50) làm rung và nứt màn hình đối thủ.', 'Thợ Rèn khảm đá vào trang bị để tăng chỉ số.', 'Thách đấu sẽ đưa hai người sang Lôi Đài để tỉ thí.',
    'Đang giao tranh với người chơi, bình máu hồi chiêu 10 giây.', 'Tẩy Tủy Kinh tẩy điểm võ học, Tẩy Tiềm Năng Đan tẩy điểm tiềm năng.'];
  let mapLoadSeq = 0;
  async function mapLoading(m) {
    const seq = ++mapLoadSeq, el = $('map-loading'), t0 = performance.now();
    el.querySelector('.ml-name').textContent = m.name;
    el.querySelector('.ml-sub').textContent = m.pvp ? 'Khu vực PK' : m.safe ? 'Khu vực an toàn' : 'Cấp ' + m.lv;
    el.querySelector('.ml-tip').textContent = '💡 ' + MAP_TIPS[Math.floor(Math.random() * MAP_TIPS.length)];
    const bar = el.querySelector('.ml-bar i'); bar.style.width = '10%';
    el.classList.remove('hidden', 'out');
    G._mlCover = true;   // màn chờ che kín: tạm không vẽ cảnh, dành CPU dựng nền
    setTimeout(() => { if (seq === mapLoadSeq) G._mlCover = false; }, 12000);   // phòng hờ: không bao giờ kẹt màn đen
    const steps = [];
    if (G.me) steps.push(Assets.loadClass(G.me.cls));
    await new Promise(r => setTimeout(r, 120));   // chờ gói trạng thái đầu tiên để biết quái / người chơi trên bản đồ
    bar.style.width = '35%';
    for (const mo of G.monsters.values()) steps.push(Assets.loadMonster(mo.type));
    for (const p of G.players.values()) if (p.cls) steps.push(Assets.loadClass(p.cls));
    const tb = performance.now();
    try { await WorldArt.prebuild(G.self.x, G.self.y, W / zoom, H / zoom, f => { if (seq === mapLoadSeq) bar.style.width = (35 + f * 25).toFixed(0) + '%'; }); } catch (e) { }
    if (seq !== mapLoadSeq) return;
    if (window.PerfHud) PerfHud.mark('dựng nền map', performance.now() - tb);
    bar.style.width = '60%';
    await Promise.race([Promise.all(steps), new Promise(r => setTimeout(r, 5000))]);   // mạng chậm: tối đa 5 giây
    if (seq !== mapLoadSeq) return;
    Assets.retainMonsters([...G.monsters.values()].map(mo => mo.type).concat((G.data.maps[m.id] || {}).mons || []));
    bar.style.width = '100%';
    if (window.PerfHud) PerfHud.mark('chuyển map', performance.now() - t0);
    const left = 450 - (performance.now() - t0);
    if (left > 0) await new Promise(r => setTimeout(r, left));
    if (seq !== mapLoadSeq) return;
    G._mlCover = false;
    el.classList.add('out');
    setTimeout(() => { if (seq === mapLoadSeq) el.classList.add('hidden'); }, 300);
  }

  // trạng thái bản đồ (server/game/world.js snapshot): người chơi = phần động mỗi lần + phần tĩnh khi đổi (giữ trong G.pStatic),
  // quái dạng mảng; chỉ có những gì trong vùng nhìn thấy
  G.pStatic = new Map();
  function onSnap(d) {
    const now = performance.now();
    if (d.ps) for (const id in d.ps) G.pStatic.set(id, d.ps[id]);
    const seenP = new Set();
    for (const p of d.p) {
      const id = p[0];
      seenP.add(id);
      if (id === G.you) {
        G.self.st = p[7] || 0;
        if (G.me) { G.me.hp = p[5]; }
        continue;
      }
      let e = G.players.get(id);
      if (!e) { e = { x: p[1], y: p[2] }; G.players.set(id, e); }
      e.id = id; e.tx = p[1]; e.ty = p[2]; e.dir = p[3]; e.moving = p[4]; e.hp = p[5]; e.dead = p[6]; e.st = p[7] || 0; e.seen = now;
      const q = G.pStatic.get(id);
      if (q && e.sv !== p[8]) {
        e.sv = p[8];
        e.name = q[0]; e.cls = q[1]; e.level = q[2]; e.guild = q[3]; e.gm = q[4]; e.ap = q[5]; e.maxHp = q[6]; e.pw = q[7] || 0; e.el = q[8] || '';
        e.rk = q[9] || 0; e.k = q[10] || 0; e.pm = q[11] || 0; e.rb = q[12] || 0; e.mc = q[13] || 0; e.bf = q[14] || null; e.md = q[15] || 0; e.iv = q[16] || 0; e.tk = q[17] || 0; e.ttl = q[18] || '';
        e.apLite = null;
        if (e.cls) Assets.loadClass(e.cls);
      }
      if (p[3] === 1 || p[3] === 2) e.lastH = p[3];
    }
    for (const id of G.players.keys()) if (!seenP.has(id)) G.players.delete(id);
    const seenM = new Set();
    let odd = false;
    for (const m of d.m) {
      const id = m[0];
      seenM.add(id);
      if (!G.data.monsters[m[1]]) odd = true;
      let e = G.monsters.get(id);
      if (!e) { e = { x: m[2], y: m[3], born: now }; G.monsters.set(id, e); }
      e.id = id; e.type = m[1]; e.tx = m[2]; e.ty = m[3]; e.dir = m[4]; e.moving = m[5]; e.hp = m[6]; e.maxHp = m[7]; e.boss = m[8]; e.elite = m[9] || 0; e.event = m[10]; e.frozen = m[11]; e.st = m[12] || 0;
      if (m[4] === 1 || m[4] === 2) e.face = m[4];
    }
    if (odd) G.refreshData();   // gặp loại quái lạ: dữ liệu cũ
    for (const id of G.monsters.keys()) if (!seenM.has(id)) { G.monsters.delete(id); if (G.target === id) G.target = null; }
    // xe tiêu
    const seenC = new Set();
    for (const c of d.c || []) {
      seenC.add(c.i);
      let e = G.carts.get(c.i);
      if (!e) { e = { x: c.x, y: c.y, cart: true }; G.carts.set(c.i, e); }
      Object.assign(e, { id: c.i, tx: c.x, ty: c.y, dir: c.d, moving: c.m, hp: c.h, maxHp: c.H, t: c.t, o: c.o, u: c.u, g: c.g, name: '🛒 Xe tiêu của ' + c.o, level: { dong: 15, bac: 30, vang: 45 }[c.t] || 1 });
    }
    for (const id of G.carts.keys()) if (!seenC.has(id)) { G.carts.delete(id); if (G.target === id) G.target = null; }
  }

  // chỗ đông người (thành, Đại Hội, boss thế giới): chỉ N người gần nhất vẽ đầy đủ, còn lại e.lod = 1 (vẽ gọn, bỏ hiệu ứng chiêu)
  const lodTmp = [];
  function markLod(s) {
    const n = G.settings.gfx === 'ultra' ? 6 : Input.isTouch || gfx.weak ? 10 : 18;
    if (G.players.size <= n) { for (const e of G.players.values()) e.lod = 0; return; }
    lodTmp.length = 0;
    for (const e of G.players.values()) { e._d = (e.x - s.x) * (e.x - s.x) + (e.y - s.y) * (e.y - s.y); lodTmp.push(e); }
    lodTmp.sort((a, b) => a._d - b._d);
    for (let i = 0; i < lodTmp.length; i++) lodTmp[i].lod = i < n ? 0 : 1;
  }
  // NPC làm mục tiêu (nút đổi mục tiêu): G.target = 'npc:<id>'
  function npcEnt(id) {
    if (typeof id !== 'string' || !id.startsWith('npc:') || !G.map) return null;
    const n = G.map.npcs.find(x => 'npc:' + x.id === id);
    return n ? { id, npc: n, x: (n.x + 0.5) * TILE, y: (n.y + 0.5) * TILE + 20, name: n.name } : null;
  }
  G.npcEnt = npcEnt;
  function entityById(id) {
    if (id === G.you) return G.self;
    return G.players.get(id) || G.monsters.get(id) || G.carts.get(id);
  }

  const FX_DUR = { levelup: 1300, death: 500, aura: 900, heal: 900, ring: 550, net: 550, poison: 800, swords: 700, taiji: 900, storm: 800,
    lightning: 320, nova: 900, meteor: 1100, tornado: 1000, pillar: 1100, blades: 700, lotus: 900, dragon: 520, dash: 380, beam: 420, bite: 260 };
  const BASIC_FX = new Set(['slash', 'slash2', 'bolt', 'dart', 'lightning', 'bite']);
  FX.init(id => entityById(id));
  const FxSpawn = f => FX.spawn(f);
  function onFx(d) {
    const now = performance.now();
    if (d.t === 'dodge') { onDodge(d, now); return; }
    const src = d.from && entityById(d.from);
    if (src && d.from !== G.you) { src.atkKind = BASIC_FX.has(d.t) ? 'atk' : 'skill'; src.atkStart = now; src.atkDur = src.atkKind === 'atk' ? 300 : 440; src.atkUntil = now + src.atkDur; }
    // chiêu của người chơi khác: bỏ hiệu ứng khi người đó ở xa, đang vẽ gọn (chỗ đông) hoặc bật "Ẩn hiệu ứng chiêu của người khác"
    if (src && d.from !== G.you && G.players.has(d.from) && !ULTI[d.t] && d.t !== 'levelup' &&
      (src.lod || G.settings.hideOtherFx || Math.abs(src.x - G.self.x) > 1000 || Math.abs(src.y - G.self.y) > 700)) return;
    if (d.t === 'death' && G.monsters.has(d.id)) {   // giữ xác quái để chạy khung ngã
      const m = G.monsters.get(d.id);
      if (Assets.monsterTop(m.type)) G.corpses.push({ type: m.type, x: m.x, y: m.y, dir: m.dir, face: m.face || 2, t0: now });
    }
    const f = Object.assign({ t0: now, dur: FX_DUR[d.t] || 300 }, d);
    G.fx.push(f);
    FxSpawn(f);
    if (d.area) jhSpread(d, now);
    if (d.jh) JhFX.play(d);   // Tuyệt Kỹ Giang Hồ: vỡ màn 4 góc + tên chiêu pixel + giọng đọc
    else if (ULTI[d.t]) ulti(d);
    else if (d.ult) ultSkill(d);
    if (d.t === 'levelup' && !d.small) sfx('level');
    else fxSound(d);
  }
  // tuyệt kỹ phủ cả màn hình: rải thêm các đợt hiệu ứng khắp vùng chữ nhật quanh người ra chiêu (trễ lệch nhau),
  // lặp 3 lượt trong ~2,6 giây cho chiêu kéo dài; lượt sau rải lệch vị trí so với lượt trước
  function jhSpread(d, now) {
    const [hw, hh] = d.area, cx = d.tx != null ? d.tx : d.x, cy = d.ty != null ? d.ty : d.y;
    const base = [[-0.62, -0.5], [0.62, -0.5], [-0.62, 0.5], [0.62, 0.5], [0, -0.72], [0, 0.72], [-0.92, 0], [0.92, 0]];
    const n = Input.isTouch || gfx.weak ? 5 : base.length;   // điện thoại / máy yếu: bớt đợt cho đỡ giật
    const pts = [];
    for (let w = 0; w < 3; w++) base.slice(0, n).forEach(([ax, ay], i) => pts.push([w % 2 ? ax * 0.55 : ax, w % 2 ? ay * 0.6 : ay, w * 1000 + i * (520 / n)]));
    pts.push([0, 0, 1000], [0, 0, 2000]);   // giữa màn cũng nổ lại
    pts.forEach(([ax, ay, t0]) => {
      const dl = 90 + t0 + Math.random() * 60;
      setTimeout(() => {
        const x = cx + ax * hw + (Math.random() - 0.5) * 80, y = cy + ay * hh + (Math.random() - 0.5) * 60;
        const g = Object.assign({}, d, { t0: performance.now(), dur: FX_DUR[d.t] || 300, x, y, tx: x, ty: y, to: null, area: null, jh: 0, r: (d.r || 200) * 0.85 });
        G.fx.push(g); FxSpawn(g);
      }, dl);
    });
  }
  // tuyệt kỹ Long Ấn: rung màn 2 nhịp (gồng chiêu rồi nổ), lớp sáng theo hệ, tên chiêu chạy ngang màn hình
  const ULTI = { firedragon: 'fire', waterdragon: 'water', icedragon: 'ice', thunderdragon: 'thunder', shadowdragon: 'shadow' };
  const rumbles = [];
  G.rumble = (amp, ms) => { if (G.settings.shake) { const t = performance.now(); rumbles.push({ t0: t, t1: t + ms, amp }); } };   // rung màn (chiêu boss...)
  function ulti(d) {
    const el = ULTI[d.t], dr = G.data.dragons[el] || {}, self = d.from === G.you;
    const cx = d.tx != null ? d.tx : d.x, cy = d.ty != null ? d.ty : d.y;
    const near = Math.hypot(cx - G.self.x, cy - G.self.y);
    if (!self && near > 900) return;
    const k = self ? 1 : Math.max(0.3, 1 - near / 900), t = performance.now(), hit = dr.hitDelay || 850;
    if (G.settings.shake) {
      rumbles.push({ t0: t, t1: t + hit, amp: 5 * k, grow: true });         // gồng chiêu: rung tăng dần
      rumbles.push({ t0: t + hit, t1: t + hit + 900, amp: 20 * k });         // rồng giáng xuống: rung mạnh rồi tắt dần
    }
    setTimeout(() => { GameAudio.sfx('thunder', 0); if (navigator.vibrate && self && G.settings.shake) try { navigator.vibrate([60, 40, 120]); } catch (e) { } }, hit);
    let ov = $('ulti-ov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'ulti-ov'; ov.innerHTML = '<div class="uo-name"><b></b><small>TUYỆT KỸ · LONG ẤN</small></div>'; $('screen-game').appendChild(ov); }
    ov.className = 'el-' + el + (self ? ' self' : '');
    ov.querySelector('b').textContent = '🐉 ' + (dr.name || '').toUpperCase();
    void ov.offsetWidth; ov.classList.add('play');
    clearTimeout(ov._t); ov._t = setTimeout(() => ov.classList.remove('play'), 2200);
  }
  // tuyệt kỹ của hai hệ võ công: người ra chiêu rung mạnh 2 nhịp + màn hình nứt tại điểm giáng đòn; người đứng gần rung nhẹ
  function ultSkill(d) {
    const self = d.from === G.you;
    const wx = d.tx != null ? d.tx : d.x, wy = d.ty != null ? d.ty : d.y;
    const near = Math.hypot(wx - G.self.x, wy - G.self.y);
    if (!self) { if (near < 520 && G.settings.shake) G.rumble(7 * (1 - near / 520) + 2, 500); return; }
    const t = performance.now();
    if (G.settings.shake) {
      rumbles.push({ t0: t, t1: t + 260, amp: 6, grow: true });          // gồng chiêu
      rumbles.push({ t0: t + 260, t1: t + 1160, amp: 26 });             // giáng đòn: rung dữ rồi tắt dần
      if (navigator.vibrate) try { navigator.vibrate([40, 30, 140]); } catch (e) { }
    }
    const sk = (G.mySkills() || []).find(s => s && s.fx === d.t);
    setTimeout(() => { const p = toScreen(wx, wy - 30); UltFX.crack(p[0], p[1], d.color, false); GameAudio.sfx('thunder', 0); }, 260);
    if (sk) UltFX.banner(sk.name, d.color, false);
  }
  // trúng tuyệt kỹ của người chơi khác: rung, nứt màn, viền đỏ, tên chiêu
  function onUltHit(d) {
    if (G.settings.shake) { const t = performance.now(); rumbles.push({ t0: t, t1: t + 900, amp: 20 }); if (navigator.vibrate) try { navigator.vibrate([120, 40, 80]); } catch (e) { } }
    const p = toScreen(G.self.x, G.self.y - 40);
    UltFX.crack(p[0], p[1], d.color || '#ff4040', true);
    UltFX.banner(d.name || 'Tuyệt kỹ', d.color, true);
  }
  // toạ độ thế giới -> toạ độ màn hình (px CSS)
  function toScreen(wx, wy) { return [(wx - cam.x) * zoom, (wy - cam.y) * zoom]; }
  function rumbleAmp(now) {
    let a = 0;
    for (let i = rumbles.length - 1; i >= 0; i--) {
      const r = rumbles[i];
      if (now > r.t1) { rumbles.splice(i, 1); continue; }
      if (now < r.t0) continue;
      const p = (now - r.t0) / (r.t1 - r.t0);
      a = Math.max(a, r.amp * (r.grow ? p : (1 - p) * (1 - p)));
    }
    return a;
  }
  // khinh công: nhảy vọt lên theo đường cong rồi hạ xuống, để lại 5 bóng mờ dọc đường bay
  const JUMP_DUR = 460, JUMP_H = 46;
  const jumpLift = t => Math.sin(Math.PI * t) * JUMP_H;
  function onDodge(d, now) {
    const self = d.from === G.you, e = self ? G.self : G.players.get(d.from);
    const cls = self ? G.me && G.me.cls : e && e.cls, ap = self ? G.me && G.me.ap : e && e.ap;
    const dir = Math.abs(d.tx - d.x) > Math.abs(d.ty - d.y) ? (d.tx > d.x ? 2 : 1) : (d.ty > d.y ? 0 : 3);
    if (cls) G.ghosts.push({ cls, ap, dir, x0: d.x, y0: d.y, x1: d.tx, y1: d.ty, t0: now });
    const J = { x0: d.x, y0: d.y, x1: d.tx, y1: d.ty, t0: now, dur: JUMP_DUR };
    if (self) G.self.jump = J; else if (e) e.jump = J;
    if (self) {
      G.dash = { x0: d.x, y0: d.y, x1: d.tx, y1: d.ty, t0: now, dur: JUMP_DUR };
      G.self.dir = dir; G.moveTo = null; G.chase = null;
      if (d.ch != null) Object.assign(G.dodge, { ch: d.ch, mx: d.mx || 3, until: d.re ? now + d.re : 0, total: d.cd, pending: false });   // máy chủ xác nhận số lượt còn lại
      else Object.assign(G.dodge, { ch: 0, mx: 1, until: now + d.cd, total: d.cd, pending: false });
    } else if (e) { e.x = d.tx; e.y = d.ty; e.tx = d.tx; e.ty = d.ty; e.dir = dir; }
    const near = Math.hypot(d.x - G.self.x, d.y - G.self.y);
    if (near < 700) GameAudio.sfx('whoosh', 60, self ? null : spatial(d.x, d.y));
    FX.emit(10, d.x, d.y - 6, { speed: 60, life: 380, size: 4, color: '#c8e8ff', drag: 3 });
  }
  const ghostCache = {};
  function ghostFrame(cls, dir, ap) {
    const key = cls + dir + (ap || []).join(',');
    if (ghostCache[key]) return ghostCache[key];
    const fr = Assets.charFrame(cls, dir, 'run', 3, ap);
    const c = document.createElement('canvas'); c.width = fr.width; c.height = fr.height;
    const x = c.getContext('2d');
    x.drawImage(fr, 0, 0);
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(140,215,255,0.62)'; x.fillRect(0, 0, c.width, c.height);
    return (ghostCache[key] = c);
  }
  function drawGhosts(now) {
    G.ghosts = G.ghosts.filter(g => now - g.t0 < 800);
    for (const g of G.ghosts) {
      if (!Assets.has(g.cls)) continue;
      const fr = ghostFrame(g.cls, g.dir, g.ap), age = (now - g.t0) / 800;
      const reach = Math.min(1, (now - g.t0) / JUMP_DUR);   // bóng mờ chỉ hiện ở đoạn đã bay qua
      for (let k = 0; k < 5; k++) {
        const t = k / 5;
        if (t > reach) break;
        ctx.globalAlpha = Math.max(0, (0.32 + t * 0.45) * (1 - age * age));
        ctx.save(); ctx.translate(Math.round(g.x0 + (g.x1 - g.x0) * t), Math.round(g.y0 + (g.y1 - g.y0) * t - jumpLift(t)));
        ctx.drawImage(fr, -48, -86, 96, 96); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  function onDmg(d) {
    const e = entityById(d.id);
    if (!e) return;
    const x = e.x, y = e.y - 70, near = Math.hypot(e.x - G.self.x, e.y - G.self.y);
    if (d.k === 'miss') { Overhead.add(x, y, 'Né!', 'status', '#bfe8ff'); return; }
    if (d.k === 'reflect') { Overhead.add(x, y, 'Phản ' + d.v, 'status', '#e39bff'); e.hitAt = performance.now(); return; }   // sát thương phản đòn
    if (d.e === 1) Overhead.add(x, y - 16, 'Khắc!', 'status', '#ffd84a');
    else if (d.e === -1 && (d.id === G.you || near < 300)) Overhead.add(x, y - 16, 'Bị khắc', 'status', '#a0a0a0');
    if (d.k === 'heal' || d.k === 'mana') Overhead.add(x, y, d.v, d.k);
    else if (d.k === 'crit') {
      Overhead.add(x, y, d.v, 'crit');
      if (d.id === G.you || near < 300 || G.fx.length < 20) FX.emit(Input.isTouch ? 6 : 14, e.x, e.y - 30, { speed: 170, life: 420, size: 4, color: '#ffb020', drag: 3 });   // điện thoại: ít hạt hơn
      if (near < 600) GameAudio.sfx('crit', 80, d.id === G.you ? null : spatial(x, y));
      if (G.settings.shake && (d.id === G.you || near < 260)) shake = Math.max(shake, d.id === G.you ? 6 : 3);
    }
    else if (d.k === 'dot' || d.k === 'poison' || d.k === 'burn' || d.k === 'bleed') Overhead.add(x, y + 8, d.v, d.k);
    else if (d.id === G.you) { Overhead.add(x, y, d.v, 'hurt'); if (G.settings.shake) shake = Math.max(shake, 4); GameAudio.sfx('hurt', 150); }
    else { Overhead.add(x, y, d.v, 'hit'); if (near < 600) GameAudio.sfx('hit', 60, spatial(x, y)); }
    e.hitAt = performance.now();
  }
  function addFloat(x, y, text, color, size, bold) { G.floats.push({ x, y, text, color, size, bold, t0: performance.now() }); if (G.floats.length > 80) G.floats.shift(); }

  // ================== Âm thanh (WebAudio đơn giản) ==================
  let actx = null;
  const SFX_ALIAS = { hit: 'hit', level: 'level', portal: 'portal', die: 'die', pick: 'pick', click: 'click' };
  function sfx(kind) { GameAudio.sfx(SFX_ALIAS[kind] || kind); }
  // Âm thanh theo kiểu hiệu ứng võ công
  const FX_SOUND = { slash: 'swing', slash2: 'slash', palm: 'palm', bite: 'hurt', dart: 'throw', dartfan: 'throw', bolt: 'zap', beam: 'qi', dash: 'whoosh',
    dragon: 'roar', hanglong: 'roar', lightning: 'lightning', storm: 'thunder', thunder: 'thunder', ring: 'boom', nova: 'boom', quake: 'quake', meteor: 'boom', pillar: 'boom',
    buddha: 'holy', lionroar: 'lion', whirl: 'slash', arrowrain: 'arrows', net: 'throw', swords: 'magic', taiji: 'magic', bagua: 'magic', lotus: 'heal', holylotus: 'holy',
    blades: 'slash', tornado: 'wind', poison: 'poison', toxic: 'poison', swarm: 'poison', frost: 'ice', dragonring: 'roar', aura: 'buff', heal: 'heal',
    firedragon: ['roar', 'fire'], waterdragon: ['roar', 'water'], icedragon: ['roar', 'ice'], thunderdragon: ['roar', 'lightning'], shadowdragon: ['roar', 'magic'] };
  // âm theo vị trí: xa thì nhỏ, lệch trái/phải theo hướng
  function spatial(x, y) {
    const dx = x - G.self.x, d = Math.hypot(dx, y - G.self.y);
    return { vol: Math.max(0.15, 1 - d / 800), pan: dx / 520 };
  }
  G.spatial = spatial;
  function fxSound(d) {
    const x = d.x != null ? d.x : G.self.x, y = d.y != null ? d.y : G.self.y;
    const mine = d.from === G.you;
    if (!mine && Math.hypot(x - G.self.x, y - G.self.y) > 750) return;
    const snd = FX_SOUND[d.t];
    if (!snd) return;
    const o = mine ? null : spatial(x, y);
    if (Array.isArray(snd)) { GameAudio.sfx(snd[0], 300, o); setTimeout(() => GameAudio.sfx(snd[1], 300, o), 750); }
    else GameAudio.sfx(snd, mine ? 40 : 120, o);
  }
  // Nhạc nền theo khu vực: thành (êm), bãi luyện công (sôi động), có Boss gần / sự kiện PK đang diễn ra (hào hùng)
  const BATTLE_MAPS = new Set(['tong_kim', 'hoa_son_ld', 'dai_hoi']);
  function updateMusic() {
    if (!G.map || (window.Intro && Intro.open)) return;
    let m = G.map.safe ? 'town' : BATTLE_MAPS.has(G.map.id) ? 'battle' : 'field';
    for (const e of G.monsters.values()) if (e.boss && Math.hypot(e.x - G.self.x, e.y - G.self.y) < 900) { m = 'boss'; break; }
    GameAudio.music(m);
  }
  setInterval(updateMusic, 1000);
  const unlockAudio = () => { GameAudio.init(); window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio); };
  window.addEventListener('pointerdown', unlockAudio); window.addEventListener('keydown', unlockAudio);
  G.sfx = sfx;

  // ================== Kỹ năng / hành động ==================
  // chỉ số võ công theo cấp võ học (giống server/data/skillbooks.js)
  function scaleSkill(sk, lv) {
    if (!lv || lv <= 1) return Object.assign({}, sk);
    const k = lv - 1, out = Object.assign({}, sk);
    if (sk.mult) out.mult = Math.round(sk.mult * (1 + 0.1 * k) * 100) / 100;
    for (const f of ['heal', 'healAllies', 'healSelf']) if (sk[f]) out[f] = Math.round(sk[f] * (1 + 0.06 * k) * 1000) / 1000;
    if (sk.freeze) out.freeze = Math.round(sk.freeze * (1 + 0.05 * k));
    if (sk.passive) { out.passive = {}; for (const b in sk.passive) out.passive[b] = Math.round(sk.passive[b] * (1 + 0.1 * k) * 1000) / 1000; }
    if (sk.buff) { out.buff = {}; for (const b in sk.buff) out.buff[b] = b === 'dur' ? Math.round(sk.buff.dur * (1 + 0.05 * k)) : Math.round(sk.buff[b] * (1 + 0.05 * k) * 1000) / 1000; }
    if (sk.mp) out.mp = Math.round(sk.mp * (1 + 0.04 * k));
    return out;
  }
  G.scaleSkill = scaleSkill;
  // hệ võ công đang tu (Nội công / Ngoại công): bộ chiêu, nội công bị động, tầm đánh thường
  G.myBranch = () => { const cl = G.data.classes[G.me.cls]; return (cl.branches && (cl.branches[G.me.branch] || cl.branches[cl.defBranch])) || { skills: cl.skills, passive: cl.extra && cl.extra[1], range: cl.range }; };
  G.myRange = () => G.myBranch().range;
  // gọi nhiều lần mỗi khung (thanh kỹ năng, hồi chiêu, tự động): chỉ dựng lại khi có gói 'me' mới hoặc dữ liệu mới
  let skMemo = null, skMe = null, skData = null;
  function mySkills() {
    if (!G.me) return [];
    if (skMe === G.me && skData === G.data) return skMemo;
    skMe = G.me; skData = G.data;
    return (skMemo = buildSkills());
  }
  function buildSkills() {
    const learnedMap = G.me.skills || {};
    const br = G.myBranch();
    const list = br.skills.map((s, i) => Object.assign(scaleSkill(s, learnedMap[s.id] || 1), { idx: i, slv: learnedMap[s.id] || 1, learned: i === 0 || !!learnedMap[s.id] }));
    if (G.me.dragon && G.me.dragons && G.me.dragons[G.me.dragon]) { const d = G.data.dragons[G.me.dragon]; list[6] = Object.assign(scaleSkill(d, learnedMap[d.id] || 1), { idx: 6, slv: learnedMap[d.id] || 1, learned: true }); }
    if (G.me.jh && G.me.jhs && G.me.jhs[G.me.jh] && G.data.jianghu) { const j = G.data.jianghu[G.me.jh]; list[9] = Object.assign(scaleSkill(j, learnedMap[j.id] || 1), { idx: 9, slv: learnedMap[j.id] || 1, learned: true }); }   // Tuyệt Kỹ Giang Hồ
    [G.data.classes[G.me.cls].extra[0], br.passive].forEach((s, k) => { if (s) list[7 + k] = Object.assign(scaleSkill(s, learnedMap[s.id] || 1), { idx: 7 + k, slv: learnedMap[s.id] || 1, learned: !!learnedMap[s.id] }); });
    return list;
  }
  // ô kỹ năng 1..6 -> chỉ số võ công (0 = trống)
  G.useSlot = n => { const idx = G.me && G.me.hotbar ? G.me.hotbar[n - 1] : n; if (idx) useSkill(idx); };
  G.mySkills = mySkills;
  // hồi chiêu tính theo từng kỹ năng (ô Long Ấn có thể đổi rồng)
  function skillCd(i) { const sk = mySkills()[i]; return sk ? G.cds[sk.id] : null; }
  G.skillCd = skillCd;
  function skillReady(i) { const c = skillCd(i); return !c || c.until <= performance.now(); }
  G.skillReady = skillReady;

  function useSkill(i) {
    if (!G.me || G.me.dead || !G.map) return;
    if (Overhead.mask(G.self, performance.now()) & 3) return;
    const sk = mySkills()[i];
    if (!sk) return;
    if (sk.type === 'passive') { UI.toast(`${sk.name} là nội công bị động, luôn có hiệu lực khi đã học`, 'info'); return; }
    if (!sk.learned) { UI.toast(`Chưa học ${sk.name}. Mua sách tại Tàng Kinh Các (Tương Dương).`, 'error'); return; }
    if (G.me.level < sk.lv) { if (i > 0) UI.toast(`Cần cấp ${sk.lv} để dùng ${sk.name}`, 'error'); return; }
    if (!skillReady(i)) return;
    const now = performance.now();
    if (G.pending[i] && now - G.pending[i] < 300) return;
    if (i === 0 || (sk.type !== 'buff' && sk.type !== 'heal')) {
      if (G.map.safe && !Duel.fighting()) { if (i > 0 || !G._safeWarn || now - G._safeWarn > 3000) { UI.toast('Không thể giao chiến trong thành', 'error'); G._safeWarn = now; } return; }
      const t = validTarget() || pickTarget(Math.max(sk.range || 0, G.myRange()) + 40);
      if (!t && (sk.type === 'single' || sk.type === 'dot')) {
        // không có mục tiêu: chạy tới quái gần nhất trong 350px
        const near = nearestEnemy(350);
        if (near) { G.target = near.id; G.chase = { id: near.id, skill: i }; }
        return;
      }
    }
    G.pending[i] = now;
    G.self.atkKind = i ? 'skill' : 'atk'; G.self.atkStart = now; G.self.atkDur = i ? 440 : 300; G.self.atkUntil = now + G.self.atkDur;
    G.socket.emit('skill', { idx: i, target: G.target });
  }
  G.useSkill = useSkill;

  function enemies() {
    const list = [];
    for (const m of G.monsters.values()) if (!TongKim.friendly(m)) list.push(m);   // lính cùng phe Tống Kim: không nhắm
    for (const p of G.players.values()) if (Escort.canHarm(p)) list.push(p);
    for (const c of G.carts.values()) if (Escort.canHitCart(c)) list.push(c);
    return list;
  }
  function nearestEnemy(range, exclude) {
    let best = null, bd = range;
    for (const e of enemies()) {
      if (e.id === exclude) continue;
      const d = Math.hypot(e.x - G.self.x, e.y - G.self.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function validTarget() {
    if (!G.target) return null;
    const pl = G.players.get(G.target), ct = G.carts.get(G.target);
    const mt = G.monsters.get(G.target), e = (mt && !TongKim.friendly(mt) ? mt : null) || (pl && Escort.canHarm(pl) ? pl : null) || (ct && Escort.canHitCart(ct) ? ct : null);
    if (!e || e.dead) { G.target = null; return null; }
    return e;
  }
  function pickTarget(range) {
    const t = nearestEnemy(range);
    if (t) G.target = t.id;
    return t;
  }
  // nút / phím đổi mục tiêu: lần lượt mọi thứ ở gần (kẻ địch, người chơi khác, xe tiêu, NPC), gần trước xa sau
  function cycleTarget() {
    const all = [...enemies()];
    for (const p of G.players.values()) if (!all.includes(p)) all.push(p);
    if (G.map) for (const n of G.map.npcs) { const e = npcEnt('npc:' + n.id); if (e) all.push(e); }
    const list = all.map(e => ({ e, d: Math.hypot(e.x - G.self.x, e.y - G.self.y) })).filter(x => x.d < 600).sort((a, b) => a.d - b.d);
    if (!list.length) { G.target = null; return; }
    const i = list.findIndex(x => x.e.id === G.target);
    G.target = list[(i + 1) % list.length].e.id;
  }
  // vật phẩm (không tính tiền) gần nhất, nhặt được ngay
  function nearItem(r) {
    let best = null, bd = r, now = performance.now();
    for (const dr of G.drops.values()) {
      if (dr.gold || (dr.o && dr.o !== (G.user && G.user.id) && dr.ownUntil > now)) continue;
      const d = Math.hypot(dr.x - G.self.x, dr.y - G.self.y);
      if (d < bd) { bd = d; best = dr; }
    }
    return best;
  }
  G.nearItem = nearItem;
  function pickNear() {
    const dr = nearItem(150);
    if (!dr) return false;
    if (Math.hypot(dr.x - G.self.x, dr.y - G.self.y) < 80) G.socket.emit('pickup', { id: dr.id });
    else { G.pickGoal = dr.id; G.moveTo = { x: dr.x, y: dr.y }; }
    return true;
  }
  G.pickNear = pickNear;
  function interact() {
    if (!G.map) return;
    if (pickNear()) return;   // phím F: ưu tiên nhặt vật phẩm ở gần
    let best = null, bd = TILE * 3;
    for (const n of G.map.npcs) {
      const d = Math.hypot((n.x + 0.5) * TILE - G.self.x, (n.y + 0.5) * TILE - G.self.y);
      if (d < bd) { bd = d; best = n; }
    }
    if (best) G.socket.emit('npc', { id: best.id });
    else UI.toast('Không có NPC ở gần', 'error');
  }
  function setAuto(on) {
    G.auto = on;
    const b = $('btn-auto');
    b.classList.toggle('on', on);
    b.title = on ? 'Tắt tự động đánh (R)' : 'Bật tự động đánh (R)';
    if (on && G.map && G.map.safe && !G._duelWith) UI.toast('Hãy ra bãi luyện công để dùng tự động đánh', 'error');
    G.autoHome = on ? { x: G.self.x, y: G.self.y } : null;
    sendAutoSrv();
  }
  G.setAuto = setAuto;
  $('btn-auto').onclick = () => setAuto(!G.auto);
  setTimeout(() => setAuto(false), 0);

  Input.on('skill', i => { G.moveTo = null; useSkill(i); });
  Input.on('slot', n => { G.moveTo = null; G.useSlot(n); });
  Input.on('potion', k => G.socket && G.socket.emit('quickUse', { kind: k }));
  Input.on('target', cycleTarget);
  Input.on('interact', interact);
  Input.on('pickup', () => { if (!pickNear()) UI.toast('Không có vật phẩm ở gần', 'error'); });
  Input.on('auto', () => setAuto(!G.auto));
  Input.on('mount', () => G.socket && G.socket.emit('mount', { op: 'ride' }));
  Input.on('meditate', () => G.socket && G.me && !G.me.dead && G.socket.emit('meditate'));
  // Khinh công (nhảy vọt): theo hướng đang đi, không đi thì theo hướng đang nhìn
  // số lượt khinh công hiện có (tích tối đa 3, hồi lần lượt từng lượt)
  G.dodgeCh = now => { const s = G.dodge; while (s.until && now >= s.until) { s.ch++; s.until = s.ch < s.mx ? s.until + s.total : 0; } return s.ch; };
  Input.on('dodge', () => {
    const now = performance.now();
    if (!G.socket || !G.me || G.me.dead || G.dash || G.dodgeCh(now) <= 0 || now - G.dodge.at < 380) return;
    if (Overhead.mask(G.self, now) & 3) return;
    let v = Input.vector();
    if (Math.hypot(v.x, v.y) < 0.1 && G.moveTo) { const dx = G.moveTo.x - G.self.x, dy = G.moveTo.y - G.self.y, d = Math.hypot(dx, dy) || 1; v = { x: dx / d, y: dy / d }; }
    if (Math.hypot(v.x, v.y) < 0.1) v = [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }][G.self.dir || 0];
    G.socket.emit('dodge', { x: v.x, y: v.y });
    const s = G.dodge; s.ch--; s.at = now; if (!s.until) s.until = now + s.total;   // trừ trước, máy chủ xác nhận sau
  });
  Input.on('panel', n => UI.togglePanel(n));
  Input.on('tlist', () => Targets.toggle());
  Input.on('bigmap', () => { BigMap.close(); WorldMap.toggle(); });
  Input.on('escape', () => { if (WorldMap.open_) WorldMap.close(); else if (BigMap.open_) BigMap.close(); else if (Targets.open_) Targets.close(); else UI.closePanel(); });
  Input.on('chat', () => UI.focusChat());
  Input.on('joymove', () => { G.moveTo = null; G.npcGoal = null; G.chase = null; QuestNav.cancel(); });
  Input.on('toast', t => UI.toast(t));
  Input.on('resize', resize);

  // ================== Nhấp/chạm vào màn hình ==================
  const canvas = $('game');
  const ctx = canvas.getContext('2d', { alpha: false });   // nền luôn được tô kín: bỏ kênh trong suốt cho trình duyệt ghép hình nhanh hơn
  let W = 0, H = 0, DPR = 1, zoom = 1, cam = { x: 0, y: 0 }, shake = 0;
  // ---------- chất lượng đồ họa ----------
  // Số điểm ảnh phải vẽ là chi phí lớn nhất trên điện thoại. 'auto': bắt đầu ở mức vừa (điện thoại) / cao (PC),
  // đo thời gian khung hình rồi tự hạ độ phân giải khi giật, nâng lại khi mượt ổn định.
  // dưới 1: vẽ ít điểm ảnh hơn màn hình rồi phóng lên (hình pixel nhìn gần như không khác) – cứu điện thoại rất yếu
  const GFX_STEPS = [2, 1.75, 1.5, 1.25, 1, 0.85, 0.75];
  const GFX_FIXED = { high: 2, medium: 1.5, low: 1, ultra: 0.6 };
  const GFX_MIN = 0.6;
  // máy yếu (ít RAM / ít nhân CPU): vào thẳng mức thấp thay vì bắt đầu ở mức vừa rồi giật vài giây mới tự hạ
  const weak = (() => { if (!Input.isTouch) return 0; const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8; return mem <= 2 && cores <= 4 ? 2 : mem <= 3 || cores <= 4 ? 1 : 0; })();   // chỉ điện thoại / máy tính bảng
  const GFX_START = () => GFX_FIXED[G.settings.gfx] || (weak === 2 ? 0.85 : weak ? 1 : Input.isTouch ? 1.5 : 2);
  const gfx = { scale: 1.5, lowFx: false, win: [], since: 0, fail: {}, weak };
  G.gfx = gfx;
  // Tiết kiệm pin (mặc định bật trên thiết bị cảm ứng): khóa 30 FPS, độ nét tối đa 1,5x, 20 FPS khi để yên lâu.
  // Không đổi cách chơi: di chuyển / hồi chiêu tính theo thời gian thật, chỉ vẽ ít khung hơn.
  const battery = () => G.settings.battery == null ? Input.isTouch : !!G.settings.battery;
  G.battery = battery;
  function gfxCap() { return Math.min(window.devicePixelRatio || 1, battery() ? 1.5 : 2); }
  function gfxApply(scale) {
    gfx.scale = Math.max(GFX_MIN, Math.min(gfxCap(), scale));
    // hiệu ứng tiết kiệm: ít hạt thời tiết / hiệu ứng, bỏ lớp ám màu kiểu 'overlay'
    const mode = G.settings.gfx || 'auto';
    gfx.lowFx = mode === 'low' || mode === 'ultra' || (mode === 'auto' && (gfx.scale <= 1.25 || weak === 2)) || !!G.settings.lowfx;
    gfx.fx = mode === 'ultra' ? 0.25 : mode === 'low' || G.settings.lowfx ? 0.4 : gfx.lowFx ? 0.55 : mode === 'high' ? 1 : (Input.isTouch ? 0.8 : 1);
    document.body.classList.toggle('lowfx', !!G.settings.lowfx);
    document.body.classList.toggle('calm', !!G.settings.lowfx || battery());   // dừng hoạt ảnh CSS lặp trang trí (cuối style.css)
    resize();
  }
  G.setGfx = mode => {
    G.settings.gfx = mode; G.saveSettings();
    gfx.fail = {}; gfx.win = []; gfx.since = performance.now();
    gfxApply(GFX_START());
  };
  G.setBattery = on => { G.settings.battery = !!on; G.saveSettings(); gfx.fail = {}; gfx.win = []; gfx.since = performance.now(); gfxApply(GFX_START()); };
  G.setLowFx = on => { G.settings.lowfx = !!on; G.saveSettings(); gfxApply(gfx.scale); };
  // gọi mỗi khung hình với thời gian khung (ms)
  function gfxTick(ms, now) {
    if ((G.settings.gfx || 'auto') !== 'auto' || document.hidden) return;
    gfx.win.push(Math.min(ms, 120));
    if (gfx.win.length < 90) return;          // ~1,5 giây mỗi lần đánh giá
    const w = gfx.win.slice().sort((a, b) => a - b), med = w[w.length >> 1], p90 = w[Math.floor(w.length * 0.9)];
    gfx.win = [];
    const i = GFX_STEPS.findIndex(v => v <= gfx.scale + 1e-6), k = gfx.k || 1;   // k: khóa 30 FPS thì ngưỡng x2
    if ((med > 22 * k || p90 > 40 * k) && gfx.scale > GFX_STEPS[GFX_STEPS.length - 1] + 1e-6) {            // dưới ~45 FPS: hạ một bậc
      gfx.fail[gfx.scale] = (gfx.fail[gfx.scale] || 0) + 1;
      gfx.since = now; gfxApply(GFX_STEPS[Math.min(GFX_STEPS.length - 1, i + 1)]);
    } else if (med < 17.5 * k && p90 < 22 * k && i > 0 && now - gfx.since > 12000) {   // mượt liên tục 12 giây: thử nâng
      const up = GFX_STEPS[i - 1];
      if (up <= gfxCap() && (gfx.fail[up] || 0) < 2) { gfx.since = now; gfxApply(up); }
    }
  }
  function resize() {
    const s = Input.size();
    W = s.w; H = s.h;
    DPR = Math.min(gfxCap(), gfx.scale);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    // gần hơn để thấy rõ nhân vật; Cài đặt → Đồ họa → Độ rộng góc nhìn (G.settings.view: 0.8–1.5, lớn = nhìn rộng hơn)
    zoom = Math.max(0.8, Math.min(1.6, Math.min(W / (TILE * 12), H / (TILE * 6.6)))) / Math.max(0.8, Math.min(1.5, G.settings.view || 1));
  }
  window.addEventListener('load', resize);
  G.setView = v => { G.settings.view = Math.max(0.8, Math.min(1.5, +v || 1)); G.saveSettings(); resize(); G._camSnap = true; };
  gfx.since = performance.now();
  gfxApply(GFX_START());

  // toạ độ thế giới -> toạ độ màn hình (màn ngang, không xoay) – dùng cho kiểm thử / gợi ý
  G.toScreen = (x, y) => { const r = canvas.getBoundingClientRect(); return { x: r.left + (x - cam.x) * zoom, y: r.top + (y - cam.y) * zoom }; };
  function screenToWorld(cx, cy) {
    const p = Input.toLocal(cx, cy);
    return { x: p.x / zoom + cam.x, y: p.y / zoom + cam.y };
  }
  // người chơi dưới con trỏ / ngón tay
  function playerAt(w) {
    let best = null, bd = 40;
    for (const p of G.players.values()) { const d = Math.hypot(w.x - p.x, w.y - (p.y - 26)); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  // điện thoại: bấm giữ 1,5 giây vào người chơi mới mở bảng Xem thông tin / Kết bạn / Thách đấu (chạm 1 lần chỉ chọn mục tiêu)
  const HOLD_MS = 1500;
  let holdT = 0, holdAt = null;
  function cancelHold() { clearTimeout(holdT); holdT = 0; holdAt = null; G.holdRing = null; }
  canvas.addEventListener('pointermove', e => { if (holdAt && Math.hypot(e.clientX - holdAt.x, e.clientY - holdAt.y) > 14) cancelHold(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(ev, cancelHold);
  canvas.addEventListener('pointerdown', e => {
    if (!G.map) return;
    const w = screenToWorld(e.clientX, e.clientY);
    // máy tính: chuột phải vào người chơi = bảng tương tác; chuột phải chỗ khác không làm gì
    if (e.button === 2) { const p = playerAt(w); if (p) Social.menu(p, e.clientX, e.clientY); return; }
    { const st = Market.hit(w.x, w.y); if (st) { Market.openStall(st); return; } }   // gian hàng ở Chợ Phiên
    // NPC
    for (const n of G.map.npcs) {
      const nx = (n.x + 0.5) * TILE, ny = (n.y + 0.5) * TILE;
      if (Math.abs(w.x - nx) < 30 && w.y > ny - 70 && w.y < ny + 12) {
        G.npcGoal = n; G.moveTo = { x: nx, y: ny + 40 }; return;
      }
    }
    // Vật phẩm rơi: bấm vào để đi tới nhặt
    for (const dr of G.drops.values()) {
      if (dr.gold || Math.abs(w.x - dr.x) > 22 || Math.abs(w.y - (dr.y - 6)) > 22) continue;
      G.pickGoal = dr.id; G.moveTo = { x: dr.x, y: dr.y }; G.chase = null; G.npcGoal = null; return;
    }
    // Quái / người chơi
    let best = null, bd = 48;
    for (const e2 of [...G.monsters.values(), ...G.players.values(), ...G.carts.values()]) {
      const mt = e2.type ? Assets.monsterTop(e2.type) : 0;
      const r = mt ? Math.max(30, mt * 0.6) : e2.boss ? 70 : 40;
      const d = Math.hypot(w.x - e2.x, w.y - (e2.y - (mt ? mt * 0.45 : e2.boss ? 50 : 26)));
      if (d < Math.max(bd, r) && d < r) { bd = d; best = e2; }
    }
    if (best) {
      const isPl = G.players.has(best.id);
      // bấm trái / chạm 1 lần = chọn mục tiêu (kẻ địch thì đuổi theo đánh); bảng tương tác: chuột phải hoặc bấm giữ 1,5 giây
      const hostile = isPl ? Escort.canHarm(best) : best.cart ? Escort.canHitCart(best) : true;
      if (isPl && e.pointerType !== 'mouse') {
        cancelHold(); holdAt = { x: e.clientX, y: e.clientY };
        G.holdRing = { id: best.id, t0: performance.now(), dur: HOLD_MS };
        const who = best, cx = e.clientX, cy = e.clientY;
        holdT = setTimeout(() => { cancelHold(); G.chase = null; Social.menu(who, cx, cy); if (navigator.vibrate) try { navigator.vibrate(30); } catch (er) { } }, HOLD_MS);
      }
      G.target = best.id;
      if (hostile) { if (!Input.isTouch || e.detail >= 1) G.chase = { id: best.id, skill: 0 }; }
      return;
    }
    if (!Input.isTouch) { G.moveTo = { x: w.x, y: w.y }; G.chase = null; G.npcGoal = null; G.clickMark = { x: w.x, y: w.y, t0: performance.now() }; }
  });

  // ================== Vòng lặp chính ==================
  let last = performance.now(), lastSend = 0, lastSent = { x: 0, y: 0, m: false }, frameT = 0, lastMini = 0, stuckT = 0;

  function solidAt(x, y) {
    const m = G.map;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
    return G.solid.has(m.tiles[ty * m.w + tx]);
  }
  function blocked(x, y) { return solidAt(x - 12, y - 6) || solidAt(x + 12, y - 6) || solidAt(x - 12, y + 6) || solidAt(x + 12, y + 6) || solidAt(x, y) || HoaSon.blocked(x, y); }

  // ---------- Tìm đường cho nhân vật (bấm đi tới, tự động đánh, tự nhặt đồ): vướng vật cản thì đi vòng ----------
  function clearPath(x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 12);
    for (let i = 1; i <= n; i++) { const t = i / n; if (blocked(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
    return true;
  }
  let navBuf = null;
  function findPath(x0, y0, x1, y1) {
    const m = G.map, W = m.w, H = m.h, N = W * H;
    const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !G.solid.has(m.tiles[y * W + x]);
    const sx = Math.floor(x0 / TILE), sy = Math.floor(y0 / TILE);
    let gx = Math.floor(x1 / TILE), gy = Math.floor(y1 / TILE);
    if (!free(gx, gy)) {
      let best = null;
      for (let r = 1; r <= 2 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!best && free(gx + dx, gy + dy)) best = [gx + dx, gy + dy];
      if (!best) return null; [gx, gy] = best;
    }
    if (!navBuf || navBuf.prev.length !== N) navBuf = { prev: new Int32Array(N), seen: new Uint32Array(N), gen: 0 };
    const gen = ++navBuf.gen, start = sy * W + sx, goal = gy * W + gx, q = [start];
    navBuf.seen[start] = gen; navBuf.prev[start] = -1;
    let found = false;
    for (let h = 0; h < q.length && h < 6000; h++) {
      const cur = q[h]; if (cur === goal) { found = true; break; }
      const cx = cur % W, cy = (cur - cx) / W;
      for (let k = 0; k < 8; k++) {
        const dx = [1, -1, 0, 0, 1, 1, -1, -1][k], dy = [0, 0, 1, -1, 1, -1, 1, -1][k], nx = cx + dx, ny = cy + dy;
        if (!free(nx, ny) || (dx && dy && (!free(cx + dx, cy) || !free(cx, cy + dy)))) continue;
        const ni = ny * W + nx; if (navBuf.seen[ni] === gen) continue;
        navBuf.seen[ni] = gen; navBuf.prev[ni] = cur; q.push(ni);
      }
    }
    if (!found) return null;
    const pts = [];
    for (let i = goal; i !== start && i >= 0; i = navBuf.prev[i]) pts.push({ x: (i % W + 0.5) * TILE, y: (Math.floor(i / W) + 0.5) * TILE });
    return pts.reverse();
  }
  const nav = { key: null, pts: null, t: 0 };
  // điểm cần hướng tới lúc này để đi tới goal (điểm trung gian của đường vòng, hoặc chính goal nếu đi thẳng được)
  function steer(goal, now) {
    const s = G.self;
    if (clearPath(s.x, s.y, goal.x, goal.y)) { nav.pts = null; return goal; }
    const key = Math.floor(goal.x / TILE) + ',' + Math.floor(goal.y / TILE);
    if (!nav.pts || nav.key !== key || now - nav.t > 1200) {
      if (nav.key === key && nav.fail && now - nav.t < 1500) return goal;   // vừa tìm không ra: đừng tìm lại liên tục
      nav.pts = findPath(s.x, s.y, goal.x, goal.y); nav.key = key; nav.t = now; nav.fail = !nav.pts;
      if (!nav.pts) return goal;
    }
    while (nav.pts.length > 1 && clearPath(s.x, s.y, nav.pts[1].x, nav.pts[1].y)) nav.pts.shift();
    if (nav.pts.length && Math.hypot(nav.pts[0].x - s.x, nav.pts[0].y - s.y) < 10) nav.pts.shift();
    return nav.pts[0] || goal;
  }

  function update(dt) {
    Input.pollGamepad();
    const now = performance.now();
    const s = G.self;
    if (!G.me || !G.map) return;
    const dead = G.me.dead;
    const myMask = Overhead.mask(s, now);
    const cc = !!(myMask & 3);   // choáng / đóng băng: không đi, không đánh được
    if (G.dash) {   // đang lướt: trượt nhanh tới điểm đích
      const p = Math.min(1, (now - G.dash.t0) / G.dash.dur);
      s.x = G.dash.x0 + (G.dash.x1 - G.dash.x0) * p; s.y = G.dash.y0 + (G.dash.y1 - G.dash.y0) * p; s.moving = true;
      if (p >= 1) { G.dash = null; lastSent = { x: s.x, y: s.y, m: false }; lastSend = now; }
      return;
    }
    let v = dead || cc ? { x: 0, y: 0 } : Input.vector();
    const manual = Math.hypot(v.x, v.y) > 0.01;
    if (manual) { G.moveTo = null; G.npcGoal = null; G.chase = null; QuestNav.cancel(); }

    // Đuổi theo mục tiêu để đánh
    if (!manual && G.chase && !dead && !cc) {
      const t = G.monsters.get(G.chase.id) || G.players.get(G.chase.id);
      if (!t || t.dead) G.chase = null;
      else {
        const sk = mySkills()[G.chase.skill] || mySkills()[0];
        const range = (sk.range || G.myRange()) * 0.85;
        const d = Math.hypot(t.x - s.x, t.y - s.y);
        if (d > range) G.moveTo = { x: t.x, y: t.y, chase: true };
        else { G.moveTo = null; useSkill(G.chase.skill); if (G.chase.skill !== 0) G.chase.skill = 0; }
      }
    }
    if (manual) G.follow = null;
    if (G.follow && !manual && !dead && !cc && !G.chase) {   // đi theo người chơi khác
      const f = G.players.get(G.follow);
      if (!f) G.follow = null;
      else if (Math.hypot(f.x - s.x, f.y - s.y) > 70) G.moveTo = { x: f.x, y: f.y + 10 };
      else G.moveTo = null;
    }
    autoPotion(now);
    if (G.auto && !manual && !dead && !cc) autoPlay(now);
    if ((Input.attackHeld || Input.padAttack) && !dead && !cc) useSkill(0);

    if (!manual && G.moveTo && !cc) {
      const d = Math.hypot(G.moveTo.x - s.x, G.moveTo.y - s.y);
      if (d < 8) { G.moveTo = null; nav.pts = null; }
      else { const w = steer(G.moveTo, now), wx = w.x - s.x, wy = w.y - s.y, wd = Math.hypot(wx, wy) || 1; v = { x: wx / wd, y: wy / wd }; }
    }
    if (G.npcGoal) {
      const nx = (G.npcGoal.x + 0.5) * TILE, ny = (G.npcGoal.y + 0.5) * TILE;
      if (Math.hypot(nx - s.x, ny - s.y) < TILE * 2) { G.socket.emit('npc', { id: G.npcGoal.id }); G.npcGoal = null; G.moveTo = null; v = { x: 0, y: 0 }; }
    }
    const pg = G.pickGoal || G.autoDrop;
    if (pg && now - (G._pickT || 0) > 350) {
      const dr = G.drops.get(pg);
      if (!dr) { if (G.pickGoal === pg) G.pickGoal = null; }
      else if (Math.hypot(dr.x - s.x, dr.y - s.y) < 44 && !dr.gold) {
        // đã gọi nhặt mà 1,5 giây sau vẫn còn (đồ của người khác, túi đầy...) thì bỏ qua món này một lúc, không đứng nhặt mãi
        if (G._pickTry && G._pickTry.id === pg && now - G._pickTry.t > 1500) { G.dropSkip.set(pg, now + 20000); G._pickTry = null; if (G.autoDrop === pg) { G.autoDrop = null; G.moveTo = null; } }
        else { if (!G._pickTry || G._pickTry.id !== pg) G._pickTry = { id: pg, t: now }; G.socket.emit('pickup', { id: pg }); G._pickT = now; }
        if (G.pickGoal === pg) { G.pickGoal = null; G.moveTo = null; v = { x: 0, y: 0 }; }
      }
    }
    if (manual) G.pickGoal = null;
    const casting = G.castLockUntil && performance.now() < G.castLockUntil;   // đánh xa: đứng yên lúc vận chiêu
    const moving = !casting && Math.hypot(v.x, v.y) > 0.01;
    if (moving) {
      const spd = (G.me.stats.spd || 150) * dt * (myMask & 16 ? 0.55 : 1);
      const nx = s.x + v.x * spd, ny = s.y + v.y * spd;
      const ox = s.x, oy = s.y;
      if (!blocked(nx, ny)) { s.x = nx; s.y = ny; }
      else if (!blocked(nx, s.y)) s.x = nx;
      else if (!blocked(s.x, ny)) s.y = ny;
      else if (Math.abs(v.x) > Math.abs(v.y)) { // trượt quanh góc
        if (!blocked(nx, s.y - spd)) s.y -= spd; else if (!blocked(nx, s.y + spd)) s.y += spd;
      } else { if (!blocked(s.x - spd, ny)) s.x -= spd; else if (!blocked(s.x + spd, ny)) s.x += spd; }
      if (Math.abs(v.x) > Math.abs(v.y)) s.dir = v.x > 0 ? 2 : 1; else s.dir = v.y > 0 ? 0 : 3;
      const movedD = Math.hypot(s.x - ox, s.y - oy);
      if (movedD < spd * 0.2) { stuckT += dt; if (stuckT > 0.8 && G.moveTo) { G.moveTo = null; G.chase = null; if (G.autoDrop) { G.dropSkip.set(G.autoDrop, now + 15000); G.autoDrop = null; } else if (G.auto) G.autoBlacklist = { id: G.target, until: now + 4000 }; G.target = G.auto ? null : G.target; } }
      else stuckT = 0;
    } else stuckT = 0;
    // Quay mặt về mục tiêu khi đánh
    const t = G.target && (G.monsters.get(G.target) || G.players.get(G.target));
    if (t && s.atkUntil > now) { const dx = t.x - s.x, dy = t.y - s.y; s.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3); }
    s.moving = moving;

    // Gửi vị trí 15 lần/giây
    if (now - lastSend > 66 && (Math.abs(s.x - lastSent.x) > 0.5 || Math.abs(s.y - lastSent.y) > 0.5 || moving !== lastSent.m || now - lastSend > 1000)) {
      G.socket.emit('move', { x: Math.round(s.x * 10) / 10, y: Math.round(s.y * 10) / 10, d: s.dir, m: moving ? 1 : 0 });
      lastSend = now; lastSent = { x: s.x, y: s.y, m: moving };
    }

    // Nội suy thực thể khác
    const k = Math.min(1, dt * 10);
    for (const e of G.players.values()) { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; }
    for (const e of G.monsters.values()) { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; }
    for (const e of G.carts.values()) { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; }
  }

  // ===== Cài đặt tự động =====
  const AUTO_DEF = { pickPots: true, pickMats: true, pickup: true, pickGold: true, pickMin: 'common', pickBooks: true, hp: true, hpPct: 50, mp: true, mpPct: 25, potAlways: true, townLow: false, townPct: 15, skills: true, range: 700, partyAuto: false, partyFrom: 'all' };
  function autoCfg() { return Object.assign({}, AUTO_DEF, G.autoCfg); }
  G.autoCfgGet = autoCfg;
  G.autoCfgSet = (k, v) => { G.autoCfg[k] = v; try { localStorage.setItem('vl_auto', JSON.stringify(G.autoCfg)); } catch (e) {} sendAutoSrv(); };
  G.noPot = {};
  const RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };
  G.dropSkip = new Map();
  function pickableDrop(now, home, cfg) {
    const s = G.self, invFull = G.me.inv.length >= (G.me.invMax || 48);   // túi đã mở rộng thì tính theo số ô thật
    if (invFull && now - (G._fullWarn || 0) > 90000) { G._fullWarn = now; UI.toast('🎒 Túi đồ đầy – tự động chỉ nhặt ngân lượng và vật phẩm cộng dồn được. Hãy bán / vứt bớt đồ.', 'error'); }
    let best = null, bd = 460;
    for (const dr of G.drops.values()) {
      if (dr.o && dr.o !== G.user.id && dr.ownUntil > now) continue;          // đồ của người khác
      if ((G.dropSkip.get(dr.id) || 0) > now) continue;                      // không tới được
      if (dr.gold) { if (!cfg.pickGold) continue; }
      else {
        const it = G.data.items[UI.resolveId ? UI.resolveId(dr.item) : dr.item] || G.data.items[dr.item]; if (!it) continue;
        const isBook = /^sk_|^book_/.test(dr.item) || !!(it.effect && it.effect.learn);
        if (it.type === 'equip') { if ((RANK[it.rarity] || 0) < (RANK[cfg.pickMin] || 0)) continue; }   // lọc phẩm chất chỉ áp cho trang bị
        else if (isBook) { if (!cfg.pickBooks) continue; }
        else if (it.type === 'use' && it.effect && (it.effect.hp || it.effect.mp || it.effect.hpPct || it.effect.mpPct)) { if (!cfg.pickPots) continue; }   // bình máu / nội lực
        else if (!cfg.pickMats) continue;   // đá, nguyên liệu, rương, vật phẩm khác
        if (invFull && !(it.type !== 'equip' && G.me.inv.some(x => x.id === dr.item))) continue;
      }
      if (Math.hypot(dr.x - home.x, dr.y - home.y) > cfg.range) continue;
      const d = Math.hypot(dr.x - s.x, dr.y - s.y);
      if (d < bd) { bd = d; best = dr; }
    }
    return best;
  }
  // tự bơm máu / nội lực (chạy cả khi không bật tự động nếu chọn "luôn bơm")
  function autoPotion(now) {
    const me = G.me, st = me.stats, cfg = autoCfg();
    if (me.dead || !G.map || G.map.safe) return;
    if (!G.auto && !cfg.potAlways) return;
    if (G._autoPot && now - G._autoPot < 700) return;
    if (cfg.hp && me.hp < st.maxHp * cfg.hpPct / 100 && !(G.noPot.hp > now)) { G.socket.emit('quickUse', { kind: 'hp', auto: 1 }); G._autoPot = now; return; }
    if (cfg.mp && me.mp < st.maxMp * cfg.mpPct / 100 && !(G.noPot.mp > now)) { G.socket.emit('quickUse', { kind: 'mp', auto: 1 }); G._autoPot = now; return; }
    // hết bình máu và máu quá thấp: dùng Hồi Thành Phù về thành
    if (G.auto && cfg.townLow && G.noPot.hp > now && me.hp < st.maxHp * cfg.townPct / 100) {
      const sc = me.inv.find(x => x.id === 'scroll_town');
      if (sc) { G.socket.emit('useItem', { uid: sc.uid }); setAuto(false); UI.toast('🏃 Máu thấp và hết bình máu: tự về thành!', 'error'); G._autoPot = now + 5000; }
    }
  }

  // Tự động đánh quái (auto)
  // ra chiêu vào mục tiêu: buff -> kỹ năng mạnh -> đánh thường; ngoài tầm thì đuổi theo
  function autoAttack(t, cfg) {
    const me = G.me, s = G.self, st = me.stats, skills = mySkills();
    const order = cfg.skills ? [7, 6, 5, 3, 4, 2, 1, 0] : [0];
    for (const i of order) {
      const sk = skills[i];
      if (!sk || !sk.learned || me.level < sk.lv || !skillReady(i) || me.mp < sk.mp) continue;
      if (sk.type === 'buff') { if (!me.buffs.some(b => b.name === sk.name)) { useSkill(i); return; } continue; }
      if (sk.type === 'heal') { if (me.hp < st.maxHp * 0.6) { useSkill(i); return; } continue; }
      const range = (sk.type === 'aoe' && !sk.range ? sk.radius : (sk.range || G.myRange())) * 0.85;
      const d = Math.hypot(t.x - s.x, t.y - s.y);
      if (d > range) { if (i === 0) G.moveTo = { x: t.x, y: t.y }; continue; }
      G.moveTo = null;
      useSkill(i);
      if (G._monChase) G._monChase.t = performance.now();   // đã ra đòn: còn đánh được
      return;
    }
  }
  function autoPlay(now) {
    const me = G.me, s = G.self;
    const cfg = autoCfg();
    if (G.map.safe) return;
    const st = me.stats;
    const home = G.autoHome || s;
    // tự nhặt đồ
    if (cfg.pickup) {
      const dr = pickableDrop(now, home, cfg);
      if (dr) {
        // đuổi theo một món quá lâu (kẹt góc, đi vòng mãi, đứng sát mà không nhặt được): bỏ qua món đó 1 phút
        if (!G._dropChase || G._dropChase.id !== dr.id) G._dropChase = { id: dr.id, t: now, lim: 2500 + Math.hypot(dr.x - s.x, dr.y - s.y) / (st.spd || 150) * 2000 };
        else if (now - G._dropChase.t > G._dropChase.lim) { G.dropSkip.set(dr.id, now + 60000); G._dropChase = null; G.autoDrop = null; G.moveTo = null; return; }
        G.autoDrop = dr.id; G.moveTo = { x: dr.x, y: dr.y }; return;
      }
    }
    G.autoDrop = null;
    let t = validTarget();
    if (t && (!G.monsters.has(t.id) || Math.hypot(t.x - home.x, t.y - home.y) > 900)) t = null;   // Tự động chỉ đánh quái, không bao giờ PK người chơi
    if (!t) {
      let best = null, bd = 700;
      for (const e of G.monsters.values()) {
        if (Math.hypot(e.x - home.x, e.y - home.y) > cfg.range) continue;
        if (G.autoBlacklist && G.autoBlacklist.id === e.id && G.autoBlacklist.until > now) continue;
        if (Math.hypot(e.x - home.x, e.y - home.y) > 900) continue;
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d < bd) { bd = d; best = e; }
      }
      t = best;
      G.target = t ? t.id : null;
    }
    if (!t) {
      if (Math.hypot(home.x - s.x, home.y - s.y) > 60) G.moveTo = { x: home.x, y: home.y };
      return;
    }
    // đuổi một con quái 8 giây mà chưa ra đòn được (đứng chỗ không tới được): bỏ qua nó 30 giây
    if (!G._monChase || G._monChase.id !== t.id) G._monChase = { id: t.id, t: now };
    else if (now - G._monChase.t > 8000) { G.autoBlacklist = { id: t.id, until: now + 30000 }; G.target = null; G.moveTo = null; G._monChase = null; return; }
    autoAttack(t, cfg);
  }

  // ================== Vẽ ==================
  function draw(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0810';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!G.map || !G.me) return;
    Assets.frameBudget(Input.isTouch || gfx.weak ? 3 : 8);   // mỗi khung chỉ ghép mới vài hình nhân vật (chỗ đông khỏi khựng)
    const m = G.map, s = G.self;
    const vw = W / zoom, vh = H / zoom;
    const fdt = Math.min(0.05, (now - (G._lastDraw || now)) / 1000); G._lastDraw = now;
    // camera đi theo mượt
    const foc = HoaSon.camFocus() || s;   // Hoa Sơn Luận Kiếm, chế độ Xem thi đấu: camera theo trận đang đấu
    let tx = Math.max(0, Math.min(m.w * TILE - vw, foc.x - vw / 2)), ty = Math.max(0, Math.min(m.h * TILE - vh, foc.y - vh / 2 - 20));
    if (m.w * TILE < vw) tx = (m.w * TILE - vw) / 2;
    if (m.h * TILE < vh) ty = (m.h * TILE - vh) / 2;
    if (G._camSnap) { cam.x = tx; cam.y = ty; G._camSnap = false; }
    else { const k = Math.min(1, fdt * 9); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; }
    let sx = 0, sy = 0;
    if (rumbles.length) shake = Math.max(shake, rumbleAmp(performance.now()));
    if (shake > 0) { sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake; shake *= 0.85; if (shake < 0.5) shake = 0; }
    const sc = zoom * DPR;
    ctx.setTransform(sc, 0, 0, sc, Math.round((-cam.x + sx) * sc), Math.round((-cam.y + sy) * sc));
    ctx.imageSmoothingEnabled = false;

    const x0 = Math.max(0, Math.floor(cam.x / TILE)), y0 = Math.max(0, Math.floor(cam.y / TILE));
    const x1 = Math.min(m.w - 1, Math.ceil((cam.x + vw) / TILE)), y1 = Math.min(m.h - 1, Math.ceil((cam.y + vh) / TILE));
    WorldArt.drawGround(ctx, cam, vw, vh, now);
    WorldArt.drawPuffs(ctx, now);
    // Cổng
    for (const p of m.portals) {
      const px = (p.x + 0.5) * TILE, py = (p.y + 0.5) * TILE;
      if (!inViewXY(px, py)) continue;   // ngoài màn hình: bỏ
      ctx.drawImage(Sprites.portalSprite(Math.floor(now / 120)), px - 32, py - 72);
      label(px, py - 78, '➜ ' + p.toName, '#9fe3ff', 11);
    }
    // Vật phẩm rơi
    for (const d of G.drops.values()) {
      if (!inViewXY(d.x, d.y)) continue;
      const bob = Math.sin(now / 300 + d.x) * 3;
      const col = { common: '#ffffff', rare: '#4fa3ff', epic: '#c060ff', legendary: '#ff9b2f' }[d.rarity];
      if (d.rarity !== 'common' || d.gold) {
        const gc = d.gold ? '#ffd040' : col;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 + Math.sin(now / 250 + d.x) * 0.15;
        const gs = Sprites.glow(gc, d.gold ? 18 : 28); ctx.drawImage(gs, d.x - gs.width / 2, d.y - 4 - gs.height / 2 + bob);
        if (d.rarity === 'epic' || d.rarity === 'legendary') { const g2 = ctx.createLinearGradient(0, d.y - 90, 0, d.y); g2.addColorStop(0, Sprites.hexA(col, 0)); g2.addColorStop(1, Sprites.hexA(col, 0.6)); ctx.fillStyle = g2; ctx.fillRect(d.x - 4, d.y - 90, 8, 90); }
        ctx.restore();
      }
      const di = d.item && G.data.items[UI.resolveId(d.item)];
      ctx.imageSmoothingEnabled = true; ctx.drawImage(Sprites.itemIcon(di ? di.icon : d.icon, d.rarity, null, di && di.tier), d.x - 17, d.y - 22 + bob, 34, 34); ctx.imageSmoothingEnabled = false;
    }
    // Dấu nhấp chuột
    if (G.clickMark && now - G.clickMark.t0 < 500) { const a = 1 - (now - G.clickMark.t0) / 500; ctx.strokeStyle = `rgba(255,215,106,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(G.clickMark.x, G.clickMark.y, 14 * (1.5 - a), 6 * (1.5 - a), 0, 0, Math.PI * 2); ctx.stroke(); }

    // Thực thể sắp xếp theo y
    const list = drawList; list.length = 0;   // dùng lại mảng mỗi khung (đỡ rác bộ nhớ)
    for (let y = Math.max(0, y0 - 1); y <= Math.min(m.h - 1, y1 + 4); y++) for (let x = Math.max(0, x0 - 8); x <= Math.min(m.w - 1, x1 + 1); x++) {   // lùi 8 ô: công trình rộng neo ở góc trái
      const t = m.tiles[y * m.w + x];
      if (Sprites.TALL.has(t)) list.push({ y: (y + 1) * TILE - 2, k: 'tall', t, tx: x, ty: y });
    }
    for (const n of m.npcs) if (inViewXY((n.x + 0.5) * TILE, (n.y + 0.5) * TILE)) list.push({ y: (n.y + 0.5) * TILE + 20, k: 'npc', n });   // trước đây vẽ mọi NPC của map
    if (G.corpses.length) G.corpses = G.corpses.filter(c => now - c.t0 < 1500);
    for (const c of G.corpses) list.push({ y: c.y - 1, k: 'corpse', c });
    for (const e of G.monsters.values()) if (inView(e)) list.push({ y: e.y, k: 'mon', e });
    markLod(s);
    for (const e of G.players.values()) if (inView(e)) list.push({ y: e.y, k: 'pl', e });
    for (const e of G.carts.values()) if (inView(e)) list.push({ y: e.y, k: 'cart', e });
    list.push({ y: s.y, k: 'self' });
    const bubbles = [];
    WorldArt.visibleDecos(cam, vw, vh, list);
    Market.collect(list);
    Pet.collect(list, now);
    const nearPl = [s, ...G.players.values()];
    list.sort((a, b) => a.y - b.y);

    // vòng chọn mục tiêu
    const tgt = G.target && (G.monsters.get(G.target) || G.players.get(G.target) || G.carts.get(G.target) || npcEnt(G.target));
    if (tgt) {
      ctx.strokeStyle = tgt.npc ? '#ffd76a' : G.players.has(tgt.id) && !Escort.canHarm(tgt) ? '#5dd0ff' : '#ff4040'; ctx.lineWidth = 2;   // vàng: NPC · xanh: người không đánh được · đỏ: kẻ địch
      const rr = tgt.boss ? 44 : tgt.cart ? 40 : 22;
      ctx.beginPath(); ctx.ellipse(tgt.x, tgt.y + 2, rr, rr * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (G.holdRing) {   // bấm giữ vào người chơi: vòng chạy đủ 1,5 giây thì mở bảng tương tác
      const hp = G.players.get(G.holdRing.id), k = Math.min(1, (now - G.holdRing.t0) / G.holdRing.dur);
      if (hp) {
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.arc(hp.x, hp.y - 30, 26, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#ffd76a'; ctx.beginPath(); ctx.arc(hp.x, hp.y - 30, 26, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
      }
    }

    DaiHoi.drawGround(ctx, now);
    HoaSon.drawGround(ctx, now);
    TongKim.drawGround(ctx, now);
    BossFX.drawGround(ctx, now);
    Duel.draw(ctx, now);
    drawGhosts(now);
    const frameOf = (moving, seed) => moving ? Math.floor(now / 140 + (seed || 0)) % 4 : 0;
    for (const it of list) {
      if (it.k === 'pet') { Pet.draw(ctx, it, now); continue; }
      if (it.k === 'tall') {
        WorldArt.drawTall(ctx, it.t, it.tx, it.ty, now);
      } else if (it.k === 'deco') {
        WorldArt.drawDeco(ctx, it.d, now, nearPl);
      } else if (it.k === 'npc') {
        const n = it.n, nx = (n.x + 0.5) * TILE, ny = (n.y + 0.5) * TILE;
        const dxp = G.self.x - nx, dyp = G.self.y - (ny + 20);
        const near = Math.hypot(dxp, dyp) < TILE * 3.5, side = near && Math.abs(dxp) > Math.abs(dyp) * 1.2;
        const nf = n.id === 'khu_bia' ? null : Assets.npcFrame(n.id, Math.floor(now / 320 + n.x) % 4, side);
        let ntop = ny - 50;
        if (n.id === 'khu_bia') {   // bia đá chuyển khu (vẽ sẵn một lần)
          const st = steleSprite();
          ctx.drawImage(st, nx - st.width / 4, ny + 22 - st.height / 2, st.width / 2, st.height / 2);
          ntop = ny + 22 - st.height / 2 - 6;
        } else if (nf) {
          const fy = ny + 20;
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(nx, fy, 14, 4.5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.save(); ctx.translate(nx, fy); if (side && dxp < 0) ctx.scale(-1, 1);
          ctx.drawImage(nf.img, nf.sx, nf.sy, nf.w, nf.h, -nf.fx, -nf.fy, nf.dw || nf.w, nf.dh || nf.h);
          ctx.restore();
          ntop = fy - 76;
        } else ctx.drawImage(Sprites.npcSprite(n.sprite, n.color, 0), nx - 32, ny - 44);
        label(nx, ntop, n.id === 'khu_bia' ? `Chuyển Khu (đang Khu ${G.map.ch || 1})` : n.name, n.id === 'khu_bia' ? '#9fe3ff' : '#7fffd4', 12, true);
        const tut = G.me && G.me.tutorial;
        if (Story.wantsNpc(n.id) || (tut && !tut.done && ((tut.type === 'talk' && tut.npc === n.id) || (tut.type === 'buy' && n.action === 'shop') || (tut.type === 'daily' && n.id === 'su_gia')))) {
          const by = Math.sin(now / 200) * 4;
          label(nx, ntop - 22 + by, '❗', '#ffd700', 22);
        }
      } else if (it.k === 'mon') {
        const mm = Overhead.mask(it.e, now) & ~2;   // băng của quái đã vẽ trong drawMonster
        if (mm) Overhead.drawUnder(ctx, it.e, it.e.x, it.e.y, mm, now);
        drawMonster(it.e, now);
        if (mm) Overhead.drawOver(ctx, it.e, it.e.x, it.e.y, it.e.y - (Assets.monsterTop(it.e.type) || (it.e.boss ? 120 : 56)), mm, now);
        if (it.e.bubble) bubbles.push([it.e, it.e.y - (Assets.monsterTop(it.e.type) || (it.e.boss ? 120 : 56)) - 30]);   // lời thoại boss
      } else if (it.k === 'stall') {
        Market.draw(ctx, it.s, label);
      } else if (it.k === 'corpse') {
        drawCorpse(it.c, now);
      } else if (it.k === 'cart') {
        Escort.drawCart(ctx, it.e, now, label, hpBar);
      } else if (it.k === 'pl') {
        const e = it.e;
        if (e.lod && G.target !== e.id && !Party.has(e.id)) {   // chỗ đông, ở xa: vẽ gọn (không thú cưỡi / thú cưng / phi phong / hào quang / tên)
          if (!e.apLite && e.ap) { e.apLite = e.ap.slice(); e.apLite[7] = ''; e.apLite[9] = 0; e.apLite[10] = ''; e.apLite[11] = -1; }
          if (e.iv) ctx.globalAlpha = 0.4;
          const top = drawHero(e.x, e.y, e.cls, e.dir, e.lastH, e.moving, e.atkUntil > now, e.apLite, e.dead, e.x / 50, now, e);
          ctx.globalAlpha = 1;
          if (e.bubble) bubbles.push([e, top - 2]);
          continue;
        }
        const pm = e.dead ? 0 : Overhead.mask(e, now);
        if (pm) Overhead.drawUnder(ctx, e, e.x, e.y, pm, now);
        const elift = e.ap && e.ap[7] ? 24 : 0;
        if (e.bf && !e.dead) Auras.draw(ctx, e.x, e.y, e.bf, now, 'under', elift);
        if (e.iv) ctx.globalAlpha = 0.4;   // quản trị viên đang tàng hình (chỉ quản trị viên khác thấy)
        const top = drawHero(e.x, e.y, e.cls, e.dir, e.lastH, e.moving, e.atkUntil > now, e.ap, e.dead, e.x / 50, now, e);
        ctx.globalAlpha = 1;
        if (e.bf && !e.dead) Auras.draw(ctx, e.x, e.y, e.bf, now, 'over', elift);
        if (e.pm && !e.dead && !G.map.pvp) Escort.drawFlag(ctx, e.x, e.y, top, e.dir === 1 || e.dir === 2 ? e.dir : (e.lastH || 2), e.pm, now);
        if (pm) Overhead.drawOver(ctx, e, e.x, e.y, top, pm, now);
        let ptop = top - 6;
        if (G.settings.names) ptop = Overhead.drawNameplate(ctx, e.x, top, { name: e.name, level: e.level, gm: e.gm, guild: e.guild, power: e.pw, myPower: G.me.stats.power, title: e.ttl, lite: !!e.lod, rank: e.rk, pk: e.k, mc: e.mc, tk: e.tk, party: Party.has(e.id) });
        hpBar(e.x, top - 4, 40, e.hp / e.maxHp, '#4ade80');
        if (e.rb && !e.dead) { ptop -= 14; label(e.x, ptop, '💰 Truy nã · Cướp Tiêu', '#ff5050', 11, true); }
        if (e.bubble) bubbles.push([e, ptop + 4]);
      } else if (it.k === 'self') {
        const me = G.me;
        if (s.dir === 1 || s.dir === 2) s.lastH = s.dir;
        s.pw = me.stats.power; s.k = me.pk || 0;
        const sm = me.dead ? 0 : Overhead.mask(s, now);
        if (sm) Overhead.drawUnder(ctx, s, s.x, s.y, sm, now);
        const tnow = Date.now(), mbf = me.dead ? null : me.buffs.filter(b => b.until > tnow && b.aura).map(b => [b.aura, b.color]);
        const slift = me.ap && me.ap[7] ? 24 : 0;
        if (mbf && mbf.length) Auras.draw(ctx, s.x, s.y, mbf, now, 'under', slift);
        if (me.gm && me.gm.hide) ctx.globalAlpha = 0.4;   // đang tàng hình: tự thấy mình mờ
        const top = drawHero(s.x, s.y, me.cls, s.dir, s.lastH, s.moving, s.atkUntil > now, me.ap, me.dead, 0, now, s);
        ctx.globalAlpha = 1;
        if (mbf && mbf.length) Auras.draw(ctx, s.x, s.y, mbf, now, 'over', slift);
        if (me.pkMode && !me.dead && !G.map.pvp) Escort.drawFlag(ctx, s.x, s.y, top, s.dir === 1 || s.dir === 2 ? s.dir : (s.lastH || 2), me.pkMode, now);
        if (sm) Overhead.drawOver(ctx, s, s.x, s.y, top, sm, now);
        let stop = top - 6;
        if (G.settings.names) stop = Overhead.drawNameplate(ctx, s.x, top, { self: true, name: me.name, gm: me.admin, guild: me.guild && me.guild.name, power: me.stats.power, title: me.title, rank: me.rank, pk: me.pk, mc: me.minhChu, tk: me.tk });
        hpBar(s.x, top - 4, 40, me.hp / me.stats.maxHp, '#ff5050');
        if (me.robUntil > Date.now() && !me.dead) { stop -= 14; label(s.x, stop, '💰 Truy nã · Cướp Tiêu', '#ff5050', 11, true); }
        if (s.bubble) bubbles.push([s, stop + 4]);
      }
    }

    if (!Input.isTouch && G.me && !G.me.dead) {
      const ni = nearItem(80);
      if (ni) label(ni.x, ni.y - 34 + Math.sin(now / 200) * 2, '[F] Nhặt', '#ffe9a8', 11, true);
    }
    const taken = [];
    for (const [e, top] of bubbles) if (!Overhead.drawBubble(ctx, e.x, top, e.bubble, now, taken)) e.bubble = null;

    BossArt.drawOver(ctx, now);   // chiêu boss: nổ, gai đá / băng, sét, lốc xoáy đè lên nhân vật
    if (!gfx.lowFx) { WorldArt.ambient(now, cam, vw, vh, fdt); WorldArt.drawAmbient(ctx, now); }   // máy yếu: bỏ hạt bay lơ lửng
    drawFx(now);
    // chữ nổi
    if (G.floats.length) G.floats = G.floats.filter(f => now - f.t0 < 1100);
    for (const f of G.floats) {
      const p = (now - f.t0) / 1100;
      ctx.globalAlpha = 1 - p * p;
      label(f.x, f.y - p * 40, f.text, f.color, f.size * (f.bold ? (1 + Math.max(0, 0.3 - p)) : 1), true);
    }
    ctx.globalAlpha = 1;
    Overhead.drawFloats(ctx, now);

    // Mũi tên hướng dẫn tân thủ
    drawGuideArrow(now);
    Escort.drawArrow(ctx, now);
    Story.drawArrow(ctx, now);
    WorldMap.drawArrow(ctx, now);
    Dungeon.drawArrow(ctx, now);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    WorldArt.overlay(!gfx.lowFx);   // lớp ám màu / tối viền bằng CSS; máy yếu thì tắt
    Weather.draw(ctx, canvas.width, canvas.height, DPR, now, cam, zoom, gfx.fx);
    const fl = FX.flash(now);
    if (fl) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = fl.a; ctx.fillStyle = fl.color; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1; }
    // Khung mục tiêu
    UI.updateTarget(tgt);
    if (now - lastMini > 200) { lastMini = now; drawMinimap(); const pb = $('btn-pick'); if (pb) pb.classList.toggle('hidden', !(G.me && !G.me.dead && nearItem(150))); }
  }

  // Bia Chuyển Khu: bia đá xám đặt trên bệ, mái ngói nhỏ, chữ "KHU" mạ vàng – vẽ ở độ phân giải gấp đôi rồi thu nhỏ
  let steleCv = null;
  function steleSprite() {
    if (steleCv) return steleCv;
    const c = document.createElement('canvas'); c.width = 88; c.height = 140; const x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0.32)'; x.beginPath(); x.ellipse(44, 130, 36, 8, 0, 0, Math.PI * 2); x.fill();   // bóng
    const g1 = x.createLinearGradient(0, 108, 0, 132); g1.addColorStop(0, '#8a8478'); g1.addColorStop(1, '#4a463e');
    x.fillStyle = g1; x.fillRect(8, 110, 72, 20); x.fillStyle = '#a49e90'; x.fillRect(8, 108, 72, 4);   // bệ đá
    const g2 = x.createLinearGradient(14, 0, 74, 0); g2.addColorStop(0, '#b4b0a8'); g2.addColorStop(0.5, '#8e8a84'); g2.addColorStop(1, '#5e5a56');
    x.fillStyle = g2; x.beginPath(); x.moveTo(16, 110); x.lineTo(16, 34); x.quadraticCurveTo(44, 22, 72, 34); x.lineTo(72, 110); x.closePath(); x.fill();   // thân bia
    x.strokeStyle = '#2e2a28'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#5a2a1a'; x.beginPath(); x.moveTo(6, 32); x.quadraticCurveTo(44, 6, 82, 32); x.lineTo(76, 38); x.quadraticCurveTo(44, 18, 12, 38); x.closePath(); x.fill();   // mái ngói
    x.strokeStyle = '#2a1008'; x.lineWidth = 2; x.stroke();
    x.fillStyle = '#c8a050'; x.fillRect(42, 6, 4, 8);   // chóp
    x.strokeStyle = 'rgba(40,36,34,0.7)'; x.lineWidth = 2; x.strokeRect(24, 42, 40, 62);   // khung khắc
    x.fillStyle = '#ffd76a'; x.strokeStyle = '#4a2e08'; x.lineWidth = 3; x.textAlign = 'center'; x.font = '900 18px "Be Vietnam Pro", system-ui, sans-serif';
    for (const [t, y] of [['K', 60], ['H', 80], ['U', 100]]) { x.strokeText(t, 44, y); x.fillText(t, 44, y); }
    x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(18, 40, 4, 66);   // vệt sáng
    return (steleCv = c);
  }
  function inViewXY(x, y) { return x > cam.x - 150 && x < cam.x + W / zoom + 150 && y > cam.y - 150 && y < cam.y + H / zoom + 200; }
  function inView(e) { return inViewXY(e.x, e.y); }
  const drawList = [];

  // trạng thái hoạt ảnh của quái: đánh / trúng đòn / đi / đứng
  function monsterAnim(e, now, info) {
    const atkAge = e.atkStart ? now - e.atkStart : 1e9;
    if (atkAge < 420) return [info.ranged ? 'cast' : 'atk', Math.min(3, Math.floor(atkAge / 105))];
    if (e.hitAt && now - e.hitAt < 160) return ['hurt', 0];
    if (e.moving) return ['walk', Math.floor(now / 105 + e.x / 70) % 6];
    return ['idle', Math.floor(now / 300 + e.x / 50) % 4];
  }
  function drawMonster(e, now) {
    const info = G.data.monsters[e.type] || { sprite: 'wolf', color: '#888', name: '?' };
    const hit = e.hitAt && now - e.hitAt < 120;
    const [state, fi] = monsterAnim(e, now, info);
    const mf = Assets.monsterFrame(e.type, state, fi, e.dir);
    if (mf) {
      const face = e.face || 2, flip = mf.rig ? e.dir === 1 : face === 1;
      const SZ = e.boss ? (info.size || 1.25) : 1;   // boss thế giới vẽ to hơn
      const half = Math.max(12, mf.half * 0.8) * SZ, top = mf.top * SZ;
      ctx.save();
      ctx.translate(Math.round(e.x), Math.round(e.y));
      if (e.boss) {
        const g = ctx.createRadialGradient(0, -top / 2, 10, 0, -top / 2, top);   // boss thế giới: hào quang vàng
        g.addColorStop(0, info.world ? `rgba(255,210,90,${0.38 + Math.sin(now / 300) * 0.08})` : 'rgba(255,40,40,0.32)'); g.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -top / 2, top, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, half, Math.max(4, half * 0.28), 0, 0, Math.PI * 2); ctx.fill();
      if (e.elite) {
        eliteAura(half, mf.top, now, e.elite === 2);
        if (Math.random() < 0.12) FX.emit(1, e.x + (Math.random() - 0.5) * half * 2, e.y - Math.random() * mf.top, { speed: 5, vy: -30, life: 800, size: 2.4, color: e.elite === 2 ? '#ff6040' : Math.random() < 0.5 ? '#ffc040' : '#c890ff' });
      }
      if (e.born && now - e.born < 300) ctx.globalAlpha = (now - e.born) / 300;
      if (e.elite === 1) ctx.scale(1.2, 1.2);   // tinh anh to hơn
      if (SZ !== 1) ctx.scale(SZ, SZ);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(mf.img, mf.sx, mf.sy, mf.w, mf.h, -mf.fx, -mf.fy, mf.w, mf.h);
      if (hit) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; ctx.drawImage(mf.img, mf.sx, mf.sy, mf.w, mf.h, -mf.fx, -mf.fy, mf.w, mf.h); }
      if (e.frozen) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45; ctx.drawImage(mf.img, mf.sx, mf.sy, mf.w, mf.h, -mf.fx, -mf.fy, mf.w, mf.h);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.32; ctx.fillStyle = '#bff0ff';
        const bw = half * 2 + 6, bh = mf.top + 4;
        ctx.fillRect(-bw / 2, -bh, bw, bh);
        ctx.globalAlpha = 0.9; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 2; ctx.strokeRect(-bw / 2, -bh, bw, bh);
        ctx.beginPath(); ctx.moveTo(-bw / 3, -bh * 0.8); ctx.lineTo(-bw / 8, -bh * 0.6); ctx.moveTo(bw / 6, -bh * 0.9); ctx.lineTo(bw / 3, -bh * 0.75); ctx.stroke();
      }
      ctx.restore();
      monsterLabel(e, info, -top * (e.elite === 1 ? 1.2 : 1) - 8);
      return;
    }
    const frame = e.moving ? Math.floor(now / 160 + e.x / 70) % 4 : Math.floor(now / 500) % 2;
    const img = Sprites.monsterSprite(e.type, info, frame, e.dir);
    const scale = e.boss ? 2 : 1;
    const flip = info.sprite !== 'bandit' && (e.face || 2) === 1;
    ctx.save();
    ctx.translate(Math.round(e.x), Math.round(e.y));
    if (e.boss) {
      const g = ctx.createRadialGradient(0, -30, 10, 0, -30, 90);
      g.addColorStop(0, 'rgba(255,40,40,0.35)'); g.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -30, 90, 0, Math.PI * 2); ctx.fill();
    }
    if (e.born && now - e.born < 300) ctx.globalAlpha = (now - e.born) / 300;
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -32 * scale, -58 * scale, 64 * scale, 64 * scale);
    if (hit) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(img, -32 * scale, -58 * scale, 64 * scale, 64 * scale); }
    if (e.frozen) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45; ctx.drawImage(img, -32 * scale, -58 * scale, 64 * scale, 64 * scale);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.35; ctx.fillStyle = '#bff0ff';
      ctx.fillRect(-22 * scale, -48 * scale, 44 * scale, 48 * scale);
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 2; ctx.strokeRect(-22 * scale, -48 * scale, 44 * scale, 48 * scale);
      ctx.beginPath(); ctx.moveTo(-16 * scale, -40 * scale); ctx.lineTo(-6 * scale, -30 * scale); ctx.moveTo(8 * scale, -44 * scale); ctx.lineTo(16 * scale, -36 * scale); ctx.stroke();
    }
    ctx.restore();
    monsterLabel(e, info, e.boss ? -130 : -62);
  }
  // xác quái: khung ngã rồi mờ dần
  function drawCorpse(c, now) {
    const age = now - c.t0;
    const mf = Assets.monsterFrame(c.type, 'dead', 0, c.dir);
    if (!mf) return;
    ctx.save();
    ctx.translate(Math.round(c.x), Math.round(c.y));
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - 700) / 800);
    if (mf.rig ? c.dir === 1 : c.face === 1) ctx.scale(-1, 1);
    ctx.drawImage(mf.img, mf.sx, mf.sy, mf.w, mf.h, -mf.fx, -mf.fy, mf.w, mf.h);
    ctx.restore();
  }
  // hào quang quái tinh anh (vàng tím) / boss phó bản (đỏ): vòng trận đồ xoay dưới chân + quầng sáng
  function eliteAura(half, top, now, boss) {
    const r = half + 10, c1 = boss ? '255,60,40' : '255,190,60', c2 = boss ? '255,120,60' : '200,120,255';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, -top / 2, 4, 0, -top / 2, top * 0.9);
    g.addColorStop(0, `rgba(${c1},${0.22 + Math.sin(now / 260) * 0.06})`); g.addColorStop(1, `rgba(${c1},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -top / 2, top * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.scale(1, 0.38); ctx.rotate(now / 900);
    ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(${c1},0.8)`; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(${c2},0.7)`; ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.beginPath(); ctx.arc(0, 0, r - 5, a, a + 0.6); ctx.stroke(); }
    ctx.restore();
  }
  function monsterLabel(e, info, top) {
    if (e.event) { label(e.x, e.y + top - 6, info.name, '#ffd700', 12, true); return; }
    if (e.elite === 1) {   // luôn hiện tên tinh anh
      label(e.x, e.y + top - 6, `⭐ Tinh Anh · ${info.name}${info.lv ? ' Lv' + info.lv : ''}`, '#ffc040', 12, true);
      hpBar(e.x, e.y + top, 60, e.hp / e.maxHp, '#ffa020');
      return;
    }
    if (e.elite === 2) {   // boss phó bản
      label(e.x, e.y + top - 6, `👹 ${info.name}${info.lv ? ' Lv' + info.lv : ''}`, '#ff5040', 14, true);
      hpBar(e.x, e.y + top, 90, e.hp / e.maxHp, '#ff3030');
      return;
    }
    const lvDiff = G.me ? info.lv - G.me.level : 0;
    const col = e.boss ? '#ff4040' : lvDiff > 5 ? '#ff7070' : lvDiff < -8 ? '#9a9a9a' : '#ffe9a8';
    if (G.settings.names || e.boss || G.target === e.id) label(e.x, e.y + top - 6, `${e.boss ? '👑 ' : ''}${info.name}${info.lv ? ' Lv' + info.lv : ''}`, col, e.boss ? 14 : 11, true);
    if (info.world) label(e.x, e.y + top - 24, '🌍 BOSS THẾ GIỚI', '#ff6ad5', 12, true);   // nhắc người chơi đây là boss thế giới
    hpBar(e.x, e.y + top, e.boss ? (info.world ? 160 : 90) : 40, e.hp / e.maxHp, e.boss ? '#ff3030' : '#e5484d');
  }

  function label(x, y, text, color, size = 12, outline) {
    if (outline !== false && Number.isInteger(size)) return Overhead.cachedText(ctx, text, x, y, size, color, 'rgba(0,0,0,0.85)', 'bold', 3);
    ctx.font = `bold ${size * 0.88}px Be Vietnam Pro, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (outline !== false) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(text, x, y); }
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function hpBar(x, y, w, r, col) {
    r = Math.max(0, Math.min(1, r || 0));
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w * r, 4);
  }

  // Chuyển động để vẽ 8 hướng: vận tốc làm mượt từ vị trí từng khung hình -> hướng chéo khi đi xiên, tốc độ để chọn đi / chạy,
  // quãng đường tích luỹ để chọn khung bước. Hướng từ máy chủ (4 hướng) đổi thì theo hướng đó (quay mặt đánh, đổi hướng khi đứng).
  const RUN_SPEED = 115, RUN_STRIDE = 100, WALK_STRIDE = 54;   // px/giây; px mỗi chu kỳ bước (khớp sải chân trong tools/rig2.py)
  const OCT_DIR = [2, 4, 0, 5, 1, 7, 3, 6];   // cung 45° (0 = phải, theo chiều kim đồng hồ) -> mã hướng vẽ
  function motion(e, x, y, dir, moving, now) {
    const m = e._mo || (e._mo = { x, y, t: now, vx: 0, vy: 0, odo: 0, speed: 0, vdir: dir, sdir: dir });
    const dt = Math.min(0.1, Math.max(0, (now - m.t) / 1000));
    if (dt > 0) {
      const dx = x - m.x, dy = y - m.y, d = Math.hypot(dx, dy);
      if (d > 120) { m.vx = m.vy = 0; }   // dịch chuyển tức thời
      else {
        m.odo += d;
        const k = Math.min(1, dt * 10);
        m.vx += (dx / dt - m.vx) * k; m.vy += (dy / dt - m.vy) * k;
      }
      m.x = x; m.y = y; m.t = now;
      m.speed = Math.hypot(m.vx, m.vy);
    }
    if (dir !== m.sdir) { m.sdir = dir; m.vdir = dir; }
    if (moving && m.speed > 20) {
      // 8 cung 45°: 0 phải, 1 chéo xuống-phải, 2 xuống ... (trục y màn hình hướng xuống)
      const oct = ((Math.round(Math.atan2(m.vy, m.vx) / (Math.PI / 4)) % 8) + 8) % 8;
      m.vdir = OCT_DIR[oct];
    }
    return m;
  }
  // Ngồi thiền: vòng khí xanh nhạt dưới đất, các đốm linh khí bay lên và tụ vào người
  function medAura(x, y, now, seed) {
    const t = now / 1000 + seed;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.translate(Math.round(x), Math.round(y) - 2); ctx.scale(1, 0.42);
    for (let k = 0; k < 2; k++) {
      const r = 26 + k * 10 + Math.sin(t * 2 + k) * 2;
      ctx.strokeStyle = `rgba(150,230,255,${0.32 - k * 0.12})`; ctx.lineWidth = 3 - k;
      ctx.beginPath(); ctx.arc(0, 0, r, t * (k ? -0.6 : 0.8), t * (k ? -0.6 : 0.8) + Math.PI * 1.6); ctx.stroke();
    }
    ctx.restore();
    if (Math.random() < 0.12) FX.emit(1, x + (Math.random() - 0.5) * 50, y - 4, { speed: 4, vy: -26, life: 1400, size: 2.6, color: Math.random() < 0.5 ? '#bff4ff' : '#fff6c0', drag: 0.4 });
  }
  // Vẽ nhân vật (có thú cưỡi, hào quang cường hóa). Trả về tọa độ y đỉnh đầu để vẽ tên.
  function drawHero(x, y, cls, dir, lastH, moving, atk, ap, dead, seed, now, ent) {
    ap = ap || [];
    const art = Assets.has(cls);
    let state = 'idle', fi = 0, lift = 0;
    const J = ent && ent.jump;
    if (J) {   // khinh công: bay theo đường cong, bóng đổ ở lại mặt đất
      const p = (now - J.t0) / J.dur;
      if (p >= 1 || dead) {
        ent.jump = null;
        if (!dead) { WorldArt.dust(J.x1, J.y1); WorldArt.dust(J.x1 + 8, J.y1 + 2); FX.emit(8, J.x1, J.y1 - 4, { speed: 50, life: 360, size: 3.5, color: '#e8dcc0', drag: 3 }); }
      } else {
        x = J.x0 + (J.x1 - J.x0) * p; y = J.y0 + (J.y1 - J.y0) * p; lift = jumpLift(p); moving = true;
        const k = 1 - lift / JUMP_H * 0.45;
        ctx.fillStyle = `rgba(0,0,0,${0.3 * k})`; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y) - 1, 15 * k, 6 * k, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (art) {
      const mo = ent && !ap[7] ? motion(ent, x, y, dir, moving, now) : null;   // cưỡi thú: giữ 4 hướng như thú cưỡi
      if (dead) state = 'dead';
      else if (atk) {
        state = ent && ent.atkKind === 'skill' ? 'cast' : 'atk';
        const p = ent && ent.atkStart ? (now - ent.atkStart) / (ent.atkDur || 300) : 0.5, n = Assets.frameCount(cls, state);
        fi = Math.max(0, Math.min(n - 1, Math.floor(p * n)));
      }
      else if (ent && ent.hitAt && now - ent.hitAt < 300) { state = 'hurt'; const n = Assets.frameCount(cls, 'hurt'); fi = Math.min(n - 1, Math.floor((now - ent.hitAt) / (300 / n))); }
      else if (lift) { state = 'run'; fi = Math.min(Assets.frameCount(cls, 'run') - 1, 3); if (mo) dir = mo.vdir; }
      else if (moving && mo) {
        // chạy khi đủ nhanh, đi bộ khi bị làm chậm / vừa bước; khung theo quãng đường đã đi nên chân không trượt
        state = mo.speed > RUN_SPEED ? 'run' : 'walk';
        const n = Assets.frameCount(cls, state);
        fi = Math.floor(mo.odo / ((state === 'run' ? RUN_STRIDE : WALK_STRIDE) / n)) % n;
        dir = mo.vdir;
      }
      else if (moving) { state = 'walk'; fi = Math.floor(now / 70 + seed) % Assets.frameCount(cls, 'walk'); }
      else if (ent && (ent === G.self ? G.me && G.me.med : ent.md) && !ap[7]) {   // ngồi thiền (đứng yên trong thành 30 giây)
        state = 'med'; fi = Math.floor(now / 325 + seed) % Assets.frameCount(cls, 'med');
        if (dir > 3) dir = dir === 4 || dir === 6 ? 2 : 1;   // ngồi thiền chỉ có 4 hướng
        medAura(x, y, now, seed);
      }
      else { fi = Math.floor(now / 200 + seed) % Assets.frameCount(cls, 'idle'); if (mo) dir = mo.vdir; }
    }
    const colors = G.data.classes[cls].colors;
    const mountId = ap[7];
    const plus = Math.max(ap[2] || 0, ap[5] || 0);
    const gcol = Sprites.enhanceGlow(plus);
    // làm tròn theo điểm ảnh thật của màn hình (camera cũng làm tròn như vậy): nhân vật không rung 1px khi chạy
    const pk = zoom * DPR; x = Math.round(x * pk) / pk; y = Math.round((y - lift) * pk) / pk;
    if (dead) ctx.globalAlpha = art ? 0.9 : 0.4;
    if (gcol && !dead) Overhead.drawEnhance(ctx, x, y, plus, gcol, now, seed, !!mountId, 'under');
    let top;
    if (mountId && G.data.mounts[mountId]) {
      const info = G.data.mounts[mountId];
      const face = dir === 1 || dir === 2 ? dir : (lastH || 2);
      const mf = moving ? Math.floor(now / 110 + seed) % 4 : 0;
      if (info.rarity === 'legendary' && !dead && !MountFX.has(mountId)) {   // thú có hiệu ứng riêng thì bỏ hào quang chung
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.save(); ctx.translate(x, y - 6); ctx.scale(1, 0.45); FX.glowDot(ctx, 0, 0, 64, info.mane, 0.4 + Math.sin(now / 200) * 0.1, true); ctx.restore();
        ctx.restore();
        if (Math.random() < 0.4) FX.emit(1, x + (face === 1 ? 10 : -10), y - 10, { speed: 15, vy: -50, life: 600, size: 4, color: info.mane, jitter: 34, jitterY: 6 });
      }
      // hướng nhìn của thú: đi xuống thấy mặt trước, đi lên thấy lưng, trái/phải nhìn ngang
      const mview = dir === 0 ? 'down' : dir === 3 ? 'up' : 'side';
      const mfr = art ? Assets.mountFrame(mountId, moving && !dead, now + seed * 37, mview) : null;
      if (mfr) {
        // thú cưỡi vẽ mới + người ngồi đúng yên, không bị cắt chân
        const side = mfr.view === 'side', flip = side && face === 1, [fx, fy] = mfr.foot;
        const flies = MountFX.flies(mountId);   // rồng, phượng bay lơ lửng: bóng mờ nhỏ, không tung bụi
        ctx.fillStyle = flies ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y - 1, side ? (flies ? 26 : 34) : (flies ? 14 : 16), side ? (flies ? 5 : 6) : (flies ? 9 : 12), 0, 0, Math.PI * 2); ctx.fill();
        if (!flies && moving && mfr.k % 3 === 0 && !dead && Math.random() < 0.5) WorldArt.dust(x + (side ? (flip ? 22 : -22) : 0), y + (mfr.view === 'down' ? -10 : side ? 0 : 10));
        if (!dead) MountFX.under(ctx, mountId, x, y, now, mfr.view, moving, seed, flip, ap[9] || 1);
        const layer = sy0 => {
          ctx.save(); ctx.translate(x, y);
          if (flip) ctx.scale(-1, 1);
          ctx.drawImage(mfr.img, mfr.sx, sy0, mfr.cw, mfr.ch, -fx, -fy, mfr.dw, mfr.dh);
          ctx.restore();
        };
        layer(mfr.sy);
        const sx = x + (flip ? fx - mfr.seat[0] : mfr.seat[0] - fx), sy = y + mfr.seat[1] - fy;
        const rs = state === 'walk' || state === 'idle' || state === 'dead' ? 'ride' : state;
        const rdir = side ? face : dir;
        const rider = Assets.riderFrame(cls, rdir, rs, rs === 'ride' ? Math.floor(mfr.k / 2) : fi, ap);
        ctx.drawImage(rider, Math.round(sx - 48), Math.round(sy - 66), 96, 96);
        if (mfr.fy >= 0) layer(mfr.fy);      // đầu ngựa / chân trước (hoặc mông, đuôi) đè lên người cưỡi
        if (!dead) MountFX.over(ctx, mountId, x, y, now, mfr.view, moving, seed, flip, ap[9] || 1);
        top = Math.round(sy - 54);
      } else {
      ctx.drawImage(Sprites.mountSprite(mountId, info, mf, face === 1), x - 48, y - 66);
      if (art) {
        const rider = Assets.charFrame(cls, face, state === 'walk' || state === 'dead' ? 'idle' : state, fi, ap);
        const ry = y - 86 - 26 + (moving && mf % 2 ? 1 : 0);
        ctx.drawImage(rider, 0, 0, 144 * Assets.K, 99 * Assets.K, x - 48 + (face === 1 ? 2 : -2), ry, 96, 66);
        top = y - 96;
      } else {
        const rider = Sprites.playerSprite(cls, colors, face, 0, atk, ap);
        const rx = x - 32 + (face === 1 ? 2 : -2), ry = y - 75 + (moving && mf % 2 ? 1 : 0);
        ctx.drawImage(rider, 0, 0, 64, 52, rx, ry, 64, 52);
        top = y - 80;
      }
      }
    } else {
      const fr = moving ? Math.floor(now / 95 + seed) % 8 : 0;
      const breathe = moving || dead ? 0 : (Math.floor(now / 650 + seed) % 2);
      if (moving && fr % 4 === 1 && !dead && Math.random() < 0.5) WorldArt.dust(x, y);
      if (art) {
        const wr = ap[1] || 0;   // phẩm chất vũ khí: 1 Hiếm (xanh), 2 VIP (tím), 3 Truyền Kỳ (cam)
        if (!dead && wr >= 1 && ap[0] >= 0 && !(ent && ent.lod)) {   // người ở xa chỗ đông: bỏ quầng sáng vũ khí
          const g = Assets.weaponGlow(cls, dir, state, fi, ['', '#4fa3ff', '#c060ff', '#ff9b2f'][wr], ap);
          if (g) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = (wr === 3 ? 0.75 : 0.6) + Math.sin(now / (wr === 3 ? 140 : 320) + seed) * 0.25;
            ctx.drawImage(g, x - 48, y - 86, 96, 96); if (wr === 3) ctx.drawImage(g, x - 48, y - 87, 96, 96);
            ctx.restore();
          }
        }
        if (!dead && ent && ent.k) Overhead.drawPkAura(ctx, x, y, ent.k, now);
        ctx.drawImage(Assets.charFrame(cls, dir, state, fi, ap), x - 48, y - 86, 96, 96);
        top = state === 'med' ? y - 50 : y - 72;   // ngồi thiền: tên hạ xuống theo dáng ngồi
      } else {
        ctx.drawImage(Sprites.playerSprite(cls, colors, dir, fr, atk, ap), x - 32, y - 58 + breathe);
        top = y - 58;
      }
    }
    if (gcol && !dead) Overhead.drawEnhance(ctx, x, y, plus, gcol, now, seed, !!mountId, 'over');
    ctx.globalAlpha = 1;
    return top;
  }

  function drawFx(now) { FX.draw(ctx, now); }

  function drawGuideArrow(now) {
    const tut = G.me && G.me.tutorial;
    if (!tut || tut.done || tut.complete) return;
    let goal = null;
    const m = G.map;
    if (tut.type === 'talk' || tut.type === 'buy' || tut.type === 'daily') {
      const npcId = tut.type === 'talk' ? tut.npc : tut.type === 'buy' ? 'duoc_diem' : 'su_gia';
      const n = m.npcs.find(x => x.id === npcId);
      if (n) goal = { x: (n.x + 0.5) * TILE, y: (n.y + 0.5) * TILE };
      else { const p = m.portals.find(x => x.to === 'tuong_duong') || m.portals[0]; if (p) goal = { x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE }; }
    } else if (tut.type === 'map' || tut.type === 'kill') {
      const target = tut.type === 'map' ? tut.map : (tut.n && G.data.monsters[tut.mon] && G.data.monsters[tut.mon].lv < 5 ? 'ngoai_o' : 'ngoai_o');
      if (m.id !== target) { const p = m.portals.find(x => x.to === target) || m.portals.find(x => x.side === 'E') || m.portals[0]; if (p) goal = { x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE }; }
    }
    if (!goal) return;
    const s = G.self;
    const d = Math.hypot(goal.x - s.x, goal.y - s.y);
    if (d < 120) return;
    const a = Math.atan2(goal.y - s.y, goal.x - s.x);
    const r = 70 + Math.sin(now / 200) * 6;
    ctx.save();
    ctx.translate(s.x + Math.cos(a) * r, s.y - 26 + Math.sin(a) * r);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd700'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  const mini = $('minimap'), mctx = mini.getContext('2d');
  function drawMinimap() {
    if (!minimapBase) return;
    const m = G.map;
    const mw = mini.width, mh = mini.height;
    mctx.imageSmoothingEnabled = false;
    mctx.fillStyle = '#000'; mctx.fillRect(0, 0, mw, mh);
    // thu nhỏ vừa khung, giữ tỉ lệ
    const sc = Math.min(mw / m.w, mh / m.h);
    const ox = (mw - m.w * sc) / 2, oy = (mh - m.h * sc) / 2;
    mctx.drawImage(minimapBase, ox, oy, m.w * sc, m.h * sc);
    const pt = (x, y, col, r) => { mctx.fillStyle = col; mctx.fillRect(ox + x / TILE * sc - r / 2, oy + y / TILE * sc - r / 2, r, r); };
    for (const n of m.npcs) pt((n.x + 0.5) * TILE, (n.y + 0.5) * TILE, '#7fffd4', 3);
    for (const e of G.monsters.values()) pt(e.x, e.y, e.boss ? '#ff00ff' : e.event ? '#ffd700' : '#ff4040', e.boss ? 6 : 2);
    for (const e of G.players.values()) pt(e.x, e.y, Party.has(e.id) ? '#4dff7a' : e.pm === 2 ? '#ff2020' : e.pm === 1 ? '#ff9a3a' : '#4fa3ff', Party.has(e.id) ? 4 : 3);
    for (const e of G.carts.values()) pt(e.x, e.y, '#ffd23f', 5);
    pt(G.self.x, G.self.y, '#ffffff', 4);
    mctx.strokeStyle = 'rgba(255,255,255,.5)';
    mctx.strokeRect(ox + cam.x / TILE * sc, oy + cam.y / TILE * sc, W / zoom / TILE * sc, H / zoom / TILE * sc);
  }

  // lần chạm / phím gần nhất: để yên lâu thì (khi tiết kiệm pin) vẽ thưa hơn nữa
  G.lastInput = performance.now();
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) window.addEventListener(ev, () => { G.lastInput = performance.now(); }, { passive: true, capture: true });
  let idlePx = 0, idlePy = 0;
  function frameBudget(now) {
    if (!battery()) return 0;
    // còn di chuyển (kể cả giữ cần điều khiển), vừa ra đòn, hoặc quanh mình có hiệu ứng giao tranh: coi như đang chơi
    if (G.self.x !== idlePx || G.self.y !== idlePy || (G.self.atkUntil || 0) > now - 1000 || G.fx.length) { idlePx = G.self.x; idlePy = G.self.y; G.lastInput = Math.max(G.lastInput, now); }
    if (!G.auto && now - G.lastInput > 45000) return 50;   // để yên 45 giây: 20 FPS
    return 1000 / 30;
  }
  // quay lại tab: bỏ khoảng thời gian ẩn khỏi đo đạc (rAF tự dừng khi tab ẩn nên không tốn pin lúc đó)
  // Rời trang (chuyển tab, điện thoại thoát ra màn hình chính / tắt màn hình) hoặc bật màn đen: trình duyệt dừng
  // vòng lặp của trang, nên giao tự động cho máy chủ treo hộ (server/game/autosrv.js). Quay lại thì máy chủ trả lái
  // và gửi vị trí thật (sự kiện 'pos'). Mất kết nối khi đang tự động: máy chủ vẫn treo hộ tối đa 8 giờ.
  function sendAutoSrv() {
    if (!G.socket || !G.inGame || !G.map) return;
    const h = G.autoHome || G.self;
    G.socket.emit('autoSrv', { on: !!G.auto, cfg: autoCfg(), hx: h.x, hy: h.y, block: window.Social && Social.blockList ? Social.blockList() : [] });
  }
  G.sendAutoSrv = sendAutoSrv;
  function setAway(v) { if (!G.socket || !G.inGame) return; if (v) sendAutoSrv(); G.socket.emit('away', { v: v ? 1 : 0 }); }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { setAway(true); return; }
    if (!G.blackout) setAway(false);
    last = performance.now(); gfx.win = []; G.lastInput = last;
  });
  // Màn đen tiết kiệm pin: phủ đen cả màn hình (màn OLED tắt hẳn điểm ảnh), dừng vẽ và dừng vòng lặp,
  // máy chủ treo hộ nếu đang bật tự động. Chạm 2 lần (hoặc Esc) để bật lại.
  let boTimer = 0, loopParked = false;
  function boInfo() {
    const el = $('blackout'), me = G.me;
    if (!el || !me) return;
    const ep = me.expNext ? (me.exp / me.expNext * 100).toFixed(1) : '0';
    el.style.transform = `translate(${(Math.random() - 0.5) * 120 | 0}px, ${(Math.random() - 0.5) * 160 | 0}px)`;   // dịch chữ: màn OLED không lưu ảnh khi treo lâu
    el.querySelector('.bo-info').textContent = `${me.name} · Cấp ${me.level} (${ep}%)\nSinh lực ${Math.max(0, Math.round(me.hp)).toLocaleString('vi-VN')}/${me.stats.maxHp.toLocaleString('vi-VN')}${me.dead ? ' – ĐÃ BỊ HẠ' : ''}\n💰 ${me.gold.toLocaleString('vi-VN')} lượng\n🤖 Tự động: ${G.auto ? (G.map && G.map.safe ? 'bật (đang ở thành – không đánh)' : 'bật – máy chủ đang treo hộ') : 'tắt'}`;
  }
  G.setBlackout = on => {
    on = !!on;
    if (on === !!G.blackout || (on && !G.inGame)) return;
    G.blackout = on;
    let el = $('blackout');
    if (!el) {
      el = document.createElement('div'); el.id = 'blackout'; el.className = 'hidden';
      el.innerHTML = '<div class="bo-info"></div><div class="bo-hint">Chạm 2 lần để bật lại màn hình</div>';
      document.body.appendChild(el);
      let tap = 0;
      el.addEventListener('pointerdown', e => { e.preventDefault(); const t = performance.now(); if (t - tap < 450) G.setBlackout(false); tap = t; });
    }
    el.classList.toggle('hidden', !on);
    document.body.classList.toggle('blackout', on);
    clearInterval(boTimer);
    if (on) { G.moveTo = null; boInfo(); boTimer = setInterval(boInfo, 3000); setAway(true); return; }
    setAway(false);
    last = performance.now(); gfx.win = []; G.lastInput = last;
    if (loopParked) { loopParked = false; requestAnimationFrame(loop); }
  };
  document.addEventListener('keydown', e => { if (G.blackout && e.code === 'Escape') G.setBlackout(false); });
  function loop(now) {
    if (G.blackout) { loopParked = true; return; }   // màn đen: dừng hẳn vòng lặp, bật lại thì chạy tiếp
    const budget = frameBudget(now);
    if (budget && now - last < budget - 4) { if (G.inGame) requestAnimationFrame(loop); return; }   // bỏ khung (màn 60/120Hz)
    const dt = Math.min(0.1, (now - last) / 1000);   // khung chậm vẫn đi đúng quãng (trước giới hạn 0,05 làm nhân vật như bị hãm lại)
    gfx.k = budget ? budget / 16.67 : 1;
    if (!G._mlCover && budget !== 50) gfxTick(now - last, now);   // khung chậm lúc tải map / lúc vẽ thưa khi để yên không tính vào tự hạ độ nét
    last = now;
    try { update(dt); if (!G._mlCover) draw(now); UI.frame(now); } catch (e) { console.error(e); }
    PerfHud.frame(now);
    if (G.inGame) requestAnimationFrame(loop);
  }

  G.show = show;
  boot();
})();
