// Máy chủ (server) trò chơi: mỗi server là 1 tiến trình riêng, dữ liệu / tài khoản tách hẳn.
// Tương Dương = server chính (cổng PORT, phục vụ trang web). Tô Châu = tiến trình con do server chính tự chạy,
// trình duyệt gọi qua đường dẫn /s/tochau/... (server chính chuyển tiếp) nên không cần sửa Nginx / tên miền.
const REALMS = {
  tuongduong: { id: 'tuongduong', name: 'Tương Dương', code: 'VL' },
  tochau: { id: 'tochau', name: 'Tô Châu', code: 'TC' }
};
const ID = REALMS[process.env.SERVER_ID] ? process.env.SERVER_ID : 'tuongduong';
module.exports = Object.assign({ REALMS, ID, IS_MAIN: ID === 'tuongduong', CHILDREN: ['tochau'] }, { NAME: REALMS[ID].name, CODE: REALMS[ID].code });
