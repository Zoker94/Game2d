# Vẽ lại THÚ (sói, gấu, hổ/báo, khỉ, thỏ, rắn, bò cạp) bằng cùng bộ tô khối của nhân vật (tools/rig2.py):
# mỗi bộ phận là một khối được đổ bóng theo pháp tuyến (sáng trên-trái), viền trong, đổ bóng lên bộ phận phía sau.
# Nhìn ngang quay phải (game tự lật). Sheet 1 hàng, giống định dạng 'side' của tools/monsters.py:
#   cột: đứng 0-3, đi 4-9, đánh 10-13, trúng đòn 14, ngã 15.
# Thú thường: ô 144 thu về 96 (cùng tỉ lệ người với nhân vật). Boss: ô 216, giữ nguyên (to gấp rưỡi), game phóng thêm theo `size`.
# Dùng: python3 tools/beasts2.py <thư mục ra> [mã ...]
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
import rig2 as R
from rig2 import Part, light, dark, mix

TAU = math.pi * 2
FRAMES = [('idle', i) for i in range(4)] + [('walk', i) for i in range(6)] + [('atk', i) for i in range(4)] + [('hurt', 0), ('dead', 0)]

def ik(a, t, l1, l2, bend):
    """khớp giữa của chi 2 đoạn từ a tới t; bend=+1 khớp chĩa ra trước, -1 chĩa ra sau"""
    dx, dy = t[0] - a[0], t[1] - a[1]
    d = max(1e-3, min(l1 + l2 - 1e-3, math.hypot(dx, dy)))
    ang = math.atan2(dy, dx)
    c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
    off = math.acos(max(-1, min(1, c)))
    a1 = ang - off * bend
    return (a[0] + math.cos(a1) * l1, a[1] + math.sin(a1) * l1)

def lerp(a, b, t): return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
def bez(p, n=12):
    out = []
    for i in range(n + 1):
        t = i / n; q = list(p)
        while len(q) > 1: q = [lerp(q[j], q[j + 1], t) for j in range(len(q) - 1)]
        out.append(q[0])
    return out

def ear_tri(part, base, w, h, lean):
    part.poly([(base[0] - w, base[1]), (base[0] + w * 0.8, base[1] + 0.5), (base[0] + lean, base[1] - h)])

def tufts(part, pts, size, out=(0, 1), jitter=0.4):
    """lông xù: tam giác nhọn dọc một mép, chĩa theo hướng `out` (đơn vị x,y màn hình)"""
    for j, (x, y) in enumerate(pts):
        s_ = size * (0.7 + ((j * 0.618) % 1) * 0.6)
        ox, oy = out[0] + ((j * 0.37) % 1 - 0.5) * jitter, out[1] + ((j * 0.73) % 1 - 0.5) * jitter
        nx, ny = -oy, ox
        part.poly([(x - nx * s_ * 0.5, y - ny * s_ * 0.5), (x + nx * s_ * 0.5, y + ny * s_ * 0.5), (x + ox * s_ * 1.4, y + oy * s_ * 1.4)])

# ======================= tứ chi chung: sói / hổ / gấu =======================
def quad_pose(kind, i, gait):
    """trả về pha của 4 chân, độ nhún thân, nghiêng thân, đầu cúi/ngẩng, mở miệng"""
    o = dict(bob=0, pitch=0, head=0, jaw=0, lunge=0, rear=0, tail=0, flinch=0)
    if kind == 'idle':
        o['bob'] = math.sin(i / 4 * TAU) * 0.7; o['head'] = math.sin(i / 4 * TAU + 1) * 0.6; o['tail'] = math.sin(i / 4 * TAU) * 0.15
        o['legs'] = None
    elif kind == 'walk':
        p = i / 6
        o['legs'] = [(p + d) % 1 for d in (0.0, 0.5, 0.25, 0.75)]   # sau gần, sau xa, trước gần, trước xa
        o['bob'] = abs(math.sin(p * TAU * 2)) * 1.4 * gait; o['head'] = math.sin(p * TAU * 2) * 0.8; o['tail'] = math.sin(p * TAU) * 0.35
    elif kind == 'atk':
        o['legs'] = None
        o['lunge'] = [0.0, -5, 9, 4][i]; o['head'] = [-1, 2, -3, -1][i]; o['jaw'] = [0.2, 0.5, 1.0, 0.5][i]; o['pitch'] = [0, 0.05, -0.08, -0.03][i]
        o['rear'] = [0, 0.3, 1.0, 0.4][i]
    elif kind == 'hurt':
        o['legs'] = None; o['flinch'] = 1; o['head'] = 2; o['jaw'] = 0.4; o['pitch'] = 0.06
    return o

def leg_target(root_x, phase, stride, lift, ground):
    """chân bước: nửa chống (lùi dần), nửa vung (nhấc lên đưa tới)"""
    if phase is None: return (root_x, ground), 0
    if phase < 0.62:   # chống chân
        t = phase / 0.62
        return (root_x + stride * (0.5 - t), ground), 0
    t = (phase - 0.62) / 0.38
    return (root_x + stride * (-0.5 + t), ground - math.sin(t * math.pi) * lift), t

class Beast:
    def __init__(self, k=1.0, ox=72, gy=128):
        self.k, self.ox, self.gy = k, ox, gy
    def P(self, x, y): return (self.ox + x * self.k, self.gy - y * self.k)

