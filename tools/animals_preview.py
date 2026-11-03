# BẢN XEM THỬ (chưa đưa vào game): động vật nhà – chó vàng, chó mực, mèo mướp, heo, trâu, gà trống, gà mái, vịt.
# Dựng bằng cùng bộ khối của tools/beastgen.py + dáng thú 4 chân của tools/beasts3.py (cùng phong cách quái hiện có),
# thêm khung CHIM 2 chân (gà, vịt). Nhìn ngang quay phải, ô 96 như quái thường.
# Dùng: python3 tools/animals_preview.py <thư mục ra>   -> mỗi con 1 sheet 16 khung (đứng 0-3, đi 4-9, đánh 10-13, trúng 14, ngã 15)
#       + preview.png (ghép vài khung phóng to kèm tên)
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import beasts3 as B
from beasts3 import S, WOLF, BEAR, CAT, dk, lt, bez, TAU, FRAMES
from beastgen import Scene


# ======================= chim 2 chân: gà trống / gà mái / vịt =======================
def bird(sc, sp, kind, i):
    col, bel = sp['col'], sp.get('belly', lt(sp['col'], 0.35))
    duck = sp.get('duck'); dead = kind == 'dead'
    step, bob, peck, flap = 0.0, 0.0, 0.0, 0.0
    if kind == 'idle': bob = math.sin(i / 4 * TAU) * 0.3; peck = max(0, math.sin(i / 4 * TAU + 1)) * (0.6 if not duck else 0.3)
    elif kind == 'walk': p = i / 6; step = math.sin(p * TAU); bob = abs(math.cos(p * TAU)) * 0.7; peck = math.sin(p * TAU * 2) * 0.5
    elif kind == 'atk': peck = [0.2, -0.8, 2.6, 1.0][i]; flap = [0, 0.6, 1.0, 0.4][i]
    elif kind == 'hurt': flap = 0.8; peck = -1.0
    leg = sp.get('leg', 5.4)
    cy = leg + 3.6 + bob if not dead else 2.6
    bc = (0.0, cy)
    fur = dict(fur=sp.get('fur', 0.35))
    # chân (gà: mảnh, có cựa; vịt: ngắn, bàn màng)
    lc = sp.get('legcol', '#e8b030')
    for near in (0, 1):
        lay = 'near' if near else 'far'; z = 1.6 if near else -1.4; ph = step * (1 if near else -1)
        hip = (0.4 + (0 if near else 0.6), cy - 1.6)
        foot = (hip[0] + ph * 2.0, 0.6 + max(0, ph) * 1.4)
        if dead: foot = (hip[0] + 3 + near, cy + 1.5)
        knee = ((hip[0] + foot[0]) / 2 + 0.6, (hip[1] + foot[1]) / 2)
        sc.cap(hip, knee, 1.1 if not duck else 1.2, 0.5, z=z, col=col if not duck else lc, grp='thigh', layer=lay, **fur)
        sc.cap(knee, foot, 0.42 if not duck else 0.5, 0.36, z=z, col=lc, grp='leg', layer=lay, fur=0)
        if not dead:
            sc.cap(foot, (foot[0] + (1.8 if not duck else 2.2), foot[1] - 0.3), 0.32 if not duck else 0.55, 0.22, z=z, col=lc, grp='leg', layer=lay, fur=0)
            sc.cap(foot, (foot[0] - 1.0, foot[1] - 0.2), 0.28, 0.18, z=z, col=lc, grp='leg', layer=lay, fur=0)
    # đuôi: gà trống – lông đuôi cong vồng nhiều tầng; gà mái – túm ngắn; vịt – chóp vểnh
    tail = sp.get('tail', 'hen'); tc = sp.get('tailcol', dk(col, 0.25))
    tb = (bc[0] - 3.6, bc[1] + 0.8)
    if dead: tb = (bc[0] - 3.8, bc[1])
    if tail == 'rooster':
        for k, (dx, dy, w) in enumerate([(-5.5, 8.5, 0.9), (-7.0, 6.0, 0.8), (-7.6, 3.2, 0.7), (-4.0, 9.5, 0.7)]):
            pts = bez([tb, (tb[0] - 1.5, tb[1] + dy * 0.7), (tb[0] + dx, tb[1] + dy), (tb[0] + dx - 1.5, tb[1] + dy * 0.45)], 6)
            if dead: pts = [(x - 2, y - (y - tb[1]) * 0.6) for x, y in pts]
            sc.chain(pts, [w * 1.4, w * 1.6, w * 1.5, w * 1.2, w * 0.9, w * 0.6, w * 0.3], z=-0.6 - k * 0.2, col=tc if k % 2 == 0 else sp.get('tailcol2', tc), grp='tail', spec=0.5, blend=0.3, fur=0.2)
    elif tail == 'hen':
        sc.spike(tb, (tb[0] - 3.2, tb[1] + 3.6), 2.2, z=-0.5, col=tc, grp='tail', fur=0.4)
        sc.spike((tb[0] + 0.4, tb[1] - 0.4), (tb[0] - 3.0, tb[1] + 2.2), 1.8, z=-0.4, col=dk(tc, 0.15), grp='tail', fur=0.4)
    else:
        sc.spike(tb, (tb[0] - 2.4, tb[1] + 2.0), 1.6, z=-0.5, col=tc, grp='tail', fur=0.3)
    # thân + ức
    body_r = sp.get('body', (4.6, 3.6))
    sc.ell(bc, body_r[0], body_r[1], z=0, col=col, cs=bel, grp='body', back=dk(col, 0.12), rot=-0.12 if not duck else 0.05, **fur)
    sc.ell((bc[0] + 2.0, bc[1] - 0.2), 2.6, 2.9, z=0.4, col=col, cs=bel, grp='body', **fur)
    # cánh: khép sát thân, vỗ lên khi đánh / trúng đòn
    wa = flap * 1.1
    w0 = (bc[0] + 1.2, bc[1] + 0.8)
    w1 = (bc[0] - 3.2, bc[1] + 0.6 + wa * 3.5)
    sc.cap(w0, w1, 2.4, 1.4, z=1.6, col=sp.get('wing', dk(col, 0.1)), grp='wing', blend=0.3, fur=0.3)
    sc.spike((w1[0] + 0.6, w1[1]), (w1[0] - 1.8, w1[1] - 0.6 + wa * 1.5), 1.2, z=1.7, col=sp.get('wingtip', dk(col, 0.3)), grp='wing', fur=0.2)
    # cổ + đầu
    nb = (bc[0] + 2.8, bc[1] + 1.4)
    hc = (bc[0] + 4.0 + peck * 0.9, bc[1] + (5.2 if not duck else 4.4) - peck * 1.4)
    if dead: hc = (bc[0] + 6.2, 1.8)
    sc.cap(nb, hc, 1.9 if not duck else 1.6, 1.2, z=1.0, col=sp.get('neck', col), cs=bel, grp='neck', **fur)
    hr = sp.get('head', 1.7)
    sc.ell(hc, hr, hr * 0.92, z=1.6, col=sp.get('headcol', sp.get('neck', col)), grp='head', fur=0.2)
    # mỏ
    if duck:
        sc.cap((hc[0] + hr * 0.7, hc[1] - 0.2), (hc[0] + hr + 2.0, hc[1] - 0.5), 0.75, 0.6, z=1.8, col=sp.get('beak', '#f08a20'), grp='beak', spec=0.4, blend=0.2, fur=0)
    else:
        sc.spike((hc[0] + hr * 0.75, hc[1] - 0.1), (hc[0] + hr + 1.5, hc[1] - 0.6), 0.9, z=1.8, col=sp.get('beak', '#e8b030'), grp='beak', fur=0)
    # mào + yếm (gà)
    comb = sp.get('comb')
    if comb:
        n = 3 if comb == 'big' else 2; ch = 1.5 if comb == 'big' else 0.9
        for k in range(n):
            bx = hc[0] - 0.6 + k * 0.7
            sc.spike((bx, hc[1] + hr * 0.75), (bx - 0.2 + k * 0.1, hc[1] + hr * 0.75 + ch * (1 - abs(k - (n - 1) / 2) * 0.3)), 0.8, z=1.9, col='#d81e1e', grp='comb', fur=0, spec=0.3)
        sc.ell((hc[0] + hr * 0.75, hc[1] - hr * 0.95), 0.55, 0.9 if comb == 'big' else 0.6, z=1.9, col='#d81e1e', grp='wattle', fur=0, spec=0.3)
    def face(d):
        e = (hc[0] + 0.35, hc[1] + 0.35)
        if dead: d.line((e[0] - 0.4, e[1]), (e[0] + 0.4, e[1]), '#1a0e0e'); return
        d.px(e[0], e[1], sp.get('eye', '#1a0e0e'))
        if sc.u > 1.3: d.px(e[0] + 0.5, e[1] + 0.5, '#ffffff')
    sc.mark(face)
    # đốm / vằn lông
    if sp.get('speckle'):
        sc.patterns.append((['body', 'wing'], lambda U, V, ny: (np.sin(U * 3.1 + V * 1.3) * np.sin(V * 2.7 - U * 0.9) > 0.55) & (ny < 0.5), sp['speckle']))
    if sp.get('ring'):   # vòng cổ trắng (vịt trời)
        sc.patterns.append((['neck'], (lambda U, V, ny, nb=nb: np.abs(V - nb[1] - 1.6) < 0.45), sp['ring']))


