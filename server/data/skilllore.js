// Lời mô tả chiêu thức võ công (hiện trong bảng Võ Công, kèm thông số tự sinh: tầm đánh, phạm vi, khống chế, hồi chiêu...).
const LORE = {
  // ---- Thiếu Lâm · Thiền Chưởng ----
  tl0: 'Côn pháp nhập môn của tăng nhân Thiếu Lâm: một gậy giáng thẳng, chắc như núi, đánh vào kẻ địch trước mặt.',
  tl1: 'Dồn chân khí Phật môn vào lòng bàn tay, chưởng lực cương mãnh như kim cương phá đá, dễ làm đối thủ choáng váng.',
  tl2: 'Hít sâu một hơi rồi gầm vang như sư tử chúa, âm ba chấn động khắp xung quanh, kẻ địch trong vùng choáng váng tại chỗ.',
  tl3: 'Tâm pháp luyện gân đổi cốt của Đạt Ma Tổ Sư: toàn thân cứng như sắt thép, phòng thủ tăng vọt trong chốc lát.',
  tl4: 'Hóa thân Hộ Pháp Vi Đà, cầm hàng ma xử lao vút tới mục tiêu, nện xuống chấn động cả vùng điểm đáp.',
  tl5: 'Tuyệt kỹ trấn tự: một bàn tay Phật khổng lồ từ trời giáng xuống vùng chỉ định, nghiền nát mọi kẻ địch bên dưới.',
  // ---- Thiếu Lâm · La Hán Côn ----
  tlb0: 'Côn thế Phục Hổ: xoay cổ tay đập ngang, một gậy đủ hạ mãnh hổ. Đòn đánh thường uy lực của hệ côn pháp.',
  tlb1: 'Vung côn quét một vòng quanh thân như gió lốc cuốn lá, đánh bật mọi kẻ địch đang vây quanh.',
  tlb2: 'Triệu hồi hư ảnh thập bát La Hán vây quanh, côn ảnh dồn dập đánh vào cả vùng xung quanh.',
  tlb4: 'Chống côn bật người lên cao rồi giáng thẳng xuống mục tiêu ở xa, chấn động lan quanh điểm đáp.',
  tlb5: 'Kim Cang Phục Ma: côn hóa thành trụ trời khổng lồ, đập dọc một đường thẳng dài, trấn áp mọi yêu ma trên đường đi.',
  // ---- Thiên Vương · Bá Vương Chùy ----
  tv0: 'Một chùy phá trời: lực cánh tay dồn hết vào đầu chùy, đập thẳng vào kẻ địch trước mặt.',
  tv1: 'Chùy giáng nhanh như sét đánh, tiếng nổ kinh hồn khiến đối thủ có thể bị choáng.',
  tv2: 'Xoay chùy như cuồng phong bão táp, bốn phương tám hướng đều trúng đòn, kẻ địch bị chảy máu.',
  tv3: 'Chiến ý Thiên Vương bừng bừng, sức mạnh và khí thế dâng trào, uy lực tấn công tăng mạnh.',
  tv4: 'Hóa thành hỏa long xung thiên, lao thẳng tới mục tiêu, lửa bùng lên thiêu đốt quanh điểm đáp.',
  tv5: 'Tuyệt kỹ: nhảy vọt lên trời rồi giáng chùy xuống đất, mặt đất nứt toác, kẻ địch quanh đó choáng váng.',
  // ---- Thiên Vương · Chân Hỏa Tâm Pháp ----
  tvb0: 'Ngưng chân hỏa trong đan điền thành quả cầu lửa, phóng xa thiêu đốt mục tiêu.',
  tvb1: 'Vung tay chém ra một luồng đao khí rực lửa, thiêu cháy mọi kẻ địch trên đường thẳng.',
  tvb2: 'Gọi cột lửa từ lòng đất phun trào tại vùng chỉ định, liệt diễm thiêu rụi cả đám đông.',
  tvb4: 'Chiến thần giáng thế: hư ảnh chiến thần rực lửa hiện sau lưng, càn quét mọi kẻ địch xung quanh.',
  tvb5: 'Tuyệt kỹ: hỏa phượng hoàng tung cánh bay dọc một đường dài, lửa cháy lan đồng cỏ, không gì cản nổi.',
  // ---- Đường Môn · Ám Khí ----
  dm0: 'Phi đao Đường Môn: vung tay một cái, lưỡi đao xé gió cắm thẳng vào mục tiêu ở xa.',
  dm1: 'Ám khí đệ nhất thiên hạ: cả ngàn mũi kim bắn ra như mưa hoa lê theo một hướng, xuyên qua hàng loạt kẻ địch.',
  dm2: 'Tung lưới thép trời đất bao trùm vùng chỉ định, kẻ địch bên trong bị trói chặt, làm chậm hẳn.',
  dm3: 'Tâm nhãn khai mở: mọi sơ hở của đối thủ hiện rõ, tỉ lệ chí mạng tăng mạnh.',
  dm4: 'Mũi tên truy tâm khóa chặt mục tiêu, xuyên thẳng từ xa với sát thương rất lớn, có thể gây chảy máu.',
  dm5: 'Tuyệt kỹ: vạn mũi tên xuyên mây trút xuống như mưa trên vùng rộng lớn, không chỗ nào trốn thoát.',
  // ---- Đường Môn · Cơ Quan Hỏa Khí ----
  dmb0: 'Ném viên tích lịch đạn nổ tung khi chạm mục tiêu, uy lực không kém kiếm đao.',
  dmb1: 'Liên tiếp ném một loạt hỏa đạn xuống vùng chỉ định, nổ dây chuyền thiêu cả đám đông.',
  dmb2: 'Chôn hỏa lôi dưới đất, kẻ địch bước vào là bùng nổ thành biển lửa.',
  dmb4: 'Tiên lôi băng tâm phát nổ lạnh buốt, đóng băng mục tiêu tại chỗ.',
  dmb5: 'Tuyệt kỹ: cửu cung phi tinh – sao băng cơ quan rơi xuống theo trận đồ chín cung, nổ tung cả vùng.',
  // ---- Ngũ Độc · Độc Cổ ----
  nd0: 'Kim châm tẩm độc phóng ra lặng lẽ, trúng ai người ấy dần trúng độc.',
  nd1: 'Độc dược xuyên tim thấm vào kinh mạch, gây sát thương liên tục theo thời gian.',
  nd2: 'Thả vạn con cổ trùng gặm nhấm tâm can kẻ địch trong vùng, ai cũng trúng độc.',
  nd3: 'Năm loài độc vật hộ thể, độc khí bao quanh người, tăng sức chống chịu và đáp trả.',
  nd4: 'Phóng Kim Tằm Cổ – cổ vương của Miêu Cương – bay vút theo đường thẳng, xuyên qua mọi kẻ địch.',
  nd5: 'Tuyệt kỹ: vạn con độc xà trồi lên từ lòng đất, quấn chặt và cắn xé cả vùng rộng lớn.',
  // ---- Ngũ Độc · Huyết Đao ----
  ndb0: 'Huyết đao chém xuống, lưỡi đao tẩm độc rạch sâu vào da thịt đối thủ.',
  ndb1: 'Hai nhát đao giao nhau hình chữ thập, độc khí u minh thấm vào vết thương.',
  ndb2: 'Xoay đao thành lốc xoáy độc khí, chém trúng mọi kẻ địch xung quanh.',
  ndb4: 'Hóa thành quỷ ảnh truy hồn, lướt tới mục tiêu trong chớp mắt, đao độc chém tung quanh điểm đáp.',
  ndb5: 'Tuyệt kỹ: ma đao vạn cổ hiện hình khổng lồ, chém nát cả vùng, độc khí bao trùm chiến trường.',
  // ---- Nga My · Phật Quang Kiếm Khí ----
  nm0: 'Kiếm khí trắng như tuyết phiêu bay, bắn tới mục tiêu ở tầm trung.',
  nm1: 'Phật quang phổ chiếu: ánh sáng từ bi hồi phục sinh lực cho bản thân và đồng đội xung quanh.',
  nm2: 'Lập kiếm trận bất diệt, phi kiếm xoay quanh chém vào mọi kẻ địch trong vùng.',
  nm3: 'Từ hàng phổ độ: hào quang Phật môn bao bọc, tăng phòng thủ và hồi phục.',
  nm4: 'Liên hoa nở rộ, kiếm vũ theo cánh sen lan ra chém trúng cả đám đông.',
  nm5: 'Tuyệt kỹ: đóa sen thánh khổng lồ nở giữa chiến trường, Phật quang thiêu đốt mọi tà ma trong vùng.',
  // ---- Nga My · Nga My Kiếm Pháp ----
  nmb0: 'Kiếm nhẹ như gió thoảng, đâm nhanh vào sơ hở của đối thủ.',
  nmb1: 'Tam hoa tụ đỉnh: ba đóa kiếm hoa liên tiếp hợp làm một nhát đâm chí mạng.',
  nmb2: 'Xoay người múa kiếm giữa hồng trần, kiếm quang quét khắp xung quanh.',
  nmb4: 'Cưỡi cánh hoa bay theo bóng kẻ địch, lướt tới đâm một kiếm rồi hoa rơi tung tóe.',
  nmb5: 'Tuyệt kỹ: vạn đóa kiếm hoa đồng loạt nở, kiếm trận hoa rơi phủ kín vùng rộng lớn.',
  // ---- Thúy Yên · Song Đao ----
  ty0: 'Hai lưỡi đao liên hoàn chém nhanh như chớp, đòn thường tốc độ cao.',
  ty1: 'Thân pháp băng tâm, đao lạnh như băng rạch qua, đối thủ có thể bị làm chậm.',
  ty2: 'Phong hoa tuyết nguyệt: đao quang bốn mùa xoáy tròn, chém trúng mọi kẻ địch xung quanh.',
  ty3: 'Ảnh tung khó nắm bắt: tốc độ và né tránh tăng vọt trong chốc lát.',
  ty4: 'Thuấn ảnh sát: biến mất rồi hiện ra ngay cạnh mục tiêu, hai đao chém xuống quanh điểm đáp.',
  ty5: 'Tuyệt kỹ: băng phong vạn lý – hàn khí đông cứng cả vùng, kẻ địch bị đóng băng tại chỗ.',
  // ---- Thúy Yên · Băng Tâm Quyết ----
  tyb0: 'Ngưng hàn khí thành kim băng phách, bắn xa và làm chậm mục tiêu.',
  tyb1: 'Kiếm khí hàn băng bay dọc một đường thẳng, kẻ địch trên đường đi đều bị làm chậm.',
  tyb2: 'Tuyết ảnh phiêu linh: bão tuyết nổi lên tại vùng chỉ định, rét buốt tới xương.',
  tyb4: 'Một đóa băng liên nở trên người mục tiêu, phong ấn tại chỗ trong giây lát.',
  tyb5: 'Tuyệt kỹ: tuyết lở Thiên Sơn – vô số băng nhọn đổ ập xuống cả vùng, đóng băng kẻ địch.',
  // ---- Cái Bang · Hàng Long Chưởng ----
  cb0: 'Bổng pháp nhập môn của Cái Bang: gõ thẳng vào đầu kẻ địch, đơn giản mà hiệu quả.',
  cb1: 'Kháng Long Hữu Hối: chưởng lực hóa rồng lao dọc một đường thẳng, có tiến có lùi, uy lực vô song.',
  cb2: 'Phi Long Tại Thiên: rồng khí bay vòng trên đầu rồi giáng xuống cả vùng xung quanh.',
  cb3: 'Túy quyền say mà không loạn: thân pháp lắc lư khó đoán, né tránh và tấn công đều tăng.',
  cb4: 'Kiến Long Tại Điền: lao tới mục tiêu như rồng hiện trên đồng, chưởng lực nổ tung quanh điểm đáp.',
  cb5: 'Tuyệt kỹ trấn bang: Hàng Long Thập Bát Chưởng – mười tám con rồng gầm thét lao thẳng một đường, quét sạch mọi thứ.',
  // ---- Cái Bang · Đả Cẩu Bổng ----
  cbb0: 'Một bổng đánh hai chó: xoay bổng đập liền hai nhát vào mục tiêu.',
  cbb1: 'Bát cẩu triều đầu: tám đường bổng dồn dập đánh vào một đối thủ, khó lòng đỡ hết.',
  cbb2: 'Thiên hạ vô cẩu: quét bổng một vòng, xung quanh không còn kẻ nào đứng vững.',
  cbb4: 'Túy bát tiên: bước chân say lảo đảo mà lướt tới cực nhanh, bổng đập tung quanh điểm đáp.',
  cbb5: 'Tuyệt kỹ: đả cẩu thần bổng – bổng ảnh cuồng phong bao trùm cả vùng, đánh không trượt một ai.',
  // ---- Võ Đang · Thái Cực Khí Công ----
  vd0: 'Kiếm khí Thái Cực mềm mà bền, bắn tới mục tiêu ở tầm trung.',
  vd1: 'Vô ngã vô kiếm: phi kiếm xoay quanh người rồi phóng thẳng một đường, xuyên qua mọi kẻ địch.',
  vd2: 'Vẽ Thái Cực Đồ dưới chân kẻ địch, âm dương xoay chuyển hút và nghiền nát cả vùng.',
  vd3: 'Tọa vong vô ngã: tâm tĩnh như nước, nội lực hồi phục nhanh và chống chịu tốt hơn.',
  vd4: 'Thất tinh kiếm trận: bảy thanh kiếm theo sao Bắc Đẩu giáng xuống vùng chỉ định.',
  vd5: 'Tuyệt kỹ: Thiên Địa Vô Cực – bát quái trận đồ khổng lồ mở ra, trời đất cùng xoay, kẻ địch không lối thoát.',
  // ---- Võ Đang · Thái Cực Kiếm ----
  vdb0: 'Thái Cực Kiếm: lấy nhu chế cương, kiếm đi theo vòng tròn mà đâm trúng sơ hở.',
  vdb1: 'Tam hoàn sáo nguyệt: ba vòng kiếm quang như trăng tròn liên tiếp chém vào mục tiêu.',
  vdb2: 'Kiếm vũ Thái Cực xoay tròn quanh thân, chém trúng mọi kẻ địch đang áp sát.',
  vdb4: 'Nhân kiếm hợp nhất: người cưỡi kiếm bay vút tới mục tiêu, kiếm khí nổ tung quanh điểm đáp.',
  vdb5: 'Tuyệt kỹ: vạn kiếm quy tông – muôn vàn phi kiếm từ trời đổ xuống cả vùng rộng lớn.',
  // ---- Côn Lôn · Ngũ Lôi Phù ----
  cl0: 'Đốt lôi phù gọi một tia sét đánh thẳng xuống mục tiêu ở xa.',
  cl1: 'Cuồng phong sậu điện: gió giật sét nổ liên hồi, đối thủ có thể bị choáng.',
  cl2: 'Thiên lôi địa hỏa: sấm trên trời, lửa dưới đất cùng bùng nổ tại vùng chỉ định.',
  cl3: 'Thanh phong phù: gió lành bao quanh người, tốc độ và né tránh tăng.',
  cl4: 'Hô phong hoán vũ: gọi lốc xoáy cuồn cuộn càn quét vùng chỉ định, làm chậm kẻ địch.',
  cl5: 'Tuyệt kỹ: Cửu Thiên Huyền Lôi – chín tầng trời đồng loạt giáng sét xuống cả vùng, choáng váng mọi kẻ địch.',
  // ---- Côn Lôn · Lôi Đình Kiếm ----
  clb0: 'Ngạo tuyết kiếm: kiếm lạnh như tuyết Côn Lôn, đâm thẳng vào đối thủ.',
  clb1: 'Lôi đình trảm: kiếm tẩm sấm sét chém xuống, tiếng nổ đinh tai, có thể gây choáng.',
  clb2: 'Phong lôi kiếm trận: vòng sấm sét xoay quanh người, giật điện mọi kẻ địch áp sát.',
  clb4: 'Thiểm điện bộ: hóa thành tia chớp lao tới mục tiêu, sét nổ tung quanh điểm đáp.',
  clb5: 'Tuyệt kỹ: lôi thần giáng thế – hóa thân lôi thần, sấm sét bao trùm cả vùng rộng lớn.'
};

module.exports = { LORE };
