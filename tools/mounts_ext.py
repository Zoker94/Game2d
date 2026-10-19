# Thú cưỡi dáng riêng (không dùng khung ngựa): Thanh Long (rồng uốn lượn, 4 chân ngắn có vuốt), Phượng Hoàng (chim bay),
# Kim Quy (rùa vàng), Kim Ngưu (trâu vàng). Cùng quy ước với tools/mounts.py:
#   side(kind, i) -> (ảnh, điểm yên)            : nhìn ngang quay phải, mặt đất GY
#   fb(view, kind, i) -> (lớp sau, lớp trước, yên) : nhìn xuống ('down') / nhìn lên ('up'), mặt đất FB_GY
# Lớp sau vẽ trước người cưỡi, lớp trước vẽ đè lên.
import math
from mounts import Part, compose, bez, hx, dark, light, CW, CH, GY, FB_GY, DEPTH, TAU, fore_angles, hind_angles, limb

def rotp(p, a, s=1.0, o=(0, 0), flip=1):
    x, y = p[0] * flip, p[1]
    ca, sa = math.cos(a), math.sin(a)
    return (o[0] + (x * ca - y * sa) * s, o[1] + (x * sa + y * ca) * s)

# =====================================================================
# Đầu rồng (nhìn ngang, quay phải). Gốc toạ độ ở gáy.
# =====================================================================
def dragon_head_side(T, C, ph, horn=True):
    """T: hàm đổi toạ độ cục bộ -> ô ảnh. C: bảng màu. ph: pha hoạt ảnh (râu, bờm bay)"""
    parts = []
    sw = math.sin(ph) * 1.6
    # bờm sau gáy (lớp sau cùng)
    mn = Part('h', dark(C['mane'], 0.5))
    for k, (a, b, c) in enumerate((((2, -8), (-8, -14 + sw), (-16, -12 + sw)), ((0, -2), (-10, -2 + sw), (-19, 2 + sw)), ((2, 4), (-6, 9 + sw), (-14, 13 + sw)))):
        mn.curve([T(a), T(b), T(c)], 5.2 - k * 0.6, 1.2, C['mane'], 8)
    parts.append(mn)
    if horn:   # sừng phía xa (tối hơn)
        hf = Part('h', dark(C['horn'], 0.55))
        hf.curve([T((12, -11)), T((6, -20)), T((-2, -26))], 2.6, 1.2, dark(C['horn'], 0.3), 6)
        parts.append(hf)
    # hàm dưới (há)
    lj = Part('v', dark(C['coat'], 0.5))
    lj.poly([T(p) for p in ((9, 3), (18, 4.5), (26, 7), (31, 10), (30, 12.5), (21, 11.5), (12, 10), (6, 7))], C['coat'])
    lj.mark(lambda s: s.poly([T(p) for p in ((12, 9.5), (21, 11), (29, 12), (29, 13), (20, 12.8), (11, 11))], C['belly']))
    parts.append(lj)
    # miệng trong + lưỡi + răng
    mo = Part(None, None, rim=False)
    mo.poly([T(p) for p in ((9, 2.5), (20, 0.5), (32, -0.5), (30.5, 9.5), (25, 6.5), (17, 4))], '#4a0a10')
    mo.curve([T((14, 5)), T((22, 6)), T((28, 3))], 1.8, 1.2, '#e0405a', 5)
    for x in (22, 26, 30):
        mo.poly([T((x, 0)), T((x + 1.6, -0.2)), T((x + 0.8, 2.8))], '#fff8ee')
    for x in (18, 23, 27):
        mo.poly([T((x, 9)), T((x + 1.5, 9.5)), T((x + 0.5, 6.6))], '#fff8ee')
    parts.append(mo)
    # sọ + mõm trên
    up = Part('v', dark(C['coat'], 0.5))
    up.poly([T(p) for p in ((0, -6), (5, -10.5), (11, -12.5), (15, -12), (18, -10), (24, -9), (30, -9), (33.5, -7), (34.5, -3.5), (33, -0.5), (24, 0.5), (15, 2.5), (8, 4.5), (2, 4))], C['coat'])
    up.ell(*T((31, -7)), 3.4, 2.8, light(C['coat'], 0.1))   # mũi gồ
    up.ell(*T((10, -1)), 6.5, 5.5, C['coat'])                # má
    def hm(s):
        e = T((17, -6.5))
        s.ell(e[0], e[1], 2.2, 1.6, C['eye']); s.rect(e[0], e[1] - 1, e[0], e[1] + 1, '#200404'); s.rect(e[0] - 1, e[1] - 1, e[0] - 1, e[1] - 1, '#ffffff')
        br = [T((12, -9)), T((15, -12)), T((18, -9.5)), T((21, -12)), T((23, -9))]   # mày lửa
        for a, b in zip(br, br[1:]): s.ln(a, b, C['mane'])
        ns = T((32, -6.5)); s.rect(ns[0], ns[1], ns[0], ns[1], '#200404')
        for k in range(4):   # vảy trên mõm
            a = T((20 + k * 3.4, -8.6)); s.ln(a, (a[0] + 1.5, a[1] + 1), dark(C['coat'], 0.35))
        for k in range(3):   # vảy má
            a = T((5 + k * 3, -3 + k)); s.ln(a, (a[0] + 2, a[1] + 1.5), dark(C['coat'], 0.3))
    up.mark(hm)
    parts.append(up)
    # râu dưới cằm
    bd = Part('h', dark(C['mane'], 0.5))
    bd.curve([T((12, 10)), T((9, 15 + sw * 0.5)), T((4, 19 + sw))], 3.6, 1, C['mane'], 6)
    bd.curve([T((18, 11.5)), T((16, 16)), T((12, 21 + sw))], 2.6, 0.8, light(C['mane'], 0.1), 6)
    parts.append(bd)
    if horn:   # sừng nhánh phía gần
        hn = Part('h', dark(C['horn'], 0.55))
        hn.curve([T((9, -11)), T((2, -19)), T((-8, -24))], 3.2, 1.4, C['horn'], 8)
        hn.curve([T((1, -19)), T((2, -25)), T((5, -29))], 2, 0.9, C['horn'], 5)
        parts.append(hn)
    # râu dài
    wk = Part(None, None, rim=False)
    wk.curve([T((33, -3)), T((40, -7 + sw)), T((45, -2 + sw)), T((47, 6 + sw))], 1.6, 0.8, light(C['mane'], 0.2), 10)
    wk.curve([T((29, 1)), T((35, 8 - sw)), T((32, 15 - sw)), T((27, 20 - sw))], 1.5, 0.8, light(C['mane'], 0.2), 10)
    parts.append(wk)
    return parts


