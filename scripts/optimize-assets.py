"""Build runtime WebP and small thumbnails from supplied originals (Pillow required)."""
from PIL import Image
from pathlib import Path
import json
root = Path(__file__).resolve().parents[1]
rows = []
def build(source, dest, bound, quality=84):
 im = Image.open(root/source)
 im.thumbnail(bound, Image.Resampling.LANCZOS)
 if im.mode == 'RGBA' and im.getextrema()[-1] == (255,255): im = im.convert('RGB')
 target=root/dest; target.parent.mkdir(parents=True,exist_ok=True)
 im.save(target,'WEBP',quality=quality,method=6)
 rows.append(dict(source=source,output=dest,width=im.width,height=im.height,beforeBytes=(root/source).stat().st_size,bytes=target.stat().st_size))
for name in ['gameplay','garden','laboratory','night','workshop']:
 source=f'assets/background/{name}-bg.webp'
 build(source,f'assets/runtime/{name}-bg.webp',(832,1480))
 build(source,f'assets/thumbnails/{name}-bg-thumb.webp',(240,426),78)
for name in ['normal','crack-1','crack-2','broken','crystal']:
 source=f'assets/bottles/bottle-{name}.webp'
 build(source,f'assets/runtime/bottle-{name}.webp',(640,960),88)
 if name in ['normal','crystal']:build(source,f'assets/thumbnails/bottle-{name}-thumb.webp',(160,240),84)
for name,bound in [('main-bg',(832,1248)),('logo',(768,384)),('tagline-board',(640,360))]:
 build(f'assets/main/{name}.png',f'assets/runtime/{name}.webp',bound,86)
(root/'docs/asset-optimization.json').write_text(json.dumps(rows,indent=2)+'\n')
print(f'{len(rows)} runtime/thumbnail assets generated')
