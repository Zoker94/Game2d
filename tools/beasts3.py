# Vẽ lại THÚ (sói, gấu, hổ/báo, khỉ, thỏ, rắn, bò cạp) bằng tools/beastgen.py: khối cơ bắp hòa liền,
# lông theo chiều, bụng sáng / lưng sẫm, vằn đốm theo toạ độ, chi tiết mặt vẽ ở lưới pixel cuối.
# Nhìn ngang quay phải (game tự lật). Sheet 1 hàng, định dạng 'side':
#   cột: đứng 0-3, đi 4-9, đánh 10-13, trúng đòn 14, ngã 15.
# Thú thường: ô 96 (cùng tỉ lệ nhân vật trong game). Boss: ô 216, game phóng thêm theo `size`.
# Dùng: python3 tools/beasts3.py <thư mục ra> [mã ...]
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from beastgen import Scene, hx, mixc, darkc, lightc

TAU = math.pi * 2
FRAMES = [('idle', i) for i in range(4)] + [('walk', i) for i in range(6)] + [('atk', i) for i in range(4)] + [('hurt', 0), ('dead', 0)]


def lerp(a, b, t): return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
def add(a, b): return (a[0] + b[0], a[1] + b[1])
def bez(p, n=12):
    out = []
    for i in range(n + 1):
        t = i / n; q = list(p)
        while len(q) > 1: q = [lerp(q[j], q[j + 1], t) for j in range(len(q) - 1)]
        out.append(q[0])
    return out


def ik(a, t, l1, l2, bend):
    """khớp giữa của chi 2 đoạn (toạ độ y lên); bend=+1 khớp chĩa ra trước (phải), -1 ra sau"""
    dx, dy = t[0] - a[0], t[1] - a[1]
    d = max(1e-3, min(l1 + l2 - 1e-3, math.hypot(dx, dy)))
    ang = math.atan2(dy, dx)
    c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
    off = math.acos(max(-1, min(1, c)))
    a1 = ang + off * bend
    return (a[0] + math.cos(a1) * l1, a[1] + math.sin(a1) * l1)


def hexs(c): c = hx(c); return '#%02x%02x%02x' % tuple(int(max(0, min(255, v))) for v in c)
def dk(c, t=0.3): return hexs(darkc(c, t))
def lt(c, t=0.3): return hexs(lightc(c, t))
def mx(a, b, t): return hexs(mixc(a, b, t))


# ======================= dáng đi / đánh chung cho thú 4 chân =======================
def quad_pose(kind, i):
    o = dict(bob=0, head=0, jaw=0, lunge=0, rear=0, tail=0, flinch=0, legs=None, crouch=0, swipe=0)
    if kind == 'idle':
        o['bob'] = math.sin(i / 4 * TAU) * 0.5; o['head'] = math.sin(i / 4 * TAU + 1) * 0.6; o['tail'] = math.sin(i / 4 * TAU) * 0.2
    elif kind == 'walk':
        p = i / 6
        o['legs'] = [(p + d) % 1 for d in (0.0, 0.5, 0.25, 0.75)]   # sau gần, sau xa, trước gần, trước xa
        o['bob'] = abs(math.sin(p * TAU * 2)) * 1.0; o['head'] = math.sin(p * TAU * 2) * 0.7; o['tail'] = math.sin(p * TAU) * 0.4
    elif kind == 'atk':
        o['lunge'] = [0.0, -4, 8, 3][i]; o['head'] = [-1, -2.5, -3, -1][i]; o['jaw'] = [0.2, 0.6, 1.0, 0.4][i]
        o['crouch'] = [0, 2.5, -1, 0.5][i]; o['rear'] = [0, 0.45, 1.0, 0.35][i]; o['swipe'] = [0, 0.2, 1.0, 0.5][i]; o['tail'] = [0, 0.3, -0.3, 0][i]
    elif kind == 'hurt':
        o['flinch'] = 1; o['head'] = 2.5; o['jaw'] = 0.5; o['tail'] = -0.4
    return o


def leg_target(x, phase, stride, lift):
    if phase is None: return (x, 0.0), 0.0
    if phase < 0.6:
        t = phase / 0.6; return (x + stride * (0.5 - t), 0.0), 0.0
    t = (phase - 0.6) / 0.4
    return (x + stride * (-0.5 + t), math.sin(t * math.pi) * lift), t


