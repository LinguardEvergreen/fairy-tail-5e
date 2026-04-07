# Fairy Tail 5e - Modulo FoundryVTT

Un modulo per **FoundryVTT** che importa il contenuto del manuale homebrew **Fairy Tail 5e** come compendium packs per il sistema D&D 5e.

## Compatibilità

| Requisito | Versione |
|-----------|----------|
| FoundryVTT | v13 (Build 351) |
| Sistema D&D 5e | v5.0.0 – v5.3.0 |

## Contenuto

Il modulo include **452 oggetti** suddivisi in 8 compendium:

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

## Installazione

### Da manifest URL

1. In FoundryVTT, vai su **Configurazione > Moduli Aggiuntivi > Installa Modulo**
2. Incolla il seguente URL nel campo "URL del Manifesto":
   ```
   https://github.com/LinguardEvergreen/fairy-tail-5e/releases/latest/download/module.json
   ```
3. Clicca **Installa**

### Manuale

1. Scarica l'ultima release da [GitHub Releases](https://github.com/LinguardEvergreen/fairy-tail-5e/releases)
2. Estrai il contenuto nella cartella `Data/modules/fairy-tail-5e` di FoundryVTT
3. Riavvia FoundryVTT e attiva il modulo nelle impostazioni del mondo

## Build da sorgente

Se vuoi rigenerare i compendium packs dai sorgenti:

```bash
# Installa le dipendenze
npm install

# Genera i file JSON dai dati sorgente
node generate-data.mjs

# Compila i compendium packs (LevelDB)
node build-packs.mjs
```

I file JSON generati si trovano in `src/`, mentre i compendium LevelDB compilati in `packs/`.

## Stato del progetto

- [x] **Fase 1** — Importazione oggetti (nome + descrizione HTML)
- [ ] **Fase 2** — Automazione campi meccanici (statistiche, proprietà, effetti)

Attualmente tutti gli oggetti contengono nome e descrizione in formato HTML. I campi meccanici (valori numerici, proprietà delle armi, componenti degli incantesimi, ecc.) verranno aggiunti nelle fasi successive.

## Crediti

- **Modulo FoundryVTT**: [LinguardEvergreen](https://github.com/LinguardEvergreen)
- **Manuale Fairy Tail 5e**: ErtBash e il team di FinnATC

## Licenza

Questo modulo è un progetto fan-made basato sul manuale homebrew Fairy Tail 5e. Fairy Tail è un'opera di Hiro Mashima. Dungeons & Dragons 5e è un prodotto di Wizards of the Coast.