# ======================= heo: thân tròn, mõm dĩa, tai cụp, chân ngắn, đuôi xoắn =======================
def legs4(sc, cy, step, xs, h, r, col, hoof, dead, lift=1.4):
    for k, (lx, near) in enumerate(xs):
        lay = 'near' if near else 'far'; z = 2.0 if near else -1.6
        ph = step * (1 if (k % 2 == 0) == bool(near) else -1)
        top = (lx, cy - 1.0); foot = (lx + ph * 1.6, 0.5 + max(0, ph) * lift)
        if dead: foot = (lx + 3.5, cy - 1.5 + (0 if near else 0.6))
        knee = ((top[0] + foot[0]) / 2 + 0.3, (top[1] + foot[1]) / 2)
        sc.cap(top, knee, r * 1.25, r, z=z, col=col, grp='leg', layer=lay, fur=0.15)
        sc.cap(knee, foot, r, r * 0.85, z=z, col=col, grp='leg', layer=lay, fur=0.1)
        if not dead: sc.ell((foot[0] + 0.3, foot[1]), r * 0.95, r * 0.6, z=z + 0.1, col=hoof, grp='hoof', layer=lay, fur=0, spec=0.3)


def pig(sc, sp, kind, i):
    col, bel = sp['col'], sp.get('belly', lt(sp['col'], 0.3)); dead = kind == 'dead'
    step = bob = nose = 0.0
    if kind == 'walk': p = i / 6; step = math.sin(p * TAU); bob = abs(math.cos(p * TAU)) * 0.5
    elif kind == 'idle': bob = math.sin(i / 4 * TAU) * 0.25; nose = math.sin(i / 4 * TAU) * 0.3
    elif kind == 'atk': nose = [0, -0.8, 2.2, 0.8][i]
    elif kind == 'hurt': nose = -1.0
    cy = 6.2 + bob if not dead else 4.2
    legs4(sc, cy, step, [(-4.2, 0), (4.0, 0), (-4.6, 1), (3.6, 1)], 5, 1.25, col, sp.get('hoof', '#7a4a44'), dead, 1.0)
    # đuôi xoắn
    t0 = (-7.2, cy + 1.4)
    pts = [(t0[0] - 0.8 * math.cos(a) - a * 0.18, t0[1] + 0.8 * math.sin(a) + 0.3) for a in [j * 0.9 for j in range(8)]]
    sc.chain([t0] + pts, [0.45] * 9, z=-0.5, col=dk(col, 0.1), grp='tail', fur=0, blend=0.2)
    sc.ell((0, cy + 0.6), 7.4, 5.2, z=0, col=col, cs=bel, grp='body', back=dk(col, 0.12), fur=0.12)
    sc.ell((-3.8, cy + 0.2), 3.6, 4.4, z=1.4, col=col, cs=bel, grp='body', fur=0.12)   # mông
    hc = (6.4 + nose * 0.6, cy + 0.8 - abs(nose) * 0.3) if not dead else (7.4, cy - 0.6)
    sc.ell(hc, 3.8, 3.4, z=1.8, col=col, cs=bel, grp='head', fur=0.1)
    sn = (hc[0] + 3.4, hc[1] - 0.6)
    sc.cap((hc[0] + 2.0, hc[1] - 0.4), sn, 1.9, 1.7, z=2.2, col=sp.get('muzcol', lt(col, 0.1)), grp='muzzle', fur=0, blend=0.3)
    for near in (0, 1):   # tai cụp về trước
        lay = 'near' if near else 'far'; o = 0 if near else -0.9
        sc.spike((hc[0] - 0.6 + o, hc[1] + 2.6), (hc[0] + 2.2 + o, hc[1] + 2.0), 1.4, z=4.4 if near else -1, col=dk(col, 0.22), grp='ear', layer=lay, fur=0)
    def face(d):
        e = (hc[0] + 1.0, hc[1] + 0.8)
        if dead: d.line((e[0] - 0.5, e[1]), (e[0] + 0.5, e[1]), '#2a1414'); return
        d.px(e[0], e[1], '#2a1414')
        d.px(sn[0] + 0.9, sn[1] + 0.3, '#a8565a'); d.px(sn[0] + 0.9, sn[1] - 0.7, '#a8565a')
    sc.mark(face)


