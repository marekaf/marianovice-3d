// Verifies an interiors room-data file (house-interior.js schema) without rendering:
//   node verify-interior-data.mjs <data.js> [dxf-walls.json]
// Checks: opening bounds, wall sanity, room perimeter closure (every room edge must be
// covered by a wall or an opening), door-graph reachability from an exterior door, and —
// when a DXF wall map is given (mm, [[x,y],[x,y]] segments) — that every model wall face
// lies on a DXF line and every long DXF wall run has a model wall (both directions).
import { createRequire } from 'module';
import { resolve } from 'path';
const require = createRequire(import.meta.url);
const data = Object.values(require(resolve(process.argv[2])))[0];
const TOL = 0.03;
const problems = [];
const note = (sev, msg) => problems.push({ sev, msg });

const allWalls = [...data.extWalls, ...data.intWalls];
const wallRect = w => ({ x0: w.a[0], z0: w.a[1], x1: w.b[0], z1: w.b[1] });
const axisOf = w => (w.b[0] - w.a[0]) >= (w.b[1] - w.a[1]) ? 'x' : 'z';
const lenOf = w => axisOf(w) === 'x' ? w.b[0] - w.a[0] : w.b[1] - w.a[1];

// 1. wall + opening sanity
for (const w of allWalls) {
  const t = axisOf(w) === 'x' ? w.b[1] - w.a[1] : w.b[0] - w.a[0];
  if (t <= 0 || lenOf(w) <= 0) note('ERR', `degenerate wall ${JSON.stringify(w.a)}-${JSON.stringify(w.b)}`);
  if (t > 1.05) note('WARN', `wall thicker than 1 m (${t.toFixed(2)}) at ${JSON.stringify(w.a)}`);
  for (const o of w.openings || []) {
    if (o.at < -TOL || o.at + o.w > lenOf(w) + TOL) note('ERR', `opening beyond wall at ${JSON.stringify(w.a)} (at=${o.at}, w=${o.w}, wall len=${lenOf(w).toFixed(2)})`);
    if ((o.sill || 0) + o.h > (data.clearH ?? 2.52) + 0.35) note('WARN', `opening taller than wall at ${JSON.stringify(w.a)}`);
  }
}

// 1b. wall-wall overlaps (coincident faces z-fight and read as double walls)
for (let i = 0; i < allWalls.length; i++) for (let j = i + 1; j < allWalls.length; j++) {
  const A = wallRect(allWalls[i]), B = wallRect(allWalls[j]);
  const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
  const oz = Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0);
  if (ox > TOL && oz > TOL) note('ERR', `walls overlap ${ox.toFixed(2)}×${oz.toFixed(2)} m at (${Math.max(A.x0, B.x0).toFixed(2)}, ${Math.max(A.z0, B.z0).toFixed(2)})`);
}

// 1c. dangling ends: each wall end must touch another wall, the outline edge, or a block
{
  const xs = data.outline.map(p => p[0]), zs = data.outline.map(p => p[1]);
  const onOutline = (x, z) => data.outline.some((p, i) => {
    const q = data.outline[(i + 1) % data.outline.length];
    return Math.abs((q[0] - p[0]) * (z - p[1]) - (q[1] - p[1]) * (x - p[0])) < 0.05 &&
      x >= Math.min(p[0], q[0]) - TOL && x <= Math.max(p[0], q[0]) + TOL &&
      z >= Math.min(p[1], q[1]) - TOL && z <= Math.max(p[1], q[1]) + TOL;
  });
  for (const w of allWalls) {
    if (w.block) continue;
    const r = wallRect(w), ax = axisOf(w);
    // end EDGE (full thickness segment); corner contact with another wall counts as supported
    const edges = ax === 'x'
      ? [[r.x0, r.z0, r.x0, r.z1], [r.x1, r.z0, r.x1, r.z1]]
      : [[r.x0, r.z0, r.x1, r.z0], [r.x0, r.z1, r.x1, r.z1]];
    for (const [ex0, ez0, ex1, ez1] of edges) {
      const touched = onOutline((ex0 + ex1) / 2, (ez0 + ez1) / 2) || onOutline(ex0, ez0) || onOutline(ex1, ez1) ||
        allWalls.some(o => {
          if (o === w) return false;
          const q = wallRect(o);
          return Math.min(ex1, q.x1) - Math.max(ex0, q.x0) >= -TOL && Math.min(ez1, q.z1) - Math.max(ez0, q.z0) >= -TOL;
        });
      if (!touched) note('ERR', `wall end mid-air at (${((ex0 + ex1) / 2).toFixed(2)}, ${((ez0 + ez1) / 2).toFixed(2)})`);
    }
  }
}

