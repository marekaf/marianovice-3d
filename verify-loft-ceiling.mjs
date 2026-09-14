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

const THREE = await import('three');
const { INTERIORS3D } = require('./interiors3d.js');
const { houseFlooringModel } = await import('./docs/house-flooring.js');
const minimal = data => ({ ...data, extWalls: [], intWalls: [], rooms: [], furniture: null, stairs: null, fireplace: null, hatch: null, slopes: [], ceilings: null });
const ground = INTERIORS3D.buildHouse(THREE, minimal(house));
const upper = INTERIORS3D.buildHouse(THREE, minimal(loft), { floorY: loft.floorY });
const hitsAt = (group, x, z) => {
  group.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(x, 6, z), new THREE.Vector3(0, -1, 0)).intersectObject(group, true);
};
for (const x of [5.71, 6.3, 7.7, 8.42]) {
  assert.equal(hitsAt(ground.ceiling, x, 12.84).length, 0, 'Ceiling has no ledge between the cathedral wall and stair opening');
  assert.equal(hitsAt(upper.floor, x, 12.84).length, 0, 'Loft floor has no ledge between the cathedral wall and stair opening');
}
for (const [x, z] of [[8.6, 13.4], [6.3, 14.2]]) {
  assert(hitsAt(ground.ceiling, x, z).length > 0, 'Ceiling beside the stair opening remains solid');
  assert(hitsAt(upper.floor, x, z).length > 0, 'Loft landing beside the stair opening remains solid');
}
for (const part of houseFlooringModel(loft).parts) {
  const [x, z] = part.position, [w, d] = part.size;
  assert(overlap({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 },
    { x0: 5.70, x1: 8.43, z0: 12.80, z1: 12.88 }) < 1e-10, 'Floor finish stops at the open stair edge');
}
const lowerWall = INTERIORS3D.buildHouse(THREE, { ...minimal(house),
  intWalls: [{ ...house.intWalls.find(wall => wall.id === 'W25'), id: undefined }] });
const galleryWall = INTERIORS3D.buildHouse(THREE, { ...minimal(loft),
  intWalls: [{ ...loft.intWalls.find(wall => wall.id === 'P9'), id: undefined }] }, { floorY: loft.floorY });
const wallHits = (group, x, y) => {
  group.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(x, y, 13.6), new THREE.Vector3(0, 0, -1)).intersectObject(group, true);
};
for (const x of [5.71, 6.3, 7.7, 8.42]) {
  for (const y of [2.54, 2.7, 2.919, 2.921, 3.05]) {
    const group = y < loft.floorY ? lowerWall.int : galleryWall.int;
    const hits = wallHits(group, x, y);
    assert(hits.length > 0, 'The stair-facing wall closes continuously across the loft floor height');
    assert(Math.abs(hits[0].point.z - 12.88) < 1e-6, 'Closure and gallery have the same stair-facing plane');
  }
  assert(Math.abs(wallHits(lowerWall.int, x, 2.5)[0].point.z - 13.05) < 1e-6,
    'The ground-floor wall retains its measured face and 170 mm setback to the gallery');
}
console.log(`Loft ceiling: ${checked} open cells covered once; partition edges and 2.27 m height preserved`);