# ======================= trâu: thân nặng, u vai, đầu cúi, sừng lưỡi liềm, đuôi có chùm lông =======================
def buffalo(sc, sp, kind, i):
    col, bel = sp['col'], sp.get('belly', lt(sp['col'], 0.15)); dead = kind == 'dead'
    step = bob = nod = 0.0
    if kind == 'walk': p = i / 6; step = math.sin(p * TAU); bob = abs(math.cos(p * TAU)) * 0.6; nod = math.sin(p * TAU * 2) * 0.4
    elif kind == 'idle': bob = math.sin(i / 4 * TAU) * 0.2; nod = math.sin(i / 4 * TAU) * 0.3
    elif kind == 'atk': nod = [0, 1.2, -1.6, -0.4][i]
    elif kind == 'hurt': nod = 1.0
    cy = 12.0 + bob if not dead else 6.0
    legs4(sc, cy, step, [(-6.6, 0), (6.0, 0), (-7.2, 1), (5.4, 1)], 9, 1.7, col, sp.get('hoof', '#1e1a1a'), dead, 1.8)
    tb = (-10.4, cy + 2.0)
    tp = bez([tb, (-11.6, cy - 1), (-11.4 + step * 0.6, cy - 6)], 6) if not dead else bez([tb, (-14, cy), (-17, 1.5)], 6)
    sc.chain(tp, [0.6, 0.55, 0.5, 0.45, 0.42, 0.4, 0.4], z=-0.4, col=dk(col, 0.1), grp='tail', fur=0)
    sc.ell(tp[-1], 0.8, 1.4, z=-0.3, col=dk(col, 0.35), grp='tail', fur=0.6)
    sc.ell((0, cy + 0.8), 10.6, 6.0, z=0, col=col, cs=bel, grp='body', back=dk(col, 0.12), fur=0.12)
    sc.ell((5.0, cy + 2.2), 4.8, 5.2, z=0.6, col=col, cs=bel, grp='body', fur=0.15)   # u vai
    sc.ell((-6.4, cy + 0.8), 4.4, 5.0, z=1.2, col=col, cs=bel, grp='body', fur=0.12)   # mông
    hc = (11.4, cy - 0.4 - nod * 1.4) if not dead else (12.6, 3.2)
    sc.cap((7.6, cy + 1.6), hc, 3.6, 2.8, z=1.4, col=col, cs=bel, grp='neck', fur=0.12)
    sc.ell(hc, 3.2, 2.7, z=1.8, col=col, cs=bel, grp='head', fur=0.08)
    sc.cap((hc[0] + 1.4, hc[1] - 0.6), (hc[0] + 3.4, hc[1] - 1.6), 1.9, 1.6, z=2.0, col=sp.get('muzcol', lt(col, 0.1)), grp='muzzle', fur=0, blend=0.4)
    hcol = sp.get('horns', '#e8e0c8')
    for near in (0, 1):   # sừng lưỡi liềm cong ra sau rồi vểnh lên
        lay = 'near' if near else 'far'; o = 0 if near else 1.2
        hp = bez([(hc[0] - 0.2 + o * 0.4, hc[1] + 2.0), (hc[0] - 3.2 + o, hc[1] + 3.0), (hc[0] - 5.0 + o, hc[1] + 6.4), (hc[0] - 2.6 + o, hc[1] + 9.2)], 7)
        sc.chain(hp, [0.95, 0.9, 0.8, 0.7, 0.55, 0.42, 0.3, 0.18], z=7.0 if near else -1.2, col=hcol if near else dk(hcol, 0.2), grp='horn', layer=lay, spec=0.6, blend=0.25, fur=0)
        sc.spike((hc[0] - 1.0 + o * 0.5, hc[1] + 1.0), (hc[0] - 3.4 + o * 0.5, hc[1] + 0.2), 0.9, z=2.4 if near else -1, col=dk(col, 0.05), grp='ear', layer=lay, fur=0)
    def face(d):
        e = (hc[0] + 0.6, hc[1] + 0.5)
        if dead: d.line((e[0] - 0.5, e[1]), (e[0] + 0.5, e[1]), '#0e0a0a'); return
        d.px(e[0], e[1], '#0e0a0a')
        if sc.u > 1.3: d.px(e[0] + 0.5, e[1] + 0.5, '#ffffff')
        d.px(hc[0] + 4.3, hc[1] - 1.4, '#1a1414')
    sc.mark(face)