def quadruped(sp, kind, i):
    """sp: thông số loài. Chân 3 đoạn theo giải phẫu: trước = vai-khuỷu (gập sau)-cổ chân-bàn; sau = hông-gối (gập trước)-khoeo-bàn"""
    k = sp['k']; B = Beast(k)
    col, bel, dk = sp['col'], sp.get('belly', light(sp['col'], 0.35)), sp.get('dark', dark(sp['col'], 0.35))
    o = quad_pose(kind, i, sp.get('gait', 1))
    dead = kind == 'dead'
    L, Hs, br = sp['len'], sp['h'], sp['bodyr']
    a1, a2, a3 = sp['leg']                 # 3 đoạn chân
    parts = []
    rear = o['rear'] * sp.get('rears', 0)
    lunge = o['lunge'] * (0.6 if sp.get('rears') else 1)
    bob = o['bob'] - (2 if o['flinch'] else 0)
    hipx, shx = -L + lunge * 0.4 - (3 if o['flinch'] else 0), L + lunge - (3 if o['flinch'] else 0)
    hipy = Hs * sp.get('hip', 1.0) + bob
    shy = Hs + bob + rear * Hs * 0.8
    if rear: shx -= rear * L * 0.4
    if dead: hipy, shy = br * 0.95, br * 1.0
    hip, sh = B.P(hipx, hipy), B.P(shx, shy)
    ground = B.gy
    pitch = math.atan2(sh[1] - hip[1], sh[0] - hip[0])
    # ---- chân ----
    phs = o.get('legs') or [None] * 4
    stride, lift = sp['stride'] * k, sp['lift'] * k
    for kd, near, ph in [('h', 0, phs[1]), ('f', 0, phs[3]), ('h', 1, phs[0]), ('f', 1, phs[2])]:
        root = (hip[0] + (-1 if near else 2) * k, hip[1] + br * 0.15 * k / k) if kd == 'h' else (sh[0] + (1 if near else 3) * k, sh[1] + br * 0.2)
        if dead:
            paw = (root[0] + (-26 if kd == 'h' else 24) * k * (1.0 if near else 0.75), ground - 3 * k - (0 if near else 4 * k)); lt = 0
        elif rear and kd == 'f':
            paw = (root[0] + (14 + o['lunge'] * 0.6) * k, root[1] - (2 + rear * 10) * k); lt = 1
        else:
            paw, lt = leg_target(root[0] + (2 * k if kd == 'f' else 1 * k), ph, stride, lift, ground)
            if o['flinch']: paw = (paw[0] - 2 * k, paw[1])
        # khớp dưới (cổ chân trước / khoeo sau) nằm trên bàn chân
        if kd == 'f': low = (paw[0] - 1.2 * k - lt * 2 * k, paw[1] - a3 * k)
        else: low = (paw[0] - a3 * 0.45 * k - lt * 1.5 * k, paw[1] - a3 * k)
        mid = ik(root, low, a1 * k, a2 * k, -1 if kd == 'f' else 1)
        lc = col if near else dark(col, 0.26)
        pc = sp.get('paw', col) if near else dark(sp.get('paw', col), 0.26)
        dp = (4.6 if near else 1.2) + (0.2 if kd == 'f' else 0)
        w0, w1, w2 = sp['legw']
        lg = Part(dp, lc, sig=1.6, spec=0.08, ol=3)
        lg.cap(root, mid, w0 * k, w0 * 0.8 * k).cap(mid, low, w1 * k, w1 * 0.8 * k).cap(low, paw, w2 * k, w2 * 0.9 * k)
        if kd == 'h': lg.ell((root[0] + 1 * k, root[1] + 2 * k), sp['thigh'] * k, sp['thigh'] * 1.15 * k)     # đùi
        else: lg.ell((root[0] - 1 * k, root[1] + 1 * k), sp['arm'] * k, sp['arm'] * 1.2 * k)                 # bắp vai
        def lmk(d, root=root, mid=mid, low=low, paw=paw, lc=lc, kd=kd):
            c = dark(lc, 0.32)
            if sp.get('furmark'):
                for t in (0.15, 0.4, 0.65, 0.9):
                    q = lerp(root, mid, t); d.line([q, (q[0] - 1.6 * k, q[1] + 2.2 * k)], c, 0.6)
                    q = lerp(mid, low, t); d.line([(q[0] + 0.8 * k, q[1]), (q[0] - 0.8 * k, q[1] + 1.8 * k)], light(lc, 0.22) if t > 0.5 else c, 0.55)
            if sp.get('stripes'):
                for t in (0.3, 0.65): q = lerp(root, mid, t); d.line([(q[0] - 2.5 * k, q[1]), (q[0] + 2.5 * k, q[1] + 1.2 * k)], sp['stripes'], 1.1)
                q = lerp(mid, low, 0.5); d.line([(q[0] - 2 * k, q[1]), (q[0] + 2 * k, q[1] + 0.8 * k)], sp['stripes'], 0.9)
            d.line([lerp(low, paw, 0.2), lerp(low, paw, 0.8)], light(lc, 0.25), 0.6)
        lg.mark(lmk)
        parts.append(lg)
        pw = Part(dp + 0.05, pc, sig=1.0, spec=0.1, ol=2)
        pw.ell((paw[0] + 1.6 * k, paw[1] - 1.2 * k), sp['pawr'] * k * 1.3, sp['pawr'] * k * 0.78)
        if sp.get('claws'):
            pw.mark(lambda d, f=paw: [d.line([(f[0] + 3.0 * k + j * 1.1 * k, f[1] - 1.2 * k), (f[0] + 4.4 * k + j * 1.1 * k, f[1] + 0.1 * k)], '#f4ecdc', 0.55) for j in range(3)])
        parts.append(pw)
    # ---- đuôi ----
    tl = sp.get('tail')
    if tl:
        base = (hip[0] - br * 0.55, hip[1] - br * 0.3)
        sw = o['tail'] * 10 * k
        if tl == 'bushy':
            pts = bez([base, (base[0] - 10 * k, base[1] + 3 * k + sw * 0.3), (base[0] - 18 * k, base[1] + 13 * k + sw), (base[0] - 21 * k, base[1] + 24 * k + sw * 0.6)], 10)
            if dead: pts = bez([base, (base[0] - 14 * k, base[1] + 4 * k), (base[0] - 26 * k, ground - 4 * k)], 10)
            tp = Part(2.6, col, sig=2.2, spec=0.05, ol=3).ribbon(pts, 5 * k, 8 * k)
            for j in range(2, len(pts) - 1, 2):
                a_, b_ = pts[j - 1], pts[j + 1]; dx, dy = b_[0] - a_[0], b_[1] - a_[1]; ln = math.hypot(dx, dy) or 1
                w_ = (5 + 3 * j / len(pts)) * k * 0.5
                for sgn in (-1, 1): tufts(tp, [(pts[j][0] - dy / ln * w_ * sgn, pts[j][1] + dx / ln * w_ * sgn)], 2.6 * k, (-dy / ln * sgn * 0.6 - dx / ln * 0.8, dx / ln * sgn * 0.6 - dy / ln * 0.8))
            tp.mark(lambda d, pts=pts: (d.line(pts[-3:], dark(col, 0.45), 2.6 * k), d.line(pts[2:7], light(col, 0.2), 1.0)))
        elif tl == 'long':
            pts = bez([base, (base[0] - 14 * k, base[1] - 2 * k), (base[0] - 26 * k, base[1] + 12 * k + sw), (base[0] - 32 * k, base[1] - 2 * k + sw * 1.2)], 14)
            if dead: pts = bez([base, (base[0] - 18 * k, base[1] + 4 * k), (base[0] - 34 * k, ground - 3 * k)], 12)
            tp = Part(2.6, col, sig=1.4, spec=0.08, ol=3).ribbon(pts, 4.2 * k, 3.0 * k)
            if sp.get('stripes'): tp.mark(lambda d, pts=pts: [d.line([(pts[j][0] - 1.5 * k, pts[j][1] - 2 * k), (pts[j][0] + 1.5 * k, pts[j][1] + 2 * k)], sp['stripes'], 1.2) for j in range(2, len(pts) - 1, 3)])
            if sp.get('tailtip'): tp.ell(pts[-1], 2.6 * k, 2.6 * k)
        else:
            tp = Part(2.6, col, sig=1.2, spec=0.05, ol=2).ell((base[0] - 1 * k, base[1] + 1 * k), 3.6 * k, 3.2 * k)
        parts.append(tp)
    # ---- thân: ngực sâu, eo thót, mông gọn ----
    brk = br * k
    def sp_(t, dy=0.0): q = lerp(hip, sh, t); return (q[0], q[1] + dy * brk)
    chest = sp_(0.92, 0.22); waist = sp_(0.5, -0.08); loin = sp_(0.22, -0.12); rump = sp_(0.0, 0.0)
    body = Part(3.0, col, sig=sp.get('sig', 2.8), spec=sp.get('spec', 0.1), ol=3)
    body.blob([(rump, brk * sp.get('rumpk', 0.82)), (loin, brk * 0.8), (waist, brk * sp.get('waistk', 0.76)), (chest, brk * sp.get('chestk', 1.08))])
    body.ell((sh[0], sh[1] - brk * 0.25), brk * 0.8, brk * 0.7)   # u vai
    fz = sp.get('fur', 0)
    if fz:   # lông xù dưới bụng, trước ngực, trên lưng
        tufts(body, [lerp((chest[0], chest[1] + brk * 0.95), (loin[0], loin[1] + brk * 0.72), t) for t in np.linspace(0, 1, 9)], fz * k, (0.15, 1))
        tufts(body, [(chest[0] + brk * (0.55 + 0.1 * t), chest[1] + brk * (0.1 + 0.8 * t)) for t in np.linspace(0, 1, 5)], fz * k, (0.7, 0.7))
        tufts(body, [lerp((rump[0], rump[1] - brk * 0.78), (sh[0], sh[1] - brk * 0.98), t) for t in np.linspace(0.1, 0.9, 8)], fz * 0.7 * k, (-0.45, -1))
    if sp.get('hump'): body.ell((sh[0] - 3 * k, sh[1] - brk * 0.65), brk * 0.75, brk * 0.6)
    def bmarks(d):
        # bụng / ngực sáng
        d.ell((chest[0] + brk * 0.3, chest[1] + brk * 0.45), brk * 0.6, brk * 0.55, bel)
        d.poly([(chest[0], chest[1] + brk * 0.85), (waist[0], waist[1] + brk * 0.68), (loin[0], loin[1] + brk * 0.62), (loin[0] + brk * 0.2, loin[1] + brk * 0.85), (waist[0], waist[1] + brk * 0.9)], bel)
        if sp.get('furmark') and not sp.get('stripes'):   # lưng sẫm hơn bụng (lông giáp lưng)
            d.poly([(rump[0] - brk * 0.4, rump[1] - brk * 0.55), (sh[0] + brk * 0.3, sh[1] - brk * 0.9), (sh[0] + brk * 0.3, sh[1] - brk * 0.55), (waist[0], waist[1] - brk * 0.3), (rump[0] - brk * 0.4, rump[1] - brk * 0.2)], dark(col, 0.16))
        if sp.get('back'): d.poly([(rump[0], rump[1] - brk * 0.8), (sh[0], sh[1] - brk * 0.95), (sh[0], sh[1] - brk * 0.55), (rump[0], rump[1] - brk * 0.4)], sp['back'])
        if sp.get('furmark'):
            for j in range(70):
                q = lerp(rump, chest, ((j * 0.618) % 1)); y = q[1] - brk * 0.85 + ((j * 0.377) % 1) * brk * 1.45
                ln = (1.6 + ((j * 0.29) % 1) * 1.6) * k
                d.line([(q[0], y), (q[0] - ln * 0.8, y + ln)], dark(col, 0.32) if j % 3 else light(col, 0.25), 0.55)
        if sp.get('stripes'):
            for j in range(8):
                q = lerp(rump, chest, (j + 0.4) / 8); yt = q[1] - brk * 0.9
                d.line(bez([(q[0], yt), (q[0] + 2.4 * k, yt + brk * 0.55), (q[0] - 0.6 * k, yt + brk * 1.15)], 6), sp['stripes'], 1.6 if j % 2 else 1.1)
        if sp.get('spots'):
            for j in range(16):
                q = lerp(rump, chest, (j * 0.37) % 1); d.ell((q[0], q[1] - brk * 0.6 + ((j * 0.61) % 1) * brk * 0.9), 1.1 * k, 0.9 * k, sp['spots'])
        if sp.get('scar'): d.line([(chest[0] - 6 * k, chest[1] - brk * 0.7), (chest[0] - 1 * k, chest[1] + brk * 0.1)], '#e8d0d0', 0.9)
        if sp.get('frost'):
            for j in range(12): q = lerp(rump, chest, (j * 0.43) % 1); d.px(q[0], q[1] - brk * 0.7 + ((j * 0.29) % 1) * brk * 0.4, '#f0faff')
    body.mark(bmarks)
    parts.append(body)
    if sp.get('saddle'):   # giáp da ôm lưng: tấm phủ theo đường lưng, viền kim loại, dây đai qua ngực và bụng
        tr = sp.get('trim', '#c8a040')
        top = [lerp((loin[0], loin[1] - brk * 0.86), (sh[0] - brk * 0.2, sh[1] - brk * 1.0), t) for t in np.linspace(0, 1, 6)]
        bot = [lerp((loin[0] + brk * 0.1, loin[1] + brk * 0.25), (sh[0] - brk * 0.3, sh[1] + brk * 0.15), t) for t in np.linspace(0, 1, 6)]
        sd = Part(3.15, sp['saddle'], sig=1.4, spec=0.35, ol=2).poly(top + bot[::-1])
        def sdm(d):
            d.line(bot, tr, 1.1); d.line(top, light(sp['saddle'], 0.3), 0.7)
            for q in bot[1:-1:2]: d.ell((q[0], q[1] - brk * 0.12), 0.9 * k, 0.9 * k, tr)
            d.line([(sh[0] - brk * 0.2, sh[1] + brk * 0.1), (chest[0] + brk * 0.5, chest[1] + brk * 0.75)], dark(sp['saddle'], 0.2), 1.2 * k)
            d.line([(waist[0], waist[1] + brk * 0.2), (waist[0] + brk * 0.1, waist[1] + brk * 0.8)], dark(sp['saddle'], 0.2), 1.2 * k)
        sd.mark(sdm); parts.append(sd)
    if sp.get('ruff'):
        rf = Part(3.25, sp['ruff'], sig=1.8, spec=0.05, ol=3)
        rf.blob([((sh[0] + 1 * k, sh[1] - brk * 0.35), brk * 0.7), ((sh[0] + 5 * k, sh[1] + brk * 0.3), brk * 0.66)])
        rf.mark(lambda d: [d.line([(sh[0] - 3 * k + j * 2 * k, sh[1] - brk * 0.8 + j * 1.4 * k), (sh[0] - 5 * k + j * 2 * k, sh[1] - brk * 0.3 + j * 1.4 * k)], dark(sp['ruff'], 0.3), 0.6) for j in range(6)])
        parts.append(rf)
    # ---- cổ + đầu ----
    hr = sp['headr'] * k; hl = sp['headlen'] * k
    nx, ny = sp['neck']
    hc = (sh[0] + nx * k + o['lunge'] * 0.4 * k, sh[1] - ny * k + o['head'] * k)
    if dead: hc = (sh[0] + 14 * k, ground - hr * 0.95)
    if rear: hc = (hc[0] - rear * 5 * k, hc[1] - rear * 1 * k)
    nk = Part(3.5, col, sig=2.0, spec=0.06, ol=3).cap((sh[0] + 1 * k, sh[1] + brk * 0.05), hc, brk * sp.get('neckw', 0.72), hr * 0.85)
    nk.mark(lambda d: d.line([lerp((sh[0] + 2 * k, sh[1] + brk * 0.6), (hc[0], hc[1] + hr * 0.7), t) for t in (0.1, 0.9)], bel, brk * 0.35))
    if fz:
        tufts(nk, [lerp((sh[0] - 2 * k, sh[1] - brk * 0.65), (hc[0] - hr * 0.7, hc[1] - hr * 0.5), t) for t in np.linspace(0.05, 0.95, 6)], fz * 0.9 * k, (-0.7, -0.7))
        tufts(nk, [lerp((sh[0] + 4 * k, sh[1] + brk * 0.7), (hc[0], hc[1] + hr * 0.85), t) for t in np.linspace(0.1, 0.9, 5)], fz * 0.9 * k, (0.2, 1))
    parts.append(nk)
    hd = Part(5.2, col, sig=1.8, spec=0.1, ol=3)
    hd.ell(hc, hr, hr * 0.9)
    jaw = o['jaw']
    mz = (hc[0] + hl * 0.72, hc[1] + hr * 0.3)
    hd.cap((hc[0] + hr * 0.25, hc[1] + hr * 0.05), mz, hr * sp.get('mzk', 0.6), hr * sp.get('mzk2', 0.36))
    jw = (mz[0] - hr * 0.15, mz[1] + hr * (0.32 + jaw * 0.55))   # hàm dưới
    hd.cap((hc[0] + hr * 0.2, hc[1] + hr * 0.45), jw, hr * 0.4, hr * 0.24)
    if sp.get('cheek'): hd.ell((hc[0] - hr * 0.15, hc[1] + hr * 0.45), hr * 0.78, hr * 0.6)
    if fz or sp.get('cheek'): tufts(hd, [(hc[0] - hr * (0.75 - 0.15 * t), hc[1] + hr * (0.2 + 0.5 * t)) for t in np.linspace(0, 1, 3)], (fz or 2.2) * 0.8 * k, (-0.8, 0.5))
    ep = sp['ears']
    if ep == 'point': ear_tri(hd, (hc[0] - hr * 0.3, hc[1] - hr * 0.6), hr * 0.34, hr * 1.05, -hr * 0.2)
    elif ep == 'round': hd.ell((hc[0] - hr * 0.42, hc[1] - hr * 0.78), hr * 0.32, hr * 0.3)
    elif ep == 'cat': ear_tri(hd, (hc[0] - hr * 0.28, hc[1] - hr * 0.68), hr * 0.34, hr * 0.66, -hr * 0.05)
    eye = sp.get('eye', '#f0c020')
    def hmarks(d):
        ex, ey = hc[0] + hr * 0.42, hc[1] - hr * 0.16
        d.poly([(ex - 1.9 * k, ey - 0.3 * k), (ex + 1.5 * k, ey - 1.0 * k), (ex + 2.3 * k, ey + 0.5 * k), (ex - 1.1 * k, ey + 0.9 * k)], '#120a0a')
        d.ell((ex + 0.3 * k, ey), 1.0 * k, 0.65 * k, eye); d.px(ex + 0.5 * k, ey, '#120a0a')
        d.line([(ex - 2.4 * k, ey - 1.6 * k), (ex + 2.6 * k, ey - 0.5 * k)], dark(col, 0.5), 0.9)
        d.ell((mz[0] + hr * 0.36, mz[1] - hr * 0.14), hr * 0.17, hr * 0.12, sp.get('nose', '#1a1214'))
        d.ell((mz[0] - hr * 0.2, mz[1] + hr * 0.12), hr * 0.45, hr * 0.22, bel)
        if jaw > 0.25:
            d.poly([(hc[0] + hr * 0.4, mz[1] + hr * 0.18), (mz[0] + hr * 0.38, mz[1] + hr * 0.12), (jw[0] + hr * 0.25, jw[1] - hr * 0.05), (hc[0] + hr * 0.45, mz[1] + hr * 0.35)], '#4a0a12')
            for j in range(2):
                tx = mz[0] + hr * (0.05 + j * 0.22)
                d.poly([(tx, mz[1] + hr * 0.16), (tx + hr * 0.1, mz[1] + hr * 0.16), (tx + hr * 0.05, mz[1] + hr * 0.42)], '#fff8e8')
                d.poly([(tx - hr * 0.05, jw[1] - hr * 0.05), (tx + hr * 0.05, jw[1] - hr * 0.05), (tx, jw[1] - hr * 0.28)], '#fff8e8')
        else:
            d.line([(hc[0] + hr * 0.45, mz[1] + hr * 0.3), (mz[0] + hr * 0.34, mz[1] + hr * 0.2)], dark(col, 0.55), 0.7)
        if ep in ('point', 'cat'):
            e0 = (hc[0] - hr * 0.32, hc[1] - hr * 0.68)
            d.poly([(e0[0] - hr * 0.14, e0[1]), (e0[0] + hr * 0.14, e0[1]), (e0[0] - hr * 0.12, e0[1] - hr * (0.6 if ep == 'point' else 0.35))], sp.get('earin', '#c89090'))
        if sp.get('stripes'):
            for j in range(3): d.line([(hc[0] - hr * 0.35 + j * hr * 0.25, hc[1] - hr * 0.82), (hc[0] - hr * 0.25 + j * hr * 0.25, hc[1] - hr * 0.42)], sp['stripes'], 1.0)
            d.line([(hc[0] - hr * 0.95, hc[1] + hr * 0.15), (hc[0] - hr * 0.4, hc[1] + hr * 0.25)], sp['stripes'], 1.0)
        if sp.get('lynx'): d.line([(hc[0] - hr * 0.42, hc[1] - hr * 1.3), (hc[0] - hr * 0.4, hc[1] - hr * 1.75)], '#1a1210', 1.0)
        if sp.get('scar'): d.line([(ex - 1 * k, ey - 3 * k), (ex + 1.5 * k, ey + 3 * k)], '#e8c0c0', 0.8)
        if dead: d.line([(ex - 1.5 * k, ey), (ex + 2 * k, ey)], '#120a0a', 0.9)
    hd.mark(hmarks)
    parts.append(hd)
    if sp.get('horns'):
        parts.append(Part(5.4, sp['horns'], sig=1.0, spec=0.5, ol=2).ribbon(bez([(hc[0] - hr * 0.1, hc[1] - hr * 0.7), (hc[0] - hr * 0.6, hc[1] - hr * 1.5), (hc[0] - hr * 1.3, hc[1] - hr * 1.7)], 6), 3 * k, 0.6 * k))
    if sp.get('collar'):
        c0, c1 = lerp((sh[0] + 1 * k, sh[1]), hc, 0.42), lerp((sh[0] + 1 * k, sh[1]), hc, 0.42)
        cl = Part(5.0, sp['collar'], sig=0.8, spec=0.6, ol=2).cap((c0[0] - 2 * k, c0[1] - brk * 0.55), (c1[0] + 2 * k, c1[1] + brk * 0.55), 2.0 * k, 2.0 * k)
        cl.mark(lambda d: [d.px(c0[0] - 1 * k + j * 1.0 * k, c0[1] - brk * 0.3 + j * 2.2 * k, '#f8f0d8') for j in range(3)])
        parts.append(cl)
    return parts

