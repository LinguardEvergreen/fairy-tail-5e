/**
 * Fairy Tail 5e — Punti di Relazione & Growth Token
 *
 * Adds a "Punti di Relazione" section to the character biography tab
 * showing all PCs in the campaign with editable relationship values.
 * Also tracks Growth Tokens assignable by the GM only.
 * Players can spend tokens via a dialog with all available options.
 *
 * Relationship points are used for Attacchi Combo and Unison Raid.
 */

const MODULE_ID = "fairy-tail-5e";
const FLAG_RELAZIONI = "relazioni";
const FLAG_GROWTH = "growthTokens";
const FLAG_GROWTH_LOG = "growthLog";

/* -------------------------------------------------- */
/*  Data Helpers                                      */
/* -------------------------------------------------- */

function getRelazioni(actor) {
  return actor.getFlag(MODULE_ID, FLAG_RELAZIONI) || {};
}

async function setRelazione(actor, targetId, points) {
  const current = getRelazioni(actor);
  current[targetId] = Math.max(0, parseInt(points) || 0);
  await actor.setFlag(MODULE_ID, FLAG_RELAZIONI, current);
}

function getGrowthTokens(actor) {
  return actor.getFlag(MODULE_ID, FLAG_GROWTH) ?? 0;
}

async function setGrowthTokens(actor, count) {
  await actor.setFlag(MODULE_ID, FLAG_GROWTH, Math.max(0, parseInt(count) || 0));
}

function getGrowthLog(actor) {
  return actor.getFlag(MODULE_ID, FLAG_GROWTH_LOG) || [];
}

async function addGrowthLog(actor, entry) {
  const log = getGrowthLog(actor);
  log.push({ ...entry, date: Date.now() });
  await actor.setFlag(MODULE_ID, FLAG_GROWTH_LOG, log);
}

/* -------------------------------------------------- */
/*  Growth Token Dialog — Multi-step flow             */
/* -------------------------------------------------- */

const REFINE_OPTIONS = [
  { id: "gittata-doppia",     label: "Gittata Doppia",                desc: "La durata è aumentata della metà, e metà dei dadi di danno viene aggiunta di nuovo." },
  { id: "riduzione-mp",       label: "Riduzione Costo MP",            desc: "Riduci il costo in MP della caratteristica di 1 per ogni rango della stessa (lv.1 = -1, lv.3 = -2, lv.6 = -3, ecc.). Minimo 1 MP." },
  { id: "tecnica-gratis",     label: "Tecnica Livello 1 Gratis",      desc: "Una feature di livello 1 può costare 0 una sola volta (non può essere un'abilità definitiva)." },
  { id: "altra-caratteristica",label: "Altra Caratteristica",          desc: "Prendi un'altra feature dalla magia, seguendo l'ordine dei livelli." },
  { id: "bonus-ca",           label: "+1 CA (+2 se Lv.11+)",          desc: "Aggiungere +1 alla CA (o +2 se Livello 11 o alta caratteristica)." },
  { id: "resistenza",         label: "Resistenza Aggiuntiva",         desc: "Aggiungere una resistenza aggiuntiva o trasformarla in danno magico (se Livello 11+)." },
  { id: "bonus-attacco",      label: "+1 Tiro per Colpire / +2 Danni",desc: "Aggiungere +1 al tiro per colpire o +2 ai danni." },
  { id: "multi-potenziamento", label: "Potenziamenti Multipli",       desc: "Se la caratteristica fa più cose, selezionare massimo 2 potenziamenti (3 se Livello 11)." },
];

/**
 * Load all magics and their features from the compendiums.
 */
