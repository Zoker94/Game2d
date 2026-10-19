# Vẽ thú cưỡi pixel kiểu tả thực (nhìn ngang, quay mặt sang phải).
# Mỗi thú = khung xương 2D (thân, cổ, đầu, 4 chân 3 đốt) -> vẽ từng bộ phận có đổ bóng theo khối,
# viền nội bộ dịu + viền ngoài đậm. Xuất ô 128x120: cột 0-1 đứng thở, 2-7 phi nước đại; hàng 0 nhìn ngang, 1-4 nhìn xuống / nhìn lên.
# Kèm mounts.json: điểm yên ngựa (seat) từng khung để game đặt hông nhân vật ngồi đúng chỗ.
# Dùng: python3 tools/mounts.py public/assets
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw

CW, CH = 128, 120
GY = 114                # mặt đất (nhìn ngang)
FB_GY = 102             # mặt đất dưới tâm thú khi nhìn trước / sau
TAU = math.pi * 2
FRAMES = [('idle', 0), ('idle', 1)] + [('run', i) for i in range(6)]

def hx(c):
    if isinstance(c, tuple): return c if len(c) == 4 else c + (255,)
    c = c.lstrip('#'); return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)
def mix(a, b, t):
    a, b = hx(a), hx(b); return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3)) + (255,)
def dark(c, t=0.3): return mix(c, '#140c1c', t)
def light(c, t=0.3): return mix(c, '#fffaf0', t)
INK = (22, 12, 26, 255)

def shift(m, dx, dy):
    o = np.zeros_like(m); h, w = m.shape
    ys, ye = max(0, dy), min(h, h + dy); xs, xe = max(0, dx), min(w, w + dx)
    o[ys:ye, xs:xe] = m[ys - dy:ye - dy, xs - dx:xe - dx]
    return o

class Part:
    """1 bộ phận: shade='v' khối nằm ngang (sáng trên, tối dưới), 'h' khối đứng (sáng trái, tối phải), None phẳng"""
    def __init__(self, shade='v', line=None, rim=True):
        self.im = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); self.d = ImageDraw.Draw(self.im)
        self.shade, self.line_c, self.rim = shade, line, rim
        self.marks = []
    def poly(self, pts, c): self.d.polygon([(round(x), round(y)) for x, y in pts], fill=hx(c))
    def ell(self, cx, cy, rx, ry, c): self.d.ellipse([round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry)], fill=hx(c))
    def rect(self, x0, y0, x1, y1, c): self.d.rectangle([round(x0), round(y0), round(x1), round(y1)], fill=hx(c))
    def ln(self, p0, p1, c, w=1): self.d.line([(round(p0[0]), round(p0[1])), (round(p1[0]), round(p1[1]))], fill=hx(c), width=w)
    def cap(self, p0, p1, w0, c, w1=None):
        """đoạn thuôn: rộng w0 ở đầu p0, w1 ở p1"""
        w1 = w0 if w1 is None else w1
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]; n = math.hypot(dx, dy) or 1
        nx, ny = -dy / n, dx / n
        self.poly([(p0[0] + nx * w0 / 2, p0[1] + ny * w0 / 2), (p1[0] + nx * w1 / 2, p1[1] + ny * w1 / 2),
                   (p1[0] - nx * w1 / 2, p1[1] - ny * w1 / 2), (p0[0] - nx * w0 / 2, p0[1] - ny * w0 / 2)], c)
        self.ell(p0[0], p0[1], w0 / 2 - 0.3, w0 / 2 - 0.3, c); self.ell(p1[0], p1[1], w1 / 2 - 0.3, w1 / 2 - 0.3, c)
    def curve(self, pts, w0, w1, c, steps=10):
        """dải cong thuôn qua các điểm (đuôi, bờm, râu)"""
        path = bez(pts, steps)
        for i in range(len(path) - 1):
            t = i / (len(path) - 1)
            self.cap(path[i], path[i + 1], w0 + (w1 - w0) * t, c, w0 + (w1 - w0) * (t + 1 / (len(path) - 1)))
    def mark(self, fn): self.marks.append(fn)
    def finish(self):
        a = np.array(self.im).astype(np.int32)
        m = a[..., 3] > 0
        if not m.any(): return None
        rgb = a[..., :3].astype(float)
        shadow = np.array([30, 18, 44], float)
        if self.shade == 'v':
            for x in np.where(m.any(0))[0]:
                ys = np.where(m[:, x])[0]; y0, y1 = ys.min(), ys.max(); hgt = y1 - y0 + 1
                if hgt < 3: continue
                t = (np.arange(CH) - y0) / hgt
                band = np.where(t > 0.72, 0.36, np.where(t > 0.5, 0.18, np.where(t < 0.16, -0.16, 0)))
                sel = m[:, x]
                b = band[sel][:, None]
                rgb[sel, x] = np.where(b > 0, rgb[sel, x] * (1 - b) + shadow * b, rgb[sel, x] * (1 + b) - 255 * b)
        elif self.shade == 'h':
            for y in np.where(m.any(1))[0]:
                xs = np.where(m[y])[0]; x0, x1 = xs.min(), xs.max(); wdt = x1 - x0 + 1
                if wdt < 3: continue
                t = (np.arange(CW) - x0) / wdt
                band = np.where(t > 0.66, 0.3, np.where(t < 0.25, -0.12, 0))
                sel = m[y]
                b = band[sel][:, None]
                rgb[y, sel] = np.where(b > 0, rgb[y, sel] * (1 - b) + shadow * b, rgb[y, sel] * (1 + b) - 255 * b)
        if self.shade and self.rim:
            li = m & ~shift(m, 0, 1)            # mép trên bắt sáng
            rgb[li] = rgb[li] * 0.72 + 255 * 0.28
        out = np.zeros((CH, CW, 4), np.uint8)
        out[..., :3] = np.clip(rgb, 0, 255); out[..., 3] = a[..., 3]
        img = Image.fromarray(out, 'RGBA')
        if self.marks:
            self.d = ImageDraw.Draw(img)
            for fn in self.marks: fn(self)
            out = np.array(img); m = out[..., 3] > 0
        if self.line_c is not None:
            ring = (shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)) & ~m
            out[ring] = hx(self.line_c)
        return Image.fromarray(out, 'RGBA')

def bez(pts, steps=10):
    """đường cong Bezier qua danh sách điểm điều khiển"""
    out = []
    n = len(pts) - 1
    for s in range(steps + 1):
        t = s / steps
        x = y = 0
        for i, p in enumerate(pts):
            c = math.comb(n, i) * (t ** i) * ((1 - t) ** (n - i))
            x += c * p[0]; y += c * p[1]
        out.append((x, y))
    return out

def compose(parts):
    img = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    for p in parts:
        if p is None: continue
        f = p.finish() if hasattr(p, 'finish') else p
        if f is not None: img.alpha_composite(f)
    # viền ngoài cùng đậm
    a = np.array(img); m = a[..., 3] > 0
    ring = (shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)) & ~m
    a[ring] = INK
    return Image.fromarray(a, 'RGBA')

def rot(p, c, a):
    s, co = math.sin(a), math.cos(a)
    x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * co - y * s, c[1] + x * s + y * co)

def limb(top, angles, lens):
    """chân nhiều đốt: góc so với phương thẳng đứng (+ = về phía trước/bên phải)"""
    pts = [top]
    for a, l in zip(angles, lens):
        x, y = pts[-1]; pts.append((x + math.sin(a) * l, y + math.cos(a) * l))
    return pts

def ease(t): return t * t * (3 - 2 * t)

# ---------------- dáng chạy ----------------
def fore_angles(q, kind):
    """chân trước: [cẳng trên, cổ chân, cổ móng]"""
    if kind == 'idle': return [0.04, 0.04, 0.55]
    st = 0.4
    if q < st:
        t = q / st; a = 0.5 - 1.0 * t
        return [a, a, a + 0.65]
    s = (q - st) / (1 - st); a = -0.5 + 1.15 * ease(s); f = 1.7 * math.sin(math.pi * min(1, s * 1.15))
    return [a, a - f, a - f * 1.25 + 0.4]

def hind_angles(q, kind):
    """chân sau: [đùi dưới (từ khớp gối), cổ chân, cổ móng]"""
    if kind == 'idle': return [-0.38, -0.02, 0.5]
    st = 0.4
    if q < st:
        t = q / st; g = 0.18 - 1.0 * t
        return [g, g + 0.4, g + 0.95]
    s = (q - st) / (1 - st); g = -0.82 + 1.0 * ease(s); f = 1.25 * math.sin(math.pi * s)
    return [g, g + 0.4 + f, g + 0.55 + f * 1.4]

