import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const { TERRAIN } = require('./terrain.js');
const { GarageModel } = require('./garage-model.js');
const { PergolaModel } = require('./pergola-model.js');
const { GreenhouseModel } = require('./greenhouse-model.js');
const { RaisedBedsModel } = require('./raised-beds-model.js');
const { SiteTerrain } = require('./site-terrain.js');
const patches = {
  garage: GarageModel.groundPatch(GARDEN, TERRAIN.houseFFLInternal - 0.5),
  pergola: PergolaModel.build(GARDEN).groundPatch,
  greenhouse: GreenhouseModel.build(GARDEN, TERRAIN.plane).groundPatch,
  raisedBeds: RaisedBedsModel.build(GARDEN).groundPatch,
};
const site = SiteTerrain.create(GARDEN, TERRAIN.plane, patches);
const points = [];
for (let x = -2; x <= 48; x += 0.5) for (let y = -2; y <= 38; y += 0.5) points.push([x, y]);
const seamXs = [3.5, 8.3, 10.48, 14.93, 16.5, 20.58, 21.28, 21.78, 22.2, 23.58, 26.18, 43.5];
const seamYs = [2.17, 5.17, 6.68, 6.7, 7.18, 11.58, 15.93, 19.18, 19.4, 25.5, 26.43, 26.5, 28.5, 29.5, 32.5];
for (const x of seamXs) for (const y of seamYs) for (const delta of [-1e-7, 0, 1e-7]) {
  points.push([x + delta, y], [x, y + delta]);
}
const pond = GARDEN.elements.find(element => element.id === 'pond').parts.find(part => part.kind === 'ellipse');
for (const radius of [0, 0.5, 1 - 1e-7, 1, 1 + 1e-7, 1.3 - 1e-7, 1.3, 1.3 + 1e-7]) {
  for (let i = 0; i < 32; i++) points.push([pond.cx + pond.rx * radius * Math.cos(i * Math.PI / 16),
    pond.cy + pond.ry * radius * Math.sin(i * Math.PI / 16)]);
}
const house = GARDEN.elements.find(element => element.id === 'house').parts.find(part => part.kind === 'polygon').points;
const centroid = [0, 1].map(axis => house.reduce((sum, point) => sum + point[axis], 0) / house.length);
const anchors = {
  house: centroid, atrium: [12.5, 17], eastFill: [22.5, 15], eastFillBank: [24.8, 15],
  southBand: [20.5, 27], driveway: [30, 29], pondCenter: [pond.cx, pond.cy],
  hiddenBench: [32.3, 18.55], westDeck: [9.5, 22], southGarden: [9, 30],
};
points.push(...Object.values(anchors));
const digest = values => {
  const bytes = Buffer.alloc(values.length * 8);
  values.forEach((value, index) => bytes.writeDoubleLE(value, index * 8));
  return createHash('sha256').update(bytes).digest('hex');
};
if (process.argv.includes('--record-baseline')) {
  const source = execFileSync('git', ['show', 'a1ba048:index.html'], { encoding: 'utf8' });
  const start = source.indexOf('const basePlaneHeight =');
  const end = source.indexOf('// ───────────────────────── HELPERS', start);
  assert.ok(start >= 0 && end > start, 'Original grading block must be present');
  const original = runInNewContext(`${source.slice(start, end)}; terrainHeight`, {
    TERRAIN, EL: Object.fromEntries(GARDEN.elements.map(element => [element.id, element])),
    garageGround: patches.garage, pergolaModel: { groundPatch: patches.pergola },
    greenhouseModel: { groundPatch: patches.greenhouse }, raisedBedsModel: { groundPatch: patches.raisedBeds },
  });
  console.log(JSON.stringify({ source: 'a1ba048:index.html', count: points.length,
    pointsDigest: digest(points.flat()), heightsDigest: digest(points.map(point => original(...point))),
    anchors: Object.fromEntries(Object.entries(anchors).map(([name, point]) => [name, original(...point)])),
    houseBaseY: original(...centroid), deckTop: original(...centroid) + 0.05 }, null, 2));
  process.exit(0);
}
const golden = JSON.parse(readFileSync(new URL('./site-terrain-golden.json', import.meta.url), 'utf8'));
assert.equal(points.length, golden.count);
assert.equal(digest(points.flat()), golden.pointsDigest, 'Golden comparison coordinates must not change silently');
const heights = points.map(point => site.height(...point));
assert.ok(heights.every(Number.isFinite));
assert.equal(digest(heights), golden.heightsDigest, 'Shared grading must exactly preserve original browser heights');
for (const [name, point] of Object.entries(anchors)) assert.equal(site.height(...point), golden.anchors[name], `${name}: original grade changed`);
assert.equal(site.spec.houseBaseY, golden.houseBaseY);
assert.equal(site.spec.deckTop, golden.deckTop);
assert.ok(Math.abs(site.spec.houseBaseY - 2.459800333333334) < 1e-10);
assert.ok(Math.abs(site.spec.deckTop - 2.509800333333334) < 1e-10);
assert.equal(site.height(...anchors.eastFill), 2.44, 'East terrace fill must remain level');
assert.equal(site.height(...anchors.southBand), 1.9, 'South cut must override the carport blend');
assert.equal(site.height(...anchors.pondCenter), site.spec.pond.edge - 0.55, 'Pond basin must remain recessed');
const serialized = JSON.parse(JSON.stringify(site.spec));
assert.deepEqual(points.map(point => SiteTerrain.height(serialized, ...point)), heights,
  'Serialized recipe must preserve browser grading');
const python = execFileSync('python3', ['-c',
  'import json,sys; from blender.site_terrain import height; data=json.load(sys.stdin); print(json.dumps([height(data["spec"], *p) for p in data["points"]]))'],
{ cwd: new URL('.', import.meta.url), input: JSON.stringify({ spec: serialized, points }), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const pythonHeights = JSON.parse(python);
assert.equal(pythonHeights.length, points.length);
let maxError = 0;
for (let i = 0; i < points.length; i++) {
  const error = Math.abs(pythonHeights[i] - heights[i]);
  assert.ok(Number.isFinite(pythonHeights[i]) && error < 1e-10, `Python grading differs at ${points[i]} by ${error}`);
  maxError = Math.max(maxError, error);
}
console.log(`Site terrain: ${points.length} original-browser golden samples exact; Python max error ${maxError} m; house/deck and grading seams pass`);
