# Bộ dựng nhân vật pixel theo khung xương (kiểu Khí Phách Anh Hùng).
# Mỗi nhân vật = khớp 3D đơn giản -> chiếu ra 3 hướng (xuống / lên / phải), vẽ từng bộ phận
# có viền, đổ bóng, rồi ghép theo chiều sâu. Dùng: python3 tools/rig.py public/assets/chars
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw

W = H = 96          # ô khung hình
AX, AY = 48, 86     # điểm chân chạm đất
TAU = math.pi * 2

# ---------------- màu ----------------
def hx(c):
    if isinstance(c, tuple): return c if len(c) == 4 else c + (255,)
    c = c.lstrip('#'); return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)
def mix(a, b, t):
    a, b = hx(a), hx(b); return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3)) + (255,)
def dark(c, t=0.3): return mix(c, '#1a1028', t)
def light(c, t=0.3): return mix(c, '#fffaf0', t)

# ---------------- lớp vẽ từng bộ phận ----------------
def shift(m, dx, dy):
    o = np.zeros_like(m)
    h, w = m.shape
    ys, ye = max(0, dy), min(h, h + dy); xs, xe = max(0, dx), min(w, w + dx)
    o[ys:ye, xs:xe] = m[ys - dy:ye - dy, xs - dx:xe - dx]
    return o

class Part:
    def __init__(self, depth, outline=True, shade=True, side=True, rim=True, glow=False):
        self.im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); self.d = ImageDraw.Draw(self.im)
        self.depth, self.outline, self.shade, self.side, self.rim, self.glow = depth, outline, shade, side, rim, glow
        self.marks = []   # chi tiết vẽ sau khi tô bóng (mắt, hoa văn...)
    # hình cơ bản (toạ độ màn hình)
    def poly(self, pts, c): self.d.polygon([(round(x), round(y)) for x, y in pts], fill=hx(c))
    def ell(self, cx, cy, rx, ry, c): self.d.ellipse([round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry)], fill=hx(c))
    def rect(self, x0, y0, x1, y1, c): self.d.rectangle([round(x0), round(y0), round(x1), round(y1)], fill=hx(c))
    def line(self, p0, p1, c, w=1): self.d.line([(round(p0[0]), round(p0[1])), (round(p1[0]), round(p1[1]))], fill=hx(c), width=w)
    def cap(self, p0, p1, w, c):
        self.line(p0, p1, c, w)
        r = (w - 1) / 2
        if w > 2:
            for p in (p0, p1): self.ell(p[0], p[1], r, r, c)
    def mark(self, fn): self.marks.append(fn)
    def finish(self):
        a = np.array(self.im).astype(np.int32)
        m = a[..., 3] > 0
        if not m.any(): return None
        rgb = a[..., :3].astype(float)
        if self.shade:
            if self.side:   # khối: nửa phải mỗi hàng tối hơn (ánh sáng từ trái)
                for y in np.where(m.any(1))[0]:
                    xs = np.where(m[y])[0]; x0, x1 = xs.min(), xs.max(); wdt = x1 - x0 + 1
                    if wdt >= 4:
                        cut = x0 + wdt * 0.62
                        sel = m[y] & (np.arange(W) > cut)
                        rgb[y, sel] = rgb[y, sel] * 0.78 + np.array([26, 16, 40]) * 0.22
            sh = m & ~shift(m, -1, -1)          # mép dưới-phải
            rgb[sh] = rgb[sh] * 0.74 + np.array([26, 16, 40]) * 0.26
            if self.rim:
                li = m & ~shift(m, 1, 1)        # mép trên-trái sáng
                rgb[li] = rgb[li] * 0.7 + 255 * 0.3
        out = np.zeros((H, W, 4), np.uint8)
        out[..., :3] = np.clip(rgb, 0, 255); out[..., 3] = a[..., 3]
        img = Image.fromarray(out, 'RGBA')
        if self.marks:
            d = ImageDraw.Draw(img); self.d = d
            for fn in self.marks: fn(self)
            out = np.array(img); m = out[..., 3] > 0
        if self.outline:
            ring = (shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)) & ~m
            out[ring] = (24, 14, 30, 255)
        return Image.fromarray(out, 'RGBA')

# ---------------- chiếu 3D -> màn hình ----------------
# hệ toạ độ nhân vật: Rt = bên phải nhân vật, F = phía trước, U = lên trên
def projector(view, ox=0, oy=0):
    def P(p):
        Rt, F, U = p
        if view == 'down': sx, dp = -Rt, F
        elif view == 'up': sx, dp = Rt, -F
        else: sx, dp = F, Rt
        return (AX + sx + ox, AY - U + dp * 0.28 + oy, dp)
    return P

def v_add(a, b, k=1): return (a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k)

def limb_dir(a, b, side):
    """a = góc vung trước/sau (0 = buông thõng, + = ra trước), b = giạng sang ngang"""
    return (side * math.sin(b), math.sin(a) * math.cos(b), -math.cos(a) * math.cos(b))

def solve(body, pose):
    """trả về các khớp 3D"""
    J = {}
    lean, twist = pose.get('lean', 0), pose.get('twist', 0)
    hipU = body['hip']
    J['hip'] = (0, pose.get('hipF', 0), hipU)
    torso_len = body['torso']
    # vai: xoay theo twist (quay người), nghiêng theo lean
    sh = (0, math.sin(lean) * torso_len + pose.get('hipF', 0), hipU + math.cos(lean) * torso_len)
    J['neck'] = sh
    for side, key in ((1, 'R'), (-1, 'L')):
        off = body['shoulder'] * side
        J['sh' + key] = (math.cos(twist) * off + sh[0], sh[1] - math.sin(twist) * off, sh[2] - 1)
        arm = pose.get('arm' + key, (0, 0.12, 0.2))
        a, b, e = arm[0], arm[1], arm[2]
        d1 = limb_dir(a, b, side)
        J['el' + key] = v_add(J['sh' + key], d1, body['upper'])
        d2 = limb_dir(a + e, b, side)
        J['ha' + key] = v_add(J['el' + key], d2, body['fore'])
        # chân
        hoff = body['hipw'] * side
        J['hp' + key] = (math.cos(twist * 0.3) * hoff, pose.get('hipF', 0) - math.sin(twist * 0.3) * hoff, hipU)
        la, lk = pose.get('leg' + key, (0, 0))
        d1 = limb_dir(la, pose.get('legb', 0.04), side)
        J['kn' + key] = v_add(J['hp' + key], d1, body['thigh'])
        d2 = limb_dir(la - lk, pose.get('legb', 0.04), side)
        J['an' + key] = v_add(J['kn' + key], d2, body['shin'])
    J['head'] = v_add(sh, (0, math.sin(lean) * 2, 1), 1)
    J['head'] = (J['head'][0], J['head'][1], J['head'][2] + body['neck'] + body['headr'])
    # chạm đất
    if not pose.get('air'):
        low = min(J['anR'][2], J['anL'][2])
        dz = -low + pose.get('lift', 0)
        J = {k: (v[0], v[1], v[2] + dz) for k, v in J.items()}
    return J

