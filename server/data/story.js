// Cốt truyện chính "Võ Mục Di Thư" – 7 chương nối theo đường đi các bản đồ.
// Bối cảnh: cuối đời Nam Tống, quân Mông Cổ vây Tương Dương. Quách đại hiệp trấn thủ thành.
// Bộ binh thư "Võ Mục Di Thư" của Nhạc Vũ Mục bị xé thành 7 tàn quyển thất lạc khắp giang hồ;
// Thiên Ma Giáo tái xuất, câu kết ngoại bang để đoạt sách. Người chơi – một thiếu hiệp mới nhập
// giang hồ – lần theo dấu vết từng tàn quyển.
//
// Bước (step): type = talk {npc} | map {map} | kill {mons, n} | elite {map, mon, hp} | level {n}
//   | equip (mặc vũ khí) | skill (thi triển kỹ năng) | buy (mua đồ ở cửa hàng) | daily (xong 1 nhiệm vụ ngày)
//   text: mục tiêu hiển thị; intro: hội thoại khi bước bắt đầu; lines: hội thoại khi gặp NPC (talk);
//   done: hội thoại khi hoàn thành; reward: { expPct (tỉ lệ KN lên cấp), gold, knb, items }
// Người nói: 'n' dẫn truyện, 'me' nhân vật chính, 'npc:<id>', 'mon:<id>', hoặc tên tuỳ ý.
// {name} = tên nhân vật, {cls} = môn phái.

const PROLOGUE = {
  title: 'Võ Mục Di Thư',
  lines: [
    'Năm ấy, thiết kỵ Mông Cổ tràn xuống phương Nam như nước lũ.',
    'Tương Dương – cửa ngõ cuối cùng của Đại Tống – đã bị vây suốt mấy mùa trăng. Quách đại hiệp cùng quân dân trong thành ngày đêm giữ từng tấc tường.',
    'Trong giang hồ lại lan truyền một lời đồn: binh thư "Võ Mục Di Thư" của Nhạc Vũ Mục năm xưa chưa hề thất truyền, mà bị xé thành bảy tàn quyển, thất lạc khắp bốn phương.',
    'Kẻ nào gom đủ bảy quyển, kẻ ấy nắm trong tay vận mệnh thiên hạ.',
    'Hai mươi năm trước, Thiên Ma Giáo bị võ lâm chính phái liên thủ tiêu diệt nơi Ma Giáo Cấm Địa. Nay, những bóng áo đen lại xuất hiện…',
    'Và đúng lúc ấy, một thiếu hiệp phái {cls} tên {name} đặt chân tới cổng thành Tương Dương.'
  ]
};

