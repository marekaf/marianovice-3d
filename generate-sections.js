// Generates section/elevation drawings (docs/sections/*.svg) from layout.js.
// Run: node generate-sections.js
const fs = require("fs");
const path = require("path");
const { GARDEN } = require("./layout.js");

const HS = GARDEN.m2px; // horizontal px/m — same scale as the plan
const VS = HS * 2; // vertical px/m — výškové měřítko 2×
const W = 1100;
const H = 440;
const BASE = 360; // svg y of elevation 0
const HATCH_B = BASE + 24;
const byId = Object.fromEntries(GARDEN.elements.map((e) => [e.id, e]));

const terrainAt = (x, y) => Math.max(0, -0.062 * x + 0.044 * y + 2.733);
const r2 = (v) => Math.round(v * 100) / 100;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function polyCut(points, sec) {
  const hits = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const a1 = sec.cutAxis === "y" ? p[1] : p[0];
    const a2 = sec.cutAxis === "y" ? q[1] : q[0];
    const b1 = sec.cutAxis === "y" ? p[0] : p[1];
    const b2 = sec.cutAxis === "y" ? q[0] : q[1];
    if (Math.min(a1, a2) <= sec.cut && sec.cut <= Math.max(a1, a2)) {
      if (a1 === a2) hits.push(b1, b2);
      else hits.push(b1 + ((sec.cut - a1) * (b2 - b1)) / (a2 - a1));
    }
  }
  return hits.length ? [Math.min(...hits), Math.max(...hits)] : null;
}

function partCut(p, sec) {
  const c = sec.cut;
  if (p.kind === "rect") {
    if (sec.cutAxis === "y") return p.y <= c && c <= p.y + p.d ? [p.x, p.x + p.w] : null;
    return p.x <= c && c <= p.x + p.w ? [p.y, p.y + p.d] : null;
  }
  if (p.kind === "polygon") return polyCut(p.points, sec);
  if (p.kind === "ellipse" || p.kind === "circle") {
    const rx = p.kind === "circle" ? p.r : p.rx;
    const ry = p.kind === "circle" ? p.r : p.ry;
    const dc = sec.cutAxis === "y" ? c - p.cy : c - p.cx;
    const rr = sec.cutAxis === "y" ? ry : rx;
    const ro = sec.cutAxis === "y" ? rx : ry;
    const ctr = sec.cutAxis === "y" ? p.cx : p.cy;
    if (Math.abs(dc) > rr) return null;
    const half = ro * Math.sqrt(1 - (dc / rr) ** 2);
    return [ctr - half, ctr + half];
  }
  return null;
}

function elementCuts(el, sec) {
  const out = [];
  for (const p of el.parts) {
    if (p.kind === "text" || p.kind === "line") continue;
    const iv = partCut(p, sec);
    if (iv) out.push(iv);
  }
  return out;
}

function houseFloor() {
  const pts = byId.house.parts[0].points;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return terrainAt(cx, cy);
}

function makeCtx(sec) {
  const [s0, s1] = polyCut(GARDEN.plot.vertices, sec);
  const cuts = {};
  for (const el of GARDEN.elements) {
    const ivs = elementCuts(el, sec);
    if (ivs.length) cuts[el.id] = ivs;
  }
  const digs = [];
  if (cuts.pond) digs.push({ iv: cuts.pond[0], depth: 0.5 });
  if (cuts.rainGarden) digs.push({ iv: cuts.rainGarden[0], depth: 0.3 });
  const base = (s) => terrainAt(...sec.at(s));
  const prof = (s) => {
    let h = base(s);
    for (const d of digs) {
      const [a, b] = d.iv;
      if (s > a && s < b) h -= d.depth * Math.sin((Math.PI * (s - a)) / (b - a));
    }
    return h;
  };
  const SX = (s) => r2(sec.left + (s - s0) * HS);
  const SY = (h) => r2(BASE - h * VS);
  const samples = [];
  for (let s = s0; s < s1; s += 0.5) samples.push(s);
  samples.push(s1);
  return { sec, s0, s1, cuts, base, prof, SX, SY, samples, out: [] };
}

