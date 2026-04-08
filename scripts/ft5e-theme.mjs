/**
 * Fairy Tail 5e — UI Theme System
 *
 * Provides 5 character-themed UI skins (Natsu, Gray, Erza, Lucy, Laxus)
 * and replaces the FoundryVTT pause icon with the Fairy Tail guild logo.
 *
 * Uses aggressive DOM manipulation and MutationObserver to ensure the
 * pause logo stays replaced even when dnd5e or core re-renders it.
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
/*  Pause Logo Override — aggressive replacement      */
/* -------------------------------------------------- */

function forcePauseLogo() {
  const pauseEl = document.getElementById("pause");
  if (!pauseEl) return;

  // Replace ALL img elements inside #pause
  const imgs = pauseEl.querySelectorAll("img");
  imgs.forEach(img => {
    if (!img.src.includes("fairy-tail-guild-logo")) {
      img.src = LOGO_PATH;
      img.classList.add("ft5e-pause-logo");
      img.style.cssText = "width:150px !important; height:150px !important; max-width:none !important;";
    }
  });

  // Also check for CSS background-image on figure/div children
  const figure = pauseEl.querySelector("figure") || pauseEl;
  const children = figure.querySelectorAll("*");
  children.forEach(child => {
    const bg = window.getComputedStyle(child).backgroundImage;
    if (bg && bg !== "none" && !bg.includes("fairy-tail-guild-logo")) {
      child.style.backgroundImage = `url(${LOGO_PATH})`;
      child.style.backgroundSize = "contain";
      child.style.backgroundRepeat = "no-repeat";
      child.style.backgroundPosition = "center";
    }
  });

  // Replace figcaption / h3 text
  const caption = pauseEl.querySelector("figcaption") || pauseEl.querySelector("h3");
  if (caption && !caption.classList.contains("ft5e-pause-text")) {
    caption.classList.add("ft5e-pause-text");
    caption.textContent = "GAME PAUSED";
  }
}

function setupPauseObserver() {
  // Watch for pause element changes
  const observer = new MutationObserver(() => {
    forcePauseLogo();
  });

  // Observe the entire document body for #pause being added/modified
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  // Also hook into all relevant render hooks
  Hooks.on("renderPause", () => {
    setTimeout(forcePauseLogo, 50);
    setTimeout(forcePauseLogo, 200);
    setTimeout(forcePauseLogo, 500);
  });

  // Periodic check as a fallback (every 2 seconds, only while paused)
  setInterval(() => {
    if (game?.paused) forcePauseLogo();
  }, 2000);
}

/* -------------------------------------------------- */
/*  Sidebar guild logo watermark                      */
/* -------------------------------------------------- */

function injectSidebarBranding() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar || sidebar.querySelector(".ft5e-sidebar-brand")) return;

  const brand = document.createElement("div");
  brand.classList.add("ft5e-sidebar-brand");
  brand.innerHTML = `
    <img src="${LOGO_PATH}" class="ft5e-sidebar-logo" alt="Fairy Tail" />
    <span class="ft5e-sidebar-title">FAIRY TAIL 5e</span>
  `;
  sidebar.prepend(brand);
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

  // Apply theme immediately
  const currentTheme = game.settings.get(MODULE_ID, "uiTheme") ?? "natsu";
  applyTheme(currentTheme);

  // Setup pause logo observer
  setupPauseObserver();
});

/* -------------------------------------------------- */
/*  Ready — finalize UI                               */
/* -------------------------------------------------- */

Hooks.once("ready", () => {
  const currentTheme = game.settings.get(MODULE_ID, "uiTheme") ?? "natsu";
  applyTheme(currentTheme);
  forcePauseLogo();
  injectSidebarBranding();
});

// Re-inject branding when sidebar re-renders
Hooks.on("renderSidebar", () => {
  setTimeout(injectSidebarBranding, 100);
});
Hooks.on("renderSidebarTab", () => {
  setTimeout(injectSidebarBranding, 100);
});
