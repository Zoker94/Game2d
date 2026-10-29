#!/usr/bin/env python3
# BẢN NÂNG CẤP ĐỒ HOẠ (xem trước, chưa dùng trong game) – dựa trên rig2.py:
#   * xuất ô 288x288 (gấp đôi) cùng kích thước hiển thị -> nét gấp đôi; vẽ ở S=6 rồi thu 3 lần (khử răng cưa mịn hơn)
#   * tô khối 7 cấp sáng/tối (trước 5) + viền sáng ở mép hướng đèn + ánh phản quang lạnh ở mép khuất
#   * khuôn mặt vẽ ở nửa điểm ảnh: mí, tròng trắng, mống mắt, đồng tử, đốm sáng, lông mày thanh, sống mũi, môi
#   * tóc có sợi (vân toả từ đỉnh đầu) + vệt bóng
# BẢN THỬ NGHIỆM nhân vật chi tiết cho 9 môn phái (chưa dùng trong game).
# - Người tỉ lệ thật (~6.3 đầu), khung xương 3D chiếu ra 5 hướng (xuống / lên / phải / chéo xuống / chéo lên), ô 144x144.
# - Vẽ ở độ phân giải gấp 4 rồi thu nhỏ: mỗi bộ phận được tô khối theo pháp tuyến (ánh sáng trên-trái),
#   có viền trong, đổ bóng lên bộ phận phía sau, rồi viền ngoài theo màu (sel-out).
# - Tóc dài, đuôi ngựa, dải lụa, vạt áo, tua kiếm, ống tay rộng chuyển động theo mô phỏng lò xo (verlet),
#   nên khi đi / chạy / ra đòn thì vải và tóc bay theo quán tính.
# - Hoạt ảnh: đứng thở 8, đi 12, chạy 12, đánh 12, ra chiêu 12, trúng đòn 4, ngã 8 khung; đứng / đi / chạy có thêm 2 hướng chéo.
# Dùng: python3 tools/rig2.py design/chars2 [mã phái ...]
import math, os, sys, json
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, binary_erosion, binary_dilation

S = 6                    # độ phân giải vẽ gấp S lần (toạ độ thế giới vẫn theo ô 144)
CELL = 144
K = 2                    # ô xuất gấp K lần: 288x288
OUT = CELL * K
D = S // K               # hệ số thu nhỏ khi xuất
FX, FY = 72, 128         # điểm chân chạm đất trong ô
TAU = math.pi * 2
TILT = 0.22              # góc nhìn từ trên xuống: vật ở gần lệch xuống dưới
LIGHT = np.array([-0.52, -0.6, 0.6]); LIGHT = LIGHT / np.linalg.norm(LIGHT)
INK = (22, 13, 30)
SH_HUE = (44, 26, 72)
LI_HUE = (255, 244, 214)
VIEWS = ['down', 'up', 'right']
DIAG = ['dr', 'ur']      # chéo xuống-phải, chéo lên-phải (chéo trái = lật); chỉ cho đứng / đi / chạy
YAW_V = {'down': 0.0, 'dr': 45.0, 'right': 90.0, 'ur': 135.0, 'up': 180.0}   # góc nhân vật quay so với hướng nhìn thẳng
DOWNS, UPS = ('down', 'dr'), ('up', 'ur')
BASEV = {'dr': 'down', 'ur': 'up'}   # đầu / tóc / mũ vẽ 2D: góc chéo dùng nét vẽ của hướng gần nhất (mặt lệch về phía quay)
GAME_SCALE = 0.68       # vẽ trong game với tỉ lệ này: cao ~72px, cân với NPC / quái hiện có (ô 64)


# ================= màu =================
def hx(c):
    if isinstance(c, (tuple, list)): return tuple(int(v) for v in c[:3])
    c = c.lstrip('#'); return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16))
def mix(a, b, t):
    a, b = hx(a), hx(b); return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))
def dark(c, t=0.3): return mix(c, SH_HUE, t)
def light(c, t=0.3): return mix(c, LI_HUE, t)
def ramp_n(c):   # thang xám trung tính cho kim loại (để game tô màu phẩm chất)
    return np.array([mix(c, '#18181c', .64), mix(c, '#18181c', .46), mix(c, '#18181c', .24), hx(c), mix(c, '#ffffff', .2), mix(c, '#ffffff', .42), mix(c, '#ffffff', .8)], np.float32)
def ramp(c):
    return np.array([mix(c, SH_HUE, .62), mix(c, SH_HUE, .44), mix(c, SH_HUE, .24), hx(c), mix(c, LI_HUE, .17), mix(c, LI_HUE, .36), mix(c, LI_HUE, .7)], np.float32)
RIM_HUE = (150, 190, 255)   # ánh phản quang lạnh ở mép khuất sáng


# ================= véc-tơ =================
def V(*a): return np.array(a, float)
def nrm(v):
    n = np.linalg.norm(v); return v / n if n > 1e-9 else v
def yaw(a):
    c, s = math.cos(a), math.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1.]])
def pitch(a):
    c, s = math.cos(a), math.sin(a); return np.array([[1., 0, 0], [0, c, s], [0, -s, c]])
def roll(a):
    c, s = math.cos(a), math.sin(a); return np.array([[c, 0, s], [0, 1., 0], [-s, 0, c]])
def adir(y, p):   # hướng theo góc: y quay từ trước sang phải, p ngẩng lên
    return V(math.sin(y) * math.cos(p), math.cos(y) * math.cos(p), math.sin(p))
def limb(a, b, side):   # a vung ra trước, b giạng ngang
    return V(side * math.sin(b), math.sin(a) * math.cos(b), -math.cos(a) * math.cos(b))
def ik(sh, tgt, l1, l2, pole):
    d = tgt - sh; L = np.linalg.norm(d)
    L = min(max(L, 0.5), l1 + l2 - 0.05); dn = nrm(d)
    ca = (l1 * l1 + L * L - l2 * l2) / (2 * l1 * L); a = math.acos(max(-1, min(1, ca)))
    pp = pole - dn * np.dot(pole, dn); pp = nrm(pp)
    el = sh + dn * math.cos(a) * l1 + pp * math.sin(a) * l1
    return el, sh + dn * L

def hull(pts):
    pts = sorted(set((round(p[0], 3), round(p[1], 3)) for p in pts))
    if len(pts) < 3: return pts
    def cr(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]
def circ(c, r, n=16): return [(c[0] + math.cos(i / n * TAU) * r, c[1] + math.sin(i / n * TAU) * r) for i in range(n)]


# ================= bộ phận =================
class Part:
    def __init__(self, depth, col, sig=2.4, spec=0.0, ol=3, shade=True, tag='body', neutral=False):
        self.depth, self.col, self.sig, self.spec, self.ol, self.shade = depth, col, sig, spec, ol, shade
        self.ops, self.marks = [], []
        self.rot = None; self.tag = tag; self.neutral = neutral; self._r = 0
    def poly(self, pts, fill=255):
        self.ops.append(('p', [(float(p[0]), float(p[1])) for p in pts], fill)); return self
    def erase(self, pts): return self.poly(pts, 0)
    def ell(self, c, rx, ry=None, fill=255):
        self.ops.append(('e', (float(c[0]), float(c[1]), rx, rx if ry is None else ry), fill)); return self
    def cap(self, a, b, r0, r1=None):
        return self.poly(hull(circ(a, r0) + circ(b, r0 if r1 is None else r1)))
    def blob(self, cs):
        pts = []
        for c, r in cs: pts += circ(c, r)
        return self.poly(hull(pts))
    def line(self, pts, w):
        self.ops.append(('l', [(float(p[0]), float(p[1])) for p in pts], w)); return self
    def ribbon(self, pts, w0, w1):
        n = len(pts)
        if n < 2: return self
        Lp, Rp = [], []
        for i, p in enumerate(pts):
            a, b = pts[max(0, i - 1)], pts[min(n - 1, i + 1)]
            dx, dy = b[0] - a[0], b[1] - a[1]; ln = math.hypot(dx, dy) or 1
            nx, ny = -dy / ln, dx / ln
            w = (w0 + (w1 - w0) * i / (n - 1)) / 2
            Lp.append((p[0] + nx * w, p[1] + ny * w)); Rp.append((p[0] - nx * w, p[1] - ny * w))
        self.poly(Lp + Rp[::-1])
        self.ell(pts[0], w0 / 2); self.ell(pts[-1], w1 / 2)
        return self
    def mark(self, fn): self.marks.append(fn); return self


def rotp(p, rot):
    if rot is None: return p
    cx, cy, a = rot; c, s = math.cos(a), math.sin(a); dx, dy = p[0] - cx, p[1] - cy
    return (cx + dx * c - dy * s, cy + dx * s + dy * c)

def apply_rot(pt):
    """xoay mọi hình của bộ phận quanh 1 điểm (đầu khi ngã)"""
    if pt.rot is None: return
    ops = []
    for k, d, f in pt.ops:
        if k == 'e':
            ops.append(('p', [rotp(q, pt.rot) for q in [(d[0] + math.cos(i / 20 * TAU) * d[2], d[1] + math.sin(i / 20 * TAU) * d[3]) for i in range(20)]], f))
        else: ops.append((k, [rotp(q, pt.rot) for q in d], f))
    pt.ops = ops

class Dr:
    """vẽ chi tiết (mắt, nếp vải, hoa văn) lên bộ phận đã tô khối, toạ độ theo pixel cuối"""
    def __init__(self, img, x0, y0, rp, rot=None):
        self.d = ImageDraw.Draw(img); self.x0, self.y0, self.rp, self.rot = x0, y0, rp, rot
    def T(self, p):
        p = rotp(p, self.rot); return ((p[0] - self.x0) * S, (p[1] - self.y0) * S)
    def c(self, col): return tuple(int(v) for v in self.rp[col]) if isinstance(col, int) else hx(col)
    def px(self, x, y, col):
        if self.rot is not None: x, y = rotp((x + 0.5, y + 0.5), self.rot); x -= 0.5; y -= 0.5
        X, Y = (int(round(x)) - self.x0) * S, (int(round(y)) - self.y0) * S
        self.d.rectangle([X, Y, X + S - 1, Y + S - 1], fill=self.c(col))
    def hp(self, x, y, col):   # nửa điểm ảnh (1 điểm ảnh ở ô xuất 288): chi tiết mặt
        if self.rot is not None: x, y = rotp((x + 0.25, y + 0.25), self.rot); x -= 0.25; y -= 0.25
        X, Y = int(round((round(x * K) / K - self.x0) * S)), int(round((round(y * K) / K - self.y0) * S))
        self.d.rectangle([X, Y, X + D - 1, Y + D - 1], fill=self.c(col))
    def line(self, pts, col, w=1.0):
        self.d.line([self.T(p) for p in pts], fill=self.c(col), width=max(1, int(round(w * S))), joint='curve')
    def poly(self, pts, col): self.d.polygon([self.T(p) for p in pts], fill=self.c(col))
    def ell(self, c, rx, ry, col):
        if self.rot is not None: return self.poly([(c[0] + math.cos(i / 16 * TAU) * rx, c[1] + math.sin(i / 16 * TAU) * ry) for i in range(16)], col)
        X, Y = self.T(c); self.d.ellipse([X - rx * S, Y - ry * S, X + rx * S, Y + ry * S], fill=self.c(col))


def render_part(pt):
    if pt._r != 0: return pt._r
    pt._r = _render_part(pt); return pt._r

def _render_part(pt):
    apply_rot(pt)
    xs, ys = [], []
    for k, d, f in pt.ops:
        if k == 'p': xs += [p[0] for p in d]; ys += [p[1] for p in d]
        elif k == 'e': xs += [d[0] - d[2], d[0] + d[2]]; ys += [d[1] - d[3], d[1] + d[3]]
        else: xs += [p[0] - f for p in d] + [p[0] + f for p in d]; ys += [p[1] - f for p in d] + [p[1] + f for p in d]
    if not xs: return None
    x0, y0 = math.floor(min(xs)) - 2, math.floor(min(ys)) - 2
    x1, y1 = math.ceil(max(xs)) + 3, math.ceil(max(ys)) + 3
    Wd, Ht = (x1 - x0) * S, (y1 - y0) * S
    if Wd <= 0 or Ht <= 0 or Wd > 4000 or Ht > 4000: return None
    m = Image.new('L', (Wd, Ht), 0); d = ImageDraw.Draw(m)
    T = lambda p: ((p[0] - x0) * S, (p[1] - y0) * S)
    for k, dd, f in pt.ops:
        if k == 'p':
            if len(dd) >= 3: d.polygon([T(p) for p in dd], fill=f)
        elif k == 'e':
            cx, cy = T(dd[:2]); d.ellipse([cx - dd[2] * S, cy - dd[3] * S, cx + dd[2] * S, cy + dd[3] * S], fill=f)
        else:
            w = max(1, int(round(f * S)))
            d.line([T(p) for p in dd], fill=255, width=w, joint='curve')
            for p in (dd[0], dd[-1]):
                cx, cy = T(p); d.ellipse([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], fill=255)
    M = np.array(m) > 127
    if not M.any(): return None
    rp = ramp_n(pt.col) if pt.neutral else ramp(pt.col)
    if pt.shade:
        sg = pt.sig * S
        hgt = gaussian_filter(M.astype(np.float32), sg, mode='constant')
        gy, gx = np.gradient(hgt)
        k = sg * 2.2
        nx, ny, nz = -gx * k, -gy * k, np.ones_like(hgt)
        ln = np.sqrt(nx * nx + ny * ny + nz * nz); nx /= ln; ny /= ln; nz /= ln
        dd = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
        if getattr(pt, 'hair', False):   # sợi tóc: vân toả từ đỉnh đầu, mảnh và không đều
            yy, xx = np.mgrid[0:M.shape[0], 0:M.shape[1]].astype(np.float32)
            ys = np.where(M.any(1))[0]; xs = np.where(M.any(0))[0]
            ccx, ccy = xs.mean(), ys.min() - (ys.max() - ys.min()) * 0.15
            ang = np.arctan2(xx - ccx, yy - ccy)
            dd = dd + 0.085 * np.sin(ang * 46 + np.sin(ang * 9) * 2.0) + 0.04 * np.sin(ang * 97)
        hh, ww = M.shape
        if not getattr(pt, 'hair', False) and not pt.neutral and pt.sig >= 1.8 and M.sum() > 260 * S * S and hh > ww * 1.15:
            # nếp vải: áo dài, ống tay, ống quần dài -> vân dọc mềm, rủ xuống loe dần (không áp cho da, kim loại)
            yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
            u = (xx - ww / 2) / (S * (1.6 + 1.4 * yy / hh))
            dd = dd + 0.07 * np.sin(u * 1.9 + 0.6 * np.sin(yy / (S * 7))) * (0.35 + 0.65 * yy / hh)
        idx = np.digitize(dd, [0.1, 0.24, 0.38, 0.54, 0.69, 0.84])
        # viền sáng: mép bộ phận quay về phía đèn sáng thêm 1 cấp; mép khuất có ánh phản quang lạnh
        edge = M & ~binary_erosion(M, iterations=max(1, int(S * 0.6)))
        facing = nx * LIGHT[0] + ny * LIGHT[1]
        idx[edge & (facing > 0.18)] += 1
        np.clip(idx, 0, 6, out=idx)
        if pt.spec:
            rz = 2 * dd * nz - LIGHT[2]
            sp = np.clip(rz, 0, 1) ** 14 * pt.spec * 1.4
            idx[(sp > 0.42) & M] = 6
        rgb = rp[idx]
        back = edge & (facing < -0.32)
        if back.any(): rgb[back] = rgb[back] * 0.82 + np.array(RIM_HUE, np.float32) * 0.18
    else:
        rgb = np.broadcast_to(rp[2], M.shape + (3,)).copy()
    arr = np.zeros(M.shape + (4,), np.uint8)
    arr[..., :3] = rgb.astype(np.uint8); arr[..., 3] = 255
    img = Image.fromarray(arr, 'RGBA')
    if pt.marks:
        dr = Dr(img, x0, y0, rp, pt.rot)
        for fn in pt.marks: fn(dr)
        arr = np.array(img)
    if pt.ol:
        inner = M & ~binary_erosion(M, iterations=max(1, round(pt.ol * S / 4)))
        arr[inner, :3] = mix(pt.col, '#16161a' if pt.neutral else INK, 0.7)
    arr[~M, 3] = 0
    return (x0 * S, y0 * S, arr, M)


def composite(parts, want=False):
    """ghép các bộ phận theo chiều sâu; want=True trả thêm bộ đệm độ sâu Z và mặt nạ kim loại"""
    N = CELL * S
    C = np.zeros((N, N, 4), np.float32)
    Z = np.full((N, N), -1e9, np.float32) if want else None
    O = np.zeros((N, N), bool) if want else None
    for pt in sorted(parts, key=lambda p: p.depth):
        r = render_part(pt)
        if r is None: continue
        ox, oy, arr, M = r
        h, w = M.shape
        X0, Y0, X1, Y1 = max(0, ox), max(0, oy), min(N, ox + w), min(N, oy + h)
        if X0 >= X1 or Y0 >= Y1: continue
        sl = (slice(Y0 - oy, Y1 - oy), slice(X0 - ox, X1 - ox))
        Mc, Ac = M[sl], arr[sl]
        reg = C[Y0:Y1, X0:X1]
        # đổ bóng (lệch xuống-phải) lên các bộ phận đã vẽ phía sau
        sh = np.zeros_like(M); sh[S:, S:] = M[:-S, :-S]; sh &= ~M
        shc = sh[sl] & (reg[..., 3] > 0)
        reg[shc, :3] = reg[shc, :3] * 0.72 + np.array(SH_HUE, np.float32) * 0.28
        # bóng tiếp xúc mềm: vòng ngoài thứ 2 nhạt hơn (đổ bóng loang, nhìn có chiều sâu hơn)
        s2 = np.zeros_like(M); s2[2 * S:, 2 * S:] = M[:-2 * S, :-2 * S]; s2 &= ~M & ~sh
        s2c = s2[sl] & (reg[..., 3] > 0)
        reg[s2c, :3] = reg[s2c, :3] * 0.88 + np.array(SH_HUE, np.float32) * 0.12
        reg[Mc, :3] = Ac[Mc, :3]; reg[Mc, 3] = 1.0
        if want:
            Z[Y0:Y1, X0:X1][Mc] = pt.depth
            O[Y0:Y1, X0:X1][Mc] = pt.tag in ('metal', 'hmetal')
    return (C, Z, O) if want else C


def layer(parts, Z, metal_tags=('hmetal',)):
    """bộ phận rời (vũ khí, mũ): chỉ giữ chỗ nằm trước thân (so với bộ đệm Z), trả thêm mặt nạ kim loại"""
    N = CELL * S
    C = np.zeros((N, N, 4), np.float32); O = np.zeros((N, N), bool); ZL = np.full((N, N), -1e9, np.float32)
    for pt in sorted(parts, key=lambda p: p.depth):
        r = render_part(pt)
        if r is None: continue
        ox, oy, arr, M = r
        h, w = M.shape
        X0, Y0, X1, Y1 = max(0, ox), max(0, oy), min(N, ox + w), min(N, oy + h)
        if X0 >= X1 or Y0 >= Y1: continue
        sl = (slice(Y0 - oy, Y1 - oy), slice(X0 - ox, X1 - ox))
        vis = M[sl] & (pt.depth > Z[Y0:Y1, X0:X1])
        reg = C[Y0:Y1, X0:X1]
        reg[vis, :3] = arr[sl][vis, :3]; reg[vis, 3] = 1.0
        O[Y0:Y1, X0:X1][vis] = pt.tag in metal_tags
    return C, O


def masked_down(C, O):
    """lớp kim loại: lấy các điểm ảnh mà phần lớn là kim loại, không viền"""
    a = C[..., 3] * O
    pm = (C[..., :3] * a[..., None]).reshape(OUT, D, OUT, D, 3).mean((1, 3))
    A = a.reshape(OUT, D, OUT, D).mean((1, 3))
    out = np.zeros((OUT, OUT, 4), np.float32)
    on = A >= 0.5
    out[on, :3] = pm[on] / A[on][:, None]; out[on, 3] = 255
    return out


def downsample(C, soft=False):
    a = C[..., 3]
    pm = (C[..., :3] * a[..., None]).reshape(OUT, D, OUT, D, 3).mean((1, 3))
    A = a.reshape(OUT, D, OUT, D).mean((1, 3))
    rgb = pm / np.maximum(A, 1e-6)[..., None]
    out = np.zeros((OUT, OUT, 4), np.float32)
    if soft:
        out[..., :3] = rgb; out[..., 3] = A * 255; return out
    on = A >= 0.5
    out[on, :3] = rgb[on]; out[on, 3] = 255
    # viền ngoài theo màu kề bên (sel-out)
    ring = binary_dilation(on) & ~on
    acc = np.zeros((OUT, OUT, 3), np.float32); cnt = np.zeros((OUT, OUT), np.float32)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sr = np.roll(out, (dy, dx), (0, 1)); so = np.roll(on, (dy, dx), (0, 1))
        acc[so] += sr[so, :3]; cnt[so] += 1
    nb = acc / np.maximum(cnt, 1)[..., None]
    out[ring, :3] = nb[ring] * 0.22 + np.array(INK, np.float32) * 0.78
    out[ring, 3] = 255
    # vòng viền thứ 2 (ô xuất gấp đôi): giữ độ đậm nét viền như bản cũ, nhân vật vẫn nổi trên nền
    ring2 = binary_dilation(on | ring) & ~(on | ring)
    out[ring2, :3] = np.array(INK, np.float32); out[ring2, 3] = 255
    return out


def over(dst, src):
    a = src[..., 3:4] / 255.0; b = dst[..., 3:4] / 255.0
    oa = a + b * (1 - a)
    rgb = (src[..., :3] * a + dst[..., :3] * b * (1 - a)) / np.maximum(oa, 1e-6)
    return np.concatenate([rgb, oa * 255], -1)


class Fx:
    """lớp hiệu ứng (bán trong suốt, không viền)"""
    def __init__(self):
        self.im = Image.new('RGBA', (CELL * S, CELL * S), (0, 0, 0, 0)); self.d = ImageDraw.Draw(self.im, 'RGBA'); self.used = False
    def col(self, c, a): self.used = True; return hx(c) + (max(0, min(255, int(a * 255))),)
    def poly(self, pts, c, a): self.d.polygon([(x * S, y * S) for x, y in pts], fill=self.col(c, a))
    def ell(self, c, rx, ry, col, a): self.d.ellipse([(c[0] - rx) * S, (c[1] - ry) * S, (c[0] + rx) * S, (c[1] + ry) * S], fill=self.col(col, a))
    def ring(self, c, rx, ry, col, a, w=1.0): self.d.ellipse([(c[0] - rx) * S, (c[1] - ry) * S, (c[0] + rx) * S, (c[1] + ry) * S], outline=self.col(col, a), width=max(1, int(w * S)))
    def line(self, pts, col, a, w=1.0): self.d.line([(x * S, y * S) for x, y in pts], fill=self.col(col, a), width=max(1, int(w * S)))
    def glow(self, c, r, col, a):
        for i in range(6, 0, -1):
            rr = r * i / 6; self.ell(c, rr, rr, col, a * (1 - i / 7) * 0.55)
        self.ell(c, r * 0.22, r * 0.22, '#ffffff', min(1, a * 1.1))
    def px(self, x, y, col, a): self.d.rectangle([int(x) * S, int(y) * S, int(x) * S + S - 1, int(y) * S + S - 1], fill=self.col(col, a))
    def star(self, x, y, col, a, r=1):
        x, y = int(x), int(y)
        self.px(x, y, '#ffffff', a)
        for k in range(1, r + 1):
            for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)): self.px(x + dx, y + dy, col, a * (1 - k / (r + 1.5)))
    def out(self):
        arr = np.array(self.im).astype(np.float32)
        C = np.zeros((CELL * S, CELL * S, 4), np.float32); C[..., :3] = arr[..., :3]; C[..., 3] = arr[..., 3] / 255
        return downsample(C, soft=True)