# ======================= rắn =======================
def snake(sp, kind, i):
    k = sp['k']; B = Beast(k); col, bel = sp['col'], sp.get('belly', light(sp['col'], 0.4))
    pat = sp.get('pattern', dark(col, 0.35))
    gy = B.gy
    ph = (i / 6 if kind == 'walk' else i / 4) * TAU
    rise = [0.5, 0.95, 0.35, 0.6][i] if kind == 'atk' else {'hurt': 0.5, 'idle': 0.6 + math.sin(ph) * 0.06, 'walk': 0.5, 'dead': 0}[kind]
    strike = [0, -6, 14, 5][i] if kind == 'atk' else 0
    N = 26; pts = []
    for j in range(N):
        t = j / (N - 1)   # 0 đuôi -> 1 đầu
        x = -40 + t * 66
        amp = (8 if kind != 'dead' else 2) * (1 - t * 0.6)
        y = 4 + math.sin(t * 8 + ph * (1 if kind != 'dead' else 0)) * amp * 0.5
        if t > 0.72 and kind != 'dead':   # phần cổ dựng lên
            u = (t - 0.72) / 0.28
            y += u * u * 34 * rise; x += u * strike - u * (1 - u) * 10
        pts.append(B.P(x, y))
    w = sp['w'] * k
    parts = []
    bd = Part(3, col, sig=2.2, spec=0.25, ol=3).ribbon(pts, w * 0.25, w)
    def m(d, pts=pts):
        for j in range(1, len(pts) - 2):
            a, b = pts[j], pts[j + 1]; nx, ny = -(b[1] - a[1]), b[0] - a[0]; ln = math.hypot(nx, ny) or 1
            ww = w * (0.25 + 0.75 * j / len(pts)) * 0.5
            d.line([(a[0] - nx / ln * ww * 0.8, a[1] - ny / ln * ww * 0.8), (b[0] - nx / ln * ww * 0.8, b[1] - ny / ln * ww * 0.8)], bel, max(1, ww * 0.7))
            if j % 2 == 0: d.ell((a[0] + nx / ln * ww * 0.25, a[1] + ny / ln * ww * 0.25), ww * 0.55, ww * 0.45, pat)
    bd.mark(m); parts.append(bd)
    hc = pts[-1]; hr = sp['head'] * k
    if sp.get('hood') and kind != 'dead':
        hood = Part(3.5, dark(col, 0.12), sig=1.6, spec=0.2, ol=3).ell((hc[0] - hr * 0.9, hc[1] + hr * 0.7), hr * 1.1, hr * 1.8)
        hood.mark(lambda d, c=sp['hood']: [d.ell((hc[0] - hr * 0.9, hc[1] + hr * (0.2 + j * 0.9)), hr * 0.32, hr * 0.22, c) for j in range(2)] + [d.line([(hc[0] - hr * 1.6, hc[1] + hr * 0.7), (hc[0] - hr * 0.2, hc[1] + hr * 0.7)], pat, 0.9)])
        parts.append(hood)
    hd = Part(4, col, sig=1.4, spec=0.3, ol=3)
    hd.ell(hc, hr * 1.25, hr * 0.85).ell((hc[0] + hr * 0.9, hc[1] + hr * 0.15), hr * 0.75, hr * 0.55)
    jaw = 1 if kind == 'atk' and i in (1, 2) else 0
    def hm(d, hc=hc):
        ex, ey = hc[0] + hr * 0.45, hc[1] - hr * 0.25
        d.ell((ex, ey), 1.3 * k, 0.9 * k, sp.get('eye', '#ffd020')); d.line([(ex, ey - 0.8 * k), (ex, ey + 0.8 * k)], '#100808', 0.6)
        d.line([(ex - 2 * k, ey - 1.4 * k), (ex + 2 * k, ey - 0.8 * k)], dark(col, 0.5), 0.8)
        if jaw:
            d.poly([(hc[0] + hr * 0.2, hc[1] + hr * 0.3), (hc[0] + hr * 1.7, hc[1] + hr * 0.2), (hc[0] + hr * 1.3, hc[1] + hr * 1.3)], '#5a0a1a')
            d.line([(hc[0] + hr * 1.1, hc[1] + hr * 0.3), (hc[0] + hr * 1.15, hc[1] + hr * 0.75)], '#ffffff', 0.7)
            d.line([(hc[0] + hr * 1.6, hc[1] + hr * 0.6), (hc[0] + hr * 2.6, hc[1] + hr * 0.4), (hc[0] + hr * 2.9, hc[1] + hr * 0.1)], '#e02040', 0.6)
    hd.mark(hm); parts.append(hd)
    if sp.get('horns'):
        parts.append(Part(4.2, sp['horns'], sig=0.8, spec=0.5, ol=2).ribbon([(hc[0] - hr * 0.2, hc[1] - hr * 0.6), (hc[0] - hr * 0.9, hc[1] - hr * 1.6), (hc[0] - hr * 1.7, hc[1] - hr * 1.8)], 2.6 * k, 0.5 * k))
    return parts