# ======================= thú 4 chân: sói / hổ / gấu =======================
def quadruped(sc, sp, kind, i):
    o = quad_pose(kind, i)
    col, bel, back = sp['col'], sp['belly'], sp.get('back', dk(sp['col'], 0.18))
    legcol = sp.get('legcol', col)
    fz = sp.get('fur', 1.0)
    dead = kind == 'dead'
    L, SH, HP = sp['L'], sp['sh'], sp['hip']
    rears = sp.get('rears', 0)
    rear = o['rear'] * rears
    lunge = o['lunge'] * (0.5 if rears else 1)
    fl = -2.5 if o['flinch'] else 0
    bob = o['bob'] - o['crouch'] - (1.2 if o['flinch'] else 0)
    hx_, hy = -L + lunge * 0.3 + fl, HP + bob
    sx, sy = L + lunge + fl - rear * L * 0.45, SH + bob + rear * SH * 0.75
    if dead: hx_, hy, sx, sy = -L, sp['bodyr'] * 1.15, L - 1, sp['bodyr'] * 1.25
    hip, sh = (hx_, hy), (sx, sy)
    ang = math.atan2(sy - hy, sx - hx_)
    br = sp['bodyr']
    fur = dict(fur=fz)
    # ---- đuôi (vẽ trước: nằm sau đùi) ----
    tl = sp.get('tail')
    sw = o['tail'] * 6
    if tl:
        base = (hx_ - br * 0.45, hy - br * 0.15)
        if tl == 'bushy':
            pts = bez([base, (base[0] - 6, base[1] - 3 + sw * 0.4), (base[0] - 11, base[1] - 11 + sw), (base[0] - 12 + sw * 0.3, base[1] - 19 + sw * 0.6)], 7)
            if dead: pts = bez([base, (base[0] - 9, base[1] - 3), (base[0] - 18, 2.5)], 7)
            rs = [2.2, 3.0, 3.6, 4.0, 4.0, 3.6, 2.8, 1.6]
            sc.chain(pts, rs, z=-1, col=col, cs=bel, flow=None, grp='tail', **fur)
            for j in range(1, len(pts) - 1):
                a_, b_ = pts[j - 1], pts[j + 1]; dx, dy = b_[0] - a_[0], b_[1] - a_[1]; ln = math.hypot(dx, dy) or 1
                for sg in (-1, 1):
                    nx, ny = -dy / ln * sg, dx / ln * sg
                    bp = (pts[j][0] + nx * rs[j] * 0.7, pts[j][1] + ny * rs[j] * 0.7)
                    sc.spike(bp, (bp[0] + nx * 2.4 + dx / ln * 2.2, bp[1] + ny * 2.4 + dy / ln * 2.2), 1.3, z=-1, col=col, grp='tail', fur=fz)
            tip = pts[-2:]
            sc.patterns.append((['tail'], (lambda U, V, ny, t=tip: (U - t[0][0]) ** 2 + (V - t[0][1]) ** 2 < 14), sp.get('tailtip', dk(col, 0.45))))
        elif tl == 'monkey':   # đuôi khỉ: vểnh lên rồi cong
            pts = bez([base, (base[0] - 5, base[1] + 3), (base[0] - 8, base[1] + 10 + sw), (base[0] - 4 + sw * 0.3, base[1] + 14 + sw)], 8)
            if dead: pts = bez([base, (base[0] - 8, base[1] - 2), (base[0] - 14, 1.5)], 8)
            sc.chain(pts, [1.5, 1.4, 1.3, 1.25, 1.2, 1.15, 1.1, 1.05, 1.0], z=-1, col=col, grp='tail', fur=fz * 0.5)
        elif tl == 'long':
            pts = bez([base, (base[0] - 8, base[1] - 1), (base[0] - 14, base[1] - 12 + sw), (base[0] - 19, base[1] - 6 + sw * 1.4), (base[0] - 22, base[1] - 2 + sw)], 9)
            if dead: pts = bez([base, (base[0] - 10, base[1] - 3), (base[0] - 22, 2)], 9)
            rs = [2.6, 2.3, 2.1, 2.0, 1.9, 1.8, 1.8, 1.8, 1.9, 2.0]
            sc.chain(pts, rs, z=-1, col=col, cs=bel, grp='tail', fur=fz * 0.5)
            if sp.get('tailtip'):
                tp = pts[-1]; sc.patterns.append((['tail'], (lambda U, V, ny, t=tp: (U - t[0]) ** 2 + (V - t[1]) ** 2 < 9), sp['tailtip']))
            if sp.get('stripes'):
                P_ = pts
                def tstripe(U, V, ny, P_=P_):
                    m = np.zeros(U.shape, bool)
                    for j in range(2, len(P_) - 1, 2): m |= (np.hypot(U - P_[j][0], V - P_[j][1]) < 1.4)
                    return m
                sc.patterns.append((['tail'], tstripe, sp['stripes']))
        else:
            sc.ell((base[0] - 1, base[1] - 1), 2.6, 2.2, z=-1, col=col, grp='tail', **fur)
    # ---- chân xa (lớp sau) ----
    phs = o['legs'] or [None] * 4
    def leg(kd, near, ph):
        lay = 'near' if near else 'far'
        zoff = 3.2 if near else -2.5
        dxo = 0 if near else 1.6
        c = legcol
        st, lf = sp['stride'], sp['lift']
        if kd == 'f':
            top = (sx + 1.5 + dxo, sy - br * 0.95)
            if dead:
                paw = (top[0] + 16, 2.2 - (0 if near else 1)); ltt = 0
            elif rear:
                paw = (top[0] + 9 + o['swipe'] * 6, top[1] - 12 + o['swipe'] * 10); ltt = 1
            else:
                paw, ltt = leg_target(sx + 1.5 + dxo + o['lunge'] * 0.2, ph, st, lf)
                if o['flinch']: paw = (paw[0] - 1.5, paw[1])
            wrist = (paw[0] - 0.4 - ltt * 2.5, paw[1] + sp['fl'][2] - ltt * 1.5)
            if rear: wrist = (paw[0] - 2.5, paw[1] - 1.5)
            elbow = ik(top, wrist, sp['fl'][0], sp['fl'][1], -1 if not dead else 1)
            w = sp['flw']
            sc.cap(top, elbow, w[0], w[1], z=zoff, col=c, cs=bel, grp='leg', layer=lay, flow=None, **fur)
            sc.cap(elbow, wrist, w[1] * 0.78, w[2], z=zoff, col=c, cs=bel, grp='leg', layer=lay, **fur)
            pw = (paw[0] + 1.2, paw[1] + w[3] * 0.55) if not rear else (paw[0] + 1, paw[1])
            sc.cap(wrist, pw, w[2], w[2] * 0.95, z=zoff, col=c, grp='leg', layer=lay, fur=fz * 0.4)
            sc.ell((pw[0] + w[3] * 0.35, pw[1]), w[3], w[3] * 0.6, z=zoff, col=sp.get('pawcol', c), grp='paw', layer=lay, fur=fz * 0.3)
            if near and sp.get('arm'):
                sc.ell((top[0] - 1.0, top[1] - 2.0), sp['arm'][0], sp['arm'][1], z=zoff - 0.8, col=c, rot=-0.3, grp='leg', layer=lay, **fur)
            if sp.get('claws') and (near or sp.get('farclaws', True)):
                cp = (pw[0] + w[3] * 1.15, pw[1] - w[3] * 0.25)
                sc.mark(lambda d, cp=cp, near=near: d.px(cp[0], cp[1], '#f0e8d8' if near else '#a09888', only_on=False))
            return top, elbow, wrist, paw
        else:
            top = (hx_ + 1.0 + dxo, hy - br * 0.55)
            if dead:
                paw = (top[0] - 16, 2.2 - (0 if near else 1)); ltt = 0
            else:
                paw, ltt = leg_target(hx_ + 0.5 + dxo + o['lunge'] * 0.05, ph, st, lf)
                if rear: paw = (paw[0] + rear * 3, 0)
                if o['flinch']: paw = (paw[0] - 1, paw[1])
            hl = sp['hl']
            hock = (paw[0] - hl[2] * 0.35 - ltt * 1.5, paw[1] + hl[2] - ltt * 0.5)
            stifle = ik(top, hock, hl[0], hl[1], 1 if not dead else -1)
            w = sp['hlw']
            sc.cap(top, stifle, w[0], w[1], z=zoff, col=c, cs=bel, grp='leg', layer=lay, **fur)
            sc.cap(stifle, hock, w[1] * 0.75, w[2], z=zoff, col=c, cs=bel, grp='leg', layer=lay, **fur)
            pw = (paw[0] + 1.0, paw[1] + w[3] * 0.55)
            sc.cap(hock, pw, w[2] * 0.95, w[2] * 0.9, z=zoff, col=c, grp='leg', layer=lay, fur=fz * 0.4)
            sc.ell((pw[0] + w[3] * 0.35, pw[1]), w[3], w[3] * 0.6, z=zoff, col=sp.get('pawcol', c), grp='paw', layer=lay, fur=fz * 0.3)
            if near:   # bắp đùi
                th = sp['thigh']
                sc.ell(lerp(top, stifle, 0.45), th[0], th[1], z=zoff - 0.5, col=c, rot=0.35, grp='leg', layer=lay, flow=math.pi * 0.62, **fur)
                if sp.get('pants'):   # lông "quần" sau đùi
                    for j in range(4):
                        bp = lerp((top[0] - th[0] * 0.8, top[1] - 1), (stifle[0] - 3.5, stifle[1] - 1), j / 3)
                        sc.spike(bp, (bp[0] - 3.2, bp[1] - 2.0), 1.6, z=zoff - 0.5, col=c, grp='leg', fur=fz)
            if sp.get('claws') and near:
                cp = (pw[0] + w[3] * 1.15, pw[1] - w[3] * 0.25)
                sc.mark(lambda d, cp=cp: d.px(cp[0], cp[1], '#f0e8d8', only_on=False))
            return top, stifle, hock, paw
    leg('h', 0, phs[1]); leg('f', 0, phs[3])
    # ---- thân ----
    def on_spine(t, dy): q = lerp(hip, sh, t); return (q[0], q[1] + dy)
    chest = on_spine(0.9, -br * 0.78)
    waist = on_spine(0.45, -br * 0.62)
    loin = on_spine(0.2, -br * 0.5)
    rump = on_spine(0.0, -br * 0.52)
    bw = sp.get('bw', (1.0, 0.72, 0.78))   # bề dày ngực / eo / mông so với bodyr
    body = dict(col=col, cs=bel, back=back, grp='body', flow=ang + math.pi, **fur)
    sc.ell(chest, br * 1.08, br * bw[0], z=0, rot=-ang * 0.6, **body)
    sc.cap((chest[0] - 2, chest[1] + br * 0.1), (loin[0] + 2, loin[1] + br * 0.15), br * bw[0] * 0.85, br * bw[1], z=0, **body)
    sc.ell(rump, br * 0.82, br * bw[2], z=0, **body)
    sc.cap(rump, (sx - 2, sy - br * 0.35), br * 0.5, br * 0.55, z=0.5, **body)   # sống lưng giữ đường lưng liền
    if sp.get('hump'): sc.ell((sx - 2.5, sy - br * 0.15), br * 0.72, br * 0.62, z=0.5, **body)
    sc.ell((sx - 1.5, sy - br * 0.5), br * 0.48, br * 0.72, z=2.2, rot=-0.45, **body)   # xương bả vai phía gần
    if fz and sp.get('belly_fringe', False):   # lông ngực giữa hai chân trước
        for j in range(3):
            bp = lerp((chest[0] + br * 0.3, chest[1] - br * bw[0] * 0.75), (chest[0] - br * 0.5, chest[1] - br * bw[0] * 0.95), j / 2)
            sc.spike(bp, (bp[0] - 1.6, bp[1] - 1.6 * fz), 1.2, z=0.3, col=col, cs=bel, grp='body', fur=fz)
    # ---- chân gần ----
    leg('h', 1, phs[0]); fore = leg('f', 1, phs[2])
    # ---- cổ + đầu ----
    hr = sp['headr']
    nx, ny = sp['neck']
    hc = (sx + nx + o['lunge'] * 0.35, sy + ny + o['head'])
    if dead: hc = (sx + 9, hr * 1.0)
    if rear: hc = (hc[0] - rear * 3, hc[1] + rear * 1)
    hd = sp['hdir']   # hướng mõm (radian), đầu cúi khi đánh
    if kind == 'atk': hd += [0, -0.12, -0.05, 0][i]
    if o['flinch']: hd += 0.25
    if dead: hd = -0.05
    ca, sa = math.cos(hd), math.sin(hd)
    def H(x, y): return (hc[0] + x * ca - y * sa, hc[1] + x * sa + y * ca)
    nw = sp['neckw']
    nb = (sx + 0.5, sy - br * 0.35)
    sc.cap(nb, H(-hr * 0.5, -hr * 0.1), nw[0], nw[1], z=1.2, col=col, cs=bel, grp='neck', flow=math.atan2(nb[1] - hc[1], nb[0] - hc[0]) * -1 + math.pi, **fur)
    if sp.get('ruff') or fz >= 1:   # bờm cổ
        rc = sp.get('ruff', col)
        for j in range(5):
            bp = lerp((nb[0] - 2, nb[1] + nw[0] * 0.75), H(-hr * 0.9, hr * 0.5), j / 4)
            sc.spike(bp, (bp[0] - 2.8, bp[1] + 1.6), 1.6, z=1.0, col=rc, grp='neck', fur=fz)
        for j in range(4):
            bp = lerp((nb[0] + 3, nb[1] - nw[0] * 0.8), H(-hr * 0.1, -hr * 0.85), j / 3)
            sc.spike(bp, (bp[0] - 0.6, bp[1] - 2.6), 1.5, z=1.6, col=rc, cs=bel, grp='neck', fur=fz)
    hk = dict(col=col, grp='head', fur=fz * 0.6)
    sk = sp.get('skull', (1.0, 0.9))
    sc.ell(H(0, 0), hr * sk[0], hr * sk[1], z=2.0, back=back, **hk)
    sc.ell(H(hr * 0.35, hr * 0.32), hr * 0.5, hr * 0.38, z=2.6, **hk)   # trán / gờ mày
    if sp.get('cheek'):
        ck = sp['cheek']
        sc.ell(H(-hr * 0.2, -hr * 0.45), hr * ck, hr * ck * 0.8, z=2.4, col=col, cs=bel, grp='head', fur=fz)
        for j in range(3):
            bp = H(-hr * (0.7 + 0.1 * j), -hr * (0.1 + 0.35 * j))
            sc.spike(bp, (bp[0] - 2.2, bp[1] - 0.8), 1.3, z=2.4, col=col, cs=bel, grp='head', fur=fz)
    ml, mw = sp['muzzle']
    jaw = o['jaw']
    m0, m1 = H(hr * 0.45, -hr * 0.12), H(hr * 0.45 + ml, -hr * 0.3)
    sc.cap(m0, m1, mw, mw * 0.62, z=2.4, col=sp.get('muzcol', col), cs=bel, grp='muzzle', fur=fz * 0.3)
    ja = hd - jaw * 0.45
    j0 = H(hr * 0.3, -hr * 0.55)
    j1 = (j0[0] + math.cos(ja) * ml * 0.92, j0[1] + math.sin(ja) * ml * 0.92 - mw * 0.25)
    sc.cap(j0, j1, mw * 0.72, mw * 0.4, z=2.2, col=sp.get('muzcol', col), cs=bel, grp='jaw', fur=fz * 0.3)
    # tai
    ep = sp['ears']
    for near in (0, 1):
        lay = 'near' if near else 'far'
        ofs = 0 if near else hr * 0.38
        if ep == 'point':
            b0 = H(-hr * 0.35 + ofs, hr * 0.62); tip = H(-hr * 0.55 + ofs, hr * 1.75)
            sc.cap(b0, tip, hr * 0.42, hr * 0.06, z=2.3 if near else -1, col=col, grp='ear', layer=lay, zk=0.5, blend=0.6)
        elif ep == 'round':
            er = sp.get('earr', 0.32)
            sc.ell(H(-hr * 0.42 + ofs, hr * 0.8), hr * er, hr * er * 0.92, z=2.3 if near else -1, col=col, grp='ear', layer=lay, blend=0.6)
        elif ep == 'cat':
            b0 = H(-hr * 0.3 + ofs, hr * 0.62); tip = H(-hr * 0.42 + ofs, hr * 1.3)
            sc.cap(b0, tip, hr * 0.36, hr * 0.12, z=2.3 if near else -1, col=col, grp='ear', layer=lay, zk=0.5, blend=0.6)
        elif ep == 'side':   # tai người / khỉ: tròn nhỏ hai bên đầu
            sc.ell(H(-hr * 0.3 + ofs * 0.3, hr * 0.15), hr * 0.3, hr * 0.36, z=2.8 if near else -1, col=sp.get('facecol2', col), grp='earside', layer=lay, blend=0.4)
        elif ep == 'long':
            b0 = H(-hr * 0.4 + ofs, hr * 0.6); tip = H(-hr * 1.0 + ofs, hr * 2.6)
            sc.cap(b0, tip, hr * 0.32, hr * 0.26, z=2.3 if near else -1, col=col, grp='ear', layer=lay, zk=0.5, blend=0.6)
    if sp.get('horns'):
        hp = bez([H(-hr * 0.1, hr * 0.7), H(-hr * 0.8, hr * 1.6), H(-hr * 1.7, hr * 1.7)], 4)
        sc.chain(hp, [hr * 0.28, hr * 0.22, hr * 0.15, hr * 0.08, hr * 0.03], z=2.8, col=sp['horns'], grp='horn', spec=0.6, blend=0.3)
    if sp.get('collar'):   # vòng cổ: dải quanh cổ
        c0 = lerp(nb, H(-hr * 0.5, 0), 0.4)
        sc.patterns.append((['neck'], (lambda U, V, ny, c0=c0: np.abs((U - c0[0]) * 0.9 + (V - c0[1]) * 0.45) < 1.0), sp['collar']))
        sc.mark(lambda d, c0=c0: [d.px(c0[0] + 0.45 * j, c0[1] + 2.2 - 1.6 * j, '#fff4c0') for j in range(3)])
    if sp.get('saddle'):   # giáp da phủ lưng: ôm theo mặt trên của thân, viền kim loại ở mép dưới
        tr = sp.get('trim', '#c8a040'); sd = sp['saddle']
        x0, x1 = loin[0] - 1, sx - 2.5
        sc.patterns.append((['body'], (lambda U, V, ny, x0=x0, x1=x1: (U > x0) & (U < x1) & (ny < 0.05)), sd))
        sc.patterns.append((['body'], (lambda U, V, ny, x0=x0, x1=x1: (U > x0) & (U < x1) & (ny >= 0.05) & (ny < 0.22)), tr))
        sc.patterns.append((['body'], (lambda U, V, ny, x0=x0, x1=x1: ((np.abs(U - x0) < 0.7) | (np.abs(U - x1) < 0.7)) & (ny < 0.22)), tr))
    # ---- vằn / đốm ----
    if sp.get('stripes'):
        st = sp['stripes']
        def stripes(U, V, ny):
            w = U * 1.05 + np.sin(V * 0.7 + U * 0.33) * 1.3 + V * 0.22
            brk = np.sin(V * 1.9 + U * 0.5) + np.sin(U * 0.37 - V * 0.8)
            return (np.sin(w) > 0.7) & (brk > -1.1) & (ny < 0.4)
        sc.patterns.append((['body', 'leg', 'neck'], stripes, st))
        def hstripe(U, V, ny, hc=hc):
            return (np.sin((U - hc[0]) * 1.6 + (V - hc[1]) * 0.5) > 0.7) & (V > hc[1] + hr * 0.15) & (ny < 0.2)
        sc.patterns.append((['head'], hstripe, st))
    if sp.get('spots'):
        sc.patterns.append((['body', 'leg', 'neck'], lambda U, V, ny: (np.sin(U * 1.25 + np.sin(V * 0.9)) * np.sin(V * 1.4 + U * 0.35) > 0.62) & (ny < 0.3), sp['spots']))
    if sp.get('chestmark'):   # gấu ngựa: vệt trăng khuyết trước ngực
        c0 = (sx + 2, sy - br * 0.7)
        sc.patterns.append((['body', 'neck'], (lambda U, V, ny, c0=c0: (np.abs((V - c0[1]) + 0.9 * (U - c0[0])) < 2.0) & (U > c0[0] - 4)), sp['chestmark']))
    if sp.get('facecol'):
        fc = sp['facecol']; e_ = H(hr * 0.3, -hr * 0.25)
        sc.patterns.append((['head'], (lambda U, V, ny, e_=e_: (V < e_[1]) & (U > e_[0] - hr * 0.9)), fc))
        sc.patterns.append((['muzzle', 'jaw'], (lambda U, V, ny: np.ones(U.shape, bool)), fc))
        ey = H(hr * 0.5, hr * 0.45)
        sc.patterns.append((['head'], (lambda U, V, ny, ey=ey: (np.abs(V - ey[1]) < hr * 0.12) & (np.abs(U - ey[0]) < hr * 0.28)), fc))
    if sp.get('primate'):   # mặt khỉ: mảng mặt trần + gờ mày
        pf = sp['primate']; e_ = H(-hr * 0.05, hr * 0.5)
        sc.patterns.append((['head'], (lambda U, V, ny, e_=e_: (U > e_[0]) & (V < e_[1])), pf))
        sc.patterns.append((['muzzle', 'jaw', 'earside'], (lambda U, V, ny: np.ones(U.shape, bool)), pf))
    if sp.get('vest'):   # áo gi-lê
        vc = sp['vest']; x0, x1 = loin[0] + 1.5, sx + 3
        sc.patterns.append((['body', 'neck'], (lambda U, V, ny, x0=x0, x1=x1: (U > x0) & (U < x1)), vc))
        sc.patterns.append((['body', 'neck'], (lambda U, V, ny, x0=x0, x1=x1: (np.abs(U - x0) < 0.6) | (np.abs(U - x1) < 0.6)), sp.get('trim', '#e8c060')))
    if sp.get('golden'):   # vòng kim cô
        gb = H(hr * 0.1, hr * 0.55)
        sc.patterns.append((['head'], (lambda U, V, ny, gb=gb: np.abs((V - gb[1]) - (U - gb[0]) * 0.25) < 0.55), '#ffd040'))
    if sp.get('sockcol'):
        sc.patterns.append((['leg', 'paw'], lambda U, V, ny: V < 7, sp['sockcol']))
    if sp.get('frost'):
        sc.patterns.append((['body', 'neck', 'head', 'tail'], lambda U, V, ny: (np.sin(U * 2.3 + V * 1.7) * np.sin(V * 2.9 - U * 0.7) > 0.86), ('#ffffff', 0.6)))
    if sp.get('ear_in'):
        pass
    # ---- mặt (lưới pixel) ----
    eye = sp.get('eye', '#e0b030')
    def face(d):
        e = H(hr * 0.42, hr * 0.12)
        if dead:
            d.line((e[0] - 0.8, e[1]), (e[0] + 1.0, e[1]), '#140a0c'); return
        if sc.u > 1.5:
            d.ell((e[0] - 0.2, e[1] - 0.1), 1.1, 0.7, '#140a0c'); d.ell((e[0] + 0.15, e[1]), 0.65, 0.45, eye)
            d.line((e[0] - 1.4, e[1] + 0.8), (e[0] + 1.0, e[1] + 0.9), dk(col, 0.55))
        else:
            d.px(e[0] - 0.9, e[1] + 0.3, dk(col, 0.6)); d.px(e[0], e[1], '#140a0c'); d.px(e[0] + 0.9, e[1], eye)
        nose = H(hr * 0.45 + ml + mw * 0.3, -hr * 0.3 + mw * 0.15)
        d.px(nose[0], nose[1], sp.get('nose', '#16100e')); d.px(nose[0] - 0.9, nose[1], sp.get('nose', '#16100e'))
        if sp.get('primate'):
            if jaw > 0.3: d.px(nose[0] - 1, nose[1] - 1.5, '#5a0c16', only_on=False)
            if sc.u > 0.8: d.line(H(hr * 0.15, hr * 0.42), H(hr * 0.75, hr * 0.38), dk(col, 0.5))
        elif jaw > 0.3:
            # miệng há: lòng đỏ + răng nanh
            a0, a1 = H(hr * 0.55, -hr * 0.62), H(hr * 0.45 + ml * 0.95, -hr * 0.3 - mw * 0.55)
            b1 = (j1[0], j1[1] + mw * 0.3)
            d.poly([a0, a1, b1], '#5a0c16', only_on=False)
            d.px(a1[0] - 0.8, a1[1] - 0.9, '#fff6e6', only_on=False); d.px(b1[0] - 0.8, b1[1] + 0.9, '#fff6e6', only_on=False)
            if sc.u > 1.5: d.px(a1[0] - 2.6, a1[1] - 0.9, '#fff6e6', only_on=False)
        else:
            m_a, m_b = H(hr * 0.5, -hr * 0.62), H(hr * 0.4 + ml * 0.9, -hr * 0.5 - mw * 0.2)
            d.line(m_a, m_b, dk(col, 0.62))
        if ep in ('point', 'cat') and sc.u > 0.8:
            ein = H(-hr * 0.42, hr * (1.0 if ep == 'point' else 0.85))
            d.px(ein[0], ein[1], sp.get('earin', dk(col, 0.4)))
        if sp.get('scar'): d.line(H(-hr * 0.1, hr * 0.7), H(-hr * 0.45, -hr * 0.2), mx(col, '#e8c8c8', 0.6))
        if sp.get('lynx'): d.line(H(-hr * 0.55, hr * 1.35), H(-hr * 0.6, hr * 1.8), '#1a1210', only_on=False)
    sc.mark(face)