# ================= vóc dáng =================
BODY = {
    'normal': dict(hip=54, torso=30, sw=9.8, hw=4.6, upper=17, fore=15, thigh=25, shin=25, ank=4, foot=7, neck=3.5, headr=7.5,
                   chest=(10, 6.4), waist=(8, 5.4), hipr=(9.2, 6.2), fem=False, arm=(4.0, 3.3), leg=(4.8, 3.6)),
    'slim':   dict(hip=54, torso=28, sw=8.4, hw=4.3, upper=16, fore=14, thigh=25, shin=25, ank=3.8, foot=6, neck=4, headr=7.2,
                   chest=(8.6, 6.2), waist=(6.4, 4.6), hipr=(8.8, 6.0), fem=True, arm=(3.4, 2.8), leg=(4.4, 3.2)),
    'heavy':  dict(hip=53, torso=31, sw=12, hw=5.4, upper=17.5, fore=15.5, thigh=24.5, shin=24.5, ank=4, foot=7.5, neck=3, headr=7.8,
                   chest=(13, 8.2), waist=(11, 7.2), hipr=(11.2, 7.4), fem=False, arm=(4.8, 4.0), leg=(5.6, 4.2)),
}
# thu nhỏ thân ~7% để đầu to hơn một chút (khoảng 6 đầu), dễ nhìn mặt hơn ở cỡ nhỏ
for _b in BODY.values():
    for _k in ('hip', 'torso', 'sw', 'hw', 'upper', 'fore', 'thigh', 'shin', 'foot'): _b[_k] = round(_b[_k] * 0.93, 2)

# ================= trang phục 9 môn phái =================
LOOKS = {
    'vodang': dict(name='Võ Đang', body='normal', skin='#f3c9a4', robe='#eef2f8', robe2='#bccbe6', trim='#2f4f9a', belt='#2f4f9a',
                   pants='#4a5574', shoe='#24232f', hair='#1e1a26', hairstyle='topknot', longhair=True, length='long', sleeve='wide',
                   weapon='sword', blade='#dfe8f4', hilt='#3a2a20', guard='#c9a24a', tassel='#3d6ad8', glow='#8fc8ff', emblem='taiji', sash=True,
                   inner=True, motif='cloud', pendant='#3d6ad8', bootcuff='#eef2f8', cape='#2f4f9a'),
    'ngamy': dict(name='Nga My', body='slim', skin='#f7d0b2', robe='#fbeaf0', robe2='#f2b0c8', trim='#d6457e', belt='#d6457e',
                  pants='#f0b8cc', shoe='#8a2f58', hair='#2a1a24', hairstyle='buns', longhair=True, frontlocks=True, length='long',
                  sleeve='wide', weapon='sword', blade='#f2f0fa', guard='#e8b8d0', hilt='#7a2a50', tassel='#ff7ab0', glow='#ff8cc6',
                  sash=True, hairribbon='#ff6aa6',
                   inner=True, motif='plum', pendant='#ff6aa6', cape='#d6457e'),
    'thuyyen': dict(name='Thúy Yên', body='slim', skin='#f7d0b2', robe='#3e70c8', robe2='#a8d2ff', trim='#e4f2ff', belt='#1d3572',
                    pants='#25407a', shoe='#16203c', hair='#141a34', hairstyle='ponytail', length='long', sleeve='tight',
                    weapon='daggers', blade='#e2f0ff', guard='#9ac8f0', hilt='#1d3572', glow='#7cdcff', shawl='#d4ebff', bracer='#1d3572',
                   inner=True, motif='wave', pendant='#7cdcff', cape='#1d3572'),
    'thieulam': dict(name='Thiếu Lâm', body='normal', skin='#e9b98f', robe='#efa132', robe2='#d27a20', trim='#8a3a18', belt='#8a3a18',
                     pants='#f1e0b4', shoe='#4a2c20', hair=None, hairstyle='bald', length='mid', sleeve='wide', weapon='staff',
                     wood='#8a5a2c', metal='#e0b040', glow='#ffd84a', kasaya='#b23a1c', beads=True, wraps=True,
                   motif='grid', cape='#b23a1c'),
    'thienvuong': dict(name='Thiên Vương', body='heavy', skin='#e6b48a', robe='#c42a22', robe2='#7a1814', trim='#f0bc4a', belt='#3a2418',
                       pants='#3a2a2e', shoe='#2a1a16', hair='#2a1a12', hairstyle='warrior', beard='full', length='mid', sleeve='tight',
                       weapon='hammer', wood='#4a2e1c', metal='#e8b448', steel='#a9b4c6', glow='#ff7030', armor=True, headband='#e0302a',
                   motif='dots', cape='#7a1814'),
    'duongmon': dict(name='Đường Môn', body='normal', skin='#efc4a0', robe='#2f6e3c', robe2='#1b3a24', trim='#121a16', belt='#5a4128',
                     pants='#1d2a20', shoe='#141814', hair='#121216', hairstyle='hat', mask='#18241c', length='mid', sleeve='tight',
                     weapon='knife', blade='#e6efe8', hilt='#2a2a2a', guard='#8a8a80', glow='#a8ff7c', bracer='#5a4128', straw='#a08a52', pouches=True,
                   bandolier=True, cape='#1b3a24'),
    'ngudoc': dict(name='Ngũ Độc', body='normal', skin='#e9bf98', robe='#5c2484', robe2='#2c1444', trim='#9ee04e', belt='#2c1444',
                   pants='#361852', shoe='#1c1424', hair='#18121e', hairstyle='turban', veil='#43195e', silver='#d4dce6', length='mid',
                   sleeve='tight', weapon='saber', blade='#c8e8c0', hilt='#2c1444', guard='#d4dce6', glow='#90ff4c', braid=True,
                   motif='coin', sleeveband=True, cape='#2c1444'),
    'caibang': dict(name='Cái Bang', body='heavy', skin='#dca67a', robe='#c9bea9', robe2='#8a7a66', trim='#7a5e44', belt='#6a4a30',
                    pants='#9a6436', shoe='#8a6a3a', hair='#3a2618', hairstyle='messy', length='short', sleeve='short', weapon='palm',
                    glow='#ffc84a', scarf='#e8892a', gourd='#c87a2a', stick='#6aa040', patches=True, barefoot=True, beard='stubble',
                   rope=True, cape='#8a6a3a'),
    'conlon': dict(name='Côn Lôn', body='normal', skin='#f0c6a0', robe='#f2c24e', robe2='#5b2e80', trim='#5b2e80', belt='#5b2e80',
                   pants='#4a2a5a', shoe='#24142c', hair='#1e1426', hairstyle='official', longhair=True, length='long', sleeve='wide',
                   sleevecol='#5b2e80', weapon='sword', blade='#efe2a8', guard='#5b2e80', hilt='#3a1e4a', tassel='#e8402a', glow='#d8a4ff',
                   emblem='bagua', talisman=True, mustache=True,
                   inner=True, motif='trigram', pendant='#f2c24e', cape='#5b2e80'),
}


# ================= khung xương =================
def solve(B, P):
    J = {}
    root = V(*P['root'])
    hip = root + V(0, 0, B['hip'])
    Rp = yaw(P['hipyaw'])
    Rt = yaw(P['twist']) @ pitch(P['lean']) @ roll(P['side'])
    J['Rp'], J['Rt'] = Rp, Rt
    J['pelvis'] = hip
    T = lambda v: hip + Rt @ V(*v)
    br = P['breath']
    J['waist'] = T((0, 0, 9)); J['chest'] = T((0, 0, 19 + br * 0.4)); J['neck'] = T((0, 0, B['torso'] + br * 0.3))
    hp_, hy_ = P['head']
    Rh = Rt @ yaw(hy_) @ pitch(hp_)
    J['Rh'] = Rh
    J['head'] = J['neck'] + Rt @ V(0, 0.4, B['neck']) + Rh @ V(0, 0.3, B['headr'])
    for side, k in ((1, 'R'), (-1, 'L')):
        J['sh' + k] = T((side * B['sw'], -0.3, B['torso'] - 2.6 + br * 0.6))
    def arm_ang(k, side):
        a, b, e = P['arm' + k]
        d1 = Rt @ limb(a, b, side); d2 = Rt @ limb(a + e, b, side)
        el = J['sh' + k] + d1 * B['upper']; return el, el + d2 * B['fore']
    def arm_ik(k, side, tgt):
        return ik(J['sh' + k], tgt, B['upper'], B['fore'], Rt @ nrm(V(side * 0.9, -0.5, -1.0)))
    def set_arm(k, el, ha):
        J['el' + k], J['ha' + k] = el, ha
        J['fa' + k] = nrm(ha - el); J['palm' + k] = ha + J['fa' + k] * 2.2
    if P.get('ikR') is not None: set_arm('R', *arm_ik('R', 1, J['chest'] + Rt @ V(*P['ikR'])))
    else: set_arm('R', *arm_ang('R', 1))
    J['wdR'] = Rt @ adir(*P['wR'])
    tgt = J['chest'] + Rt @ V(*P['ikL']) if P.get('ikL') is not None else None
    if P['gripw'] > 0.001:
        g = J['palmR'] + J['wdR'] * P['grip']
        g = g - nrm(g - J['shL']) * 2.2
        if tgt is None: tgt = arm_ang('L', -1)[1]
        tgt = tgt + (g - tgt) * P['gripw']
    if tgt is not None: set_arm('L', *arm_ik('L', -1, tgt))
    else: set_arm('L', *arm_ang('L', -1))
    J['wdL'] = Rt @ adir(*P['wL'])
    for side, k in ((1, 'R'), (-1, 'L')):
        J['hp' + k] = hip + Rp @ V(side * B['hw'], 0, 0)
        la, lk, lb = P['leg' + k]
        d1 = Rp @ limb(la, lb, side)
        sh = P.get('shin' + k)   # hướng cẳng chân riêng (a, b) khi cần gập vào trong (ngồi kiết già)
        d2 = Rp @ (limb(sh[0], sh[1], side) if sh else limb(la - lk, lb, side))
        J['kn' + k] = J['hp' + k] + d1 * B['thigh']; J['an' + k] = J['kn' + k] + d2 * B['shin']
        fp = P['foot' + k]
        fd = Rp @ V(0, math.cos(fp), math.sin(fp))
        sole = J['an' + k] + V(0, 0, -B['ank'])
        J['heel' + k] = sole - fd * 2.0; J['toe' + k] = sole + fd * B['foot']
    pts = [k for k, v in J.items() if isinstance(v, np.ndarray) and v.shape == (3,) and not k.startswith(('wd', 'fa'))]
    # ngã: xoay cả người quanh chân (sang ngang khi nhìn trước/sau, ngửa ra sau khi nhìn nghiêng)
    fa = P.get('fall', 0)
    if fa > 0.001:
        Rf = roll(fa) if P.get('fallmode') == 'side' else np.array([[1., 0, 0], [0, math.cos(fa), -math.sin(fa)], [0, math.sin(fa), math.cos(fa)]])
        piv = (J['anR'] + J['anL']) / 2; piv[2] = 0
        for k in pts: J[k] = piv + Rf @ (J[k] - piv)
        for k in ('Rt', 'Rh', 'Rp'): J[k] = Rf @ J[k]
        for k in ('wdR', 'wdL', 'faR', 'faL'): J[k] = Rf @ J[k]
        cen = sum(J[k] for k in pts) / len(pts)
        sh_ = V(piv[0] - cen[0], piv[1] - cen[1], 0) * min(1, fa / 1.4)
        for k in pts: J[k] = J[k] + sh_
    soles = min(J[k][2] for k in ('heelR', 'heelL', 'toeR', 'toeL'))
    body = min(J[k][2] for k in pts if not k.startswith(('heel', 'toe')))
    dz = P['lift'] if P.get('air') else max(-soles, 3.0 - body) + P['lift']
    for k in pts: J[k] = J[k] + V(0, 0, dz)
    return J


# ================= tư thế & hoạt ảnh =================
def base_pose(L):
    w = L['weapon']
    P = dict(root=(0, 0, 0), lean=0.02, side=0.0, twist=0.0, hipyaw=0.0, head=(0.03, 0.0), breath=0.0,
             armR=(0.06, 0.14, 0.3), armL=(0.06, 0.14, 0.3), legR=(0.03, 0.07, 0.07), legL=(-0.03, 0.07, 0.07),
             footR=0.0, footL=0.0, lift=0.0, wR=(0.25, -1.0), wL=(-0.25, -1.0), grip=0.0, gripw=0.0, fall=0.0,
             ikR=None, ikL=None, openR=0.0, openL=0.0)
    if w in ('sword', 'saber'): P.update(armR=(0.16, 0.2, 0.55), wR=(0.3, -0.95))
    if L['name'] == 'Võ Đang': P.update(ikL=(3, -8.5, -9))       # tay trái chắp sau lưng
    if w == 'daggers': P.update(armR=(0.12, 0.22, 0.55), wR=(0.45, -1.1), armL=(0.12, 0.22, 0.55), wL=(-0.45, -1.1))
    if w in ('staff', 'cane', 'spear'): P.update(armR=(0.3, 0.24, 0.55), wR=(0.05, 1.4), armL=(0.12, 0.14, 0.5))
    if w == 'cane': P.update(armR=(0.34, 0.26, 0.42), wR=(0.08, 1.45), lean=0.06, head=(0.1, 0.0))
    if w == 'hammer': P.update(armR=(0.2, 0.3, 0.25), wR=(0.35, -1.35))
    if w == 'knife': P.update(armR=(0.1, 0.2, 0.45), wR=(0.3, -1.25))
    if w == 'palm': P.update(armL=(-0.4, 0.12, 1.7))
    return P

def lerp(a, b, u):
    if a is None or b is None: return a if u < 0.5 else b
    if isinstance(a, (tuple, list)): return tuple(x + (y - x) * u for x, y in zip(a, b))
    if isinstance(a, (int, float)): return a + (b - a) * u
    return a if u < 0.5 else b

def keyed(keys, t):
    if t <= keys[0][0]: return dict(keys[0][1])
    for (t0, a), (t1, b) in zip(keys, keys[1:]):
        if t <= t1:
            u = (t - t0) / (t1 - t0) if t1 > t0 else 1
            u = u * u * (3 - 2 * u)
            return {k: lerp(a[k], b.get(k, a[k]), u) for k in a}
    return dict(keys[-1][1])

def fill_keys(base, keys):
    out, cur = [], dict(base)
    for t, d in keys:
        cur = dict(cur); cur.update(d); out.append((t, cur))
    return out

def hand_local(B, P, k):
    J = solve(B, P); return tuple(J['Rt'].T @ (J['ha' + k] - J['chest']))

WIND = dict(legL=(0.14, 0.28, 0.08), legR=(-0.12, 0.26, 0.08))
LUNGE = dict(legL=(0.52, 0.42, 0.08), legR=(-0.4, 0.12, 0.09), footR=-0.25, root=(0, 5, 0))

def attack_keys(L, base0):
    w = L['weapon']
    if w in ('sword',):
        return [(0, base0),
                (0.25, dict(twist=-0.6, lean=-0.03, hipyaw=-0.25, head=(0.05, 0.25), ikR=(9, -3, 13), wR=(2.6, 0.85), ikL=(-6, 11, 4), **WIND)),
                (0.36, dict(twist=-0.65, ikR=(10, -4, 15), wR=(2.75, 0.95))),
                (0.47, dict(twist=0.1, lean=0.1, hipyaw=0.1, ikR=(7, 15, 5), wR=(0.6, 0.15), ikL=(-10, 0, 3))),
                (0.56, dict(twist=0.55, lean=0.18, hipyaw=0.3, head=(0.1, -0.2), ikR=(-7, 15, -6), wR=(-0.75, -0.45), ikL=(-13, -6, 2), **LUNGE)),
                (0.72, dict(twist=0.6, ikR=(-9, 12, -8), wR=(-1.0, -0.6))),
                (1.0, base0)]
    if w == 'daggers':
        return [(0, base0),
                (0.22, dict(lean=0.18, twist=-0.2, ikR=(-2, 9, 3), wR=(-1.3, 0.35), ikL=(2, 10, 5), wL=(1.3, 0.35), legL=(0.15, 0.55, 0.12), legR=(-0.15, 0.55, 0.12))),
                (0.4, dict(twist=0.4, lean=0.22, ikR=(12, 16, -1), wR=(1.1, -0.15), ikL=(-2, 8, 6), **LUNGE)),
                (0.55, dict(twist=-0.45, ikL=(-12, 16, -1), wL=(-1.1, -0.15), ikR=(5, 4, 2), wR=(0.4, 0.3))),
                (0.72, dict(twist=-0.3, ikL=(-13, 13, -4), wL=(-1.3, -0.3))),
                (1.0, base0)]
    if w == 'staff':
        return [(0, base0),
                (0.24, dict(twist=-0.75, hipyaw=-0.3, lean=0.02, ikR=(10, 6, 1), wR=(2.1, 0.05), grip=-16, gripw=1.0, **WIND)),
                (0.36, dict(twist=-0.85, ikR=(11, 4, 1), wR=(2.35, 0.08))),
                (0.48, dict(twist=0.0, lean=0.1, ikR=(4, 15, -1), wR=(0.2, 0.0))),
                (0.58, dict(twist=0.7, hipyaw=0.35, lean=0.12, ikR=(-4, 13, -1), wR=(-1.35, -0.05), **LUNGE)),
                (0.76, dict(twist=0.75, ikR=(-5, 11, 0), wR=(-1.55, 0.0))),
                (1.0, dict(base0, gripw=0.0))]
    if w == 'hammer':
        return [(0, base0),
                (0.3, dict(lean=-0.15, twist=-0.15, ikR=(3, 0, 19), wR=(0.0, 2.1), grip=-7, gripw=1.0, legL=(0.15, 0.15, 0.1), legR=(-0.1, 0.15, 0.1))),
                (0.42, dict(lean=-0.2, ikR=(2, -1, 21), wR=(0.0, 2.3))),
                (0.54, dict(lean=0.32, twist=0.1, ikR=(1, 16, -6), wR=(0.0, -0.75), **dict(LUNGE, legL=(0.55, 0.6, 0.1)))),
                (0.68, dict(lean=0.34)),
                (1.0, dict(base0, gripw=0.0))]
    if w == 'knife':
        return [(0, base0),
                (0.25, dict(twist=-0.55, ikR=(9, -4, 12), wR=(0.0, 2.0), ikL=(-3, 14, 5), **WIND)),
                (0.4, dict(twist=-0.6, ikR=(10, -5, 13))),
                (0.5, dict(twist=0.4, lean=0.15, ikR=(-1, 18, 5), wR=(0.0, 0.1), ikL=(-11, 0, 2), openR=1.0, **LUNGE)),
                (0.7, dict(twist=0.45, ikR=(-3, 16, 0), wR=(0.0, -0.5))),
                (1.0, base0)]
    if w == 'saber':
        return [(0, base0),
                (0.24, dict(twist=-0.8, hipyaw=-0.3, ikR=(11, 0, 6), wR=(2.3, 0.3), ikL=(-5, 10, 3), **WIND)),
                (0.36, dict(twist=-0.85, ikR=(12, -1, 7))),
                (0.48, dict(twist=0.1, lean=0.12, ikR=(6, 16, 2), wR=(0.3, 0.0))),
                (0.58, dict(twist=0.7, hipyaw=0.35, lean=0.16, ikR=(-8, 13, 0), wR=(-1.3, -0.15), ikL=(-12, -4, 3), **LUNGE)),
                (0.76, dict(twist=0.75, ikR=(-10, 10, -2), wR=(-1.6, -0.2))),
                (1.0, base0)]
    # chưởng (Cái Bang)
    return [(0, base0),
            (0.28, dict(twist=-0.6, ikR=(7, -5, 1), ikL=(-3, 13, 7), openL=1.0, **WIND)),
            (0.4, dict(twist=-0.65, ikR=(8, -6, 1))),
            (0.5, dict(twist=0.45, lean=0.14, ikR=(0, 23, 4), ikL=(-9, 2, 0), openR=1.0, **LUNGE)),
            (0.68, dict(twist=0.5, ikR=(0, 22, 4))),
            (1.0, base0)]

def cast_keys(L, base0):
    w = L['weapon']
    if w == 'staff':   # tay phải giữ thiền trượng, tay trái niệm Phật
        return [(0, base0),
                (0.3, dict(ikL=(-1, 10, 4), openL=1.0, head=(0.15, 0))),
                (0.55, dict(ikL=(-1, 11, 6), lean=0.05, head=(0.2, 0), breath=1.0)),
                (0.8, dict(ikL=(-1, 10, 5))),
                (1.0, base0)]
    k = [(0, base0),
         (0.28, dict(ikR=(2, 10, 3), ikL=(-2, 10, 3), wR=(0.1, 1.35), wL=(-0.1, 1.35), lean=0.03, openL=1.0, openR=1.0 if w == 'palm' else 0.0)),
         (0.5, dict(ikR=(9, 6, 21), ikL=(-9, 6, 21), lean=-0.08, head=(-0.25, 0), breath=1.0)),
         (0.62, dict(ikR=(10, 6, 22), ikL=(-10, 6, 22))),
         (0.8, dict(ikR=(6, 17, 5), ikL=(-6, 17, 5), lean=0.1, head=(0.05, 0))),
         (1.0, base0)]
    if w == 'hammer': k[1][1].update(wR=(0.0, 1.45))
    return k

RIDE_PELVIS = 29.0      # khi cưỡi: hông ở độ cao này (y = 99 trong ô 144 -> 66 trong ô 96 như game)

def anim_pose(L, B, name):
    if name.startswith('ride'):   # ngồi trên yên: giữ thân trên của động tác gốc, chân kẹp hai bên
        base_name = {'ride': 'idle', 'ride_attack': 'attack', 'ride_cast': 'cast', 'ride_hurt': 'hurt'}[name]
        f0 = _anim_pose(L, B, base_name)
        def f(t):
            P = dict(f0(t))
            bob = math.cos(TAU * t) * 1.2 if name == 'ride' else 0.0
            P.update(legR=(1.32, 1.62, 0.36), legL=(1.32, 1.62, 0.36), footR=-0.25, footL=-0.25, air=True, hipyaw=0.0,
                     root=(0.0, 0.0, RIDE_PELVIS - B['hip'] + bob), lift=0.0, fall=0.0)
            P['lean'] = P['lean'] + 0.05
            if name == 'ride': P['breath'] = 0.5 + 0.5 * math.sin(TAU * t)
            return P
        return f
    return _anim_pose(L, B, name)