B.FN['bird'] = bird
B.FN['pig'] = pig
B.FN['buffalo'] = buffalo

DOG = S(WOLF, L=12.5, sh=25, hip=24.5, bodyr=7.4, fl=(7.2, 8.6, 3.6), hl=(8.6, 9.0, 5.2), headr=4.4, muzzle=(5.0, 2.3),
        neck=(6.2, 4.6), stride=11, lift=4, tail='monkey', ears='point', fur=0.5, pants=False, cheek=0.7)
PIG = S(BEAR, L=14, sh=21, hip=21, bodyr=9.6, bw=(1.05, 0.98, 1.0), fl=(5.8, 6.2, 2.4), flw=(3.4, 2.8, 2.2, 2.4), hl=(6.2, 6.4, 2.8),
        hlw=(3.8, 3.0, 2.2, 2.4), thigh=(5.6, 7.4), arm=(3.8, 5.0), headr=6.0, muzzle=(3.4, 3.0), neck=(9.5, -1.0), neckw=(7.6, 6.2),
        hump=False, rears=0, tail='stub', ears='round', earr=0.48, claws=False, fur=0.12, stride=8, lift=2.5)
BUFFALO = S(BEAR, L=17, sh=31, hip=31, bodyr=10.4, bw=(1.0, 0.9, 0.95), fl=(9.5, 10.5, 3.2), flw=(4.4, 3.6, 2.6, 2.8), hl=(10, 10.5, 4.6),
            hlw=(5.4, 3.8, 2.6, 2.8), thigh=(6.8, 9.0), arm=(4.6, 6.6), headr=6.4, muzzle=(4.8, 3.6), neck=(11.5, 1.0), neckw=(7.6, 6.0),
            hump=False, rears=0, tail='long', ears='round', earr=0.36, claws=False, fur=0.15, stride=11, lift=3)