# ---------------- vóc dáng ----------------
BODY = {
    'normal': dict(hip=20, torso=15, shoulder=6.5, hipw=3.6, upper=7.5, fore=7.0, thigh=10, shin=10, neck=1, headr=9.5),
    'heavy':  dict(hip=20, torso=16, shoulder=8.2, hipw=4.2, upper=8.0, fore=7.5, thigh=10, shin=10, neck=0.5, headr=9.5),
    'slim':   dict(hip=20, torso=14.5, shoulder=5.6, hipw=3.3, upper=7.2, fore=6.8, thigh=10, shin=10, neck=1, headr=9.2),
}

def ring(cen, U, rx, rf, P, shiftR=0, shiftL=0, n=16):
    pts = []
    for i in range(n):
        t = i / n * TAU
        Rt, F = math.cos(t) * rx, math.sin(t) * rf
        F += shiftR if Rt > 0.5 else shiftL if Rt < -0.5 else (shiftR + shiftL) / 2
        pts.append(P((cen[0] + Rt, cen[1] + F, U)))
    return pts

def hull(pts):
    pts = sorted(set((round(p[0], 2), round(p[1], 2)) for p in pts))
    if len(pts) < 3: return pts
    def cross(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]

# ---------------- trang phục 9 môn phái ----------------
SKIN = '#f6cba2'
LOOK = {
    'vodang':     dict(body='normal', robe='#eef2fa', robe2='#c2d0ea', trim='#3d5ca8', belt='#3d5ca8', pants='#58627e', shoe='#262434', hair='#262030', style='taoist', hem=6, sleeve='wide', weapon='sword', wcol='#e4ecff', glow='#8fc8ff'),
    'ngamy':      dict(body='slim', robe='#fde6ee', robe2='#f6b0c8', trim='#e2568c', belt='#e2568c', pants='#f2b4ca', shoe='#8a3058', hair='#3a2230', style='buns', hem=5, sleeve='wide', weapon='sword', wcol='#fff0fa', glow='#ff8cc6', female=True),
    'thuyyen':    dict(body='slim', robe='#3c6cc4', robe2='#a6d2ff', trim='#c8e6ff', belt='#1c3470', pants='#223c74', shoe='#141c38', hair='#141a36', style='ponytail', hem=11, sleeve='tight', weapon='daggers', wcol='#d8ecff', glow='#7cdcff', female=True),
    'thieulam':   dict(body='normal', robe='#f2a634', robe2='#c4441c', trim='#9a4a1e', belt='#8a3a1a', pants='#f6e4ba', shoe='#4a2c20', hair=None, style='bald', hem=6, sleeve='wide', weapon='staff', wcol='#b07834', glow='#ffd84a', beads=True),
    'thienvuong': dict(body='heavy', robe='#c62c24', robe2='#7c1a16', trim='#f2be4c', belt='#f2be4c', pants='#3c2a2e', shoe='#2a1a16', hair='#3a2216', style='warrior', hem=7, sleeve='tight', weapon='hammer', wcol='#c8d0de', glow='#ff7030', armor=True, beard=True),
    'duongmon':   dict(body='normal', robe='#2f7c3a', robe2='#1a3a22', trim='#141c18', belt='#4a3a26', pants='#1e2c20', shoe='#141814', hair='#141418', style='straw', hem=12, sleeve='tight', weapon='knife', wcol='#e8f0e8', glow='#a8ff7c'),
    'ngudoc':     dict(body='normal', robe='#5c2484', robe2='#2c1444', trim='#9ee04e', belt='#9ee04e', pants='#361852', shoe='#1c1424', hair='#18121e', style='turban', hem=9, sleeve='tight', weapon='saber', wcol='#b4f474', glow='#90ff4c'),
    'caibang':    dict(body='heavy', robe='#cdc3b0', robe2='#8a7a66', trim='#7a5e44', belt='#6a4a30', pants='#b26c38', shoe='#3c2a20', hair='#4a3020', style='messy', hem=14, sleeve='tight', weapon='palm', wcol='#a26c3a', glow='#ffc84a', scarf='#ec8c2a', gourd=True, patches=True),
    'conlon':     dict(body='normal', robe='#f4c450', robe2='#5c2f82', trim='#5c2f82', belt='#5c2f82', pants='#4a2a5a', shoe='#24142c', hair='#1e1426', style='official', hem=6, sleeve='wide', weapon='talisman', wcol='#ffe48c', glow='#d8a4ff'),
}

# ---------------- tóc / mũ ----------------
def hair_cap(pt, cx, cy, r, view, col, fringe=True):
    hl = light(col, 0.42)
    if view == 'up':
        pt.mark(lambda q: (q.line((cx - r + 3, cy - r + 3), (cx - 2, cy - r + 0.5), hl), q.line((cx - r + 2, cy - 1), (cx - r + 3, cy - r + 4), hl)))
    elif view == 'down':
        pt.mark(lambda q: q.line((cx - r + 2.5, cy - r + 3.5), (cx - 2, cy - r + 1), hl))
    else:
        pt.mark(lambda q: q.line((cx - r + 1, cy - r + 3.5), (cx + 1, cy - r + 1), hl))
    if view == 'up':
        pt.ell(cx, cy - 0.5, r + 1, r * 0.98, col); return
    if view == 'down':
        pt.ell(cx, cy - 1.8, r + 1.2, r * 0.82, col)
        if fringe:
            pts = [(cx - r + 1.5, cy - 1.5)]
            for i in range(6):
                x = cx - r + 1.5 + (2 * r - 3) * (i + 0.5) / 6
                pts += [(x, cy - 0.5 + (1 if i % 2 else 0)), (x + (2 * r - 3) / 12, cy - 2)]
            pts += [(cx + r - 1.5, cy - 1.5), (cx + r - 1.5, cy + r), (cx - r + 1.5, cy + r)]
            pt.poly(pts, (0, 0, 0, 0))
    else:  # nhìn phải
        pt.ell(cx - 1, cy - 1.6, r + 1.1, r * 0.86, col)
        pt.poly([(cx + 0.5, cy - 1.5), (cx + 2.5, cy - 3), (cx + r + 3, cy - 3), (cx + r + 3, cy + r + 2), (cx + 0.5, cy + r + 2)], (0, 0, 0, 0))
        pt.poly([(cx + 0.5, cy - 4), (cx + r + 0.5, cy - 4.5), (cx + r - 1, cy - 2), (cx + 2, cy - 1.5)], col)  # mái

