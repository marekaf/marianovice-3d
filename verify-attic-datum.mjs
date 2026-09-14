import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { buildModel } from './model3d.js';
import { loftInteriorModel } from './docs/loft-interior.js';
import { prepareLoftRoofData, attachLoftRoofWindows } from './docs/loft-roof-windows.js';

const require = createRequire(import.meta.url);
const { HOUSE_INTERIOR: house, HOUSE_LOFT: loft } = require('./house-interior.js');
const { INTERIORS3D } = require('./interiors3d.js');
const { HouseRoof } = require('./house-roof.js');
globalThis.document = { createElement() { return { getContext() { return {
  fillRect() {}, fillText() {}, createImageData(w, h) { return { data: new Uint8ClampedArray(w*h*4) }; }, putImageData() {},
}; } }; } };
const minimal = data => ({ ...data, extWalls: [], intWalls: [], rooms: [], furniture: null, stairs: null,
  fireplace: null, hatch: null, slopes: [], ceilings: [] });
const ground = INTERIORS3D.buildHouse(THREE, minimal(house));
const upper = INTERIORS3D.buildHouse(THREE, minimal(loft), { floorY: loft.floorY });
const details = loftInteriorModel(loft);
const concrete = buildModel(THREE, { ...details, floorHeight: loft.floorY,
  parts: details.parts.filter(part => part.category === 'floorFinish') });
const floors = new THREE.Group();
floors.add(ground.ceiling, upper.floor, concrete);
floors.updateMatrixWorld(true);
const down = (x,z) => new THREE.Raycaster(new THREE.Vector3(x, 4, z), new THREE.Vector3(0,-1,0)).intersectObject(floors, true);
for (const [x,z] of [[3.7,1],[6,3],[7,5],[9.4,6.6]]) {
  const hits = down(x,z);
  assert(hits.length && Math.abs(hits[0].point.y-2.77)<1e-6, 'Northern attic concrete surface is exactly +2.770');
  assert.equal(hits.filter(hit => Math.abs(hit.point.y-2.77)<1e-6).length, 1, 'Concrete replaces the structural top face without coincident surfaces');
}
assert.equal(down(4.6,2.8).length, 0, 'The attic hatch remains physically open');
for (const [x,z] of [[6.2,17],[8.5,14.8]]) assert(Math.abs(down(x,z)[0].point.y-2.92)<1e-6, 'Southern floor remains +2.920');
const opening = house.gableOpening();
const window = buildModel(THREE, opening);
const windowBounds = new THREE.Box3().setFromObject(window);
assert(Math.abs(windowBounds.min.y-3.87)<1e-6 && Math.abs(windowBounds.max.y-4.87)<1e-6, 'Actual gable frame and reveals span +3.870 to +4.870');
assert(Math.abs(windowBounds.max.x-windowBounds.min.x-.75)<1e-6, 'Gable window retains its 750 mm width');
const separate = loft.buildOpening(loft.extWalls.find(wall=>wall.id==='P1'));
assert(Math.abs(separate.opening.sill+loft.floorY-3.87)<1e-6, 'Standalone loft and garden use the same absolute O7 sill');
const roof = HouseRoof.describe({ bbox:[0,0,10.8,19.25], atrium:[0,8.75,4.45,11.99], gable:[3.2,10.8] });
const prepared = prepareLoftRoofData(loft, roof, { parts:[], cutouts:[], materials:{}, lights:[], floorHeight:0 });
const view = { ceiling:new THREE.Group() };
const lining = attachLoftRoofWindows(THREE, view, prepared, { buildModel });
lining.group.updateMatrixWorld(true);
for (const x of [4,5.7,7,8.3,9.4]) {
  const hits = new THREE.Raycaster(new THREE.Vector3(x,3,3), new THREE.Vector3(0,1,0)).intersectObject(lining.lining,true);
  const expected = (x<roof.ridgeX?roof.mainWest:roof.mainEast).heightAt(x)-.480*Math.SQRT2;
  assert(hits.length && Math.abs(hits[0].point.y-expected)<1e-5, 'Northern ceiling follows the detailed roof lining with no flat cap');
}
const south = new THREE.Raycaster(new THREE.Vector3(7,3,17), new THREE.Vector3(0,1,0)).intersectObject(lining.lining,true);
assert(Math.abs(south[0].point.y-5.19)<1e-6, 'Southern ceiling remains at its existing height');
console.log('Northern attic: +2.770 concrete, open hatch, O7 +3.870–4.870, roof-following ceiling; southern levels preserved');
