import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const element = id => GARDEN.elements.find(item => item.id === id);
const rect = id => element(id).parts.find(part => part.kind === 'rect');
const footprint = id => {
  const { x, y, w, d } = rect(id);
  return [x, y, w, d];
};
const fixedIds = ['house', 'garage', 'carport', 'driveway', 'eastTerrace', 'westTerrace', 'northPassage'];
const fixed = GARDEN.elements.filter(item => fixedIds.includes(item.id));
assert.equal(createHash('sha256').update(JSON.stringify(fixed)).digest('hex'),
  'a987da7fd6f269925bc7996a9acfb0496bc702cbc2df3ffd352ba16f5221ceb4',
  'The approved garden layout must not change buildings, terraces or the north passage');
assert.deepEqual(footprint('pergola'), [25, 6.8, 6, 4]);
assert.deepEqual(footprint('sauna'), [5.3, 2, 4, 3]);
assert.deepEqual(footprint('saunaShelter'), [2.3, 2, 3, 3]);
assert.deepEqual(footprint('greenhouse'), [1, 24, 2.6, 3.6]);
assert.deepEqual(footprint('compost'), [1, 28.5, 2, 1]);
assert.deepEqual(footprint('zasivarna'), [35.8, 16.5, 1.8, .5]);
assert.deepEqual(['raisedBed1','raisedBed2','raisedBed3','raisedBed4'].map(footprint),
  [[5,24,1,2],[7,24,1,2],[5,27,1,2],[7,27,1,2]]);
const table = element('pergola').parts.find(part => part.role === 'table');
assert.deepEqual([table.w, table.d], [2.4, 1.1]);
assert.equal(element('pergola').meta.grading.level, 2.1);
const fire = element('firePit').parts.filter(part => part.kind === 'circle');
assert.deepEqual(fire.map(part => [part.cx, part.cy, part.r]), [[34.5,8.5,2],[34.5,8.5,.5],[34.5,8.5,.496]]);
const pond = element('pond').parts[0];
assert.deepEqual([pond.cx,pond.cy,pond.rx,pond.ry], [34.8,14,2.8,2]);
assert.equal(new Set(GARDEN.elements.map(item => item.id)).size, GARDEN.elements.length);
assert.equal(GARDEN.gardenRoutes.length, 9);
assert.deepEqual(GARDEN.gardenRoutes.find(route => route.id === 'Gathering connection'),
  {id:'Gathering connection',points:[[31.5,8.7],[32.5,8.7]],width:1.4});
const paving=element('pergola').parts.find(p=>p.role==='paving');
const dining=GARDEN.gardenRoutes.find(r=>r.id==='Daily dining');
assert.ok(Math.abs(dining.points.at(-1)[1]-dining.width/2-(paving.y+paving.d))<1e-7,'Dining route must reach the paving, not stop at the roof footprint');
assert.ok(GARDEN.gardenRoutes.every(route => route.width >= 1 && route.points.length >= 2));
assert.ok(!GARDEN.elements.some(e=>e.id==='steppingPaths'));
for (const id of ['westBackbone','productiveBorder','quietGardenBorder','eastGatheringBorder','terraceFrontage','orchardMeadow']) {
  assert.equal(element(id).parts[0].kind, 'polygon');
  assert.ok(element(id).meta.plant);
}
for (const id of ['pondFringe','bedTerrace','prairieIsland','saunaBed','pergolaBeds','arrivalStrip','eastUnderstory','southFoundation','garageFaceBed','rainGarden']) {
  assert.equal(element(id), undefined, `${id} must not survive as an isolated legacy bed`);
}
const trees = ['orchard','northTrees','eastTrees'].flatMap(id => element(id).parts);
assert.equal(trees.filter(tree => tree.form === 'evergreen').length, 2);
assert.ok(trees.every(tree => Math.hypot(tree.cx - fire[0].cx, tree.cy - fire[0].cy) > tree.canopyRadius + fire[0].r),
  'Tree crowns must not overhang the occupied fire apron');
for (const [cx,cy] of [[2.8,9],[6.8,12.6],[24.7,3.6],[34.8,3.1],[40.2,14]]) {
  assert.ok(trees.some(tree => tree.cx === cx && tree.cy === cy));
}
for (const reserve of GARDEN.gardenReserves) {
  assert.ok(trees.every(tree => tree.cx < reserve.x || tree.cx > reserve.x + reserve.w || tree.cy < reserve.y || tree.cy > reserve.y + reserve.d));
}
const segmentDistance = (x,y,a,b) => {
  const dx=b[0]-a[0], dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
};
const inside = (x,y,points) => {
  let result=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [ax,ay]=points[i], [bx,by]=points[j];
    if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax)result=!result;
  }
  return result;
};
const planting = GARDEN.elements.filter(item => item.meta?.plant).flatMap(item => item.parts).filter(part => part.kind === 'polygon');
for(const light of ['pathLights','gardenSpots'].flatMap(id => element(id).parts).filter(part => part.kind === 'circle')) {
  assert.ok(Math.hypot(light.cx-fire[0].cx,light.cy-fire[0].cy)>fire[0].r+light.r);
  assert.ok(((light.cx-pond.cx)/(pond.rx+light.r))**2+((light.cy-pond.cy)/(pond.ry+light.r))**2>1);
  for(const bed of planting) {
    assert.ok(!inside(light.cx,light.cy,bed.points), 'Lights must not be scattered inside planting masses');
    assert.ok(bed.points.every((point,i)=>segmentDistance(light.cx,light.cy,point,bed.points[(i+1)%bed.points.length])>light.r));
  }
  if(light.route) {
    const route=GARDEN.gardenRoutes.find(item=>item.id===light.route);
    assert.ok(route);
    const offset=Math.min(...route.points.slice(1).map((point,i)=>segmentDistance(light.cx,light.cy,route.points[i],point)))-route.width/2;
    assert.ok(offset>=.5-1e-6 && offset<1.3, 'Bollards should flank the named route with at least 0.5 m clearance');
  }
}
console.log('Approved A footprints, room planting, routes, lighting, reserves and fixed geometry verified');
