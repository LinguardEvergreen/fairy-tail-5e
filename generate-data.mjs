/**
 * Parses the Homebrewery source file and generates JSON data files
 * for each compendium pack.
 *
 * Usage: node generate-data.mjs <path-to-source-file>
 */

import fs from "fs";
import path from "path";

const SOURCE_FILE = process.argv[2] || "D:/D&D/Fairy Tail/Homebrewery/Manuale Homebrewery Fairy Tail_it - VS FINAL.txt";
const SRC_DIR = path.resolve("src");

if (!fs.existsSync(SRC_DIR)) fs.mkdirSync(SRC_DIR, { recursive: true });

const raw = fs.readFileSync(SOURCE_FILE, "utf-8");
const lines = raw.split("\n");

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip Homebrewery markup, HTML tags, etc. from a heading to get plain name */
function cleanName(text) {
  let n = text;
  n = n.replace(/^#+\s*/, "");
  n = n.replace(/<span[^>]*>/gi, "").replace(/<\/span>/gi, "");
  // Remove nested {{Color:X ...}} / {{font-family:X ...}}
  for (let i = 0; i < 6; i++) {
    n = n.replace(/\{\{(?:Color|font-family|color):\s*[A-Za-z0-9_\-]+\s+/gi, "");
  }
  n = n.replace(/\}\}/g, "");
  n = n.replace(/<[^>]*>/g, "");
  // Remove image markdown: ![...](...)  and  {position:...}
  n = n.replace(/!\[.*?\]\(.*?\)/g, "");
  n = n.replace(/\{[^}]*\}/g, "");
  return n.replace(/\s+/g, " ").trim();
}

/** Convert a block of Homebrewery markdown to simple HTML description */
function mdToHtml(mdLines) {
  let html = [];
  for (const line of mdLines) {
    let l = line.trim();
    // Skip image lines, style blocks, page breaks, column breaks
    if (l.startsWith("![") || l.startsWith("<img") || l.startsWith("\\page") ||
        l.startsWith("\\column") || l.startsWith("{{") || l.startsWith("}}") ||
        l.startsWith(":::") || l.startsWith("<div") || l.startsWith("</div") ||
        l.startsWith("<style") || l.startsWith("@import") || l === "") continue;

    // Clean Homebrewery-specific markup
    l = l.replace(/<span[^>]*>/gi, "").replace(/<\/span>/gi, "");
    for (let i = 0; i < 6; i++) {
      l = l.replace(/\{\{(?:Color|font-family|color):\s*[A-Za-z0-9_\-]+\s+/gi, "");
    }
    l = l.replace(/\}\}/g, "").replace(/\{\{[^}]*\}\}/g, "");

    // Convert markdown to simple HTML
    if (l.startsWith("##### ")) html.push(`<h5>${l.slice(6)}</h5>`);
    else if (l.startsWith("#### ")) html.push(`<h4>${l.slice(5)}</h4>`);
    else if (l.startsWith("### ")) html.push(`<h3>${l.slice(4)}</h3>`);
    else if (l.startsWith("## ")) html.push(`<h2>${l.slice(3)}</h2>`);
    else if (l.startsWith("# ")) html.push(`<h1>${l.slice(2)}</h1>`);
    else if (l.startsWith("* ")) html.push(`<li>${l.slice(2)}</li>`);
    else if (l.startsWith("- ")) html.push(`<li>${l.slice(2)}</li>`);
    else if (l.startsWith("___") || l.startsWith("---")) html.push("<hr>");
    else if (l === ":") html.push("<br>");
    else if (l.startsWith("|")) {
      // Table row - just pass through
      html.push(`<p>${l}</p>`);
    }
    else html.push(`<p>${l}</p>`);
  }
  return html.join("\n");
}

/** Find the line number of a specific page (1-indexed) */
function findPageStart(pageNum) {
  let currentPage = 1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "\\page") {
      currentPage++;
      if (currentPage === pageNum) return i + 1;
    }
  }
  return -1;
}