# ======================= thỏ =======================
def rabbit(sc, sp, kind, i):
    col, bel = sp['col'], sp.get('belly', lt(sp['col'], 0.45))
    dead = kind == 'dead'
    up, stretch, kick = 0, 0, 0
    if kind == 'walk':
        p = i / 6; up = max(0, math.sin(p * TAU)) * 5; stretch = math.sin(p * TAU)
    elif kind == 'idle': up = 0; stretch = math.sin(i / 4 * TAU) * 0.15
    elif kind == 'atk': kick = [0, -1, 1, 0.4][i]; up = [0, 1, 4, 1][i]; stretch = kick
    elif kind == 'hurt': stretch = -0.6
    cy = 5.4 + up if not dead else 3.2
    f = dict(fur=0.7)
    ear = 1 if kind != 'hurt' else 0.75
    hc = (7.2 + stretch * 1.5, cy + 4.2) if not dead else (8.5, 3.2)
    for near in (0, 1):
        lay = 'near' if near else 'far'; z = 2.4 if near else -2; dx = 0 if near else 1.0
        # tai
        ea = (hc[0] - 0.8 + dx * 0.8, hc[1] + 2.0); et = (hc[0] - 3.4 + dx * 1.2 - (4 if dead else 0), hc[1] + (8.5 * ear if not dead else 2))
        sc.cap(ea, et, 1.15, 0.85, z=z + 0.4, col=col, grp='ear', layer=lay, zk=0.4, blend=0.4)
        # chân trước
        fs = (4.6 + stretch * 1.2 + dx, cy - 1.8)
        fp = (fs[0] + 1.2 + max(0, stretch) * 2.5, 0.7 if not up or kind != 'walk' else up * 0.4 + 0.7)
        if dead: fp = (fs[0] + 4, 1.0)
        sc.cap(fs, fp, 1.1, 0.75, z=z, col=col, cs=bel, grp='leg', layer=lay, **f)
        # chân sau (bàn dài nằm sát đất)
        hs = (-3.0 + dx, cy - 2.0)
        kick_x = -max(0, stretch) * 3 - (kick > 0.5) * 3
        heel = (hs[0] - 1.5 + kick_x, 1.6 + up * 0.25)
        toe = (heel[0] + 5.0 - (2 if kick_x < -1 else 0), 0.7 + up * 0.15)
        if dead: heel, toe = (hs[0] - 4, 1.2), (hs[0] - 8, 1.0)
        sc.cap(hs, heel, 1.6, 1.3, z=z, col=col, grp='leg', layer=lay, **f)
        sc.cap(heel, toe, 1.3, 0.9, z=z, col=col, grp='leg', layer=lay, **f)
    sc.ell((-3.6, cy + 0.6), 5.0, 4.6, z=0, col=col, cs=bel, grp='body', back=dk(col, 0.15), **f)          # mông
    sc.ell((1.2 + stretch, cy + 0.9), 5.0, 3.9, z=0, col=col, cs=bel, grp='body', back=dk(col, 0.15), rot=-0.1, **f)
    sc.ell((4.4 + stretch * 1.3, cy + 0.2), 3.0, 3.4, z=0.3, col=col, cs=bel, grp='body', **f)
    sc.ell((-3.2, cy - 0.6), 3.6, 3.9, z=2.0, col=col, cs=bel, grp='body', **f)                              # đùi sau gần
    sc.ell((-8.6, cy + 1.6), 1.7, 1.6, z=0.5, col='#f8f4ee', grp='tail', fur=0.5)                              # đuôi bông
    sc.ell(hc, 3.3, 2.9, z=2.4, col=col, grp='head', **f)
    sc.ell((hc[0] + 2.4, hc[1] - 0.8), 1.8, 1.6, z=2.8, col=col, cs=bel, grp='muzzle', fur=0.3)
    def face(d):
        e = (hc[0] + 0.9, hc[1] + 0.4)
        if dead: d.line((e[0] - 0.6, e[1]), (e[0] + 0.6, e[1]), '#1a0e0e'); return
        d.px(e[0], e[1], '#1a0e0e'); d.px(e[0] + 0.9, e[1], '#3a1e1a')
        if sc.u > 1.3: d.px(e[0] + 0.9, e[1] + 0.9, '#ffffff')
        d.px(hc[0] + 4.0, hc[1] - 0.4, '#d87a8a')
    sc.mark(face)


