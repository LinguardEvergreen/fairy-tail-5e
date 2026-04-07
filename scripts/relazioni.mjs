/**
 * Fairy Tail 5e — Punti di Relazione & Growth Token
 *
 * Adds a "Punti di Relazione" section to the character biography tab
 * showing all PCs in the campaign with editable relationship values.
 * Also tracks Growth Tokens assignable by the GM.
 *
 * Relationship points are used for Attacchi Combo and Unison Raid.
 */

const MODULE_ID = "fairy-tail-5e";
const FLAG_RELAZIONI = "relazioni";
const FLAG_GROWTH = "growthTokens";

/* -------------------------------------------------- */
/*  Data Helpers                                      */
/* -------------------------------------------------- */

/**
 * Get relationship points for an actor toward all other PCs.
 * Returns an object { actorId: pointsNumber, ... }
 */
function getRelazioni(actor) {
  return actor.getFlag(MODULE_ID, FLAG_RELAZIONI) || {};
}

/**
 * Set relationship points toward a specific actor.
 */
async function setRelazione(actor, targetId, points) {
  const current = getRelazioni(actor);
  current[targetId] = Math.max(0, parseInt(points) || 0);
  await actor.setFlag(MODULE_ID, FLAG_RELAZIONI, current);
}

/**
 * Get Growth Token count for an actor.
 */
function getGrowthTokens(actor) {
  return actor.getFlag(MODULE_ID, FLAG_GROWTH) ?? 0;
}

/**
 * Set Growth Token count.
 */
async function setGrowthTokens(actor, count) {
  await actor.setFlag(MODULE_ID, FLAG_GROWTH, Math.max(0, parseInt(count) || 0));
}

/* -------------------------------------------------- */
/*  UI Injection                                      */
/* -------------------------------------------------- */

/**
 * Inject Punti di Relazione + Growth Token section into
 * the character biography tab.
 */
function injectRelazioniUI(app, html, data) {
  const actor = app.actor ?? app.document;
  if (!actor || actor.type !== "character") return;

  const jqHtml = html instanceof jQuery ? html : $(html);

  // Find biography tab content area (dnd5e v5 ActorSheet2)
  let bioTab = jqHtml.find('.tab[data-tab="biography"]');
  if (!bioTab.length) {
    bioTab = jqHtml.find('.tab[data-tab="biography"] .editor, .biography');
  }
  if (!bioTab.length) return;

  // Get all PC actors except self
  const allPCs = game.actors.filter(a =>
    a.type === "character" && a.id !== actor.id
  );

  const relazioni = getRelazioni(actor);
  const growthTokens = getGrowthTokens(actor);
  const isGM = game.user.isGM;
  const isOwner = actor.isOwner;

  // Build relationship rows
  let relazioniRows = "";
  if (allPCs.length === 0) {
    relazioniRows = `<p class="ft5e-rel-empty">Nessun altro personaggio nella campagna.</p>`;
  } else {
    for (const pc of allPCs) {
      const points = relazioni[pc.id] ?? 0;
      const canCombo = points >= 4;
      const canUnison = points >= 6;
      let badges = "";
      if (canUnison) {
        badges = `<span class="ft5e-rel-badge ft5e-rel-badge-unison" title="Unison Raid disponibile (6+ PR)">UR</span>
                   <span class="ft5e-rel-badge ft5e-rel-badge-combo" title="Attacchi Combo disponibili (4+ PR)">AC</span>`;
      } else if (canCombo) {
        badges = `<span class="ft5e-rel-badge ft5e-rel-badge-combo" title="Attacchi Combo disponibili (4+ PR)">AC</span>`;
      }

      relazioniRows += `
        <div class="ft5e-rel-row" data-target-id="${pc.id}">
          <img class="ft5e-rel-avatar" src="${pc.img}" alt="${pc.name}" title="${pc.name}" />
          <span class="ft5e-rel-name">${pc.name}</span>
          ${badges}
          <input type="number" class="ft5e-rel-input" value="${points}" min="0"
            data-target-id="${pc.id}" ${!isOwner ? "disabled" : ""} title="Punti Relazione" />
        </div>
      `;
    }
  }

  // Build full section HTML
  const sectionHtml = `
    <div class="ft5e-relazioni-section">
      <div class="ft5e-section-header">
        <h3 class="ft5e-section-title">
          <i class="fas fa-heart"></i> Punti di Relazione
        </h3>
        <p class="ft5e-section-hint">Usati per Attacchi Combo (4+) e Unison Raid (6+). Ottieni 1 punto per aumento di livello.</p>
      </div>
      <div class="ft5e-rel-list">
        ${relazioniRows}
      </div>

      <div class="ft5e-section-header ft5e-growth-header">
        <h3 class="ft5e-section-title">
          <i class="fas fa-seedling"></i> Growth Token
        </h3>
        <p class="ft5e-section-hint">Assegnati dal Master. Usali per ottenere nuove magie o raffinare quelle esistenti.</p>
      </div>
      <div class="ft5e-growth-tracker">
        <label class="ft5e-growth-label">Token disponibili:</label>
        <input type="number" class="ft5e-growth-input" value="${growthTokens}" min="0"
          ${!isGM && !isOwner ? "disabled" : ""} title="Growth Token" />
      </div>
    </div>
  `;

  // Insert at the beginning of the biography tab
  bioTab.prepend(sectionHtml);

  // Bind relationship point change events
  jqHtml.find(".ft5e-rel-input").on("change", async (ev) => {
    ev.preventDefault();
    const targetId = ev.currentTarget.dataset.targetId;
    const newVal = parseInt(ev.currentTarget.value);
    if (!isNaN(newVal) && targetId) {
      await setRelazione(actor, targetId, newVal);
    }
  });

  // Bind growth token change events
  jqHtml.find(".ft5e-growth-input").on("change", async (ev) => {
    ev.preventDefault();
    const newVal = parseInt(ev.currentTarget.value);
    if (!isNaN(newVal)) {
      await setGrowthTokens(actor, newVal);
    }
  });
}

/* -------------------------------------------------- */
/*  Hooks                                             */
/* -------------------------------------------------- */

Hooks.on("renderActorSheet", injectRelazioniUI);
Hooks.on("renderActorSheet5eCharacter2", injectRelazioniUI);
Hooks.on("renderActorSheetV2", injectRelazioniUI);
Hooks.on("renderActorSheet5eCharacter", injectRelazioniUI);
