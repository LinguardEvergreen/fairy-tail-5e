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
  return total;
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
          <input type="number" class="ft5e-mana-input" value="${mana.value}" min="0" max="${mana.max}" data-dtype="Number" />
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

Hooks.on("createItem", (item, options, userId) => {
  if (!isEnabled()) return;
  if (game.user.id !== userId) return;
  if (item.type !== "class") return;
  const actor = item.parent;
  if (!actor || actor.type !== "character") return;
  const id = item.system?.identifier;
  if (!id || !CLASS_CONFIG[id]) return;

  // Initialize mana if this is the first FT5e class
  const existing = actor.getFlag(MODULE_ID, FLAG_MANA);
  if (!existing) {
    const max = calcMaxMana(actor);
    actor.setFlag(MODULE_ID, FLAG_MANA, { value: max, override: null });
  }
});

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
