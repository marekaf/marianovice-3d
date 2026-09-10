import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import {prepareLoftRoofData,attachLoftRoofWindows} from './docs/loft-roof-windows.js';
const require=createRequire(import.meta.url),{HOUSE_LOFT}=require('./house-interior.js');
const {HouseRoof}=require('./house-roof.js'),RoofWindows=require('./docs/house-roof-windows.js');
const roof=HouseRoof.describe({bbox:[0,0,10.8,19.25],atrium:[0,8.75,4.45,11.99],gable:[3.2,10.8]});
const windows=RoofWindows.build({gable:[3.2,10.8],ridgeY:7.15,eaveY:2.9,windows:[
  {side:'e',z:17.58,width:.66,height:1.4},{side:'e',z:13.6,width:.78,height:1.4},{side:'w',z:13.6,width:.78,height:1.4}]});
const before=JSON.stringify(HOUSE_LOFT),windowBefore=JSON.stringify(windows);
const data=prepareLoftRoofData(HOUSE_LOFT,roof,windows);
const {INTERIORS3D}=require('./interiors3d.js');
const floorOnly={...data,extWalls:[],intWalls:[],rooms:[],furniture:null};
const floorView=INTERIORS3D.buildHouse(THREE,floorOnly,{floorY:data.floorY});
floorView.root.updateMatrixWorld(true);
const floorOrigin=data.originPlot;
function floorHits(x,z,fromAbove=true){
  return new THREE.Raycaster(new THREE.Vector3(floorOrigin.x+x,fromAbove?4:2,floorOrigin.z+z),new THREE.Vector3(0,fromAbove?-1:1,0))
    .intersectObjects(floorView.floor.children,true);
}
const crossing=(data.floorY-roof.westWing.undersideHeightAt(0))/Math.tan(5*Math.PI/180);
const slab=floorView.floor.children.find(mesh=>mesh.isMesh),slabPositions=slab.geometry.attributes.position;
assert([...slabPositions.array].every(Number.isFinite));
assert([...slab.geometry.attributes.normal.array].every(Number.isFinite));
assert(Array.from({length:slabPositions.count},(_,i)=>slabPositions.getX(i)).some(x=>Math.abs(x-crossing)<1e-6),'Slab triangles split at the exact roof/level-floor crossing');
for(let i=0;i<slabPositions.count;i++){
  assert(slabPositions.getY(i)>=2.77-1e-6,'The lower structural slab is retained');
  assert(slabPositions.getY(i)<=Math.min(2.92,roof.westWing.undersideHeightAt(slabPositions.getX(i)))+1e-6,'Every generated floor vertex stays within its upper envelope');
}
for(const x of [.001,.1,crossing-.001,crossing+.001,.5,1])for(const z of[1,17]){
  const hits=floorHits(x,z),expected=Math.min(2.92,roof.westWing.undersideHeightAt(x));
  assert(hits.length&&Math.abs(hits[0].point.y-expected)<1e-6,'Generated loft slab top must fit the shallow roof, returning to its unchanged level after the crossing');
  assert(Math.abs(floorHits(x,z,false)[0].point.y-2.77)<1e-6,'Structural slab bottom is unchanged');
}
for(const hole of data.floorHoles)assert.equal(floorHits((hole.x0+hole.x1)/2,(hole.z0+hole.z1)/2).length,0,'Slab openings remain physically open');
assert.equal(JSON.stringify(HOUSE_LOFT),before);
assert.equal(data.floorY,2.92);assert.equal(data.clearH,2.27);
for(const key of ['rooms','furniture','floorHoles','outline'])assert.deepEqual(data[key],HOUSE_LOFT[key]);
for(const wall of HOUSE_LOFT.intWalls.filter(w=>w.openings?.length))assert.deepEqual(data.intWalls.find(w=>w.id===wall.id),wall,'Door wall and head clearance remain unchanged');
assert(data.extWalls.every(w=>!['P18','P19'].includes(w.id)),'Nonpositive east eave wall pieces are omitted');
assert.deepEqual(data.slopes,[]);assert.deepEqual(data.ceilings,[]);
assert(Math.abs(data.roofWindowLining.westJoin-5.7188225099390855)<1e-9);
assert(Math.abs(data.roofWindowLining.eastJoin-8.281177490060914)<1e-9);
const loft={ceiling:new THREE.Group()};
const buildModel=(three,model)=>{
  const root=new three.Group();
  for(const part of model.parts){
    const geometry=new three.BufferGeometry();geometry.setAttribute('position',new three.Float32BufferAttribute(part.vertices.flatMap(([x,z,y])=>[x,y,z]),3));
    geometry.setIndex(part.faces.flatMap(face=>Array.from({length:face.length-2},(_,i)=>[face[0],face[i+1],face[i+2]]).flat()));
    const mesh=new three.Mesh(geometry,new three.MeshBasicMaterial({side:three.DoubleSide}));mesh.name=part.name;root.add(mesh);
  }
  return root;
};
const result=attachLoftRoofWindows(THREE,loft,data,{buildModel});
loft.ceiling.updateMatrixWorld(true);
for(const cut of windows.cutouts){
  const ray=new THREE.Raycaster(new THREE.Vector3(cut.center[0],3.3,cut.center[1]),new THREE.Vector3(0,1,0));
  assert.equal(ray.intersectObjects(result.lining.children,true).length,0,`${cut.side} ${cut.center[1]} aperture must be a real geometry hole`);
  const hits=ray.intersectObjects(result.group.children,true);
  assert(hits.length&&hits[0].object.name.includes('triple_glazing'),'Window center sees actual shared glass, not lining or reveal');
}
for(const [x,z,y]of [[9.7,14.5,roof.mainEast.heightAt(9.7)-.480*Math.SQRT2],[8.2,14.5,5.19],[4.1,14.5,roof.mainWest.heightAt(4.1)-.480*Math.SQRT2]]){
  const hits=new THREE.Raycaster(new THREE.Vector3(x,3,z),new THREE.Vector3(0,1,0)).intersectObjects(result.lining.children,true);
  assert(hits.length&&Math.abs(hits[0].point.y-y)<1e-5,'Lining outside apertures remains closed at its intended height');
}
result.group.traverse(mesh=>{if(mesh.isMesh)assert([...mesh.geometry.attributes.position.array].every(Number.isFinite),`${mesh.name}: finite geometry`);});
for(const wall of[...data.extWalls,...data.intWalls]){
  const original=[...HOUSE_LOFT.extWalls,...HOUSE_LOFT.intWalls].find(w=>w.id===(wall.roofSourceId||wall.id));
  assert.deepEqual(wall.a,original.a);assert.deepEqual(wall.b,original.b);assert.deepEqual(wall.openings,original.openings);
  if(wall.profile)for(const [x,y]of wall.profile){
    assert(y>=0,`${wall.id}: no negative wall profile`);
    if(x<roof.intersectionX-1e-8)assert(y+data.floorY<=roof.westWing.undersideHeightAt(x)+1e-8,`${wall.id}: low-wing gable stays below its roof underside`);
    if(x>roof.intersectionX+1e-8){const plane=x<roof.ridgeX?roof.mainWest:roof.mainEast;assert(y+data.floorY<=plane.heightAt(x)-.480*Math.SQRT2+1e-8,`${wall.id}: top fits the finished roof lining`);}
  }
}
for(const id of ['P1','P2']){
  const wall=data.extWalls.find(w=>w.id===id);
  for(const x of[4,5,5.59,6,7,8,9]){
    const i=wall.profile.findIndex((p,i)=>i>0&&p[0]>=x),a=wall.profile[i-1],b=wall.profile[i];
    const top=data.floorY+a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
    assert(Math.abs(top-(7.15-Math.abs(x-7)-.480*Math.SQRT2))<1e-9,`${id}: gable meets finished lining without an end gap`);
  }
}
for(const cut of data.roofWindowLining.cutouts){
  assert(Math.abs(cut.back+.14)<1e-9,'Reveal depth is derived from the shared timber frame');
  const endpoint=new THREE.Vector3(cut.x0,cut.center[2]+(cut.x0-cut.center[0])*cut.slopeAxis[2]/cut.slopeAxis[0]+cut.back/cut.normal[2],cut.z0);
  assert(result.reveals.children.some(mesh=>{const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)if(new THREE.Vector3().fromBufferAttribute(p,i).distanceTo(endpoint)<1e-5)return true;return false;}),'Reveal reaches the exact rear-frame corner');
}
assert.equal(JSON.stringify(windows),windowBefore);
console.log('Loft roof windows: shared placement, physical lining apertures, unchanged room geometry.');