async function loadMagieAndFeatures() {
  const magiePack = game.packs.get(`${MODULE_ID}.ft5e-magie`);
  const featurePack = game.packs.get(`${MODULE_ID}.ft5e-feature-magie`);
  if (!magiePack || !featurePack) return { magies: [], features: [] };

  const magies = (await magiePack.getDocuments()).map(d => ({
    id: d.id, name: d.name, img: d.img
  }));
  const features = (await featurePack.getDocuments()).map(d => ({
    id: d.id, name: d.name, img: d.img,
    magia: d.system?.requirements || ""
  }));
  return { magies, features };
}

/**
 * Finalize: decrement token, add feature to actor, log, notify chat.
 */
async function finalizeGrowthSpend(actor, tokens, choiceLabel, details) {
  // Add the chosen feature item to the actor
  if (details.featureId) {
    try {
      const featurePack = game.packs.get(`${MODULE_ID}.ft5e-feature-magie`);
      if (featurePack) {
        const sourceDoc = await featurePack.getDocument(details.featureId);
        if (sourceDoc) {
          const itemData = sourceDoc.toObject();
          // Mark it as a growth token acquisition
          itemData.flags = itemData.flags || {};
          itemData.flags[MODULE_ID] = {
            ...(itemData.flags[MODULE_ID] || {}),
            growthToken: true,
            source: "fairy-tail-5e"
          };
          await actor.createEmbeddedDocuments("Item", [itemData]);
        }
      }
    } catch (err) {
      console.error(`${MODULE_ID} | Error adding feature to actor:`, err);
      ui.notifications.error("Errore nell'aggiungere la feature al personaggio.");
    }
  }

  await setGrowthTokens(actor, tokens - 1);
  await addGrowthLog(actor, {
    label: choiceLabel,
    ...details,
    tokensRemaining: tokens - 1
  });
  const chatContent = `
    <div class="ft5e-growth-chat">
      <strong>${actor.name}</strong> ha speso 1 Growth Token!<br>
      <em>${choiceLabel}</em>
      ${details.magia ? `<br>Magia: <strong>${details.magia}</strong>` : ""}
      ${details.feature ? `<br>Feature: <strong>${details.feature}</strong>` : ""}
      ${details.notes ? `<br><small>${details.notes}</small>` : ""}
      <br><small>Token rimanenti: ${tokens - 1}</small>
    </div>
  `;
  ChatMessage.create({ content: chatContent, speaker: ChatMessage.getSpeaker({ actor }) });
  ui.notifications.info(`Growth Token speso: ${choiceLabel}. Rimanenti: ${tokens - 1}`);
}

/* ── Step 3: Select feature from chosen magic ── */

function openFeatureSelectDialog(actor, tokens, magiaName, features, choiceContext) {
  const magiaFeatures = features.filter(f => f.magia === magiaName);
  if (magiaFeatures.length === 0) {
    ui.notifications.warn(`Nessuna feature trovata per ${magiaName}.`);
    return;
  }

  let rowsHtml = magiaFeatures.map(f => `
    <div class="ft5e-gd-option">
      <label class="ft5e-gd-option-label">
        <input type="radio" name="feature-choice" value="${f.id}" data-name="${f.name}" />
        <img src="${f.img}" width="24" height="24" style="border-radius:4px; margin-right:4px;" />
        <strong>${f.name}</strong>
      </label>
    </div>
  `).join("");

  new Dialog({
    title: `Scegli Feature — ${magiaName}`,
    content: `
      <div class="ft5e-growth-dialog">
        <p class="ft5e-gd-info"><i class="fas fa-scroll"></i> Seleziona la feature di <strong>${magiaName}</strong>:</p>
        <hr>
        <div class="ft5e-gd-options ft5e-gd-scrollable">${rowsHtml}</div>
        <hr>
        <div class="ft5e-gd-notes">
          <label><strong>Note aggiuntive:</strong></label>
          <textarea class="ft5e-gd-notes-input" rows="2" placeholder="Dettagli..."></textarea>
        </div>
      </div>
    `,
    buttons: {
      confirm: {
        icon: '<i class="fas fa-check"></i>',
        label: "Conferma",
        callback: async (html) => {
          const selectedRadio = html.find('input[name="feature-choice"]:checked');
          if (!selectedRadio.length) {
            ui.notifications.warn("Seleziona una feature!");
            return;
          }
          const featureId = selectedRadio.val();
          const featureName = selectedRadio.data("name");
          const notes = html.find('.ft5e-gd-notes-input').val() || "";
          await finalizeGrowthSpend(actor, tokens, choiceContext.label, {
            choice: choiceContext.id,
            magia: magiaName,
            feature: featureName,
            featureId,
            notes
          });
        }
      },
      back: {
        icon: '<i class="fas fa-arrow-left"></i>',
        label: "Indietro",
        callback: () => openMagiaSelectDialog(actor, tokens, choiceContext, features)
      }
    },
    default: "confirm"
  }, { width: 480, height: "auto", classes: ["ft5e-growth-dialog-window"] }).render(true);
}