def draw_hair(L, view, cx, cy, r, sway, back):
    """back=True: phần tóc phía sau đầu (vẽ trước đầu khi nhìn xuống/nghiêng)"""
    st, hc = L['style'], L.get('hair')
    pt = Part(0, side=False)
    H2 = dark(hc, 0.25) if hc else None
    if back:
        if st == 'taoist':
            if view == 'up': pt.poly([(cx - r, cy), (cx + r, cy), (cx + r - 1, cy + r + 8), (cx, cy + r + 10), (cx - r + 1, cy + r + 8)], hc)
            elif view == 'right': pt.poly([(cx - r - 1, cy - 1), (cx - 1, cy), (cx - 3 - sway, cy + r + 9), (cx - r - 3 - sway, cy + r + 7)], hc)
            else: pt.poly([(cx - r - 1, cy), (cx + r + 1, cy), (cx + r, cy + r + 5), (cx - r, cy + r + 5)], H2)
        elif st == 'buns':
            if view != 'down': pt.poly([(cx - r + 1, cy), (cx + r - 1, cy), (cx + r - 2, cy + r + 4), (cx - r + 2, cy + r + 4)], hc)
        elif st == 'ponytail':
            if view == 'right': pt.poly([(cx - r, cy - r + 1), (cx - r + 3, cy - r), (cx - r - 3 - sway, cy + r + 8), (cx - r - 6 - sway, cy + r + 5)], hc)
            elif view == 'up': pt.poly([(cx - 2, cy - r + 2), (cx + 2, cy - r + 2), (cx + 2 + sway * 0.5, cy + r + 9), (cx - 2 + sway * 0.5, cy + r + 10)], hc)
            else: pt.poly([(cx + r - 2, cy - r + 1), (cx + r + 1, cy - r + 2), (cx + r + 3 + sway * 0.5, cy + r + 6), (cx + r, cy + r + 5)], hc)
        elif st == 'turban':
            if view != 'down': pt.poly([(cx - 1, cy - 2), (cx + 2, cy - 2), (cx - 2 - sway, cy + r + 6), (cx - 5 - sway, cy + r + 4)] if view == 'right' else [(cx - 2, cy), (cx + 2, cy), (cx + 1 + sway * 0.4, cy + r + 7), (cx - 2 + sway * 0.4, cy + r + 7)], L['trim'])
        elif st == 'warrior':
            rb = '#e8402a'
            if view == 'right': pt.poly([(cx - r + 1, cy - 3), (cx - r + 2, cy - 4), (cx - r - 4 - sway, cy + 4), (cx - r - 5 - sway, cy + 2)], rb)
            elif view == 'up': pt.poly([(cx - 1, cy - 3), (cx + 1, cy - 3), (cx + 2 + sway * 0.4, cy + 6), (cx - 2 + sway * 0.4, cy + 6)], rb)
        elif st == 'messy':
            if view == 'right': pt.poly([(cx - r + 1, cy - 3), (cx - r + 2, cy - 4), (cx - r - 4 - sway, cy + 3), (cx - r - 5 - sway, cy + 1)], dark(L['robe2'], 0.2))
        return pt
    # ------- phần trước -------
    if st == 'bald':
        pt = Part(0, outline=False, shade=False)
        if view == 'down':
            for dx, dy in ((-2, -5), (0, -5.5), (2, -5), (-1, -3.5), (1, -3.5)):
                pt.rect(cx + dx, cy + dy, cx + dx, cy + dy, '#b4643a')
        elif view == 'up':
            pass
        else:
            for dx, dy in ((0, -6), (2, -5.5), (-2, -5.5)): pt.rect(cx + dx, cy + dy, cx + dx, cy + dy, '#b4643a')
        return pt
    if st == 'taoist':
        hair_cap(pt, cx, cy, r, view, hc)
        pt.ell(cx - (1 if view == 'right' else 0), cy - r - 1.5, 2.6, 2.4, hc)
        pt.rect(cx - 3 - (1 if view == 'right' else 0), cy - r - 0.5, cx + 2 - (1 if view == 'right' else 0), cy - r + 0.5, '#d8dce8')   # mão bạc
        pt.line((cx - 5, cy - r - 2), (cx + 4, cy - r - 1), '#e8d070')
    elif st == 'buns':
        hair_cap(pt, cx, cy, r, view, hc)
        for sx in ((-1, 1) if view != 'right' else (-1,)):
            bx = cx + sx * (r - 1) - (2 if view == 'right' else 0)
            pt.ell(bx, cy - r + 0.5, 2.8, 2.6, hc)
            pt.rect(bx - 1, cy - r + 2, bx + 1, cy - r + 3, '#ff6aa6')
        if view == 'down': pt.rect(cx - 1, cy - r - 0.5, cx + 1, cy - r + 0.5, '#ff9ac4')
    elif st == 'ponytail':
        hair_cap(pt, cx, cy, r, view, hc)
        pt.ell(cx - (2 if view == 'right' else 0), cy - r - 0.5, 2.4, 2.2, hc)
        pt.rect(cx - 2 - (2 if view == 'right' else 0), cy - r + 1, cx + 2 - (2 if view == 'right' else 0), cy - r + 1.8, L['trim'])
    elif st == 'warrior':
        hair_cap(pt, cx, cy, r, view, hc)
        pt.ell(cx - (1 if view == 'right' else 0), cy - r - 1.5, 2.6, 2.4, hc)
        pt.rect(cx - r - 0.5, cy - 4, cx + r + 0.5, cy - 2.6, '#e8402a')     # khăn đỏ
        if view != 'right': pt.rect(cx - 1, cy - 4.5, cx + 1, cy - 2.3, '#f2be4c')
    elif st == 'straw':
        hair_cap(pt, cx, cy, r, view, hc)
        hat = '#556a3a'
        bw = r * 1.75
        pt.poly([(cx - bw, cy - 2.5), (cx + bw, cy - 2.5), (cx + 1, cy - r - 6.5), (cx - 1, cy - r - 6.5)], hat)
        pt.ell(cx, cy - 2.5, bw, 1.6, dark(hat, 0.25))
        for k in (-0.55, 0, 0.55): pt.line((cx, cy - r - 6), (cx + bw * k, cy - 3), dark(hat, 0.35))
        pt.rect(cx - 1, cy - r - 7.5, cx + 1, cy - r - 6, '#c8c48c')
    elif st == 'turban':
        tc = '#3c1658'
        if view == 'up': pt.ell(cx, cy - 1, r + 1.5, r + 0.5, tc)
        elif view == 'down':
            pt.ell(cx, cy - 2.5, r + 1.6, r * 0.8, tc)
            pt.poly([(cx - r + 1, cy - 1.8), (cx + r - 1, cy - 1.8), (cx + r, cy + r), (cx - r, cy + r)], (0, 0, 0, 0))
            pt.rect(cx - r + 1, cy - 2, cx - r + 2.5, cy + 1, hc); pt.rect(cx + r - 2.5, cy - 2, cx + r - 1, cy + 1, hc)
            pt.poly([(cx - r + 1, cy + 4.5), (cx + r - 1, cy + 4.5), (cx + r - 3, cy + r), (cx - r + 3, cy + r)], '#4e2c66')  # khăn che mặt
        else:
            pt.ell(cx - 1, cy - 2.4, r + 1.4, r * 0.82, tc)
            pt.poly([(cx + 1, cy - 1.6), (cx + r + 3, cy - 1.6), (cx + r + 3, cy + r + 2), (cx + 1, cy + r + 2)], (0, 0, 0, 0))
            pt.poly([(cx + 1, cy + 4.5), (cx + r + 0.5, cy + 4.5), (cx + r - 1, cy + r), (cx + 1, cy + r)], L['robe2'])
        pt.rect(cx - r - 1, cy - 3.5, cx + r + 1, cy - 2.6, L['trim'])
    elif st == 'messy':
        hair_cap(pt, cx, cy, r, view, hc)
        for i in range(5):
            x = cx - r + 1 + i * (2 * r - 2) / 4 - (1 if view == 'right' else 0)
            pt.poly([(x - 1.5, cy - r + 1), (x + 1.5, cy - r + 1), (x + 0.5 + (i - 2) * 0.6, cy - r - 2.5)], hc)
        pt.rect(cx - r - 0.6, cy - 3.6, cx + r + 0.6, cy - 2.4, dark(L['robe2'], 0.2))
    elif st == 'official':
        hair_cap(pt, cx, cy, r, view, hc)
        hc2 = L['robe2']
        pt.poly([(cx - 4, cy - r + 1), (cx + 4, cy - r + 1), (cx + 3, cy - r - 4.5), (cx - 3, cy - r - 4.5)], hc2)
        pt.ell(cx, cy - r + 1, r + 2.5, 1.6, dark(hc2, 0.15))
        pt.rect(cx - 3.5, cy - r - 1.2, cx + 3.5, cy - r - 0.4, '#f4c450')
        pt.ell(cx, cy - r - 5.5, 1.4, 1.4, '#f4c450')
        if view == 'down': pt.rect(cx - 0.5, cy - r - 3, cx + 0.5, cy - r - 2, '#e8402a')
    return pt

