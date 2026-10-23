/**
 * Fairy Tail 5e — Mana Points System
 *
 * Replaces D&D 5e spell slots with a class-based Mana Point resource.
 * Each FT5e class has its own mana formula and spell-level progression.
 *
 * Mana cost per spell level is simply equal to the spell level (1 MP for 1st, 2 MP for 2nd, etc.).
 * All mana is recovered on a long rest.
 */

const MODULE_ID = "fairy-tail-5e";
const FLAG_MANA = "manaPoints";

/* -------------------------------------------------- */
/*  Class Mana Configuration                          */
/* -------------------------------------------------- */

/**
 * Each class entry defines:
 *   formula   — how max MP is computed
 *              "2xLvl+Mod"  → Level × 2 + Casting Modifier
 *              "Lvl+Mod"    → Level + Casting Modifier
 *              "Lvl"        → Level only
 *              "Lvl+Mod+Prof" → Level + Casting Modifier + Proficiency Bonus
 *   ability   — the spellcasting ability key (str/dex/con/int/wis/cha)
 *   maxSpellLevel — array of [classLevel, spellLevel] thresholds
 */
const CLASS_CONFIG = {
  "mago-combattente": {
    formula: "2xLvl+Mod",
    ability: null, // chosen by player — uses class spellcasting ability
    maxSpellLevel: [[1,1],[3,2],[5,3],[7,4],[9,5],[11,6],[13,7],[15,8],[17,9]]
  },
  "mago-tattico": {
    formula: "2xLvl+Mod",
    ability: null,
    maxSpellLevel: [[1,1],[3,2],[5,3],[7,4],[9,5],[11,6],[13,7],[15,8],[17,9]]
  },
  "guerriero": {
    formula: "2xLvl+Mod",
    ability: null,
    maxSpellLevel: [[1,0],[3,1],[7,2],[9,3],[13,4],[17,5]]
  },
  "mago-difensore": {
    formula: "Lvl",
    ability: null,
    maxSpellLevel: [[1,0],[3,1],[7,2],[9,3],[13,4],[17,5]]
  },
  "mago-furtivo": {
    formula: "Lvl",
    ability: null,
    maxSpellLevel: [[1,0],[3,1],[7,2],[9,3],[13,4],[17,5]]
  },
  "mago-di-strada": {
    formula: "Lvl+Mod+Prof",
    ability: "cha",
    maxSpellLevel: [[1,0],[2,1],[4,2],[8,3],[10,4],[12,5],[14,6],[16,7]]
  },
  "mago-di-supporto": {
    formula: "Lvl+Mod",
    ability: null,
    maxSpellLevel: [[1,1],[3,2],[5,3],[7,4],[9,5],[11,6],[13,7],[16,8]]
  }
};

/* -------------------------------------------------- */
/*  Helpers                                           */
/* -------------------------------------------------- */

/**
 * Retrieve the module setting for mana-points enabled.
 */
function isEnabled() {
  try {
    return game.settings.get(MODULE_ID, "manaPointsEnabled");
  } catch {
    return false;
  }
}

/**
 * Given an actor, find every FT5e class item it owns and return
 * an array of { classItem, identifier, level, config }.
 */
function getActorFT5eClasses(actor) {
  if (!actor || actor.type !== "character") return [];
  const results = [];
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const id = item.system?.identifier;
    if (id && CLASS_CONFIG[id]) {
      results.push({
        classItem: item,
        identifier: id,
        level: item.system.levels ?? 0,
        config: CLASS_CONFIG[id]
      });
    }
  }
  return results;
}

/**
 * Calculate max mana points for an actor based on its FT5e classes.
 */
function calcMaxMana(actor) {
  const classes = getActorFT5eClasses(actor);
  if (!classes.length) return 0;

  let total = 0;
  for (const { classItem, level, config } of classes) {
    let mp = 0;
    const mod = _getCastingMod(actor, classItem, config);
    const prof = actor.system?.attributes?.prof ?? 0;

    switch (config.formula) {
      case "2xLvl+Mod":
        mp = level * 2 + mod;
        break;
      case "Lvl+Mod":
        mp = level + mod;
        break;
      case "Lvl":
        mp = level;
        break;
      case "Lvl+Mod+Prof":
        mp = level + mod + prof;
        break;
    }
    total += Math.max(0, mp);
  }

  // Apply race-based mana bonuses/penalties
  total += _getRaceManaBonus(actor);

  return Math.max(0, total);
}

/**
 * Calculate mana bonus/penalty from race features and talents.
 *
 * Race features:
 * - Umani "Controllo magico": +2 MP, +2 extra at lv8, +2 extra at lv16
 * - Exceed "Riserva di mana": -1 MP per character level
 *
 * Talents (flat mana bonuses):
 * - Serbatoio di Mana Naturale: +proficiency bonus to max mana
 * - Relazioni di Mana: +1 MP + removes Exceed -1/level penalty
 * - Fortuna raddoppiata: +1 MP
 * - Risonanza degli ingranaggi: +1 MP
 * - Fortuna Stellare: +1 MP
 * - Scarica statica: +2 MP
 * - Passo del Tuono: +2 MP
 */
function _getRaceManaBonus(actor) {
  if (!actor) return 0;
  let bonus = 0;

  const totalLevel = actor.system?.details?.level ?? 0;
  const prof = actor.system?.attributes?.prof ?? 0;

  let hasExceedPenalty = false;
  let hasExceedFix = false;

  for (const item of actor.items) {
    if (item.type !== "feat") continue;
    const name = item.name?.toLowerCase() || "";

    // ── Race features ──────────────────────────────
    // Umani: Controllo magico
    if (name.includes("controllo magico")) {
      bonus += 2;
      if (totalLevel >= 8) bonus += 2;
      if (totalLevel >= 16) bonus += 2;
    }

    // Exceed: Riserva di mana
    if (name.includes("riserva di mana") && !name.includes("serbatoio")) {
      hasExceedPenalty = true;
    }

    // ── Talent mana bonuses (hardcoded) ────────────
    // Serbatoio di Mana Naturale: +proficiency bonus to max mana
    if (name.includes("serbatoio di mana naturale")) {
      bonus += prof;
    }

    // Relazioni di Mana: +1 MP + cancels Exceed penalty
    if (name.includes("relazioni di mana")) {
      bonus += 1;
      hasExceedFix = true;
    }

    // Fortuna raddoppiata: +1 MP
    if (name.includes("fortuna raddoppiata")) {
      bonus += 1;
    }

    // Risonanza degli ingranaggi: +1 MP
    if (name.includes("risonanza degli ingranaggi")) {
      bonus += 1;
    }

    // Fortuna Stellare: +1 MP
    if (name.includes("fortuna stellare")) {
      bonus += 1;
    }

    // Scarica statica: +2 MP
    if (name.includes("scarica statica")) {
      bonus += 2;
    }

    // Passo del Tuono: +2 MP
    if (name.includes("passo del tuono")) {
      bonus += 2;
    }
  }

  // Apply Exceed penalty only if not fixed by Relazioni di Mana
  if (hasExceedPenalty && !hasExceedFix) {
    bonus -= totalLevel;
  }

  return bonus;
}

/**
 * Get the highest spell level available to the actor across all its FT5e classes.
 */
function getMaxSpellLevel(actor) {
  const classes = getActorFT5eClasses(actor);
  let highest = 0;
  for (const { level, config } of classes) {
    for (const [classLvl, spellLvl] of config.maxSpellLevel) {
      if (level >= classLvl && spellLvl > highest) {
        highest = spellLvl;
      }
    }
  }
  return highest;
}

/**
 * Resolve the casting modifier for a class.
 */
