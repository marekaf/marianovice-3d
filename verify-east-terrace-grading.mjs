import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {runPythonJson} from './scripts/python-json.mjs';

const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js');
const {GradingSite}=require('./grading-site.js'),{SURVEY_TERRAIN}=require('./docs/survey-terrain.js');
const {createGradingData}=require('./grading-data.js');
const {TerraceDeckModel}=require('./terrace-deck-model.js');
const create=garden=>GradingSite.create({garden,terrain:TERRAIN,survey:SURVEY_TERRAIN}).site;
const previousGarden=structuredClone(GARDEN);
delete previousGarden.gradingPlan.eastTerraceApron;
const previous=create(previousGarden);
const {site,survey}=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey:SURVEY_TERRAIN});
const near=(actual,expected,label)=>assert(Math.abs(actual-expected)<1e-7,`${label}: ${actual} != ${expected}`);
const bpv=(x,z)=>TERRAIN.bpv(site.height(x,z));
const apron=site.spec.protectedPads.find(p=>p.id==='east-terrace-apron');
assert(apron&&!('finish' in apron),'The apron is terrain, not an extension of the finished deck');
near(apron.x0,23.58,'Apron begins at the deck edge');
near(apron.x1-apron.x0,1,'One metre apron');
assert.deepEqual([apron.z0,apron.z1],[11.58,19.23],'Apron follows only the east-facing deck edge');
assert.deepEqual(site.spec.finishPads,previous.spec.finishPads,'Deck dimensions and finish levels stay fixed');
assert.deepEqual(site.spec.carportSurface,previous.spec.carportSurface,'Carport surface stays fixed');
assert.deepEqual(site.spec.drainageStrips,previous.spec.drainageStrips,'Drainage controls stay fixed');
const deck=TerraceDeckModel.build(GARDEN,site.spec.deckTop,site.height);
const board=deck.parts.find(p=>p.name.startsWith('eastTerrace_0_board_'));
const boardTop=deck.floorHeight+board.position[2]+board.size[2]/2;
near(apron.level,boardTop,'Soil apron aligns with the actual top of the terrace boards');

for(const z of [14,15,16,17,18]) {
  for(let i=0;i<=20;i++){
    const x=23.58+i/20;
    near(site.height(x,z),boardTop,'Level soil strip aligns with boards across its full width');
    near(site.routeHeight(x,z),boardTop+.02,'Walking surface uses the soil allowance, not deck bedding');
  }
  near(site.height(23.58-1e-6,z),boardTop-.12,'Bedding stays below the boards inside the deck');
  near(site.height(23.58+1e-6,z),boardTop,'No lowered bedding lip outside the deck');
  for(let i=0;i<=30;i++)near(bpv(24.58+i/20,z),397-.4*i/20,'Forty percent bank');
  near(TERRAIN.bpv(previous.height(24.08,z)),396.64,'Previous bank fell at 48 percent');
  near(bpv(26.08,z),396.40,'Bank meets the unchanged lawn');
}

for(const [x,z] of [[24.08,10],[24.08,11.58],[24.58,12],[23.58,18.5],[23.58,19.23],[22,21.5],[25,22],[30,23],[10.48,7.18],[35,9],[40,8]])near(site.height(x,z),previous.height(x,z),`Existing junction ${x},${z}`);
for(let x=23.58;x<=24.58;x+=.1)for(let z=11.58;z<=12.59;z+=.1) {
  assert(Math.abs(site.height(x,z)-previous.height(x,z))<.005,'Sampled northern route bedding changes by less than five millimetres');
  near(site.routeHeight(x,z),previous.routeHeight(x,z),'Northern route finish stays fixed');
}
near(TERRAIN.bpv(previous.routeHeight(24.2,17.8)),396.6024,'Previous pond walk start finish');
near(TERRAIN.bpv(site.routeHeight(24.2,17.8)),397.02,'Pond walk start follows the raised soil apron');
const data=createGradingData({garden:GARDEN,terrain:TERRAIN,site,survey});
const section=data.sections.find(s=>s.id==='east-terrace-bank');
near(section.maxSlope,40,'Grading report central section has a forty percent maximum slope');
for(const sample of section.samples)near(sample.proposed,site.height(sample.x,sample.z),'Report uses the rendered soil surface');
const spot=data.points.find(p=>p.id==='eastTerraceApron');
near(TERRAIN.bpv(spot.proposed),397,'Grading report apron spot level');
assert(!('finished' in spot),'Apron spot is soil, not a finished deck level');
for(const [z,level] of [[18.3,396.88],[18.5,396.8],[19,396.6],[19.23,396.508]])for(const x of [23.58,24.08,24.58])near(bpv(x,z),level,'South transition follows the lower carport');
for(const segment of site.spec.fixedFences.segments)for(let i=0;i<=10;i++) {
  const point=segment.start.map((v,j)=>v+(segment.end[j]-v)*i/10);
  near(site.height(...point),previous.height(...point),'Survey boundary remains unchanged');
}

const points=[];
for(let x=23.3;x<=26.3;x+=.13)for(let z=11.3;z<=19.6;z+=.23)points.push([x,z]);
for(const x of [23.58,24.58,26.08])for(const z of [11.58,13,15,18.3,19.23,19.4]) {
  points.push([x,z]);
  for(const [dx,dz] of [[1e-6,0],...(x===23.58?[]:[[-1e-6,0]]),[0,1e-6],[0,-1e-6]])assert(Math.abs(site.height(x+dx,z+dz)-site.height(x,z))<1e-5,'Apron and bank junctions remain continuous');
}
const python=runPythonJson('from blender.site_terrain import height, route_height\nimport json,sys\np=json.load(sys.stdin)\nprint(json.dumps([[height(p["spec"],*v),route_height(p["spec"],*v)] for v in p["points"]]))',{spec:site.spec,points});
python.forEach(([h,r],i)=>{near(h,site.height(...points[i]),'Browser and Blender terrain parity');near(r,site.routeHeight(...points[i]),'Browser and Blender walking parity');});
console.log(`East terrace: 1 m soil apron, bank 48% to 40%, preserved end junctions and ${points.length} Blender comparisons`);