function frame(c, title) {
  c.out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="-apple-system, BlinkMacSystemFont, sans-serif">`);
  c.out.push(`  <defs>
    <pattern id="earth" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="7" height="7" fill="#f0e8d6"/>
      <line x1="0" y1="0" x2="0" y2="7" stroke="#d9c9a6" stroke-width="1"/>
    </pattern>
  </defs>`);
  c.out.push(`  <style>
    text { font-family: -apple-system, sans-serif; fill: #2a2a2a; }
    .title { font-size: 18px; font-weight: 700; text-anchor: middle; }
    .subtitle { font-size: 11px; fill: #666; text-anchor: middle; }
    .lbl { font-size: 12px; text-anchor: middle; }
    .lbl-w { font-size: 12px; text-anchor: middle; fill: white; }
    .lbl-sm { font-size: 10px; text-anchor: middle; }
    .lbl-sm-w { font-size: 10px; text-anchor: middle; fill: white; }
    .strana { font-size: 10px; fill: #557; font-weight: 600; text-anchor: middle; }
    .dim { font-size: 9px; fill: #b22; text-anchor: middle; font-style: italic; }
  </style>`);
  c.out.push(`  <rect x="0" y="0" width="${W}" height="${H}" fill="white"/>`);
  c.out.push(`  <text x="${W / 2}" y="28" class="title">${esc(title)}</text>`);
  c.out.push(`  <text x="${W / 2}" y="46" class="subtitle">výškové měřítko 2× (heights exaggerated 2×) · horizontal ${HS} px/m as in the plan</text>`);
}

function drawEarth(c) {
  const top = c.samples.map((s) => `${c.SX(s)},${c.SY(c.prof(s))}`).join(" ");
  const poly = `${top} ${c.SX(c.s1)},${HATCH_B} ${c.SX(c.s0)},${HATCH_B}`;
  c.out.push(`  <polygon points="${poly}" fill="url(#earth)" stroke="none"/>`);
}

function drawTerrainLine(c) {
  const pts = c.samples.map((s) => `${c.SX(s)},${c.SY(c.prof(s))}`).join(" ");
  c.out.push(`  <polyline points="${pts}" fill="none" stroke="#4a3a28" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`);
}

function drawWater(c) {
  if (!c.cuts.pond) return null;
  const [a, b] = c.cuts.pond[0];
  const pond = byId.pond.parts[0];
  const WL = terrainAt(pond.cx, pond.cy) - 0.15;
  const wet = [];
  for (let s = a; s <= b + 1e-9; s += 0.1) if (c.prof(s) < WL) wet.push(s);
  if (!wet.length) return WL;
  const pts = wet.map((s) => `${c.SX(s)},${c.SY(c.prof(s))}`).join(" ");
  c.out.push(`  <polygon points="${c.SX(wet[0])},${c.SY(WL)} ${pts} ${c.SX(wet[wet.length - 1])},${c.SY(WL)}" fill="#3a7ab8" opacity="0.65"/>`);
  c.out.push(`  <line x1="${c.SX(wet[0])}" y1="${c.SY(WL)}" x2="${c.SX(wet[wet.length - 1])}" y2="${c.SY(WL)}" stroke="#1f3a5f" stroke-width="1.2"/>`);
  return WL;
}

function levelBox(c, iv, height, fill, stroke) {
  const [a, b] = iv;
  const top = Math.max(c.prof(a), c.prof(b)) + height;
  const pts = `${c.SX(a)},${c.SY(c.prof(a))} ${c.SX(a)},${c.SY(top)} ${c.SX(b)},${c.SY(top)} ${c.SX(b)},${c.SY(c.prof(b))}`;
  c.out.push(`  <polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`);
  return top;
}

function mound(c, iv, hmin, hmax, fill, stroke, opts = {}) {
  const [a, b] = iv;
  const len = b - a;
  const n = Math.max(2, Math.round(len / 1.6));
  const peaks = [1, 0.55, 0.85, 0.65];
  let d = `M ${c.SX(a)} ${c.SY(c.prof(a))}`;
  for (let i = 0; i < n; i++) {
    const sB = a + (len * (i + 1)) / n;
    const sM = a + (len * (i + 0.5)) / n;
    const peak = hmin + (hmax - hmin) * peaks[i % 4];
    const endH = i === n - 1 ? 0 : 0.08;
    d += ` Q ${c.SX(sM)} ${c.SY(c.prof(sM) + 2 * peak - 0.1)} ${c.SX(sB)} ${c.SY(c.prof(sB) + endH)}`;
  }
  for (let s = b; s > a; s -= 0.25) d += ` L ${c.SX(s)} ${c.SY(c.prof(s))}`;
  d += ` L ${c.SX(a)} ${c.SY(c.prof(a))} Z`;
  const dash = opts.dash ? ` stroke-dasharray="4,3"` : "";
  c.out.push(`  <path d="${d}" fill="${fill}" opacity="${opts.opacity || 0.75}" stroke="${stroke}" stroke-width="1"${dash}/>`);
}

function fencePost(c, s) {
  const g = c.prof(s);
  c.out.push(`  <line x1="${c.SX(s)}" y1="${c.SY(g)}" x2="${c.SX(s)}" y2="${c.SY(g + 1.6)}" stroke="#6b4f2f" stroke-width="3" stroke-linecap="round"/>`);
  for (const rh of [0.45, 0.95, 1.45]) {
    c.out.push(`  <circle cx="${c.SX(s)}" cy="${c.SY(g + rh)}" r="2.2" fill="#8a6a42"/>`);
  }
}

function tree(c, s, hTot) {
  const g = c.base(s);
  const trunkTop = g + hTot * 0.45;
  c.out.push(`  <line x1="${c.SX(s)}" y1="${c.SY(g)}" x2="${c.SX(s)}" y2="${c.SY(trunkTop)}" stroke="#6b4f2f" stroke-width="3.5"/>`);
  const cy = g + hTot * 0.66;
  const ryM = hTot * 0.34;
  c.out.push(`  <ellipse cx="${c.SX(s)}" cy="${c.SY(cy)}" rx="${r2(1.7 * HS)}" ry="${r2(ryM * VS)}" fill="#4d7a4d" opacity="0.85"/>`);
  c.out.push(`  <ellipse cx="${r2(c.SX(s) - 0.9 * HS)}" cy="${c.SY(cy - ryM * 0.35)}" rx="${r2(0.9 * HS)}" ry="${r2(ryM * 0.55 * VS)}" fill="#4d7a4d" opacity="0.85"/>`);
}

function human(c, s) {
  const gx = c.SX(s);
  const gy = c.SY(c.prof(s));
  const top = gy - 1.7 * VS;
  c.out.push(`  <g stroke="#555" stroke-width="2" stroke-linecap="round" fill="none">`);
  c.out.push(`    <circle cx="${gx}" cy="${r2(top + 5)}" r="5" fill="#555" stroke="none"/>`);
  c.out.push(`    <line x1="${gx}" y1="${r2(top + 10)}" x2="${gx}" y2="${r2(gy - 22)}"/>`);
  c.out.push(`    <line x1="${gx}" y1="${r2(gy - 22)}" x2="${r2(gx - 5)}" y2="${gy}"/>`);
  c.out.push(`    <line x1="${gx}" y1="${r2(gy - 22)}" x2="${r2(gx + 5)}" y2="${gy}"/>`);
  c.out.push(`    <line x1="${gx}" y1="${r2(top + 16)}" x2="${r2(gx - 6)}" y2="${r2(top + 32)}"/>`);
  c.out.push(`    <line x1="${gx}" y1="${r2(top + 16)}" x2="${r2(gx + 6)}" y2="${r2(top + 32)}"/>`);
  c.out.push(`  </g>`);
  c.out.push(`  <text x="${r2(gx + 9)}" y="${r2(top + 14)}" class="dim" text-anchor="start">1.7 m</text>`);
}

function tick(c, s, hTop, text, lift = 0, opts = {}) {
  const x = c.SX(s);
  const y = c.SY(hTop);
  c.out.push(`  <line x1="${x}" y1="${r2(y - 3)}" x2="${x}" y2="${r2(y - 12 - lift)}" stroke="#999" stroke-width="0.8"/>`);
  const anchor = opts.anchor ? ` text-anchor="${opts.anchor}"` : "";
  const fill = opts.fill ? ` fill="${opts.fill}"` : "";
  c.out.push(`  <text x="${x}" y="${r2(y - 15 - lift)}" class="lbl-sm"${anchor}${fill}>${esc(text)}</text>`);
}

function dim(c, xPx, yPx, text, anchor = "middle") {
  const a = anchor === "middle" ? "" : ` text-anchor="${anchor}"`;
  c.out.push(`  <text x="${r2(xPx)}" y="${r2(yPx)}" class="dim"${a}>${esc(text)}</text>`);
}

function scaleBarsAndFooter(c) {
  const L = c.sec.left;
  const vx = L - 44;
  for (let i = 0; i < 8; i++) {
    c.out.push(`  <rect x="${vx}" y="${c.SY(i + 1)}" width="8" height="${VS}" fill="${i % 2 === 0 ? "#2a2a2a" : "white"}" stroke="#2a2a2a" stroke-width="0.8"/>`);
  }
  for (const v of [0, 2, 4, 6, 8]) {
    c.out.push(`  <text x="${vx - 5}" y="${r2(c.SY(v) + 3)}" class="lbl-sm" text-anchor="end">${v}</text>`);
  }
  c.out.push(`  <text x="${vx + 4}" y="${r2(c.SY(8) - 8)}" class="lbl-sm">m (2×)</text>`);
  c.out.push(`  <rect x="${L}" y="402" width="${5 * HS}" height="8" fill="#2a2a2a"/>`);
  c.out.push(`  <rect x="${L + 5 * HS}" y="402" width="${5 * HS}" height="8" fill="white" stroke="#2a2a2a" stroke-width="1"/>`);
  c.out.push(`  <text x="${L}" y="422" class="lbl-sm" text-anchor="start">0</text>`);
  c.out.push(`  <text x="${L + 5 * HS}" y="422" class="lbl-sm">5 m</text>`);
  c.out.push(`  <text x="${L + 10 * HS}" y="422" class="lbl-sm">10 m</text>`);
  c.out.push(`  <text x="${L}" y="436" class="lbl-sm" text-anchor="start" fill="#888">Generated from layout.js (node generate-sections.js).</text>`);
  c.out.push(`</svg>`);
}

function strana(c, leftText, rightText) {
  c.out.push(`  <text x="${r2(c.SX(c.s0) + 6)}" y="84" class="strana" text-anchor="start">${esc(leftText)}</text>`);
  c.out.push(`  <text x="${r2(c.SX(c.s1) - 6)}" y="84" class="strana" text-anchor="end">${esc(rightText)}</text>`);
}

function subtract(iv, cut) {
  const out = [];
  if (cut[0] > iv[0]) out.push([iv[0], Math.min(iv[1], cut[0])]);
  if (cut[1] < iv[1]) out.push([Math.max(iv[0], cut[1]), iv[1]]);
  return out.filter(([a, b]) => b - a > 0.3);
}

function fringeIvs(c) {
  const iv = c.cuts.pondFringe[0];
  const ex = byId.pondFringe.meta && byId.pondFringe.meta.exclude;
  if (ex && c.cuts[ex]) return subtract(iv, c.cuts[ex][0]);
  return [iv];
}

function houseEW(c) {
  const m = byId.house.meta;
  const [wallW, wallE] = c.cuts.house[0];
  const b = houseFloor();
  const [c1, c2] = m.coreX;
  const ridgeX = (c1 + c2) / 2;
  const eave = b + 2.8;
  const shedTop = b + 3.7;
  const ridge = b + 5;
  const slope = (ridge - eave) / ((c2 - c1) / 2);
  const ghE = ridge - Math.abs(wallE - ridgeX) * slope;
  const pts = [
    [wallW, b], [wallW, eave], [c1, shedTop], [c1, eave], [ridgeX, ridge], [wallE, ghE], [wallE, b],
  ].map(([s, h]) => `${c.SX(s)},${c.SY(h)}`).join(" ");
  c.out.push(`  <polygon points="${pts}" fill="#d4b896" opacity="0.95" stroke="#7a5e3e" stroke-width="2.5" stroke-linejoin="round"/>`);
  const slab = [
    [wallE, ghE], [c2, eave], [c2, eave - 0.2], [wallE, ghE - 0.2],
  ].map(([s, h]) => `${c.SX(s)},${c.SY(h)}`).join(" ");
  c.out.push(`  <polygon points="${slab}" fill="#d4b896" opacity="0.95" stroke="#7a5e3e" stroke-width="2" stroke-linejoin="round"/>`);
  const [ax1, , ax2] = m.atrium;
  c.out.push(`  <rect x="${c.SX(ax1)}" y="${c.SY(b + 2.8)}" width="${r2((ax2 - ax1) * HS)}" height="${r2(2.8 * VS)}" fill="none" stroke="#7a5e3e" stroke-width="1" stroke-dasharray="5,3"/>`);
  c.out.push(`  <text x="${c.SX((ax1 + ax2) / 2)}" y="${c.SY(b + 0.5)}" class="lbl-sm" fill="#6a5a44">atrium — za řezem</text>`);
  c.out.push(`  <text x="${c.SX(17.7)}" y="${c.SY(b + 1.5)}" class="lbl" font-weight="700">HOUSE</text>`);
  dim(c, c.SX(ridgeX), c.SY(ridge) - 8, `ridge +5.0 m (abs ${r2(ridge)} m)`);
  return { b, ridge };
}

function deckEW(c) {
  const [a, b] = c.cuts.eastTerrace[0];
  const lvl = houseFloor() + 0.05;
  for (const s of [a + 0.3, b - 0.3]) {
    c.out.push(`  <line x1="${c.SX(s)}" y1="${c.SY(lvl - 0.12)}" x2="${c.SX(s)}" y2="${c.SY(c.prof(s))}" stroke="#5a3e25" stroke-width="2"/>`);
  }
  c.out.push(`  <rect x="${c.SX(a)}" y="${c.SY(lvl)}" width="${r2((b - a) * HS)}" height="${r2(0.12 * VS)}" fill="#a87d4a" opacity="0.85" stroke="#5a3e25" stroke-width="1"/>`);
  return lvl;
}

function sectionEW() {
  const sec = { cutAxis: "y", cut: 15.5, at: (s) => [s, 15.5], left: 158 };
  const c = makeCtx(sec);
  frame(c, "Section A–A (E–W, y=15.5 m)");
  strana(c, "ZÁPAD (W)", "VÝCHOD (E)");
  drawEarth(c);
  levelBox(c, c.cuts.westTerrace[0], 0.06, "#a87d4a", "#5a3e25");
  const hh = houseEW(c);
  const deckLvl = deckEW(c);
  levelBox(c, c.cuts.raisedBed2[0], 0.4, "#7a5a3a", "#4a3620");
  levelBox(c, c.cuts.raisedBed4[0], 0.4, "#7a5a3a", "#4a3620");
  mound(c, c.cuts.bedTerrace[0], 0.4, 0.9, "#8fa05a", "#6a7a3a");
  for (const iv of fringeIvs(c)) mound(c, iv, 0.4, 0.9, "#8fa05a", "#6a7a3a");
  mound(c, c.cuts.eastUnderstory[0], 1.2, 1.8, "#6a8e5a", "#4a6e3a");
  drawTerrainLine(c);
  const WL = drawWater(c);
  tree(c, 42.5, 5.0);
  fencePost(c, c.s0 + 0.05);
  fencePost(c, c.s1 - 0.05);
  human(c, 6.8);
  tick(c, 0.62, c.prof(0.62) + 1.6, "fence", 2);
  dim(c, c.SX(c.s0) + 6, c.SY(c.prof(c.s0) + 1.6) - 2, "1.6 m", "start");
  tick(c, 1.75, Math.max(c.prof(1), c.prof(2.5)) + 0.4, "raised beds 2+4", 2);
  tick(c, 9.98, c.prof(9.98) + 0.06, "sidewalk", 18, { anchor: "end" });
  tick(c, 22.6, deckLvl, "east terrace", 0);
  tick(c, 25.8, c.prof(25.8) + 0.95, "terrace bed Z1", 16);
  tick(c, 33.6, c.prof(33.6) + 0.95, "pond fringe Z2", 6);
  c.out.push(`  <text x="${c.SX(30)}" y="${r2(c.SY(WL) - 5)}" class="lbl-sm" fill="#1f3a5f">pond</text>`);
  dim(c, c.SX(30), BASE + 16, "depth 0.5 m · water −0.15 m");
  tick(c, 41.3, c.prof(41.3) + 1.85, "east understory Z7", 108);
  dim(c, c.SX(c.s1) + 4, c.SY(c.prof(c.s1) + 1.6) - 2, "1.6 m", "start");
  scaleBarsAndFooter(c);
  return { c, hh, deckLvl, WL };
}

function garageNS(c) {
  const [a, b] = c.cuts.garage[0];
  const g = byId.garage.parts[0];
  const f = terrainAt(g.x + g.w / 2, g.y + g.d / 2);
  const ridgeH = 2.3 + 1.2;
  const cutH = ridgeH - 1.2 * ((c.sec.cut - g.x) / g.w);
  c.out.push(`  <rect x="${c.SX(a)}" y="${c.SY(f + cutH)}" width="${r2((b - a) * HS)}" height="${r2((cutH + 0.3) * VS)}" fill="#888" opacity="0.92" stroke="#3a3a3a" stroke-width="2"/>`);
  c.out.push(`  <rect x="${c.SX(a)}" y="${c.SY(f + cutH)}" width="${r2((b - a) * HS)}" height="${r2(0.12 * VS)}" fill="#3a3a3a"/>`);
  c.out.push(`  <rect x="${c.SX(b - 0.18)}" y="${c.SY(f + 2.05)}" width="${r2(0.18 * HS)}" height="${r2(2.05 * VS)}" fill="#222"/>`);
  c.out.push(`  <line x1="${c.SX(a)}" y1="${c.SY(f + ridgeH)}" x2="${c.SX(b)}" y2="${c.SY(f + ridgeH)}" stroke="#3a3a3a" stroke-width="1.2" stroke-dasharray="6,4"/>`);
  c.out.push(`  <text x="${c.SX((a + b) / 2)}" y="${c.SY(f + 1.1)}" class="lbl-w" font-weight="700">GARAGE</text>`);
  dim(c, c.SX(a) - 5, c.SY(f + 2.3) + 3, "wall 2.3 m", "end");
  dim(c, c.SX((a + b) / 2), c.SY(f + ridgeH) - 6, "ridge +3.5 m — za řezem (x=27.63)");
  return { f, cutH, ridgeH };
}

function pergolaNS(c) {
  const [a, b] = c.cuts.pergola[0];
  const top = c.base((a + b) / 2) + 2.5;
  for (const s of [a + 0.15, b - 0.15]) {
    c.out.push(`  <line x1="${c.SX(s)}" y1="${c.SY(c.prof(s))}" x2="${c.SX(s)}" y2="${c.SY(top)}" stroke="#7a5e3e" stroke-width="3.5"/>`);
  }
  c.out.push(`  <rect x="${c.SX(a)}" y="${c.SY(top)}" width="${r2((b - a) * HS)}" height="${r2(0.1 * VS)}" fill="#c8a878" stroke="#7a5e3e" stroke-width="1"/>`);
  for (let s = a + 0.4; s < b - 0.2; s += 0.6) {
    c.out.push(`  <line x1="${c.SX(s)}" y1="${c.SY(top)}" x2="${c.SX(s)}" y2="${c.SY(top + 0.14)}" stroke="#7a5e3e" stroke-width="2.5"/>`);
  }
  return top;
}

function sectionNS() {
  const sec = { cutAxis: "x", cut: 30, at: (s) => [30, s], left: 245 };
  const c = makeCtx(sec);
  frame(c, "Section B–B (N–S, x=30.0 m)");
  strana(c, "SEVER (N)", "JIH (S)");
  drawEarth(c);
  mound(c, [1, 5], 0.4, 0.9, "#6a8e5a", "#4a6e3a", { dash: true, opacity: 0.35 });
  const perTop = pergolaNS(c);
  mound(c, c.cuts.prairieIsland[0], 0.4, 0.9, "#8fa05a", "#6a7a3a");
  for (const iv of fringeIvs(c)) mound(c, iv, 0.4, 0.9, "#8fa05a", "#6a7a3a");
  mound(c, c.cuts.garageFaceBed[0], 0.4, 0.9, "#8fa05a", "#6a7a3a");
  const gg = garageNS(c);
  const dw = c.cuts.driveway[0];
  const fwd = [];
  const bck = [];
  for (let s = dw[0]; s <= dw[1] + 1e-9; s += 0.25) {
    fwd.push(`${c.SX(s)},${c.SY(c.prof(s) + 0.08)}`);
    bck.unshift(`${c.SX(s)},${c.SY(c.prof(s) - 0.02)}`);
  }
  c.out.push(`  <polygon points="${fwd.join(" ")} ${bck.join(" ")}" fill="#cccccc" opacity="0.9" stroke="#888" stroke-width="0.6"/>`);
  mound(c, c.cuts.arrivalStrip[0], 0.4, 0.9, "#8fa05a", "#6a7a3a");
  drawTerrainLine(c);
  const WL = drawWater(c);
  fencePost(c, c.s0 + 0.05);
  fencePost(c, c.s1 - 0.05);
  human(c, 30.3);
  tick(c, 0.1, c.prof(0.1) + 1.6, "fence", 2, { anchor: "start" });
  dim(c, c.SX(c.s0) + 6, c.SY(c.prof(c.s0) + 1.6) + 12, "1.6 m", "start");
  tick(c, 3.5, perTop + 0.14, "pergola + grill — climbers Z5 za řezem", 6);
  dim(c, c.SX(6) + 6, c.SY(c.base(3.5) + 1.25), "2.5 m", "start");
  tick(c, 9.0, c.prof(9.0) + 0.95, "prairie island Z3", 4);
  tick(c, 12.6, c.prof(12.6) + 0.95, "pond fringe Z2", 26);
  c.out.push(`  <text x="${c.SX(15)}" y="${r2(c.SY(WL) - 5)}" class="lbl-sm" fill="#1f3a5f">pond</text>`);
  dim(c, c.SX(15), BASE + 16, "depth 0.5 m · water −0.15 m");
  tick(c, 18.55, c.prof(18.55) + 0.95, "shade bed Z10", 12);
  tick(c, 28.2, c.prof(28.2) + 0.1, "driveway", 4);
  tick(c, 32.6, c.prof(32.6) + 0.95, "arrival strip Z6", 18);
  dim(c, c.SX(c.s1) + 4, c.SY(c.prof(c.s1) + 1.6) + 12, "1.6 m", "start");
  scaleBarsAndFooter(c);
  return { c, gg, WL };
}

const outDir = path.join(__dirname, "docs", "sections");
fs.mkdirSync(outDir, { recursive: true });

const ew = sectionEW();
fs.writeFileSync(path.join(outDir, "section-ew.svg"), ew.c.out.join("\n") + "\n");
const ns = sectionNS();
fs.writeFileSync(path.join(outDir, "section-ns.svg"), ns.c.out.join("\n") + "\n");

console.log("A–A (y=15.5): span", r2(ew.c.s0), "→", r2(ew.c.s1), "m; terrain W", r2(ew.c.base(ew.c.s0)), "m, E", r2(ew.c.base(ew.c.s1)), "m");
console.log("A–A house: floor", r2(ew.hh.b), "m, ridge abs", r2(ew.hh.ridge), "m; deck", r2(ew.deckLvl), "m; pond water", r2(ew.WL), "m");
console.log("B–B (x=30): span 0 →", r2(ns.c.s1), "m; terrain N", r2(ns.c.base(ns.c.s0)), "m, S", r2(ns.c.base(ns.c.s1)), "m");
console.log("B–B garage: floor", r2(ns.gg.f), "m, roof at cut", r2(ns.gg.f + ns.gg.cutH), "m, ridge abs", r2(ns.gg.f + ns.gg.ridgeH), "m; pond water", r2(ns.WL), "m");
