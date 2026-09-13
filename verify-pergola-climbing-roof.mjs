import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import {createMeshHeightQuery} from './mesh-height-query.js';
const require=createRequire(import.meta.url),{GARDEN}=require('./layout.js'),{PergolaModel}=require('./pergola-model.js');
const {SelectedPlanting}=require('./selected-planting.js');
const model=PergolaModel.build(GARDEN),slats=model.parts.filter(p=>p.name.startsWith('roof_slat_'));
assert.equal(slats.length,11,'Open roof keeps eleven separated cross slats');
assert.equal(model.parts.filter(p=>p.name.startsWith('rafter_')).length,9);
const element=GARDEN.elements.find(e=>e.id==='pergola'),rect=element.parts.find(p=>p.kind==='rect'),floor=model.floorHeight;
assert(Math.abs(slats[0].position[0]-slats[0].size[0]/2-(rect.x-.08))<1e-10);
assert(Math.abs(slats[0].position[1]-slats[0].size[1]/2-(rect.y-.055))<1e-10);
assert(Math.abs(slats.at(-1).position[1]+slats.at(-1).size[1]/2-(rect.y+rect.d+.06))<1e-10);
const roses=SelectedPlanting.createRoses(THREE,element),roof=[];
roses.updateMatrixWorld(true);
roses.traverse(mesh=>{
 if(!mesh.isInstancedMesh||mesh.name!=='Rose leaves')return;
 const p=mesh.geometry.attributes.position,index=mesh.geometry.index,instance=new THREE.Matrix4(),point=new THREE.Vector3();
 for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,instance);const matrix=mesh.matrixWorld.clone().multiply(instance);
  const origin=new THREE.Vector3().setFromMatrixPosition(matrix);if(origin.y<floor+2.765)continue;
  for(let j=0;j<index.count;j++){point.fromBufferAttribute(p,index.getX(j)).applyMatrix4(matrix);assert(point.y>floor+2.765,'Roof leaves remain above the timber roof');roof.push(...point.toArray());}
 }
});
assert.ok(roof.length>30000,'Trained foliage grows across the roof');
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(roof,3));
const query=createMeshHeightQuery(geometry);let covered=0,total=0;
for(let x=rect.x+.35;x<rect.x+rect.w-.35;x+=.075)for(let z=rect.y+.35;z<rect.y+rect.d-.35;z+=.075){total++;if(query(x,z)!==null)covered++;}
const coverage=covered/total;assert(coverage>.25&&coverage<.45,'Rose foliage leaves visible open roof patches');
const {buildRoseModel}=require('./selected-planting-export.js');
const exported=buildRoseModel(element),vertices=exported.parts.flatMap(p=>p.vertices);
const bounds=new THREE.Box3();
roses.traverse(mesh=>{if(!mesh.isMesh)return;const point=new THREE.Vector3(),instance=new THREE.Matrix4();
 for(let i=0;i<(mesh.isInstancedMesh?mesh.count:1);i++){
  const matrix=mesh.matrixWorld.clone();if(mesh.isInstancedMesh){mesh.getMatrixAt(i,instance);matrix.multiply(instance);}
  for(let v=0;v<mesh.geometry.attributes.position.count;v++){mesh.getVertexPosition(v,point);bounds.expandByPoint(point.applyMatrix4(matrix));}
 }
});
for(let axis=0;axis<3;axis++){const sourceAxis=[0,2,1][axis];assert(Math.abs(vertices.reduce((a,v)=>Math.min(a,v[axis]),Infinity)-bounds.min.getComponent(sourceAxis))<1e-6);assert(Math.abs(vertices.reduce((a,v)=>Math.max(a,v[axis]),-Infinity)-bounds.max.getComponent(sourceAxis))<1e-6);}
assert(exported.parts.some(p=>p.leafHabit==='deciduous'));assert(exported.parts.some(p=>p.bloom?.includes(7)));
console.log(JSON.stringify({slats:slats.length,roofLeafVertices:roof.length/3,coverage,exportParts:exported.parts.length}));