# ---------------- ngựa (và kỳ lân / long mã dựa trên thân ngựa) ----------------
HORSE = {
    'ngua_nau': dict(coat='#8a5530', mane='#2a1810', points='#2a1a12', hoof='#3a3030', muzzle='#4a3024', blanket='#2c5aa0', trim='#e8c060', saddle='#5a3218', blaze=True, armor='#8a6a40'),
    'bach_ma':  dict(coat='#eceae4', mane='#d0d0dc', points='#e2dfd8', hoof='#8a8278', muzzle='#c8b0a8', blanket='#b02a30', trim='#ffd860', saddle='#6a3a1e', dapple=True, armor='#d8b050'),
    'hac_ma':   dict(coat='#2a2630', mane='#b81c1c', points='#1a1820', hoof='#1a1418', muzzle='#3a3238', blanket='#5a1020', trim='#e0b040', saddle='#2a1810', eyeRed=True, armor='#4a4652', spike=True),
    'hoa_ky_lan': dict(coat='#d8381a', mane='#ffb020', points='#7a1408', hoof='#c89020', muzzle='#ff8a40', blanket='#5a0a10', trim='#ffd040', saddle='#3a1008',
                       scales='#ffc040', belly='#ffd890', fire=True, dragon='qilin', horn='#ffe9a0', dhead=True),
    'thanh_long': dict(coat='#1fa07a', mane='#c8fff0', points='#0e5a48', hoof='#0a3028', muzzle='#7ae0c0', blanket='#0a3a5a', trim='#a0f0ff', saddle='#0a2a3a',
                       scales='#7af0c8', belly='#d8ffe8', cloud=True, dragon='long', horn='#f0e0a0'),
}

