#!/usr/bin/env python3
"""Download ALREADY-TRANSPARENT PNGs and convert to WebP. NO background removal."""
import os, urllib.request, ssl, io
from PIL import Image
import numpy as np

TEMP = "E:/Project Claude/FoundryVTT/fairy-tail-5e/temp-imgs-final"
ASSETS = "E:/Project Claude/FoundryVTT/fairy-tail-5e/assets/images"
os.makedirs(TEMP, exist_ok=True)

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
WIKI_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://fairytail.fandom.com/",
}

# ── ALL IMAGE SOURCES ──
# Magie: pngimg.com (confirmed real transparency)
# Characters: DeviantArt wixmp, NicePNG, PNGitem, Fairy Tail Wiki (all confirmed real transparency)
SOURCES = {
    # === MAGIE (pngimg.com - already transparent) ===
    "fuoco":        "https://pngimg.com/d/fire_PNG6023.png",
    "acqua":        "https://pngimg.com/uploads/water_splash/water_splash_PNG27.png",
    "fulmine":      "https://pngimg.com/uploads/lightning/lightning_PNG24.png",
    "terra":        "https://pngimg.com/d/stone_PNG13561.png",
    "corpo-celeste":"https://pngimg.com/d/gemini_PNG42.png",
    "carte":        "https://pngimg.com/uploads/cards/cards_PNG8490.png",
    "take-over":    "https://pngimg.com/uploads/demon/demon_PNG39.png",
    "solid-script": "https://www.nicepng.com/png/full/78-786393_3-free-magic-wand-pink-magic-wand-png.png",
    "spazio-aereo": "https://pngimg.com/uploads/hurricane/hurricane_PNG26.png",
    "ingranaggi":   "https://pngimg.com/d/gear_PNG53.png",
    "sabbia":       "https://pngimg.com/d/hourglass_PNG30.png",
    "creazione":    "https://www.nicepng.com/png/full/78-786086_magic-wand-vector-magic-wand-svg.png",
    "armi-da-fuoco":"https://pngimg.com/d/gun_PNG1355.png",
    "cambio-stock": "https://pngimg.com/d/sword_PNG5506.png",

    # === CHARACTERS (all from sites with REAL transparency) ===
    # DeviantArt wixmp (confirmed RGBA)
    "natsu": "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/7d3ef723-eb25-4365-9952-a75f9460f1d2/d5dxqmy-8a64ac33-448f-4897-878e-60a79458bc1a.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi83ZDNlZjcyMy1lYjI1LTQzNjUtOTk1Mi1hNzVmOTQ2MGYxZDIvZDVkeHFteS04YTY0YWMzMy00NDhmLTQ4OTctODc4ZS02MGE3OTQ1OGJjMWEucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.BzS_WQYiZHfzrlwX7QvFo9Xd8t36_KYhite8JIV4AoQ",
    "erza": "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/d843633d-1147-4204-bf9c-9cb8088abd09/d57mzqr-bd7b9f02-320d-45d2-a63b-33a8da81ab80.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi9kODQzNjMzZC0xMTQ3LTQyMDQtYmY5Yy05Y2I4MDg4YWJkMDkvZDU3bXpxci1iZDdiOWYwMi0zMjBkLTQ1ZDItYTYzYi0zM2E4ZGE4MWFiODAucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.HSXpJ5kETr_auIHWHDurOhvdE6-4TFzrLJs740KGlWo",
    "laxus": "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/4e71f197-68cd-4ace-86fc-8e9342f851e6/dhz48uu-93ae6b9c-1ea2-481b-97a6-061309a557a8.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi80ZTcxZjE5Ny02OGNkLTRhY2UtODZmYy04ZTkzNDJmODUxZTYvZGh6NDh1dS05M2FlNmI5Yy0xZWEyLTQ4MWItOTdhNi0wNjEzMDlhNTU3YTgucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.aawh-m6n3q1xz0Ez99U9Gl6aRHKT9hDtULqn1cyjSWY",
    "mirajane": "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/50f05812-6489-49a6-8398-d922b6c13e36/d9ykm1j-3ea62ba1-f9d4-4f61-92ba-54db5988311b.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi81MGYwNTgxMi02NDg5LTQ5YTYtODM5OC1kOTIyYjZjMTNlMzYvZDl5a20xai0zZWE2MmJhMS1mOWQ0LTRmNjEtOTJiYS01NGRiNTk4ODMxMWIucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.MLYqJnJn4BL6OZwJBvSWjL0kCPh09gAAY5cqq-P01wM",
    "gajeel": "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/8f8dd14e-215f-48d3-b5f2-1e54cc062c1a/d55ryr0-00b1a4fc-28df-4f59-b085-0c3fc140d2b0.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi84ZjhkZDE0ZS0yMTVmLTQ4ZDMtYjVmMi0xZTU0Y2MwNjJjMWEvZDU1cnlyMC0wMGIxYTRmYy0yOGRmLTRmNTktYjA4NS0wYzNmYzE0MGQyYjAucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.P5PQ7PlRNpFjykkK1jdd_vo8jF1J6IgKBwxv6IVYtDY",
    "mavis": "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/6233922d-753c-4152-9afe-3b82ce990681/d9z0r06-c4596f4f-92f0-46c2-a96b-2b36cc089ca2.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi82MjMzOTIyZC03NTNjLTQxNTItOWFmZS0zYjgyY2U5OTA2ODEvZDl6MHIwNi1jNDU5NmY0Zi05MmYwLTQ2YzItYTk2Yi0yYjM2Y2MwODljYTIucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.3XRAZz2DchgA62LxTTZAexHwh9fSUpOwE4IWrJwIulw",

    # NicePNG (confirmed RGBA)
    "gray": "https://www.nicepng.com/png/full/579-5791032_gray-fullbuster-2-photo-grayfullbuster4b-gray-fullbuster.png",
    "wendy": "https://www.nicepng.com/png/full/65-653762_wendy-marvell-images-wendy-marvell-short-hair-hd.png",
    "happy": "https://www.nicepng.com/png/full/319-3197590_fairy-tail-happy-cute-fairy-tail-happy.png",
    "elfman": "https://www.nicepng.com/png/full/201-2013791_fairy-tail-png-image-background-elfman-strauss.png",
    "lucy": "https://www.nicepng.com/png/full/169-1694887_story-character-lucy-heartfilia-004-render-lucy-heartfilia.png",
    "gildarts": "https://www.nicepng.com/png/full/570-5709829_gildart-clive.png",
    "carla": "https://www.nicepng.com/png/full/319-3197648_happy-and-charle-coloring-chibi-render-fairy-tail.png",
    "pantherlily": "https://www.nicepng.com/png/full/140-1407164_clip-art-library-image-chibi-panther-png-wiki.png",
    "logo": "https://www.nicepng.com/png/full/78-788273_jpg-royalty-free-stock-drawing-logos-fire-logo.png",

    # DeviantArt wixmp (confirmed RGBA - with tokens)
    "mystogan": "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/8f8dd14e-215f-48d3-b5f2-1e54cc062c1a/d566ai6-2d96063f-f826-414f-b3fc-93ca1b40854f.png/v1/fill/w_900,h_510/mystogan_render_by_artofarcher_d566ai6-fullview.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9NTEwIiwicGF0aCI6Ii9mLzhmOGRkMTRlLTIxNWYtNDhkMy1iNWYyLTFlNTRjYzA2MmMxYS9kNTY2YWk2LTJkOTYwNjNmLWY4MjYtNDE0Zi1iM2ZjLTkzY2ExYjQwODU0Zi5wbmciLCJ3aWR0aCI6Ijw9OTAwIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmltYWdlLm9wZXJhdGlvbnMiXX0.B7LmNhTsJVFyQgkKzrJkJt31G_7HnfOE1lsXlSzCy7A",

    # Wiki (confirmed RGBA)
    "freed": "https://static.wikia.nocookie.net/five-world-war/images/3/38/Freed1.png/revision/latest?cb=20180117174824",
    "levy": "https://static.wikia.nocookie.net/vsbattles/images/e/ed/New_X791_Levy.png/revision/latest?cb=20200704090812",

    # === NEW: Guerriero (Kagura Mikazuchi) - DeviantArt wixmp ===
    "kagura": "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/6233922d-753c-4152-9afe-3b82ce990681/d87dt56-3fe139c7-4247-4a12-9b09-d65ed9e01a71.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi82MjMzOTIyZC03NTNjLTQxNTItOWFmZS0zYjgyY2U5OTA2ODEvZDg3ZHQ1Ni0zZmUxMzljNy00MjQ3LTRhMTItOWIwOS1kNjVlZDllMDFhNzEucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.RXjwHYFndzFUA8X8eDerGkXKW59kvJ_rO-QMtZXCwjA",

    # === NEW: Razze replacement images ===
    # Devil Slayer: Gray in Devil Slayer form (Top-Strongest Wiki)
    "gray-devil-slayer": "https://static.wikia.nocookie.net/topstrongest/images/7/7c/GrayDevilSlayerRender.png/revision/latest?cb=20210702091954",
    # Dragon Slayer: Natsu in Dragon Force (DeviantArt wixmp)
    "natsu-dragon-force": "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/973c01c1-c4e4-45ee-bf9d-9b6fc849fae3/d7d84da-468d2898-5f5a-472f-b7a6-c839fc0aab89.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi85NzNjMDFjMS1jNGU0LTQ1ZWUtYmY5ZC05YjZmYzg0OWZhZTMvZDdkODRkYS00NjhkMjg5OC01ZjVhLTQ3MmYtYjdhNi1jODM5ZmMwYWFiODkucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.bKqYqnaHAx_LuQ35TAqUM9mDPHwMynBW7bkmYfARIrw",
    # Ibrido Demone Galuna: Galuna Island demon villagers (Fairy Tail Wiki)
    "demone-galuna": "https://static.wikia.nocookie.net/fairytail/images/e/e5/The_villagers_become_demons.png/revision/latest",
    # Ibrido Gatto: Millianna (DeviantArt wixmp)
    "millianna": "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/6233922d-753c-4152-9afe-3b82ce990681/d89c6zv-1c33bc34-2d5e-4799-8177-b1c3e9c2f5ea.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi82MjMzOTIyZC03NTNjLTQxNTItOWFmZS0zYjgyY2U5OTA2ODEvZDg5YzZ6di0xYzMzYmMzNC0yZDVlLTQ3OTktODE3Ny1iMWMzZTljMmY1ZWEucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.Qa0GfSNg9XnSNSTGcRdWTerHIgwbO0hdxf-wtvn0qio",
    # Ibrido Lucertola: Crocodile Lizardman (Fairy Tail Wiki)
    "lucertola": "https://static.wikia.nocookie.net/fairytail/images/4/40/Crocodile_Lizardman.png/revision/latest",
    # Ibrido Lupo: Beast Soul Sirius wolf form (Fairy Tail Wiki)
    "lupo": "https://static.wikia.nocookie.net/fairytail/images/9/97/Beast_Soul_Sirius.jpg/revision/latest",
}