def dragon_face_front(hc, C, ph, k=1.0):
    """mặt rồng nhìn thẳng (hướng về người xem): bờm toả, sừng nhánh, mắt, mõm há, râu"""
    hp = []
    sw = math.sin(ph) * 1.5
    mn = Part('h', dark(C['mane'], 0.5))
    for j in range(7):
        a = math.pi * (0.15 + j * 0.7 / 6) + math.pi
        mn.curve([(hc[0] + math.cos(a) * 6 * k, hc[1] + math.sin(a) * 6 * k), (hc[0] + math.cos(a) * 13 * k, hc[1] + math.sin(a) * 12 * k + sw), (hc[0] + math.cos(a) * 16 * k, hc[1] + math.sin(a) * 16 * k + sw)], 4 * k, 1, C['mane'], 6)
    hp.append(mn)
    hr = Part('h', dark(C['horn'], 0.55))
    for sx_ in (-1, 1):
        hr.curve([(hc[0] + sx_ * 4 * k, hc[1] - 6 * k), (hc[0] + sx_ * 9 * k, hc[1] - 14 * k), (hc[0] + sx_ * 7 * k, hc[1] - 22 * k)], 3 * k, 1.2, C['horn'], 7)
        hr.curve([(hc[0] + sx_ * 8 * k, hc[1] - 13 * k), (hc[0] + sx_ * 13 * k, hc[1] - 16 * k)], 2 * k, 0.8, C['horn'], 3)
    hp.append(hr)
    fc = Part('v', dark(C['coat'], 0.5))
    fc.ell(hc[0], hc[1], 8.5 * k, 7 * k, C['coat'])
    fc.poly([(hc[0] - 7 * k, hc[1] + 1), (hc[0] + 7 * k, hc[1] + 1), (hc[0] + 5.5 * k, hc[1] + 10 * k), (hc[0] - 5.5 * k, hc[1] + 10 * k)], C['coat'])
    fc.ell(hc[0], hc[1] + 10 * k, 6 * k, 3.5 * k, light(C['coat'], 0.1))
    def fm(d):
        for sx_ in (-1, 1):
            e = (hc[0] + sx_ * 4.5 * k, hc[1] - 1)
            d.ell(e[0], e[1], 2, 1.4, C['eye']); d.rect(e[0], e[1] - 1, e[0], e[1] + 1, '#200404')
            d.ln((hc[0] + sx_ * 2 * k, hc[1] - 4 * k), (hc[0] + sx_ * 7 * k, hc[1] - 3 * k), C['mane'])
            d.rect(hc[0] + sx_ * 2 * k, hc[1] + 9 * k, hc[0] + sx_ * 2 * k, hc[1] + 9 * k, '#200404')
        m0 = hc[1] + 12 * k
        d.poly([(hc[0] - 5 * k, m0), (hc[0] + 5 * k, m0), (hc[0] + 3.5 * k, m0 + 4 * k), (hc[0] - 3.5 * k, m0 + 4 * k)], '#4a0a10')
        for j in (-3, -1, 1, 3): d.rect(hc[0] + j * k, m0, hc[0] + j * k, m0 + 1, '#ffffff')
        d.ell(hc[0], m0 + 3 * k, 2.2 * k, 1, '#e0405a')
    fc.mark(fm)
    hp.append(fc)
    wk = Part(None, None, rim=False)
    for sx_ in (-1, 1):
        a = (hc[0] + sx_ * 5 * k, hc[1] + 9 * k)
        wk.curve([a, (a[0] + sx_ * 9 * k, a[1] - 1 + sw), (a[0] + sx_ * 15 * k, a[1] + 6 * k + sw), (a[0] + sx_ * 13 * k, a[1] + 13 * k)], 1.5, 0.8, light(C['mane'], 0.2), 8)
    bd = Part('h', dark(C['mane'], 0.5))
    bd.curve([(hc[0], hc[1] + 16 * k), (hc[0] - 1, hc[1] + 21 * k), (hc[0] + 1 + sw, hc[1] + 25 * k)], 3 * k, 1, C['mane'], 5)
    return hp + [wk, bd]

def dragon_head_back(hc, C, ph, k=1.0):
    """đầu rồng nhìn từ sau: gáy, sừng, bờm rủ, râu hai bên"""
    hp = Part('v', dark(C['coat'], 0.5))
    hp.ell(hc[0], hc[1], 7.5 * k, 7 * k, C['coat'])
    hr = Part('h', dark(C['horn'], 0.55))
    for sx_ in (-1, 1):
        hr.curve([(hc[0] + sx_ * 3 * k, hc[1] - 4 * k), (hc[0] + sx_ * 8 * k, hc[1] - 12 * k), (hc[0] + sx_ * 6 * k, hc[1] - 19 * k)], 3 * k, 1.2, C['horn'], 6)
    mn = Part('h', dark(C['mane'], 0.5))
    for j in range(5):
        x = (j - 2) * 3 * k
        mn.curve([(hc[0] + x, hc[1] - 2), (hc[0] + x * 1.6, hc[1] + 6 * k), (hc[0] + x * 2, hc[1] + 12 * k)], 3 * k, 1, C['mane'], 5)
    wk = Part(None, None, rim=False)
    sw = math.sin(ph) * 1.5
    for sx_ in (-1, 1):
        wk.curve([(hc[0] + sx_ * 6 * k, hc[1] + 2), (hc[0] + sx_ * 14 * k, hc[1] + sw), (hc[0] + sx_ * 18 * k, hc[1] + 6 * k + sw)], 1.4, 0.8, light(C['mane'], 0.2), 6)
    return [wk, hr, hp, mn]

# =====================================================================
# THANH LONG – rồng uốn lượn bay lơ lửng (không chân)
# =====================================================================
LONG = dict(coat='#1f9a86', belly='#f2dc96', mane='#9ef2ff', horn='#fff0c0', eye='#ffd23a', fin='#5ad8e8', cloud='#e8fbff', cloud2='#a8dce8',
            blanket='#123a5a', trim='#ffd860', saddle='#0a2a3a')

def long_spine(kind, i, n=46):
    ph = (i / 6 * TAU) if kind == 'run' else (i * 0.9)
    amp_k = 1.0 if kind == 'run' else 0.7
    pts, rad = [], []
    for k in range(n):
        s = k / (n - 1)
        x = 90 - 86 * s
        y = 64 + (2 + 10 * s) * amp_k * math.sin(TAU * 1.15 * s - ph) - (1 - s) ** 6 * 8
        pts.append((x, y)); rad.append(8.6 * (1 - s) ** 0.85 + 1.4)
    return pts, rad, ph

def dragon_leg(C, base, ang, near, k=1.0):
    """chân rồng ngắn: đùi to, cẳng ngắn, bàn 4 vuốt xòe. ang: góc cẳng so với phương thẳng đứng (dương = chĩa về trước)"""
    col = C['coat'] if near else dark(C['coat'], 0.3)
    lg = Part('v', dark(C['coat'], 0.55))
    knee = (base[0] + math.sin(ang * 0.4) * 3 * k, base[1] + 6.5 * k)
    foot = (knee[0] + math.sin(ang) * 6 * k, knee[1] + math.cos(ang) * 5 * k)
    lg.cap(base, knee, 6.2 * k, col, 4.6 * k)
    lg.cap(knee, foot, 4.4 * k, col, 3.4 * k)
    lg.ell(knee[0] - 1.2 * k, knee[1], 2.4 * k, 1.4 * k, C['mane'] if near else dark(C['mane'], 0.3))   # túm lông khuỷu
    cl = C['horn'] if near else dark(C['horn'], 0.25)
    fa = ang + math.pi / 2
    for j in range(4):   # vuốt cong xòe ra trước
        a = fa - 0.9 + j * 0.5
        tip = (foot[0] + math.sin(a) * 3.6 * k, foot[1] - math.cos(a) * 3.6 * k + 1.5 * k)
        lg.cap(foot, tip, 1.8 * k, cl, 0.8 * k)
    return lg