const CHAPTERS = [
  {
    // Chương 1 kiêm hướng dẫn tân thủ: mỗi bước dạy một thao tác. tut: N là bước thuần hướng dẫn, ứng với bước N của
    // hướng dẫn tân thủ kiểu cũ: người chơi cũ đã qua bước đó thì tự bỏ qua. hint: mẹo thao tác hiện dưới mục tiêu.
    name: 'Sơ Nhập Giang Hồ', lv: 1,
    desc: 'Tới Tương Dương, {name} được Trưởng Lão chỉ dạy những bước đầu hành tẩu giang hồ, rồi lên đường dẹp đám Mã Tặc quấy nhiễu ngoài thành – và phát hiện chúng không phải bọn cướp tầm thường.',
    steps: [
      { type: 'talk', npc: 'truong_lao', text: 'Gặp Trưởng Lão Tân Thủ ở quảng trường Tương Dương',
        hint: 'Đi theo mũi tên 📜 tới NPC có dấu ❗ rồi chạm vào NPC (PC: bấm chuột hoặc phím F) để nói chuyện.',
        lines: [['npc:truong_lao', 'Hài tử, đường xa vất vả rồi. Lão phu nhìn khí sắc ngươi, hẳn là đệ tử phái {cls}?'],
                ['me', 'Vãn bối {name}, phụng mệnh sư phụ xuống núi lịch luyện, nghe tin Tương Dương nguy cấp nên tới góp sức.'],
                ['npc:truong_lao', 'Tốt! Quách đại hiệp giữ thành, nhưng ngoài thành Mã Tặc hoành hành, cướp cả lương thảo tiếp tế.'],
                ['npc:truong_lao', 'Có điều tay không ra ngoài thành thì chẳng khác gì dâng mạng cho giặc. Mở hành trang ra, cầm lấy thanh Mộc Kiếm sư môn trao cho ngươi đã.']],
        reward: { expPct: 0.5, gold: 300 } },
      { type: 'equip', tut: 1, text: 'Mở Túi đồ và trang bị Mộc Kiếm',
        hint: 'Mở Túi đồ (phím I hoặc nút 🎒), chạm vào Mộc Kiếm rồi chọn "Trang bị".',
        done: [['npc:truong_lao', 'Ra dáng hiệp khách rồi đấy! Giờ hãy qua cổng phía Đông ra Ngoại Ô xem tình hình.']],
        reward: { items: [['hp1', 10], ['mp1', 10]] } },
      { type: 'map', map: 'ngoai_o', text: 'Đi qua cổng phía Đông tới Ngoại Ô Tương Dương',
        hint: 'Di chuyển bằng phím WASD / mũi tên (điện thoại: cần gạt bên trái). Đi theo mũi tên 📜 tới cổng sáng ở mép bản đồ.',
        done: [['n', 'Ngoài thành, khói bếp tắt lạnh, ruộng đồng bỏ hoang. Vết vó ngựa dày đặc dẫn về phía rừng.'],
               ['me', 'Bầy thỏ rừng phá nát cả ruộng… Trước khi đụng độ Mã Tặc, cứ luyện tay với chúng đã.']],
        reward: { expPct: 0.3 } },
      { type: 'kill', tut: 3, mons: ['tho_rung'], n: 5, text: 'Luyện tay: hạ 5 Thỏ Rừng',
        hint: 'Chạm vào quái để chọn, rồi đánh bằng phím 1 / Space (điện thoại: nút kiếm lớn). Nút 🤖 Tự động (phím R) sẽ tự đánh quái gần bạn.',
        done: [['me', 'Tay chân đã nóng. Giờ tới lượt bọn Mã Tặc!']],
        reward: { expPct: 0.4, gold: 200 } },
      { type: 'kill', mons: ['ma_tac'], n: 8, text: 'Đánh tan 8 tên Mã Tặc',
        hint: 'Hết máu thì dùng thuốc: phím Z (máu) / X (nội lực), hoặc nút bình thuốc trên màn hình.',
        done: [['n', 'Trong người tên Mã Tặc cuối cùng có một phong thư dán sáp đen, vẽ hình xoáy gió.'],
               ['me', 'Dấu "Hắc Phong"… Bọn cướp ngựa sao lại thư từ qua lại? Phải mang về cho người biết chuyện xem.']],
        reward: { expPct: 0.6, gold: 400, items: [['hp1', 10]] } },
      { type: 'talk', npc: 'su_gia', text: 'Mang phong thư sáp đen về cho Sứ Giả Nhiệm Vụ ở Tương Dương',
        hint: 'Mang thư về nhanh: dùng Phù Về Thành trong túi đồ, hoặc nút 🏠 Về thành.',
        lines: [['npc:su_gia', 'Sáp đen xoáy gió… Đây là ám hiệu của Hắc Phong Trại dưới Bến Đò Hán Thủy!'],
                ['npc:su_gia', 'Thư viết: "Lang Vương đã thuần, đêm trăng tròn thả bầy sói chặn đường tiếp tế." Chúng dùng sói để cắt đứt lương thảo của thành!'],
                ['npc:su_gia', 'Lang Vương là con sói đầu đàn hung tợn nhất Ngoại Ô. Muốn diệt nó, võ công của ngươi phải tiến thêm một bậc.'],
                ['npc:su_gia', 'Đây là bộ giáp vải và một quyển bí kíp võ công bổn môn ta giữ hộ. Hãy lĩnh hội rồi thi triển thử xem.']],
        reward: { expPct: 0.4, gold: 300, items: [['armor_0_common', 1], ['@book1', 1]] } },
      { type: 'skill', tut: 5, text: 'Học bí kíp võ công rồi thi triển chiêu thức',
        hint: 'Mở Túi đồ, chạm vào Sách võ công → "Dùng" để học. Sau đó bấm phím 2 (điện thoại: nút kỹ năng thứ hai) để thi triển.',
        done: [['npc:su_gia', 'Chiêu thức có uy lực lắm! Nhưng Lang Vương rất hung tợn, ngươi nên ghé Dược Điếm mua ít thuốc trị thương phòng thân.']],
        reward: { expPct: 0.3 } },
      { type: 'buy', tut: 6, text: 'Mua thuốc tại Dược Điếm Hồi Xuân ở Tương Dương',
        hint: 'Tới Dược Điếm (có dấu ❗), chọn món rồi bấm "Mua". Thuốc dùng nhanh bằng phím Z / X.',
        done: [['n', 'Đêm xuống. Ngoài Ngoại Ô, bầy sói của Lang Vương bắt đầu lảng vảng quanh đường tiếp tế…']],
        reward: { gold: 500 } },
      { type: 'kill', mons: ['soi_xam'], n: 10, text: 'Diệt 10 Sói Xám trong bầy của Lang Vương ở Ngoại Ô',
        hint: 'Bấm vào khung 📜 bên trái để xem toàn bộ chương. Nhặt đồ rơi bằng cách đi qua.',
        done: [['me', 'Bầy sói đông quá, diệt mãi không hết. Phải tìm thêm người giúp sức.']],
        reward: { expPct: 0.5, items: [['boots_0_rare', 1]] } },
      { type: 'daily', tut: 8, text: 'Nhận và hoàn thành 1 nhiệm vụ hàng ngày của Sứ Giả Nhiệm Vụ',
        hint: 'Mở bảng Nhiệm vụ (nút 📜) → tab "Hàng ngày". Làm xong nhiệm vụ thì bấm "Nhận".',
        intro: [['npc:su_gia', 'Bá tánh Tương Dương cần người giúp những việc hằng ngày. Ngươi giúp họ, họ sẽ giúp ngươi – lương thực, thuốc men, cả tin tức nữa.']],
        done: [['npc:su_gia', 'Dân chúng đều nhắc tên {name} rồi đấy. Mỗi ngày bảng việc đều được làm mới, đừng quên ghé qua.']],
        reward: { gold: 1000, items: [['stone', 3]] } },
      { type: 'level', n: 8, text: 'Rèn luyện tới cấp 8',
        hint: 'Đánh quái ở Ngoại Ô để lên cấp. Lên cấp được điểm tiềm năng: mở bảng Nhân vật để cộng.',
        reward: { items: [['mp1', 10], ['stone', 2]] } },
      { type: 'elite', map: 'ngoai_o', mon: 'boss_soi', hp: 0.12, text: 'Hạ Lang Vương ở Ngoại Ô Tương Dương',
        hint: 'Lang Vương có vòng cảnh báo đỏ trước khi ra chiêu: chạy ra khỏi vòng để né.',
        intro: [['n', 'Trăng vừa lên. Từ bìa rừng Ngoại Ô vang lên tiếng hú rợn người…'], ['mon:boss_soi', 'Grrrraooo!']],
        done: [['n', 'Lang Vương gục xuống. Trên cổ nó đeo một vòng sắt khắc chữ "Hắc Phong". Bầy sói tan tác bỏ chạy.']],
        reward: { expPct: 0.8, gold: 1000 } },
      { type: 'talk', npc: 'truong_lao', text: 'Báo tin với Trưởng Lão Tân Thủ – xuất sư',
        lines: [['npc:truong_lao', 'Giỏi lắm! Đường tiếp tế đã thông. Từ nay ngươi đã đủ bản lĩnh tự mình hành tẩu giang hồ – coi như xuất sư rồi!'],
                ['npc:truong_lao', 'Nhưng chuyện này không đơn giản… Hắc Phong Trại vốn chỉ là bọn thủy tặc. Kẻ đứng sau chúng ắt đang tìm thứ gì đó quanh Tương Dương.'],
                ['npc:truong_lao', 'Ngươi từng nghe tới "Võ Mục Di Thư" chưa? Binh thư của Nhạc Vũ Mục… Lão phu e rằng có kẻ đang săn lùng nó.']],
        reward: { expPct: 1.0, gold: 2000, knb: 50, items: [['weapon_1_rare', 1], ['lucky_chest', 1]] } }
    ]
  },
  {
    name: 'Sóng Gió Hán Thủy', lv: 8,
    desc: 'Lần theo dấu Hắc Phong tới Bến Đò Hán Thủy và Cổ Mộ Hoang Sơn, {name} tìm thấy tàn quyển đầu tiên – cùng dấu vết của một giáo phái tưởng đã diệt vong.',
    steps: [
      { type: 'map', map: 'ben_do', text: 'Tới Bến Đò Hán Thủy (cổng phía Nam Tương Dương)',
        done: [['n', 'Thuyền bè trên sông Hán nằm úp, dân chài trốn biệt. Thủy Tặc tuần tra khắp bờ.']], reward: { expPct: 0.3 } },
      { type: 'kill', mons: ['thuy_tac'], n: 12, text: 'Dẹp 12 tên Thủy Tặc',
        done: [['me', 'Bọn này đều mang dấu xoáy gió. Sào huyệt hẳn ở Thủy Trại phía Đông.']], reward: { expPct: 0.6, gold: 600 } },
      { type: 'talk', npc: 'tieu_cuc', text: 'Hỏi tin Tổng Tiêu Đầu Long Môn ở Tương Dương',
        lines: [['npc:tieu_cuc', 'Hắc Phong Trại? Ba chuyến tiêu của Long Môn ta đều bị chúng cướp trắng!'],
                ['npc:tieu_cuc', 'Lạ ở chỗ, chúng chẳng màng vàng bạc, chỉ lục tìm sách vở, thư tịch. Một tiêu sư của ta còn nghe chúng nhắc "tàn quyển".'],
                ['me', 'Quả nhiên là Võ Mục Di Thư. Vãn bối sẽ đánh vào Thủy Trại!']],
        reward: { expPct: 0.4, gold: 500 } },
      { type: 'kill', mons: ['hac_phong_tac'], n: 10, text: 'Tiến vào Thủy Trại Hắc Phong, hạ 10 Hắc Phong Tặc', reward: { expPct: 0.6, gold: 800 } },
      { type: 'elite', map: 'thuy_trai', mon: 'dau_muc', hp: 9, text: 'Hạ Đầu Mục Thủy Trại',
        intro: [['mon:dau_muc', 'Thằng nhãi ranh dám xông vào Thủy Trại! Người đâu, băm nó cho cá ăn!']],
        done: [['mon:dau_muc', 'Khụ… Ngươi thắng rồi… Quyển sách… ta đã giao cho người áo đen ở Cổ Mộ… Hắn nói Thiên Ma sẽ trở lại…'],
               ['n', 'Trong rương của Đầu Mục còn sót lại một tờ da dê cổ: Tàn quyển thứ nhất của Võ Mục Di Thư!']],
        reward: { expPct: 0.8, gold: 1500, items: [['stone', 3]] } },
      { type: 'kill', mons: ['cuong_thi_nho', 'u_hon'], n: 12, text: 'Tới Cổ Mộ Hoang Sơn (cổng phía Tây), diệt 12 cương thi / u hồn',
        intro: [['n', 'Cổ Mộ Hoang Sơn – nơi chôn cất tướng sĩ chết trận. Đêm đêm người ta thấy xác chết đứng dậy nhảy cóc giữa mộ phần.']],
        reward: { expPct: 0.6, gold: 800 } },
      { type: 'elite', map: 'co_mo', mon: 'mo_thu', hp: 9, text: 'Hạ Mộ Thủ Quỷ – kẻ luyện thi trong Cổ Mộ',
        intro: [['mon:mo_thu', 'Hắc hắc… Lại thêm một cái xác tươi cho ta luyện thi. Thiên Ma Giáo vạn tuế!']],
        done: [['n', 'Mộ Thủ Quỷ tan thành khói đen, để lại một lệnh bài khắc ba chữ "Thiên Ma Lệnh".']],
        reward: { expPct: 0.8, gold: 1500 } },
      { type: 'talk', npc: 'tang_kinh', text: 'Mang Thiên Ma Lệnh tới Tàng Kinh Các ở Tương Dương',
        lines: [['npc:tang_kinh', 'Thiên Ma Lệnh! Hai mươi năm rồi lão phu mới thấy lại vật này…'],
                ['npc:tang_kinh', 'Năm ấy chính phái liên thủ phá Ma Giáo Cấm Địa, nhưng Thiên Ma Giáo Chủ chưa từng lộ xác. Nếu hắn còn sống và gom đủ bảy tàn quyển…'],
                ['npc:tang_kinh', 'Ngươi giữ tàn quyển thứ nhất cẩn thận. Tàn quyển thứ hai, theo sử sách, được chôn ở rừng trúc Thanh Thành.']],
        reward: { expPct: 1.0, gold: 3000, items: [['armor_2_rare', 1], ['lucky_chest', 1]] } }
    ]
  },
  {
    name: 'Thanh Thành Huyết Ảnh', lv: 14,
    desc: 'Rừng trúc Thanh Thành nhuốm độc, làng mạc thành tro tàn. {name} đối mặt Thanh Xà Tinh để giành lại tàn quyển thứ hai.',
    steps: [
      { type: 'level', n: 14, text: 'Rèn luyện tới cấp 14', reward: { items: [['hp2', 10]] } },
      { type: 'kill', mons: ['son_phi'], n: 12, text: 'Qua Sơn Đạo Thanh Thành (phía Đông Ngoại Ô), dẹp 12 Sơn Phỉ',
        intro: [['n', 'Con đường núi dẫn tới Thanh Thành bị Sơn Phỉ chặn. Chúng thu "phí qua đường" bằng máu.']], reward: { expPct: 0.6, gold: 1000 } },
      { type: 'kill', mons: ['xac_song'], n: 12, text: 'Tới Làng Hoang Phế, siêu độ 12 Xác Sống',
        intro: [['n', 'Ngôi làng dưới chân núi đã chết. Những thân xác tím tái lang thang trong sương độc…'], ['me', 'Đây là độc rắn… Thứ gì trong rừng trúc đã gây nên chuyện này?']],
        reward: { expPct: 0.6, gold: 1000 } },
      { type: 'talk', npc: 'thuong_nhan', map: 'truc_lam', text: 'Hỏi chuyện Thương Nhân Lưu Động ở Rừng Trúc Thanh Thành',
        lines: [['npc:thuong_nhan', 'Thiếu hiệp đi đâu vào chốn này? Rừng trúc giờ là hang ổ của Thanh Xà Tinh rồi!'],
                ['npc:thuong_nhan', 'Con rắn thành tinh ấy cuộn mình trên một hòm đá cổ giữa rừng. Ai lại gần đều bị phun độc. Có người áo đen hay đến cho nó ăn…'],
                ['me', 'Hòm đá cổ… chính là nơi giấu tàn quyển!']],
        reward: { expPct: 0.4, gold: 800 } },
      { type: 'kill', mons: ['ran_truc'], n: 15, text: 'Diệt 15 Trúc Diệp Thanh mở đường', reward: { expPct: 0.6, gold: 1000 } },
      { type: 'elite', map: 'truc_lam', mon: 'boss_truc', hp: 0.12, text: 'Hạ Thanh Xà Tinh giữa Rừng Trúc',
        intro: [['n', 'Mặt đất rung chuyển. Một con mãng xà xanh biếc to như cột đình trườn ra, mang bành sừng ngọc.'], ['mon:boss_truc', 'Xìiiiiii…']],
        done: [['n', 'Thanh Xà Tinh đổ gục. Trong hòm đá cổ, {name} tìm thấy Tàn quyển thứ hai – và dấu chân người áo đen dẫn về phía Hắc Hùng Động.']],
        reward: { expPct: 0.9, gold: 2500, items: [['stone', 4]] } },
      { type: 'elite', map: 'dong_gau', mon: 'hung_vuong', hp: 8, text: 'Vào Hắc Hùng Động, hạ Hùng Vương mang ấn Ma Giáo',
        intro: [['n', 'Trong động tối, một con gấu khổng lồ khoác giáp đồng gầm lên. Trên giáp khắc dấu Thiên Ma.']],
        done: [['n', 'Hùng Vương gục ngã. Kẻ áo đen đã bỏ trốn, để lại mảnh giấy: "Hoa Sơn Luận Kiếm – nơi chính phái tụ hội, cũng là nơi diệt chính phái."']],
        reward: { expPct: 0.9, gold: 2500 } },
      { type: 'talk', npc: 'truong_lao', text: 'Báo tin với Trưởng Lão Tân Thủ',
        lines: [['npc:truong_lao', 'Hai tàn quyển đã về tay ngươi, nhưng Ma Giáo định ra tay ở Hoa Sơn Luận Kiếm sao?'],
                ['npc:truong_lao', 'Đại hội ấy quy tụ cao thủ khắp thiên hạ. Nếu Ma Giáo trà trộn hạ độc, võ lâm sẽ mất hết rường cột!'],
                ['npc:truong_lao', 'Ngươi phải tới đó. Lễ Quan triều đình đang chiêu mộ hiệp sĩ dự đại hội.']],
        reward: { expPct: 1.0, gold: 5000, items: [['helmet_3_rare', 1], ['lucky_chest', 1]] } }
    ]
  },
  {
    name: 'Hoa Sơn Luận Kiếm', lv: 20,
    desc: 'Đại hội Hoa Sơn Luận Kiếm sắp khai mạc. {name} phải vạch mặt bọn Hắc Y Kiếm Khách trà trộn và vượt qua thử thách của Kiếm Ma Độc Cô Cầu Bại.',
    steps: [
      { type: 'level', n: 20, text: 'Rèn luyện tới cấp 20', reward: { items: [['hp2', 10], ['mp2', 10]] } },
      { type: 'talk', npc: 'le_quan', text: 'Gặp Lễ Quan ở Tương Dương để nhận thiếp mời Hoa Sơn',
        lines: [['npc:le_quan', 'Ngươi là {name}? Danh tiếng diệt Lang Vương, trảm Thanh Xà đã truyền tới tai triều đình.'],
                ['npc:le_quan', 'Đây là thiếp mời Hoa Sơn Luận Kiếm. Quách đại hiệp dặn: hãy để mắt tới những kẻ áo đen lạ mặt.']],
        reward: { expPct: 0.4, gold: 1000 } },
      { type: 'kill', mons: ['dao_khach'], n: 12, text: 'Vượt Vực Sâu Hoa Sơn, hạ 12 Đao Khách chặn đường', reward: { expPct: 0.6, gold: 1500 } },
      { type: 'kill', mons: ['kiem_khach'], n: 15, text: 'Lên Hoa Sơn Tuyệt Đỉnh, vạch mặt 15 Hắc Y Kiếm Khách',
        intro: [['n', 'Trên đỉnh Hoa Sơn, giữa những cao thủ chính phái, thấp thoáng bóng áo đen giấu kiếm trong tay áo…']],
        done: [['me', 'Trong người chúng toàn là Nhuyễn Cân Tán – độc làm tê liệt nội lực! Chúng định hạ độc cả đại hội.']],
        reward: { expPct: 0.7, gold: 1800 } },
      { type: 'elite', map: 'hoa_son', mon: 'khi_dot', hp: 8, text: 'Đuổi theo Hầu Vương – con khỉ đã cướp mất tàn quyển',
        intro: [['n', 'Đang lúc hỗn loạn, một con khỉ lông vàng đeo vòng kim cô vọt tới, giật phắt túi đồ của {name}!'], ['me', 'Tàn quyển! Đứng lại!']],
        done: [['n', 'Hầu Vương bị đánh đuổi, bỏ lại túi đồ. May thay hai tàn quyển vẫn còn nguyên. Hóa ra nó được Ma Giáo huấn luyện để trộm đồ.']],
        reward: { expPct: 0.8, gold: 2500 } },
      { type: 'kill', mons: ['kiem_no'], n: 12, text: 'Vào Kiếm Trủng Cổ Mộ, phá 12 Kiếm Nô canh giữ', reward: { expPct: 0.7, gold: 2000 } },
      { type: 'elite', map: 'hoa_son', mon: 'boss_hoason', hp: 0.12, text: 'Vượt thử thách của Độc Cô Cầu Bại trên Hoa Sơn',
        intro: [['mon:boss_hoason', 'Kiếm Trủng là nơi lão phu chôn kiếm. Ngươi muốn lấy tàn quyển giấu ở đó, phải bước qua kiếm của lão phu trước.'],
                ['me', 'Vãn bối {name}, xin tiền bối chỉ giáo!']],
        done: [['mon:boss_hoason', 'Ha ha ha! Cầu bại cả đời, hôm nay mới thấy hậu sinh khả úy. Tàn quyển thứ ba này, ngươi xứng đáng giữ.'],
               ['mon:boss_hoason', 'Nhớ kỹ: kẻ áo đen đã đi về Tây Vực. Thiên Ma năm xưa luyện công ở Lâu Lan…']],
        reward: { expPct: 1.0, gold: 4000, items: [['stone', 5]] } },
      { type: 'talk', npc: 'tang_kinh', text: 'Mang tàn quyển thứ ba về Tàng Kinh Các',
        lines: [['npc:tang_kinh', 'Ba tàn quyển… Ngươi xem, ghép lại thì hiện ra một tấm bản đồ: con đường tơ lụa tới Lâu Lan cổ thành.'],
                ['npc:tang_kinh', 'Tây Vực là đất của Ma Giáo năm xưa. Đi đường cẩn thận, hài tử.']],
        reward: { expPct: 1.0, gold: 8000, knb: 20, items: [['weapon_3_epic', 1], ['boss_chest', 1]] } }
    ]
  },
  {
    name: 'Tây Vực Phong Vân', lv: 28,
    desc: 'Theo bản đồ trên tàn quyển, {name} băng qua Cổ Đạo Tơ Lụa và sa mạc Tây Vực, tới phế tích Lâu Lan – nơi Thiên Ma năm xưa luyện ma công.',
    steps: [
      { type: 'level', n: 28, text: 'Rèn luyện tới cấp 28', reward: { items: [['hp3', 10]] } },
      { type: 'talk', npc: 'tieu_cuc', text: 'Gặp Tổng Tiêu Đầu Long Môn, hỏi đường Tây Vực',
        lines: [['npc:tieu_cuc', 'Đi Tây Vực? Đoàn tiêu sang Lâu Lan của ta mất tích đã nửa tháng nay.'],
                ['npc:tieu_cuc', 'Nghe nói Sa Mạc Mã Tặc giờ có đao khách Tây Vực cầm đầu, kẻ nào cũng mang lệnh bài đen. Nếu gặp tiêu sư của ta, xin cứu giúp.']],
        reward: { expPct: 0.4, gold: 1500 } },
      { type: 'kill', mons: ['ma_tac_sa'], n: 15, text: 'Trên Cổ Đạo Tơ Lụa, dẹp 15 Sa Mạc Mã Tặc', reward: { expPct: 0.6, gold: 2500 } },
      { type: 'kill', mons: ['lang_nhan'], n: 15, text: 'Vào Sa Mạc Tây Vực, hạ 15 Tây Vực Đao Khách',
        done: [['n', 'Tên Đao Khách cuối cùng thều thào: "Hạt Hoàng… canh cổng Lâu Lan… không ai qua được…"']], reward: { expPct: 0.7, gold: 3000 } },
      { type: 'elite', map: 'sa_mac', mon: 'boss_samac', hp: 0.12, text: 'Hạ Sa Mạc Hạt Hoàng canh cổng Lâu Lan',
        intro: [['n', 'Cát dưới chân sụt xuống. Một con bọ cạp khổng lồ giáp vàng, gai lưng sáng như lửa trồi lên giữa bão cát!']],
        done: [['n', 'Hạt Hoàng gục ngã, để lộ lối vào lòng đất dẫn tới Lâu Lan Cổ Thành.']], reward: { expPct: 0.9, gold: 4000, items: [['stone', 5]] } },
      { type: 'kill', mons: ['vong_binh'], n: 15, text: 'Vào Lâu Lan Cổ Thành, siêu độ 15 Vong Binh',
        intro: [['n', 'Lâu Lan – vương quốc bị cát vùi lấp. Vong binh vẫn canh giữ cung điện đổ nát như thể chủ nhân chưa từng rời đi.']], reward: { expPct: 0.7, gold: 3000 } },
      { type: 'kill', mons: ['doc_hat'], n: 10, text: 'Diệt 10 Độc Hạt trong cung điện Lâu Lan',
        done: [['n', 'Sâu trong cung điện, trên bệ đá khắc hình ma vương, {name} tìm thấy Tàn quyển thứ tư.'],
               ['n', 'Trên tường có dòng chữ máu còn mới: "Băng Cung đã quy phục. Tàn quyển năm và sáu ở Thiên Sơn. — Thiên Ma"']],
        reward: { expPct: 0.8, gold: 3500 } },
      { type: 'talk', npc: 'truong_lao', text: 'Báo tin với Trưởng Lão Tân Thủ',
        lines: [['npc:truong_lao', 'Băng Cung quy phục Ma Giáo? Không thể nào! Cung Chủ Băng Cung là người chính trực, lão phu từng gặp…'],
                ['npc:truong_lao', 'Trừ phi… bà ta trúng "Nhiếp Hồn Đại Pháp" của Thiên Ma. Hài tử, ngươi phải lên Thiên Sơn!']],
        reward: { expPct: 1.0, gold: 12000, knb: 30, items: [['armor_4_epic', 1], ['boss_chest', 1]] } }
    ]
  },
  {
    name: 'Thiên Sơn Tuyết Hận', lv: 38,
    desc: 'Băng Cung trên Thiên Sơn đã trở thành tay sai Ma Giáo. {name} phải phá Nhiếp Hồn Đại Pháp, cứu Cung Chủ và lấy lại hai tàn quyển.',
    steps: [
      { type: 'level', n: 38, text: 'Rèn luyện tới cấp 38', reward: { items: [['hp3', 15], ['mp3', 10]] } },
      { type: 'talk', npc: 'su_gia', text: 'Gặp Sứ Giả Nhiệm Vụ hỏi tin Thiên Sơn',
        lines: [['npc:su_gia', 'Huynh đệ Cái Bang trên Thiên Sơn báo về: đệ tử Băng Cung mắt đỏ như máu, gặp ai cũng chém.'],
                ['npc:su_gia', 'Muốn giải Nhiếp Hồn Đại Pháp cần Hàn Băng Ngọc trong Băng Phách Động. Nhưng trước hết phải khống chế được Cung Chủ.']],
        reward: { expPct: 0.4, gold: 2000 } },
      { type: 'kill', mons: ['bang_tac'], n: 15, text: 'Tại Thiên Sơn Khẩu, dẹp 15 Băng Tặc', reward: { expPct: 0.6, gold: 3500 } },
      { type: 'kill', mons: ['bang_nu'], n: 15, text: 'Vào Băng Cung, khống chế 15 Đệ Tử Băng Cung bị nhiếp hồn',
        intro: [['n', 'Cung điện băng lạnh lẽo. Những nữ đệ tử áo trắng đồng loạt quay lại, ánh mắt đỏ rực vô hồn.']], reward: { expPct: 0.7, gold: 4000 } },
      { type: 'elite', map: 'bang_cung', mon: 'boss_bang', hp: 0.12, text: 'Đánh bại Băng Cung Cung Chủ đang bị khống chế',
        intro: [['mon:boss_bang', 'Kẻ nào… dám xâm phạm Băng Cung? Thiên Ma Giáo Chủ có lệnh… giết!'], ['me', 'Cung Chủ, xin tỉnh lại! Người đang bị nhiếp hồn!']],
        done: [['mon:boss_bang', 'Ta… ta đã làm gì thế này? Tên Thiên Ma ấy… hắn dùng tà thuật khống chế ta, cướp đi Tàn quyển thứ năm và thứ sáu của Băng Cung.'],
               ['mon:boss_bang', 'Hắn để lại một bản sao ở đây làm mồi nhử. Ta còn giữ được… Tàn quyển thứ năm thật. Quyển sáu, hắn đã mang về Ma Giáo Cấm Địa.']],
        reward: { expPct: 1.0, gold: 6000, items: [['stone2', 1]] } },
      { type: 'kill', mons: ['bang_phach'], n: 12, text: 'Vào Băng Phách Động, diệt 12 Băng Phách Yêu, lấy Hàn Băng Ngọc',
        done: [['n', 'Hàn Băng Ngọc tỏa ánh sáng xanh lạnh. Đệ tử Băng Cung lần lượt tỉnh lại. Cung Chủ trao cho {name} một lệnh bài: "Băng Cung nguyện theo thiếu hiệp diệt Ma."']],
        reward: { expPct: 0.8, gold: 5000 } },
      { type: 'talk', npc: 'tang_kinh', text: 'Mang Tàn quyển thứ năm về Tàng Kinh Các',
        lines: [['npc:tang_kinh', 'Năm tàn quyển… Thiên Ma giữ quyển sáu, còn quyển bảy – quyển ghi tinh hoa binh pháp – chưa ai biết ở đâu.'],
                ['npc:tang_kinh', 'Có lẽ chính Thiên Ma cũng đang tìm nó. Trận chiến cuối cùng sẽ diễn ra ở Ma Giáo Cấm Địa.']],
        reward: { expPct: 1.0, gold: 18000, knb: 40, items: [['weapon_5_epic', 1], ['boss_chest', 1]] } }
    ]
  },
  {
    name: 'Thiên Ma Tái Thế', lv: 48,
    desc: 'Trận chiến cuối cùng. {name} dẫn đầu chính phái tiến vào Ma Giáo Cấm Địa, đối đầu Thiên Ma Giáo Chủ để giành lại Võ Mục Di Thư và cứu Tương Dương.',
    steps: [
      { type: 'level', n: 48, text: 'Rèn luyện tới cấp 48', reward: { items: [['hp4', 10], ['mp4', 10]] } },
      { type: 'talk', npc: 'truong_lao', text: 'Gặp Trưởng Lão Tân Thủ trước trận quyết chiến',
        lines: [['npc:truong_lao', 'Hài tử, ngươi đã đi một chặng đường dài. Từ một thiếu niên vô danh, nay giang hồ gọi ngươi là "{name} đại hiệp".'],
                ['npc:truong_lao', 'Quân Mông Cổ đã bí mật đưa quân tới Hắc Phong Cốc để hội quân với Ma Giáo. Nếu Thiên Ma có đủ binh thư, Tương Dương sẽ thất thủ.'],
                ['me', 'Vãn bối nguyện lấy tính mạng bảo vệ Tương Dương!']],
        reward: { expPct: 0.5, gold: 3000 } },
      { type: 'kill', mons: ['hac_y_ma'], n: 15, text: 'Vào Hắc Phong Cốc, diệt 15 Hắc Y Ma', reward: { expPct: 0.7, gold: 5000 } },
      { type: 'kill', mons: ['ma_binh'], n: 20, text: 'Tiến vào Ma Giáo Cấm Địa, hạ 20 Ma Giáo Binh', reward: { expPct: 0.8, gold: 6000 } },
      { type: 'elite', map: 'u_minh', mon: 'diem_la', hp: 10, text: 'Vào U Minh Điện, hạ Diêm La Sứ – hộ pháp của Thiên Ma',
        intro: [['mon:diem_la', 'Sổ sinh tử đã ghi tên ngươi, {name}. Đêm nay là đêm cuối của ngươi!']],
        done: [['n', 'Diêm La Sứ gục xuống, trong tay vẫn nắm chặt Tàn quyển thứ sáu. Cánh cửa dẫn tới tế đàn Thiên Ma mở ra…']],
        reward: { expPct: 1.0, gold: 8000, items: [['stone2', 2]] } },
      { type: 'elite', map: 'ma_giao', mon: 'boss_ma', hp: 0.12, text: 'Quyết chiến Thiên Ma Giáo Chủ tại Ma Giáo Cấm Địa',
        intro: [['mon:boss_ma', 'Ha ha ha! Hai mươi năm nằm gai nếm mật, cuối cùng có kẻ mang sáu tàn quyển tới tận tay bổn tọa!'],
                ['mon:boss_ma', 'Quyển thứ bảy nằm trong đầu bổn tọa. Gom đủ bảy quyển, thiên hạ này là của Thiên Ma Giáo!'],
                ['me', 'Thiên Ma! Hôm nay ta thay mặt võ lâm chính phái và bá tánh Tương Dương, đòi lại món nợ máu này!']],
        done: [['mon:boss_ma', 'Không… thể nào… Bổn tọa… vô địch thiên hạ…'],
               ['n', 'Thiên Ma Giáo Chủ ngã xuống. Ma Giáo tan rã, quân Mông Cổ mất nội ứng phải rút về phương Bắc.']],
        reward: { expPct: 1.5, gold: 20000, items: [['stone2', 3]] } },
      { type: 'talk', npc: 'truong_lao', text: 'Trở về Tương Dương, kết thúc hành trình',
        lines: [['npc:truong_lao', 'Tương Dương được cứu rồi! Quách đại hiệp đích thân dặn lão phu chuyển lời cảm tạ ngươi.'],
                ['npc:truong_lao', 'Sáu tàn quyển đã ghép lại. Còn quyển thứ bảy… Quách đại hiệp nói: "Tinh hoa binh pháp không nằm trên giấy, mà ở lòng dân." Có lẽ Nhạc Vũ Mục chưa từng viết nó ra.'],
                ['me', 'Vì nước vì dân, mới là hiệp chi đại giả. Vãn bối đã hiểu.'],
                ['n', 'Từ đó, giang hồ truyền tụng danh hiệu "Tương Dương Đại Hiệp – {name}". Nhưng giang hồ chưa bao giờ yên bình… Hành trình vẫn còn tiếp diễn.']],
        reward: { expPct: 2.0, gold: 50000, knb: 100, items: [['weapon_6_legendary', 1], ['boss_chest', 2]] } }
    ]
  }
];

// Chương 1 trước khi gộp hướng dẫn tân thủ có 7 bước: chỉ số cũ -> chỉ số mới (đổi tiến độ người chơi cũ)
const CH1_V1_MAP = [0, 2, 4, 5, 10, 11, 12];

module.exports = { PROLOGUE, CHAPTERS, CH1_V1_MAP };
