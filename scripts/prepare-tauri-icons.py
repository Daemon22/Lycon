from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/webdev-static-assets/lycon-archive/wolf-logo-original.png')
out = Path('/home/ubuntu/lycon-permanent/src-tauri/icons')
out.mkdir(parents=True, exist_ok=True)

if not source.exists():
    raise SystemExit(f'Missing canonical logo source: {source}')

image = Image.open(source).convert('RGBA')
# Preserve the supplied mark and fit it into square transparent canvases for native app shells.
side = max(image.width, image.height)
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.alpha_composite(image, ((side - image.width) // 2, (side - image.height) // 2))

sizes = [32, 64, 128, 256, 512]
for size in sizes:
    rendered = canvas.resize((size, size), Image.Resampling.LANCZOS)
    rendered.save(out / f'{size}x{size}.png', optimize=True)

canvas.resize((512, 512), Image.Resampling.LANCZOS).save(out / 'icon.png', optimize=True)
canvas.resize((512, 512), Image.Resampling.LANCZOS).save(out / 'icon.ico', format='ICO', sizes=[(32, 32), (64, 64), (128, 128), (256, 256), (512, 512)])
print(f'Prepared {len(sizes) + 2} Tauri icon files from {source}')