# ---------------- vũ khí ----------------
def unit(v):
    n = math.sqrt(sum(c * c for c in v)) or 1; return tuple(c / n for c in v)

def weapon_line(L, J, pose):
    """(gốc, mũi) của vũ khí trong 3D, dùng cho vẽ và vệt chém"""
    k = L['weapon']
    armR = pose.get('armR', (0, 0, 0))
    hand = J['haR']
    if k == 'staff':
        if pose.get('two'):
            d = unit(tuple(J['haR'][i] - J['haL'][i] for i in range(3)))
            c = tuple((J['haR'][i] + J['haL'][i]) / 2 for i in range(3))
            return v_add(c, d, -13), v_add(c, d, 17)
        d = unit(limb_dir(pose.get('wa', math.pi), pose.get('wb', 0.0), 1))
        return v_add(hand, d, -11), v_add(hand, d, 19)
    if k == 'hammer':
        d = unit(limb_dir(armR[0] + armR[2] + pose.get('w', 0), armR[1], 1))
        return v_add(hand, d, -3), v_add(hand, d, 18)
    if k in ('sword', 'saber'):
        d = unit(limb_dir(armR[0] + armR[2] + pose.get('w', 1.4), armR[1], 1))
        return v_add(hand, d, -2), v_add(hand, d, 16 if k == 'sword' else 14)
    if k == 'daggers':
        d = unit(limb_dir(armR[0] + armR[2] + pose.get('w', 1.2), armR[1], 1))
        return v_add(hand, d, -1), v_add(hand, d, 8)
    if k == 'knife':
        d = unit(limb_dir(armR[0] + armR[2] + pose.get('w', 1.5), armR[1], 1))
        return v_add(hand, d, 0), v_add(hand, d, 6)
    if k == 'talisman':
        d = unit(limb_dir(armR[0] + armR[2] + pose.get('w', 1.5), armR[1], 1))
        return v_add(hand, d, 0), v_add(hand, d, 6)
    return hand, v_add(hand, unit(limb_dir(armR[0] + armR[2], armR[1], 1)), 3)

def draw_weapon(L, J, pose, P):
    k = L['weapon']
    if k == 'palm' or pose.get('noweapon'): return []
    parts = []
    b3, t3 = weapon_line(L, J, pose)
    b, t = P(b3), P(t3)
    wc = L['wcol']
    pt = Part((b[2] + t[2]) / 2 + 0.6, side=False)
    if k in ('sword', 'saber'):
        pt.line(b[:2], t[:2], wc, 2)
        pt.line(b[:2], t[:2], light(wc, 0.5), 1)
        g = P(v_add(b3, unit(tuple(t3[i] - b3[i] for i in range(3))), 2))
        nx, ny = t[1] - b[1], -(t[0] - b[0]); n = math.hypot(nx, ny) or 1
        pt.line((g[0] - nx / n * 2, g[1] - ny / n * 2), (g[0] + nx / n * 2, g[1] + ny / n * 2), '#e8c050', 1)
        pt.line(b[:2], g[:2], '#5a3420', 2)
        if k == 'saber': pt.line(((b[0] + t[0]) / 2, (b[1] + t[1]) / 2), t[:2], light(wc, 0.2), 2)
    elif k == 'staff':
        pt.line(b[:2], t[:2], wc, 2)
        for e in (b, t): pt.ell(e[0], e[1], 1.2, 1.2, '#f2c24a')
    elif k == 'hammer':   # chùy gai
        pt.line(b[:2], t[:2], '#6a4024', 2)
        dx, dy = t[0] - b[0], t[1] - b[1]; n = math.hypot(dx, dy) or 1
        cx, cy = t[0] - dx / n * 2, t[1] - dy / n * 2
        for i in range(6):
            a_ = i / 6 * TAU + 0.3
            pt.line((cx, cy), (cx + math.cos(a_) * 6, cy + math.sin(a_) * 6), '#f2be4c', 1)
        pt.ell(cx, cy, 4.2, 4.2, '#7c8292')
        pt.mark(lambda q: q.rect(cx - 2, cy - 2, cx - 1, cy - 1, '#e8ecf4'))
    elif k == 'daggers':
        for key in ('R', 'L'):
            arm = pose.get('arm' + key, (0, 0, 0)); side = 1 if key == 'R' else -1
            d = unit(limb_dir(arm[0] + arm[2] + pose.get('w', 1.2), arm[1], side))
            h = J['ha' + key]
            p0, p1 = P(v_add(h, d, -1)), P(v_add(h, d, 8))
            q = Part((p0[2] + p1[2]) / 2 + 0.6, side=False)
            q.line(p0[:2], p1[:2], wc, 2); q.line(p0[:2], p1[:2], '#ffffff', 1)
            parts.append(q)
        return parts
    elif k == 'knife':
        pt.line(b[:2], t[:2], wc, 2); pt.rect(b[0] - 0.5, b[1] - 0.5, b[0] + 0.5, b[1] + 0.5, '#3a2a20')
    elif k == 'talisman':
        pt.poly([(b[0] - 1.5, b[1] - 2.5), (b[0] + 1.5, b[1] - 2.5), (b[0] + 1.5, b[1] + 3), (b[0] - 1.5, b[1] + 3)], '#ffe48c')
        pt.line((b[0], b[1] - 1.5), (b[0], b[1] + 2), '#d0302a')
    parts.append(pt)
    return parts