# ======================= rắn =======================
def snake(sc, sp, kind, i):
    col, bel = sp['col'], sp.get('belly', lt(sp['col'], 0.45))
    pat = sp.get('pattern', dk(col, 0.4))
    dead = kind == 'dead'
    ph = (i / 6 if kind == 'walk' else i / 4) * TAU
    rise = [0.55, 0.95, 0.4, 0.65][i] if kind == 'atk' else {'hurt': 0.45, 'idle': 0.62 + math.sin(ph) * 0.05, 'walk': 0.5, 'dead': 0}[kind]
    strike = [0, -5, 13, 5][i] if kind == 'atk' else (-2 if kind == 'hurt' else 0)
    sc.u *= 1.15
    rmax = sp['w'] * 0.4
    N = 30; pts, rs, zs = [], [], []
    for j in range(N):
        t = j / (N - 1)   # 0 đuôi -> 1 đầu
        r = rmax * (0.2 + 0.8 * min(1, t * 2.2) ** 0.6)
        if t > 0.72: r *= 1 - (t - 0.72) * 0.75
        if dead:
            x, dep, y = -26 + t * 44, math.sin(t * 7) * 3, r
        else:
            g = min(t, 0.62)
            x = -22 + g * 46 + math.sin(g * 15 + ph) * 2.2
            dep = math.cos(g * 15 + ph) * 5.5 * (1 - g * 0.6)   # khúc uốn trên mặt đất (gần/xa)
            y = r
            if t > 0.62:   # cổ dựng chữ S, đầu chĩa ngang
                u_ = (t - 0.62) / 0.38
                x += u_ * (5 + strike) - math.sin(u_ * math.pi) * 3.5
                y += (1 - math.cos(u_ * math.pi * 0.9)) * 0.5 * 26 * rise
                dep *= (1 - u_)
        pts.append((x, y - dep * 0.32)); rs.append(r); zs.append(dep)
    sc.blend = 1.0
    sc.chain(pts, rs, z=zs, col=col, cs=bel, back=dk(col, 0.12), grp='body', spec=0.35, fur=0)
    P_ = pts; R_ = rs
    def blot(U, V, ny):
        m = np.zeros(U.shape, bool)
        for j in range(1, len(P_) - 4, 3):
            m |= (np.abs(U - P_[j][0]) * 0.8 + np.abs(V - P_[j][1] - R_[j] * 0.25) < R_[j] * 0.62)
        return m & (ny < 0.25)
    sc.patterns.append((['body'], blot, pat))
    hc = (pts[-1][0] + rs[-1] * 0.5, pts[-1][1] + 0.4)
    hr = sp['head'] * 0.52
    if sp.get('hood') and not dead:
        hp = (hc[0] - hr * 1.5, hc[1] - hr * 1.5)
        sc.ell(hp, hr * 1.0, hr * 1.9, z=-0.4, col=mx(col, sp['hood'], 0.35), cs=bel, grp='hood', spec=0.3, blend=1.2, rot=0.25)
    jaw = 1 if kind == 'atk' and i in (1, 2) else 0
    sc.ell(hc, hr * 1.3, hr * 0.8, z=1.0, col=col, back=dk(col, 0.15), grp='head', spec=0.4, blend=0.6)
    sc.cap((hc[0] + hr * 0.5, hc[1] - hr * 0.05), (hc[0] + hr * 1.6, hc[1] - hr * 0.15), hr * 0.62, hr * 0.42, z=1.2, col=col, grp='head', spec=0.4, blend=0.5)
    if jaw:
        sc.cap((hc[0] + hr * 0.2, hc[1] - hr * 0.5), (hc[0] + hr * 1.2, hc[1] - hr * 1.6), hr * 0.45, hr * 0.3, z=1.0, col=bel, grp='jaw', blend=0.3)
    if sp.get('horns'):
        hp = bez([(hc[0] - hr * 0.2, hc[1] + hr * 0.5), (hc[0] - hr * 1.0, hc[1] + hr * 1.6), (hc[0] - hr * 2.0, hc[1] + hr * 1.9)], 4)
        sc.chain(hp, [hr * 0.36, hr * 0.28, hr * 0.2, hr * 0.12, hr * 0.05], z=2.0, col=sp['horns'], grp='horn', spec=0.6, blend=0.3)
    def face(d):
        e = (hc[0] + hr * 0.45, hc[1] + hr * 0.3)
        if dead: d.line((e[0] - 0.6, e[1]), (e[0] + 0.6, e[1]), '#100808'); return
        if sc.u > 1.3:
            d.ell(e, 0.75, 0.6, '#100808'); d.ell((e[0] + 0.1, e[1]), 0.5, 0.4, sp.get('eye', '#ffd020')); d.line((e[0] + 0.1, e[1] + 0.4), (e[0] + 0.1, e[1] - 0.4), '#100808')
        else:
            d.px(e[0], e[1], sp.get('eye', '#ffd020')); d.px(e[0] - 0.9, e[1], '#100808')
        if jaw:
            a0 = (hc[0] + hr * 0.2, hc[1] - hr * 0.3)
            d.poly([a0, (hc[0] + hr * 2.0, hc[1] - hr * 0.4), (hc[0] + hr * 1.3, hc[1] - hr * 1.5)], '#5a0a1a', only_on=False)
            d.px(hc[0] + hr * 1.6, hc[1] - hr * 0.7, '#ffffff', only_on=False)
            d.line((hc[0] + hr * 2.0, hc[1] - hr * 0.5), (hc[0] + hr * 2.0 + 3.5, hc[1] - hr * 0.8), '#e02040', only_on=False)
        else:
            d.line((hc[0] + hr * 0.3, hc[1] - hr * 0.35), (hc[0] + hr * 1.9, hc[1] - hr * 0.4), dk(col, 0.55))
    sc.mark(face)


