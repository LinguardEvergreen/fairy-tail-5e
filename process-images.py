#!/usr/bin/env python3
"""Process all Fairy Tail images: rembg for characters, passthrough for already-transparent."""
from rembg import remove
from PIL import Image
import numpy as np
import os

TEMP = "E:/Project Claude/FoundryVTT/fairy-tail-5e/temp-imgs"
ASSETS = "E:/Project Claude/FoundryVTT/fairy-tail-5e/assets/images"

# Images from pngimg.com that already have REAL transparency - don't touch
ALREADY_TRANSPARENT = {
    "fuoco", "acqua", "fulmine", "terra", "corpo-celeste", "carte",
    "take-over", "solid-script", "spazio-aereo", "ingranaggi",
    "sabbia", "creazione", "armi-da-fuoco", "cambio-stock"
}

# Source -> (category, filename) mapping
TARGETS = [
    # Magie (14) - thematic element images (already transparent from pngimg.com)
    ("fuoco",         "magie", "fuoco"),
    ("acqua",         "magie", "acqua"),
    ("fulmine",       "magie", "fulmine"),
    ("terra",         "magie", "terra"),
    ("corpo-celeste", "magie", "corpo-celeste"),
    ("carte",         "magie", "carte"),
    ("take-over",     "magie", "take-over"),
    ("solid-script",  "magie", "solid-script"),
    ("spazio-aereo",  "magie", "spazio-aereo"),
    ("ingranaggi",    "magie", "ingranaggi"),
    ("sabbia",        "magie", "sabbia"),
    ("creazione",     "magie", "creazione"),
    ("armi-da-fuoco", "magie", "armi-da-fuoco"),
    ("cambio-stock",  "magie", "cambio-stock"),

    # Classi (7)
    ("natsu",    "classi", "mago-combattente"),
    ("erza",     "classi", "guerriero"),
    ("gajeel",   "classi", "mago-di-strada"),
    ("wendy",    "classi", "mago-di-supporto"),
    ("erza",     "classi", "mago-difensore"),
    ("mystogan", "classi", "mago-furtivo"),
    ("mavis",    "classi", "mago-tattico"),

    # Razze (8)
    ("natsu",       "razze", "dragon-slayer"),
    ("gray",        "razze", "devil-slayer"),
    ("happy",       "razze", "exceed"),
    ("mirajane",    "razze", "ibrido-demone-galuna"),
    ("carla",       "razze", "ibrido-gatto"),
    ("pantherlily", "razze", "ibrido-lucertola"),
    ("elfman",      "razze", "ibrido-lupo"),
    ("lucy",        "razze", "umani"),

    # Background (7)
    ("logo",      "background", "mago-gilda"),
    ("gildarts",  "background", "mago-errante"),
    ("laxus",     "background", "mago-combattimento"),
    ("levy",      "background", "studioso"),
    ("gajeel",    "background", "mago-selvaggio"),
    ("gray",      "background", "minatore-lacrima"),
    ("freed",     "background", "camminatore-specchio"),

    # Stili (10)
    ("wendy",       "stili", "combattente-agile"),
    ("erza",        "stili", "combattente-due-armi"),
    ("gray",        "stili", "contrattaccante"),
    ("freed",       "stili", "difensore-arcano"),
    ("erza",        "stili", "duellante"),
    ("elfman",      "stili", "furia-marziale"),
    ("cambio-stock","stili", "lama-infusa"),
    ("erza",        "stili", "maestro-armi"),
    ("natsu",       "stili", "pugni-devastanti"),
    ("laxus",       "stili", "spirito-combattivo"),
]

def main():
    cache = {}  # src_key -> processed RGBA image
    ok = 0

    for src_key, category, filename in TARGETS:
        src_path = os.path.join(TEMP, f"{src_key}.png")
        dst_dir = os.path.join(ASSETS, category)
        dst_path = os.path.join(dst_dir, f"{filename}.webp")
        os.makedirs(dst_dir, exist_ok=True)

        if not os.path.exists(src_path):
            print(f"  [SKIP] {category}/{filename} - {src_key}.png missing")
            continue

        if src_key not in cache:
            try:
                img = Image.open(src_path)
                if src_key in ALREADY_TRANSPARENT:
                    # Already has real transparency - just convert
                    cache[src_key] = img.convert("RGBA")
                    print(f"  [PASS] {src_key} (already transparent)")
                else:
                    # Use rembg AI to remove background
                    result = remove(img)
                    cache[src_key] = result
                    # Check quality
                    arr = np.array(result)
                    pct = (arr[:,:,3] < 250).sum() / arr[:,:,3].size * 100
                    print(f"  [REMBG] {src_key} ({pct:.0f}% transparent)")
            except Exception as e:
                print(f"  [ERR] {src_key}: {e}")
                continue

        try:
            cache[src_key].save(dst_path, "WEBP", quality=90)
            print(f"    -> {category}/{filename}.webp")
            ok += 1
        except Exception as e:
            print(f"  [ERR] {category}/{filename}: {e}")

    print(f"\n=== Done: {ok}/{len(TARGETS)} images ===")

if __name__ == "__main__":
    main()