# ---------------- dựng 1 khung hình ----------------
def render(cls, view, pose, prev=None, eyes=True, sway=0):
    L = LOOK[cls]; body = BODY[L['body']]
    J = solve(body, pose)
    P = projector(view)
    parts = []
    skin = SKIN
    robe, robe2, trim = L['robe'], L['robe2'], L['trim']
    # ---- chân ----
    for key in ('L', 'R'):
        hp, kn, an = P(J['hp' + key]), P(J['kn' + key]), P(J['an' + key])
        pt = Part(-2 + an[2] * 0.01)
        pt.cap(hp[:2], kn[:2], 6, L['pants']); pt.cap(kn[:2], an[:2], 5, L['pants'])
        boot = P(v_add(J['an' + key], (0, 0, 3)))
        pt.cap(boot[:2], an[:2], 5, L['shoe'])
        toe = P(v_add(J['an' + key], (0, 3, 0)))
        pt.cap(an[:2], toe[:2], 4, L['shoe'])
        parts.append(pt)
    # ---- áo choàng ----
    hip, neck = J['hip'], J['neck']
    shR = J['shR']; shL = J['shL']
    hemU = max(1.5, L['hem'] * 1.18)
    knR, knL = J['knR'], J['knL']
    kfR, kfL = (knR[1] - hip[1]) * 0.8, (knL[1] - hip[1]) * 0.8
    sw_ = body['shoulder']
    top = ring((neck[0], neck[1], 0), neck[2] - 1, sw_ + 0.8, 4.4, P)
    waist = ring((hip[0], hip[1], 0), hip[2] + 3, body['hipw'] + 2.4, 4.3, P)
    if L['hem'] < hip[2]:
        hem = ring((hip[0], hip[1], 0), hemU, body['hipw'] + 5.2 + (0 if L['hem'] > 9 else 1.2), 6.4, P, kfR, kfL)
    else:
        hem = ring((hip[0], hip[1], 0), hip[2] - 1, body['hipw'] + 2.8, 3.6, P)
    shape = hull(top + waist + hem)
    rp = Part(0)
    rp.poly(shape, robe)
    if L.get('armor'):
        chest = hull(ring((neck[0], neck[1], 0), neck[2] - 2, sw_ - 0.5, 2.8, P) + ring((hip[0], hip[1], 0), hip[2] + 4, body['hipw'] + 1.5, 3, P))
        if view != 'up':
            rp.poly(chest, robe2)
            c = P((0, neck[1] + (3 if view != 'up' else -3), neck[2] - 5))
            rp.ell(c[0] if view == 'down' else c[0] + 1, c[1], 2, 2, trim)
        tasset = hull(ring((hip[0], hip[1], 0), hip[2] + 1, body['hipw'] + 3, 3.2, P) + ring((hip[0], hip[1], 0), hip[2] - 6, body['hipw'] + 4.5, 4, P, kfR, kfL))
        rp.poly(tasset, robe2)
    # cổ áo / hoa văn
    nk = P(neck)
    if view == 'down':
        chest = P((hip[0], hip[1] + 2.6, hip[2] + 5))
        if not L.get('armor'):
            rp.poly([(nk[0] - 3, nk[1] + 1), (nk[0] + 3, nk[1] + 1), (nk[0], nk[1] + 5)], L.get('inner', robe2))
            rp.line((nk[0] + 3, nk[1] + 1), (chest[0] - 2, chest[1] + 2), trim, 1)
            rp.line((nk[0] - 3, nk[1] + 1), (nk[0], nk[1] + 5), trim, 1)
            hm = P((hip[0], hip[1] + 4, hemU + 0.5))
            rp.line((chest[0] - 2, chest[1] + 3), (hm[0] - 2, hm[1]), dark(robe, 0.18), 1)
        if cls == 'thieulam':  # áo cà sa chéo vai
            rp.poly([(nk[0] + 4, nk[1] - 0.5), (nk[0] + 6.5, nk[1] + 1.5), (chest[0] - 4, chest[1] + 5), (chest[0] - 6, chest[1] + 2)], robe2)
    elif view == 'right':
        chest = P((hip[0], hip[1] + 3, hip[2] + 5))
        if not L.get('armor'):
            rp.line((nk[0] + 1.5, nk[1] + 1), (chest[0] + 1, chest[1] + 2), trim, 1)
        if cls == 'thieulam':
            rp.poly([(nk[0] - 2, nk[1] - 0.5), (nk[0] + 1, nk[1]), (chest[0] + 2, chest[1] + 4), (chest[0] - 1, chest[1] + 4)], robe2)
    else:
        if cls == 'thieulam':
            chest = P((hip[0], hip[1] - 3, hip[2] + 5))
            rp.poly([(nk[0] - 4, nk[1] - 0.5), (nk[0] - 6.5, nk[1] + 1.5), (chest[0] + 4, chest[1] + 5), (chest[0] + 6, chest[1] + 2)], robe2)
        rp.line((nk[0], nk[1] + 2), (nk[0], P(hip)[1] - 2), dark(robe, 0.12), 1)
    # thắt lưng
    belt = hull(ring((hip[0], hip[1], 0), hip[2] + 1.2, body['hipw'] + 2.7, 3.8, P) + ring((hip[0], hip[1], 0), hip[2] + 3.4, body['hipw'] + 2.6, 3.7, P))
    rp.poly(belt, L['belt'])
    if view == 'down':
        bk = P((hip[0], hip[1] + 3, hip[2] + 2.2))
        rp.rect(bk[0] - 1, bk[1] - 1, bk[0] + 1, bk[1] + 0.5, light(L['belt'], 0.35))
        if L['hem'] < 9 and not L.get('armor'):   # vạt áo trong + nếp gấp
            hm = P((hip[0], hip[1] + 5, hemU + 0.8))
            rp.poly([(bk[0] - 1.5, bk[1] + 1), (bk[0] + 1.5, bk[1] + 1), (hm[0] + 3, hm[1]), (hm[0] - 3, hm[1])], robe2)
            rp.line((bk[0] - 1.5, bk[1] + 1), (hm[0] - 3, hm[1]), trim); rp.line((bk[0] + 1.5, bk[1] + 1), (hm[0] + 3, hm[1]), trim)
            for dx in (-6, 6):
                f0 = P((hip[0] - dx * 0.6, hip[1] + 4, hip[2] - 2)); f1 = P((hip[0] - dx, hip[1] + 5, hemU + 1.5))
                rp.line(f0[:2], f1[:2], dark(robe, 0.16))
        if L['hem'] < hip[2] - 3:
            rp.poly([(bk[0] - 1, bk[1] + 1), (bk[0] + 1, bk[1] + 1), (bk[0] + 1.5, bk[1] + 6), (bk[0] - 1.5, bk[1] + 6)], L['belt'])
    # viền gấu áo
    edge = [p for p in hem if p[2] >= -0.5]
    edge.sort(key=lambda p: p[0])
    if len(edge) > 1:
        for a, b in zip(edge, edge[1:]): rp.line(a[:2], b[:2], trim, 2)
    if L.get('patches') and view != 'up':
        c = P((hip[0], hip[1] + 3, hip[2] + 6)); rp.rect(c[0] + 1, c[1] - 1, c[0] + 3, c[1] + 1, robe2)
        c = P((hip[0], hip[1] + 4, hemU + 3)); rp.rect(c[0] - 4, c[1] - 1, c[0] - 2, c[1] + 1, robe2)
    parts.append(rp)
    # khăn quàng / chuỗi hạt / hồ lô
    if L.get('scarf'):
        sp = Part(0.3)
        sc = ring((neck[0], neck[1], 0), neck[2] - 0.5, sw_ - 0.5, 2.8, P) + ring((neck[0], neck[1], 0), neck[2] - 3, sw_, 3, P)
        sp.poly(hull(sc), L['scarf'])
        tail = P((neck[0] + 2, neck[1] + (-3 if view != 'down' else 3), neck[2] - 3))
        sp.poly([(tail[0] - 1, tail[1]), (tail[0] + 2, tail[1]), (tail[0] + 1 - sway * 0.6, tail[1] + 7), (tail[0] - 2 - sway * 0.6, tail[1] + 6)], dark(L['scarf'], 0.1))
        parts.append(sp)
    if L.get('beads') and view == 'down':
        bp = Part(0.35, outline=False, shade=False)
        for i in range(9):
            t = math.pi * (0.1 + 0.8 * i / 8)
            x = nk[0] + math.cos(t) * 4.5; y = nk[1] + 0.5 + math.sin(t) * 4
            bp.rect(x, y, x + 1, y + 1, '#5a2e1a'); bp.rect(x, y, x, y, '#c08048')
        parts.append(bp)
    if L.get('gourd'):
        g = P((hip[0] - 4.5, hip[1] + 1, hip[2] + 0.5))
        gp = Part(g[2] + 0.05)
        gp.ell(g[0], g[1] + 2, 2.2, 2.6, '#c08a3c'); gp.ell(g[0], g[1] - 1.5, 1.4, 1.5, '#c08a3c'); gp.rect(g[0] - 1, g[1] - 0.2, g[0] + 1, g[1] + 0.3, '#7a3a1a')
        parts.append(gp)
    # ---- tay ----
    for key, side in (('R', 1), ('L', -1)):
        s, e, h = P(J['sh' + key]), P(J['el' + key]), P(J['ha' + key])
        dp = max(h[2], s[2]) + (0.1 if view != 'right' else 0)
        ap = Part(dp)
        ap.cap(s[:2], e[:2], 5, robe)
        if L['sleeve'] == 'wide':
            dx, dy = h[0] - e[0], h[1] - e[1]; n = math.hypot(dx, dy) or 1
            nx, ny = -dy / n, dx / n
            w0, w1 = 2.4, 4.4
            cuff = (e[0] + dx * 0.85, e[1] + dy * 0.85)
            ap.poly([(e[0] + nx * w0, e[1] + ny * w0), (e[0] - nx * w0, e[1] - ny * w0), (cuff[0] - nx * w1, cuff[1] - ny * w1), (cuff[0] + nx * w1, cuff[1] + ny * w1)], robe)
            ap.line((cuff[0] - nx * w1, cuff[1] - ny * w1), (cuff[0] + nx * w1, cuff[1] + ny * w1), trim, 1)
        else:
            ap.cap(e[:2], h[:2], 5, robe)
            br = (e[0] + (h[0] - e[0]) * 0.55, e[1] + (h[1] - e[1]) * 0.55)
            ap.cap(br, (e[0] + (h[0] - e[0]) * 0.9, e[1] + (h[1] - e[1]) * 0.9), 4, trim if not L.get('armor') else L['trim'])
        ap.ell(h[0], h[1], 2, 2, skin)
        if L.get('armor'):
            ap.ell(s[0], s[1] - 0.5, 3.2, 2.6, robe2); ap.line((s[0] - 3, s[1] - 2), (s[0] + 3, s[1] - 2), trim, 1)
        parts.append(ap)
    # ---- đầu ----
    hc = P(J['head']); cx, cy = hc[0], hc[1]; r = body['headr']
    hp = Part(1.0)
    hp.ell(cx, cy, r, r * 0.93, skin)
    if view == 'down':
        hp.rect(cx - r - 0.5, cy, cx - r + 0.5, cy + 2, dark(skin, 0.15)); hp.rect(cx + r - 0.5, cy, cx + r + 0.5, cy + 2, dark(skin, 0.15))
    elif view == 'right':
        hp.rect(cx + r - 1, cy + 0.5, cx + r + 0.6, cy + 1.5, skin)   # mũi
        hp.rect(cx - 2, cy, cx - 1, cy + 2, dark(skin, 0.18))         # tai
    female = L.get('female'); hcol = L.get('hair') or '#2a1a14'
    def face(pt):
        iris = L.get('iris', '#3a2a5a')
        if view == 'down':
            for ex in (cx - 4, cx + 2):
                if eyes:
                    pt.rect(ex, cy + 0.5, ex + 2, cy + 3.5, '#1e1628')
                    pt.rect(ex + (1 if ex < cx else 0), cy + 2, ex + (2 if ex < cx else 1), cy + 3.5, iris)
                    pt.rect(ex + (0 if ex < cx else 1), cy + 0.5, ex + (0 if ex < cx else 1), cy + 1.5, '#ffffff')
                    if female: pt.rect(ex - (1 if ex < cx else -3), cy, ex - (1 if ex < cx else -3), cy + 0.5, '#1e1628')
                else: pt.rect(ex, cy + 2, ex + 2, cy + 2, '#1e1628')
            if L['style'] in ('bald', 'warrior', 'messy', 'turban'):
                pt.rect(cx - 5, cy - 1.5, cx - 2, cy - 1.5, dark(hcol, 0.2)); pt.rect(cx + 2, cy - 1.5, cx + 5, cy - 1.5, dark(hcol, 0.2))
            pt.rect(cx - 1, cy + 5, cx + 0.5, cy + 5, '#b0503a')
            if female or L['style'] in ('taoist', 'ponytail'): pt.rect(cx - 6, cy + 4, cx - 4, cy + 4, '#ffa8a0'); pt.rect(cx + 4, cy + 4, cx + 6, cy + 4, '#ffa8a0')
            if L.get('beard'):
                pt.poly([(cx - 3, cy + 6), (cx + 3, cy + 6), (cx + 1.5, cy + 9), (cx - 1.5, cy + 9)], hcol)
                pt.rect(cx - 3, cy + 4.2, cx - 1.5, cy + 4.2, hcol); pt.rect(cx + 1, cy + 4.2, cx + 2.5, cy + 4.2, hcol)
        elif view == 'right':
            if eyes:
                pt.rect(cx + 3, cy + 0.5, cx + 5, cy + 3.5, '#1e1628'); pt.rect(cx + 4, cy + 2, cx + 5, cy + 3.5, iris)
                pt.rect(cx + 4, cy + 0.5, cx + 4, cy + 1.5, '#ffffff')
                if female: pt.rect(cx + 6, cy, cx + 6, cy + 0.5, '#1e1628')
            else: pt.rect(cx + 3, cy + 2, cx + 5, cy + 2, '#1e1628')
            if L['style'] in ('bald', 'warrior', 'messy', 'turban'): pt.rect(cx + 2, cy - 1, cx + 5, cy - 1, dark(hcol, 0.2))
            pt.rect(cx + 5, cy + 5, cx + 6, cy + 5, '#b0503a')
            if L.get('beard'): pt.poly([(cx + 2, cy + 6), (cx + 7, cy + 6), (cx + 6, cy + 9), (cx + 3, cy + 9)], hcol)
            if female or L['style'] in ('taoist', 'ponytail'): pt.rect(cx + 1, cy + 4, cx + 3, cy + 4, '#ffa8a0')
    hp.mark(face)
    parts.append(hp)
    hb = draw_hair(L, view, cx, cy, r, sway, True)
    hb.depth = 0.9 if view == 'up' else -3
    parts.append(hb)
    hf = draw_hair(L, view, cx, cy, r, sway, False)
    hf.depth = 1.1
    parts.append(hf)
    # ---- vũ khí ----
    parts += draw_weapon(L, J, pose, P)
    # ---- vệt chém ----
    if prev is not None and pose.get('trail'):
        tp = Part(5, outline=False, shade=False)
        tips, bases = [], []
        for i in range(7):
            q = lerp_pose(prev, pose, i / 6)
            Jq = solve(body, q)
            b3, t3 = weapon_line(L, Jq, q)
            if L['weapon'] in ('palm',): b3 = Jq['elR']
            tips.append(P(t3)[:2]); bases.append(P(tuple(b3[k] + (t3[k] - b3[k]) * 0.45 for k in range(3)))[:2])
        g = hx(L['glow'])
        tp.poly(tips + bases[::-1], light(L['glow'], 0.25)[:3] + (165,))
        for a, b in zip(tips, tips[1:]): tp.line(a, b, light(L['glow'], 0.6)[:3] + (230,), 2)
        parts.append(tp)
    # ---- hào quang ra chiêu ----
    for gk in pose.get('glow', []):
        key, rad = gk
        h = P(J['ha' + key])
        gp = Part(4, outline=False, shade=False)
        g = hx(L['glow'])
        gp.ell(h[0], h[1], rad + 1.5, rad + 1.5, g[:3] + (70,))
        gp.ell(h[0], h[1], rad, rad, g[:3] + (150,))
        gp.ell(h[0], h[1], max(1, rad * 0.5), max(1, rad * 0.5), (255, 255, 240, 230))
        for i in range(5):
            t = i / 5 * TAU + rad
            gp.rect(h[0] + math.cos(t) * (rad + 3), h[1] + math.sin(t) * (rad + 3), h[0] + math.cos(t) * (rad + 3), h[1] + math.sin(t) * (rad + 3), light(L['glow'], 0.5))
        parts.append(gp)
    # ---- ghép ----
    parts.sort(key=lambda p: p.depth)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for pt in parts:
        im = pt.finish()
        if im is not None: canvas.alpha_composite(im)
    return canvas

