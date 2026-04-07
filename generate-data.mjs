/**
 * Parses the Homebrewery source file and generates JSON data files
 * for each compendium pack.
 *
 * Usage: node generate-data.mjs <path-to-source-file>
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";

const MODULE_ID = "fairy-tail-5e";
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

// ── FEATURE RAZZE (pages 10-18) ────────────────────────────────────────────
function extractFeatureRazze() {
  const raceNames = [
    "Umani", "Exceed", "Ibrido Gatto", "Ibrido Lucertola",
    "Ibrido Lupo", "Ibrido Demone di Galuna", "Dragon Slayer", "Devil Slayer"
  ];
  const pageLines = getPageRange(10, 18);
  const items = [];

  /** Match a race name from a ## heading line */
  function matchRace(line) {
    const fontMatch = line.match(/font-family:\s*([^}]+)\}\}/);
    if (fontMatch) {
      const fontName = fontMatch[1].trim();
      const match = raceNames.find(r => fontName === r || fontName.includes(r));
      if (match) return match;
    }
    const name = cleanName(line);
    let match = raceNames.find(r => name === r);
    if (match) return match;
    match = raceNames.find(r => name.includes(r) || r.includes(name));
    return match || null;
  }

  // Split into race sections
  const raceSections = [];
  let curRace = null;
  let curLines = [];

  for (const line of pageLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ") && !trimmed.startsWith("### ")) {
      const matched = matchRace(trimmed);
      if (matched) {
        if (curRace) raceSections.push({ name: curRace, lines: curLines });
        curRace = matched;
        curLines = [];
        continue;
      }
    }
    if (curRace) curLines.push(line);
  }
  if (curRace) raceSections.push({ name: curRace, lines: curLines });

  // Deduplicate race sections
  const seenRaces = new Set();
  const uniqueRaceSections = raceSections.filter(s => {
    if (seenRaces.has(s.name)) return false;
    seenRaces.add(s.name);
    return true;
  });

  // Extract features from each race section
  for (const section of uniqueRaceSections) {
    let currentFeature = null;
    let featureLines = [];

    function pushFeature() {
      if (!currentFeature) return;
      const desc = `<p><em>Razza: ${section.name}</em></p>\n` + mdToHtml(featureLines);
      items.push({ name: currentFeature, description: desc });
    }

    for (const line of section.lines) {
      const trimmed = line.trim();

      // Skip images, style blocks, etc.
      if (trimmed.startsWith("![") || trimmed.startsWith("<img") ||
          trimmed.startsWith("{{") || trimmed.startsWith("}}") ||
          trimmed.startsWith(":::") || trimmed.startsWith("<div") ||
          trimmed.startsWith("</div")) continue;

      // ### heading → level-based feature
      if (trimmed.startsWith("### ")) {
        pushFeature();
        currentFeature = cleanName(trimmed);
        featureLines = [line];
        continue;
      }

      // **Name:** pattern → racial trait
      const boldMatch = trimmed.match(/^\*\*([^*]+?):\*\*/);
      if (boldMatch && boldMatch[1].length > 2 && boldMatch[1].length < 80) {
        pushFeature();
        currentFeature = boldMatch[1].trim();
        featureLines = [line];
        continue;
      }

      if (currentFeature) featureLines.push(line);
    }
    pushFeature();
  }

  writeJson("feature-razze.json", items);
}