# ======================= bò cạp =======================
def scorpion(sc, sp, kind, i):
    sc.u *= 1.35
    col = sp['col']; bel = lt(col, 0.2); dkc = dk(col, 0.25)
    dead = kind == 'dead'
    ph = (i / 6 if kind == 'walk' else 0) * TAU
    lf = [0.15, 0.55, 1.0, 0.4][i] if kind == 'atk' else (0.2 if kind == 'hurt' else 0)
    by = 4.6 + (math.sin(ph * 2) * 0.3 if kind == 'walk' else 0) if not dead else 3.0
    ch = dict(col=col, spec=0.75, fur=0, cs=bel, back=dkc)
    sc.blend = 0.5
    # chân: 4 đôi, khớp gối nhô cao
    for near in (0, 1):
        lay = 'near' if near else 'far'; z = 3 if near else -3
        for j in range(4):
            rx = 5.5 - j * 2.6 + (0 if near else 0.8)
            sw = math.sin(ph + j * 1.6 + near * math.pi) * 1.6 if kind == 'walk' else 0
            spread = (j - 1.2) * 2.4
            root = (rx, by - 0.4)
            knee = (rx + spread * 0.6 + sw * 0.4, by + 3.6 - (0 if near else 0.6))
            foot = (rx + spread * 1.6 + sw + 1, 0.4 if not dead else 1.6)
            sc.cap(root, knee, 1.15, 0.85, z=z, col=col if near else dkc, grp='leg', layer=lay, spec=0.6, blend=0.2)
            sc.cap(knee, foot, 0.85, 0.4, z=z, col=col if near else dkc, grp='leg', layer=lay, spec=0.6, blend=0.2)
    # thân: đầu ngực + 6 đốt bụng
    sc.ell((6.5, by + 0.6), 4.4, 3.0, z=0, grp='body', **ch)
    for j in range(6):
        cx = 2.6 - j * 2.3
        sc.ell((cx, by + 0.4), 1.6, 3.2 - abs(j - 2) * 0.22, z=0, grp='body', blend=0.15, **ch)
    # đuôi 5 đốt cong qua lưng
    ctrl = [(-11.5, by + 0.8), (-17.5, by + 5), (-17.5 + lf * 4, by + 14 + lf * 2), (-11 + lf * 12, by + 19 - lf * 3), (-4 + lf * 16, by + 18 - lf * 10)]
    if dead: ctrl = [(-11.5, by), (-17, by + 0.5), (-22, by + 1.5), (-26, by + 3), (-28, by + 5)]
    tp = bez(ctrl, 5)
    for j in range(len(tp) - 1):
        a_, b_ = tp[j], tp[j + 1]
        sc.cap(a_, b_, 2.1 - j * 0.12, 1.9 - j * 0.12, z=0.5, grp='tail', blend=0.12, **ch)
    end, pv = tp[-1], tp[-2]
    ang = math.atan2(end[1] - pv[1], end[0] - pv[0])
    bulb = (end[0] + math.cos(ang) * 1.6, end[1] + math.sin(ang) * 1.6)
    sc.ell(bulb, 2.3, 1.9, z=0.8, col=sp.get('bulb', '#e0a040'), spec=0.8, grp='bulb', blend=0.2, rot=-ang)
    tipa = ang - 1.3
    sc.spike(bulb, (bulb[0] + math.cos(tipa) * 4.2, bulb[1] + math.sin(tipa) * 4.2), 1.0, z=0.8, col=dk(sp.get('bulb', '#e0a040'), 0.3), spec=0.6, grp='bulb')
    # càng
    for near in (0, 1):
        lay = 'near' if near else 'far'; z = 3.5 if near else -3
        hit = kind == 'atk' and i == 2
        reach = 1.5 + (3.5 if hit else 0)
        s0 = (9.5, by + 0.3 - (0 if near else 0.5))
        el = (13 + reach * 0.3, by + 4.4 - (0 if near else 0.5))
        cl = (16.5 + reach, by + 2.6 - (0 if near else 0.5))
        cc = col if near else dkc
        sc.cap(s0, el, 1.4, 1.3, z=z, col=cc, grp='claw', layer=lay, spec=0.7, blend=0.2)
        sc.cap(el, cl, 1.3, 1.9, z=z, col=cc, grp='claw', layer=lay, spec=0.7, blend=0.2)
        sc.ell((cl[0] + 1.6, cl[1]), 3.6, 2.4, z=z, col=cc, grp='claw', layer=lay, spec=0.8, blend=0.3)
        op = 0.9 if kind == 'atk' and i in (1, 2) else 0.35
        sc.spike((cl[0] + 3.4, cl[1] + 0.8), (cl[0] + 7.4, cl[1] + 0.8 + op * 1.6), 0.95, z=z, col=cc, grp='claw', layer=lay, spec=0.7)
        sc.spike((cl[0] + 3.4, cl[1] - 0.6), (cl[0] + 6.8, cl[1] - 0.6 - op * 1.8), 0.85, z=z, col=cc, grp='claw', layer=lay, spec=0.7)
    if sp.get('crown'):
        for j in range(3):
            b0 = (5.0 + j * 1.6, by + 3.2)
            sc.spike(b0, (b0[0] + 0.2, b0[1] + 2.2), 0.7, z=1.5, col=sp['crown'], spec=0.8, grp='crown')
    def face(d):
        for j in range(2): d.px(9.4 + j * 0.9, by + 1.6, sp.get('eye', '#200808'))
    sc.mark(face)