def long_side(kind, i):
    C = LONG
    pts, rad, ph = long_spine(kind, i)
    bob = math.sin(ph * (1 if kind == 'run' else 1)) * 1.2
    pts = [(x, y + bob) for x, y in pts]
    parts = []
    # mây dưới thân
    cl = Part('v', dark(C['cloud2'], 0.35), rim=False)
    drift = (i * 4) % 24 if kind == 'run' else i
    for (cx, cy, r) in ((70 - drift, 96, 6), (60 - drift, 99, 8), (48 - drift, 97, 6), (30 - drift * 0.6, 92, 5), (22 - drift * 0.6, 95, 6), (92 - drift, 99, 5)):
        cl.ell(cx, cy, r * 1.4, r * 0.75, C['cloud'])
    parts.append(cl)
    # vây lưng (sau thân)
    fins = Part('h', dark(C['fin'], 0.5))
    for k in range(4, len(pts) - 4, 4):
        (x, y), r = pts[k], rad[k]
        a, b = pts[k - 1], pts[k + 1]
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        nx, ny = math.sin(ang), -math.cos(ang)   # pháp tuyến hướng lên
        base0 = (x - nx * r * 0.6, y - abs(ny) * r * 0.85)
        tip = (base0[0] + 3.5 + nx * 2, base0[1] - 3.2 - r * 0.35)
        fins.poly([(base0[0] - 2.5, base0[1] + 1), tip, (base0[0] + 2.8, base0[1] + 1.5)], C['fin'])
    parts.append(fins)
    # 4 chân ngắn: chân trước sau cổ, chân sau giữa thân; khi bay chân khua như bơi trong mây
    run = kind == 'run'
    legs = []
    for kk, ph0, fore in ((6, 0.0, True), (22, 2.2, False)):
        (x, y), r = pts[kk], rad[kk]
        sw = math.sin(ph + ph0) * (0.55 if run else 0.18)
        base_a = 0.7 if fore else -0.35
        legs.append(((x + 2.5, y + r * 0.35), base_a + sw, False, r))           # chân phía xa
        legs.append(((x - 1.5, y + r * 0.45), base_a - sw * 0.9 + 0.15, True, r))   # chân phía gần
    for b, a, nr, r in legs:
        if not nr: parts.append(dragon_leg(C, b, a, False, 0.85 + r / 40))
    # chóp đuôi như ngọn lửa
    tl = Part('h', dark(C['fin'], 0.5))
    tx, ty = pts[-1]
    tw = math.sin(ph + 1) * 2
    for k, (dx, dy) in enumerate(((-7, -6), (-9, 0), (-6, 6))):
        tl.curve([(tx + 1, ty), (tx + dx * 0.5, ty + dy * 0.5 + tw), (tx + dx, ty + dy + tw)], 3.2 - k * 0.4, 0.8, C['fin'] if k != 1 else light(C['fin'], 0.25), 6)
    parts.append(tl)
    # thân
    body = Part('v', dark(C['coat'], 0.55))
    for (x, y), r in zip(pts[::-1], rad[::-1]): body.ell(x, y, r, r, C['coat'])
    def bm(s):
        for k in range(1, len(pts) - 2):   # bụng vàng có vạch
            (x, y), r = pts[k], rad[k]
            s.ell(x, y + r * 0.55, r * 0.72, r * 0.42, C['belly'])
            if k % 2 == 0: s.ln((x - r * 0.5, y + r * 0.62), (x + r * 0.5, y + r * 0.62), dark(C['belly'], 0.3))
        for k in range(2, len(pts) - 3, 2):   # vảy
            (x, y), r = pts[k], rad[k]
            if r < 3: continue
            for row in (-0.35, 0.05):
                c = (x + (k % 4) * 0.6, y + r * row)
                s.d.arc([round(c[0] - 2), round(c[1] - 1.6), round(c[0] + 2), round(c[1] + 1.6)], 20, 160, fill=hx(dark(C['coat'], 0.35)))
    body.mark(bm)
    parts.append(body)
    for b, a, nr, r in legs:
        if nr: parts.append(dragon_leg(C, b, a, True, 0.9 + r / 40))
    # yên nhỏ (đệm gấm)
    sk = 9
    sx, sy = pts[sk]; r = rad[sk]
    tk = Part('v', dark(C['blanket'], 0.5))
    tk.poly([(sx - 8, sy - r + 1), (sx + 8, sy - r + 0.5), (sx + 9, sy + 1), (sx - 9, sy + 1.5)], C['blanket'])
    tk.mark(lambda s: [s.ln((sx - 9, sy + 1.5), (sx + 9, sy + 1), C['trim'], 1)])
    parts.append(tk)
    sd = Part('v', dark(C['saddle'], 0.5))
    sd.poly([(sx - 6, sy - r - 2), (sx - 3, sy - r + 1), (sx + 4, sy - r + 1), (sx + 7, sy - r - 3), (sx + 8, sy - r - 1), (sx + 6, sy - r + 3), (sx - 6, sy - r + 3), (sx - 8, sy - r)], C['saddle'])
    parts.append(sd)
    seat = (sx, sy - r - 0.5)
    # cổ + đầu
    hx0, hy0 = pts[0]
    ang = -0.18 + math.sin(ph + 0.6) * 0.06
    o = (hx0 + 3, hy0 - 9)
    nk = Part('v', dark(C['coat'], 0.55))
    for k in range(6):
        t = k / 5
        nk.ell(hx0 + 1 + t * 4, hy0 - t * 7, 8 - t * 1.2, 8 - t * 1.2, C['coat'])
    parts.append(nk)
    parts += dragon_head_side(lambda p: rotp(p, ang, 1.05, o), C, ph)
    return compose(parts), (round(seat[0], 1), round(seat[1], 1))

def long_fb(view, kind, i):
    C = LONG
    down = view == 'down'
    ph = (i / 6 * TAU) if kind == 'run' else (i * 0.9)
    bob = math.sin(ph) * 1.2
    def P(x, f, u):
        return (CW / 2 - x, FB_GY - u + f * DEPTH) if down else (CW / 2 + x, FB_GY - u - f * DEPTH)
    near = (lambda f: f) if down else (lambda f: -f)
    # thân: từ đầu (f lớn) uốn ra xa (f âm)
    secs = []
    n = 26
    for k in range(n):
        s = k / (n - 1)
        f = 26 - 78 * s
        x = (3 + 12 * s) * math.sin(TAU * 1.1 * s - ph)
        u = 40 + (2 + 6 * s) * math.sin(TAU * 1.3 * s - ph + 1) + bob + s * 14
        r = 9.2 * (1 - s) ** 0.8 + 1.6
        secs.append((s, x, f, u, r))
    seat_f = 14
    seat_s = (26 - seat_f) / 78
    back, front = [], []
    cl = Part('v', dark(C['cloud2'], 0.35), rim=False)
    dr = (i * 3) % 12 if kind == 'run' else 0
    for (x, f, r) in ((-10, 18 - dr, 7), (8, 10 - dr, 8), (-4, 0 - dr, 6), (12, -12 - dr, 5)):
        c = P(x, f, 8); cl.ell(c[0], c[1], r * 1.5, r * 0.7, C['cloud'])
    back.append(cl)
    def body_part(sel):
        bp = Part('v', dark(C['coat'], 0.55))
        fp = Part('h', dark(C['fin'], 0.5))
        for s, x, f, u, r in sorted(sel, key=lambda z: near(z[2])):
            c = P(x, f, u)
            top = P(x, f, u + r)
            fp.poly([(top[0] - 2.5, top[1] + 2), (top[0], top[1] - 3.5 - r * 0.2), (top[0] + 2.5, top[1] + 2)], C['fin'])
            bp.ell(c[0], c[1], r, r * 0.92, C['coat'])
        def bm(d):
            for s, x, f, u, r in sorted(sel, key=lambda z: near(z[2])):
                if r < 3: continue
                c = P(x, f, u)
                if down:
                    d.d.arc([round(c[0] - r * 0.55), round(c[1] - r * 0.4), round(c[0] + r * 0.55), round(c[1] + r * 0.25)], 20, 160, fill=hx(dark(C['coat'], 0.35)))
                else:
                    d.ln((c[0], c[1] - r * 0.7), (c[0], c[1] - r * 0.2), dark(C['coat'], 0.3))
        bp.mark(bm)
        return [fp, bp]
    tail_s = secs[-1]
    tl = Part('h', dark(C['fin'], 0.5))
    tc = P(tail_s[1], tail_s[2], tail_s[3])
    tw = math.sin(ph + 1) * 2
    for k, dx in enumerate((-6, 0, 6)):
        tl.curve([tc, (tc[0] + dx * 0.6 + tw, tc[1] - 4), (tc[0] + dx + tw, tc[1] - 8 + abs(dx) * 0.3)], 3 - abs(dx) * 0.2, 0.8, C['fin'], 5)
    # chân: 2 đôi chìa ra hai bên thân (đôi trước gần đầu, đôi sau giữa thân)
    def leg_pair(s0, ph0):
        z = min(secs, key=lambda q: abs(q[0] - s0))
        _, x, f, u, r = z
        out = []
        sw = math.sin(ph + ph0) * (2.2 if kind == 'run' else 0.7)
        for side in (-1, 1):
            b = P(x + side * r * 0.75, f, u - r * 0.25)
            c = P(x + side * (r + 3.5), f + sw * side, u - r - 3)
            lg = Part('v', dark(C['coat'], 0.55))
            lg.cap(b, c, 5.6, C['coat'], 4.2)
            lg.ell(c[0], c[1] + 1, 3, 1.8, C['coat'])
            for j in range(4):
                tx = c[0] + (j - 1.5) * 1.7
                lg.cap((tx, c[1] + 1.5), (tx + (j - 1.5) * 0.6, c[1] + 4.2), 1.5, C['horn'], 0.7)
            out.append(lg)
        return out
    foreL, hindL = leg_pair(0.12, 0.0), leg_pair(0.45, 2.2)
    if down:
        back += [tl] + hindL + body_part(secs)
        front += foreL
    else:
        far = [z for z in secs if z[0] <= seat_s + 0.08]
        nr = [z for z in secs if z[0] > seat_s + 0.08]
        back += foreL + body_part(far)
        front += [tl] + hindL + body_part(nr)
    # yên
    ss = min(secs, key=lambda z: abs(z[0] - seat_s))
    sc = P(ss[1], ss[2], ss[3] + ss[4])
    tk = Part('v', dark(C['blanket'], 0.5))
    tk.poly([(sc[0] - 11, sc[1] + 1), (sc[0] + 11, sc[1] + 1), (sc[0] + 10, sc[1] + 9), (sc[0] - 10, sc[1] + 9)], C['blanket'])
    tk.mark(lambda d: [d.ln((sc[0] - 10, sc[1] + 9), (sc[0] + 10, sc[1] + 9), C['trim'], 1)])
    sd = Part('v', dark(C['saddle'], 0.5))
    sd.ell(sc[0], sc[1], 7, 3.4, C['saddle'])
    back += [tk, sd]
    seat = (sc[0], sc[1] - 1)
    # đầu
    h = secs[0]
    if down:
        front += dragon_face_front(P(h[1], h[2] + 8, h[3] + 4), C, ph)
    else:
        back = dragon_head_back(P(h[1], h[2] + 6, h[3] + 8), C, ph) + back
    return compose(back), compose(front), (round(seat[0], 1), round(seat[1], 1))