// ── FEATURE CLASSI (pages 19-52) ───────────────────────────────────────────
function extractFeatureClassi() {
  const classNames = [
    "Mago Combattente", "Mago Difensore", "Mago Furtivo",
    "Mago di Strada", "Mago di Supporto", "Mago Tattico", "Guerriero"
  ];
  const classLines = [693, 884, 1048, 1230, 1407, 1553, 1848];
  const items = [];

  // #### headings that are proficiency/equipment info, NOT actual features
  const skipH4Names = [
    "Punti ferita", "Competenze", "Attrezzatura", "Equipaggiamento",
    "Sistema Magico", "Capacità Massima", "Costo in Mana",
    "Caratteristica da Incantatore", "Capacità di Incantesimo"
  ];

  function isSkippedH4(name) {
    const lower = name.toLowerCase();
    return skipH4Names.some(s => lower.includes(s.toLowerCase()));
  }

  for (let i = 0; i < classNames.length; i++) {
    const startLine = classLines[i] - 1;
    const endLine = i < classNames.length - 1 ? classLines[i + 1] - 1 : findPageStart(53);
    const sectionLines = lines.slice(startLine, endLine === -1 ? startLine + 500 : endLine);

    let currentFeature = null;
    let featureLines = [];

    function pushFeature() {
      if (!currentFeature) return;
      if (currentFeature.length < 2) return;
      const desc = `<p><em>Classe: ${classNames[i]}</em></p>\n` + mdToHtml(featureLines);
      items.push({ name: currentFeature, description: desc });
    }

    for (const line of sectionLines) {
      const trimmed = line.trim();

      // ### heading → class feature
      if (trimmed.startsWith("### ") && !trimmed.startsWith("#### ")) {
        const name = cleanName(trimmed);
        if (!name || name.length < 3) continue;
        pushFeature();
        currentFeature = name;
        featureLines = [line];
        continue;
      }

      // #### heading → class feature (used by Guerriero and some sub-features)
      // but skip proficiency/equipment info headings
      if (trimmed.startsWith("#### ") && !trimmed.startsWith("##### ")) {
        const name = cleanName(trimmed);
        if (!name || name.length < 3) continue;
        if (isSkippedH4(name)) continue;
        pushFeature();
        currentFeature = name;
        featureLines = [line];
        continue;
      }

      if (currentFeature) featureLines.push(line);
    }
    pushFeature();
  }

  writeJson("feature-classi.json", items);
}

// ── FEATURE MAGIE (pages 53-114) ───────────────────────────────────────────
function extractFeatureMagie() {
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

  // Skip patterns for section headers (not actual features)
  function isSkippedHeading(name) {
    if (!name || name.length < 3) return true;
    const lower = name.toLowerCase();
    if (lower === "mana") return true;
    if (lower === "azioni") return true;
    if (lower.includes("opzion") && lower.includes("funzionalità")) return true;
    if (lower.includes("opzion") && lower.includes("livello")) return true;
    return false;
  }

  // Split into magia sections by # headings
  const magiaSections = [];
  let curMagia = null;
  let curLines = [];

  for (const line of pageLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      if (trimmed.includes("Capitolo") || trimmed.includes("Magie}}")) continue;
      const matched = matchMagia(trimmed);
      if (matched) {
        if (curMagia) magiaSections.push({ name: curMagia, lines: curLines });
        curMagia = matched;
        curLines = [];
        continue;
      }
    }
    if (curMagia) curLines.push(line);
  }
  if (curMagia) magiaSections.push({ name: curMagia, lines: curLines });

  // Check Solid Script fallback
  if (!magiaSections.find(s => s.name === "Magia del Solid Script")) {
    const ssPages = getPageRange(102, 106);
    magiaSections.splice(11, 0, { name: "Magia del Solid Script", lines: ssPages });
  }

  // Extract features from each magia section
  for (const section of magiaSections) {
    let currentFeature = null;
    let featureLines = [];

    function pushFeature() {
      if (!currentFeature || isSkippedHeading(currentFeature)) return;
      const desc = `<p><em>Magia: ${section.name}</em></p>\n` + mdToHtml(featureLines);
      items.push({ name: currentFeature, description: desc });
    }

    for (const line of section.lines) {
      const trimmed = line.trim();

      // ### heading → magia feature
      if (trimmed.startsWith("### ")) {
        const name = cleanName(trimmed);
        pushFeature();
        currentFeature = name;
        featureLines = [line];
        continue;
      }

      if (currentFeature) featureLines.push(line);
    }
    pushFeature();
  }

  writeJson("feature-magie.json", items);
}