# ======================= bò cạp =======================
def scorpion(sp, kind, i):
    k = sp['k']; B = Beast(k); col = sp['col']; dk = dark(col, 0.35)
    ph = (i / 6 if kind == 'walk' else 0) * TAU
    lift = {'atk': [0.2, 0.6, 1.0, 0.4][i] if kind == 'atk' else 0}.get('atk', 0)
    dead = kind == 'dead'
    parts = []
    by = 9 if not dead else 6
    # 8 chân (4 xa, 4 gần): gối nhô cao hơn lưng, bàn chân xoè rộng
    for near in (0, 1):
        for j in range(4):
            bx = -8 + j * 6.5
            root = B.P(bx, by + 3)
            swing = math.sin(ph + j * 1.6 + near * math.pi) * 3 if kind == 'walk' else 0
            spread = (j - 1.5) * 5
            knee = B.P(bx + spread * 0.5 + swing * 0.4, by + 13 - near * 2)
            ank = B.P(bx + spread * 1.2 + swing, by - 2 - near)
            foot = B.P(bx + spread * 1.4 + swing + 2, 0 if not dead else 3)
            lc = col if near else dark(col, 0.3)
            lg = Part(4.5 if near else 1, lc, sig=0.8, spec=0.35, ol=2).cap(root, knee, 2.6 * k, 2.2 * k).cap(knee, ank, 2.2 * k, 1.6 * k).cap(ank, foot, 1.6 * k, 0.8 * k)
            parts.append(lg)
    # thân đốt
    body = Part(3, col, sig=1.8, spec=0.45, ol=3)
    segs = [B.P(-14 + j * 6, by + 4) for j in range(6)]
    body.blob([(s, (8.8 - abs(j - 3.2) * 0.55) * k) for j, s in enumerate(segs)])
    body.mark(lambda d: [d.line([(s[0] + 3 * k, s[1] - 7.5 * k), (s[0] + 2 * k, s[1] + 6 * k)], dk, 1.1) for s in segs[:-1]] + [d.line([(segs[0][0], segs[0][1] - 4 * k), (segs[-1][0], segs[-1][1] - 5 * k)], light(col, 0.3), 0.8)])
    parts.append(body)
    # đuôi cong vút qua lưng: từ đốt cuối đi lùi, vòng lên, mũi kim chĩa ra trước
    lf = lift
    ctrl = [(-16, by + 4), (-30, by + 10), (-30 + lf * 6, by + 30 + lf * 4), (-10 + lf * 16, by + 40 - lf * 2), (4 + lf * 20, by + 34 - lf * 14)]
    if dead: ctrl = [(-16, by + 3), (-30, by + 4), (-40, by + 8), (-46, by + 14), (-44, by + 20)]
    tail = [B.P(x, y) for x, y in bez(ctrl, 8)[1:]]
    tp = Part(3.2 if not lf else 5.5, col, sig=1.4, spec=0.45, ol=3)
    prev = segs[0]
    for j, p in enumerate(tail):
        tp.cap(prev, p, (4.4 - j * 0.32) * k, (4.2 - j * 0.32) * k); prev = p
    tp.mark(lambda d: [d.line([(tail[j][0] - 3 * k, tail[j][1]), (tail[j][0] + 3 * k, tail[j][1])], dk, 0.8) for j in range(0, len(tail) - 1)])
    parts.append(tp)
    st = Part(5.6, sp.get('bulb', '#ffb020'), sig=1.0, spec=0.6, ol=2)
    end = tail[-1]; pv = tail[-2]
    ang = math.atan2(end[1] - pv[1], end[0] - pv[0])
    st.ell(end, 3.8 * k, 3.2 * k).poly([(end[0] + math.cos(ang + 1.4) * 2.4 * k, end[1] + math.sin(ang + 1.4) * 2.4 * k), (end[0] + math.cos(ang + 0.4) * 8 * k, end[1] + math.sin(ang + 0.4) * 8 * k), (end[0] + math.cos(ang - 0.6) * 2.4 * k, end[1] + math.sin(ang - 0.6) * 2.4 * k)])
    parts.append(st)
    # càng: cánh tay gập lên, kìm to sát đất phía trước
    for near in (0, 1):
        hit = kind == 'atk' and i == 2
        reach = 4 + (10 if hit else 0)
        sh = B.P(17, by + 4 + near)
        el = B.P(25 + reach * 0.3, by + 13 + near * 2 - (3 if hit else 0))
        cl = B.P(33 + reach, by + 4 + near * 3 + (4 if hit else 0))
        c = col if near else dark(col, 0.3)
        arm = Part(5 if near else 1.5, c, sig=1.3, spec=0.45, ol=3).cap(sh, el, 3.0 * k, 3.4 * k).cap(el, cl, 3.4 * k, 4.6 * k)
        op = 0.8 if kind == 'atk' and i in (1, 2) else 0.3
        arm.blob([((cl[0] - 1 * k, cl[1]), 5.2 * k), ((cl[0] + 4 * k, cl[1] + 0.5 * k), 5.6 * k)])
        tip = (cl[0] + 8 * k, cl[1])
        arm.poly([(tip[0], tip[1] + 3 * k), (tip[0] + 9 * k, tip[1] + (3 + op * 5) * k), (tip[0] + 12 * k, tip[1] + (1 + op * 6) * k), (tip[0] + 2 * k, tip[1] + 0.5 * k)])
        arm.poly([(tip[0], tip[1] - 3 * k), (tip[0] + 10 * k, tip[1] - (2.5 + op * 2) * k), (tip[0] + 11 * k, tip[1] - (0.5 + op * 1) * k), (tip[0] + 2 * k, tip[1] - 0.5 * k)])
        arm.mark(lambda d, cl=cl, c=c: [d.line([(cl[0] - 3 * k, cl[1] + 3 * k), (cl[0] + 6 * k, cl[1] + 3.5 * k)], light(c, 0.3), 0.9)])
        parts.append(arm)
    hd = Part(5.2, col, sig=1.2, spec=0.4, ol=2).ell(B.P(19, by + 5), 7 * k, 5.6 * k)
    hd.mark(lambda d: [d.px(B.P(21, by + 7)[0] + j * 1.5 * k, B.P(21, by + 7)[1], sp.get('eye', '#ff3020')) for j in range(2)])
    parts.append(hd)
    if sp.get('crown'):
        parts.append(Part(5.6, sp['crown'], sig=0.8, spec=0.7, ol=2).poly([B.P(14, by + 9), B.P(16, by + 13), B.P(18, by + 10), B.P(20, by + 14), B.P(22, by + 10), B.P(24, by + 13), B.P(25, by + 9)]))
    return parts

