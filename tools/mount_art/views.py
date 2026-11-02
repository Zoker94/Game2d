# Vẽ thêm hướng nhìn TRƯỚC (đi xuống) và SAU (đi lên) cho thú cưỡi, ghép vào sheet có sẵn hàng nhìn ngang.
# Chạy SAU build.py:  cd tools/mount_art && python3 views.py
# Mỗi sheet thành 5 hàng: 0 ngang | 1 trước-lớp sau | 2 trước-lớp đè người cưỡi | 3 sau-lớp sau | 4 sau-lớp đè
# Vẽ ở lưới 1 điểm ảnh = 4px sheet (= 2px màn hình, khớp độ thô của ảnh nhìn ngang), có viền tối tự động.
import json, math, colorsys
import numpy as np
from PIL import Image, ImageDraw
OUT = '/home/user/Game2d/public/assets/'
PX = 4

def hexc(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def shade(c, dv, ds=0.0, dh=0.0):
    r, g, b = [x / 255 for x in c]; h, s, v = colorsys.rgb_to_hsv(r, g, b)
    h = (h + dh) % 1; s = min(1, max(0, s + ds)); v = min(1, max(0, v * (1 + dv)))
    return tuple(round(x * 255) for x in colorsys.hsv_to_rgb(h, s, v))
def ramp(base):
    c = hexc(base) if isinstance(base, str) else base
    return [shade(c, -0.55, 0.1, -0.02), shade(c, -0.28, 0.05, -0.01), c, shade(c, 0.22, -0.08, 0.01), shade(c, 0.45, -0.2, 0.02)]

class Part:
    """một mảnh vẽ riêng (để có viền tách khỏi mảnh khác)"""
    def __init__(s, w, h):
        s.im = Image.new('RGBA', (w, h)); s.d = ImageDraw.Draw(s.im)
    def ell(s, cx, cy, rx, ry, c):
        if rx <= 0 or ry <= 0: return
        x0, y0 = round(cx - rx), round(cy - ry); x1, y1 = max(x0, round(cx + rx) - 1), max(y0, round(cy + ry) - 1)
        s.d.ellipse([x0, y0, x1, y1], fill=c + (255,))
    def blob(s, cx, cy, rx, ry, R, light=1.0):
        """khối tròn có bóng: tối dưới phải, sáng trên trái"""
        s.ell(cx, cy, rx, ry, R[1])
        s.ell(cx - rx * 0.12, cy - ry * 0.16, rx * 0.86, ry * 0.8, R[2])
        if light: s.ell(cx - rx * 0.32, cy - ry * 0.42, rx * 0.38 * light, ry * 0.32 * light, R[3])
    def poly(s, pts, c):
        s.d.polygon([(round(x), round(y)) for x, y in pts], fill=c + (255,))
    def rect(s, x0, y0, x1, y1, c):
        if x1 < x0 or y1 < y0: return
        s.d.rectangle([round(x0), round(y0), round(x1), round(y1)], fill=c + (255,))
    def px(s, x, y, c):
        x, y = round(x), round(y)
        if 0 <= x < s.im.width and 0 <= y < s.im.height: s.im.putpixel((x, y), c + (255,))
    def line(s, pts, c, w=1):
        s.d.line([(round(x), round(y)) for x, y in pts], fill=c + (255,), width=max(1, round(w)))
    def leg(s, x, top, bot, w, R, hoof, knee=None):
        """chân thẳng đứng nhìn trước/sau: thân sáng giữa, mép tối, móng"""
        s.rect(x - w / 2, top, x + w / 2 - 1, bot, R[1])
        s.rect(x - w / 2 + (1 if w >= 3 else 0), top, x + w / 2 - 2 if w >= 3 else x, bot - 1, R[2])
        if knee: s.rect(x - w / 2, knee, x + w / 2 - 1, knee, R[1])
        hh = max(1, round(w * 0.55)); s.rect(x - w / 2, bot - hh + 1, x + w / 2 - 1, bot, hoof)
    def done(s):
        a = np.asarray(s.im).copy(); al = a[..., 3] > 0
        nb = np.zeros_like(al); col = np.zeros(a.shape[:2] + (3,), float); cnt = np.zeros(a.shape[:2])
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(al, dy, 0), dx, 1); shc = np.roll(np.roll(a[..., :3], dy, 0), dx, 1)
            m = sh & ~al; nb |= m; col[m] += shc[m]; cnt[m] += 1
        col[nb] = col[nb] / cnt[nb][:, None] * 0.28
        a[nb, :3] = col[nb].astype(np.uint8); a[nb, 3] = 255
        return Image.fromarray(a, 'RGBA')

def stack(parts, w, h):
    out = Image.new('RGBA', (w, h))
    for p in parts: out.alpha_composite(p.done())
    return out