def _anim_pose(L, B, name):
    base = base_pose(L)
    w = L['weapon']
    armed = {'R'} if w in ('sword', 'saber', 'staff', 'hammer', 'knife') else ({'R', 'L'} if w == 'daggers' else set())
    if L['name'] == 'Võ Đang': armed = armed | {'L'}
    if name == 'idle':
        def f(t):
            P = dict(base); b = math.sin(TAU * t)
            P['breath'] = b * 0.5 + 0.5
            P['lean'] = base['lean'] + 0.012 * b
            P['side'] = 0.014 * math.sin(TAU * t + 0.6)
            P['head'] = (base['head'][0] - 0.03 * b, 0.04 * math.sin(TAU * t + 1.2))
            for k in ('R', 'L'):
                if k not in armed:
                    a = base['arm' + k]; P['arm' + k] = (a[0] + 0.04 * b, a[1] + 0.02 * b, a[2] + 0.05 * b)
            return P
        return f
    if name == 'meditate':   # ngồi kiết già: đùi xoè ngang, cẳng chân gập vào trong, hai tay kết ấn trước bụng
        def f(t):
            P = dict(base); b = math.sin(TAU * t)
            P.update(legR=(1.5, 0.0, 0.95), legL=(1.5, 0.0, 0.95), shinR=(1.5, -1.2), shinL=(1.45, -1.25), footR=-0.6, footL=-0.6, air=True, lift=0.0,
                     root=(0.0, 0.0, 6.5 - B['hip'] + 0.25 * b), hipyaw=0.0, twist=0.0, side=0.0,
                     lean=0.03 + 0.015 * b, head=(0.12 - 0.03 * b, 0.0), breath=0.5 + 0.5 * b,
                     ikR=(2.6, 8.5, -15.5), ikL=(-2.6, 8.5, -15.5), gripw=0.0, openR=0.0, openL=0.0)
            P['wR'] = (1.57, 0.05); P['wL'] = (-1.57, 0.05)   # binh khí đặt nằm ngang trên đùi
            return P
        return f
    if name in ('walk', 'run'):
        run = name == 'run'
        def f(t):
            P = dict(base); ph = TAU * t
            for k, off in (('R', 0.0), ('L', math.pi)):
                s, c = math.sin(ph + off), math.cos(ph + off)
                if run:
                    thigh = 0.74 * s - 0.06; knee = 0.28 + 1.5 * max(0, c) ** 1.2 + 0.2 * max(0, s)
                    foot = 0.3 * s - 0.35 * max(0, c) * max(0, -s)
                else:
                    thigh = 0.4 * s; knee = 0.07 + 0.75 * max(0, c) ** 1.4 + 0.1 * max(0, s) * max(0, -c)
                    foot = 0.24 * s - 0.3 * max(0, c) * max(0, -s)
                P['leg' + k] = (thigh, knee, 0.06); P['foot' + k] = foot
            for k, sg in (('R', -1), ('L', 1)):
                s = math.sin(ph)
                if k in armed:
                    a = base['arm' + k]
                    if run and w in ('sword', 'saber', 'daggers', 'knife'):   # chạy kiểu kiếm khách: tay cầm binh khí kéo ra sau
                        P['arm' + k] = (-0.75 + 0.08 * s * sg, 0.3, 0.35)
                        P['w' + k] = ((math.pi - 0.35) * (1 if k == 'R' else -1), -0.25)
                    elif w == 'staff' and k == 'R':
                        P['armR'] = (0.4 + 0.1 * s * sg, 0.24, 0.9); P['wR'] = (0.0, 0.25 if run else 1.0)
                    else:
                        P['arm' + k] = (a[0] + 0.1 * s * sg, a[1], a[2])
                else:
                    amp = 0.78 if run else 0.34
                    P['arm' + k] = (amp * s * sg + (0.15 if run else 0.04), 0.16, (1.45 if run else 0.32) + 0.2 * max(0, s * sg))
            P['twist'] = -(0.16 if run else 0.08) * math.sin(ph)
            P['hipyaw'] = (0.14 if run else 0.1) * math.sin(ph)
            c2 = math.cos(2 * ph)   # nhịp nhún: 2 lần mỗi chu kỳ bước
            P['lean'] = (0.26 + 0.03 * c2) if run else (0.045 + 0.01 * c2)
            P['side'] = 0.02 * math.sin(ph)
            # đầu gật nhẹ theo nhịp bước và xoay ngược chiều vai để mắt luôn nhìn thẳng
            P['head'] = ((-0.12 + 0.04 * c2) if run else (0.02 + 0.025 * c2), (0.06 if run else 0.05) * math.sin(ph))
            P['breath'] = (0.6 + 0.4 * c2) if run else (0.3 + 0.2 * c2)
            P['root'] = (0.7 * math.sin(ph), 0, 0)
            if run: P['lift'] = 3.0 * max(0, -math.cos(2 * ph))
            return P
        return f
    base0 = dict(base, ikR=hand_local(B, base, 'R'), ikL=hand_local(B, base, 'L'))
    if name == 'attack': keys = fill_keys(base0, attack_keys(L, base0))
    elif name == 'cast': keys = fill_keys(base0, cast_keys(L, base0))
    elif name == 'hurt':
        keys = fill_keys(base0, [(0, base0),
                                 (0.35, dict(lean=-0.28, twist=0.15, head=(-0.4, 0.1), root=(0, -4, 0), ikR=(15, 2, 4), ikL=(-15, 2, 4),
                                             legL=(0.1, 0.35, 0.1), legR=(-0.1, 0.35, 0.1), openL=1.0)),
                                 (0.7, dict(lean=-0.15, head=(-0.2, 0))),
                                 (1.0, base0)])
    else:   # death
        keys = fill_keys(base0, [(0, dict(lean=-0.25, head=(-0.4, 0), ikR=(15, 2, 4), ikL=(-15, 2, 4))),
                                 (0.25, dict(lean=0.25, head=(0.3, 0), legL=(0.5, 1.3, 0.12), legR=(0.3, 1.0, 0.1), ikR=(8, 8, -10), ikL=(-8, 8, -10))),
                                 (0.55, dict(fall=0.9, lean=0.1, head=(-0.3, 0))),
                                 (0.8, dict(fall=1.45, ikR=(16, -2, 6), ikL=(-16, 0, 8), legL=(0.3, 0.4, 0.15), legR=(0.1, 0.2, 0.12), head=(-0.5, 0.3), openL=1.0, openR=1.0)),
                                 (1.0, dict(fall=1.5))])
    return lambda t: keyed(keys, t)

ANIMS = [('idle', 8, 1.6, True), ('walk', 12, 0.8, True), ('run', 12, 0.56, True), ('attack', 12, 0.62, False),
         ('ride', 4, 0.44, True), ('ride_attack', 8, 0.62, False), ('ride_cast', 8, 0.9, False), ('ride_hurt', 3, 0.3, False),
         ('cast', 12, 0.9, False), ('hurt', 4, 0.3, False), ('death', 8, 0.9, False), ('meditate', 8, 2.6, True)]
DIAG_ANIMS = {'idle', 'walk', 'run'}   # động tác có thêm 2 hướng chéo
COLS = 8                               # số cột của sheet; động tác > 8 khung xuống dòng (mỗi hướng ceil(n / 8) hàng)
FRAME_T = {'attack': [0, .1, .2, .28, .35, .41, .46, .5, .56, .66, .78, .9], 'cast': [0, .08, .16, .24, .32, .4, .48, .56, .64, .74, .84, .96],
           'ride_attack': [0, .16, .3, .42, .5, .6, .76, .9], 'ride_cast': [0, .14, .28, .42, .56, .7, .84, .96], 'ride_hurt': [0, .35, .7],
           'hurt': [0, .25, .5, .75], 'death': [0, .13, .26, .4, .55, .7, .85, 1.0]}


# ================= vải / tóc mô phỏng =================
def chains_for(L, B):
    C = []
    hemU = {'long': 10, 'mid': 28, 'short': 44}[L['length']]
    hl = (B['hip'] + 9) - hemU
    C.append(dict(name='hem', anchor=('torso', (0, 0, 9)), n=2, seg=hl / 2, rest=(0, 0, -1), frame='world', stiff=0.1, damp=4.0, side=0))
    if L['sleeve'] == 'wide':
        for k in 'RL': C.append(dict(name='dr' + k, anchor=('pt', 'ha' + k, (0, 0, 0)), n=1, seg=5.5, rest=(0, -0.2, -1), frame='world', stiff=0.04, damp=3.0, side=0))
    hc = L.get('hair')
    if L.get('longhair'):
        C.append(dict(name='hair', anchor=('head', (0, -5.2, -1.5)), n=5, seg=5.4, rest=(0, -0.25, -1), frame='head', stiff=0.07, damp=3.5, side=-1, w=(10, 4), col=hc, kind='hair'))
    if L['hairstyle'] == 'ponytail':
        C.append(dict(name='pony', anchor=('head', (0, -5.8, 5.2)), n=6, seg=5.2, rest=(0, -0.5, -1), frame='head', stiff=0.05, damp=3.0, side=-1, w=(6.5, 2.2), col=hc, kind='hair'))
    if L.get('frontlocks'):
        for k, s in (('R', 1), ('L', -1)):
            C.append(dict(name='lock' + k, anchor=('head', (s * 5.4, 1.0, -3)), n=3, seg=4.6, rest=(s * 0.05, 0.3, -1), frame='head', stiff=0.09, damp=3.5, side=0, w=(3.2, 1.6), col=hc, kind='hair'))
    if L.get('hairribbon'):
        for k, s in (('R', 1), ('L', -1)):
            C.append(dict(name='hr' + k, anchor=('head', (s * 5.0, -1.5, 6.5)), n=4, seg=4.2, rest=(s * 0.3, -0.4, -1), frame='head', stiff=0.03, damp=2.5, side=-1, w=(2.4, 1.8), col=L['hairribbon'], kind='ribbon'))
    if L.get('sash'):
        for k, s in (('R', 1), ('L', -1)):
            C.append(dict(name='sash' + k, anchor=('torso', (s * 1.6 - 1.5, B['waist'][1] + 1.6, 8.5)), n=4, seg=4.6, rest=(s * 0.1, 0.12, -1), frame='torso', stiff=0.04, damp=2.8, side=1, w=(2.8, 2.2), col=L['belt'], kind='ribbon'))
    if L.get('headband'):
        for k, s in (('R', 1), ('L', -1)):
            C.append(dict(name='hb' + k, anchor=('head', (s * 1.2, -6.6, 3.6)), n=4, seg=4.6, rest=(s * 0.25, -0.7, -0.8), frame='head', stiff=0.03, damp=2.5, side=-1, w=(2.6, 1.8), col=L['headband'], kind='ribbon'))
    if L.get('shawl'):
        for k, s in (('R', 1), ('L', -1)):
            C.append(dict(name='sw' + k, anchor=('torso', (s * (B['sw'] - 0.5), -3.5, B['torso'] - 3.5)), n=6, seg=6.0, rest=(s * 0.25, -0.5, -1), frame='torso', stiff=0.02, damp=2.2, side=-1, w=(4.2, 3.0), col=L['shawl'], kind='ribbon'))
    if L.get('scarf'):
        C.append(dict(name='scarf', anchor=('torso', (2.0, -4.5, B['torso'] - 1.5)), n=3, seg=5.0, rest=(0.2, -0.5, -1), frame='torso', stiff=0.04, damp=2.8, side=-1, w=(4.0, 2.6), col=L['scarf'], kind='ribbon'))
    if L.get('braid'):
        C.append(dict(name='braid', anchor=('head', (0, -5.6, -2.0)), n=5, seg=5.0, rest=(0, -0.2, -1), frame='head', stiff=0.06, damp=3.2, side=-1, w=(3.8, 2.2), col=hc, kind='braid'))
    if L['hairstyle'] == 'official':
        for k, s in (('R', 1), ('L', -1)):
            C.append(dict(name='hat' + k, anchor=('head', (s * 2.0, -6.2, 6.5)), n=4, seg=5.0, rest=(s * 0.2, -0.5, -1), frame='head', stiff=0.03, damp=2.5, side=-1, w=(2.2, 1.6), col=L['robe2'], kind='ribbon'))
    if L['hairstyle'] == 'messy':
        C.append(dict(name='tail', anchor=('head', (0, -6.2, 1.5)), n=2, seg=4.2, rest=(0, -0.6, -1), frame='head', stiff=0.06, damp=3.0, side=-1, w=(4.4, 2.2), col=hc, kind='hair'))
    if L.get('pendant'):
        C.append(dict(name='pend', anchor=('torso', (B['waist'][0] * 0.55 + 1, B['waist'][1] + 1.6, 7)), n=3, seg=3.4, rest=(0, 0.1, -1), frame='torso', stiff=0.05, damp=3.0, side=1, w=(1, 1), col=L.get('cord', '#d8b860'), col2=L['pendant'], kind='pendant'))
    for k, s_ in (('R', 1), ('L', -1)):   # áo choàng (chỉ hiện ở thần giáp)
        C.append(dict(name='cape' + k, anchor=('torso', (s_ * (B['sw'] - 3.2), -B['chest'][1] - 1.5, B['torso'] - 3)), n=6, seg=6.4, rest=(s_ * 0.12, -0.35, -1), frame='torso', stiff=0.03, damp=2.4, side=-1, w=(9, 12), col=L.get('cape', L['robe2']), kind='cape', need='cape'))
    if L.get('tassel'):
        C.append(dict(name='tassel', anchor=('wpn', 'R', -5.6), n=3, seg=3.2, rest=(0, 0, -1), frame='world', stiff=0.02, damp=2.5, side=0, w=(2.4, 1.2), col=L['tassel'], kind='tassel'))
    return C

def anchor_of(J, a):
    if a[0] == 'head': return J['head'] + J['Rh'] @ V(*a[1])
    if a[0] == 'torso': return J['pelvis'] + J['Rt'] @ V(*a[1])
    if a[0] == 'pt': return J[a[1]] + V(*a[2])
    return J['palm' + a[1]] + J['wd' + a[1]] * a[2]

def rest_of(J, d):
    r = V(*d['rest'])
    if d['frame'] == 'head': r = J['Rh'] @ r
    elif d['frame'] == 'torso': r = J['Rt'] @ r
    return nrm(r)

def simulate(defs, Js, times, speed, loop, dur):
    res = {d['name']: [None] * len(Js) for d in defs}
    if not defs: return res
    G = 620.0; nF = len(Js); SUB = 8
    off = lambda tt: V(0, speed * tt, 0)
    A = [[anchor_of(J, d['anchor']) for d in defs] for J in Js]
    Rr = [[rest_of(J, d) for d in defs] for J in Js]
    fw = [J['Rt'] @ V(0, 1, 0) for J in Js]
    st = []
    for j, d in enumerate(defs):
        p0 = A[0][j] + off(times[0])
        pts = np.array([p0 + Rr[0][j] * d['seg'] * i for i in range(d['n'] + 1)])
        st.append([pts, pts.copy()])
    seq = []
    if loop:
        for c in range(3):
            for i in range(nF):
                t0 = times[i] + c * dur; t1 = (times[i + 1] if i + 1 < nF else dur) + c * dur
                seq.append((i, (i + 1) % nF, t0, t1, c == 2))
    else:
        seq.append((0, 0, times[0] - 0.8, times[0], False))
        for i in range(nF - 1): seq.append((i, i + 1, times[i], times[i + 1], True))
    def record(i, tt):
        for j, d in enumerate(defs): res[d['name']][i] = st[j][0] - off(tt)
    for i0, i1, t0, t1, rec in seq:
        if rec: record(i0, t0)
        h = (t1 - t0) / SUB
        for s in range(1, SUB + 1):
            u = s / SUB; tt = t0 + (t1 - t0) * u
            wind = V(25 * math.sin(TAU * tt / max(dur, 0.3)), -22, 0)
            fwd = nrm(fw[i0] * (1 - u) + fw[i1] * u)
            for j, d in enumerate(defs):
                anc = A[i0][j] * (1 - u) + A[i1][j] * u
                rest = nrm(Rr[i0][j] * (1 - u) + Rr[i1][j] * u)
                p, pv = st[j]
                vel = (p - pv) * math.exp(-d['damp'] * h)
                new = p + vel + (V(0, 0, -G) + wind) * h * h
                new[0] = anc + off(tt)
                for k in range(1, len(new)):
                    tgt = new[k - 1] + rest * d['seg']; new[k] += (tgt - new[k]) * d['stiff']
                for _ in range(3):
                    for k in range(1, len(new)):
                        dv = new[k] - new[k - 1]; ln = np.linalg.norm(dv) or 1
                        new[k] = new[k - 1] + dv / ln * d['seg']
                if d['side']:
                    a0 = new[0]
                    for k in range(1, len(new)):
                        q = np.dot(new[k] - a0, fwd) * d['side']
                        if q < 0: new[k] = new[k] - fwd * q * d['side']
                for k in range(1, len(new)):
                    if new[k][2] < 1: new[k][2] = 1
                st[j] = [new, p]
    if not loop: record(nF - 1, times[-1])
    return res


# ================= dựng hình 1 khung =================
CAM = {v: V(math.sin(math.radians(a)), math.cos(math.radians(a)), 0.25) for v, a in YAW_V.items()}

def mkproj(view):
    a = math.radians(YAW_V[view]); ca, sa = math.cos(a), math.sin(a)
    if abs(ca) < 1e-9: ca = 0.0
    if abs(sa) < 1e-9: sa = 0.0
    def pr(v):
        x, y, z = v
        sx, dp = -x * ca + y * sa, y * ca + x * sa
        return (FX + sx, FY - z + dp * TILT, dp)
    return pr

def ring3(c, r, rf=None, n=16):
    rf = r if rf is None else rf
    return [c + V(math.cos(a) * r, math.sin(a) * rf, 0) for a in np.linspace(0, TAU, n, endpoint=False)]

def loft(part, pr, origin, R, secs, n=18):
    rings = [[pr(origin + R @ V(math.cos(a) * rx, math.sin(a) * rf + fs, z)) for a in np.linspace(0, TAU, n, endpoint=False)] for z, rx, rf, fs in secs]
    for r0, r1 in zip(rings, rings[1:]): part.poly(hull(r0 + r1))
    return part

LEATHER = '#6e4a2c'
STEEL = '#b6bcc6'       # kim loại xám trung tính: game tô theo phẩm chất
GOLD = '#f0c25a'
MOTIF_C = {'cloud': '#cfe0ff', 'plum': '#ff9ac0', 'wave': '#e8f6ff', 'coin': '#dfe6ee', 'trigram': '#fff4d0', 'grid': '#6a2410'}


def hem_marks(motif, col):
    """hoa văn thêu trên dải viền vạt áo"""
    lc = light(col, 0.5)
    mc = MOTIF_C.get(motif, lc)
    def f(d, hx_, hy, r):
        x0, x1 = int(round(hx_ - r + 1)), int(round(hx_ + r - 1))
        y = int(round(hy))
        for x in range(x0, x1 + 1):
            if motif == 'cloud':
                if x % 4 == 0: d.px(x, y, mc); d.px(x + 1, y - 1, mc)
                elif x % 4 == 2: d.px(x, y, mc)
            elif motif == 'wave':
                d.px(x, y - (1 if x % 3 == 0 else 0), mc)
            elif motif == 'coin':
                if x % 3 == 0: d.px(x, y, mc)
            elif motif == 'trigram':
                if x % 5 in (0, 1, 3): d.px(x, y, mc)
            else:
                if x % 2 == 0: d.px(x, y, lc)
    return f


