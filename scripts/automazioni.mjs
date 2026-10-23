/**
 * Fairy Tail 5e — Automazioni
 *
 * - Permessi delle macro "FT5E ..." per i giocatori
 * - Bruciato automatico su chi subisce danni da fuoco (capitolo Condizioni),
 *   piu' i gradi extra indicati da alcuni incantesimi
 * - Celestia automatica dai talenti Maledizione Celeste e Guida di Orione
 * - Effetti di fine turno: danni da Bruciato, scadenza della Celestia
 *
 * Le modifiche ai bersagli le esegue UN solo client, il GM attivo (via socketlib
 * quando a colpire e' un giocatore, che non puo' modificare attori non suoi).
 * Un hook che applica effetti su ogni client li applicherebbe piu' volte.
 */

const MODULE_ID = "fairy-tail-5e";
const BRUCIATO = "ft5eBruciato";
const CELESTIA = "ft5eCelestia";
const CELESTIA_GRADO_MAX = 5;
const SOCKET_HANDLER = "applicaCondizioni";

/** Stesso _id che dnd5e assegna all'effetto di stato: cosi' l'HUD del token e
 *  l'automazione lavorano sullo stesso effetto invece di crearne due. */
const idStato = id => `dnd5e${id}`.padEnd(16, "0").substring(0, 16);

let socket = null;
const usiGestiti = new Map();

/* -------------------------------------------------- */
/*  Impostazioni                                      */
/* -------------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "automazioneCondizioni", {
    name: "Condizioni automatiche (Bruciato e Celestia)",
    hint: "Applica da sola Bruciato a chi subisce danni da fuoco e Celestia quando la infliggono i talenti Maledizione Celeste e Guida di Orione, e gestisce i loro effetti a fine turno.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("socketlib.ready", () => {
  try {
    socket = socketlib.registerModule(MODULE_ID);
    socket?.register(SOCKET_HANDLER, applicaCondizioniGM);
  } catch (err) {
    console.warn(`${MODULE_ID} | socketlib non disponibile per le condizioni:`, err);
  }
});

Hooks.once("ready", async () => {
  const mod = game.modules.get(MODULE_ID);
  mod.api = Object.assign(mod.api ?? {}, {
    condizioni: { aggiungiBruciato, rimuoviBruciato, aggiungiCelestia, impostaCelestia, fineTurno }
  });
  if (game.user === game.users.activeGM) await sbloccaMacroFT5E();
});

/* -------------------------------------------------- */
/*  Permessi delle macro                              */
/* -------------------------------------------------- */

/**
 * Le macro FT5E sono chiamate da midi-qol sul client di chi usa l'oggetto, e
 * Macro#execute richiede almeno il permesso LIMITED: senza, ai giocatori compare
 * "You do not have permission to execute Macro".
 */
async function sbloccaMacroFT5E() {
  const LIMITED = CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED;
  const bloccate = game.macros.filter(m => /^FT5E\b/.test(m.name) && (m.ownership.default ?? 0) < LIMITED);
  if (!bloccate.length) return;
  await Macro.updateDocuments(bloccate.map(m => ({ _id: m.id, "ownership.default": LIMITED })));
  console.log(`${MODULE_ID} | Macro rese eseguibili dai giocatori: ${bloccate.map(m => m.name).join(", ")}`);
}

/* -------------------------------------------------- */
/*  Chi infligge Celestia                             */
/* -------------------------------------------------- */

/**
 * Per il manuale la Celestia la infliggono solo due talenti:
 * - Maledizione Celeste: le capacita' Potenziamento Celestiale e Raccolta Celeste
 *   (le capacita' della sottoclasse Magia del Corpo Celeste);
 * - Guida di Orione: la capacita' Orione.
 * Il costo di 1 MP di "Lancio Maledetto" (uso senza frammento) resta manuale.
 */
function infliggeCelestia(attore, item, activity) {
  // solo usi offensivi: un buff della stessa magia non deve maledire l'alleato
  if (!["attack", "save", "damage"].includes(activity?.type)) return false;
  const haTalento = regola => attore.items.some(i => i.type === "feat" && regola.test(i.name));
  if (haTalento(/maledizione celeste/i) && /corpo celeste/i.test(item?.system?.requirements ?? "")) return true;
  if (haTalento(/guida di orione/i) && /orion/i.test(`${item?.name} ${activity?.name}`)) return true;
  return false;
}

/* -------------------------------------------------- */
/*  Gradi di Bruciato indicati dagli incantesimi      */
/* -------------------------------------------------- */