// 1d. stairs must not collide with walls or block a door swing zone
if (data.stairs) {
  const s = data.stairs;
  for (const w of allWalls) {
    const r = wallRect(w);
    const ox = Math.min(s.x1, r.x1) - Math.max(s.x0, r.x0);
    const oz = Math.min(s.z1, r.z1) - Math.max(s.z0, r.z0);
    if (ox > TOL && oz > TOL) note('ERR', `stairs collide with wall at (${Math.max(s.x0, r.x0).toFixed(2)}, ${Math.max(s.z0, r.z0).toFixed(2)})`);
  }
  for (const w of allWalls) {
    const ax = axisOf(w), r = wallRect(w);
    for (const o of w.openings || []) {
      if (o.h < 1.9 || (o.sill || 0) > 0.1) continue;
      const from = (ax === 'x' ? r.x0 : r.z0) + o.at;
      // 0.7 m clear zone on both sides of a door; the stairs' first 0.3 m of rise is walkable
      const zone = ax === 'x'
        ? { x0: from, x1: from + o.w, z0: r.z0 - 0.7, z1: r.z1 + 0.7 }
        : { x0: r.x0 - 0.7, x1: r.x1 + 0.7, z0: from, z1: from + o.w };
      const ox = Math.min(s.x1, zone.x1) - Math.max(s.x0, zone.x0);
      const oz = Math.min(s.z1, zone.z1) - Math.max(s.z0, zone.z0);
      if (ox > 0.1 && oz > 0.1) {
        const run = axisOf({ a: [s.x0, s.z0], b: [s.x1, s.z1] });
        const enc = run === 'x'
          ? (s.toward === 'E' ? Math.max(s.x0, zone.x0) - s.x0 : s.x1 - Math.min(s.x1, zone.x1))
          : (s.toward === 'S' ? Math.max(s.z0, zone.z0) - s.z0 : s.z1 - Math.min(s.z1, zone.z1));
        const riseAtZone = (enc / (run === 'x' ? s.x1 - s.x0 : s.z1 - s.z0)) * s.steps * s.rise;
        if (riseAtZone > 0.3) note('ERR', `door at (${zone.x0.toFixed(2)}–${zone.x1.toFixed(2)}, ${zone.z0.toFixed(2)}–${zone.z1.toFixed(2)}) opens into the stairs ${riseAtZone.toFixed(1)} m up`);
      }
    }
  }
}

// 1e. door egress: the 0.7 m clear zone on both sides of every door must be free of
// wall bodies (incl. block masses like the fireplace); and a wall that is 100% opening
// (a portal) must bear on another wall at both ends — otherwise its lintel floats
{
  const doorish = w => {
    const ext = data.extWalls.includes(w);
    return (w.openings || []).filter(o => ext ? o.door : (o.h >= 1.9 && (o.sill || 0) <= 0.1));
  };
  for (const w of allWalls) {
    const ax = axisOf(w), r = wallRect(w);
    for (const o of doorish(w)) {
      const from = (ax === 'x' ? r.x0 : r.z0) + o.at;
      const zone = ax === 'x'
        ? { x0: from, x1: from + o.w, z0: r.z0 - 0.7, z1: r.z1 + 0.7 }
        : { x0: r.x0 - 0.7, x1: r.x1 + 0.7, z0: from, z1: from + o.w };
      for (const w2 of allWalls) {
        if (w2 === w) continue;
        const q = wallRect(w2);
        const ox = Math.min(zone.x1, q.x1) - Math.max(zone.x0, q.x0);
        const oz = Math.min(zone.z1, q.z1) - Math.max(zone.z0, q.z0);
        if (ox > 0.05 && oz > 0.05) note('ERR', `door at (${from.toFixed(2)}, ${(ax === 'x' ? r.z0 : r.x0).toFixed(2)}) blocked by a wall/mass at (${Math.max(zone.x0, q.x0).toFixed(2)}, ${Math.max(zone.z0, q.z0).toFixed(2)})`);
      }
    }
    const L = lenOf(w);
    const openLen = (w.openings || []).reduce((a, o) => a + o.w, 0);
    if (!w.block && openLen >= L * 0.95) {
      const edges = ax === 'x'
        ? [[r.x0, r.z0, r.x0, r.z1], [r.x1, r.z0, r.x1, r.z1]]
        : [[r.x0, r.z0, r.x1, r.z0], [r.x0, r.z1, r.x1, r.z1]];
      for (const [ex0, ez0, ex1, ez1] of edges) {
        const bearing = allWalls.some(o2 => {
          if (o2 === w) return false;
          const q = wallRect(o2);
          return Math.min(ex1, q.x1) - Math.max(ex0, q.x0) >= 0.1 - TOL && Math.min(ez1, q.z1) - Math.max(ez0, q.z0) >= -TOL ||
                 Math.min(ez1, q.z1) - Math.max(ez0, q.z0) >= 0.1 - TOL && Math.min(ex1, q.x1) - Math.max(ex0, q.x0) >= -TOL;
        });
        if (!bearing) note('ERR', `portal lintel floats — no bearing at (${((ex0 + ex1) / 2).toFixed(2)}, ${((ez0 + ez1) / 2).toFixed(2)})`);
      }
    }
  }
}