# ======================= khỉ =======================
def monkey(sp, kind, i):
    k = sp['k']; B = Beast(k); col, face = sp['col'], sp.get('face', '#e8c098')
    ph = (i / 6) * TAU if kind == 'walk' else (i / 4) * TAU
    dead = kind == 'dead'
    bob = abs(math.sin(ph)) * 2 if kind == 'walk' else math.sin(ph) * 0.5
    leap = [0, 3, 10, 4][i] if kind == 'atk' else 0
    parts = []
    hip = B.P(-4 + leap * 0.5, 22 + bob + leap * 0.6) if not dead else B.P(-6, 6)
    sh = B.P(4 + leap, 36 + bob + leap) if not dead else B.P(12, 7)
    # đuôi cong
    tb = hip
    tail = bez([tb, (tb[0] - 14 * k, tb[1] + 4 * k), (tb[0] - 20 * k, tb[1] - 12 * k + math.sin(ph) * 3 * k), (tb[0] - 12 * k, tb[1] - 20 * k)], 12)
    parts.append(Part(1.5, col, sig=1.0, spec=0.05, ol=2).ribbon(tail, 3 * k, 2.2 * k))
    # chân
    for near in (0, 1):
        sw = math.sin(ph + near * math.pi) * 6 if kind == 'walk' else 0
        foot = (hip[0] + (6 + sw) * k, B.gy - (0 if not dead else 3 * k))
        knee = ik(hip, foot, 13 * k, 12 * k, 1)
        c = col if near else dark(col, 0.3)
        parts.append(Part(4.5 if near else 1.0, c, sig=1.4, spec=0.05, ol=3).cap(hip, knee, 4.4 * k, 3.4 * k).cap(knee, foot, 3.2 * k, 2.6 * k).ell((foot[0] + 2 * k, foot[1] - 1 * k), 3.4 * k, 1.8 * k))
    # thân
    bd = Part(3, col, sig=2.4, spec=0.08, ol=3).blob([(hip, 8 * k), (lerp(hip, sh, 0.5), 8.6 * k), (sh, 8.4 * k)])
    bd.mark(lambda d: d.ell((lerp(hip, sh, 0.55)[0] + 4 * k, lerp(hip, sh, 0.55)[1] + 2 * k), 4.5 * k, 7 * k, light(col, 0.35)))
    if sp.get('vest'): bd.mark(lambda d: d.poly([(sh[0] - 7 * k, sh[1] - 4 * k), (sh[0] + 7 * k, sh[1] - 4 * k), (hip[0] + 7 * k, hip[1] + 2 * k), (hip[0] - 7 * k, hip[1] + 2 * k)], sp['vest']))
    parts.append(bd)
    # tay dài
    for near in (0, 1):
        sw = math.sin(ph + near * math.pi + 1) * 8 if kind == 'walk' else 0
        if kind == 'atk' and near: hand = (sh[0] + (16 + leap) * k, sh[1] - [4, 10, 4, 0][i] * k)
        elif dead: hand = (sh[0] + 14 * k, B.gy - 3 * k)
        else: hand = (sh[0] + (8 + sw) * k, B.gy - 1 * k)
        el = ik(sh, hand, 15 * k, 14 * k, -1)
        c = col if near else dark(col, 0.3)
        parts.append(Part(5 if near else 0.8, c, sig=1.3, spec=0.05, ol=3).cap(sh, el, 3.6 * k, 3.0 * k).cap(el, hand, 2.8 * k, 2.4 * k).ell(hand, 2.8 * k, 2.4 * k))
    # đầu
    hc = (sh[0] + 6 * k, sh[1] - 9 * k) if not dead else (sh[0] + 9 * k, B.gy - 6 * k)
    hd = Part(5.5, col, sig=1.6, spec=0.08, ol=3).ell(hc, 7.4 * k, 7 * k)
    hd.ell((hc[0] - 5.5 * k, hc[1] - 1 * k), 2.6 * k, 3 * k)
    def hm(d, hc=hc):
        d.ell((hc[0] + 2.8 * k, hc[1] + 0.8 * k), 4.6 * k, 4.6 * k, face)
        d.ell((hc[0] + 5.2 * k, hc[1] + 3.0 * k), 2.8 * k, 2.2 * k, light(face, 0.15))
        for ex in (hc[0] + 1.8 * k, hc[0] + 4.6 * k):
            d.ell((ex, hc[1] - 0.6 * k), 0.9 * k, 0.8 * k, '#120808'); d.px(ex + 0.3 * k, hc[1] - 0.8 * k, sp.get('eye', '#ffd040'))
        d.line([(hc[0] + 0.6 * k, hc[1] - 2 * k), (hc[0] + 6 * k, hc[1] - 1.6 * k)], dark(face, 0.5), 0.9)
        if kind == 'atk': d.ell((hc[0] + 5.6 * k, hc[1] + 3.6 * k), 1.6 * k, 1.3 * k, '#5a0a10')
    hd.mark(hm); parts.append(hd)
    if sp.get('golden'):
        parts.append(Part(5.7, '#ffd040', sig=0.6, spec=0.8, ol=2).ribbon([(hc[0] - 6 * k, hc[1] - 4 * k), (hc[0], hc[1] - 6.8 * k), (hc[0] + 6 * k, hc[1] - 4.5 * k)], 1.6 * k, 1.6 * k))
    return parts