/** Get lines between two page numbers (inclusive) */
function getPageRange(startPage, endPage) {
  const start = startPage === 1 ? 0 : findPageStart(startPage);
  const end = endPage >= 230 ? lines.length : findPageStart(endPage + 1);
  if (start === -1) return [];
  return lines.slice(start, end === -1 ? lines.length : end);
}

/** Extract items by heading level from a range of lines */
function extractByHeading(pageLines, headingPrefix, filter = null) {
  const items = [];
  let current = null;
  let contentLines = [];

  for (const line of pageLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(headingPrefix + " ") &&
        !trimmed.startsWith(headingPrefix + "# ")) {
      // Save previous item
      if (current) {
        items.push({ name: current, description: mdToHtml(contentLines) });
      }
      const name = cleanName(trimmed);
      if (filter && !filter(name, trimmed)) {
        current = null;
        contentLines = [];
        continue;
      }
      current = name;
      contentLines = [line];
    } else if (current) {
      contentLines.push(line);
    }
  }
  // Save last item
  if (current) {
    items.push({ name: current, description: mdToHtml(contentLines) });
  }
  return items;
}

function writeJson(filename, data) {
  const outPath = path.join(SRC_DIR, filename);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`  ✓ ${filename}: ${data.length} items`);
}

// ── RAZZE (pages 10-18) ─────────────────────────────────────────────────────
function extractRazze() {
  const raceNames = [
    "Umani", "Exceed", "Ibrido Gatto", "Ibrido Lucertola",
    "Ibrido Lupo", "Ibrido Demone di Galuna", "Dragon Slayer", "Devil Slayer"
  ];
  const pageLines = getPageRange(10, 18);
  const items = [];

  /** Enhanced name matching that also checks font-family values */
  function matchRace(line) {
    // Check font-family FIRST (more precise for Dragon Slayer / Devil Slayer)
    const fontMatch = line.match(/font-family:\s*([^}]+)\}\}/);
    if (fontMatch) {
      const fontName = fontMatch[1].trim();
      const match = raceNames.find(r => fontName === r || fontName.includes(r));
      if (match) return match;
    }
    const name = cleanName(line);
    // Direct match - prefer exact matches
    let match = raceNames.find(r => name === r);
    if (match) return match;
    match = raceNames.find(r => name.includes(r) || r.includes(name));
    if (match) return match;
    return null;
  }

  for (let idx = 0; idx < pageLines.length; idx++) {
    const trimmed = pageLines[idx].trim();
    if (trimmed.startsWith("## ")) {
      const matchedName = matchRace(trimmed);
      if (matchedName) {
        let endIdx = pageLines.length;
        for (let j = idx + 1; j < pageLines.length; j++) {
          const t = pageLines[j].trim();
          if (t.startsWith("## ") && !t.startsWith("### ")) {
            if (matchRace(t)) { endIdx = j; break; }
          }
        }
        const content = pageLines.slice(idx, endIdx);
        items.push({ name: matchedName, description: mdToHtml(content) });
      }
    }
  }

  // Deduplicate
  const seen = new Set();
  const unique = items.filter(i => {
    if (seen.has(i.name)) return false;
    seen.add(i.name);
    return true;
  });

  writeJson("razze.json", unique);
}

// ── CLASSI (pages 19-52) ────────────────────────────────────────────────────
function extractClassi() {
  const classNames = [
    "Mago Combattente", "Mago Difensore", "Mago Furtivo",
    "Mago di Strada", "Mago di Supporto", "Mago Tattico", "Guerriero"
  ];
  // Find class headings by line number from the grep results
  const classLines = [693, 884, 1048, 1230, 1407, 1553, 1848];
  const items = [];

  for (let i = 0; i < classNames.length; i++) {
    const startLine = classLines[i] - 1; // 0-indexed
    const endLine = i < classNames.length - 1 ? classLines[i + 1] - 1 : findPageStart(53);
    const content = lines.slice(startLine, endLine === -1 ? startLine + 500 : endLine);
    items.push({ name: classNames[i], description: mdToHtml(content) });
  }

  writeJson("classi.json", items);
}