/* ── Step 2: Select magic ── */

function openMagiaSelectDialog(actor, tokens, choiceContext, features) {
  // Use cached magies or load
  const magieNames = [...new Set(features.map(f => f.magia).filter(Boolean))].sort();

  let rowsHtml = magieNames.map(name => `
    <div class="ft5e-gd-option">
      <label class="ft5e-gd-option-label">
        <input type="radio" name="magia-choice" value="${name}" />
        <strong>${name}</strong>
      </label>
    </div>
  `).join("");

  new Dialog({
    title: `Scegli Magia — ${choiceContext.label}`,
    content: `
      <div class="ft5e-growth-dialog">
        <p class="ft5e-gd-info"><i class="fas fa-hat-wizard"></i> Seleziona la magia:</p>
        <hr>
        <div class="ft5e-gd-options">${rowsHtml}</div>
      </div>
    `,
    buttons: {
      next: {
        icon: '<i class="fas fa-arrow-right"></i>',
        label: "Avanti",
        callback: (html) => {
          const magiaName = html.find('input[name="magia-choice"]:checked').val();
          if (!magiaName) {
            ui.notifications.warn("Seleziona una magia!");
            return;
          }
          openFeatureSelectDialog(actor, tokens, magiaName, features, choiceContext);
        }
      },
      back: {
        icon: '<i class="fas fa-arrow-left"></i>',
        label: "Indietro",
        callback: () => openGrowthDialog(actor)
      }
    },
    default: "next"
  }, { width: 480, height: "auto", classes: ["ft5e-growth-dialog-window"] }).render(true);
}

/* ── Step 1: Main Growth Token dialog ── */

