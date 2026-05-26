"""从 debug_icon.png 生成 Android 各密度的 debug 图标（ic_launcher + foreground）"""
from PIL import Image
import os, sys

SRC = os.path.join(os.path.dirname(__file__), '..', 'debug_icon.png')
OUT_BASE = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'android', 'app', 'src', 'debug', 'res')

# 各密度对应的像素尺寸
# ic_launcher: 标准 mipmap 尺寸
# ic_launcher_foreground: 自适应图标前景 (108dp base)
DENSITIES = {
    'mdpi':   {'launcher': 48,  'foreground': 108},
    'hdpi':   {'launcher': 72,  'foreground': 162},
    'xhdpi':  {'launcher': 96,  'foreground': 216},
    'xxhdpi': {'launcher': 144, 'foreground': 324},
    'xxxhdpi':{'launcher': 192, 'foreground': 432},
}

def main():
    if not os.path.isfile(SRC):
        print(f'[ERROR] 源文件不存在: {SRC}')
        sys.exit(1)

    img = Image.open(SRC).convert('RGBA')
    print(f'源图标: {img.size} mode={img.mode}')

    for dens, sizes in DENSITIES.items():
        mip_dir = os.path.join(OUT_BASE, f'mipmap-{dens}')
        os.makedirs(mip_dir, exist_ok=True)

        # --- ic_launcher.png ---
        launcher = img.resize((sizes['launcher'], sizes['launcher']), Image.LANCZOS)
        path_launcher = os.path.join(mip_dir, 'ic_launcher.png')
        launcher.save(path_launcher, 'PNG')
        print(f'  {dens}: ic_launcher.png {launcher.size}')

        # --- ic_launcher_foreground.png ---
        # 自适应图标前景在 108dp 视口内居中 72dp 内容
        # 直接用源图缩放到 foreground 尺寸
        fg = img.resize((sizes['foreground'], sizes['foreground']), Image.LANCZOS)
        path_fg = os.path.join(mip_dir, 'ic_launcher_foreground.png')
        fg.save(path_fg, 'PNG')
        print(f'  {dens}: ic_launcher_foreground.png {fg.size}')

    print('\n✅ debug 图标已生成到 android/app/src/debug/res/')

if __name__ == '__main__':
    main()
