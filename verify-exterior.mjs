// Verifies layout.js site geometry:
//   node verify-exterior.mjs [site-truth.json]
// Always: structures inside the plot, no structure overlaps, vehicles inside their bays,
// the garage gate must lie inside the driveway polygon edge. With a site-truth file
// (local, DWG-derived): footprints, positions and openings must match it to 5 cm.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const problems = [];
const note = (sev, msg) => problems.push({ sev, msg });
const EL = Object.fromEntries(GARDEN.elements.map(e => [e.id, e]));
const rectOf = id => EL[id] && EL[id].parts.find(p => p.kind === 'rect');
const TOL = 0.05;

// structures inside the plot polygon
const pts = GARDEN.plot.vertices;
const inPlot = (x, z) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};
const structures = ['garage', 'carport', 'parking', 'sauna', 'greenhouse', 'pergola'].map(id => [id, rectOf(id)]).filter(([, r]) => r);
for (const [id, r] of structures) {
  for (const [cx, cz] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]]) {
    if (!inPlot(cx, cz)) note('ERR', `${id} corner (${cx.toFixed(2)}, ${cz.toFixed(2)}) outside the plot`);
  }
}
for (let i = 0; i < structures.length; i++) for (let j = i + 1; j < structures.length; j++) {
  const [ai, A] = structures[i], [aj, B] = structures[j];
  const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
  const oz = Math.min(A.y + A.d, B.y + B.d) - Math.max(A.y, B.y);
  if (ox > TOL && oz > TOL) note('ERR', `${ai} overlaps ${aj} by ${ox.toFixed(2)}×${oz.toFixed(2)} m`);
}

// vehicles inside their bays (with the garage's wall thickness honoured)
const bays = { carport: rectOf('carport'), garage: rectOf('garage'), parking: rectOf('parking') };
const wallT = (EL.garage.meta && EL.garage.meta.wallT) || 0;
for (const v of GARDEN.vehicles || []) {
  const b = bays[v.bay];
  if (!b) continue;
  const inset = v.bay === 'garage' ? wallT : 0;
  const x0 = v.cx - v.w / 2, x1 = v.cx + v.w / 2, z0 = v.noseZ, z1 = v.noseZ + v.l;
  if (x0 < b.x + inset - TOL || x1 > b.x + b.w - inset + TOL || z0 < b.y + inset - TOL || z1 > b.y + b.d - inset + TOL) {
    note('ERR', `${v.name} sticks out of the ${v.bay} bay (x ${x0.toFixed(2)}–${x1.toFixed(2)}, z ${z0.toFixed(2)}–${z1.toFixed(2)})`);
  }
}

// DWG ground truth
if (process.argv[2]) {
  const truth = require('./' + process.argv[2]);
  const cmp = (what, got, want) => { if (Math.abs(got - want) > TOL) note('ERR', `${what}: model ${got.toFixed(2)} vs DPS ${want.toFixed(2)} (Δ ${(got - want).toFixed(2)} m)`); };
  const house = EL.house.meta.bbox;
  cmp('house x', house[0], truth.house.x); cmp('house z', house[1], truth.house.z);
  cmp('house w', house[2] - house[0], truth.house.w); cmp('house d', house[3] - house[1], truth.house.d);
  const g = rectOf('garage');
  cmp('garage x', g.x, truth.garage.x); cmp('garage z', g.y, truth.garage.z);
  cmp('garage w', g.w, truth.garage.w); cmp('garage d', g.d, truth.garage.d);
  cmp('garage wallT', wallT, truth.garage.wallT);
  const cp = rectOf('carport');
  cmp('carport gap (house→garage)', cp.w, truth.carportGapW);
  const gate = (EL.garage.meta.openings || []).find(o => o.kind === 'gate');
  if (gate) { cmp('garage gate from', gate.from, truth.garageGate.fromX); cmp('garage gate width', gate.w, truth.garageGate.w); }
  const door = (EL.garage.meta.openings || []).find(o => o.kind === 'door');
  if (door) { cmp('garage west door from', door.from, truth.garageWestDoor.fromZ); cmp('garage west door width', door.w, truth.garageWestDoor.w); }
  if (truth.garageSouthFlushWithHouse) cmp('garage south edge flush with house south', g.y + g.d, house[3]);
}

const errs = problems.filter(p => p.sev === 'ERR');
for (const p of problems) console.log(`${p.sev.padEnd(4)} ${p.msg}`);
console.log(`\n${errs.length} errors, ${problems.length - errs.length} warnings`);
process.exit(errs.length ? 1 : 0);
