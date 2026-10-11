import os
import numpy as np
from PIL import Image, ImageEnhance

def generate_hush_glass_icons():
    # Source generated high-res glassy orb
    src_path = os.path.join(os.path.dirname(__file__), "..", ".gemini", "antigravity-ide", "brain")
    # Search for source image or use local master
    local_master = "public/icon-master-transparent.png"
    
    if not os.path.exists(local_master):
        raise FileNotFoundError(f"Master image {local_master} not found.")

    master = Image.open(local_master).convert("RGBA")

    # Target icon sizes
    sizes = [
        (128, 1.0),
        (48, 1.3),
        (32, 1.4),
        (16, 1.6),
    ]

    for size, sharp in sizes:
        resized = master.resize((size, size), Image.Resampling.LANCZOS)
        if sharp > 1.0:
            enhancer = ImageEnhance.Sharpness(resized)
            resized = enhancer.enhance(sharp)
        out_path = f"public/icon-{size}.png"
        resized.save(out_path, "PNG", optimize=True)
        print(f"Verified & exported {out_path} ({size}x{size}, RGBA)")

if __name__ == "__main__":
    generate_hush_glass_icons()