# =====================================================================
# PHƯỢNG HOÀNG – chim lửa bay lượn, đuôi dài có mắt lông
# =====================================================================
PHX = dict(body='#d42a24', belly='#ffb43a', wing='#e8401c', prim='#ff9a20', tip='#ffe27a', crest='#ffcf40', beak='#ffd060', eye='#ffffff',
           eyespot='#2ad0c0', tail1='#ff5a1a', tail2='#ffb020', blanket='#5a0a2a', trim='#ffd860', saddle='#3a0a18')

def feather_fan(part, root, ang, n, length, spread, w0, cols, curl=0.25):
    """quạt lông vũ: n lông tỏa từ gốc theo góc ang (radian)"""
    for k in range(n):
        t = k / max(1, n - 1)
        a = ang + (t - 0.5) * spread
        L = length * (0.72 + 0.28 * math.sin(math.pi * t))
        tip = (root[0] + math.cos(a) * L, root[1] + math.sin(a) * L)
        mid = (root[0] + math.cos(a - curl) * L * 0.55, root[1] + math.sin(a - curl) * L * 0.55)
        part.curve([root, mid, tip], w0, 1.2, cols[k % len(cols)], 8)

def wing_side(C, sh, theta, far):
    """cánh nhìn ngang: gốc vai sh, góc theta (rad, -pi/2 là thẳng lên)"""
    k = 0.72 if far else 1.0
    col = (lambda c: dark(c, 0.35)) if far else (lambda c: hx(c))
    arm = (sh[0] + math.cos(theta) * 14, sh[1] + math.sin(theta) * 14)
    wp = Part('h', dark(C['wing'], 0.5))
    feather_fan(wp, arm, theta - 0.55, 7, 26 * k + 4, 1.1, 4.2, [col(C['prim']), col(C['tip']), col(C['prim'])], 0.3)
    feather_fan(wp, ((sh[0] + arm[0]) / 2, (sh[1] + arm[1]) / 2), theta - 0.95, 5, 15, 0.8, 4.5, [col(C['wing']), col(C['prim'])], 0.2)
    cv = Part('v', dark(C['wing'], 0.5))
    cv.cap(sh, arm, 9 * k + 1, col(C['wing']), 6 * k + 1)
    cv.mark(lambda d: [d.ln((sh[0] + (arm[0] - sh[0]) * t, sh[1] + (arm[1] - sh[1]) * t), (sh[0] + (arm[0] - sh[0]) * t - 2, sh[1] + (arm[1] - sh[1]) * t + 3), dark(C['wing'], 0.3)) for t in (0.3, 0.55, 0.8)])
    return [wp, cv]

