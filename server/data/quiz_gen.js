// Đố Vui: câu hỏi sinh từ bảng dữ liệu (thủ đô, nguyên tố, từ vựng tiếng Anh, số La Mã, đổi đơn vị, tính nhẩm).
// Tính nhẩm sinh bằng hạt giống cố định nên bộ câu không đổi giữa các lần khởi động.
const Q = [];
const add = (q, a) => Q.push([q, Array.isArray(a) ? a.map(String) : [String(a)]]);

// ---------- thủ đô các nước: [nước, thủ đô, ...cách gọi khác] ----------
const CAPITALS = [
  ['Việt Nam', 'Hà Nội'], ['Lào', 'Viêng Chăn', 'Vientiane'], ['Campuchia', 'Phnôm Pênh', 'Phnom Penh', 'Nam Vang'], ['Thái Lan', 'Băng Cốc', 'Bangkok'],
  ['Myanmar', 'Naypyidaw', 'Nay Pyi Taw', 'Naypyitaw'], ['Malaysia', 'Kuala Lumpur'], ['Singapore', 'Singapore', 'Xin-ga-po'], ['Indonesia', 'Jakarta', 'Gia-các-ta'],
  ['Philippines', 'Manila'], ['Brunei', 'Bandar Seri Begawan'], ['Đông Timor', 'Dili'], ['Trung Quốc', 'Bắc Kinh', 'Beijing'],
  ['Nhật Bản', 'Tokyo', 'Tô-ky-ô', 'Đông Kinh'], ['Hàn Quốc', 'Seoul', 'Xơ-un'], ['Triều Tiên', 'Bình Nhưỡng', 'Pyongyang'], ['Mông Cổ', 'Ulaanbaatar', 'Ulan Bator', 'U-lan Ba-to'],
  ['Ấn Độ', 'New Delhi', 'Niu Đê-li', 'Delhi'], ['Pakistan', 'Islamabad'], ['Bangladesh', 'Dhaka'], ['Nepal', 'Kathmandu'], ['Sri Lanka', 'Colombo', 'Sri Jayawardenepura Kotte', 'Kotte'],
  ['Afghanistan', 'Kabul'], ['Iran', 'Tehran', 'Tê-hê-ran'], ['Iraq', 'Baghdad', 'Bát-đa'], ['Syria', 'Damascus', 'Đa-mát'], ['Thổ Nhĩ Kỳ', 'Ankara'],
  ['Ả Rập Xê Út', 'Riyadh'], ['Israel', 'Jerusalem', 'Giê-ru-xa-lem'], ['Jordan', 'Amman'], ['Liban', 'Beirut'], ['Qatar', 'Doha'], ['Các Tiểu vương quốc Ả Rập Thống nhất (UAE)', 'Abu Dhabi'],
  ['Kuwait', 'Kuwait', 'Thành phố Kuwait'], ['Oman', 'Muscat'], ['Yemen', 'Sanaa'], ['Kazakhstan', 'Astana'], ['Uzbekistan', 'Tashkent'],
  ['Pháp', 'Paris', 'Pa-ri'], ['Anh', 'Luân Đôn', 'London'], ['Đức', 'Berlin', 'Béc-lin'], ['Ý', 'Rome', 'Roma', 'La Mã'], ['Tây Ban Nha', 'Madrid'],
  ['Bồ Đào Nha', 'Lisbon', 'Lisboa'], ['Hà Lan', 'Amsterdam'], ['Bỉ', 'Brussels', 'Bruxelles', 'Brúc-xen'], ['Thụy Sĩ', 'Bern', 'Berne'], ['Áo', 'Vienna', 'Viên', 'Wien'],
  ['Ba Lan', 'Warszawa', 'Warsaw', 'Vác-sa-va'], ['Séc', 'Praha', 'Prague', 'Pra-ha'], ['Hungary', 'Budapest', 'Bu-đa-pét'], ['Romania', 'Bucharest', 'Bucuresti', 'Bu-ca-rét'],
  ['Bulgaria', 'Sofia', 'Xô-phi-a'], ['Hy Lạp', 'Athens', 'Athena', 'A-ten'], ['Nga', 'Moskva', 'Moscow', 'Mát-xcơ-va', 'Matxcova'], ['Ukraina', 'Kyiv', 'Kiev', 'Ki-ép'],
  ['Belarus', 'Minsk'], ['Thụy Điển', 'Stockholm', 'Xtốc-khôm'], ['Na Uy', 'Oslo'], ['Phần Lan', 'Helsinki'], ['Đan Mạch', 'Copenhagen', 'Cô-pen-ha-ghen'],
  ['Iceland', 'Reykjavik'], ['Ireland', 'Dublin'], ['Scotland', 'Edinburgh'], ['Serbia', 'Belgrade', 'Beograd'], ['Croatia', 'Zagreb'], ['Slovakia', 'Bratislava'],
  ['Slovenia', 'Ljubljana'], ['Estonia', 'Tallinn'], ['Latvia', 'Riga'], ['Litva', 'Vilnius'], ['Luxembourg', 'Luxembourg', 'Lúc-xăm-bua'], ['Monaco', 'Monaco'],
  ['Malta', 'Valletta'], ['Síp', 'Nicosia'], ['Albania', 'Tirana'], ['Bắc Macedonia', 'Skopje'], ['Montenegro', 'Podgorica'], ['Bosnia và Herzegovina', 'Sarajevo'],
  ['Moldova', 'Chisinau'], ['Gruzia', 'Tbilisi'], ['Armenia', 'Yerevan'], ['Azerbaijan', 'Baku'],
  ['Hoa Kỳ', 'Washington', 'Oa-sinh-tơn', 'Washington DC'], ['Canada', 'Ottawa', 'Ốt-ta-oa'], ['Mexico', 'Mexico City', 'Thành phố Mexico', 'Mê-hi-cô'],
  ['Cuba', 'La Habana', 'Havana', 'La Ha-ba-na'], ['Jamaica', 'Kingston'], ['Brazil', 'Brasília', 'Bra-xi-li-a'], ['Argentina', 'Buenos Aires'], ['Chile', 'Santiago'],
  ['Peru', 'Lima'], ['Colombia', 'Bogotá'], ['Venezuela', 'Caracas'], ['Ecuador', 'Quito'], ['Uruguay', 'Montevideo'], ['Paraguay', 'Asunción', 'Asuncion'],
  ['Bolivia', 'Sucre', 'La Paz'], ['Panama', 'Panama', 'Thành phố Panama'], ['Costa Rica', 'San José', 'San Jose'], ['Guatemala', 'Guatemala', 'Thành phố Guatemala'],
  ['Nicaragua', 'Managua'], ['Honduras', 'Tegucigalpa'], ['Haiti', 'Port-au-Prince'], ['Cộng hòa Dominica', 'Santo Domingo'],
  ['Ai Cập', 'Cairo', 'Cai-rô'], ['Nam Phi', 'Pretoria', 'Cape Town', 'Bloemfontein'], ['Nigeria', 'Abuja'], ['Kenya', 'Nairobi'], ['Ethiopia', 'Addis Ababa'],
  ['Maroc', 'Rabat'], ['Algeria', 'Algiers', 'Alger', 'An-giê'], ['Tunisia', 'Tunis'], ['Libya', 'Tripoli'], ['Sudan', 'Khartoum'], ['Ghana', 'Accra'],
  ['Senegal', 'Dakar'], ['Tanzania', 'Dodoma'], ['Uganda', 'Kampala'], ['Angola', 'Luanda'], ['Mozambique', 'Maputo'], ['Zimbabwe', 'Harare'], ['Zambia', 'Lusaka'],
  ['Madagascar', 'Antananarivo'], ['Cameroon', 'Yaoundé', 'Yaounde'], ['Bờ Biển Ngà', 'Yamoussoukro'], ['Mali', 'Bamako'], ['Rwanda', 'Kigali'], ['Somalia', 'Mogadishu'],
  ['Úc', 'Canberra', 'Can-bê-ra'], ['New Zealand', 'Wellington'], ['Papua New Guinea', 'Port Moresby'], ['Fiji', 'Suva']
];
for (const [c, ...caps] of CAPITALS) if (!caps.some(x => x === c)) add(`Thủ đô của ${c} là thành phố nào?`, caps);
// hỏi ngược với các thủ đô quen thuộc
const REV = [['Paris', 'Pháp'], ['Luân Đôn', 'Anh', 'Vương quốc Anh'], ['Tokyo', 'Nhật Bản', 'Nhật'], ['Bắc Kinh', 'Trung Quốc'], ['Seoul', 'Hàn Quốc'], ['Viêng Chăn', 'Lào'],
  ['Phnôm Pênh', 'Campuchia'], ['Băng Cốc', 'Thái Lan'], ['Jakarta', 'Indonesia'], ['Manila', 'Philippines'], ['Canberra', 'Úc', 'Australia'], ['Ottawa', 'Canada'], ['Brasília', 'Brazil'],
  ['Buenos Aires', 'Argentina'], ['Cairo', 'Ai Cập'], ['Nairobi', 'Kenya'], ['Moskva', 'Nga'], ['Berlin', 'Đức'], ['Madrid', 'Tây Ban Nha'], ['Rome', 'Ý', 'Italia'],
  ['Lisbon', 'Bồ Đào Nha'], ['Athens', 'Hy Lạp'], ['Ankara', 'Thổ Nhĩ Kỳ'], ['Tehran', 'Iran'], ['Baghdad', 'Iraq'], ['Havana', 'Cuba'], ['Lima', 'Peru'], ['Bogotá', 'Colombia'],
  ['Wellington', 'New Zealand'], ['Ulaanbaatar', 'Mông Cổ'], ['Bình Nhưỡng', 'Triều Tiên'], ['Kuala Lumpur', 'Malaysia'], ['Amsterdam', 'Hà Lan'], ['Stockholm', 'Thụy Điển'],
  ['Oslo', 'Na Uy'], ['Helsinki', 'Phần Lan'], ['Copenhagen', 'Đan Mạch'], ['Warszawa', 'Ba Lan'], ['Praha', 'Séc', 'Cộng hòa Séc'], ['Budapest', 'Hungary'], ['Vienna', 'Áo'],
  ['Bern', 'Thụy Sĩ'], ['Brussels', 'Bỉ'], ['Dublin', 'Ireland'], ['Kyiv', 'Ukraina', 'Ukraine'], ['Abuja', 'Nigeria'], ['Pretoria', 'Nam Phi'], ['Rabat', 'Maroc', 'Morocco']];