function _getCastingMod(actor, classItem, config) {
  // If the config specifies a fixed ability, use that
  if (config.ability) {
    return actor.system?.abilities?.[config.ability]?.mod ?? 0;
  }
  // Otherwise look at the class's spellcasting ability
  const spellAbility = classItem.system?.spellcasting?.ability || classItem.spellcasting?.ability;
  if (spellAbility) {
    return actor.system?.abilities?.[spellAbility]?.mod ?? 0;
  }
  // Fallback: use the actor's global spellcasting ability
  const globalAbility = actor.system?.attributes?.spellcasting;
  if (globalAbility) {
    return actor.system?.abilities?.[globalAbility]?.mod ?? 0;
  }
  return 0;
}

/**
 * Get the mana data stored in actor flags.
 */
function getManaData(actor) {
  const data = actor.getFlag(MODULE_ID, FLAG_MANA);
  const max = calcMaxMana(actor);
  if (!data) {
    return { value: max, max, override: null };
  }
  return {
    value: Math.min(data.value ?? max, data.override ?? max),
    max: data.override ?? max,
    override: data.override ?? null
  };
}

/**
 * Update the mana value on an actor.
 */
async function setManaValue(actor, value) {
  const { max } = getManaData(actor);
  const clamped = Math.clamp(value, 0, max);
  await actor.setFlag(MODULE_ID, FLAG_MANA, {
    ...actor.getFlag(MODULE_ID, FLAG_MANA),
    value: clamped
  });
}

/**
 * Set a manual max-mana override (null to remove).
 */
async function setManaOverride(actor, override) {
  const current = actor.getFlag(MODULE_ID, FLAG_MANA) || {};
  await actor.setFlag(MODULE_ID, FLAG_MANA, {
    ...current,
    override: override
  });
}

/* -------------------------------------------------- */
/*  Spellcasting Ability Choice Dialog                */
/* -------------------------------------------------- */

/**
 * Prompt the player to choose a spellcasting ability for a FT5e class.
 * Opens a dialog with Int / Wis / Cha options.
 */
async function promptSpellcastingAbility(classItem) {
  const className = classItem.name;
  const abilities = {
    int: CONFIG.DND5E?.abilities?.int?.label ?? "Intelligenza",
    wis: CONFIG.DND5E?.abilities?.wis?.label ?? "Saggezza",
    cha: CONFIG.DND5E?.abilities?.cha?.label ?? "Carisma"
  };

  const content = `
    <p>Scegli la <strong>Caratteristica da Incantatore</strong> per <strong>${className}</strong>:</p>
    <p><em>Questa determina il modificatore usato per i tiri per colpire e la CD degli incantesimi.</em></p>
    <div style="display:flex; flex-direction:column; gap:4px; margin-top:8px;">
      <label><input type="radio" name="ft5e-spell-ability" value="int" checked> ${abilities.int}</label>
      <label><input type="radio" name="ft5e-spell-ability" value="wis"> ${abilities.wis}</label>
      <label><input type="radio" name="ft5e-spell-ability" value="cha"> ${abilities.cha}</label>
    </div>`;

  return new Promise((resolve) => {
    new Dialog({
      title: `${className} — Caratteristica da Incantatore`,
      content,
      buttons: {
        ok: {
          label: "Conferma",
          icon: '<i class="fas fa-check"></i>',
          callback: async (html) => {
            const chosen = html.find('input[name="ft5e-spell-ability"]:checked').val();
            if (chosen) {
              await classItem.update({ "system.spellcasting.ability": chosen });
            }
            resolve(chosen);
          }
        }
      },
      default: "ok",
      close: () => resolve(null)
    }, { width: 340 }).render(true);
  });
}

/**
 * Prompt the player to choose a Magia (subclass) for their FT5e class.
 */
async function promptMagiaSelection(classItem, actor) {
  const className = classItem.name;
  const classIdentifier = classItem.system?.identifier;

  // Fetch all magie from the compendium
  const pack = game.packs.get("fairy-tail-5e.ft5e-magie");
  if (!pack) {
    console.warn("Fairy Tail 5e | Magie compendium not found");
    return;
  }

  const index = await pack.getIndex();
  const magieList = Array.from(index.values());

  if (!magieList.length) return;

  // Build radio buttons for each magia
  const options = magieList.map((m, i) => {
    const checked = i === 0 ? "checked" : "";
    return `<label style="display:block; padding:4px 0;"><input type="radio" name="ft5e-magia" value="${m._id}" ${checked}> ${m.name}</label>`;
  }).join("");

  const content = `
    <p>Scegli la <strong>Magia</strong> per <strong>${className}</strong>:</p>
    <p><em>La Magia determina i tuoi incantesimi e le tue abilit\u00e0 magiche uniche.</em></p>
    <div style="max-height:300px; overflow-y:auto; margin-top:8px; padding:4px;">
      ${options}
    </div>`;

  return new Promise((resolve) => {
    new Dialog({
      title: `${className} \u2014 Scegli la tua Magia`,
      content,
      buttons: {
        ok: {
          label: "Conferma",
          icon: '<i class="fas fa-check"></i>',
          callback: async (html) => {
            const chosenId = html.find('input[name="ft5e-magia"]:checked').val();
            if (!chosenId) { resolve(null); return; }

            try {
              // Fetch the full magia document from compendium
              const magiaDoc = await pack.getDocument(chosenId);
              if (!magiaDoc) { resolve(null); return; }

              // Create item data, overriding classIdentifier to match this class
              const magiaData = magiaDoc.toObject();
              magiaData.system.classIdentifier = classIdentifier;

              // Remove _id so FoundryVTT generates a new one
              delete magiaData._id;

              // Add to actor — use AdvancementManager if item has advancements
              const AdvManager = dnd5e.applications.advancement?.AdvancementManager;
              if (AdvManager && !foundry.utils.isEmpty(magiaData.system?.advancement)) {
                const manager = AdvManager.forNewItem(actor, magiaData);
                if (manager.steps.length) {
                  manager.render(true);
                  ui.notifications.info(`${actor.name} ha scelto ${magiaDoc.name}!`);
                  resolve(true);
                } else {
                  const created = await actor.createEmbeddedDocuments("Item", [magiaData]);
                  ui.notifications.info(`${actor.name} ha scelto ${magiaDoc.name}!`);
                  resolve(created[0]);
                }
              } else {
                const created = await actor.createEmbeddedDocuments("Item", [magiaData]);
                ui.notifications.info(`${actor.name} ha scelto ${magiaDoc.name}!`);
                resolve(created[0]);
              }
            } catch (err) {
              console.error("Fairy Tail 5e | Error adding magia:", err);
              resolve(null);
            }
          }
        }
      },
      default: "ok",
      close: () => resolve(null)
    }, { width: 400 }).render(true);
  });
}

/* -------------------------------------------------- */
/*  Talent Selection Dialog (Jack Of All, etc.)       */
/* -------------------------------------------------- */

/**
 * Races that grant a talent choice at character creation.
 * Identifier (kebab-case) → { count, title, hint }
 */
const RACES_WITH_TALENT = {
  "umani":                     { count: 1, title: "Jack Of All",  hint: "Inizi con un Talento extra a tua scelta." },
  "ibrido-demone-di-galuna":   { count: 1, title: "Talento",      hint: "Ottieni un talento a tua scelta dal capitolo Talenti." }
};

/**
 * Show a custom talent picker dialog.
 * Lists every feat from both the FT5e and dnd5e SRD compendiums,
 * with an option to hide those whose prerequisites aren't met.
 */