# ---------------- bảng màu từng thú ----------------
P = {
    'ngua_nau': dict(kind='horse', body='#8a3f1a', mane='#2a1712', hoof='#24140e', muzzle='#5a2a16', blaze='#e8dcc8', size=1.0),
    'bach_ma': dict(kind='horse', body='#d8dce6', mane='#9ad8e8', mane2='#e8a8d8', mane3='#b8a0f0', hoof='#e0b040', muzzle='#c4b8c8', horn='#f0d060', size=1.0),
    'hac_ma': dict(kind='horse', body='#5a2a18', mane='#241410', hoof='#202024', muzzle='#3a1c12', armor='#7a7c84', cloth='#9a1c1c', trim='#e0b040', cloth2='#2a3a7a', size=1.04),
    'kim_nguu': dict(kind='bull', body='#f0a400', mane='#c86000', hoof='#5a2a10', muzzle='#d86800', horn='#e8c060', size=0.96),
    'hoa_ky_lan': dict(kind='qilin', body='#2f7a62', mane='#f06018', mane2='#ffb030', hoof='#3a1a20', muzzle='#3f8a6a', horn='#c8a070', belly='#e0b060', size=1.04),
    'kim_quy': dict(kind='turtle', body='#6a7448', shell='#4a5a34', rim='#8a8a50', size=0.82),
    'phuong_hoang': dict(kind='bird', body='#d83018', wing='#f06010', tip='#ffd040', chest='#f09018', beak='#f0c030', size=1.0),
    'thanh_long': dict(kind='dragon', body='#2f7a4a', belly='#c0a060', wing='#2a5a40', memb='#7a3030', horn='#d8c090', size=1.0),
}
SADDLE = ramp('#5a3020'); BLANKET = ramp('#7a2a20'); EYE = (20, 12, 10); WHITE = (250, 250, 240)
# độ vỗ cánh (độ nâng đầu cánh, độ duỗi) – khớp nhịp vỗ ở hàng nhìn ngang
RUN_FLAP = [(0.95, 1.0), (0.55, 0.95), (-0.1, 0.85), (-0.55, 0.8), (-0.15, 0.85), (0.5, 0.95)]
IDLE_FLAP = [(0.35, 1.0), (0.2, 0.97), (0.05, 0.94), (0.2, 0.97)]

def gait(k, n, moving):
    """trả về (độ nhún thân, nâng chân [trước trái, trước phải, sau trái, sau phải], gật đầu)"""
    if not moving:
        return (1 if k % 2 else 0), [0, 0, 0, 0], 0
    ph = 2 * math.pi * k / n; s = math.sin(ph)
    return round(abs(s) * 1.6), [max(0, s) * 4, max(0, -s) * 4, max(0, -s) * 3, max(0, s) * 3], round(math.sin(ph + 0.6))