def S(base, **kw):
    d = dict(base); d.update(kw); return d


WOLF = dict(kind='quad', L=14.5, sh=31, hip=30, bodyr=8.8, bw=(1.05, 0.72, 0.8),
            fl=(8.5, 10.5, 4.6), flw=(3.6, 2.6, 1.55, 2.0), hl=(10.5, 11, 6.6), hlw=(4.2, 2.6, 1.5, 2.0), thigh=(5.2, 7.6), arm=(3.2, 5.2),
            headr=5.0, skull=(1.05, 0.88), muzzle=(6.4, 2.4), neck=(7, 5.5), neckw=(6.6, 4.6), hdir=-0.1,
            stride=13, lift=4.5, tail='bushy', ears='point', claws=True, fur=1.0, pants=True, cheek=0.72)
BEAR = dict(kind='quad', L=16, sh=33, hip=31.5, bodyr=10.8, bw=(1.0, 0.94, 0.96),
            fl=(9.5, 10, 4.0), flw=(5.4, 4.6, 3.6, 3.6), hl=(10, 10.5, 4.8), hlw=(6.2, 4.6, 3.6, 3.8), thigh=(7.4, 9.8), arm=(5.4, 7.4),
            headr=7.4, skull=(1.0, 0.92), muzzle=(5.2, 3.3), neck=(13.5, -2.0), neckw=(8.8, 6.8), hdir=-0.12, earr=0.42,
            stride=10, lift=4, tail='stub', ears='round', claws=True, hump=True, rears=1, fur=1.2, pants=False, cheek=0.85)