def build_parts(L, B, J, CH, view, P, gear):
    """trả về (các bộ phận thân, các bộ phận vũ khí, các bộ phận mũ); gear = {'a': cấp áo, 'w': cấp vũ khí, 'h': cấp mũ}"""
    pr = mkproj(view); cam = nrm(CAM[view])
    parts = []
    Rt = J['Rt']
    def facing(v, th=0.1): return np.dot(nrm(v), cam) > th
    front = facing(Rt @ V(0, 1, 0), 0.05)
    back = view in UPS
    D = lambda v: pr(v)[2]
    T3 = lambda *q: J['pelvis'] + Rt @ V(*q)
    tdp = D(J['chest'])
    wc, wr = B['waist'], B['hipr']
    robe = L['robe']; trim = L['trim']; r2 = L['robe2']
    tier = gear.get('a', 0)
    motif = L.get('motif')
    # ---------- chân ----------
    legdp = {}
    for k in 'RL':
        hp, kn, an = J['hp' + k], J['kn' + k], J['an' + k]
        dp = (D(hp) + D(kn) + D(an)) / 3; legdp[k] = dp
        r0, r1 = B['leg']
        pl = Part(dp, L['pants'], sig=2.3, spec=0.08)
        pl.cap(pr(hp), pr(kn), r0, r0 * 0.86).cap(pr(kn), pr(an), r1, r1 * 0.74)
        if L.get('barefoot'):    # quần xắn ống, chân trần
            mid = kn + (an - kn) * 0.45
            pl = Part(dp, L['pants'], sig=2.3, spec=0.05).cap(pr(hp), pr(kn), r0, r0 * 0.9).cap(pr(kn), pr(mid), r1 * 1.05, r1)
            mi = pr(mid)
            pl.mark(lambda d, mi=mi: (d.line([(mi[0] - 3.4, mi[1] - 1.2), (mi[0] + 3.4, mi[1] - 0.6)], 0, 0.7), d.line([(mi[0] - 3.2, mi[1] - 2.6), (mi[0] + 3.2, mi[1] - 2.0)], 3, 0.6)))
            parts.append(Part(dp - 0.01, L['skin'], sig=1.8, spec=0.05).cap(pr(mid), pr(an), r1 * 0.78, r1 * 0.62))
        k2, a2 = pr(kn), pr(an)
        if L.get('wraps'):
            def wr_(d, a2=a2, k2=k2):
                for i in range(1, 6):
                    u = 0.12 + i * 0.13; x = k2[0] + (a2[0] - k2[0]) * u; y = k2[1] + (a2[1] - k2[1]) * u
                    d.line([(x - 3, y - 0.8), (x + 3, y + 0.8)], 1, 0.6)
            pl.mark(wr_)
        else:   # nếp nhăn quần ở gối và cổ chân
            pl.mark(lambda d, k2=k2, a2=a2: (d.line([(k2[0] - 2.4, k2[1] - 1), (k2[0] + 1.6, k2[1] + 0.6)], 1, 0.6),
                                            d.line([(a2[0] - 2, a2[1] - 4), (a2[0] + 1.4, a2[1] - 3.2)], 1, 0.6)))
        parts.append(pl)
        sh = Part(dp + 0.05, L['skin'] if L.get('barefoot') else L['shoe'], sig=1.4, spec=0.22)
        h_, to = pr(J['heel' + k]), pr(J['toe' + k])
        if not L.get('barefoot'): sh.cap(pr(an + V(0, 0, 4.0)), pr(an), r1 * 0.74, r1 * 0.7)
        sh.cap(h_, to, 2.1, 1.7).cap(pr(an), h_, 2.3, 2.0)
        if L.get('barefoot'):
            sc = L['shoe']
            sh.mark(lambda d, h_=h_, to=to, sc=sc: (d.line([h_, to], sc, 0.8), d.line([(to[0] - 1, to[1] - 2.4), (to[0] - 2.6, to[1] + 0.2)], sc, 0.6)))
        else:
            cuff = pr(an + V(0, 0, 3.4)); bc = L.get('bootcuff', trim)
            sh.mark(lambda d, h_=h_, to=to: d.line([(h_[0], h_[1] + 1.4), (to[0], to[1] + 1.2)], 4, 0.7))
            sh.mark(lambda d, c=cuff, r=r1 * 0.74, bc=bc: (d.line([(c[0] - r, c[1]), (c[0] + r, c[1])], bc, 1.1), d.line([(c[0] - r, c[1] + 0.9), (c[0] + r, c[1] + 0.9)], 0, 0.5)))
        parts.append(sh)
    # ---------- vạt áo (2 vạt theo 2 chân, đi thì xẻ tà; áo dài có lớp áo trong) ----------
    hem_off = V(0, 0, 0)
    if CH.get('hem') is not None:
        hp_ = CH['hem']; anc = anchor_of(J, ('torso', (0, 0, 9)))
        e = hp_[-1] - (anc + V(0, 0, -np.linalg.norm(hp_[-1] - hp_[0]) * 0.98))
        e[2] = 0
        n_ = np.linalg.norm(e)
        if n_ > 7: e = e / n_ * 7
        hem_off = e
    frac0 = {'long': 0.88, 'mid': 0.42, 'short': None}[L['length']]
    inner = L.get('inner') and frac0 is not None
    panel_dp = []
    wst = [pr(T3(math.cos(a) * (wc[0] + 1.6), math.sin(a) * (wc[1] + 1.4), 8)) for a in np.linspace(0, TAU, 16, endpoint=False)]
    hipr_ = [pr(T3(math.cos(a) * (wr[0] + 1.6), math.sin(a) * (wr[1] + 1.6), 0)) for a in np.linspace(0, TAU, 16, endpoint=False)]
    def panel(k, drop, col, dpp, frac, spec=0.06):
        hp, kn, an = J['hp' + k], J['kn' + k], J['an' + k]
        pt = Part(dpp, col, sig=3.6, spec=spec)
        if frac is None:
            th = hp + (kn - hp) * 0.38 + hem_off * 0.6 + V(0, 0, drop)
            pt.poly(hull(wst + hipr_ + [pr(p) for p in ring3(th, B['leg'][0] + 2.6)]))
            return pt, th, B['leg'][0] + 2.6
        knr = [pr(p) for p in ring3(kn + hem_off * 0.45, B['leg'][0] + 2.2)]
        hc = kn + (an - kn) * frac + hem_off + V(0, 0, drop)
        rr = 5.0 + 1.8 * frac
        hm = [pr(p) for p in ring3(hc, rr, 4.4 + 1.2 * frac)]
        pt.poly(hull(wst + hipr_ + knr)); pt.poly(hull(knr + hm))
        return pt, hc, rr
    def center_panel(drop, col, z, frac):
        stride = abs((J['Rp'].T @ (J['anR'] - J['anL']))[1])
        rr = max(0.0, 5.5 - stride * 0.42)
        if rr <= 0.6: return None
        mk_ = (J['knR'] + J['knL']) / 2 + hem_off * 0.45
        mh = (J['anR'] + J['anL']) / 2 + (J['knR'] + J['knL'] - J['anR'] - J['anL']) / 2 * (1 - frac) + hem_off
        cp_ = Part(min(legdp.values()) + 0.6 + z, col, sig=3.6, spec=0.06)
        cp_.poly(hull(hipr_ + [pr(p) for p in ring3(mk_, rr + 1.5)] + [pr(p) for p in ring3(mh + V(0, 0, drop), rr + 1.2)]))
        return cp_
    fo = frac0 - 0.17 if inner else frac0          # vạt áo ngoài ngắn hơn để lộ áo trong
    for k in 'RL':
        dp = legdp[k] + 0.6; panel_dp.append(dp)
        if inner:
            ip, ihc, irr = panel(k, 0, r2, dp - 0.03, frac0)
            ip.mark(lambda d, c=pr(ihc), r=irr, c2=dark(r2, 0.35): [d.px(x, c[1] - 0.5, c2) for x in range(int(c[0] - r + 1), int(c[0] + r))])
            parts.append(ip)
        tp, thc, trr = panel(k, 0, trim, dp - 0.01, fo)
        tp.mark(lambda d, c=pr(thc), r=trr, f=hem_marks(motif, trim): f(d, c[0], c[1] - 0.6, r))
        rp, hc, _ = panel(k, 2.4, robe, dp, fo)
        kk = pr(J['kn' + k]); h2 = pr(hc); w2 = pr(T3(0, wc[1], 6))
        def folds(d, k2=kk, h2=h2, w2=w2):
            for o in (-2.2, 1.8):
                d.line([(w2[0] + o * 0.6 + (k2[0] - w2[0]) * 0.3, w2[1] + (k2[1] - w2[1]) * 0.3), (k2[0] + o, k2[1]), (h2[0] + o * 1.5, h2[1])], 1, 0.7)
            d.line([(k2[0] - 0.4, k2[1] + 1), (h2[0] - 0.2, h2[1] - 1)], 3, 0.5)
        rp.mark(folds)
        # mép vạt áo trước chạy dọc xuống (vạt trái đè vạt phải)
        if front and k == ('R' if view in DOWNS else 'L') and frac0 is not None and view != 'right':
            e0 = pr(T3(wc[0] * 0.5, wc[1] + 1.6, 7)); e1 = pr(hc + J['Rp'] @ V(-2.6, 4.2, 0.4))
            rp.mark(lambda d, e0=e0, e1=e1, tc_=trim: (d.line([e0[:2], e1[:2]], tc_, 1.4), d.line([(e0[0] + 1, e0[1]), (e1[0] + 1, e1[1])], 3, 0.5)))
        if motif == 'plum' and not back:
            pc = pr(J['hp' + k] + (J['kn' + k] - J['hp' + k]) * 0.8 + J['Rp'] @ V(0, 4, 0))
            rp.mark(lambda d, pc=pc: flower(d, pc[0], pc[1]))
        if L.get('patches') and k == 'R':
            pc = pr(J['hp' + k] + (J['kn' + k] - J['hp' + k]) * 0.7)
            rp.mark(lambda d, pc=pc: (d.poly([(pc[0] - 2.5, pc[1] - 2), (pc[0] + 2, pc[1] - 2.4), (pc[0] + 2.4, pc[1] + 2), (pc[0] - 2, pc[1] + 2.4)], '#9a8b70'),
                                      d.line([(pc[0] - 2.5, pc[1] - 2), (pc[0] + 2, pc[1] - 2.4)], 0, 0.5)))
        parts += [tp, rp]
    if frac0 is not None and not P.get('air'):
        if inner:
            cp = center_panel(0, r2, -0.04, frac0)
            if cp: parts.append(cp)
        for dd, col, z in ((0, trim, -0.02), (2.4, robe, -0.01)):
            cp = center_panel(dd, col, z, fo)
            if cp: parts.append(cp)
    # ---------- thân ----------
    fem = B['fem']
    secs = [(0, wr[0] + 1, wr[1] + 0.8, 0), (9, wc[0] + 1, wc[1] + 1, 0), (14, (wc[0] + B['chest'][0]) / 2 + 1, (wc[1] + B['chest'][1]) / 2 + 1, 0.2 if fem else 0),
            (19, B['chest'][0] + 1, B['chest'][1] + 1, 0.8 if fem else 0.2), (B['torso'] - 4.0, B['sw'] + 0.2, B['chest'][1] * 0.8 + 0.8, 0), (B['torso'] - 1.8, B['sw'] - 2.6, B['chest'][1] * 0.6 + 0.6, 0),
            (B['torso'] - 0.3, 4.2, 3.6, 0.2)]
    tc = Part(tdp, robe, sig=4.2, spec=0.06)
    loft(tc, pr, J['pelvis'], Rt, secs)
    # nếp áo dưới nách, đường may vai
    if view != 'right':
        sg = 1 if front else -1
        fl = [(pr(T3(x * B['chest'][0], sg * (B['chest'][1] + 0.6), 17))[:2], pr(T3(x * (B['chest'][0] - 3), sg * (B['chest'][1] + 1), 13))[:2]) for x in (-1, 1)]
        tc.mark(lambda d, fl=fl: [d.line(list(f), 1, 0.6) for f in fl])
    else:
        a_, b_ = pr(T3(0, B['chest'][1] * 0.3, B['torso'] - 3)), pr(T3(0, 0, 11))
        tc.mark(lambda d, a_=a_, b_=b_: d.line([a_[:2], b_[:2]], 1, 0.5))
    # cổ áo giao lĩnh nhiều lớp (áo lót trắng, áo trong, viền thêu)
    if front:
        lp = [pr(T3(*q)) for q in ((-3.2, 2.6, B['torso'] - 0.6), (-1.5, B['chest'][1] + 1.2, 21), (3, B['chest'][1] + 1.0, 15), (wc[0] + 0.6, wc[1] + 1.0, 9.5))]
        lp2 = [pr(T3(*q)) for q in ((3.2, 2.6, B['torso'] - 0.6), (0.5, B['chest'][1] + 1.3, 22.5))]
        vv = [pr(T3(*q)) for q in ((-3, 3.0, B['torso'] - 0.5), (3, 3.0, B['torso'] - 0.5), (0, B['chest'][1] + 1.3, 22))]
        def collar(d, lp=lp, lp2=lp2, vv=vv):
            d.poly(vv, r2)
            d.line([(p[0] - 0.9, p[1] - 0.3) for p in lp2], '#f4efe4', 0.9)
            d.line([(p[0] - 1.0, p[1] - 0.5) for p in lp[:2]], '#f4efe4', 0.9)
            d.line(lp2, trim, 1.6); d.line(lp, trim, 2.2)
            d.line([(p[0] + 1.3, p[1] + 0.6) for p in lp[1:]], 1, 0.6)
            ec = light(trim, 0.55)
            for (x0, y0), (x1, y1) in zip([q[:2] for q in lp], [q[:2] for q in lp[1:]]):
                for u in (0.25, 0.75):
                    d.px(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, ec)
        tc.mark(collar)
    else:
        nk = [pr(T3(math.cos(a) * 4.2, math.sin(a) * 3.8, B['torso'] - 0.8)) for a in np.linspace(0, TAU, 12, endpoint=False)]
        tc.mark(lambda d, nk=nk: (d.line(nk[2:11], trim, 1.6), d.line([(p[0], p[1] + 1) for p in nk[3:10]], '#f4efe4', 0.6)))
        if back:
            a_, b_ = pr(T3(0, -B['chest'][1] - 1, B['torso'] - 2)), pr(T3(0, -wc[1] - 1, 10))
            tc.mark(lambda d, a_=a_, b_=b_: d.line([a_[:2], b_[:2]], 1, 0.5))
        if L.get('emblem') and back:
            ec = pr(T3(0, -wc[1] - 1.6, 19))
            if L['emblem'] == 'taiji':
                tc.mark(lambda d, ec=ec: (d.ell(ec, 3.6, 3.6, '#20202c'), d.ell(ec, 3.0, 3.0, '#f4f4f8'), d.poly([(ec[0], ec[1] - 3), (ec[0] + 3, ec[1]), (ec[0], ec[1] + 3)], '#20202c'),
                                          d.ell((ec[0], ec[1] - 1.5), 1.5, 1.5, '#f4f4f8'), d.ell((ec[0], ec[1] + 1.5), 1.5, 1.5, '#20202c'),
                                          d.px(ec[0], ec[1] - 2, '#20202c'), d.px(ec[0], ec[1] + 1, '#f4f4f8')))
            else:
                oc = [(ec[0] + math.cos(a) * 4.2, ec[1] + math.sin(a) * 4.2) for a in np.linspace(0, TAU, 9)[:-1] + math.pi / 8]
                tc.mark(lambda d, ec=ec, oc=oc: (d.line(oc + [oc[0]], r2, 0.8), d.ell(ec, 2.0, 2.0, r2), d.ell(ec, 1.0, 1.0, '#f2c24e')))
    if motif == 'plum' and not back:
        for q in ((5, 18), (-6, 12)):
            pc = pr(T3(q[0], B['chest'][1] + 1.1, q[1]))
            if view == 'right' and q[0] < 0: continue
            tc.mark(lambda d, pc=pc: flower(d, pc[0], pc[1]))
    if L.get('patches'):
        pc = pr(T3(-4, (wc[1] + 1.2) * (1 if not back else -1), 16))
        tc.mark(lambda d, pc=pc: (d.poly([(pc[0] - 3, pc[1] - 2.5), (pc[0] + 2.6, pc[1] - 3), (pc[0] + 3, pc[1] + 2.6), (pc[0] - 2.4, pc[1] + 3)], '#a89a7c'),
                                  d.line([(pc[0] - 3, pc[1] - 2.5), (pc[0] + 2.6, pc[1] - 3), (pc[0] + 3, pc[1] + 2.6)], 0, 0.5),
                                  [d.px(pc[0] - 2 + i * 1.6, pc[1] - 2.8, '#5a4a38') for i in range(3)]))
    parts.append(tc)
    # áo cà sa (Thiếu Lâm): dải chéo từ vai trái xuống hông phải, may ghép từng ô
    if L.get('kasaya'):
        sgn = 1 if not back else -1
        pts_ = [pr(T3(x, sgn * (f_ + 0.8), z)) for x, f_, z in ((-B['sw'] - 0.5, 2, B['torso'] - 2.5), (-4, B['chest'][1] + 0.6, 21), (3, B['chest'][1] + 0.4, 13), (wc[0] + 1.4, wc[1] + 0.8, 5))]
        kp = Part(tdp + 0.32, L['kasaya'], sig=1.8, spec=0.05, ol=2).line(pts_, 6.0)
        def grid(d, p=pts_):
            d.line([(q[0] + 1.5, q[1] + 1) for q in p], 1, 0.6)
            for (x0, y0), (x1, y1) in zip([q[:2] for q in p], [q[:2] for q in p[1:]]):
                for u in (0.33, 0.66):
                    x, y = x0 + (x1 - x0) * u, y0 + (y1 - y0) * u; nx, ny = -(y1 - y0), x1 - x0; ln = math.hypot(nx, ny) or 1
                    d.line([(x + nx / ln * 3, y + ny / ln * 3), (x - nx / ln * 3, y - ny / ln * 3)], 0, 0.5)
        kp.mark(grid)
        if front:
            rg = pts_[0]
            kp.mark(lambda d, rg=pr(T3(-B['sw'] + 2.2, B['chest'][1] * 0.6 + 1, B['torso'] - 4)): (d.ell(rg[:2], 1.6, 1.6, GOLD), d.ell(rg[:2], 0.7, 0.7, L['kasaya'])))
        parts.append(kp)
    # bao phi tiêu đeo chéo ngực (Đường Môn)
    if L.get('bandolier'):
        sgn = 1 if not back else -1
        bpts = [pr(T3(x, sgn * f_, z)) for x, f_, z in ((B['sw'] - 1, sgn * 0 + 2.6, B['torso'] - 2.5), (2, B['chest'][1] + 1.3, 19), (-5, B['chest'][1] + 0.9, 12), (-wc[0] - 1, wc[1] * 0.4, 8))]
        bp_ = Part(tdp + 0.4, '#3a2a1c', sig=1.2, spec=0.2, ol=2).line(bpts, 2.6)
        if not back:
            def darts(d, p=bpts):
                for (x0, y0), (x1, y1) in zip([q[:2] for q in p[:2]], [q[:2] for q in p[1:3]]):
                    for u in (0.2, 0.5, 0.8):
                        x, y = x0 + (x1 - x0) * u, y0 + (y1 - y0) * u
                        d.px(x, y - 1, '#dfe6e4'); d.px(x, y, '#9aa4a8')
            bp_.mark(darts)
        parts.append(bp_)
    # giáp riêng Thiên Vương (chỉ ở cấp áo vải; cấp cao hơn dùng giáp theo cấp)
    if L.get('armor') and tier == 0:
        ap = Part(tdp + 0.35, L['steel'], sig=2.6, spec=0.85)
        loft(ap, pr, J['pelvis'], Rt, [(11, wc[0] + 1.9, wc[1] + 1.9, 0), (19, B['chest'][0] + 1.8, B['chest'][1] + 1.8, 0.3), (B['torso'] - 4.5, B['sw'] - 0.2, B['chest'][1] * 0.8 + 1.6, 0)])
        g = L['metal']
        ap.mark(armor_rings(J, pr, Rt, B, wc, tdp, g, 1.2))
        if front:
            cc = pr(T3(0, B['chest'][1] + 2.6, 19.5))
            ap.mark(lambda d, cc=cc, g=g: (d.ell(cc, 3.6, 3.6, g), d.ell(cc, 2.4, 2.4, '#fff3c0'), d.ell((cc[0] + 0.7, cc[1] + 0.7), 1.5, 1.5, light(g, 0.2)), d.px(cc[0] - 1, cc[1] - 1, '#ffffff')))
        parts.append(ap)
        for k in 'RL':
            parts.append(tasset(J, pr, k, view, max(panel_dp) + 0.15, L['steel'], g, 'body'))
    # đai lưng
    bdp = max(tdp, max(panel_dp)) + 0.2
    bt = Part(bdp, L['belt'], sig=1.6, spec=0.15, ol=2)
    loft(bt, pr, J['pelvis'], Rt, [(6.8, wc[0] + 1.9, wc[1] + 1.8, 0), (10.6, wc[0] + 1.8, wc[1] + 1.7, 0)])
    brng = [pr(T3(math.cos(a) * (wc[0] + 2.0), math.sin(a) * (wc[1] + 1.9), 8.7)) for a in np.linspace(0, TAU, 20, endpoint=False)]
    bvis = sorted([p[:2] for p in brng if p[2] - tdp > -1], key=lambda p: p[0])
    if L.get('rope'):
        bt.mark(lambda d, v=bvis: [d.line([(x - 0.8, y - 1.2), (x + 0.8, y + 1.2)], 1, 0.6) for x, y in v[::1]])
    elif len(bvis) > 1:
        bt.mark(lambda d, v=bvis, c=light(L['belt'], 0.35): d.line(v, c, 0.5))
    if L.get('armor') and tier == 0:
        bc = pr(T3(0, wc[1] + 2.4, 8.6))
        if front: bt.mark(lambda d, bc=bc, g=L['metal']: (d.ell(bc, 2.8, 2.2, g), d.px(bc[0] - 1, bc[1] - 0.5, '#5a3010'), d.px(bc[0] + 1, bc[1] - 0.5, '#5a3010'), d.px(bc[0], bc[1] + 1, '#5a3010')))
    parts.append(bt)
    if front and L.get('sash'):
        kc = pr(T3(-1.5, wc[1] + 2.2, 8.8))
        parts.append(Part(bdp + 0.05, L['belt'], sig=1.0, spec=0.2, ol=2).ell(kc, 2.2, 1.7).ell((kc[0] - 2.2, kc[1] + 0.4), 1.6, 1.1).ell((kc[0] + 2.2, kc[1] + 0.4), 1.6, 1.1))
    if L.get('apron') and view not in UPS:   # tạp dề da thợ rèn
        km = (J['knR'] + J['knL']) / 2 + J['Rp'] @ V(0, 6, 3)
        q = [pr(T3(-5.5, B['chest'][1] + 2.2, 23))[:2], pr(T3(5.5, B['chest'][1] + 2.2, 23))[:2], pr(T3(wc[0] + 2.4, wc[1] + 2.6, 8))[:2],
             pr(km + J['Rp'] @ V(6.5, 0, 0))[:2], pr(km + J['Rp'] @ V(-6.5, 0, 0))[:2], pr(T3(-wc[0] - 2.4, wc[1] + 2.6, 8))[:2]]
        if view == 'right': q = [pr(T3(0, B['chest'][1] + 2.2, 23))[:2], pr(T3(0, wc[1] + 2.8, 8))[:2], pr(km)[:2], pr(km + J['Rp'] @ V(0, -3, 0))[:2], pr(T3(0, wc[1] + 1.6, 8))[:2], pr(T3(0, B['chest'][1] + 1, 23))[:2]]
        ap_ = Part(bdp + 0.1, L['apron'], sig=2.0, spec=0.2).poly(q)
        ap_.mark(lambda d, q=q: (d.line([q[0], q[1]], 4, 0.7), [d.px(x[0], x[1], 0) for x in q[2:3]]))
        parts.append(ap_)
    if L.get('pouches'):
        for x in (-6.5, 6.5):
            pc3 = T3(x, wc[1] * 0.6, 6.5)
            pp = Part(D(pc3) + 0.25, L['belt'], sig=1.0, spec=0.15, ol=2).poly(hull(circ(pr(pc3), 2.2) + circ(pr(pc3 + V(0, 0, -3)), 2.0)))
            pp.mark(lambda d, c=pr(pc3): (d.line([(c[0] - 2, c[1] - 0.4), (c[0] + 2, c[1] - 0.4)], 0, 0.6), d.px(c[0], c[1] + 0.4, '#c8b070')))
            parts.append(pp)
    if L.get('gourd'):
        g0 = T3(wr[0] + 0.8, 1.5, 2.5)
        gp = Part(D(g0) + 0.7, L['gourd'], sig=1.4, spec=0.45, ol=2).ell(pr(g0 + V(0, 0, -4.5)), 3.4, 3.6).ell(pr(g0), 2.3, 2.4)
        gp.mark(lambda d, a=pr(g0): (d.line([(a[0] - 2, a[1] - 0.2), (a[0] + 2, a[1] + 0.2)], '#7a3a18', 0.7), d.line([(a[0], a[1] - 2.4), (a[0] + 0.6, a[1] - 4.2)], '#d0302a', 0.8)))
        parts.append(gp)
    if L.get('stick'):
        s0, s1 = T3(-8, -7.5, -6), T3(8, -7.5, 38)
        sp = Part((D(s0) + D(s1)) / 2, L['stick'], sig=0.9, spec=0.4, ol=2).cap(pr(s0), pr(s1), 1.4)
        a_, b_ = pr(s0), pr(s1)
        sp.mark(lambda d, a=a_, b=b_: [d.px(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 0) for u in (0.2, 0.4, 0.6, 0.8)])
        parts.append(sp)
    # chuỗi hạt / vòng bạc
    if L.get('beads') or L.get('silver'):
        bp = Part(tdp + 0.45, '#5a3418' if L.get('beads') else L['silver'], sig=0.6, spec=0.6, ol=2)
        nb = 16 if L.get('beads') else 22
        for i in range(nb):
            a = i / nb * TAU
            q = T3(math.cos(a) * 6.2, math.sin(a) * (B['chest'][1] + 1.2) * (1 if math.sin(a) > 0 else 0.5), B['torso'] - 2.5 - (1 + math.sin(a)) * (6 if L.get('beads') else 3.5))
            if np.dot(Rt @ V(0, math.sin(a), 0), cam) > -0.05 or view == 'right':
                bp.ell(pr(q)[:2], 1.25 if L.get('beads') else 0.75)
        if L.get('beads') and front:
            q = pr(T3(0, B['chest'][1] + 1.6, B['torso'] - 15))
            bp.ell(q[:2], 1.8)
        if bp.ops: parts.append(bp)
    if L.get('scarf'):
        parts.append(loft(Part(tdp + 0.5, L['scarf'], sig=1.4, spec=0.1, ol=2), pr, J['pelvis'], Rt, [(B['torso'] - 3.4, 4.6, 4.0, 0.5), (B['torso'] - 0.8, 4.2, 3.7, 0.3)]))
    # ---------- tay ----------
    arm_dp = {}
    for k, side in (('R', 1), ('L', -1)):
        sh, el, ha, palm = J['sh' + k], J['el' + k], J['ha' + k], J['palm' + k]
        adp = (D(sh) + D(el) + D(ha)) / 3 + 1.2; arm_dp[k] = adp
        S_, E_, H_ = pr(sh), pr(el), pr(ha)
        scol = L.get('sleevecol', robe)
        if L.get('kasaya') and k == 'L': scol = L['kasaya']
        a0, a1 = B['arm']
        if L['sleeve'] == 'wide':
            drp = CH.get('dr' + k)
            dpt = pr(drp[-1]) if drp is not None else pr(ha + V(0, 0, -5))
            ap = Part(adp, scol, sig=2.6, spec=0.08)
            ap.blob([(S_, a0 - 0.2), (E_, a0 + 0.6)]).blob([(E_, a0 + 0.7), (H_, a0 + 2.2), (dpt, 2.4)])
            ap.mark(lambda d, E_=E_, H_=H_, dpt=dpt: (d.line([(E_[0] + 1, E_[1] + 1.5), ((H_[0] + dpt[0]) / 2, (H_[1] + dpt[1]) / 2 + 1)], 1, 0.7),
                                                     d.line([(E_[0] - 1.2, E_[1] + 0.6), (H_[0] - 0.8, H_[1] - 0.6)], 3, 0.5)))
            if motif == 'cloud':
                mc = pr(el + (ha - el) * 0.7 + V(0, 0, -2.5))
                ap.mark(lambda d, c=mc: [d.px(c[0] + x, c[1] + y, MOTIF_C['cloud']) for x, y in ((-1, 0), (0, -1), (1, -1), (2, 0), (0, 1))])
            if motif == 'trigram':
                mc = pr(el + (ha - el) * 0.6 + V(0, 0, -2))
                ap.mark(lambda d, c=mc: [d.line([(c[0] - 1.6, c[1] + i * 1.2), (c[0] + 1.6, c[1] + i * 1.2)], '#f2c24e', 0.5) for i in range(3)])
            parts.append(ap)
            # miệng tay áo: lót màu áo trong + viền thêu
            parts.append(Part(adp + 0.04, r2, sig=1.0, ol=2).ell(((H_[0] + dpt[0]) / 2, (H_[1] + dpt[1]) / 2 + 0.6), 2.6, 1.6))
            cl = [pr(ha + J['fa' + k] * 0.3 + V(0, 0, 3)), pr(ha + V(0, 0, -2)), dpt]
            cp = Part(adp + 0.05, trim, sig=1.0, ol=2).line(cl, 1.8)
            cp.mark(lambda d, cl=cl, c=light(trim, 0.5): [d.px(p[0], p[1], c) for p in cl[:2]])
            parts.append(cp)
        elif L['sleeve'] == 'tight':
            ap = Part(adp, scol, sig=2.2, spec=0.08).cap(S_, E_, a0, a0 * 0.86).cap(E_, H_, a1, a1 * 0.8)
            ap.mark(lambda d, E_=E_: d.line([(E_[0] - 1.6, E_[1] - 0.8), (E_[0] + 1.4, E_[1] + 0.6)], 1, 0.6))
            parts.append(ap)
            if L.get('sleeveband'):     # dải thêu nhiều màu (Ngũ Độc)
                m0, m1 = el + (sh - el) * 0.25, el + (ha - el) * 0.18
                bb = Part(adp + 0.03, L['trim'], sig=1.0, ol=2).cap(pr(m0), pr(m1), a0 * 0.95, a1 * 0.95)
                bb.mark(lambda d, a=pr(m0), b=pr(m1): [d.px(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, c) for u, c in ((0.2, '#e8402a'), (0.5, '#f2c24e'), (0.8, '#3a8ad8'))])
                parts.append(bb)
            if L.get('bracer'):
                m_ = el + (ha - el) * 0.45
                bp_ = Part(adp + 0.05, L['bracer'], sig=1.2, spec=0.25, ol=2).cap(pr(m_), H_, a1 * 0.95, a1 * 0.88)
                bp_.mark(lambda d, a=pr(m_), b=H_: [d.line([(a[0] + (b[0] - a[0]) * u - 2.2, a[1] + (b[1] - a[1]) * u - 0.4), (a[0] + (b[0] - a[0]) * u + 2.2, a[1] + (b[1] - a[1]) * u + 0.4)], 0, 0.5) for u in (0.3, 0.65)])
                parts.append(bp_)
            else:
                parts.append(Part(adp + 0.05, trim, sig=1.0, ol=2).cap(pr(ha - J['fa' + k] * 1.6), H_, a1 * 0.9, a1 * 0.86))
        else:   # tay áo ngắn (Cái Bang)
            m_ = sh + (el - sh) * 0.62
            parts.append(Part(adp - 0.01, L['skin'], sig=2.0, spec=0.05).cap(pr(m_), E_, a0 * 0.8, a1 * 0.92).cap(E_, H_, a1 * 0.9, a1 * 0.78))
            sp = Part(adp, scol, sig=2.2, spec=0.05).cap(S_, pr(m_), a0 + 0.6, a0 + 0.3)
            mm = pr(m_)
            sp.mark(lambda d, mm=mm: [d.px(mm[0] + x, mm[1] + 0.6 + (x % 2), 1) for x in range(-3, 4)])
            if k == 'L': sp.mark(lambda d, c=pr(sh + (el - sh) * 0.35): d.poly([(c[0] - 2, c[1] - 1.6), (c[0] + 2, c[1] - 1.8), (c[0] + 2, c[1] + 1.6), (c[0] - 2, c[1] + 1.8)], '#9a8b70'))
            parts.append(sp)
            parts.append(Part(adp + 0.02, '#d8ccb4', sig=1.0, ol=2).cap(pr(ha - J['fa' + k] * 3), H_, a1 * 0.84, a1 * 0.8))
        if L.get('armor') and tier == 0:
            parts.append(pauldron(J, pr, Rt, k, side, adp + 0.15, L['metal'], 'body', False))
        op = P.get('open' + k, 0) > 0.5
        hp_ = Part(adp + 0.1, L['skin'], sig=1.0, spec=0.05, ol=2)
        Pm = pr(palm)
        if op:
            tip = pr(palm + J['fa' + k] * 3.0)
            hp_.cap(Pm, tip, 2.2, 1.6)
        else:
            hp_.ell(Pm[:2], 2.3, 2.2)
            hp_.mark(lambda d, Pm=Pm: d.px(Pm[0] - 0.5, Pm[1] + 0.5, 1))
        parts.append(hp_)
    # ---------- giáp theo cấp ----------
    if tier: parts += armor_tier(L, B, J, pr, view, tier, front, tdp, panel_dp, legdp, arm_dp, CH)
    # ---------- đầu, tóc, mũ ----------
    helm = []
    head_parts(L, B, J, pr, view, parts, CH, P, gear.get('h', 0), helm)
    # ---------- tóc / dải lụa mô phỏng ----------
    wparts = []
    for nm, pts3 in CH.items():
        d0 = next((d for d in CHAINS_CACHE[L['name']] if d['name'] == nm), None)
        if d0 is None or 'kind' not in d0 or pts3 is None: continue
        if d0.get('need') == 'cape' and tier < 3: continue
        p2 = [pr(q) for q in pts3]
        dp = sum(p[2] for p in p2) / len(p2) + 0.2
        if d0['kind'] == 'hair' and d0['name'] in ('lockR', 'lockL'): dp = D(J['head']) + 2.6 if view not in UPS else D(J['head']) - 4
        if d0['kind'] == 'tassel': dp = D(J['palmR']) - 0.1
        if d0['kind'] == 'cape': dp = min(dp, tdp - 0.5) if not back else max(dp, tdp + 1.5)
        pt = Part(dp, d0['col'], sig=1.2 if d0['kind'] != 'hair' else 1.6, spec=0.5 if d0['kind'] in ('hair', 'braid') else 0.22, ol=2,
                  tag='weapon' if d0['kind'] == 'tassel' else 'body')
        pp = [p[:2] for p in p2]
        if d0['kind'] == 'pendant':
            pt.ribbon(pp[:2], 0.9, 0.9)
            parts.append(Part(dp + 0.01, '#6ac8a0', sig=0.8, spec=0.8, ol=2).ell(pp[1], 1.9, 1.9).mark(lambda d, c=pp[1]: (d.ell(c, 0.7, 0.7, 1), d.px(c[0] - 1, c[1] - 1, '#ffffff'))))
            parts.append(Part(dp, d0.get('col2', '#e8402a'), sig=0.8, spec=0.2, ol=2).ribbon(pp[1:], 1.6, 2.4))
            parts.append(pt)
            continue
        pt.ribbon(pp, *d0['w'])
        if d0['kind'] in ('hair', 'braid'):
            if d0['kind'] == 'braid':
                pt.mark(lambda d, pp=pp: [d.line([(pp[i][0] - 1.6, pp[i][1] - 0.6), (pp[i][0] + 1.6, pp[i][1] + 0.6)], 1, 0.6) for i in range(1, len(pp))])
            else:
                pt.mark(lambda d, pp=pp: (d.line([(x + 1.2, y) for x, y in pp[:-1]], 1, 0.6), d.line([(x - 1.4, y + 0.5) for x, y in pp[1:-1]], 3, 0.5)))
        if d0['kind'] == 'cape':
            pt.mark(lambda d, pp=pp, g=GOLD: d.line([(x + 3.2, y) for x, y in pp], g, 0.7))
        if d0['kind'] == 'tassel':
            pt.ell(p2[0][:2], 1.4)
            wparts.append(pt); continue
        parts.append(pt)
    return parts, wparts, helm