// ── MAGIE / subclasses (pages 53-114) ───────────────────────────────────────
function extractMagie() {
  // Map from source heading keywords to official Italian names from the TOC
  const magieMap = [
    { keywords: ["Spazio Aereo"], name: "Magia dello Spazio Aereo" },
    { keywords: ["Card Magic", "Carte"], name: "Magia delle Carte" },
    { keywords: ["Magia della Terra"], name: "Magia della Terra" },
    { keywords: ["Magia del fuoco", "Magia del Fuoco"], name: "Magia del Fuoco" },
    { keywords: ["Gear Magic", "Ingranaggi"], name: "Magia degli Ingranaggi" },
    { keywords: ["pistola", "Armi da Fuoco"], name: "Magia delle Armi da Fuoco" },
    { keywords: ["Corpo celeste", "Corpo Celeste"], name: "Magia del Corpo Celeste" },
    { keywords: ["Fulmine"], name: "Magia del Fulmine" },
    { keywords: ["Maker Magic", "Creazione"], name: "Magia della Creazione" },
    { keywords: ["Re-Equip", "Cambio Stock"], name: "Magia del Cambio Stock" },
    { keywords: ["Sabbia"], name: "Magia della Sabbia" },
    { keywords: ["Solid Script"], name: "Magia del Solid Script" },
    { keywords: ["Take Over"], name: "Magia di Take Over" },
    { keywords: ["acqua", "Acqua"], name: "Magia dell'Acqua" },
  ];

  // Known H1 heading line numbers for each magia from the grep output
  const magieLineNumbers = [2049, 2183, 2359, 2643, 2766, 2893, 2979, 3107, 3236, 3415, 3519, null, 3783, 3910];
  // Solid Script doesn't have a clear H1 heading in the magie chapter, check around page 102

  const pageLines = getPageRange(53, 114);
  const items = [];

  function matchMagia(lineText) {
    for (const m of magieMap) {
      for (const kw of m.keywords) {
        if (lineText.includes(kw)) return m.name;
      }
    }
    return null;
  }

  let currentMagia = null;
  let contentLines = [];

  for (const line of pageLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      const matched = matchMagia(trimmed);

      // Skip chapter headers and section headers
      if (trimmed.includes("Capitolo") || trimmed.includes("Magie}}")) continue;

      if (matched) {
        if (currentMagia) {
          items.push({ name: currentMagia, description: mdToHtml(contentLines) });
        }
        currentMagia = matched;
        contentLines = [line];
        continue;
      }
    }
    if (currentMagia) contentLines.push(line);
  }
  if (currentMagia) {
    items.push({ name: currentMagia, description: mdToHtml(contentLines) });
  }

  // Check if Solid Script is missing - it might be between Sabbia and Take Over
  if (!items.find(i => i.name === "Magia del Solid Script")) {
    // Look for it specifically around page 102
    const ssPages = getPageRange(102, 106);
    items.splice(11, 0, { name: "Magia del Solid Script", description: mdToHtml(ssPages) });
  }

  writeJson("magie.json", items);
}

// ── BACKGROUND (pages 115-120) ──────────────────────────────────────────────
function extractBackground() {
  const bgNames = [
    "Background del mago della gilda",
    "Background del mago errante",
    "Background dello studioso",
    "Background del mago da combattimento",
    "Background del Mago Selvaggio",
    "Background del Minatore di Lacrima",
    "Background del Camminatore dello Specchio"
  ];

  const pageLines = getPageRange(115, 120);
  const items = [];
  let currentBg = null;
  let contentLines = [];

  for (const line of pageLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("### ") && trimmed.toLowerCase().includes("ackground")) {
      if (currentBg) {
        items.push({ name: currentBg, description: mdToHtml(contentLines) });
      }
      currentBg = cleanName(trimmed);
      contentLines = [line];
      continue;
    }
    if (currentBg) contentLines.push(line);
  }
  if (currentBg) {
    items.push({ name: currentBg, description: mdToHtml(contentLines) });
  }

  writeJson("background.json", items);
}

