# Khôi phục ảnh pixel art bị nhòe (ảnh gốc nén webp, phóng lẻ): đưa về lưới ô gốc, lọc nhiễu màu, viền rõ, phóng bội số nguyên.
#   native(im, b)  : lấy mẫu giữa mỗi ô b x b (dò pha lưới theo cạnh màu) -> ảnh độ phân giải gốc
#   palette(frames, n) : bảng màu chung (bỏ nhiễu nén) ; apply(im, pal) : áp bảng màu
#   outline(im)    : mép hình chưa tối thì kẻ viền tối (tông màu theo điểm bên trong)
#   up(im, n)      : phóng n lần (nearest)
import math
import numpy as np
from PIL import Image, ImageEnhance

def _phase(e, b):
    x = np.arange(len(e)); z = (e * np.exp(2j * np.pi * x / b)).sum()
    return (np.angle(z) / (2 * np.pi)) * b + 0.5      # vị trí ranh giới ô (mod b)

def period(im, lo=2.5, hi=9.0):
    a = np.asarray(im.convert('RGBA')).astype(float); g = a[..., :3].sum(2); m = a[..., 3] > 0
    best = []
    for ax in (0, 1):
        d = np.abs(np.diff(g, axis=ax)) * ((m[:-1] & m[1:]) if ax == 0 else (m[:, :-1] & m[:, 1:]))
        p = d.sum(1 - ax); p = p - p.mean()
        f = np.abs(np.fft.rfft(p, n=len(p) * 8)); fr = np.fft.rfftfreq(len(p) * 8)
        sel = (fr > 1 / hi) & (fr < 1 / lo); best.append(1 / fr[np.argmax(f * sel)])
    return float(np.mean(best))

def native(im, b):
    a = np.asarray(im.convert('RGBA')).astype(float); H, W = a.shape[:2]
    g = a[..., :3].sum(2); m = a[..., 3] > 0
    ex = (np.abs(np.diff(g, axis=1)) * (m[:, :-1] & m[:, 1:])).sum(0)
    ey = (np.abs(np.diff(g, axis=0)) * (m[:-1] & m[1:])).sum(1)
    px, py = _phase(ex, b) % b, _phase(ey, b) % b
    xs = np.arange(px - b + b / 2, W + b, b); ys = np.arange(py - b + b / 2, H + b, b)
    r = max(1, int(b * 0.28))
    out = np.zeros((len(ys), len(xs), 4), np.uint8)
    for j, cy in enumerate(ys):
        y0, y1 = int(round(cy - r)), int(round(cy + r)) + 1
        if y1 <= 0 or y0 >= H: continue
        y0, y1 = max(0, y0), min(H, y1)
        for i, cx in enumerate(xs):
            x0, x1 = int(round(cx - r)), int(round(cx + r)) + 1
            if x1 <= 0 or x0 >= W: continue
            x0, x1 = max(0, x0), min(W, x1)
            blk = a[y0:y1, x0:x1].reshape(-1, 4); op = blk[blk[:, 3] > 0]
            if len(op) * 2 < len(blk): continue
            out[j, i, :3] = np.median(op[:, :3], 0); out[j, i, 3] = 255
    al = out[..., 3] > 0
    from scipy import ndimage as nd
    lab, n = nd.label(al, structure=np.ones((3, 3)))
    if n > 1:   # bỏ chấm lẻ (mảnh khung bên cạnh, tia lửa vụn)
        sz = nd.sum(al, lab, range(1, n + 1)); keep = max(10, sz.max() * 0.01)
        out[np.isin(lab, [i + 1 for i, z in enumerate(sz) if z < keep]), 3] = 0; al = out[..., 3] > 0
    ys_, xs_ = np.nonzero(al)
    if not len(ys_): return Image.fromarray(out, 'RGBA'), (px, py)
    return Image.fromarray(out[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1], 'RGBA'), (xs[xs_.min()] - b / 2, ys[ys_.min()] - b / 2)

def enhance(im, contrast=1.08, color=1.1):
    rgb = im.convert('RGB'); rgb = ImageEnhance.Contrast(rgb).enhance(contrast); rgb = ImageEnhance.Color(rgb).enhance(color)
    out = rgb.convert('RGBA'); out.putalpha(im.getchannel('A')); return out

def palette(frames, n=56):
    W = sum(f.width for f in frames); H = max(f.height for f in frames)
    sheet = Image.new('RGB', (W, H), (0, 0, 0)); x = 0
    for f in frames:
        bg = Image.new('RGB', f.size, tuple(np.asarray(f.convert('RGB'))[np.asarray(f)[..., 3] > 0].mean(0).astype(int)) if (np.asarray(f)[..., 3] > 0).any() else (0, 0, 0))
        bg.paste(f.convert('RGB'), mask=f.getchannel('A')); sheet.paste(bg, (x, 0)); x += f.width
    return sheet.quantize(colors=n, method=Image.MEDIANCUT, dither=Image.NONE)

def apply(im, pal):
    q = im.convert('RGB').quantize(palette=pal, dither=Image.NONE).convert('RGBA'); q.putalpha(im.getchannel('A')); return q

def outline(im, k=0.38):
    a = np.asarray(im).copy(); al = a[..., 3] > 0
    pad = np.pad(al, 1); inner = pad[1:-1, 1:-1] & pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
    edge = al & ~inner
    lum = a[..., :3].astype(float) @ np.array([0.3, 0.59, 0.11])
    fix = edge & (lum > 70) & (lum < 185)         # mép còn sáng: tối lại theo tông màu (giữ đầu lửa / sừng phát sáng)
    a[fix, :3] = (a[fix, :3].astype(float) * k).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')

def up(im, n):
    return im.resize((im.width * n, im.height * n), Image.NEAREST)

def prepare(raws, offs, b, h_side, side_names, colors=112):
    """raws: {tên: ảnh gốc}, offs: {tên: khoảng cách tới đỉnh hàng (px gốc)} -> ({tên: (ảnh sheet, off sheet)}, scale)"""
    nat = {}
    for nm, im in raws.items():
        bb = b(nm) if callable(b) else b   # cỡ ô có thể khác theo khung (vd. hình ngang vẽ riêng)
        n_, (ox, oy) = native(im, bb); nat[nm] = (enhance(n_), (offs[nm] + oy) / bb)
    pal = palette([v[0] for v in nat.values()], colors)
    hn = float(np.median([nat[nm][0].height for nm in side_names]))
    n = max(2, math.ceil(2 * h_side / hn))
    out = {nm: (up(outline(apply(im, pal)), n), round(o) * n) for nm, (im, o) in nat.items()}
    global LAST_N; LAST_N = n   # hệ số phóng: bộ ghép căn vị trí theo bội số n rồi thu sheet về kích thước gốc (nhẹ bộ nhớ)
    return out, h_side / (hn * n)