def flower(d, x, y):
    x, y = int(round(x)), int(round(y))
    for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)): d.px(x + dx, y + dy, '#ff9ac0')
    d.px(x, y, '#ffe070')


def armor_rings(J, pr, Rt, B, wc, tdp, g, w):
    T3 = lambda *q: J['pelvis'] + Rt @ V(*q)
    top = [pr(T3(math.cos(a) * (B['sw'] - 0.2), math.sin(a) * (B['chest'][1] * 0.8 + 1.6), B['torso'] - 4.5)) for a in np.linspace(0, TAU, 20, endpoint=False)]
    bot = [pr(T3(math.cos(a) * (wc[0] + 1.9), math.sin(a) * (wc[1] + 1.9), 11)) for a in np.linspace(0, TAU, 20, endpoint=False)]
    vis = lambda r: sorted([p[:2] for p in r if p[2] - tdp > -1.5], key=lambda p: p[0])
    mids = []
    for i in range(3):
        z = 13.5 + i * 2.6
        mids.append(vis([pr(T3(math.cos(a) * (wc[0] + 2.2 + i * 0.6), math.sin(a) * (wc[1] + 2.2 + i * 0.4), z)) for a in np.linspace(0, TAU, 20, endpoint=False)]))
    vt, vb = vis(top), vis(bot)
    def f(d):
        for v in (vt, vb):
            if len(v) > 1: d.line(v, g, w)
        for v in mids:
            if len(v) > 1: d.line(v, 1, 0.6)
    return f


def tasset(J, pr, k, view, depth, col, g, tag, neutral=False, w=7.5):
    """váy giáp: tấm hình thang từ hông xuống giữa đùi, ghép nhiều hàng lá"""
    hp, kn = J['hp' + k], J['kn' + k]
    fwd = J['Rp'] @ V(0, 1, 0) * (1 if view not in UPS else -1)
    q0, q1 = pr(hp + fwd * 6.2 + V(0, 0, 5)), pr(hp + (kn - hp) * 0.58 + fwd * 5.4)
    dx, dy = q1[0] - q0[0], q1[1] - q0[1]; ln = math.hypot(dx, dy) or 1
    nx, ny = -dy / ln, dx / ln
    t0, t1 = w * 0.42, w * 0.56
    quad = [(q0[0] + nx * t0, q0[1] + ny * t0), (q0[0] - nx * t0, q0[1] - ny * t0), (q1[0] - nx * t1 + dx / ln, q1[1] - ny * t1 + dy / ln), (q1[0] + dx / ln * 2, q1[1] + dy / ln * 2), (q1[0] + nx * t1 + dx / ln, q1[1] + ny * t1 + dy / ln)]
    tp = Part(depth, col, sig=1.6, spec=0.8, ol=2, tag=tag, neutral=neutral).poly(quad)
    def scales(d):
        for i in range(1, 4):
            u = i / 4; x = q0[0] + dx * u; y = q0[1] + dy * u; hw = t0 + (t1 - t0) * u
            d.line([(x + nx * hw, y + ny * hw), (x - nx * hw, y - ny * hw)], 1, 0.6)
            for j in (-1, 0, 1): d.px(x + nx * hw * j * 0.55, y + ny * hw * j * 0.55 - 1, 4)
        if g: d.line([quad[2], quad[3], quad[4]], g, 0.9)
    tp.mark(scales)
    return tp


def pauldron(J, pr, Rt, k, side, depth, col, tag, neutral, big=1.0):
    sh = J['sh' + k]
    out_ = Rt @ V(side * 2.2, 0, 1.2)
    c1, c2, c3 = pr(sh + out_ * 0.6 + V(0, 0, 1)), pr(sh + out_ * 1.2 + V(0, 0, -2.4)), pr(sh + out_ * 1.6 + V(0, 0, -5.4))
    pa = Part(depth, col, sig=1.4, spec=0.85, ol=2, tag=tag, neutral=neutral).ell(c1[:2], 5.2 * big, 2.7 * big).ell(c2[:2], 5.0 * big, 2.5 * big).ell(c3[:2], 4.5 * big, 2.3 * big)
    def lames(d, c1=c1, c2=c2, c3=c3):
        for c, w in ((c2, 4.6), (c3, 4.0)):
            arc = [(c[0] - w * big, c[1] - 1.6), (c[0] - w * big * 0.5, c[1] - 2.4), (c[0], c[1] - 2.6), (c[0] + w * big * 0.5, c[1] - 2.4), (c[0] + w * big, c[1] - 1.6)]
            d.line(arc, 0, 0.8)                                        # khe tối giữa 2 lá
            d.line([(x, y + 0.6) for x, y in arc], 5, 0.4)             # gờ sáng mép lá dưới
        for c, w in ((c1, 4.4), (c2, 4.2), (c3, 3.7)):                 # đinh tán 2 đầu mỗi lá
            for sx in (-1, 1): d.hp(c[0] + sx * w * big, c[1] - 0.5, 6); d.hp(c[0] + sx * w * big + 0.5, c[1], 1)
    pa.mark(lames)
    return pa


def armor_tier(L, B, J, pr, view, tier, front, tdp, panel_dp, legdp, arm_dp, CH):
    """áo giáp theo cấp: 1 giáp da, 2 giáp sắt, 3 thần giáp. Phần kim loại gắn tag 'metal' (xám, game tô màu)"""
    out = []
    Rt = J['Rt']; T3 = lambda *q: J['pelvis'] + Rt @ V(*q)
    D = lambda v: pr(v)[2]
    wc = B['waist']; back = view in UPS; sgn = -1 if back else 1
    a1r = B['arm'][1]; r1 = B['leg'][1]
    glow = L['glow']
    vest_secs = [(9.5, wc[0] + 2.3, wc[1] + 2.2, 0), (19, B['chest'][0] + 2.1, B['chest'][1] + 2.0, 0.3), (B['torso'] - 4.2, B['sw'] - 0.6, B['chest'][1] * 0.8 + 1.8, 0)]
    if tier == 1:
        v = Part(tdp + 0.36, LEATHER, sig=2.8, spec=0.25)
        loft(v, pr, J['pelvis'], Rt, vest_secs)
        if front:
            v.erase([pr(T3(-4.2, B['chest'][1] + 3, B['torso'] - 3.6))[:2], pr(T3(4.2, B['chest'][1] + 3, B['torso'] - 3.6))[:2], pr(T3(0, B['chest'][1] + 3, 15))[:2]])
        rows = []
        for z in (13, 17.5):
            r = [pr(T3(math.cos(a) * (wc[0] + 2.6 + (z - 13) * 0.25), math.sin(a) * (wc[1] + 2.5 + (z - 13) * 0.15), z)) for a in np.linspace(0, TAU, 20, endpoint=False)]
            rows.append(sorted([p[:2] for p in r if p[2] - tdp > -1.5], key=lambda p: p[0]))
        v.mark(lambda d, rows=rows: [[d.px(x, y, light(LEATHER, 0.35)) for i, (x, y) in enumerate(rw) if i % 2 == 0] for rw in rows])
        out.append(v)
        st = Part(tdp + 0.37, STEEL, sig=0.7, spec=0.9, ol=2, tag='metal', neutral=True)
        for x, z in ((-6, 21), (6, 21), (-6.5, 12), (6.5, 12)):
            q = T3(x, sgn * (B['chest'][1] + 2.4 - abs(x) * 0.08), z)
            st.ell(pr(q)[:2], 1.1)
        out.append(st)
        for k, side in (('R', 1), ('L', -1)):
            el, ha, sh = J['el' + k], J['ha' + k], J['sh' + k]
            m_ = el + (ha - el) * 0.35
            out.append(Part(arm_dp[k] + 0.06, LEATHER, sig=1.2, spec=0.3, ol=2).cap(pr(m_)[:2], pr(ha)[:2], a1r * 1.1, a1r))
            out.append(Part(arm_dp[k] + 0.07, STEEL, sig=0.8, spec=0.9, ol=2, tag='metal', neutral=True).cap(pr(el + (ha - el) * 0.82)[:2], pr(ha)[:2], a1r * 1.15, a1r * 1.1))
            c = pr(sh + Rt @ V(side * 1.8, 0, 1))
            sp = Part(arm_dp[k] + 0.08, LEATHER, sig=1.4, spec=0.3, ol=2).ell(c[:2], 4.6, 3.2)
            sp.mark(lambda d, c=c: d.line([(c[0] - 3.6, c[1] + 0.6), (c[0] + 3.6, c[1] + 0.6)], 3, 0.5))
            out.append(sp)
            kn, an = J['kn' + k], J['an' + k]
            out.append(Part(legdp[k] + 0.09, LEATHER, sig=1.4, spec=0.3, ol=2).cap(pr(kn + (an - kn) * 0.2)[:2], pr(kn + (an - kn) * 0.8)[:2], r1 * 1.05, r1 * 0.9))
            out.append(Part(legdp[k] + 0.1, STEEL, sig=0.8, spec=0.9, ol=2, tag='metal', neutral=True).ell(pr(kn + J['Rp'] @ V(0, 2.5 * sgn, 0))[:2], 2.6, 2.2))
        bc = pr(T3(0, sgn * (wc[1] + 2.6), 8.6))
        if not back: out.append(Part(max(panel_dp) + 0.5, STEEL, sig=0.8, spec=0.9, ol=2, tag='metal', neutral=True).ell(bc[:2], 2.4, 1.9))
        return out
    # cấp 2, 3: giáp sắt lá ghép
    cu = Part(tdp + 0.38, STEEL, sig=2.6, spec=0.85, tag='metal', neutral=True)
    loft(cu, pr, J['pelvis'], Rt, vest_secs)
    rows = []
    for i in range(5):
        z = 11 + i * 2.6
        r = [pr(T3(math.cos(a) * (wc[0] + 2.5 + i * 0.55), math.sin(a) * (wc[1] + 2.4 + i * 0.4), z)) for a in np.linspace(0, TAU, 22, endpoint=False)]
        rows.append(sorted([p[:2] for p in r if p[2] - tdp > -1.5], key=lambda p: p[0]))
    chest = [pr(T3(x, sgn * (B['chest'][1] + 2.2), z)) for x, z in ((0, B['torso'] - 4.6), (0, 19), (0, 14.5))]
    pec = [[pr(T3(sx * u, sgn * (B['chest'][1] + 2.3 - abs(u) * 0.06), 19.5 - (abs(u) - 3.5) ** 2 * 0.12)) for u in np.linspace(0.6, 6.6, 7)] for sx in (-1, 1)]
    def lam(d, rows=rows):
        for j, rw in enumerate(rows):
            if len(rw) > 1: d.line(rw, 1, 0.55); d.line([(x, y + 0.5) for x, y in rw], 5, 0.3)   # lá giáp: khe tối + gờ sáng
            for i, (x, y) in enumerate(rw):
                if (i + j) % 2 == 0: d.hp(x, y - 1, 6); d.hp(x + 0.5, y - 0.5, 1)              # đinh tán
        if not back:
            for pc in pec:
                pts = [p[:2] for p in pc if p[2] - tdp > -1.5]
                if len(pts) > 1: d.line(pts, 1, 0.6); d.line([(x, y - 0.6) for x, y in pts], 6, 0.35)   # 2 tấm ngực
            a, b2 = chest[0], chest[2]
            d.line([(a[0], a[1]), (b2[0], b2[1])], 5, 0.5); d.line([(a[0] + 0.6, a[1]), (b2[0] + 0.6, b2[1])], 1, 0.4)   # gờ giữa
    cu.mark(lam)
    out.append(cu)
    if tier == 2:   # viền vải màu phái ở cổ và gấu giáp (không bị tô màu phẩm chất -> điểm nhấn màu)
        tr = Part(tdp + 0.39, L['trim'], sig=0.6, spec=0.4, ol=0)
        for z, rx, rf in ((B['torso'] - 4.2, B['sw'] - 0.6, B['chest'][1] * 0.8 + 1.8), (9.5, wc[0] + 2.3, wc[1] + 2.2)):
            r = [pr(T3(math.cos(a) * (rx + 0.25), math.sin(a) * (rf + 0.25), z)) for a in np.linspace(0, TAU, 24, endpoint=False)]
            vv = sorted([p[:2] for p in r if p[2] - tdp > -1.5], key=lambda p: p[0])
            if len(vv) > 1: tr.line(vv, 1.0)
        if tr.ops: out.append(tr)
    if tier == 3:   # viền vàng + hộ tâm kính ngọc theo màu phái
        gt = Part(tdp + 0.39, GOLD, sig=0.6, spec=0.9, ol=0)
        for z, rx, rf in ((B['torso'] - 4.2, B['sw'] - 0.6, B['chest'][1] * 0.8 + 1.8), (9.5, wc[0] + 2.3, wc[1] + 2.2)):
            r = [pr(T3(math.cos(a) * (rx + 0.2), math.sin(a) * (rf + 0.2), z)) for a in np.linspace(0, TAU, 24, endpoint=False)]
            vv = sorted([p[:2] for p in r if p[2] - tdp > -1.5], key=lambda p: p[0])
            if len(vv) > 1: gt.line(vv, 1.2)
        if front or back:
            cc = pr(T3(0, sgn * (B['chest'][1] + 2.8), 19))
            gt.ell(cc[:2], 3.8, 3.8)
            out.append(gt)
            out.append(Part(tdp + 0.4, glow, sig=0.8, spec=0.9, ol=2).ell(cc[:2], 2.4, 2.4).mark(lambda d, cc=cc: (d.px(cc[0] - 1, cc[1] - 1, '#ffffff'), d.px(cc[0], cc[1] - 1, light(glow, 0.6)))))
        elif gt.ops: out.append(gt)
    big = 1.0 if tier == 2 else 1.18
    for k, side in (('R', 1), ('L', -1)):
        pa = pauldron(J, pr, Rt, k, side, arm_dp[k] + 0.15, STEEL, 'metal', True, big)
        out.append(pa)
        if tier == 3:
            sh = J['sh' + k]
            c0 = pr(sh + Rt @ V(side * 3.2, 0, 3.4)); c1 = pr(sh + Rt @ V(side * 7.5, 0, 9))
            out.append(Part(arm_dp[k] + 0.14, STEEL, sig=1.0, spec=0.9, ol=2, tag='metal', neutral=True).poly([(c0[0] - 2.4, c0[1] + 1.4), (c1[0], c1[1]), (c0[0] + 2.4, c0[1] + 1.4)]))
            out.append(Part(arm_dp[k] + 0.16, GOLD, sig=0.6, spec=0.9, ol=0).line([pr(sh + Rt @ V(side * 1.6, 0, 2.2))[:2], pr(sh + Rt @ V(side * 4.4, 0, -1.6))[:2]], 0.9))
        el, ha = J['el' + k], J['ha' + k]
        br = Part(arm_dp[k] + 0.07, STEEL, sig=1.0, spec=0.9, ol=2, tag='metal', neutral=True).cap(pr(el + (ha - el) * 0.3)[:2], pr(ha)[:2], a1r * 1.15, a1r * 1.05)
        def brace(d, a=pr(el + (ha - el) * 0.55), t0=pr(el + (ha - el) * 0.34), t1=pr(el + (ha - el) * 0.95)):
            d.line([(a[0] - 2.4, a[1]), (a[0] + 2.4, a[1])], 1, 0.6)
            for t in (t0, t1): d.line([(t[0] - 2.6, t[1]), (t[0] + 2.6, t[1])], 5, 0.5)
            for dx, dy in ((0, -1.0), (0.5, -0.5), (0, 0), (-0.5, -0.5)): d.hp(a[0] + dx, a[1] + 1.5 + dy, 6)
        br.mark(brace)
        out.append(br)
        out.append(tasset(J, pr, k, view, max(panel_dp) + 0.15, STEEL, GOLD if tier == 3 else None, 'metal', True, 7.5 if tier == 2 else 8.5))
        kn, an = J['kn' + k], J['an' + k]
        gv = Part(legdp[k] + 0.09, STEEL, sig=1.2, spec=0.9, ol=2, tag='metal', neutral=True).cap(pr(kn + (an - kn) * 0.15)[:2], pr(kn + (an - kn) * 0.78)[:2], r1 * 1.06, r1 * 0.9)
        def greave(d, a=pr(kn + (an - kn) * 0.2), b=pr(kn + (an - kn) * 0.74)):
            d.line([(a[0], a[1]), (b[0], b[1])], 5, 0.45); d.line([(a[0] + 0.6, a[1]), (b[0] + 0.6, b[1])], 1, 0.35)
            d.line([(a[0] - r1, a[1] + 0.3), (a[0] + r1, a[1] + 0.3)], 1, 0.6)
        gv.mark(greave)
        out.append(gv)
    bc = pr(T3(0, sgn * (wc[1] + 2.8), 8.6))
    if not back:
        out.append(Part(max(panel_dp) + 0.5, STEEL, sig=1.0, spec=0.9, ol=2, tag='metal', neutral=True).ell(bc[:2], 3.2, 2.5))
        if tier == 3: out.append(Part(max(panel_dp) + 0.51, glow, sig=0.6, spec=0.9, ol=2).ell(bc[:2], 1.2, 1.1))
    return out


