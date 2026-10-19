#!/usr/bin/env python3
# Vẽ lại 9 thú cưỡi chi tiết (cùng bộ tô khối với tools/rig2.py, cân với nhân vật tỉ lệ người thật).
# - Khung xương 3D: thân lấy theo các mặt cắt dọc sống lưng, chân 2 đốt giải ngược (gối trước gập ra sau, khuỷu
#   chân sau chĩa ra sau), móng / bàn chân; đầu theo loài (ngựa, mèo lớn, rồng, trâu); rồng thân uốn lượn, phượng vỗ cánh.
# - Bờm, đuôi, râu rồng, lông đuôi phượng chuyển động theo mô phỏng lò xo (rig2.simulate).
# - Yên cương: chăn yên viền thêu, yên da, bàn đạp, dây cương, đai bụng.
# - Mỗi thú: hàng 0 nhìn ngang (quay phải), hàng 1-2 nhìn xuống (thân / phần đè lên người cưỡi), hàng 3-4 nhìn lên;
#   cột 0-3 đứng thở, 4-11 chạy. Ô 192, vẽ trong game x2/3 (= ô 128 cũ). Điểm yên (hông người cưỡi) từng khung.
# Dùng: python3 tools/mounts2.py [thư mục assets] [mã thú ...]
import math, os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig2 as R
from rig2 import Part, V, nrm, hull, circ, mix, light, dark, TAU

MC = 192
MX, MY = 96, 178
TILT = 0.22
VIEWS = ['side', 'down', 'up']
IDLE_N, RUN_N = 4, 8
IDLE_DUR, RUN_DUR = 2.8, 0.76


def mkpr(view):
    def pr(v):
        x, y, z = v
        if view == 'side': return (MX + y, MY - z + x * TILT, x)
        sx, dp = (-x, y) if view == 'down' else (x, -y)
        return (MX + sx, MY - 16 - z * 0.84 + dp * 0.5, dp)     # nhìn trước / sau: dốc hơn để thấy lưng và yên
    return pr


def tube(part, pr, pts, n=16):
    """thân / cổ / đuôi: các mặt cắt elip vuông góc với trục (tâm, nửa rộng, nửa cao)"""
    rings = []
    for i, (c, rx, rz) in enumerate(pts):
        a = pts[max(0, i - 1)][0]; b = pts[min(len(pts) - 1, i + 1)][0]
        t = nrm(b - a)
        side = nrm(np.cross(V(0, 0, 1), t)) if abs(t[2]) < 0.97 else V(1, 0, 0)
        up = nrm(np.cross(t, side))
        rings.append([pr(c + side * math.cos(q) * rx + up * math.sin(q) * rz)[:2] for q in np.linspace(0, TAU, n, endpoint=False)])
    for r0, r1 in zip(rings, rings[1:]): part.poly(hull(r0 + r1))
    return part


def ringpts(c, t, rx, rz, n=24):
    t = nrm(t)
    side = nrm(np.cross(V(0, 0, 1), t)) if abs(t[2]) < 0.97 else V(1, 0, 0)
    up = nrm(np.cross(t, side))
    return [c + side * math.cos(q) * rx + up * math.sin(q) * rz for q in np.linspace(0, TAU, n, endpoint=False)]


# ================= các loài =================
def quad(**kw):
    d = dict(kind='quad', head='horse', bounce=3.0, pitch=0.05, stride=38, lift=15, stance=0.42, speed=270,
             phase={'FR': 0.56, 'FL': 0.46, 'HR': 0.1, 'HL': 0.0}, tack=True, socks=None, hoof='#2a2420')
    d.update(kw); return d

HORSE_BODY = [(-41, 72, 10.5, 11), (-31, 71, 13.5, 15), (-15, 67, 14, 17), (1, 66, 14, 17.5), (15, 67, 13, 17), (27, 67, 11, 15), (34, 64, 8, 10)]
HORSE = dict(body=HORSE_BODY, neck=[(29, 75, 6.5, 11.5), (39, 89, 5.6, 8.4), (47, 101, 4.6, 6.4)], poll=(49, 106), muzzle=(65, 86), hr0=(4.7, 6.6), hr1=(3.3, 4.2),
             legs={'F': dict(root=(28, 7.5, 62), foot0=28, upper=37, lower=27, pole=1, r=(7.5, 3.0)), 'H': dict(root=(-31, 7.5, 67), foot0=-33, upper=41, lower=28, pole=-1, r=(9.5, 3.2))},
             tail=(-44, 75), tailn=(6, 6.8, (8, 3.2)), seat=(-2, 89), saddle=(-13, 9, 83.5))

MOUNTS = {
    'ngua_nau': quad(name='Ngựa Nâu', coat='#8b5a2b', mane='#3b2412', blanket='#2f5f9a', btrim='#e8c060', socks='#f0e6d6', **HORSE),
    'bach_ma': quad(name='Bạch Mã', coat='#eeeeee', mane='#d4d4e0', blanket='#c8a040', btrim='#ffffff', hoof='#5a5048', **HORSE),
    'hac_ma': quad(name='Ô Truy Hắc Mã', coat='#2e2c36', mane='#c02020', blanket='#8a1a1a', btrim='#e8c060', **HORSE),
    'hoa_ky_lan': quad(name='Hỏa Kỳ Lân', coat='#ff6a1a', mane='#ffd23f', blanket='#7a1a10', btrim='#ffd23f', head='dragon', scales='#c83a08', antler='#ffe9a0', hoof='#ffd23f',
                       flame=True, **dict(HORSE, poll=(49, 104), muzzle=(66, 88))),
    'kim_nguu': quad(name='Kim Ngưu', coat='#e8b030', mane='#ffe070', blanket='#8a2a10', btrim='#ffe070', head='ox', hoof='#5a3a10', bounce=1.6, pitch=0.03, stride=28, lift=9,
                     stance=0.55, phase={'FR': 0.0, 'HL': 0.0, 'FL': 0.5, 'HR': 0.5},
                     body=[(-38, 60, 13, 14), (-26, 62, 16, 18), (-8, 62, 17.5, 20.5), (8, 64, 17.5, 21.5), (21, 64, 16, 20), (30, 60, 12, 14)],
                     neck=[(30, 66, 9, 13), (38, 68, 8, 11), (44, 68, 7, 9)], poll=(45, 70), muzzle=(58, 54), hr0=(6.4, 7.0), hr1=(5.2, 4.6),
                     legs={'F': dict(root=(25, 9, 56), foot0=25, upper=32, lower=24, pole=1, r=(8.5, 3.8)), 'H': dict(root=(-30, 9, 60), foot0=-31, upper=34, lower=26, pole=-1, r=(10.5, 4.0))},
                     tail=(-41, 64), tailn=(5, 6.2, (2.2, 4.6)), seat=(-4, 91), saddle=(-15, 7, 86)),
    'bach_ho': quad(name='Bạch Hổ Vương', coat='#f4f2ee', mane='#2a2a30', blanket='#8a1a1a', btrim='#e8c060', head='cat', stripes='#26242c', bounce=3.5, pitch=0.09, stride=36, lift=12,
                    stance=0.38, phase={'FR': 0.52, 'FL': 0.58, 'HR': 0.02, 'HL': 0.08}, paws=True,
                    body=[(-35, 47, 9.5, 10), (-22, 47, 11, 12.5), (-4, 46, 12, 13), (12, 48, 12, 13.5), (24, 49, 11, 12.5), (30, 48, 8.5, 9.5)],
                    neck=[(29, 52, 8.5, 10.5), (36, 58, 8, 9.5)], poll=(38, 63), muzzle=(52, 56), hr0=(8.4, 8.4), hr1=(5.4, 5.0),
                    legs={'F': dict(root=(25, 7, 45), foot0=27, upper=25, lower=20, pole=1, r=(7.5, 4.0)), 'H': dict(root=(-28, 7, 47), foot0=-29, upper=27, lower=21, pole=-1, r=(9.0, 4.2))},
                    tail=(-38, 50), tailn=(8, 6.0, (4.4, 3.0)), seat=(-3, 68), saddle=(-13, 8, 61)),
    'kim_quy': dict(kind='turtle', name='Kim Quy', coat='#f0c23a', mane='#2ad08a', blanket='#8a1a1a', btrim='#ffe070', speed=120, seat=(-2, 68)),
    'thanh_long': dict(kind='dragon', name='Thanh Long', coat='#2ecc9a', mane='#c8fff0', belly='#f0e6a0', blanket='#1a4a8a', btrim='#ffe070', antler='#fff0c0', speed=280, fly=True),
    'phuong_hoang': dict(kind='bird', name='Phượng Hoàng', coat='#ff5a1a', mane='#ffd040', blanket='#7a1a10', btrim='#ffe070', speed=280, fly=True, seat=(-2, 84)),
}