async function promptTalentSelection(actor, config) {
  // ── 1. Gather feats from all compendiums ──────────────────────
  const feats = [];

  // FT5e talents
  const ft5ePack = game.packs.get("fairy-tail-5e.ft5e-talenti");
  if (ft5ePack) {
    const docs = await ft5ePack.getDocuments();
    for (const d of docs) {
      feats.push({
        id: d.id,
        packId: ft5ePack.collection,
        name: d.name,
        img: d.img || "icons/svg/book.svg",
        source: "Fairy Tail",
        requirements: d.system?.requirements || "",
        doc: d
      });
    }
  }

  // dnd5e SRD feats — scan all system compendiums for type "feat"
  for (const pack of game.packs) {
    if (pack.collection === ft5ePack?.collection) continue;           // skip FT5e
    if (pack.documentName !== "Item") continue;
    try {
      const idx = await pack.getIndex({ fields: ["system.type.value", "system.type.subtype", "system.requirements", "system.source"] });
      for (const entry of idx) {
        if (entry.system?.type?.value !== "feat") continue;
        feats.push({
          id: entry._id,
          packId: pack.collection,
          name: entry.name,
          img: entry.img || "icons/svg/book.svg",
          source: entry.system?.source?.book || pack.metadata?.label || "D&D 5e",
          requirements: entry.system?.requirements || "",
          doc: null  // lazy-loaded on selection
        });
      }
    } catch { /* skip locked packs */ }
  }

  // Sort alphabetically
  feats.sort((a, b) => a.name.localeCompare(b.name, "it"));

  // ── 2. Prerequisite checking helper ───────────────────────────
  function meetsPrereqs(feat) {
    const req = feat.requirements?.toLowerCase() || "";
    if (!req) return true;  // no prerequisite → always ok
    const level = actor.system?.details?.level ?? 0;
    const abilities = actor.system?.abilities ?? {};

    // Level check: "livello X" or "X° livello"
    const lvlMatch = req.match(/livello\s+(\d+)|(\d+)°?\s*livello/);
    if (lvlMatch) {
      const needed = parseInt(lvlMatch[1] || lvlMatch[2]);
      if (level < needed) return false;
    }

    // Ability score check: "Forza 13", "Destrezza 15", etc.
    const abilityMap = { forza: "str", destrezza: "dex", costituzione: "con", intelligenza: "int", saggezza: "wis", carisma: "cha" };
    for (const [itName, key] of Object.entries(abilityMap)) {
      const abiMatch = req.match(new RegExp(itName + "\\s+(\\d+)", "i"));
      if (abiMatch) {
        const needed = parseInt(abiMatch[1]);
        if ((abilities[key]?.value ?? 10) < needed) return false;
      }
    }

    // Modifier check: "Modificatore Incantatore pari o superiore a X" or "Modificatore Incantatore X"
    const modMatch = req.match(/modificatore\s+incantatore\s+(?:pari\s+o\s+superiore\s+a\s+)?(\d+)/i);
    if (modMatch) {
      const needed = parseInt(modMatch[1]);
      const spellAbility = actor.system?.attributes?.spellcasting;
      const mod = spellAbility ? (abilities[spellAbility]?.mod ?? 0) : 0;
      // For "20 in Modificatore Incantatore" → compare ability score, not mod
      if (needed >= 10) {
        const score = spellAbility ? (abilities[spellAbility]?.value ?? 10) : 10;
        if (score < needed) return false;
      } else {
        if (mod < needed) return false;
      }
    }

    // Feature/talent prerequisite: check if actor has an item with that name
    const talentMatch = req.match(/talento\s+(.+?)(?:,|$)/i);
    if (talentMatch) {
      const needed = talentMatch[1].trim().toLowerCase();
      const has = actor.items.some(i => i.type === "feat" && i.name?.toLowerCase().includes(needed));
      if (!has) return false;
    }

    return true;  // can't parse further → assume ok
  }

  // ── 3. Build dialog HTML ──────────────────────────────────────
  function buildFeatListHtml(filterPrereqs, searchText) {
    const search = searchText.toLowerCase();
    let html = "";
    for (const feat of feats) {
      // Search filter
      if (search && !feat.name.toLowerCase().includes(search)) continue;
      // Prerequisite filter
      const ok = meetsPrereqs(feat);
      if (filterPrereqs && !ok) continue;

      const badge = feat.source === "Fairy Tail"
        ? '<span style="background:#e74c3c;color:#fff;padding:1px 6px;border-radius:3px;font-size:0.75em;margin-right:4px;">FT</span>'
        : '<span style="background:#3498db;color:#fff;padding:1px 6px;border-radius:3px;font-size:0.75em;margin-right:4px;">5e</span>';
      const reqText = feat.requirements ? `<span style="color:#888;font-size:0.85em;"> — ${feat.requirements}</span>` : "";
      const dimStyle = !ok ? ' style="opacity:0.45;"' : "";

      html += `<label class="ft5e-talent-row"${dimStyle}>
        <input type="radio" name="ft5e-talent-pick" value="${feat.packId}|||${feat.id}">
        <img src="${feat.img}" width="24" height="24" style="margin:0 6px;vertical-align:middle;border:0;">
        ${badge}<strong>${feat.name}</strong>${reqText}
      </label>`;
    }
    return html || '<p style="color:#888;text-align:center;">Nessun talento trovato.</p>';
  }

  // ── 4. Render dialog ──────────────────────────────────────────
  return new Promise((resolve) => {
    let filterPrereqs = true;
    let searchText = "";

    const dlg = new Dialog({
      title: `${config.title} — Scegli un Talento`,
      content: `
        <p>${config.hint}</p>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <input type="text" id="ft5e-talent-search" placeholder="Cerca talento..." style="flex:1;">
          <label style="white-space:nowrap;font-size:0.9em;">
            <input type="checkbox" id="ft5e-talent-filter" checked> Solo con prerequisiti
          </label>
        </div>
        <div id="ft5e-talent-list" style="max-height:400px;overflow-y:auto;border:1px solid #999;border-radius:4px;padding:4px;">
          ${buildFeatListHtml(true, "")}
        </div>
        <style>
          .ft5e-talent-row { display:flex; align-items:center; padding:4px 6px; cursor:pointer; border-bottom:1px solid #eee; }
          .ft5e-talent-row:hover { background:rgba(123,104,238,0.1); }
          .ft5e-talent-row input[type="radio"] { margin-right:4px; }
        </style>`,
      buttons: {
        ok: {
          label: "Conferma",
          icon: '<i class="fas fa-check"></i>',
          callback: async (html) => {
            const val = html.find('input[name="ft5e-talent-pick"]:checked').val();
            if (!val) { resolve(null); return; }
            const [packId, itemId] = val.split("|||");
            try {
              const pack = game.packs.get(packId);
              const doc = await pack.getDocument(itemId);
              if (!doc) { resolve(null); return; }
              const data = doc.toObject();
              delete data._id;

              // Use AdvancementManager if item has advancements (e.g. ASI)
              const AdvManager = dnd5e.applications.advancement?.AdvancementManager;
              if (AdvManager && !foundry.utils.isEmpty(data.system?.advancement)) {
                const manager = AdvManager.forNewItem(actor, data);
                if (manager.steps.length) {
                  manager.render(true);
                  ui.notifications.info(`${actor.name} ottiene il talento: ${doc.name}!`);
                  resolve(true);
                } else {
                  const created = await actor.createEmbeddedDocuments("Item", [data]);
                  ui.notifications.info(`${actor.name} ottiene il talento: ${doc.name}!`);
                  resolve(created[0]);
                }
              } else {
                const created = await actor.createEmbeddedDocuments("Item", [data]);
                ui.notifications.info(`${actor.name} ottiene il talento: ${doc.name}!`);
                resolve(created[0]);
              }
            } catch (err) {
              console.error("Fairy Tail 5e | Error adding talent:", err);
              resolve(null);
            }
          }
        }
      },
      default: "ok",
      close: () => resolve(null),
      render: (html) => {
        // Live search + filter
        const refresh = () => {
          searchText = html.find("#ft5e-talent-search").val() || "";
          filterPrereqs = html.find("#ft5e-talent-filter").prop("checked");
          html.find("#ft5e-talent-list").html(buildFeatListHtml(filterPrereqs, searchText));
        };
        html.find("#ft5e-talent-search").on("input", refresh);
        html.find("#ft5e-talent-filter").on("change", refresh);
      }
    }, { width: 520, height: "auto" });
    dlg.render(true);
  });
}

