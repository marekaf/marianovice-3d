// Geometry validator for layout.js. Flags footprints that (1) cross or sit outside the plot boundary
// (the fence runs the boundary, so "crosses boundary" == "fence goes through it"), and (2) collide with
// another object that they are not expected to overlap. Usage: node validate-layout.js
const { GARDEN } = require("./layout.js");
const PLOT = GARDEN.plot.vertices;

const inPoly = (px, py, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if ((poly[i][1] > py) !== (poly[j][1] > py) &&
        px < ((poly[j][0] - poly[i][0]) * (py - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c;
  }
  return c;
};

// Turn a part into a boundary-point ring + interior sample points for hit-testing.
function partPoints(p) {
  if (p.kind === "rect") {
    const pts = [];
    for (let a = 0; a <= 1.0001; a += 0.25) for (let b = 0; b <= 1.0001; b += 0.25) pts.push([p.x + a * p.w, p.y + b * p.d]);
    return pts;
  }
  if (p.kind === "circle") {
    const pts = [[p.cx, p.cy]];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; pts.push([p.cx + Math.cos(a) * p.r, p.cy + Math.sin(a) * p.r]); }
    return pts;
  }
  if (p.kind === "polygon") {
    const pts = p.points.map(q => [q[0], q[1]]);
    // add edge midpoints so long edges that bow out of the plot are caught
    for (let i = 0; i < p.points.length; i++) { const a = p.points[i], b = p.points[(i + 1) % p.points.length]; pts.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); }
    return pts;
  }
  return null; // text/line ignored
}

const solidParts = el => el.parts.filter(p => ["rect", "circle", "polygon"].includes(p.kind) && !p.clipToPlot ? true : ["rect", "circle", "polygon"].includes(p.kind));

// footprint of an element = union of its solid parts, as one point cloud
function elFootprint(el) {
  const pts = [];
  for (const p of el.parts) { const pp = partPoints(p); if (pp) pts.push(...pp); }
  return pts;
}
function pointInEl(x, y, el) {
  for (const p of el.parts) {
    if (p.kind === "rect" && x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.d) return true;
    if (p.kind === "circle" && Math.hypot(x - p.cx, y - p.cy) <= p.r) return true;
    if (p.kind === "polygon" && inPoly(x, y, p.points)) return true;
  }
  return false;
}
const bbox = pts => ({ x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1])) });

// ── Check 1: boundary / outside-plot ──────────────────────────────────────
const outside = [];
for (const el of GARDEN.elements) {
  if (el.parts.every(p => p.clipToPlot)) { /* clipped elements are allowed to touch the edge, but a fully-outside one is still wrong */ }
  const pts = elFootprint(el);
  if (!pts.length) continue;
  const inCount = pts.filter(([x, y]) => inPoly(x, y, PLOT)).length;
  if (inCount === 0) outside.push({ id: el.id, kind: "FULLY OUTSIDE the plot" });
  else if (inCount < pts.length) outside.push({ id: el.id, kind: `crosses boundary (fence through it) — ${pts.length - inCount}/${pts.length} pts outside` });
}

// ── Check 2: collisions between SOLID objects not expected to overlap ──────
// Only physical objects that must not interpenetrate; planting beds/paths/lights/decor are meant to overlap.
const SOLID = new Set(["house", "garage", "carport", "sauna", "saunaShelter", "softub", "pergola",
  "greenhouse", "compost", "binStore", "toolStore", "rainTank", "screenNorth", "screenWest", "screenSouth",
  "raisedBed1", "raisedBed2", "raisedBed3", "raisedBed4"]);
const key = (a, b) => [a, b].sort().join("|");
const ALLOW = new Set([
  key("sauna", "saunaShelter"), key("sauna", "softub"), key("saunaShelter", "softub"),
].map(k => k));
const collisions = [];
const els = GARDEN.elements.filter(e => SOLID.has(e.id) && elFootprint(e).length);
for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
  const A = els[i], B = els[j];
  if (ALLOW.has(key(A.id, B.id))) continue;
  const ba = bbox(elFootprint(A)), bb = bbox(elFootprint(B));
  if (ba.x1 < bb.x0 || bb.x1 < ba.x0 || ba.y1 < bb.y0 || bb.y1 < ba.y0) continue; // bbox miss
  // sample A's bbox, look for a point inside both
  let hit = false;
  for (let x = ba.x0; x <= ba.x1 && !hit; x += 0.2) for (let y = ba.y0; y <= ba.y1 && !hit; y += 0.2)
    if (pointInEl(x, y, A) && pointInEl(x, y, B)) hit = true;
  if (hit) collisions.push(`${A.id} ⨯ ${B.id}`);
}

// ── Check 3: hardcoded trees / conifers / bushes in index.html outside plot ─
let htmlOut = [];
try {
  const html = require("fs").readFileSync(require("path").join(__dirname, "index.html"), "utf8");
  const hits = [];
  for (const m of html.matchAll(/add(?:Tree|Conifer)\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/g)) hits.push(["tree/conifer", +m[1], +m[2]]);
  const bp = html.match(/bushPositions\s*=\s*\[([\s\S]*?)\];/);
  if (bp) for (const m of bp[1].matchAll(/\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/g)) hits.push(["bush", +m[1], +m[2]]);
  htmlOut = hits.filter(([, x, z]) => !inPoly(x, z, PLOT));
} catch (e) { /* index.html not readable */ }

// ── Report ────────────────────────────────────────────────────────────────
console.log(`plot: ${PLOT.length} verts, ${GARDEN.elements.length} elements checked\n`);
console.log(`OUTSIDE / FENCE-THROUGH (${outside.length}):`);
outside.length ? outside.forEach(o => console.log(`  ✗ ${o.id.padEnd(16)} ${o.kind}`)) : console.log("  ✓ none");
console.log(`\nUNEXPECTED COLLISIONS (${collisions.length}):`);
collisions.length ? collisions.forEach(c => console.log(`  ✗ ${c}`)) : console.log("  ✓ none");
console.log(`\nHARDCODED index.html TREES/BUSHES OUTSIDE (${htmlOut.length}):`);
htmlOut.length ? htmlOut.forEach(([t, x, z]) => console.log(`  ✗ ${t} at (${x}, ${z})`)) : console.log("  ✓ none");
process.exit(outside.length + collisions.length + htmlOut.length ? 1 : 0);