async function openGrowthDialog(actor) {
  const tokens = getGrowthTokens(actor);
  if (tokens <= 0) {
    ui.notifications.warn("Nessun Growth Token disponibile!");
    return;
  }

  // Pre-load features for later steps
  const { features } = await loadMagieAndFeatures();

  // Build options HTML
  let refineRows = REFINE_OPTIONS.map(opt => `
    <div class="ft5e-gd-option">
      <label class="ft5e-gd-option-label">
        <input type="radio" name="growth-choice" value="${opt.id}" />
        <strong>${opt.label}</strong>
      </label>
      <p class="ft5e-gd-option-desc">${opt.desc}</p>
    </div>
  `).join("");

  const dialogContent = `
    <div class="ft5e-growth-dialog">
      <p class="ft5e-gd-info">
        <i class="fas fa-seedling"></i>
        <strong>${actor.name}</strong> ha <strong>${tokens}</strong> Growth Token disponibil${tokens === 1 ? "e" : "i"}.
      </p>
      <p class="ft5e-gd-info-sub">Seleziona come vuoi utilizzare 1 Growth Token:</p>
      <hr>
      <h3 class="ft5e-gd-category">Ottenere nuove magie</h3>
      <div class="ft5e-gd-option">
        <label class="ft5e-gd-option-label">
          <input type="radio" name="growth-choice" value="nuova-magia" />
          <strong>Nuova Magia</strong>
        </label>
        <p class="ft5e-gd-option-desc">Prendi 1 feature da una nuova magia, seguendo l'ordine dei livelli: 1, 3, 6, 11, 18.</p>
      </div>
      <h3 class="ft5e-gd-category">Raffinare magia esistente (scegli 2 opzioni per token)</h3>
      ${refineRows}
    </div>
  `;

  new Dialog({
    title: `Growth Token — ${actor.name}`,
    content: dialogContent,
    buttons: {
      next: {
        icon: '<i class="fas fa-arrow-right"></i>',
        label: "Avanti",
        callback: async (html) => {
          const choice = html.find('input[name="growth-choice"]:checked').val();
          if (!choice) {
            ui.notifications.warn("Seleziona un'opzione!");
            return;
          }

          if (choice === "nuova-magia") {
            // → Step 2: select magic, then feature
            openMagiaSelectDialog(actor, tokens, { id: "nuova-magia", label: "Nuova Magia" }, features);
          } else {
            // Refinement: also need to pick which magic/feature to refine
            const opt = REFINE_OPTIONS.find(o => o.id === choice);
            openMagiaSelectDialog(actor, tokens, { id: choice, label: opt?.label || choice }, features);
          }
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Annulla"
      }
    },
    default: "cancel"
  }, { width: 520, height: "auto", classes: ["ft5e-growth-dialog-window"] }).render(true);
}

/* -------------------------------------------------- */
/*  UI Injection                                      */
/* -------------------------------------------------- */

function injectRelazioniUI(app, html, data) {
  try {
    const actor = app.actor ?? app.document;
    if (!actor || actor.type !== "character") return;

    const jqHtml = html instanceof jQuery ? html : $(html);

    // Avoid duplicate injection
    if (jqHtml.find(".ft5e-relazioni-section").length) return;

    // Find biography tab content area (dnd5e v5 ActorSheet2)
    let bioTab = jqHtml.find('.tab[data-tab="biography"]');
    if (!bioTab.length) {
      bioTab = jqHtml.find('.tab[data-tab="biography"] .editor, .biography');
    }
    if (!bioTab.length) return;

    // Get all PC actors except self
    const allPCs = game.actors?.filter(a =>
      a.type === "character" && a.id !== actor.id
    ) || [];

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

  // Growth Token: input only editable by GM, spend button for owner (when tokens > 0)
  const spendButton = (isOwner && growthTokens > 0)
    ? `<button type="button" class="ft5e-growth-spend-btn" title="Spendi Growth Token"><i class="fas fa-hand-sparkles"></i> Spendi</button>`
    : "";

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
          ${!isGM ? "disabled" : ""} title="Growth Token — solo il GM può modificare" />
        ${spendButton}
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

  // Bind growth token input (GM only)
  jqHtml.find(".ft5e-growth-input").on("change", async (ev) => {
    ev.preventDefault();
    if (!game.user.isGM) return;
    const newVal = parseInt(ev.currentTarget.value);
    if (!isNaN(newVal)) {
      await setGrowthTokens(actor, newVal);
    }
  });

  // Bind spend button
  jqHtml.find(".ft5e-growth-spend-btn").on("click", (ev) => {
    ev.preventDefault();
    openGrowthDialog(actor);
  });

  } catch (err) {
    console.error(`${MODULE_ID} | Error injecting relazioni UI:`, err);
  }
}

/* -------------------------------------------------- */
/*  Hooks                                             */
/* -------------------------------------------------- */

Hooks.on("renderActorSheet", injectRelazioniUI);
Hooks.on("renderActorSheet5eCharacter2", injectRelazioniUI);
Hooks.on("renderActorSheetV2", injectRelazioniUI);
Hooks.on("renderActorSheet5eCharacter", injectRelazioniUI);
