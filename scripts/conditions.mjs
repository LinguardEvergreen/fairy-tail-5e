/**
 * Fairy Tail 5e — Custom Conditions
 *
 * Registers 5 custom conditions as FoundryVTT status effects:
 * - Silenziato (Silenced)
 * - Bruciato (Burned)
 * - Rallentato (Slowed)
 * - Celestia (Celestial Curse)
 * - Occhio del Ciclone (Eye of the Cyclone)
 */

const MODULE_ID = "fairy-tail-5e";

const FT5E_CONDITIONS = {
  silenziato: {
    label: "Silenziato",
    icon: "icons/svg/mute.svg",
    reference: "",
    description:
      `<p>Un bersaglio sotto l'effetto di <strong>Silenziato</strong> subisce i seguenti effetti:</p>
      <ul>
        <li>Non può utilizzare incantesimi con componente <strong>Verbale</strong> o <strong>Sonora</strong>.</li>
        <li>Fallisce automaticamente tutte le prove che richiedono l'uso del suono.</li>
        <li>Tutti gli effetti attivi basati sul suono terminano immediatamente.</li>
      </ul>`
  },

  bruciato: {
    label: "Bruciato",
    icon: "icons/svg/fire.svg",
    levels: 10,
    reference: "",
    description:
      `<p><strong>Applicazione:</strong> Quando una creatura viene colpita da un attacco di <strong>fuoco</strong>, ottiene un numero di segni di <strong>Bruciato</strong> pari alla metà del danno da fuoco subito (arrotondato per eccesso).</p>
      <p>Il numero massimo di segni di Bruciato che una creatura può avere contemporaneamente è pari al <strong>modificatore da incantatore + bonus di competenza</strong> dell'attaccante.</p>
      <p>Alla fine del suo turno, una creatura Bruciata subisce <strong>1d4 danni da fuoco</strong> per ogni segno di Bruciato.</p>
      <p><strong>Rimuovere Bruciato:</strong> Una creatura può usare un'<strong>Azione Bonus</strong> per tentare di spegnere le fiamme:</p>
      <ul>
        <li><strong>Resilienza:</strong> Tiro salvezza su <strong>Costituzione</strong> (CD 10 + numero di segni). In caso di successo, rimuove segni pari al modificatore di Costituzione (minimo 1).</li>
        <li><strong>Destrezza:</strong> Prova di <strong>Destrezza</strong> (CD 10 + numero di segni). In caso di successo, rimuove segni pari a metà del modificatore di Destrezza, arrotondato per difetto (minimo 1).</li>
      </ul>`
  },

  rallentato: {
    label: "Rallentato",
    icon: "icons/svg/downgrade.svg",
    reference: "",
    description:
      `<p>Una creatura con la condizione <strong>Rallentato</strong> considera tutti i movimenti come <strong>terreno difficile</strong> fino al termine della condizione, che avviene alla fine del suo turno successivo.</p>`
  },

  celestia: {
    label: "Celestia",
    icon: "icons/svg/sun.svg",
    levels: 5,
    reference: "",
    description:
      `<p>Il bersaglio viene sopraffatto dal potere dei corpi celesti, subendo diversi effetti debilitanti in base al <strong>grado</strong> della condizione:</p>
      <ul>
        <li><strong>Grado 1 – Presa della Gravità:</strong> Il bersaglio ha svantaggio alle prove di <strong>Forza</strong> e ai tiri salvezza su Forza.</li>
        <li><strong>Grado 2 – Vincolo di Orione:</strong> La velocità del bersaglio è ridotta di <strong>3 metri</strong> per ogni grado successivo a questo.</li>
        <li><strong>Grado 4 – Sguardo di Altairis:</strong> Il bersaglio ha svantaggio ai tiri salvezza su <strong>Costituzione</strong>.</li>
        <li><strong>Grado 5 – Prigione delle Pleiadi:</strong> Il bersaglio è <strong>Trattenuto</strong>.</li>
      </ul>
      <p>La condizione <strong>Celestia</strong> dura <strong>1 minuto</strong>. Alla fine di ciascun suo turno, una creatura può ripetere il tiro salvezza associato al grado attuale della condizione, terminandola su se stessa in caso di successo.</p>`
  },

  "occhio-del-ciclone": {
    label: "Occhio del Ciclone",
    icon: "icons/svg/windmill.svg",
    levels: 5,
    reference: "",
    description:
      `<ul>
        <li><strong>Riduzione della Velocità:</strong> La velocità di una creatura è ridotta di <strong>3 metri</strong> per ogni grado di Occhio del Ciclone che possiede.</li>
        <li><strong>Svantaggio ai Tiri Salvezza:</strong> Al <strong>3° grado</strong> di Occhio del Ciclone, la creatura ha svantaggio ai tiri salvezza su <strong>Forza</strong> e <strong>Destrezza</strong>.</li>
        <li><strong>Danno Tagliente:</strong> All'inizio del suo turno, la creatura subisce <strong>1d4 danni taglienti</strong> per ogni grado di Occhio del Ciclone che possiede.</li>
        <li><strong>Terminare la Condizione:</strong> Alla fine di ciascun suo turno, la creatura può ripetere il tiro salvezza che ha causato la condizione. In caso di successo, la condizione termina.</li>
      </ul>`
  }
};

/* -------------------------------------------------- */
/*  Register conditions                               */
/* -------------------------------------------------- */

Hooks.once("init", () => {
  try {
    // Register each custom condition into the dnd5e condition types
    if (CONFIG.DND5E?.conditionTypes) {
      for (const [id, data] of Object.entries(FT5E_CONDITIONS)) {
        const entry = {
          label: data.label,
          icon: data.icon,
          pseudo: false
        };
        if (data.levels) entry.levels = data.levels;
        CONFIG.DND5E.conditionTypes[id] = entry;
      }
      console.log(`${MODULE_ID} | Registered ${Object.keys(FT5E_CONDITIONS).length} custom conditions`);
    }
  } catch (err) {
    console.error(`${MODULE_ID} | Error registering conditions:`, err);
  }
});

/* -------------------------------------------------- */
/*  Add condition descriptions to chat/journal        */
/* -------------------------------------------------- */

Hooks.once("ready", () => {
  try {
    for (const [id, data] of Object.entries(FT5E_CONDITIONS)) {
      const effect = CONFIG.statusEffects?.find(e => e.id === id);
      if (effect && data.description) {
        effect.description = data.description;
      }
    }
  } catch (err) {
    console.error(`${MODULE_ID} | Error enriching condition descriptions:`, err);
  }
});
