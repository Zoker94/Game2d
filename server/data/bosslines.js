// Lời thoại boss. Mỗi boss có các nhóm: spawn (xuất hiện), fight (khi đang giao chiến, nói ngẫu nhiên),
// hp75 / hp50 / hp25 / hp10 (khi còn bấy nhiêu % máu), kill (hạ một người chơi – {name} là tên người đó), death (khi bị hạ).
// Boss không có nhóm nào thì dùng GENERIC.
const GENERIC = {
  spawn: ['Kẻ nào dám bước vào lãnh địa của ta?', 'Hôm nay lại có kẻ muốn chết sao?', 'Ta đã chờ các ngươi rất lâu rồi!'],
  fight: ['Chỉ có chút công phu mèo cào này thôi sao?', 'Cùng xông lên một lượt đi, đỡ mất thời gian!', 'Ha ha ha! Yếu ớt!', 'Đòn này ngươi đỡ nổi không?', 'Máu của các ngươi sẽ nhuộm đỏ nơi này!'],
  hp75: ['Hừ, cũng có chút bản lĩnh.', 'Khá lắm, nhưng chưa đủ đâu!'],
  hp50: ['Các ngươi đã chọc giận ta rồi đấy!', 'Giờ mới là lúc ta nghiêm túc!'],
  hp25: ['Không thể nào... ta không thể thua lũ nhãi ranh này!', 'Ta sẽ kéo các ngươi xuống mồ cùng ta!'],
  hp10: ['Khụ... khụ... chưa xong đâu!', 'Ta... vẫn còn đứng được!'],
  kill: ['{name}, kiếp sau hãy luyện thêm vài năm nữa!', 'Lại thêm một kẻ ngã xuống. Kẻ tiếp theo là ai?', '{name} không chịu nổi một chiêu của ta!'],
  death: ['Ta... đã xem thường các ngươi...', 'Giang hồ... rộng lớn thật...', 'Hận... hận quá!']
};

