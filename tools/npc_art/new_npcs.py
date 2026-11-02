# Vẽ NPC mới theo đúng phong cách bộ NPC hiện có (ô 144, 4 khung x 2 hàng: trước / nghiêng):
# lấy dáng người của một NPC có sẵn làm khung, đổi màu trang phục theo độ sáng gốc (giữ nếp vải), rồi vẽ thêm phụ kiện
# riêng từng điểm ảnh (mũ, tạp dề, muôi, mũ trùm, mạng che mặt, đèn lồng, mũ cánh chuồn, hốt ngọc...).
#   python3 tools/npc_art/new_npcs.py   -> ghi public/assets/npcs/{dau_bep,dem_thuong_nhan,ct_thanh_quan}.png
import colorsys, os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets', 'npcs')
C = 144
OUT = (37, 23, 35, 255)   # màu viền tối của bộ NPC


def load(n):
    im = Image.open(os.path.join(ROOT, n + '.png')).convert('RGBA')
    BOB_SRC[id(im)] = im.copy()
    return im


def hsv(p):
    return colorsys.rgb_to_hsv(p[0] / 255, p[1] / 255, p[2] / 255)


def is_robe(p, y):
    h, s, v = hsv(p)
    return p[3] > 128 and 0.03 <= h <= 0.16 and s >= 0.38 and y >= 46


def ramp_at(ramp, t):
    t = max(0.0, min(1.0, t)) * (len(ramp) - 1)
    i = min(int(t), len(ramp) - 2); f = t - i
    a, b = ramp[i], ramp[i + 1]
    return tuple(int(a[k] + (b[k] - a[k]) * f) for k in range(3)) + (255,)


