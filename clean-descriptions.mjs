/**
 * Cleans up HTML descriptions in src/*.json:
 * - converts leftover markdown (**bold**, *italic*) to <strong>/<em>
 * - removes Homebrewery "::" column separators
 * - converts consecutive <p>|...|</p> pipe rows into real <table> markup
 * - wraps consecutive <li> in <ul>
 * - drops standalone <br> spacers and trims heading whitespace
 *
 * Exposed as cleanAllSrc() for generate-data.mjs; runs standalone via CLI.
 */

import fs from "fs";
import path from "path";

const SRC_DIR = path.resolve("src");

/** Convert markdown leftovers to HTML on a single line (never spans lines/cells) */
function mdInline(line) {
  let l = line;
  l = l.replace(/\*\*\*(\S(?:[^*\n]*?\S)?)\*\*\*/g, "<strong><em>$1</em></strong>");
  l = l.replace(/\*\*(\S(?:[^*\n]*?\S)?)\*\*/g, "<strong>$1</strong>");
  // em: no spaces adjacent to the asterisks, so "Livello * 2" (multiplication) is untouched
  l = l.replace(/(^|[\s>(])\*(\S(?:[^*\n]*?\S)?)\*(?=[\s<.,;:!?)]|$)/g, "$1<em>$2</em>");
  return l;
}

export function cleanDescription(html) {
  if (!html) return html;
  let lines = html.split("\n").map(mdInline);
  const out = [];
  let tableBuf = [];
  let listOpen = false;

  const flushTable = () => {
    if (!tableBuf.length) return;
    const rows = tableBuf
      .map(r => r.replace(/^<p>\s*\|/, "").replace(/\|?\s*<\/p>$/, ""))
      .filter(r => !/^[\s:|-]+$/.test(r)); // drop |---|---| separator rows
    if (rows.length) {
      const cells = r => r.split("|").map(c => c.trim());
      let t = "<table><thead><tr>";
      t += cells(rows[0]).map(c => `<th>${c}</th>`).join("");
      t += "</tr></thead><tbody>";
      for (const r of rows.slice(1)) {
        t += "<tr>" + cells(r).map(c => `<td>${c}</td>`).join("") + "</tr>";
      }
      t += "</tbody></table>";
      out.push(t);
    }
    tableBuf = [];
  };

  const closeList = () => {
    if (listOpen) { out.push("</ul>"); listOpen = false; }
  };

  for (let line of lines) {
    // Existing list wrappers are stripped and regenerated so re-runs don't nest them
    if (line.trim() === "<ul>" || line.trim() === "</ul>") continue;
    // Some source rows lack the trailing pipe, so only require the leading one
    const isTableRow = /^<p>\s*\|/.test(line.trim());
    const isLi = /^<li>/.test(line.trim());

    if (isTableRow) { closeList(); tableBuf.push(line.trim()); continue; }
    flushTable();

    if (isLi) {
      if (!listOpen) { out.push("<ul>"); listOpen = true; }
      out.push(line.trim());
      continue;
    }
    closeList();

    // Standalone <br> spacers between paragraphs add double spacing in Foundry
    if (line.trim() === "<br>") continue;
    // Headings/paragraphs with no text left after markup stripping ("<p>#####</p>")
    if (/^<(p|h[1-6])>[#\s]*<\/(p|h[1-6])>$/.test(line.trim())) continue;
    out.push(line);
  }
  flushTable();
  closeList();

  let result = out.join("\n");

  // Homebrewery table separators left inline: "<strong>Portata:</strong> :: 9 metri"
  result = result.replace(/\s*::\s+/g, " ");

  // Trim padding inside headings: "<h2> Nome </h2>"
  result = result.replace(/<(h[1-6])>\s+/g, "<$1>").replace(/\s+<\/(h[1-6])>/g, "</$1>");

  // Empty paragraphs
  result = result.replace(/<p>\s*<\/p>\n?/g, "");

  return result;
}

export function cleanAllSrc() {
  let totalItems = 0;
  let changedItems = 0;
  for (const file of fs.readdirSync(SRC_DIR).filter(f => f.endsWith(".json"))) {
    const p = path.join(SRC_DIR, file);
    const items = JSON.parse(fs.readFileSync(p, "utf-8"));
    let changed = 0;
    for (const item of items) {
      totalItems++;
      if (typeof item.description === "string") {
        const cleaned = cleanDescription(item.description);
        if (cleaned !== item.description) { item.description = cleaned; changed++; }
      }
    }
    if (changed) fs.writeFileSync(p, JSON.stringify(items, null, 2), "utf-8");
    changedItems += changed;
    console.log(`  ${file}: ${changed} descriptions cleaned`);
  }
  console.log(`\nDone: ${changedItems}/${totalItems} items cleaned.`);
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, "/")}`).href) {
  cleanAllSrc();
}
