// Server chính (Tương Dương) tự chạy tiến trình con cho các server khác (Tô Châu) và chuyển tiếp
// /s/<id>/... (HTTP + WebSocket của socket.io) sang tiến trình đó. Server con dùng dữ liệu riêng:
// file DATA_DIR/<id>/db.json, hoặc bảng Postgres vl_store_<id>. Bật / tắt cho người chơi vào: trang quản trị server chính.
const path = require('path');
const http = require('http');
const net = require('net');
const { fork } = require('child_process');
const R = require('./realm');

const BASE_PORT = +process.env.PORT || 3000;
const kids = {};   // id -> { port, proc, up, online, startAt, fails }

function portBusy(port) {
  return new Promise(res => {
    const s = net.connect(port, '127.0.0.1');
    s.once('connect', () => { s.destroy(); res(true); });
    s.once('error', () => res(false));
  });
}

function start(db) {
  if (/^(1|true|yes)$/i.test(process.env.REALMS_OFF || '')) return;
  R.CHILDREN.forEach((id, i) => {
    const k = kids[id] = { id, port: +process.env['PORT_' + id.toUpperCase()] || BASE_PORT + 301 + i, proc: null, up: false, online: 0, fails: 0 };
    const spawn = async () => {
      // đợi tiến trình cũ (lần chạy trước) lưu xong dữ liệu và nhả cổng -> tránh đọc dữ liệu cũ
      for (let t = 0; t < 120 && await portBusy(k.port); t++) await new Promise(r => setTimeout(r, 1000));
      const dataDir = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), id);
      const env = Object.assign({}, process.env, { SERVER_ID: id, PORT: String(k.port), DATA_DIR: dataDir, DB_TABLE: 'vl_store_' + id, KEEP_AWAKE: '0' });
      delete env.KEEP_AWAKE_URL; delete env.RENDER_EXTERNAL_URL;
      const p = k.proc = fork(path.join(__dirname, 'index.js'), process.argv.slice(2), { env, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      k.startAt = Date.now();
      p.on('message', m => {
        if (!m || typeof m !== 'object') return;
        if (m.ready) { k.up = true; k.fails = 0; sendOpen(db, id); }
        if (m.online != null) k.online = m.online | 0;
      });
      p.on('exit', code => {
        k.up = false; k.proc = null; k.online = 0;
        if (shutting) return;
        k.fails++;
        console.warn(`[server ${R.REALMS[id].name}] dừng (mã ${code}) – chạy lại sau ${Math.min(60, 3 * k.fails)} giây`);
        setTimeout(spawn, Math.min(60, 3 * k.fails) * 1000);
      });
    };
    spawn();
  });
}
let shutting = false;
function stopAll() { shutting = true; for (const k of Object.values(kids)) if (k.proc) try { k.proc.kill('SIGTERM'); } catch (e) { } }

const isOpen = (db, id) => !!((db.data.config.realmsOpen || {})[id]);
function sendOpen(db, id) { const k = kids[id]; if (k && k.proc && k.proc.connected) k.proc.send({ open: isOpen(db, id), bank: db.data.config.bank || null }); }   // kèm tài khoản nhận nạp tiền (dùng chung)
function send(id, msg) { const k = kids[id]; if (k && k.proc && k.proc.connected) { k.proc.send(msg); return true; } return false; }

// danh sách server cho màn đăng nhập / trang quản trị
function list(db, mainOnline) {
  const c = db.data.config;
  return [{ id: R.ID, name: R.NAME, open: !c.maintenance, up: true, online: mainOnline | 0 }]
    .concat(R.CHILDREN.map(id => { const k = kids[id] || {}; return { id, name: R.REALMS[id].name, open: isOpen(db, id), up: !!k.up, online: k.online | 0 }; }));
}

const PREFIX = /^\/s\/([a-z]+)(\/.*)?$/;
// HTTP: phải gắn TRƯỚC express.json (giữ nguyên thân yêu cầu để chuyển tiếp)
function httpProxy(req, res, next) {
  const m = PREFIX.exec(req.url);
  if (!m || !R.CHILDREN.includes(m[1])) return next();
  const k = kids[m[1]];
  const fail = () => { if (!res.headersSent) res.status(502).json({ error: `Server ${R.REALMS[m[1]].name} đang khởi động, vui lòng thử lại sau ít giây` }); else res.end(); };
  if (!k || !k.up) return fail();
  const up = http.request({ host: '127.0.0.1', port: k.port, method: req.method, path: m[2] || '/', headers: req.headers }, r => {
    res.writeHead(r.statusCode, r.headers); r.pipe(res);
  });
  up.on('error', fail);
  req.pipe(up);
}
// WebSocket (socket.io) qua /s/<id>/socket.io/...
function upgrade(req, socket, head) {
  const m = PREFIX.exec(req.url);
  if (!m) { if (!req.url.startsWith('/socket.io/')) socket.destroy(); return; }   // /socket.io/ của server chính: socket.io tự xử lý
  const k = kids[m[1]];
  if (!k || !k.up) return socket.destroy();
  const up = net.connect(k.port, '127.0.0.1', () => {
    let h = `${req.method} ${m[2] || '/'} HTTP/${req.httpVersion}\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) h += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
    up.write(h + '\r\n'); if (head && head.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  const end = () => { socket.destroy(); up.destroy(); };
  up.on('error', end); socket.on('error', end); up.on('close', end); socket.on('close', end);
}

module.exports = { start, stopAll, list, sendOpen, send, httpProxy, upgrade, isOpen, kids };