# ================= dáng & chuyển động =================
def foot_target(S, key, t, anim):
    lg = S['legs'][key[0]]
    side = 1 if key[1] == 'R' else -1
    F0 = lg['foot0']
    if anim == 'idle':
        return V(side * lg['root'][1], F0 + (1.5 if key == 'FR' else 0), 0)
    p = (t + S['phase'][key]) % 1; st = S['stance']; L = S['stride']
    if p < st:
        u = p / st; return V(side * lg['root'][1], F0 + L / 2 - L * u, 0)
    u = (p - st) / (1 - st)
    return V(side * lg['root'][1], F0 - L / 2 + L * (u * u * (3 - 2 * u)), S['lift'] * math.sin(math.pi * u) ** 0.8)


def quad_joints(S, t, anim):
    J = {'Rt': np.eye(3)}
    if anim == 'run':
        dz = S['bounce'] * math.cos(TAU * (t + 0.1)); pa = S['pitch'] * math.sin(TAU * (t + 0.15))
    else:
        dz = 0.6 * math.sin(TAU * t); pa = 0.006 * math.sin(TAU * t)
    c, s = math.cos(pa), math.sin(pa)
    cen = V(0, 0, 64)
    def X(F, U, x=0.0):   # điểm thân sau khi nhún & chúi
        p = V(x, F, U) - cen
        return cen + V(p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]) + V(0, 0, dz)
    J['X'] = X
    J['body'] = [(X(F, U), rx, rz) for F, U, rx, rz in S['body']]
    nb = 0.05 * math.sin(TAU * (t + 0.35)) if anim == 'run' else 0.03 * math.sin(TAU * t * 1 + 1)
    base = V(0, S['neck'][0][0], S['neck'][0][1])
    def NK(F, U):     # cổ / đầu gật theo nhịp
        p = V(0, F, U) - base; cn, sn = math.cos(nb), math.sin(nb)
        q = base + V(0, cn * p[1] - sn * p[2], sn * p[1] + cn * p[2])
        return X(q[1], q[2])
    J['NK'] = NK
    J['neck'] = [(NK(F, U), rx, rz) for F, U, rx, rz in S['neck']]
    J['poll'] = NK(*S['poll']); J['muzzle'] = NK(*S['muzzle'])
    for key in ('FR', 'FL', 'HR', 'HL'):
        lg = S['legs'][key[0]]; side = 1 if key[1] == 'R' else -1
        root = X(lg['root'][0], lg['root'][2], side * lg['root'][1])
        tgt = foot_target(S, key, t, anim)
        el, ft = R.ik(root, tgt, lg['upper'], lg['lower'], V(0, lg['pole'], 0))
        J[key] = (root, el, ft)
    J['tailroot'] = X(*S['tail'])
    J['seat'] = X(*S['seat'])
    for i, u in enumerate((0.15, 0.4, 0.65, 0.88)):
        a, b = S['neck'][0], S['neck'][-1]
        F = a[0] + (b[0] - a[0]) * u; U = a[1] + (b[1] - a[1]) * u + (a[3] + (b[3] - a[3]) * u) * 0.9
        J['mane%d' % i] = NK(F, U)
    J['forelock'] = J['poll'] + V(0, 1.5, 1)
    return J


def quad_chains(S):
    C = []
    n, seg, w = S['tailn']
    C.append(dict(name='tail', anchor=('pt', 'tailroot', (0, 0, 0)), n=n, seg=seg, rest=(0, -0.5, -1), frame='world', stiff=0.05, damp=2.6, side=0, w=w, col=S['mane'], kind='tail'))
    if S['head'] in ('horse', 'dragon'):
        for i in range(4):
            C.append(dict(name='mane%d' % i, anchor=('pt', 'mane%d' % i, (0, 0, 0)), n=2, seg=4.6 + i * 0.4, rest=(0.55, -0.35, -1), frame='world', stiff=0.06, damp=2.6, side=0,
                          w=(4.6, 2.2), col=S['mane'], kind='mane'))
        C.append(dict(name='forelock', anchor=('pt', 'forelock', (0, 0, 0)), n=2, seg=3.4, rest=(0, 0.6, -1), frame='world', stiff=0.08, damp=2.6, side=0, w=(3.4, 1.8), col=S['mane'], kind='mane'))
    return C


