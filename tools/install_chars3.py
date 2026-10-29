#!/usr/bin/env python3
# Cài bộ nhân vật vẽ bằng tools/rig3.py vào game:
#   public/assets/chars_hd/  ô 288 (máy tính / màn hình nét cao)
#   public/assets/chars/     cùng hình thu về ô 144 (máy yếu, tiết kiệm dữ liệu) – thay bộ cũ
# rồi cắt dải theo nhóm động tác bằng tools/splitsheets.py.
# Dùng: python3 tools/rig3.py <thư mục tạm>  &&  python3 tools/install_chars3.py <thư mục tạm>
import glob, json, os, shutil, subprocess, sys
import numpy as np
from PIL import Image

src = sys.argv[1]
HD, SD = 'public/assets/chars_hd', 'public/assets/chars'
for d in (HD, SD):
    if os.path.isdir(d):
        for f in glob.glob(d + '/*'): os.remove(f)
    os.makedirs(d, exist_ok=True)

def quant(arr, path):
    Image.fromarray(arr, 'RGBA').quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)

for jf in sorted(glob.glob(src + '/*.json')):
    cls = os.path.basename(jf)[:-5]
    meta = json.load(open(jf))
    shutil.copy(jf, HD)
    sd = dict(meta, cell=meta['cell'] // 2, foot=[v / 2 for v in meta['foot']], gameScale=meta['gameScale'] * 2)
    json.dump(sd, open(f'{SD}/{cls}.json', 'w'), ensure_ascii=False)
    for layer in meta['layers']:
        p = f'{src}/{cls}_{layer}.png'
        if not os.path.exists(p): continue
        shutil.copy(p, HD)
        im = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32)
        h, w = im.shape[0] // 2, im.shape[1] // 2
        a = im[..., 3:4] / 255.0
        q = (im[..., :3] * a).reshape(h, 2, w, 2, 3).sum((1, 3))
        A = a.reshape(h, 2, w, 2, 1).sum((1, 3))
        rgb = q / np.maximum(A, 1e-6)
        out = np.zeros((h, w, 4), np.uint8)
        out[..., :3] = np.clip(rgb, 0, 255)
        if layer.startswith('fx'): out[..., 3] = np.clip(A[..., 0] / 4 * 255, 0, 255)   # hiệu ứng: giữ trong suốt mềm
        else: out[..., 3] = np.where(A[..., 0] >= 2, 255, 0)                            # thân / trang bị: cạnh sắc như bản gốc
        quant(out, f'{SD}/{cls}_{layer}.png')
    print('cài', cls)
for d in (HD, SD): subprocess.run([sys.executable, 'tools/splitsheets.py', d], check=True)
