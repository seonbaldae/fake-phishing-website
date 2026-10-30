from pathlib import Path
from PIL import Image, ImageChops
import tinycss2
ROOT=Path(__file__).resolve().parents[1]
for name,dimensions in [('hackathon-hero',(1120,108)),('hackathon-card',(440,120))]:
    base=ROOT/'public/assets'/name
    with Image.open(base.with_suffix('.gif')) as image:
        assert image.format == 'GIF'
        assert image.size == dimensions
        assert image.n_frames >= 20
        image.seek(0); first=image.convert('RGB')
        image.seek(image.n_frames//2); second=image.convert('RGB')
        assert ImageChops.difference(first,second).getbbox() is not None
    with Image.open(base.parent/f'{name}-still.png') as still:
        assert still.format=='PNG' and still.size==dimensions
assert len(list((ROOT/'public/assets/tiles').glob('ad-*.png')))==39
for file in ['public/styles.css']:
    errors=[x for x in tinycss2.parse_stylesheet((ROOT/file).read_text(),skip_whitespace=True,skip_comments=True) if x.type=='error']
    assert not errors,errors
print('PASS: two real multi-frame GIFs, still PNGs, 39 tiles, CSS parsed')