# ======================= thỏ =======================
def rabbit(sp, kind, i):
    k = sp['k']; B = Beast(k); col = sp['col']
    hop = math.sin(i / 6 * math.pi * 2) if kind == 'walk' else 0
    up = max(0, hop) * 6
    dead = kind == 'dead'
    c = (0, 9 + up) if not dead else (0, 6)
    parts = []
    body = Part(3, col, sig=2.4, spec=0.06, ol=3).blob([(B.P(-6, c[1]), 8 * k), (B.P(2, c[1] + 2), 7 * k)])
    body.mark(lambda d: d.ell((B.P(4, c[1] - 1)[0], B.P(4, c[1] - 1)[1]), 4 * k, 4 * k, light(col, 0.4)))
    parts.append(Part(2.5, '#ffffff', sig=1.0, ol=2).ell(B.P(-13, c[1] + 3), 3.2 * k, 3 * k))
    parts.append(Part(4.5, col, sig=1.4, ol=3).ell(B.P(-3, c[1] - 6 + (2 if up else 0)), 6 * k, 3.2 * k))   # đùi sau
    parts.append(Part(4.6, dark(col, 0.1), sig=1.0, ol=2).cap(B.P(6, c[1] - 4), B.P(8, 0.5 + up * 0.3), 1.8 * k, 1.6 * k))
    parts.append(body)
    hc = B.P(9, c[1] + 8) if not dead else B.P(11, 6)
    hd = Part(5, col, sig=1.6, spec=0.06, ol=3).ell(hc, 5.4 * k, 4.8 * k)
    ear = 1 if kind != 'hurt' else 0.6
    hd.cap((hc[0] - 2 * k, hc[1] - 3 * k), (hc[0] - 5 * k, hc[1] - 12 * k * ear), 1.8 * k, 1.5 * k)
    hd.mark(lambda d: (d.ell((hc[0] + 1.8 * k, hc[1] - 0.6 * k), 1.1 * k, 1.1 * k, '#2a1010'), d.px(hc[0] + 2 * k, hc[1] - 1 * k, '#ffffff'), d.ell((hc[0] + 5 * k, hc[1] + 1 * k), 0.8 * k, 0.6 * k, '#e88a9a')))
    parts.append(hd)
    parts.append(Part(4.9, dark(col, 0.25), sig=1.2, ol=2).cap((hc[0] - 3.5 * k, hc[1] - 3 * k), (hc[0] - 8 * k, hc[1] - 11 * k * ear), 1.6 * k, 1.3 * k))
    return parts