WSCALE2 = (1.0, 1.12, 1.25)     # độ dài binh khí theo cấp: thường / tinh luyện / thần binh

def weapon_parts(L, J, pr, CH, wt=0):
    """binh khí theo cấp (tag 'weapon'), trả về danh sách bộ phận"""
    out = []
    w = L['weapon']
    D = lambda v: pr(v)[2]
    sc = WSCALE2[wt]; glow = L['glow']
    WP = lambda *a, **k: Part(*a, tag='weapon', **k)
    def blade(k, ln, wid, col, guard=True, curve=0.0, hilt=4.8):
        ln *= sc; wid *= (1 + 0.12 * wt)
        g, d = J['palm' + k], J['wd' + k]
        hdp = (D(J['sh' + k]) + D(J['el' + k]) + D(J['ha' + k])) / 3 + 1.2 + 0.1
        pom, grd, tip = g - d * hilt, g + d * 2.4, g + d * (2.4 + ln)
        A, Bq, Cq = pr(pom), pr(grd), pr(tip)
        hp = WP(hdp - 0.05, L.get('hilt', '#3a2a20'), sig=0.8, spec=0.3, ol=2).cap(A[:2], Bq[:2], 1.25, 1.1)
        hp.mark(lambda d_, A=A, Bq=Bq: [d_.px(A[0] + (Bq[0] - A[0]) * u, A[1] + (Bq[1] - A[1]) * u, 3) for u in (0.3, 0.6)])
        out.append(hp)
        out.append(WP(hdp - 0.04, GOLD if wt else L.get('guard', '#c9a24a'), sig=0.6, spec=0.8, ol=2).ell(A[:2], 1.5 + 0.3 * wt))
        if wt: out.append(WP(hdp - 0.03, '#e8302a' if wt == 1 else glow, sig=0.5, spec=0.9, ol=0).ell(A[:2], 0.8))
        vx, vy = Cq[0] - Bq[0], Cq[1] - Bq[1]; ln2 = math.hypot(vx, vy)
        ux, uy = (vx / ln2, vy / ln2) if ln2 > 0.01 else (0, -1); nx, ny = -uy, ux
        if guard:
            gw = 3.4 + 0.9 * wt
            gp = WP(D(grd) + 0.15, GOLD if wt else L.get('guard', '#c9a24a'), sig=0.8, spec=0.8, ol=2)
            pts = [(Bq[0] + nx * gw - ux * 0.6, Bq[1] + ny * gw - uy * 0.6), (Bq[0] + ux * 1.2, Bq[1] + uy * 1.2),
                   (Bq[0] - nx * gw - ux * 0.6, Bq[1] - ny * gw - uy * 0.6), (Bq[0] - ux * 1.4, Bq[1] - uy * 1.4)]
            if wt == 2:   # chắn tay hình cánh
                pts = [(Bq[0] + nx * gw + ux * 1.6, Bq[1] + ny * gw + uy * 1.6), (Bq[0] + nx * 1.2 + ux * 0.4, Bq[1] + ny * 1.2 + uy * 0.4), (Bq[0] + ux * 1.6, Bq[1] + uy * 1.6),
                       (Bq[0] - nx * 1.2 + ux * 0.4, Bq[1] - ny * 1.2 + uy * 0.4), (Bq[0] - nx * gw + ux * 1.6, Bq[1] - ny * gw + uy * 1.6), (Bq[0] - nx * 2.2 - ux * 1.4, Bq[1] - ny * 2.2 - uy * 1.4),
                       (Bq[0] + nx * 2.2 - ux * 1.4, Bq[1] + ny * 2.2 - uy * 1.4)]
            gp.poly(pts)
            if wt: gp.mark(lambda d_, Bq=Bq, c=('#e8302a' if wt == 1 else glow): d_.ell(Bq[:2], 0.9, 0.9, c))
            out.append(gp)
        if ln2 < 2.5: return
        bdp = (D(grd) + D(tip)) / 2 + 0.1
        bp = WP(bdp, col, sig=0.9, spec=0.95, ol=2)
        if curve:
            back, edge = [], []
            for i in range(9):
                s = i / 8
                cx = Bq[0] + vx * s + nx * curve * s * s; cy = Bq[1] + vy * s + ny * curve * s * s
                ww = wid * (0.55 + 0.75 * s ** 0.8)
                back.append((cx + nx * ww * 0.35, cy + ny * ww * 0.35)); edge.append((cx - nx * ww * 0.65, cy - ny * ww * 0.65))
            tipp = (Cq[0] + nx * curve * 1.2 + ux * 1.5, Cq[1] + ny * curve * 1.2 + uy * 1.5)
            bp.poly(back + [tipp] + edge[::-1])
            bp.mark(lambda d_, back=back: d_.line(back[1:-1], 4, 0.6))
            if wt: bp.mark(lambda d_, back=back: [d_.px(x, y, 0) for x, y in back[2:-2:2]])
            if wt == 2: bp.mark(lambda d_, e=edge: d_.line(e[2:], light(glow, 0.5), 0.6))
        else:
            hw = wid / 2
            pts = [(Bq[0] + nx * hw, Bq[1] + ny * hw), (Cq[0] - ux * 2.6 + nx * hw * 0.85, Cq[1] - uy * 2.6 + ny * hw * 0.85), (Cq[0], Cq[1]),
                   (Cq[0] - ux * 2.6 - nx * hw * 0.85, Cq[1] - uy * 2.6 - ny * hw * 0.85), (Bq[0] - nx * hw, Bq[1] - ny * hw)]
            bp.poly(pts)
            ridge = [(Bq[0] + ux * 1.5 - nx * 0.4, Bq[1] + uy * 1.5 - ny * 0.4), (Cq[0] - ux * 3 - nx * 0.4, Cq[1] - uy * 3 - ny * 0.4)]
            bp.mark(lambda d_, r=ridge: d_.line(r, 1, 0.5))
            if wt == 1: bp.mark(lambda d_, B_=Bq, ux=ux, uy=uy: d_.line([(B_[0] + ux * 1.8, B_[1] + uy * 1.8), (B_[0] + ux * 7, B_[1] + uy * 7)], GOLD, 0.5))
            if wt == 2: bp.mark(lambda d_, p=pts: (d_.line([p[0], p[1]], light(glow, 0.55), 0.6), d_.line([p[4], p[3]], light(glow, 0.55), 0.6)))
        out.append(bp)
    if w == 'cane':     # gậy chống của trưởng lão: gỗ mấu, đầu uốn
        g, d = J['palmR'], J['wdR']
        e0, e1 = g - d * 47, g + d * 7
        hdp = (D(J['shR']) + D(J['elR']) + D(J['haR'])) / 3 + 1.2
        cp = WP(hdp - 0.05, L.get('wood', '#7a5230'), sig=0.9, spec=0.3, ol=2).cap(pr(e0)[:2], pr(e1)[:2], 1.4, 1.6).ell(pr(e1 + d * 1.5)[:2], 2.6, 2.4)
        cp.mark(lambda d_, a=pr(e0), b=pr(e1): [d_.px(a[0] + (b[0] - a[0]) * u + 1, a[1] + (b[1] - a[1]) * u, 1) for u in (0.25, 0.5, 0.72)])
        out.append(cp)
        if L.get('canegourd'):
            q = pr(e1 + d * 0.5 + V(0, 0, -5))
            out.append(WP(hdp - 0.04, '#c87a2a', sig=1.0, spec=0.4, ol=2).ell((q[0] + 2.5, q[1] + 1.5), 2.4, 2.6).ell((q[0] + 2.5, q[1] - 2), 1.6, 1.7))
    elif w == 'spear':  # giáo tiêu đầu: mũi lá liễu, tua đỏ
        g, d = J['palmR'], J['wdR']
        e0, e1 = g - d * 36, g + d * 44
        dp = (D(e0) + D(e1)) / 2 + 0.1
        hdp = (D(J['shR']) + D(J['elR']) + D(J['haR'])) / 3 + 1.2
        if abs(dp - hdp) < 6: dp = hdp - 0.05
        out.append(WP(dp, '#5a3a22', sig=0.9, spec=0.3, ol=2).cap(pr(e0)[:2], pr(e1)[:2], 1.3))
        A, Bq = pr(e1), pr(e1 + d * 10)
        vx, vy = Bq[0] - A[0], Bq[1] - A[1]; ln = math.hypot(vx, vy) or 1; nx, ny = -vy / ln * 2.2, vx / ln * 2.2
        out.append(WP(dp + 0.05, '#dfe6ee', sig=0.8, spec=0.95, ol=2).poly([(A[0] + nx * 0.5, A[1] + ny * 0.5), (A[0] + vx * 0.4 + nx, A[1] + vy * 0.4 + ny), (Bq[0], Bq[1]), (A[0] + vx * 0.4 - nx, A[1] + vy * 0.4 - ny), (A[0] - nx * 0.5, A[1] - ny * 0.5)]))
        tq = pr(e1 - d * 1.5)
        out.append(WP(dp + 0.04, '#d02a20', sig=0.8, spec=0.2, ol=2).poly([(tq[0] - 2.4, tq[1]), (tq[0] + 2.4, tq[1]), (tq[0] + 1.4, tq[1] + 6), (tq[0] - 1.6, tq[1] + 6.5)]))
    elif w == 'sword': blade('R', 27, 2.6, L['blade'])
    elif w == 'daggers':
        blade('R', 11, 2.4, L['blade'], hilt=3.4); blade('L', 11, 2.4, L['blade'], hilt=3.4)
    elif w == 'knife': blade('R', 10, 2.6, L['blade'], hilt=3.6)
    elif w == 'saber': blade('R', 23, 3.0, L['blade'], curve=2.6)
    if w == 'staff':
        g, d = J['palmR'], J['wdR']
        e0, e1 = g - d * 38 * sc, g + d * 44 * sc
        dp = (D(e0) + D(e1)) / 2 + 0.1
        hdp = (D(J['shR']) + D(J['elR']) + D(J['haR'])) / 3 + 1.2
        if abs(dp - hdp) < 6: dp = hdp - 0.05
        sp = WP(dp, L['wood'] if wt < 2 else '#5a2a18', sig=0.9, spec=0.35, ol=2).cap(pr(e0)[:2], pr(e1)[:2], 1.5 + 0.15 * wt)
        bands = [0.35, 0.65] if wt else []
        sp.mark(lambda d_, a=pr(e0), b=pr(e1), bands=bands: [d_.line([(a[0] + (b[0] - a[0]) * u - 1.6, a[1] + (b[1] - a[1]) * u), (a[0] + (b[0] - a[0]) * u + 1.6, a[1] + (b[1] - a[1]) * u)], GOLD, 0.8) for u in bands])
        out.append(sp)
        cl = 5 + 2 * wt
        out.append(WP(dp + 0.02, L['metal'], sig=0.8, spec=0.85, ol=2).cap(pr(e1)[:2], pr(e1 - d * cl)[:2], 1.9 + 0.3 * wt).cap(pr(e0)[:2], pr(e0 + d * (cl - 1))[:2], 1.8 + 0.3 * wt))
        rc = pr(e1 + d * (2.5 + wt))
        rg = WP(dp + 0.03, L['metal'], sig=0.7, spec=0.85, ol=0).ell(rc[:2], 3.6 + 0.6 * wt, 3.0 + 0.5 * wt).ell(rc[:2], 2.4 + 0.5 * wt, 1.9 + 0.4 * wt, fill=0)
        out.append(rg)
        for i in range([0, 2, 4][wt]):   # vòng thiếc treo trên đầu trượng
            a = (i / max(1, [0, 2, 4][wt]) - 0.5) * 2.4
            q = (rc[0] + math.sin(a) * (3.6 + 0.6 * wt), rc[1] + math.cos(a) * 2.4 + 1)
            out.append(WP(dp + 0.04, L['metal'], sig=0.5, spec=0.9, ol=0).ell(q, 1.3, 1.3).ell(q, 0.6, 0.6, fill=0))
        if wt == 2: out.append(WP(dp + 0.05, glow, sig=0.5, spec=0.9, ol=0).ell(rc[:2], 1.2, 1.2))
    elif w == 'hammer':
        g, d = J['palmR'], J['wdR']
        hdp = (D(J['shR']) + D(J['elR']) + D(J['haR'])) / 3 + 1.2
        s0, s1, hc = g - d * 6, g + d * 22 * sc, g + d * (27.5 * sc + wt)
        dp = (D(s0) + D(hc)) / 2 + 0.1
        out.append(WP(min(dp, hdp - 0.05) if abs(dp - hdp) < 5 else dp, L['wood'], sig=0.9, spec=0.3, ol=2).cap(pr(s0)[:2], pr(s1)[:2], 1.4))
        R_ = 5.8 + 0.9 * wt
        H_ = pr(hc); T_ = pr(hc + d * (R_ + 1 + 1.5 * wt))
        hp = WP(D(hc) + 0.2, L['metal'], sig=2.0, spec=0.9, ol=2).ell(H_[:2], R_, R_ * 0.96).poly([(T_[0], T_[1]), (H_[0] - 1.6, H_[1] - 1), (H_[0] + 1.6, H_[1] - 1)])
        if wt:   # gai quanh đầu chùy
            for i in range(6):
                a = i / 6 * TAU + 0.3
                bx, by = H_[0] + math.cos(a) * R_, H_[1] + math.sin(a) * R_ * 0.96
                hp.poly([(bx + math.cos(a) * (2 + wt), by + math.sin(a) * (2 + wt)), (bx - math.sin(a) * 1.3, by + math.cos(a) * 1.3), (bx + math.sin(a) * 1.3, by - math.cos(a) * 1.3)])
        a_ = pr(hc - d * (R_ - 0.3)); b_ = pr(hc + d * (R_ - 0.3))
        rib = light(glow, 0.3) if wt == 2 else 1
        hp.mark(lambda d_, a=a_, b=b_, H=H_, rib=rib: [d_.line([(a[0] + o, a[1]), (H[0] + o * 1.6, H[1]), (b[0] + o, b[1])], rib, 0.6) for o in (-2.6, 0, 2.6)])
        out.append(hp)
        out.append(WP(D(s1) + 0.1, L['metal'], sig=0.8, spec=0.85, ol=2).ell(pr(s1)[:2], 2.4 + 0.3 * wt, 2.0 + 0.3 * wt))
    return out