def horse_frame(H, kind, i):
    n = 6
    p = (i / n) if kind == 'run' else 0
    bob = math.sin(p * TAU + 0.6) * 1.6 if kind == 'run' else (0.6 if i else 0)
    pitch = math.sin(p * TAU + 2.2) * 0.05 if kind == 'run' else 0
    C = (62, 58)
    def B(x, y): return rot((x, y - bob), C, pitch)
    coat, mane = H['coat'], H['mane']
    soft = dark(coat, 0.5)
    # mốc cơ thể
    withers, back, croup, tailr = B(80, 41), B(62, 46), B(42, 43), B(33, 46)
    chest, brisket, belly1, belly2 = B(92, 56), B(86, 66), B(72, 69), B(50, 67)
    stifle_b, buttock = B(37, 62), B(30, 52)
    neck_ang = (math.sin(p * TAU + 1.0) * 0.12 if kind == 'run' else (-0.05 if i else -0.08)) + (-0.12 if kind == 'run' else 0)
    nb = B(86, 46)                       # gốc cổ
    def N(x, y): return rot(B(x, y), nb, neck_ang)
    poll, throat, crest = N(99, 21), N(101, 34), N(90, 30)
    muzzle, jaw, nose = N(115, 39), N(104, 38), N(117, 33)
    dragon = H.get('dragon')
    # khớp chân
    q = [(p + o) % 1 for o in (0.0, 0.1, 0.48, 0.58)]   # sau gần, sau xa, trước gần, trước xa
    hipJ, hipJf = B(42, 60), B(46, 60)
    shJ, shJf = B(83, 62), B(79, 62)
    legs = {}
    for key, top, qq, fore in (('hn', hipJ, q[0], 0), ('hf', hipJf, q[1], 0), ('fn', shJ, q[2], 1), ('ff', shJf, q[3], 1)):
        ang = fore_angles(qq, kind) if fore else hind_angles(qq, kind)
        lens = [12, 8, 4.5] if fore else [13, 10, 4.5]
        legs[key] = limb(top, ang, lens)
    # chạm đất: hạ cả con xuống để móng thấp nhất chạm mặt đất
    low = max(pt[-1][1] for pt in legs.values())
    dy = GY - 2 - low
    if kind == 'idle': dy = GY - 2 - low
    def S(pt): return (pt[0], pt[1] + dy)
    parts = []

    def draw_leg(pts, fore, near):
        col = coat if near else dark(coat, 0.3)
        pc = H['points'] if near else dark(H['points'], 0.3)
        pt = Part('h', dark(col, 0.5))
        a, b, c, d = [S(x) for x in pts]
        if fore:
            pt.cap(a, b, 7.5, col, 5)            # cẳng tay khỏe
            pt.cap(b, c, 4.2, pc, 3.6)           # ống chân
        else:
            pt.cap(a, b, 8, col, 4.6)            # bắp đùi dưới
            pt.ell(b[0], b[1], 2.6, 2.6, col)    # khớp cổ chân sau (hock)
            pt.cap(b, c, 4.2, pc, 3.6)
        pt.cap(c, d, 3.6, pc, 3.4)               # cổ móng
        # móng guốc
        hdx, hdy = d[0] - c[0], d[1] - c[1]; hn = math.hypot(hdx, hdy) or 1
        ux, uy = hdx / hn, hdy / hn
        hoof = [(d[0] - uy * 2.6 - ux, d[1] + ux * 2.6 - uy), (d[0] + uy * 2.6 - ux, d[1] - ux * 2.6 - uy),
                (d[0] + uy * 3.0 + ux * 3, d[1] - ux * 3.0 + uy * 3), (d[0] - uy * 3.0 + ux * 3, d[1] + ux * 3.0 + uy * 3)]
        hp = Part('h', None)
        hp.poly(hoof, H['hoof'] if near else dark(H['hoof'], 0.3))
        if H.get('fire'):
            fp = Part(None, None, rim=False)
            fl = (i + (1 if near else 0) + (2 if fore else 0)) % 3
            for jt, sz in ((d, 1.0), (b, 0.75)):      # móng + khớp gối / cổ chân
                for k, col in enumerate(('#ff4a10', '#ff9a20', '#ffe070')):
                    L = (7.5 - k * 2 + (fl - 1) * 0.8) * sz
                    fp.poly([(jt[0] - 3.2 * sz + k * 0.8, jt[1] + 1.5), (jt[0] + 2.2 * sz - k * 0.6, jt[1] + 1), (jt[0] - 4 - L * 0.6, jt[1] - L)], col)
            return [pt, hp, fp]
        if H.get('cloud') and kind == 'run':
            cp = Part(None, None, rim=False)
            for k in range(3): cp.ell(d[0] - 2 - k * 3, d[1] + 1.5, 2.6 - k * 0.5, 1.6, light(H['mane'], 0.2 + k * 0.1))
            return [pt, hp, cp]
        return [pt, hp]

    # --- chân phía xa ---
    parts += draw_leg(legs['hf'], 0, False)
    parts += draw_leg(legs['ff'], 1, False)
    # --- đuôi ---
    tail_sw = math.sin(p * TAU) * 3 if kind == 'run' else (1 if i else 0)
    tr = S(tailr)
    if kind == 'run': tpts = [tr, (tr[0] - 9, tr[1] - 2 + tail_sw), (tr[0] - 18, tr[1] + 4 + tail_sw), (tr[0] - 24, tr[1] + 10 + tail_sw)]
    else: tpts = [tr, (tr[0] - 6, tr[1] + 2), (tr[0] - 9, tr[1] + 14 + tail_sw), (tr[0] - 6, tr[1] + 28)]
    tp = Part('h', dark(mane, 0.45))
    if H.get('fire'):
        tp.curve(tpts, 5, 2, '#ff6a10'); tp.curve([(x, y - 1) for x, y in tpts], 3, 1, '#ffd040')
        tf = Part(None, None, rim=False)
        for k, pt_ in enumerate(bez(tpts, 6)[1:]):
            for j, col in enumerate(('#ff4a10', '#ff9a20', '#ffe070')):
                L = 9 - j * 2.6 + ((i + k) % 3 - 1)
                tf.poly([(pt_[0] + 2.5, pt_[1] + 1), (pt_[0] - 2.5, pt_[1] + 1.5), (pt_[0] - 4 - j, pt_[1] - L)], col)
        parts.append(tp); tp = tf
    elif H.get('cloud'):
        tp.curve(tpts, 4, 2, mane)
        e = tpts[-1]; tp.ell(e[0], e[1], 4, 3, light(mane, 0.2)); tp.ell(e[0] + 3, e[1] - 2, 3, 2.4, mane)
    else:
        tp.curve(tpts, 5.5, 2.5, mane)
        tp.mark(lambda s: [s.ln(bez(tpts, 8)[k], bez([(x + 1, y + 1) for x, y in tpts], 8)[k + 1], light(mane, 0.25)) for k in range(1, 7, 2)])
    parts.append(tp)
    # --- thân ---
    bp = Part('v', soft)
    body = [S(x) for x in (withers, B(73, 44), back, B(52, 45), croup, tailr, buttock, B(31, 58), stifle_b, B(44, 66), belly2, belly1, brisket, B(90, 63), chest, B(90, 49))]
    bp.poly(body, coat)
    bp.ell(*S(B(39, 53)), 10, 10, coat)         # mông tròn
    bp.ell(*S(B(84, 56)), 9.5, 10, coat)        # vai ngực vạm vỡ
    bp.ell(*S(B(78, 50)), 7, 6, coat)           # u vai
    if H.get('belly'):
        bp.poly([S(B(48, 63)), S(B(72, 65)), S(brisket), S(belly1), S(belly2)], H['belly'])
    def body_marks(s):
        # đường cơ vai, cơ mông, sườn
        sh = [S(B(80, 47)), S(B(78, 55)), S(B(81, 64))]
        for a, b in zip(sh, sh[1:]): s.ln(a, b, dark(coat, 0.22))
        hip = bez([S(B(48, 46)), S(B(50, 56)), S(B(44, 64))], 6)
        for a, b in zip(hip, hip[1:]): s.ln(a, b, dark(coat, 0.2))
        for k in range(3):
            r0 = S(B(64 + k * 4, 58 + k)); s.ln(r0, (r0[0] + 3, r0[1] + 3), dark(coat, 0.12))
        if H.get('dapple'):
            for (x, y) in ((40, 52), (46, 57), (36, 58), (54, 56), (44, 49)):
                c = S(B(x, y)); s.ell(c[0], c[1], 1.5, 1.2, dark(coat, 0.1))
        if H.get('scales'):
            for row in range(4):
                for col in range(9):
                    x = 38 + col * 5.2 + (row % 2) * 2.6; y = 48 + row * 4.2
                    c = S(B(x, y))
                    s.d.arc([round(c[0] - 2), round(c[1] - 2), round(c[0] + 2), round(c[1] + 2)], 20, 160, fill=hx(H['scales']))
    bp.mark(body_marks)
    parts.append(bp)
    # --- cổ ---
    npart = Part('h', soft)
    neck = [S(x) for x in (B(76, 44), crest, N(95, 22), poll, throat, N(96, 44), chest, B(88, 50))]
    npart.poly(neck, coat)
    if H.get('belly'): npart.poly([S(throat), S(N(97, 44)), S(chest), S(N(94, 42))], H['belly'])
    parts.append(npart)
    if H.get('dhead'):   # kỳ lân: bờm lửa dọc cổ + đầu rồng thật
        from mounts_ext import dragon_head_side, rotp
        mp = Part(None, None, rim=False)
        for k, a in enumerate([N(97, 19), N(92, 24), N(87, 30), N(82, 36), N(77, 42)]):
            a = S(a)
            for j, col in enumerate(('#ff3a08', '#ff8a18', '#ffd040', '#fff2a0')):
                L = 14 - j * 3 + ((i + k) % 3 - 1) * 1.5
                mp.poly([(a[0] + 3.5, a[1] + 1), (a[0] - 3.5, a[1] + 3), (a[0] - 6 - j - (4 if kind == 'run' else 1), a[1] - L)], col)
        parts.append(mp)
        DC = dict(coat=coat, belly=H['belly'], mane=H['mane'], horn=H['horn'], eye='#ffe040')
        parts += dragon_head_side(lambda q: S(N(*rotp(q, 0.42, 0.78, (95, 20)))), DC, p * TAU * 2 + i)
        parts += draw_leg(legs['hn'], 0, True)
        parts += draw_leg(legs['fn'], 1, True)
        return qilin_tack(H, parts, S, B, kind)
    # --- đầu ---
    hp = Part('v', soft)
    if dragon:
        snout = N(118, 36)
        head = [S(x) for x in (N(95, 22), N(102, 20), N(110, 27), snout, N(119, 40), N(108, 42), jaw, throat, N(96, 30))]
        hp.poly(head, coat)
        hp.poly([S(N(106, 40)), S(N(118, 41)), S(N(116, 44)), S(N(105, 44))], H['belly'])   # hàm dưới
    else:
        head = [S(x) for x in (N(95, 22), poll, N(104, 24), N(112, 31), nose, muzzle, N(110, 41), jaw, throat, N(96, 30))]
        hp.poly(head, coat)
        hp.ell(*S(N(113, 37)), 4.2, 4, H['muzzle'])   # mõm
        hp.ell(*S(N(101, 31)), 5.5, 6, coat)          # má
    def head_marks(s):
        e = S(N(103, 27))
        # mắt dữ: hốc mắt tối, con ngươi nhỏ, mày gồ xếch xuống phía mõm
        s.poly([S(N(100.5, 26.5)), S(N(103.5, 25.6)), S(N(106, 27.4)), S(N(103, 28.8))], '#120a0a')
        red = H.get('eyeRed') or dragon
        s.rect(e[0], e[1], e[0] + 1, e[1], '#ff3020' if red else '#e0a020')
        if red: s.rect(e[0] + 2, e[1], e[0] + 2, e[1], '#ff6040')
        s.rect(e[0] + 1, e[1], e[0] + 1, e[1], '#ffe080' if red else '#fff0c0')
        for a, b in ((S(N(99.5, 24.6)), S(N(106.5, 26.2))), (S(N(99.5, 25.4)), S(N(106, 26.8)))):
            s.ln(a, b, dark(coat, 0.5))   # mày gồ
        s.ln(S(N(100, 23.8)), S(N(105, 24.8)), light(coat, 0.25))
        if dragon:
            ns = S(N(116, 35)); s.rect(ns[0], ns[1], ns[0] + 1, ns[1], '#1a0a0a')
            mo = [S(N(108, 41)), S(N(118, 40))]; s.ln(mo[0], mo[1], '#3a0a0a')
            for k in range(3):    # răng nanh
                t = S(N(111 + k * 2.5, 41)); s.rect(t[0], t[1], t[0], t[1] + 1, '#ffffff')
        else:
            ns = S(N(115, 35)); s.ell(ns[0], ns[1], 1.7, 1.3, dark(H['muzzle'], 0.6)); s.ln((ns[0] - 2.5, ns[1] - 2), (ns[0] + 1, ns[1] - 2.2), dark(H['muzzle'], 0.35))   # mũi phập phồng
            mo = S(N(112, 40)); s.ln(mo, (mo[0] + 3, mo[1] - 0.5), dark(H['muzzle'], 0.5))
            if H.get('blaze'):
                bl = [S(N(101, 22)), S(N(104, 22)), S(N(113, 33)), S(N(111, 34))]
                s.d.polygon([(round(x), round(y)) for x, y in bl], fill=hx('#f4ece0'))
            ch = bez([S(N(99, 34)), S(N(103, 37)), S(N(108, 36))], 4)
            for a, b in zip(ch, ch[1:]): s.ln(a, b, dark(coat, 0.2))
    hp.mark(head_marks)
    parts.append(hp)
    # tai / sừng
    ep = Part('h', dark(coat, 0.5))
    ear_t = S(N(98, 9))
    ep.poly([S(N(94.5, 23)), S(N(95, 15)), ear_t, S(N(100.5, 21))], coat)
    ep.mark(lambda s: s.ln(S(N(97, 20)), S(N(97.6, 13)), dark(coat, 0.45)))
    if dragon == 'long':
        hc = H['horn']
        for (bx, by), tip, br in (((98, 20), (88, 6), (92, 10)), ((101, 20), (95, 4), (98, 9))):
            a, b = S(N(bx, by)), S(N(*tip)); ep.cap(a, b, 2.6, hc, 1.4)
            m_ = S(N(*br)); ep.cap(m_, (m_[0] - 4, m_[1] - 1), 1.8, hc, 1)
    elif dragon == 'qilin':
        a, b = S(N(101, 21)), S(N(104, 8)); ep.cap(a, b, 3.2, H['horn'], 1.2)
        ep.mark(lambda s: [s.ln(S(N(101.5, 18 - k * 3)), S(N(103.5, 18 - k * 3)), dark(H['horn'], 0.3)) for k in range(3)])
    parts.append(ep)
    if H.get('armor') and not dragon:
        ar = Part('v', dark(H['armor'], 0.55))
        plate = [S(N(101, 20.5)), S(N(105, 22)), S(N(113.5, 30)), S(N(112, 32)), S(N(105.5, 25.6)), S(N(101.5, 23.6))]
        ar.poly(plate, H['armor'])
        def armk(s):
            s.ln(plate[0], plate[2], light(H['armor'], 0.45))
            for k in range(3):
                r_ = S(N(105 + k * 2.6, 23.6 + k * 2.3)); s.rect(r_[0], r_[1], r_[0], r_[1], H['trim'])
        ar.mark(armk)
        parts.append(ar)
        if H.get('spike'):
            sp = Part('h', '#141016')
            b0, b1, tip = S(N(102.5, 21)), S(N(105.5, 22.5)), S(N(109, 12))
            sp.poly([b0, b1, tip], '#9a96a4')
            parts.append(sp)
    if dragon:   # râu rồng
        wp = Part(None, None, rim=False)
        sw = math.sin(p * TAU) * 2
        wp.curve([S(N(116, 37)), S(N(122, 36 + sw)), S(N(126, 42 + sw))], 1.6, 1, H['mane'])
        wp.curve([S(N(109, 43)), S(N(110, 49)), S(N(106, 53 + sw))], 2.2, 1, H['mane'])
        parts.append(wp)
    # --- bờm ---
    mp = Part('h', dark(mane, 0.45))
    mpts = [N(96, 19), N(91, 25), N(85, 32), N(79, 40)]
    wave = math.sin(p * TAU * 2) * 1.5 if kind == 'run' else 0
    for k, a in enumerate(mpts):
        a = S(a)
        drift = -5 if kind == 'run' else -2
        if H.get('fire'):
            for j, col in enumerate(('#ff5010', '#ff9a20', '#ffe060')):
                L = 9 - j * 2.5
                mp.poly([(a[0] + 3, a[1] - 1), (a[0] - 3, a[1] + 2), (a[0] + drift - 3 - j, a[1] - L + wave)], col)
        else:
            mp.poly([(a[0] + 3.5, a[1] - 3), (a[0] - 3.5, a[1] + 3), (a[0] + drift - 5 + wave, a[1] + 10 + k * 0.8), (a[0] + drift + 1, a[1] + 2)], mane)
            mp.poly([(a[0] + 2.5, a[1] - 3.5), (a[0] - 2, a[1] - 0.5), (a[0] + drift - 7 + wave, a[1] - 2.5 - (k % 2) * 1.5)], mane)
    fl = S(N(100, 19))
    mp.poly([(fl[0] - 2, fl[1]), (fl[0] + 2, fl[1] - 1), (fl[0] + 5, fl[1] + 6)], mane if not H.get('fire') else '#ffb020')   # chỏm bờm trán
    if H.get('plume'):
        pl = S(N(98, 15)); mp.curve([pl, (pl[0] - 4, pl[1] - 6), (pl[0] - 10, pl[1] - 6 + wave)], 3, 1.2, '#d82020')
    parts.append(mp)
    # --- chân phía gần ---
    parts += draw_leg(legs['hn'], 0, True)
    parts += draw_leg(legs['fn'], 1, True)
    # --- yên cương ---
    seat = S(B(62, 41.5))
    tk = Part('v', dark(H['blanket'], 0.5))
    cloth = [S(B(50, 44)), S(B(73, 44)), S(B(75, 59)), S(B(49, 59))]
    tk.poly(cloth, H['blanket'])
    tk.mark(lambda s: [s.ln(cloth[2], cloth[3], H['trim'], 2), s.ln(cloth[1], cloth[2], H['trim']), s.ln(cloth[0], cloth[3], H['trim'])])
    parts.append(tk)
    sd = Part('v', dark(H['saddle'], 0.55))
    sd.poly([S(B(52, 38)), S(B(55, 43)), S(B(68, 43)), S(B(72, 37)), S(B(74, 39)), S(B(71, 47)), S(B(53, 47)), S(B(50, 41))], H['saddle'])
    sd.mark(lambda s: [s.ln(S(B(55, 46)), S(B(69, 46)), light(H['saddle'], 0.3)), s.ell(*S(B(73, 38)), 1.2, 1.2, H['trim'])])
    parts.append(sd)
    st = Part(None, None, rim=False)
    sa, sb = S(B(64, 47)), S(B(68, 61))
    st.ln(sa, sb, '#3a2414', 1)
    st.d.rectangle([round(sb[0] - 2), round(sb[1]), round(sb[0] + 2), round(sb[1] + 2)], outline=hx('#c8c0b0'))
    gir = [S(B(73, 45)), S(B(76, 66))]; st.ln(gir[0], gir[1], '#3a2414', 2)                 # đai bụng
    br = bez([S(B(82, 47)), S(B(92, 55)), S(B(88, 60))], 5)                                     # đai ngực
    for a, b in zip(br, br[1:]): st.ln(a, b, '#4a2c18', 2)
    md = S(B(91, 54)); st.ell(md[0], md[1], 2.2, 2.2, H['trim']); st.rect(md[0], md[1], md[0], md[1], '#c01818')
    tsw = math.sin(p * TAU + 1.5) * 1.5 if kind == 'run' else 0
    st.poly([(md[0] - 1.5, md[1] + 2), (md[0] + 1.5, md[1] + 2), (md[0] + 2 - tsw, md[1] + 9), (md[0] - 2 - tsw, md[1] + 9)], '#c01818')   # tua đỏ
    st.ln((md[0] - 1 - tsw, md[1] + 8), (md[0] + 1 - tsw, md[1] + 8), '#ff5a3a')
    # dây cương: đầu ngựa -> tay người cưỡi
    if not dragon:
        for a, b in ((N(97, 22), N(108, 39)), (N(103, 25), N(112, 32)), (N(100, 31), N(112, 38))):
            st.ln(S(a), S(b), '#3a2010')
        bit = S(N(111, 39))
    else:
        bit = S(N(110, 38))
    st.ell(bit[0], bit[1], 1.2, 1.2, '#d8d0b8')
    hand = (seat[0] + 13, seat[1] - 13)
    rp = bez([bit, ((bit[0] + hand[0]) / 2, (bit[1] + hand[1]) / 2 + 6), hand], 6)
    for a, b in zip(rp, rp[1:]): st.ln(a, b, '#2a160a')
    parts.append(st)
    return compose(parts), (round(seat[0], 1), round(seat[1], 1))

