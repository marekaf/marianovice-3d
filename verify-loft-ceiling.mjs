import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loftInteriorModel } from './docs/loft-interior.js';
import { HOUSE_FLUE_INTERIOR_TOP } from './house-chimney.js';
import { stairFinishSurfaces } from './docs/stair-finishes.js';

const require = createRequire(import.meta.url);
const { HOUSE_LOFT: loft, HOUSE_INTERIOR: house } = require('./house-interior.js');
assert.equal(loft.floorY, 2.92, 'Revised loft plan places the landing at +2.920 m');
assert(Math.abs(house.lid.top - 2.77) < 1e-9, 'Section A places the structural ceiling top at +2.770 m');
assert(Math.abs(house.lid.top - (loft.floorY - loft.floorDepth)) < 1e-9,
  'Structural ceiling and loft floor build-up meet without an open gap or overlap');
assert(Math.abs(house.stairs.rise * (house.stairs.steps + 1) - loft.floorY) < 1e-9,
  'Thirteen treads and the final landing rise reach the shared loft level');
assert(Math.abs(house.stairs.rise * house.stairs.steps - 2.712) < .001,
  'The +2.712 m drawing label belongs to the last tread, not the landing');
const flue = loftInteriorModel(loft).parts.find(part => part.name === 'loft_black_flue');
const finishes = stairFinishSurfaces(house.stairs);
assert.equal(finishes.filter(surface => surface.kind === 'tread').length, 13);
assert.equal(finishes.filter(surface => surface.kind === 'riser').length, 14);
const landingRiser = finishes.find(surface => surface.name === 'vinyl_riser_13');
assert(Math.abs(landingRiser.position[1] + landingRiser.size[1] / 2 - (loft.floorY - .003)) < 1e-9,
  'The landing edge receives vinyl up to the normal 3 mm finish margin');
assert(Math.abs(loft.floorY + flue.position[2] + flue.height / 2 - HOUSE_FLUE_INTERIOR_TOP) < 1e-9,
  'Loft placement preserves the shared flue endpoint');
const inside = (rect, x, z) => x > rect.x0 && x < rect.x1 && z > rect.z0 && z < rect.z1;
const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
  * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
const walls = [...loft.extWalls, ...loft.intWalls].map(wall => ({
  id: wall.id, x0: wall.a[0], z0: wall.a[1], x1: wall.b[0], z1: wall.b[1],
}));
assert.equal(loft.clearH, 2.27, 'The measured flat ceiling height remains unchanged');
for (const [x, z] of [[7.72, 17], [7.72, 13.5]]) {
  assert.equal(loft.ceilings.filter(panel => inside(panel, x, z)).length, 1,
    `Flat ceiling closes the unpartitioned strip at ${x}, ${z}`);
}

const regions = [
  { x0: 5.59, z0: .45, x1: 9.51, z1: 6.75 },
  { x0: 5.59, z0: 12.88, x1: 9.51, z1: 18.80 },
];
let checked = 0;
for (const region of regions) {
  const bounds = [region, ...loft.ceilings, ...walls];
  const cuts = axis => [...new Set(bounds.flatMap(rect => [rect[`${axis}0`], rect[`${axis}1`]])
    .filter(value => value >= region[`${axis}0`] && value <= region[`${axis}1`]))].sort((a, b) => a - b);
  const xs = cuts('x'), zs = cuts('z');
  for (let i = 1; i < xs.length; i++) for (let j = 1; j < zs.length; j++) {
    const x = (xs[i - 1] + xs[i]) / 2, z = (zs[j - 1] + zs[j]) / 2;
    if (walls.some(wall => inside(wall, x, z))) continue;
    assert.equal(loft.ceilings.filter(panel => inside(panel, x, z)).length, 1,
      `Exactly one flat ceiling panel covers the open area at ${x}, ${z}`);
    checked++;
  }
}
for (const wall of walls.filter(wall => ['P10', 'P11'].includes(wall.id))) {
  for (const panel of loft.ceilings) assert(overlap(wall, panel) < 1e-10,
    `Ceiling panels stop at the ${wall.id} partition`);
}
for (const patch of [
  { x0: 7.65, z0: 12.88, x1: 7.80, z1: 13.95 },
  { x0: 7.65, z0: 15.65, x1: 7.80, z1: 18.80 },
]) for (const wall of walls) assert(overlap(patch, wall) < 1e-10,
  `Gap closure stays outside ${wall.id}`);
console.log(`Loft ceiling: ${checked} open cells covered once; partition edges and 2.27 m height preserved`);