for (const [cap, ...cs] of REV) add(`${cap} là thủ đô của nước nào?`, cs);

// ---------- nguyên tố hóa học: [tên, ký hiệu] ----------
const EL = [['Hiđro', 'H', 'Hydro'], ['Heli', 'He', 'Helium'], ['Liti', 'Li', 'Lithium'], ['Beri', 'Be', 'Beryllium'], ['Bo', 'B', 'Boron'], ['Cacbon', 'C', 'Carbon'],
  ['Nitơ', 'N', 'Nito', 'Nitrogen'], ['Oxi', 'O', 'Oxy', 'Oxygen'], ['Flo', 'F', 'Fluorine'], ['Neon', 'Ne'], ['Natri', 'Na', 'Sodium'], ['Magie', 'Mg', 'Magnesium'],
  ['Nhôm', 'Al', 'Aluminium'], ['Silic', 'Si', 'Silicon'], ['Photpho', 'P', 'Phốt pho', 'Phosphorus'], ['Lưu huỳnh', 'S', 'Sulfur'], ['Clo', 'Cl', 'Chlorine'],
  ['Agon', 'Ar', 'Argon'], ['Kali', 'K', 'Potassium'], ['Canxi', 'Ca', 'Calcium'], ['Titan', 'Ti', 'Titanium'], ['Crom', 'Cr', 'Chromium'], ['Mangan', 'Mn', 'Manganese'],
  ['Sắt', 'Fe'], ['Coban', 'Co', 'Cobalt'], ['Niken', 'Ni', 'Nickel'], ['Đồng', 'Cu'], ['Kẽm', 'Zn'], ['Asen', 'As', 'Thạch tín', 'Arsenic'], ['Brom', 'Br', 'Bromine'],
  ['Kripton', 'Kr', 'Krypton'], ['Bạc', 'Ag'], ['Thiếc', 'Sn'], ['Iot', 'I', 'Iốt', 'Iodine'], ['Xenon', 'Xe'], ['Bari', 'Ba', 'Barium'], ['Vonfram', 'W', 'Tungsten'],
  ['Bạch kim', 'Pt', 'Platin', 'Platinum'], ['Vàng', 'Au'], ['Thủy ngân', 'Hg'], ['Chì', 'Pb'], ['Urani', 'U', 'Uranium'], ['Radon', 'Rn'], ['Rađi', 'Ra', 'Radium'],
  ['Plutoni', 'Pu', 'Plutonium'], ['Cadimi', 'Cd', 'Cadmium'], ['Antimon', 'Sb', 'Antimony'], ['Bitmut', 'Bi', 'Bismuth'], ['Selen', 'Se', 'Selenium'], ['Stronti', 'Sr', 'Strontium']];