def qilin_tack(H, parts, S, B, kind):
    seat = S(B(62, 41.5))
    tk = Part('v', dark(H['blanket'], 0.5))
    cloth = [S(B(50, 44)), S(B(73, 44)), S(B(75, 59)), S(B(49, 59))]
    tk.poly(cloth, H['blanket'])
    tk.mark(lambda s: [s.ln(cloth[2], cloth[3], H['trim'], 2), s.ln(cloth[1], cloth[2], H['trim']), s.ln(cloth[0], cloth[3], H['trim'])])
    parts.append(tk)
    sd = Part('v', dark(H['saddle'], 0.55))
    sd.poly([S(B(52, 38)), S(B(55, 43)), S(B(68, 43)), S(B(72, 37)), S(B(74, 39)), S(B(71, 47)), S(B(53, 47)), S(B(50, 41))], H['saddle'])
    sd.mark(lambda s: [s.ln(S(B(55, 46)), S(B(69, 46)), light(H['saddle'], 0.3)), s.ell(*S(B(73, 38)), 1.2, 1.2, H['trim'])])
    parts.append(sd)
    return compose(parts), (round(seat[0], 1), round(seat[1], 1))

# ---------------- hổ trắng ----------------
TIGER = dict(coat='#f2f0ea', stripe='#24202a', belly='#ffffff', nose='#c86a7a', eye='#ffc828', blanket='#3a3a6a', trim='#ffd860', saddle='#5a3a20')

