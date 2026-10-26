// Môn phái: bản đồ của từng phái, cấp bậc theo tổng điểm cống hiến, cửa hàng đổi cống hiến.
const SECT_MAP = {
  thieulam: 'thieu_lam_tu', thienvuong: 'thien_vuong_dao', duongmon: 'duong_gia_bao', ngudoc: 'van_doc_coc', ngamy: 'nga_my_son',
  thuyyen: 'thuy_yen_mon', caibang: 'cai_bang_da', vodang: 'vo_dang_son', conlon: 'con_lon_phai'
};
// [tổng cống hiến cần, tên cấp bậc]; mỗi bậc +2% công / thủ / sinh lực
const SECT_RANKS = [[0, 'Đệ Tử Ký Danh'], [150, 'Ngoại Môn Đệ Tử'], [500, 'Nội Môn Đệ Tử'], [1200, 'Chân Truyền Đệ Tử'], [2500, 'Hộ Pháp'], [5000, 'Trưởng Lão']];
const SECT_DAILY = 10;
function sectRank(c) {
  const t = (c.sect && c.sect.total) || 0;
  let r = 0;
  for (let i = 0; i < SECT_RANKS.length; i++) if (t >= SECT_RANKS[i][0]) r = i;
  return r;
}
// cửa hàng cống hiến ở Hộ Pháp Môn Phái: cost điểm, rank: cấp bậc tối thiểu
const SECT_SHOP = [
  { id: 'scroll_town', cost: 2, rank: 0 }, { id: 'stone', cost: 8, rank: 0 }, { id: 'mount_food', cost: 4, rank: 0 }, { id: 'exp_x2', cost: 25, rank: 0 },
  { id: 'lucky_chest', cost: 30, rank: 1 }, { id: 'stone2', cost: 80, rank: 2 }, { id: 'mount_stone', cost: 60, rank: 2 }, { id: 'insure', cost: 100, rank: 3 },
  { id: 'boss_chest', cost: 150, rank: 4 }, { id: 'thien_tam_ti', cost: 15, rank: 0 }
];
module.exports = { SECT_MAP, SECT_RANKS, SECT_DAILY, SECT_SHOP, sectRank };
