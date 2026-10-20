# Bộ dựng hình THÚ kiểu "điêu khắc khối" cho tools/beasts2.py.
# Mỗi con thú là một tập khối tròn (ống thuôn, elip khối) đặt theo khung xương. Các khối được
# HÒA VÀO NHAU thành một bề mặt liền (smooth-union cả bóng lẫn độ cao) nên vai, đùi, cổ nối vào thân
# như cơ bắp thật, không có đường viền khớp kiểu con rối. Sau đó:
#   - pháp tuyến lấy từ bản đồ độ cao -> ánh sáng trên-trái (cùng hướng nhân vật rig2), bóng khe (AO);
#   - màu nền theo từng khối + bụng sáng (mặt quay xuống), lưng sẫm (mặt quay lên), vằn / đốm theo toạ độ;
#   - lông: nét ngắn theo chiều lông làm răng cưa ranh giới sáng tối; lông xù ở rìa là các gai nhỏ;
#   - thu về lưới pixel cuối (vẽ gấp 4 rồi gộp) và lượng tử theo thang 6 bậc của bảng màu nhân vật;
#   - viền ngoài sel-out, chân phía xa tô sẫm và tách bằng bóng đổ của phần gần.
import math
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, binary_dilation, binary_erosion

S = 4
SH_HUE = np.array((44, 26, 72), np.float32)
LI_HUE = np.array((255, 244, 214), np.float32)
INK = np.array((22, 13, 30), np.float32)
LIGHT = np.array([-0.5, -0.68, 0.54]); LIGHT = LIGHT / np.linalg.norm(LIGHT)
# 6 bậc sáng: (hướng pha, lượng)
LEVELS = [(SH_HUE, 0.6), (SH_HUE, 0.4), (SH_HUE, 0.2), (None, 0), (LI_HUE, 0.2), (LI_HUE, 0.42)]
TH = [0.24, 0.4, 0.56, 0.78, 0.93]


def hx(c):
    if isinstance(c, (tuple, list, np.ndarray)): return np.array(c[:3], np.float32)
    c = c.lstrip('#'); return np.array((int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)), np.float32)


def mixc(a, b, t): a, b = hx(a), hx(b); return a + (b - a) * t
def darkc(c, t=0.3): return mixc(c, SH_HUE, t)
def lightc(c, t=0.3): return mixc(c, LI_HUE, t)


def smax(a, b, k):
    if k <= 1e-6: return np.maximum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return a * (1 - h) + b * h + k * h * (1 - h)


class Prim:
    __slots__ = ('kind', 'a', 'b', 'r0', 'r1', 'z', 'zk', 'col', 'cs', 'back', 'fur', 'spec', 'blend', 'grp', 'flow', 'rot', 'pts')