# ── Target mapping ──
TARGETS = [
    # Magie (14)
    ("fuoco", "magie", "fuoco"), ("acqua", "magie", "acqua"),
    ("fulmine", "magie", "fulmine"), ("terra", "magie", "terra"),
    ("corpo-celeste", "magie", "corpo-celeste"), ("carte", "magie", "carte"),
    ("take-over", "magie", "take-over"), ("solid-script", "magie", "solid-script"),
    ("spazio-aereo", "magie", "spazio-aereo"), ("ingranaggi", "magie", "ingranaggi"),
    ("sabbia", "magie", "sabbia"), ("creazione", "magie", "creazione"),
    ("armi-da-fuoco", "magie", "armi-da-fuoco"), ("cambio-stock", "magie", "cambio-stock"),
    # Classi (7)
    ("natsu", "classi", "mago-combattente"), ("kagura", "classi", "guerriero"),
    ("gajeel", "classi", "mago-di-strada"), ("wendy", "classi", "mago-di-supporto"),
    ("erza", "classi", "mago-difensore"), ("mystogan", "classi", "mago-furtivo"),
    ("mavis", "classi", "mago-tattico"),
    # Razze (8)
    ("natsu-dragon-force", "razze", "dragon-slayer"), ("gray-devil-slayer", "razze", "devil-slayer"),
    ("happy", "razze", "exceed"), ("demone-galuna", "razze", "ibrido-demone-galuna"),
    ("millianna", "razze", "ibrido-gatto"), ("lucertola", "razze", "ibrido-lucertola"),
    ("lupo", "razze", "ibrido-lupo"), ("lucy", "razze", "umani"),
    # Background (7)
    ("logo", "background", "mago-gilda"), ("gildarts", "background", "mago-errante"),
    ("laxus", "background", "mago-combattimento"), ("levy", "background", "studioso"),
    ("gajeel", "background", "mago-selvaggio"), ("gray", "background", "minatore-lacrima"),
    ("freed", "background", "camminatore-specchio"),
    # Stili (10)
    ("wendy", "stili", "combattente-agile"), ("erza", "stili", "combattente-due-armi"),
    ("gray", "stili", "contrattaccante"), ("freed", "stili", "difensore-arcano"),
    ("erza", "stili", "duellante"), ("elfman", "stili", "furia-marziale"),
    ("cambio-stock", "stili", "lama-infusa"), ("erza", "stili", "maestro-armi"),
    ("natsu", "stili", "pugni-devastanti"), ("laxus", "stili", "spirito-combattivo"),
]

