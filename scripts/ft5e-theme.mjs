/**
 * Fairy Tail 5e — UI Theme System
 *
 * Provides 5 character-themed UI skins (Natsu, Gray, Erza, Lucy, Laxus)
 * and replaces the FoundryVTT pause icon with the Fairy Tail guild logo.
 *
 * Each theme overrides CSS custom properties on <body> via a data-ft5e-theme attribute.
 * The chosen theme is stored as a per-client module setting.
 */

const MODULE_ID = "fairy-tail-5e";

/* -------------------------------------------------- */
/*  Theme Definitions                                 */
/* -------------------------------------------------- */

const THEMES = {
  natsu: {
    label: "🔥 Natsu",
    desc: "Rosso fuoco, arancione, nero"
  },
  gray: {
    label: "❄️ Gray",
    desc: "Blu ghiaccio, bianco, azzurro scuro"
  },
  erza: {
    label: "⚔️ Erza",
    desc: "Rosso scarlatto, argento, blu acciaio"
  },
  lucy: {
    label: "⭐ Lucy",
    desc: "Oro, rosa, bianco crema"
  },
  laxus: {
    label: "⚡ Laxus",
    desc: "Giallo elettrico, viola scuro, nero"
  }
};

/* -------------------------------------------------- */
/*  Apply Theme                                       */
/* -------------------------------------------------- */

function applyTheme(themeId) {
  document.body.setAttribute("data-ft5e-theme", themeId || "natsu");
}

/* -------------------------------------------------- */
/*  Pause Logo Override                               */
/* -------------------------------------------------- */

function replacePauseLogo() {
  // FoundryVTT v13 uses #pause > img for the pause icon
  Hooks.on("renderPause", (app, html) => {
    try {
      const jq = html instanceof jQuery ? html : $(html);
      const img = jq.find("img");
      if (img.length) {
        img.attr("src", `modules/${MODULE_ID}/assets/images/ui/fairy-tail-guild-logo.webp`);
        img.attr("class", "ft5e-pause-logo fa-spin");
      }
    } catch (err) {
      console.error(`${MODULE_ID} | Error replacing pause logo:`, err);
    }
  });
}

/* -------------------------------------------------- */
/*  Module Settings                                   */
/* -------------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "uiTheme", {
    name: "Tema UI Fairy Tail",
    hint: "Scegli il tema colore dell'interfaccia. Ogni tema è ispirato a un personaggio di Fairy Tail.",
    scope: "client",
    config: true,
    type: String,
    default: "natsu",
    choices: Object.fromEntries(
      Object.entries(THEMES).map(([k, v]) => [k, `${v.label} — ${v.desc}`])
    ),
    onChange: (value) => applyTheme(value)
  });

  // Apply theme immediately on init
  const currentTheme = game.settings.get(MODULE_ID, "uiTheme") ?? "natsu";
  applyTheme(currentTheme);

  // Set up pause logo replacement
  replacePauseLogo();
});

/* -------------------------------------------------- */
/*  Ready — ensure theme is applied after full load   */
/* -------------------------------------------------- */

Hooks.once("ready", () => {
  const currentTheme = game.settings.get(MODULE_ID, "uiTheme") ?? "natsu";
  applyTheme(currentTheme);
});