# ======================= ngựa / bò / kỳ lân =======================
def quad(name, view, k, n, moving, w, h, G, cx):
    p = P[name]; u = p['size']; kind = p['kind']
    R = ramp(p['body']); M = ramp(p['mane']); hoof = hexc(p['hoof']); MZ = ramp(p['muzzle'])
    b, lift, nod = gait(k, n, moving)
    bull = kind == 'bull'; qilin = kind == 'qilin'; armor = 'armor' in p
    wid = 1.3 if bull else 1.14
    back, front = [], []
    LW = 4 * u * (1.12 if bull else 1)
    # ---- đuôi ----
    def tail(part, y0, y1, sway, big):
        tw = (3.2 if big else 2) * u
        if bull:   # đuôi bò: sợi mảnh + chùm lông cuối
            part.line([(cx + sway * 0.3, y0), (cx + sway, y1 - 3 * u)], R[1], 1)
            part.ell(cx + sway, y1 - 1.5 * u, 1.8 * u, 2.4 * u, M[1]); part.ell(cx + sway - 0.4, y1 - 2 * u, 1.1 * u, 1.5 * u, M[2]); return
        TR = ramp(p['mane2']) if qilin else M
        for i in range(int(y1 - y0) + 1):
            t = i / max(1, (y1 - y0)); x = cx + sway * t * t; ww = tw * (0.8 + 0.6 * t)
            part.rect(x - ww / 2, y0 + i, x + ww / 2 - 1, y0 + i, TR[1] if i % 3 == 0 else TR[2])
            if ww > 2: part.px(x - ww / 4, y0 + i, TR[3])
        if 'mane2' in p and not qilin:   # bờm/đuôi cầu vồng (Bạch Mã)
            for i in range(0, int(y1 - y0), 3):
                t = i / max(1, (y1 - y0)); x = cx + sway * t * t
                part.px(x + 0.5, y0 + i, hexc(p['mane2'])); part.px(x - 0.5, y0 + i + 1, hexc(p['mane3']))
        if qilin:  # lửa ở chóp đuôi
            for j in range(4):
                part.ell(cx + sway + (j - 1.5) * 1.2, y1 - 1 - (j % 2) * 2, 1.2, 2.2, hexc(p['mane2']) if j % 2 else hexc(p['mane']))
    def flames(part, x, y, r, n_=5, seed=0):
        F1, F2 = hexc(p['mane']), hexc(p['mane2'])
        for i in range(n_):
            a = (i / n_) * math.pi * 2 + seed
            part.ell(x + math.cos(a) * r, y + math.sin(a) * r * 0.8, 1.6 * u, 2.4 * u, F1 if i % 2 else F2)
    # ---- giáp/vải phủ (Hắc Mã) ----
    def caparison(part, cy, rx, ry):
        A = ramp(p['armor']); C = ramp(p['cloth']); T = hexc(p['trim'])
        part.blob(cx, cy, rx, ry, A)
        for yy in range(int(cy - ry) + 1, int(cy + ry), 2):   # vảy giáp
            for xx in range(int(cx - rx) + 1 + (yy % 4 == 0), int(cx + rx), 2): part.px(xx, yy, A[1])
        part.rect(cx - rx - 0.5, cy + ry * 0.15, cx - rx * 0.55, cy + ry + 3 * u, C[2]); part.rect(cx + rx * 0.55, cy + ry * 0.15, cx + rx - 0.5, cy + ry + 3 * u, C[1])
        part.rect(cx - rx - 0.5, cy + ry + 3 * u, cx - rx * 0.55, cy + ry + 3 * u, T); part.rect(cx + rx * 0.55, cy + ry + 3 * u, cx + rx - 0.5, cy + ry + 3 * u, T)
    # ---- đầu nhìn thẳng ----
    def head_front(part, hy):
        hw = 4.6 * u * (1.18 if bull else 1)
        if qilin:  # bờm lửa lớn quanh đầu
            flames(part, cx, hy - 1 * u, 5.6 * u, 9, k * 0.4)
        if 'horn' in p and kind == 'horse':   # sừng kỳ lân (Bạch Mã)
            Hn = ramp(p['horn'])
            for i in range(int(8 * u)):
                part.rect(cx - 1 + (i > 4 * u), hy - 4 * u - i, cx + (i < 5 * u), hy - 4 * u - i, Hn[2] if i % 2 else Hn[3])
        if bull:   # sừng bò cong ra hai bên
            Hn = ramp(p['horn'])
            for sgn in (-1, 1):
                pts = [(cx + sgn * (hw - 1 + t * 5.5 * u), hy - 3 * u - math.sin(t * 2.2) * 3.5 * u) for t in [i / 10 for i in range(11)]]
                part.line(pts, Hn[1], 2.4 * u); part.line([(x, y - 0.5) for x, y in pts[:-2]], Hn[3], 1)
        if qilin:  # gạc
            Hn = ramp(p['horn'])
            for sgn in (-1, 1):
                part.line([(cx + sgn * 2 * u, hy - 3 * u), (cx + sgn * 3.5 * u, hy - 8.5 * u)], Hn[2], 1.4)
                part.line([(cx + sgn * 3 * u, hy - 6 * u), (cx + sgn * 5.5 * u, hy - 7.5 * u)], Hn[2], 1)
        # tai
        if not qilin:
            for sgn in (-1, 1):
                ex = cx + sgn * (hw * (1.2 if bull else 0.62))
                if bull: part.ell(ex, hy - 0.5 * u, 2.2 * u, 1.3 * u, R[1])
                else: part.poly([(ex - 1.3 * u, hy - 2.5 * u), (ex + 1.3 * u, hy - 2.5 * u), (ex + sgn * 0.6 * u, hy - 6.5 * u)], R[1]); part.px(ex, hy - 3.5 * u, R[0])
        # mặt: trán rộng thuôn xuống mõm (đầu hướng về người nhìn nên ngắn lại)
        part.blob(cx, hy, hw, 4.4 * u, R)
        if not bull and not qilin: part.blob(cx, hy + 2.6 * u, hw * 0.74, 3.4 * u, R, 0.4)
        part.blob(cx, hy + 4.4 * u, hw * (0.92 if bull else 0.7), 2.8 * u, MZ, 0.6)
        if p.get('blaze'): part.rect(cx - 0.5, hy - 2.5 * u, cx, hy + 3 * u, hexc(p['blaze']))
        if armor:  # mặt nạ giáp + chùm lông đỏ
            A = ramp(p['armor']); part.rect(cx - 2 * u, hy - 4 * u, cx + 2 * u - 1, hy + 2.5 * u, A[2]); part.rect(cx - 2 * u, hy - 4 * u, cx - 2 * u, hy + 2.5 * u, A[3])
            part.px(cx, hy - 1, hexc(p['trim'])); C = ramp(p['cloth'])
            part.ell(cx, hy - 6.5 * u, 1.8 * u, 2.6 * u, C[2]); part.ell(cx - 0.5, hy - 7.5 * u, 1, 1.5, C[3])
        if p['mane'] and kind == 'horse' and not armor:   # chỏm bờm trước trán
            part.ell(cx + (1 if 'mane2' not in p else 0), hy - 3.6 * u, 2.2 * u, 1.6 * u, M[2]); part.px(cx, hy - 4.2 * u, M[3])
            if 'mane2' in p: part.px(cx - 1, hy - 3.4 * u, hexc(p['mane2'])); part.px(cx + 1, hy - 3.6 * u, hexc(p['mane3']))
        if bull: part.ell(cx, hy - 3.6 * u, 2.4 * u, 1.4 * u, M[2])
        # mắt hai bên + lỗ mũi
        for sgn in (-1, 1):
            ex = cx + sgn * (hw - 1.4); part.px(ex, hy - 0.5, EYE); part.px(ex + sgn, hy - 0.5, EYE); part.px(ex, hy - 1.5, EYE if not qilin else (255, 200, 60))
            if not qilin: part.px(ex + (1 if sgn < 0 else 0), hy - 1.5, WHITE)
            part.px(cx + sgn * 1.4 * u, hy + 5.4 * u, MZ[0])
        if bull: part.rect(cx - 1, hy + 5.6 * u, cx + 1, hy + 5.6 * u, (200, 200, 210))   # khoen mũi
        if qilin:  # râu
            part.line([(cx - 2.5 * u, hy + 4 * u), (cx - 5.5 * u, hy + 6 * u)], hexc(p['mane2']), 1)
            part.line([(cx + 2.5 * u, hy + 4 * u), (cx + 5.5 * u, hy + 6 * u)], hexc(p['mane2']), 1)
    # ---- đầu nhìn từ sau ----
    def head_back(part, hy):
        hw = 4.2 * u * (1.18 if bull else 1)
        if qilin: flames(part, cx, hy, 5.2 * u, 9, k * 0.4)
        if bull:
            Hn = ramp(p['horn'])
            for sgn in (-1, 1):
                pts = [(cx + sgn * (hw - 1 + t * 5.5 * u), hy - 2 * u - math.sin(t * 2.2) * 3.5 * u) for t in [i / 10 for i in range(11)]]
                part.line(pts, Hn[1], 2.4 * u)
        if qilin:
            Hn = ramp(p['horn'])
            for sgn in (-1, 1): part.line([(cx + sgn * 2 * u, hy - 2 * u), (cx + sgn * 3.5 * u, hy - 7.5 * u)], Hn[2], 1.4)
        if 'horn' in p and kind == 'horse':
            Hn = ramp(p['horn']); part.rect(cx - 0.5, hy - 9 * u, cx, hy - 3 * u, Hn[2])
        if not qilin:
            for sgn in (-1, 1):
                ex = cx + sgn * hw * (1.2 if bull else 0.6)
                if bull: part.ell(ex, hy + 0.5, 2 * u, 1.2 * u, R[1])
                else: part.poly([(ex - 1.3 * u, hy - 1.5 * u), (ex + 1.3 * u, hy - 1.5 * u), (ex + sgn * 0.5 * u, hy - 5.5 * u)], R[1])
        part.blob(cx, hy, hw, 3.6 * u, R, 0.7)
        if armor:
            C = ramp(p['cloth']); part.ell(cx, hy - 4.5 * u, 1.8 * u, 2.6 * u, C[2])
    lf, rf, lh, rh = lift
    if view == 'down':
        # --- lớp sau: chân sau (xa, chạm đất cao hơn), đuôi, thân ---
        P1 = Part(w, h)
        for sgn, lt in ((-1, lh), (1, rh)):
            P1.leg(cx + sgn * 4.6 * u * wid, G - 22 * u - b, G - 3 * u - lt, LW * 0.92, ramp(shade(R[2], -0.15)), hoof)
        P2 = Part(w, h); tail(P2, G - 26 * u - b, G - 9 * u, 1.5 * math.sin(2 * math.pi * k / n) if moving else 0, False)
        P3 = Part(w, h)
        if armor: caparison(P3, G - 28 * u - b, 9.2 * u, 7.6 * u)
        else:
            P3.blob(cx, G - 28 * u - b, 9.2 * u * wid, 8 * u, R)
            if qilin:
                for yy in range(int(G - 34 * u - b), int(G - 21 * u - b), 2):
                    for xx in range(int(cx - 8 * u), int(cx + 8 * u), 3): P3.px(xx + (yy % 4 == 0), yy, R[1])
            P3.rect(cx - 9.2 * u * wid, G - 31 * u - b, cx - 7.6 * u * wid, G - 24 * u - b, BLANKET[2]); P3.rect(cx + 7.6 * u * wid, G - 31 * u - b, cx + 9.2 * u * wid - 1, G - 24 * u - b, BLANKET[1])
        back = [P1, P2, P3]
        # --- lớp đè: ngực, chân trước, cổ, đầu ---
        F1 = Part(w, h)
        if armor: caparison(F1, G - 22 * u - b, 6.8 * u, 5.6 * u)
        else:
            F1.blob(cx, G - 22 * u - b, 6.6 * u * wid, 6 * u, R)
            if qilin: F1.blob(cx, G - 21 * u - b, 3.6 * u, 4.4 * u, ramp(p['belly']), 0.6)
        F2 = Part(w, h)
        for sgn, lt in ((-1, lf), (1, rf)):
            F2.leg(cx + sgn * 3.8 * u * wid, G - 18 * u - b, G - lt, LW, R, hoof, knee=G - 9 * u - lt)
            if armor: A = ramp(p['armor']); F2.rect(cx + sgn * 3.8 * u - LW / 2, G - 8 * u - lt, cx + sgn * 3.8 * u + LW / 2 - 1, G - 4 * u - lt, A[2])
            if qilin: F2.ell(cx + sgn * 3.8 * u, G - 2 * u - lt, 1.6 * u, 1.4 * u, hexc(p['mane']))
        F3 = Part(w, h)
        hy = G - 30 * u - b + nod
        if kind == 'horse' and not armor:   # bờm hai bên cổ
            for sgn in (-1, 1): F3.ell(cx + sgn * 4.2 * u, hy + 1.5 * u, 1.6 * u, 4.4 * u, M[1] if sgn > 0 else M[2])
        if armor: A = ramp(p['armor']); F3.blob(cx, hy + 4 * u, 4.6 * u, 4 * u, A)
        else: F3.blob(cx, hy + 4 * u, 4.4 * u * wid, 4.2 * u, R, 0.5)
        F4 = Part(w, h); head_front(F4, hy)
        front = [F1, F2, F3, F4]
        seat = (cx, G - 34.5 * u - b)
    else:
        # --- lớp sau: đầu + cổ (xa), chân trước (xa), thân ---
        B1 = Part(w, h); hy = G - 36 * u - b + nod
        if kind == 'horse' and not armor:
            B1.ell(cx, hy + 3 * u, 4.2 * u, 5 * u, R[1]); B1.rect(cx - 1, hy - 1 * u, cx, hy + 7 * u, M[2])
        else: B1.blob(cx, hy + 3 * u, 4.4 * u * wid, 4.6 * u, ramp(p['armor']) if armor else R, 0.4)
        B2 = Part(w, h); head_back(B2, hy)
        B3 = Part(w, h)
        for sgn, lt in ((-1, lf), (1, rf)):
            B3.leg(cx + sgn * 4.4 * u * wid, G - 22 * u - b, G - 3 * u - lt, LW * 0.92, ramp(shade(R[2], -0.15)), hoof)
        B4 = Part(w, h)
        if armor: caparison(B4, G - 28 * u - b, 9.2 * u, 7.6 * u)
        else:
            B4.blob(cx, G - 28 * u - b, 9.2 * u * wid, 8 * u, R)
            B4.rect(cx - 9.2 * u * wid, G - 31 * u - b, cx - 7.6 * u * wid, G - 24 * u - b, BLANKET[2]); B4.rect(cx + 7.6 * u * wid, G - 31 * u - b, cx + 9.2 * u * wid - 1, G - 24 * u - b, BLANKET[1])
        back = [B1, B2, B3, B4]
        # --- lớp đè: chân sau (gần), mông, đuôi ---
        F1 = Part(w, h)
        for sgn, lt in ((-1, lh), (1, rh)):
            F1.leg(cx + sgn * 4.4 * u * wid, G - 17 * u - b, G - lt, LW, R, hoof, knee=G - 8 * u - lt)
            if armor: A = ramp(p['armor']); F1.rect(cx + sgn * 4.4 * u - LW / 2, G - 7 * u - lt, cx + sgn * 4.4 * u + LW / 2 - 1, G - 4 * u - lt, A[2])
            if qilin: F1.ell(cx + sgn * 4.4 * u, G - 2 * u - lt, 1.6 * u, 1.4 * u, hexc(p['mane']))
        F2 = Part(w, h)
        if armor:
            C = ramp(p['cloth']); T = hexc(p['trim'])
            F2.blob(cx, G - 24 * u - b, 8.6 * u, 7.2 * u, C); F2.rect(cx - 8 * u, G - 18 * u - b, cx + 8 * u, G - 18 * u - b, T)
            F2.rect(cx - 0.5, G - 31 * u - b, cx, G - 18 * u - b, ramp(p['cloth2'])[2])
        else:
            for sgn in (-1, 1): F2.blob(cx + sgn * 4.2 * u * wid, G - 24 * u - b, 5.4 * u * wid, 7 * u, R, 0.8)
            F2.rect(cx, G - 29 * u - b, cx, G - 19 * u - b, R[0])
            if qilin:
                for yy in range(int(G - 30 * u - b), int(G - 18 * u - b), 2):
                    for xx in range(int(cx - 8 * u), int(cx + 8 * u), 3): F2.px(xx + (yy % 4 == 0), yy, R[1])
        F3 = Part(w, h); tail(F3, G - 30 * u - b, G - (12 if bull else 7) * u, 2.2 * math.sin(2 * math.pi * k / n) if moving else (0.5 if k % 2 else 0), True)
        front = [F1, F2, F3]
        seat = (cx, G - 33 * u - b)
    return back, front, seat