def lerp_pose(a, b, t):
    out = {}
    for k in set(a) | set(b):
        va, vb = a.get(k, b.get(k)), b.get(k, a.get(k))
        if isinstance(va, (int, float)) and isinstance(vb, (int, float)) and not isinstance(va, bool):
            out[k] = va + (vb - va) * t
        elif isinstance(va, tuple) and isinstance(vb, tuple) and len(va) == len(vb):
            out[k] = tuple(x + (y - x) * t for x, y in zip(va, vb))
        else:
            out[k] = vb
    return out

# ---------------- động tác ----------------
REST = {'armR': (0.12, 0.2, 0.35), 'armL': (0.12, 0.2, 0.35), 'legR': (0, 0), 'legL': (0, 0)}
def stance(L):
    k = L['weapon']
    p = dict(REST)
    if k in ('sword', 'saber'): p.update(armR=(0.3, 0.28, 0.55), w=0.7)
    elif k == 'staff': p.update(armR=(0.35, 0.32, 0.75), wa=math.pi * 0.97, wb=0.1)
    elif k == 'hammer': p.update(armR=(0.18, 0.3, 0.25), w=-0.15)
    elif k == 'daggers': p.update(armR=(0.45, 0.3, 1.0), armL=(0.45, 0.3, 1.0), w=1.9)
    elif k == 'knife': p.update(armR=(0.2, 0.25, 0.6), w=1.4)
    elif k == 'talisman': p.update(armR=(0.25, 0.25, 0.9), armL=(0.55, 0.15, 1.7), w=1.6)
    elif k == 'palm': p.update(armR=(0.55, 0.3, 1.7), armL=(0.55, 0.3, 1.7))
    return p