for (const [name, sym, ...alt] of EL) {
  add(`Ký hiệu hóa học của nguyên tố ${name} là gì?`, [sym]);
  if (sym.length > 1 || ['C', 'O', 'N', 'H', 'S', 'K', 'P', 'I', 'U', 'W'].includes(sym)) add(`Nguyên tố có ký hiệu hóa học "${sym}" tên là gì?`, [name, ...alt]);
}
const ELNUM = [['Hiđro', 1], ['Heli', 2], ['Cacbon', 6], ['Nitơ', 7], ['Oxi', 8], ['Natri', 11], ['Nhôm', 13], ['Canxi', 20], ['Sắt', 26], ['Đồng', 29], ['Vàng', 79], ['Bạc', 47], ['Urani', 92], ['Clo', 17], ['Kali', 19]];
for (const [n, z] of ELNUM) add(`Số hiệu nguyên tử của ${n} là bao nhiêu? (số)`, [z]);

// ---------- từ vựng tiếng Anh: [từ, nghĩa...] ----------
const EN = [['apple', 'táo', 'quả táo'], ['banana', 'chuối', 'quả chuối'], ['orange', 'cam', 'quả cam', 'màu cam'], ['grape', 'nho', 'quả nho'], ['watermelon', 'dưa hấu'],
  ['mango', 'xoài'], ['pineapple', 'dứa', 'thơm', 'khóm'], ['coconut', 'dừa'], ['lemon', 'chanh'], ['strawberry', 'dâu tây', 'dâu'], ['dog', 'chó', 'con chó'], ['cat', 'mèo', 'con mèo'],
  ['chicken', 'gà', 'con gà', 'thịt gà'], ['duck', 'vịt', 'con vịt'], ['pig', 'lợn', 'heo'], ['cow', 'bò', 'con bò', 'bò cái'], ['horse', 'ngựa', 'con ngựa'], ['tiger', 'hổ', 'cọp'],
  ['lion', 'sư tử'], ['elephant', 'voi', 'con voi'], ['monkey', 'khỉ', 'con khỉ'], ['snake', 'rắn', 'con rắn'], ['bird', 'chim', 'con chim'], ['fish', 'cá', 'con cá'],
  ['rabbit', 'thỏ', 'con thỏ'], ['bear', 'gấu', 'con gấu'], ['wolf', 'sói', 'chó sói'], ['dragon', 'rồng', 'con rồng'], ['turtle', 'rùa', 'con rùa'], ['butterfly', 'bướm', 'con bướm'],
  ['bee', 'ong', 'con ong'], ['ant', 'kiến', 'con kiến'], ['mouse', 'chuột', 'con chuột'], ['goat', 'dê', 'con dê'], ['sheep', 'cừu', 'con cừu'], ['deer', 'hươu', 'nai'],
  ['shark', 'cá mập'], ['whale', 'cá voi'], ['crab', 'cua', 'con cua'], ['frog', 'ếch', 'con ếch'], ['red', 'đỏ', 'màu đỏ'], ['blue', 'xanh dương', 'xanh lam', 'màu xanh'],
  ['green', 'xanh lá', 'xanh lục', 'màu xanh'], ['yellow', 'vàng', 'màu vàng'], ['black', 'đen', 'màu đen'], ['white', 'trắng', 'màu trắng'], ['pink', 'hồng', 'màu hồng'],
  ['purple', 'tím', 'màu tím'], ['brown', 'nâu', 'màu nâu'], ['gray', 'xám', 'màu xám'], ['water', 'nước'], ['fire', 'lửa'], ['earth', 'đất', 'trái đất'], ['wind', 'gió'],
  ['sun', 'mặt trời'], ['moon', 'mặt trăng', 'trăng'], ['star', 'ngôi sao', 'sao'], ['sky', 'bầu trời', 'trời'], ['rain', 'mưa'], ['snow', 'tuyết'], ['cloud', 'mây', 'đám mây'],
  ['river', 'sông', 'dòng sông'], ['mountain', 'núi', 'ngọn núi'], ['sea', 'biển'], ['forest', 'rừng', 'khu rừng'], ['tree', 'cây', 'cái cây'], ['flower', 'hoa', 'bông hoa'],
  ['house', 'nhà', 'ngôi nhà'], ['school', 'trường', 'trường học'], ['book', 'sách', 'quyển sách'], ['pen', 'bút', 'cây bút'], ['table', 'bàn', 'cái bàn'], ['chair', 'ghế', 'cái ghế'],
  ['door', 'cửa', 'cửa ra vào'], ['window', 'cửa sổ'], ['car', 'ô tô', 'xe hơi', 'xe ô tô'], ['bicycle', 'xe đạp'], ['ship', 'tàu', 'con tàu', 'tàu thủy'], ['plane', 'máy bay'],
  ['train', 'tàu hỏa', 'xe lửa'], ['road', 'đường', 'con đường'], ['bridge', 'cầu', 'cây cầu'], ['city', 'thành phố'], ['village', 'làng', 'ngôi làng'], ['king', 'vua', 'nhà vua'],
  ['queen', 'nữ hoàng', 'hoàng hậu'], ['prince', 'hoàng tử'], ['princess', 'công chúa'], ['sword', 'kiếm', 'thanh kiếm', 'gươm'], ['shield', 'khiên', 'cái khiên'],
  ['bow', 'cung', 'cây cung'], ['arrow', 'mũi tên', 'tên'], ['gold', 'vàng'], ['silver', 'bạc'], ['iron', 'sắt'], ['money', 'tiền'], ['friend', 'bạn', 'bạn bè', 'người bạn'],
  ['family', 'gia đình'], ['mother', 'mẹ'], ['father', 'bố', 'cha', 'ba'], ['brother', 'anh trai', 'em trai', 'anh em trai'], ['sister', 'chị gái', 'em gái', 'chị em gái'],
  ['teacher', 'giáo viên', 'thầy giáo', 'cô giáo', 'thầy', 'cô'], ['student', 'học sinh', 'sinh viên'], ['doctor', 'bác sĩ'], ['farmer', 'nông dân'], ['soldier', 'lính', 'người lính', 'binh lính'],
  ['love', 'yêu', 'tình yêu'], ['happy', 'vui', 'hạnh phúc', 'vui vẻ'], ['sad', 'buồn'], ['angry', 'giận', 'tức giận'], ['hungry', 'đói'], ['tired', 'mệt', 'mệt mỏi'],
  ['big', 'to', 'lớn'], ['small', 'nhỏ', 'bé'], ['hot', 'nóng'], ['cold', 'lạnh'], ['fast', 'nhanh'], ['slow', 'chậm'], ['old', 'già', 'cũ'], ['new', 'mới'], ['beautiful', 'đẹp', 'xinh đẹp'],
  ['strong', 'mạnh', 'khỏe'], ['weak', 'yếu'], ['rich', 'giàu'], ['poor', 'nghèo'], ['eat', 'ăn'], ['drink', 'uống'], ['sleep', 'ngủ'], ['run', 'chạy'], ['walk', 'đi bộ', 'đi'],
  ['swim', 'bơi'], ['fly', 'bay'], ['read', 'đọc'], ['write', 'viết'], ['sing', 'hát'], ['dance', 'nhảy', 'múa', 'khiêu vũ'], ['fight', 'đánh nhau', 'chiến đấu', 'đánh'],
  ['win', 'thắng', 'chiến thắng'], ['lose', 'thua', 'mất'], ['buy', 'mua'], ['sell', 'bán'], ['open', 'mở'], ['close', 'đóng', 'gần'], ['rice', 'gạo', 'cơm', 'lúa'],
  ['bread', 'bánh mì'], ['milk', 'sữa'], ['egg', 'trứng', 'quả trứng'], ['meat', 'thịt'], ['tea', 'trà', 'chè'], ['coffee', 'cà phê'], ['sugar', 'đường'], ['salt', 'muối'],
  ['head', 'đầu', 'cái đầu'], ['hand', 'tay', 'bàn tay'], ['foot', 'chân', 'bàn chân'], ['eye', 'mắt', 'con mắt'], ['ear', 'tai', 'cái tai'], ['nose', 'mũi', 'cái mũi'],
  ['mouth', 'miệng', 'cái miệng'], ['heart', 'tim', 'trái tim'], ['morning', 'buổi sáng', 'sáng'], ['night', 'đêm', 'ban đêm', 'buổi tối'], ['today', 'hôm nay'], ['tomorrow', 'ngày mai'],
  ['yesterday', 'hôm qua'], ['week', 'tuần'], ['month', 'tháng'], ['year', 'năm'], ['spring', 'mùa xuân', 'xuân'], ['summer', 'mùa hè', 'mùa hạ', 'hè'], ['autumn', 'mùa thu', 'thu'],
  ['winter', 'mùa đông', 'đông'], ['north', 'phía bắc', 'bắc', 'hướng bắc'], ['south', 'phía nam', 'nam', 'hướng nam'], ['east', 'phía đông', 'đông', 'hướng đông'], ['west', 'phía tây', 'tây', 'hướng tây'],
  ['one', '1', 'một'], ['ten', '10', 'mười'], ['hundred', '100', 'trăm', 'một trăm'], ['thousand', '1000', 'nghìn', 'ngàn', 'một nghìn'], ['million', 'triệu', 'một triệu']];