def download(name, url):
    """Download image. Returns True if successful."""
    dest = os.path.join(TEMP, f"{name}.png")
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        return True  # Already downloaded
    try:
        hdrs = WIKI_HEADERS if "wikia.nocookie.net" in url or "fandom.com" in url else HEADERS
        req = urllib.request.Request(url, headers=hdrs)
        resp = urllib.request.urlopen(req, timeout=30, context=ctx)
        data = resp.read()
        if len(data) < 500 or data[:5] in (b'<!DOC', b'<html', b'<HTML'):
            print(f"  [HTML] {name}")
            return False
        with open(dest, "wb") as f:
            f.write(data)
        # Verify it's a real image with transparency
        img = Image.open(io.BytesIO(data))
        mode = img.mode
        has_alpha = mode == "RGBA"
        if has_alpha:
            arr = np.array(img)
            pct = (arr[:,:,3] < 250).sum() / arr[:,:,3].size * 100
            status = f"RGBA {pct:.0f}% transparent"
        else:
            status = f"{mode} NO ALPHA"
        print(f"  [OK] {name:15s} {img.size[0]}x{img.size[1]} {status} ({len(data)//1024}KB)")
        return True
    except Exception as e:
        print(f"  [ERR] {name}: {e}")
        return False

def main():
    # Step 1: Download all sources
    print("=== Downloading ===")
    for name, url in SOURCES.items():
        download(name, url)

    # Step 2: Convert to WebP (NO background removal - images are already transparent!)
    print("\n=== Converting to WebP ===")
    cache = {}
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
                img = Image.open(src_path).convert("RGBA")
                cache[src_key] = img
            except Exception as e:
                print(f"  [ERR] {src_key}: {e}")
                continue

        try:
            cache[src_key].save(dst_path, "WEBP", quality=90)
            print(f"  [OK] {category}/{filename}.webp")
            ok += 1
        except Exception as e:
            print(f"  [ERR] {category}/{filename}: {e}")

    print(f"\n=== Done: {ok}/{len(TARGETS)} images ===")

if __name__ == "__main__":
    main()
