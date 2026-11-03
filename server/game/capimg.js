// Ảnh mã xác nhận do MÁY CHỦ vẽ (PNG), máy khách chỉ nhận ảnh – không nhận mã dạng chữ, script không đọc thẳng được.
// Chữ số vẽ từ phông 5x7 phóng to, mỗi chữ nghiêng / xoay / uốn sóng ngẫu nhiên, màu khác nhau, thêm chấm nhiễu và
// đường cong nhiễu cắt ngang. Mã hoá PNG bằng zlib có sẵn của Node.
const zlib = require('zlib');

const W = 200, H = 64;
const FONT = {   // 5x7, mỗi hàng 5 bit
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2],
  5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12]
};
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(px) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const hsl = (h, s, l) => {   // -> [r,g,b]
  const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
};

function make(len = 4) {
  const code = Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
  const px = Buffer.alloc(W * H * 3);
  const put = (x, y, c, a = 1) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; for (let k = 0; k < 3; k++) px[i + k] = Math.round(px[i + k] * (1 - a) + c[k] * a); };
  // nền tối loang màu
  const h0 = Math.random() * 360;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = hsl((h0 + x * 0.4) % 360, 0.35, 0.08 + 0.05 * Math.sin(x / 13 + y / 9)); put(x, y, c); }
  for (let i = 0; i < 260; i++) put(Math.random() * W, Math.random() * H, hsl(Math.random() * 360, 0.6, 0.55), 0.5);
  // chữ số: lấy mẫu ngược (xoay + nghiêng + uốn sóng) từ phông 5x7
  [...code].forEach((ch, i) => {
    const g = FONT[ch], sc = 5.2 + Math.random() * 1.2, rot = (Math.random() - 0.5) * 0.7, shx = (Math.random() - 0.5) * 0.5;
    const cx = 30 + i * 45 + (Math.random() - 0.5) * 8, cy = H / 2 + (Math.random() - 0.5) * 8, wav = 1 + Math.random() * 2, wph = Math.random() * 6;
    const col = hsl(30 + Math.random() * 40, 0.95, 0.6 + Math.random() * 0.15), cos = Math.cos(rot), sin = Math.sin(rot);
    for (let y = -26; y <= 26; y++) for (let x = -20; x <= 20; x++) {
      let u = x * cos + y * sin, v = -x * sin + y * cos;
      u -= shx * v; u += Math.sin(v / 5 + wph) * wav;
      const gx = Math.floor(u / sc + 2.5), gy = Math.floor(v / sc + 3.5);
      if (gx < 0 || gx > 4 || gy < 0 || gy > 6 || !(g[gy] >> (4 - gx) & 1)) continue;
      put(cx + x, cy + y, col);
    }
  });
  // đường cong nhiễu cắt qua chữ
  for (let k = 0; k < 4; k++) {
    const c = hsl(Math.random() * 360, 0.7, 0.6), y0 = Math.random() * H, a1 = (Math.random() - 0.5) * 30, f = 0.02 + Math.random() * 0.04, ph = Math.random() * 6;
    for (let x = 0; x < W; x++) { const y = y0 + Math.sin(x * f + ph) * a1 * 0.5 + (x / W - 0.5) * a1; put(x, y, c, 0.7); put(x, y + 1, c, 0.4); }
  }
  return { code, img: 'data:image/png;base64,' + png(px).toString('base64') };
}

module.exports = { make };