def helmet_parts(L, B, J, pr, view, ht, cx, cy, hd, helm):
    """mũ theo cấp: 1 khăn/vòng trán, 2 mão kim loại, 3 mão cánh (phượng quan với phái nữ). Kim loại gắn tag 'hmetal'"""
    st = L['hairstyle']; fem = B['fem']; glow = L['glow']
    side = view == 'right'
    HP = lambda dz, col, tag='helm', **k: Part(hd + dz, col, tag=tag, **k)
    HM = lambda dz, **k: Part(hd + dz, STEEL, tag='hmetal', neutral=True, sig=k.pop('sig', 1.0), spec=0.9, ol=k.pop('ol', 2), **k)
    sx = 0.62 if side else 1.0; ox = -1.5 if side else 0
    def X(dx): return cx + ox + dx * sx
    def crown(base, w, h, dz=0.5):
        p = HM(dz)
        p.poly([(X(-w), base), (X(w), base), (X(w * 0.85), base - h * 0.72), (X(w * 0.4), base - h * 0.5), (X(0), base - h), (X(-w * 0.4), base - h * 0.5), (X(-w * 0.85), base - h * 0.72)])
        p.mark(lambda d: (d.line([(X(-w + 0.6), base - 1), (X(w - 0.6), base - 1)], 1, 0.6), d.px(X(0), base - h * 0.55, 4)))
        return p
    def band(col, y0=-4.6, y1=-2.8, tag='helm', neutral=False):
        p = Part(hd + 0.35, col, tag=tag, neutral=neutral, sig=0.8, spec=0.5 if neutral else 0.25, ol=2)
        if view in DOWNS: p.poly([(cx - 7.2, cy + y0), (cx + 7.2, cy + y0), (cx + 7.1, cy + y1), (cx - 7.1, cy + y1)])
        elif side: p.poly([(cx - 8.4, cy + y0 + 0.6), (cx + 5.2, cy + y0 - 0.2), (cx + 5.3, cy + y1 - 0.2), (cx - 8.3, cy + y1 + 0.6)])
        else: p.poly([(cx - 7.2, cy + y0 + 0.6), (cx + 7.2, cy + y0 + 0.6), (cx + 7.1, cy + y1 + 0.6), (cx - 7.1, cy + y1 + 0.6)])
        return p
    if st == 'hat':
        hc3 = J['head']; Rh = J['Rh']
        base_c = hc3 + Rh @ V(0, 0.6, 4.2); D = lambda v: pr(v)[2]
        def ring(z, r):
            pts = [pr(base_c + Rh @ V(math.cos(a) * r, math.sin(a) * r, z)) for a in np.linspace(0, TAU, 24, endpoint=False)]
            cz = D(base_c + Rh @ V(0, 0, z))
            return sorted([p[:2] for p in pts if p[2] - cz > -1.5], key=lambda p: p[0])
        p = HM(1.0, sig=0.6)
        r_ = ring(3.4, 8.2)
        if len(r_) > 1: p.line(r_, 1.5)
        if ht >= 2:
            br = ring(0, 13.6)
            if len(br) > 1: p.line(br, 1.2)
            tp = pr(hc3 + Rh @ V(0, 0.6, 12.5)); p.poly([(tp[0] - 1.2, tp[1] + 0.5), (tp[0] + 1.2, tp[1] + 0.5), (tp[0], tp[1] - 3.5 - ht)])
        helm.append(p)
        if ht == 3:
            vl = HP(1.1, '#1a1a22', sig=0.6, ol=0)
            for x, y in ring(0, 13.4)[1:-1:2]: vl.line([(x, y + 0.5), (x + 0.3, y + 7.5)], 0.7)
            helm.append(vl)
            g = pr(base_c + Rh @ V(0, 8.2, 3.4)); helm.append(HP(1.2, glow, sig=0.5, spec=0.9, ol=2).ell(g[:2], 1.3, 1.3))
        return
    if st == 'turban':
        if ht == 1:
            p = HM(0.6, sig=0.5, ol=0)
            for x in range(-6, 7, 2):
                if side and x < -2: continue
                p.ell((X(x), cy - 2.0 + abs(x) * 0.05), 0.8)
            p.ell((X(0), cy - 0.6), 1.1)
            helm.append(p); return
        helm.append(band(STEEL, -5.2, -3.0, 'hmetal', True))
        if ht == 2:
            helm.append(HM(0.6).poly([(X(-2.4), cy - 4.6), (X(2.4), cy - 4.6), (X(1.6), cy - 11), (X(0), cy - 12.4), (X(-1.6), cy - 11)]))
            if not view in UPS: helm.append(HP(0.7, glow, sig=0.5, spec=0.9, ol=2).ell((X(0), cy - 7.4), 1.2, 1.2))
            return
        # sừng bạc kiểu H'Mông
        hr = HM(0.6, sig=1.2)
        for s in ((-1, 1) if not side else (-1,)):
            pts = [(X(s * 2), cy - 6.5), (X(s * 7.5), cy - 9), (X(s * 12.5), cy - 15), (X(s * 13), cy - 19.5), (X(s * 10.5), cy - 15.5), (X(s * 6.5), cy - 11.5), (X(s * 1.5), cy - 9.5)]
            hr.poly(pts)
        hr.mark(lambda d: [d.px(X(x), cy - 3.4, '#ffffff') for x in range(-6, 7, 3)])
        helm.append(hr)
        drops = HM(0.65, sig=0.4, ol=0)
        for x in (-6, -3, 3, 6):
            if side and x < 0: continue
            drops.line([(X(x), cy - 3), (X(x), cy + 0.5)], 0.5).ell((X(x), cy + 1), 0.7)
        helm.append(drops)
        return
    if st == 'bald':
        helm.append(band(STEEL, -4.4, -3.0, 'hmetal', True))
        if ht >= 2:   # mão ngũ Phật: 5 cánh sen trước trán
            p = HM(0.55)
            n = 5 if not side else 3
            for i in range(n):
                x = (i - (n - 1) / 2) * 2.8
                h = 5.5 + (2.5 if i == (n - 1) // 2 else 0) + (2 if ht == 3 else 0)
                p.poly([(X(x - 1.5), cy - 4.2), (X(x + 1.5), cy - 4.2), (X(x + 1.1), cy - 4.2 - h * 0.7), (X(x), cy - 4.2 - h), (X(x - 1.1), cy - 4.2 - h * 0.7)])
            if view not in UPS: p.mark(lambda d: d.ell((X(0), cy - 7.5), 0.9, 0.9, glow))
            helm.append(p)
        if ht == 3 and view != 'right':
            helm.append(HP(-6, GOLD, sig=0.5, spec=0.9, ol=0).ell((cx, cy - 2), 10.5, 10.5).ell((cx, cy - 2), 9.4, 9.4, fill=0))
        return
    base = cy - 13.6 if st == 'official' else cy - 6.4
    if ht == 1:
        if st == 'official':
            helm.append(band(STEEL, -8.6, -7.0, 'hmetal', True))
        else:
            helm.append(band(L['trim'], -4.6, -2.9))
            if view not in UPS: helm.append(HM(0.45, sig=0.5).ell((X(0) if not side else cx + 4.6, cy - 3.75), 1.6, 1.3))
        return
    w, h = (4.6, 5.2) if ht == 2 else (5.2, 6.6)
    helm.append(crown(base, w, h))
    if ht == 2:
        helm.append(HP(0.6, GOLD, sig=0.5, spec=0.9, ol=0).line([(X(-w - 2.6), base - 2.2), (X(w + 2.6), base - 1.8)], 0.9))
        return
    if view not in UPS: helm.append(HP(0.7, glow, sig=0.5, spec=0.9, ol=2).ell((X(0), base - 2.6), 1.3, 1.3))
    wg = HM(0.45, sig=1.0)   # cánh hai bên mão
    for s in ((-1, 1) if not side else (1,)):
        wg.poly([(X(s * w * 0.8), base - 1), (X(s * (w + 5.5)), base - 5.5), (X(s * (w + 6.5)), base - 9), (X(s * (w + 3)), base - 5.4), (X(s * w * 0.6), base - 3.4)])
    wg.mark(lambda d: [d.line([(X(s * (w + 1)), base - 2.6), (X(s * (w + 5)), base - 6.4)], 1, 0.5) for s in (-1, 1)])
    helm.append(wg)
    if fem:   # chuỗi hạt rủ hai bên phượng quan
        bd = HP(0.4, '#f4e0a0', sig=0.4, spec=0.8, ol=0)
        for s in ((-1, 1) if not side else (1,)):
            for j in range(3):
                x = X(s * (w + 1 + j * 1.6))
                bd.line([(x, base - 1), (x, base + 4 + j * 1.2)], 0.4).ell((x, base + 4.6 + j * 1.2), 0.7)
        helm.append(bd)
    else:         # lông trĩ cắm sau mão
        pl = HP(-0.2, '#e8c070', sig=0.6, spec=0.4, ol=2)
        for s in ((-1, 1) if view != 'right' else (-1,)):
            pts = [(X(s * 1.5) + (s * 0 if view != 'right' else -2), base - h + 1)]
            for i in range(1, 7):
                u = i / 6
                if view == 'right': pts.append((X(-1.5) - u * 16, base - h - 4 - math.sin(u * 2.4) * 10))
                else: pts.append((X(s * (1.5 + u * 9)), base - h - 2 - u * 16 + u * u * 6))
            pl.ribbon(pts, 2.2, 1.0)
            pl.mark(lambda d, pts=pts: [d.px(x, y, 0) for x, y in pts[1::2]])
        helm.append(pl)


def head_parts(L, B, J, pr, view, parts, CH, P, ht=0, helm=None):
    n0 = len(parts)
    helm = [] if helm is None else helm
    _head_parts(L, B, J, pr, view, parts, CH, P, ht, helm)
    up = pr(J['head'] + J['Rh'] @ V(0, 0, 6)); hc = pr(J['head'])
    ang = math.atan2(up[0] - hc[0], -(up[1] - hc[1]))
    if abs(ang) > 0.3:
        for pt in parts[n0 + 1:] + helm: pt.rot = (int(round(hc[0])), int(round(hc[1])), ang)

def _head_parts(L, B, J, pr, view, parts, CH, P, htier, helm):
    vx = view; view = BASEV.get(view, view)
    hc3 = J['head']; h = pr(hc3)
    cx, cy = int(round(h[0])), int(round(h[1])); dp = h[2]
    skin, hair = L['skin'], L.get('hair') or '#202020'
    fem = B['fem']; st = L['hairstyle']
    fwd = J['Rh'] @ V(0, 1, 0)
    fs = int(max(-2, min(2, round(-fwd[0] * 4)))) if view in DOWNS else 0
    if vx == 'dr': fs = min(3, fs + 2)   # mặt 3/4: ngũ quan dồn về phía quay
    # cổ
    nb = pr(J['neck']); nt = pr(hc3 + J['Rh'] @ V(0, 0, -6))
    parts.append(Part(pr(J['chest'])[2] - 0.1, skin, sig=1.6, spec=0.03).cap(nb[:2], nt[:2], 2.7, 2.4))
    hp = Part(dp + 3, skin, sig=2.6, spec=0.05)
    if view in DOWNS:
        hp.ell((cx, cy - 1), 6.4, 7.0)
        hp.poly([(cx - 6.3, cy), (cx - 5.4, cy + 4), (cx - 3, cy + 7), (cx - 1, cy + 8.2 - (0.3 if fem else 0)), (cx + 1, cy + 8.2 - (0.3 if fem else 0)), (cx + 3, cy + 7), (cx + 5.4, cy + 4), (cx + 6.3, cy)])
        if st not in ('buns', 'turban'): hp.ell((cx - 6.5, cy + 1.6), 1.3, 2.1).ell((cx + 6.5, cy + 1.6), 1.3, 2.1)
        def face(d, cx=cx + fs, cy=cy):
            # mắt vẽ ở nửa điểm ảnh: mí trên đậm + đuôi hất, tròng trắng, mống mắt 3 tông, đồng tử, đốm sáng, mí dưới nhạt
            lid, iris, white = '#22141c', L.get('eyecol', '#3a2216'), L.get('eyewhite', '#f6f2ee')
            irl, pup = mix(iris, '#e8d0a0', 0.45), '#0e080c'
            bc = L.get('hair') or '#8a5a3a'
            if st == 'bald': bc = '#6a4028'
            for ex, s in ((cx - 3, -1), (cx + 3, 1)):
                for k in range(-3, 4): d.hp(ex + k * 0.5, cy + 1.0, lid)
                d.hp(ex + s * 2.0, cy + 0.5, lid)
                if fem: d.hp(ex + s * 2.5, cy + 0.0, lid); d.hp(ex + s * 2.0, cy + 1.0, lid)
                for yy in (1.5, 2.0, 2.5, 3.0):
                    for k in (-3, -2, 2, 3):
                        if yy == 3.0 and abs(k) == 3: continue
                        d.hp(ex + k * 0.5, cy + yy, white)
                ix = ex - s * 0.25
                for k in (-1, 0, 1):
                    d.hp(ix + k * 0.5, cy + 1.5, mix(iris, lid, 0.45))
                    d.hp(ix + k * 0.5, cy + 2.0, iris); d.hp(ix + k * 0.5, cy + 2.5, iris)
                    d.hp(ix + k * 0.5, cy + 3.0, irl)
                d.hp(ix, cy + 2.0, pup); d.hp(ix, cy + 2.5, pup)
                d.hp(ix - 0.5, cy + 1.5, '#ffffff'); d.hp(ix + 0.5, cy + 3.0, mix(irl, '#ffffff', 0.4))
                for k in range(-2, 3): d.hp(ex + k * 0.5, cy + 3.5, 2)
                # lông mày: đầu trong dày, đuôi thanh hất lên
                if L.get('beard') == 'full':
                    for k in range(-3, 4): d.hp(ex + k * 0.5, cy - 1.0, bc); d.hp(ex + k * 0.5, cy - 1.5, bc)
                    d.hp(ex + s * 2.0, cy - 2.0, bc)
                else:   # cung mày cong nhẹ: giữa cao, hai đầu thấp (không chau)
                    for k in range(-3, 4):
                        d.hp(ex + k * 0.5, cy - 1.0 - (0.5 if abs(k) <= 1 else 0), bc)
                    if not fem: d.hp(ex - s * 1.5, cy - 0.5, mix(bc, skin, 0.4))
            # mũi: bóng sống mũi + chóp mũi; môi: khe môi + môi dưới sáng
            d.hp(cx + 0.5, cy + 3.0, 2); d.hp(cx + 0.5, cy + 3.5, 2); d.hp(cx + 0.5, cy + 4.0, 1); d.hp(cx, cy + 4.5, 1); d.hp(cx - 0.5, cy + 3.5, 5)
            lip = mix(skin, '#c0304a', 0.55 if fem else 0.3); lipd = mix(lip, '#3a1018', 0.45)
            for k in (-2, -1, 0, 1): d.hp(cx + k * 0.5, cy + 6.0, lipd)
            for k in (-1, 0): d.hp(cx + k * 0.5, cy + 6.5, mix(lip, '#ffffff', 0.25) if fem else lip)
            if fem:
                for x in (cx - 4.5, cx - 4.0, cx + 3.5, cx + 4.0): d.hp(x, cy + 4.5, mix(skin, '#ff6a8a', 0.4))
            if L.get('old'):
                for ex in (cx - 3, cx + 3): d.px(ex - 1, cy + 3, 1); d.px(ex + 1, cy + 3, 1)
                d.px(cx - 4, cy + 5, 1); d.px(cx + 4, cy + 5, 1)
            if L.get('mustache'):
                for x in (cx - 2, cx - 1, cx, cx + 1): d.px(x, cy + 5, hair)
                d.px(cx - 0.5, cy + 8, hair)
            if L.get('beard') == 'stubble':
                for x in range(cx - 4, cx + 5):
                    if (x + cy) % 2 == 0: d.px(x, cy + 7 - (1 if abs(x - cx) > 2 else 0), mix(skin, hair, 0.45))
        if st != 'hat' or True: hp.mark(face)
    elif view == 'right':
        hp.ell((cx - 1, cy - 1), 6.6, 7.0)
        hp.poly([(cx + 1, cy - 7), (cx + 4.8, cy - 4.5), (cx + 5.6, cy - 1), (cx + 5.4, cy + 0.8), (cx + 6.8, cy + 3.4), (cx + 5.6, cy + 4.4),
                 (cx + 5.9, cy + 5.6), (cx + 5.2, cy + 6.6), (cx + 4.6, cy + 8.2 - (0.4 if fem else 0)), (cx + 2, cy + 8.4), (cx - 1.5, cy + 6), (cx - 3, cy + 3)])
        def face(d, cx=cx, cy=cy):
            lid, iris = '#22141c', L.get('eyecol', '#3a2216')
            for k in range(5): d.hp(cx + 2.5 + k * 0.5, cy + 1.0, lid)
            if fem: d.hp(cx + 5.0, cy + 0.5, lid)
            for yy in (1.5, 2.0): d.hp(cx + 2.5, cy + yy, '#f6f2ee'); d.hp(cx + 3.0, cy + yy, '#f6f2ee')
            for yy in (1.5, 2.0, 2.5): d.hp(cx + 3.5, cy + yy, iris); d.hp(cx + 4.0, cy + yy, mix(iris, '#e8d0a0', 0.3) if yy == 2.5 else iris)
            d.hp(cx + 4.0, cy + 2.0, '#0e080c'); d.hp(cx + 3.5, cy + 1.5, '#ffffff')
            for k in range(4): d.hp(cx + 2.5 + k * 0.5, cy + 3.0, 2)
            bc = (L.get('hair') or '#6a4028')
            for k in range(6): d.hp(cx + 2.5 + k * 0.5, cy - 1.0 - (0.5 if k >= 4 else 0), bc)
            d.hp(cx + 6.0, cy + 4.0, 1); d.hp(cx + 5.5, cy + 4.5, 2)
            d.px(cx + 5, cy + 6, mix(skin, '#c0304a', 0.5 if fem else 0.3))
            d.px(cx + 6, cy + 4, 1)
            if L.get('mustache'): d.px(cx + 5, cy + 5, hair); d.px(cx + 4, cy + 5, hair)
            if L.get('beard') == 'stubble':
                for x in range(cx, cx + 5):
                    if (x + cy) % 2 == 0: d.px(x, cy + 7, mix(skin, hair, 0.45))
        hp.mark(face)
    else:
        hp.ell((cx, cy - 1), 6.5, 7.1)
        hp.poly([(cx - 5, cy + 3), (cx + 5, cy + 3), (cx + 3.6, cy + 7.4), (cx - 3.6, cy + 7.4)])
        hp.ell((cx - 6.5, cy + 1.6), 1.3, 2.1).ell((cx + 6.5, cy + 1.6), 1.3, 2.1)
    if st == 'bald':
        if view in DOWNS: hp.mark(lambda d: [d.px(cx + x, cy + y, '#9a5a34') for x, y in ((-2, -5), (0, -5), (2, -5), (-1, -3), (1, -3))])
        elif view == 'right': hp.mark(lambda d: [d.px(cx + x, cy + y, '#9a5a34') for x, y in ((0, -6), (2, -5), (1, -3))])
    parts.append(hp)
    if view == 'right' and st not in ('buns', 'turban', 'bald'):
        ep = Part(dp + 3.8, skin, sig=0.8, spec=0.03, ol=2).ell((cx - 1.4, cy + 1.6), 1.6, 2.2)
        ep.mark(lambda d: d.px(cx - 1, cy + 2, 1))
        parts.append(ep)
    # ----- tóc / mũ -----
    hd = dp + 3.5
    def cap(bangs):
        hp2 = Part(hd, hair, sig=2.0, spec=0.55); hp2.hair = True
        if view in DOWNS:
            hp2.ell((cx, cy - 2.2), 7.0, 6.6)
            if bangs == 'part':
                hp2.erase([(cx - 5.6, cy - 1.5), (cx - 3.2, cy - 3.6), (cx - 0.6, cy - 4.8), (cx, cy - 4.0), (cx + 0.6, cy - 4.8), (cx + 3.2, cy - 3.6), (cx + 5.6, cy - 1.5), (cx + 5.6, cy + 9), (cx - 5.6, cy + 9)])
                hp2.poly([(cx - 7, cy - 2.4), (cx - 5.0, cy - 2.4), (cx - 5.3, cy + 5.0), (cx - 6.9, cy + 4.2)])
                hp2.poly([(cx + 7, cy - 2.4), (cx + 5.0, cy - 2.4), (cx + 5.3, cy + 5.0), (cx + 6.9, cy + 4.2)])
            elif bangs == 'full':
                pts = [(cx - 5.8, cy + 9), (cx - 5.8, cy - 0.6)]
                for i in range(7):
                    x = cx - 5.8 + 11.6 * (i + 0.5) / 7
                    pts += [(x - 0.5, cy - 0.4 + (0.6 if i % 2 else 0)), (x + 0.8, cy - 2.2)]
                pts += [(cx + 5.8, cy - 0.6), (cx + 5.8, cy + 9)]
                hp2.erase(pts)
            else:   # chải ngược, trán cao
                hp2.erase([(cx - 5.8, cy - 2.2), (cx - 3, cy - 4.4), (cx, cy - 4.9), (cx + 3, cy - 4.4), (cx + 5.8, cy - 2.2), (cx + 5.8, cy + 9), (cx - 5.8, cy + 9)])
            hp2.mark(lambda d: (d.line([(cx - 1, cy - 8), (cx - 4, cy - 4)], 1, 0.6), d.line([(cx + 1, cy - 8), (cx + 4, cy - 4.5)], 1, 0.6)))
        elif view == 'right':
            hp2.ell((cx - 1.3, cy - 2.2), 7.2, 6.7)
            hp2.erase([(cx + 0.6, cy - 3.4), (cx + 3.4, cy - 4.6 if bangs != 'swept' else -5.2 + cy), (cx + 9, cy - 5), (cx + 9, cy + 10), (cx - 0.2, cy + 10), (cx - 0.2, cy + 0.4)])
            hp2.poly([(cx - 0.4, cy - 1.2), (cx + 1.0, cy - 1.2), (cx + 0.7, cy + 2.6), (cx - 0.3, cy + 2.6)])
            if bangs == 'full': hp2.poly([(cx + 0.4, cy - 4.2), (cx + 5.6, cy - 5.0), (cx + 5.0, cy - 1.6), (cx + 2.4, cy - 2.4)])
            hp2.mark(lambda d: d.line([(cx - 6, cy - 4), (cx - 1, cy - 8)], 1, 0.6))
        else:
            hp2.ell((cx, cy - 1.6), 7.0, 7.0)
            hp2.poly([(cx - 6.4, cy - 1), (cx + 6.4, cy - 1), (cx + 5.0, cy + 6.4), (cx - 5.0, cy + 6.4)])
            hp2.mark(lambda d: (d.line([(cx, cy - 8), (cx - 2, cy + 5)], 1, 0.6), d.line([(cx + 3, cy - 7), (cx + 3.5, cy + 4)], 1, 0.6)))
        return hp2
    def acc(col, sig=1.0, spec=0.6, z=0.2, ol=2): return Part(hd + z, col, sig=sig, spec=spec, ol=ol)
    if st == 'topknot':
        parts.append(cap('part'))
        bx = cx - (1.5 if view == 'right' else 0)
        parts.append(acc(hair, 1.2, 0.6).ell((bx, cy - 8.8), 2.9, 2.5))
        parts.append(acc('#dfe4ee', 0.8, 0.9, 0.3).poly([(bx - 2.6, cy - 8.0), (bx + 2.6, cy - 8.0), (bx + 1.8, cy - 11.4), (bx - 1.8, cy - 11.4)]))
        parts.append(acc(L['guard'], 0.6, 0.8, 0.4, 0).line([(bx - 4.6, cy - 9.8), (bx + 4.6, cy - 9.4)], 0.9))
    elif st == 'buns':
        parts.append(cap('part'))
        buns = [(cx - 5.2, cy - 6.8), (cx + 5.2, cy - 6.8)] if view != 'right' else [(cx - 2.8, cy - 7.8)]
        for b in buns:
            parts.append(acc(hair, 1.3, 0.6).ell(b, 3.0, 2.8))
            parts.append(acc('#ff8ab8', 0.5, 0.3, 0.3, 0).ell((b[0], b[1] + 2.0), 1.4, 0.9))
        if view in DOWNS: parts.append(acc('#ffd0e4', 0.5, 0.5, 0.35, 0).ell((cx, cy - 8.2), 1.2, 1.0))
    elif st == 'ponytail':
        parts.append(cap('part'))
        if view == 'right': parts.append(acc(hair, 1.0, 0.6).ell((cx - 5.6, cy - 5.6), 2.2, 2.2)); parts.append(acc(L['trim'], 0.6, 0.3, 0.3, 0).line([(cx - 5.6, cy - 7.6), (cx - 5.6, cy - 3.8)], 1.1))
        elif view in UPS: parts.append(acc(hair, 1.0, 0.6).ell((cx, cy - 4.6), 2.4, 2.2)); parts.append(acc(L['trim'], 0.6, 0.3, 0.3, 0).line([(cx - 2.2, cy - 4.4), (cx + 2.2, cy - 4.4)], 1.1))
        else: parts.append(acc(L['trim'], 0.6, 0.3, 0.3, 0).line([(cx - 1.6, cy - 8.6), (cx + 1.6, cy - 8.6)], 1.0))
    elif st == 'warrior':
        parts.append(cap('swept'))
        bx = cx - (1.5 if view == 'right' else 0)
        parts.append(acc(hair, 1.0, 0.6).ell((bx, cy - 8.6), 2.4, 2.1))
        band = acc(L['headband'], 0.8, 0.25, 0.3)
        if view in DOWNS: band.poly([(cx - 7.2, cy - 4.6), (cx + 7.2, cy - 4.6), (cx + 7.1, cy - 2.8), (cx - 7.1, cy - 2.8)])
        elif view == 'right': band.poly([(cx - 8.4, cy - 4.0), (cx + 5.2, cy - 4.8), (cx + 5.3, cy - 3.0), (cx - 8.3, cy - 2.2)])
        else: band.poly([(cx - 7.2, cy - 4.0), (cx + 7.2, cy - 4.0), (cx + 7.1, cy - 2.2), (cx - 7.1, cy - 2.2)]).ell((cx, cy - 3.1), 1.8, 1.4)
        if view in DOWNS: band.mark(lambda d: (d.px(cx - 1, cy - 4, L['metal']), d.px(cx, cy - 4, L['metal'])))
        parts.append(band)
        bd = Part(dp + 3.3, hair, sig=1.4, spec=0.35, ol=2)
        if view in DOWNS:
            bd.poly([(cx - 6.4, cy + 0.5), (cx - 5.8, cy + 5), (cx - 3.4, cy + 9.6), (cx, cy + 11.2), (cx + 3.4, cy + 9.6), (cx + 5.8, cy + 5), (cx + 6.4, cy + 0.5), (cx + 4.6, cy + 3), (cx + 2.6, cy + 4.6), (cx, cy + 4.4), (cx - 2.6, cy + 4.6), (cx - 4.6, cy + 3)])
            bd.erase([(cx - 1.8, cy + 5.6), (cx + 1.8, cy + 5.6), (cx + 1.2, cy + 7.0), (cx - 1.2, cy + 7.0)])
            bd.mark(lambda d: (d.line([(cx - 2, cy + 8), (cx - 1, cy + 10.4)], 1, 0.5), d.line([(cx + 2, cy + 8), (cx + 1, cy + 10.4)], 1, 0.5)))
        elif view == 'right':
            bd.poly([(cx - 0.4, cy + 2.4), (cx + 1.6, cy + 1.2), (cx + 4.4, cy + 4.6), (cx + 6.2, cy + 5.0), (cx + 5.6, cy + 7.4), (cx + 4.4, cy + 10.6), (cx + 1.6, cy + 10.4), (cx - 0.6, cy + 7)])
        if bd.ops: parts.append(bd)
    elif st == 'hat':
        parts.append(cap('full'))
        # nón lá tre hình chóp (dựng 3D để nghiêng theo đầu)
        base_c = hc3 + J['Rh'] @ V(0, 0.6, 4.2)
        brim = [pr(base_c + J['Rh'] @ V(math.cos(a) * 13.5, math.sin(a) * 13.5, 0)) for a in np.linspace(0, TAU, 24, endpoint=False)]
        tip = pr(hc3 + J['Rh'] @ V(0, 0.6, 12.5))
        ht = Part(dp + 4.2, L['straw'], sig=2.2, spec=0.15)
        ht.poly(hull([b[:2] for b in brim] + [tip[:2]]))
        def weave(d, brim=brim, tip=tip):
            for i in range(0, 24, 3): d.line([tip[:2], brim[i][:2]], 1, 0.5)
            fr = [b for b in brim if b[2] - pr(base_c)[2] > -2]
            if len(fr) > 2: d.line([b[:2] for b in sorted(fr, key=lambda b: b[0])], 0, 0.7)
        ht.mark(weave)
        parts.append(ht)
        parts.append(Part(dp + 4.3, '#c8c08a', sig=0.6, spec=0.5, ol=2).ell(tip[:2], 1.2))
        mk = Part(dp + 3.4, L.get('mask') or '#000000', sig=1.4, spec=0.1, ol=2)
        if view in DOWNS: mk.poly([(cx - 6.5, cy + 2.8), (cx + 6.5, cy + 2.8), (cx + 5.5, cy + 5), (cx + 3, cy + 7.6), (cx, cy + 8.9), (cx - 3, cy + 7.6), (cx - 5.5, cy + 5)])
        elif view == 'right': mk.poly([(cx + 0.2, cy + 2.6), (cx + 7.2, cy + 2.6), (cx + 6.4, cy + 6.2), (cx + 4.6, cy + 8.8), (cx + 0.6, cy + 8.8)])
        if mk.ops and L.get('mask'): parts.append(mk)
    elif st == 'turban':
        tb = Part(hd, '#231a3c', sig=2.0, spec=0.25)
        if view in DOWNS:
            tb.ell((cx, cy - 3.2), 7.6, 6.6).erase([(cx - 6.2, cy - 1.8), (cx + 6.2, cy - 1.8), (cx + 6.2, cy + 9), (cx - 6.2, cy + 9)])
        elif view == 'right':
            tb.ell((cx - 1.2, cy - 3.2), 7.8, 6.6).erase([(cx + 0.4, cy - 1.8), (cx + 9, cy - 2.4), (cx + 9, cy + 10), (cx + 0.4, cy + 10)])
        else:
            tb.ell((cx, cy - 2.4), 7.6, 7.0).poly([(cx - 6.4, cy - 1), (cx + 6.4, cy - 1), (cx + 4.8, cy + 5.6), (cx - 4.8, cy + 5.6)])
        tb.mark(lambda d: [d.line([(cx - 7 + i * 3.4, cy - 8 + i * 0.6), (cx - 4 + i * 3.4, cy - 2)], 1, 0.6) for i in range(4)])
        tb.mark(lambda d: d.line([(cx - 7.4, cy - 2.4), (cx + 7.4, cy - 2.4)], L['trim'], 0.9))
        parts.append(tb)
        if view not in UPS:
            ox = cx if view in DOWNS else cx + 3.2
            parts.append(acc(L['silver'], 0.8, 0.9, 0.3).ell((ox, cy - 4.6), 1.9, 1.9))
            parts.append(acc(L['trim'], 0.4, 0.7, 0.4, 0).ell((ox, cy - 4.6), 0.8, 0.8))
            vl = Part(dp + 3.4, L['veil'], sig=1.4, spec=0.1, ol=2)
            if view in DOWNS: vl.poly([(cx - 6.4, cy + 4.4), (cx + 6.4, cy + 4.4), (cx + 5.5, cy + 6.2), (cx + 3, cy + 8.6), (cx, cy + 9.8), (cx - 3, cy + 8.6), (cx - 5.5, cy + 6.2)])
            else: vl.poly([(cx + 0.4, cy + 3.2), (cx + 7.2, cy + 3.0), (cx + 6.4, cy + 6.6), (cx + 4.6, cy + 9.4), (cx + 0.8, cy + 9.4)])
            sv = L['silver']
            vl.mark(lambda d: [d.px(x, cy + 4 if view in DOWNS else cy + 3, sv) for x in (range(cx - 5, cx + 6, 2) if view in DOWNS else range(cx + 1, cx + 7, 2))])
            parts.append(vl)
    elif st == 'messy':
        hp2 = cap('full')
        sp = [(-6, -6, -9.6), (-3, -8, -11), (0, -8.6, -12), (3, -8, -11), (6, -6, -9.4)] if view != 'right' else [(-7, -5, -7.5), (-4.5, -7.5, -10.5), (-1.5, -8.6, -11.8), (1.5, -8, -10.6)]
        for x, y0, y1 in sp: hp2.poly([(cx + x - 2, cy + y0 + 1.5), (cx + x + 2, cy + y0 + 1.5), (cx + x + 0.8 + x * 0.12, cy + y1)])
        parts.append(hp2)
        rag = acc('#6a5a44', 0.8, 0.1, 0.25)
        if view in DOWNS: rag.poly([(cx - 7.2, cy - 4.4), (cx + 7.2, cy - 4.4), (cx + 7, cy - 3.0), (cx - 7, cy - 3.0)])
        elif view == 'right': rag.poly([(cx - 8.4, cy - 3.8), (cx + 5, cy - 4.6), (cx + 5.1, cy - 3.2), (cx - 8.3, cy - 2.4)])
        else: rag.poly([(cx - 7.2, cy - 3.8), (cx + 7.2, cy - 3.8), (cx + 7, cy - 2.4), (cx - 7, cy - 2.4)])
        parts.append(rag)
    elif st == 'cap':     # mũ quả dưa chưởng quỹ
        parts.append(cap('swept'))
        cp = acc('#1e1a22', 1.6, 0.35, 0.4, 3)
        if view in DOWNS: cp.ell((cx, cy - 3.6), 7.3, 5.8).erase([(cx - 8, cy - 2.6), (cx + 8, cy - 2.6), (cx + 8, cy + 6), (cx - 8, cy + 6)])
        elif view == 'right': cp.ell((cx - 1.2, cy - 3.6), 7.4, 5.8).erase([(cx - 9, cy - 2.4), (cx + 8, cy - 3.0), (cx + 8, cy + 6), (cx - 9, cy + 6)])
        else: cp.ell((cx, cy - 3.2), 7.3, 6.0).erase([(cx - 8, cy - 1.8), (cx + 8, cy - 1.8), (cx + 8, cy + 6), (cx - 8, cy + 6)])
        cp.mark(lambda d: [d.line([(cx + x, cy - 9), (cx + x * 1.5, cy - 3)], 1, 0.5) for x in (-3, 0, 3)])
        parts.append(cp)
        parts.append(acc('#d02a20', 0.6, 0.5, 0.5).ell((cx - (1 if view == 'right' else 0), cy - 9.4), 1.3, 1.2))
    elif st == 'official':
        parts.append(cap('swept'))
        hcol = '#1d1a26'
        hat = acc(hcol, 1.6, 0.35, 0.4, 3)
        if view in DOWNS: q = [(cx - 4.8, cy - 6.4), (cx + 4.8, cy - 6.4), (cx + 4.0, cy - 13.6), (cx - 4.0, cy - 13.6)]
        elif view == 'right': q = [(cx - 5.8, cy - 6.0), (cx + 3.0, cy - 6.6), (cx + 2.0, cy - 13.6), (cx - 4.6, cy - 13.2)]
        else: q = [(cx - 4.8, cy - 6.2), (cx + 4.8, cy - 6.2), (cx + 4.0, cy - 13.4), (cx - 4.0, cy - 13.4)]
        hat.poly(q)
        hat.mark(lambda d, q=q: (d.line([(q[0][0] + 0.4, q[0][1] - 1.6), (q[1][0] - 0.4, q[1][1] - 1.6)], '#f2c24e', 0.9), d.line([(q[3][0], q[3][1] + 0.6), (q[2][0], q[2][1] + 0.6)], '#f2c24e', 0.7)))
        parts.append(hat)
        topc = ((q[2][0] + q[3][0]) / 2, (q[2][1] + q[3][1]) / 2 - 1.4)
        parts.append(acc('#f2c24e', 0.6, 0.9, 0.5).ell(topc, 1.6, 1.4))
        if view in DOWNS: parts.append(acc('#e8402a', 0.4, 0.5, 0.5, 0).ell((cx, cy - 9.6), 1.0, 1.0))
    if L.get('beard') == 'long' and view not in UPS:
        bc = L.get('beardcol', hair)
        bd = Part(dp + 3.3, bc, sig=1.4, spec=0.45, ol=2)
        if view in DOWNS:
            bd.poly([(cx - 5.8, cy + 2.6), (cx - 5.0, cy + 8), (cx - 2.8, cy + 13), (cx, cy + 18), (cx + 2.8, cy + 13), (cx + 5.0, cy + 8), (cx + 5.8, cy + 2.6), (cx + 3.8, cy + 4.6), (cx + 1.4, cy + 5.4), (cx - 1.4, cy + 5.4), (cx - 3.8, cy + 4.6)])
            bd.erase([(cx - 1.6, cy + 5.8), (cx + 1.6, cy + 5.8), (cx + 1.0, cy + 7.0), (cx - 1.0, cy + 7.0)])
            bd.mark(lambda d: (d.line([(cx - 2.4, cy + 9), (cx - 1, cy + 15)], 1, 0.5), d.line([(cx + 2.2, cy + 9), (cx + 0.8, cy + 15)], 1, 0.5), d.line([(cx - 4, cy + 4.8), (cx - 1, cy + 5.2)], 3, 0.6), d.line([(cx + 1, cy + 5.2), (cx + 4, cy + 4.8)], 3, 0.6)))
        else:
            bd.poly([(cx + 0.8, cy + 2.6), (cx + 5.0, cy + 4.6), (cx + 6.2, cy + 6.5), (cx + 5.6, cy + 11), (cx + 4.2, cy + 17), (cx + 2.4, cy + 12), (cx - 0.6, cy + 7)])
            bd.mark(lambda d: d.line([(cx + 3.6, cy + 8), (cx + 3.8, cy + 14)], 1, 0.5))
        parts.append(bd)
    if L.get('horns'):   # sừng (ma đầu): cong ra ngoài rồi vút lên, mặt trái sáng
        hcol = L['horns']
        if view == 'right':
            specs = [((cx - 2.6, cy - 6.4), [(cx - 6.0, cy - 10.5), (cx - 9.6, cy - 13.0), (cx - 11.2, cy - 17.5)], -0.4),
                     ((cx + 1.6, cy - 6.8), [(cx - 0.6, cy - 11.5), (cx - 3.4, cy - 14.8), (cx - 4.2, cy - 19.5)], 0.4)]
        else:
            specs = [((cx + sx * 4.4, cy - 5.6), [(cx + sx * 7.8, cy - 9.8), (cx + sx * 9.2, cy - 14.4), (cx + sx * 7.6, cy - 19.0)], 0.5 if view in DOWNS else -0.5) for sx in (-1, 1)]
        for b, pts, z in specs:
            hn = Part(hd + z, hcol, sig=1.2, spec=0.55, ol=2).ribbon([b] + pts, 3.6, 0.5)
            hn.mark(lambda d, b=b, pts=pts: [d.line([(b[0] + (pts[0][0] - b[0]) * k, b[1] + (pts[0][1] - b[1]) * k - 1), (b[0] + (pts[0][0] - b[0]) * k + 1.2, b[1] + (pts[0][1] - b[1]) * k)], dark(hcol, 0.45), 0.6) for k in (0.3, 0.7, 1.0)])
            parts.append(hn)
    if htier: helmet_parts(L, B, J, pr, view, htier, cx, cy, hd + 1.0, helm)


def effects(L, B, J, pr, view, anim, t, posefn, fxo, fxu, P):
    glow = L['glow']; w = L['weapon']
    rnd = np.random.RandomState(int(t * 1000) + len(anim) * 7 + (VIEWS + DIAG).index(view))
    if anim == 'attack':
        # vệt chém theo đường đi của lưỡi
        lo, hi = {'sword': (0.4, 0.68), 'saber': (0.42, 0.72), 'staff': (0.42, 0.74), 'hammer': (0.42, 0.66), 'daggers': (0.34, 0.72)}.get(w, (2, 2))
        if lo <= t <= hi:
            reach = {'sword': (8, 29.4), 'saber': (8, 26), 'staff': (14, 44), 'hammer': (22, 30), 'daggers': (4, 13.4)}[w]
            ks = ['R', 'L'] if w == 'daggers' else ['R']
            for k in ks:
                path = []
                for i in range(9):
                    tt = max(0, t - 0.14 + 0.14 * i / 8)
                    Pp = posefn(tt); Pp['fallmode'] = P.get('fallmode')
                    Jq = solve(B, Pp)
                    g, d = Jq['palm' + k], Jq['wd' + k]
                    path.append((pr(g + d * reach[0])[:2], pr(g + d * reach[1])[:2]))
                for i in range(len(path) - 1):
                    a0, a1 = path[i]; b0, b1 = path[i + 1]
                    al = 0.08 + 0.5 * (i / (len(path) - 1)) ** 1.5
                    fxo.poly([a0, a1, b1, b0], glow, al)
                fxo.line([p[1] for p in path[3:]], '#ffffff', 0.8, 1.0)
        if w == 'hammer' and t >= 0.5:
            u = (t - 0.5) / 0.5
            g = J['palmR'] + J['wdR'] * 27; c = pr(V(g[0], g[1], 0))
            fxu.ring(c[:2], 10 + 26 * u, (10 + 26 * u) * 0.32, glow, 0.7 * (1 - u), 1.6)
            fxu.ring(c[:2], 5 + 16 * u, (5 + 16 * u) * 0.32, '#ffffff', 0.5 * (1 - u), 1.0)
            for i in range(10):
                a = rnd.rand() * TAU; r = 6 + 22 * u * rnd.rand()
                fxo.px(c[0] + math.cos(a) * r, c[1] + math.sin(a) * r * 0.35 - 8 * u * rnd.rand(), '#b8a080', 0.8 * (1 - u))
        if w == 'palm' and t >= 0.46:
            u = min(1, (t - 0.46) / 0.4)
            g = J['palmR'] + (J['Rt'] @ V(0, 1, 0)) * (6 + 22 * u)
            c = pr(g)
            fxo.glow(c[:2], 7 + 6 * u, glow, 0.9 * (1 - u * 0.7))
            fxo.ring(c[:2], 6 + 12 * u, 6 + 12 * u, '#ffffff', 0.7 * (1 - u), 1.0)
        if w == 'knife' and t >= 0.47:
            u = t - 0.47
            rel = J['Rt'] @ V(0, 1, 0)
            g0 = J['palmR'] + rel * 2
            for yy in (-0.16, 0, 0.16):
                dv = J['Rt'] @ adir(yy, -0.02)
                p0 = g0 + dv * (u * 170); p1 = p0 - dv * 6
                a, b = pr(p0), pr(p1)
                fxo.line([b[:2], a[:2]], '#d8e4dc', 1.0, 1.0)
                fxo.px(a[0], a[1], '#ffffff', 1.0)
                fxo.line([pr(p1 - dv * 8)[:2], b[:2]], glow, 0.35, 1.0)
    if anim == 'cast':
        u = t
        feet = pr(V(J['pelvis'][0], J['pelvis'][1], 0))
        if 0.1 <= u:
            a = min(1, (u - 0.1) / 0.3) * (1 if u < 0.9 else (1 - (u - 0.9) * 8))
            rr = 24
            fxu.ring(feet[:2], rr, rr * 0.34, glow, 0.75 * a, 1.2)
            fxu.ring(feet[:2], rr * 0.72, rr * 0.72 * 0.34, glow, 0.55 * a, 0.8)
            for i in range(8):
                ang = i / 8 * TAU + u * 2.4
                x, y = feet[0] + math.cos(ang) * rr * 0.86, feet[1] + math.sin(ang) * rr * 0.86 * 0.34
                fxu.px(x, y, '#ffffff', 0.8 * a)
            for i in range(10):
                ph = (rnd.rand() + u * 1.6) % 1
                x = feet[0] + (rnd.rand() - 0.5) * 34; y = feet[1] - ph * 70
                fxo.star(x, y, glow, (1 - ph) * a, 1 if rnd.rand() < 0.4 else 0)
        mid = (J['palmR'] + J['palmL']) / 2
        if w == 'staff':
            mid = J['palmL'] + J['Rt'] @ V(0, 3, 2)
        if 0.22 <= u <= 0.8:
            a = 1 - abs(u - 0.5) / 0.3
            fxo.glow(pr(mid)[:2], 6 + 5 * a, glow, 0.9 * a)
        if L.get('talisman') and u >= 0.3:
            for i in range(5):
                ang = i / 5 * TAU + u * 5
                q = J['pelvis'] + V(math.cos(ang) * 20, math.sin(ang) * 20, 30 + 6 * math.sin(ang * 2 + u * 3))
                c = pr(q); lay = fxo if math.sin(ang) * (1 if view in DOWNS else -1) >= 0 or view == 'right' and math.cos(ang) >= 0 else fxu
                lay.poly([(c[0] - 2, c[1] - 3.5), (c[0] + 2, c[1] - 3.5), (c[0] + 2, c[1] + 3.5), (c[0] - 2, c[1] + 3.5)], '#f4d860', 0.95)
                lay.line([(c[0], c[1] - 2.5), (c[0], c[1] + 2.5)], '#d02020', 0.95, 0.6)
        if w == 'staff' and u >= 0.35:   # Kim Chung Tráo
            a = min(1, (u - 0.35) / 0.2) * (1 if u < 0.85 else (1 - (u - 0.85) * 6))
            top = pr(J['head'] + V(0, 0, 14))
            fxo.ring((feet[0], (feet[1] + top[1]) / 2 + 4), 26, (feet[1] - top[1]) / 2 + 6, glow, 0.55 * a, 1.2)
            fxo.ell((feet[0], (feet[1] + top[1]) / 2 + 4), 25, (feet[1] - top[1]) / 2 + 5, glow, 0.12 * a)
    if anim == 'hurt' and 0.2 < t < 0.6:
        c = pr(J['chest'] + J['Rt'] @ V(0, 6, 0))
        fxo.star(c[0], c[1], '#ffe0a0', 1.0, 3)
        for i in range(6):
            a = rnd.rand() * TAU; fxo.px(c[0] + math.cos(a) * 6, c[1] + math.sin(a) * 6, '#ffffff', 0.8)


CHAINS_CACHE = {}

LAYERS = ['a0', 'a1', 'a2', 'a3', 'am1', 'am2', 'am3', 'w0', 'w1', 'w2', 'h1', 'h2', 'h3', 'hm1', 'hm2', 'hm3', 'fxu', 'fxo']

def render_layers(L, B, J, CH, view, anim, t, posefn, P):
    """1 khung -> mọi lớp: thân theo 4 cấp áo, kim loại (xám), vũ khí 3 cấp, mũ 3 cấp, hiệu ứng"""
    out = {}
    pr = mkproj(view)
    Z0 = None; tassel = []
    for a in range(4):
        parts, wp, _ = build_parts(L, B, J, CH, view, P, {'a': a})
        C, Z, O = composite(parts, want=True)
        out['a%d' % a] = downsample(C)
        if a: out['am%d' % a] = masked_down(C, O)
        else: Z0, tassel = Z, wp
    for w in range(3):
        if L['weapon'] == 'palm': out['w%d' % w] = None; continue
        C, _ = layer(tassel + weapon_parts(L, J, pr, CH, w), Z0)
        out['w%d' % w] = downsample(C)
    for h in (1, 2, 3):
        helm = []
        head_parts(L, B, J, pr, view, [], CH, P, h, helm)
        C, O = layer(helm, Z0)
        out['h%d' % h] = downsample(C); out['hm%d' % h] = masked_down(C, O)
    fxo, fxu = Fx(), Fx()
    effects(L, B, J, pr, view, anim, t, posefn, fxo, fxu, P)
    out['fxo'] = fxo.out() if fxo.used else None
    out['fxu'] = fxu.out() if fxu.used else None
    return out


def save_sheet(rows, path):
    sheet = np.zeros((len(rows) * OUT, COLS * OUT, 4), np.uint8)
    for r, row in enumerate(rows):
        for c, im in enumerate(row):
            if im is not None: sheet[r * OUT:(r + 1) * OUT, c * OUT:(c + 1) * OUT] = np.clip(im, 0, 255).astype(np.uint8)
    if not sheet[..., 3].any(): return False
    img = Image.fromarray(sheet, 'RGBA')
    img.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)
    return True