def phx_side(kind, i):
    C = PHX
    run = kind == 'run'
    ph = (i / 6 * TAU) if run else (i * math.pi * 0.5)
    flap = math.sin(ph) * (0.95 if run else 0.35)
    bob = -math.sin(ph) * (2.0 if run else 1.0)
    parts = []
    # đuôi dài (sau cùng)
    tp = Part('h', dark(C['tail1'], 0.5))
    ends = []
    for k in range(5):
        wv = math.sin(ph - 1.2 - k * 0.4) * (3 + k)
        a = (44, 64 + bob)
        b = (28 - k * 3, 66 + k * 4 + bob + wv * 0.5)
        c = (10 - k * 2, 60 + k * 9 + bob + wv)
        tp.curve([a, b, c], 3.8 - k * 0.3, 2.2, [C['tail1'], C['tail2'], C['tail1'], C['tail2'], C['tail1']][k], 10)
        ends.append(c)
    def eyes(d):
        for (x, y) in ends:
            d.ell(x, y, 3.2, 2.6, C['tail2']); d.ell(x, y, 2, 1.6, C['eyespot']); d.rect(x, y, x, y, '#0a2a3a')
    tp.mark(eyes)
    parts.append(tp)
    sh = (66, 54 + bob)
    th = -1.95 - flap
    parts += wing_side(C, (sh[0] + 3, sh[1] - 2), th - 0.15, True)
    # thân
    bp = Part('v', dark(C['body'], 0.5))
    bp.ell(62, 62 + bob, 17, 9.5, C['body'])
    bp.poly([(48, 58 + bob), (40, 63 + bob), (48, 68 + bob)], C['body'])
    bp.mark(lambda d: [d.ell(70, 66 + bob, 9, 4.5, C['belly'])] + [d.d.arc([round(52 + k * 5), round(56 + bob + (k % 2)), round(56 + k * 5), round(59 + bob + (k % 2))], 20, 160, fill=hx(dark(C['body'], 0.35))) for k in range(4)])
    parts.append(bp)
    # móng vàng co dưới bụng
    lg = Part('h', dark(C['beak'], 0.5))
    for dx in (0, 5):
        lg.cap((60 + dx, 69 + bob), (56 + dx, 74 + bob), 2.6, C['beak'], 2)
        lg.ln((56 + dx, 74 + bob), (53 + dx, 75 + bob), C['beak'])
    parts.append(lg)
    # yên
    sx, sy = 58, 53 + bob
    tk = Part('v', dark(C['blanket'], 0.5))
    tk.poly([(sx - 9, sy + 1), (sx + 9, sy), (sx + 10, sy + 7), (sx - 10, sy + 8)], C['blanket'])
    tk.mark(lambda d: [d.ln((sx - 10, sy + 8), (sx + 10, sy + 7), C['trim'])])
    sd = Part('v', dark(C['saddle'], 0.5))
    sd.poly([(sx - 6, sy - 2), (sx - 3, sy + 1), (sx + 4, sy + 1), (sx + 7, sy - 3), (sx + 8, sy - 1), (sx + 6, sy + 3), (sx - 6, sy + 3), (sx - 8, sy)], C['saddle'])
    parts += [tk, sd]
    # cổ + đầu
    nk = Part('h', dark(C['body'], 0.5))
    nk.curve([(74, 58 + bob), (82, 52 + bob), (87, 43 + bob)], 9, 6, C['body'], 8)
    nk.mark(lambda d: [d.ln((78 + k * 2, 55 + bob - k * 3), (80 + k * 2, 56 + bob - k * 3), C['crest']) for k in range(3)])
    parts.append(nk)
    cr = Part('h', dark(C['crest'], 0.5))
    cw = math.sin(ph + 0.8) * 1.5
    for k in range(3):
        cr.curve([(88, 37 + bob), (82 - k * 2, 30 - k * 2 + bob + cw), (72 - k * 4, 30 - k * 4 + bob + cw * 1.5)], 2.6 - k * 0.4, 0.8, [C['crest'], C['tip'], C['tail1']][k], 8)
    parts.append(cr)
    hd = Part('v', dark(C['body'], 0.5))
    hd.ell(89, 41 + bob, 6, 5, C['body'])
    hd.mark(lambda d: [d.ell(90, 40 + bob, 1.8, 1.5, C['eye']), d.rect(91, 40 + bob, 91, 40 + bob, '#1a0404'), d.ln((86, 38 + bob), (92, 37.5 + bob), C['crest'])])
    parts.append(hd)
    bk = Part('h', dark(C['beak'], 0.5))
    bk.poly([(93, 39 + bob), (101, 41 + bob), (99, 44.5 + bob), (94, 44 + bob)], C['beak'])
    bk.mark(lambda d: [d.ln((94, 42.5 + bob), (99, 42.5 + bob), dark(C['beak'], 0.45))])
    parts.append(bk)
    parts += wing_side(C, sh, th, False)
    return compose(parts), (sx, round(sy - 1, 1))

def phx_fb(view, kind, i):
    C = PHX
    down = view == 'down'
    run = kind == 'run'
    ph = (i / 6 * TAU) if run else (i * math.pi * 0.5)
    flap = math.sin(ph) * (0.9 if run else 0.3)
    bob = -math.sin(ph) * (2.0 if run else 1.0)
    def P(x, f, u):
        return (CW / 2 - x, FB_GY - u + f * DEPTH) if down else (CW / 2 + x, FB_GY - u - f * DEPTH)
    back, front = [], []
    # đuôi
    tp = Part('h', dark(C['tail1'], 0.5))
    ends = []
    for k in range(5):
        x = (k - 2) * 7
        wv = math.sin(ph - 1 - k * 0.5) * 3
        a = P(0, -8, 44 + bob); b = P(x * 0.7, -24, 50 + bob + wv * 0.5); c = P(x * 1.3 + wv, -44 + abs(x) * 0.3, 52 + bob - abs(x) * 0.4)
        tp.curve([a, b, c], 3.6, 2.2, [C['tail1'], C['tail2'], C['tail1'], C['tail2'], C['tail1']][k], 10)
        ends.append(c)
    tp.mark(lambda d: [x for (ex, ey) in ends for x in (d.ell(ex, ey, 3.2, 2.6, C['tail2']), d.ell(ex, ey, 2, 1.6, C['eyespot']))])
    # cánh dang hai bên
    wings = []
    for sx_ in (-1, 1):
        root = P(sx_ * 7, 2, 50 + bob)
        dirx = 1 if root[0] > CW / 2 else -1
        tip = (root[0] + dirx * 34, root[1] - 22 * flap - 6)
        arm_end = (root[0] + (tip[0] - root[0]) * 0.6, root[1] + (tip[1] - root[1]) * 0.6)
        base_ang = math.atan2(tip[1] - root[1], tip[0] - root[0])
        wp = Part('h', dark(C['wing'], 0.5))
        feather_fan(wp, arm_end, base_ang + 0.75 * dirx, 8, 27, 1.25, 4.4, [C['prim'], C['tip'], C['prim']], 0.0)
        feather_fan(wp, ((root[0] + arm_end[0]) / 2, (root[1] + arm_end[1]) / 2), base_ang + 1.2 * dirx, 5, 15, 0.9, 4.6, [C['wing'], C['prim']], 0.0)
        cv = Part('v', dark(C['wing'], 0.5))
        cv.cap(root, arm_end, 9, C['wing'], 6)
        wings += [wp, cv]
    bp = Part('v', dark(C['body'], 0.5))
    bp.ell(*P(0, 0, 46 + bob), 11, 10, C['body'])
    bp.mark(lambda d: d.ell(*P(0, 6, 40 + bob), 6, 5, C['belly']) if down else None)
    sc = P(0, -2, 56 + bob)
    tk = Part('v', dark(C['blanket'], 0.5))
    tk.poly([(sc[0] - 10, sc[1] + 1), (sc[0] + 10, sc[1] + 1), (sc[0] + 9, sc[1] + 8), (sc[0] - 9, sc[1] + 8)], C['blanket'])
    sd = Part('v', dark(C['saddle'], 0.5))
    sd.ell(sc[0], sc[1], 7, 3.4, C['saddle'])
    seat = (sc[0], sc[1] - 1)
    hc = P(0, 16, 52 + bob) if down else P(0, 14, 58 + bob)
    head = []
    nk = Part('h', dark(C['body'], 0.5)); nk.cap(P(0, 6, 50 + bob), hc, 8, C['body'], 6)
    cr = Part('h', dark(C['crest'], 0.5))
    cw = math.sin(ph + 0.8) * 1.5
    for k, x in enumerate((-4, 0, 4)):
        cr.curve([(hc[0] + x * 0.4, hc[1] - 4), (hc[0] + x, hc[1] - 12 + cw), (hc[0] + x * 1.8, hc[1] - 18 + cw)], 2.4, 0.8, [C['crest'], C['tip'], C['crest']][k], 6)
    hd = Part('v', dark(C['body'], 0.5)); hd.ell(hc[0], hc[1], 5.5, 5, C['body'])
    if down:
        hd.mark(lambda d: [d.ell(hc[0] + sx_ * 3, hc[1] - 1, 1.5, 1.3, C['eye']) for sx_ in (-1, 1)] + [d.rect(hc[0] + sx_ * 3, hc[1] - 1, hc[0] + sx_ * 3, hc[1] - 1, '#1a0404') for sx_ in (-1, 1)])
        bk = Part('h', dark(C['beak'], 0.5)); bk.poly([(hc[0] - 2.5, hc[1] + 2), (hc[0] + 2.5, hc[1] + 2), (hc[0], hc[1] + 8)], C['beak'])
        head = [nk, cr, hd, bk]
        back += [tp] + wings + [bp, tk, sd]
        front += head
    else:
        head = [nk, hd, cr]
        back += head + wings + [bp, tk, sd]
        front += [tp]
    return compose(back), compose(front), (round(seat[0], 1), round(seat[1], 1))

# =====================================================================
# KIM QUY – rùa vàng mai lục giác
# =====================================================================
QUY = dict(shell='#f0c23a', shell2='#a86a10', rim='#c88a1a', skin='#a8a040', skin2='#5a5a18', eye='#ff3020', gem='#2ad08a',
           blanket='#8a1020', trim='#ffd860', saddle='#4a0a10')

