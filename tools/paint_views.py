# Vẽ hướng nhìn TRƯỚC / SAU cho 9 môn phái – chibi pixel art 64x64, khớp tỉ lệ ảnh nghiêng
# Dùng: python3 tools/paint_views.py public/assets/chars  (cần pillow, numpy)
from PIL import Image, ImageDraw
import numpy as np, os, sys
OUT = sys.argv[1] if len(sys.argv) > 1 else 'gen'
os.makedirs(OUT, exist_ok=True)

def hx(h):
    if not isinstance(h, str): return h
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
def mix(a, b, t):
    a, b = hx(a), hx(b)
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
def tones(c):
    return {'b': hx(c), 's': mix(c, '#1a0e24', 0.32), 'd': mix(c, '#1a0e24', 0.58), 'l': mix(c, '#fff6e6', 0.38)}

SKIN = '#f8cfa6'
LOOK = {
    'thieulam':   dict(robe='#f2a33c', trim='#9a4e24', inner='#fde3a6', belt='#7a3e22', pants='#fbe6c0', shoe='#4a2a20', hair=None, hat='bald', beads=True, weapon='staff', wcol='#9a6432'),
    'ngudoc':     dict(robe='#5c2580', trim='#93dc4c', inner='#2c4436', belt='#93dc4c', pants='#3c1a54', shoe='#1c1424', hair='#1c1428', hat='hood', hatc='#4c1e6c', band='#93dc4c', weapon='claw', wcol='#a6e868'),
    'thienvuong': dict(robe='#c8302a', trim='#efba50', inner='#7e1e1a', belt='#efba50', pants='#3c2c32', shoe='#2a1a18', hair='#4c2c1c', hat='topknot', ribbon='#ff7a2a', beard=True, armor=True, weapon='halberd', wcol='#c4ccdc'),
    'caibang':    dict(robe='#d4ccbe', trim='#e88c3a', inner='#8c7c6c', belt='#6c4c30', pants='#b46c38', shoe='#3c2a20', hair='#4c3020', hat='headband', band='#4c464c', ribbon='#ff9a3a', scarf='#ea8c2a', gourd=True, weapon='stick', wcol='#a06c3a', patch=True),
    'vodang':     dict(robe='#f0f4fc', trim='#4262ae', inner='#c0cce2', belt='#4262ae', pants='#6c7294', shoe='#2a2838', hair='#2c2232', hat='longhair', pin='#dce2ee', weapon='sword', wcol='#ccd8f0'),
    'ngamy':      dict(robe='#f6bccc', trim='#fffafa', inner='#dc7c9c', belt='#c65c80', pants='#ea9cb4', shoe='#7c304c', hair='#3c2232', hat='buns', flower='#ff6aa4', weapon='sword', wcol='#f2e2f2', female=True),
    'thuyyen':    dict(robe='#3c66b4', trim='#acccE8', inner='#1e3668', belt='#acccE8', pants='#26427c', shoe='#121a34', hair='#161e3e', hat='ponytail', pin='#acccE8', weapon='dagger', wcol='#d2e6ff', female=True),
    'conlon':     dict(robe='#f4c65c', trim='#5c307c', inner='#ca8c3c', belt='#5c307c', pants='#4c2c5c', shoe='#24142c', hair='#1e1426', hat='official', hatc='#4c2c6c', weapon='talisman', wcol='#ffe28c'),
    'duongmon':   dict(robe='#41903e', trim='#161e1a', inner='#2c5c2e', belt='#bec68c', pants='#283220', shoe='#141814', hair='#161618', hat='straw', hatc='#2c3c2c', weapon='crossbow', wcol='#6c5c3c'),
}

class Pix:
    def __init__(self):
        self.im = Image.new('RGBA', (64, 64), (0, 0, 0, 0)); self.d = ImageDraw.Draw(self.im)
    def r(self, x0, y0, x1, y1, c):
        if x1 >= x0 and y1 >= y0: self.d.rectangle([x0, y0, x1, y1], fill=hx(c))
    def p(self, x, y, c): self.d.point((x, y), fill=hx(c))
    def e(self, x0, y0, x1, y1, c): self.d.ellipse([x0, y0, x1, y1], fill=hx(c))
    def poly(self, pts, c): self.d.polygon(pts, fill=hx(c))
    def line(self, pts, c, w=1): self.d.line(pts, fill=hx(c), width=w)
    def vol_e(self, box, T, dx=2, dy=1):
        """khối tròn có bóng: bóng dưới-phải, sáng trên-trái"""
        x0, y0, x1, y1 = box
        self.e(x0, y0, x1, y1, T['s']); self.e(x0, y0, x1 - dx, y1 - dy, T['b'])
    def vol_poly(self, pts, T, dx=3):
        self.poly(pts, T['s']); self.poly([(x - dx if x > 32 else x, y) for x, y in pts], T['b'])