# ================= vẽ thú 4 chân =================
def head_parts(S, J, pr, view, parts):
    P0, P1 = J['poll'], J['muzzle']
    d = nrm(P1 - P0); L = np.linalg.norm(P1 - P0)
    coat = S['coat']; kind = S['head']
    r0, r1 = S['hr0'], S['hr1']
    D = lambda v: pr(v)[2]
    hdp = (D(P0) + D(P1)) / 2 + 0.5
    pts = [(P0 + d * L * u, r0[0] + (r1[0] - r0[0]) * u, r0[1] + (r1[1] - r0[1]) * u) for u in (0, 0.3, 0.65, 1.0)]
    hp = Part(hdp, coat, sig=2.2, spec=0.12)
    tube(hp, pr, pts)
    side_dir = V(1, 0, 0)
    up = nrm(np.cross(d, side_dir)) * -1
    if up[2] < 0: up = -up
    if kind in ('horse', 'dragon', 'ox'):   # má / hàm dưới
        jaw = P0 + d * L * 0.22 - up * r0[1] * 0.55
        hp.ell(pr(jaw)[:2], r0[0] * 0.95, r0[1] * 0.7)
    if kind == 'cat':
        hp.ell(pr(P0 + d * L * 0.15)[:2], r0[0] * 1.15, r0[1] * 1.05)      # đầu tròn
        hp.ell(pr(P1 - up * 1.2)[:2], r1[0] * 1.05, r1[1] * 0.9)
    # mắt, lỗ mũi, miệng
    marks = []
    for sx_ in (1, -1):
        e = P0 + d * L * (0.24 if kind != 'cat' else 0.38) + side_dir * sx_ * r0[0] * (0.82 if kind != 'cat' else 0.6) + up * r0[1] * (0.25 if kind != 'cat' else 0.3)
        if (view == 'side' and sx_ < 0) or (view == 'up'): continue
        marks.append(('eye', pr(e)))
        nz = P1 + side_dir * sx_ * r1[0] * 0.55 + up * r1[1] * 0.2
        if view == 'down' or sx_ > 0: marks.append(('nos', pr(nz)))
    mc = pr(P1 - up * r1[1] * 0.6 - d * 2)
    eyec = {'cat': '#e8c030', 'dragon': '#ffe040'}.get(kind, '#1a1210')
    def hm(dr, marks=marks, mc=mc, eyec=eyec):
        for k, p in marks:
            if k == 'eye':
                dr.px(p[0], p[1], eyec); dr.px(p[0] + (1 if view == 'side' else 0), p[1], '#1a1210' if kind in ('cat', 'dragon') else eyec)
                dr.px(p[0] - 1, p[1] - 1, 0)
                if kind != 'cat': dr.px(p[0], p[1] - 1, '#ffffff') if False else None
            else:
                dr.px(p[0], p[1], 0)
        if view != 'up': dr.px(mc[0], mc[1], 0)
    hp.mark(hm)
    # dây cương trên đầu (ngựa, kỳ lân)
    if S.get('tack') and kind in ('horse', 'dragon') and view != 'up':
        rn = [pr(q)[:2] for q in ringpts(P0 + d * L * 0.72, d, r1[0] * 1.15 + 0.4, r1[1] * 1.15 + 0.4, 18) if pr(q)[2] > D(P0 + d * L * 0.72) - 0.5]
        ck = [pr(P0 + d * L * 0.05 + side_dir * r0[0] * 1.02)[:2], pr(P0 + d * L * 0.72 + side_dir * r1[0] * 1.1)[:2]]
        hp.mark(lambda dr, rn=sorted(rn, key=lambda p: p[0]), ck=ck: ((dr.line(rn, '#3a2414', 0.9) if len(rn) > 1 else None), (dr.line(ck, '#3a2414', 0.9) if view == 'side' else None)))
    if kind == 'cat':
        hp.mark(lambda dr, p=pr(P1 + up * r1[1] * 0.3): (dr.px(p[0], p[1], '#e8889a'), dr.px(p[0] - 1, p[1], '#e8889a')) if view != 'up' else None)
        if S.get('stripes'):
            st = S['stripes']
            ss = [pr(P0 + d * L * u + up * r0[1] * 0.9)[:2] for u in (0.05, 0.2, 0.35)]
            hp.mark(lambda dr, ss=ss, st=st: [dr.line([(x - 2, y - 0.5), (x + 2, y + 0.5)], st, 0.7) for x, y in ss])
    parts.append(hp)
    # tai
    for sx_ in (1, -1):
        if view == 'side' and sx_ < 0: continue
        b0 = P0 + side_dir * sx_ * r0[0] * 0.55 + up * r0[1] * 0.8 - d * 1.2
        if kind == 'cat':
            ep = Part(hdp + (0.3 if view != 'up' else -0.3), coat, sig=0.8, spec=0.1, ol=2).ell(pr(b0 + up * 1.4)[:2], 2.6, 2.4)
            ep.mark(lambda dr, c=pr(b0 + up * 1.4): dr.ell(c[:2], 1.2, 1.0, S.get('stripes', '#202020')))
        elif kind == 'ox':
            tip = b0 + side_dir * sx_ * 5 - up * 0.5
            ep = Part(hdp + 0.2, coat, sig=0.8, spec=0.1, ol=2).cap(pr(b0)[:2], pr(tip)[:2], 1.8, 1.2)
            parts.append(ep)
            horn = [b0 + up * 0.5, b0 + side_dir * sx_ * 6 + up * 3, b0 + side_dir * sx_ * 8 + up * 8 + d * 2]
            parts.append(Part(hdp + 0.35, '#f4ecd0', sig=0.8, spec=0.6, ol=2).ribbon([pr(q)[:2] for q in horn], 3.0, 1.0))
            continue
        else:
            tip = b0 + up * 6 - d * 1.2 + side_dir * sx_ * 0.8
            ep = Part(hdp + 0.2, coat, sig=0.8, spec=0.1, ol=2).poly([pr(b0 - d * 1.6)[:2], pr(tip)[:2], pr(b0 + d * 1.6)[:2]])
        parts.append(ep)
    if kind == 'dragon':   # sừng hươu, râu, vảy
        for sx_ in (1, -1):
            if view == 'side' and sx_ < 0: continue
            a0 = P0 + side_dir * sx_ * 2.2 + up * r0[1] * 0.9
            br = [a0, a0 + up * 5 - d * 3 + side_dir * sx_ * 1.5, a0 + up * 10 - d * 7 + side_dir * sx_ * 2.5]
            ap = Part(hdp + 0.4, S.get('antler', '#fff0c0'), sig=0.6, spec=0.5, ol=2).ribbon([pr(q)[:2] for q in br], 2.0, 1.0)
            k1 = br[1]; ap.ribbon([pr(k1)[:2], pr(k1 + up * 3 + d * 2.5)[:2]], 1.4, 0.8)
            parts.append(ap)
    if kind == 'ox' and view != 'up':
        rg = pr(P1 - up * r1[1] * 0.1 + d * 0.6)
        parts.append(Part(hdp + 0.6, '#ffd040', sig=0.5, spec=0.9, ol=0).ell(rg[:2], 2.2, 1.6).ell(rg[:2], 1.2, 0.8, fill=0))


