// Chọn server (Tương Dương / Tô Châu). Mỗi server dữ liệu + tài khoản riêng.
// Server khác server chính được gọi qua /s/<id>/... (API + socket.io); phiên đăng nhập lưu riêng từng server.
(function () {
  const NAMES = { tuongduong: 'Tương Dương', tochau: 'Tô Châu' };
  const fromPath = (location.pathname.match(/^\/s\/([a-z]+)\//) || [])[1];   // trang quản trị của server con: /s/tochau/admin/
  let id = fromPath;
  if (!id) try { id = localStorage.getItem('vl_server'); } catch (e) { }
  // vào /play mà chưa chọn server lần nào (và chưa đăng nhập): sang trang chọn server; app cài đặt (?app=) vẫn vào thẳng
  if (!id && /^\/play\/?$/.test(location.pathname) && !/[?&]app=/.test(location.search)) {
    let tok = null; try { tok = localStorage.getItem('vl_token'); } catch (e) { }
    if (!tok) { location.replace('/server' + location.search); return; }
  }
  if (!NAMES[id]) id = 'tuongduong';
  const base = id === 'tuongduong' ? '' : '/s/' + id;
  window.REALM = {
    id, base, name: NAMES[id], NAMES, sockPath: base + '/socket.io',
    set(nid) { try { localStorage.setItem('vl_server', nid); } catch (e) { } location.reload(); }
  };
  try { document.title += ' · ' + NAMES[id]; } catch (e) { }
  try {   // vừa chuyển cảnh từ trang chọn server: màn trắng tan dần
    if (sessionStorage.getItem('vl_warp')) {
      sessionStorage.removeItem('vl_warp');
      const st = document.createElement('style'); st.textContent = '@keyframes vlWarpIn{to{opacity:0;visibility:hidden}}';
      const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:2147483000;pointer-events:none;animation:vlWarpIn .9s ease .1s forwards';
      document.head.appendChild(st); (document.body || document.documentElement).appendChild(d); setTimeout(() => d.remove(), 1300);
    }
  } catch (e) { }
  if (!base) return;
  const f = window.fetch.bind(window);
  window.fetch = (u, o) => { if (typeof u === 'string' && u.startsWith('/api/') && !u.startsWith('/api/servers')) u = base + u; return f(u, o); };
  const KEYS = { vl_token: 1, vl_admin: 1, vl_admin_user: 1 };   // phiên đăng nhập riêng từng server
  const P = Storage.prototype, g = P.getItem, s = P.setItem, r = P.removeItem, k = x => KEYS[x] ? x + '@' + id : x;
  P.getItem = function (x) { return g.call(this, k(x)); };
  P.setItem = function (x, v) { return s.call(this, k(x), v); };
  P.removeItem = function (x) { return r.call(this, k(x)); };
})();
