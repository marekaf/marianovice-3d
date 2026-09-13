import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import {prepareLivingData} from './docs/living-interior.js';
const require=createRequire(import.meta.url),{HOUSE_INTERIOR}=require('./house-interior.js'),{FurnitureModel}=require('./furniture-model.js');
const before=JSON.stringify(HOUSE_INTERIOR),data=prepareLivingData(HOUSE_INTERIOR);
const index=data.furniture.findIndex(f=>f.label==='kuchyň uppers 1050'),cab=data.furniture[index];
const model=FurnitureModel.build(data.furniture),prefix=`fixture_${index}`;
const previous=FurnitureModel.build(data.furniture.map(f=>{const copy={...f};delete copy.endGrille;return copy;}));
const changed=p=>p.name.startsWith(`${prefix}_side_1`)||p.name.startsWith(`${prefix}_inner_E`)||p.name.startsWith(`${prefix}_return_grille`);
assert.deepEqual(model.parts.filter(p=>!changed(p)),previous.parts.filter(p=>!changed(p)),'Other cabinet parts and fixtures retain exact geometry');
assert.equal(JSON.stringify(HOUSE_INTERIOR),before);
const louvers=model.parts.filter(p=>p.name.startsWith(`${prefix}_return_grille_louver`));
assert.equal(louvers.length,5);
for(const p of louvers){assert(p.vertices[1][2]<p.vertices[0][2],'Louvers descend towards their room-side edge');assert(p.vertices.every(v=>v[0]<=cab.x1&&v[0]>=cab.x1-.018-1e-9));}
const group=new THREE.Group();
for(const part of model.parts.filter(p=>p.type==='box')){const mesh=new THREE.Mesh(new THREE.BoxGeometry(part.size[0],part.size[2],part.size[1]),new THREE.MeshBasicMaterial());mesh.position.set(part.position[0],part.position[2],part.position[1]);group.add(mesh);}group.updateMatrixWorld(true);
const ray=new THREE.Raycaster(),z=(cab.z0+cab.z1)/2,low=cab.y0+cab.h-cab.endGrille.topInset-cab.endGrille.height;
for(let i=0;i<4;i++){
  const height=low+.025+i*.019;
  ray.set(new THREE.Vector3(cab.x1+.05,height,z),new THREE.Vector3(-1,0,0));
  const hit=ray.intersectObject(group,true)[0];
  assert(hit&&hit.point.x<cab.x1-.05,'The grille opening must pass both the outer panel and inner liner');
}
assert(Math.abs(9.65-cab.x1-.192)<1e-9);
console.log('Kitchen return grille: 5 downward louvers, 4 clear mesh rays, fixed furniture preserved.');