CAT = dict(kind='quad', L=17.5, sh=29, hip=29.5, bodyr=9.6, bw=(1.02, 0.82, 0.9),
           fl=(8.5, 9.0, 3.6), flw=(4.8, 4.0, 2.9, 3.2), hl=(10.5, 10.5, 5.8), hlw=(5.4, 3.6, 2.6, 3.0), thigh=(6.6, 9.0), arm=(4.6, 7.0),
           headr=6.6, skull=(1.0, 0.86), muzzle=(4.4, 3.0), neck=(10.5, 1.5), neckw=(7.0, 5.0), hdir=-0.08, facecol='#fff8f0',
           stride=14, lift=4, tail='long', ears='cat', claws=True, fur=0.6, pants=False, cheek=0.9, belly_fringe=False, earin='#e8c8c0')

SPECIES = {
    # ---- sói ----
    'soi_xam': S(WOLF, col='#8c8a88', belly='#dcd8d0', back='#5e5a58'),
    'soi_hoang': S(WOLF, col='#a8906c', belly='#e8dcc0', back='#6e5a40'),
    'lang_xam': S(WOLF, col='#6c6c72', belly='#bcb8b0', back='#46464c', ruff='#8a8a90'),
    'soi_doi': S(WOLF, col='#5c5248', belly='#a89888', back='#3a322c', scar=1, eye='#ffb020'),
    'bang_lang': S(WOLF, col='#c4d8ea', belly='#f4fbff', back='#8aa8c8', eye='#7ae0ff', frost=1, ruff='#e4f2ff'),
    'tuyet_lang': S(WOLF, col='#e4eaf0', belly='#ffffff', back='#b8c4d0', eye='#7ae0ff', frost=1),
    'ma_lang': S(WOLF, col='#3e2e3e', belly='#6e4e5e', back='#22161e', eye='#d040ff', saddle='#1a0a14', ruff='#4e2e44', trim='#a040c0'),
    'xich_lang': S(WOLF, col='#a8401c', belly='#e8a060', back='#6a1e0a', eye='#ffd040', saddle='#4a0808', ruff='#c8541e'),
    'huyet_lang': S(WOLF, col='#701010', belly='#a83030', back='#3a0404', eye='#ff2020', saddle='#2a0008', scar=1, ruff='#8a1414', trim='#ff3030'),
    'boss_soi': S(WOLF, col='#4c4c56', belly='#9a9aa2', back='#2a2a32', eye='#ff3020', saddle='#2a2a30', scar=1, collar='#c8a040', ruff='#64646e', k=1.5),
    # ---- gấu ----
    'gau_den': S(BEAR, col='#2c2420', belly='#3a302a', back='#1c1614', eye='#c08030', muzcol='#8a6a50', chestmark='#e8e0c8'),
    'gau_dong': S(BEAR, col='#5c3c24', belly='#7a5838', back='#3a2414', muzcol='#8a6a4a'),
    'gau_nui': S(BEAR, col='#7c5836', belly='#a88458', back='#54381e', muzcol='#b89870'),
    'hung_vuong': S(BEAR, col='#3c2a1e', belly='#5a4434', back='#22160e', eye='#ff3020', saddle='#5a1810', trim='#e8b040', muzcol='#6a5040', k=1.25),
    # ---- hổ / báo ----
    'ho_trang': S(CAT, col='#f0ece4', belly='#ffffff', back='#d0ccc4', stripes='#24202a', eye='#ffc828'),
    'ho_den': S(CAT, col='#3e3e46', belly='#62626a', back='#2a2a30', stripes='#141018', eye='#ffd040'),
    'linh_mieu': S(CAT, col='#c8a274', belly='#f0e2c4', back='#a07c50', spots='#5a3418', lynx=1, eye='#c8e040', tail='stub', tailtip='#2a1a10', cheek=1.05),
    'tuyet_ho': S(CAT, col='#e6ecf6', belly='#ffffff', back='#c4cede', stripes='#56688c', eye='#4ab0ff', fur=0.8),
    'tien_ho': S(CAT, col='#dceaf8', belly='#ffffff', back='#b8cce4', stripes='#98bce0', eye='#7ae0ff'),
    'xich_ho': S(CAT, col='#e07424', belly='#fff0dc', back='#b04c10', stripes='#2a0a04', eye='#ffd040'),
}


