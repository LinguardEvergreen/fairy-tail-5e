/**
 * Fairy Tail 5e — UI Theme System
 *
 * Provides 5 character-themed UI skins (Natsu, Gray, Erza, Lucy, Laxus)
 * and replaces the FoundryVTT pause icon with the Fairy Tail guild logo.
 */

const MODULE_ID = "fairy-tail-5e";
const LOGO_PATH = `modules/${MODULE_ID}/assets/images/ui/fairy-tail-guild-logo.webp`;

/* -------------------------------------------------- */
/*  Theme Definitions                                 */
/* -------------------------------------------------- */

const THEMES = {
  natsu: { label: "\u{1F525} Natsu", desc: "Rosso fuoco, arancione, nero" },
  gray:  { label: "\u2744\uFE0F Gray", desc: "Blu ghiaccio, bianco, azzurro scuro" },
  erza:  { label: "\u2694\uFE0F Erza", desc: "Rosso scarlatto, argento, blu acciaio" },
  lucy:  { label: "\u2B50 Lucy", desc: "Oro, rosa, bianco crema" },
  laxus: { label: "\u26A1 Laxus", desc: "Giallo elettrico, viola scuro, nero" }
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

function forcePauseLogo() {
  const pauseEl = document.getElementById("pause");
  if (!pauseEl) return;

  // Find and replace any img inside #pause
  const imgs = pauseEl.querySelectorAll("img");
  imgs.forEach(img => {
    if (!img.src.includes("fairy-tail-guild-logo")) {
      img.src = LOGO_PATH;
      img.classList.add("ft5e-pause-logo");
    }
  });
}

function setupPauseObserver() {
  const observer = new MutationObserver(() => forcePauseLogo());
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  Hooks.on("renderPause", () => {
    setTimeout(forcePauseLogo, 50);
    setTimeout(forcePauseLogo, 200);
    setTimeout(forcePauseLogo, 500);
  });

  setInterval(() => {
    if (game?.paused) forcePauseLogo();
  }, 2000);
}

/* -------------------------------------------------- */
/*  Module Settings                                   */
/* -------------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "uiTheme", {
    name: "Tema UI Fairy Tail",
    hint: "Scegli il tema colore dell'interfaccia. Ogni tema \u00e8 ispirato a un personaggio di Fairy Tail.",
    scope: "client",
    config: true,
    type: String,
    default: "natsu",
    choices: Object.fromEntries(
      Object.entries(THEMES).map(([k, v]) => [k, `${v.label} \u2014 ${v.desc}`])
    ),
    onChange: (value) => applyTheme(value)
  });

  const currentTheme = game.settings.get(MODULE_ID, "uiTheme") ?? "natsu";
  applyTheme(currentTheme);
  setupPauseObserver();
});

Hooks.once("ready", () => {
  const currentTheme = game.settings.get(MODULE_ID, "uiTheme") ?? "natsu";
  applyTheme(currentTheme);
  forcePauseLogo();
});