/**
 * Questi incantesimi indicano dei gradi di Bruciato: si aggiungono ai segni
 * dati dal danno da fuoco, non li sostituiscono.
 * colpito = attacco andato a segno, fallito / superato = esito del tiro salvezza.
 */
const BRUCIATO_EXTRA = {
  "braci": { colpito: 1 },
  "eruzione": { fallito: 1 },
  "streaming palla di fuoco": { fallito: 1 },
  "colonna di fuoco": { fallito: 1 },
  "striature di fiamme": { fallito: 2 },
  "tempesta di fuoco": { fallito: 2, superato: 1 },
  "nova solare": { fallito: 3 },
  "tiro d'attacco aereo": { fallito: 1 }
};

function gradiExtraBruciato(item, activity, salvato) {
  const nome = (item?.name ?? "").toLowerCase().replace(/[’`]/g, "'").trim();
  const extra = BRUCIATO_EXTRA[nome];
  if (!extra) return 0;
  if (activity?.type === "save") return (salvato ? extra.superato : extra.fallito) ?? 0;
  return extra.colpito ?? extra.fallito ?? 0;
}

/* -------------------------------------------------- */
/*  Raccolta dopo l'uso di un oggetto (midi-qol)      */
/* -------------------------------------------------- */

/** Massimo di segni: modificatore da incantatore + bonus di competenza dell'attaccante. */
function capBruciato(attore) {
  const ab = attore?.system?.abilities ?? {};
  const chiave = attore?.system?.attributes?.spellcasting;
  const mod = chiave && ab[chiave]
    ? ab[chiave].mod
    : Math.max(ab.int?.mod ?? 0, ab.wis?.mod ?? 0, ab.cha?.mod ?? 0);
  return Math.max(1, (mod ?? 0) + (attore?.system?.attributes?.prof ?? 0));
}

function raccogliCondizioni(workflow) {
  const attore = workflow?.actor;
  const item = workflow?.item;
  if (!attore || !item) return null;

  const uuidToken = t => t?.document?.uuid ?? t?.uuid;
  const tokenLanciatore = uuidToken(workflow.token);
  const eLanciatore = (tok, act) => act === attore.uuid || (!!tokenLanciatore && tok === tokenLanciatore);

  const bersagli = new Map();
  const voce = (tokenUuid, actorUuid) => {
    const chiave = tokenUuid ?? actorUuid;
    if (!bersagli.has(chiave)) bersagli.set(chiave, { tokenUuid: tokenUuid ?? null, actorUuid: actorUuid ?? null, segni: 0, celestia: 0 });
    return bersagli.get(chiave);
  };

  // damageDetail riporta il danno per tipo gia' ridotto da resistenze e immunita':
  // chi non subisce danni da fuoco (es. immune) non brucia, neanche coi gradi extra
  for (const d of workflow.damageList ?? []) {
    if (d.wasHit === false || eLanciatore(d.targetUuid, d.actorUuid)) continue;
    const fuoco = (d.damageDetail ?? [])
      .filter(x => x.type === "fire")
      .reduce((somma, x) => somma + Math.max(0, Number(x.value) || 0), 0);
    if (fuoco <= 0) continue;
    voce(d.targetUuid, d.actorUuid).segni += Math.ceil(fuoco / 2) + gradiExtraBruciato(item, workflow.activity, d.saved);
  }

  if (infliggeCelestia(attore, item, workflow.activity)) {
    const salvati = new Set([...(workflow.saves ?? [])].map(uuidToken));
    for (const t of workflow.hitTargets ?? []) {
      const tok = uuidToken(t);
      if (!tok || salvati.has(tok) || eLanciatore(tok, t.actor?.uuid)) continue;
      voce(tok, t.actor?.uuid).celestia = 1;
    }
  }

  const lista = [...bersagli.values()].filter(b => b.segni > 0 || b.celestia > 0);
  if (!lista.length) return null;
  return {
    // la carta in chat e' unica per ogni uso: chiave anti doppia applicazione
    uso: workflow.itemCardUuid ?? workflow.itemCardId ?? foundry.utils.randomID(),
    attoreNome: attore.name,
    fonte: item.name,
    capBruciato: capBruciato(attore),
    bersagli: lista
  };
}

Hooks.on("midi-qol.RollComplete", async workflow => {
  try {
    if (!game.settings.get(MODULE_ID, "automazioneCondizioni")) return;
    const dati = raccogliCondizioni(workflow);
    if (!dati) return;
    if (game.user.isGM) return await applicaCondizioniGM(dati);
    if (socket && game.users.activeGM) return await socket.executeAsGM(SOCKET_HANDLER, dati);
    ui.notifications.warn("Fairy Tail 5e: nessun GM connesso, Bruciato e Celestia non sono stati applicati.");
  } catch (err) {
    console.warn(`${MODULE_ID} | Condizioni automatiche non applicate:`, err);
  }
});

/* -------------------------------------------------- */
/*  Applicazione (solo GM)                            */
/* -------------------------------------------------- */

async function applicaCondizioniGM(dati) {
  if (!game.user.isGM) return;
  const ora = Date.now();
  for (const [chiave, quando] of usiGestiti) if (ora - quando > 60000) usiGestiti.delete(chiave);
  if (usiGestiti.has(dati.uso)) return;
  usiGestiti.set(dati.uso, ora);

  const righe = [];
  for (const b of dati.bersagli) {
    const tokenDoc = b.tokenUuid ? await fromUuid(b.tokenUuid) : null;
    const attore = tokenDoc?.actor ?? (b.actorUuid ? await fromUuid(b.actorUuid) : null);
    if (!attore) continue;
    if (b.segni > 0) {
      const esito = await aggiungiBruciato(attore, b.segni, dati.capBruciato);
      if (esito) righe.push(`<i class="fas fa-fire"></i> <strong>${attore.name}</strong>: Bruciato ${esito.prima} → <strong>${esito.dopo}</strong> ${esito.dopo === 1 ? "segno" : "segni"}`);
    }
    if (b.celestia > 0) {
      const esito = await aggiungiCelestia(attore, b.celestia);
      if (esito) righe.push(`<i class="fas fa-star"></i> <strong>${attore.name}</strong>: Celestia grado ${esito.prima} → <strong>${esito.dopo}</strong>`);
    }
  }
  if (righe.length) {
    ChatMessage.create({
      content: `<div class="ft5e-mana-chat"><strong>${dati.fonte}</strong> (${dati.attoreNome})<br>${righe.join("<br>")}</div>`,
      speaker: { alias: dati.attoreNome }
    });
  }
}

function trovaEffetto(attore, stato) {
  return attore.effects.find(e => e.statuses?.has(stato));
}

/* ---- Bruciato ---- */

async function impostaBruciato(attore, segni, effetto = trovaEffetto(attore, BRUCIATO)) {
  if (segni <= 0) {
    if (effetto) await effetto.delete();
    return;
  }
  if (effetto) {
    return effetto.update({ name: `Bruciato (${segni})`, [`flags.${MODULE_ID}.segni`]: segni });
  }
  const base = CONFIG.statusEffects.find(s => s.id === BRUCIATO);
  return ActiveEffect.implementation.create({
    _id: idStato(BRUCIATO),
    name: `Bruciato (${segni})`,
    img: base?.img ?? "icons/svg/fire.svg",
    description: base?.description ?? "",
    statuses: [BRUCIATO],
    flags: { [MODULE_ID]: { segni } }
  }, { parent: attore, keepId: true });
}

/** I nuovi segni si sommano, ma il totale non supera il massimo dell'attaccante
 *  (senza mai togliere segni gia' presenti, magari dati da qualcun altro). */
async function aggiungiBruciato(attore, segni, cap = 1) {
  const effetto = trovaEffetto(attore, BRUCIATO);
  const prima = effetto ? Number(effetto.getFlag(MODULE_ID, "segni") ?? 1) : 0;
  const dopo = Math.min(prima + segni, Math.max(cap, prima));
  if (dopo === prima) return null;
  await impostaBruciato(attore, dopo, effetto);
  return { prima, dopo };
}

async function rimuoviBruciato(attore, segni = Infinity) {
  const effetto = trovaEffetto(attore, BRUCIATO);
  if (!effetto) return;
  const attuali = Number(effetto.getFlag(MODULE_ID, "segni") ?? 1);
  await impostaBruciato(attore, Math.max(0, attuali - segni), effetto);
}

/* ---- Celestia ---- */

function modificheCelestia(grado) {
  const { OVERRIDE, ADD } = CONST.ACTIVE_EFFECT_MODES;
  // Grado 1: svantaggio a prove e TS di Forza
  const modifiche = [
    { key: "flags.midi-qol.disadvantage.ability.check.str", mode: OVERRIDE, value: "1" },
    { key: "flags.midi-qol.disadvantage.ability.save.str", mode: OVERRIDE, value: "1" }
  ];
  // Grado 2: -3 m di velocita' per ogni grado dal secondo in su
  if (grado >= 2) modifiche.push({ key: "system.attributes.movement.walk", mode: ADD, value: String(-3 * (grado - 1)) });
  // Grado 4: svantaggio ai TS di Costituzione
  if (grado >= 4) modifiche.push({ key: "flags.midi-qol.disadvantage.ability.save.con", mode: OVERRIDE, value: "1" });
  return modifiche;
}

async function impostaCelestia(attore, grado, effetto = trovaEffetto(attore, CELESTIA)) {
  if (grado <= 0) {
    if (effetto) await effetto.delete();
    return;
  }
  const combattimento = game.combat;
  const dati = {
    name: `Celestia (grado ${grado})`,
    // Grado 5: Trattenuto
    statuses: grado >= CELESTIA_GRADO_MAX ? [CELESTIA, "restrained"] : [CELESTIA],
    changes: modificheCelestia(grado),
    duration: {
      rounds: 10,
      seconds: 60,
      startTime: game.time.worldTime,
      startRound: combattimento?.round ?? null,
      startTurn: combattimento?.turn ?? null,
      combat: combattimento?.id ?? null
    },
    flags: { [MODULE_ID]: { grado } }
  };
  if (effetto) return effetto.update(dati);
  const base = CONFIG.statusEffects.find(s => s.id === CELESTIA);
  return ActiveEffect.implementation.create({
    _id: idStato(CELESTIA),
    img: base?.img ?? "icons/svg/sun.svg",
    description: base?.description ?? "",
    ...dati
  }, { parent: attore, keepId: true });
}

/** Ogni nuovo colpo aggiunge gradi e fa ripartire il minuto di durata. */
async function aggiungiCelestia(attore, gradi = 1) {
  const effetto = trovaEffetto(attore, CELESTIA);
  const prima = effetto ? Number(effetto.getFlag(MODULE_ID, "grado") ?? 1) : 0;
  const dopo = Math.min(prima + gradi, CELESTIA_GRADO_MAX);
  await impostaCelestia(attore, dopo, effetto);
  return dopo === prima ? null : { prima, dopo };
}

/* -------------------------------------------------- */
/*  Fine turno                                        */
/* -------------------------------------------------- */

Hooks.on("combatTurnChange", async (combat, prima, dopo) => {
  try {
    if (game.user !== game.users.activeGM) return;
    if (!game.settings.get(MODULE_ID, "automazioneCondizioni")) return;
    const avanti = (dopo.round > prima.round) || (dopo.round === prima.round && dopo.turn > prima.turn);
    if (!avanti) return;
    const attore = combat.combatants.get(prima.combatantId)?.actor;
    if (attore) await fineTurno(attore);
  } catch (err) {
    console.warn(`${MODULE_ID} | Effetti di fine turno non applicati:`, err);
  }
});

async function fineTurno(attore) {
  await bruciaturaFineTurno(attore);
  await celestiaFineTurno(attore);
}

/** Alla fine del suo turno la creatura subisce 1d4 danni da fuoco per segno. */
async function bruciaturaFineTurno(attore) {
  const effetto = trovaEffetto(attore, BRUCIATO);
  if (!effetto) return;
  const segni = Math.max(1, Number(effetto.getFlag(MODULE_ID, "segni") ?? 1));
  const tiro = await new Roll(`${segni}d4[fire]`).evaluate();
  await tiro.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attore }),
    flavor: `Bruciato: ${segni} ${segni === 1 ? "segno" : "segni"}, danni da fuoco a fine turno`
  });
  await attore.applyDamage([{ value: tiro.total, type: "fire", properties: new Set() }]);
}

/** Dopo 1 minuto la Celestia finisce; altrimenti ricorda il tiro salvezza. */
async function celestiaFineTurno(attore) {
  const effetto = trovaEffetto(attore, CELESTIA);
  if (!effetto) return;
  const destinatari = game.users.filter(u => u.isGM || attore.testUserPermission(u, "OWNER")).map(u => u.id);
  const restanti = effetto.duration?.remaining;
  if (Number.isFinite(restanti) && restanti <= 0) {
    await effetto.delete();
    return ChatMessage.create({
      content: `<div class="ft5e-mana-chat"><i class="fas fa-star"></i> <strong>${attore.name}</strong>: la Celestia termina, è passato 1 minuto.</div>`,
      speaker: ChatMessage.getSpeaker({ actor: attore }),
      whisper: destinatari
    });
  }
  const grado = Number(effetto.getFlag(MODULE_ID, "grado") ?? 1);
  return ChatMessage.create({
    content: `<div class="ft5e-mana-chat"><i class="fas fa-star"></i> <strong>${attore.name}</strong> (Celestia grado ${grado}) può ripetere il tiro salvezza della condizione: se lo supera, la Celestia termina.</div>`,
    speaker: ChatMessage.getSpeaker({ actor: attore }),
    whisper: destinatari
  });
}
