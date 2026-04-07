#!/usr/bin/env python3
"""Download Fairy Tail themed images from pngegg, remove white bg, convert to WebP."""
import os, urllib.request
from PIL import Image
import numpy as np

TEMP = "E:/Project Claude/FoundryVTT/fairy-tail-5e/temp-imgs"
ASSETS = "E:/Project Claude/FoundryVTT/fairy-tail-5e/assets/images"
os.makedirs(TEMP, exist_ok=True)

# ─── Thematic element images for magie ───
SOURCES = {
    # Magie elements
    "fuoco":        "https://e7.pngegg.com/pngimages/446/964/png-clipart-fireball-sphere-flaming-orb-energy-magic-fantasy-fire-burning-planet-mystical-flame-magical-explosion-fiery-energy-fantasy-magic-power-supernatural-fire.png",
    "acqua":        "https://e7.pngegg.com/pngimages/190/123/png-clipart-blue-blue-water-splash-blue-illustration-texture-blue.png",
    "fulmine":      "https://e7.pngegg.com/pngimages/406/929/png-clipart-lightning-strike-collections-lightning-bolt-best-thunder-light-miscellaneous-blue.png",
    "terra":        "https://e7.pngegg.com/pngimages/89/506/png-clipart-ice-stone-gem-winter-crystal-frost-cut-gem-gemstone-mineral-water.png",
    "corpo-celeste":"https://e7.pngegg.com/pngimages/412/522/png-clipart-the-constellations-star-names-night-sky-big-dipper-star-sphere-constellations.png",
    "carte":        "https://e7.pngegg.com/pngimages/70/565/png-clipart-tarot-cards-halloween-magic-spells-witchcraft-sorcery-magical-objects-fantasy-superstitions-divination.png",
    "take-over":    "https://e7.pngegg.com/pngimages/886/243/png-clipart-drawing-demon-art-devil-sketch-demon-pencil-monochrome.png",
    "solid-script": "https://e7.pngegg.com/pngimages/783/586/png-clipart-magic-spell-book-illustration-the-secret-book-of-shadows-magic-grimoire-magic-book-desktop-wallpaper-magic.png",
    "spazio-aereo": "https://e7.pngegg.com/pngimages/100/150/png-clipart-tornado-wind-terrible-tornado-effect-hand.png",
    "ingranaggi":   "https://e7.pngegg.com/pngimages/783/472/png-clipart-gear-steampunk-clockwork-computer-icons-top-gear-color-top-gear.png",
    "sabbia":       "https://e7.pngegg.com/pngimages/131/585/png-clipart-hourglass-graphy-time-sand-timer-time-timer.png",
    "creazione":    "https://e7.pngegg.com/pngimages/7/782/png-clipart-snowflake-ice-snowflakes-blue-symmetry.png",
    "armi-da-fuoco":"https://e7.pngegg.com/pngimages/89/902/png-clipart-silver-revolver-firearm-revolver-weapon-pistol-handgun-hand-gun-hand-gun-rifle.png",
    "cambio-stock": "https://e7.pngegg.com/pngimages/335/440/png-clipart-fantasy-sword-crystal-blade-glowing-weapon-enchanted-sword-ice-sword-rpg-magic-weapon-energy-sword-glowing-crystal-blade-epic-fantasy-weapon-magical-sword.png",
    # Character images for classi/razze/etc
    "natsu":    "https://e7.pngegg.com/pngimages/114/845/png-clipart-natsu-dragneel-fairy-tail-anime-fairy-tail-manga-cartoon.png",
    "erza":     "https://e7.pngegg.com/pngimages/678/724/png-clipart-fairy-tail-anime-erza-scarlet-drawing-fairy-tail-cg-artwork-black-hair.png",
    "lucy":     "https://e7.pngegg.com/pngimages/821/731/png-clipart-lucy-heartfilia-fairy-tail-timeskip-manga-anime-celestial-bodies-hand-photography.png",
    "gray":     "https://e7.pngegg.com/pngimages/111/986/png-clipart-gray-fullbuster-fairy-tail-anime-drawing-character-gray-purple-black-hair.png",
    "laxus":    "https://e7.pngegg.com/pngimages/177/312/png-clipart-laxus-dreyar-fairy-tail-character-dragon-slayer-anime-fairy-tail-cartoon-fictional-character.png",
    "wendy":    "https://e7.pngegg.com/pngimages/785/251/png-clipart-wendy-marvell-fairy-tail-anime-dragon-slayer-fairy-tail-fictional-character-cartoon.png",
    "gajeel":   "https://e7.pngegg.com/pngimages/511/519/png-clipart-gajeel-redfox-fairy-tail-wendy-marvell-natsu-dragneel-desktop-fairy-tail-television-hand.png",
    "happy":    "https://e7.pngegg.com/pngimages/570/51/png-clipart-gray-fullbuster-fairy-tail-anime-cat-happy-fairy-tail-happy-mammal-cat-like-mammal.png",
    "elfman":   "https://e7.pngegg.com/pngimages/608/743/png-clipart-elfman-strauss-membri-di-fairy-tail-mirajane-strauss-manga-fairy-tail-fictional-character-anime-music-video.png",
    "mavis":    "https://e7.pngegg.com/pngimages/841/140/png-clipart-mavis-vermilion-fairy-tail-natsu-dragneel-anime-manga-fairy-tail-child-mammal.png",
    "mystogan": "https://e7.pngegg.com/pngimages/212/496/png-clipart-jellal-fernandez-erza-scarlet-desktop-fairy-tail-mystogan-fairy-tail-black-hair-fictional-character.png",
    "freed":    "https://e7.pngegg.com/pngimages/359/703/png-clipart-fairy-tail-freed-justine-honda-freed-anime-mangaka-mirajane-strauss-purple-photography.png",
    "mirajane": "https://e7.pngegg.com/pngimages/815/491/png-clipart-erza-scarlet-anime-fairy-tail-mirajane-strauss-demon-rider-black-hair-manga.png",
    "logo":     "https://e7.pngegg.com/pngimages/361/891/png-clipart-fairy-tail-logo-bleach-fairy-tail-leaf-logo.png",
    "levy":     "https://e7.pngegg.com/pngimages/897/601/png-clipart-drawing-fairy-tail-anime-character-fairy-tail-hand-human.png",
}

