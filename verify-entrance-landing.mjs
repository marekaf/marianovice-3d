import * as THREE from "three";
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {entranceLanding} from './entrance-landing.js';
const {HOUSE_INTERIOR:house}=createRequire(import.meta.url)('./house-interior.js');
const entry=house.exteriorOpenings().find(e=>e.model.opening.kind==='entrance');
const landing=entranceLanding(entry,house.originPlot,20.58,2.465,1.965);
assert(Math.abs(landing.x0-20.2575)<1e-9);
assert.equal(landing.x1,20.58);
assert(Math.abs(landing.z0-21.1275)<1e-9);
assert(Math.abs(landing.z1-22.5525)<1e-9);
assert(Math.abs(landing.y-2.466)<1e-12,"Finish sits 1mm above the existing floor backing without coplanar faces");
assert.equal(landing.bottom,1.965);
const threshold=entry.model.parts.find(p=>p.name.endsWith('_threshold'));
assert(Math.abs(landing.x0-(house.originPlot.x+threshold.position[0]+threshold.size[0]/2))<1e-9,'Landing meets the physical threshold edge');
assert.equal(landing.x1,20.58,'Landing meets the first tread without moving the stair run');
const mesh=new THREE.Mesh(new THREE.BoxGeometry(landing.x1-landing.x0,landing.y-landing.bottom,landing.z1-landing.z0));
mesh.position.set((landing.x0+landing.x1)/2,(landing.y+landing.bottom)/2,(landing.z0+landing.z1)/2);mesh.updateMatrixWorld(true);
for(let x=landing.x0+.005;x<landing.x1;x+=.01)for(let z=landing.z0+.005;z<landing.z1;z+=.01){
  const hit=new THREE.Raycaster(new THREE.Vector3(x,landing.y+1,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0];
  assert(hit&&Math.abs(hit.point.y-landing.y)<1e-7,"Physical landing covers the entire reveal at FFL");
}
console.log('Entrance reveal landing joins measured frame and existing stairs at house floor level');

const {buildEntranceStairs,buildEntranceRecess,entrancePavingDatum}=await import('./entrance-landing.js');
const {GARDEN}=createRequire(import.meta.url)('./layout.js');
const {GradingSite}=createRequire(import.meta.url)('./grading-site.js');
const {TERRAIN}=createRequire(import.meta.url)('./terrain.js');
const inputs=JSON.stringify([house,GARDEN]),openings=JSON.stringify(house.exteriorOpenings());
const stairs=buildEntranceStairs(house,GARDEN,2.465,1.965),levels=[2.465,2.298333333333333,2.131666666666667];
assert.equal(stairs.parts.length,4);
const edges=[20.58,21.26,21.60,21.94];
let rays=0;
for(const [i,part] of stairs.parts.slice(1).entries()){
  const [x,z,y]=part.position,[w,d,h]=part.size;
  for(const [actual,expected] of [[x-w/2,edges[i]],[x+w/2,edges[i+1]],[z-d/2,landing.z0],[z+d/2,landing.z1],[y+h/2,levels[i]],[y-h/2,1.965]])assert(Math.abs(actual-expected)<1e-9);
  assert(Math.abs(stairs.walkSurfaces[i+1].y-levels[i])<1e-9,'Visible and walking tread levels match');
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d));mesh.position.set(x,y,z);mesh.updateMatrixWorld(true);
  for(let px=x-w/2+.005;px<x+w/2;px+=.025)for(let pz=z-d/2+.005;pz<z+d/2;pz+=.025){
    const hit=new THREE.Raycaster(new THREE.Vector3(px,2.7,pz),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0];
    assert(hit&&Math.abs(hit.point.y-levels[i])<1e-7,'Entire physical tread remains at its finished level');rays++;
  }
}
assert(Math.abs(levels[0]-2.465)<1e-12,'Large upper platform meets the door floor without another step');
for(let i=0;i<3;i++)assert(Math.abs(levels[i]-(levels[i+1]??1.965)-.5/3)<1e-9,'Rises are equal down to finished paving');
const {site}=GradingSite.create({garden:GARDEN,terrain:TERRAIN});
const {SiteTerrain}=createRequire(import.meta.url)('./site-terrain.js');
const finish=(x,z)=>SiteTerrain.drivewayFinish(site.spec,x,z),datum=entrancePavingDatum(GARDEN,finish,house);
assert(Math.abs(datum-1.950528368794326)<1e-9,'Stair datum meets the lowest graded carport contact');
const graded=buildEntranceStairs(house,GARDEN,TERRAIN.houseFFLInternal,datum);
let supports=0,maximumEmbed=0,minimumRise=Infinity,maximumRise=-Infinity;
for(const part of graded.parts){
 const [x,z,y]=part.position,[w,d,h]=part.size,bottom=y-h/2;
 for(let px=x-w/2;px<=x+w/2+1e-9;px+=.02)for(let pz=z-d/2;pz<=z+d/2+1e-9;pz+=.02){
  assert(Math.abs(bottom-datum)<1e-9,'Every stair box shares the pavement datum');
  if(px<21.28-1e-9)continue;
  const support=finish(Math.max(21.28,px),pz);
  assert(bottom<=support+1e-8,'Every pavement contact supports the stair base');supports++;
  maximumEmbed=Math.max(maximumEmbed,support-bottom);
 }
}
const bottomTread=graded.walkSurfaces.at(-1).y,rise=(TERRAIN.houseFFLInternal-datum)/3;
for(let i=0;i<=150;i++){const z=landing.z0+(landing.z1-landing.z0)*i/150;{const value=bottomTread-finish(21.94,z);minimumRise=Math.min(minimumRise,value);maximumRise=Math.max(maximumRise,value);}}
assert(Math.abs(maximumRise-rise)<1e-8&&Math.abs(maximumRise-minimumRise-.01*(landing.z1-landing.z0)/7.05)<1e-8,'Pavement crossfall changes the bottom rise by only 2 mm');
assert(maximumEmbed<.00203&&supports>2000);
console.log(JSON.stringify({gradedStairDatum:datum,supports,maximumEmbed,minimumRise,maximumRise}));
assert.equal(JSON.stringify([house,GARDEN]),inputs);assert.equal(JSON.stringify(house.exteriorOpenings()),openings,'Fixed openings remain unchanged');
console.log(`Entrance stairs: ${rays} full-platform mesh rays, equal finished rises and fixed inputs pass`);
const recess=buildEntranceRecess(house,GARDEN,2.465,1.965),[soil,edge]=recess.parts;
const deckEnd=GARDEN.elements.find(e=>e.id==='eastTerrace').parts.find(p=>p.kind==='rect');
const bounds=part=>({x0:part.position[0]-part.size[0]/2,x1:part.position[0]+part.size[0]/2,z0:part.position[1]-part.size[1]/2,z1:part.position[1]+part.size[1]/2,top:part.position[2]+part.size[2]/2,bottom:part.position[2]-part.size[2]/2});
const s0=bounds(soil),e0=bounds(edge);
assert(Math.abs(s0.z0-(deckEnd.y+deckEnd.d))<1e-9&&Math.abs(s0.z1-landing.z0)<1e-9,'Recess runs from the deck end to the stairs');
assert(Math.abs(s0.x0-20.58)<1e-9&&Math.abs(s0.x1-e0.x0)<1e-9&&Math.abs(e0.x1-21.28)<1e-9,'Retaining edge holds the soil along the carport side');
assert(Math.abs(s0.top-2.415)<1e-9&&e0.top>s0.top&&e0.top<2.465,'Level soil 5 cm below the floor, edge just above it');
assert(Math.abs(s0.bottom-1.965)<1e-9&&Math.abs(e0.bottom-1.965)<1e-9,'Recess sits on the pavement datum');
for(const key of ['x0','x1','z0','z1'])assert(Math.abs(recess.soil[key]-s0[key])<1e-9,'Walk surface matches the soil box');
assert(Math.abs(recess.soil.y-s0.top)<1e-9);
console.log('Entrance recess: level soil held by an edge between the east deck and the stairs');
