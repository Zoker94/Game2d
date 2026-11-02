from PIL import Image
from cut2 import cut, U
im=Image.open(U+'804ccc39-image.png')
rows=[(0,510),(511,1026),(1027,1536)]
out=[]
for r,(y0,y1) in enumerate(rows):
    n=4 if r==0 else 6; cw=im.width/n
    for i in range(n):
        cell=im.crop((int(i*cw)+4,y0+4,int((i+1)*cw)-4,y1-4))
        sz=(int(cell.width*0.6),int(cell.height*0.6))
        c=cut(None,img=cell,margin=0.0,size=sz)
        if r==2 and i==5:   # logo góc dưới phải của ô cuối
            px=c.load()
        c.save(f'horse_{r}_{i}.png'); out.append((r,i,c.size))
print(out)
