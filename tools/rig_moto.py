#!/usr/bin/env python3
"""Tư thế cưỡi XE MÁY cho mọi phái (bộ khung tools/rig3.py): ngồi như cưỡi ngựa nhưng người đổ về trước,
hai tay vươn ra nắm hai đầu ghi-đông (tay áo / găng đúng phái, đúng cấp áo vì do chính bộ khung vẽ).
Binh khí cất đi (không vẽ lớp vũ khí) để hai tay rảnh nắm lái.

  python3 tools/rig_moto.py            -> ghi thêm dải 'moto' vào public/assets/chars_hd (ô 288) và public/assets/chars (ô 144)

Mỗi phái: <cls>_<lớp>-moto.png (3 hàng: nhìn xuống / lên / ngang, 4 khung) + anims.ride_moto, parts.moto trong <cls>.json.
"""
import json, math, os, sys
from multiprocessing import Pool
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig3 as R

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
HD, SD = os.path.join(ROOT, 'public/assets/chars_hd'), os.path.join(ROOT, 'public/assets/chars')
N, DUR = 4, 0.44
# tay nắm ghi-đông so với ngực (hệ trục thân: x sang phải, y ra trước, z lên) – ghi-đông xe phân khối lớn cao và rộng
GRIP = (15.0, 24.0, 9.0)

def moto_pose(L, B):
    f0 = R._anim_pose(L, B, 'idle')
    def f(t):
        P = dict(f0(t))
        bob = math.cos(R.TAU * t) * 0.8   # máy nổ: rung nhẹ
        P.update(legR=(1.32, 1.62, 0.36), legL=(1.32, 1.62, 0.36), footR=-0.25, footL=-0.25, air=True, hipyaw=0.0,
                 root=(0.0, 0.0, R.RIDE_PELVIS - B['hip'] + bob), lift=0.0, fall=0.0, twist=0.0, side=0.0,
                 ikR=(GRIP[0], GRIP[1], GRIP[2]), ikL=(-GRIP[0], GRIP[1], GRIP[2]), gripw=0.0, openR=0.0, openL=0.0,
                 head=(-0.06, 0.0))
        P['lean'] = 0.24                  # đổ người về trước như lái mô tô
        P['breath'] = 0.5 + 0.5 * math.sin(R.TAU * t)
        return P
    return f

def render(key):
    L = R.LOOKS[key]; B = R.BODY[L['body']]
    defs = R.chains_for(L, B); R.CHAINS_CACHE[L['name']] = defs
    f = moto_pose(L, B)
    ts = [i / N for i in range(N)]
    times = [t * DUR for t in ts]
    rows = {k: [] for k in R.LAYERS}
    for view in R.VIEWS:   # down, up, right
        Ps = [f(t) for t in ts]
        for P in Ps: P['fallmode'] = 'back' if view == 'right' else 'side'
        Js = [R.solve(B, P) for P in Ps]
        CH = R.simulate(defs, Js, times, 0.0, True, DUR)
        frames = [R.render_layers(L, B, J, {nm: CH[nm][i] for nm in CH}, view, 'ride', ts[i], f, Ps[i]) for i, J in enumerate(Js)]
        for k in R.LAYERS:
            fr = [None if (x[k] is None or k.startswith('w')) else np.clip(x[k], 0, 255).astype(np.uint8) for x in frames]   # bỏ binh khí
            rows[k].append(fr)
    out = {}
    for k in R.LAYERS:
        sheet = np.zeros((3 * R.OUT, R.COLS * R.OUT, 4), np.uint8)
        for r, row in enumerate(rows[k]):
            for c, im in enumerate(row):
                if im is not None: sheet[r * R.OUT:(r + 1) * R.OUT, c * R.OUT:(c + 1) * R.OUT] = im
        out[k] = sheet if sheet[..., 3].any() else None
    return key, out

def half(arr, fx):
    im = arr.astype(np.float32); h, w = im.shape[0] // 2, im.shape[1] // 2
    a = im[..., 3:4] / 255.0
    q = (im[..., :3] * a).reshape(h, 2, w, 2, 3).sum((1, 3)); A = a.reshape(h, 2, w, 2, 1).sum((1, 3))
    o = np.zeros((h, w, 4), np.uint8); o[..., :3] = np.clip(q / np.maximum(A, 1e-6), 0, 255)
    o[..., 3] = np.clip(A[..., 0] / 4 * 255, 0, 255) if fx else np.where(A[..., 0] >= 2, 255, 0)
    return o

def save(arr, path):
    Image.fromarray(arr, 'RGBA').quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)

def install(key, out):
    for D, scale in ((HD, 1), (SD, 2)):
        jf = os.path.join(D, key + '.json'); meta = json.load(open(jf))
        row0 = max(r0 + n for r0, n in meta['parts'].values()) if 'moto' not in meta['parts'] else meta['parts']['moto'][0]
        meta['anims']['ride_moto'] = {'row': row0, 'n': N, 'ms': [110] * N, 'loop': True, 'views': list(R.VIEWS), 'rpv': 1}
        meta['parts']['moto'] = [row0, 3]
        emp = meta.setdefault('empty', {})
        for k in meta['layers']:
            lst = [p for p in emp.get(k, []) if p != 'moto']
            arr = out.get(k)
            if arr is None: lst.append('moto')
            else: save(arr if scale == 1 else half(arr, k.startswith('fx')), os.path.join(D, f'{key}_{k}-moto.png'))
            if lst: emp[k] = lst
            elif k in emp: del emp[k]
        json.dump(meta, open(jf, 'w'), ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    keys = sys.argv[1:] or [os.path.basename(p)[:-5] for p in sorted(os.listdir(HD)) if p.endswith('.json') for p in [os.path.join(HD, p)]]
    keys = [k for k in keys if k in R.LOOKS]
    with Pool(min(4, len(keys))) as pool:
        for key, out in pool.imap_unordered(render, keys):
            install(key, out); print('xong', key, flush=True)