// ── TALENTI (pages 121-167) ─────────────────────────────────────────────────
function extractTalenti() {
  const pageLines = getPageRange(121, 167);
  const items = [];
  const seen = new Set();

  // Talenti use ### headings within their sections
  // But we also need #### headings for individual talents
  let currentTalent = null;
  let contentLines = [];

  for (const line of pageLines) {
    const trimmed = line.trim();

    // Individual talents are usually ### or #### headings that aren't section headers
    if ((trimmed.startsWith("### ") || trimmed.startsWith("#### ")) &&
        !trimmed.startsWith("##### ")) {
      const name = cleanName(trimmed);

      // Skip section titles, chapter headers, etc.
      if (!name || name.length < 3 || name.length > 80 ||
          name.includes("Capitolo") || name.includes("Potenziare") ||
          name.includes("Talenti magici") || name.includes("Talenti di magia") ||
          name.includes("Talenti della magia") || name.includes("Caratteristiche fisiche") ||
          name.includes("Talenti ibridi") || name.includes("diversi") ||
          name.includes("raccolta") || name.includes("ScalySans") ||
          name.includes("NodestoCaps") || name.includes("BookInsanity") ||
          name.includes("Padroneggia")) continue;

      if (currentTalent) {
        if (!seen.has(currentTalent)) {
          items.push({ name: currentTalent, description: mdToHtml(contentLines) });
          seen.add(currentTalent);
        }
      }
      currentTalent = name;
      contentLines = [line];
      continue;
    }
    if (currentTalent) contentLines.push(line);
  }
  if (currentTalent && !seen.has(currentTalent)) {
    items.push({ name: currentTalent, description: mdToHtml(contentLines) });
  }

  writeJson("talenti.json", items);
}

// ── EQUIPAGGIAMENTO (pages 168-174) ─────────────────────────────────────────
function extractEquipaggiamento() {
  const items = [];

  // Extract armor items from the table
  const armors = [
    "Armatura imbottita", "Armatura di cuoio", "Armatura di cuoio borchiato",
    "Armatura in pelle", "Giaco di Maglia", "Corazza di Scaglie",
    "Corazza di Piastre", "Mezza Armatura", "Corazza di Anelli",
    "Cotta di maglia", "Corazza a strisce", "Armatura Completa", "Scudo"
  ];

  // Simple melee weapons
  const simpleMelee = [
    "Ascia", "Bastone ferrato", "Clava", "Falcetto", "Giavellotto",
    "Lancia", "Martello leggero", "Mazza", "Pugnale"
  ];

  // Martial melee weapons
  const martialMelee = [
    "Alabarda", "Ascia Bipenne", "Ascia da battaglia", "Falcione",
    "Frusta", "Lancia da Cavaliere", "Maglio", "Martello da guerra",
    "Mazzafrusto", "Morning Star", "Picca", "Piccone da guerra",
    "Scimitarra", "Spada corta", "Spada lunga", "Spadone", "Stocco", "Tridente"
  ];

  // Simple ranged weapons
  const simpleRanged = [
    "Arco corto", "Balestra leggera", "Dardo", "Fionda"
  ];

  // Firearms
  const firearms = [
    "Archibugio", "Pistola", "Rivoltella",
    "DMR", "Fucile a canne mozze", "Fucile a pompa",
    "Fucile d'Assalto", "Fucile da cecchino Bolt Action",
    "Fucile da cecchino (semi)", "Fucile semi-automatico", "Mitraglietta"
  ];

  // Martial ranged
  const martialRanged = [
    "Arco lungo", "Balestra a mano", "Balestra pesante", "Rete"
  ];

  // Ammo
  const ammo = [
    "Cartuccia a palla", "Cartuccia sfondaporte", "Pallini",
    "Pallettoni", "Respiro del Drago"
  ];

  const allEquip = [
    ...armors.map(n => ({ name: n, description: "<p>Armatura</p>" })),
    ...simpleMelee.map(n => ({ name: n, description: "<p>Arma da mischia semplice</p>" })),
    ...martialMelee.map(n => ({ name: n, description: "<p>Arma marziale da mischia</p>" })),
    ...simpleRanged.map(n => ({ name: n, description: "<p>Arma a distanza semplice</p>" })),
    ...martialRanged.map(n => ({ name: n, description: "<p>Arma marziale a distanza</p>" })),
    ...firearms.map(n => ({ name: n, description: "<p>Arma da fuoco</p>" })),
    ...ammo.map(n => ({ name: n, description: "<p>Munizione</p>" })),
  ];

  writeJson("equipaggiamento.json", allEquip);
}

