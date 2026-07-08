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
/*  Theme color palettes (hardcoded for inline use)   */
/* -------------------------------------------------- */

const THEME_COLORS = {
  natsu: {
    bg: "#1e0e0c", border: "#6a3018", text: "#f0ddd5", textDim: "#b08a70",
    primary: "#e74c3c", primaryLight: "#ff7a45", accent: "#f39c12",
    primaryRgb: "231,76,60", shadow: "rgba(243,156,18,0.12)"
  },
  gray: {
    bg: "#0c1c2c", border: "#23507a", text: "#d9ecf7", textDim: "#82a6be",
    primary: "#3498db", primaryLight: "#6fc4e8", accent: "#d9f0fa",
    primaryRgb: "52,152,219", shadow: "rgba(217,240,250,0.10)"
  },
  erza: {
    bg: "#151a24", border: "#3c4a60", text: "#e2e7ee", textDim: "#8c98ac",
    primary: "#c0392b", primaryLight: "#e85c48", accent: "#b8c6d8",
    primaryRgb: "192,57,43", shadow: "rgba(184,198,216,0.10)"
  },
  lucy: {
    bg: "#1e170c", border: "#5c4520", text: "#f4ead2", textDim: "#b29c72",
    primary: "#d4a017", primaryLight: "#f0c840", accent: "#ee9ab0",
    primaryRgb: "212,160,23", shadow: "rgba(238,154,176,0.10)"
  },
  laxus: {
    bg: "#141022", border: "#45306e", text: "#ece8d4", textDim: "#9d8cb4",
    primary: "#f1c40f", primaryLight: "#f9e154", accent: "#a55ec9",
    primaryRgb: "241,196,15", shadow: "rgba(165,94,201,0.12)"
  }
};

/* -------------------------------------------------- */
/*  Style Players Panel via inline styles             */
/*  FoundryVTT v13 @layer(modules) prevents CSS       */
/*  overrides — inline styles bypass all layers.      */
/* -------------------------------------------------- */

function stylePlayersPanel(themeId) {
  const panel = document.getElementById("players");
  if (!panel) return;
  const c = THEME_COLORS[themeId] || THEME_COLORS.natsu;

  // Use setProperty to add styles WITHOUT removing existing layout properties
  const ps = panel.style;
  ps.setProperty("background", c.bg, "important");
  ps.setProperty("border", `1px solid ${c.border}`, "important");
  ps.setProperty("border-radius", "8px", "important");
  ps.setProperty("padding", "8px 10px", "important");
  ps.setProperty("box-shadow", `0 2px 16px rgba(0,0,0,0.6), inset 0 1px 0 ${c.shadow}`, "important");
  ps.setProperty("color", c.text, "important");
  ps.setProperty("min-width", "fit-content", "important");

  // Style inner sections — transparent so container is one unified box
  for (const id of ["players-inactive", "players-active"]) {
    const el = document.getElementById(id);
    if (el) {
      el.style.setProperty("background", "transparent", "important");
      el.style.setProperty("color", c.text, "important");
    }
  }

  // Style player rows
  panel.querySelectorAll("li.player").forEach(li => {
    li.style.setProperty("padding", "3px 6px", "important");
    li.style.setProperty("border-radius", "4px", "important");
    li.style.setProperty("color", c.text, "important");
    const nameEl = li.querySelector(".player-name");
    if (nameEl) {
      if (li.classList.contains("gm")) {
        nameEl.style.setProperty("color", c.accent, "important");
      } else if (li.classList.contains("active")) {
        nameEl.style.setProperty("color", c.primaryLight, "important");
      } else {
        nameEl.style.setProperty("color", c.textDim, "important");
      }
    }
  });

  // Style expand button
  const expand = document.getElementById("players-expand");
  if (expand) expand.style.setProperty("color", c.textDim, "important");

  console.log("FT5e | Panel styled OK, width:", window.getComputedStyle(panel).width);
}

function setupPlayersObserver(themeId) {
  // Only use hooks - NO MutationObserver to avoid infinite loops
  const apply = () => stylePlayersPanel(themeId);
  Hooks.on("renderPlayerList", () => setTimeout(apply, 100));
  // Initial apply + delayed retries
  apply();
  setTimeout(apply, 1000);
  setTimeout(apply, 3000);
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
    onChange: (value) => { applyTheme(value); stylePlayersPanel(value); }
  });

  const currentTheme = game.settings.get(MODULE_ID, "uiTheme") ?? "natsu";
  applyTheme(currentTheme);
  setupPauseObserver();
});

Hooks.once("ready", () => {
  const currentTheme = game.settings.get(MODULE_ID, "uiTheme") ?? "natsu";
  console.log("FT5e | ready hook, theme:", currentTheme);
  applyTheme(currentTheme);
  setupPlayersObserver(currentTheme);
  forcePauseLogo();
});