// 2. room perimeter closure: each edge must be covered by wall bodies or their openings
function coverageGaps(edge) {
  // edge: {axis:'x'|'z', at, from, to, side} — a room boundary line segment
  const spans = [];
  for (const w of allWalls) {
    const r = wallRect(w);
    const [lo, hi] = edge.axis === 'x' ? [r.z0, r.z1] : [r.x0, r.x1];
    if (edge.at < lo - TOL || edge.at > hi + TOL) continue;            // wall does not touch this line
    const [wf, wt] = edge.axis === 'x' ? [r.x0, r.x1] : [r.z0, r.z1];
    const f = Math.max(edge.from, wf), t = Math.min(edge.to, wt);
    if (t > f) spans.push([f, t]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let cur = edge.from;
  for (const [f, t] of spans) {
    if (f > cur + TOL) gaps.push([cur, f]);
    cur = Math.max(cur, t);
  }
  if (cur < edge.to - TOL) gaps.push([cur, edge.to]);
  return gaps.filter(([f, t]) => t - f > 0.10);
}
const openPairs = [];
for (const r of data.rooms) {
  const edges = [
    { axis: 'x', at: r.z0, from: r.x0, to: r.x1, name: 'N' },
    { axis: 'x', at: r.z1, from: r.x0, to: r.x1, name: 'S' },
    { axis: 'z', at: r.x0, from: r.z0, to: r.z1, name: 'W' },
    { axis: 'z', at: r.x1, from: r.z0, to: r.z1, name: 'E' },
  ];
  for (const e of edges) {
    for (const [f, t] of coverageGaps(e)) {
      // a gap is fine if another room adjoins it (open-plan boundary) or the segment
      // lies inside another room's rect (deliberate carve-out overlap)
      const other = data.rooms.find(o => o !== r && (
        e.axis === 'x' ? ((Math.abs(o.z1 - e.at) < TOL || Math.abs(o.z0 - e.at) < TOL || (o.z0 < e.at && o.z1 > e.at)) && o.x0 < t - TOL && o.x1 > f + TOL)
                       : ((Math.abs(o.x1 - e.at) < TOL || Math.abs(o.x0 - e.at) < TOL || (o.x0 < e.at && o.x1 > e.at)) && o.z0 < t - TOL && o.z1 > f + TOL)));
      if (other) openPairs.push([r.id, other.id]);
      note(other ? 'INFO' : 'ERR', `room ${r.id} ${e.name} edge gap ${f.toFixed(2)}–${t.toFixed(2)}${other ? ` (open to ${other.id})` : ' — leaks outside/into wall void'}`);
    }
  }
}

// 3. reachability: doors (h ≥ 1.9 openings) connect rooms; BFS from any exterior-door room
function roomsTouching(seg) {
  return data.rooms.filter(r =>
    seg.axis === 'x' ? (r.x0 < seg.to - TOL && r.x1 > seg.from + TOL && (Math.abs(r.z0 - seg.at2) < 0.6 || Math.abs(r.z1 - seg.at1) < 0.6))
                     : (r.z0 < seg.to - TOL && r.z1 > seg.from + TOL && (Math.abs(r.x0 - seg.at2) < 0.6 || Math.abs(r.x1 - seg.at1) < 0.6)));
}
const links = [];
for (const w of allWalls) {
  const ax = axisOf(w);
  const ext = data.extWalls.includes(w);
  for (const o of w.openings || []) {
    if (ext ? !o.door : (o.h < 1.9 || (o.sill || 0) > 0.1)) continue;  // ext: only flagged doors; int: any full-height opening
    const from = (ax === 'x' ? w.a[0] : w.a[1]) + o.at;
    const seg = { axis: ax, from, to: from + o.w, at1: ax === 'x' ? w.a[1] : w.a[0], at2: ax === 'x' ? w.b[1] : w.b[0] };
    links.push({ rooms: roomsTouching(seg).map(r => r.id), ext });
  }
}
for (const [a, b] of openPairs) links.push({ rooms: [a, b], ext: false });   // open-plan boundaries connect too
const reach = new Set();
for (const l of links) if (l.ext) l.rooms.forEach(id => reach.add(id));
let grew = true;
while (grew) {
  grew = false;
  for (const l of links) {
    if (l.rooms.some(id => reach.has(id))) for (const id of l.rooms) if (!reach.has(id)) { reach.add(id); grew = true; }
  }
}
for (const r of data.rooms) if (!reach.has(r.id)) note('ERR', `room ${r.id} (${r.name}) unreachable — no door path from an exterior door`);

// 4. DXF ground-truth cross-check
if (process.argv[3]) {
  const raw = require(resolve(process.argv[3]));
  const H = 19.25;
  const dxfV = [], dxfH = [];
  for (const [a, b] of raw) {
    if (a[0] == null || b[0] == null || Math.max(a[0], b[0]) > 11500) continue;
    const ax = a[0] / 1000, az = H - a[1] / 1000, bx = b[0] / 1000, bz = H - b[1] / 1000;
    if (Math.abs(ax - bx) < 0.002) dxfV.push({ at: ax, from: Math.min(az, bz), to: Math.max(az, bz) });
    else if (Math.abs(az - bz) < 0.002) dxfH.push({ at: az, from: Math.min(ax, bx), to: Math.max(ax, bx) });
  }
  const near = (lines, at, from, to) =>
    lines.some(l => Math.abs(l.at - at) <= TOL && l.from < to - 0.05 && l.to > from + 0.05);
  for (const w of allWalls) {
    const r = wallRect(w);
    const faces = axisOf(w) === 'x'
      ? [['H', r.z0, r.x0, r.x1], ['H', r.z1, r.x0, r.x1]]
      : [['V', r.x0, r.z0, r.z1], ['V', r.x1, r.z0, r.z1]];
    for (const [k, at, f, t] of faces) {
      if (!near(k === 'V' ? dxfV : dxfH, at, f, t)) note('WARN', `model wall face ${k}@${at.toFixed(3)} (${f.toFixed(2)}–${t.toFixed(2)}) has no DXF line within ${TOL * 1000} mm`);
    }
  }
  const modelFaces = { V: [], H: [] };
  for (const w of allWalls) {
    const r = wallRect(w);
    if (axisOf(w) === 'x') { modelFaces.H.push([r.z0, r.x0, r.x1], [r.z1, r.x0, r.x1]); }
    else { modelFaces.V.push([r.x0, r.z0, r.z1], [r.x1, r.z0, r.z1]); }
  }
  const covered = (k, l) => modelFaces[k].some(([at, f, t]) => Math.abs(at - l.at) <= TOL && f < l.to - 0.05 && t > l.from + 0.05);
  for (const l of dxfV) if (l.to - l.from >= 1.0 && !covered('V', l)) note('WARN', `DXF vertical wall x=${l.at.toFixed(3)} z ${l.from.toFixed(2)}–${l.to.toFixed(2)} missing in model`);
  for (const l of dxfH) if (l.to - l.from >= 1.0 && !covered('H', l)) note('WARN', `DXF horizontal wall z=${l.at.toFixed(3)} x ${l.from.toFixed(2)}–${l.to.toFixed(2)} missing in model`);
}

const errs = problems.filter(p => p.sev === 'ERR');
for (const p of problems) console.log(`${p.sev.padEnd(4)} ${p.msg}`);
console.log(`\n${errs.length} errors, ${problems.filter(p => p.sev === 'WARN').length} warnings, ${problems.filter(p => p.sev === 'INFO').length} info`);
process.exit(errs.length ? 1 : 0);