def hexagon(cx, cy, r, sq=0.75):
    return [(cx + math.cos(a) * r, cy + math.sin(a) * r * sq) for a in [k * math.pi / 3 for k in range(6)]]

def quy_side(kind, i):
    C = QUY
    run = kind == 'run'
    ph = (i / 6 * TAU) if run else 0
    bob = abs(math.sin(ph)) * 1.2 if run else (0.5 if i else 0)
    parts = []
    def leg(x, near, phase):
        sw = math.sin(phase) * (5 if run else 0)
        lift = max(0, math.sin(phase)) * (3 if run else 0)
        col = C['skin'] if near else dark(C['skin'], 0.3)
        lp = Part('h', dark(col, 0.5))
        top = (x, 88 - bob); foot = (x + sw, GY - 3 - lift)
        lp.cap(top, foot, 9, col, 8)
        lp.ell(foot[0] + 1, foot[1] + 1, 5.5, 3, col)
        lp.mark(lambda d: [d.rect(foot[0] + 2 + k * 2, foot[1] + 2, foot[0] + 2 + k * 2, foot[1] + 3, '#f0e0b0') for k in range(3)] + [d.ln((top[0] - 3, top[1] + 6 + k * 4), (top[0] + 3, top[1] + 7 + k * 4), dark(col, 0.3)) for k in range(3)])
        return lp
    parts += [leg(44, False, ph + math.pi), leg(82, False, ph)]
    tl = Part('h', dark(C['skin'], 0.5)); tl.poly([(34, 86 - bob), (24, 92 - bob), (34, 92 - bob)], C['skin'])
    parts.append(tl)
    # cổ + đầu
    nb = math.sin(ph * 2) * 1 if run else 0
    nk = Part('h', dark(C['skin'], 0.5))
    nk.curve([(86, 86 - bob), (96, 82 - bob + nb), (104, 77 - bob + nb)], 10, 8, C['skin'], 6)
    nk.mark(lambda d: [d.ln((90 + k * 4, 87 - bob - k * 2 + nb), (92 + k * 4, 84 - bob - k * 2 + nb), C['skin2']) for k in range(3)])
    hd = Part('v', dark(C['skin'], 0.5))
    hx0, hy0 = 108, 75 - bob + nb
    hd.ell(hx0, hy0, 9, 6.5, C['skin'])
    hd.poly([(hx0 + 4, hy0 - 4), (hx0 + 12, hy0 - 1), (hx0 + 11, hy0 + 3), (hx0 + 4, hy0 + 4)], C['skin'])
    hd.mark(lambda d: [d.ell(hx0 + 2, hy0 - 2.5, 1.8, 1.5, C['eye']), d.rect(hx0 + 2, hy0 - 3, hx0 + 2, hy0 - 2, '#1a0404'), d.ln((hx0 + 3, hy0 + 2), (hx0 + 11, hy0 + 1.5), C['skin2']),
                       d.ell(hx0 - 2, hy0 - 5, 2.2, 1.2, C['shell'])])
    parts += [nk, hd]
    # mai
    rimp = Part('v', dark(C['rim'], 0.5))
    rimp.ell(62, 88 - bob, 34, 8, C['rim'])
    rimp.mark(lambda d: [d.ln((62 + math.cos(a) * 30, 88 - bob + math.sin(a) * 6), (62 + math.cos(a) * 34, 88 - bob + math.sin(a) * 8), dark(C['rim'], 0.4)) for a in [k * 0.35 for k in range(0, 10)]])
    sh = Part('v', dark(C['shell'], 0.55))
    sh.ell(62, 82 - bob, 31, 26, C['shell'])
    def scutes(d):
        for (cx, cy, r) in ((62, 62, 8.5), (47, 68, 8), (77, 68, 8), (40, 80, 7), (62, 77, 8), (84, 80, 7), (52, 84, 6), (72, 84, 6)):
            pts = hexagon(cx, cy - bob, r)
            d.d.polygon([(round(x), round(y)) for x, y in pts], outline=hx(C['shell2']))
            d.ell(cx, cy - bob - 1, r * 0.35, r * 0.25, light(C['shell'], 0.35))
        d.ell(62, 62 - bob, 2, 1.6, C['gem'])
    sh.mark(scutes)
    parts += [rimp, sh]
    sx, sy = 62, 56 - bob
    tk = Part('v', dark(C['blanket'], 0.5))
    tk.poly([(sx - 11, sy + 2), (sx + 11, sy + 2), (sx + 13, sy + 9), (sx - 13, sy + 9)], C['blanket'])
    tk.mark(lambda d: [d.ln((sx - 13, sy + 9), (sx + 13, sy + 9), C['trim'])] + [d.ln((sx + k * 6, sy + 9), (sx + k * 6, sy + 12), C['trim']) for k in (-2, -1, 0, 1, 2)])
    sd = Part('v', dark(C['saddle'], 0.5))
    sd.poly([(sx - 7, sy - 2), (sx - 4, sy + 2), (sx + 4, sy + 2), (sx + 8, sy - 3), (sx + 9, sy), (sx + 7, sy + 4), (sx - 7, sy + 4), (sx - 9, sy)], C['saddle'])
    parts += [tk, sd]
    parts += [leg(40, True, ph), leg(80, True, ph + math.pi)]
    return compose(parts), (sx, round(sy - 1, 1))

def quy_fb(view, kind, i):
    C = QUY
    down = view == 'down'
    run = kind == 'run'
    ph = (i / 6 * TAU) if run else 0
    bob = abs(math.sin(ph)) * 1.2 if run else (0.5 if i else 0)
    def P(x, f, u):
        return (CW / 2 - x, FB_GY - u + f * DEPTH) if down else (CW / 2 + x, FB_GY - u - f * DEPTH)
    def leg(x, f, phase):
        sw = math.sin(phase) * (4 if run else 0)
        lp = Part('h', dark(C['skin'], 0.5))
        top = P(x, f + sw * 0.5, 18 + bob); foot = P(x * 1.1, f + sw, 2)
        lp.cap(top, foot, 9, C['skin'], 8); lp.ell(foot[0], foot[1] + 1, 5.5, 3, C['skin'])
        lp.mark(lambda d: [d.rect(foot[0] + k * 2, foot[1] + 2, foot[0] + k * 2, foot[1] + 3, '#f0e0b0') for k in (-1, 0, 1)])
        return lp
    front_legs = [leg(-18, 14, ph), leg(18, 14, ph + math.pi)]
    rear_legs = [leg(-18, -14, ph + math.pi), leg(18, -14, ph)]
    rimp = Part('v', dark(C['rim'], 0.5)); rimp.ell(*P(0, 0, 18 + bob), 30, 14, C['rim'])
    sh = Part('v', dark(C['shell'], 0.55)); c = P(0, 0, 28 + bob); sh.ell(c[0], c[1], 27, 21, C['shell'])
    def scutes(d):
        for (dx, dy, r) in ((0, -6, 8), (-14, -1, 7), (14, -1, 7), (0, 8, 7), (-12, 11, 5.5), (12, 11, 5.5)):
            pts = hexagon(c[0] + dx, c[1] + dy, r)
            d.d.polygon([(round(x), round(y)) for x, y in pts], outline=hx(C['shell2']))
            d.ell(c[0] + dx, c[1] + dy - 1, r * 0.35, r * 0.25, light(C['shell'], 0.35))
        d.ell(c[0], c[1] - 6, 2, 1.6, C['gem'])
    sh.mark(scutes)
    sc = (c[0], c[1] - 19)
    tk = Part('v', dark(C['blanket'], 0.5))
    tk.poly([(sc[0] - 12, sc[1] + 2), (sc[0] + 12, sc[1] + 2), (sc[0] + 13, sc[1] + 10), (sc[0] - 13, sc[1] + 10)], C['blanket'])
    tk.mark(lambda d: [d.ln((sc[0] - 13, sc[1] + 10), (sc[0] + 13, sc[1] + 10), C['trim'])])
    sd = Part('v', dark(C['saddle'], 0.5)); sd.ell(sc[0], sc[1], 7, 3.4, C['saddle'])
    seat = (sc[0], sc[1] - 1)
    nb = math.sin(ph * 2) if run else 0
    if down:
        hc = P(0, 24, 18 + bob + nb)
        hd = Part('v', dark(C['skin'], 0.5))
        hd.ell(hc[0], hc[1], 8, 7, C['skin']); hd.ell(hc[0], hc[1] + 5, 6, 4, C['skin'])
        hd.mark(lambda d: [d.ell(hc[0] + sx_ * 4.5, hc[1] - 1, 1.6, 1.4, C['eye']) for sx_ in (-1, 1)] + [d.ln((hc[0] - 4, hc[1] + 6), (hc[0] + 4, hc[1] + 6), C['skin2']), d.ell(hc[0], hc[1] - 5, 2.4, 1.2, C['shell'])])
        return compose(rear_legs + [rimp, sh, tk, sd]), compose(front_legs + [hd]), (round(seat[0], 1), round(seat[1], 1))
    tl = Part('h', dark(C['skin'], 0.5)); t0 = P(0, -26, 14 + bob); tl.poly([(t0[0] - 3, t0[1]), (t0[0] + 3, t0[1]), (t0[0], t0[1] + 7)], C['skin'])
    hd = Part('v', dark(C['skin'], 0.5)); hc = P(0, 26, 22 + bob); hd.ell(hc[0], hc[1], 6, 5, C['skin'])
    return compose(front_legs + [hd, rimp, sh, tk, sd]), compose(rear_legs + [tl]), (round(seat[0], 1), round(seat[1], 1))

