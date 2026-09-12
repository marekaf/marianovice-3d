import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { runPythonJson } from './scripts/python-json.mjs';
import { readFileSync, existsSync } from 'node:fs';
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
if(!GARDEN.gardenRoutes?.length) {
const golden = JSON.parse(readFileSync(new URL('./site-terrain-golden.json', import.meta.url), 'utf8'));
assert.equal(points.length, golden.count);
assert.equal(digest(points.flat()), golden.pointsDigest, 'Golden comparison coordinates must not change silently');
const heights = points.map(point => site.height(...point));
assert.ok(heights.every(Number.isFinite));
const originalSpec = { ...site.spec, postCuts: site.spec.postCuts.slice(0, 3) };
assert.equal(digest(points.map(point => SiteTerrain.height(originalSpec, ...point))), golden.heightsDigest,
  'Grading before the sauna access cuts must preserve original browser heights');
const saunaCuts = site.spec.postCuts.slice(3);
for (const point of points) {
  const affected = saunaCuts.some(r => Math.hypot(Math.max(r.x0 - point[0], 0, point[0] - r.x1),
    Math.max(r.z0 - point[1], 0, point[1] - r.z1)) < r.blend);
  if (!affected) assert.equal(site.height(...point), SiteTerrain.height(originalSpec, ...point), 'Unrelated terrain must remain unchanged');
}
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
const pythonHeights = runPythonJson(
  'import json,sys; from blender.site_terrain import height; data=json.load(sys.stdin); print(json.dumps([height(data["spec"], *p) for p in data["points"]]))',
  { spec: serialized, points }, { cwd: new URL('.', import.meta.url), maxBuffer: 4 * 1024 * 1024 });
assert.equal(pythonHeights.length, points.length);
let maxError = 0;
for (let i = 0; i < points.length; i++) {
  const error = Math.abs(pythonHeights[i] - heights[i]);
  assert.ok(Number.isFinite(pythonHeights[i]) && error < 1e-10, `Python grading differs at ${points[i]} by ${error}`);
  maxError = Math.max(maxError, error);
}
console.log(`Site terrain: ${points.length} samples; original grading preserved outside sauna access cuts; Python max error ${maxError} m; house/deck and grading seams pass`);
}
const { SurveySurface } = require('./survey-surface.js');
const syntheticSurvey = [[-10,-10,4],[60,-10,1],[60,50,2],[-10,50,5],[18,17,2.7]];
const surveySurface = SurveySurface.create(syntheticSurvey,TERRAIN.plane).data;
const surveyed = SiteTerrain.create(GARDEN,TERRAIN.plane,patches,{surveySurface,houseFFL:TERRAIN.houseFFLInternal});
const fixedFallback = SiteTerrain.create(GARDEN,TERRAIN.plane,patches,{houseFFL:TERRAIN.houseFFLInternal});
assert.equal(fixedFallback.routeHeight(4.6,13),2.865,'Bed court retains its chosen finish without a survey');
function verifyProductiveFinishes(sample){
  const court=sample.spec.productiveCourt;
  const snapshot=JSON.stringify(sample.spec);
  assert(court,'Fixed-datum terrain uses the coordinated court');
  for(let ix=0;ix<=40;ix++)for(let iz=0;iz<=16;iz++){
    const x=court.x0+(court.x1-court.x0)*ix/40,z=court.z0+(court.z1-court.z0)*iz/16;
    assert(Math.abs(sample.routeHeight(x,z)-SiteTerrain.productiveFinish(court,x))<1e-10,'Court core follows its shared level finish');
  }
  for(const x of [court.x0-.3,court.x0,...court.aisles.flat(),court.x1,court.x1+.3])
    for(const z of [court.z0-.3-.6,court.z0,court.z1,court.z1+.3]){
      const height=sample.routeHeight(x,z);
      for(const [dx,dz]of [[1e-6,0],[-1e-6,0],[0,1e-6],[0,-1e-6]])assert(Math.abs(sample.routeHeight(x+dx,z+dz)-height)<1e-5,'Productive finish remains continuous across court and influence boundaries');
    }
  const {GardenRouteModel}=require('./garden-route-model.js');
  const beds=RaisedBedsModel.build(GARDEN,{surfaceHeight:sample.routeHeight,groundHeight:sample.height,court});
  const geometry=GardenRouteModel.geometry(GARDEN.gardenRoutes,sample.routeHeight,.12,[...GardenRouteModel.surfaceExclusions(GARDEN),beds.surfaceFootprint]);
  let courtJoinVertices=0;
  for(let i=0;i<geometry.positions.length;i+=3){
    const [x,y,z]=geometry.positions.slice(i,i+3);
    if(Math.abs(x-court.x1)<1e-8&&z>12.7&&z<13.7){
      courtJoinVertices++;assert(Math.abs(y-court.finish)<1e-10,'Clipped eastern route triangles meet the level bed aisle');
    }
  }
  assert(courtJoinVertices>0,'Regression covers visible route/court join');
  const gravel=beds.parts.find(p=>p.name==='raised_beds_gravel');
  const houseEdge=gravel.vertices.filter(([x,z,y])=>Math.abs(x-court.x1)<1e-8&&z>12.5&&z<13.5&&Math.abs(y+beds.floorHeight-court.finish)<1e-8);
  assert(houseEdge.length>10,'Court triangles meet the fixed productive court finish');
  assert.equal(JSON.stringify(sample.spec),snapshot,'Sampling productive finishes must not alter the shared grading specification');
}
verifyProductiveFinishes(fixedFallback);
verifyProductiveFinishes(surveyed);
assert.equal(fixedFallback.spec.deckTop,TERRAIN.houseFFLInternal);
assert.equal(fixedFallback.spec.continuousGrading,true);
assert.equal(fixedFallback.baseHeight(8,12),TERRAIN.basePlaneHeight(8,12));
assert.equal(surveyed.spec.houseBaseY,TERRAIN.houseFFLInternal);
assert.equal(surveyed.spec.deckTop,TERRAIN.houseFFLInternal);
for(const [x,z,h] of syntheticSurvey)assert.ok(Math.abs(surveyed.baseHeight(x,z)-h)<1e-10);
const checks = [...points];
for(const x of [-.2,2.2,4.2,5.2,6.2,7.2,8.8,9.48,9.88])for(let z=6.9;z<=18.5;z+=.2)
  for(const offset of [-1e-6,0,1e-6])checks.push([x+offset,z]);