CHAINS_CACHE = {}

def render_sect(key, outdir):
    L = LOOKS[key]; B = BODY[L['body']]
    defs = chains_for(L, B); CHAINS_CACHE[L['name']] = defs
    rows = {k: [] for k in LAYERS}
    meta = {'cell': OUT, 'foot': [FX * K, FY * K], 'gameScale': GAME_SCALE / K, 'views': VIEWS + DIAG, 'cols': COLS, 'anims': {}, 'name': L['name'], 'layers': []}
    nrow = 0
    for name, n, dur, loop in ANIMS:
        f = anim_pose(L, B, name)
        ts = [i / n for i in range(n)] if loop else FRAME_T[name]
        times = [t * dur for t in ts]
        ms = [round((times[i + 1] - times[i]) * 1000) if i + 1 < len(times) else round((dur - times[i]) * 1000 if loop else 220) for i in range(len(times))]
        views = VIEWS + DIAG if name in DIAG_ANIMS else VIEWS
        rpv = -(-n // COLS)
        # mỗi hướng chiếm rpv hàng liên tiếp, khung i ở hàng row + chỉ số hướng * rpv + i // COLS, cột i % COLS
        meta['anims'][name] = {'row': nrow, 'n': n, 'ms': [max(40, m) for m in ms], 'loop': loop, 'views': views, 'rpv': rpv}
        speed = {'walk': 100.0, 'run': 270.0}.get(name, 0.0)
        for view in views:
            Ps = [f(t) for t in ts]
            for P in Ps: P['fallmode'] = 'back' if view == 'right' else 'side'
            Js = [solve(B, P) for P in Ps]
            CH = simulate(defs, Js, times, speed, loop, dur)
            frames = [render_layers(L, B, J, {nm: CH[nm][i] for nm in CH}, view, name, ts[i], f, Ps[i]) for i, J in enumerate(Js)]
            for k in LAYERS:   # giữ khung dạng uint8 (ô 288 dạng số thực tốn ~8GB mỗi phái -> bị hệ thống dừng)
                fr = [None if x[k] is None else np.clip(x[k], 0, 255).astype(np.uint8) for x in frames]
                for r in range(rpv): rows[k].append(fr[r * COLS:(r + 1) * COLS])
            del frames
            nrow += rpv
    for k in LAYERS:
        if save_sheet(rows[k], os.path.join(outdir, '%s_%s.png' % (key, k))): meta['layers'].append(k)
    with open(os.path.join(outdir, key + '.json'), 'w') as fp: json.dump(meta, fp, ensure_ascii=False)
    return key


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'design/chars2'
    keys = sys.argv[2:] or list(LOOKS)
    os.makedirs(out, exist_ok=True)
    if len(keys) > 1:
        from multiprocessing import Pool
        with Pool(min(4, len(keys))) as pool:
            for k in pool.starmap(render_sect, [(k, out) for k in keys]): print('xong', k)
    else:
        for k in keys: print('xong', render_sect(k, out))