def leg_parts(S, J, pr, key, parts):
    root, el, ft = J[key]
    lg = S['legs'][key[0]]
    r0, r1 = lg['r']
    D = lambda v: pr(v)[2]
    dp = (D(root) + D(el) + D(ft)) / 3
    coat = S['coat']
    up_ = Part(dp, coat, sig=2.2, spec=0.12)
    mus = root + (el - root) * 0.28
    if key[0] == 'F':
        up_.blob([(pr(root)[:2], r0 * 1.15), (pr(mus)[:2], r0 * 0.9)]).blob([(pr(mus)[:2], r0 * 0.9), (pr(root + (el - root) * 0.6)[:2], r0 * 0.6), (pr(el)[:2], r1 * 1.45)])
    else:
        up_.blob([(pr(root + V(0, -2, 2))[:2], r0 * 1.3), (pr(mus)[:2], r0 * 1.1)]).blob([(pr(mus)[:2], r0 * 1.05), (pr(root + (el - root) * 0.62)[:2], r0 * 0.62), (pr(el)[:2], r1 * 1.5)])
    parts.append(up_)
    lowc = S.get('socks') if S.get('socks') and key in ('FR', 'HL') else coat
    fet = el + (ft - el) * 0.86
    lo = Part(dp + 0.01, lowc, sig=1.4, spec=0.14, ol=2).cap(pr(el)[:2], pr(fet)[:2], r1 * 1.1, r1 * 0.85).ell(pr(fet)[:2], r1 * 1.05, r1)
    parts.append(lo)
    if S.get('paws'):
        parts.append(Part(dp + 0.02, coat, sig=1.0, spec=0.1, ol=2).ell(pr(ft + V(0, 1.5, 1))[:2], r1 * 1.35, r1 * 0.95).mark(lambda dr, p=pr(ft + V(0, 3, 0.6)): [dr.px(p[0] + o, p[1], 1) for o in (-1, 1)]))
        if S.get('stripes'):
            st = S['stripes']; a, b = pr(root), pr(el)
            up_.mark(lambda dr, a=a, b=b, st=st: [dr.line([(a[0] + (b[0] - a[0]) * u - 3, a[1] + (b[1] - a[1]) * u - 1), (a[0] + (b[0] - a[0]) * u + 3, a[1] + (b[1] - a[1]) * u + 1)], st, 0.8) for u in (0.3, 0.55)])
    else:
        d_ = nrm(ft - fet)
        h0, h1 = pr(fet + d_ * 1.0), pr(ft)
        hv = Part(dp + 0.02, S['hoof'], sig=0.8, spec=0.4, ol=2).poly([(h0[0] - r1 * 0.9, h0[1]), (h0[0] + r1 * 0.9, h0[1]), (h1[0] + r1 * 1.2 + 0.6, h1[1] + 0.5), (h1[0] - r1 * 1.1, h1[1] + 0.5)])
        parts.append(hv)
        if S.get('flame'):
            parts.append(Part(dp + 0.015, S['mane'], sig=0.6, spec=0.2, ol=0).poly([(h0[0] - 3, h0[1] - 0.5), (h0[0] + 3, h0[1] - 0.5), (h0[0] - 1, h0[1] - 6)]))


def body_parts(S, J, pr, view, parts):
    D = lambda v: pr(v)[2]
    bdp = D(J['body'][3][0])
    bp = Part(bdp, S['coat'], sig=4.0, spec=0.12)
    tube(bp, pr, J['body'])
    tube(bp, pr, J['neck'] + [(J['poll'], S['hr0'][0] * 0.9, S['hr0'][1] * 0.85)])
    # cơ vai và mông hai bên thân
    X = J['X']; b = S['body']
    for sx_ in (1, -1):
        for F, U, rx, rz, k in ((b[-2][0] - 2, b[-2][1] - 4, b[-2][2], b[-2][3], 0.62), (b[1][0] + 2, b[1][1] - 2, b[1][2], b[1][3], 0.72)):
            c = pr(X(F, U, sx_ * rx * 0.7))
            bp.ell(c[:2], rz * k, rz * k * 0.95)
    # nếp cơ: vai, mông, bụng
    X = J['X']
    sh = pr(X(S['body'][-2][0], S['body'][-2][1] - 2, S['body'][-2][2])); hp = pr(X(S['body'][1][0], S['body'][1][1] + 2, S['body'][1][2]))
    belly = [pr(X(F, U - rz * 0.85, 0))[:2] for F, U, rx, rz in S['body'][1:-1]]
    def mk(dr, sh=sh, hp=hp, belly=belly):
        if view == 'side':
            dr.line([(sh[0] - 2, sh[1] - 8), (sh[0] - 4, sh[1] + 6)], 1, 0.6)
            dr.line([(hp[0] + 3, hp[1] - 7), (hp[0] + 6, hp[1] + 5)], 1, 0.6)
        dr.line(belly, 1, 0.6)
    bp.mark(mk)
    if S.get('scales'):
        sc = S['scales']
        pts = [pr(X(F, U + dz, rx * 0.95))[:2] for F, U, rx, rz in S['body'][1:-1] for dz in (-6, 2)]
        bp.mark(lambda dr, pts=pts, sc=sc: [dr.line([(x - 2, y), (x, y + 1.2), (x + 2, y)], sc, 0.6) for x, y in pts] if view == 'side' else None)
    if S.get('stripes'):
        st = S['stripes']
        sl = []
        for F, U, rx, rz in S['body'][:-1]:
            for dF in (-3, 3):
                for sx_ in (1, -1):
                    q = [X(F + dF + a * 1.5, U + rz * math.sin(a), sx_ * rx * math.cos(a)) for a in np.linspace(-0.5, 1.45, 6)]
                    vis = [pr(p)[:2] for p in q if pr(p)[2] >= D(X(F, U, 0)) - 2] if view == 'side' else [pr(p)[:2] for p in q]
                    sl.append(vis)
        bp.mark(lambda dr, sl=sl, st=st: [dr.line(l, st, 1.0) for l in sl if len(l) > 1])
    parts.append(bp)