function insideHouse(x,z) {
  const points=surveyed.spec.houseExcavation.points;
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
for(let x=10.49;x<21.28;x+=.2)for(let z=7.19;z<26.43;z+=.2)if(insideHouse(x,z)) {
  const clearance=x<=11.56&&(z<=7.305||z>=26.305)?.07:.12;
  assert.ok(surveyed.height(x,z)<=TERRAIN.houseFFLInternal-clearance+1e-10,'House excavation and facade gravel bedding must keep soil below finished floors');
  checks.push([x,z]);
}
assert.ok(!insideHouse(12,17),'House excavation polygon must exclude atrium notch');
for(const [x,z] of surveyed.spec.houseExcavation.points)for(const [dx,dz] of [[1e-7,0],[-1e-7,0],[0,1e-7],[0,-1e-7]]) {
  assert.ok(Math.abs(surveyed.height(x,z)-surveyed.height(x+dx,z+dz))<1e-5,'House excavation boundary must remain continuous');
  checks.push([x+dx,z+dz]);
}
for(const pad of surveyed.spec.finishPads)for(let ix=0;ix<=4;ix++)for(let iz=0;iz<=4;iz++) {
  const x=pad.x0+(pad.x1-pad.x0)*ix/4,z=pad.z0+(pad.z1-pad.z0)*iz/4;
  const protectedEdge=surveyed.spec.protectedPads.slice(0,1).some(p=>Math.hypot(Math.max(p.x0-x,0,x-p.x1),Math.max(p.z0-z,0,z-p.z1))<p.blend);
  if(!protectedEdge)assert.ok(surveyed.height(x,z)<=TERRAIN.houseFFLInternal-.04+1e-10,`Finished soil and route bedding must stay below level access surfaces at ${x},${z}: ${surveyed.height(x,z)}`);
  else assert.ok(surveyed.height(x,z)<=TERRAIN.houseFFLInternal-.12+1e-10,'Vehicle pad must stay clear under adjacent terrace edge');
  checks.push([x,z]);
}
for(const pad of [...surveyed.spec.cutRects,...surveyed.spec.levelPads,...surveyed.spec.postCuts,...surveyed.spec.finishPads,...surveyed.spec.protectedPads]) {
  const blend=pad.blend??surveyed.spec.cutBlend;
  for(const x of [pad.x0-blend,pad.x0,pad.x1,pad.x1+blend])for(const z of [pad.z0-blend,pad.z0,pad.z1,pad.z1+blend]) {
    const h=surveyed.height(x,z);
    for(const [dx,dz] of [[1e-7,0],[-1e-7,0],[0,1e-7],[0,-1e-7]]) {
      assert.ok(Math.abs(surveyed.height(x+dx,z+dz)-h)<1e-5,'Continuous grading must not jump at rectangular bank edges');
      checks.push([x+dx,z+dz]);
    }
  }
}
for(const pad of surveyed.spec.protectedPads.slice(0,1))for(let ix=0;ix<=12;ix++)for(let iz=0;iz<=12;iz++) {
  const x=pad.x0+(pad.x1-pad.x0)*ix/12,z=pad.z0+(pad.z1-pad.z0)*iz/12;
  assert.ok(Math.abs(surveyed.height(x,z)-pad.level)<1e-10,'Garage/carport ground must stay at its fixed datum');
  checks.push([x,z]);
}
for(const vehicle of GARDEN.vehicles)for(const side of [-1,1])for(const axle of [.2,.8]) {
  const x=vehicle.cx+side*vehicle.w*.4,z=vehicle.noseZ+vehicle.l*axle;
  assert.ok(Math.abs(surveyed.height(x,z)-patches.garage.level)<1e-10,'Vehicle tire ground must not be raised by terrace banks');
  checks.push([x,z]);
}
for(const x of [17.7-.575,17.7,17.7+.575])for(const z of [26.7,27,27.3]) {
  assert.ok(surveyed.height(x,z)<=TERRAIN.houseFFLInternal-.5,'Ground must remain below heat-pump support slab');
  checks.push([x,z]);
}
function verifyDriveway(sample) {
  const p=sample.spec.drivewayProfile;
  assert.ok(Math.abs(sample.height(...p.gate)+p.surfaceOffset-sample.baseHeight(...p.gate))<1e-10,'Driveway paving must meet interpolated surveyed gate grade');
  let previous=p.startLevel;
  for(let i=0;i<=100;i++) {
    const t=i/100,x=p.startX+(p.gate[0]-p.startX)*t,z=27.4+(p.gate[1]-27.4)*t;
    const h=sample.height(x,z);
    assert.ok((h-previous)*Math.sign(p.gateLevel-p.startLevel)>=-1e-10,'Driveway route must change monotonically toward gate grade');
    previous=h;
    if(sample===surveyed)checks.push([x,z]);
  }
  for(const [x,z] of p.points)for(const [dx,dz] of [[1e-7,0],[-1e-7,0],[0,1e-7],[0,-1e-7]])assert.ok(Math.abs(sample.height(x,z)-sample.height(x+dx,z+dz))<1e-5);
}
verifyDriveway(surveyed);
verifyDriveway(fixedFallback);
if(existsSync(new URL('./docs/survey-terrain.js',import.meta.url))) {
  const {SURVEY_TERRAIN}=require('./docs/survey-terrain.js');
  const productiveSite=require('./grading-site.js').GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey:SURVEY_TERRAIN});
  verifyProductiveFinishes(productiveSite.site);
  const actual=SiteTerrain.create(GARDEN,TERRAIN.plane,patches,{surveySurface:SurveySurface.create(SURVEY_TERRAIN.points,TERRAIN.plane).data,houseFFL:TERRAIN.houseFFLInternal});
  verifyDriveway(actual);
  for(const vehicle of GARDEN.vehicles)for(const side of [-1,1])for(const axle of [.2,.8])assert.ok(Math.abs(actual.height(vehicle.cx+side*vehicle.w*.4,vehicle.noseZ+vehicle.l*axle)-patches.garage.level)<1e-10);
  const corridor=actual.spec.gateRunback;
  let maximumFill=0,maximumCut=0;
  for(let t=corridor.from;t<=corridor.to;t+=.05)for(const inset of [.05,.18,.75]){
    const [ux,uz]=corridor.direction,x=corridor.start[0]+ux*t-uz*inset,z=corridor.start[1]+uz*t+ux*inset;
    assert(Math.abs(actual.height(x,z)-corridor.level)<1e-8,'Measured terrain must stay level under full gate travel');
    const delta=actual.height(x,z)-actual.baseHeight(x,z);maximumFill=Math.max(maximumFill,delta);maximumCut=Math.max(maximumCut,-delta);
  }
  console.log(JSON.stringify({measuredRunback:{maximumFill,maximumCut,finishedLevel:corridor.finishedLevel}}));
  console.log(`Measured driveway gate ground: ${actual.spec.drivewayProfile.gateLevel.toFixed(6)} internal m; carport ground ${patches.garage.level.toFixed(6)} m`);
}
assert(surveyed.spec.gateRunback,'Sliding gate needs a level runback strip');
assert(surveyed.spec.wicketLanding,'Pedestrian gate needs an independent level landing');
const landing=surveyed.spec.wicketLanding;
assert.equal(landing.from,4.02);assert.equal(landing.to,5.30);assert.equal(landing.width,1.20);
assert(Math.abs(landing.finishedLevel-surveyed.spec.gateRunback.finishedLevel)<1e-9);
const landingPoint=(t,inset)=>[landing.start[0]+landing.direction[0]*t-landing.direction[1]*inset,landing.start[1]+landing.direction[1]*t+landing.direction[0]*inset];
for(let angle=0;angle<=90;angle++)for(let step=0;step<=20;step++){
  const a=angle*Math.PI/180,s=.948*step/20,t=5.10-Math.cos(a)*s,inset=Math.sin(a)*s;
  const p=landingPoint(t,inset);
  assert(Math.abs(surveyed.height(...p)-landing.level)<1e-8,'Whole wicket sweep must have level subgrade');
  assert(Math.abs(landing.finishedLevel+.035-(surveyed.height(...p)+surveyed.spec.drivewayProfile.surfaceOffset)-.035)<1e-8,'Wicket must clear finished paving by35mm at every angle');
  checks.push(p);
}
const {GradingZones}=require('./grading-zones.js');
const drivewayLandingOverlap=GradingZones.triangles(surveyed.spec.drivewayProfile.points).reduce((area,triangle)=>area+GradingZones.area(GradingZones.split(triangle,landing.points).inside),0);
assert(drivewayLandingOverlap<1e-9,'Wicket landing footprint must not overlap vehicle driveway');
const vehicleGate=GARDEN.elements.find(e=>e.id==='gate').parts.find(p=>p.kind==='line');
assert(landing.from>Math.hypot(vehicleGate.x2-vehicleGate.x1,vehicleGate.y2-vehicleGate.y1),'Wicket landing starts beyond the vehicle gate opening');
for(const t of [landing.from,landing.to])for(const inset of [.1,.6,1.2]){
  const p=landingPoint(t,inset),h=surveyed.height(...p);
  for(const [dx,dz]of[[1e-7,0],[-1e-7,0],[0,1e-7],[0,-1e-7]])assert(Math.abs(surveyed.height(p[0]+dx,p[1]+dz)-h)<1e-5,'Wicket landing edge must blend continuously');
}
const withoutLanding={...surveyed.spec,wicketLanding:undefined};
for(const t of [6.6,6.8,7])for(const inset of [.1,.6,1.2]){
  const p=landingPoint(t,inset);
  assert.equal(surveyed.height(...p),SiteTerrain.height(withoutLanding,...p),'Wicket grading must not alter neighbor ground');
}
const runback=surveyed.spec.gateRunback;
assert(Math.abs(runback.finishedLevel-runback.level-surveyed.spec.drivewayProfile.surfaceOffset)<1e-9,'Runback gravel must meet the driveway finish');
let runbackMaxFill=0,runbackMaxCut=0;
for(let t=runback.from;t<=runback.to;t+=.05)for(const inset of [.05,.18,.75]){
  const [ux,uz]=runback.direction,x=runback.start[0]+ux*t-uz*inset,z=runback.start[1]+uz*t+ux*inset;
  assert(Math.abs(surveyed.height(x,z)-runback.level)<1e-8,'Gate runback ground must share the opening datum');
  assert(Math.abs(runback.finishedLevel+.035-(surveyed.height(x,z)+surveyed.spec.drivewayProfile.surfaceOffset)-.035)<1e-8,'Cantilever runner retains 35 mm clearance over finished gravel throughout travel');
  const delta=surveyed.height(x,z)-surveyed.baseHeight(x,z);runbackMaxFill=Math.max(runbackMaxFill,delta);runbackMaxCut=Math.max(runbackMaxCut,-delta);
  checks.push([x,z]);
}
console.log(JSON.stringify({gateRunbackWidth:runback.width,runbackMaxFill,runbackMaxCut}));
const surveyPython=runPythonJson('import json,sys; from blender.site_terrain import height; d=json.load(sys.stdin); print(json.dumps([height(d["spec"], *p) for p in d["points"]]))',
  {spec:surveyed.spec,points:checks},{cwd:new URL('.',import.meta.url)});
let surveyMaxError=0;
checks.forEach(([x,z],i)=>{const error=Math.abs(surveyPython[i]-surveyed.height(x,z));surveyMaxError=Math.max(surveyMaxError,error);assert.ok(error<1e-10);});
console.log(`Survey grading: ${checks.length} samples; fixed house datum; continuous pads and banks; Python max error ${surveyMaxError} m`);