# ======================= rùa =======================
def turtle(name, view, k, n, moving, w, h, G, cx):
    p = P[name]; S = ramp(p['shell']); R = ramp(p['body']); RM = ramp(p['rim'])
    b, lift, nod = gait(k, n, moving); lf, rf, lh, rh = [x * 0.5 for x in lift]
    def shell(part, cy):
        part.blob(cx, cy + 4, 17, 6, RM, 0.4)               # vành mai
        part.blob(cx, cy, 15.5, 10.5, S)
        for (dx, dy) in ((0, -5), (-7, -2), (7, -2), (-4, 3), (4, 3), (-11, 3), (11, 3)):   # vảy lục giác
            part.ell(cx + dx, cy + dy, 3, 2.4, S[1]); part.ell(cx + dx - 0.5, cy + dy - 0.6, 2.2, 1.6, S[2 if dy > 0 else 3])
        part.rect(cx - 6, cy - 10, cx + 6, cy - 8, SADDLE[2]); part.rect(cx - 8, cy - 8, cx - 7, cy + 2, SADDLE[1]); part.rect(cx + 7, cy - 8, cx + 8, cy + 2, SADDLE[1])
    back, front = [], []
    if view == 'down':
        B1 = Part(w, h)
        for sgn, lt in ((-1, lh), (1, rh)): B1.blob(cx + sgn * 10, G - 7 - lt, 3, 4.5, ramp(shade(R[2], -0.15)), 0.4)
        B2 = Part(w, h); shell(B2, G - 15 - b)
        back = [B1, B2]
        F1 = Part(w, h)
        for sgn, lt in ((-1, lf), (1, rf)):
            F1.blob(cx + sgn * 12, G - 4 - lt, 3.4, 4.6, R); F1.px(cx + sgn * 12 - 1, G - lt, R[0]); F1.px(cx + sgn * 12 + 1, G - lt, R[0])
        F2 = Part(w, h); hy = G - 7 - b + nod
        F2.blob(cx, hy + 3, 3, 3, R, 0.3); F2.blob(cx, hy, 4.2, 3.6, R)
        F2.px(cx - 2.5, hy - 0.5, EYE); F2.px(cx + 2.5, hy - 0.5, EYE); F2.px(cx - 2.5, hy - 1.5, WHITE); F2.rect(cx - 1, hy + 2, cx + 1, hy + 2, R[0])
        front = [F1, F2]
        seat = (cx, G - 26 - b)
    else:
        B1 = Part(w, h); B1.blob(cx, G - 21 - b, 3.2, 2.6, R, 0.3)
        for sgn, lt in ((-1, lf), (1, rf)): B1.blob(cx + sgn * 10, G - 7 - lt, 3, 4.5, ramp(shade(R[2], -0.15)), 0.4)
        B2 = Part(w, h); shell(B2, G - 15 - b)
        back = [B1, B2]
        F1 = Part(w, h)
        for sgn, lt in ((-1, lh), (1, rh)): F1.blob(cx + sgn * 11, G - 4 - lt, 3.4, 4.4, R)
        F2 = Part(w, h); F2.poly([(cx - 2, G - 7 - b), (cx + 2, G - 7 - b), (cx + (1 if k % 2 else 0), G - 2 - b)], R[2])
        front = [F1, F2]
        seat = (cx, G - 26 - b)
    return back, front, seat