def tack_parts(S, J, pr, view, parts):
    """yên cương: chăn yên, yên, bàn đạp, đai bụng, dây cương"""
    X = J['X']; D = lambda v: pr(v)[2]
    F0, F1, U0 = S['saddle']
    rx = max(r for F, U, r, z in S['body']) + 0.6
    bl, bt = S['blanket'], S['btrim']
    for sx_ in (1, -1):
        q = [X(F0, U0, sx_ * rx * 0.55), X(F1, U0, sx_ * rx * 0.55), X(F1 + 2, U0 - 21, sx_ * rx), X(F0 - 2, U0 - 21, sx_ * rx)]
        P = [pr(p)[:2] for p in q]
        dp = sum(pr(p)[2] for p in q) / 4 - (5 if sx_ * (1 if view == 'side' else 0) > 0 else 0)
        bp = Part(dp + 0.5, bl, sig=1.6, spec=0.08, ol=2).poly(P)
        bp.mark(lambda dr, P=P, bt=bt: (dr.line([P[1], P[2], P[3], P[0]], bt, 0.9), [dr.px(P[3][0] + (P[2][0] - P[3][0]) * u, P[3][1] + (P[2][1] - P[3][1]) * u - 1.5, bt) for u in (0.2, 0.5, 0.8)]))
        parts.append(bp)
        # đai bụng
        g0, g1 = X(F1 - 3, U0 - 2, sx_ * rx * 0.9), X(F1 - 1, U0 - 34, sx_ * rx * 0.5)
        parts.append(Part(D(g0) + 0.55, '#3a2414', sig=0.8, spec=0.2, ol=0).line([pr(g0)[:2], pr(g1)[:2]], 1.4))
        # bàn đạp
        s0, s1 = X((F0 + F1) / 2 - 1, U0 - 3, sx_ * (rx + 0.5)), X((F0 + F1) / 2 - 1, U0 - 30, sx_ * (rx + 1.6))
        sp = Part(D(s1) + 0.6, '#2a1a10', sig=0.6, spec=0.2, ol=0).line([pr(s0)[:2], pr(s1)[:2]], 0.9)
        parts.append(sp)
        parts.append(Part(D(s1) + 0.62, '#c8a050', sig=0.5, spec=0.9, ol=0).ell(pr(s1)[:2], 2.0, 1.5).ell(pr(s1)[:2], 1.0, 0.7, fill=0))
    # yên da: đệm ngồi + cổ yên + đuôi yên
    pts = [(X(F, U0 + 1.5 + (2.5 if F in (F0, F1) else 0), 0), rx * 0.62 if F not in (F0, F1) else rx * 0.4, 2.6 if F not in (F0, F1) else 3.4) for F in (F0, F0 + 4, (F0 + F1) / 2, F1 - 4, F1)]
    sd = Part(D(X((F0 + F1) / 2, U0, 0)) + 0.6, '#5a3418', sig=1.4, spec=0.45, ol=2)
    tube(sd, pr, pts)
    sd.mark(lambda dr, p=pr(X((F0 + F1) / 2, U0 + 4.2, 0)): dr.line([(p[0] - 5, p[1]), (p[0] + 5, p[1])], 3, 0.6))
    parts.append(sd)
    # dây cương từ hàm tới cổ yên
    if S['head'] in ('horse', 'dragon', 'ox'):
        bit = J['muzzle'] + V(0, -2.5, -1.5)
        for sx_ in (1, -1):
            if view == 'side' and sx_ < 0: continue
            a, b = bit + V(sx_ * S['hr1'][0], 0, 0), X(F1 + 1, U0 + 4, sx_ * 3)
            mid = (a + b) / 2 + V(0, 0, -4)
            parts.append(Part(max(D(a), D(b)) + 0.4, '#2a1a10', sig=0.6, spec=0.2, ol=0).line([pr(a)[:2], pr(mid)[:2], pr(b)[:2]], 0.8))


def chain_parts(S, CH, pr, parts):
    for d0 in S['_chains']:
        pts = CH.get(d0['name'])
        if pts is None: continue
        p2 = [pr(q) for q in pts]
        dp = sum(p[2] for p in p2) / len(p2) + 0.3
        pt = Part(dp, d0['col'], sig=1.4, spec=0.45, ol=2)
        pp = [p[:2] for p in p2]
        w0, w1 = d0['w']
        if d0['kind'] == 'tail' and S.get('kind') == 'quad' and S['head'] in ('horse', 'dragon'):
            w0, w1 = w0, w1 + 3   # đuôi ngựa xòe ở ngọn
        pt.ribbon(pp, w0, w1)
        pt.mark(lambda dr, pp=pp: (dr.line([(x + 1, y) for x, y in pp[:-1]], 1, 0.6), dr.line([(x - 1, y + 0.5) for x, y in pp[1:]], 3, 0.5)))
        if S.get('stripes') and d0['kind'] == 'tail':
            st = S['stripes']; pt.mark(lambda dr, pp=pp, st=st: [dr.line([(pp[i][0] - 1.8, pp[i][1] - 0.8), (pp[i][0] + 1.8, pp[i][1] + 0.8)], st, 0.9) for i in range(1, len(pp), 1)])
        parts.append(pt)
        if d0.get('tip'):
            parts.append(Part(dp + 0.01, d0['tip'], sig=0.8, spec=0.3, ol=2).ell(pp[-1], w1 * 0.45, w1 * 0.45))


# ================= rồng =================
def dragon_joints(S, t, anim):
    J = {'Rt': np.eye(3)}
    sp = 1.0 if anim == 'run' else 0.35
    bob = 2.5 * math.sin(TAU * t) if anim == 'idle' else 1.5 * math.sin(TAU * t * 2)
    N = 20; spine = []
    for i in range(N):
        s = i / (N - 1)
        F = 44 - s * 118
        A = 4 + 9 * s
        U = 60 + bob + A * math.sin(TAU * (s * 1.25 - t * sp)) - 6 * s
        x = 4.5 * s * math.sin(TAU * (s * 1.05 - t * sp) + 1.2)
        r = 9.5 * (1 - s) ** 0.75 + 1.4
        spine.append((V(x, F, U), r))
    J['spine'] = spine
    J['seat'] = spine[3][0] + V(0, 0, spine[3][1] + 2.5)
    head = spine[0][0]
    J['poll'] = head + V(0, 3, 3); J['muzzle'] = head + V(0, 19, -2)
    J['whiskR'] = J['muzzle'] + V(2.6, -2, 0); J['whiskL'] = J['muzzle'] + V(-2.6, -2, 0)
    J['maneH'] = head + V(0, -2, 6)
    for k, (i, side) in enumerate(((2, 1), (2, -1), (9, 1), (9, -1))):
        c, r = spine[i]
        root = c + V(side * r * 0.8, 0, -r * 0.3)
        ph = TAU * (t * (2 if anim == 'run' else 1) + (0 if k % 3 == 0 else 0.5))
        a = 0.6 * math.sin(ph)
        el = root + V(side * 3, 6 * math.sin(a), -7 * math.cos(a))
        ft = el + V(side * 1, 6 * math.sin(a + 0.8), -5)
        J['leg%d' % k] = (root, el, ft)
    J['tailtip'] = spine[-1][0]
    return J