# =====================================================================
# KIM NGƯU – trâu vàng sừng cong, vòng mũi
# =====================================================================
NGUU = dict(coat='#e8b030', coat2='#8a5a10', horn='#fff4d8', hoof='#5a3a14', muzzle='#d8a060', ring='#ffe070', eye='#2a1404', tuft='#7a4a10',
            blanket='#1a3a8a', trim='#ffd860', saddle='#3a2410')

def nguu_side(kind, i):
    C = NGUU
    run = kind == 'run'
    p = (i / 6) if run else 0
    bob = math.sin(p * TAU + 0.6) * 1.4 if run else (0.6 if i else 0)
    q = [(p + o) % 1 for o in (0.0, 0.1, 0.5, 0.6)]
    legs = {}
    for key, top, qq, fore in (('hn', (42, 74), q[0], 0), ('hf', (46, 74), q[1], 0), ('fn', (82, 74), q[2], 1), ('ff', (78, 74), q[3], 1)):
        ang = fore_angles(qq, kind) if fore else hind_angles(qq, kind)
        ang = [a * 0.75 for a in ang[:2]] + [ang[2] * 0.6]
        legs[key] = limb((top[0], top[1] - bob), ang, [12, 10, 4] if fore else [12, 11, 4])
    low = max(pt[-1][1] for pt in legs.values()); dy = GY - 2 - low
    def S(pt): return (pt[0], pt[1] + dy)
    def B(x, y): return S((x, y - bob))
    parts = []
    def draw_leg(pts, fore, near):
        col = C['coat'] if near else dark(C['coat'], 0.3)
        lp = Part('h', dark(col, 0.5))
        a, b, c, d = [S(x) for x in pts]
        lp.cap(a, b, 10 if not fore else 9.5, col, 6.5)
        lp.cap(b, c, 5.5, col, 4.6); lp.cap(c, d, 4.6, col, 4.4)
        hf = Part('h', None)
        hf.poly([(d[0] - 3, d[1] - 1), (d[0] + 3, d[1] - 1), (d[0] + 3.4, d[1] + 2.5), (d[0] - 3.4, d[1] + 2.5)], C['hoof'] if near else dark(C['hoof'], 0.3))
        hf.mark(lambda s: s.ln((d[0], d[1]), (d[0], d[1] + 2.5), dark(C['hoof'], 0.5)))
        return [lp, hf]
    parts += draw_leg(legs['hf'], 0, False) + draw_leg(legs['ff'], 1, False)
    # đuôi có chùm lông
    sw = math.sin(p * TAU) * 3 if run else (1 if i else 0)
    tp = Part('h', dark(C['coat'], 0.5))
    tpts = [B(34, 58), B(30, 64), B(29 + sw, 74), B(30 + sw * 1.4, 84)]
    tp.curve(tpts, 2.6, 2, C['coat'], 8)
    e = tpts[-1]; tp.ell(e[0], e[1] + 2, 3, 4.5, C['tuft'])
    parts.append(tp)
    # thân + bướu vai
    bp = Part('v', dark(C['coat'], 0.55))
    bp.poly([B(36, 56), B(48, 52), B(66, 53), B(80, 47), B(88, 52), B(94, 62), B(92, 76), B(80, 80), B(58, 82), B(42, 80), B(33, 72)], C['coat'])
    bp.ell(*B(40, 66), 12, 13, C['coat']); bp.ell(*B(84, 62), 11, 13, C['coat'])
    def bm(s):
        for a_, b_ in ((B(78, 52), B(76, 66)), (B(50, 56), B(48, 70))): s.ln(a_, b_, dark(C['coat'], 0.2))
        for k in range(4): r0 = B(60 + k * 4, 66 + k); s.ln(r0, (r0[0] + 3, r0[1] + 3), dark(C['coat'], 0.15))
        for k in range(5): a_ = B(44 + k * 9, 55); s.ln(a_, (a_[0] + 5, a_[1] - 1), light(C['coat'], 0.45))   # ánh kim
    bp.mark(bm)
    parts.append(bp)
    # cổ + yếm + đầu (thấp, hướng phải)
    nk = Part('h', dark(C['coat'], 0.55))
    nk.poly([B(80, 50), B(92, 54), B(100, 62), B(98, 74), B(90, 80), B(86, 64)], C['coat'])
    nk.poly([B(88, 72), B(96, 72), B(94, 84), B(89, 82)], dark(C['coat'], 0.12))   # yếm
    parts.append(nk)
    nod = math.sin(p * TAU * 2) * 1 if run else 0
    hd = Part('v', dark(C['coat'], 0.55))
    hp_ = [B(96, 58 + nod), B(104, 58 + nod), B(110, 64 + nod), B(114, 72 + nod), B(113, 77 + nod), B(104, 78 + nod), B(98, 72 + nod)]
    hd.poly(hp_, C['coat'])
    hd.ell(*B(111, 75 + nod), 4.5, 4, C['muzzle'])
    hd.mark(lambda s: [s.ell(*B(104, 64 + nod), 1.6, 1.4, C['eye']), s.ln(B(102, 62 + nod), B(106, 62 + nod), dark(C['coat'], 0.4)),
                       s.rect(*B(113, 73 + nod), *B(113, 73 + nod), '#2a1404'),
                       s.d.arc([round(B(110, 75 + nod)[0] - 2), round(B(110, 75 + nod)[1]), round(B(110, 75 + nod)[0] + 3), round(B(110, 75 + nod)[1] + 5)], 0, 360, fill=hx(C['ring']))])
    parts.append(hd)
    ear = Part('h', dark(C['coat'], 0.5)); ear.poly([B(98, 60 + nod), B(91, 58 + nod), B(97, 64 + nod)], C['coat'])
    parts.append(ear)
    hn = Part('h', dark(C['horn'], 0.55))
    hn.curve([B(100, 58 + nod), B(104, 50 + nod), B(112, 46 + nod), B(116, 50 + nod)], 4.2, 1.4, C['horn'], 10)
    hn.curve([B(97, 58 + nod), B(98, 50 + nod), B(104, 44 + nod), B(109, 44 + nod)], 3.6, 1.2, dark(C['horn'], 0.2), 10)
    parts.append(hn)
    parts += draw_leg(legs['hn'], 0, True) + draw_leg(legs['fn'], 1, True)
    seat = B(62, 50.5)
    tk = Part('v', dark(C['blanket'], 0.5))
    cloth = [B(50, 53), B(74, 52), B(76, 68), B(48, 69)]
    tk.poly(cloth, C['blanket'])
    tk.mark(lambda s: [s.ln(cloth[2], cloth[3], C['trim'], 2)])
    sd = Part('v', dark(C['saddle'], 0.55))
    sd.poly([B(52, 47), B(55, 52), B(68, 52), B(72, 46), B(74, 48), B(71, 56), B(53, 56), B(50, 50)], C['saddle'])
    parts += [tk, sd]
    return compose(parts), (round(seat[0], 1), round(seat[1], 1))