def tiger_frame(T, kind, i):
    p = i / 6 if kind == 'run' else 0
    coat = T['coat']; soft = dark(coat, 0.5)
    stretch = math.sin(p * TAU) * 3 if kind == 'run' else 0      # co duỗi lưng khi phóng
    bob = math.sin(p * TAU * 2 + 0.5) * 1.2 if kind == 'run' else (0.5 if i else 0)
    def B(x, y, front=0):
        return (x + (stretch * 0.5 if front else -stretch * 0.5), y - bob)
    # chân: kiểu mèo, ngắn và to
    q = [(p + o) % 1 for o in (0.0, 0.12, 0.5, 0.62)]
    def fa(qq):
        if kind == 'idle': return [0.05, 0.0, 1.2]
        if qq < 0.45: t = qq / 0.45; a = 0.7 - 1.3 * t; return [a, a, a + 1.1]
        s = (qq - 0.45) / 0.55; a = -0.6 + 1.3 * ease(s); f = 1.4 * math.sin(math.pi * s); return [a, a - f, a - f + 1.0]
    def ha(qq):
        if kind == 'idle': return [-0.55, 0.15, 1.2]
        if qq < 0.45: t = qq / 0.45; g = 0.2 - 1.2 * t; return [g, g + 0.6, g + 1.6]
        s = (qq - 0.45) / 0.55; g = -1.0 + 1.2 * ease(s); f = 1.0 * math.sin(math.pi * s); return [g, g + 0.6 + f, g + 1.6 + f]
    legs = {}
    for key, top, qq, fore in (('hn', B(40, 60), q[0], 0), ('hf', B(44, 60), q[1], 0), ('fn', B(84, 61, 1), q[2], 1), ('ff', B(80, 61, 1), q[3], 1)):
        legs[key] = limb(top, fa(qq) if fore else ha(qq), [13, 9, 4] if fore else [12, 11, 4])
    low = max(pt[-1][1] for pt in legs.values())
    dy = GY - 3 - low
    def S(pt): return (pt[0], pt[1] + dy)
    parts = []
    def draw_leg(pts, fore, near):
        col = coat if near else dark(coat, 0.28)
        pt = Part('h', dark(col, 0.5))
        a, b, c, d = [S(x) for x in pts]
        pt.cap(a, b, 9 if fore else 10, col, 6)
        pt.cap(b, c, 6, col, 5)
        pt.ell(d[0] + 1.5, d[1] + 0.5, 4, 2.6, col)       # bàn chân to
        def mk(s):
            for k in range(2):
                m = (a[0] + (b[0] - a[0]) * (0.3 + k * 0.3), a[1] + (b[1] - a[1]) * (0.3 + k * 0.3))
                s.ln((m[0] - 3, m[1]), (m[0] + 1, m[1] + 1), T['stripe'] if near else dark(T['stripe'], 0.2))
            s.ln((d[0] + 2, d[1] + 2), (d[0] + 2, d[1] + 3), dark(col, 0.5)); s.ln((d[0] + 4, d[1] + 1), (d[0] + 4, d[1] + 3), dark(col, 0.5))
        pt.mark(mk)
        return [pt]
    parts += draw_leg(legs['hf'], 0, False) + draw_leg(legs['ff'], 1, False)
    # đuôi dài cong
    tr = S(B(30, 48))
    sw = math.sin(p * TAU + 1) * 4 if kind == 'run' else (2 if i else 0)
    tpts = [tr, (tr[0] - 12, tr[1] - 4 + sw), (tr[0] - 20, tr[1] + 8 - sw), (tr[0] - 16, tr[1] - 8 + sw)]
    tp = Part('h', soft); tp.curve(tpts, 5, 3.5, coat, 14)
    def tmk(s):
        path = bez(tpts, 14)
        for k in range(2, 14, 3):
            a = path[k]; s.ln((a[0] - 1.5, a[1] - 2), (a[0] + 1.5, a[1] + 2), T['stripe'])
        e = path[-1]; s.ell(e[0], e[1], 2.4, 2.4, T['stripe'])
    tp.mark(tmk); parts.append(tp)
    # thân dài, thấp
    bp = Part('v', soft)
    body = [S(B(80, 43, 1)), S(B(60, 45)), S(B(40, 42)), S(B(30, 47)), S(B(28, 56)), S(B(36, 66)), S(B(56, 67)), S(B(78, 68, 1)), S(B(90, 64, 1)), S(B(94, 54, 1)), S(B(90, 45, 1))]
    bp.poly(body, coat)
    bp.ell(*S(B(38, 54)), 11, 11, coat); bp.ell(*S(B(84, 54, 1)), 12, 12.5, coat)   # vai hổ vạm vỡ
    bp.poly([S(B(44, 64)), S(B(80, 65, 1)), S(B(78, 68, 1)), S(B(56, 67))], T['belly'])
    def bmk(s):
        # vằn hổ: các vệt thuôn cong, so le dài ngắn
        xs = [33, 38, 44, 49, 55, 74, 79, 85, 90]
        for k, x in enumerate(xs):
            fr = x > 62
            top = S(B(x, 44 if x < 50 or x > 72 else 46, fr))
            L = [8, 12, 7, 11, 6, 7, 12, 8, 10][k]
            bend = [2, -1, 3, 0, 2, -2, 1, 3, -1][k]
            path = bez([top, (top[0] + bend, top[1] + L * 0.5), (top[0] - 1 + bend * 0.5, top[1] + L)], 6)
            for j, (a, b) in enumerate(zip(path, path[1:])): s.ln(a, b, T['stripe'], 2 if j < 3 else 1)
            if k % 2 == 0: s.ln((top[0] + 3, top[1] + L * 0.6), (top[0] + 4, top[1] + L * 0.6 + 3), T['stripe'])
    bp.mark(bmk); parts.append(bp)
    # đầu hổ
    hc = S(B(100, 46, 1)); bobh = math.sin(p * TAU + 2) * 1.2 if kind == 'run' else 0
    hc = (hc[0], hc[1] + bobh)
    rf = Part('h', soft)   # bờm má xù quanh đầu
    for k in range(6):
        a_ = 1.0 + k * 0.42
        bx, by = hc[0] - 2 + math.cos(a_) * 9, hc[1] + 1 + math.sin(a_) * 9
        ox, oy = math.cos(a_ + 0.35) * 7, math.sin(a_ + 0.35) * 7
        rf.poly([(bx - math.sin(a_) * 3, by + math.cos(a_) * 3), (bx + math.sin(a_) * 3, by - math.cos(a_) * 3), (bx + ox, by + oy)], T['belly'] if k < 3 else coat)
    rf.mark(lambda s: [s.ln((hc[0] - 10 - k * 2, hc[1] - 2 + k * 4), (hc[0] - 6 - k * 2, hc[1] - 1 + k * 4), T['stripe']) for k in range(2)])
    parts.append(rf)
    hp = Part('v', soft)
    hp.ell(hc[0], hc[1], 12, 10.5, coat)
    hp.ell(hc[0] + 9, hc[1] + 3, 6.5, 5.5, coat)   # mõm
    hp.ell(hc[0] - 4, hc[1] + 6, 7.5, 5.5, T['belly'])  # má râu
    hp.poly([(hc[0] - 9, hc[1] - 5), (hc[0] - 6, hc[1] - 15), (hc[0] - 1, hc[1] - 8)], coat)   # tai
    def hmk(s):
        s.poly([(hc[0] - 7, hc[1] - 8), (hc[0] - 5.5, hc[1] - 12), (hc[0] - 3, hc[1] - 8)], '#e8a0a8')
        e = (hc[0] + 4, hc[1] - 3)
        s.poly([(e[0] - 3, e[1] - 1), (e[0] + 1, e[1] - 1.5), (e[0] + 3.5, e[1] + 1), (e[0] - 1, e[1] + 1.5)], '#141018')   # viền mắt xếch
        s.poly([(e[0] - 2, e[1] - 0.5), (e[0] + 1, e[1] - 0.8), (e[0] + 2.5, e[1] + 0.8), (e[0] - 1, e[1] + 0.8)], T['eye'])
        s.rect(e[0], e[1] - 1, e[0], e[1] + 1, '#101018')
        s.ln((e[0] - 4, e[1] - 4), (e[0] + 3, e[1] - 1.5), T['stripe'], 2)   # mày nhíu xếch
        s.ln((e[0] - 1, e[1] - 6), (e[0] + 2, e[1] - 3), T['stripe'])
        s.ln((hc[0] + 9, hc[1] - 2), (hc[0] + 12, hc[1] - 3), T['stripe'])   # nếp nhăn sống mũi
        s.ln((hc[0] + 9, hc[1] - 0.5), (hc[0] + 12, hc[1] - 1.5), T['stripe'])
        n = (hc[0] + 14, hc[1] + 1); s.poly([(n[0] - 2, n[1] - 1), (n[0] + 1, n[1] - 1), (n[0], n[1] + 1.5)], T['nose'])
        s.ln((n[0], n[1] + 2), (n[0] - 3, n[1] + 5), T['stripe'])
        for k in range(3): s.ln((hc[0] - 8 + k * 3, hc[1] - 9 + k), (hc[0] - 6 + k * 3, hc[1] - 4 + k), T['stripe'])   # vằn trán 王
        for k in range(2): s.ln((hc[0] - 10, hc[1] + k * 3), (hc[0] - 5, hc[1] + 1 + k * 3), T['stripe'])
        roar = kind == 'run' and i in (2, 3)
        mh = 4 if roar else 2   # luôn nhe nanh, gầm khi phóng
        s.poly([(n[0] - 7, n[1] + 3.5), (n[0] + 1, n[1] + 3.5), (n[0] - 1, n[1] + 3.5 + mh), (n[0] - 6, n[1] + 3.5 + mh * 0.7)], '#5a0a1a')
        for fx_ in (n[0] - 1, n[0] - 5): s.poly([(fx_ - 1, n[1] + 3.5), (fx_ + 1, n[1] + 3.5), (fx_, n[1] + 6.5)], '#ffffff')   # nanh
    hp.mark(hmk); parts.append(hp)
    parts += draw_leg(legs['hn'], 0, True) + draw_leg(legs['fn'], 1, True)
    seat = S(B(62, 41))
    tk = Part('v', dark(T['blanket'], 0.5))
    cloth = [S(B(50, 43)), S(B(74, 43, 1)), S(B(76, 58, 1)), S(B(48, 58))]
    tk.poly(cloth, T['blanket'])
    tk.mark(lambda s: [s.ln(cloth[2], cloth[3], T['trim'], 2)] + [s.ell((cloth[2][0] + cloth[3][0]) / 2 + k * 6 - 6, cloth[2][1] + 2, 1.2, 1.2, T['trim']) for k in range(3)])
    parts.append(tk)
    sd = Part('v', dark(T['saddle'], 0.55))
    sd.poly([S(B(52, 37)), S(B(55, 42)), S(B(68, 42)), S(B(72, 36)), S(B(74, 38)), S(B(71, 46)), S(B(53, 46)), S(B(50, 40))], T['saddle'])
    parts.append(sd)
    st = Part(None, None, rim=False)
    sa, sb = S(B(64, 46)), S(B(68, 60)); st.ln(sa, sb, '#3a2414')
    st.d.rectangle([round(sb[0] - 2), round(sb[1]), round(sb[0] + 2), round(sb[1] + 2)], outline=hx('#d0c8b0'))
    hand = (seat[0] + 13, seat[1] - 13)
    col = (hc[0] - 2, hc[1] + 9)   # vòng cổ
    st.ell(col[0], col[1], 1.5, 1.5, T['trim'])
    rp = bez([col, ((col[0] + hand[0]) / 2, (col[1] + hand[1]) / 2 + 5), hand], 6)
    for a, b in zip(rp, rp[1:]): st.ln(a, b, '#2a160a')
    parts.append(st)
    return compose(parts), (round(seat[0], 1), round(seat[1], 1))