def dragon_parts(S, J, CH, pr, view, parts):
    D = lambda v: pr(v)[2]
    sp = J['spine']
    # thân chia đoạn để sắp chiều sâu đúng khi uốn
    for a in range(0, len(sp) - 1, 3):
        seg = sp[a:a + 4]
        pts = [(c, r, r * 0.95) for c, r in seg]
        dp = sum(D(c) for c, _ in seg) / len(seg)
        bp = Part(dp, S['coat'], sig=2.6, spec=0.35)
        tube(bp, pr, pts)
        bel = [pr(c + V(0, 0, -r * 0.78))[:2] for c, r in seg]
        dor = [pr(c + V(0, 0, r * 0.95))[:2] for c, r in seg]
        bp.mark(lambda dr, bel=bel, dor=dor: (dr.line(bel, S['belly'], 2.0), [dr.px(x, y, 1) for x, y in bel[::1]], dr.line(dor, 1, 0.6)))
        sc = [pr(c + V(0, 0, r * 0.2))[:2] for c, r in seg]
        bp.mark(lambda dr, sc=sc: [dr.line([(x - 2, y - 0.5), (x, y + 0.8), (x + 2, y - 0.5)], 1, 0.5) for x, y in sc])
        parts.append(bp)
        # vây lưng
        fin = Part(dp - 0.05, S['mane'], sig=0.8, spec=0.3, ol=2)
        for c, r in seg[:-1]:
            b = c + V(0, 0, r * 0.85)
            fin.poly([pr(b + V(0, 2.2, 0))[:2], pr(b + V(0, -1.5, 4 + r * 0.25))[:2], pr(b + V(0, -2.2, 0))[:2]])
        parts.append(fin)
    for k in range(4):
        root, el, ft = J['leg%d' % k]
        dp = (D(root) + D(el) + D(ft)) / 3 + 0.2
        lp = Part(dp, S['coat'], sig=1.2, spec=0.3, ol=2).cap(pr(root)[:2], pr(el)[:2], 3.0, 2.2).cap(pr(el)[:2], pr(ft)[:2], 2.0, 1.6)
        parts.append(lp)
        cl = Part(dp + 0.01, '#fff0c0', sig=0.5, spec=0.6, ol=0)
        for o in (-1.6, 0, 1.6):
            p = pr(ft); cl.line([(p[0] + o, p[1]), (p[0] + o * 1.4 + 1.5, p[1] + 2.2)], 0.8)
        parts.append(cl)
    # đầu rồng
    S2 = dict(S, head='dragon', hr0=(5.6, 6.6), hr1=(3.8, 4.0), tack=False)
    head_parts(S2, J, pr, view, parts)
    chain_parts(S, CH, pr, parts)
    # chăn yên trên lưng
    c, r = sp[3]
    q = [c + V(x, f, r * 0.8) for x, f in ((-r * 0.9, -7), (r * 0.9, -7), (r * 0.9, 7), (-r * 0.9, 7))]
    sd = Part(D(c) + 0.5, S['blanket'], sig=1.2, spec=0.15, ol=2).poly(hull([pr(p)[:2] for p in q] + [pr(c + V(sx_ * (r + 1.5), 0, -2))[:2] for sx_ in (1, -1)]))
    sd.mark(lambda dr, p=pr(c + V(0, 0, r + 1)): dr.line([(p[0] - 5, p[1]), (p[0] + 5, p[1])], S['btrim'], 0.9))
    parts.append(sd)


def dragon_chains(S):
    return [dict(name='whiskR', anchor=('pt', 'whiskR', (0, 0, 0)), n=5, seg=4.2, rest=(0.4, -0.6, -0.4), frame='world', stiff=0.03, damp=2.0, side=0, w=(1.4, 0.8), col=S['mane'], kind='wh'),
            dict(name='whiskL', anchor=('pt', 'whiskL', (0, 0, 0)), n=5, seg=4.2, rest=(-0.4, -0.6, -0.4), frame='world', stiff=0.03, damp=2.0, side=0, w=(1.4, 0.8), col=S['mane'], kind='wh'),
            dict(name='maneH', anchor=('pt', 'maneH', (0, 0, 0)), n=3, seg=4.5, rest=(0, -1, 0.2), frame='world', stiff=0.05, damp=2.4, side=0, w=(5.5, 2.4), col=S['mane'], kind='mane'),
            dict(name='tailtuft', anchor=('pt', 'tailtip', (0, 0, 0)), n=3, seg=3.6, rest=(0, -1, 0.3), frame='world', stiff=0.05, damp=2.4, side=0, w=(2.4, 4.8), col=S['mane'], kind='mane')]


# ================= phượng hoàng =================
def bird_joints(S, t, anim):
    J = {'Rt': np.eye(3)}
    bob = 2.2 * math.sin(TAU * t) if anim == 'idle' else 3.0 * math.sin(TAU * t + 0.6)
    J['body'] = [(V(0, F, U + bob), rx, rz) for F, U, rx, rz in ((-20, 64, 8, 8.5), (-8, 66, 12, 12.5), (6, 68, 11.5, 12), (15, 72, 7, 8))]
    J['neck'] = [(V(0, F, U + bob), r, r) for F, U, r in ((16, 74, 6), (22, 84, 4.6), (25, 93, 4.0))]
    J['head'] = V(0, 27, 97 + bob); J['seat'] = V(0, -2, 82 + bob)
    flap = math.sin(TAU * t) if anim == 'run' else -0.15 + 0.06 * math.sin(TAU * t)
    J['flap'] = flap; J['fold'] = anim != 'run'
    J['tailroot'] = V(0, -24, 64 + bob)
    J['crest'] = J['head'] + V(0, -2, 3)
    return J


