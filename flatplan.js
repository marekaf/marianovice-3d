// Renders zahrada-flat-plan.svg — a grading plan for the construction company. Highlights every
// area that must be built flat (level pads, decks, graded apron) with derived finished levels,
// keyed to the shared terrain datum. Regenerate with: node generate-flat-plan.js
const { TERRAIN } = require("./terrain.js");

const ROWS = "abcdefghijklmnopqrstuvwxyz";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r2 = (v) => Math.round(v * 100) / 100;
const fmtSigned = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);   // +0.05 / −1.25
const fmtBpv = (v) => v.toFixed(2);

// Categories: how each flat area is built, its colour, and the earthworks it implies.
const CAT = {
  pad:   { fill: "#ffe0b2", stroke: "#e08a1e", label: "Level pad — cut to level (structure on grade)" },
  apron: { fill: "#f6c9a0", stroke: "#c25e12", label: "Graded apron — level slab (cut & fill)" },
  deck:  { fill: "#d9ead3", stroke: "#5a9a3c", label: "Level deck at +0.050 — on posts, ground not graded" },
  fill:  { fill: "#e6cfa6", stroke: "#b0801f", label: "Level pad on soil fill — excavated soil placed under" },
  fall:  { fill: "#cfe2f3", stroke: "#2f6fae", label: "Hard surface — graded to fall (~2% to gate)" },
  soft:  { fill: "#fff2cc", stroke: "#bf9000", label: "Level soft/utility area — trim to level" },
};

// The flat areas, in schedule order. `level` (internal height) pins an explicit finished level;
// otherwise the pad is cut to its lowest natural corner. `ids` groups several footprints as one row.
const ZONES = [
  { id: "pergola",      label: "Pergola + grill",   cat: "pad",  level: 1.05 },
  { id: "sauna",        label: "Sauna",             cat: "pad", level: 2.45 }, // sauna + hot-tub share
  { id: "saunaShelter", label: "Hot-tub shelter",   cat: "pad", level: 2.45 }, // one flat platform, on grade
  { id: "greenhouse",   label: "Greenhouse",        cat: "pad" },
  { id: "carport",      label: "Carport slab",      cat: "apron", level: 1.965 },
  { id: "garage",       label: "Garage slab/apron", cat: "apron", level: 1.965 },
  { id: "eastTerrace",  label: "Terrace E (fill)",  cat: "fill",  level: 2.44 },
  { id: "westTerrace",  label: "Terrace W",         cat: "deck",  level: 2.515 },
  { id: "driveway",     label: "Driveway",          cat: "fall" },
  { id: "firePit",      label: "Fire-pit seating",  cat: "soft" },
  { id: "raisedBedsPad", label: "Raised-beds pad",  cat: "soft", level: 3.15 },
  { id: "compost",      label: "Compost",           cat: "soft" },
  { id: "binStore",     label: "Bin store",         cat: "pad" },
  { id: "toolStore",    label: "Tool store",        cat: "pad" },
];

// Footprint parts (rect/circle/polygon) for a zone across one or more element ids.
function zoneParts(garden, z) {
  const EL = Object.fromEntries(garden.elements.map((e) => [e.id, e]));
  const ids = z.ids || [z.id];
  const parts = [];
  for (const id of ids) {
    for (const p of EL[id].parts) if (["rect", "circle", "polygon"].includes(p.kind)) parts.push(p);
  }
  return parts;
}

// Corner points of a zone's bounding footprint — used to sample natural grade.
function zoneCorners(parts) {
  const pts = [];
  for (const p of parts) {
    if (p.kind === "rect") pts.push([p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.d], [p.x + p.w, p.y + p.d]);
    else if (p.kind === "circle") pts.push([p.cx - p.r, p.cy - p.r], [p.cx + p.r, p.cy - p.r], [p.cx - p.r, p.cy + p.r], [p.cx + p.r, p.cy + p.r]);
    else if (p.kind === "polygon") for (const [x, y] of p.points) pts.push([x, y]);
  }
  return pts;
}

// Derived finished level + earthworks for a zone.
function levelInfo(z, parts) {
  const gs = zoneCorners(parts).map(([x, y]) => TERRAIN.basePlaneHeight(x, y));
  const gmin = Math.min(...gs), gmax = Math.max(...gs);
  if (z.cat === "deck") return { target: z.level, cut: null, fill: null, note: "deck on posts" };
  if (z.cat === "fall") return { target: null, cut: null, fill: null, delta: gmax - gmin };
  const target = z.level !== undefined ? z.level : gmin;
  return { target, cut: Math.max(0, gmax - target), fill: Math.max(0, target - gmin) };
}

function renderShape(p, px) {
  if (p.kind === "rect") return `<rect x="${px(p.x)}" y="${px(p.y)}" width="${px(p.w)}" height="${px(p.d)}"`;
  if (p.kind === "circle") return `<circle cx="${px(p.cx)}" cy="${px(p.cy)}" r="${px(p.r)}"`;
  if (p.kind === "ellipse") return `<ellipse cx="${px(p.cx)}" cy="${px(p.cy)}" rx="${px(p.rx)}" ry="${px(p.ry)}"`;
  if (p.kind === "polygon") return `<polygon points="${p.points.map(([x, y]) => `${px(x)},${px(y)}`).join(" ")}"`;
  if (p.kind === "line") return `<line x1="${px(p.x1)}" y1="${px(p.y1)}" x2="${px(p.x2)}" y2="${px(p.y2)}"`;
  return null;
}

