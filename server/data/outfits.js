// Ngoại trang: "nhuộm" lại bộ áo của phái (giữ nguyên kiểu áo, nếp vải, bóng đổ – game đổi màu theo bảng dưới).
// Vai màu: robe (áo chính), robe2 (lớp áo phụ / lót), trim (viền), pants (quần), belt (đai). Thiếu vai nào thì giữ màu gốc của phái.
// test: chỉ phát qua quản trị viên để thử (chưa bán, chưa rơi).
const OUTFITS = {
  bach_y:    { name: 'Bạch Y Thư Sinh',  rarity: 'rare',      test: true, fx: '#e8f2ff',
               colors: { robe: '#f4f6fa', robe2: '#cdd5e4', trim: '#3a3e52', pants: '#e4e7ee', belt: '#3a3e52', sleevecol: '#cdd5e4', cape: '#3a3e52' } },
  hac_long:  { name: 'Hắc Long Bào',     rarity: 'epic',      test: true, fx: '#ffd040',
               colors: { robe: '#24242e', robe2: '#3c3020', trim: '#e2b23e', pants: '#1a1a22', belt: '#e2b23e', sleevecol: '#3c3020', cape: '#e2b23e' } },
  hong_lien: { name: 'Hồng Liên Tiên Y', rarity: 'epic',      test: true, fx: '#ff8cc6',
               colors: { robe: '#ff7eb2', robe2: '#ffd2e6', trim: '#ffffff', pants: '#f8bcd4', belt: '#c2306e', sleevecol: '#ffd2e6', cape: '#c2306e' } },
  bang_tam:  { name: 'Băng Tâm Ngọc Y',  rarity: 'legendary', test: true, fx: '#9ef0ff',
               colors: { robe: '#a6e6ff', robe2: '#e8faff', trim: '#2a78b0', pants: '#cfeeff', belt: '#2a78b0', sleevecol: '#e8faff', cape: '#2a78b0' } },
  xich_hoa:  { name: 'Xích Hỏa Chiến Bào', rarity: 'legendary', test: true, fx: '#ff7a2a',
               colors: { robe: '#cf2414', robe2: '#ff9422', trim: '#2c1a10', pants: '#3a1a12', belt: '#ffd040', sleevecol: '#ff9422', cape: '#2c1a10' } }
};
for (const id in OUTFITS) OUTFITS[id].id = id;
module.exports = { OUTFITS };