// ── ENRICHMENT: Razze + Feature Razze ──────────────────────────────────────

/** Generate a deterministic 16-char hex ID from a seed string */
function stableId(seed) {
  return createHash("md5").update(seed).digest("hex").slice(0, 16);
}

/** Convert a name to kebab-case identifier */
function toKebab(name) {
  return name
    .toLowerCase()
    .replace(/[°:()]/g, "")
    .replace(/[àáâ]/g, "a").replace(/[èéê]/g, "e")
    .replace(/[ìíî]/g, "i").replace(/[òóô]/g, "o").replace(/[ùúû]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Mechanical configuration for each race.
 * - asi: AbilityScoreImprovement advancement config
 * - skills: Trait advancement for skill proficiencies
 * - movement: base movement speeds
 * - senses: darkvision etc.
 * - size: creature size ("sm", "med", etc.)
 * - featureLevels: map level → array of feature names to grant via ItemGrant
 */
const RACE_CONFIG = {
  "Umani": {
    movement: { walk: 9, units: "m" },
    senses: {},
    size: "med",
    asi: { points: 3, fixed: {}, cap: 2 },
    skills: { grants: ["skills:his"] },
    featureLevels: {
      0: ["Jack Of All", "Controllo magico"]
    },
    talentChoices: [
      { level: 0, title: "Jack Of All", hint: "Inizi con un Talento extra a tua scelta.", count: 1 }
    ]
  },
  "Exceed": {
    movement: { walk: 12, units: "m" },
    senses: {},
    size: "sm",
    asi: { points: 2, fixed: { dex: 2 }, cap: 2 },
    skills: { grants: [] },
    featureLevels: {
      0: ["Ali magiche", "Le Ali Ti Sostengono", "Riserva di mana"]
    }
  },
  "Ibrido Gatto": {
    movement: { walk: 12, units: "m" },
    senses: {},
    size: "med",
    asi: { points: 1, fixed: { dex: 2 }, cap: 2 },
    skills: { grants: ["skills:sur"] },
    featureLevels: {
      0: ["Sensi acuti", "Sensi felini", "Artigli del felino"]
    }
  },
  "Ibrido Lucertola": {
    movement: { walk: 9, units: "m" },
    senses: {},
    size: "med",
    asi: { points: 1, fixed: { con: 1, str: 1 }, cap: 1 },
    skills: {
      grants: [],
      choices: [{ count: 1, pool: ["skills:itm", "skills:sur"] }]
    },
    featureLevels: {
      0: ["Corpo avvelenato", "Frusta coda avvelenata", "Corpo resistente"]
    }
  },
  "Ibrido Lupo": {
    movement: { walk: 12, units: "m" },
    senses: {},
    size: "med",
    asi: { points: 0, fixed: { str: 2, wis: 1 }, cap: 2 },
    skills: { grants: ["skills:prc"] },
    featureLevels: {
      0: ["Udito e olfatto acuti", "Tattiche di branco", "Ululato del branco"]
    }
  },
  "Ibrido Demone di Galuna": {
    movement: { walk: 9, units: "m" },
    senses: { darkvision: 18, units: "m" },
    size: "med",
    asi: { points: 0, fixed: { cha: 2, con: 1 }, cap: 2 },
    skills: { grants: [] },
    featureLevels: {
      0: ["Talento", "Resistenza Demoniaca", "Trasformazione demoniaca"]
    },
    talentChoices: [
      { level: 0, title: "Talento", hint: "Ottieni un talento a tua scelta dal capitolo Talenti.", count: 1 }
    ]
  },
  "Dragon Slayer": {
    movement: { walk: 9, units: "m" },
    senses: {},
    size: "med",
    asi: { points: 1, fixed: { con: 2 }, cap: 2 },
    skills: {
      grants: [],
      choices: [{ count: 1, pool: ["skills:ath", "skills:acr"] }]
    },
    featureLevels: {
      0: ["Magia Focalizzata", "Potere del Drago"],
      1: ["Anima del drago 1° livello"],
      3: ["Tecniche del Dragon Slayer 3° livello"],
      6: ["Dragon Mode 6° livello", "Buff in Dual Dragon Mode"],
      11: ["Tecniche segrete del dragon slayer 11° livello"],
      18: ["Dragon Force 18° Livello"]
    }
  },
  "Devil Slayer": {
    movement: { walk: 9, units: "m" },
    senses: {},
    size: "med",
    asi: { points: 0, fixed: { wis: 2, con: 1 }, cap: 2 },
    skills: { grants: ["skills:rel"] },
    featureLevels: {
      0: ["Preda"],
      1: ["1° livello: Demonizzazione"],
      3: ["3° livello: Esorcismo"],
      6: ["6° Livello: Osservazione Demoniaca"],
      11: ["11° livello: Yama"],
      18: ["18° livello: Post Mortem"]
    }
  }
};

/** Build the advancement array for a race */
function buildAdvancement(raceName, config, featureItems) {
  const adv = [];
  const PACK = `ft5e-feature-razze`;

  // 1. AbilityScoreImprovement
  adv.push({
    _id: stableId(`adv:${raceName}:asi`),
    type: "AbilityScoreImprovement",
    level: 0,
    title: "",
    hint: "",
    icon: null,
    classRestriction: null,
    configuration: {
      points: config.asi.points,
      fixed: {
        str: config.asi.fixed.str || 0,
        dex: config.asi.fixed.dex || 0,
        con: config.asi.fixed.con || 0,
        int: config.asi.fixed.int || 0,
        wis: config.asi.fixed.wis || 0,
        cha: config.asi.fixed.cha || 0
      },
      cap: config.asi.cap || 2,
      locked: []
    },
    value: {}
  });

  // 2. Size
  adv.push({
    _id: stableId(`adv:${raceName}:size`),
    type: "Size",
    level: 1,
    title: "",
    hint: "",
    icon: null,
    classRestriction: null,
    configuration: { sizes: [config.size] },
    value: { size: "" }
  });

  // 3. Trait (skill proficiencies)
  if ((config.skills.grants && config.skills.grants.length) ||
      (config.skills.choices && config.skills.choices.length)) {
    adv.push({
      _id: stableId(`adv:${raceName}:skills`),
      type: "Trait",
      level: 0,
      title: "",
      hint: "",
      icon: null,
      classRestriction: null,
      configuration: {
        mode: "default",
        allowReplacements: false,
        grants: config.skills.grants || [],
        choices: config.skills.choices || []
      },
      value: { chosen: [] }
    });
  }

  // 4. ItemGrant per level
  for (const [level, featureNames] of Object.entries(config.featureLevels)) {
    const items = [];
    for (const fname of featureNames) {
      const feat = featureItems.find(
        f => f.name === fname &&
        f.description.includes(`Razza: ${raceName}`)
      );
      if (feat && feat._id) {
        items.push({
          uuid: `Compendium.${MODULE_ID}.${PACK}.${feat._id}`
        });
      }
    }
    if (items.length > 0) {
      adv.push({
        _id: stableId(`adv:${raceName}:grant:${level}`),
        type: "ItemGrant",
        level: parseInt(level),
        title: "",
        hint: "",
        icon: null,
        classRestriction: null,
        configuration: {
          items: items,
          optional: false,
          spell: null
        },
        value: {}
      });
    }
  }

  // 5. ItemChoice for talent grants (race features that let player choose a talent)
  if (config.talentChoices) {
    for (const tc of config.talentChoices) {
      adv.push({
        _id: stableId(`adv:${raceName}:talent:${tc.level}:${tc.title}`),
        type: "ItemChoice",
        level: tc.level,
        title: tc.title,
        hint: tc.hint || "",
        icon: null,
        classRestriction: null,
        configuration: {
          choices: { [String(tc.level)]: { count: tc.count, replacement: false } },
          allowDrops: true,
          type: "feat",
          pool: [],
          restriction: {},
          spell: null
        },
        value: { added: {}, replaced: {} }
      });
    }
  }

  return adv;
}

/** Post-process: enrich razze and feature-razze with mechanical data */
function enrichRazze() {
  const razzePath = path.join(SRC_DIR, "razze.json");
  const featPath = path.join(SRC_DIR, "feature-razze.json");

  const razze = JSON.parse(fs.readFileSync(razzePath, "utf-8"));
  const features = JSON.parse(fs.readFileSync(featPath, "utf-8"));

  // Assign stable IDs + metadata to features
  for (const f of features) {
    const race = f.description.match(/Razza: ([^<]+)/)?.[1] || "";
    f._id = stableId(`feature-razze:${race}:${f.name}`);
    f.system = {
      type: { value: "race", subtype: "" },
      requirements: race,
      identifier: toKebab(f.name)
    };
  }

  // Enrich races
  for (const r of razze) {
    const config = RACE_CONFIG[r.name];
    if (!config) {
      console.warn(`  ⚠ No config for race: ${r.name}`);
      continue;
    }

    r._id = stableId(`razze:${r.name}`);
    r.system = {
      identifier: toKebab(r.name),
      source: {
        custom: "Fairy Tail 5e",
        book: "Fairy Tail",
        page: "",
        license: "",
        rules: "2014"
      },
      movement: {
        walk: config.movement.walk,
        burrow: null,
        climb: null,
        fly: config.movement.fly || null,
        swim: null,
        units: config.movement.units || "m",
        hover: false
      },
      senses: {
        darkvision: config.senses.darkvision || null,
        blindsight: null,
        tremorsense: null,
        truesight: null,
        units: config.senses.units || "m",
        special: ""
      },
      type: { value: "humanoid", subtype: "", custom: "" },
      advancement: buildAdvancement(r.name, config, features)
    };
  }

  // Write back
  fs.writeFileSync(razzePath, JSON.stringify(razze, null, 2), "utf-8");
  console.log(`  ✓ razze.json: enriched ${razze.length} items with advancement`);
  fs.writeFileSync(featPath, JSON.stringify(features, null, 2), "utf-8");
  console.log(`  ✓ feature-razze.json: enriched ${features.length} items with metadata`);
}

// ── ENRICHMENT: Classi + Feature Classi ────────────────────────────────────

const CLASS_CONFIG = {
  "Mago Combattente": {
    identifier: "mago-combattente",
    asiLevels: [4, 8, 12, 16, 19],
    asiFeatureKeyword: "Incremento dei Punteggi",
    asiTitle: "Incremento dei Punteggi di Caratteristica"
  },
  "Mago Difensore": {
    identifier: "mago-difensore",
    asiLevels: [4, 8, 12, 16, 19],
    asiFeatureKeyword: "Incremento dei Punteggi",
    asiTitle: "Incremento dei Punteggi di Caratteristica"
  },
  "Mago Furtivo": {
    identifier: "mago-furtivo",
    asiLevels: [4, 8, 12, 16, 19],
    asiFeatureKeyword: "Miglioramento del punteggio",
    asiTitle: "Miglioramento del punteggio di caratteristica"
  },
  "Mago di Strada": {
    identifier: "mago-di-strada",
    asiLevels: [4, 8, 12, 16, 19],
    asiFeatureKeyword: "Miglioramento del punteggio",
    asiTitle: "Miglioramento del punteggio di caratteristica"
  },
  "Mago di Supporto": {
    identifier: "mago-di-supporto",
    asiLevels: [4, 8, 12, 16, 19],
    asiFeatureKeyword: "Miglioramento",
    asiTitle: "Miglioramento Punteggio Caratteristica"
  },
  "Mago Tattico": {
    identifier: "mago-tattico",
    asiLevels: [4, 8, 12, 16, 19],
    asiFeatureKeyword: "Miglioramento del Punteggio",
    asiTitle: "Miglioramento del Punteggio di Caratteristica"
  },
  "Guerriero": {
    identifier: "guerriero",
    asiLevels: [4, 8, 12, 16, 19],
    asiFeatureKeyword: "Miglioramento delle Caratteristiche",
    asiTitle: "Miglioramento delle Caratteristiche"
  }
};

/** Post-process: enrich classi and feature-classi with mechanical data */
function enrichClassi() {
  const classiPath = path.join(SRC_DIR, "classi.json");
  const featPath = path.join(SRC_DIR, "feature-classi.json");

  const classi = JSON.parse(fs.readFileSync(classiPath, "utf-8"));
  const features = JSON.parse(fs.readFileSync(featPath, "utf-8"));

  // Assign stable IDs and metadata to all class features
  for (const f of features) {
    const cls = f.description.match(/Classe: ([^<]+)/)?.[1] || "";
    f._id = stableId(`feature-classi:${cls}:${f.name}`);
    f.system = {
      type: { value: "class", subtype: "" },
      requirements: cls,
      identifier: toKebab(f.name)
    };
  }

  // Enrich classes
  for (const c of classi) {
    const config = CLASS_CONFIG[c.name];
    if (!config) {
      console.warn(`  ⚠ No config for class: ${c.name}`);
      continue;
    }

    c._id = stableId(`classi:${c.name}`);
    const advancement = [];

    // Find the ASI feature item for this class
    const asiFeature = features.find(
      f => f.name.toLowerCase().includes(config.asiFeatureKeyword.toLowerCase()) &&
      f.description.includes(`Classe: ${c.name}`)
    );

    // Add ASI advancement at each ASI level
    for (const level of config.asiLevels) {
      // ItemGrant for the ASI feature description
      if (asiFeature) {
        advancement.push({
          _id: stableId(`adv:${c.name}:asi-grant:${level}`),
          type: "ItemGrant",
          level: level,
          title: config.asiTitle,
          hint: "",
          icon: null,
          classRestriction: null,
          configuration: {
            items: [{ uuid: `Compendium.${MODULE_ID}.ft5e-feature-classi.${asiFeature._id}` }],
            optional: false,
            spell: null
          },
          value: {}
        });
      }

      // AbilityScoreImprovement (mechanical: +2 to one stat, or +1 to two, or a feat)
      advancement.push({
        _id: stableId(`adv:${c.name}:asi:${level}`),
        type: "AbilityScoreImprovement",
        level: level,
        title: config.asiTitle,
        hint: "Puoi aumentare una caratteristica di 2 o due caratteristiche di 1. In alternativa, puoi scegliere un Talento.",
        icon: null,
        classRestriction: null,
        configuration: {
          points: 2,
          fixed: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
          cap: 2,
          locked: []
        },
        value: {}
      });
    }

    c.system = {
      identifier: config.identifier,
      source: {
        custom: "Fairy Tail 5e",
        book: "Fairy Tail",
        page: "",
        license: "",
        rules: "2014"
      },
      advancement: advancement
    };
  }

  // Write back
  fs.writeFileSync(classiPath, JSON.stringify(classi, null, 2), "utf-8");
  console.log(`  ✓ classi.json: enriched ${classi.length} items with ASI advancement`);
  fs.writeFileSync(featPath, JSON.stringify(features, null, 2), "utf-8");
  console.log(`  ✓ feature-classi.json: enriched ${features.length} items with metadata`);
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
extractFeatureRazze();
extractFeatureClassi();
extractFeatureMagie();

console.log("\nEnriching data...");
enrichRazze();
enrichClassi();

console.log("\nAll JSON files generated in src/");
