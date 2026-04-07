/**
 * Download images from Fairy Tail wiki for all module objects.
 * Usage: node download-images.mjs
 */

import fs from "fs";
import path from "path";
import https from "https";

const BASE_DIR = path.resolve("assets/images");

/** Download a file from URL, following redirects */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", reject);
    }).on("error", (e) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(e);
    });
  });
}

// All image mappings: filename -> wiki URL
const IMAGES = {
  // === RAZZE ===
  "razze/umani.webp": "https://static.wikia.nocookie.net/fairytail/images/9/9c/Lucy_X792_image.png",
  "razze/exceed.webp": "https://static.wikia.nocookie.net/fairytail/images/4/41/Happy_proposal.png",
  "razze/ibrido-gatto.webp": "https://static.wikia.nocookie.net/fairytail/images/6/61/GMG_Millianna.png",
  "razze/ibrido-lucertola.webp": "https://static.wikia.nocookie.net/fairytail/images/a/a8/Lisanna_X792.png",
  "razze/ibrido-lupo.webp": "https://static.wikia.nocookie.net/fairytail/images/a/ad/Elfman_X792.png",
  "razze/ibrido-demone-galuna.webp": "https://static.wikia.nocookie.net/fairytail/images/c/c8/Deloria.jpg",
  "razze/dragon-slayer.webp": "https://static.wikia.nocookie.net/fairytail/images/d/d6/All_Dragon_Slayers_in_action.png",
  "razze/devil-slayer.webp": "https://static.wikia.nocookie.net/fairytail/images/4/4c/Gray_attacks_Ajeel_back.png",

  // === CLASSI ===
  "classi/mago-combattente.webp": "https://static.wikia.nocookie.net/fairytail/images/c/ca/Natsu_X792.png",
  "classi/mago-difensore.webp": "https://static.wikia.nocookie.net/fairytail/images/9/9e/Freed_Mugshot.png",
  "classi/mago-furtivo.webp": "https://static.wikia.nocookie.net/fairytail/images/6/62/Mystogan_X793_Profile.png",
  "classi/mago-di-strada.webp": "https://static.wikia.nocookie.net/fairytail/images/d/d6/Gildarts_in_X792.png",
  "classi/mago-di-supporto.webp": "https://static.wikia.nocookie.net/fairytail/images/0/02/Wendy_Marvell_X792.png",
  "classi/mago-tattico.webp": "https://static.wikia.nocookie.net/fairytail/images/e/e6/Mavis%27_image.png",
  "classi/guerriero.webp": "https://static.wikia.nocookie.net/fairytail/images/c/c3/Erza%27s_picture.png",

  // === MAGIE ===
  "magie/spazio-aereo.webp": "https://static.wikia.nocookie.net/fairytail/images/4/46/Void.png",
  "magie/carte.webp": "https://static.wikia.nocookie.net/fairytail/images/b/b5/Card_Magic.jpg",
  "magie/terra.webp": "https://static.wikia.nocookie.net/fairytail/images/5/51/Iron_Rock_Wall_v2.png",
  "magie/fuoco.webp": "https://static.wikia.nocookie.net/fairytail/images/7/74/Hell_Prominence.JPG",
  "magie/ingranaggi.webp": "https://static.wikia.nocookie.net/fairytail/images/f/f5/Wally_Prof.png",
  "magie/armi-da-fuoco.webp": "https://static.wikia.nocookie.net/fairytail/images/a/a9/Wide_Shot.jpg",
  "magie/corpo-celeste.webp": "https://static.wikia.nocookie.net/fairytail/images/e/e5/Celestial_Spirit_Contract.jpg",
  "magie/fulmine.webp": "https://static.wikia.nocookie.net/fairytail/images/6/6d/Lightning_Magic.gif",
  "magie/creazione.webp": "https://static.wikia.nocookie.net/fairytail/images/8/83/Ice-Make.png",
  "magie/cambio-stock.webp": "https://static.wikia.nocookie.net/fairytail/images/a/a3/Requipp.gif",
  "magie/sabbia.webp": "https://static.wikia.nocookie.net/fairytail/images/1/1e/Sable.JPG",
  "magie/solid-script.webp": "https://static.wikia.nocookie.net/fairytail/images/8/87/Solidscript_Silent.jpg",
  "magie/take-over.webp": "https://static.wikia.nocookie.net/fairytail/images/f/fd/Full_Body.jpg",
  "magie/acqua.webp": "https://static.wikia.nocookie.net/fairytail/images/c/c9/Aquarius_Water_Attack.gif",

  // === BACKGROUND ===
  "background/mago-gilda.webp": "https://static.wikia.nocookie.net/fairytail/images/2/26/Fairy_Tail_Banner.png",
  "background/mago-errante.webp": "https://static.wikia.nocookie.net/fairytail/images/d/d6/Gildarts_in_X792.png",
  "background/studioso.webp": "https://static.wikia.nocookie.net/fairytail/images/3/34/Levy_X792.png",
  "background/mago-combattimento.webp": "https://static.wikia.nocookie.net/fairytail/images/d/db/Laxus_profile_image.png",
  "background/mago-selvaggio.webp": "https://static.wikia.nocookie.net/fairytail/images/3/30/Gajeel_Redfox.png",
  "background/minatore-lacrima.webp": "https://static.wikia.nocookie.net/fairytail/images/e/eb/Communications_Lacrima_Crystal.jpg",
  "background/camminatore-specchio.webp": "https://static.wikia.nocookie.net/fairytail/images/9/9d/Anima.jpg",

  // === STILI DI COMBATTIMENTO ===
  "stili/pugni-devastanti.webp": "https://static.wikia.nocookie.net/fairytail/images/c/ca/Natsu_X792.png",
  "stili/lama-infusa.webp": "https://static.wikia.nocookie.net/fairytail/images/c/c3/Erza%27s_picture.png",
  "stili/difensore-arcano.webp": "https://static.wikia.nocookie.net/fairytail/images/9/9e/Freed_Mugshot.png",
  "stili/combattente-agile.webp": "https://static.wikia.nocookie.net/fairytail/images/3/31/Jet_in_the_year_X971.PNG",
  "stili/contrattaccante.webp": "https://static.wikia.nocookie.net/fairytail/images/7/7d/Kagura%27s_profile_image.png",
  "stili/furia-marziale.webp": "https://static.wikia.nocookie.net/fairytail/images/a/ad/Elfman_X792.png",
  "stili/duellante.webp": "https://static.wikia.nocookie.net/fairytail/images/f/f9/Phanter_Lily_X793.jpg",
  "stili/maestro-armi.webp": "https://static.wikia.nocookie.net/fairytail/images/c/c3/Erza%27s_picture.png",
  "stili/combattente-due-armi.webp": "https://static.wikia.nocookie.net/fairytail/images/6/6a/Ikaruga.jpg",
  "stili/spirito-combattivo.webp": "https://static.wikia.nocookie.net/fairytail/images/7/7a/Makarov_X792_Anime.png",
};

async function main() {
  console.log("Downloading Fairy Tail wiki images...\n");

  let ok = 0, fail = 0;
  for (const [filename, url] of Object.entries(IMAGES)) {
    const dest = path.join(BASE_DIR, filename);
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(dest)) {
      console.log(`  ⏭ ${filename} (already exists)`);
      ok++;
      continue;
    }

    try {
      await download(url, dest);
      const size = fs.statSync(dest).size;
      console.log(`  ✓ ${filename} (${(size / 1024).toFixed(1)} KB)`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${filename}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} downloaded, ${fail} failed out of ${Object.keys(IMAGES).length} total.`);
}

main().catch(console.error);