def anim_idle(L, i):
    p = stance(L)
    s = math.sin(i / 4 * TAU)
    for key in ('armR', 'armL'):
        a = p[key]; p[key] = (a[0] + s * 0.05, a[1], a[2] + s * 0.06)
    p['lean'] = 0.02 + s * 0.02
    p['_sway'] = s * 1.2
    return p

def anim_walk(L, i, n=6):
    p = stance(L)
    ph = i / n * TAU
    sa = math.sin(ph)
    p['legR'] = (0.5 * sa, 0.75 * max(0, math.cos(ph)) + 0.1)
    p['legL'] = (-0.5 * sa, 0.75 * max(0, -math.cos(ph)) + 0.1)
    swing = 0.45 if L['weapon'] in ('knife', 'palm') else 0.3
    aR, aL = p['armR'], p['armL']
    p['armL'] = (aL[0] + swing * sa, aL[1], aL[2])
    if L['weapon'] in ('knife', 'palm'): p['armR'] = (aR[0] - swing * sa, aR[1], aR[2])
    else: p['armR'] = (aR[0] - 0.12 * sa, aR[1], aR[2])
    p['lean'] = 0.08
    p['twist'] = 0.12 * sa
    p['_sway'] = -2 * math.cos(ph)
    return p

def anim_attack(L, i):
    k = L['weapon']; p = stance(L)
    step = [(0, 0), (0.25, 0.25), (0.45, 0.25), (0.2, 0.1)][i]
    back = [(0, 0), (-0.15, 0.05), (-0.3, 0.1), (-0.1, 0.05)][i]
    p['legR'], p['legL'] = step, back
    if k in ('sword', 'saber'):
        p.update([({'armR': (2.7, 0.55, 0.4), 'twist': -0.55, 'w': 0.3, 'lean': -0.05},),
                  ({'armR': (1.65, 0.25, 0.1), 'twist': 0.05, 'w': 0.15, 'lean': 0.12, 'trail': 1},),
                  ({'armR': (0.65, -0.35, 0.05), 'twist': 0.55, 'w': 0.2, 'lean': 0.22, 'trail': 1},),
                  ({'armR': (0.55, 0.1, 0.35), 'twist': 0.25, 'w': 0.5, 'lean': 0.1},)][i][0])
        p['armL'] = [(0.2, 0.5, 0.5), (0.4, 0.4, 0.6), (-0.3, 0.6, 0.4), (0.0, 0.4, 0.4)][i]
    elif k == 'hammer':
        a = [(2.95, 0.25, 0.2), (2.0, 0.15, 0.1), (0.95, 0.1, 0.05), (0.75, 0.15, 0.1)][i]
        p.update(armR=a, armL=(a[0], 0.05, a[2] + 0.2), w=0, lean=[-0.12, 0.1, 0.35, 0.25][i], trail=i in (1, 2))
    elif k == 'staff':
        p.update(two=1, armR=[(1.3, 0.6, 0.6), (1.45, 0.25, 0.4), (1.3, -0.25, 0.4), (1.1, 0.1, 0.6)][i],
                 armL=[(1.2, -0.2, 0.9), (1.35, 0.35, 0.6), (1.3, 0.6, 0.5), (1.0, 0.3, 0.7)][i],
                 twist=[-0.85, 0.0, 0.8, 0.4][i], lean=[0, 0.12, 0.2, 0.1][i], trail=i in (1, 2))
    elif k == 'daggers':
        p.update(armR=[(1.2, 0.5, 1.6), (1.6, 0.1, 0.05), (0.9, 0.45, 1.2), (0.7, 0.35, 1.0)][i],
                 armL=[(1.1, 0.5, 1.6), (0.8, 0.45, 1.3), (1.6, 0.1, 0.05), (0.7, 0.35, 1.0)][i],
                 w=[1.9, 0.2, 1.9, 1.9][i], twist=[-0.2, 0.35, -0.35, 0][i], lean=[0, 0.25, 0.25, 0.1][i], trail=i == 1)
    elif k in ('knife', 'talisman'):
        p.update(armR=[(2.6, 0.45, 1.3), (1.9, 0.25, 0.35), (1.35, 0.05, 0.0), (0.8, 0.15, 0.4)][i],
                 twist=[-0.5, 0.1, 0.4, 0.2][i], lean=[-0.05, 0.12, 0.22, 0.1][i], trail=i == 1, noweapon=i >= 2,
                 glow=[('R', 2)] if (k == 'talisman' and i in (1, 2)) else [])
    elif k == 'palm':
        p.update(armR=[(-0.4, 0.35, 1.9), (1.55, 0.05, 0.0), (1.55, 0.05, 0.0), (0.9, 0.2, 1.0)][i],
                 armL=[(0.9, 0.2, 1.7), (0.3, 0.4, 1.5), (0.3, 0.4, 1.5), (0.5, 0.3, 1.6)][i],
                 twist=[-0.5, 0.35, 0.35, 0.1][i], lean=[-0.1, 0.25, 0.28, 0.1][i],
                 glow=[('R', 3)] if i in (1, 2) else [])
    p['_sway'] = [1, -1, -2, 0][i]
    return p