def nguu_fb(view, kind, i):
    C = NGUU
    down = view == 'down'
    run = kind == 'run'
    p = (i / 6) if run else 0
    bob = (math.sin(p * TAU * 2 + 0.6) * 1.3) if run else (0.6 if i else 0)
    def P(x, f, u):
        return (CW / 2 - x, FB_GY - u + f * DEPTH) if down else (CW / 2 + x, FB_GY - u - f * DEPTH)
    q = [(p + o) % 1 for o in (0.0, 0.1, 0.5, 0.6)]
    def leg(x, fore, qq, near):
        ang = fore_angles(qq, kind) if fore else hind_angles(qq, kind)
        f0, u0 = (20, 32) if fore else (-20, 32)
        pts = [(f0, u0 + bob)]
        for a, l in zip([a * 0.75 for a in ang], [12, 10, 4] if fore else [12, 11, 4]):
            f, u = pts[-1]; pts.append((f + math.sin(a) * l, u - math.cos(a) * l))
        col = C['coat'] if near else dark(C['coat'], 0.28)
        lp = Part('h', dark(col, 0.5))
        s_ = [P(x, f, u) for f, u in pts]
        lp.cap(s_[0], s_[1], 10, col, 7); lp.cap(s_[1], s_[2], 6, col, 5); lp.cap(s_[2], s_[3], 5, col, 4.6)
        h = s_[3]
        lp.poly([(h[0] - 3.2, h[1] - 1), (h[0] + 3.2, h[1] - 1), (h[0] + 3.5, h[1] + 2.5), (h[0] - 3.5, h[1] + 2.5)], C['hoof'])
        return lp
    legs = [(-8, 0, q[0]), (8, 0, q[1]), (-8, 1, q[2]), (8, 1, q[3])]
    lows = []
    far_legs = [leg(x, fo, qq, False) for x, fo, qq in legs if (fo == 0) == down]
    near_legs = [leg(x, fo, qq, True) for x, fo, qq in legs if (fo == 0) != down]
    body = Part('v', dark(C['coat'], 0.55))
    secs = [(-26, 42, 14, 12), (-14, 42, 16, 13), (0, 42, 16, 13), (14, 44, 16, 14), (24, 46, 15, 14)]
    order = sorted(secs, key=lambda z: z[0] if down else -z[0])
    for f, u, rx, ry in order:
        c = P(0, f, u + bob); body.ell(c[0], c[1], rx, ry, C['coat'])
    top_u = max(u + ry for f, u, rx, ry in secs)
    sc = P(0, -1, top_u + bob + 1)
    tk = Part('v', dark(C['blanket'], 0.5))
    tk.poly([(sc[0] - 14, sc[1] + 2), (sc[0] + 14, sc[1] + 2), (sc[0] + 13, sc[1] + 14), (sc[0] - 13, sc[1] + 14)], C['blanket'])
    tk.mark(lambda d: [d.ln((sc[0] - 13, sc[1] + 14), (sc[0] + 13, sc[1] + 14), C['trim'], 2)])
    sd = Part('v', dark(C['saddle'], 0.55)); sd.ell(sc[0], sc[1], 7.5, 3.6, C['saddle'])
    seat = (sc[0], sc[1] - 1.5)
    if down:
        hc = P(0, 34, 40 + bob)
        hd = Part('v', dark(C['coat'], 0.55))
        hd.ell(hc[0], hc[1], 10, 8, C['coat'])
        hd.poly([(hc[0] - 8, hc[1]), (hc[0] + 8, hc[1]), (hc[0] + 6, hc[1] + 12), (hc[0] - 6, hc[1] + 12)], C['coat'])
        hd.ell(hc[0], hc[1] + 12, 6.5, 4, C['muzzle'])
        hd.mark(lambda d: [d.ell(hc[0] + sx_ * 5.5, hc[1] - 1, 1.6, 1.4, C['eye']) for sx_ in (-1, 1)] + [d.rect(hc[0] + sx_ * 2.5, hc[1] + 12, hc[0] + sx_ * 2.5, hc[1] + 13, '#2a1404') for sx_ in (-1, 1)]
                  + [d.d.arc([round(hc[0] - 3), round(hc[1] + 12), round(hc[0] + 3), round(hc[1] + 18)], 0, 360, fill=hx(C['ring']))])
        hn = Part('h', dark(C['horn'], 0.55))
        for sx_ in (-1, 1):
            hn.curve([(hc[0] + sx_ * 6, hc[1] - 5), (hc[0] + sx_ * 16, hc[1] - 6), (hc[0] + sx_ * 20, hc[1] - 14), (hc[0] + sx_ * 17, hc[1] - 20)], 4.4, 1.4, C['horn'], 10)
        ear = Part('h', dark(C['coat'], 0.5))
        for sx_ in (-1, 1): ear.poly([(hc[0] + sx_ * 8, hc[1] - 2), (hc[0] + sx_ * 16, hc[1]), (hc[0] + sx_ * 9, hc[1] + 3)], C['coat'])
        return compose(far_legs + [body, tk, sd]), compose(near_legs + [ear, hd, hn]), (round(seat[0], 1), round(seat[1], 1))
    hc = P(0, 32, 46 + bob)
    hd = Part('v', dark(C['coat'], 0.55)); hd.ell(hc[0], hc[1], 9, 8, C['coat'])
    hn = Part('h', dark(C['horn'], 0.55))
    for sx_ in (-1, 1):
        hn.curve([(hc[0] + sx_ * 5, hc[1] - 4), (hc[0] + sx_ * 15, hc[1] - 5), (hc[0] + sx_ * 19, hc[1] - 13), (hc[0] + sx_ * 16, hc[1] - 19)], 4.2, 1.4, C['horn'], 10)
    sw = math.sin(p * TAU) * 3 if run else 0
    tp = Part('h', dark(C['coat'], 0.5))
    t0 = P(0, -30, 46 + bob); tpts = [t0, (t0[0] + sw * 0.4, t0[1] + 8), (t0[0] + sw, t0[1] + 18), (t0[0] + sw, t0[1] + 26)]
    tp.curve(tpts, 2.6, 2, C['coat'], 8); e = tpts[-1]; tp.ell(e[0], e[1] + 2, 3, 4.5, C['tuft'])
    return compose(far_legs + [hd, hn, body, tk, sd]), compose(near_legs + [tp]), (round(seat[0], 1), round(seat[1], 1))

EXT = {'thanh_long': (long_side, long_fb), 'phuong_hoang': (phx_side, phx_fb), 'kim_quy': (quy_side, quy_fb), 'kim_nguu': (nguu_side, nguu_fb)}