# ======================= cánh (phượng, rồng) =======================
def wings(part, cx, sy, span, lift_, ext, kind, p):
    """hai cánh dang hai bên: lift_ >0 đầu cánh nâng lên, ext độ duỗi"""
    for sgn in (-1, 1):
        sx = cx + sgn * 5
        tipx = cx + sgn * (5 + span * ext); tipy = sy - span * 0.62 * lift_
        midx = cx + sgn * (5 + span * ext * 0.55); midy = sy - span * 0.42 * lift_ - 3
        if kind == 'bird':
            W = ramp(p['wing']); T = hexc(p['tip']); Bd = ramp(p['body'])
            # lông vũ: các dải toả từ gốc cánh ra mép
            for i in range(7):
                t = i / 6
                ex = midx + (tipx - midx) * t; ey = midy + (tipy - midy) * t + t * 9 + 6
                part.line([(sx, sy + 1), (ex, ey)], Bd[1] if i % 2 else W[1], 3)
                part.line([(sx, sy + 1), (ex, ey - 1)], W[2], 2)
                part.ell(ex, ey, 1.6, 2.4, T if i % 2 == 0 else W[3])
            part.poly([(sx, sy - 2), (midx, midy), (tipx, tipy), (tipx - sgn * 2, tipy + 3), (midx, midy + 5), (sx, sy + 5)], W[2])
            part.line([(sx, sy - 2), (midx, midy), (tipx, tipy)], W[3], 1)
            part.px(tipx, tipy, T)
        else:
            Wg = ramp(p['wing']); Mb = ramp(p['memb'])
            # màng cánh dơi: xương cánh + màng giữa các ngón
            fingers = [(tipx, tipy), (midx + sgn * span * ext * 0.32, midy + 7), (midx + sgn * span * ext * 0.12, midy + 11), (midx - sgn * 2, midy + 12)]
            pts = [(sx, sy + 4), (sx, sy - 1), (midx, midy)] + fingers + [(sx + sgn * 2, sy + 6)]
            part.poly(pts, Mb[1])
            for fx, fy in fingers:
                part.poly([(midx, midy), (fx, fy), ((midx + fx) / 2, (midy + fy) / 2 + 2)], Mb[2])
            for fx, fy in fingers: part.line([(midx, midy), (fx, fy)], Wg[2], 1)
            part.line([(sx, sy - 1), (midx, midy), (tipx, tipy)], Wg[3], 2)
            part.px(midx, midy - 1, hexc(p['horn']))