/* -------------------------------------------------- */
/*  Hooks — Init & Settings                           */
/* -------------------------------------------------- */

Hooks.once("init", () => {
  // Register the main toggle setting
  game.settings.register(MODULE_ID, "manaPointsEnabled", {
    name: game.i18n?.localize("FT5E.Settings.ManaEnabled.Name") ?? "Abilita Punti Mana",
    hint: game.i18n?.localize("FT5E.Settings.ManaEnabled.Hint") ?? "Sostituisce gli slot incantesimi con i Punti Mana del manuale Fairy Tail 5e.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });

  // Register the color setting
  game.settings.register(MODULE_ID, "manaBarColor", {
    name: game.i18n?.localize("FT5E.Settings.ManaBarColor.Name") ?? "Colore Barra Mana",
    hint: game.i18n?.localize("FT5E.Settings.ManaBarColor.Hint") ?? "Colore primario della barra Punti Mana.",
    scope: "world",
    config: true,
    type: String,
    default: "#7b68ee",
    requiresReload: false
  });

  console.log("Fairy Tail 5e | Mana Points system registered.");
});

// Register source book after dnd5e has initialized its config
Hooks.once("setup", () => {
  if (CONFIG.DND5E?.sourceBooks) {
    CONFIG.DND5E.sourceBooks["Fairy Tail"] = "Fairy Tail";
    console.log("Fairy Tail 5e | Source book 'Fairy Tail' registered.");
  }
});

/* -------------------------------------------------- */
/*  Hooks — Sheet Rendering (Mana Bar)                */
/* -------------------------------------------------- */

/**
 * Inject the Mana Points tracker bar into the character sheet.
 */
function injectManaTracker(app, html, data) {
  if (!isEnabled()) return;
  const actor = app.actor ?? app.document;
  if (!actor || actor.type !== "character") return;
  const classes = getActorFT5eClasses(actor);
  if (!classes.length) return;

  const mana = getManaData(actor);
  const pct = mana.max > 0 ? Math.round((mana.value / mana.max) * 100) : 0;
  const color = game.settings.get(MODULE_ID, "manaBarColor") || "#7b68ee";

  // Build the tracker HTML
  const trackerHtml = `
    <div class="ft5e-mana-tracker" data-actor-id="${actor.id}">
      <label class="ft5e-mana-label">
        <i class="fas fa-hat-wizard"></i>
        Punti Mana
      </label>
      <div class="ft5e-mana-bar-container">
        <div class="ft5e-mana-bar" style="width: ${pct}%; background: linear-gradient(90deg, ${color}, ${_lighten(color, 30)});"></div>
        <span class="ft5e-mana-text">
          <input type="number" class="ft5e-mana-input" style="width: ${String(mana.value).length + 0.4}ch" value="${mana.value}" min="0" max="${mana.max}" data-dtype="Number" />
          / ${mana.max}
        </span>
      </div>
    </div>
  `;

  // Find insertion point — try multiple selectors for compatibility
  const jqHtml = html instanceof jQuery ? html : $(html);
  const sidebar = jqHtml.find(".sidebar .stats");
  if (sidebar.length) {
    // dnd5e v5 ActorSheet2
    sidebar.append(trackerHtml);
  } else {
    // Fallback: insert after header attributes
    const attrs = jqHtml.find(".header-details .attributes, .sheet-header .attributes");
    if (attrs.length) {
      attrs.after(trackerHtml);
    }
  }

  // Bind events
  jqHtml.find(".ft5e-mana-input").on("change", async (ev) => {
    ev.preventDefault();
    const newVal = parseInt(ev.currentTarget.value);
    if (!isNaN(newVal)) {
      await setManaValue(actor, newVal);
    }
  });
}

/**
 * Lighten a hex color by a percentage.
 */
function _lighten(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + Math.round(2.55 * percent));
  const g = Math.min(255, ((num >> 8) & 0x00ff) + Math.round(2.55 * percent));
  const b = Math.min(255, (num & 0x0000ff) + Math.round(2.55 * percent));
  return `#${(0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Hook into both v2 and legacy character sheets
Hooks.on("renderActorSheet", injectManaTracker);
Hooks.on("renderActorSheet5eCharacter2", injectManaTracker);
Hooks.on("renderActorSheetV2", injectManaTracker);
Hooks.on("renderActorSheet5eCharacter", injectManaTracker);

/* -------------------------------------------------- */
/*  Hooks — Hide Spell Slots                          */
/* -------------------------------------------------- */

/**
 * Override prepared spell slot data so the sheet shows 0 slots.
 * The spells tab still shows spells grouped by level, but no slot pips.
 */
Hooks.on("dnd5e.prepareLeveledSlots", (slots, actor) => {
  if (!isEnabled()) return;
  const classes = getActorFT5eClasses(actor);
  if (!classes.length) return;

  // Zero out all leveled slots
  for (const slot of Object.values(slots)) {
    slot.max = 0;
    slot.value = 0;
    slot.override = 0;
  }
});

/* -------------------------------------------------- */
/*  Hooks — Spell Casting (Mana Consumption)          */
/* -------------------------------------------------- */

/**
 * Before a spell activity is used, flag it so we consume mana instead of slots.
 */
Hooks.on("dnd5e.preUseActivity", (activity, usageConfig, dialogConfig, messageConfig) => {
  if (!isEnabled()) return true;
  const actor = activity.actor;
  if (!actor || actor.type !== "character") return true;
  const classes = getActorFT5eClasses(actor);
  if (!classes.length) return true;

  // Only intercept spell activities
  const item = activity.item;
  if (item?.type !== "spell") return true;

  // Mark for mana consumption
  if (usageConfig.consume) {
    usageConfig.consume.spellSlot = false;
    foundry.utils.setProperty(usageConfig, "flags.ft5e.useMana", true);
  }
  return true;
});

/**
 * Modify the casting dialog to show mana cost instead of slot selection.
 */
Hooks.on("renderActivityUsageDialog", (dialog, html) => {
  if (!isEnabled()) return;

  const activity = dialog.activity ?? dialog.item?.system?.activities?.contents?.[0];
  if (!activity) return;
  const actor = activity.actor;
  if (!actor || actor.type !== "character") return;
  const classes = getActorFT5eClasses(actor);
  if (!classes.length) return;
  const item = activity.item;
  if (item?.type !== "spell") return;

  const jqHtml = html instanceof jQuery ? html : $(html);
  const mana = getManaData(actor);
  const baseLevel = item.system?.level ?? 0;
  if (baseLevel === 0) return; // Cantrips are free

  const maxAvail = getMaxSpellLevel(actor);

  // Modify slot select options to show mana cost
  const slotSelect = jqHtml.find('select[name="spell.slot"], select[name="slotLevel"]');
  if (slotSelect.length) {
    slotSelect.find("option").each(function () {
      const opt = $(this);
      const val = opt.val();
      // Extract spell level from the value (e.g. "spell1" → 1)
      const match = val?.match?.(/spell(\d+)/);
      if (!match) return;
      const lvl = parseInt(match[1]);
      if (lvl < baseLevel || lvl > maxAvail) {
        opt.prop("disabled", true);
        opt.text(opt.text() + ` (non disponibile)`);
        return;
      }
      const cost = lvl; // Mana cost = spell level
      opt.text(opt.text() + ` — ${cost} PM (${mana.value}/${mana.max})`);
      if (cost > mana.value) {
        opt.prop("disabled", true);
        opt.text(opt.text() + ` (mana insufficiente)`);
      }
    });
  }

  // Add a mana cost info line
  const cost = baseLevel;
  const info = $(`<div class="ft5e-mana-cast-info" style="margin: 4px 0; padding: 4px 8px; background: rgba(123,104,238,0.1); border-radius: 4px; font-size: 0.9em;">
    <i class="fas fa-hat-wizard"></i>
    Costo base: <strong>${cost} PM</strong> — Mana disponibile: <strong>${mana.value}/${mana.max}</strong>
  </div>`);

  // Insert before the form buttons
  const footer = jqHtml.find(".dialog-buttons, footer, .form-footer");
  if (footer.length) {
    footer.before(info);
  } else {
    jqHtml.append(info);
  }
});

/**
 * Intercept actual spell consumption to deduct mana instead of spell slots.
 */
Hooks.on("dnd5e.preActivityConsumption", (activity, usageConfig, consumeConfig, messageConfig) => {
  if (!isEnabled()) return true;
  const actor = activity.actor;
  if (!actor || actor.type !== "character") return true;
  const classes = getActorFT5eClasses(actor);
  if (!classes.length) return true;
  const item = activity.item;
  if (item?.type !== "spell") return true;

  const baseLevel = item.system?.level ?? 0;
  if (baseLevel === 0) return true; // Cantrips cost nothing

  // Determine the cast level from usage config
  let castLevel = baseLevel;
  const slotKey = usageConfig?.spell?.slot ?? usageConfig?.slotLevel;
  if (slotKey) {
    const match = slotKey.match?.(/spell(\d+)/);
    if (match) castLevel = parseInt(match[1]);
  }

  const cost = castLevel; // Mana cost = spell level
  const mana = getManaData(actor);

  if (cost > mana.value) {
    ui.notifications.warn(game.i18n?.format("FT5E.Mana.NotEnough", { cost, current: mana.value }) ??
      `Punti Mana insufficienti! Costo: ${cost} PM, disponibili: ${mana.value} PM.`);
    return false; // Cancel the cast
  }

  // Prevent normal spell slot consumption
  if (consumeConfig?.consume) {
    consumeConfig.consume.spellSlot = false;
  }

  // Deduct mana
  setManaValue(actor, mana.value - cost);

  // Chat notification
  const chatContent = `
    <div class="ft5e-mana-chat">
      <strong>${actor.name}</strong> lancia <em>${item.name}</em> al livello ${castLevel}.<br>
      <i class="fas fa-hat-wizard"></i> Mana: ${mana.value} → ${mana.value - cost} PM (−${cost} PM)
    </div>
  `;
  ChatMessage.create({
    content: chatContent,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: []
  });

  return true;
});

/* -------------------------------------------------- */
/*  Hooks — Long Rest Recovery                        */
/* -------------------------------------------------- */

Hooks.on("dnd5e.longRest", (actor, result) => {
  if (!isEnabled()) return;
  if (!actor || actor.type !== "character") return;
  const classes = getActorFT5eClasses(actor);
  if (!classes.length) return;

  const max = calcMaxMana(actor);
  setManaValue(actor, max);
  ui.notifications.info(
    game.i18n?.format("FT5E.Mana.Recovered", { name: actor.name, max }) ??
    `${actor.name} recupera tutti i Punti Mana! (${max} PM)`
  );
});

/**
 * Also handle short rest hook for future class features that recover mana on short rest.
 */
Hooks.on("dnd5e.shortRest", (actor, result) => {
  if (!isEnabled()) return;
  // Currently no FT5e class recovers mana on short rest by default.
  // This hook is here for future extensibility.
});

/* -------------------------------------------------- */
/*  Hooks — Auto-initialize mana on class changes     */
/* -------------------------------------------------- */

Hooks.on("createItem", async (item, options, userId) => {
  if (game.user.id !== userId) return;
  if (item.type !== "class") return;
  const actor = item.parent;
  if (!actor || actor.type !== "character") return;
  const id = item.system?.identifier;
  if (!id || !CLASS_CONFIG[id]) return;

  // If spellcasting ability is not set, prompt the player to choose
  if (!item.system?.spellcasting?.ability) {
    await promptSpellcastingAbility(item);
  }

  // Prompt to choose a Magia (subclass)
  await promptMagiaSelection(item, actor);

  if (!isEnabled()) return;

  // Initialize mana if this is the first FT5e class
  const existing = actor.getFlag(MODULE_ID, FLAG_MANA);
  if (!existing) {
    const max = calcMaxMana(actor);
    actor.setFlag(MODULE_ID, FLAG_MANA, { value: max, override: null });
  }
});

/* -------------------------------------------------- */
/*  Hooks — Race talent choice (Jack Of All, etc.)    */
/* -------------------------------------------------- */

Hooks.on("createItem", async (item, options, userId) => {
  if (game.user.id !== userId) return;
  if (item.type !== "race") return;
  const actor = item.parent;
  if (!actor || actor.type !== "character") return;

  // Check if this race grants talent choices
  const identifier = item.system?.identifier || toKebabRuntime(item.name);
  const talentConfig = RACES_WITH_TALENT[identifier];
  if (!talentConfig) return;

  // Small delay so the race advancements finish processing first
  await new Promise(r => setTimeout(r, 500));

  for (let i = 0; i < talentConfig.count; i++) {
    await promptTalentSelection(actor, talentConfig);
  }
});

/** Convert a name to kebab-case (runtime version for matching race names) */
function toKebabRuntime(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[àáâ]/g, "a").replace(/[èéê]/g, "e")
    .replace(/[ìíî]/g, "i").replace(/[òóô]/g, "o").replace(/[ùúû]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* -------------------------------------------------- */
/*  Hooks — Class level changes                       */
/* -------------------------------------------------- */

Hooks.on("updateItem", (item, changes, options, userId) => {
  if (!isEnabled()) return;
  if (game.user.id !== userId) return;
  if (item.type !== "class") return;
  const actor = item.parent;
  if (!actor || actor.type !== "character") return;
  const id = item.system?.identifier;
  if (!id || !CLASS_CONFIG[id]) return;

  // Recalculate if level changed
  if (changes?.system?.levels !== undefined) {
    const mana = getManaData(actor);
    const newMax = calcMaxMana(actor);
    // Keep the same "spent" amount
    const spent = mana.max - mana.value;
    const newValue = Math.max(0, newMax - spent);
    actor.setFlag(MODULE_ID, FLAG_MANA, {
      ...actor.getFlag(MODULE_ID, FLAG_MANA),
      value: newValue
    });
  }
});

/* -------------------------------------------------- */
/*  Hooks — Talent MP Consumption                     */
/* -------------------------------------------------- */

/**
 * When a feat with fairy-tail-5e.mpCost flag is used, deduct MP and show chat message.
 */
Hooks.on("dnd5e.preUseActivity", (activity, usageConfig, dialogConfig, messageConfig) => {
  if (!isEnabled()) return true;
  const item = activity.item;
  if (item?.type !== "feat") return true;
  const actor = activity.actor;
  if (!actor || actor.type !== "character") return true;

  const mpCost = item.flags?.["fairy-tail-5e"]?.mpCost;
  if (!mpCost || mpCost <= 0) return true;

  const mana = getManaData(actor);
  if (mpCost > mana.value) {
    ui.notifications.warn(`Punti Mana insufficienti per ${item.name}! Costo: ${mpCost} PM, disponibili: ${mana.value} PM.`);
    return false;
  }

  // Deduct mana
  setManaValue(actor, mana.value - mpCost);

  // Chat notification
  ChatMessage.create({
    content: `<div class="ft5e-mana-chat"><strong>${actor.name}</strong> usa <em>${item.name}</em>.<br><i class="fas fa-hat-wizard"></i> Mana: ${mana.value} \u2192 ${mana.value - mpCost} PM (\u2212${mpCost} PM)</div>`,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: []
  });

  return true;
});

/* -------------------------------------------------- */
/*  Hooks — Enhancement Talent Dialog                 */
/* -------------------------------------------------- */

/**
 * When an ability is used, check if the actor has enhancement talents that
 * match it and offer to activate them.
 */
Hooks.on("dnd5e.preUseActivity", (activity, usageConfig, dialogConfig, messageConfig) => {
  if (!isEnabled()) return true;
  const item = activity.item;
  if (!item) return true;
  const actor = activity.actor;
  if (!actor || actor.type !== "character") return true;

  // Find enhancement talents that match this ability
  const itemName = item.name?.toLowerCase() || "";
  const enhancements = [];

  for (const feat of actor.items) {
    if (feat.type !== "feat") continue;
    const enhances = feat.flags?.["fairy-tail-5e"]?.enhances;
    if (!enhances) continue;
    // Check if this talent enhances the current ability
    if (itemName.includes(enhances.toLowerCase())) {
      enhancements.push({
        talent: feat,
        mpCost: feat.flags?.["fairy-tail-5e"]?.mpCost || 0
      });
    }
  }

  if (enhancements.length === 0) return true;

  // Show enhancement dialog for each matching talent (non-blocking)
  const mana = getManaData(actor);
  for (const enh of enhancements) {
    _showEnhancementDialog(actor, item, enh.talent, enh.mpCost, mana);
  }

  return true;
});

/**
 * Display a dialog asking the player whether to activate an enhancement talent.
 */
async function _showEnhancementDialog(actor, baseItem, talentItem, mpCost, mana) {
  const canAfford = mana.value >= mpCost;
  const costText = mpCost > 0
    ? `Costo aggiuntivo: ${mpCost} PM (${mana.value}/${mana.max} disponibili)`
    : "Nessun costo aggiuntivo";

  const desc = talentItem.system?.description?.value || "";
  const cleanDesc = desc.replace(/<[^>]*>/g, "").replace(/\*\*/g, "").replace(/\*/g, "").substring(0, 200);

  const result = await Dialog.confirm({
    title: `${talentItem.name} \u2014 Potenziamento`,
    content: `
      <p>Vuoi attivare <strong>${talentItem.name}</strong> insieme a <strong>${baseItem.name}</strong>?</p>
      <p><em>${costText}</em></p>
      ${!canAfford ? '<p style="color:red;"><strong>Mana insufficiente!</strong></p>' : ''}
    `,
    yes: () => true,
    no: () => false,
    defaultYes: canAfford
  });

  if (result && canAfford && mpCost > 0) {
    await setManaValue(actor, mana.value - mpCost);
    ChatMessage.create({
      content: `<div class="ft5e-mana-chat"><strong>${actor.name}</strong> attiva <em>${talentItem.name}</em> con <em>${baseItem.name}</em>!<br><i class="fas fa-hat-wizard"></i> Mana: ${mana.value} \u2192 ${mana.value - mpCost} PM (\u2212${mpCost} PM)</div>`,
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper: []
    });
  }
}

/* -------------------------------------------------- */
/*  Hooks — Per-Combat Tracking Reset                 */
/* -------------------------------------------------- */

/**
 * Reset per-combat uses on initiative roll and trigger combat-start talents.
 */
Hooks.on("dnd5e.rollInitiative", (actor) => {
  if (!isEnabled()) return;
  if (!actor || actor.type !== "character") return;

  // Reset uses for talents with per-combat tracking
  for (const item of actor.items) {
    if (item.type !== "feat") continue;
    if (item.system?.uses?.per === "charges" && item.system?.uses?.max) {
      const maxVal = item.system.uses.max;
      item.update({ "system.uses.value": typeof maxVal === "number" ? maxVal : parseInt(maxVal) || 0 });
    }
  }

  // Efficienza del Mana: grant temp mana on initiative
  const hasEfficienza = actor.items.find(i => i.type === "feat" && i.name?.toLowerCase().includes("efficienza del mana"));
  if (hasEfficienza) {
    const prof = actor.system?.attributes?.prof ?? 0;
    const tempMana = Math.ceil(prof / 2);
    if (tempMana > 0) {
      const mana = getManaData(actor);
      setManaValue(actor, Math.min(mana.value + tempMana, mana.max));
      ChatMessage.create({
        content: `<div class="ft5e-mana-chat"><strong>${actor.name}</strong> ottiene ${tempMana} PM temporanei da <em>Efficienza del Mana</em>!</div>`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    }
  }

  // Ondata di Mana Berserk: recover castMod MP when at 0
  const hasBerserk = actor.items.find(i => i.type === "feat" && i.name?.toLowerCase().includes("ondata di mana berserk"));
  if (hasBerserk) {
    const mana = getManaData(actor);
    if (mana.value === 0) {
      const classes = getActorFT5eClasses(actor);
      if (classes.length) {
        const mod = _getCastingMod(actor, classes[0].classItem, classes[0].config);
        const recovery = Math.max(1, mod);
        setManaValue(actor, recovery);
        ChatMessage.create({
          content: `<div class="ft5e-mana-chat"><strong>${actor.name}</strong> recupera ${recovery} PM da <em>Ondata di Mana Berserk</em>!</div>`,
          speaker: ChatMessage.getSpeaker({ actor })
        });
      }
    }
  }
});

/* -------------------------------------------------- */
/*  Public API (exposed on the module)                */
/* -------------------------------------------------- */

Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    mod.api = {
      isEnabled,
      getManaData,
      setManaValue,
      setManaOverride,
      calcMaxMana,
      getMaxSpellLevel,
      getActorFT5eClasses,
      CLASS_CONFIG
    };
  }
  console.log("Fairy Tail 5e | Mana Points system ready.");
});

/* ================================================== */
/*  FT5E DEMON POINTS — Demonizzazione (Devil Slayer) */
/*  Aggiunto il 18/07/2026 — tracker DP automatico    */
/*  Backup pre-patch: mana-points.backup-20260718.txt */
/* ================================================== */

const DP_FLAG = "demonPoints";
const DP_THRESHOLDS = [10,20,30,40,50,60,70,80,90,100,200,300,400,500,600,700,800,900,1000];
const DP_BUFFS = {10:"+3 m velocità di movimento",20:"Ti alzi da prono usando solo 1,5 m",30:"+1 a tutti i tiri per colpire",40:"+1 CA",50:"Resistenza ai danni da maledizioni/demoni",60:"Vantaggio ai TS su Saggezza",70:"Vedi nell'oscurità (anche magica) fino a 36 m",80:"+mod SAG danni da Forza con la magia Devil Slayer",90:"Critico +1 vs demoni, dado danno +1 categoria",100:"+1 CA",200:"Leggi qualsiasi scrittura demoniaca/angelica",300:"Critico +1 vs demoni, dado danno +1 categoria",400:"Immunità ad Ammaliato e Spaventato",500:"Incosciente solo a PF negativi pari a livello×2",600:"Critico +1 vs demoni, dado danno +1 categoria",700:"Immunità a maledizioni e magia demoniaca",800:"Allineamento LM — dado danno +2 categorie",900:"Allineamento CM — danno sempre massimizzato",1000:"⚠️ DIVENTA UN DEMONE (il PG diventa PNG)"};

function dpIsDevilSlayer(actor) {
  return actor?.type === "character" && actor.items.some(i => i.type === "race" && /devil\s*slayer/i.test(i.name));
}
function dpGet(actor) { return Number(actor.getFlag(MODULE_ID, DP_FLAG) ?? 0); }
async function dpSet(actor, v) { return actor.setFlag(MODULE_ID, DP_FLAG, Math.max(0, Math.min(1000, Math.round(v)))); }
function dpTier(dp) { let t = 0; for (const th of DP_THRESHOLDS) if (dp >= th) t = th; return t; }

function dpAnnounce(actor, oldDp, newDp, reason) {
  const ot = dpTier(oldDp), nt = dpTier(newDp);
  if (ot === nt) return;
  let extra = "";
  if (nt > ot) {
    const items = DP_THRESHOLDS.filter(t => t > ot && t <= nt).map(t => `<li><strong>${t} DP:</strong> ${DP_BUFFS[t]}</li>`).join("");
    extra = `<p><strong>Nuovi effetti attivi:</strong></p><ul>${items}</ul>`;
  } else {
    extra = `<p>Soglia scesa a <strong>${nt || "nessuna"}</strong>.</p>`;
  }
  ChatMessage.create({content: `<div class="ft5e-mana-chat" style="border-left:3px solid #a11;padding-left:6px"><i class="fas fa-fire-flame-curved" style="color:#a11"></i> <strong>${actor.name}</strong> — Demonizzazione: ${oldDp} → <strong>${newDp} DP</strong> <em>(${reason})</em>${extra}</div>`, speaker: ChatMessage.getSpeaker({actor})});
}

// Accumulo automatico: 10 DP per ogni MP speso
Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
  const nv = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.manaPoints.value`);
  if (nv === undefined || !dpIsDevilSlayer(actor)) return;
  const ov = Number(foundry.utils.getProperty(actor, `flags.${MODULE_ID}.manaPoints.value`) ?? 0);
  const spent = ov - Number(nv);
  if (spent > 0) options.ft5eManaSpent = spent;
});
Hooks.on("updateActor", async (actor, changes, options, userId) => {
  if (!options.ft5eManaSpent || game.user.id !== userId) return;
  if (!dpIsDevilSlayer(actor)) return;
  const gain = options.ft5eManaSpent * 10;
  const old = dpGet(actor);
  const nv = Math.min(1000, old + gain);
  if (nv === old) return;
  await dpSet(actor, nv);
  dpAnnounce(actor, old, nv, `+${gain} DP per ${options.ft5eManaSpent} MP spesi`);
});

