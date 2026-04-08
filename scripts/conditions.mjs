/**
 * Fairy Tail 5e — Custom Conditions
 *
 * Registers 5 custom conditions as FoundryVTT status effects
 * on the token HUD. Does NOT touch CONFIG.DND5E.conditionTypes
 * (which expects class instances with getLabel() in dnd5e v5.3.0).
 *
 * - Silenziato (Silenced)
 * - Bruciato (Burned)
 * - Rallentato (Slowed)
 * - Celestia (Celestial Curse)
 * - Occhio del Ciclone (Eye of the Cyclone)
 */

const MODULE_ID = "fairy-tail-5e";

const FT5E_CONDITIONS = [
  {
    id: "ft5e-silenziato",
    name: "Silenziato",
    icon: "icons/svg/mute.svg",
    description:
      `<p>Un bersaglio sotto l'effetto di <strong>Silenziato</strong> subisce i seguenti effetti:</p>
      <ul>
        <li>Non può utilizzare incantesimi con componente <strong>Verbale</strong> o <strong>Sonora</strong>.</li>
        <li>Fallisce automaticamente tutte le prove che richiedono l'uso del suono.</li>
        <li>Tutti gli effetti attivi basati sul suono terminano immediatamente.</li>
      </ul>`
  },
  {
    id: "ft5e-bruciato",
    name: "Bruciato",
    icon: "icons/svg/fire.svg",
    description:
      `<p><strong>Applicazione:</strong> Quando una creatura viene colpita da un attacco di <strong>fuoco</strong>, ottiene un numero di segni di <strong>Bruciato</strong> pari alla metà del danno da fuoco subito (arrotondato per eccesso).</p>
      <p>Il numero massimo di segni è pari al <strong>modificatore da incantatore + bonus di competenza</strong> dell'attaccante.</p>
      <p>Alla fine del suo turno, una creatura Bruciata subisce <strong>1d4 danni da fuoco</strong> per ogni segno di Bruciato.</p>
      <p><strong>Rimuovere Bruciato:</strong> Azione Bonus — Tiro salvezza su Costituzione o prova di Destrezza (CD 10 + numero di segni).</p>`
  },
  {
    id: "ft5e-rallentato",
    name: "Rallentato",
    icon: "icons/svg/downgrade.svg",
    description:
      `<p>Una creatura con la condizione <strong>Rallentato</strong> considera tutti i movimenti come <strong>terreno difficile</strong> fino al termine della condizione, che avviene alla fine del suo turno successivo.</p>`
  },
  {
    id: "ft5e-celestia",
    name: "Celestia",
    icon: "icons/svg/sun.svg",
    description:
      `<p>Effetti debilitanti in base al <strong>grado</strong>:</p>
      <ul>
        <li><strong>Grado 1:</strong> Svantaggio prove/TS Forza.</li>
        <li><strong>Grado 2:</strong> Velocità -3m per grado.</li>
        <li><strong>Grado 4:</strong> Svantaggio TS Costituzione.</li>
        <li><strong>Grado 5:</strong> Trattenuto.</li>
      </ul>
      <p>Dura 1 minuto. TS a fine turno per terminare.</p>`
  },
  {
    id: "ft5e-occhio-del-ciclone",
    name: "Occhio del Ciclone",
    icon: "icons/svg/windmill.svg",
    description:
      `<ul>
        <li><strong>Velocità:</strong> -3m per grado.</li>
        <li><strong>3° grado:</strong> Svantaggio TS Forza e Destrezza.</li>
        <li><strong>Danno:</strong> 1d4 taglienti per grado a inizio turno.</li>
        <li>TS a fine turno per terminare.</li>
      </ul>`
  }
];

/* -------------------------------------------------- */
/*  Register as status effects only                   */
/* -------------------------------------------------- */

Hooks.once("init", () => {
  try {
    for (const cond of FT5E_CONDITIONS) {
      CONFIG.statusEffects.push({
        id: cond.id,
        name: cond.name,
        icon: cond.icon,
        _id: cond.id  // used as effect ID on tokens
      });
    }
    console.log(`${MODULE_ID} | Registered ${FT5E_CONDITIONS.length} custom status effects`);
  } catch (err) {
    console.error(`${MODULE_ID} | Error registering status effects:`, err);
  }
});