def bird(name, view, k, n, moving, w, h, G, cx, flapf):
    p = P[name]; R = ramp(p['body']); C = ramp(p['chest']); Bk = ramp(p['beak']); T = hexc(p['tip']); W = ramp(p['wing'])
    b, lift, nod = gait(k, n, moving); lf, rf = lift[0] * 0.8, lift[1] * 0.8
    if not moving: b = 0
    fl, ex = flapf
    def legs(part, top):
        for sgn, lt in ((-1, lf), (1, rf)):
            x = cx + sgn * 3.4
            part.rect(x - 0.5, top, x + 0.5, G - 1 - lt, Bk[1]); part.rect(x - 0.5, top, x - 0.5, G - 2 - lt, Bk[3])
            for d in (-1.5, 0, 1.5): part.px(x + d, G - lt, Bk[0])
    def tailfan(part, y0, y1, spread):
        for i in range(7):
            t = (i - 3) / 3; x1 = cx + t * spread; sw = math.sin(2 * math.pi * k / n + i) * (1.2 if moving else 0.4)
            part.line([(cx, y0), (x1 + sw, y1 - abs(t) * 5)], R[1] if i % 2 else W[2], 3)
            part.line([(cx, y0), (x1 + sw, y1 - abs(t) * 5 - 1)], W[3], 1)
            part.ell(x1 + sw, y1 - abs(t) * 5, 1.8, 2.6, T if i % 2 == 0 else C[2])
    sy = G - 36 - b
    if view == 'down':
        B0 = Part(w, h); tailfan(B0, G - 24 - b, G - 6, 13)
        B1 = Part(w, h); wings(B1, cx, sy, 26, fl, ex, 'bird', p)
        B2 = Part(w, h); B2.blob(cx, G - 27 - b, 9, 10.5, R)
        B2.rect(cx - 9, G - 32 - b, cx - 7.5, G - 25 - b, SADDLE[2]); B2.rect(cx + 7.5, G - 32 - b, cx + 9, G - 25 - b, SADDLE[1])
        back = [B0, B1, B2]
        F1 = Part(w, h); legs(F1, G - 17 - b)
        F2 = Part(w, h); F2.blob(cx, G - 23 - b, 6.4, 7.6, C)
        for yy in range(int(G - 28 - b), int(G - 17 - b), 2):
            for xx in range(int(cx - 5), int(cx + 6), 2): F2.px(xx + (yy % 4 == 0), yy, C[1])
        F3 = Part(w, h); hy = G - 33 - b + nod
        for i in range(5):   # mào lông
            a = -math.pi / 2 + (i - 2) * 0.38
            F3.line([(cx, hy - 2), (cx + math.cos(a) * 7, hy - 2 + math.sin(a) * 7)], R[2], 1); F3.ell(cx + math.cos(a) * 7, hy - 2 + math.sin(a) * 7, 1.2, 1.2, T)
        F3.blob(cx, hy, 4.2, 4, R)
        F3.poly([(cx - 1.8, hy + 1), (cx + 1.8, hy + 1), (cx, hy + 5)], Bk[2]); F3.px(cx - 0.5, hy + 1.5, Bk[3])
        F3.px(cx - 2.6, hy - 0.6, EYE); F3.px(cx + 2.6, hy - 0.6, EYE); F3.px(cx - 2.6, hy - 1.6, (255, 230, 120)); F3.px(cx + 2.6, hy - 1.6, (255, 230, 120))
        front = [F1, F2, F3]
        seat = (cx, G - 35 - b)
    else:
        B0 = Part(w, h); hy = G - 41 - b + nod
        for i in range(5):
            a = -math.pi / 2 + (i - 2) * 0.38
            B0.line([(cx, hy - 1), (cx + math.cos(a) * 6, hy - 1 + math.sin(a) * 6)], R[2], 1); B0.ell(cx + math.cos(a) * 6, hy - 1 + math.sin(a) * 6, 1.2, 1.2, T)
        B0.blob(cx, hy + 3, 3.2, 4, R, 0.4); B0.blob(cx, hy, 3.6, 3.4, R, 0.5)
        B1 = Part(w, h); wings(B1, cx, sy, 26, fl, ex, 'bird', p)
        B2 = Part(w, h); legs(B2, G - 17 - b)
        B3 = Part(w, h); B3.blob(cx, G - 27 - b, 9, 10.5, R)
        B3.rect(cx - 9, G - 32 - b, cx - 7.5, G - 25 - b, SADDLE[2]); B3.rect(cx + 7.5, G - 32 - b, cx + 9, G - 25 - b, SADDLE[1])
        back = [B0, B1, B2, B3]
        F1 = Part(w, h); F1.blob(cx, G - 24 - b, 7.6, 6.6, R, 0.6)
        F2 = Part(w, h); tailfan(F2, G - 24 - b, G + 1, 12)
        front = [F1, F2]
        seat = (cx, G - 33 - b)
    return back, front, seat

