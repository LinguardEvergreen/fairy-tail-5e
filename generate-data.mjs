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

/** Map section header keywords to magia names */
const SPELL_SECTION_MAP = [
  { keywords: ["Spazio Aereo"], magia: "Magia dello Spazio Aereo" },
  { keywords: ["magia delle carte", "carte"], magia: "Magia delle Carte" },
  { keywords: ["magia della terra", "della terra"], magia: "Magia della Terra" },
  { keywords: ["magia del fuoco", "del fuoco"], magia: "Magia del Fuoco" },
  { keywords: ["ingranaggio", "Ingranaggi"], magia: "Magia degli Ingranaggi" },
  { keywords: ["pistola", "Armi da Fuoco"], magia: "Magia delle Armi da Fuoco" },
  { keywords: ["Corpo Celeste", "corpo celeste"], magia: "Magia del Corpo Celeste" },
  { keywords: ["Fulmine", "fulmine"], magia: "Magia del Fulmine" },
  { keywords: ["Creazione", "creazione"], magia: "Magia della Creazione" },
  { keywords: ["Cambio Stock", "cambio stock"], magia: "Magia del Cambio Stock" },
  { keywords: ["Sabbia", "sabbia"], magia: "Magia della Sabbia" },
  { keywords: ["Solid Script", "solid script"], magia: "Magia del Solid Script" },
  { keywords: ["Take Over", "take over"], magia: "Magia di Take Over" },
  { keywords: ["acqua", "Acqua"], magia: "Magia dell'Acqua" },
];

function matchSpellSection(line) {
  for (const entry of SPELL_SECTION_MAP) {
    for (const kw of entry.keywords) {
      if (line.includes(kw)) return entry.magia;
    }
  }
  return null;
}

/** Parse spell level and school from the italic metadata line */
function parseSpellLevelSchool(text) {
  const clean = text.replace(/^\*+|\*+$/g, "").trim().toLowerCase();
  let level = null;
  let school = null;
  let ritual = false;

  // Check ritual
  if (clean.includes("rituale") || clean.includes("ritual")) ritual = true;

  // Cantrip detection
  if (clean.includes("trucco") || clean.includes("trucchetto") || clean.includes("cantrip")) {
    level = 0;
  }

  // Level number
  const lvlMatch = clean.match(/(\d+)°?\s*livello/);
  if (lvlMatch) level = parseInt(lvlMatch[1]);

  // School detection
  const schools = {
    "evocazione": "evo", "abiurazione": "abj", "trasmutazione": "trs",
    "divinazione": "div", "necromanzia": "nec", "ammaliamento": "enc",
    "illusione": "ill", "invocazione": "con", "conjuration": "con"
  };
  for (const [it, en] of Object.entries(schools)) {
    if (clean.includes(it)) { school = en; break; }
  }

  return { level: level ?? 0, school: school || "evo", ritual };
}

/** Parse spell metadata fields from raw content lines */
function parseSpellMeta(rawLines) {
  const meta = { castTime: null, range: null, components: null, duration: null, manaCost: null };

  for (const line of rawLines) {
    const t = line.trim();
    // Casting time
    let m = t.match(/\*\*Tempo di lancio:\*\*\s*::?\s*(.+)/i);
    if (m) { meta.castTime = m[1].trim(); continue; }
    // Range
    m = t.match(/\*\*(?:Portata|Intervallo):\*\*\s*::?\s*(.+)/i);
    if (m) { meta.range = m[1].trim(); continue; }
    // Components
    m = t.match(/\*\*(?:Componenti?|Componente):\*\*\s*::?\s*(.+)/i);
    if (m) { meta.components = m[1].trim(); continue; }
    // Duration
    m = t.match(/\*\*Durata:\*\*\s*::?\s*(.+)/i);
    if (m) { meta.duration = m[1].trim(); continue; }
    // Mana cost
    m = t.match(/\*\*(?:Costo di mana|Punti mana):\*\*\s*::?\s*(\d+)\s*(?:MP|PM)/i);
    if (m) { meta.manaCost = parseInt(m[1]); continue; }
  }
  return meta;
}

/** Parse casting time to dnd5e activation object */
function parseActivation(castTime) {
  if (!castTime) return { type: "action", cost: 1 };
  const lower = castTime.toLowerCase();
  if (lower.includes("bonus") || lower.includes("azione bonus")) return { type: "bonus", cost: 1 };
  if (lower.includes("reazione") || lower.includes("reaction")) return { type: "reaction", cost: 1 };
  if (lower.includes("minuto") || lower.includes("minuti")) {
    const n = lower.match(/(\d+)/);
    return { type: "minute", cost: n ? parseInt(n[1]) : 1 };
  }
  if (lower.includes("ora") || lower.includes("ore")) {
    const n = lower.match(/(\d+)/);
    return { type: "hour", cost: n ? parseInt(n[1]) : 1 };
  }
  return { type: "action", cost: 1 };
}

/** Parse range to dnd5e range object */
function parseRange(rangeStr) {
  if (!rangeStr) return { value: null, units: "" };
  const lower = rangeStr.toLowerCase().trim();
  if (lower.includes("sé") || lower.includes("se stesso") || lower === "sè" || lower === "personale")
    return { value: null, units: "self" };
  if (lower.includes("tocco") || lower.includes("contatto"))
    return { value: null, units: "touch" };
  const mMatch = lower.match(/(\d+)\s*(?:metr[io]|m\b)/);
  if (mMatch) return { value: parseInt(mMatch[1]), units: "m" };
  const kmMatch = lower.match(/(\d+)\s*(?:km|chilometr)/);
  if (kmMatch) return { value: parseInt(kmMatch[1]) * 1000, units: "m" };
  return { value: null, units: "" };
}

/** Parse duration to dnd5e duration object */
function parseDuration(durStr) {
  if (!durStr) return { value: null, units: "" };
  const lower = durStr.toLowerCase().trim();
  if (lower.includes("istantan")) return { value: null, units: "inst" };
  if (lower.includes("concentrazione")) {
    const minMatch = lower.match(/(\d+)\s*minut/);
    if (minMatch) return { value: parseInt(minMatch[1]), units: "minute", concentration: true };
    const hMatch = lower.match(/(\d+)\s*or[ae]/);
    if (hMatch) return { value: parseInt(hMatch[1]), units: "hour", concentration: true };
    const rMatch = lower.match(/(\d+)\s*round/);
    if (rMatch) return { value: parseInt(rMatch[1]), units: "round", concentration: true };
    return { value: 1, units: "minute", concentration: true };
  }
  const minMatch = lower.match(/(\d+)\s*minut/);
  if (minMatch) return { value: parseInt(minMatch[1]), units: "minute" };
  const hMatch = lower.match(/(\d+)\s*or[ae]/);
  if (hMatch) return { value: parseInt(hMatch[1]), units: "hour" };
  const rMatch = lower.match(/(\d+)\s*round/);
  if (rMatch) return { value: parseInt(rMatch[1]), units: "round" };
  const dMatch = lower.match(/(\d+)\s*giorn/);
  if (dMatch) return { value: parseInt(dMatch[1]), units: "day" };
  return { value: null, units: "" };
}

/** Parse components string */
function parseComponents(compStr) {
  if (!compStr) return { vocal: false, somatic: false, material: false, value: "" };
  const upper = compStr.toUpperCase();
  const vocal = upper.includes("V");
  const somatic = upper.includes("S");
  // Material: "M" or anything in parentheses
  let material = upper.includes("M") || compStr.includes("(");
  let matValue = "";
  const matMatch = compStr.match(/\(([^)]+)\)/);
  if (matMatch) { material = true; matValue = matMatch[1].trim(); }
  return { vocal, somatic, material, value: matValue };
}

function extractIncantesimi() {
  const items = [];
  const seen = new Set();

  const pageLines = getPageRange(180, 226);

  let currentSpell = null;
  let contentLines = [];
  let rawLines = []; // original lines for metadata parsing
  let currentMagia = null;

  // Skip section headers that contain these keywords
  const skipKeywords = [
    "Come funzionano", "Elenco",
    "Capitolo", "Equipaggiamento", "Nuove regole", "Sovraccarico",
    "Limite", "Nuove Condizioni"
  ];

  function pushSpell() {
    if (!currentSpell || seen.has(currentSpell)) return;

    // Parse the italic level/school line (first non-empty raw line after heading)
    let levelSchool = { level: 0, school: "evo", ritual: false };
    let meta = parseSpellMeta(rawLines);
    for (const rl of rawLines) {
      const t = rl.trim();
      if (t.startsWith("*") && !t.startsWith("**")) {
        levelSchool = parseSpellLevelSchool(t);
        break;
      }
    }

    items.push({
      name: currentSpell,
      description: mdToHtml(contentLines),
      _magia: currentMagia,
      _meta: { ...levelSchool, ...meta }
    });
    seen.add(currentSpell);
  }

  for (const line of pageLines) {
    const trimmed = line.trim();

    // Track magia sections: # headings with "Incantesimi"
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      if (trimmed.toLowerCase().includes("incantesim")) {
        const matched = matchSpellSection(trimmed);
        if (matched) currentMagia = matched;
      }
      continue;
    }

    // Spell headings: ## <span style="font-size:20px"> {{Color:XXX SpellName}} </span>
    const isSpellHeading = trimmed.startsWith("## ") && trimmed.includes("Color:") &&
        !trimmed.includes("ScalySansSmallCaps") && !trimmed.includes("NodestoCaps") &&
        !trimmed.includes("ScalySansRemake") && !trimmed.includes("BookInsanity");

    if (isSpellHeading) {
      const name = cleanName(trimmed);
      if (!name || name.length < 2 || skipKeywords.some(k => name.includes(k))) continue;

      pushSpell();
      currentSpell = name;
      contentLines = [line];
      rawLines = [];
      continue;
    }

    if (currentSpell) {
      contentLines.push(line);
      rawLines.push(line);
    }
  }
  pushSpell();

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

  // Check Solid Script fallback — if missing, split it from Sabbia
  if (!magiaSections.find(s => s.name === "Magia del Solid Script")) {
    const ssPages = getPageRange(102, 106);
    magiaSections.splice(11, 0, { name: "Magia del Solid Script", lines: ssPages });

    // Remove Solid Script lines from Sabbia section to avoid duplicates
    const sabbiaSection = magiaSections.find(s => s.name === "Magia della Sabbia");
    if (sabbiaSection) {
      // Find the first Solid Script feature line in Sabbia and cut there
      const cutIdx = sabbiaSection.lines.findIndex(l =>
        l.trim().startsWith("### ") && (
          cleanName(l).toLowerCase().includes("scrittura solida") ||
          cleanName(l).toLowerCase().includes("solid script") ||
          cleanName(l).toLowerCase().includes("forgiatore di parole")
        )
      );
      if (cutIdx > 0) {
        sabbiaSection.lines = sabbiaSection.lines.slice(0, cutIdx);
      }
    }
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

  // 5. Talent choices (Jack Of All, etc.) are handled at RUNTIME by mana-points.mjs
  // via a custom dialog that shows both FT5e and D&D 5e feats with prerequisite filtering.
  // No ItemChoice advancement is created here.

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
        custom: "",
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
    hitDice: "d8",
    saves: ["int", "con"],
    armor: [],
    weapons: ["sim"],
    skills: { count: 2, pool: ["arc", "his", "ins", "inv", "med", "rel"] },
    asiLevels: [4, 8, 12, 16, 19],
    asiFeatureKeyword: "Incremento dei Punteggi",
    asiTitle: "Incremento dei Punteggi di Caratteristica",
    featureLevels: {
      1: ["Magia", "Senza Freni"],
      3: ["Risonanza Distruttiva"],
      7: ["Magia Potenziata"],
      10: ["Risonanza Distruttiva"],
      14: ["Senza Freni"],
      17: ["Risonanza Distruttiva"],
      20: ["Incantesimo Personale"]
    }
  },
  "Mago Difensore": {
    identifier: "mago-difensore",
    hitDice: "d12",
    saves: ["str", "con"],
    armor: ["lgt", "med", "hvy", "shl"],
    weapons: ["sim", "mar"],
    skills: { count: 2, pool: ["ath", "itm", "his", "ins", "med", "sur"] },
    asiLevels: [4, 8, 12, 16, 19],
    asiFeatureKeyword: "Incremento dei Punteggi",
    asiTitle: "Incremento dei Punteggi di Caratteristica",
    featureLevels: {
      1: ["Magia", "Pelle Indotta dal Mana"],
      2: ["Resilienza del Baluardo"],
      3: ["Ritorsione del Baluardo"],
      5: ["Attacco Extra"],
      6: ["Provocazione"],
      7: ["Maestro dello Scudo"],
      10: ["Baluardo Adamantino"],
      13: ["Posizione Inamovibile"],
      14: ["Posizione Difensiva"],
      17: ["Posizione Inamovibile Potenziata"],
      18: ["Corpo di Guerriero"]
    }
  },
  "Mago Furtivo": {
    identifier: "mago-furtivo",
    hitDice: "d8",
    saves: ["dex", "int"],
    armor: ["lgt"],
    weapons: ["sim"],
    skills: { count: 4, pool: ["acr", "ath", "dec", "ins", "itm", "inv", "prc", "prf", "per", "slt", "ste"] },
    asiLevels: [4, 8, 12, 16, 19],
    asiFeatureKeyword: "Miglioramento del punteggio",
    asiTitle: "Miglioramento del punteggio di caratteristica",
    featureLevels: {
      1: ["Magia nata o insegnata:", "Maestria", "Attacco Furtivo"],
      2: ["Azione Scaltra"],
      3: ["Incantesimi Silenziosi"],
      5: ["Schivata Prodigiosa"],
      6: ["Familiarità Magica"],
      7: ["Elusione"],
      9: ["Innesco Accecante"],
      11: ["Dote Affidabile"],
      13: ["Innesco Silenziante"],
      14: ["Percezione Cieca"],
      15: ["Mente Sfuggente"],
      18: ["Inafferrabile"],
      20: ["Colpo di Fortuna"]
    }
  },
  "Mago di Strada": {
    identifier: "mago-di-strada",
    hitDice: "d10",
    saves: ["dex", "cha"],
    armor: ["lgt"],
    weapons: ["sim"],
    skills: { count: 3, pool: ["acr", "dec", "prf", "per", "slt", "ste"] },
    asiLevels: [4, 8, 12, 16, 19],
    asiFeatureKeyword: "Miglioramento del punteggio",
    asiTitle: "Miglioramento del punteggio di caratteristica",
    featureLevels: {
      1: ["Magia nata o insegnata:", "Performance Magica"],
      2: ["Miglioramento della Performance"],
      5: ["Maestria della Performance"],
      7: ["Spettacolo Mozzafiato"],
      10: ["Performance Ispirante"],
      13: ["Riarmo Musicale"],
      15: ["Maestria della Performance Potenziata"],
      18: ["Performance Leggendaria"]
    }
  },
  "Mago di Supporto": {
    identifier: "mago-di-supporto",
    hitDice: "d8",
    saves: ["dex", "wis"],
    armor: ["lgt"],
    weapons: ["sim"],
    skills: { count: 2, pool: ["arc", "dec", "ins", "itm", "prf", "per", "ste"], fixed: ["med"] },
    asiLevels: [4, 8, 12, 16, 19],
    asiFeatureKeyword: "Miglioramento",
    asiTitle: "Miglioramento Punteggio Caratteristica",
    featureLevels: {
      1: ["Magia nata o insegnata:", "Determinazione Inestinguibile"],
      2: ["Armonia Protettiva"],
      3: ["Maestria"],
      5: ["Crescendo Difensivo"],
      6: ["Fonte di Determinazione"],
      11: ["Risonanza"],
      14: ["Purificazione Armonica"],
      20: ["Cadenza Concertata"]
    }
  },
  "Mago Tattico": {
    identifier: "mago-tattico",
    hitDice: "d6",
    saves: ["int", "con"],
    armor: ["lgt"],
    weapons: ["sim"],
    skills: { count: 3, pool: ["arc", "dec", "acr", "inv", "prc", "ste"] },
    asiLevels: [4, 8, 12, 16, 19],
    asiFeatureKeyword: "Miglioramento del Punteggio",
    asiTitle: "Miglioramento del Punteggio di Caratteristica",
    featureLevels: {
      1: ["Magia nata o insegnata:", "Mente Tattica"],
      2: ["Analisi degli Incantesimi"],
      3: ["Lancio Rapido"],
      6: ["Conservazione del Mana"],
      9: ["Maestria degli Incantesimi"],
      10: ["Maestria Arcana"],
      14: ["Maestro Tattico"],
      20: ["Genio Tattico"],
      // Piano Tattico sub-features granted as choices
      _pianoTattico: {
        levels: [6, 12, 18],
        title: "Piano Tattico",
        hint: "Scegli un Piano Tattico dalla lista.",
        pool: [
          "Sfrutta i punti deboli:", "Occhio vigile:", "Movimenti tattici:",
          "Osservazione acuta:", "Coordinamento strategico:", "Sinergia arcana:",
          "Assalto Calcolato:", "Diversione Tattica:", "Precognizione:",
          "Interruzione Tattica:", "Via di Fuga:", "Cautela:",
          "Offensiva Focalizzata:", "Efficienza del Mana:", "Ritirata Calcolata:"
        ]
      }
    }
  },
  "Guerriero": {
    identifier: "guerriero",
    hitDice: "d10",
    saves: ["str", "dex", "con"],
    armor: ["lgt", "med", "hvy", "shl"],
    weapons: ["sim", "mar"],
    skills: { count: 2, pool: ["acr", "ani", "ath", "his", "ins", "itm", "prc", "sur"] },
    asiLevels: [4, 8, 12, 16, 19],
    asiFeatureKeyword: "Miglioramento delle Caratteristiche",
    asiTitle: "Miglioramento delle Caratteristiche",
    featureLevels: {
      1: ["Magia nata o insegnata:", "Abilità in combattimento", "Difesa senza armatura"],
      2: ["Flusso di Mana"],
      4: ["Maestria con le armi"],
      5: ["Attacco Extra"],
      9: ["Spirito Indomito"],
      10: ["Maestria nel Combattimento Migliorata"],
      11: ["Attacco Extra"],
      17: ["Maestria nel Critico"]
    }
  }
};

