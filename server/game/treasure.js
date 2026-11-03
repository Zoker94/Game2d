// Tàng Bảo Đồ: Boss bang có 5% rơi Mảnh Tàng Bảo Đồ (mỗi người được tính thưởng tung riêng). Gom 4 mảnh (Sử dụng) ghép thành
// 1 Tàng Bảo Đồ hoàn chỉnh (đồ khoá). Mỗi tấm bản đồ giấu 1 kho báu: câu đố về bản đồ trong game + lối đi tính từ 1 NPC làm mốc
// ("từ chỗ Xa Phu đi 4 bước về phía Đông, 3 bước về phía Nam"). Đứng đúng chỗ (lệch tối đa ~1 ô) mà trong túi có Tàng Bảo Đồ
// hoàn chỉnh thì hiện nút ⛏ Đào; đào 3 giây (đứng yên) -> nhận 1 món Thần Khí (vũ khí Thần Binh đúng môn phái).
// Vị trí kho báu chỉ nằm ở máy chủ (không gửi toạ độ cho máy khách) – không soi được bằng công cụ.
const U = require('./util');
const { MAPS, TILE, baseOf } = require('../data/maps');
const { NPCS } = require('../data/npcs');
const { ITEMS } = require('../data/items');
const { MONSTERS } = require('../data/monsters');

const FRAG = 'tb_frag', MAP_ID = 'tb_map', NEED = 4, DIG_MS = 3000;
const FRAG_CHANCE = 0.05;
const NEAR_R = 1.25 * TILE, WARM_R = 4 * TILE;