class Scene:
    """toạ độ đơn vị: x sang phải, y lên trên, gốc tại điểm chân chạm đất; u = số pixel mỗi đơn vị"""

    def __init__(self, W, H, ox, gy, u):
        self.W, self.H, self.ox, self.gy, self.u = W, H, ox, gy, u
        self.groups = {'far': [], 'near': []}
        self.cur = 'near'
        self.patterns = []   # (nhóm khối, hàm(U, V, NY) -> mặt nạ, màu)
        self.marks = []      # hàm(dr) vẽ chi tiết ở lưới pixel cuối
        self.blend = 1.4     # độ hòa khối mặc định (đơn vị)

    def P(self, x, y): return (self.ox + x * self.u, self.gy - y * self.u)

    def _add(self, kind, a, b, r0, r1, z, col, **m):
        p = Prim(); p.kind = kind; p.a = a; p.b = b; p.r0 = r0; p.r1 = r1; p.z = z
        p.zk = m.get('zk', 1.0); p.col = hx(col); p.cs = m.get('cs'); p.back = m.get('back')
        p.fur = m.get('fur', 0.0); p.spec = m.get('spec', 0.0); p.blend = m.get('blend', self.blend)
        p.grp = m.get('grp', 'body'); p.flow = m.get('flow'); p.rot = m.get('rot', 0.0); p.pts = m.get('pts')
        self.groups[m.get('layer', self.cur)].append(p)
        return p

    def cap(self, a, b, r0, r1=None, z=0.0, col='#808080', **m):
        return self._add('cap', a, b, r0, r0 if r1 is None else r1, z, col, **m)

    def ell(self, c, rx, ry, z=0.0, col='#808080', **m):
        return self._add('ell', c, None, rx, ry, z, col, **m)

    def spike(self, base, tip, w, z=0.0, col='#808080', **m):
        m.setdefault('blend', 0.5); m.setdefault('zk', 0.6)
        return self._add('cap', base, tip, w, w * 0.12, z, col, **m)

    def chain(self, pts, rs, z=0.0, col='#808080', **m):
        """ống cong qua nhiều điểm, bán kính theo từng điểm"""
        zs = z if isinstance(z, (list, tuple)) else [z] * len(pts)
        out = []
        for j in range(len(pts) - 1):
            out.append(self.cap(pts[j], pts[j + 1], rs[j], rs[j + 1], (zs[j] + zs[j + 1]) / 2, col, **m))
        return out

    def mark(self, fn): self.marks.append(fn)

    # ---------------- dựng ----------------
    def _field(self, prims):
        W, H, u = self.W * S, self.H * S, self.u
        Sd = np.full((H, W), -1e4, np.float32)    # khoảng cách có dấu (dương = bên trong), đơn vị pixel cuối
        Hh = np.full((H, W), -1e4, np.float32)    # độ cao bề mặt
        Id = np.full((H, W), -1, np.int32)
        Fa = np.zeros((H, W), np.float32)         # hướng lông (radian, toạ độ màn hình)
        for idx, p in enumerate(prims):
            if p.kind == 'cap':
                ax, ay = self.P(*p.a); bx, by = self.P(*p.b)
                r0, r1 = p.r0 * u, p.r1 * u; rm = max(r0, r1)
                x0, x1 = min(ax, bx) - rm, max(ax, bx) + rm; y0, y1 = min(ay, by) - rm, max(ay, by) + rm
            else:
                cx, cy = self.P(*p.a); rx, ry = p.r0 * u, p.r1 * u; rm = max(rx, ry)
                x0, x1, y0, y1 = cx - rm, cx + rm, cy - rm, cy + rm
            mg = p.blend * u + 2
            X0, X1 = max(0, int((x0 - mg) * S)), min(W, int((x1 + mg) * S) + 1)
            Y0, Y1 = max(0, int((y0 - mg) * S)), min(H, int((y1 + mg) * S) + 1)
            if X0 >= X1 or Y0 >= Y1: continue
            yy, xx = np.mgrid[Y0:Y1, X0:X1].astype(np.float32)
            X = (xx + 0.5) / S; Y = (yy + 0.5) / S
            if p.kind == 'cap':
                dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy or 1e-6
                t = np.clip(((X - ax) * dx + (Y - ay) * dy) / L2, 0, 1)
                d = np.hypot(X - (ax + dx * t), Y - (ay + dy * t))
                r = r0 + (r1 - r0) * t
                s = r - d
                hin = np.sqrt(np.maximum(r * r - d * d, 0)) * p.zk
                ang = math.atan2(dy, dx) if p.flow is None else p.flow
            else:
                c, sn = math.cos(p.rot), math.sin(p.rot)
                lx, ly = (X - cx) * c + (Y - cy) * sn, -(X - cx) * sn + (Y - cy) * c
                q = np.sqrt((lx / rx) ** 2 + (ly / ry) ** 2)
                s = (1 - q) * min(rx, ry)
                hin = np.sqrt(np.maximum(1 - q * q, 0)) * min(rx, ry) * p.zk
                ang = (math.pi * 0.92 if p.flow is None else p.flow)
            z = p.z * u
            h = np.where(s > 0, z + hin, z + s * 1.2)
            k = p.blend * u
            sub = (slice(Y0, Y1), slice(X0, X1))
            old = Hh[sub]
            win = h >= old
            Sd[sub] = smax(Sd[sub], s, k * 0.6)
            Hh[sub] = smax(old, h, k)
            Id[sub] = np.where(win & (s > -k), idx, Id[sub])
            Fa[sub] = np.where(win, ang, Fa[sub])
        return Sd, Hh, Id, Fa

    def _shade(self, prims, seed):
        Sd, Hh, Id, Fa = self._field(prims)
        M = Sd > 0
        if not M.any(): return None
        u = self.u
        Hs = gaussian_filter(np.maximum(Hh, -3 * u), 0.7 * S)
        gy, gx = np.gradient(Hs)
        gx *= S; gy *= S
        g = np.hypot(gx, gy); sc = np.minimum(1, 3.2 / np.maximum(g, 1e-6)); gx *= sc; gy *= sc
        nz = 1 / np.sqrt(gx * gx + gy * gy + 1); nx = -gx * nz; ny = -gy * nz
        dif = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
        dif = np.clip((dif + 0.22) / 1.22, 0, 1)
        Hb = gaussian_filter(np.maximum(Hh, -3 * u), 2.4 * u * S * 0.5)
        ao = np.clip((Hb - Hh) / (2.2 * u), 0, 1)
        v = 0.16 + 0.84 * dif - 0.34 * ao
        # màu nền theo khối
        n = len(prims)
        cols = np.array([p.col for p in prims] + [(0, 0, 0)], np.float32)
        Ii = np.where(Id < 0, n, Id)
        alb = cols[Ii]
        U = ((np.arange(self.W * S)[None, :] + 0.5) / S - self.ox) / u
        Vv = (self.gy - (np.arange(self.H * S)[:, None] + 0.5) / S) / u
        U = np.broadcast_to(U, M.shape); Vv = np.broadcast_to(Vv, M.shape)
        grp = np.array([p.grp for p in prims] + [''], object)[Ii]
        for j, p in enumerate(prims):
            if p.cs is None and p.back is None: continue
            on = Id == j
            if p.cs is not None:
                t = np.clip((ny - 0.12) / 0.45, 0, 1)[on]
                alb[on] = alb[on] * (1 - t[:, None]) + hx(p.cs) * t[:, None]
            if p.back is not None:
                t = np.clip((-ny - 0.35) / 0.4, 0, 1)[on]
                alb[on] = alb[on] * (1 - t[:, None]) + hx(p.back) * t[:, None]
        for grps, fn, col in self.patterns:
            sel = np.isin(grp, grps) & M
            if not sel.any(): continue
            mk = fn(U, Vv, ny) & sel
            if isinstance(col, (list, tuple)) and len(col) == 2 and not isinstance(col[0], (int, float)):
                c, t = col; alb[mk] = alb[mk] * (1 - t) + hx(c) * t
            else: alb[mk] = hx(col)
        # lông: nét ngắn theo chiều lông
        fur = np.array([p.fur for p in prims] + [0], np.float32)[Ii]
        if fur.max() > 0:
            rng = np.random.default_rng(seed)
            tex = Image.new('L', (self.W * S, self.H * S), 128); d = ImageDraw.Draw(tex)
            ys, xs = np.where(M & (fur > 0))
            nstroke = len(ys) // (S * S)
            if len(ys):
                pick = rng.integers(0, len(ys), nstroke)
                for q in pick:
                    y, x = ys[q], xs[q]
                    a = Fa[y, x] + rng.normal(0, 0.18); ln = (1.6 + rng.random() * 2.0) * S * max(0.6, fur[y, x])
                    val = int(128 + rng.choice([-1, 1]) * (40 + rng.random() * 40))
                    d.line([(x, y), (x + math.cos(a) * ln, y + math.sin(a) * ln)], fill=val, width=S)
            T = (np.array(tex, np.float32) - 128) / 128
            v = v + T * 0.13 * np.clip(fur, 0, 1.5)
        spec = np.array([p.spec for p in prims] + [0], np.float32)[Ii]
        rz = 2 * (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) * nz - LIGHT[2]
        sp = (np.clip(rz, 0, 1) ** 12) * spec
        return M, v, alb, sp, Id

    def _down(self, res):
        M, v, alb, sp, Id = res
        H, W = self.H, self.W
        def blk(a): return a.reshape(H, S, W, S, *a.shape[2:]).mean((1, 3))
        A = blk(M.astype(np.float32))
        Mf = M.astype(np.float32)
        vw = blk(v * Mf) / np.maximum(A, 1e-6)
        aw = blk(alb * Mf[..., None]) / np.maximum(A, 1e-6)[..., None]
        sw = blk(sp * Mf) / np.maximum(A, 1e-6)
        on = A >= 0.5
        lv = np.digitize(vw, TH)
        lv = np.where(sw > 0.35, 5, lv)
        out = np.zeros((H, W, 3), np.float32)
        for i, (hue, t) in enumerate(LEVELS):
            m = lv == i
            if not m.any(): continue
            out[m] = aw[m] if hue is None else aw[m] * (1 - t) + hue * t
        return on, out, lv

    def render(self, seed=1):
        H, W = self.H, self.W
        img = np.zeros((H, W, 4), np.float32)
        layers = []
        for nm in ('far', 'near'):
            pr = self.groups[nm]
            if not pr: layers.append(None); continue
            res = self._shade(pr, seed + (0 if nm == 'near' else 7))
            layers.append(None if res is None else self._down(res))
        far, near = layers
        if far is not None:
            on, col, lv = far
            col = col * 0.8 + SH_HUE * 0.2   # phía xa: sẫm hơn
            img[on, :3] = col[on]; img[on, 3] = 255
        if near is not None:
            on, col, lv = near
            if far is not None:   # bóng của phần gần đổ lên phần xa (lệch xuống-phải 1px) + đường tách
                sh = np.zeros_like(on); sh[1:, 1:] = on[:-1, :-1]
                edge = binary_dilation(on) & ~on & far[0]
                img[edge, :3] = img[edge, :3] * 0.45 + INK * 0.55
                s2 = sh & ~on & far[0] & ~edge
                img[s2, :3] = img[s2, :3] * 0.8 + SH_HUE * 0.2
            img[on, :3] = col[on]; img[on, 3] = 255
        A = img[..., 3] > 0
        # chi tiết (mắt, mũi, răng...) ở lưới cuối
        dr = Dr(img, self)
        for fn in self.marks: fn(dr)
        A = img[..., 3] > 0
        ring = binary_dilation(A) & ~A
        acc = np.zeros((H, W, 3), np.float32); cnt = np.zeros((H, W), np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sr = np.roll(img, (dy, dx), (0, 1)); so = np.roll(A, (dy, dx), (0, 1))
            acc[so] += sr[so, :3]; cnt[so] += 1
        nb = acc / np.maximum(cnt, 1)[..., None]
        img[ring, :3] = nb[ring] * 0.22 + INK * 0.78; img[ring, 3] = 255
        return np.clip(img, 0, 255).astype(np.uint8)


class Dr:
    """vẽ chi tiết thẳng lên lưới pixel cuối, toạ độ đơn vị"""

    def __init__(self, img, sc): self.img, self.sc = img, sc

    def px(self, x, y, col, only_on=True):
        X, Y = self.sc.P(x, y); X, Y = int(math.floor(X)), int(math.floor(Y))
        if 0 <= X < self.sc.W and 0 <= Y < self.sc.H and (not only_on or self.img[Y, X, 3] > 0):
            self.img[Y, X, :3] = hx(col); self.img[Y, X, 3] = 255

    def get(self, x, y):
        X, Y = self.sc.P(x, y); X, Y = int(math.floor(X)), int(math.floor(Y))
        if 0 <= X < self.sc.W and 0 <= Y < self.sc.H: return self.img[Y, X, :3].copy()
        return None

    def line(self, a, b, col, only_on=True):
        (ax, ay), (bx, by) = self.sc.P(*a), self.sc.P(*b)
        n = int(max(abs(bx - ax), abs(by - ay))) + 1
        for j in range(n + 1):
            t = j / max(1, n)
            X, Y = int(math.floor(ax + (bx - ax) * t)), int(math.floor(ay + (by - ay) * t))
            if 0 <= X < self.sc.W and 0 <= Y < self.sc.H and (not only_on or self.img[Y, X, 3] > 0):
                self.img[Y, X, :3] = hx(col); self.img[Y, X, 3] = 255

    def poly(self, pts, col, only_on=True):
        m = Image.new('L', (self.sc.W, self.sc.H), 0)
        ImageDraw.Draw(m).polygon([self.sc.P(*p) for p in pts], fill=255)
        mk = np.array(m) > 0
        if only_on: mk &= self.img[..., 3] > 0
        self.img[mk, :3] = hx(col); self.img[mk, 3] = 255

    def ell(self, c, rx, ry, col, only_on=True):
        m = Image.new('L', (self.sc.W, self.sc.H), 0)
        X, Y = self.sc.P(*c); u = self.sc.u
        ImageDraw.Draw(m).ellipse([X - rx * u, Y - ry * u, X + rx * u - 1, Y + ry * u - 1], fill=255)
        mk = np.array(m) > 0
        if only_on: mk &= self.img[..., 3] > 0
        self.img[mk, :3] = hx(col); self.img[mk, 3] = 255