// Guadagno di fine turno in combattimento (in base alla soglia raggiunta)
Hooks.on("combatTurnChange", async (combat, prior, current) => {
  if (game.user !== game.users.activeGM) return;
  const c = combat.combatants.get(prior?.combatantId);
  const actor = c?.actor;
  if (!actor || !dpIsDevilSlayer(actor)) return;
  const dp = dpGet(actor);
  if (dp < 10 || dp >= 1000) return;
  const gain = dpTier(dp) / 10;
  const nv = Math.min(1000, dp + gain);
  await dpSet(actor, nv);
  dpAnnounce(actor, dp, nv, `+${gain} DP a fine turno`);
});

// Tracker sulla scheda (sotto i Punti Mana)
function injectDemonTracker(app, html) {
  if (!isEnabled()) return;
  const actor = app.actor ?? app.document;
  if (!actor || !dpIsDevilSlayer(actor)) return;
  const jq = html instanceof jQuery ? html : $(html);
  if (jq.find(".ft5e-demon-tracker").length) return;
  const dp = dpGet(actor);
  const pct = Math.round(dp / 1000 * 100);
  const tier = dpTier(dp);
  const tip = DP_THRESHOLDS.map(t => `${dp >= t ? "✔" : "✖"} ${t}: ${DP_BUFFS[t]}`).join("&#10;");
  const el = $(`<div class="ft5e-mana-tracker ft5e-demon-tracker" data-actor-id="${actor.id}" title="${tip}">
    <label class="ft5e-mana-label"><i class="fas fa-fire-flame-curved" style="color:#b22"></i> Punti Demoniaci${tier ? ` <span style="color:#b22">(soglia ${tier})</span>` : ""}</label>
    <div class="ft5e-mana-bar-container">
      <div class="ft5e-mana-bar" style="width:${pct}%;background:linear-gradient(90deg,#5a0202,#cc2222)"></div>
      <span class="ft5e-mana-text"><input type="number" class="ft5e-demon-input" style="width:${String(dp).length + 0.4}ch" value="${dp}" min="0" max="1000" data-dtype="Number"/> / 1000</span>
    </div>
  </div>`);
  const sidebar = jq.find(".sidebar .stats");
  if (sidebar.length) sidebar.append(el);
  else jq.find(".header-details .attributes, .sheet-header .attributes").after(el);
  el.find(".ft5e-demon-input").on("change", async (ev) => {
    const v = parseInt(ev.currentTarget.value);
    if (isNaN(v)) return;
    const old = dpGet(actor);
    const nv = Math.max(0, Math.min(1000, v));
    await dpSet(actor, nv);
    dpAnnounce(actor, old, nv, "modifica manuale");
  });
}
Hooks.on("renderActorSheet", injectDemonTracker);
Hooks.on("renderActorSheet5eCharacter2", injectDemonTracker);
Hooks.on("renderActorSheetV2", injectDemonTracker);
Hooks.on("renderActorSheet5eCharacter", injectDemonTracker);