// câu đố theo bản đồ (đáp án là tên bản đồ – người chơi phải tự đoán ra nơi đó). Mỗi nơi nhiều câu viết tay,
// cộng thêm câu tự sinh từ quái của bản đồ (xem clueFor) -> mỗi tấm bản đồ bốc ngẫu nhiên 1 câu.
const CLUES = {
  // ---- thành thị ----
  tuong_duong: [
    'Thành trì mà Quách Tĩnh – Hoàng Dung tử thủ mấy chục năm chống vó ngựa Mông Cổ.',
    'Nơi mọi tân thủ bước ra giang hồ, có Trưởng Lão Tân Thủ đứng chờ chỉ dạy.',
    'Thành lớn nhất trung nguyên trong game, nơi có Kỳ Trân Các và Lễ Quan.',
    'Từ đây Sứ Giả Hoa Sơn, Mộ Binh Quan và Thành Quan đưa người đi tham gia đại sự võ lâm.'
  ],
  cho_phien: [
    'Nơi người người bày sạp mua bán, chủ sạp đi vắng hàng vẫn bày – cửa hàng không bao giờ đóng.',
    'Muốn mở gian hàng ở đây phải có Lệnh Bài Bán Hàng.',
    'Nơi Quản Lý Chợ trông coi trăm gian hàng của người chơi.'
  ],
  thanh_do: [
    'Phủ thành đất Thục, quê của gấm vóc và vị cay nồng.',
    'Thành trì thứ hai trên đường đi, mở cửa cho đại hiệp từ cấp 20.',
    'Kinh đô xưa của nước Thục thời Tam Quốc, nay là phủ thành sầm uất.'
  ],
  lan_chau: [
    'Thành trì bên bờ Hoàng Hà, cửa ngõ của con đường đi Tây Vực.',
    'Thành mở cửa cho đại hiệp từ cấp 30, nằm giữa trung nguyên và sa mạc.',
    'Nơi dòng sông Mẹ chảy qua giữa lòng thành, thương đoàn nghỉ chân trước khi vào Tây Vực.'
  ],
  long_mon: [
    'Trấn nhỏ giữa sa mạc, khách điếm đầy giang hồ hiểm ác.',
    'Cửa ải cuối cùng trước khi vào những vùng đất cấp cao, mở cho đại hiệp từ cấp 55.',
    'Cá chép vượt "cửa rồng" thì hoá rồng – tên trấn này cũng mang ý ấy.'
  ],
  // ---- bãi luyện ----
  ngoai_o: [
    'Bãi luyện ngay ngoài cổng thành, nơi kẻ mới cầm vũ khí lần đầu đánh quái.',
    'Thỏ rừng nhảy nhót, sói xám rình mồi – vùng ven thành dành cho người mới.',
    'Chặng đầu tiên của mọi cuộc hành trình, cấp 1 đến 10.'
  ],
  ben_do: [
    'Bến sông gần Tương Dương, nơi người qua sông phải chờ con thuyền nhỏ.',
    'Thủy xà dưới nước, thủy tặc trên bờ – bến sông chẳng mấy yên bình.',
    'Nơi thuyền neo đậu bên dòng sông lớn chảy qua đất Kinh Tương, cấp 3 đến 12.'
  ],
  thuy_trai: [
    'Sào huyệt của bọn cướp sông mang tên một cơn gió đen, dựng ngay trên mặt nước.',
    'Một gã đầu mục cầm đầu lũ giặc nước, đóng quân bằng cọc gỗ giữa dòng.',
    'Trại giặc trên sông, nơi Phân Đà Tiêu Cục đóng gần để dẹp loạn.'
  ],
  co_mo: [
    'Nơi người xưa yên nghỉ giữa núi không người, nay cương thi và u hồn không yên giấc.',
    'Quỷ giữ mộ canh những nấm mồ lạnh lẽo nơi vùng tân thủ.',
    'Chốn âm u nhất của vùng tân thủ – mộ cổ chôn ở núi hoang.'
  ],
  lang_hoang: [
    'Ngôi làng bỏ hoang, xác sống lang thang giữa những mái nhà đổ nát.',
    'Dân làng đã bỏ đi hết, chỉ còn sói đói và thổ phỉ.',
    'Làng xưa phế tích, nơi người chết chẳng chịu nằm yên.'
  ],
  truc_lam: [
    'Gió thổi lá xào xạc trong rừng cây thân đốt, dưới chân ngọn núi Đạo giáo đất Thục.',
    'Rắn lục ẩn mình giữa những thân cây rỗng ruột, gấu đen rình bên suối.',
    'Rừng tre bạt ngàn nơi Hắc Hùng và sơn tặc trú ngụ, cấp 10 đến 20.'
  ],
  dong_gau: [
    'Hang đá tối tăm, chúa của loài gấu ngự trị nơi sâu nhất.',
    'Tiếng gấu gầm vang trong hang đá, rắn hang bò dưới chân.',
    'Hang gấu cấp 15 đến 22 – đừng đánh thức chúa gấu.'
  ],
  hoa_son: [
    'Ngọn núi hiểm nhất thiên hạ, Ngũ Tuyệt từng luận kiếm – hãy lên tới tận đỉnh cao nhất của nó.',
    'Hổ trắng và vua khỉ tranh nhau ngọn núi đá dựng đứng, một trong Ngũ Nhạc.',
    'Đỉnh cao nhất của Tây Nhạc, nơi kiếm khách áo đen lảng vảng trên vách đá.'
  ],
  kiem_trung: [
    'Mộ chôn kiếm của bậc kiếm khách cô độc tìm thất bại cả đời.',
    'Kiếm Hồn, Kiếm Nô, Kiếm Ma – nơi những thanh kiếm cũng có linh hồn.',
    'Nghĩa địa của binh khí, "trủng" nghĩa là mộ.'
  ],
  sa_mac: [
    'Biển cát vàng phía Tây, gió cuốn cát che lấp cả lối về.',
    'Vua bọ cạp bò dưới cát nóng, cương thi phơi xương dưới nắng cháy.',
    'Vùng cát cháy Tây Vực, cấp 30 đến 40, nơi Tây Vực Đao Khách rong ruổi.'
  ],
  lau_lan: [
    'Cổ quốc bị cát vùi lấp trên con đường tơ lụa, chỉ còn vong binh canh gác.',
    'Thành cổ đã chết, vong binh vẫn tuần tra quanh tường đổ.',
    'Vương quốc biến mất giữa sa mạc – tên của nó gắn với một mỹ nhân ướp xác ngàn năm.'
  ],
  bang_cung: [
    'Cung điện băng giá trên dãy Thiên Sơn, tuyết phủ quanh năm.',
    'Nữ đệ tử cung băng múa kiếm giữa trời tuyết trắng.',
    'Tuyết quái và sói trắng quanh một cung điện trong suốt như pha lê, cấp 40 đến 50.'
  ],
  bang_dong: [
    'Hang sâu dưới lòng núi tuyết, yêu quái băng giá ẩn trong vách đá lạnh.',
    'Động ngầm buốt giá, nơi tuyết yêu và băng xà trú ngụ.',
    'Ở cạnh cung băng nhưng nằm dưới lòng đất – hang của hàn khí.'
  ],
  ma_giao: [
    'Cấm địa của tà giáo – người chính phái chớ bén mảng.',
    'Hỏa Quỷ và U Linh lang thang trong vùng đất mà chính phái cấm bước vào.',
    'Đất cấm cấp 50, nơi giáo chủ tà phái từng xưng bá.'
  ],
  con_lon: [
    'Tiên cảnh trên dãy núi tổ của vạn sơn – không phải sơn môn của phái mang cùng tên.',
    'Hồ ly tiên, kiếm tiên và vượn tay dài sống giữa mây núi tổ phương Tây.',
    'Bãi luyện cấp 60, nơi tiên khí lượn lờ quanh núi cao nhất phương Tây.'
  ],
  thien_tri: [
    'Hồ trên đỉnh núi tuyết, Băng Giao ẩn dưới mặt nước đóng băng.',
    'Người khổng lồ băng giá canh hồ thiêng, thánh nữ núi tuyết ngự trên bờ.',
    'Mặt hồ phẳng như gương nằm sát trời, giữa băng tuyết vạn năm, cấp 66 đến 74.'
  ],
  vo_luong: [
    'Sơn cốc nơi chàng thư sinh họ Đoàn rơi xuống vách đá, gặp pho tượng ngọc "thần tiên tỷ tỷ".',
    'Độc mãng và Xích Diễm Hổ ẩn trong cốc núi mang tên "không thể đo lường".',
    'Thung lũng có ngọc bích khắc kiếm pháp trên vách, cấp 72 đến 80.'
  ],
  nhac_mieu: [
    'Ngôi miếu thờ vị anh hùng có bốn chữ "Tận Trung Báo Quốc" xăm trên lưng.',
    'Hồn những người lính trung nghĩa vẫn đứng gác quanh nơi thờ chủ tướng của họ.',
    'Nơi anh linh vị đại tướng bị gian thần hại chết hiện về – đánh bại anh linh nhận được Tâm Pháp.'
  ],
  huyet_ma: [
    'Vực sâu nhuộm máu, nơi ma đầu luyện tà công.',
    'Sói, vệ binh, sát thần – mọi thứ nơi đây đều đỏ một màu máu.',
    'Vực thẳm cấp 80 đến 90, mùi tanh nồng bốc lên từ đáy.'
  ],
  thien_ngoai: [
    '"Ngoài trời còn có trời" – vùng đất ở trên cả mây xanh.',
    'Thần binh của triều đình trên trời tuần tra, tiên nữ bay lượn – chốn tiên giới cấp 100.',
    'Thần Lang và Thánh Thú tuyết vực canh giữ cõi trời ngoài trời.'
  ],
  cuu_u: [
    'Chín tầng âm u tận cùng, ma vực không thấy ánh mặt trời.',
    'Bãi luyện cao nhất, cấp 110 đến 120, nơi Thiên Ma Đại Tướng cầm quân.',
    'Ma lang, quỷ tướng và ma hồn của tầng địa ngục sâu nhất.'
  ],
  // ---- sơn môn 9 phái ----
  thieu_lam_tu: [
    'Ngôi chùa trên núi Thiếu Thất, nơi Đạt Ma tổ sư diện bích chín năm.',
    'Thiên hạ võ công xuất từ đây – 72 tuyệt kỹ, đệ tử dùng côn.',
    'Sơn môn của các nhà sư đầu trọc luyện Dịch Cân Kinh.'
  ],
  thien_vuong_dao: [
    'Hòn đảo giữa hồ Động Đình, sào huyệt của bang phái dùng chùy.',
    'Sơn môn nằm giữa sóng nước, đệ tử khoẻ như vâm, dũng mãnh vô song.',
    'Phái có tên là vua của trời, đóng trên một hòn đảo.'
  ],
  duong_gia_bao: [
    'Thành lũy của gia tộc ám khí đất Thục, cơ quan cạm bẫy khắp nơi.',
    'Nơi chế tạo Bạo Vũ Lê Hoa Châm và vạn loại ám khí.',
    'Môn phái là một gia tộc, sơn môn là một tòa "bảo".'
  ],
  van_doc_coc: [
    'Thung lũng của vạn loài độc vật nơi Miêu Cương, đệ tử nuôi cổ trùng.',
    'Năm loài độc là rắn, rết, bọ cạp, nhện, cóc – thờ ở sơn cốc này.',
    'Phái dùng đao tẩm độc, sơn môn là một cái cốc.'
  ],
  nga_my_son: [
    'Ngọn núi Phật giáo đất Thục, nữ ni múa kiếm trên Kim Đỉnh.',
    'Phái của Diệt Tuyệt sư thái và Chu Chỉ Nhược, toàn đệ tử nữ.',
    'Nơi đệ tử nữ vừa tụng kinh vừa luyện kiếm, chữa thương giỏi nhất giang hồ.'
  ],
  thuy_yen_mon: [
    'Môn phái nữ nhân ở Vân Nam, sử song đao như liễu rủ khói biếc.',
    'Sơn môn mang tên "khói biếc", đệ tử múa song đao uyển chuyển.',
    'Phái của những nữ hiệp đất Đại Lý dùng song đao và băng công.'
  ],
  cai_bang_da: [
    'Tổng đà của bang hội ăn mày đông nhất thiên hạ.',
    'Nơi truyền Hàng Long Thập Bát Chưởng và Đả Cẩu Bổng Pháp.',
    'Bang chủ mang gậy trúc xanh, đệ tử đeo túi vải – nơi đây là tổng đà.'
  ],
  vo_dang_son: [
    'Ngọn núi Đạo giáo do Trương Tam Phong khai sơn lập phái.',
    'Nơi truyền Thái Cực Quyền, Thái Cực Kiếm – lấy nhu khắc cương.',
    'Đạo sĩ áo xanh luyện kiếm trên núi, đối trọng của Thiếu Lâm.'
  ],
  con_lon_phai: [
    'Sơn môn của phái đạo sĩ Tây Vực dùng phù chú gọi sấm sét.',
    'Phái mang tên ngọn núi tổ phương Tây, đệ tử vẽ bùa triệu lôi.',
    'Không phải tiên cảnh – đây là sơn môn của chính phái ấy.'
  ]
};
// NPC làm mốc (chỉ dùng NPC có 1 người trên bản đồ; không dùng NPC mang tên thành / bản đồ – lộ đáp án)
const LANDMARK = ['xa_phu', 'thuong_nhan', 'truong_lao', 'quan_cho', 'tieu_cuc_pd', 'tho_ren', 'duoc_diem', 'tap_hoa', 'kim_hoan', 'khu_bia', 'phi_phong', 'truyen_cong', 'sect_ho_phap'];
const COMMON = new Set(['thành', 'động', 'cốc', 'sơn', 'phái', 'môn', 'trấn', 'phủ', 'điện', 'đảo', 'tự', 'đà', 'cổ', 'thiên']);
// cách nói lối đi (bốc ngẫu nhiên)
const WAYS = [
  (n, w) => `Từ chỗ ${n} đứng, đi ${w}. Đào ở đó.`,
  (n, w) => `Bắt đầu bên cạnh ${n}, bước ${w} – kho báu nằm dưới chân.`,
  (n, w) => `Tìm ${n}, rồi từ đó đi ${w}. Đất ở đó còn mới xới.`,
  (n, w) => `Đứng sát ${n}, đếm ${w}, rồi cắm cuốc xuống.`,
  (n, w) => `Vị tông sư để lại lời nhắn: "Gặp ${n}, đi ${w}, đào sâu ba thước."`
];

