import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const { TERRAIN } = require('./terrain.js');
const { SaunaModel } = require('./sauna-model.js');
const { SiteTerrain } = require('./site-terrain.js');
const { GarageModel } = require('./garage-model.js');
const { PergolaModel } = require('./pergola-model.js');
const { GreenhouseModel } = require('./greenhouse-model.js');
const { RaisedBedsModel } = require('./raised-beds-model.js');
const site = SiteTerrain.create(GARDEN, TERRAIN.plane, {
  garage: GarageModel.groundPatch(GARDEN, TERRAIN.houseFFLInternal - 0.5),
  pergola: PergolaModel.build(GARDEN).groundPatch,
  greenhouse: GreenhouseModel.build(GARDEN, TERRAIN.plane).groundPatch,
  raisedBeds: RaisedBedsModel.build(GARDEN).groundPatch,
});
const model = SaunaModel.build(GARDEN, site.spec.deckTop);
const parts = new Map(model.parts.map(p => [p.name, p]));
const rect = id => GARDEN.elements.find(e => e.id === id).parts.find(p => p.kind === 'rect');
const sauna = rect('sauna');
const top = p => p.position[2] + p.size[2] / 2;
const bottom = p => p.position[2] - p.size[2] / 2;
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.001, `${a} != ${b}`);
const bounds = p => ({ min: p.position.map((v, i) => v - p.size[i] / 2), max: p.position.map((v, i) => v + p.size[i] / 2) });
const overlaps = (a, b) => a.min.every((v, i) => Math.min(a.max[i], b.max[i]) - Math.max(v, b.min[i]) > 0.001);