def bird_parts(S, J, CH, pr, view, parts):
    D = lambda v: pr(v)[2]
    coat, mane = S['coat'], S['mane']
    bp = Part(D(J['body'][2][0]), coat, sig=3.4, spec=0.25)
    tube(bp, pr, J['body']); tube(bp, pr, J['neck'])
    bel = [pr(c + V(0, 0, -rz * 0.8))[:2] for c, rx, rz in J['body']]
    bp.mark(lambda dr, bel=bel: dr.line(bel, mane, 2.2))
    fe = [pr(c + V(rx * 0.95 if view != 'up' else -rx * 0.95, 0, z))[:2] for c, rx, rz in J['body'][1:3] for z in (-4, 0, 4)]
    bp.mark(lambda dr, fe=fe: [dr.line([(x - 2, y - 1), (x, y + 1), (x + 2, y - 1)], 1, 0.5) for x, y in fe])
    parts.append(bp)
    h = J['head']
    hp = Part(D(h) + 0.4, coat, sig=1.6, spec=0.3, ol=3).ell(pr(h)[:2], 5.0, 4.6)
    if view != 'up':
        e = pr(h + V(3.4 if view == 'side' else 2.4, 1.5, 1))
        hp.mark(lambda dr, e=e: (dr.px(e[0], e[1], '#ffe040'), dr.px(e[0] + 1, e[1], '#1a1210'), dr.px(e[0] - 1, e[1] - 1, 0)))
        if view == 'down': e2 = pr(h + V(-2.4, 1.5, 1)); hp.mark(lambda dr, e=e2: (dr.px(e[0], e[1], '#ffe040'), dr.px(e[0] - 1, e[1], '#1a1210')))
    parts.append(hp)
    bk = [h + V(0, 4, 0.5), h + V(0, 10, -2.5), h + V(0, 4, -2.5)]
    parts.append(Part(D(h) + 0.5, '#f2c040', sig=0.6, spec=0.7, ol=2).poly([pr(p)[:2] for p in bk]))
    # cánh: xương vai - khuỷu - cổ tay, lông chính xòe ra sau
    for sx_ in (1, -1):
        sh = V(sx_ * 8, 6, 72) + V(0, 0, J['body'][2][0][2] - 68)
        el_a = J['flap'] * 0.9 + (0.25 if J['fold'] else 0)
        if J['fold']:
            el = sh + V(sx_ * 4, -8, -1 + 2 * el_a); wr = el + V(sx_ * 2, -14, 1); dirs = [V(sx_ * 0.3, -1, -0.2 + 0.08 * i) for i in range(6)]; fl = 18
        else:
            ca, sa = math.cos(el_a), math.sin(el_a)
            el = sh + V(sx_ * 13 * ca, -2, 13 * sa); wr = el + V(sx_ * 15 * math.cos(el_a * 1.2), -5, 15 * math.sin(el_a * 1.2))
            dirs = [nrm(V(sx_ * (0.9 - i * 0.18) * math.cos(el_a * 1.2), -0.3 - i * 0.25, (0.9 - i * 0.18) * math.sin(el_a * 1.2) - 0.1)) for i in range(6)]; fl = 22
        dp = (D(sh) + D(el) + D(wr)) / 3 + (0.6 if sx_ * (1 if view == 'side' else 0) > 0 else 0)
        wp = Part(dp, coat, sig=1.8, spec=0.25, ol=2)
        bone = [sh, el, wr]
        wp.ribbon([pr(p)[:2] for p in bone], 7, 4)
        fea = Part(dp - 0.02, mane, sig=1.0, spec=0.3, ol=2)
        base_pts = [el + (wr - el) * (i / 5) for i in range(6)]
        for i, (b, dv) in enumerate(zip(base_pts[::-1], dirs)):
            tip = b + dv * (fl - i * 1.2)
            fea.ribbon([pr(b)[:2], pr(b + dv * (fl - i * 1.2) * 0.6)[:2], pr(tip)[:2]], 4.2, 1.6)
        sec = Part(dp - 0.01, light(coat, 0.15), sig=1.0, spec=0.25, ol=2)
        for i in range(5):
            b = sh + (el - sh) * (i / 4)
            dv = V(sx_ * 0.1, -0.7, -0.7) if not J['fold'] else V(sx_ * 0.2, -1, -0.3)
            sec.ribbon([pr(b)[:2], pr(b + dv * 10)[:2]], 4.0, 2.0)
        fea.mark(lambda dr, tips=[pr(b + dv * (fl - i * 1.2))[:2] for i, (b, dv) in enumerate(zip(base_pts[::-1], dirs))]: [dr.px(x, y, '#8a1a10') for x, y in tips])
        parts += [fea, sec, wp]
    # chân co dưới bụng
    for sx_ in (1, -1):
        a = V(sx_ * 4, -2, J['body'][1][0][2] - 10)
        parts.append(Part(D(a) - 0.2, '#f2c040', sig=0.6, spec=0.5, ol=2).cap(pr(a)[:2], pr(a + V(0, -6, -3))[:2], 1.4, 1.0))
    chain_parts(S, CH, pr, parts)
    c = J['seat']
    sd = Part(D(c) + 0.5, S['blanket'], sig=1.2, spec=0.15, ol=2).poly(hull([pr(c + V(x, f, -2))[:2] for x in (-9, 9) for f in (-8, 8)] + [pr(c + V(sx_ * 12, 0, -8))[:2] for sx_ in (1, -1)]))
    sd.mark(lambda dr, p=pr(c + V(0, 0, 0)): dr.line([(p[0] - 6, p[1]), (p[0] + 6, p[1])], S['btrim'], 0.9))
    parts.append(sd)


def bird_chains(S):
    C = []
    for i, (x, sp) in enumerate(((0, 0), (2.5, 0.25), (-2.5, -0.25), (5, 0.5), (-5, -0.5))):
        C.append(dict(name='tf%d' % i, anchor=('pt', 'tailroot', (x * 0.6, 0, 0)), n=6, seg=8.5 - abs(x) * 0.4, rest=(sp, -1, -0.15 - abs(sp) * 0.2), frame='world', stiff=0.04, damp=2.0, side=0,
                      w=(3.2, 5.4), col=S['mane'] if i % 2 == 0 else S['coat'], kind='feather', tip='#3a8ad8'))
    for i, x in enumerate((-1.2, 0, 1.2)):
        C.append(dict(name='cr%d' % i, anchor=('pt', 'crest', (x, 0, 0)), n=3, seg=3.6, rest=(x * 0.2, -0.7, 0.7), frame='world', stiff=0.08, damp=2.4, side=0, w=(1.8, 1.0), col=S['mane'], kind='crest', tip='#e8402a'))
    return C


# ================= rùa =================
def turtle_joints(S, t, anim):
    J = {'Rt': np.eye(3)}
    bob = 0.6 * math.sin(TAU * t * (2 if anim == 'run' else 1))
    J['bob'] = bob
    J['seat'] = V(0, -2, 66 + bob)
    J['neck'] = [V(0, 30, 26 + bob), V(0, 40, 30 + bob + 1.5 * math.sin(TAU * t))]
    J['head'] = J['neck'][-1] + V(0, 6, 1)
    for k, (fx, fy, ph) in enumerate(((1, 1, 0), (-1, 1, 0.5), (1, -1, 0.5), (-1, -1, 0))):
        root = V(fx * 22, fy * 20, 20 + bob)
        a = 0.5 * math.sin(TAU * (t + ph)) if anim == 'run' else 0.04 * math.sin(TAU * t)
        lift = max(0, math.sin(TAU * (t + ph))) * 5 if anim == 'run' else 0
        ft = V(fx * 27, fy * 22 + a * 10, lift)
        J['leg%d' % k] = (root, ft)
    J['tailroot'] = V(0, -32, 18 + bob)
    return J


