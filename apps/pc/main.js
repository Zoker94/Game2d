// Võ Lâm Pixel cho máy tính: cửa sổ riêng mở thẳng game (volam2d.com/play), F11 toàn màn hình, link ngoài mở bằng trình duyệt.
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const HOST = 'volam2d.com', URL = `https://${HOST}/play?app=pc`;
app.commandLine.appendSwitch('disable-renderer-backgrounding');     // thu nhỏ cửa sổ vẫn chạy (treo máy)
app.commandLine.appendSwitch('disable-background-timer-throttling');
function create() {
  const win = new BrowserWindow({
    width: 1280, height: 760, minWidth: 900, minHeight: 540, backgroundColor: '#0b0810', title: 'Võ Lâm Pixel',
    icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, backgroundThrottling: false, spellcheck: false }
  });
  Menu.setApplicationMenu(null);
  win.loadURL(URL);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { try { const h = new globalThis.URL(url).hostname; if (h !== HOST && !h.endsWith('.' + HOST)) { e.preventDefault(); shell.openExternal(url); } } catch (er) { } });
  win.webContents.on('before-input-event', (e, inp) => {
    if (inp.type !== 'keyDown') return;
    if (inp.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (inp.key === 'F5') { win.webContents.reload(); e.preventDefault(); }
    if (inp.key === 'F12' && inp.control && inp.shift) win.webContents.openDevTools({ mode: 'detach' });
  });
  win.webContents.on('did-fail-load', (e, code, desc, url, main) => {
    if (!main) return;
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<body style="margin:0;background:#140a06;color:#f5e6c8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center"><div><h2 style="color:#ffd36a">Mất kết nối</h2><p>Kiểm tra mạng rồi bấm thử lại.</p><a href="${URL}" style="padding:12px 28px;background:#e8b048;color:#2a0e02;border-radius:8px;text-decoration:none;font-weight:bold">Thử lại</a></div></body>`));
  });
}
app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
