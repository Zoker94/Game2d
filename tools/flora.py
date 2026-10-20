"""Cắt + làm nét bộ cây cối / nông sản / xương rồng / chậu cảnh từ ảnh tileset có sẵn (nền đen)
-> public/assets/flora.png + flora.json (cùng định dạng nature.json: [x, y, w, h, gốc x, gốc y]).

  python3 tools/flora.py [ảnh gốc = design/flora/src/plants.jpg] [thư mục ra = public/assets]

Các bước: tách vật thể tự động (vùng sáng hơn nền đen, gom các mảnh sát nhau) -> xoá nền đen loang từ mép khung
-> gom màu khử nhiễu JPEG -> viền tối cùng tông (như tools/nature.py) -> phóng x4 bằng Scale2x rồi thu về x1.5
(tileset vẽ cho nhân vật ~48px, nhân vật trong game ~65px -> x1.5).
Tên từng vật đặt theo số thứ tự vùng tách (xem design/flora/preview/boxes.png).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_dilation, find_objects, label

sys.path.insert(0, os.path.dirname(__file__))
from spriteup import quantize, scale2x  # noqa: E402

K = 1.5   # hệ số hiển thị (tileset vẽ cho nhân vật ~48px, nhân vật game ~65px)

# số vùng tách -> tên dùng trong game. Nhóm theo nơi đặt (world-art.js chọn theo chủ đề map)
NAMES = {
    # nấm (rừng, đồng cỏ, bờ sông)
    49: 'mush_b1', 57: 'mush_r1', 61: 'mush_b2', 59: 'mush_r2', 68: 'mush_pink', 69: 'mush_w1', 80: 'mush_o1',
    81: 'mush_w2', 83: 'mush_o2', 119: 'mush_o3', 128: 'mush_b3', 134: 'mush_gold', 56: 'mush_b4', 65: 'mush_b5', 76: 'mush_pink2',
    # gốc cây (cưa phẳng), gốc trắng (tuyết / mộ), khúc gỗ
    48: 'stump_r1', 55: 'stump_s1', 58: 'stump_s2', 60: 'stump_l1', 73: 'stump_r2', 78: 'stump_s3', 87: 'stump_l2',
    118: 'stump_root', 115: 'stump_axe', 123: 'stump_r3', 139: 'stump_r4', 50: 'stump_white1', 91: 'stump_white2',
    121: 'log_moss1', 126: 'log_moss2', 127: 'log_dry1', 136: 'log_dry2', 137: 'log_dry3',
    # bụi, dương xỉ, cỏ
    86: 'shrub_leafy', 130: 'shrub_round', 106: 'shrub_ball', 110: 'fern_big', 111: 'fern_dry', 82: 'grass_dry', 125: 'grass_tuft',
    97: 'grass_patch', 99: 'grass_low', 94: 'moss_mound1', 109: 'moss_mound2', 79: 'leaf_pile', 52: 'roots_dead', 54: 'leaves_dry',
    # xương rồng, cây chết (sa mạc)
    71: 'cactus_tall', 96: 'cactus_big', 122: 'cactus_col', 74: 'cactus_m1', 85: 'cactus_m2', 70: 'cactus_s1', 92: 'cactus_cluster',
    75: 'cactus_pear', 124: 'cactus_barrel1', 133: 'cactus_barrel2', 107: 'tree_dead_white',
    # chậu cảnh (thành, trước nhà / NPC)
    53: 'pot_topiary1', 100: 'pot_topiary2', 113: 'pot_topiary3', 104: 'pot_tree1', 105: 'pot_tree2', 93: 'pot_cypress',
    117: 'pot_palm', 120: 'pot_fern', 132: 'pot_leafy', 131: 'pot_vine', 64: 'pot_bamboo', 95: 'pot_bonsai', 88: 'planter_bonsai',
    103: 'planter_big',
    # nông sản (ruộng rau cạnh thành, sạp chợ)
    108: 'pumpkin_big', 112: 'grapes', 62: 'patch_cabbage', 51: 'patch_turnip', 135: 'patch_tomato',
    102: 'patch_leafy', 116: 'patch_herb', 138: 'patch_sprout', 4: 'crop_cabbage', 13: 'crop_corn', 15: 'crop_wheat',
    14: 'crop_wheat_gold', 28: 'crop_pumpkin', 29: 'crop_cauli', 27: 'crop_eggplant', 1: 'crop_tomato', 25: 'crop_pepper',
    16: 'crop_leafy', 24: 'crop_bean', 12: 'crop_flower', 30: 'crop_melon', 38: 'crop_radish', 42: 'crop_lettuce',
}


def boxes_of(rgb):
    """vùng vật thể: điểm sáng hơn nền đen, gom các mảnh cách nhau <= 2px"""
    fg = rgb.max(2) > 34
    lab, _ = label(binary_dilation(fg, iterations=2))
    out = []
    for s in find_objects(lab):
        x0, y0, x1, y1 = s[1].start, s[0].start, s[1].stop, s[0].stop
        if (x1 - x0) * (y1 - y0) > 40: out.append((x0, y0, x1, y1))
    return out


def cut(rgb, box):
    x0, y0, x1, y1 = box
    c = rgb[max(0, y0 - 1):y1 + 1, max(0, x0 - 1):x1 + 1]
    a = c.astype(np.int16)
    dark = a.max(2) <= 38
    lab, _ = label(dark)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    fg = ~bg
    lab2, n = label(fg)          # bỏ đốm nhiễu lẻ
    if n:
        sz = np.bincount(lab2.ravel()); sz[0] = 0
        fg = (sz >= 4)[lab2]
    return c.copy(), fg


def outline(rgba):
    """viền 1 điểm ảnh gốc: màu kề sẫm lại (không dùng đen tuyền), như tools/nature.py"""
    A = rgba[..., 3] > 0
    ring = binary_dilation(A) & ~A
    acc = np.zeros(rgba.shape[:2] + (3,), np.float32); cnt = np.zeros(rgba.shape[:2], np.float32)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sr = np.roll(rgba, (dy, dx), (0, 1)); so = np.roll(A, (dy, dx), (0, 1))
        acc[so] += sr[so, :3]; cnt[so] += 1
    nb = acc / np.maximum(cnt, 1)[..., None]
    out = rgba.copy()
    out[ring, :3] = (nb[ring] * 0.4 + np.array([20, 18, 24]) * 0.6).astype(np.uint8); out[ring, 3] = 255
    return out


def enhance(c, fg):
    q = quantize(c, fg, 40)
    rgba = np.zeros(c.shape[:2] + (4,), np.uint8)
    rgba[fg, :3] = q[fg]; rgba[fg, 3] = 255
    rgba = np.pad(rgba, ((2, 2), (2, 2), (0, 0)))
    rgba = outline(rgba)
    big = scale2x(scale2x(rgba))
    H, W = rgba.shape[:2]
    f = big.astype(np.float32); f[..., :3] *= f[..., 3:4] / 255
    TW, TH = int(round(W * K)), int(round(H * K))
    sm = np.array(Image.fromarray(f.astype(np.uint8), 'RGBA').resize((TW, TH), Image.LANCZOS)).astype(np.float32)
    al = sm[..., 3]
    out = np.zeros((TH, TW, 4), np.uint8)
    on = al >= 110
    out[on, :3] = np.clip(sm[on, :3] / np.maximum(al[on, None], 1) * 255, 0, 255); out[on, 3] = 255
    return out


def build(src, dst):
    rgb = np.array(Image.open(src).convert('RGB'))
    bx = boxes_of(rgb)
    sprites = {}
    for i, name in NAMES.items():
        c, fg = cut(rgb, bx[i])
        sp = enhance(c, fg)
        ys, xs = np.nonzero(sp[..., 3])
        sprites[name] = sp[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    # xếp kệ: cao trước
    order = sorted(sprites, key=lambda n: -sprites[n].shape[0])
    W, x, y, rowh, pos = 1024, 0, 0, 0, {}
    for n in order:
        h, w = sprites[n].shape[:2]
        if x + w > W: x, y, rowh = 0, y + rowh + 2, 0
        pos[n] = (x, y); x += w + 2; rowh = max(rowh, h)
    atlas = np.zeros((y + rowh, W, 4), np.uint8)
    meta = {}
    for n in order:
        h, w = sprites[n].shape[:2]; px, py = pos[n]
        atlas[py:py + h, px:px + w] = sprites[n]
        meta[n] = [px, py, w, h, w // 2, h - 3]     # gốc: giữa đáy, lùi 3px để chân vật lún vào nền
    Image.fromarray(atlas, 'RGBA').save(os.path.join(dst, 'flora.png'), optimize=True)
    json.dump(meta, open(os.path.join(dst, 'flora.json'), 'w'), separators=(',', ':'))
    # ảnh soát: các vùng đã tách kèm số
    pv = 'design/flora/preview'
    os.makedirs(pv, exist_ok=True)
    im = Image.open(src).convert('RGB').resize((rgb.shape[1] * 3, rgb.shape[0] * 3), Image.NEAREST)
    d = ImageDraw.Draw(im)
    for i, (x0, y0, x1, y1) in enumerate(bx):
        d.rectangle((x0 * 3, y0 * 3, x1 * 3, y1 * 3), outline=(255, 0, 0) if i in NAMES else (90, 90, 90))
        d.text((x0 * 3 + 2, y0 * 3 + 1), str(i), fill=(255, 255, 0))
    im.save(os.path.join(pv, 'boxes.png'))
    print('flora:', len(meta), 'vật, atlas', atlas.shape[1], 'x', atlas.shape[0])


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else 'design/flora/src/plants.jpg', sys.argv[2] if len(sys.argv) > 2 else 'public/assets')
