import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from 'three';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js');
const {HouseRoof}=require('./house-roof.js');
const {buildHouseRoofExport}=require('./house-roof-export.js');
const base=TERRAIN.houseFFLInternal,bundle=buildHouseRoofExport(GARDEN,base);
const house=GARDEN.elements.find(e=>e.id==='house');
const spec=HouseRoof.describe({bbox:house.meta.bbox,atrium:house.meta.atrium,gable:[13.68,21.28],baseY:base,eNotch:house.meta.eNotch});
assert.deepEqual(bundle.spec.normalThickness,[.25,.25,.227]);
const mesh=part=>{
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.vertices.flatMap(([x,z,y])=>[x,y,z]),3));
  geometry.setIndex(part.faces.flatMap(f=>[...f].reverse()));
  return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
};
const roof=bundle.roofModel.parts.map(p=>Object.assign(mesh(p),{name:p.name}));
const tops=bundle.roofModel.parts.filter(p=>p.roofSurface).map(mesh);
const bounds=new THREE.Box3();tops.forEach(m=>bounds.expandByObject(m));
[bounds.min.x,bounds.max.x,bounds.min.z,bounds.max.z].forEach((v,i)=>assert(Math.abs(v-[9.33,21.63,7.005,26.605][i])<1e-5));
const ray=(x,z)=>new THREE.Raycaster(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0));
let probes=0;
for(let x=9.35;x<21.62;x+=.17)for(let z=7.03;z<26.6;z+=.23){
  if(bundle.spec.windowCuts.some(b=>x>b.min[0]-1e-4&&x<b.max[0]+1e-4&&z>b.min[2]-1e-4&&z<b.max[2]+1e-4))continue;
  const expected=spec.heightAt(x,z),hits=ray(x,z).intersectObjects(tops);
  if(expected===null)assert.equal(hits.length,0);
  else{assert(hits.length);assert(hits.every(h=>Math.abs(h.point.y-expected)<1e-5));probes++;}
}
for(const cut of bundle.spec.windowCuts){
  const x=(cut.min[0]+cut.max[0])/2,z=(cut.min[2]+cut.max[2])/2;
  assert.equal(ray(x,z).intersectObjects(roof).length,0,'Roof window opening is physically cut through every exported roof layer');
}
for(const [name,x,z,depth]of[['East eave',21.5,10,.25*Math.SQRT2],['West north eave',9.5,10,.227/Math.cos(5*Math.PI/180)]]){
  const soffit=roof.filter(m=>m.name===name+' bioboard soffit');
  const hits=ray(x,z).intersectObjects(soffit);assert.equal(hits.length,1);
  assert(Math.abs(spec.heightAt(x,z)-hits[0].point.y-depth)<1e-5);
}
const infill=bundle.infillModel.parts.map(mesh),opening=bundle.gableWindowModel.opening;
const origin=require('./house-interior.js').HOUSE_INTERIOR.originPlot;
assert.equal(new THREE.Raycaster(new THREE.Vector3(origin.x+opening.x,base+opening.sill+.5,6),new THREE.Vector3(0,0,1),0,2).intersectObjects(infill).length,0,'Gable opening is cut into exported facade infill');
for(const [i,expected]of[[0,[19.3925,24.76,base+5.2375]],[1,[19.3925,20.78,base+5.2375]],[2,[15.5675,20.78,base+5.2375]]])bundle.windowModel.cutouts[i].center.forEach((v,j)=>assert(Math.abs(v-expected[j])<1e-8));
assert(Math.abs(bundle.wallCap.slope-Math.tan(5*Math.PI/180))<1e-12);
assert(Math.abs(bundle.wallCap.intercept-spec.westWing.undersideHeightAt(0))<1e-12);
console.log(`House roof export: ${probes} exact skin probes, approved depths, physical window holes, fixed windows and wall-cap profile pass`);
