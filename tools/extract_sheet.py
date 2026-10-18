# Dùng: python3 tools/extract_sheet.py <bang_asset.png> [thu_muc_ra]  (cần pillow, numpy, scipy)
# Tách lại khung nhân vật: lấp lỗ, bỏ vệt tốc độ / mảnh hiệu ứng, làm nét bằng giảm màu
from PIL import Image
import numpy as np, os, sys
from scipy import ndimage
A=np.array(Image.open(sys.argv[1]).convert('RGB')).astype(int)
R=[531,580,629,679,729,780,831,880,934,988]
C=[199,347,527,695,875,1060,1204,1347,1513]
CLS=['thieulam','ngudoc','thienvuong','caibang','vodang','ngamy','thuyyen','conlon','duongmon']
COL=['walk','run','jump','atk','skill','hurt','dead','idle']
D=sys.argv[2] if len(sys.argv) > 2 else 'public/assets/chars'; os.makedirs(D,exist_ok=True)
S=1.3
def pick(cell, mode):
  bg=np.median(np.concatenate([cell[0],cell[-1],cell[:,0],cell[:,-1]]),0)
  d=np.abs(cell-bg).sum(2)
  core=d>40
  # bỏ nét mảnh (vệt tốc độ, tia sáng): mở hình theo chiều dọc rồi ngang
  op=ndimage.binary_opening(core,structure=np.ones((3,1)))
  op=ndimage.binary_opening(op,structure=np.ones((1,2)))
  lab,n=ndimage.label(ndimage.binary_dilation(op,iterations=1),structure=np.ones((3,3)))
  if n==0: return None
  objs=ndimage.find_objects(lab)
  sizes=ndimage.sum(op,lab,range(1,n+1))
  big=[i for i in range(n) if sizes[i]>=max(40,sizes.max()*0.25) and (objs[i][0].stop-objs[i][0].start)>=18]
  if mode=='left': k=min(big,key=lambda i:objs[i][1].start)
  elif mode=='right': k=max(big,key=lambda i:objs[i][1].stop)
  else: k=max(range(n),key=lambda i:sizes[i])
  main=lab==k+1
  m=core & ndimage.binary_dilation(main,iterations=2)
  # lấp lỗ thưa bên trong thân
  m=ndimage.binary_closing(m,structure=np.ones((3,3)),iterations=1)|m
  m=ndimage.binary_fill_holes(m)
  # nhặt thêm viền tối sát thân (tóc, đai, giày màu sẫm)
  ring=ndimage.binary_dilation(m,iterations=1)&~m&(d>18)
  m=m|ring
  m=ndimage.binary_fill_holes(m)
  if mode!='big':
    # chỉ giữ vùng quanh thân (đầu làm tâm): bỏ vệt chém / hiệu ứng dài
    ys0,xs0=np.where(m); top=ys0.min()
    hx=int(xs0[ys0<top+12].mean())
    keep=np.zeros_like(m); keep[:,max(0,hx-24):hx+28]=True; m=m&keep
  # bỏ mảnh rời nhỏ
  lab2,n2=ndimage.label(m,structure=np.ones((3,3)))
  if n2>1:
    sz=ndimage.sum(m,lab2,range(1,n2+1)); m=lab2==(np.argmax(sz)+1)
  ys,xs=np.where(m)
  y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
  return cell[y0:y1,x0:x1],m[y0:y1,x0:x1]
def finish(rgb,m,W=64):
  h,w=m.shape; nw,nh=round(w*S),round(h*S)
  rgba=np.dstack([rgb*m[...,None],m*255]).astype(np.uint8)
  a=np.array(Image.fromarray(rgba,'RGBA').resize((nw,nh),Image.LANCZOS)).astype(float)
  al=a[...,3]/255; rgbn=np.where(al[...,None]>0.02,a[...,:3]/np.maximum(al[...,None],0.02),0)
  mm=al>0.42
  mm=ndimage.binary_fill_holes(mm)
  rgbn=np.clip(rgbn*1.06+4,0,255).astype(np.uint8)
  # giảm màu cho nét pixel
  im=Image.fromarray(rgbn).quantize(28,method=Image.MEDIANCUT).convert('RGB')
  q=np.array(im)
  o=np.zeros((nh,nw,4),np.uint8); o[...,:3]=q; o[...,3]=mm*255
  pad=np.pad(mm,1); nb=pad[:-2,1:-1]|pad[2:,1:-1]|pad[1:-1,:-2]|pad[1:-1,2:]
  o[nb&~mm]=[20,14,22,255]
  img=Image.fromarray(o,'RGBA'); img=img.crop(img.getbbox())
  W=max(W,img.width+2)
  cv=Image.new('RGBA',(W,64)); cv.alpha_composite(img,(W//2-img.width//2,max(0,62-img.height)))
  return cv
meta={}
for ri,cls in enumerate(CLS):
  for ci,col in enumerate(COL):
    cell=A[R[ri]+3:R[ri+1]-2,C[ci]+3:C[ci+1]-2]
    if col=='walk':
      half=cell.shape[1]//2
      parts=[(cell[:,:half],'big'),(cell[:,half:],'big')]
    else:
      parts=[(cell[:,:72] if col=='skill' else cell,{'run':'right','dead':'big','idle':'big'}.get(col,'left'))]
    for k,(cc,mode) in enumerate(parts):
      r=pick(cc,mode)
      name=f'{cls}_{col}{k if col=="walk" else ""}'
      img=finish(*r, W=80 if col=='dead' else 64)
      img.save(f'{D}/{name}.png'); meta[name]=img.size
print({k:v for k,v in meta.items() if v[0]>64 and 'dead' not in k})