def dragon(name, view, k, n, moving, w, h, G, cx, flapf):
    p = P[name]; R = ramp(p['body']); Bl = ramp(p['belly']); Hn = ramp(p['horn'])
    b, lift, nod = gait(k, n, moving); lf, rf, lh, rh = lift
    fl, ex = flapf; claw = (230, 220, 190)
    def leg(part, x, top, bot, wd, RR):
        part.blob(x, top + 3, wd * 0.75, 4, RR, 0.5); part.leg(x, top + 3, bot, wd, RR, RR[0])
        for d in (-1, 0, 1): part.px(x + d * 1.2, bot, claw)
    def tail_side(part, sway):
        pts = [(cx + 6 + t * 12, G - 10 - math.sin(t * 3.2) * 4 + t * 6 + sway * t) for t in [i / 12 for i in range(13)]]
        for i, (x, y) in enumerate(pts): part.ell(x, y, 3 - i * 0.18, 2.6 - i * 0.15, R[1] if i % 2 else R[2])
        x, y = pts[-1]; part.poly([(x, y - 2), (x + 4, y), (x, y + 2)], R[1])
    sy = G - 35 - b
    if view == 'down':
        B0 = Part(w, h); tail_side(B0, math.sin(2 * math.pi * k / n) * 2)
        B1 = Part(w, h); wings(B1, cx, sy, 27, fl, ex, 'dragon', p)
        B2 = Part(w, h)
        for sgn, lt in ((-1, lh), (1, rh)): leg(B2, cx + sgn * 6, G - 20 - b, G - 3 - lt, 4, ramp(shade(R[2], -0.15)))
        B3 = Part(w, h); B3.blob(cx, G - 27 - b, 9.5, 8.5, R)
        for yy in range(int(G - 34 - b), int(G - 20 - b), 2):
            for xx in range(int(cx - 8), int(cx + 9), 3): B3.px(xx + (yy % 4 == 0), yy, R[1])
        B3.rect(cx - 9.5, G - 31 - b, cx - 8, G - 24 - b, SADDLE[2]); B3.rect(cx + 8, G - 31 - b, cx + 9.5, G - 24 - b, SADDLE[1])
        back = [B0, B1, B2, B3]
        F1 = Part(w, h); F1.blob(cx, G - 21 - b, 6.6, 6.4, R)
        for i in range(4): F1.rect(cx - 3 + abs(i - 1.5) * 0.3, G - 26 - b + i * 2.6, cx + 3 - abs(i - 1.5) * 0.3, G - 25 - b + i * 2.6, Bl[2 if i % 2 else 3])
        F2 = Part(w, h)
        for sgn, lt in ((-1, lf), (1, rf)): leg(F2, cx + sgn * 5, G - 15 - b, G - lt, 3.6, R)
        F3 = Part(w, h); hy = G - 31 - b + nod
        for sgn in (-1, 1):   # sừng vuốt ngược ra sau
            F3.line([(cx + sgn * 2.5, hy - 2.5), (cx + sgn * 5, hy - 7), (cx + sgn * 6.5, hy - 9)], Hn[2], 2); F3.px(cx + sgn * 6.5, hy - 9, Hn[4])
            F3.poly([(cx + sgn * 4, hy), (cx + sgn * 7.5, hy - 1.5), (cx + sgn * 4.5, hy + 2)], ramp(p['memb'])[2])   # vây tai
        F3.blob(cx, hy + 3.5, 4, 3.4, R, 0.4); F3.blob(cx, hy, 4.6, 4, R)
        F3.blob(cx, hy + 3.4, 3.2, 2.4, ramp(shade(R[2], 0.12)), 0.5)
        F3.px(cx - 1.3, hy + 4.4, R[0]); F3.px(cx + 1.3, hy + 4.4, R[0])
        for sgn in (-1, 1): F3.px(cx + sgn * 3, hy - 0.8, (255, 210, 60)); F3.px(cx + sgn * 3, hy - 0.2, (120, 40, 10))
        front = [F1, F2, F3]
        seat = (cx, G - 34 - b)
    else:
        B0 = Part(w, h); hy = G - 39 - b + nod
        for sgn in (-1, 1): B0.line([(cx + sgn * 2.5, hy - 1.5), (cx + sgn * 5, hy - 6), (cx + sgn * 6, hy - 8)], Hn[2], 2)
        B0.blob(cx, hy + 3, 3.6, 4, R, 0.4); B0.blob(cx, hy, 4.2, 3.6, R, 0.5)
        for i in range(3): B0.px(cx, hy - 2 + i * 2, ramp(p['memb'])[2])
        B1 = Part(w, h); wings(B1, cx, sy, 27, fl, ex, 'dragon', p)
        B2 = Part(w, h)
        for sgn, lt in ((-1, lf), (1, rf)): leg(B2, cx + sgn * 5, G - 18 - b, G - 3 - lt, 3.6, ramp(shade(R[2], -0.15)))
        B3 = Part(w, h); B3.blob(cx, G - 27 - b, 9.5, 8.5, R)
        B3.rect(cx - 9.5, G - 31 - b, cx - 8, G - 24 - b, SADDLE[2]); B3.rect(cx + 8, G - 31 - b, cx + 9.5, G - 24 - b, SADDLE[1])
        back = [B0, B1, B2, B3]
        F1 = Part(w, h)
        for sgn, lt in ((-1, lh), (1, rh)): leg(F1, cx + sgn * 6, G - 17 - b, G - lt, 4.4, R)
        F2 = Part(w, h)
        for sgn in (-1, 1): F2.blob(cx + sgn * 4.4, G - 23 - b, 5.6, 6.6, R, 0.7)
        for yy in range(int(G - 29 - b), int(G - 17 - b), 2):
            for xx in range(int(cx - 9), int(cx + 9), 3): F2.px(xx + (yy % 4 == 0), yy, R[1])
        F3 = Part(w, h); sw = math.sin(2 * math.pi * k / n) * (3 if moving else 1)
        pts = [(cx + sw * t * t + math.sin(t * 2.6) * 3 * t, G - 26 - b + t * (25 + b)) for t in [i / 14 for i in range(15)]]
        for i, (x, y) in enumerate(pts):
            F3.ell(x, y, 3.6 - i * 0.17, 2.4, R[1] if i % 2 else R[2])
            if i % 2 == 0 and i < 13: F3.poly([(x - 1, y - 1), (x + 1, y - 1), (x, y - 3)], ramp(p['memb'])[2])
        x, y = pts[-1]; F3.poly([(x - 3, y), (x + 3, y), (x, y + 3)], R[1])
        front = [F1, F2, F3]
        seat = (cx, G - 33 - b)
    return back, front, seat