def outline(im, col=(22, 14, 26, 255)):
    a = np.array(im); al = a[..., 3] > 0
    pad = np.pad(al, 1); nb = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    a[nb & ~al] = col
    return Image.fromarray(a)

LIFT = [(2, 0), (1, 1), (0, 2), (1, 1)]
SWING = [1, 0, -1, 0]
BOB = [0, -1, 0, -1]

def draw(cls, view, f):
    L = LOOK[cls]; P = Pix()
    R, T, I, B, PA, SH = (tones(L[k]) for k in ('robe', 'trim', 'inner', 'belt', 'pants', 'shoe'))
    S = tones(SKIN); H = tones(L['hair']) if L.get('hair') else None
    walk = f is not None
    ll, rl = LIFT[f] if walk else (0, 0)
    sw = SWING[f] if walk else 0
    oy = BOB[f] if walk else 0
    back = view == 'back'
    hcy = 22 + oy

    def weapon_back():
        w = tones(L['wcol']); k = L['weapon']
        if k in ('staff', 'stick'):
            P.line([(18, 58 + oy), (46, 18 + oy)], w['s'], 2); P.line([(18, 57 + oy), (46, 17 + oy)], w['b'])
            P.r(44, 16 + oy, 47, 18 + oy, w['d']) if k == 'staff' else None
        elif k == 'halberd':
            P.line([(17, 61 + oy), (45, 13 + oy)], '#5c3c2a', 2)
            P.poly([(43, 11 + oy), (51, 6 + oy), (48, 16 + oy)], w['b']); P.poly([(45, 15 + oy), (52, 18 + oy), (46, 20 + oy)], w['s'])
            P.r(42, 15 + oy, 45, 16 + oy, '#efba50')
        elif k == 'sword':
            P.line([(20, 52 + oy), (42, 22 + oy)], w['b'], 2); P.line([(20, 53 + oy), (42, 23 + oy)], w['s'])
            P.line([(42, 22 + oy), (46, 16 + oy)], '#6c4c2c', 2); P.r(39, 22 + oy, 44, 23 + oy, '#eac65c')
        elif k == 'crossbow':
            P.r(21, 30 + oy, 43, 31 + oy, w['b']); P.line([(21, 31 + oy), (24, 39 + oy)], w['d']); P.line([(43, 31 + oy), (40, 39 + oy)], w['d'])
            P.r(31, 27 + oy, 33, 40 + oy, w['s'])
        elif k == 'talisman':
            P.r(42, 24 + oy, 46, 33 + oy, '#ffe28c'); P.r(43, 26 + oy, 45, 31 + oy, '#c4402c')
        elif k == 'claw':
            for i in range(3): P.line([(42 + i, 40 + oy), (47 + i, 33 + oy)], w['b'])
        elif k == 'dagger':
            P.line([(19, 46 + oy), (24, 36 + oy)], w['b'], 2); P.line([(45, 46 + oy), (40, 36 + oy)], w['b'], 2)
    if not back: weapon_back()

    # ---------- chân & giày ----------
    for x0, lift in ((26, ll), (34, rl)):
        yb = 57 - lift
        P.r(x0, 50 + oy, x0 + 4, yb + oy, PA['b']); P.r(x0 + 3, 50 + oy, x0 + 4, yb + oy, PA['s'])
        P.r(x0 - 1, yb + 1 + oy, x0 + 5, yb + 3 + oy, SH['b']); P.r(x0 - 1, yb + 3 + oy, x0 + 5, yb + 3 + oy, SH['d'])
        if not back: P.r(x0, yb + 1 + oy, x0 + 2, yb + 1 + oy, SH['l'])

    # ---------- áo choàng ----------
    top, bot = 31 + oy, 51 + oy
    body = [(24, top), (40, top), (44, bot), (20, bot)]
    P.vol_poly(body, R, 3)
    P.poly([(24, top), (26, top), (23, bot), (20, bot)], R['l'])
    for fx in (25, 31, 37):  # nếp gấp vạt áo
        P.line([(fx, bot - 6), (fx + (1 if fx > 32 else 0), bot - 1)], R['s'])
    P.r(20, bot - 1, 44, bot, T['b']); P.r(20, bot, 44, bot, T['s'])
    if L.get('patch'):
        P.r(23, 45 + oy, 26, 48 + oy, '#a89a84'); P.r(37, 35 + oy, 39, 37 + oy, '#a89a84')
    if L.get('armor'):
        P.r(24, 34 + oy, 40, 41 + oy, mix(L['robe'], '#000000', 0.18))
        for yy in (35, 38): P.r(25, yy + oy, 39, yy + oy, R['s'])
        if not back: P.r(30, 34 + oy, 34, 40 + oy, T['b']); P.r(31, 35 + oy, 33, 39 + oy, '#ff5a2a')
        P.r(22, 45 + oy, 42, 50 + oy, mix(L['robe'], '#000000', 0.12)); P.r(31, 45 + oy, 33, 50 + oy, T['s'])
    if not back:
        if not L.get('armor'):
            P.poly([(28, top), (36, top), (32, top + 5)], I['b'])
            P.line([(28, top), (35, top + 10)], T['b']); P.line([(36, top), (32, top + 5)], T['b'])
            P.line([(35, top + 10), (36, bot - 2)], T['s'])
    else:
        P.line([(32, top + 2), (32, bot - 2)], R['s'])
    P.r(23, 41 + oy, 41, 43 + oy, B['b']); P.r(23, 43 + oy, 41, 43 + oy, B['s'])
    if not back:
        P.r(30, 41 + oy, 34, 43 + oy, B['l']); P.r(31, 44 + oy, 32, 47 + oy, B['s'])
    else:
        P.poly([(33, 43 + oy), (36, 43 + oy), (37, 49 + oy), (34, 48 + oy)], B['b'])
    if L.get('gourd'):
        P.vol_e((38, 42 + oy, 44, 50 + oy), tones('#bc843c'), 1, 1); P.e(39, 40 + oy, 42, 43 + oy, '#9c6c2c'); P.p(39, 44 + oy, '#f2c272')

    # ---------- tay áo ----------
    for side in (-1, 1):
        dy = sw * side
        if side < 0:
            sl = [(25, top + 1), (22, top + 2), (18, 44 + oy + dy), (24, 45 + oy + dy)]
            hand = (19, 45 + oy + dy, 22, 47 + oy + dy)
        else:
            sl = [(39, top + 1), (42, top + 2), (46, 44 + oy + dy), (40, 45 + oy + dy)]
            hand = (42, 45 + oy + dy, 45, 47 + oy + dy)
        P.poly(sl, R['l'] if side < 0 else R['s'])
        P.poly([(x + (1 if side < 0 else -1), y) for x, y in sl[1:3]] + [sl[3]], R['b'] if side < 0 else R['d'])
        P.line([sl[2], sl[3]], T['b'])
        P.r(*hand, S['b'] if not back else S['s'])
        if L.get('armor'):
            cx = 23 if side < 0 else 41
            P.vol_e((cx - 4, top - 2, cx + 4, top + 5), tones('#8e1e1a'), 1, 1); P.r(cx - 3, top - 2, cx + 3, top - 2, T['b'])

    if L.get('scarf'):
        sc = tones(L['scarf'])
        P.e(24, 29 + oy, 40, 36 + oy, sc['s']); P.e(24, 29 + oy, 39, 35 + oy, sc['b'])
        P.poly([(34, 33 + oy), (38, 33 + oy), (39, 41 + oy), (35, 40 + oy)] if not back else [(28, 33 + oy), (32, 33 + oy), (30, 42 + oy)], sc['s'])
    if L.get('beads') and not back:
        for bx, by in [(25, 32), (26, 35), (28, 37), (30, 38), (32, 39), (34, 38), (36, 37), (38, 35), (39, 32)]:
            P.r(bx, by + oy, bx + 1, by + 1 + oy, '#6c3c20'); P.p(bx, by + oy, '#c08048')
        P.r(31, 40 + oy, 33, 42 + oy, '#6c3c20')

    # ---------- đầu ----------
    P.vol_e((21, hcy - 10, 43, hcy + 9), S, 2, 1)
    P.r(21, hcy + 1, 22, hcy + 4, S['s']); P.r(42, hcy + 1, 43, hcy + 4, S['s'])  # tai
    hat = L['hat']

    def face(brow=False):
        ey = hcy + 3
        for ex in (26, 35):
            P.r(ex, ey, ex + 2, ey + 3, '#20182c')
            P.p(ex, ey, '#ffffff'); P.p(ex + 1, ey + 3, '#5a4a7a')
            if L.get('female'): P.p(ex - 1 if ex < 32 else ex + 3, ey, '#20182c')
        if brow:
            c = H['d'] if H else S['d']
            P.r(25, ey - 2, 28, ey - 2, c); P.r(35, ey - 2, 38, ey - 2, c)
        P.p(32, ey + 4, S['s']) if False else None
        P.r(31, ey + 5, 33, ey + 5, mix(SKIN, '#8a2a2a', 0.55))
        if L.get('female') or cls in ('vodang',):
            P.r(23, ey + 4, 25, ey + 4, mix(SKIN, '#ff6a8a', 0.45)); P.r(38, ey + 4, 40, ey + 4, mix(SKIN, '#ff6a8a', 0.45))

    def hair_cap(low=hcy, fringe=True):
        P.vol_e((20, hcy - 12, 44, hcy + 1), H, 2, 1)
        P.r(25, hcy - 9, 30, hcy - 9, H['l']); P.r(24, hcy - 8, 26, hcy - 8, H['l'])
        if not back:
            if fringe:
                for x in range(23, 41, 4): P.poly([(x, hcy - 2), (x + 4, hcy - 2), (x + 2, hcy + 1)], H['b'])
            P.r(20, hcy - 4, 22, low, H['b']); P.r(42, hcy - 4, 44, low, H['s'])

    if back:
        if hat == 'bald':
            P.e(26, hcy - 8, 31, hcy - 4, S['l'])
        elif hat not in ('hood',):
            P.vol_e((20, hcy - 12, 44, hcy + 9), H, 2, 1); P.r(25, hcy - 9, 30, hcy - 9, H['l'])
            P.r(27, hcy + 6, 37, hcy + 9, H['s'])
    else:
        face(brow=hat in ('bald', 'headband', 'hood'))

    if hat == 'bald':
        if not back:
            P.e(26, hcy - 8, 31, hcy - 5, S['l'])
            for x, y in ((29, hcy - 7), (32, hcy - 8), (35, hcy - 7)): P.p(x, y, '#b86c44')
    elif hat == 'hood':
        hc = tones(L['hatc']); bd = tones(L['band'])
        P.vol_e((19, hcy - 13, 45, hcy + 6), hc, 2, 1)
        if not back:
            P.vol_e((23, hcy - 5, 41, hcy + 10), S, 2, 1)
            face(True)
            P.poly([(24, hcy + 5), (40, hcy + 5), (37, hcy + 10), (27, hcy + 10)], '#2c4436')
            P.r(25, hcy + 5, 39, hcy + 5, bd['s'])
            P.r(23, hcy - 5, 26, hcy - 2, H['b']); P.r(38, hcy - 5, 41, hcy - 2, H['b'])
        P.r(19, hcy - 7, 45, hcy - 6, bd['b'])
        P.poly([(43, hcy - 7), (49, hcy - 2), (46, hcy + 1)], bd['s']); P.poly([(43, hcy - 6), (47, hcy + 4), (44, hcy + 4)], bd['b'])
    elif hat == 'topknot':
        hair_cap()
        P.vol_e((27, hcy - 17, 37, hcy - 9), H, 1, 1)
        rb = tones(L['ribbon']); P.r(27, hcy - 11, 37, hcy - 10, rb['b'])
        P.poly([(37, hcy - 13), (43, hcy - 17), (42, hcy - 10)], rb['b']); P.poly([(37, hcy - 11), (42, hcy - 7), (39, hcy - 6)], rb['s'])
        if L.get('beard') and not back:
            P.poly([(26, hcy + 8), (38, hcy + 8), (35, hcy + 12), (29, hcy + 12)], H['b'])
            P.r(29, hcy + 7, 35, hcy + 7, H['b']); P.r(31, hcy + 8, 33, hcy + 8, mix(SKIN, '#8a2a2a', 0.5))
            P.r(23, hcy + 3, 24, hcy + 8, H['b']); P.r(40, hcy + 3, 41, hcy + 8, H['b'])
    elif hat == 'headband':
        hair_cap(hcy + 3)
        for x in (22, 27, 33, 38): P.poly([(x, hcy - 10), (x + 4, hcy - 14), (x + 4, hcy - 9)], H['b'])
        bd = tones(L['band']); P.r(20, hcy - 6, 44, hcy - 4, bd['b']); P.r(20, hcy - 4, 44, hcy - 4, bd['d'])
        if not back: P.r(30, hcy - 6, 34, hcy - 4, '#c48c3c')
        rb = tones(L['ribbon'])
        P.poly([(41, hcy - 6), (49, hcy - 4), (46, hcy + 1)], rb['b']); P.poly([(42, hcy - 5), (50, hcy + 3), (45, hcy + 3)], rb['s'])
    elif hat == 'longhair':
        if back:
            P.r(21, hcy, 43, hcy + 22, H['b']); P.r(38, hcy, 43, hcy + 22, H['s'])
            P.poly([(21, hcy + 22), (43, hcy + 22), (32, hcy + 26)], H['b']); P.r(26, hcy + 4, 27, hcy + 18, H['l'])
        hair_cap(hcy + 14)
        P.vol_e((27, hcy - 18, 37, hcy - 9), H, 1, 1)
        pn = tones(L['pin']); P.r(24, hcy - 14, 40, hcy - 13, pn['b']); P.p(40, hcy - 14, pn['l'])
    elif hat == 'buns':
        if back:
            P.r(22, hcy, 42, hcy + 16, H['b']); P.r(38, hcy, 42, hcy + 16, H['s'])
            P.r(30, hcy + 2, 34, hcy + 4, tones(L['flower'])['b'])
        hair_cap(hcy + 9)
        fl = tones(L['flower'])
        for bx in (17, 38):
            P.vol_e((bx, hcy - 15, bx + 9, hcy - 6), H, 1, 1)
            P.r(bx + 3, hcy - 8, bx + 5, hcy - 6, fl['b']); P.p(bx + 4, hcy - 7, '#fff2a2')
            P.p(bx + (1 if bx < 32 else 7), hcy - 9, fl['l'])
    elif hat == 'ponytail':
        hair_cap(hcy + 6)
        P.vol_e((28, hcy - 18, 38, hcy - 10), H, 1, 1)
        pn = tones(L['pin']); P.r(29, hcy - 12, 37, hcy - 11, pn['b'])
        if back:
            P.poly([(29, hcy - 6), (36, hcy - 6), (37, hcy + 18), (31, hcy + 22), (28, hcy + 16)], H['b']); P.r(34, hcy - 4, 36, hcy + 16, H['s'])
        else:
            P.poly([(37, hcy - 14), (46, hcy - 8), (46, hcy + 10), (43, hcy + 4), (41, hcy - 6)], H['b'])
            P.poly([(44, hcy - 6), (46, hcy - 8), (46, hcy + 10)], H['s'])
    elif hat == 'official':
        hair_cap(hcy + 1)
        hc = tones(L['hatc'])
        P.poly([(25, hcy - 9), (39, hcy - 9), (37, hcy - 18), (27, hcy - 18)], hc['s'])
        P.poly([(25, hcy - 9), (35, hcy - 9), (34, hcy - 18), (27, hcy - 18)], hc['b'])
        P.poly([(16, hcy - 5), (48, hcy - 5), (43, hcy - 10), (21, hcy - 10)], hc['b'])
        P.r(16, hcy - 5, 48, hcy - 4, hc['d'])
        P.r(26, hcy - 11, 38, hcy - 10, '#f4c65c')
        P.vol_e((29, hcy - 23, 35, hcy - 17), tones('#f4c65c'), 1, 1)
        if not back: P.r(30, hcy - 16, 34, hcy - 13, '#f4c65c'); P.p(32, hcy - 15, '#c4402c')
    elif hat == 'straw':
        hair_cap(hcy + 4)
        hc = tones(L['hatc'])
        P.poly([(12, hcy - 3), (52, hcy - 3), (32, hcy - 17)], hc['b'])
        P.poly([(32, hcy - 17), (52, hcy - 3), (37, hcy - 3)], hc['s'])
        P.poly([(32, hcy - 17), (12, hcy - 3), (18, hcy - 3)], hc['l'])
        P.r(12, hcy - 3, 52, hcy - 2, hc['d'])
        for x in range(16, 50, 5): P.line([(32, hcy - 16), (x, hcy - 4)], hc['d'])
        P.r(29, hcy - 18, 35, hcy - 16, '#bec68c')
        if not back: P.line([(24, hcy - 2), (27, hcy + 9)], '#bec68c'); P.line([(40, hcy - 2), (37, hcy + 9)], '#bec68c')
    if back: weapon_back()
    return outline(P.im)

if __name__ == '__main__':
    for cls in LOOK:
        for view, pre in (('front', 'f'), ('back', 'b')):
            draw(cls, view, None).save(f'{OUT}/{cls}_{pre}i.png')
            for f in range(4): draw(cls, view, f).save(f'{OUT}/{cls}_{pre}{f}.png')