def turtle_parts(S, J, CH, pr, view, parts):
    D = lambda v: pr(v)[2]
    b = J['bob']
    for k in range(4):
        root, ft = J['leg%d' % k]
        dp = (D(root) + D(ft)) / 2 - 0.3
        parts.append(Part(dp, S['mane'], sig=2.0, spec=0.2).cap(pr(root)[:2], pr(ft + V(0, 0, 3))[:2], 6.5, 5.2).mark(lambda dr, p=pr(ft + V(0, 0, 2)): [dr.px(p[0] + o, p[1] + 1, '#f4ecd0') for o in (-2, 0, 2)]))
    n0, n1 = J['neck']
    parts.append(Part(D(n1) + 0.2, S['mane'], sig=1.8, spec=0.2).cap(pr(n0)[:2], pr(n1)[:2], 5.2, 4.6))
    h = J['head']
    hp = Part(D(h) + 0.4, S['mane'], sig=1.6, spec=0.25, ol=3).ell(pr(h)[:2], 6.2, 5.0).ell(pr(h + V(0, 4, -1))[:2], 4.6, 3.6)
    if view != 'up':
        for sx_ in ((1, -1) if view == 'down' else (1,)):
            e = pr(h + V(sx_ * 3.6, 1.5, 1.6))
            hp.mark(lambda dr, e=e: (dr.px(e[0], e[1], '#1a1210'), dr.px(e[0] - 1, e[1] - 1, '#ffffff')))
        hp.mark(lambda dr, m=pr(h + V(0, 7.5, -2)): dr.line([(m[0] - 2, m[1]), (m[0] + 2, m[1])], 0, 0.6))
    parts.append(hp)
    # mai rùa: vòm từ các vòng ngang
    sh = Part(0.0, S['coat'], sig=5.0, spec=0.45)
    rings = [(18 + b, 31, 36), (28 + b, 30, 35), (40 + b, 25, 29), (49 + b, 16, 19), (53 + b, 6, 8)]
    R.loft(sh, pr, V(0, 0, 0), np.eye(3), [(z, rx, rf, 0) for z, rx, rf in rings], n=24)
    def scutes(dr):
        cen = pr(V(0, 0, 52 + b))[:2]
        ring1 = [pr(V(math.cos(a) * 15, math.sin(a) * 18, 47 + b)) for a in np.linspace(0, TAU, 6, endpoint=False)]
        vis = [p for p in ring1 if p[2] > -8 or view == 'side']
        for p in vis: dr.line([cen, p[:2]], 0, 0.7)
        rr = [p[:2] for p in ring1]
        dr.line(rr + [rr[0]], 0, 0.7)
        ring2 = [pr(V(math.cos(a) * 27, math.sin(a) * 32, 32 + b)) for a in np.linspace(0, TAU, 12, endpoint=False)]
        for p, q in zip(ring1 + ring1, ring2[::2] + ring2[1::2]):
            if q[2] > -10 or view == 'side': dr.line([p[:2], q[:2]], 0, 0.6)
        r2 = sorted([p[:2] for p in ring2 if p[2] > -2], key=lambda p: p[0])
        if len(r2) > 1: dr.line(r2, 0, 0.6)
    sh.mark(scutes)
    parts.append(sh)
    rim = Part(0.1, dark(S['coat'], 0.25), sig=1.0, spec=0.3, ol=2)
    rp = [pr(V(math.cos(a) * 31.5, math.sin(a) * 36.5, 19 + b)) for a in np.linspace(0, TAU, 32, endpoint=False)]
    rim.poly(hull([p[:2] for p in rp]))
    rim.erase(hull([pr(V(math.cos(a) * 29.5, math.sin(a) * 34, 21 + b))[:2] for a in np.linspace(0, TAU, 32, endpoint=False)]))
    parts.append(rim)
    c = J['seat']
    sd = Part(1.0, S['blanket'], sig=1.4, spec=0.15, ol=2).poly(hull([pr(V(x, f, 52 + b))[:2] for x in (-11, 11) for f in (-12, 9)] + [pr(V(sx_ * 17, -2, 44 + b))[:2] for sx_ in (1, -1)]))
    sd.mark(lambda dr, p=pr(V(0, 0, 54 + b)): (dr.line([(p[0] - 7, p[1]), (p[0] + 7, p[1])], S['btrim'], 1.0), [dr.px(p[0] + o, p[1] + 3, S['btrim']) for o in (-6, 0, 6)]))
    parts.append(sd)
    parts.append(Part(1.1, '#5a3418', sig=1.0, spec=0.4, ol=2).ell(pr(V(0, -2, 57 + b))[:2], 7, 3.6))
    chain_parts(S, CH, pr, parts)


# ================= dựng sheet =================
def build(S, J, CH, view):
    pr = mkpr(view); parts = []
    k = S['kind']
    if k == 'quad':
        for key in ('FR', 'FL', 'HR', 'HL'): leg_parts(S, J, pr, key, parts)
        body_parts(S, J, pr, view, parts)
        head_parts(S, J, pr, view, parts)
        if S.get('tack'): tack_parts(S, J, pr, view, parts)
        chain_parts(S, CH, pr, parts)
    elif k == 'dragon': dragon_parts(S, J, CH, pr, view, parts)
    elif k == 'bird': bird_parts(S, J, CH, pr, view, parts)
    else: turtle_parts(S, J, CH, pr, view, parts)
    seat = pr(J['seat'])
    return parts, seat


def render_mount(mid):
    S = dict(MOUNTS[mid]); S['id'] = mid
    k = S['kind']
    jf = {'quad': quad_joints, 'dragon': dragon_joints, 'bird': bird_joints, 'turtle': turtle_joints}[k]
    chains = {'quad': quad_chains, 'dragon': dragon_chains, 'bird': bird_chains, 'turtle': lambda S: []}[k](S)
    S['_chains'] = chains
    R.CELL = MC
    rows = {v: [] for v in ('side', 'down', 'downF', 'up', 'upF')}
    seats = {v: [] for v in VIEWS}
    for anim, n, dur in (('idle', IDLE_N, IDLE_DUR), ('run', RUN_N, RUN_DUR)):
        ts = [i / n for i in range(n)]
        Js = [jf(S, t, anim) for t in ts]
        CH = R.simulate(chains, Js, [t * dur for t in ts], S['speed'] if anim == 'run' else 0.0, True, dur) if chains else {}
        for i, J in enumerate(Js):
            ch = {nm: CH[nm][i] for nm in CH}
            for view in VIEWS:
                parts, seat = build(S, J, ch, view)
                img = R.downsample(R.composite(parts))
                rows[view].append(img)
                seats[view].append([round(seat[0], 1), round(seat[1], 1)])
                if view != 'side':   # phần đè lên người cưỡi: đầu cổ (nhìn xuống) / mông đuôi (nhìn lên)
                    front = [p for p in parts if p.depth > seat[2] + 8]
                    rows[view + 'F'].append(R.downsample(R.composite(front)) if front else np.zeros((MC, MC, 4), np.float32))
    order = ['side', 'down', 'downF', 'up', 'upF']
    W = IDLE_N + RUN_N
    sheet = np.zeros((len(order) * MC, W * MC, 4), np.uint8)
    for r, key in enumerate(order):
        for c, im in enumerate(rows[key]):
            sheet[r * MC:(r + 1) * MC, c * MC:(c + 1) * MC] = np.clip(im, 0, 255).astype(np.uint8)
    img = Image.fromarray(sheet, 'RGBA')   # giữ RGBA: nén bảng màu làm mất nền trong suốt ở vài thú
    return img, seats


if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else 'public/assets'
    only = sys.argv[2:] or list(MOUNTS)
    os.makedirs(os.path.join(root, 'mounts'), exist_ok=True)
    mp = os.path.join(root, 'mounts.json')
    meta = json.load(open(mp)) if os.path.exists(mp) and sys.argv[2:] else {}
    meta.update({'cell': [MC, MC], 'scale': 2 / 3, 'foot': [MX, MY], 'footFB': [MX, MY], 'frames': {'idle': [0, IDLE_N], 'run': [IDLE_N, RUN_N]},
                 'rows': {'side': [0], 'down': [1, 2], 'up': [3, 4]}})
    meta.setdefault('seat', {}); meta.setdefault('seats', {})
    from multiprocessing import Pool
    with Pool(min(4, len(only))) as pool:
        for mid, (img, seats) in zip(only, pool.map(render_mount, only)):
            img.save(os.path.join(root, 'mounts', mid + '.png'), optimize=True)
            meta['seats'][mid] = seats; meta['seat'][mid] = seats['side']
            print('ok', mid)
    with open(mp, 'w') as f: json.dump(meta, f)