# ─── Mapping: source key -> (category, filename) ───
TARGETS = [
    # Magie (14) - thematic element images
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
    ("freed",    "classi", "mago-difensore"),
    ("mystogan", "classi", "mago-furtivo"),
    ("mavis",    "classi", "mago-tattico"),
    # Razze (8)
    ("natsu",    "razze", "dragon-slayer"),
    ("gray",     "razze", "devil-slayer"),
    ("happy",    "razze", "exceed"),
    ("mirajane", "razze", "ibrido-demone-galuna"),
    ("happy",    "razze", "ibrido-gatto"),
    ("gajeel",   "razze", "ibrido-lucertola"),
    ("elfman",   "razze", "ibrido-lupo"),
    ("logo",     "razze", "umani"),
    # Background (7)
    ("logo",     "background", "mago-gilda"),
    ("mystogan", "background", "camminatore-specchio"),
    ("natsu",    "background", "mago-combattimento"),
    ("gajeel",   "background", "mago-errante"),
    ("elfman",   "background", "mago-selvaggio"),
    ("levy",     "background", "studioso"),
    ("lucy",     "background", "minatore-lacrima"),
    # Stili (10)
    ("erza",     "stili", "combattente-agile"),
    ("erza",     "stili", "combattente-due-armi"),
    ("gray",     "stili", "contrattaccante"),
    ("freed",    "stili", "difensore-arcano"),
    ("erza",     "stili", "duellante"),
    ("elfman",   "stili", "furia-marziale"),
    ("cambio-stock", "stili", "lama-infusa"),
    ("erza",     "stili", "maestro-armi"),
    ("elfman",   "stili", "pugni-devastanti"),
    ("laxus",    "stili", "spirito-combattivo"),
]

def remove_white_bg(img):
    """Remove white/near-white background, make transparent."""
    rgba = img.convert("RGBA")
    arr = np.array(rgba, dtype=np.float32)
    r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
    min_rgb = np.minimum(np.minimum(r, g), b)

    # Pure white (>245) -> fully transparent
    pure_white = (r > 245) & (g > 245) & (b > 245)
    # Near-white (220-245) -> gradient transparency for smooth edges
    near_white = (min_rgb > 220) & ~pure_white

    new_alpha = a.copy()
    new_alpha[pure_white] = 0
    edge_factor = np.clip((245 - min_rgb) / 25.0, 0, 1)
    new_alpha[near_white] = (edge_factor[near_white] * 255).astype(np.float32)

    arr[:,:,3] = new_alpha
    return Image.fromarray(arr.astype(np.uint8), "RGBA")

def main():
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    # Step 1: Download
    print("=== Downloading ===")
    for name, url in SOURCES.items():
        dest = os.path.join(TEMP, f"{name}.png")
        if os.path.exists(dest) and os.path.getsize(dest) > 5000:
            print(f"  [skip] {name}")
            continue
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
            with open(dest, "wb") as f:
                f.write(data)
            print(f"  [OK] {name} ({len(data)//1024}KB)")
        except Exception as e:
            print(f"  [ERR] {name}: {e}")

    # Step 2: Process
    print("\n=== Processing ===")
    cache = {}
    ok = 0
    for src_key, category, filename in TARGETS:
        src_path = os.path.join(TEMP, f"{src_key}.png")
        dst_dir = os.path.join(ASSETS, category)
        dst_path = os.path.join(dst_dir, f"{filename}.webp")
        os.makedirs(dst_dir, exist_ok=True)

        if src_key not in cache:
            try:
                img = Image.open(src_path)
                cache[src_key] = remove_white_bg(img)
            except Exception as e:
                print(f"  [ERR] {src_key}: {e}")
                continue

        try:
            cache[src_key].save(dst_path, "WEBP", quality=85)
            print(f"  [OK] {category}/{filename}.webp")
            ok += 1
        except Exception as e:
            print(f"  [ERR] {category}/{filename}: {e}")

    print(f"\n=== Done: {ok}/{len(TARGETS)} images ===")

if __name__ == "__main__":
    main()
