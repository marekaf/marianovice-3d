import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import * as THREE from 'three';
const require=createRequire(import.meta.url),{GARDEN}=require('./layout.js'),{GarageModel}=require('./garage-model.js');
const dims=GarageModel.build(GARDEN,0).dims,GA=dims.rect;
const CP=GARDEN.elements.find(e=>e.id==='carport').parts.find(p=>p.kind==='rect');
assert.equal(GA.w,6.5);assert.equal(GA.d,7.05);
assert.equal(dims.roofRidgeOffset,.11,'Roof plan 103 places the ridge 110 mm inside the west wall');
assert.equal(dims.roofEndOverhang,.05,'Roof plan 103 specifies 50 mm beyond each north/south wall');
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const helper=html.slice(html.indexOf('function makePultRoofWE('),html.indexOf('const houseRoof ='));
const blocks=html.slice(html.indexOf('// Garage pult roof'),html.indexOf('// Carport between house and garage'));
const group=new THREE.Group();
new Function('THREE','GA','CP','garageRoofHigh','garageWallTop','garagePitch','garageRoofEndOverhang','garageRoofEastOverhang','garageRoofRidgeOffset','carportPitch','roofGroup','roofMat',`${helper}\n${blocks}`)(THREE,GA,CP,dims.roofHigh,dims.wallTop,dims.pitch,dims.roofEndOverhang,dims.roofEastOverhang,dims.roofRidgeOffset,dims.carportPitch,group,new THREE.MeshBasicMaterial());
group.updateMatrixWorld(true);
for(const [mesh,rect]of [[group.children[0],GA],[group.children[1],CP]]){
  const bounds=new THREE.Box3().setFromObject(mesh);
  assert(Math.abs(bounds.min.z-(rect.y-.05))<1e-5);
  assert(Math.abs(bounds.max.z-(rect.y+rect.d+.05))<1e-5);
  assert(Math.abs(bounds.max.z-bounds.min.z-7.15)<1e-5);
}
assert(Math.abs(new THREE.Box3().setFromObject(group.children[0]).max.x-34.18)<1e-5,'Roof plan 103 places the garage east edge at 34.18 m');
assert(Math.abs(new THREE.Box3().setFromObject(group.children[0]).min.x-27.74)<1e-5);
assert(Math.abs(new THREE.Box3().setFromObject(group.children[1]).max.x-27.74)<1e-5,'Both roof skins terminate at the same plan ridge');
const carportPositions=group.children[1].geometry.attributes.position;
const roofTopAt=x=>Math.max(...Array.from({length:carportPositions.count},(_,i)=>Math.abs(carportPositions.getX(i)-x)<1e-5?carportPositions.getY(i):-Infinity));
assert(Math.abs((roofTopAt(27.74)-roofTopAt(CP.x))/(27.74-CP.x)-Math.tan(2*Math.PI/180))<1e-6);
assert(Math.abs(roofTopAt(27.74)-dims.roofHigh-.001)<1e-5,'Carport and garage metal skins meet at the same height');
const seams=group.children.slice(2).filter(mesh=>mesh.rotation.z<0);
assert(seams.length>0);
for(const seam of seams){
  const end=new THREE.Vector3(seam.geometry.parameters.width/2,0,0).applyMatrix4(seam.matrixWorld);
  assert(Math.abs(end.x-34.18)<1e-5,'Garage seam centreline terminates at the east roof edge');
  assert(Math.abs(end.y-(dims.wallTop-.05*dims.pitch+.031))<1e-5,'Seam remains seated on the sloping roof');
}
for(const seam of group.children.slice(2).filter(mesh=>mesh.rotation.z>0)){
  assert(Math.abs(seam.rotation.z-2*Math.PI/180)<1e-10,'Carport seams follow the 2 degree roof plane');
}
console.log('Garage east and roof-end projections are 50 mm; carport plate and seams fall at 2 degrees');