// ── INCANTESIMI (pages 180-226) ─────────────────────────────────────────────
function extractIncantesimi() {
  const items = [];
  const seen = new Set();

  const pageLines = getPageRange(180, 226);

  let currentSpell = null;
  let contentLines = [];

  // Skip section headers that contain these keywords
  const skipKeywords = [
    "Come funzionano", "Incantesimi d", "Incantesimi m", "Elenco",
    "Capitolo", "Equipaggiamento", "Nuove regole", "Sovraccarico",
    "Limite", "Nuove Condizioni", "Incantesimi della",
    "Incantesimi di", "Incantesimi dello"
  ];

  for (const line of pageLines) {
    const trimmed = line.trim();

    // Spell headings: ## <span style="font-size:20px"> {{Color:XXX SpellName}} </span>
    const isSpellHeading = trimmed.startsWith("## ") && trimmed.includes("Color:") &&
        !trimmed.includes("ScalySansSmallCaps") && !trimmed.includes("NodestoCaps") &&
        !trimmed.includes("ScalySansRemake") && !trimmed.includes("BookInsanity");

    // Also catch ## headings for spells that don't use Color: (some spell sections)
    const isPlainSpellHeading = trimmed.startsWith("## ") && trimmed.includes("font-size:20px") &&
        trimmed.includes("Color:");

    if (isSpellHeading || isPlainSpellHeading) {
      const name = cleanName(trimmed);

      // Skip section headers
      if (!name || name.length < 2 || skipKeywords.some(k => name.includes(k))) continue;

      if (currentSpell && !seen.has(currentSpell)) {
        items.push({ name: currentSpell, description: mdToHtml(contentLines) });
        seen.add(currentSpell);
      }
      currentSpell = name;
      contentLines = [line];
      continue;
    }

    // Skip H1 section headers (# Incantesimi di magia...)
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      // This is a section header, don't add to current spell
      continue;
    }

    if (currentSpell) contentLines.push(line);
  }
  if (currentSpell && !seen.has(currentSpell)) {
    items.push({ name: currentSpell, description: mdToHtml(contentLines) });
  }

  writeJson("incantesimi.json", items);
}

// ── STILI DI COMBATTIMENTO (pages 227-229) ──────────────────────────────────
function extractStiliCombattimento() {
  const pageLines = getPageRange(227, 229);
  const items = [];
  let currentStyle = null;
  let contentLines = [];

  for (const line of pageLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("### ") && !trimmed.includes("Padroneggia") &&
        !trimmed.includes("Capitolo")) {
      if (currentStyle) {
        items.push({ name: currentStyle, description: mdToHtml(contentLines) });
      }
      currentStyle = cleanName(trimmed);
      contentLines = [line];
      continue;
    }
    if (currentStyle) contentLines.push(line);
  }
  if (currentStyle) {
    items.push({ name: currentStyle, description: mdToHtml(contentLines) });
  }

  writeJson("stili-combattimento.json", items);
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log("Generating JSON data files from Homebrewery source...\n");
console.log(`Source: ${SOURCE_FILE}`);
console.log(`Total lines: ${lines.length}\n`);

extractRazze();
extractClassi();
extractMagie();
extractBackground();
extractTalenti();
extractEquipaggiamento();
extractIncantesimi();
extractStiliCombattimento();

console.log("\nAll JSON files generated in src/");
