// Điểm khởi động: kết nối dữ liệu (Postgres nếu có DATABASE_URL, ngược lại file JSON) rồi chạy game.
const db = require('./db');
db.init()
  .then(() => require('./app'))
  .catch(e => { console.error('Không thể khởi động:', e); process.exit(1); });
