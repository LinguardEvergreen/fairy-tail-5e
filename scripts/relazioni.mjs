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
/*  Growth Token Dialog                               */
/* -------------------------------------------------- */

const GROWTH_OPTIONS = [
  {
    category: "Ottenere nuove magie",
    options: [
      {
        id: "nuova-magia",
        label: "Nuova Magia",
        desc: "Prendi 1 caratteristica da una nuova magia, seguendo l'ordine dei livelli: 1, 3, 6, 11, 18.",
        needsInput: true,
        placeholder: "Nome della magia e caratteristica scelta..."
      }
    ]
  },
  {
    category: "Raffinare magia esistente (scegli 2 opzioni per token)",
    options: [
      {
        id: "gittata-doppia",
        label: "Gittata Doppia",
        desc: "La durata è aumentata della metà, e metà dei dadi di danno viene aggiunta di nuovo."
      },
      {
        id: "riduzione-mp",
        label: "Riduzione Costo MP",
        desc: "Riduci il costo in MP della caratteristica di 1 per ogni rango della stessa (lv.1 = -1, lv.3 = -2, lv.6 = -3, ecc.). Minimo 1 MP."
      },
      {
        id: "tecnica-gratis",
        label: "Tecnica Livello 1 Gratis",
        desc: "Una tecnica di livello 1 può costare 0 una sola volta (non può essere un'abilità definitiva)."
      },
      {
        id: "altra-caratteristica",
        label: "Altra Caratteristica",
        desc: "Prendi un'altra caratteristica dalla magia, seguendo l'ordine dei livelli."
      },
      {
        id: "bonus-ca",
        label: "+1 CA (+2 se Lv.11+)",
        desc: "Aggiungere +1 alla CA (o +2 se Livello 11 o alta caratteristica)."
      },
      {
        id: "resistenza",
        label: "Resistenza Aggiuntiva",
        desc: "Aggiungere una resistenza aggiuntiva o trasformarla in danno magico (se Livello 11+)."
      },
      {
        id: "bonus-attacco",
        label: "+1 Tiro per Colpire / +2 Danni",
        desc: "Aggiungere +1 al tiro per colpire o +2 ai danni."
      },
      {
        id: "multi-potenziamento",
        label: "Potenziamenti Multipli",
        desc: "Se la caratteristica fa più cose, selezionare massimo 2 potenziamenti (3 se Livello 11)."
      }
    ]
  }
];

/**
 * Open the Growth Token spending dialog for the actor.
 */
async function openGrowthDialog(actor) {
  const tokens = getGrowthTokens(actor);
  if (tokens <= 0) {
    ui.notifications.warn("Nessun Growth Token disponibile!");
    return;
  }

  // Build options HTML
  let optionsHtml = "";
  for (const cat of GROWTH_OPTIONS) {
    optionsHtml += `<h3 class="ft5e-gd-category">${cat.category}</h3>`;
    for (const opt of cat.options) {
      optionsHtml += `
        <div class="ft5e-gd-option">
          <label class="ft5e-gd-option-label">
            <input type="radio" name="growth-choice" value="${opt.id}" />
            <strong>${opt.label}</strong>
          </label>
          <p class="ft5e-gd-option-desc">${opt.desc}</p>
          ${opt.needsInput ? `<input type="text" class="ft5e-gd-option-input" data-for="${opt.id}" placeholder="${opt.placeholder}" style="display:none;" />` : ""}
        </div>
      `;
    }
  }

  const dialogContent = `
    <div class="ft5e-growth-dialog">
      <p class="ft5e-gd-info">
        <i class="fas fa-seedling"></i>
        <strong>${actor.name}</strong> ha <strong>${tokens}</strong> Growth Token disponibil${tokens === 1 ? "e" : "i"}.
      </p>
      <p class="ft5e-gd-info-sub">Seleziona come vuoi utilizzare 1 Growth Token:</p>
      <hr>
      <div class="ft5e-gd-options">
        ${optionsHtml}
      </div>
      <hr>
      <div class="ft5e-gd-notes">
        <label><strong>Note aggiuntive:</strong></label>
        <textarea class="ft5e-gd-notes-input" rows="2" placeholder="Dettagli sulla scelta (es. quale magia, quale caratteristica...)"></textarea>
      </div>
    </div>
  `;

  const dialog = new Dialog({
    title: `Growth Token — ${actor.name}`,
    content: dialogContent,
    buttons: {
      spend: {
        icon: '<i class="fas fa-check"></i>',
        label: "Spendi Token",
        callback: async (html) => {
          const choice = html.find('input[name="growth-choice"]:checked').val();
          if (!choice) {
            ui.notifications.warn("Seleziona un'opzione prima di spendere il token!");
            return;
          }

          const notes = html.find('.ft5e-gd-notes-input').val() || "";
          const extraInput = html.find(`.ft5e-gd-option-input[data-for="${choice}"]`).val() || "";

          // Find the label for the chosen option
          let choiceLabel = choice;
          for (const cat of GROWTH_OPTIONS) {
            const found = cat.options.find(o => o.id === choice);
            if (found) { choiceLabel = found.label; break; }
          }

          // Decrement token
          await setGrowthTokens(actor, tokens - 1);

          // Log the spend
          await addGrowthLog(actor, {
            choice: choice,
            label: choiceLabel,
            notes: notes,
            extraInput: extraInput,
            tokensRemaining: tokens - 1
          });

          // Notify in chat
          const chatContent = `
            <div class="ft5e-growth-chat">
              <strong>${actor.name}</strong> ha speso 1 Growth Token!<br>
              <em>${choiceLabel}</em>${notes ? `<br><small>${notes}</small>` : ""}${extraInput ? `<br><small>${extraInput}</small>` : ""}
              <br><small>Token rimanenti: ${tokens - 1}</small>
            </div>
          `;
          ChatMessage.create({ content: chatContent, speaker: ChatMessage.getSpeaker({ actor }) });

          ui.notifications.info(`Growth Token speso: ${choiceLabel}. Rimanenti: ${tokens - 1}`);
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Annulla"
      }
    },
    default: "cancel",
    render: (html) => {
      // Show/hide text input when "nuova-magia" is selected
      html.find('input[name="growth-choice"]').on("change", (ev) => {
        html.find('.ft5e-gd-option-input').hide();
        const val = ev.currentTarget.value;
        html.find(`.ft5e-gd-option-input[data-for="${val}"]`).show();
      });
    }
  }, {
    width: 520,
    height: "auto",
    classes: ["ft5e-growth-dialog-window"]
  });
  dialog.render(true);
}

/* -------------------------------------------------- */
/*  UI Injection                                      */
/* -------------------------------------------------- */

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
}

/* -------------------------------------------------- */
/*  Hooks                                             */
/* -------------------------------------------------- */

Hooks.on("renderActorSheet", injectRelazioniUI);
Hooks.on("renderActorSheet5eCharacter2", injectRelazioniUI);
Hooks.on("renderActorSheetV2", injectRelazioniUI);
Hooks.on("renderActorSheet5eCharacter", injectRelazioniUI);