/* ================================================== */
/*  FT5E PUSH — Spinta automatica dei token           */
/*  Aggiunto il 19/07/2026. Backup: mana-points.backup-prepush.txt */
/*  Usato da tecniche/capacità che spingono il bersaglio. */
/* ================================================== */

let _ft5eSocket = null;

Hooks.once("socketlib.ready", () => {
  try {
    _ft5eSocket = socketlib.registerModule(MODULE_ID);
    _ft5eSocket.register("pushToken", _ft5ePushGM);
  } catch (err) {
    console.warn("Fairy Tail 5e | socketlib non disponibile per la spinta:", err);
  }
});

/**
 * Sposta un token in linea retta allontanandolo dalla sorgente.
 * Eseguita SEMPRE lato GM (via socketlib) così funziona anche se a colpire è un giocatore.
 */
async function _ft5ePushGM(sorgenteUuid, bersaglioUuid, metri) {
  const srcDoc = await fromUuid(sorgenteUuid);
  const tgtDoc = await fromUuid(bersaglioUuid);
  if (!srcDoc || !tgtDoc) return { ok: false, motivo: "token non trovato" };

  const src = srcDoc.object, tgt = tgtDoc.object;
  if (!src || !tgt) return { ok: false, motivo: "token non sulla scena" };

  const grid = canvas.grid;
  const da = { x: src.center.x, y: src.center.y };
  const a = { x: tgt.center.x, y: tgt.center.y };

  let dx = a.x - da.x, dy = a.y - da.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { ok: false, motivo: "token sovrapposti" };
  dx /= len; dy /= len;

  const px = (metri / grid.distance) * grid.size;
  let dest = { x: a.x + dx * px, y: a.y + dy * px };

  // Si ferma contro i muri
  try {
    const backend = CONFIG.Canvas.polygonBackends.move;
    const urto = backend.testCollision(a, dest, { type: "move", mode: "closest" });
    if (urto) {
      // arretra di mezza casella per non incastrarsi nel muro
      const d = Math.hypot(urto.x - a.x, urto.y - a.y) - grid.size * 0.5;
      dest = d > 0 ? { x: a.x + dx * d, y: a.y + dy * d } : { x: a.x, y: a.y };
    }
  } catch (err) { /* nessun controllo muri disponibile: prosegue */ }

  // da centro a angolo alto-sinistra
  let nx = dest.x - (tgt.w ?? tgtDoc.width * grid.size) / 2;
  let ny = dest.y - (tgt.h ?? tgtDoc.height * grid.size) / 2;

  // allinea alla griglia se possibile
  try {
    if (grid.type !== CONST.GRID_TYPES.GRIDLESS && grid.getSnappedPoint) {
      const snap = grid.getSnappedPoint({ x: nx, y: ny }, { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_CORNER });
      if (Number.isFinite(snap?.x)) { nx = snap.x; ny = snap.y; }
    }
  } catch (err) { /* lascia la posizione libera */ }

  // Foundry v13: gli update diretti di x/y vengono annullati dal sistema di movimento.
  // "displace" e' l'azione corretta per il movimento forzato (spinte, tiri, respingimenti).
  try {
    await tgtDoc.move({ x: nx, y: ny, action: "displace" }, { animate: true });
  } catch (err) {
    console.warn("Fairy Tail 5e | move() non disponibile, fallback su update():", err);
    await tgtDoc.update({ x: nx, y: ny }, { animate: true });
  }
  const percorsi = Math.hypot(nx + (tgt.w ?? 0) / 2 - a.x, ny + (tgt.h ?? 0) / 2 - a.y);
  return { ok: true, metri: Math.round((percorsi / grid.size) * grid.distance * 10) / 10 };
}