class Treasure {
  constructor(world) { this.w = world; world.treasure = this; }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }

  // ---------- tạo kho báu ----------
  // bản đồ hợp cấp: cấp thấp nhất của bản đồ không quá cấp người ghép + 5 (người mới không bị gửi tới Cửu U)
  spotsFor(lv) { return Object.keys(CLUES).filter(id => MAPS[id] && Math.max(MAPS[id].minLv || 1, parseInt(MAPS[id].lv, 10) || 1) <= lv + 5); }
  // câu đố: câu viết tay hoặc câu tự sinh theo quái của bản đồ
  clueFor(mid) {
    const pool = (CLUES[mid] || []).slice(), d = MAPS[mid];
    const mons = [...new Set((d.spawns || []).map(s => s.mon))].map(id => MONSTERS[id] && MONSTERS[id].name).filter(Boolean);
    if (mons.length >= 2) {
      // bỏ quái có tên trùng chữ với tên bản đồ (lộ đáp án), vd. "Vô Lượng Kiếm Khách" ở Vô Lượng Sơn Cốc
      const words = d.name.toLowerCase().split(/\s+/).filter(w => w.length > 1 && !COMMON.has(w));
      mons.splice(0, mons.length, ...mons.filter(n => !words.some(w => n.toLowerCase().split(/\s+/).includes(w))));
    }
    if (mons.length >= 2) {
      const a = mons.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(3, mons.length));
      pool.push(`Nơi ${a.slice(0, -1).join(', ')} và ${a[a.length - 1]} lui tới.`, `Kẻ nào hạ được ${a[0]} và ${a[1]} hẳn đã từng đặt chân tới đây.`);
      if (/^\d+-\d+$/.test(d.lv || '')) pool.push(`Bãi luyện cấp ${d.lv.replace('-', ' đến ')}, nơi ${a[0]} sinh sống.`);
    }
    return pool[U.randInt(0, pool.length - 1)];
  }
  makeTarget(lv) {
    const ids = this.spotsFor(lv);
    for (let tries = 0; tries < 60; tries++) {
      const mid = ids[U.randInt(0, ids.length - 1)], d = MAPS[mid];
      const cnt = {}; for (const n of d.npcs || []) cnt[n.id] = (cnt[n.id] || 0) + 1;
      const lms = (d.npcs || []).filter(n => cnt[n.id] === 1 && LANDMARK.includes(n.id) && NPCS[n.id]);
      if (!lms.length) continue;
      const n = lms[U.randInt(0, lms.length - 1)];
      const dx = U.randInt(-7, 7), dy = U.randInt(-6, 6);
      if (Math.abs(dx) + Math.abs(dy) < 3) continue;
      const tx = n.x + dx, ty = n.y + dy;
      if (tx < 1 || ty < 1 || tx >= d.w - 1 || ty >= d.h - 1) continue;
      if (!d.walkable.includes(ty * d.w + tx)) continue;
      if ((d.npcs || []).some(o => o.x === tx && o.y === ty)) continue;
      return { m: mid, x: tx, y: ty, npc: n.id, dx, dy, q: this.clueFor(mid), wv: U.randInt(0, WAYS.length - 1) };
    }
    return { m: 'tuong_duong', x: MAPS.tuong_duong.center.x + 3, y: MAPS.tuong_duong.center.y + 2, npc: null, dx: 3, dy: 2 };
  }
  // c.tbMaps: danh sách kho báu, số phần tử = số Tàng Bảo Đồ hoàn chỉnh đang có (bản đồ trong túi chồng lên nhau)
  sync(c) {
    const have = U.countItem(c, MAP_ID);
    c.tbMaps = Array.isArray(c.tbMaps) ? c.tbMaps : [];
    while (c.tbMaps.length < have) c.tbMaps.push(this.makeTarget(c.level));
    if (c.tbMaps.length > have) c.tbMaps.length = have;
    return c.tbMaps;
  }
  riddle(t) {
    const step = (n, a, b) => n ? `${Math.abs(n)} bước về phía ${n > 0 ? a : b}` : '';
    const way = [step(t.dx, 'Đông', 'Tây'), step(t.dy, 'Nam', 'Bắc')].filter(Boolean).join(', rồi ');
    const c = CLUES[t.m];
    return { clue: t.q || (Array.isArray(c) ? c[0] : c) || '', way: t.npc ? WAYS[t.wv | 0](NPCS[t.npc].name, way) : `Từ giữa thành đi ${way}.` };
  }

  // ---------- dùng vật phẩm ----------
  combine(p) {
    const c = p.c, have = U.countItem(c, FRAG);
    if (have < NEED) return this.toast(p, `Cần ${NEED} Mảnh Tàng Bảo Đồ để ghép (đang có ${have}). Mảnh rơi từ Boss bang.`, 'error');
    if (U.freeSlots(c) < 1 && !c.inv.some(x => x.id === MAP_ID)) return this.toast(p, 'Túi đồ đầy', 'error');
    U.removeItemById(c, FRAG, NEED);
    this.sync(c);
    U.addItem(c, MAP_ID, 1, 0, null, true);
    c.tbMaps.push(this.makeTarget(c.level));
    p.dirtyMe = true; this.w.db.markDirty();
    this.toast(p, '📜 Ghép thành công Tàng Bảo Đồ! Sử dụng để xem câu đố và tìm nơi chôn kho báu.', 'reward');
    this.w.db.log('item', `${c.name} ghép Tàng Bảo Đồ`);
    this.view(p, { wid: `dv_wp_${c.cls}` });   // máy khách chiếu đoạn phim giới thiệu bản đồ & Thần Khí rồi mở câu đố
  }
  view(p, cut) {
    const list = this.sync(p.c);
    p.socket.emit('treasure', { list: list.map((t, i) => Object.assign({ i }, this.riddle(t))), near: p._tbNear || null, cut: cut || null });
  }

  // ---------- tìm & đào ----------
  nearState(p) {
    const list = Array.isArray(p.c.tbMaps) ? p.c.tbMaps : [];
    if (!list.length || !U.countItem(p.c, MAP_ID)) return null;
    const base = baseOf(p.mapId);
    let best = null;
    list.forEach((t, i) => {
      if (t.m !== base) return;
      const d = Math.hypot(p.x - (t.x + 0.5) * TILE, p.y - (t.y + 0.5) * TILE);
      const lv = d <= NEAR_R ? 2 : d <= WARM_R ? 1 : 0;
      if (lv && (!best || lv > best.lv)) best = { i, lv };
    });
    return best;
  }
  dig(p) {
    if (p.dead || p.duel) return;
    this.sync(p.c);
    const s = this.nearState(p);
    if (!s || s.lv < 2) return this.toast(p, 'Chỗ này không có gì cả… Hãy đọc kỹ câu đố trên Tàng Bảo Đồ.', 'error');
    if (p._tbDig) return;
    p._tbDig = { i: s.i, at: Date.now(), x: p.x, y: p.y };
    p.socket.emit('tbDig', { ms: DIG_MS });
    this.w.fx(p.mapId, { t: 'aura', x: p.x, y: p.y, color: '#ffd76a' });
  }
  finish(p) {
    const g = p._tbDig; p._tbDig = null;
    const c = p.c, list = this.sync(c), t = list[g.i];
    if (!t || !U.countItem(c, MAP_ID)) return;
    const wid = `dv_wp_${c.cls}`;
    if (!ITEMS[wid]) return;
    if (U.freeSlots(c) < 1) { p.socket.emit('tbDig', { cancel: 1 }); return this.toast(p, 'Túi đồ đầy – dọn 1 ô rồi đào lại', 'error'); }
    U.removeItemById(c, MAP_ID, 1);
    list.splice(g.i, 1);
    this.w.giveItem(p, wid, 1);
    p._tbNear = null; p.socket.emit('tbNear', null);
    p.socket.emit('tbDig', { done: 1, id: wid });
    this.w.fx(p.mapId, { t: 'levelup', id: p.id, x: p.x, y: p.y });
    this.toast(p, `⛏ Đào trúng kho báu! Nhận được 🔴 [${ITEMS[wid].name}]!`, 'reward');
    this.w.features.announce(`🔴 ${c.name} lần theo Tàng Bảo Đồ, đào được Thần Khí [${ITEMS[wid].name}] tại ${MAPS[t.m].name}!`);
    this.w.db.log('item', `${c.name} đào Tàng Bảo Đồ ở ${t.m} -> ${wid}`);
    p.dirtyMe = true; this.w.db.markDirty();
  }
  tick(now) {
    for (const p of this.w.players.values()) {
      if (p.offline) continue;
      if (p._tbDig) {
        if (p.dead || Math.hypot(p.x - p._tbDig.x, p.y - p._tbDig.y) > 24) { p._tbDig = null; p.socket.emit('tbDig', { cancel: 1 }); this.toast(p, 'Đã dừng đào (di chuyển hoặc bị hạ)', 'error'); }
        else if (now - p._tbDig.at >= DIG_MS) this.finish(p);
      }
      if (!p.c.tbMaps || !p.c.tbMaps.length) { if (p._tbNear) { p._tbNear = null; p.socket.emit('tbNear', null); } continue; }
      const s = this.nearState(p), lv = s ? s.lv : 0;
      if (lv !== ((p._tbNear && p._tbNear.lv) || 0)) { p._tbNear = s && s.lv ? s : null; p.socket.emit('tbNear', p._tbNear); }
    }
  }
  // Boss bang: mỗi người được tính thưởng tung 5%
  bossDrop() { return Math.random() < (process.env.TB_TEST ? 1 : FRAG_CHANCE); }
  action(p, d) {
    if (!d) return;
    if (d.op === 'view') return this.view(p);
    if (d.op === 'dig') return this.dig(p);
  }
}

module.exports = { Treasure, CLUES };