assert.equal(parts.size, model.parts.length, 'Part names must be unique');
assert.deepEqual(model, SaunaModel.build(GARDEN, site.spec.deckTop), 'Geometry must be repeatable');
near(model.floorHeight, site.spec.deckTop);
assert.ok(!model.parts.some(p => /^entry_(step|tread)/.test(p.name)), 'House-to-sauna route must not contain stairs');
for (const r of GARDEN.elements.filter(e => ['sauna', 'saunaShelter', 'saunaPath'].includes(e.id)).flatMap(e => e.parts.filter(p => p.kind === 'rect'))) {
  for (let x = r.x; x <= r.x + r.w; x += 0.1) for (let z = r.y; z <= r.y + r.d; z += 0.1)
    assert.ok(site.height(x, z) <= model.floorHeight - 0.1, 'Soil must stay below sauna decks and approach');
}
for (const part of model.parts) {
  assert.ok(['N', 'S', 'E', 'W', 'floor', 'roof', 'furniture', 'outdoor'].includes(part.category), `${part.name}: missing cutaway owner`);
  assert.ok(model.materials[part.material], `${part.name}: missing material`);
  assert.ok([...part.position || [], ...part.size || [], ...part.vertices?.flat() || [], ...part.profile?.flat() || []].every(Number.isFinite));
  if (part.size) assert.ok(part.size.every(v => v > 0), `${part.name}: degenerate geometry`);
}
const shelter = rect('saunaShelter');
const roof = parts.get('shared_roof');
near(roof.size[0], 5);
near(roof.size[1], 2.5);
assert.equal(SaunaModel.roofFootprints(GARDEN).length, 1, 'The whole construction has one roof');
assert.ok(!model.parts.some(p => /^(log_|shelter_roof|tub_step)/.test(p.name)));
near(bottom(parts.get('sauna_ceiling')), 2.4);
for (const part of model.parts.filter(p => !p.name.startsWith('landing_'))) {
  const points = part.vertices || (part.size ? [bounds(part).min, bounds(part).max] : part.profile
    ? part.profile.flatMap(([r, z]) => [[part.position[0] - r, part.position[1] - r, z], [part.position[0] + r, part.position[1] + r, z]])
    : [[part.position[0] - part.radiusTop, part.position[1] - part.radiusTop], [part.position[0] + part.radiusTop, part.position[1] + part.radiusTop]]);
  for (const [px, py] of points) assert.ok(px >= shelter.x - 1e-9 && px <= sauna.x + sauna.w + 1e-9 && py >= sauna.y - 1e-9 && py <= sauna.y + sauna.d + 1e-9,
    `${part.name} leaves the 5 × 2.5 m construction`);
}
near(model.rooms.hall.w, 0.85);
near(model.rooms.sauna.w, 1.53);
near(model.rooms.sauna.d, 2.26);
near(parts.get('bench_upper_slat_0').size[1], 2);
const chair = bounds(parts.get('hall_chair_seat'));
assert.ok(chair.min[0] > model.rooms.hall.x && chair.max[0] < model.rooms.hall.x + model.rooms.hall.w);
for (const swing of model.doorSwings) {
  const [xx, yy, width, depth] = swing.bounds;
  if (swing.name === 'sauna_door') assert.ok(xx >= model.rooms.hall.x - 1e-9 && xx + width <= model.rooms.hall.x + model.rooms.hall.w + 0.04 + 1e-9);
  assert.ok(!overlaps({ min: [xx, yy, 0.01], max: [xx + width, yy + depth, 2.05] }, chair), 'Chair obstructs a door swing');
}
const glass = model.parts.filter(p => /_window_glass$/.test(p.name));
assert.equal(glass.length, 2);
assert.ok(glass.every(p => p.category === 'S' && p.size[2] >= 2.3));
assert.ok(glass.reduce((sum, p) => sum + p.size[0], 0) > sauna.w * 0.85, 'South front must be a glazed wall');
for (const opening of model.openings) {
  assert.equal(opening.side, 'west', 'Both entrances are side doors from the Softub bay through the hall');
  const aperture = { min: [opening.x, opening.from + 0.05, 0.02], max: [opening.x + 0.16, opening.to - 0.05, 2.05] };
  for (const part of model.parts.filter(p => p.type === 'box' && /^(wall_|cladding_|hall_partition)/.test(p.name)))
    assert.ok(!overlaps(aperture, bounds(part)), `${part.name} obstructs ${opening.name}`);
}
const tub = GARDEN.elements.find(e => e.id === 'softub').parts.find(p => p.kind === 'circle');
const profile = parts.get('tub_shell').profile;
near(Math.max(...profile.map(([r]) => r)) * 2, 1.8);
near(Math.max(...profile.map(([, z]) => z)), 0.61);
assert.ok(profile.some(([r, z]) => Math.abs(r - 0.75) < 1e-9 && z > 0.5), 'Softub inner diameter is 1.5 m');
assert.ok(parts.get('tub_water').position[2] < 0.61 - 0.1);
near(parts.get('tub_base').position[2] - parts.get('tub_base').height / 2, 0);
const pump = bounds(parts.get('tub_pump'));
const circleRectGap = (cx, cy, r, b) => Math.hypot(cx - Math.max(b.min[0], Math.min(cx, b.max[0])), cy - Math.max(b.min[1], Math.min(cy, b.max[1]))) - r;
assert.ok(circleRectGap(tub.cx, tub.cy, tub.r, pump) >= 0.08, 'Pump does not overlap the tub');
const externalSwing = model.doorSwings.find(s => s.name === 'entrance');
assert.ok(Math.hypot(externalSwing.hinge[0] - tub.cx, externalSwing.hinge[1] - tub.cy) - externalSwing.radius - tub.r > 0.1,
  'Outward entrance door clears the Softub throughout its swing');
