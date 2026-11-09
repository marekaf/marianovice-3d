import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {runPythonJson} from './scripts/python-json.mjs';

const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js');
const {GradingSite}=require('./grading-site.js'),{SURVEY_TERRAIN}=require('./docs/survey-terrain.js');
const {SiteTerrain}=require('./site-terrain.js');
const {TerraceDeckModel}=require('./terrace-deck-model.js');
const near=(a,b,label)=>assert(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);
const create=garden=>GradingSite.create({garden,terrain:TERRAIN,survey:SURVEY_TERRAIN}).site;
const previousGarden=structuredClone(GARDEN);
delete previousGarden.elements.find(e=>e.id==='eastTerrace').meta.retainedSoil;
const previous=create(previousGarden),site=create(GARDEN),p=site.spec.eastTerraceRetainedSoil;
const deck=TerraceDeckModel.build(GARDEN,site.spec.deckTop,site.height);
const board=deck.parts.find(p=>p.name.startsWith('eastTerrace_0_board_'));
const top=deck.floorHeight+board.position[2]+board.size[2]/2;
near(TERRAIN.bpv(top),397,'Deck top datum');
for(let i=0;i<=10;i++)for(let j=0;j<=10;j++) {
  const x=p.x0+(p.x1-p.x0)*i/10,z=p.z0+(p.z1-p.z0)*j/10;
  near(site.height(x,z),top,'Retained soil is the actual shared terrain at board level');
  near(site.routeHeight(x,z),top+.02,'Walking allowance does not inherit the buried deck structure');
}
for(let x=p.x0+.01;x<=p.x1;x+=.03)for(const z of [p.z0-p.northBlend,p.z0])for(const dz of [-1e-6,1e-6])assert(Math.abs(site.height(x,z+dz)-site.height(x,z))<1e-5,'Open northern terrain joins continuously');
for(const x of [p.x1+p.wallWidth+.0001,p.x1+.4,p.x1+.8])for(const dz of [-1e-6,1e-6])assert(Math.abs(site.height(x,p.z0+dz)-site.height(x,p.z0))<1e-5,'Northeast corner has no vertical step outside the wall footprint');
const gradient=(x,z)=>Math.hypot(site.height(x+.01,z)-site.height(x-.01,z),site.height(x,z+.01)-site.height(x,z-.01))/.02;
assert(gradient(24.58,18.4)<.65,'North wall tip must not concentrate the full level difference into the wall width');
for(let x=p.x1+p.wallWidth+.02;x<=27;x+=.08)for(let z=p.z0-.5;z<=19.4;z+=.08)assert(gradient(x,z)<.65,'The bank around the wall tip and its exterior stays below 65 percent');
for(let x=21.28;x<=27.63;x+=.25)for(let z=19.4;z<=26.45;z+=.25)near(site.height(x,z),previous.height(x,z),'Parking ground remains unchanged');
for(const [x,z] of [[22,21.5],[23,15],[24,16],[26,20],[35,9]])near(site.height(x,z),previous.height(x,z),'Adjacent fixed terrain remains unchanged');

const points=[];
for(let x=23.5;x<=27;x+=.09)for(let z=16.3;z<=19.5;z+=.11)points.push([x,z]);
const result=runPythonJson('from blender.site_terrain import height,route_height\nimport json,sys\np=json.load(sys.stdin)\nprint(json.dumps([[height(p["spec"],*v),route_height(p["spec"],*v)] for v in p["points"]]))',{spec:site.spec,points});
result.forEach(([h,r],i)=>{near(h,site.height(...points[i]),'Python terrain parity');near(r,site.routeHeight(...points[i]),'Python walking parity');});
const raisedBase=structuredClone(site.spec);
raisedBase.protectedPads.push({id:'east-terrace-apron',x0:p.x0,x1:p.x0+1,z0:11.58,z1:p.z1,level:top,bankSlope:.4});
for(let x=p.x0+.01;x<=p.x1;x+=.1) {
  near(SiteTerrain.height(raisedBase,x,p.z0),top,'Retained pocket meets a raised garden apron');
  assert(Math.abs(SiteTerrain.height(raisedBase,x,p.z0-1e-6)-top)<1e-5,'Raised apron and retained pocket have no northern seam');
}
console.log(`Entrance retained soil: shared 397.00 m terrain, continuous open edges, unchanged parking and ${points.length} Python comparisons`);