/**
 * Find a feature item by name for a specific class.
 * Tries exact match first, then case-insensitive.
 */
function findClassFeature(features, featureName, className) {
  // Exact match
  let feat = features.find(
    f => f.name === featureName && f.description.includes(`Classe: ${className}`)
  );
  if (feat) return feat;

  // Case-insensitive match
  const lower = featureName.toLowerCase().replace(/:$/, "");
  feat = features.find(
    f => f.name.toLowerCase().replace(/:$/, "") === lower &&
    f.description.includes(`Classe: ${className}`)
  );
  return feat || null;
}

/** Post-process: enrich classi and feature-classi with mechanical data */
function enrichClassi() {
  const classiPath = path.join(SRC_DIR, "classi.json");
  const featPath = path.join(SRC_DIR, "feature-classi.json");

  const classi = JSON.parse(fs.readFileSync(classiPath, "utf-8"));
  const features = JSON.parse(fs.readFileSync(featPath, "utf-8"));
  const PACK = "ft5e-feature-classi";

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
  let totalGranted = 0;
  let totalMissing = 0;

  for (const c of classi) {
    const config = CLASS_CONFIG[c.name];
    if (!config) {
      console.warn(`  ⚠ No config for class: ${c.name}`);
      continue;
    }

    c._id = stableId(`classi:${c.name}`);
    const advancement = [];

    // 0. HitPoints advancement (level 0 = every level)
    advancement.push({
      _id: stableId(`adv:${c.name}:hp`),
      type: "HitPoints",
      level: 0,
      title: "",
      hint: "",
      icon: null,
      classRestriction: null,
      configuration: {},
      value: {}
    });

    // 0b. Saving throw proficiencies (level 1)
    if (config.saves?.length) {
      const grants = config.saves.map(s => `saves:${s}`);
      advancement.push({
        _id: stableId(`adv:${c.name}:saves`),
        type: "Trait",
        level: 1,
        title: "Tiri Salvezza",
        hint: "",
        icon: null,
        classRestriction: null,
        configuration: {
          mode: "default",
          allowReplacements: false,
          grants,
          choices: []
        },
        value: { chosen: [] }
      });
    }

    // 0c. Armor proficiencies (level 1)
    if (config.armor?.length) {
      const grants = config.armor.map(a => `armor:${a}`);
      advancement.push({
        _id: stableId(`adv:${c.name}:armor`),
        type: "Trait",
        level: 1,
        title: "Competenze nelle Armature",
        hint: "",
        icon: null,
        classRestriction: null,
        configuration: {
          mode: "default",
          allowReplacements: false,
          grants,
          choices: []
        },
        value: { chosen: [] }
      });
    }

    // 0d. Weapon proficiencies (level 1)
    if (config.weapons?.length) {
      const grants = config.weapons.map(w => `weapon:${w}`);
      advancement.push({
        _id: stableId(`adv:${c.name}:weapons`),
        type: "Trait",
        level: 1,
        title: "Competenze nelle Armi",
        hint: "",
        icon: null,
        classRestriction: null,
        configuration: {
          mode: "default",
          allowReplacements: false,
          grants,
          choices: []
        },
        value: { chosen: [] }
      });
    }

    // 0e. Skill proficiencies (level 1)
    if (config.skills) {
      const fixedGrants = (config.skills.fixed || []).map(s => `skills:${s}`);
      const choices = [];
      if (config.skills.count > 0) {
        choices.push({
          count: config.skills.count,
          pool: config.skills.pool.map(s => `skills:${s}`)
        });
      }
      advancement.push({
        _id: stableId(`adv:${c.name}:skills`),
        type: "Trait",
        level: 1,
        title: "Competenze nelle Abilità",
        hint: "",
        icon: null,
        classRestriction: null,
        configuration: {
          mode: "default",
          allowReplacements: false,
          grants: fixedGrants,
          choices
        },
        value: { chosen: [] }
      });
    }

    // 1. ItemGrant for features at each level
    for (const [level, featureNames] of Object.entries(config.featureLevels)) {
      if (level.startsWith("_")) continue; // Skip special keys like _pianoTattico
      const items = [];
      for (const fname of featureNames) {
        const feat = findClassFeature(features, fname, c.name);
        if (feat && feat._id) {
          items.push({ uuid: `Compendium.${MODULE_ID}.${PACK}.${feat._id}` });
          totalGranted++;
        } else {
          console.warn(`    ⚠ ${c.name} lv${level}: feature "${fname}" non trovata`);
          totalMissing++;
        }
      }
      if (items.length > 0) {
        advancement.push({
          _id: stableId(`adv:${c.name}:grant:${level}`),
          type: "ItemGrant",
          level: parseInt(level),
          title: "",
          hint: "",
          icon: null,
          classRestriction: null,
          configuration: { items, optional: false, spell: null },
          value: {}
        });
      }
    }

    // 2. ItemChoice for Piano Tattico (Mago Tattico special)
    const pianoTattico = config.featureLevels._pianoTattico;
    if (pianoTattico) {
      // Build pool of tactical plan UUIDs
      const pool = [];
      for (const planName of pianoTattico.pool) {
        const feat = findClassFeature(features, planName, c.name);
        if (feat && feat._id) {
          pool.push({ uuid: `Compendium.${MODULE_ID}.${PACK}.${feat._id}` });
        }
      }
      for (const level of pianoTattico.levels) {
        advancement.push({
          _id: stableId(`adv:${c.name}:piano-tattico:${level}`),
          type: "ItemChoice",
          level: level,
          title: pianoTattico.title,
          hint: pianoTattico.hint,
          icon: null,
          classRestriction: null,
          configuration: {
            choices: { [String(level)]: { count: 1, replacement: false } },
            allowDrops: false,
            type: "feat",
            pool: pool,
            restriction: {},
            spell: null
          },
          value: { added: {}, replaced: {} }
        });
      }
    }

    // 3. ASI: AbilityScoreImprovement + ItemGrant at each ASI level
    const asiFeature = features.find(
      f => f.name.toLowerCase().includes(config.asiFeatureKeyword.toLowerCase()) &&
      f.description.includes(`Classe: ${c.name}`)
    );

    for (const level of config.asiLevels) {
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
            items: [{ uuid: `Compendium.${MODULE_ID}.${PACK}.${asiFeature._id}` }],
            optional: false,
            spell: null
          },
          value: {}
        });
      }

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

    // Sort advancement by level
    advancement.sort((a, b) => a.level - b.level);

    // Spellcasting configuration
    // Mago di Strada uses Charisma fixed; all others choose between Int/Wis/Cha
    const spellAbility = c.name === "Mago di Strada" ? "cha" : "";

    c.system = {
      identifier: config.identifier,
      hitDice: config.hitDice,
      source: {
        custom: "",
        book: "Fairy Tail",
        page: "",
        license: "",
        rules: "2014"
      },
      spellcasting: {
        ability: spellAbility,
        progression: "full"
      },
      advancement: advancement
    };
  }

  // Write back
  fs.writeFileSync(classiPath, JSON.stringify(classi, null, 2), "utf-8");
  console.log(`  ✓ classi.json: enriched ${classi.length} classes (${totalGranted} features granted, ${totalMissing} missing)`);
  fs.writeFileSync(featPath, JSON.stringify(features, null, 2), "utf-8");
  console.log(`  ✓ feature-classi.json: enriched ${features.length} items with metadata`);
}

// ── ENRICHMENT: Magie + Feature Magie ─────────────────────────────────────

/**
 * Parse the level from a feature name.
 * Handles patterns: "liv.X", "Lv.X", "lv.X", "Liv.X", "LV.X" anywhere in the name.
 * Returns the level number, or 1 as default for features with no explicit level.
 */
function parseLevelFromName(name) {
  // Match patterns like "liv.3", "Lv.6", "lv.10", "Liv.1"
  const match = name.match(/[Ll][Ii]?[Vv]\.?\s*(\d+)/);
  if (match) return parseInt(match[1]);
  // Also try "livello X" or "livello: X"
  const match2 = name.match(/livello[:\s]+(\d+)/i);
  if (match2) return parseInt(match2[1]);
  return 1; // Default: level 1 feature
}