for (const [w, ...m] of EN) add(`Từ tiếng Anh "${w}" nghĩa là gì?`, m);
const EN_REV = [['con mèo', 'cat'], ['con chó', 'dog'], ['quả táo', 'apple'], ['nước', 'water'], ['mặt trời', 'sun'], ['mặt trăng', 'moon'], ['ngôi nhà', 'house'], ['trường học', 'school'],
  ['quyển sách', 'book'], ['bạn bè', 'friend'], ['gia đình', 'family'], ['màu đỏ', 'red'], ['màu xanh dương', 'blue'], ['màu trắng', 'white'], ['màu đen', 'black'], ['con rồng', 'dragon'],
  ['thanh kiếm', 'sword'], ['nhà vua', 'king'], ['công chúa', 'princess'], ['xin chào', 'hello', 'hi'], ['cảm ơn', 'thank you', 'thanks'], ['tạm biệt', 'goodbye', 'bye'],
  ['xin lỗi', 'sorry'], ['vâng / có', 'yes'], ['không', 'no'], ['tình yêu', 'love'], ['bác sĩ', 'doctor'], ['giáo viên', 'teacher'], ['máy bay', 'airplane', 'plane'], ['xe đạp', 'bicycle', 'bike'],
  ['hoa', 'flower'], ['cây', 'tree'], ['biển', 'sea', 'ocean'], ['núi', 'mountain'], ['mưa', 'rain'], ['tuyết', 'snow'], ['sữa', 'milk'], ['trứng', 'egg'], ['bánh mì', 'bread'], ['gạo', 'rice']];
