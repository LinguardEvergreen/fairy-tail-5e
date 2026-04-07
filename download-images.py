#!/usr/bin/env python3
"""Download Fairy Tail themed images, convert to WebP with transparency."""
import os, urllib.request, ssl
from PIL import Image
import numpy as np

TEMP = "E:/Project Claude/FoundryVTT/fairy-tail-5e/temp-imgs"
ASSETS = "E:/Project Claude/FoundryVTT/fairy-tail-5e/assets/images"
os.makedirs(TEMP, exist_ok=True)

# SSL context for sites with certificate issues
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}

# ─── Image sources ───
# Magie: thematic element images (pngimg.com = actual transparent PNGs)
# Characters: from various PNG sites with actual transparency
SOURCES = {
    # === MAGIE (thematic elements) ===
    "fuoco":        "https://pngimg.com/d/fire_PNG6023.png",
    "acqua":        "https://pngimg.com/uploads/water_splash/water_splash_PNG27.png",
    "fulmine":      "https://pngimg.com/uploads/lightning/lightning_PNG24.png",
    "terra":        "https://pngimg.com/d/stone_PNG13561.png",
    "corpo-celeste":"https://pngimg.com/d/gemini_PNG42.png",
    "carte":        "https://pngimg.com/uploads/cards/cards_PNG8490.png",
    "take-over":    "https://pngimg.com/uploads/demon/demon_PNG39.png",
    "solid-script": "https://pngimg.com/d/wand_PNG26.png",
    "spazio-aereo": "https://pngimg.com/uploads/hurricane/hurricane_PNG26.png",
    "ingranaggi":   "https://pngimg.com/d/gear_PNG53.png",
    "sabbia":       "https://pngimg.com/d/hourglass_PNG30.png",
    "creazione":    "https://pngimg.com/d/wand_PNG26.png",
    "armi-da-fuoco":"https://pngimg.com/d/gun_PNG1355.png",
    "cambio-stock": "https://pngimg.com/d/sword_PNG5506.png",

    # === CHARACTERS (from transparent PNG sites) ===
    # Natsu Dragneel - Dragon Slayer, battle mage
    "natsu":     "https://www.kindpng.com/picc/m/129-1293096_natsu-dragneel-full-body-photo-fairy-tail-natsu.png",
    # Erza Scarlet - Armored warrior, weapons master
    "erza":      "https://www.pngkit.com/png/detail/162-1627674_render-fairy-tail-erza-scarlet-fairy-tail-erza.png",
    # Gray Fullbuster - Ice Devil Slayer
    "gray":      "https://www.kindpng.com/picc/m/449-4499420_fairy-tail-gray-png-transparent-png.png",
    # Wendy Marvell - Sky Dragon Slayer, healer/support
    "wendy":     "https://www.kindpng.com/picc/m/90-903631_wendy-marvell-fairy-tail-dragon-cry-hd-png.png",
    # Gajeel Redfox - Iron Dragon Slayer, tough street fighter
    "gajeel":    "https://e7.pngegg.com/pngimages/386/787/png-clipart-gajeel-redfox-fairy-tail-character-art-fairy-tail-hand-manga.png",
    # Happy - Exceed cat
    "happy":     "https://www.pngkey.com/png/detail/826-8261347_happy-the-cat-from-fairy-tale-happy-fairy.png",
    # Mystogan - Mysterious masked mage
    "mystogan":  "https://www.pngitem.com/pimgs/m/658-6587478_fairy-tail-mystogan-hd-png-download.png",
    # Mavis Vermillion - First Master, supreme tactician
    "mavis":     "https://www.pngitem.com/pimgs/m/292-2923359_fairy-tail-mavis-png-transparent-png.png",
    # Elfman Strauss - Beast Soul Take Over, physical fighter
    "elfman":    "https://e7.pngegg.com/pngimages/608/743/png-clipart-elfman-strauss-membri-di-fairy-tail-mirajane-strauss-manga-fairy-tail-fictional-character-anime-music-video.png",
    # Lucy Heartfilia - Celestial mage, human
    "lucy":      "https://e7.pngegg.com/pngimages/791/535/png-clipart-fairytail-lucy-heartfilia-lucy-heartfilia-natsu-dragneel-fairy-tail-portable-guild-costume-fairy-tail-halloween-costume-fictional-character.png",
    # Laxus Dreyar - Lightning Dragon Slayer, combat specialist
    "laxus":     "https://www.kindpng.com/picc/m/765-7650377_laxus-dreyar-png-laxus-dreyar-transparent-png.png",
    # Mirajane Strauss - Satan Soul Take Over, demon hybrid
    "mirajane":  "https://e7.pngegg.com/pngimages/815/491/png-clipart-erza-scarlet-anime-fairy-tail-mirajane-strauss-demon-rider-black-hair-manga.png",
    # Freed Justine - Rune/enchantment mage
    "freed":     "https://e7.pngegg.com/pngimages/359/703/png-clipart-fairy-tail-freed-justine-honda-freed-anime-mangaka-mirajane-strauss-purple-photography.png",
    # Gildarts Clive - Wandering S-Class mage
    "gildarts":  "https://e7.pngegg.com/pngimages/794/574/png-clipart-gildarts-clive-fairy-tail-artist-fairy-tail-mammal-black-hair.png",
    # Levy McGarden - Solid Script scholar
    "levy":      "https://www.seekpng.com/png/detail/551-5510303_levy-mcgarden-3-render-by-stella1994x-d8aba4t-levy.png",
    # Fairy Tail Guild Logo
    "logo":      "https://www.pngitem.com/pimgs/m/156-1567409_fairy-tail-logo-fairy-tail-logo-png-transparent.png",
    # Carla/Charle - Exceed in human form (cat hybrid)
    "carla":     "https://www.kindpng.com/picc/m/595-5951944_fairy-tail-charle-human-form-hd-png-download.png",
    # Panther Lily - Beast exceed (for lizard hybrid)
    "pantherlily": "https://www.pngkey.com/png/detail/140-1407170_image-freeuse-library-drawing-lily-fairy-tail-fairy.png",
    # Shield image for arcane defender style
    "shield":    "https://pngimg.com/d/shield_PNG1305.png",
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

    # Classi (7) - sensible character match
    ("natsu",    "classi", "mago-combattente"),   # Natsu = battle mage
    ("erza",     "classi", "guerriero"),           # Erza = warrior (armor/weapons)
    ("gajeel",   "classi", "mago-di-strada"),      # Gajeel = street mage (rough, tough)
    ("wendy",    "classi", "mago-di-supporto"),    # Wendy = support mage (healer)
    ("erza",     "classi", "mago-difensore"),       # Erza = defender (armor)
    ("mystogan", "classi", "mago-furtivo"),        # Mystogan = stealth mage
    ("mavis",    "classi", "mago-tattico"),         # Mavis = tactician

    # Razze (8) - sensible race-to-character match
    ("natsu",       "razze", "dragon-slayer"),       # Natsu = Dragon Slayer
    ("gray",        "razze", "devil-slayer"),        # Gray = Devil Slayer
    ("happy",       "razze", "exceed"),              # Happy = Exceed
    ("mirajane",    "razze", "ibrido-demone-galuna"),# Mirajane = Demon hybrid (Satan Soul)
    ("carla",       "razze", "ibrido-gatto"),        # Carla human form = Cat hybrid
    ("pantherlily", "razze", "ibrido-lucertola"),    # Panther Lily beast form = Lizard-ish
    ("elfman",      "razze", "ibrido-lupo"),         # Elfman = Wolf/Beast hybrid (Beast Soul)
    ("lucy",        "razze", "umani"),               # Lucy = Human

    # Background (7) - sensible character match
    ("logo",      "background", "mago-gilda"),           # Guild logo = Guild mage
    ("gildarts",  "background", "mago-errante"),         # Gildarts = Wandering mage
    ("laxus",     "background", "mago-combattimento"),   # Laxus = Combat mage
    ("levy",      "background", "studioso"),             # Levy = Scholar
    ("gajeel",    "background", "mago-selvaggio"),       # Gajeel = Wild mage
    ("gray",      "background", "minatore-lacrima"),     # Gray = Lacrima miner (ice/crystal)
    ("freed",     "background", "camminatore-specchio"), # Freed = Mirror walker (runes)

    # Stili (10) - character or thematic images
    ("wendy",       "stili", "combattente-agile"),      # Wendy = agile fighter (small, fast)
    ("erza",        "stili", "combattente-due-armi"),    # Erza = dual wielder (Heaven's Wheel)
    ("gray",        "stili", "contrattaccante"),         # Gray = counter-attacker (ice make)
    ("shield",      "stili", "difensore-arcano"),        # Shield = arcane defender
    ("erza",        "stili", "duellante"),               # Erza = duelist (single sword forms)
    ("elfman",      "stili", "furia-marziale"),          # Elfman = martial fury (Beast Soul)
    ("cambio-stock","stili", "lama-infusa"),             # Crystal sword = infused blade
    ("erza",        "stili", "maestro-armi"),            # Erza = weapons master (requip)
    ("natsu",       "stili", "pugni-devastanti"),        # Natsu = devastating punches (fire fist)
    ("laxus",       "stili", "spirito-combattivo"),      # Laxus = fighting spirit (lightning aura)
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

def has_real_transparency(img):
    """Check if image actually uses its alpha channel meaningfully."""
    if img.mode != "RGBA":
        return False
    arr = np.array(img)
    alpha = arr[:,:,3]
    # If less than 5% of pixels are transparent, it's not really transparent
    transparent_ratio = np.sum(alpha < 250) / alpha.size
    return transparent_ratio > 0.05

def needs_bg_removal(img, url):
    """Check if the image needs white background removal."""
    # pngimg.com images are already transparent - skip
    if "pngimg.com" in url:
        return False
    # If the image has real transparency already, skip
    if has_real_transparency(img):
        return False
    # Everything else needs bg removal (pngegg, kindpng, pngkit, etc.)
    return True

def main():
    # Step 1: Download all sources
    print("=== Downloading ===")
    for name, url in SOURCES.items():
        dest = os.path.join(TEMP, f"{name}.png")
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
                data = resp.read()
            # Check if we got a real image (not HTML error page)
            if len(data) < 1000 or data[:5] == b'<!DOC' or data[:5] == b'<html':
                print(f"  [ERR] {name}: got HTML instead of image")
                continue
            with open(dest, "wb") as f:
                f.write(data)
            print(f"  [OK] {name} ({len(data)//1024}KB)")
        except Exception as e:
            print(f"  [ERR] {name}: {e}")

    # Step 2: Process and convert
    print("\n=== Processing ===")
    cache = {}
    ok = 0
    for src_key, category, filename in TARGETS:
        src_path = os.path.join(TEMP, f"{src_key}.png")
        dst_dir = os.path.join(ASSETS, category)
        dst_path = os.path.join(dst_dir, f"{filename}.webp")
        os.makedirs(dst_dir, exist_ok=True)

        if not os.path.exists(src_path):
            print(f"  [SKIP] {category}/{filename} - source {src_key}.png missing")
            continue

        if src_key not in cache:
            try:
                img = Image.open(src_path)
                url = SOURCES.get(src_key, "")
                if needs_bg_removal(img, url):
                    cache[src_key] = remove_white_bg(img)
                    print(f"    (bg removed for {src_key})")
                else:
                    cache[src_key] = img.convert("RGBA")
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
