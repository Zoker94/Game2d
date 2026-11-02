from PIL import Image, ImageDraw
import numpy as np
RES=2
H={'ngua_nau':100,'hac_ma':104,'bach_ma':100,'kim_nguu':96,'kim_quy':82,'hoa_ky_lan':104,'phuong_hoang':122,'thanh_long':118}
def crisp(im):
    a=np.asarray(im).copy();a[...,3]=np.where(a[...,3]>110,255,0);return Image.fromarray(a,'RGBA')
def norm(im,h,flip=True):
    im=im.crop(im.getbbox());w=round(im.width*h*RES/im.height)
    im=crisp(im.resize((w,h*RES),Image.LANCZOS))
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
if __name__=='__main__':
    for k,h in H.items():
        src=Image.open(('horse_0_2' if k=='ngua_nau' else k+'_cut')+'.png')
        im=norm(src,h,flip=k!='ngua_nau')
        g=Image.new('RGBA',im.size,(60,90,50,255));g.alpha_composite(im);d=ImageDraw.Draw(g)
        for x in range(0,im.width,20):d.line([(x,0),(x,im.height)],fill=(255,255,255,90) if x%100 else (255,0,0,200))
        for y in range(0,im.height,20):d.line([(0,y),(im.width,y)],fill=(255,255,255,90) if y%100 else (255,0,0,200))
        g.save(k+'_grid.png');print(k,im.size)