/**
 * API pubblica: instrada la spinta al GM se serve.
 */
async function ft5ePush(sorgenteUuid, bersaglioUuid, metri = 4.5) {
  if (game.user.isGM) return _ft5ePushGM(sorgenteUuid, bersaglioUuid, metri);
  if (_ft5eSocket) return _ft5eSocket.executeAsGM("pushToken", sorgenteUuid, bersaglioUuid, metri);
  ui.notifications.warn("Spinta non applicata: nessun GM connesso.");
  return { ok: false, motivo: "nessun GM" };
}

Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod?.api) mod.api.push = ft5ePush;
});

/* ================================================== */
/*  FT5E MOVE TO TEMPLATE — spostamento sul punto      */
/*  d'impatto (es. Cometa del Drago Celeste).          */
/*  Aggiunto il 19/07/2026.                            */
/*  Attivo sugli item con flag                         */
/*  "fairy-tail-5e.moveToTemplate": true               */
/* ================================================== */

Hooks.on("dnd5e.createActivityTemplate", async (templates, activity) => {
  try {
    if (!isEnabled()) return;
    const item = activity?.item;
    if (!item?.getFlag?.(MODULE_ID, "moveToTemplate")) return;
    const actor = activity.actor;
    const tokDoc = actor?.getActiveTokens?.()[0]?.document;
    if (!tokDoc) return;
    const tpl = Array.isArray(templates) ? templates[0] : templates;
    if (!tpl) return;

    // il template viene piazzato dopo: aspetta che abbia coordinate valide
    await new Promise(r => setTimeout(r, 250));
    const doc = tpl.document ?? tpl;
    if (!Number.isFinite(doc?.x) || !Number.isFinite(doc?.y)) return;

    const grid = canvas.grid;
    const tok = tokDoc.object;
    const larghezza = tok?.w ?? (tokDoc.width * grid.size);
    const altezza = tok?.h ?? (tokDoc.height * grid.size);
    let nx = doc.x - larghezza / 2;
    let ny = doc.y - altezza / 2;
    try {
      if (grid.type !== CONST.GRID_TYPES.GRIDLESS && grid.getSnappedPoint) {
        const s = grid.getSnappedPoint({ x: nx, y: ny }, { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_CORNER });
        if (Number.isFinite(s?.x)) { nx = s.x; ny = s.y; }
      }
    } catch (err) { /* posizione libera */ }

    const px = tokDoc.x, py = tokDoc.y;
    if (nx === px && ny === py) return;

    // "displace": movimento speciale concesso dalla tecnica, non consuma il movimento normale.
    // Se il centro e' occupato (di solito c'e' il bersaglio), ripiega sulla casella libera piu' vicina.
    const candidati = [{ x: nx, y: ny }];
    for (let anello = 1; anello <= 2; anello++) {
      for (let dx = -anello; dx <= anello; dx++) {
        for (let dy = -anello; dy <= anello; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== anello) continue;
          candidati.push({ x: nx + dx * grid.size, y: ny + dy * grid.size });
        }
      }
    }
    let atterrata = false;
    for (const c of candidati) {
      if (c.x === px && c.y === py) { atterrata = true; nx = c.x; ny = c.y; break; }
      const ok = await tokDoc.move({ x: c.x, y: c.y, action: "displace" }, { animate: true });
      if (ok !== false) { nx = c.x; ny = c.y; atterrata = true; break; }
    }
    if (!atterrata) {
      ui.notifications.warn(`${actor.name}: nessuno spazio libero sul punto d'impatto, spostala a mano.`);
      return;
    }

    const metri = Math.round(Math.hypot(nx - px, ny - py) / grid.size * grid.distance * 10) / 10;
    ChatMessage.create({
      content: `<div class="ft5e-mana-chat"><i class="fas fa-meteor"></i> <strong>${actor.name}</strong> piomba sul punto d'impatto (${metri} m).</div>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  } catch (err) {
    console.warn("Fairy Tail 5e | moveToTemplate non riuscito:", err);
  }
});

/* ================================================== */
/*  FT5E SELF BUFF — applica da soli i buff personali  */
/*  Aggiunto il 19/09/2026.                            */
/*  Gli Active Effect di un'activity si applicano ai   */
/*  BERSAGLI: per i buff su se stessi il giocatore     */
/*  doveva bersagliarsi a mano. Questo hook li applica */
/*  automaticamente al lanciatore.                     */
/*                                                     */
/*  Condizioni (tutte necessarie, per sicurezza):      */
/*   - gittata "self"                                  */
/*   - NESSUN template (cosi' coni e linee come        */
/*     "Luce Accecante" restano esclusi: colpiscono    */
/*     i nemici, non il lanciatore)                    */
/*   - target.affects.type === "self" (opt-in esplicito)*/
/* ================================================== */

function _ft5eIsSelfBuff(activity) {
  if (activity?.range?.units !== "self") return false;
  const tgt = activity?.target;
  if (tgt?.template?.type) return false;          // ha un'area: non e' un buff personale
  if (tgt?.affects?.type !== "self") return false; // opt-in
  return true;
}

/**
 * midi-qol con l'applicazione automatica degli effetti attiva applica gia' da solo
 * gli effetti delle activity "su se stesso" al lanciatore: se li applicassimo anche
 * noi il personaggio se li ritroverebbe due volte.
 */
function _ft5eMidiApplicaEffetti() {
  if (!game.modules.get("midi-qol")?.active) return false;
  try {
    const modo = game.settings.get("midi-qol", "ConfigSettings")?.autoItemEffects ?? "off";
    return modo !== "off";
  } catch (err) {
    return false;
  }
}

Hooks.on("dnd5e.postUseActivity", async (activity, usageConfig, results) => {
  try {
    if (!isEnabled()) return;
    if (!_ft5eIsSelfBuff(activity)) return;
    if (_ft5eMidiApplicaEffetti()) return;
    const actor = activity.actor;
    if (!actor?.isOwner) return;

    // Un solo client deve applicare, altrimenti con piu' GM/proprietari connessi
    // l'effetto viene creato in duplicato. Responsabile: il giocatore proprietario
    // se e' collegato, altrimenti il GM attivo.
    const proprietario = game.users.players.find(u => u.active && actor.testUserPermission(u, "OWNER"));
    const responsabile = proprietario ?? game.users.activeGM;
    if (responsabile && game.user.id !== responsabile.id) return;

    const effetti = activity.applicableEffects ?? [];
    if (!effetti.length) return;

    const applicati = [];
    for (const eff of effetti) {
      // se c'e' gia', lo rinnova (rimette la durata a nuovo)
      const esistente = actor.effects.find(e => e.origin === eff.uuid);
      if (esistente) await esistente.delete();
      const dati = eff.toObject();
      delete dati._id;
      dati.origin = eff.uuid;
      dati.transfer = false;
      dati.disabled = false;
      await actor.createEmbeddedDocuments("ActiveEffect", [dati]);
      applicati.push(eff.name);
      // rete di sicurezza contro i doppioni
      const doppioni = actor.effects.filter(e => e.origin === eff.uuid);
      if (doppioni.length > 1) {
        await actor.deleteEmbeddedDocuments("ActiveEffect", doppioni.slice(1).map(e => e.id));
      }
    }
    if (applicati.length) {
      ChatMessage.create({
        content: `<div class="ft5e-mana-chat"><i class="fas fa-sparkles"></i> <strong>${actor.name}</strong> — effetto attivo: ${applicati.join(", ")}</div>`,
        speaker: ChatMessage.getSpeaker({ actor }),
        whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id).concat(game.user.id)
      });
    }
  } catch (err) {
    console.warn("Fairy Tail 5e | applicazione buff personale non riuscita:", err);
  }
});