for (const [v, ...e] of EN_REV) add(`"${v}" trong tiếng Anh là gì?`, e);

// ---------- số La Mã ----------
const roman = n => { const T = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of T) while (n >= v) { s += r; n -= v; } return s; };
for (const n of [4, 9, 12, 14, 19, 24, 27, 39, 40, 44, 49, 50, 58, 90, 99, 100, 400, 500, 900, 1000, 1990, 2024, 1945, 1975, 2000]) add(`Số La Mã ${roman(n)} bằng bao nhiêu? (số)`, [n]);
for (const n of [6, 11, 15, 20, 30, 45, 60, 77, 150, 2026]) add(`Số ${n} viết bằng số La Mã như thế nào?`, [roman(n)]);

// ---------- đổi đơn vị ----------
const UNITS = [['1 km bằng bao nhiêu mét? (số)', 1000], ['1 m bằng bao nhiêu cm? (số)', 100], ['1 m bằng bao nhiêu mm? (số)', 1000], ['1 kg bằng bao nhiêu gam? (số)', 1000],
  ['1 tấn bằng bao nhiêu kg? (số)', 1000], ['1 tạ bằng bao nhiêu kg? (số)', 100], ['1 yến bằng bao nhiêu kg? (số)', 10], ['1 lít bằng bao nhiêu ml? (số)', 1000],
  ['1 giờ bằng bao nhiêu giây? (số)', 3600], ['1 phút bằng bao nhiêu giây? (số)', 60], ['1 thế kỷ bằng bao nhiêu năm? (số)', 100], ['1 thiên niên kỷ bằng bao nhiêu năm? (số)', 1000],
  ['1 thập kỷ bằng bao nhiêu năm? (số)', 10], ['1 hecta bằng bao nhiêu mét vuông? (số)', 10000], ['1 km vuông bằng bao nhiêu hecta? (số)', 100], ['1 m khối bằng bao nhiêu lít? (số)', 1000],
  ['1 tá bằng bao nhiêu cái? (số)', 12], ['1 năm thường có bao nhiêu ngày? (số)', 365], ['1 năm có bao nhiêu tháng? (số)', 12], ['1 năm có bao nhiêu quý? (số)', 4],
  ['1 inch bằng bao nhiêu cm? (số thập phân)', ['2,54', '2.54']], ['1 dặm Anh (mile) bằng khoảng bao nhiêu km? (một chữ số thập phân)', ['1,6', '1.6', '1,61', '1.61', '1,609', '1.609']],
  ['1 ngày có bao nhiêu giây? (số)', 86400], ['1 giờ bằng bao nhiêu phút? (số)', 60], ['1 dm bằng bao nhiêu cm? (số)', 10], ['1 GB bằng bao nhiêu MB? (theo hệ nhị phân, số)', ['1024', '1000']],
  ['1 byte bằng bao nhiêu bit? (số)', 8], ['Nước sôi ở bao nhiêu độ C (áp suất thường)? (số)', 100], ['Nước đóng băng ở bao nhiêu độ C? (số)', 0], ['0 độ C bằng bao nhiêu độ F? (số)', 32],
  ['Một vòng tròn có bao nhiêu độ? (số)', 360], ['Tổng ba góc trong một tam giác bằng bao nhiêu độ? (số)', 180], ['Tổng các góc trong của tứ giác bằng bao nhiêu độ? (số)', 360],
  ['Một góc vuông bằng bao nhiêu độ? (số)', 90], ['Một góc bẹt bằng bao nhiêu độ? (số)', 180]];