# ======================= ghép vào sheet =======================
def build(name):
    meta = json.load(open(OUT + 'mounts.json')); per = meta['per'][name]
    cw, ch = per['cell']; NI = per['frames']['idle'][1]; NT = NI + per['frames']['run'][1]
    sheet0 = Image.open(OUT + 'mounts/' + name + '.png').convert('RGBA').crop((0, 0, cw * NT, ch))
    gw, gh = -(-cw // PX), -(-ch // PX); G = gh - 2; cx = gw // 2
    kind = P[name]['kind']
    sheet = Image.new('RGBA', (cw * NT, ch * 5)); sheet.alpha_composite(sheet0, (0, 0))
    seats = {'down': [], 'up': []}
    for col in range(NT):
        moving = col >= NI; k = col - NI if moving else col; n = NT - NI if moving else NI
        for vi, view in enumerate(('down', 'up')):
            if kind == 'turtle': bk, fr, seat = turtle(name, view, k, n, moving, gw, gh, G, cx)
            elif kind in ('bird', 'dragon'):
                ff = (RUN_FLAP[k % 6] if moving else IDLE_FLAP[k % 4])
                fn = bird if kind == 'bird' else dragon
                bk, fr, seat = fn(name, view, k, n, moving, gw, gh, G, cx, ff)
            else: bk, fr, seat = quad(name, view, k, n, moving, gw, gh, G, cx)
            for li, parts in enumerate((bk, fr)):
                im = stack(parts, gw, gh).resize((gw * PX, gh * PX), Image.NEAREST).crop((0, 0, cw, ch))
                sheet.alpha_composite(im, (col * cw, ch * (1 + vi * 2 + li)))
            seats[view].append([round((seat[0] + 0.5) * PX, 1), round(seat[1] * PX, 1)])
    sheet.save(OUT + 'mounts/' + name + '.png')
    per['rows'] = {'side': [0], 'down': [1, 2], 'up': [3, 4]}
    per['footFB'] = [cx * PX + PX / 2, G * PX + PX - 1]
    meta['seats'][name]['down'] = seats['down']; meta['seats'][name]['up'] = seats['up']
    json.dump(meta, open(OUT + 'mounts.json', 'w'))
    return sheet, (cw, ch, NT)

if __name__ == '__main__':
    import sys
    names = sys.argv[1:] or [k for k in P if k != 'hac_ma']   # Hắc Mã có ảnh 4 hướng riêng: hacma.py
    for nm in names:
        build(nm); print('ok', nm)