ANIMALS = {
    'cho_vang': ('Chó Vàng', S(DOG, col='#c89040', belly='#f2dcb0', back='#8a5a20', k=0.82)),
    'cho_muc': ('Chó Mực', S(DOG, col='#2e2a26', belly='#4a423a', back='#1a1614', eye='#c08030', muzcol='#3a342e', collar='#c8302a', k=0.82)),
    'meo_muop': ('Mèo Mướp', S(CAT, col='#b09070', belly='#f0e2cc', back='#8a6a48', stripes='#4a3420', eye='#7ac040', k=0.55)),
    'heo': ('Heo Ỉn', dict(kind='pig', col='#eeb0a6', belly='#f8d4cc', muzcol='#f8c0b8', k=1.7)),
    'trau': ('Trâu Nước', dict(kind='buffalo', col='#4c4c56', belly='#6a6a74', muzcol='#5c5c66', horns='#e8e0c8', k=1.6)),
    'ga_trong': ('Gà Trống', dict(kind='bird', col='#c8501e', belly='#8a2a10', neck='#f0a030', headcol='#e88a2a', wing='#8a2a14', wingtip='#2a4a3a',
                               tail='rooster', tailcol='#1a3a2e', tailcol2='#2a6a4a', comb='big', k=2.0)),
    'ga_mai': ('Gà Mái', dict(kind='bird', col='#b88850', belly='#d8b080', neck='#c89860', wing='#9a6a38', speckle='#7a5428', tail='hen', comb='small', k=1.8)),
    'vit': ('Vịt Cỏ', dict(kind='bird', duck=1, col='#a8865a', belly='#d8c0a0', neck='#2a6a3a', headcol='#2a6a3a', ring='#f4f4f0', wing='#7a5a38',
                          wingtip='#3a5ac8', speckle='#6a4a2a', tail='duck', tailcol='#4a3a2a', beak='#e8c040', legcol='#f08a20', leg=3.4,
                          body=(5.0, 3.2), head=1.6, k=1.8)),
}