# ======================= loài =======================
WOLF = dict(kind='quad', len=20, h=34, leg=(11, 12, 8), legw=(5.0, 3.4, 2.5), pawr=2.8, bodyr=11.5, headr=8.2, headlen=17, neck=(12, 10), stride=17, lift=6,
            tail='bushy', ears='point', furmark=True, claws=True, mzk=0.6, mzk2=0.36, fur=3.8, thigh=9.5, arm=8, chestk=1.12, waistk=0.72, rumpk=0.84)
BEAR = dict(kind='quad', len=20, h=34, leg=(10, 11, 6), legw=(7.4, 6.2, 5.0), pawr=4.0, bodyr=16, headr=9.4, headlen=11, neck=(17, 4), stride=12, lift=5, rumpk=1.0, chestk=1.08, waistk=0.95,
            tail='stub', ears='round', furmark=True, claws=True, hump=True, rears=1, fur=4.2, mzk=0.62, mzk2=0.5, thigh=11, arm=10, sig=3.4, gait=0.8, neckw=0.9, hip=1.04)
CAT = dict(kind='quad', len=23, h=31, leg=(10, 11, 7), legw=(5.4, 4.2, 3.2), pawr=3.2, bodyr=11, headr=8, headlen=9, neck=(14, 8), stride=19, lift=6,
           tail='long', ears='cat', claws=True, cheek=True, furmark=True, mzk=0.66, mzk2=0.52, thigh=9, arm=8, chestk=1.08, waistk=0.78, rumpk=0.9, earin='#f0c8c8')

def S(base, **kw):
    d = dict(base); d.update(kw); return d