def hexc(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def recolor(im, ramp, keep_trim=True, mask=None):
    """đổi màu áo: ánh xạ độ sáng của điểm ảnh áo gốc lên thang màu mới (giữ nếp, bóng)"""
    px = im.load(); W, H = im.size
    ramp = [hexc(c) for c in ramp]
    for fy in range(H // C):
        for fx in range(W // C):
            pts = []
            for y in range(C):
                for x in range(C):
                    p = px[fx * C + x, fy * C + y]
                    if is_robe(p, y) and (mask is None or mask(x, y, fy)):
                        h, s, v = hsv(p)
                        if keep_trim and v > 0.93 and s < 0.5: continue   # viền chỉ vàng sáng: giữ
                        pts.append((x, y, v))
            if not pts: continue
            lo = min(v for *_, v in pts); hi = max(v for *_, v in pts)
            for x, y, v in pts:
                px[fx * C + x, fy * C + y] = ramp_at(ramp, (v - lo) / max(1e-6, hi - lo))
    return im


def frames(im):
    for fy in range(2):
        for fx in range(4):
            yield fy, fx, fx * C, fy * C


BOB_SRC = {}
def bob(im, fx, fy):
    """độ nhún của khung (so đỉnh đầu với khung 0 cùng hàng) – đo trên ảnh gốc, trước khi vẽ thêm phụ kiện"""
    a = BOB_SRC[id(im)].getchannel('A')
    top = lambda x0, y0: a.crop((x0, y0, x0 + C, y0 + C)).getbbox()[1]
    return top(fx * C, fy * C) - top(0, fy * C)


def px_rect(d, x, y, w, h, col, outline=True):
    if outline: d.rectangle([x - 1, y - 1, x + w, y + h], fill=OUT)
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=col)


# ---------------------------------------------------------------- Đầu Bếp Tửu Lâu
def dau_bep():
    im = load('thuong_nhan')
    recolor(im, ['#2a3a52', '#3e5878', '#5a7ea4', '#86a8c8'])   # áo vải chàm của đầu bếp
    d = ImageDraw.Draw(im)
    for fy, fx, X, Y in frames(im):
        b = bob(im, fx, fy)
        if fy == 0:   # nhìn thẳng
            # tạp dề trắng từ ngực xuống gối, dây buộc quanh eo
            d.polygon([(X + 65, Y + 69 + b), (X + 78, Y + 69 + b), (X + 80, Y + 101 + b), (X + 63, Y + 101 + b)], fill=OUT)
            d.polygon([(X + 66, Y + 70 + b), (X + 77, Y + 70 + b), (X + 79, Y + 100 + b), (X + 64, Y + 100 + b)], fill=(238, 234, 222, 255))
            d.line([(X + 66, Y + 71 + b), (X + 64, Y + 99 + b)], fill=(255, 255, 250, 255))   # mép sáng
            d.line([(X + 77, Y + 71 + b), (X + 79, Y + 99 + b)], fill=(200, 194, 178, 255))   # mép tối
            d.line([(X + 58, Y + 69 + b), (X + 85, Y + 69 + b)], fill=(226, 220, 204, 255))   # dây buộc
            d.rectangle([X + 69, Y + 84 + b, X + 74, Y + 88 + b], outline=(200, 194, 178, 255))   # túi tạp dề
            # mũ đầu bếp trắng phồng
            d.ellipse([X + 62, Y + 17 + b, X + 81, Y + 32 + b], fill=OUT)
            d.ellipse([X + 63, Y + 18 + b, X + 80, Y + 31 + b], fill=(246, 244, 236, 255))
            d.ellipse([X + 65, Y + 19 + b, X + 71, Y + 24 + b], fill=(255, 255, 255, 255))
            d.line([(X + 71, Y + 20 + b), (X + 70, Y + 29 + b)], fill=(214, 210, 198, 255))
            px_rect(d, X + 64, Y + 29 + b, 16, 5, (232, 228, 216, 255))
            # muôi gỗ ở tay phải (bên phải ảnh)
            d.line([(X + 88, Y + 70 + b), (X + 96, Y + 46 + b)], fill=OUT, width=3)
            d.line([(X + 88, Y + 70 + b), (X + 96, Y + 46 + b)], fill=(150, 104, 58, 255), width=1)
            d.ellipse([X + 92, Y + 38 + b, X + 102, Y + 47 + b], fill=OUT)
            d.ellipse([X + 93, Y + 39 + b, X + 101, Y + 46 + b], fill=(184, 186, 196, 255))
            d.point((X + 95, Y + 41 + b), fill=(240, 240, 250, 255))
        else:   # nghiêng sang phải
            d.polygon([(X + 78, Y + 68 + b), (X + 84, Y + 69 + b), (X + 85, Y + 101 + b), (X + 77, Y + 101 + b)], fill=OUT)
            d.polygon([(X + 79, Y + 69 + b), (X + 83, Y + 70 + b), (X + 84, Y + 100 + b), (X + 78, Y + 100 + b)], fill=(238, 234, 222, 255))
            d.ellipse([X + 64, Y + 15 + b, X + 82, Y + 29 + b], fill=OUT)
            d.ellipse([X + 65, Y + 16 + b, X + 81, Y + 28 + b], fill=(246, 244, 236, 255))
            d.ellipse([X + 67, Y + 17 + b, X + 72, Y + 21 + b], fill=(255, 255, 255, 255))
            px_rect(d, X + 66, Y + 27 + b, 15, 5, (232, 228, 216, 255))
            d.line([(X + 82, Y + 86 + b), (X + 92, Y + 64 + b)], fill=OUT, width=3)
            d.line([(X + 82, Y + 86 + b), (X + 92, Y + 64 + b)], fill=(150, 104, 58, 255), width=1)
            d.ellipse([X + 88, Y + 56 + b, X + 98, Y + 65 + b], fill=OUT)
            d.ellipse([X + 89, Y + 57 + b, X + 97, Y + 64 + b], fill=(184, 186, 196, 255))
    return im


# ---------------------------------------------------------------- Thương Nhân Bí Ẩn
def dem_thuong_nhan():
    im = load('thuong_nhan')
    recolor(im, ['#1a1028', '#2e1a48', '#4a2a72', '#6e48a0'], keep_trim=False)   # áo choàng tím thẫm
    base = im.copy()
    d = ImageDraw.Draw(im)
    hood, hood2, veil = (40, 24, 62, 255), (70, 46, 104, 255), (26, 16, 34, 255)
    def face(X, Y, b, box):   # trả lại khuôn mặt gốc trong khung mũ trùm
        m = Image.new('L', im.size, 0); ImageDraw.Draw(m).ellipse([X + box[0], Y + box[1] + b, X + box[2], Y + box[3] + b], fill=255)
        im.paste(base, (0, 0), m)
    for fy, fx, X, Y in frames(im):
        b = bob(im, fx, fy)
        if fy == 0:
            # mũ trùm che tóc, rủ xuống vai
            d.ellipse([X + 58, Y + 21 + b, X + 85, Y + 56 + b], fill=OUT)
            d.ellipse([X + 59, Y + 22 + b, X + 84, Y + 55 + b], fill=hood)
            d.polygon([(X + 57, Y + 50 + b), (X + 86, Y + 50 + b), (X + 89, Y + 63 + b), (X + 54, Y + 63 + b)], fill=OUT)
            d.polygon([(X + 58, Y + 50 + b), (X + 85, Y + 50 + b), (X + 87, Y + 62 + b), (X + 56, Y + 62 + b)], fill=hood)
            d.arc([X + 60, Y + 23 + b, X + 83, Y + 54 + b], 200, 260, fill=hood2)
            face(X, Y, b, (64, 33, 78, 54))
            d.arc([X + 63, Y + 32 + b, X + 79, Y + 55 + b], 180, 360, fill=OUT)   # bóng vành mũ trên trán
            d.rectangle([X + 65, Y + 46 + b, X + 77, Y + 53 + b], fill=veil)   # mạng che nửa mặt dưới
            d.line([(X + 65, Y + 46 + b), (X + 77, Y + 46 + b)], fill=(130, 90, 180, 255))
            d.point((X + 71, Y + 44 + b), fill=(150, 100, 200, 255))
            # đèn lồng tím treo ở tay trái
            lx, ly = X + 52, Y + 92 + b
            d.line([(X + 56, Y + 82 + b), (lx, ly - 6)], fill=OUT)
            d.ellipse([lx - 6, ly - 6, lx + 6, ly + 8], fill=OUT)
            d.ellipse([lx - 5, ly - 5, lx + 5, ly + 7], fill=(150, 70, 220, 255))
            d.ellipse([lx - 3, ly - 2, lx + 3, ly + 4], fill=(230, 190, 255, 255))
            d.rectangle([lx - 4, ly - 7, lx + 4, ly - 6], fill=(200, 160, 60, 255)); d.rectangle([lx - 4, ly + 7, lx + 4, ly + 8], fill=(200, 160, 60, 255))
        else:
            d.ellipse([X + 59, Y + 18 + b, X + 83, Y + 52 + b], fill=OUT)
            d.ellipse([X + 60, Y + 19 + b, X + 82, Y + 51 + b], fill=hood)
            d.polygon([(X + 60, Y + 44 + b), (X + 78, Y + 46 + b), (X + 80, Y + 60 + b), (X + 58, Y + 62 + b)], fill=hood)
            face(X, Y, b, (71, 31, 82, 50))
            d.rectangle([X + 74, Y + 43 + b, X + 80, Y + 49 + b], fill=veil)
            px_rect(d, X + 57, Y + 56 + b, 6, 16, (92, 64, 40, 255))   # túi hàng sau lưng
            lx, ly = X + 86, Y + 96 + b
            d.line([(X + 82, Y + 86 + b), (lx, ly - 6)], fill=OUT)
            d.ellipse([lx - 6, ly - 6, lx + 6, ly + 8], fill=OUT)
            d.ellipse([lx - 5, ly - 5, lx + 5, ly + 7], fill=(150, 70, 220, 255))
            d.ellipse([lx - 3, ly - 2, lx + 3, ly + 4], fill=(230, 190, 255, 255))
    return im


# ---------------------------------------------------------------- Thành Quan Lâm An
def ct_thanh_quan():
    im = load('thanh_chu_lan_chau')
    recolor(im, ['#3a0a0e', '#6e1418', '#a82a26', '#d8503c'])   # quan phục đỏ thắm, giữ viền chỉ vàng
    d = ImageDraw.Draw(im)
    for fy, fx, X, Y in frames(im):
        b = bob(im, fx, fy)
        a = BOB_SRC[id(im)].getchannel('A').crop((X, Y, X + C, Y + C)); top = a.getbbox()[1]
        if fy == 0:
            # mũ ô sa cánh chuồn: hai cánh đen dài hai bên mũ
            wy = Y + top + 9
            for side in (-1, 1):
                x0 = X + 71 + side * 9
                x1 = X + 71 + side * 21
                d.rectangle([min(x0, x1), wy - 2, max(x0, x1), wy + 2], fill=OUT)
                d.rectangle([min(x0, x1) + (1 if side < 0 else 0), wy - 1, max(x0, x1) - (0 if side < 0 else 1), wy + 1], fill=(28, 20, 26, 255))
                d.ellipse([x1 - 3, wy - 4, x1 + 3, wy + 4], fill=OUT); d.ellipse([x1 - 2, wy - 3, x1 + 2, wy + 3], fill=(28, 20, 26, 255))
                d.point((x1 + side * -1, wy - 2), fill=(90, 80, 90, 255))
            # bổ tử thêu hạc trước ngực + hốt ngọc cầm hai tay
            px_rect(d, X + 70, Y + 60 + b, 3, 17, (170, 220, 180, 255))   # hốt ngọc
            d.line([(X + 70, Y + 61 + b), (X + 70, Y + 75 + b)], fill=(225, 250, 230, 255))
        else:
            wy = Y + top + 9
            d.rectangle([X + 56, wy - 2, X + 66, wy + 2], fill=OUT); d.rectangle([X + 57, wy - 1, X + 66, wy + 1], fill=(28, 20, 26, 255))
            d.ellipse([X + 52, wy - 4, X + 58, wy + 4], fill=OUT); d.ellipse([X + 53, wy - 3, X + 57, wy + 3], fill=(28, 20, 26, 255))
            px_rect(d, X + 82, Y + 56 + b, 3, 22, (170, 220, 180, 255))
    return im


if __name__ == '__main__':
    for name, fn in (('dau_bep', dau_bep), ('dem_thuong_nhan', dem_thuong_nhan), ('ct_thanh_quan', ct_thanh_quan)):
        im = fn()
        im.save(os.path.join(ROOT, name + '.png'), optimize=True)
        print('ok', name)