# ---------------- nhìn trước / nhìn sau (chạy xuống / chạy lên) ----------------
# Dựng thú bằng các khối 3D (x: bên phải con thú, f: phía trước, u: lên trên) rồi chiếu giống nhân vật:
# nhìn xuống: sx = giữa - x, sy = đất - u + f*0.28 ; nhìn lên: sx = giữa + x, sy = đất - u - f*0.28.
# Mỗi khung trả 2 lớp: lớp sau (vẽ trước người cưỡi) và lớp trước (vẽ đè lên người cưỡi).
DEPTH = 0.55   # đậm hơn nhân vật một chút để thấy rõ thân dài của thú

def fb_frame(mid, view, kind, i):
    tiger = mid == 'bach_ho'
    H = TIGER if tiger else HORSE[mid]
    dragon = None if tiger else H.get('dragon')
    coat = H['coat']; mane = H.get('mane', H.get('stripe'))
    soft = dark(coat, 0.5)
    down = view == 'down'
    p = (i / 6) if kind == 'run' else 0
    bob = (math.sin(p * TAU * 2 + 0.6) * 1.4) if kind == 'run' else (0.6 if i else 0)
    # chân: dùng cùng nhịp với dáng nghiêng, toạ độ (f, u)
    q = [(p + o) % 1 for o in ((0.0, 0.12, 0.5, 0.62) if tiger else (0.0, 0.1, 0.48, 0.58))]
    legdef = []   # (x, fore, q)
    if tiger:
        legdef = [(-7, 0, q[0]), (7, 0, q[1]), (-7, 1, q[2]), (7, 1, q[3])]
        tops = {0: (-20, 31), 1: (21, 30)}; lens = {0: [12, 11, 4], 1: [13, 9, 4]}
    else:
        legdef = [(-6, 0, q[0]), (6, 0, q[1]), (-5.5, 1, q[2]), (5.5, 1, q[3])]
        tops = {0: (-20, 31), 1: (21, 29)}; lens = {0: [13, 10, 4.5], 1: [12, 8, 4.5]}
    legs = []
    for x, fore, qq in legdef:
        ang = fore_angles(qq, kind) if fore else hind_angles(qq, kind)
        if tiger:
            ang = [ang[0] * 0.8, ang[1] * 0.8, ang[2]]
        f0, u0 = tops[fore]
        pts = [(f0, u0 + bob)]
        for a, l in zip(ang, lens[fore]):
            f, u = pts[-1]; pts.append((f + math.sin(a) * l, u - math.cos(a) * l))
        legs.append((x, fore, pts))
    low = min(pts[-1][1] for _, _, pts in legs)
    du = 2 - low     # nâng / hạ cả con để móng thấp nhất chạm đất
    def P(x, f, u):
        u += du
        return (CW / 2 - x, FB_GY - u + f * DEPTH) if down else (CW / 2 + x, FB_GY - u - f * DEPTH)
    near_f = (lambda f: f) if down else (lambda f: -f)     # độ gần người xem
    back, front = [], []

    # ----- chân -----
    def leg_part(x, fore, pts, near):
        col = coat if near else dark(coat, 0.28)
        pc = (H.get('points', coat) if not tiger else coat)
        pc = pc if near else dark(pc, 0.28)
        lp = Part('h', dark(col, 0.5))
        s = [P(x, f, u) for f, u in pts]
        if tiger:
            lp.cap(s[0], s[1], 9, col, 7); lp.cap(s[1], s[2], 7, col, 6)
            lp.ell(s[3][0], s[3][1] + 0.5, 4.2, 2.8, col)
            lp.mark(lambda d: [d.ln((s[0][0] - 3, (s[0][1] + s[1][1]) / 2 + k * 3), (s[0][0] + 1, (s[0][1] + s[1][1]) / 2 + k * 3 + 1), H['stripe']) for k in range(2)]
                    + [d.ln((s[3][0] + k, s[3][1] + 1), (s[3][0] + k, s[3][1] + 3), dark(col, 0.5)) for k in (-2, 0, 2)])
            return [lp]
        lp.cap(s[0], s[1], 7 if fore else 7.5, col, 5)
        if not fore: lp.ell(s[1][0], s[1][1], 2.6, 2.6, col)
        lp.cap(s[1], s[2], 4.2, pc, 3.6); lp.cap(s[2], s[3], 3.6, pc, 3.4)
        hp = Part('h', None)
        hb = s[3]
        hp.poly([(hb[0] - 2.6, hb[1] - 1.5), (hb[0] + 2.6, hb[1] - 1.5), (hb[0] + 3, hb[1] + 1.8), (hb[0] - 3, hb[1] + 1.8)], H['hoof'] if near else dark(H['hoof'], 0.3))
        out = [lp, hp]
        if kind == 'run' and (H.get('fire') or H.get('cloud')):
            fp = Part(None, None, rim=False)
            for k in range(3):
                c = ['#fff0a0', '#ffb020', '#ff5010'][k] if H.get('fire') else light(mane, 0.2 + k * 0.1)
                fp.ell(hb[0] + (k - 1) * 2.5, hb[1] + 1 - k * 0.4 + (k % 2), 2.4 - k * 0.4, 1.6, c)
            out.append(fp)
        return out
    far_legs = [l for l in legs if (l[1] == 0) == down]      # nhìn xuống: chân sau ở xa
    near_legs = [l for l in legs if (l[1] == 0) != down]

    # ----- thân: chuỗi elip từ xa tới gần -----
    if tiger:
        sec = [(-27, 30, 13, 10.5), (-18, 32, 15, 11.5), (-6, 31, 14, 11), (6, 31, 14, 11), (18, 32, 15, 12), (26, 31, 13, 11)]
    else:
        sec = [(-28, 40, 12, 10.5), (-21, 40, 14.5, 12.5), (-12, 37, 14, 12.5), (0, 36, 13.5, 12.5), (12, 36, 13.5, 12.5), (21, 37, 13.5, 12.5), (26, 38, 12, 11)]
    sec = [(f, u + bob, rx, ry) for f, u, rx, ry in sec]
    order = sorted(sec, key=lambda s_: near_f(s_[0]))
    body = Part('v', soft)
    for f, u, rx, ry in order:
        c = P(0, f, u); body.ell(c[0], c[1], rx, ry, coat)
    top_u = max(u + ry for f, u, rx, ry in sec)
    def body_marks(d):
        if H.get('belly'):
            for f, u, rx, ry in order:
                c = P(0, f, u - ry * 0.75); d.ell(c[0], c[1], rx * 0.55, ry * 0.25, H['belly'])
        if H.get('scales'):
            for f, u, rx, ry in order[:-1]:
                for k in (-1, 0, 1):
                    c = P(k * 5, f, u + 4)
                    d.d.arc([round(c[0] - 2), round(c[1] - 2), round(c[0] + 2), round(c[1] + 2)], 20, 160, fill=hx(H['scales']))
        if H.get('dapple'):
            for k, (x, f) in enumerate(((-5, -18), (4, -10), (-3, 6), (6, 14))):
                c = P(x, f, 42 + bob); d.ell(c[0], c[1], 1.5, 1.2, dark(coat, 0.1))
        if tiger:
            for k, f in enumerate((-22, -14, -6, 4, 12, 20)):
                for sx_ in (-1, 1):
                    a = P(sx_ * 4, f, top_u - 1); b = P(sx_ * 12, f + 1, 26 + bob)
                    d.ln(a, ((a[0] + b[0]) / 2 + sx_ * 1, (a[1] + b[1]) / 2), H['stripe'], 2); d.ln(((a[0] + b[0]) / 2 + sx_, (a[1] + b[1]) / 2), b, H['stripe'], 1)
            c = P(0, -2, top_u); d.ln((c[0], c[1] - 6), (c[0], c[1] + 4), H['stripe'], 2)
    body.mark(body_marks)

    # ----- đuôi -----
    sw = math.sin(p * TAU + 1) * (4 if kind == 'run' else 0) + (1 if (kind == 'idle' and i) else 0)
    tail = Part('h', dark(mane if not tiger else coat, 0.45))
    if tiger:
        tpts = [(-29, 34), (-36, 40), (-40, 52), (-36, 60)]
        pts2 = [P(sw * (k / 3), f, u + bob) for k, (f, u) in enumerate(tpts)]
        tail.curve(pts2, 5, 3.5, coat, 12)
        tail.mark(lambda d: [d.ell(pts2[-1][0], pts2[-1][1], 2.4, 2.4, H['stripe'])] + [d.ln((pt[0] - 2, pt[1]), (pt[0] + 2, pt[1]), H['stripe']) for pt in bez(pts2, 8)[2:8:2]])
    else:
        run = kind == 'run'
        tpts = [(-29, 44), (-34, 40), (-38, 30), (-37, 18)] if not run else [(-29, 44), (-36, 44), (-43, 40), (-49, 36)]
        pts2 = [P(sw * (k / 3) * 1.2, f, u + bob) for k, (f, u) in enumerate(tpts)]
        if H.get('fire'):
            tail.curve(pts2, 6, 2, '#ff6a10'); tail.curve(pts2, 3, 1, '#ffd040')
        elif H.get('cloud'):
            tail.curve(pts2, 4.5, 2, mane); e = pts2[-1]; tail.ell(e[0], e[1], 4, 3, light(mane, 0.2))
        else:
            tail.curve(pts2, 6, 3, mane)

    # ----- cổ + đầu -----
    nod = math.sin(p * TAU * 2 + 1.2) * 1.2 if kind == 'run' else (0.5 if i else 0)
    head = []
    if tiger:
        hc = P(0, 33, 36 + bob + nod)
        hp = Part('v', soft)
        if down:
            hp.ell(hc[0], hc[1], 11.5, 10.5, coat)
            hp.ell(hc[0] - 9, hc[1] - 8, 3.5, 4, coat); hp.ell(hc[0] + 9, hc[1] - 8, 3.5, 4, coat)
            def tm(d):
                for sx_ in (-1, 1):
                    d.ell(hc[0] + sx_ * 9, hc[1] - 8, 1.6, 2, '#e8a0a8')
                    e = (hc[0] + sx_ * 4.5, hc[1] - 2); d.ell(e[0], e[1], 2.2, 1.4, '#141018'); d.ell(e[0], e[1], 1.6, 1, H['eye']); d.rect(e[0], e[1] - 1, e[0], e[1] + 1, '#101018')
                    d.ln((hc[0] + sx_ * 1.5, hc[1] - 3), (hc[0] + sx_ * 7.5, hc[1] - 5.5), H['stripe'], 2)   # mày nhíu
                    d.ln((hc[0] + sx_ * 10, hc[1] - 1), (hc[0] + sx_ * 7, hc[1]), H['stripe']); d.ln((hc[0] + sx_ * 10, hc[1] + 2), (hc[0] + sx_ * 7, hc[1] + 2.5), H['stripe'])
                d.ell(hc[0] - 3, hc[1] + 4.5, 3.5, 3, H['belly']); d.ell(hc[0] + 3, hc[1] + 4.5, 3.5, 3, H['belly'])
                d.poly([(hc[0] - 2, hc[1] + 1.5), (hc[0] + 2, hc[1] + 1.5), (hc[0], hc[1] + 3.5)], H['nose'])
                for k in range(3): d.ln((hc[0] - 3, hc[1] - 8 + k * 2), (hc[0] + 3, hc[1] - 8 + k * 2), H['stripe'])   # 王
                d.ln((hc[0], hc[1] - 8), (hc[0], hc[1] - 4), H['stripe'])
                d.ell(hc[0], hc[1] + 7, 2.6, 1.6 if not (kind == 'run' and i in (2, 3)) else 2.4, '#5a0a1a')
                for sx_ in (-1, 1): d.poly([(hc[0] + sx_ * 2.5 - 0.8, hc[1] + 6), (hc[0] + sx_ * 2.5 + 0.8, hc[1] + 6), (hc[0] + sx_ * 2.5, hc[1] + 9)], '#ffffff')   # nanh
            hp.mark(tm)
        else:
            hp.ell(hc[0], hc[1], 10, 9, coat)
            hp.ell(hc[0] - 8.5, hc[1] - 7, 3.5, 4, coat); hp.ell(hc[0] + 8.5, hc[1] - 7, 3.5, 4, coat)
            hp.mark(lambda d: [d.ln((hc[0] + k * 3, hc[1] - 8), (hc[0] + k * 2.5, hc[1] + 2), H['stripe'], 2) for k in (-2, 0, 2)])
        head = [hp]
    else:
        np_ = Part('h', soft)
        neck = [(22, 44, 8), (27, 50, 7.5), (31, 56, 7), (34, 61, 6.5)]
        nk = sorted(neck, key=lambda s_: near_f(s_[0]))
        for f, u, r in nk:
            c = P(0, f, u + bob + nod * (u - 44) / 17); np_.ell(c[0], c[1], r, r + 1, coat)
        hp = Part('v', soft)
        fh, uh = (40, 58) if down else (37, 63)
        uh += bob + nod
        if down:
            # mặt nhìn thẳng: trán ở trên, mõm ở dưới
            top = P(0, fh, uh); mz = P(0, fh + 6, uh - 15)
            hp.ell(top[0], top[1], 7, 6, coat)
            hp.poly([(top[0] - 7, top[1]), (top[0] + 7, top[1]), (mz[0] + 5.2, mz[1]), (mz[0] - 5.2, mz[1])], coat)
            hp.ell(mz[0], mz[1], 5.4, 4.2, H['muzzle'] if not dragon else coat)
            if dragon:
                hp.ell(mz[0], mz[1] + 1, 5.5, 3.2, coat)
            def hm(d):
                for sx_ in (-1, 1):
                    e = (top[0] + sx_ * 6.5, top[1] + 2)
                    d.rect(e[0] - (1 if sx_ > 0 else 0), e[1] - 1, e[0] + (0 if sx_ > 0 else 1), e[1] + 1, '#ff3020' if (H.get('eyeRed') or dragon) else '#1a1010')
                    d.ln((e[0] - sx_ * 3, e[1] - 0.5), (e[0] + sx_ * 0.5, e[1] - 3), dark(coat, 0.5), 1)   # mày xếch
                    n = (mz[0] + sx_ * 2, mz[1] + 1); d.rect(n[0], n[1], n[0], n[1] + 1, dark(H['muzzle'], 0.6))
                if H.get('armor'):
                    d.poly([(top[0] - 3.5, top[1] - 3), (top[0] + 3.5, top[1] - 3), (mz[0] + 2, mz[1] - 4), (mz[0] - 2, mz[1] - 4)], H['armor'])
                    d.ln((top[0], top[1] - 3), (mz[0], mz[1] - 4), light(H['armor'], 0.45))
                    if H.get('spike'): d.poly([(top[0] - 1.5, top[1] - 3), (top[0] + 1.5, top[1] - 3), (top[0], top[1] - 9)], '#9a96a4')
                elif H.get('blaze'):
                    d.poly([(top[0] - 1, top[1] - 3), (top[0] + 1, top[1] - 3), (mz[0] + 1.5, mz[1] - 2), (mz[0] - 1.5, mz[1] - 2)], '#f4ece0')
                if dragon:
                    d.ln((mz[0] - 4, mz[1] + 2), (mz[0] + 4, mz[1] + 2), '#3a0a0a')
                    for k in (-2, 2): d.rect(mz[0] + k, mz[1] + 2, mz[0] + k, mz[1] + 3, '#ffffff')
                else:   # dây cương trên mặt
                    d.ln((top[0] - 5, top[1] + 4), (mz[0] - 4, mz[1] - 1), '#3a2010'); d.ln((top[0] + 5, top[1] + 4), (mz[0] + 4, mz[1] - 1), '#3a2010')
                    d.ln((mz[0] - 4, mz[1] - 2), (mz[0] + 4, mz[1] - 2), '#3a2010')
            hp.mark(hm)
            face_top, face_bot = top, mz
        else:
            top = P(0, fh - 2, uh)
            hp.ell(top[0], top[1], 7, 7, coat)
            face_top, face_bot = top, top
        ep = Part('h', soft)
        et = face_top
        for sx_ in (-1, 1):
            ep.poly([(et[0] + sx_ * 2.5, et[1] - 4), (et[0] + sx_ * 7, et[1] - 3), (et[0] + sx_ * 6, et[1] - 12)], coat)
        if dragon == 'long':
            for sx_ in (-1, 1):
                a = (et[0] + sx_ * 3, et[1] - 4); b = (et[0] + sx_ * 8, et[1] - 16)
                ep.cap(a, b, 2.6, H['horn'], 1.4); m_ = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); ep.cap(m_, (m_[0] + sx_ * 4, m_[1] - 2), 1.8, H['horn'], 1)
        elif dragon == 'qilin':
            ep.cap((et[0], et[1] - 4), (et[0], et[1] - 16), 3.2, H['horn'], 1.2)
        mp = Part('h', dark(mane, 0.45))
        if down:
            fl = face_top   # chỏm bờm trán + bờm hai bên cổ
            mp.poly([(fl[0] - 3, fl[1] - 4), (fl[0] + 3, fl[1] - 4), (fl[0], fl[1] + 3)], mane if not H.get('fire') else '#ffb020')
            if H.get('fire'):
                for k, col in enumerate(('#ff5010', '#ff9a20', '#ffe060')):
                    mp.poly([(fl[0] - 6 + k, fl[1] + 2), (fl[0] + 6 - k, fl[1] + 2), (fl[0] + (k - 1) * 3, fl[1] - 14 + k * 3 + nod)], col)
        else:
            # nhìn từ sau: bờm chạy dọc sống cổ
            for k, (f, u, r) in enumerate(neck):
                c = P(0, f, u + bob + nod * (u - 44) / 17)
                w_ = 3 if not H.get('fire') else 4
                col = mane if not H.get('fire') else ['#ff5010', '#ff9a20', '#ffe060', '#ff9a20'][k]
                mp.poly([(c[0] - w_, c[1] - r), (c[0] + w_, c[1] - r), (c[0] + w_ * 0.6 + (k % 2), c[1] + 3), (c[0] - w_ * 0.6, c[1] + 3)], col)
        head = [np_, hp, mp, ep]
        if H.get('dhead'):
            from mounts_ext import dragon_face_front, dragon_head_back
            C = dict(coat=coat, belly=H['belly'], mane=H['mane'], horn=H['horn'], eye='#ffe040')
            if down: head = [np_, mp] + dragon_face_front(P(0, fh + 6, uh - 8), C, p * TAU * 2 + i, 0.95)
            else: head = [np_] + dragon_head_back(P(0, fh - 2, uh), C, p * TAU * 2 + i, 0.8) + [mp]
        if dragon and down and not H.get('dhead'):
            wp = Part(None, None, rim=False)
            sw2 = math.sin(p * TAU) * 2
            for sx_ in (-1, 1):
                a = (face_bot[0] + sx_ * 4, face_bot[1])
                wp.curve([a, (a[0] + sx_ * 7, a[1] - 2 + sw2), (a[0] + sx_ * 11, a[1] + 4 + sw2)], 1.6, 1, mane)
            head.append(wp)

    # ----- yên cương -----
    seat_f, seat_u = (-1, top_u + 1.5)
    tk = Part('v', dark(H['blanket'], 0.5))
    def drape(f):
        return [P(-13, f, 28 + bob), P(-12, f, top_u - 5), P(-6, f, top_u), P(6, f, top_u), P(12, f, top_u - 5), P(13, f, 28 + bob)]
    cl = drape(seat_f + (5 if down else -5))
    tk.poly(cl, H['blanket'])
    tk.mark(lambda d: [d.ln(cl[0], cl[1], H['trim'], 2), d.ln(cl[5], cl[4], H['trim'], 2)])
    sd = Part('v', dark(H['saddle'], 0.55))
    sc = P(0, seat_f, seat_u)
    sd.ell(sc[0], sc[1], 7, 3.5, H['saddle'])
    pm = P(0, seat_f + 7, seat_u + 2.5); ct = P(0, seat_f - 7, seat_u + 3)
    sd.ell(pm[0], pm[1], 3, 2.2, H['saddle']); sd.ell(ct[0], ct[1], 6, 2.5, H['saddle'])
    st = Part(None, None, rim=False)
    for sx_ in (-1, 1):
        a = P(sx_ * 11, seat_f, seat_u - 3); b = P(sx_ * 13, seat_f + 1, 22 + bob)
        st.ln(a, b, '#3a2414')
        st.d.rectangle([round(b[0] - 1.5), round(b[1]), round(b[0] + 1.5), round(b[1] + 2)], outline=hx('#d0c8b0'))
    seat = P(0, seat_f, seat_u - 1.5)

    # ----- dây cương + đai ngực (lớp trước khi nhìn xuống) -----
    tack = Part(None, None, rim=False)
    if down:
        ch = [P(x, 27, 36 + bob) for x in (-9, -5, 0, 5, 9)]
        for a, b in zip(ch, ch[1:]): tack.ln(a, b, '#4a2c18', 2)
        tack.ell(ch[2][0], ch[2][1] + 1, 1.6, 1.6, H['trim'])
        if not tiger:
            for sx_ in (-1, 1):
                bit = (face_bot[0] + sx_ * 4, face_bot[1] - 1)
                hand = (seat[0] + sx_ * 7, seat[1] - 8)
                rp = bez([bit, ((bit[0] + hand[0]) / 2 + sx_ * 2, (bit[1] + hand[1]) / 2 + 3), hand], 5)
                for a, b in zip(rp, rp[1:]): tack.ln(a, b, '#2a160a')
        else:
            col_ = (hc[0], hc[1] + 9)
            tack.ell(col_[0], col_[1], 1.6, 1.6, H['trim'])
            for sx_ in (-1, 1):
                hand = (seat[0] + sx_ * 7, seat[1] - 8)
                tack.ln(col_, hand, '#2a160a')

    farL = [pp for l in far_legs for pp in leg_part(*l, False)]
    nearL = [pp for l in near_legs for pp in leg_part(*l, True)]
    if down:
        # xa -> gần: chân sau, đuôi, thân, chăn + yên | người cưỡi | chân trước, cổ, đầu, dây cương
        back = farL + [tail, body, tk, sd, st]
        front = nearL + head + [tack]
    else:
        # nhìn lên: chân trước + đầu ở xa, thân, yên | người cưỡi | chân sau, đuôi
        back = farL + head + [body, tk, sd, st]
        front = nearL + [tail]
    return compose(back), compose(front), (round(seat[0], 1), round(seat[1], 1))

