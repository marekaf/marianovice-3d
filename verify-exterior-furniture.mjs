import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const { ExteriorFurnitureModel } = require('./exterior-furniture-model.js');
const { PergolaModel } = require('./pergola-model.js');
const lounge = ExteriorFurnitureModel.build(GARDEN, 2.51);
const pergola = PergolaModel.build(GARDEN);
const intersects = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.d && a.y+a.d > b.y;
const routes = [
  {name:'east route toward pergola',x:22.58,y:11.58,w:1,d:7.82},
  {name:'east sliding doorway approach',x:20.58,y:14.18,w:.9,d:2.58},
  {name:'atrium opening approach',x:13.73,y:15.93,w:1.2,d:3.25},
  {name:'atrium opening to west path',x:10.48,y:15.93,w:4.45,d:1.1},
];
for (const route of routes) for (const item of lounge.footprints)
  assert.ok(!intersects(route,item), `${item.name} blocks ${route.name}`);
assert.deepEqual(lounge, ExteriorFurnitureModel.build(GARDEN, 2.51));
assert.equal(lounge.footprints.length, 6);
assert.equal(lounge.feet.length, 16);
assert.equal(lounge.circulation.length, 4);
const eastTerrace = GARDEN.elements.find(e=>e.id==='eastTerrace').parts.find(p=>p.kind==='rect');
assert.equal(eastTerrace.w,3);
assert.equal(eastTerrace.d,7.82);
const worktop = lounge.parts.find(p=>p.name==='outdoor_kitchen_top');
assert.ok(worktop.position[2]+worktop.size[2]/2 <= .8, 'Worktable must sit below the kitchen sill');
const fitted=lounge.footprints.find(p=>p.name==='outdoor_kitchen_table');
assert.ok(Math.abs(fitted.x-20.58)<1e-9&&Math.abs(fitted.y-11.58)<1e-9);
assert.ok(Math.abs(fitted.w-.7)<1e-9&&Math.abs(fitted.d-2.6)<1e-9,'Joinery fills the kitchen portion of the recess');
assert.equal(lounge.parts.filter(p=>p.name.startsWith('outdoor_kitchen_door_')).length,4);
const fronts=lounge.parts.filter(p=>p.name.startsWith('outdoor_kitchen_door_')).sort((a,b)=>a.position[1]-b.position[1]);
for(const name of ['joinery_front','joinery_case']){
  assert.equal(lounge.materials[name].color,'#45494a','Cabinet paint matches the modeled window frame colour');
  assert.equal(lounge.materials[name].grain,undefined,'Painted cabinetry must not retain raw timber grain');
}
for(const front of fronts){
  assert.ok(Math.abs(front.position[0]+front.size[0]/2-21.278)<1e-9,'Closed fronts sit within the notch face');
  assert.ok(front.position[2]-front.size[2]/2>=.099&&front.position[2]+front.size[2]/2<=.751);
}
for(let i=1;i<fronts.length;i++)assert.ok(Math.abs(fronts[i].position[1]-fronts[i].size[1]/2-fronts[i-1].position[1]-fronts[i-1].size[1]/2-.003)<1e-9,'Only joinery reveals separate the closed fronts');
assert.ok(!lounge.parts.some(p=>/outdoor_kitchen_(towel|lower_slat|leg_|rail_)/.test(p.name)),'No freestanding table or hanging accessories');
assert.ok(Math.abs(worktop.position[1]-12.88)<.001,'Worktop spans the full usable nook');
const sofa=lounge.footprints.find(p=>p.name==='east_sofa');
const coffee=lounge.footprints.find(p=>p.name==='east_low_table');
for(const name of ['east_low_table','atrium_low_table']){
  const table=lounge.parts.find(p=>p.name===name),profile=table.profile;
  assert.equal(Math.max(...profile.map(p=>p[0])),.3,'Garbet diameter is600mm');
  assert.equal(Math.max(...profile.map(p=>p[1])),.4,'Garbet height is400mm');
  assert(profile.filter(([r,h])=>h>=.20&&h<=.39).every(([r])=>r>=.295),'Garbet upper body must have near-vertical drum sides, not a tapering pot');
  assert(profile.some(([r,h])=>h===.4&&r>=.295),'Flat tabletop must extend to its outer edge');
  assert(profile.some(([r,h])=>h>.025&&h<.08&&r>.22),'Garbet lower body should round outward from its recessed base');
}
assert.equal(sofa.w,.8);assert.equal(sofa.d,1.64);
assert.ok(sofa.x>=20.58&&sofa.x<20.8,'Sofa back sits beside the portal');
assert.ok(coffee.x>sofa.x+sofa.w,'Coffee table sits garden-side of the sofa');
assert.equal(lounge.floorHeight, 2.51);
for (const model of [lounge, pergola]) {
  assert.equal(new Set(model.parts.map(p => p.name)).size, model.parts.length);
  for (const part of model.parts) {
    assert.ok(model.materials[part.material], part.name);
    for (const key of ['position', 'size', 'start', 'end']) if (part[key]) assert.ok(part[key].every(Number.isFinite), part.name);
    if (part.vertices) {
      assert.ok(part.vertices.flat().every(Number.isFinite), part.name);
      assert.ok(part.faces.flat().every(i => Number.isInteger(i) && i >= 0 && i < part.vertices.length), part.name);
    }
  }
}
const rectangles = GARDEN.elements.filter(e => ['eastTerrace','westTerrace'].includes(e.id)).flatMap(e => e.parts.filter(p => p.kind === 'rect'));
for (const p of lounge.footprints) assert.ok(rectangles.some(r => p.x >= r.x && p.y >= r.y && p.x+p.w <= r.x+r.w && p.y+p.d <= r.y+r.d), p.name+' must fit its terrace');
for (const foot of lounge.feet) {
  const part = lounge.parts.find(p => p.name === foot.name);
  assert.ok(Math.abs(part.position[2] - part.size[2]/2) < 1e-10, foot.name+' must touch finished surface');
}
const overlap = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.d && a.y+a.d > b.y;
for (let i=0;i<lounge.footprints.length;i++) for (let j=i+1;j<lounge.footprints.length;j++) assert.ok(!overlap(lounge.footprints[i],lounge.footprints[j]));
assert.equal(pergola.diningSeats.length, 8);
assert.equal(pergola.parts.filter(p => p.name.startsWith('plate_')).length, 8);
assert.ok(!pergola.parts.some(p => p.name.startsWith('bench_')));
const element = GARDEN.elements.find(e => e.id === 'pergola');
const table = element.parts.find(p => p.role === 'table');
const paving = element.parts.find(p => p.role === 'paving');
const seatRects = pergola.diningSeats.map(seat => {
  const sideways = Math.abs(Math.sin(seat.angle)) > .5;
  const w=sideways?seat.depth:seat.width,d=sideways?seat.width:seat.depth;
  return {x:seat.center[0]-w/2,y:seat.center[1]-d/2,w,d};
});
for (const [i,r] of seatRects.entries()) {
  assert.ok(!overlap(r,table), 'Chair must not overlap table');
  assert.ok(r.x>=paving.x && r.y>=paving.y && r.x+r.w<=paving.x+paving.w && r.y+r.d<=paving.y+paving.d);
  assert.ok(r.y > element.parts[0].y+.4, 'Chair must clear north privacy wall');
  for(let j=i+1;j<seatRects.length;j++)assert.ok(!overlap(r,seatRects[j]), 'Chairs must not overlap');
  const name = pergola.diningSeats[i].name;
  for(let leg=0;leg<2;leg++)for(let end=0;end<2;end++) {
    const glide=pergola.parts.find(p=>p.name===name+'_glide_'+leg+'_'+end);
    const beam=pergola.parts.find(p=>p.name===name+'_leg_'+leg+'_'+end);
    assert.ok(Math.abs(glide.position[2]-glide.size[2]/2)<1e-10);
    assert.ok(beam.start[2] <= glide.position[2]+glide.size[2]/2+.005);
    assert.ok(beam.end[2]>=.43);
  }
}
console.log(`Outdoor furniture: ${lounge.parts.length} lounge parts; eight individual dining chairs; feet, terrace bounds and privacy clearances pass`);