SPECIES = {
    # ---- sói ----
    'soi_xam': S(WOLF, col='#8a8a8e', belly='#d8d4cc'),
    'soi_hoang': S(WOLF, col='#a08a6a', belly='#e0d0b0'),
    'lang_xam': S(WOLF, col='#6a6a70', belly='#b8b4ac', ruff='#7a7a80'),
    'soi_doi': S(WOLF, col='#5a5048', belly='#a89888', scar=1, eye='#ffb020'),
    'bang_lang': S(WOLF, col='#c8dcec', belly='#f4fbff', eye='#7ae0ff', frost=1, ruff='#e0f0ff'),
    'tuyet_lang': S(WOLF, col='#e8eef4', belly='#ffffff', eye='#7ae0ff', frost=1),
    'ma_lang': S(WOLF, col='#3a2a3a', belly='#6a4a5a', eye='#d040ff', saddle='#1a0a14', ruff='#4a2a3a', trim='#a040c0'),
    'xich_lang': S(WOLF, col='#a03a1a', belly='#e08a50', eye='#ffd040', saddle='#4a0808', ruff='#c04a1a'),
    'huyet_lang': S(WOLF, col='#6a0a0a', belly='#a02020', eye='#ff2020', saddle='#3a0008', scar=1, ruff='#8a1010', trim='#ff3030'),
    'boss_soi': S(WOLF, col='#4a4a52', belly='#8a8a90', eye='#ff3020', saddle='#2a2a30', scar=1, collar='#c8a040', ruff='#5a5a62', k=1.5),
    # ---- gấu ----
    'gau_den': S(BEAR, col='#2e241e', belly='#e8e0c8', eye='#c08030'),
    'gau_dong': S(BEAR, col='#5a3a22', belly='#8a6040'),
    'gau_nui': S(BEAR, col='#7a5634', belly='#c8a070'),
    'hung_vuong': S(BEAR, col='#3a2a1e', belly='#6a5038', eye='#ff3020', saddle='#b08030', trim='#ffd060', k=1.25),
    # ---- hổ / báo ----
    'ho_trang': S(CAT, col='#f2f0ea', belly='#ffffff', stripes='#24202a', eye='#ffc828'),
    'ho_den': S(CAT, col='#3a3a42', belly='#6a6a72', stripes='#141018', eye='#ffd040'),
    'linh_mieu': S(CAT, col='#c8a070', belly='#f0e0c0', spots='#4a2a14', lynx=1, eye='#c8e040', tail='long', tailtip='#2a1a10'),
    'tuyet_ho': S(CAT, col='#e8eef8', belly='#ffffff', stripes='#5a6a8a', eye='#4ab0ff'),
    'tien_ho': S(CAT, col='#e0ecf8', belly='#ffffff', stripes='#a8c8e8', eye='#7ae0ff'),
    'xich_ho': S(CAT, col='#e07020', belly='#ffd0a0', stripes='#3a0a00', eye='#ffd040'),
    # ---- khỉ ----
    'khi_rung': dict(kind='monkey', col='#7a5232', face='#e8c098', k=1.0),
    'khi_dot': dict(kind='monkey', col='#c8902a', face='#f4d0a8', vest='#a02020', golden=1, k=1.35),
    'linh_vien': dict(kind='monkey', col='#e8e8f0', face='#f4d8b8', vest='#3a5a8a', eye='#80d0ff', k=1.3),
    # ---- thỏ ----
    'tho_rung': dict(kind='rabbit', col='#d8c8b0', k=1.0),
    # ---- rắn ----
    'ran_truc': dict(kind='snake', col='#3cb043', belly='#c8f0a0', pattern='#1a6a20', w=11, head=5.4, k=1.0),
    'ran_nuoc': dict(kind='snake', col='#3a7aa0', belly='#c8e8f0', pattern='#1a4a70', w=11, head=5.4, k=1.0),
    'ran_hang': dict(kind='snake', col='#5a5040', belly='#c8b898', pattern='#2a2418', w=12, head=5.8, k=1.0),
    'sa_xa': dict(kind='snake', col='#c8a060', belly='#f0e0b0', pattern='#7a5a20', w=11, head=5.6, k=1.0),
    'bang_xa': dict(kind='snake', col='#a8d8f0', belly='#f0fbff', pattern='#4a90c0', eye='#e8ffff', hood='#e8ffff', w=12, head=5.8, k=1.05),
    'bang_giao': dict(kind='snake', col='#8ac0e8', belly='#f0fbff', pattern='#4a90c0', eye='#e8ffff', hood='#d8f0ff', horns='#f0f8ff', w=13, head=6.4, k=1.35),
    'doc_mang': dict(kind='snake', col='#2a6a20', belly='#c8f080', pattern='#0a3a10', eye='#ffe040', hood='#80ff40', w=13, head=6.4, k=1.35),
    'boss_truc': dict(kind='snake', col='#00a86b', belly='#d8ffd0', pattern='#006040', eye='#ffe040', hood='#ffe080', horns='#f0e0a0', w=14, head=7, k=1.6),
    # ---- bò cạp ----
    'bo_cap': dict(kind='scorpion', col='#a06a3a', k=1.0),
    'kim_hat': dict(kind='scorpion', col='#d8a030', bulb='#ffe060', k=1.05),
    'doc_hat': dict(kind='scorpion', col='#4a6a2a', bulb='#80ff40', eye='#80ff40', k=1.05),
    'boss_samac': dict(kind='scorpion', col='#8b4513', bulb='#ff6020', crown='#ffd040', k=1.7),
}
FN = {'quad': quadruped, 'snake': snake, 'scorpion': scorpion, 'monkey': monkey, 'rabbit': rabbit}

def render(mid, outdir):
    sp = dict(SPECIES[mid]); sp.setdefault('k', 1.0)
    boss = mid.startswith('boss_') or sp['k'] >= 1.5
    cell = 216 if boss else 144
    R.CELL = cell; R.FX, R.FY = cell // 2, cell - 16
    sheet = np.zeros((cell, cell * len(FRAMES), 4), np.uint8)
    for c, (kind, i) in enumerate(FRAMES):
        fn = FN[sp['kind']]
        def P0(x, y, sp=sp): return None
        Beast.__init__.__defaults__ = (1.0, cell // 2, cell - 16)
        parts = fn(sp, kind, i)
        C = R.composite(parts)
        img = R.downsample(C)
        sheet[:, c * cell:(c + 1) * cell] = np.clip(img, 0, 255).astype(np.uint8)
    img = Image.fromarray(sheet, 'RGBA')
    fy = cell - 16
    if not boss:
        img = img.resize((img.width * 2 // 3, img.height * 2 // 3), Image.LANCZOS)
        cell, fy = cell * 2 // 3, fy * 2 // 3
    a = np.array(img); a[..., 3] = np.where(a[..., 3] < 40, 0, 255); img = Image.fromarray(a, 'RGBA')
    img.save(os.path.join(outdir, mid + '.png'), optimize=True)
    cl = np.array(img.crop((0, 0, cell, cell))); ys, xs = np.where(cl[..., 3] > 0)
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
        for res in pool.starmap(safe, [(i, out) for i in ids]):
            if res: meta[res[0]] = res[1]; print('ok', *res)
    json.dump(meta, open(mp, 'w'))
