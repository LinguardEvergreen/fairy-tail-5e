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
/*  Inject unlayered CSS overrides                    */
/*  FoundryVTT v13 loads module CSS inside            */
/*  @layer(modules) which loses to core layers.       */
/*  Critical overrides must be injected as unlayered. */
/* -------------------------------------------------- */

function injectUnlayeredCSS() {
  if (document.getElementById("ft5e-unlayered-css")) return;
  const style = document.createElement("style");
  style.id = "ft5e-unlayered-css";
  style.textContent = `
    /* Players panel */
    body[data-ft5e-theme] #players {
      --background-color: transparent !important;
      background: var(--ft5e-bg-2) !important;
      border: 1px solid var(--ft5e-border) !important;
      border-radius: 8px !important;
      padding: 8px 10px !important;
      box-shadow: 0 2px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(var(--ft5e-primary-rgb),0.1) !important;
    }
    body[data-ft5e-theme] #players #players-inactive,
    body[data-ft5e-theme] #players #players-active {
      background: transparent !important;
    }
    body[data-ft5e-theme] #players,
    body[data-ft5e-theme] #players * {
      color: var(--ft5e-text) !important;
    }
    body[data-ft5e-theme] #players li.player {
      padding: 3px 6px !important;
      border-radius: 4px !important;
      transition: background 0.2s ease !important;
    }
    body[data-ft5e-theme] #players li.player:hover {
      background: rgba(var(--ft5e-primary-rgb), 0.1) !important;
    }
    body[data-ft5e-theme] #players li.player.active .player-name {
      color: var(--ft5e-primary-light) !important;
    }
    body[data-ft5e-theme] #players li.player.gm .player-name {
      color: var(--ft5e-accent) !important;
    }
    body[data-ft5e-theme] #players h3 {
      color: var(--ft5e-primary) !important;
      font-size: 11px !important;
      letter-spacing: 1px !important;
      text-transform: uppercase !important;
      border-bottom: 1px solid var(--ft5e-border) !important;
      padding-bottom: 4px !important;
      margin-bottom: 4px !important;
    }
    body[data-ft5e-theme] #players #players-expand {
      color: var(--ft5e-text-dim) !important;
    }
    body[data-ft5e-theme] #players #players-expand:hover {
      color: var(--ft5e-primary) !important;
    }
  `;
  document.head.appendChild(style);
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
  injectUnlayeredCSS();
  setupPauseObserver();
});

Hooks.once("ready", () => {
  const currentTheme = game.settings.get(MODULE_ID, "uiTheme") ?? "natsu";
  applyTheme(currentTheme);
  forcePauseLogo();
});