MONKEY = dict(kind='quad', L=8.5, sh=19, hip=18, bodyr=5.6, bw=(1.0, 0.85, 0.9),
              fl=(7.0, 7.4, 2.4), flw=(2.4, 1.9, 1.4, 1.6), hl=(6.6, 7.0, 3.6), hlw=(3.0, 2.0, 1.4, 1.8), thigh=(3.6, 4.6), arm=(2.2, 3.4),
              headr=4.2, skull=(1.0, 0.98), muzzle=(2.0, 2.2), neck=(5.0, 3.2), neckw=(3.6, 3.0), hdir=-0.05,
              stride=8, lift=3, tail='monkey', ears='side', claws=False, fur=0.7, rears=1, cheek=0.6, belly_fringe=False)
SPECIES.update({
    'khi_rung': S(MONKEY, col='#7c5434', belly='#b08a64', back='#563820', primate='#e8b898', facecol2='#c89878'),
    'khi_dot': S(MONKEY, col='#c8922c', belly='#e8c070', back='#8a5c14', primate='#f4d0a8', facecol2='#e0b080', vest='#a02020', golden=1, k=1.35),
    'linh_vien': S(MONKEY, col='#e6e6ee', belly='#ffffff', back='#b8b8c8', primate='#f0d4c0', facecol2='#e0c0b0', vest='#3a5a8a', eye='#60c8ff', k=1.3,
                   fl=(8.4, 8.8, 2.4), sh=21),
    'tho_rung': dict(kind='rabbit', col='#c8b498', belly='#f0e8dc', k=1.15),
    'ran_truc': dict(kind='snake', col='#3cb043', belly='#d0f0a8', pattern='#1a6a20', w=10, head=5.4, k=1.0),
    'ran_nuoc': dict(kind='snake', col='#3a7aa0', belly='#d0e8f0', pattern='#1a4a70', w=10, head=5.4, k=1.0),
    'ran_hang': dict(kind='snake', col='#5c5242', belly='#c8b898', pattern='#2a2418', w=11, head=5.8, k=1.0),
    'sa_xa': dict(kind='snake', col='#c8a060', belly='#f0e0b0', pattern='#7a5420', w=10, head=5.6, k=1.0),
    'bang_xa': dict(kind='snake', col='#a8d8f0', belly='#f0fbff', pattern='#4a90c0', eye='#e8ffff', hood='#e8ffff', w=11, head=5.8, k=1.05),
    'bang_giao': dict(kind='snake', col='#8ac0e8', belly='#f0fbff', pattern='#4a90c0', eye='#e8ffff', hood='#d8f0ff', horns='#f0f8ff', w=12, head=6.4, k=1.35),
    'doc_mang': dict(kind='snake', col='#2a6a20', belly='#c8f080', pattern='#0a3a10', eye='#ffe040', hood='#80ff40', w=12, head=6.4, k=1.35),
    'boss_truc': dict(kind='snake', col='#0a9a62', belly='#d8ffd0', pattern='#04583a', eye='#ffe040', hood='#ffe080', horns='#f0e0a0', w=12, head=6.6, k=1.6),
    'bo_cap': dict(kind='scorpion', col='#9c6838', k=1.0),
    'kim_hat': dict(kind='scorpion', col='#d0a030', bulb='#ffe060', k=1.05),
    'doc_hat': dict(kind='scorpion', col='#4a6a2a', bulb='#80ff40', eye='#80ff40', k=1.05),
    'boss_samac': dict(kind='scorpion', col='#5a2a18', bulb='#ff6020', crown='#ffd040', k=1.7),
})


def render_frame(mid, sp, kind, i, cell, fy, u):
    sc = Scene(cell, cell, cell / 2, fy, u)
    FN[sp['kind']](sc, sp, kind, i)
    return sc.render(seed=hash((mid, kind, i)) % 10000)


FN = {'quad': quadruped, 'rabbit': rabbit, 'snake': snake, 'scorpion': scorpion}


def render(mid, outdir):
    sp = dict(SPECIES[mid]); sp.setdefault('k', 1.0)
    boss = mid.startswith('boss_') or sp['k'] >= 1.5
    cell = 216 if boss else 96
    fy = cell - 11 if not boss else cell - 16
    u = sp['k'] * (1.5 if boss else 1.0)
    sheet = np.zeros((cell, cell * len(FRAMES), 4), np.uint8)
    for c, (kind, i) in enumerate(FRAMES):
        sheet[:, c * cell:(c + 1) * cell] = render_frame(mid, sp, kind, i, cell, fy, u)
    img = Image.fromarray(sheet, 'RGBA')
    img.save(os.path.join(outdir, mid + '.png'), optimize=True)
    cl = sheet[:, :cell]; ys, xs = np.where(cl[..., 3] > 0)
    return mid, dict(k='side', w=cell, h=cell, fx=cell // 2, fy=fy, top=int(fy - ys.min()) if len(ys) else 40, half=int((xs.max() - xs.min()) / 2) if len(xs) else 20)


def safe(mid, out):
    try: return render(mid, out)
    except Exception as e:
        import traceback; print('LỖI', mid, repr(e)); traceback.print_exc(); return None


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'design/monsters2'
    ids = sys.argv[2:] or list(SPECIES)
    os.makedirs(out, exist_ok=True)
    mp = os.path.join(out, 'meta_beast.json')
    meta = json.load(open(mp)) if os.path.exists(mp) else {}
    from multiprocessing import Pool
    with Pool(4) as pool:
        for r in pool.starmap(safe, [(m, out) for m in ids]):
            if r: meta[r[0]] = r[1]; print('ok', r[0], r[1])
    json.dump(meta, open(mp, 'w'), indent=1, ensure_ascii=False)
