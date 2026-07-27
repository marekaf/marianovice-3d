// Assembles docs/book.html (self-contained, A4 landscape print CSS) from the plan SVGs,
// blender renders and docs/*.md, then prints docs/project-book.pdf with Chrome headless.
// Run: node build-book.js
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { GARDEN } = require("./layout.js");

const ROOT = __dirname;
const DOCS = path.join(ROOT, "docs");
const meta = GARDEN.docMeta;
const dateStr = new Date().toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });

function pandoc(md) {
  return execSync("pandoc -f gfm -t html", { input: md, encoding: "utf8" });
}

// Inline an SVG file, namespacing ids + url()/href refs and scoping <style> rules under
// a wrapper id — inlined SVG styles/ids are document-global and the sources collide.
function inlineSvg(file, scope) {
  let s = fs.readFileSync(file, "utf8")
    .replace(/<\?xml[\s\S]*?\?>\s*/, "")
    .replace(/<!DOCTYPE[^>]*>\s*/, "");
  s = s.replace(/\bid="([^"]+)"/g, (m, i) => `id="${scope}_${i}"`);
  s = s.replace(/url\(#([^)]+)\)/g, (m, i) => `url(#${scope}_${i})`);
  s = s.replace(/(xlink:)?href="#([^"]+)"/g, (m, x, i) => `${x || ""}href="#${scope}_${i}"`);
  s = s.replace(/<style>([\s\S]*?)<\/style>/g, (m, css) => {
    const scoped = css.replace(/([^{}]+)\{/g, (mm, sel) =>
      sel.split(",").map((x) => `#${scope} ${x.trim()}`).join(", ") + " {");
    return `<style>${scoped}</style>`;
  });
  return `<div class="svgwrap" id="${scope}">${s}</div>`;
}

function section(md, startRe, endRe) {
  const from = md.search(startRe);
  if (from < 0) throw new Error(`section start not found: ${startRe}`);
  const rest = md.slice(from);
  const nl = rest.indexOf("\n") + 1;
  const to = endRe ? rest.slice(nl).search(endRe) : -1;
  return to < 0 ? rest : rest.slice(0, nl + to);
}

// Split a GFM table into {header, rows} (header = first 2 pipe lines).
function splitTable(md) {
  const lines = md.split("\n");
  const first = lines.findIndex((l) => l.trim().startsWith("|"));
  let last = first;
  while (last + 1 < lines.length && lines[last + 1].trim().startsWith("|")) last++;
  return {
    before: lines.slice(0, first).join("\n"),
    header: lines.slice(first, first + 2),
    rows: lines.slice(first + 2, last + 1),
    after: lines.slice(last + 1).join("\n"),
  };
}

const review = fs.readFileSync(path.join(DOCS, "flera-design-review.md"), "utf8");
const vykaz = fs.readFileSync(path.join(DOCS, "vykaz-vymer.md"), "utf8");
const care = fs.readFileSync(path.join(DOCS, "care-plan.md"), "utf8");

const part2 = section(review, /^## Part 2/m, /^## Part 3/m);
const part2a = section(part2, /^## Part 2/m, /^### 2\.2/m);
const part2b = section(part2, /^### 2\.2/m, null);
const part3 = section(review, /^## Part 3/m, /^### Phasing/m).replace(/^---\s*$/m, "");
const zt = splitTable(part3);
const zoneHalf = zt.rows.findIndex((r) => r.includes("| Z7 |"));
const zonesA = [...zt.header, ...zt.rows.slice(0, zoneHalf)].join("\n");
const zonesB = [...zt.header, ...zt.rows.slice(zoneHalf)].join("\n");

function vykazSection(title) {
  return section(vykaz, new RegExp(`^## ${title}`, "m"), /^## /m).replace(new RegExp(`^## ${title}.*$`, "m"), "").trim();
}
const vykazIntro = vykaz.split(/^## /m)[0].replace(/^# .*$/m, "").trim();
const vPlochy = vykazSection("Plochy záhonů");
const vTrvalky = section(vykaz, /^## Trvalky/m, /^## Cibuloviny/m).replace(/^## Trvalky.*$/m, "").trim();
const vCibule = vykazSection("Cibuloviny");
const vDreviny = section(vykaz, /^## Dřeviny/m, /^## Rostliny/m).replace(/^## Dřeviny.*$/m, "").trim();
const vNadoby = section(vykaz, /^## Rostliny do nádob/m, /^## Materiál/m).replace(/^## Rostliny.*$/m, "").trim();
const vMaterial = section(vykaz, /^## Materiál/m, /^## Rozpočet/m).replace(/^## Materiál.*$/m, "").trim();
const vRozpocet = section(vykaz, /^## Rozpočet/m, null).replace(/^## Rozpočet.*$/m, "").trim();
const tt = splitTable(vTrvalky);
const tHalf = Math.ceil(tt.rows.length / 2);
const trvalkyParts = [tt.rows.slice(0, tHalf), tt.rows.slice(tHalf)]
  .map((rows) => [...tt.header, ...rows].join("\n"));

const careIntro = care.split(/^## /m)[0].replace(/^# .*$/m, "").trim();
const careCal = section(care, /^## Kalendář/m, /^## Milníky/m).replace(/^## Kalendář.*$/m, "").trim();
const careMilniky = section(care, /^## Milníky/m, null).replace(/^## Milníky.*$/m, "").trim();
const ct = splitTable(careCal);
const careCalA = [...ct.header, ...ct.rows.slice(0, 6)].join("\n");
const careCalB = [...ct.header, ...ct.rows.slice(6)].join("\n");

const sheets = [
  ["bedTerrace", "Z1 — Terrace bed"],
  ["pondFringe", "Z2 — Pond fringe"],
  ["prairieIsland", "Z3 — Prairie island"],
  ["saunaBed", "Z4 — Sauna surround"],
  ["pergolaBeds", "Z5 — Pergola beds"],
  ["arrivalStrip", "Z6 — Arrival strip"],
  ["eastUnderstory", "Z7 — East understory"],
  ["atriumPots", "Z8 — Atrium planters"],
  ["northFoundation", "Z9a — North foundation"],
  ["southFoundation", "Z9b — South foundation"],
  ["garageFaceBed", "Z10 — Garage face bed"],
  ["rainGarden", "Z11 — Rain garden"],
  ["orchardMeadow", "Z12 — Orchard meadow"],
];

const renders = [
  ["../blender/render-walk.png", "Procházka zahradou — ohniště"],
  ["../blender/render-living.png", "Pohled z obývacího pokoje přes terasu"],
  ["../blender/render-terrace-golden.png", "Terasa — zlatá hodina"],
  ["../blender/render-arrival-night.png", "Příjezd — noční osvětlení"],
];

const pages = [];
function page(name, body, cls, tocLabel) {
  pages.push({ name, body, cls: cls || "", tocLabel: tocLabel || null });
}

page("Titulní strana", "{{COVER}}", "cover", null);

page("Vizualizace", `<div class="grid2x2">${renders.map(([src, cap]) =>
  `<figure><img src="${src}" alt=""><figcaption>${cap}</figcaption></figure>`).join("")}</div>`,
  "", "Vizualizace");

page("Situace", inlineSvg(path.join(ROOT, "zahrada-plan.svg"), "svg_situace"), "svgpage", "Situace — osazovací koncept");
page("Řez A–A (V–Z)", inlineSvg(path.join(DOCS, "sections", "section-ew.svg"), "svg_secew"), "svgpage", "Řezy A–A, B–B");
page("Řez B–B (S–J)", inlineSvg(path.join(DOCS, "sections", "section-ns.svg"), "svg_secns"), "svgpage", null);

page("Recenze návrhu — principy Flera", `<div class="prose cols2">${pandoc(part2a)}${pandoc(part2b)}</div>`, "review", "Recenze návrhu (Flera)");
page("Osazovací návrh — zóny Z1–Z6", `<div class="prose">${pandoc(zt.before)}${pandoc(zonesA)}</div>`, "zonetbl", "Osazovací návrh — zóny");
page("Osazovací návrh — zóny Z7–Z12", `<div class="prose">${pandoc(zonesB)}${pandoc(zt.after.trim())}</div>`, "zonetbl", null);

page("Kalendář kvetení", inlineSvg(path.join(DOCS, "bloom-calendar.svg"), "svg_bloom"), "svgpage", "Kalendář kvetení");

for (const [id, name] of sheets) {
  page(name, inlineSvg(path.join(DOCS, "plansheets", `${id}.svg`), `svg_${id}`), "svgpage",
    id === "bedTerrace" ? "Osazovací listy Z1–Z12" : null);
}

page("Výkaz výměr — plochy záhonů",
  `<div class="prose"><p class="note">${pandoc(vykazIntro).replace(/<\/?p>/g, " ")}</p>${pandoc(vPlochy)}</div>`,
  "vykaz", "Výkaz výměr");
page("Výkaz výměr — trvalky",
  `<div class="prose"><div class="cols2flex">${trvalkyParts.map((t) => `<div>${pandoc(t)}</div>`).join("")}</div></div>`,
  "vykaz", null);
const onlyTable = (md) => md.split("\n").filter((l) => l.trim().startsWith("|")).join("\n");
page("Výkaz výměr — cibuloviny, dřeviny, nádoby",
  `<div class="prose"><div class="cols2flex">
    <div><h3>Cibuloviny</h3>${pandoc(vCibule)}<h3>Rostliny do nádob (Z8)</h3>${pandoc(vNadoby)}</div>
    <div><h3>Dřeviny a popínavky</h3>${pandoc(vDreviny)}</div>
  </div></div>`,
  "vykaz", null);
page("Výkaz výměr — materiál a rozpočet",
  `<div class="prose"><div class="cols2flex">
    <div><h3>Materiál</h3>${pandoc(onlyTable(vMaterial))}<p class="note">${pandoc(section(vMaterial, /^Štěrkový mulč/m, null)).replace(/<\/?p>/g, " ")}</p></div>
    <div><h3>Rozpočet po fázích</h3>${pandoc(vRozpocet)}</div>
  </div></div>`,
  "vykaz", null);

page("Plán péče — kalendář I–VI",
  `<div class="prose"><p class="note">${pandoc(careIntro).replace(/<\/?p>/g, " ")}</p>${pandoc(careCalA)}</div>`,
  "care", "Plán péče");
page("Plán péče — kalendář VII–XII, milníky režimu",
  `<div class="prose">${pandoc(careCalB)}<h3>Milníky režimu</h3><div class="milniky">${pandoc(careMilniky)}</div></div>`,
  "care", null);

// TOC: unlabeled pages extend the preceding labeled entry's range.
const total = pages.length;
const tocEntries = [];
pages.forEach((p, i) => {
  if (p.tocLabel) tocEntries.push({ label: p.tocLabel, from: i + 1, to: i + 1 });
  else if (tocEntries.length) tocEntries[tocEntries.length - 1].to = i + 1;
});
const tocHtml = tocEntries.map((e) =>
  `<div class="tocrow"><span>${e.label}</span><span class="tocdots"></span><span>${e.from === e.to ? e.from : `${e.from}–${e.to}`}</span></div>`).join("");

const cover = `
  <div class="cover-head">
    <div>
      <div class="cover-kicker">Projektová kniha — koncept zahrady</div>
      <h1>${meta.project}</h1>
      <div class="cover-place">${meta.place}</div>
    </div>
    <div class="cover-rev">${meta.revision}<span>revize</span></div>
  </div>
  <div class="cover-img"><img src="../blender/render-iso.png" alt=""></div>
  <div class="cover-bottom">
    <div class="cover-toc"><div class="toctitle">Obsah</div><div class="toccols">${tocHtml}</div></div>
    <div class="cover-meta">
      <div><span>projekt</span>${meta.project}</div>
      <div><span>místo</span>${meta.place}</div>
      <div><span>autor</span>${meta.author}</div>
      <div><span>revize</span>${meta.revision}</div>
      <div><span>datum</span>${dateStr}</div>
    </div>
  </div>`;

const css = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #2a2a2a; }
  .page { width: 277mm; height: 190mm; page-break-after: always; display: flex; flex-direction: column; overflow: hidden; position: relative; }
  .page:last-child { page-break-after: auto; }
  .hdr { flex: none; display: flex; align-items: baseline; justify-content: space-between; border-bottom: 1.2pt solid #2a2a2a; padding-bottom: 1.4mm; margin-bottom: 2.5mm; font-size: 8pt; }
  .hdr .proj { font-weight: 700; letter-spacing: 0.3px; }
  .hdr .sec { color: #555; }
  .hdr .pg { color: #555; }
  .ftr { flex: none; display: flex; justify-content: space-between; border-top: 0.5pt solid #aaa; padding-top: 1.2mm; margin-top: 2mm; font-size: 6.5pt; color: #777; }
  .content { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }

  .svgpage .content, .svgwrap { align-items: center; justify-content: center; }
  .svgwrap { width: 100%; height: 100%; display: flex; }
  .svgwrap svg { width: 100%; height: 100%; }

  .grid2x2 { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 4mm; }
  .grid2x2 figure { margin: 0; display: flex; flex-direction: column; min-height: 0; }
  .grid2x2 img { flex: 1; min-height: 0; width: 100%; object-fit: cover; border-radius: 1mm; }
  .grid2x2 figcaption { flex: none; font-size: 8pt; color: #555; padding-top: 1.2mm; }

  .prose { font-size: 8.5pt; line-height: 1.42; }
  .prose h3 { font-size: 9.5pt; margin: 0 0 1.5mm; }
  .prose p { margin: 0 0 2mm; }
  .prose a { color: inherit; text-decoration: none; }
  .prose table { border-collapse: collapse; width: 100%; margin: 0 0 2.5mm; }
  .prose th, .prose td { border: 0.5pt solid #bbb; padding: 0.9mm 1.6mm; vertical-align: top; text-align: left; font-size: inherit; }
  .prose th { background: #f0efe8; font-size: 90%; }
  .prose .note { font-size: 7.5pt; color: #666; }
  .cols2 { columns: 2; column-gap: 6mm; }
  .cols2 h2, .cols2 h3 { column-span: all; }
  .cols2 table { break-inside: avoid-column; }
  .cols2flex { display: flex; gap: 5mm; align-items: flex-start; }
  .cols2flex > div { flex: 1; min-width: 0; }
  .cols3flex { display: flex; gap: 4mm; align-items: flex-start; }
  .cols3flex > div { flex: 1; min-width: 0; }
  .review .prose { font-size: 7.6pt; line-height: 1.32; }
  .review .prose h2 { font-size: 11pt; margin: 0 0 2mm; }
  .review .prose h3 { font-size: 9.5pt; margin: 0 0 2mm; }
  .review .prose ol { margin: 0 0 2mm; padding-left: 4mm; }
  .review .prose ol li { margin-bottom: 0.8mm; }
  .zonetbl .prose { font-size: 8pt; line-height: 1.35; }
  .zonetbl .prose h2 { display: none; }
  .vykaz .prose { font-size: 8pt; line-height: 1.3; }
  .care .prose { font-size: 8pt; line-height: 1.35; }
  .care .milniky { font-size: 8pt; line-height: 1.45; max-width: 230mm; }
  .care .milniky li { margin-bottom: 1.5mm; }

  .cover { }
  .cover-head { flex: none; display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1.6pt solid #2a2a2a; padding-bottom: 3mm; margin-bottom: 4mm; }
  .cover-kicker { font-size: 10pt; letter-spacing: 2.2px; text-transform: uppercase; color: #6a7a3a; font-weight: 600; margin-bottom: 1.5mm; }
  .cover-head h1 { font-size: 26pt; margin: 0 0 1mm; letter-spacing: 0.2px; }
  .cover-place { font-size: 11pt; color: #555; }
  .cover-rev { font-size: 22pt; font-weight: 700; text-align: center; border: 1.2pt solid #2a2a2a; padding: 2mm 4mm 1mm; }
  .cover-rev span { display: block; font-size: 6.5pt; font-weight: 400; letter-spacing: 1.5px; text-transform: uppercase; color: #777; }
  .cover-img { flex: 1 1 auto; min-height: 0; }
  .cover-img img { width: 100%; height: 100%; object-fit: cover; border-radius: 1mm; }
  .cover-bottom { flex: none; display: flex; gap: 8mm; align-items: flex-end; margin-top: 3.5mm; }
  .cover-toc { flex: 1; }
  .toctitle { font-size: 8pt; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 1.5mm; }
  .toccols { columns: 3; column-gap: 8mm; font-size: 7.5pt; }
  .tocrow { display: flex; align-items: baseline; gap: 1.5mm; break-inside: avoid; margin-bottom: 0.8mm; }
  .tocdots { flex: 1; border-bottom: 0.5pt dotted #999; }
  .cover-meta { flex: none; display: flex; gap: 6mm; border-top: 0.5pt solid #aaa; padding-top: 1.6mm; font-size: 8pt; }
  .cover-meta span { display: block; font-size: 6pt; letter-spacing: 1.2px; text-transform: uppercase; color: #888; }
`;

const pageHtml = pages.map((p, i) => {
  const n = i + 1;
  const body = p.body === "{{COVER}}" ? cover : p.body;
  const hdr = p.cls === "cover" ? "" :
    `<div class="hdr"><span class="proj">${meta.project}</span><span class="sec">${p.name}</span><span class="pg">${meta.revision} · ${n} / ${total}</span></div>`;
  const ftr = p.cls === "cover" ? "" :
    `<div class="ftr"><span>${meta.author} · ${dateStr}</span><span>Projektová kniha — koncept zahrady</span><span>${meta.place}</span></div>`;
  return `<div class="page ${p.cls}">${hdr}<div class="content">${body}</div>${ftr}</div>`;
}).join("\n");

const html = `<!DOCTYPE html>
<meta charset="utf-8">
<title>${meta.project} — projektová kniha</title>
<style>@page { size: A4 landscape; margin: 10mm; } ${css}</style>
${pageHtml}`;

fs.writeFileSync(path.join(DOCS, "book.html"), html);
console.log(`docs/book.html written — ${total} pages`);

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
execSync(`"${chrome}" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=15000 --print-to-pdf="${path.join(DOCS, "project-book.pdf")}" "${path.join(DOCS, "book.html")}"`, { stdio: "inherit" });
const size = fs.statSync(path.join(DOCS, "project-book.pdf")).size;
console.log(`docs/project-book.pdf written — ${(size / 1024 / 1024).toFixed(1)} MB`);
