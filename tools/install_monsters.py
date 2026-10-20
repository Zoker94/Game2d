# Đưa sprite quái / boss vẽ mới (tools/monsters2.py: hình người, ma; tools/beasts3.py: thú) vào game:
# chép design/monsters2/<id>.png -> public/assets/monsters/ và cập nhật public/assets/monsters.json.
# Dùng: python3 tools/install_monsters.py [thư mục nguồn] [thư mục assets]
import json, os, shutil, sys

src = sys.argv[1] if len(sys.argv) > 1 else 'design/monsters2'
root = sys.argv[2] if len(sys.argv) > 2 else 'public/assets'
meta_path = os.path.join(root, 'monsters.json')
meta = json.load(open(meta_path))
new = {}
for f in ('meta_human.json', 'meta_beast.json'):
    p = os.path.join(src, f)
    if os.path.exists(p): new.update(json.load(open(p)))
for mid, m in new.items():
    shutil.copy(os.path.join(src, mid + '.png'), os.path.join(root, 'monsters', mid + '.png'))
    meta['mon'][mid] = m
json.dump(meta, open(meta_path, 'w'), ensure_ascii=False)
print('đã cài', len(new), 'quái')