MOUNTS = ['ngua_nau', 'bach_ma', 'hac_ma', 'bach_ho', 'hoa_ky_lan', 'thanh_long', 'phuong_hoang', 'kim_quy', 'kim_nguu']

def sheet(mid):
    """hàng 0: nhìn ngang; 1-2: nhìn xuống (lớp sau / lớp trước người cưỡi); 3-4: nhìn lên (lớp sau / lớp trước)"""
    img = Image.new('RGBA', (CW * len(FRAMES), CH * 5), (0, 0, 0, 0))
    seats = {'side': [], 'down': [], 'up': []}
    from mounts_ext import EXT   # thú dáng riêng (rồng, phượng, rùa, trâu)
    ext = EXT.get(mid)
    for c, (kind, i) in enumerate(FRAMES):
        if ext: fr, seat = ext[0](kind, i)
        else: fr, seat = tiger_frame(TIGER, kind, i) if mid == 'bach_ho' else horse_frame(HORSE[mid], kind, i)
        img.alpha_composite(fr, (c * CW, 0)); seats['side'].append(seat)
        for r, view in ((1, 'down'), (3, 'up')):
            b, f, seat = ext[1](view, kind, i) if ext else fb_frame(mid, view, kind, i)
            img.alpha_composite(b, (c * CW, r * CH)); img.alpha_composite(f, (c * CW, (r + 1) * CH))
            seats[view].append(seat)
    return img, seats

if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else 'public/assets'
    os.makedirs(os.path.join(root, 'mounts'), exist_ok=True)
    meta = {'cell': [CW, CH], 'foot': [CW // 2, GY], 'footFB': [CW // 2, FB_GY], 'frames': {'idle': [0, 2], 'run': [2, 6]},
            'rows': {'side': [0], 'down': [1, 2], 'up': [3, 4]}, 'seat': {}, 'seats': {}}
    for mid in (sys.argv[2:] or MOUNTS):
        img, seats = sheet(mid)
        img.save(os.path.join(root, 'mounts', mid + '.png'), optimize=True)
        meta['seat'][mid] = seats['side']
        meta['seats'][mid] = seats
        print('ok', mid)
    if not sys.argv[2:]:
        with open(os.path.join(root, 'mounts.json'), 'w') as f: json.dump(meta, f)