assert.ok(circleRectGap(...externalSwing.hinge, externalSwing.radius, pump) > 0.1, 'Entrance swing clears the pump');
assert.ok(circleRectGap(...externalSwing.hinge, externalSwing.radius, bounds(parts.get('shelter_front_post'))) > 0.1, 'Entrance swing clears the post');
assert.ok(model.doorSwings[0].bounds[0] + model.doorSwings[0].bounds[2] < model.doorSwings[1].bounds[0], 'Both door swings are separate');
for (const part of model.parts.filter(p => p.name.startsWith('shelter_privacy_'))) {
  const b = { min: [0, 1].map(i => Math.min(...part.vertices.map(v => v[i]))), max: [0, 1].map(i => Math.max(...part.vertices.map(v => v[i]))) };
  assert.ok(circleRectGap(tub.cx, tub.cy, tub.r, b) >= 0.009, 'Tub clears both integrated privacy walls');
}
const entry = model.openings[0];
const entryCenter = (entry.from + entry.to) / 2;
const route = [[sauna.x - 0.32, sauna.y + sauna.d + 0.4], [sauna.x - 0.32, entryCenter], [sauna.x + 0.48, entryCenter]];
for (let segment = 0; segment < route.length - 1; segment++) for (let i = 0; i <= 100; i++) {
  const [a, b] = [route[segment], route[segment + 1]], t = i / 100, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
  assert.ok(Math.hypot(px - tub.cx, py - tub.cy) - tub.r >= 0.3, 'A 60 cm pedestrian envelope reaches the hall without entering the tub');
  assert.ok(circleRectGap(px, py, 0.3, pump) >= 0, 'Pump obstructs the entrance route');
}
near(top(parts.get('bench_light')), bottom(parts.get('bench_upper_slat_0')));
near(top(parts.get('heater_foot_0')), bottom(parts.get('heater_body')));
near(bottom(parts.get('heater_foot_0')), top(parts.get('heater_hearth')));
near(top(parts.get('bench_step_leg_0')), bottom(parts.get('bench_step')));
console.log(`Sauna: ${model.parts.length} parts; one 5 × 2.5 m roof, side-entry hall/chair, glass front, 1.8 m Softub and clear access pass`);

const {GradingZones}=require('./grading-zones.js');

const facility=[rect('sauna'),rect('saunaShelter')];
near(Math.max(...facility.map(p=>p.x+p.w))-Math.min(...facility.map(p=>p.x)),5);
near(Math.max(...facility.map(p=>p.y+p.d))-Math.min(...facility.map(p=>p.y)),2.5);
if(existsSync(new URL('./docs/fence-survey.js',import.meta.url))) {
const {FENCE_SURVEY}=require('./docs/fence-survey.js');
const gap=GradingZones.create(GARDEN).dimensions.find(d=>d.id==='saunaFenceGap');
assert.equal(gap.value,'2,00 m');
assert(Math.abs(Math.hypot(gap.from[0]-gap.to[0],gap.from[1]-gap.to[1])-2)<1e-9,'Complete building roof sits exactly2m from measured fence');
assert(FENCE_SURVEY.segments.some(s=>{const [a,b]=[s.start,s.end];return Math.abs(Math.hypot(gap.to[0]-a[0],gap.to[1]-a[1])+Math.hypot(gap.to[0]-b[0],gap.to[1]-b[1])-Math.hypot(a[0]-b[0],a[1]-b[1]))<1e-9;}),'Clearance endpoint lies on an actual measured fence segment');
for(const p of SaunaModel.roofFootprints(GARDEN))for(const point of p)for(const segment of FENCE_SURVEY.segments){
  const [a,b]=[segment.start,segment.end],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/(dx*dx+dz*dz)));
  assert(Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dz)>=2-1e-9,'Every sauna and shelter roof corner clears the fixed fence');
}
const moved=structuredClone(GARDEN);
for(const id of ['sauna','saunaShelter'])for(const p of moved.elements.find(e=>e.id===id).parts)if(p.y!==undefined)p.y+=.1;
const movedGap=GradingZones.create(moved).dimensions.find(d=>d.id==='saunaFenceGap');
assert(Math.hypot(movedGap.from[0]-movedGap.to[0],movedGap.from[1]-movedGap.to[1])>2.09,'Dimension follows model geometry rather than a fixed2m label');

}
