# Fairy Tail 5e

<p align="center">
  <strong>Modulo FoundryVTT per il manuale homebrew Fairy Tail 5e su D&D 5e</strong><br>
  Compendium completi, sistema Mana Points, condizioni custom, Punti di Relazione, Growth Token e UI tematizzata con 5 skin ispirate ai personaggi.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Foundry-v13%20Build%20351-f36f24?style=for-the-badge" alt="Foundry VTT v13">
  <img src="https://img.shields.io/badge/D%26D%205e-v5.3.0-c9272d?style=for-the-badge" alt="D&D 5e v5.3.0">
  <img src="https://img.shields.io/badge/Modulo-v1.0.0-2d7ff9?style=for-the-badge" alt="Module version">
  <img src="https://img.shields.io/badge/Lingua-IT-00a7c4?style=for-the-badge" alt="Italiano">
</p>

---

## Panoramica

`fairy-tail-5e` è un modulo per FoundryVTT che porta l'intero contenuto del manuale homebrew **Fairy Tail 5e** (FinnATC) nel sistema D&D 5e.

Include:

- **12 compendium** con 749+ oggetti pronti all'uso
- un sistema **Mana Points** con barra personalizzata nella scheda personaggio
- **5 condizioni custom** (Silenziato, Bruciato, Rallentato, Celestia, Occhio del Ciclone)
- un tracker **Punti di Relazione** nella tab biografia per Attacchi Combo e Unison Raid
- un sistema **Growth Token** con dialogo multi-step per acquisire nuove magie e feature
- una **UI tematizzata** con 5 skin personaggio e logo pausa della gilda Fairy Tail

## Highlights

| Area | Funzionalità |
|------|-------------|
| Compendium | 12 pack: razze, classi, magie, background, talenti, equipaggiamento, incantesimi, stili di combattimento, feature razze/classi/magie, regole combattimento |
| Mana Points | Barra MP nella scheda attore, calcolo automatico basato su livello e classe, costo MP per incantesimo |
| Condizioni | 5 status effect custom registrati nel sistema con icone dedicate |
| Relazioni | Tracker Punti di Relazione tra PG, badge automatici per Attacchi Combo (4+) e Unison Raid (6+) |
| Growth Token | Token assegnabili dal GM, dialogo multi-step per scegliere nuova magia o raffinare quella esistente, feature aggiunta automaticamente alla scheda |
| UI Temi | 5 temi per personaggio (Natsu, Gray, Erza, Lucy, Laxus), skin completa sidebar/chat/schede/hotbar, logo pausa gilda |

## Compendium Inclusi

Il modulo include **12 compendium** precompilati.

| Compendium | Contenuto | Oggetti |
|------------|-----------|---------|
| FT5e - Razze | Razze giocabili | 8 |
| FT5e - Classi | Classi personaggio | 7 |
| FT5e - Magie | Sottoclassi (Magie) | 14 |
| FT5e - Background | Background | 7 |
| FT5e - Talenti | Talenti e capacità | 174 |
| FT5e - Equipaggiamento | Armature, armi, armi da fuoco e munizioni | 64 |
| FT5e - Incantesimi | Incantesimi | 168 |
| FT5e - Stili di Combattimento | Stili di combattimento | 10 |
| FT5e - Feature Razze | Tratti razziali | 49 |
| FT5e - Feature Classi | Feature di classe | 91 |
| FT5e - Feature Magie | Feature delle magie (sottoclassi) | 152 |
| FT5e - Regole Combattimento | Carica, Attacchi Combo, Unison Raid, Cerchi Magici, Growth Token | 5 |

## UI e Temi

Il modulo include un sistema di temi UI che restylla l'intera interfaccia di FoundryVTT.

Ogni utente può scegliere il proprio tema dalle impostazioni del modulo:

| Tema | Colori |
|------|--------|
| Natsu | Rosso fuoco, arancione, nero |
| Gray | Blu ghiaccio, bianco, azzurro scuro |
| Erza | Rosso scarlatto, argento, blu acciaio |
| Lucy | Oro, rosa, bianco crema |
| Laxus | Giallo elettrico, viola scuro, nero |

Il tema è **client-scoped**: ogni giocatore può usare un tema diverso.

Il logo di pausa viene sostituito con il simbolo della gilda di Fairy Tail.

**Come cambiare tema:** Impostazioni > Configura Impostazioni > Fairy Tail 5e > Tema UI Fairy Tail

## Installazione

### Da Manifest URL

1. In FoundryVTT, vai su **Configurazione > Moduli Aggiuntivi > Installa Modulo**
2. Incolla il seguente URL nel campo "URL del Manifesto":
   ```
   https://github.com/LinguardEvergreen/fairy-tail-5e/releases/latest/download/module.json
   ```
3. Clicca **Installa**

### Download diretto

```
https://github.com/LinguardEvergreen/fairy-tail-5e/releases/latest/download/fairy-tail-5e.zip
```

### Installazione manuale

1. Scarica l'ultima release da [GitHub Releases](https://github.com/LinguardEvergreen/fairy-tail-5e/releases)
2. Estrai il contenuto nella cartella `Data/modules/fairy-tail-5e` di FoundryVTT
3. Riavvia FoundryVTT e attiva il modulo nelle impostazioni del mondo

## Build da sorgente

Per rigenerare i compendium packs dai sorgenti:

```bash
# Installa le dipendenze
npm install

# Genera i file JSON dai dati sorgente
node generate-data.mjs

# Compila i compendium packs (LevelDB)
node build-packs.mjs
```

I file JSON generati si trovano in `src/`, i compendium LevelDB compilati in `packs/`.

## Struttura del repository

| Percorso | Contenuto |
|----------|-----------|
| `module.json` | Manifesto modulo FoundryVTT |
| `scripts/` | Mana Points, Condizioni, Relazioni/Growth Token, Temi UI |
| `styles/` | CSS per Mana Points, Relazioni e Temi |
| `packs/` | Compendium LevelDB precompilati |
| `src/` | Dati sorgente JSON |
| `assets/` | Immagini per razze, classi, magie, equipaggiamento, UI |
| `languages/` | Localizzazione italiana |

## Crediti

- **Modulo FoundryVTT**: [LinguardEvergreen](https://github.com/LinguardEvergreen)
- **Manuale Fairy Tail 5e**: Il team di FinnATC
- **Fairy Tail**: Opera di Hiro Mashima
- **D&D 5e**: Wizards of the Coast

## Licenza

Questo modulo è un progetto fan-made basato sul manuale homebrew Fairy Tail 5e. Fairy Tail è un'opera di Hiro Mashima. Dungeons & Dragons 5e è un prodotto di Wizards of the Coast. Questo modulo non è affiliato né approvato da nessuna delle parti sopra menzionate.