def render_sheet(mid, sp):
    sp = dict(sp); sp.setdefault('k', 1.0)
    cell, fy, u = 96, 85, sp['k']
    sheet = np.zeros((cell, cell * len(FRAMES), 4), np.uint8)
    for c, (kind, i) in enumerate(FRAMES):
        sc = Scene(cell, cell, cell / 2, fy, u)
        B.FN[sp['kind']](sc, sp, kind, i)
        sheet[:, c * cell:(c + 1) * cell] = sc.render(seed=hash((mid, kind, i)) % 10000)
    return Image.fromarray(sheet, 'RGBA')


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'design/animals_preview'
    os.makedirs(out, exist_ok=True)
    sheets = {}
    for mid, (name, sp) in ANIMALS.items():
        try:
            im = render_sheet(mid, sp); im.save(os.path.join(out, mid + '.png')); sheets[mid] = (name, im); print('ok', mid)
        except Exception as e:
            import traceback; print('LỖI', mid, e); traceback.print_exc()
    # ghép xem thử: mỗi con 1 hàng – đứng, đi (2 khung), đánh, ngã; phóng 3 lần trên nền cỏ
    cols = [0, 5, 8, 12, 15]; Z = 3; cw = 96 * Z
    W, H = 200 + cw * len(cols), (cw - 60) * len(sheets) + 40
    pv = Image.new('RGB', (W, H), (74, 120, 62)); dr = ImageDraw.Draw(pv)
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26); small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
    except Exception: font = small = None
    for j, lab in enumerate(['Đứng', 'Đi', 'Đi', 'Đánh', 'Ngã']): dr.text((200 + j * cw + cw // 2 - 24, 8), lab, fill=(255, 245, 210), font=small)
    for r, (mid, (name, im)) in enumerate(sheets.items()):
        y0 = 40 + r * (cw - 60) - 40
        dr.rectangle([0, y0 + 40, W, y0 + cw - 20], fill=(84, 132, 70) if r % 2 else (74, 120, 62))
        dr.text((16, y0 + cw // 2 - 14), name, fill=(255, 240, 200), font=font)
        for j, c in enumerate(cols):
            fr = im.crop((c * 96, 0, c * 96 + 96, 96)).resize((cw, cw), Image.NEAREST)
            pv.paste(fr, (200 + j * cw, y0), fr)
    pv.save(os.path.join(out, 'preview.png')); print('preview', pv.size)