// ── Italian Mechanics Parser ─────────────────────────────────────────────

/**
 * Parse Italian descriptions and extract mechanical data for dnd5e items.
 * Returns an object with activation, mpCost, damage, save, actionType, range, target.
 */
function parseItalianMechanics(desc) {
  const result = {
    activation: { type: null, cost: 1 },
    mpCost: null,
    damage: null,
    save: { ability: null, scaling: "spell" },
    actionType: null,
    range: null,
    target: null
  };

  if (!desc) return result;

  // ── Activation ──
  if (/come reazione/i.test(desc)) {
    result.activation.type = "reaction";
  } else if (/(?:come )?azione bonus/i.test(desc)) {
    result.activation.type = "bonus";
  } else if (/come (?:un[''']?)?azione/i.test(desc)) {
    result.activation.type = "action";
  }

  // ── MP Cost ──
  const mpPatterns = [
    /[Cc]osto di mana:\s*::?\s*(\d+)\s*(?:MP|PM)/i,
    /spend(?:i|ere)\s+(\d+)\s+punti mana/i,
    /(\d+)\s*(?:PM|MP)/i,
    /(\d+)\s+punti mana/i,
    /(\d+)\s+[Mm]ana/i
  ];
  for (const pat of mpPatterns) {
    const m = desc.match(pat);
    if (m) { result.mpCost = parseInt(m[1]); break; }
  }

  // ── Damage ──
  const damageTypeMap = {
    fuoco: "fire", fulmine: "lightning", freddo: "cold",
    necrotici: "necrotic", necrotico: "necrotic",
    radiosi: "radiant", radioso: "radiant",
    contundenti: "bludgeoning", contundente: "bludgeoning",
    perforanti: "piercing", perforante: "piercing",
    taglienti: "slashing", tagliente: "slashing",
    forza: "force",
    psichici: "psychic", psichico: "psychic",
    veleno: "poison",
    tuono: "thunder",
    acido: "acid"
  };
  const dmgTypeKeys = Object.keys(damageTypeMap).join("|");
  const dmgRegex = new RegExp(`(\\d+d\\d+(?:\\s*\\+\\s*\\d+)?)\\s+(?:danni\\s+(?:da\\s+)?)?(?:di\\s+)?(${dmgTypeKeys})`, "gi");
  const parts = [];
  let dmgMatch;
  while ((dmgMatch = dmgRegex.exec(desc)) !== null) {
    const formula = dmgMatch[1].replace(/\s+/g, "");
    const itType = dmgMatch[2].toLowerCase();
    const enType = damageTypeMap[itType] || "";
    parts.push([formula, enType]);
  }
  // Also try pattern: XdY danni (without type)
  if (!parts.length) {
    const simpleDmg = desc.match(/(\d+d\d+(?:\s*\+\s*\d+)?)\s+danni/i);
    if (simpleDmg) {
      parts.push([simpleDmg[1].replace(/\s+/g, ""), ""]);
    }
  }
  if (parts.length) {
    result.damage = { parts };
  }

  // ── Save ──
  const saveMap = {
    "destrezza": "dex", "forza": "str", "costituzione": "con",
    "intelligenza": "int", "saggezza": "wis", "carisma": "cha"
  };
  const saveMatch = desc.match(/(?:tiro salvezza|TS)\s+su\s+(Destrezza|Forza|Costituzione|Intelligenza|Saggezza|Carisma)/i);
  if (saveMatch) {
    result.save.ability = saveMap[saveMatch[1].toLowerCase()] || null;
  }

  // ── Action Type ──
  if (/attacco con incantesimo a distanza|tiro per colpire con incantesimo a distanza/i.test(desc)) {
    result.actionType = "rsak";
  } else if (/attacco con incantesimo in mischia|tiro per colpire con incantesimo/i.test(desc)) {
    result.actionType = "msak";
  } else if (result.save.ability) {
    result.actionType = "save";
  } else if (/recupera|guarisci|cura/i.test(desc)) {
    result.actionType = "heal";
  } else if (result.damage) {
    result.actionType = "util";
  } else {
    result.actionType = "util";
  }

  // ── Range ──
  const rangeMatch = desc.match(/(?:entro|raggio di)\s+(\d+(?:[,]\d+)?)\s*metri/i);
  if (rangeMatch) {
    const val = parseFloat(rangeMatch[1].replace(",", "."));
    result.range = { value: val, units: "m" };
  }

  // ── Target ──
  const coneMatch = desc.match(/cono di\s+(\d+(?:[,]\d+)?)\s*metri/i);
  const sphereMatch = desc.match(/sfera di\s+(\d+(?:[,]\d+)?)\s*metri/i);
  const lineMatch = desc.match(/linea di\s+(\d+(?:[,]\d+)?)\s*metri/i);
  const cubeMatch = desc.match(/cubo di\s+(\d+(?:[,]\d+)?)\s*metri/i);

  if (coneMatch) {
    result.target = { value: parseFloat(coneMatch[1].replace(",", ".")), type: "cone", units: "m" };
  } else if (sphereMatch) {
    result.target = { value: parseFloat(sphereMatch[1].replace(",", ".")), type: "sphere", units: "m" };
  } else if (lineMatch) {
    result.target = { value: parseFloat(lineMatch[1].replace(",", ".")), type: "line", units: "m" };
  } else if (cubeMatch) {
    result.target = { value: parseFloat(cubeMatch[1].replace(",", ".")), type: "cube", units: "m" };
  } else if (/una creatura|bersaglio/i.test(desc)) {
    result.target = { value: 1, type: "creature", units: "" };
  }

  return result;
}

// ── ENRICHMENT: Incantesimi ───────────────────────────────────────────────

/** Post-process: enrich incantesimi with dnd5e mechanical data */
function enrichIncantesimi() {
  const spellPath = path.join(SRC_DIR, "incantesimi.json");
  const spells = JSON.parse(fs.readFileSync(spellPath, "utf-8"));

  for (const s of spells) {
    const meta = s._meta || {};
    s._id = stableId(`incantesimi:${s.name}`);

    const activation = parseActivation(meta.castTime);
    const range = parseRange(meta.range);
    const duration = parseDuration(meta.duration);
    const components = parseComponents(meta.components);

    s.system = {
      level: meta.level ?? 0,
      school: meta.school || "evo",
      source: {
        custom: "",
        book: "Fairy Tail",
        page: "",
        license: "",
        rules: "2014"
      },
      activation: {
        type: activation.type,
        cost: activation.cost,
        condition: ""
      },
      range: {
        value: range.value,
        units: range.units,
        special: ""
      },
      duration: {
        value: duration.value,
        units: duration.units,
        concentration: duration.concentration || false
      },
      components: {
        vocal: components.vocal,
        somatic: components.somatic,
        material: components.material,
        value: components.value,
        ritual: meta.ritual || false
      },
      materials: {
        value: components.value,
        consumed: false,
        cost: 0,
        supply: 0
      }
    };

    // Parse damage/save/actionType from description
    const desc = (s.description || "").replace(/<[^>]*>/g, "").replace(/\*\*/g, "").replace(/\*/g, "");
    const mechanics = parseItalianMechanics(desc);

    if (mechanics.damage) s.system.damage = mechanics.damage;
    if (mechanics.save?.ability) s.system.save = { ability: mechanics.save.ability, dc: null, scaling: "spell" };
    if (mechanics.actionType) s.system.actionType = mechanics.actionType;
    if (mechanics.target) s.system.target = { value: mechanics.target.value, type: mechanics.target.type, units: mechanics.target.units || "m" };
  }

  // Write back (keep _magia for enrichMagie to use, remove _meta)
  const output = spells.map(s => {
    const { _meta, ...rest } = s;
    return rest;
  });
  fs.writeFileSync(spellPath, JSON.stringify(output, null, 2), "utf-8");

  const cantrips = spells.filter(s => (s._meta?.level ?? 0) === 0).length;
  const leveled = spells.length - cantrips;
  console.log(`  ✓ incantesimi.json: enriched ${spells.length} spells (${cantrips} cantrips, ${leveled} leveled)`);

  // Return the enriched spells (with _magia) for enrichMagie to use
  return spells;
}

// ── ENRICHMENT: Magie + Feature Magie + Incantesimi ───────────────────────

/**
 * Spell level → class level mapping (full caster progression).
 * Used to determine at which subclass level each spell tier is granted.
 */
const SPELL_LEVEL_TO_CLASS_LEVEL = {
  0: 1,   // Cantrips at level 1
  1: 1,   // 1st level spells
  2: 3,   // 2nd level spells
  3: 5,   // 3rd
  4: 7,   // 4th
  5: 9,   // 5th
  6: 11,  // 6th
  7: 13,  // 7th
  8: 15,  // 8th
  9: 17   // 9th
};

/** Post-process: enrich magie and feature-magie with mechanical data + spells */
function enrichMagie(spells) {
  const magiePath = path.join(SRC_DIR, "magie.json");
  const featPath = path.join(SRC_DIR, "feature-magie.json");

  const magie = JSON.parse(fs.readFileSync(magiePath, "utf-8"));
  const features = JSON.parse(fs.readFileSync(featPath, "utf-8"));
  const FEAT_PACK = "ft5e-feature-magie";
  const SPELL_PACK = "ft5e-incantesimi";

  // Assign stable IDs and metadata to all magie features
  for (const f of features) {
    const mag = f.description.match(/Magia: ([^<]+)/)?.[1] || "";
    f._id = stableId(`feature-magie:${mag}:${f.name}`);

    const desc = (f.description || "").replace(/<[^>]*>/g, "").replace(/\*\*/g, "").replace(/\*/g, "");
    const mechanics = parseItalianMechanics(desc);

    f.system = {
      type: { value: "class", subtype: "" },
      requirements: mag,
      identifier: toKebab(f.name),
      source: { custom: "", book: "Fairy Tail", page: "", license: "", rules: "2014" }
    };

    // Apply parsed mechanics
    if (mechanics.activation?.type) {
      f.system.activation = mechanics.activation;
    }
    if (mechanics.damage) {
      f.system.damage = mechanics.damage;
      f.system.damage.versatile = "";
    }
    if (mechanics.save?.ability) {
      f.system.save = { ability: mechanics.save.ability, dc: null, scaling: "spell" };
    }
    if (mechanics.actionType) {
      f.system.actionType = mechanics.actionType;
    }
    if (mechanics.target) {
      f.system.target = { value: mechanics.target.value, type: mechanics.target.type, units: "m" };
    }
    if (mechanics.range) {
      f.system.range = { value: mechanics.range.value, long: null, units: mechanics.range.units || "m" };
    }
    if (mechanics.mpCost) {
      if (!f.flags) f.flags = {};
      f.flags["fairy-tail-5e"] = { mpCost: mechanics.mpCost };
    }
  }

  // Enrich magie (subclasses)
  let totalFeaturesGranted = 0;
  let totalSpellsGranted = 0;

  for (const m of magie) {
    m._id = stableId(`magie:${m.name}`);
    m.type = "subclass";

    // ── Features ──
    const magFeatures = features.filter(
      f => f.description.includes(`Magia: ${m.name}`)
    );
    const featByLevel = {};
    for (const f of magFeatures) {
      const level = parseLevelFromName(f.name);
      if (!featByLevel[level]) featByLevel[level] = [];
      featByLevel[level].push(f);
    }

    const advancement = [];

    // Feature ItemGrants
    for (const [level, feats] of Object.entries(featByLevel)) {
      const items = feats
        .filter(f => f._id)
        .map(f => ({ uuid: `Compendium.${MODULE_ID}.${FEAT_PACK}.${f._id}` }));
      if (items.length > 0) {
        advancement.push({
          _id: stableId(`adv:${m.name}:feat-grant:${level}`),
          type: "ItemGrant",
          level: parseInt(level),
          title: "",
          hint: "",
          icon: null,
          classRestriction: null,
          configuration: { items, optional: false, spell: null },
          value: {}
        });
        totalFeaturesGranted += items.length;
      }
    }

    // ── Spells ──
    const magSpells = spells.filter(s => s._magia === m.name);

    // Group spells by spell level, then map to class level
    const spellsByClassLevel = {};
    for (const s of magSpells) {
      const spellLvl = s._meta?.level ?? s.system?.level ?? 0;
      const classLvl = SPELL_LEVEL_TO_CLASS_LEVEL[spellLvl] ?? 1;
      if (!spellsByClassLevel[classLvl]) spellsByClassLevel[classLvl] = [];
      spellsByClassLevel[classLvl].push(s);
    }

    // Spell ItemGrants per class level
    for (const [classLevel, spellList] of Object.entries(spellsByClassLevel)) {
      const items = spellList
        .filter(s => s._id)
        .map(s => ({ uuid: `Compendium.${MODULE_ID}.${SPELL_PACK}.${s._id}` }));
      if (items.length > 0) {
        advancement.push({
          _id: stableId(`adv:${m.name}:spell-grant:${classLevel}`),
          type: "ItemGrant",
          level: parseInt(classLevel),
          title: "Incantesimi",
          hint: `Incantesimi della ${m.name} disponibili a questo livello.`,
          icon: null,
          classRestriction: null,
          configuration: { items, optional: true, spell: { ability: [], preparation: "", uses: { max: "", per: "" } } },
          value: {}
        });
        totalSpellsGranted += items.length;
      }
    }

    // Sort advancement by level
    advancement.sort((a, b) => a.level - b.level);

    m.system = {
      identifier: toKebab(m.name),
      classIdentifier: "",
      source: {
        custom: "",
        book: "Fairy Tail",
        page: "",
        license: "",
        rules: "2014"
      },
      advancement: advancement
    };
  }

  // Write back
  fs.writeFileSync(magiePath, JSON.stringify(magie, null, 2), "utf-8");
  console.log(`  ✓ magie.json: enriched ${magie.length} magie (${totalFeaturesGranted} features + ${totalSpellsGranted} spells granted)`);
  fs.writeFileSync(featPath, JSON.stringify(features, null, 2), "utf-8");
  console.log(`  ✓ feature-magie.json: enriched ${features.length} items with metadata`);
}

// ── ENRICHMENT: Background ────────────────────────────────────────────────

const BG_CONFIG = {
  "Background del mago della gilda": {
    skills: { choices: [{ count: 2, pool: ["skills:arc", "skills:his", "skills:ins", "skills:per", "skills:prf"] }] },
    toolProf: "Un tipo di strumenti da artigiano O un set da gioco",
    languages: 1
  },
  "Background del mago errante": {
    skills: { choices: [{ count: 2, pool: ["skills:arc", "skills:nat", "skills:sur", "skills:med", "skills:dec"] }] },
    toolProf: "Kit da erborista, uno strumento musicale",
    languages: 2
  },
  "Background dello studioso": {
    skills: { choices: [{ count: 2, pool: ["skills:arc", "skills:his", "skills:inv", "skills:rel", "skills:nat"] }] },
    toolProf: "Strumenti da calligrafo, un tipo di strumenti da artigiano",
    languages: 2
  },
  "Background del mago da combattimento": {
    skills: { choices: [{ count: 2, pool: ["skills:arc", "skills:ath", "skills:acr", "skills:itm", "skills:prc"] }] },
    toolProf: "Un set da gioco, veicoli (terra)",
    languages: 1
  },
  "Background del Mago Selvaggio": {
    skills: { choices: [{ count: 2, pool: ["skills:arc", "skills:nat", "skills:sur", "skills:med", "skills:ani"] }] },
    toolProf: "Kit da erborista, uno strumento musicale",
    languages: 1
  },
  "Background del Minatore di Lacrima": {
    skills: { choices: [{ count: 2, pool: ["skills:ath", "skills:prc", "skills:sur", "skills:inv", "skills:itm"] }] },
    toolProf: "Strumenti da fabbro, un set da gioco",
    languages: 1
  },
  "Background del Camminatore dello Specchio": {
    skills: { choices: [{ count: 2, pool: ["skills:arc", "skills:his", "skills:inv", "skills:nat", "skills:rel"] }] },
    toolProf: "Un tipo di strumenti da artigiano, strumenti da cartografo",
    languages: 1
  }
};

function enrichBackground() {
  const bgPath = path.join(SRC_DIR, "background.json");
  const bgs = JSON.parse(fs.readFileSync(bgPath, "utf-8"));

  for (const bg of bgs) {
    bg._id = stableId(`background:${bg.name}`);
    const config = BG_CONFIG[bg.name];
    const advancement = [];

    if (config) {
      // Trait advancement for skill choices
      advancement.push({
        _id: stableId(`adv:${bg.name}:skills`),
        type: "Trait",
        level: 0,
        title: "",
        hint: "",
        icon: null,
        classRestriction: null,
        configuration: {
          mode: "default",
          allowReplacements: false,
          grants: [],
          choices: config.skills.choices || []
        },
        value: { chosen: [] }
      });
    }

    bg.system = {
      identifier: toKebab(bg.name),
      source: {
        custom: "",
        book: "Fairy Tail",
        page: "",
        license: "",
        rules: "2014"
      },
      advancement: advancement
    };
  }

  fs.writeFileSync(bgPath, JSON.stringify(bgs, null, 2), "utf-8");
  console.log(`  ✓ background.json: enriched ${bgs.length} backgrounds with skill advancement`);
}

// ── ENRICHMENT: Talenti ───────────────────────────────────────────────────

/** Parse prerequisites from a talent description */
function parsePrerequisites(desc) {
  const match = desc.match(/\*\*Prerequisit[oi]?:\*\*\s*([^<]+)/i);
  if (!match) return "";
  return match[1].replace(/\*\*/g, "").replace(/<[^>]*>/g, "").trim();
}

/**
 * Talent automation map.
 * Each entry maps a talent name to its mechanical effects:
 *   asi       — AbilityScoreImprovement: { fixed: {dex:1}, points:0, cap:1 } or { fixed:{}, points:1, cap:1 } for player choice
 *   effects   — Active Effects array: [{ key, mode, value }]
 *   mana      — flat mana bonus (handled by mana-points.mjs at runtime)
 *   manaProf  — add proficiency bonus to mana (boolean)
 *   manaExceedFix — remove Exceed -1/level penalty (boolean)
 */
const TALENT_AUTOMATION = {
  // ═══════════════════════════════════════════════════════════
  //  GENERIC / MANA TALENTS
  // ═══════════════════════════════════════════════════════════
  "Serbatoio di Mana Naturale": {
    asi: { fixed: {}, points: 1, cap: 1 },
    manaProf: true
  },
  "Incantesimi Caratteristici (Modificato)": {
    mpCost: 2,
    narrative: true  // choose 2 spells with DM
  },
  "Efficienza del Mana": {
    // per-combat: free casts ≤prof cost, prof times. +temp MP on init — handled at runtime
  },
  "Ondata di Mana Berserk": {
    mpCost: 0,
    damage: { parts: [["1d6", ""]] },
    // on init with 0 MP: recover castMod. On spell dmg: spend MP for +1d6/MP — runtime
  },
  "Sensorialità Magica": {
    effects: [{ key: "system.attributes.init.bonus", mode: 2, value: "2" }]
  },
  "Lancio Migliorato (Modificato)": {
    activation: { type: "reaction", cost: 1, condition: "Quando lanci un incantesimo" }
  },
  "Protezione magica": {
    activation: { type: "reaction", cost: 1, condition: "Quando tu o un alleato entro 9m subite danni" },
    mpCost: 1,
    actionType: "util",
    target: { value: 1, type: "creature", units: "m" },
    range: { value: 9, units: "m" }
  },
  "Connessione eterea": {
    // passive: touch spells reach 6m, spend 2 MP for 12m
  },
  "Magia potenziata": {
    mpCost: 2,
    // spend 2 MP: +castMod to spell DC. spend 3 MP: maximize 1 die
  },
  "Infusione di mana": {
    mpCost: 2,
    damage: { parts: [["1d4", ""]] },
    save: { ability: "con", scaling: "spell" },
    actionType: "save"
  },
  "Arma di mana": {
    activation: { type: "bonus", cost: 1, condition: "" },
    actionType: "util",
    target: { value: null, type: "self", units: "" },
    range: { value: null, units: "self" }
  },
  "Lanciatore lontano": {
    asi: { fixed: {}, points: 1, cap: 1 }
    // passive: double spell range
  },
  "Forza di volontà": {
    activation: { type: "bonus", cost: 1, condition: "" }
    // charge combat actions, spend MP for extra dmg
  },
  "Mago pieno di risorse": {
    narrative: true  // choose 2 more signature spells
  },
  "Incantesimo della Gilda": {
    mpCost: 16,
    narrative: true  // create guild spell
  },
  "Relazioni di Mana": {
    asi: { fixed: {}, points: 1, cap: 1 },
    mana: 1,
    manaExceedFix: true
  },
  "Grande Magia": {
    mpCost: 10,
    narrative: true  // create unique spell
  },
  "Studente": {
    narrative: true  // learn spells via study
  },

  // ═══════════════════════════════════════════════════════════
  //  MAGIC CIRCLE TALENTS
  // ═══════════════════════════════════════════════════════════
  "Cerchio d'attacco magico": {
    activation: { type: "bonus", cost: 1, condition: "" },
    mpCost: 1,
    actionType: "util",
    target: { value: null, type: "self", units: "" },
    range: { value: null, units: "self" }
  },
  "Cerchi subdoli": {
    // passive: disguise magic circles (Deception check)
  },
  "Condotto del Mana": {
    asi: { fixed: {}, points: 1, cap: 1 },
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 2,
    actionType: "util",
    target: { value: 1, type: "creature", units: "m" },
    range: { value: 9, units: "m" }
  },
  "Cerchi magici stratificati": {
    mpCost: 2
    // extra bonus action for magic circles
  },
  "Ciclo di feedback arcano": {
    mpCost: 1
    // on spell dmg: +1 temp MP. On self dmg: +1d4 next spell
  },
  "Scultore di incantesimi": {
    asi: { fixed: {}, points: 1, cap: 1 },
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 1,
    actionType: "util"
  },
  "Antica affinità magica": {
    asi: { fixed: {}, points: 1, cap: 1 },
    mpCost: 2
    // learn 1 cantrip + 1 1st-level spell
  },

  // ═══════════════════════════════════════════════════════════
  //  AIR MAGIC (Magia dell'Aria)
  // ═══════════════════════════════════════════════════════════
  "Aria Concentrata": {
    activation: { type: "bonus", cost: 1, condition: "" },
    mpCost: 1,
    enhances: "Manipolazione Spazio Aereo"
  },
  "Sfera Soffocante": {
    enhances: "Aerial"
    // reduce radius, +damage
  },
  "Esplosione Concentrata": {
    mpCost: 1,
    damage: { parts: [["5d4", "force"]] },
    actionType: "rsak",
    enhances: "Zetsu"
  },
  "Sbarramento a Ricerca": {
    asi: { fixed: {}, points: 1, cap: 1 },
    enhances: "Aerial Shot"
  },
  "Forma Aerea Potenziata": {
    asi: { fixed: { dex: 1 }, points: 0, cap: 1 },
    enhances: "Forma Aerea"
  },
  "Ciclone Schiacciante": {
    enhances: "Aerial Phose"
    // radius 3m, stun on fail
  },
  "Risucchio di Mana": {
    damage: { parts: [["1d8", "necrotic"]] },
    actionType: "msak",
    enhances: "Metsu"
  },
  "Ascesa in volo": {
    activation: { type: "action", cost: 1, condition: "" },
    damage: { parts: [["2d8", ""]] },
    actionType: "msak",
    effects: [{ key: "system.attributes.movement.fly", mode: 2, value: "9" }]
  },
  "Soffocamento assoluto": {
    enhances: "Aria Assoluta"
    // +necrotic damage in domain
  },

  // ═══════════════════════════════════════════════════════════
  //  CARD MAGIC (Magia delle Carte)
  // ═══════════════════════════════════════════════════════════
  "Fortuna raddoppiata": {
    mana: 1,
    mpCost: 1
    // draw 2 cards choose 1
  },
  "Evocazione di carte": {
    asi: { fixed: {}, points: 1, cap: 1 },
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 1,
    actionType: "util"
  },
  "Finezza del bariere": {
    activation: { type: "bonus", cost: 1, condition: "" },
    actionType: "util"
  },
  "Maestro del mazzo": {
    activation: { type: "bonus", cost: 1, condition: "" }
    // cards 1-8 free. Bonus: 2 MP for card + spell combo
  },
  "Potenziamento delle carte": {
    mpCost: 1,
    enhances: "Card"
  },
  "Maestria a doppia carta": {
    activation: { type: "action", cost: 1, condition: "" },
    actionType: "util"
  },
  "Rinnovo dei Tarocchi": {
    uses: { max: "1", per: "lr" }
  },

  // ═══════════════════════════════════════════════════════════
  //  EARTH MAGIC (Magia della Terra)
  // ═══════════════════════════════════════════════════════════
  "Clone terrestre": {
    activation: { type: "reaction", cost: 1, condition: "Quando subisci un colpo" },
    mpCost: 2,
    actionType: "util"
  },
  "Evocatore della Terra": {
    // passive: earth summons +HP, +dmg, +prof to DC
  },
  "Baluardo di Pietra": {
    save: { ability: "str", scaling: "spell" },
    actionType: "save",
    enhances: "Baluardo Terrestre"
  },
  "Terra duratura": {
    // passive: earth effects duration doubled. 2 MP for permanent
  },
  "Pugno tettonico": {
    mpCost: 1,
    damage: { parts: [["20d12", "bludgeoning"]] },
    save: { ability: "str", scaling: "spell" },
    actionType: "save",
    enhances: "Schianto Tettonico"
  },
  "Arsenale dell'Alchimista": {
    activation: { type: "bonus", cost: 1, condition: "" },
    mpCost: 3,
    damage: { parts: [["4d6", "slashing"]] },
    save: { ability: "dex", scaling: "spell" },
    actionType: "save",
    target: { value: 1, type: "creature", units: "m" },
    range: { value: 9, units: "m" }
  },
  "Bastione della Terra": {
    // passive: summon CA +castMod/2, +temp HP = level
  },

  // ═══════════════════════════════════════════════════════════
  //  FIRE MAGIC (Magia del Fuoco)
  // ═══════════════════════════════════════════════════════════
  "Inferno furioso": {
    mpCost: 1,
    save: { ability: "dex", scaling: "spell" },
    actionType: "save",
    target: { value: 9, type: "cone", units: "m" },
    range: { value: null, units: "self" },
    enhances: "Emberstrike"
  },
  "Velocità sfolgorante": {
    // passive: fire speed bonus +3m per spell level
  },
  "Detonazione controllata": {
    mpCost: 1,
    enhances: "Scorching Burst"
  },
  "Alimentato dalla Fiamma": {
    enhances: "Searing Surge"
  },
  "Aura Ardente": {
    effects: [{ key: "system.traits.dr.value", mode: 2, value: "fire" }]
    // +castMod fire dmg to melee — runtime
  },
  "Carica dell'Inferno": {
    activation: { type: "bonus", cost: 1, condition: "" },
    actionType: "util",
    duration: { value: 1, units: "round" }
  },
  "Fiamma Eterna": {
    // passive: Furia della Fenice attacks -1 MP cost
  },
  "Fiamma dell'Annientamento": {
    mpCost: 5,
    damage: { parts: [["2d8", "fire"]] },
    save: { ability: "con", scaling: "spell" },
    actionType: "save",
    enhances: "Bagliore di Creazione"
  },

  // ═══════════════════════════════════════════════════════════
  //  GEAR MAGIC (Magia degli Ingranaggi)
  // ═══════════════════════════════════════════════════════════
  "Colpo d'ingranaggio": {
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 2,
    damage: { parts: [["2d8", "bludgeoning"]] },
    actionType: "rsak",
    target: { value: 1, type: "creature", units: "m" },
    range: { value: 18, units: "m" }
  },
  "Ingranaggio di potenziamento personale": {
    enhances: "Gear Boost"
  },
  "Risonanza degli ingranaggi": {
    mana: 1,
    mpCost: 1
    // gear effects have area
  },
  "Distribuzione strategica": {
    enhances: "Gear Field"
  },
  "Dono del Forgiaingranaggi": {
    // passive: Gear Self no longer requires bonus action maintenance
  },
  "Famiglia Fantasma": {
    enhances: "Marcia Fantasma"
  },
  "Maestria dell'equipaggiamento": {
    // passive: maintain 3 gear effects instead of 2
  },

  // ═══════════════════════════════════════════════════════════
  //  GUN MAGIC (Magia dei Proiettili)
  // ═══════════════════════════════════════════════════════════
  "Maestria dei Proiettili di Mana": {
    mpCost: 1
    // passive: create ammo bonus action, basic ammo free
  },
  "Tiratore di Mana": {
    activation: { type: "action", cost: 1, condition: "" }
    // passive: Mana Bullet free + bonus action reload
  },
  "Fusione Elementale": {
    asi: { fixed: { dex: 1 }, points: 0, cap: 1 },
    activation: { type: "action", cost: 1, condition: "" },
    actionType: "rsak"
  },
  "Inseguimento Infallibile": {
    mpCost: 2,
    enhances: "Tiro a Ricerca"
  },
  "Vortice Persistente": {
    damage: { parts: [["1d8", "bludgeoning"]] },
    save: { ability: "str", scaling: "spell" },
    actionType: "save",
    enhances: "Tiro Tornado"
  },
  "Arsenale Fantasma": {
    activation: { type: "bonus", cost: 1, condition: "" },
    mpCost: 1,
    actionType: "rwak"
  },
  "Esplosione a Doppia Canna": {
    mpCost: 3,
    enhances: "Wide Shot"
  },
  "Ordigni Esplosivi": {
    enhances: "Blast Bullet"
  },
  "Eruzione Solare": {
    damage: { parts: [["2d6", "radiant"]] },
    actionType: "rsak",
    enhances: "Sunlight Shot"
  },

  // ═══════════════════════════════════════════════════════════
  //  CELESTIAL MAGIC (Magia Celeste)
  // ═══════════════════════════════════════════════════════════
  "Fortuna Stellare": {
    mana: 1
    // enh: celestial fragments enhanced
  },
  "Maledizione Celeste": {
    mpCost: 1
    // passive: fragments apply curse on enemy
  },
  "Echi Celesti": {
    mpCost: 2,
    damage: { parts: [["4d6", "force"]] },
    save: { ability: "str", scaling: "spell" },
    actionType: "save"
  },
  "Favore Celeste": {
    mpCost: 1,
    enhances: "Collezione Celeste"
  },
  "Chiamata Meteora": {
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 5,
    damage: { parts: [["2d10", "bludgeoning"], ["2d10", "fire"]] },
    save: { ability: "dex", scaling: "spell" },
    actionType: "save",
    target: { value: 6, type: "sphere", units: "m" },
    range: { value: 90, units: "m" }
  },
  "Guida di Orione": {
    save: { ability: "con", scaling: "spell" },
    actionType: "save",
    enhances: "Orion"
  },
  "Cuore di Sema": {
    damage: { parts: [["6d10", "force"]] },
    save: { ability: "dex", scaling: "spell" },
    actionType: "save",
    enhances: "Sema"
  },
  "Abbraccio della gravità": {
    damage: { parts: [["2d6", "force"]] },
    save: { ability: "str", scaling: "spell" },
    actionType: "save",
    enhances: "Altairis"
  },
  "Carica del carro": {
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 6,
    damage: { parts: [["10d10", "force"]] },
    save: { ability: "str", scaling: "spell" },
    actionType: "save",
    enhances: "Grand Chariot"
  },
  "Lame persistenti": {
    duration: { value: 1, units: "minute" },
    enhances: "Jiu Leixing"
  },

  // ═══════════════════════════════════════════════════════════
  //  LIGHTNING MAGIC (Magia del Fulmine)
  // ═══════════════════════════════════════════════════════════
  "Presenza Elettrificata": {
    enhances: "Personal Cloud"
  },
  "Colpo Tonante": {
    mpCost: 1,
    damage: { parts: [["2d8", "lightning"]] },
    save: { ability: "dex", scaling: "spell" },
    actionType: "save",
    enhances: "Pugno del Fulmine"
  },
  "Arco Elettrizzante": {
    mpCost: 1,
    damage: { parts: [["2d8", "lightning"]] },
    save: { ability: "dex", scaling: "spell" },
    actionType: "save",
    enhances: "Raggio ad Arco"
  },
  "Riflessi Fulminei": {
    enhances: "Velocità del Fulmine"
  },
  "Fulmine Divisore": {
    mpCost: 2,
    damage: { parts: [["8d6", "lightning"]] },
    actionType: "msak",
    enhances: "Catena di Fulmini"
  },
  "Scarica statica": {
    mana: 2,
    save: { ability: "dex", scaling: "spell" },
    actionType: "save",
    enhances: "Armi Fulminanti"
  },
  "Furia di Thunderhead": {
    save: { ability: "dex", scaling: "spell" },
    actionType: "save",
    enhances: "Fulmine Vero"
  },
  "Dono del Fulmine": {
    enhances: "Corpo del Fulmine"
  },
  "Carapace Conduttivo": {
    damage: { parts: [["1d4", "lightning"]] },
    enhances: "Parafulmine"
  },
  "Slancio del Fulmine": {
    enhances: "Azione Impetuosa"
  },
  "Asta della Tempesta": {
    save: { ability: "str", scaling: "spell" },
    actionType: "save",
    enhances: "Flusso di Fulmine"
  },
  "Colpo del Tuono": {
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 4,
    damage: { parts: [["6d10", "lightning"]] },
    save: { ability: "dex", scaling: "spell" },
    actionType: "save",
    target: { value: 6, type: "sphere", units: "m" },
    range: { value: null, units: "self" }
  },
  "Passo del Tuono": {
    mana: 2,
    activation: { type: "reaction", cost: 1, condition: "Quando subisci danno" },
    damage: { parts: [["3d8", "lightning"]] },
    save: { ability: "dex", scaling: "spell" },
    actionType: "save"
  },

  // ═══════════════════════════════════════════════════════════
  //  CREATION MAGIC (Magia della Creazione)
  // ═══════════════════════════════════════════════════════════
  "Arsenale ampliato": {
    // passive: learn 2 extra base constructs
  },
  "Casting adattivo": {
    // passive: choose 2nd casting style
  },
  "Creazione armoniosa": {
    // passive: harmonize 2 casting styles
  },
  "Magia della Creazione reattiva": {
    activation: { type: "reaction", cost: 1, condition: "Quando attacchi o sei attaccato" },
    actionType: "util"
  },
  "Costrutto Distintivo": {
    // passive: chosen construct bonuses
  },
  "Artigiano degli Arcani": {
    // passive: create complex tools, imbue objects
  },
  "Duplice Creazione": {
    activation: { type: "reaction", cost: 1, condition: "" },
    mpCost: 2,
    actionType: "util"
  },
  "Impeto Elementale": {
    damage: { parts: [["4d6", ""]] },
    actionType: "msak"
  },
  "Divisione Elementale": {
    // passive: split construct damage between targets
  },
  "Sigillo Eterno": {
    activation: { type: "action", cost: 1, condition: "" },
    damage: { parts: [["10d10", ""]] },
    save: { ability: "str", scaling: "spell" },
    actionType: "save"
  },

  // ═══════════════════════════════════════════════════════════
  //  REQUIP / THE KNIGHT (Ri-equipaggiamento)
  // ═══════════════════════════════════════════════════════════
  "Valore del Cavaliere": {
    effects: [
      { key: "system.attributes.ac.bonus", mode: 2, value: "1" }
    ]
    // +1 AC from Armatura Cuore, +1 dmg from Arma Mente — dmg at runtime
  },
  "Arco Spezzante": {
    mpCost: 1,
    save: { ability: "dex", scaling: "spell" },
    actionType: "save",
    enhances: "Danza a Catena"
  },
  "Versatilità del Cambio Stock": {
    activation: { type: "bonus", cost: 1, condition: "" },
    damage: { parts: [["1d6", ""]] },
    actionType: "mwak"
  },
  "Cento Colpi, Mezza Precisione": {
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 2,
    actionType: "mwak"
    // 5 attacks with advantage
  },
  "Campione incrollabile": {
    asi: { fixed: { con: 1 }, points: 0, cap: 1 },
    enhances: "Armatura del Campione"
  },
  "Ira di Nakagami": {
    mpCost: 2,
    damage: { parts: [["3d10", ""]] },
    save: { ability: "dex", scaling: "spell" },
    actionType: "save",
    enhances: "Armatura Nakagami"
  },
  "Decreto del Re": {
    activation: { type: "bonus", cost: 1, condition: "" },
    mpCost: 2,
    save: { ability: "dex", scaling: "spell" },
    actionType: "save",
    enhances: "Spada del Re"
  },
  "Asso dell'Arsenale": {
    activation: { type: "reaction", cost: 1, condition: "Quando sei attaccato" },
    damage: { parts: [["1d6", ""]] },
    actionType: "mwak"
  },
  "Ascesa dell'Arsenale": {
    // passive: Armeria Infinita peak
  },

  // ═══════════════════════════════════════════════════════════
  //  SAND MAGIC (Magia della Sabbia)
  // ═══════════════════════════════════════════════════════════
  "Abbraccio della Tempesta di Sabbia": {
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 2,
    damage: { parts: [["2d8", "bludgeoning"]] },
    actionType: "msak"
  },
  "Scultore di Sabbia": {
    activation: { type: "reaction", cost: 1, condition: "Quando un alleato è attaccato" },
    mpCost: 2,
    actionType: "util"
  },
  "Miraggio del Deserto": {
    enhances: "Clone di Sabbia"
  },
  "Maelstrom Vorticoso": {
    save: { ability: "str", scaling: "spell" },
    actionType: "save",
    enhances: "Sand Buster"
  },
  "Tempesta di Sabbia Perforante": {
    damage: { parts: [["4d8", "piercing"]] },
    actionType: "msak",
    enhances: "Lancia di Sabbia"
  },
  "Titano della Sabbia": {
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 5,
    damage: { parts: [["1d10", "bludgeoning"]] },
    actionType: "util",
    duration: { value: 1, units: "minute" }
  },
  "Turbine del Deserto": {
    save: { ability: "dex", scaling: "spell" },
    actionType: "save",
    enhances: "Sand Buster Migliorato"
  },
  "Sbarramento della Tempesta di Sabbia": {
    mpCost: 1,
    enhances: "Raml Sayf"
  },
  "Catastrofe delle Sabbie Mobili": {
    damage: { parts: [["6d10", "bludgeoning"]] },
    save: { ability: "dex", scaling: "spell" },
    actionType: "save",
    enhances: "Esplosione di Sabbia"
  },
  "Avatar della Tempesta di Sabbia": {
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 10,
    damage: { parts: [["5d10", "bludgeoning"]] },
    save: { ability: "str", scaling: "spell" },
    actionType: "save",
    duration: { value: 1, units: "minute" }
  },

  // ═══════════════════════════════════════════════════════════
  //  SOLID SCRIPT (Scrittura Solida)
  // ═══════════════════════════════════════════════════════════
  "Padronanza linguistica": {
    mpCost: 1,
    effects: [{ key: "system.skills.arc.value", mode: 4, value: "1" }]
    // Arcana proficiency/expertise. Extended cast duration 1 MP
  },
  "Kanji istantaneo": {
    mpCost: 2,
    actionType: "msak",
    enhances: "Orient Solid Script"
  },
  "Precisione del Wordsmith": {
    effects: [{ key: "system.bonuses.spell.dc", mode: 2, value: "1" }]
    // +1 spell DC. Reroll 1s on damage
  },
  "Cascata Kanji": {
    mpCost: 2,
    enhances: "Fioritura del Maestro"
  },
  "Esperto del Solid Script": {
    asi: { fixed: {}, points: 1, cap: 1 },
    activation: { type: "reaction", cost: 1, condition: "" },
    mpCost: 1,
    actionType: "util"
  },
  "Parole runiche": {
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 2,
    actionType: "util",
    duration: { value: 10, units: "minute" }
  },
  "Parole veloci": {
    activation: { type: "bonus", cost: 1, condition: "" }
    // passive: words ≤2 MP as bonus action
  },
  "Scrittura silenziosa": {
    // passive: cast without verbal components
  },
  "Dominio del Master": {
    activation: { type: "bonus", cost: 1, condition: "" },
    enhances: "Dominio Kanji"
  },

  // ═══════════════════════════════════════════════════════════
  //  TAKE OVER (Possessione)
  // ═══════════════════════════════════════════════════════════
  "Forma Feroce": {
    asi: { fixed: { con: 1 }, points: 0, cap: 1 }
    // Form AC +1, reduced revert cost
  },
  "Trasformazione sfrenata": {
    save: { ability: "wis", scaling: "spell" },
    actionType: "save"
    // passive: wild power with risk (WIS save to control)
  },
  "Infusione dell'Anima": {
    save: { ability: "wis", scaling: "spell" },
    actionType: "save"
    // after defeating creature: WIS save to capture essence
  },
  "Spirito Indomito": {
    mpCost: 4
    // passive: double wild adaptation + 4 MP burst
  },
  "Cambio Reattivo": {
    activation: { type: "reaction", cost: 1, condition: "Quando sei bersaglio di un attacco" },
    actionType: "util"
  },
  "Vero Adattamento": {
    mpCost: 2
    // passive: 2 MP manifest 2 partial transforms
  },
  "Anima Espansa": {
    // passive: choose 2nd beast soul creature
  },
  "Potenza Unificata": {
    enhances: "Fusione Primordiale"
  },
  "Evoluzione Scatenata": {
    // passive: extra abilities from beast souls
  },
  "Pinnacolo dell'Anima": {
    // passive: transcendent form, +2 stat, higher CR
  },

  // ═══════════════════════════════════════════════════════════
  //  WATER MAGIC (Magia dell'Acqua)
  // ═══════════════════════════════════════════════════════════
  "Armamento del Re": {
    activation: { type: "bonus", cost: 1, condition: "" },
    mpCost: 5,
    actionType: "util"
  },
  "Potenza acquatica": {
    activation: { type: "bonus", cost: 1, condition: "" },
    mpCost: 1,
    damage: { parts: [["1d6", ""]] },
    actionType: "util"
  },
  "Hydro Fist": {
    mpCost: 2,
    damage: { parts: [["1d6", "bludgeoning"]] },
    actionType: "msak",
    enhances: "Pugno d'Acqua"
  },
  "Adattamento acquatico": {
    activation: { type: "reaction", cost: 1, condition: "" },
    mpCost: 2,
    damage: { parts: [["2d8", "slashing"]] },
    actionType: "mwak"
  },
  "Controllo delle maree": {
    activation: { type: "bonus", cost: 1, condition: "" },
    mpCost: 2,
    enhances: "Ondata di Marea"
  },
  "Sosia acquatico": {
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 12,
    actionType: "util",
    duration: { value: 1, units: "hour" }
  },
  "Sbarramento di marea": {
    activation: { type: "action", cost: 1, condition: "" },
    damage: { parts: [["1d4", "force"]] },
    actionType: "msak"
  },
  "L'Abbraccio della Profondità": {
    damage: { parts: [["1d8", ""]] },
    save: { ability: "con", scaling: "spell" },
    actionType: "save",
    enhances: "Morte Abissale"
  },
  "Furia delle Maree": {
    activation: { type: "reaction", cost: 1, condition: "" },
    enhances: "Furia dell'Oceano"
  },
  "Dominio del Sovrano": {
    damage: { parts: [["4d6", "force"]] },
    save: { ability: "str", scaling: "spell" },
    actionType: "save",
    enhances: "Sovrano del Mare"
  },
  "La chiamata del Leviatano": {
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 5,
    damage: { parts: [["5d8", "bludgeoning"]] },
    save: { ability: "str", scaling: "spell" },
    actionType: "save",
    target: { value: 9, type: "sphere", units: "m" },
    range: { value: 27, units: "m" }
  },

  // ═══════════════════════════════════════════════════════════
  //  PHYSICAL / COMBAT TALENTS
  // ═══════════════════════════════════════════════════════════
  "Riflessi potenziati": {
    asi: { fixed: { dex: 1 }, points: 0, cap: 1 },
    effects: [{ key: "system.attributes.ac.bonus", mode: 2, value: "1" }]
  },
  "Finezza acrobatica": {
    effects: [{ key: "system.attributes.ac.bonus", mode: 2, value: "1" }]
  },
  "Recupero corporeo": {
    activation: { type: "bonus", cost: 1, condition: "" },
    mpCost: 1,
    actionType: "heal",
    damage: { parts: [["1d10 + @abilities.con.mod", "healing"]] },
    uses: { max: "@abilities.con.mod", per: "lr" },
    target: { value: null, type: "self", units: "" },
    range: { value: null, units: "self" }
  },
  "Volontà di Ferro": {
    save: { ability: "con", scaling: "spell" },
    actionType: "save"
    // passive: advantage charm/fear, CON save concentration advantage
  },
  "Maestria nelle armi": {
    damage: { parts: [["1d10", ""]] },
    actionType: "mwak"
    // passive: +1 attack chosen weapon, opportunity attack
  },
  "Adattamento ambientale": {
    activation: { type: "bonus", cost: 1, condition: "" }
    // passive: ignore difficult terrain, climb/swim normal
  },
  "Combattente adattabile": {
    // passive: 2 skill profs, dodge as bonus
  },
  "Sangue di drago": {
    asi: { fixed: { con: 1 }, points: 0, cap: 1 },
    effects: [{ key: "system.traits.dr.value", mode: 2, value: "poison" }],
    uses: { max: "1", per: "sr" }  // 1/sr breath attack
  },
  "Durabilità migliorata": {
    effects: [
      { key: "system.traits.dr.value", mode: 2, value: "bludgeoning" },
      { key: "system.traits.dr.value", mode: 2, value: "piercing" },
      { key: "system.traits.dr.value", mode: 2, value: "slashing" }
    ]
  },
  "Durabilità avanzata": {
    // passive: immunity 1 phys type, temp HP on hit
  },
  "Attaccabrighe": {
    damage: { parts: [["1d4", "bludgeoning"]] },
    actionType: "mwak"
  },
  "Attaccabrighe: Maestria": {
    damage: { parts: [["1d8", "bludgeoning"]] },
    save: { ability: "str", scaling: "spell" },
    actionType: "mwak"
    // stunning strike (STR save), extra attack
  },
  "Sentinale a distanza": {
    asi: { fixed: { dex: 1 }, points: 0, cap: 1 }
    // 1 MP: -3m speed on ranged hit
  },
  "Arguto": {
    asi: { fixed: { int: 1 }, points: 0, cap: 1 }
    // Use INT for initiative. Bonus action plan
  },

  // ═══════════════════════════════════════════════════════════
  //  UTILITY / SPECIAL TALENTS
  // ═══════════════════════════════════════════════════════════
  "Comunicazione Telepatica": {
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 1,
    actionType: "util",
    target: { value: 1, type: "creature", units: "m" },
    range: { value: 18, units: "m" },
    duration: { value: 10, units: "minute" }
  },
  "Vera Telepatia": {
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 3,
    save: { ability: "wis", scaling: "spell" },
    actionType: "save",
    target: { value: 6, type: "creature", units: "m" },
    range: { value: 18, units: "m" }
  },
  "Coreografia magica": {
    activation: { type: "bonus", cost: 1, condition: "" },
    mpCost: 1,
    actionType: "util"
  },
  "Ballerina eterea": {
    activation: { type: "action", cost: 1, condition: "" },
    mpCost: 3,
    damage: { parts: [["1d6", "force"]] },
    actionType: "msak"
  },
  "Magia di appiattimento": {
    activation: { type: "bonus", cost: 1, condition: "" },
    mpCost: 1,
    actionType: "util"
  },
  "Magia del Portale": {
    activation: { type: "bonus", cost: 1, condition: "" },
    actionType: "util"
  }
};

function enrichTalenti() {
  const talPath = path.join(SRC_DIR, "talenti.json");
  const talenti = JSON.parse(fs.readFileSync(talPath, "utf-8"));

  let automatedCount = 0;

  for (const t of talenti) {
    t._id = stableId(`talenti:${t.name}`);
    const prereq = parsePrerequisites(t.description);

    t.system = {
      type: { value: "feat", subtype: "general" },
      requirements: prereq,
      identifier: toKebab(t.name),
      source: {
        custom: "",
        book: "Fairy Tail",
        page: "",
        license: "",
        rules: "2014"
      }
    };

    // Apply automation if defined for this talent
    const auto = TALENT_AUTOMATION[t.name];
    if (auto) {
      // Skip narrative-only talents (they keep default feat data)
      if (auto.narrative) {
        automatedCount++;
        continue;
      }
      automatedCount++;

      // AbilityScoreImprovement advancement
      if (auto.asi) {
        if (!t.system.advancement) t.system.advancement = [];
        t.system.advancement.push({
          _id: stableId(`adv:talenti:${t.name}:asi`),
          type: "AbilityScoreImprovement",
          level: 0,
          title: "",
          icon: null,
          classRestriction: null,
          configuration: {
            points: auto.asi.points ?? 0,
            fixed: auto.asi.fixed ?? {},
            cap: auto.asi.cap ?? 1
          },
          value: {
            type: "asi"
          }
        });
      }

      // Active Effects
      if (auto.effects && auto.effects.length > 0) {
        if (!t.effects) t.effects = [];
        t.effects.push({
          _id: stableId(`effect:talenti:${t.name}`),
          name: t.name,
          icon: t.img || "icons/svg/book.svg",
          origin: null,
          disabled: false,
          transfer: true,
          changes: auto.effects.map(e => ({
            key: e.key,
            mode: e.mode,
            value: String(e.value),
            priority: 20
          }))
        });
      }

      // Activation type (action, bonus, reaction)
      if (auto.activation) {
        t.system.activation = {
          type: auto.activation.type || "",
          cost: auto.activation.cost ?? 1,
          condition: auto.activation.condition || ""
        };
      }

      // Damage parts
      if (auto.damage) {
        t.system.damage = {
          parts: auto.damage.parts || [],
          versatile: ""
        };
      }

      // Save DC
      if (auto.save) {
        t.system.save = {
          ability: auto.save.ability || "",
          dc: null,
          scaling: auto.save.scaling || "spell"
        };
      }

      // Action type
      if (auto.actionType) {
        t.system.actionType = auto.actionType;
      }

      // Target
      if (auto.target) {
        t.system.target = {
          value: auto.target.value,
          type: auto.target.type || "",
          units: auto.target.units || ""
        };
      }

      // Range
      if (auto.range) {
        t.system.range = {
          value: auto.range.value,
          long: null,
          units: auto.range.units || ""
        };
      }

      // Duration
      if (auto.duration) {
        t.system.duration = {
          value: auto.duration.value,
          units: auto.duration.units || ""
        };
      }

      // Uses (limited uses per rest/combat)
      if (auto.uses) {
        t.system.uses = {
          value: null,
          max: auto.uses.max || "",
          per: auto.uses.per || ""
        };
      }

      // Flags for runtime systems (MP cost, enhancement linking)
      if (auto.mpCost || auto.enhances) {
        if (!t.flags) t.flags = {};
        t.flags["fairy-tail-5e"] = {};
        if (auto.mpCost) t.flags["fairy-tail-5e"].mpCost = auto.mpCost;
        if (auto.enhances) t.flags["fairy-tail-5e"].enhances = auto.enhances;
      }

      // Mana bonuses are handled at runtime by mana-points.mjs (hardcoded by talent name)
    }
  }

  const withPrereq = talenti.filter(t => t.system.requirements).length;
  fs.writeFileSync(talPath, JSON.stringify(talenti, null, 2), "utf-8");
  console.log(`  ✓ talenti.json: enriched ${talenti.length} talents (${withPrereq} with prerequisites, ${automatedCount} automated)`);
}

// ── ENRICHMENT: Equipaggiamento ───────────────────────────────────────────

const EQUIP_DATA = {
  // ── Armature ──
  "Armatura imbottita":          { armor: "light",  ac: 11, dexCap: null, str: 0,  stealth: true,  weight: 4,    cost: 500 },
  "Armatura di cuoio":           { armor: "light",  ac: 11, dexCap: null, str: 0,  stealth: false, weight: 5,    cost: 1000 },
  "Armatura di cuoio borchiato": { armor: "light",  ac: 12, dexCap: null, str: 0,  stealth: false, weight: 6.5,  cost: 4500 },
  "Armatura in pelle":           { armor: "medium", ac: 12, dexCap: 2,   str: 0,  stealth: false, weight: 6,    cost: 1000 },
  "Giaco di Maglia":             { armor: "medium", ac: 13, dexCap: 2,   str: 0,  stealth: false, weight: 10,   cost: 5000 },
  "Corazza di Scaglie":          { armor: "medium", ac: 14, dexCap: 2,   str: 0,  stealth: true,  weight: 22.5, cost: 5000 },
  "Corazza di Piastre":          { armor: "medium", ac: 14, dexCap: 2,   str: 0,  stealth: false, weight: 10,   cost: 4000 },
  "Mezza Armatura":              { armor: "medium", ac: 15, dexCap: 2,   str: 0,  stealth: true,  weight: 20,   cost: 7500 },
  "Corazza di Anelli":           { armor: "heavy",  ac: 14, dexCap: 0,   str: 0,  stealth: true,  weight: 20,   cost: 3000 },
  "Cotta di maglia":             { armor: "heavy",  ac: 16, dexCap: 0,   str: 13, stealth: true,  weight: 27.5, cost: 7500 },
  "Corazza a strisce":           { armor: "heavy",  ac: 17, dexCap: 0,   str: 15, stealth: true,  weight: 30,   cost: 20000 },
  "Armatura Completa":           { armor: "heavy",  ac: 18, dexCap: 0,   str: 15, stealth: true,  weight: 32.5, cost: 150000 },
  "Scudo":                       { armor: "shield", ac: 2,  dexCap: null,str: 0,  stealth: false, weight: 3,    cost: 1000 },
  // ── Armi da mischia semplici ──
  "Ascia":             { weapon: "simpleM", dmg: "1d6",  dmgType: "slashing",    props: ["lgt","thr"], range: [6,18],    weight: 1,   cost: 500 },
  "Bastone ferrato":   { weapon: "simpleM", dmg: "1d6",  dmgType: "bludgeoning", props: ["ver"],       range: null,      weight: 2,   cost: 200 },
  "Clava":             { weapon: "simpleM", dmg: "1d4",  dmgType: "bludgeoning", props: ["lgt"],       range: null,      weight: 1,   cost: 1000 },
  "Falcetto":          { weapon: "simpleM", dmg: "1d4",  dmgType: "slashing",    props: ["lgt"],       range: null,      weight: 1,   cost: 500 },
  "Giavellotto":       { weapon: "simpleM", dmg: "1d6",  dmgType: "piercing",    props: ["thr"],       range: [9,36],    weight: 1,   cost: 1500 },
  "Lancia":            { weapon: "simpleM", dmg: "1d6",  dmgType: "piercing",    props: ["thr","ver"], range: [6,18],    weight: 1.5, cost: 500 },
  "Martello leggero":  { weapon: "simpleM", dmg: "1d4",  dmgType: "bludgeoning", props: ["lgt","thr"], range: [6,18],    weight: 1,   cost: 1000 },
  "Mazza":             { weapon: "simpleM", dmg: "1d6",  dmgType: "bludgeoning", props: [],            range: null,      weight: 2,   cost: 1000 },
  "Pugnale":           { weapon: "simpleM", dmg: "1d4",  dmgType: "piercing",    props: ["fin","lgt","thr"], range: [6,18], weight: 0.5, cost: 1000 },
  // ── Armi marziali da mischia ──
  "Alabarda":          { weapon: "martialM", dmg: "1d10", dmgType: "slashing",    props: ["hvy","rch","two"], range: null, weight: 3,   cost: 2500 },
  "Ascia Bipenne":     { weapon: "martialM", dmg: "1d12", dmgType: "slashing",    props: ["hvy","two"],       range: null, weight: 3.5, cost: 2500 },
  "Ascia da battaglia": { weapon: "martialM", dmg: "1d8", dmgType: "slashing",    props: ["ver"],             range: null, weight: 2,   cost: 1000 },
  "Falcione":          { weapon: "martialM", dmg: "1d10", dmgType: "slashing",    props: ["hvy","rch","two"], range: null, weight: 3,   cost: 2000 },
  "Frusta":            { weapon: "martialM", dmg: "1d4",  dmgType: "slashing",    props: ["fin","rch"],       range: null, weight: 1.5, cost: 2000 },
  "Lancia da Cavaliere": { weapon: "martialM", dmg: "1d12", dmgType: "piercing",  props: ["rch"],             range: null, weight: 3,   cost: 1000 },
  "Maglio":            { weapon: "martialM", dmg: "2d6",  dmgType: "bludgeoning", props: ["hvy","two"],       range: null, weight: 5,   cost: 1000 },
  "Martello da guerra": { weapon: "martialM", dmg: "1d8", dmgType: "bludgeoning", props: ["ver"],             range: null, weight: 1,   cost: 1500 },
  "Mazzafrusto":       { weapon: "martialM", dmg: "1d8",  dmgType: "bludgeoning", props: [],                  range: null, weight: 1,   cost: 1000 },
  "Morning Star":      { weapon: "martialM", dmg: "1d8",  dmgType: "piercing",    props: [],                  range: null, weight: 2,   cost: 1500 },
  "Picca":             { weapon: "martialM", dmg: "1d10", dmgType: "piercing",    props: ["hvy","rch","two"], range: null, weight: 9,   cost: 500 },
  "Piccone da guerra": { weapon: "martialM", dmg: "1d8",  dmgType: "piercing",    props: [],                  range: null, weight: 1,   cost: 1500 },
  "Scimitarra":        { weapon: "martialM", dmg: "1d6",  dmgType: "slashing",    props: ["fin","lgt"],       range: null, weight: 1.5, cost: 2000 },
  "Spada corta":       { weapon: "martialM", dmg: "1d6",  dmgType: "piercing",    props: ["fin","lgt"],       range: null, weight: 1,   cost: 1500 },
  "Spada lunga":       { weapon: "martialM", dmg: "1d8",  dmgType: "slashing",    props: ["ver"],             range: null, weight: 1.5, cost: 1500 },
  "Spadone":           { weapon: "martialM", dmg: "2d6",  dmgType: "slashing",    props: ["hvy","two"],       range: null, weight: 3,   cost: 5000 },
  "Stocco":            { weapon: "martialM", dmg: "1d8",  dmgType: "piercing",    props: ["fin"],             range: null, weight: 1,   cost: 2500 },
  "Tridente":          { weapon: "martialM", dmg: "1d6",  dmgType: "piercing",    props: ["thr","ver"],       range: [6,18], weight: 2, cost: 5000 },
  // ── Armi a distanza semplici ──
  "Arco corto":        { weapon: "simpleR", dmg: "1d6",  dmgType: "piercing",    props: ["amm","two"],       range: [24,96],  weight: 1,  cost: 2500 },
  "Balestra leggera":  { weapon: "simpleR", dmg: "1d8",  dmgType: "piercing",    props: ["amm","lod","two"], range: [24,96],  weight: 2.5, cost: 2500 },
  "Dardo":             { weapon: "simpleR", dmg: "1d4",  dmgType: "piercing",    props: ["fin","thr"],       range: [6,18],   weight: 0.1, cost: 100 },
  "Fionda":            { weapon: "simpleR", dmg: "1d4",  dmgType: "bludgeoning", props: ["amm"],             range: [9,36],   weight: 0,   cost: 500 },
  // ── Armi marziali a distanza ──
  "Arco lungo":        { weapon: "martialR", dmg: "1d10", dmgType: "piercing",    props: ["amm","hvy","two"], range: [45,180], weight: 1, cost: 5000 },
  "Balestra a mano":   { weapon: "martialR", dmg: "1d6",  dmgType: "piercing",    props: ["amm","lgt","lod"], range: [9,36],   weight: 1.5, cost: 7500 },
  "Balestra pesante":  { weapon: "martialR", dmg: "1d10", dmgType: "piercing",    props: ["amm","hvy","lod","two"], range: [30,120], weight: 9, cost: 5000 },
  "Rete":              { weapon: "martialR", dmg: null,   dmgType: null,           props: ["thr"],             range: [1.5,4.5], weight: 1.5, cost: 100 },
  // ── Armi da fuoco semplici ──
  "Archibugio":        { weapon: "simpleR",  dmg: "2d6",  dmgType: "bludgeoning", props: ["amm","lod","fir","two"], range: [6,9],    weight: 5, cost: 5000 },
  "Pistola":           { weapon: "simpleR",  dmg: "1d8",  dmgType: "piercing",    props: ["amm","fir"],             range: [15,45],  weight: 1.5, cost: 2500 },
  "Rivoltella":        { weapon: "simpleR",  dmg: "1d10", dmgType: "piercing",    props: ["amm","fir"],             range: [12,36],  weight: 1.5, cost: 2500 },
  // ── Armi da fuoco marziali ──
  "DMR":                           { weapon: "martialR", dmg: "1d12", dmgType: "piercing", props: ["amm","hvy","fir","two"], range: [45,180],  weight: 2, cost: 10000 },
  "Fucile a canne mozze":          { weapon: "martialR", dmg: null,   dmgType: null,       props: ["amm","hvy","lod","fir","two"], range: [9,36], weight: 2, cost: 2500 },
  "Fucile a pompa":                { weapon: "martialR", dmg: null,   dmgType: null,       props: ["amm","hvy","lod","fir","two"], range: [9,36], weight: 2, cost: 5000 },
  "Fucile d'Assalto":              { weapon: "martialR", dmg: "2d4",  dmgType: "piercing", props: ["amm","fir","two"],             range: [27,60], weight: 2, cost: 7500 },
  "Fucile da cecchino Bolt Action": { weapon: "martialR", dmg: "2d6", dmgType: "piercing", props: ["amm","hvy","lod","fir","two"], range: [90,360], weight: 3, cost: 12500 },
  "Fucile da cecchino (semi)":     { weapon: "martialR", dmg: "2d6",  dmgType: "piercing", props: ["amm","hvy","fir","two"],       range: [90,360], weight: 2, cost: 15000 },
  "Fucile semi-automatico":        { weapon: "martialR", dmg: null,   dmgType: null,       props: ["amm","hvy","fir","two"],       range: [9,36],   weight: 2, cost: 10000 },
  "Mitraglietta":                  { weapon: "martialR", dmg: "1d8",  dmgType: "piercing", props: ["amm","fir"],                   range: [15,45],  weight: 2, cost: 5000 },
  // ── Munizioni ──
  "Cartuccia a palla":     { ammo: true, weight: 0.05, cost: 100 },
  "Cartuccia sfondaporte": { ammo: true, weight: 0.05, cost: 200 },
  "Pallini":               { ammo: true, weight: 0.05, cost: 100 },
  "Pallettoni":            { ammo: true, weight: 0.05, cost: 200 },
  "Respiro del Drago":     { ammo: true, weight: 0.05, cost: 300 },
};

function enrichEquipaggiamento() {
  const eqPath = path.join(SRC_DIR, "equipaggiamento.json");
  const items = JSON.parse(fs.readFileSync(eqPath, "utf-8"));

  let enriched = 0;
  for (const item of items) {
    item._id = stableId(`equipaggiamento:${item.name}`);
    const data = EQUIP_DATA[item.name];
    if (!data) {
      item.system = { source: { custom: "", book: "Fairy Tail" } };
      continue;
    }
    enriched++;

    if (data.armor) {
      item.system = {
        type: { value: data.armor === "shield" ? "shield" : data.armor, baseItem: "" },
        armor: {
          value: data.ac,
          dex: data.dexCap,
          magicalBonus: 0
        },
        strength: data.str || null,
        stealth: data.stealth || false,
        weight: { value: data.weight, units: "kg" },
        price: { value: data.cost, denomination: "" },
        source: { custom: "", book: "Fairy Tail" }
      };
    } else if (data.weapon) {
      const dmgParts = data.dmg ? data.dmg.match(/(\d+)d(\d+)/) : null;
      item.system = {
        type: { value: data.weapon, baseItem: "" },
        damage: {
          parts: data.dmg ? [[data.dmg, data.dmgType]] : [],
          versatile: data.props.includes("ver") ? data.dmg.replace(/d(\d+)/, (m,n) => `d${parseInt(n)+2}`) : ""
        },
        range: data.range ? { value: data.range[0], long: data.range[1], units: "m" } : { value: null, long: null, units: "m" },
        weight: { value: data.weight, units: "kg" },
        price: { value: data.cost, denomination: "" },
        properties: data.props,
        proficient: true,
        source: { custom: "", book: "Fairy Tail" }
      };
    } else if (data.ammo) {
      item.system = {
        type: { value: "ammo", baseItem: "" },
        weight: { value: data.weight, units: "kg" },
        price: { value: data.cost, denomination: "" },
        source: { custom: "", book: "Fairy Tail" }
      };
    }
  }

  fs.writeFileSync(eqPath, JSON.stringify(items, null, 2), "utf-8");
  console.log(`  ✓ equipaggiamento.json: enriched ${enriched}/${items.length} items with mechanical data`);
}

// ── ENRICHMENT: Stili di Combattimento ────────────────────────────────────

function enrichStiliCombattimento() {
  const stPath = path.join(SRC_DIR, "stili-combattimento.json");
  const stili = JSON.parse(fs.readFileSync(stPath, "utf-8"));

  for (const s of stili) {
    s._id = stableId(`stili:${s.name}`);
    s.system = {
      type: { value: "feat", subtype: "" },
      requirements: "",
      identifier: toKebab(s.name),
      source: {
        custom: "",
        book: "Fairy Tail",
        page: "",
        license: "",
        rules: "2014"
      }
    };
  }

  fs.writeFileSync(stPath, JSON.stringify(stili, null, 2), "utf-8");
  console.log(`  ✓ stili-combattimento.json: enriched ${stili.length} fighting styles`);
}

// ── Image Assignment ──────────────────────────────────────────────────────
const IMG_BASE = `modules/${MODULE_ID}/assets/images`;

const RACE_IMG = {
  "Umani": `${IMG_BASE}/razze/umani.webp`,
  "Exceed": `${IMG_BASE}/razze/exceed.webp`,
  "Ibrido Gatto": `${IMG_BASE}/razze/ibrido-gatto.webp`,
  "Ibrido Lucertola": `${IMG_BASE}/razze/ibrido-lucertola.webp`,
  "Ibrido Lupo": `${IMG_BASE}/razze/ibrido-lupo.webp`,
  "Ibrido Demone di Galuna": `${IMG_BASE}/razze/ibrido-demone-galuna.webp`,
  "Dragon Slayer": `${IMG_BASE}/razze/dragon-slayer.webp`,
  "Devil Slayer": `${IMG_BASE}/razze/devil-slayer.webp`,
};

const CLASS_IMG = {
  "Mago Combattente": `${IMG_BASE}/classi/mago-combattente.webp`,
  "Mago Difensore": `${IMG_BASE}/classi/mago-difensore.webp`,
  "Mago Furtivo": `${IMG_BASE}/classi/mago-furtivo.webp`,
  "Mago di Strada": `${IMG_BASE}/classi/mago-di-strada.webp`,
  "Mago di Supporto": `${IMG_BASE}/classi/mago-di-supporto.webp`,
  "Mago Tattico": `${IMG_BASE}/classi/mago-tattico.webp`,
  "Guerriero": `${IMG_BASE}/classi/guerriero.webp`,
};

const MAGIA_IMG = {
  "Magia dello Spazio Aereo": `${IMG_BASE}/magie/spazio-aereo.webp`,
  "Magia delle Carte": `${IMG_BASE}/magie/carte.webp`,
  "Magia della Terra": `${IMG_BASE}/magie/terra.webp`,
  "Magia del Fuoco": `${IMG_BASE}/magie/fuoco.webp`,
  "Magia degli Ingranaggi": `${IMG_BASE}/magie/ingranaggi.webp`,
  "Magia delle Armi da Fuoco": `${IMG_BASE}/magie/armi-da-fuoco.webp`,
  "Magia del Corpo Celeste": `${IMG_BASE}/magie/corpo-celeste.webp`,
  "Magia del Fulmine": `${IMG_BASE}/magie/fulmine.webp`,
  "Magia della Creazione": `${IMG_BASE}/magie/creazione.webp`,
  "Magia del Cambio Stock": `${IMG_BASE}/magie/cambio-stock.webp`,
  "Magia della Sabbia": `${IMG_BASE}/magie/sabbia.webp`,
  "Magia del Solid Script": `${IMG_BASE}/magie/solid-script.webp`,
  "Magia di Take Over": `${IMG_BASE}/magie/take-over.webp`,
  "Magia dell'Acqua": `${IMG_BASE}/magie/acqua.webp`,
};

const BG_IMG = {
  "Background del mago della gilda": `${IMG_BASE}/background/mago-gilda.webp`,
  "Background del mago errante": `${IMG_BASE}/background/mago-errante.webp`,
  "Background dello studioso": `${IMG_BASE}/background/studioso.webp`,
  "Background del mago da combattimento": `${IMG_BASE}/background/mago-combattimento.webp`,
  "Background del Mago Selvaggio": `${IMG_BASE}/background/mago-selvaggio.webp`,
  "Background del Minatore di Lacrima": `${IMG_BASE}/background/minatore-lacrima.webp`,
  "Background del Camminatore dello Specchio": `${IMG_BASE}/background/camminatore-specchio.webp`,
};

const STILE_IMG = {
  "Pugni Devastanti": `${IMG_BASE}/stili/pugni-devastanti.webp`,
  "Lama Infusa": `${IMG_BASE}/stili/lama-infusa.webp`,
  "Difensore Arcano": `${IMG_BASE}/stili/difensore-arcano.webp`,
  "Combattente Agile": `${IMG_BASE}/stili/combattente-agile.webp`,
  "Contrattaccante": `${IMG_BASE}/stili/contrattaccante.webp`,
  "Furia Marziale": `${IMG_BASE}/stili/furia-marziale.webp`,
  "Duellante": `${IMG_BASE}/stili/duellante.webp`,
  "Maestro d'Armi": `${IMG_BASE}/stili/maestro-armi.webp`,
  "Combattente a Due Armi": `${IMG_BASE}/stili/combattente-due-armi.webp`,
  "Spirito Combattivo": `${IMG_BASE}/stili/spirito-combattivo.webp`,
};

/** Map equipment type to image file */
function equipImg(item) {
  const t = item.system?.type?.value || "";
  const name = item.name.toLowerCase();
  // Armor types
  if (["light", "medium", "heavy"].includes(t))
    return `${IMG_BASE}/equipaggiamento/armatura.webp`;
  if (t === "shield" || name.includes("scudo"))
    return `${IMG_BASE}/equipaggiamento/scudo.webp`;
  // Ranged weapons
  if (t === "simpleR" || t === "martialR") {
    if (name.includes("arco")) return `${IMG_BASE}/equipaggiamento/arco.webp`;
    if (name.includes("balestra") || name.includes("fionda") || name.includes("dardo"))
      return `${IMG_BASE}/equipaggiamento/arco.webp`;
    // Firearms
    return `${IMG_BASE}/equipaggiamento/pistola.webp`;
  }
  // Ammo
  if (t === "ammo") return `${IMG_BASE}/equipaggiamento/lacrima.webp`;
  // Melee weapons
  if (name.includes("spada") || name.includes("spadone") || name.includes("stocco") || name.includes("scimitarra") || name.includes("falcione"))
    return `${IMG_BASE}/equipaggiamento/spada.webp`;
  if (name.includes("ascia") || name.includes("alabarda"))
    return `${IMG_BASE}/equipaggiamento/ascia.webp`;
  if (name.includes("lancia") || name.includes("picca") || name.includes("tridente") || name.includes("giavellotto"))
    return `${IMG_BASE}/equipaggiamento/lancia.webp`;
  if (name.includes("mazza") || name.includes("clava") || name.includes("maglio") || name.includes("martello") || name.includes("mazzafrusto") || name.includes("morning") || name.includes("piccone"))
    return `${IMG_BASE}/equipaggiamento/mazza.webp`;
  if (name.includes("pugnale") || name.includes("falcetto") || name.includes("frusta"))
    return `${IMG_BASE}/equipaggiamento/pugnale.webp`;
  if (name.includes("bastone"))
    return `${IMG_BASE}/equipaggiamento/bastone.webp`;
  return "icons/svg/item-bag.svg";
}

/** Assign images to all items in all source files */
function assignImages() {
  const files = [
    { file: "razze.json", getImg: item => RACE_IMG[item.name] },
    { file: "classi.json", getImg: item => CLASS_IMG[item.name] },
    { file: "magie.json", getImg: item => MAGIA_IMG[item.name] },
    { file: "background.json", getImg: item => BG_IMG[item.name] },
    { file: "stili-combattimento.json", getImg: item => STILE_IMG[item.name] },
    { file: "equipaggiamento.json", getImg: item => equipImg(item) },
    {
      file: "talenti.json",
      getImg: item => {
        // Try to match talent to a magic type based on description keywords
        const desc = (item.description || "").toLowerCase();
        const name = item.name.toLowerCase();
        const magiaKeywords = [
          [/spazio aereo|aereo|aria concentrata|sfera soffocante|sbarramento a ricerca|forma aerea|ciclone|risucchio di mana|ascesa in volo|soffocamento/i, "Magia dello Spazio Aereo"],
          [/carte|mazzo|tarocchi|bariere|doppia carta/i, "Magia delle Carte"],
          [/terra|pietra|tettonico|terrestre|clone terrestre|baluardo|alchimista|bastione/i, "Magia della Terra"],
          [/fuoco|fiamma|inferno|sfolgorante|detonazione|ardente|annientamento/i, "Magia del Fuoco"],
          [/ingranaggi?|forgiaingranaggi|distribuzione strategica/i, "Magia degli Ingranaggi"],
          [/armi da fuoco|proiettil|tiratore|doppia canna|ordigni|arsenale fantasma|inseguimento|vortice persistente|fusione elementale/i, "Magia delle Armi da Fuoco"],
          [/corpo celeste|celest|stell|solar|meteor|orione|sema|gravità|carro/i, "Magia del Corpo Celeste"],
          [/fulmine|tuon|elettr|scarica|thunderhead|conduttivo|tempesta|asta della tempesta/i, "Magia del Fulmine"],
          [/creazione|arsenale ampliato|casting adattivo|creazione armoniosa|artigiano|duplice|impeto elementale|divisione elementale|sigillo eterno/i, "Magia della Creazione"],
          [/cambio stock|cavaliere|spazzante|versatilità|cento colpi|incrollabile|nakagami|decreto del re|asso dell.arsenale|ascesa dell.arsenale/i, "Magia del Cambio Stock"],
          [/sabbia|deserto|maelstrom|tempesta di sabbia|titano|turbine|sabbie mobili|avatar/i, "Magia della Sabbia"],
          [/solid script|kanji|wordsmith|cascata|padronanza linguistica|parole runiche|parole veloci|scrittura silenziosa/i, "Magia del Solid Script"],
          [/take over|forma feroce|trasformazione|infusione dell.anima|spirito indomito|cambio reattivo|adattamento|anima espansa|potenza unificata|evoluzione|pinnacolo|dominio del master/i, "Magia di Take Over"],
          [/acqua|hydro|maree|acquatico|profondità|leviatano|sovrano/i, "Magia dell'Acqua"],
        ];
        const text = name + " " + desc;
        for (const [regex, magia] of magiaKeywords) {
          if (regex.test(text) && MAGIA_IMG[magia]) return MAGIA_IMG[magia];
        }
        return "icons/svg/book.svg";
      }
    },
    {
      file: "feature-razze.json",
      getImg: item => {
        const race = item.description?.match(/Razza: ([^<]+)/)?.[1]?.trim() || "";
        return RACE_IMG[race] || "icons/svg/item-bag.svg";
      }
    },
    {
      file: "feature-classi.json",
      getImg: item => {
        const cls = item.description?.match(/Classe: ([^<]+)/)?.[1]?.trim() || "";
        return CLASS_IMG[cls] || "icons/svg/item-bag.svg";
      }
    },
    {
      file: "feature-magie.json",
      getImg: item => {
        const magia = item.description?.match(/Magia: ([^<]+)/)?.[1]?.trim() || "";
        return MAGIA_IMG[magia] || "icons/svg/item-bag.svg";
      }
    },
    {
      file: "incantesimi.json",
      getImg: item => {
        const magia = item._magia || "";
        return MAGIA_IMG[magia] || "icons/svg/item-bag.svg";
      }
    },
  ];

  const FT_SOURCE = { custom: "", book: "Fairy Tail", page: "", license: "", rules: "2014" };

  let total = 0, assigned = 0;
  for (const { file, getImg } of files) {
    const filePath = path.join(SRC_DIR, file);
    if (!fs.existsSync(filePath)) continue;
    const items = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    for (const item of items) {
      total++;
      const img = getImg(item);
      if (img) {
        item.img = img;
        assigned++;
      }
      // Ensure source is set on all items
      if (!item.system) item.system = {};
      if (!item.system.source || item.system.source.custom !== "" || item.system.source.book !== "Fairy Tail") {
        item.system.source = { ...FT_SOURCE };
      }
    }
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf-8");
  }
  console.log(`  ✓ Images & source assigned: ${assigned}/${total} items`);
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
// Enrich talenti first so we have stable IDs and automation
enrichTalenti();

// Talent selection now uses Foundry's native feat browser (no pool restriction)
enrichRazze();
enrichClassi();
const enrichedSpells = enrichIncantesimi();
enrichMagie(enrichedSpells);
enrichBackground();
enrichEquipaggiamento();
enrichStiliCombattimento();

console.log("\nAssigning images...");
assignImages();

console.log("\nAll JSON files generated in src/");