const LINES = {
  boss_soi: {
    spawn: ['Gràooo! Bầy sói đâu, theo ta đi săn!', 'Mùi máu người... thơm quá!'],
    fight: ['Gừ... gừ...', 'Răng nanh của ta sẽ xé nát các ngươi!', 'Grừ! Đứng yên cho ta cắn!'],
    hp50: ['Gràooo! Ta là vua của khu rừng này!'],
    death: ['Ư... ư... ử...']
  },
  boss_truc: {
    spawn: ['Xì... xì... Rừng trúc này là của Thanh Xà ta.', 'Lũ người phàm lại dám tới quấy rầy giấc ngủ của ta?'],
    fight: ['Nọc độc của ta ngấm vào xương tủy rồi đấy!', 'Xì... trốn đi đâu cho thoát?', 'Uốn lượn như gió, các ngươi bắt được ta sao?'],
    hp25: ['Ngàn năm tu luyện... không thể bỏ phí ở đây!'],
    death: ['Xì... ta còn chưa kịp hóa rồng...']
  },
  boss_hoason: {
    spawn: ['Cả đời chỉ cầu một bại. Ai trong các ngươi cho ta được thua?', 'Kiếm của ta đã lâu không nếm máu.'],
    fight: ['Vô chiêu thắng hữu chiêu!', 'Kiếm pháp của ngươi còn quá nhiều sơ hở.', 'Độc Cô Cửu Kiếm – phá!', 'Nhanh hơn nữa! Chậm như vậy làm sao địch nổi ta?'],
    hp50: ['Hay! Lâu lắm rồi mới gặp được đối thủ!'],
    hp10: ['Thua... cuối cùng ta cũng được nếm mùi thua...'],
    kill: ['{name}, kiếm của ngươi còn non lắm.'],
    death: ['Ha ha ha... Cầu bại... đắc bại... ta mãn nguyện rồi.']
  },
  boss_samac: {
    spawn: ['Cát vàng là mồ chôn của lữ khách. Hôm nay đến lượt các ngươi!'],
    fight: ['Đuôi độc của ta không tha kẻ nào!', 'Bão cát nổi lên rồi, các ngươi không nhìn thấy gì đâu!', 'Khô héo như sa mạc này đi!'],
    hp25: ['Hừ! Ta sẽ chui xuống cát rồi hồi sức... không, không kịp nữa!'],
    death: ['Cát... cát lấp mất ta rồi...']
  },
  boss_bang: {
    spawn: ['Băng Cung lạnh lẽo không tiếp khách lạ. Cút đi, hoặc đóng băng mãi mãi.'],
    fight: ['Hàn băng chưởng – đóng băng!', 'Tim ta lạnh như băng, đừng mong ta nương tay.', 'Lạnh không? Còn lạnh hơn nữa cơ!'],
    hp50: ['Các ngươi làm băng cung của ta rạn nứt rồi!'],
    death: ['Băng tan... lòng ta cũng tan...']
  },
  boss_ma: {
    spawn: ['Thiên Ma giáng thế! Chính phái các ngươi hôm nay tận số!', 'Ma Giáo trường tồn – thiên thu vạn đại!'],
    fight: ['Thiên Ma Giải Thể Đại Pháp!', 'Chính đạo? Chỉ là lũ đạo đức giả!', 'Quỳ xuống, ta tha cho cái mạng chó!', 'Ma công của ta đã đạt tầng thứ chín!'],
    hp50: ['Đừng tưởng thế là thắng – ma công của ta mới bắt đầu!'],
    hp10: ['Ta... là Thiên Ma bất tử...'],
    kill: ['{name} – thêm một vong hồn cho Ma Giáo!'],
    death: ['Ma Giáo... sẽ có ngày... trở lại...']
  },
  boss_conlon: {
    spawn: ['Côn Lôn là đất thánh, kẻ ngoại đạo không được bén mảng!'],
    fight: ['Ngũ Lôi Oanh Đỉnh!', 'Lôi thần, giáng xuống!', 'Kiếm khí Côn Lôn – trảm!'],
    hp25: ['Bổn tọa tu đạo trăm năm, sao lại thua tay lũ hậu bối?'],
    death: ['Thiên đạo... vô thường...']
  },
  boss_huyet: {
    spawn: ['Huyết Ma Lão Tổ ta đói rồi! Máu tươi đâu, mau dâng lên!'],
    fight: ['Huyết Ma Đại Pháp – hút cạn tinh huyết!', 'Máu của ngươi ngon lắm!', 'Càng đánh ta càng mạnh, ha ha ha!'],
    hp50: ['Máu! Ta cần thêm máu!'],
    kill: ['Tinh huyết của {name}... thật tuyệt!'],
    death: ['Máu... của ta... chảy hết rồi...']
  },
  boss_cuuu: {
    spawn: ['Cửu U mở cửa, vạn quỷ dạ hành! Ma Tôn ta tái xuất nhân gian!'],
    fight: ['Âm hồn Cửu U, nuốt chửng chúng!', 'Ngươi sẽ thành quỷ nô của ta mãi mãi!', 'Địa ngục cũng không giữ nổi ta, huống chi lũ phàm nhân!'],
    hp50: ['Lũ sâu kiến dám khiêu khích Ma Tôn?!'],
    hp10: ['Không... Cửu U... đừng đóng lại...'],
    kill: ['{name}, linh hồn ngươi giờ thuộc về Cửu U!'],
    death: ['Ta sẽ... quay lại... từ Cửu U...']
  },
  boss_thienngoai: {
    spawn: ['Thiên ngoại hữu thiên. Kiếm của ta – ở trên cả trời.'],
    fight: ['Nhân kiếm hợp nhất!', 'Một kiếm phá vạn pháp!', 'Kiếm ý của ngươi quá tạp, chưa đủ tư cách!'],
    hp50: ['Tốt! Rất tốt! Hãy cho ta thấy kiếm của các ngươi!'],
    death: ['Kiếm gãy... nhưng kiếm ý vẫn còn...']
  },
  boss_kimluan: {
    spawn: ['Kim Luân Pháp Vương đến rồi! Võ lâm Trung Nguyên, mau ra lĩnh giáo!', 'Thiết kỵ Mông Cổ sẽ san bằng Tương Dương!'],
    fight: ['Long Tượng Bát Nhã Công – tầng thứ mười!', 'Năm bánh xe vàng – bay!', 'Trung Nguyên không còn ai sao?'],
    hp50: ['Không ngờ Trung Nguyên vẫn còn cao thủ!'],
    hp10: ['Quách Tĩnh... không, các ngươi còn đáng sợ hơn...'],
    kill: ['{name} cũng chỉ đến thế!'],
    death: ['Đại Hãn... thần đã... phụ lòng...']
  },
  boss_vumuc: {
    spawn: ['Hậu nhân võ lâm, hãy cho ta thấy chí khí của các ngươi!', 'Tận trung báo quốc! Ai đủ dũng khí nhận Võ Mục Di Thư?'],
    fight: ['Trả lại non sông cho ta!', 'Nhạc Gia Quân – xung phong!', 'Sơn hà vạn dặm, há để giặc giày xéo!', 'Võ công là để bảo vệ bá tánh, không phải để tranh danh!', 'Mãn Giang Hồng... nộ phát xung quan!'],
    hp75: ['Tốt! Lòng dũng cảm đáng khen!'],
    hp50: ['Ba mươi năm công danh như cát bụi... nhưng chí khí này không bao giờ tắt!'],
    hp25: ['Các ngươi... chính là hy vọng của giang sơn!'],
    hp10: ['Đủ rồi... chí khí của các ngươi, ta đã thấy.'],
    kill: ['{name}, đứng dậy! Người luyện võ không được gục ngã dễ dàng như vậy!'],
    death: ['Giang sơn... giao lại cho các ngươi. Đừng phụ lòng bá tánh...']
  },
  pb1_boss: {
    spawn: ['Đứa nào dám phá sơn trại của ông? Anh em, chém!'],
    fight: ['Đao của ông không có mắt đâu!', 'Nộp hết bạc ra đây!', 'Hôm nay ông cho các ngươi lên núi làm phân bón!'],
    hp25: ['Anh em đâu hết rồi?! Ra đỡ cho ta!'],
    death: ['Sơn trại... tan rồi...']
  },
  pb2_boss: {
    spawn: ['Kẻ nào dám đánh thức Thi Vương... trong mộ thất ngàn năm?'],
    fight: ['Thi độc... ngấm vào người rồi...', 'Các ngươi sẽ nằm lại đây cùng ta... mãi mãi...', 'Đứng dậy đi, hỡi các thi binh!'],
    hp50: ['Hào quang của người sống... chói mắt quá!'],
    death: ['Cuối cùng... ta cũng được yên nghỉ...']
  },
  pb3_boss: {
    spawn: ['Huyết Ma Cung không có đường ra. Hôm nay các ngươi làm tế phẩm!'],
    fight: ['Huyết Tế Đại Trận – khởi!', 'Mỗi giọt máu đổ xuống đều làm ta mạnh thêm!', 'Quỳ xuống trước Cung Chủ!'],
    hp50: ['Hộ pháp đâu! Giết hết bọn chúng cho ta!'],
    death: ['Huyết Ma Cung... sụp đổ...']
  },
  pb4_boss: {
    spawn: ['Thiên Cung không dung kẻ phàm. Rút kiếm đi.'],
    fight: ['Vạn Kiếm Quy Tông!', 'Kiếm của tiên giới – các ngươi không đỡ nổi!', 'Mây trời là kiếm, gió là kiếm, vạn vật đều là kiếm!'],
    hp50: ['Phàm nhân mà đạt tới cảnh giới này... thú vị!'],
    death: ['Kiếm Đế... cũng có ngày thất bại...']
  },
  pb5_boss: {
    spawn: ['Cửu tầng luyện ngục, ta là vua! Bước vào đây là không có ngày trở ra!'],
    fight: ['Lửa luyện ngục thiêu rụi linh hồn!', 'Gào thét đi! Ta thích nghe tiếng gào của các ngươi!', 'Ma Lang, Quỷ Tướng – xé xác chúng!'],
    hp50: ['Luyện ngục đang sôi lên vì giận dữ!'],
    hp10: ['Không thể... ta là vua của luyện ngục...'],
    kill: ['{name} sẽ bị thiêu đốt chín ngàn năm!'],
    death: ['Lửa luyện ngục... tắt rồi...']
  }
};

function linesOf(id) { return LINES[id] || {}; }
function pick(id, kind) {
  const own = linesOf(id)[kind], arr = own && own.length ? own : GENERIC[kind];
  return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
}

module.exports = { pick, LINES, GENERIC };
