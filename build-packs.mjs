/**
 * Build script for Fairy Tail 5e FoundryVTT module.
 * Reads JSON item data from src/ and creates LevelDB compendium packs in packs/.
 *
 * Usage: node build-packs.mjs
 */

import { ClassicLevel } from "classic-level";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const MODULE_ID = "fairy-tail-5e";
const SRC_DIR = path.resolve("src");
const PACKS_DIR = path.resolve("packs");

/** Generate a random Foundry-style ID (16 hex chars) */
function generateId() {
  return randomBytes(8).toString("hex");
}

/**
 * Map of compendium pack names to their source JSON files and dnd5e item types.
 * type: the dnd5e Item type (race, class, subclass, background, feat, equipment, spell, feat)
 */
const PACKS = [
  { pack: "ft5e-razze",              src: "razze.json",              type: "race" },
  { pack: "ft5e-classi",             src: "classi.json",             type: "class" },
  { pack: "ft5e-magie",              src: "magie.json",              type: "subclass" },
  { pack: "ft5e-background",         src: "background.json",         type: "background" },
  { pack: "ft5e-talenti",            src: "talenti.json",            type: "feat" },
  { pack: "ft5e-equipaggiamento",    src: "equipaggiamento.json",    type: "equipment" },
  { pack: "ft5e-incantesimi",        src: "incantesimi.json",        type: "spell" },
  { pack: "ft5e-stili-combattimento", src: "stili-combattimento.json", type: "feat" },
  { pack: "ft5e-feature-razze",       src: "feature-razze.json",       type: "feat" },
  { pack: "ft5e-feature-classi",      src: "feature-classi.json",      type: "feat" },
  { pack: "ft5e-feature-magie",       src: "feature-magie.json",       type: "feat" },
];

async function buildPack({ pack, src, type }) {
  const srcPath = path.join(SRC_DIR, src);
  if (!fs.existsSync(srcPath)) {
    console.warn(`  ⚠ Source file not found: ${src} — skipping ${pack}`);
    return;
  }

  const items = JSON.parse(fs.readFileSync(srcPath, "utf-8"));
  const packDir = path.join(PACKS_DIR, pack);

  // Remove existing pack directory
  if (fs.existsSync(packDir)) {
    fs.rmSync(packDir, { recursive: true, force: true });
  }

  const db = new ClassicLevel(packDir, { keyEncoding: "utf8", valueEncoding: "json" });

  console.log(`  Building ${pack} (${items.length} items)...`);

  for (const item of items) {
    const id = item._id || generateId();
    const doc = {
      _id: id,
      name: item.name,
      type: type,
      img: item.img || "icons/svg/item-bag.svg",
      system: item.system || {},
      effects: item.effects || [],
      flags: {
        [MODULE_ID]: {
          source: "fairy-tail-5e"
        }
      },
      _stats: {
        compendiumSource: null,
        duplicateSource: null,
        coreVersion: "13.351",
        systemId: "dnd5e",
        systemVersion: "5.3.0",
        createdTime: Date.now(),
        modifiedTime: Date.now(),
        lastModifiedBy: "fairy-tail-5e-builder"
      }
    };

    // Add description if present
    if (item.description) {
      if (type === "spell") {
        doc.system.description = { value: item.description };
      } else if (type === "race") {
        doc.system.description = { value: item.description };
      } else if (type === "class") {
        doc.system.description = { value: item.description };
      } else if (type === "subclass") {
        doc.system.description = { value: item.description };
      } else if (type === "background") {
        doc.system.description = { value: item.description };
      } else if (type === "feat") {
        doc.system.description = { value: item.description };
      } else if (type === "equipment") {
        doc.system.description = { value: item.description };
      } else {
        doc.system.description = { value: item.description };
      }
    }

    await db.put(`!items!${id}`, doc);
  }

  await db.close();
  console.log(`  ✓ ${pack} done.`);
}

async function main() {
  console.log("Building Fairy Tail 5e compendium packs...\n");

  // Ensure packs directory exists
  if (!fs.existsSync(PACKS_DIR)) {
    fs.mkdirSync(PACKS_DIR, { recursive: true });
  }

  for (const packDef of PACKS) {
    await buildPack(packDef);
  }

  console.log("\nAll packs built successfully!");
}

main().catch(console.error);