for (const [q, a] of UNITS) add(q, a);

// ---------- tính nhẩm (hạt giống cố định) ----------
let seed = 20261105;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const seen = new Set();
const addM = (q, a) => { if (seen.has(q)) return false; seen.add(q); add(q, [a]); return true; };
let n = 0;
while (n < 60) { const a = ri(12, 99), b = ri(12, 99); if (addM(`${a} + ${b} = ?`, a + b)) n++; }
n = 0; while (n < 40) { const a = ri(50, 199), b = ri(11, a - 5); if (addM(`${a} - ${b} = ?`, a - b)) n++; }
n = 0; while (n < 60) { const a = ri(6, 19), b = ri(3, 12); if (addM(`${a} x ${b} = ?`, a * b)) n++; }
n = 0; while (n < 30) { const b = ri(3, 12), q = ri(4, 15); if (addM(`${b * q} : ${b} = ?`, q)) n++; }
for (let k = 11; k <= 30; k++) addM(`${k} bình phương (${k} x ${k}) bằng bao nhiêu?`, k * k);
for (const k of [2, 3, 4, 5]) addM(`${k} lập phương (${k} mũ 3) bằng bao nhiêu?`, k ** 3);
for (const k of [16, 25, 36, 49, 64, 81, 100, 121, 144, 196, 225, 400, 625, 900]) addM(`Căn bậc hai của ${k} bằng bao nhiêu?`, Math.sqrt(k));
for (const [p, v] of [[10, 250], [20, 150], [25, 80], [50, 64], [15, 200], [30, 90], [75, 40], [5, 300], [40, 50], [12, 50]]) addM(`${p}% của ${v} bằng bao nhiêu?`, p * v / 100);
n = 0; while (n < 25) { const x = ri(2, 30), a = ri(3, 40); if (addM(`Tìm x: x + ${a} = ${x + a}`, x)) n++; }
n = 0; while (n < 15) { const x = ri(2, 12), a = ri(2, 9); if (addM(`Tìm x: ${a} × x = ${a * x}`, x)) n++; }
n = 0; while (n < 25) { const a = ri(2, 9), b = ri(2, 9), c = ri(1, 20); if (addM(`${a} x ${b} + ${c} = ?`, a * b + c)) n++; }
for (const [s, a] of [['2, 4, 8, 16, ?', 32], ['1, 3, 5, 7, ?', 9], ['3, 6, 9, 12, ?', 15], ['1, 4, 9, 16, ?', 25], ['1, 1, 2, 3, 5, 8, ?', 13], ['100, 90, 80, 70, ?', 60],
  ['2, 3, 5, 7, 11, ?', 13], ['1, 2, 4, 7, 11, ?', 16], ['5, 10, 20, 40, ?', 80], ['81, 27, 9, 3, ?', 1], ['1, 8, 27, 64, ?', 125], ['10, 20, 30, 40, ?', 50], ['0, 1, 3, 6, 10, ?', 15],
  ['2, 6, 18, 54, ?', 162], ['50, 45, 40, 35, ?', 30], ['1, 2, 6, 24, ?', 120], ['7, 14, 21, 28, ?', 35], ['3, 5, 9, 17, ?', 33], ['4, 9, 16, 25, 36, ?', 49], ['11, 22, 33, 44, ?', 55]])
  addM(`Số tiếp theo của dãy: ${s}`, a);

module.exports = { QUIZ_GEN: Q };
