"""Đưa thú cưỡi làm từ sheet có sẵn (tools/spriteup.py, thư mục design/mounts3) vào game:
chép ảnh vào public/assets/mounts và gộp meta riêng từng thú vào public/assets/mounts.json (khoá per / seat / seats).

  python3 tools/install_mounts3.py [mã thú ...]

Lưu ý: chạy lại tools/mounts2.py / mounts.py sẽ ghi đè ảnh cùng tên (ngua_nau, bach_ma, hac_ma) -> chạy lại file này sau đó.
"""
import json
import os
import shutil
import sys

SRC, DST = 'design/mounts3', 'public/assets'
meta3 = json.load(open(os.path.join(SRC, 'mounts.json')))
mp = os.path.join(DST, 'mounts.json')
game = json.load(open(mp))
game.setdefault('per', {})
for mid in sys.argv[1:] or list(meta3):
    m = dict(meta3[mid])
    shutil.copy(os.path.join(SRC, mid + '.png'), os.path.join(DST, 'mounts', mid + '.png'))
    game['seats'][mid] = m.pop('seats')
    game['seat'][mid] = game['seats'][mid]['side']
    m.pop('flies', None)
    game['per'][mid] = m
    print('đã đưa vào game:', mid)
json.dump(game, open(mp, 'w'), separators=(',', ':'))