def anim_cast(L, i):
    p = stance(L)
    p['armR'] = [(0.9, 0.6, 1.8), (2.6, 0.75, 0.3), (1.6, 0.22, 0.0), (1.45, 0.3, 0.25)][i]
    p['armL'] = p['armR']
    p['lean'] = [-0.05, -0.08, 0.2, 0.12][i]
    p['legR'] = [(0, 0), (0, 0), (0.35, 0.2), (0.25, 0.1)][i]
    p['legL'] = [(0, 0), (0, 0), (-0.25, 0.05), (-0.15, 0)][i]
    rad = [2, 3, 4, 2.5][i]
    p['glow'] = [('R', rad), ('L', rad)]
    p['lift'] = [0, 1, 0, 0][i]
    if L['weapon'] == 'staff': p.update(wa=math.pi * 0.9)
    p['_sway'] = [0, 2, -2, -1][i]
    return p

def anim_hurt(L, i):
    p = stance(L)
    p.update(lean=-0.3, armR=(0.7, 0.75, 0.6), armL=(0.7, 0.75, 0.6), legR=(0.2, 0.3), legL=(-0.2, 0.1), _sway=3)
    return p

ANIMS = [('idle', 4, anim_idle), ('walk', 6, anim_walk), ('atk', 4, anim_attack), ('cast', 4, anim_cast), ('hurt', 1, anim_hurt)]
VIEWS = ['down', 'up', 'right']
COLS = sum(n for _, n, _ in ANIMS)

def frame(cls, view, name, i):
    L = LOOK[cls]
    fn = dict((a, f) for a, _, f in ANIMS)[name]
    n = dict((a, n) for a, n, _ in ANIMS)[name]
    pose = fn(L, i)
    prev = fn(L, i - 1) if (name == 'atk' and i > 0) else None
    sway = pose.pop('_sway', 0)
    if prev: prev.pop('_sway', 0)
    return render(cls, view, pose, prev, sway=sway)

def dead_frame(cls):
    L = LOOK[cls]
    pose = dict(REST); pose.update(noweapon=1, armR=(0.4, 0.5, 0.3), armL=(0.4, 0.5, 0.3))
    im = render(cls, 'right', pose, eyes=False)
    im = im.rotate(90, expand=False)
    bb = im.getbbox()
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    if bb:
        crop = im.crop(bb)
        out.alpha_composite(crop, (AX - crop.width // 2, AY - crop.height + 2))
    return out

def sheet(cls):
    """hàng 0..2: down/up/right; cột: idle4 walk6 atk4 cast4 hurt1; hàng 3: ngã"""
    sh = Image.new('RGBA', (W * COLS, H * 4), (0, 0, 0, 0))
    for r, view in enumerate(VIEWS):
        c = 0
        for name, n, _ in ANIMS:
            for i in range(n):
                sh.alpha_composite(frame(cls, view, name, i), (c * W, r * H)); c += 1
    sh.alpha_composite(dead_frame(cls), (0, 3 * H))
    return sh

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'public/assets/chars'
    os.makedirs(out, exist_ok=True)
    only = sys.argv[2:] or list(LOOK)
    for cls in only:
        sheet(cls).save(os.path.join(out, cls + '.png'), optimize=True)
        print('ok', cls)