// Centroid of a zone's first footprint part — anchor for the number tag.
function zoneAnchor(parts) {
  const p = parts[0];
  if (p.kind === "rect") return [p.x + p.w / 2, p.y + p.d / 2];
  if (p.kind === "circle") return [p.cx, p.cy];
  const xs = p.points.map((q) => q[0]), ys = p.points.map((q) => q[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

function renderFlatPlanSVG(garden) {
  const S = garden.m2px;
  const px = (m) => Math.round(m * S * 100) / 100;
  const cell = garden.gridCellM * S, major = cell * 5;
  const maxX = Math.max(...garden.plot.vertices.map((v) => v[0]));
  const maxY = Math.max(...garden.plot.vertices.map((v) => v[1]));
  const cols = Math.floor((maxX - garden.gridCellM / 2) / garden.gridCellM) + 1;
  const rows = Math.floor((maxY - garden.gridCellM / 2) / garden.gridCellM) + 1;
  const plotPts = garden.plot.vertices.map(([x, y]) => `${px(x)},${px(y)}`).join(" ");
  const out = [];

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 880" font-family="-apple-system, BlinkMacSystemFont, sans-serif">`);
  out.push(`  <defs>
    <pattern id="cellgrid" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse">
      <path d="M ${cell} 0 L 0 0 0 ${cell}" fill="none" stroke="#e2e2e2" stroke-width="0.6"/>
    </pattern>
    <pattern id="majorgrid" x="0" y="0" width="${major}" height="${major}" patternUnits="userSpaceOnUse">
      <rect width="${major}" height="${major}" fill="url(#cellgrid)"/>
      <path d="M ${major} 0 L 0 0 0 ${major}" fill="none" stroke="#bcbcbc" stroke-width="1"/>
    </pattern>
    <pattern id="fallhatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="7" stroke="#2f6fae" stroke-width="1" opacity="0.5"/>
    </pattern>
    <clipPath id="plotShape"><polygon points="${plotPts}"/></clipPath>
  </defs>`);
  out.push(`  <style>
    text { font-family: -apple-system, sans-serif; fill: #2a2a2a; }
    .title { font-size: 18px; font-weight: 700; text-anchor: middle; }
    .subtitle { font-size: 11px; fill: #666; text-anchor: middle; }
    .axis { font-size: 9px; fill: #777; text-anchor: middle; font-weight: 600; }
    .tag { font-size: 10px; font-weight: 700; text-anchor: middle; }
    .zlvl { font-size: 8px; text-anchor: middle; fill: #333; }
    .ctxlbl { font-size: 8px; fill: #aaa; text-anchor: middle; }
    .panelh { font-size: 11px; font-weight: 700; }
    .th { font-size: 8px; fill: #555; font-weight: 700; }
    .td { font-size: 8px; }
    .note { font-size: 8px; fill: #777; }
  </style>`);
  out.push(`  <rect x="0" y="0" width="1100" height="880" fill="white"/>`);
  out.push(`  <text x="440" y="26" class="title">${esc(garden.title)} — grading / flat-areas plan</text>`);
  out.push(`  <text x="440" y="44" class="subtitle">Areas to be built level, with finished levels. Datum ±0.000 = house floor = ${fmtBpv(TERRAIN.bpvDatum)} Bpv · levels indicative, confirm on site</text>`);

  out.push(`  <g transform="translate(70, 96)">`);
  out.push(`    <g clip-path="url(#plotShape)"><rect x="-50" y="-10" width="900" height="720" fill="url(#majorgrid)"/></g>`);
  out.push(`    <polygon points="${plotPts}" fill="none" stroke="#2a2a2a" stroke-width="2.5"/>`);
  const colLabels = [];
  for (let i = 1; i <= cols; i++) colLabels.push(`<text x="${(i - 0.5) * cell}" y="-6">${i}</text>`);
  out.push(`    <g class="axis">${colLabels.join("")}</g>`);
  const rowLabels = [];
  for (let j = 0; j < rows; j++) rowLabels.push(`<text x="-12" y="${j * cell + 22}">${ROWS[j]}</text>`);
  out.push(`    <g class="axis">${rowLabels.join("")}</g>`);

  // Context layer — every element as a faint outline for orientation.
  out.push(`    <g clip-path="url(#plotShape)" fill="#f3f3f3" stroke="#d3d3d3" stroke-width="0.8">`);
  for (const el of garden.elements) {
    for (const p of el.parts) {
      const s = renderShape(p, px);
      if (s) out.push(`      ${s} />`);
    }
  }
  out.push(`    </g>`);

  // Flat zones — coloured footprints + number tags.
  const computed = ZONES.map((z, i) => {
    const parts = zoneParts(garden, z);
    return { z, i, parts, info: levelInfo(z, parts), anchor: zoneAnchor(parts) };
  });
  out.push(`    <g clip-path="url(#plotShape)">`);
  for (const { z, parts } of computed) {
    const c = CAT[z.cat];
    const extra = z.cat === "fall" ? ` fill="url(#fallhatch)"` : ` fill="${c.fill}" fill-opacity="0.75"`;
    for (const p of parts) {
      const s = renderShape(p, px);
      if (s) out.push(`      ${s}${extra} stroke="${c.stroke}" stroke-width="1.6" />`);
    }
  }
  out.push(`    </g>`);
  // Number tags + short level caption on the plan.
  for (const { z, i, info, anchor } of computed) {
    const [ax, ay] = anchor, c = CAT[z.cat];
    out.push(`    <circle cx="${px(ax)}" cy="${px(ay)}" r="8" fill="${c.stroke}"/>`);
    out.push(`    <text x="${px(ax)}" y="${px(ay) + 3.2}" class="tag" fill="#fff">${i + 1}</text>`);
    const cap = info.target != null ? fmtSigned(TERRAIN.relToHouse(info.target)) : "fall";
    out.push(`    <text x="${px(ax)}" y="${px(ay) + 18}" class="zlvl">${esc(cap)}</text>`);
  }

  // Compass
  out.push(`  </g>`);
  out.push(`  <g transform="translate(838, 92)">
    <circle cx="0" cy="0" r="24" fill="white" stroke="#555" stroke-width="1.3"/>
    <path d="M 0 -19 L 5 3 L 0 -5 L -5 3 Z" fill="#2a2a2a"/>
    <path d="M 0 5 L 5 -3 L 0 19 L -5 -3 Z" fill="#999"/>
    <text x="0" y="-28" font-size="12" font-weight="700" text-anchor="middle">N</text>
  </g>`);

  // Right panel — legend, datum note, levels schedule.
  out.push(`  <g transform="translate(882, 150)">`);
  out.push(`    <text x="0" y="0" class="panelh">LEGEND</text>`);
  let ly = 16;
  for (const key of ["pad", "apron", "deck", "fill", "fall", "soft"]) {
    const c = CAT[key];
    const box = key === "fall" ? `fill="url(#fallhatch)"` : `fill="${c.fill}"`;
    out.push(`    <rect x="0" y="${ly - 8}" width="12" height="10" ${box} stroke="${c.stroke}" stroke-width="1"/>`);
    out.push(`    <text x="18" y="${ly}" class="td">${esc(c.label)}</text>`);
    ly += 15;
  }
  ly += 6;
  out.push(`    <text x="0" y="${ly}" class="panelh">LEVELS SCHEDULE</text>`);
  ly += 13;
  out.push(`    <text x="0" y="${ly}" class="th">#  area</text><text x="118" y="${ly}" class="th" text-anchor="end">±0.000</text><text x="158" y="${ly}" class="th" text-anchor="end">Bpv</text><text x="196" y="${ly}" class="th" text-anchor="end">cut m</text>`);
  ly += 4;
  out.push(`    <line x1="0" y1="${ly}" x2="196" y2="${ly}" stroke="#bbb" stroke-width="0.8"/>`);
  ly += 12;
  for (const { z, i, info } of computed) {
    const rel = info.target != null ? fmtSigned(TERRAIN.relToHouse(info.target)) : "—";
    const bpv = info.target != null ? fmtBpv(TERRAIN.bpv(info.target)) : "—";
    let cut;
    if (z.cat === "deck") cut = "posts";
    else if (z.cat === "fall") cut = "Δ" + info.delta.toFixed(2);
    else if (z.cat === "fill") cut = info.fill.toFixed(2) + "f";
    else if (info.fill > 0.02 && z.cat === "apron") cut = `${info.cut.toFixed(2)}/${info.fill.toFixed(2)}f`;
    else cut = info.cut.toFixed(2);
    out.push(`    <text x="0" y="${ly}" class="td">${i + 1}  ${esc(z.label)}</text><text x="118" y="${ly}" class="td" text-anchor="end">${esc(rel)}</text><text x="158" y="${ly}" class="td" text-anchor="end">${esc(bpv)}</text><text x="196" y="${ly}" class="td" text-anchor="end">${esc(cut)}</text>`);
    ly += 12;
  }
  ly += 8;
  out.push(`    <text x="0" y="${ly}" class="note">±0.000 = house FF = ${fmtBpv(TERRAIN.bpvDatum)} Bpv.</text>`);
  ly += 11;
  out.push(`    <text x="0" y="${ly}" class="note">Pads cut to lowest corner (no fill</text>`);
  ly += 10;
  out.push(`    <text x="0" y="${ly}" class="note">under structures); cut m = max dig.</text>`);
  ly += 11;
  out.push(`    <text x="0" y="${ly}" class="note">Driveway graded to fall, not flat.</text>`);
  ly += 11;
  out.push(`    <text x="0" y="${ly}" class="note">Decks are level on posts over grade.</text>`);
  out.push(`  </g>`);

  out.push(`</svg>`);
  return out.join("\n");
}

module.exports = { renderFlatPlanSVG };
