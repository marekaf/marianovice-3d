import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cutGroundUnderRoutes,routeEdgeGeometry} from './route-ground-clipping.js';

const geometry=(vertices,indices)=>{
  const result=new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));
  result.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap(([x,,z])=>[x,z]),2));
  result.setIndex(indices);result.computeVertexNormals();return result;
};
const heightAt=(geometry,x,z,strict=true)=>{
  const p=geometry.attributes.position,index=geometry.index;
  for(let i=0;i<index.count;i+=3){
    const [a,b,c]=[0,1,2].map(j=>{const k=index.getX(i+j);return [p.getX(k),p.getY(k),p.getZ(k)];});
    const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if(Math.abs(d)<1e-12)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
    if(strict?u>1e-7&&v>1e-7&&u+v<1-1e-7:u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)return u*a[1]+v*b[1]+(1-u-v)*c[1];
  }
};
const source=geometry([[30.600000381469727,1.4297164678573608,17.200000762939453],[30.600000381469727,1.4627236127853394,17.3799991607666],[31.200000762939453,1.5177319049835205,17.3799991607666]],[0,1,2]);
const path=geometry([[30.799999237060547,1.4400079250335693,17.219999313354492],[30.920000076293945,1.4761173725128174,17.34000015258789],[30.920000076293945,1.4330734014511108,17.219999313354492]],[0,1,2]);
const snapshot=source.toJSON(),pathSnapshot=path.toJSON(),cut=cutGroundUnderRoutes(THREE,source,path);
const x=30.895999908447266,z=17.29199981689453;
assert(heightAt(source,x,z)-heightAt(path,x,z)>.013,'Fixture reproduces the rendered Pond walk penetration');
assert.equal(heightAt(cut,x,z),undefined,'Grass geometry must not remain inside the mineral surface');
assert.deepEqual(source.toJSON(),snapshot,'Original terrain remains available for pond and grading consumers');
assert.deepEqual(path.toJSON(),pathSnapshot,'Cutting ground must not alter the planned path');
const plane=(x,z)=>.1*x+.07*z;
const field=geometry([[0,plane(0,0),0],[0,plane(0,8),8],[8,plane(8,8),8],[8,plane(8,0),0]],[0,1,2,0,2,3]);
const rectangles=[[1,2,2,3],[3,2,7,3],[5,2,6,7]],vertices=[],indices=[];
for(const [x0,z0,x1,z1] of rectangles){
  const offset=vertices.length;
  vertices.push(...[[x0,z0],[x0,z1],[x1,z1],[x1,z0]].map(([x,z])=>[x,plane(x,z)+.02,z]));
  indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
}
const footprint=geometry(vertices,indices),clipped=cutGroundUnderRoutes(THREE,field,footprint);
const within=(x,z)=>rectangles.some(([x0,z0,x1,z1])=>x>x0&&x<x1&&z>z0&&z<z1);
for(let x=.017;x<8;x+=.11)for(let z=.023;z<8;z+=.11){
  const height=heightAt(clipped,x,z);
  if(within(x,z))assert.equal(height,undefined,`Route owns ${x},${z}`);
  else assert(Math.abs(height-plane(x,z))<1e-6,`No hole or height change outside routes at ${x},${z}`);
}
assert.notEqual(heightAt(clipped,2.5,2.4),undefined,'Excluded hardscape notch keeps its original ground');
let area=0;
const cp=clipped.attributes.position;
for(let i=0;i<clipped.index.count;i+=3){
  const [a,b,c]=[0,1,2].map(j=>at(clipped.index.getX(i+j)));
  area+=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;
}
function at(i){return [cp.getX(i),cp.getY(i),cp.getZ(i)];}
assert(Math.abs(area-55)<1e-5,'Subtract the union once, preserving its notch and outside area');
for(let i=0;i<cp.count;i++){
  assert(Math.abs(cp.getY(i)-plane(cp.getX(i),cp.getZ(i)))<1e-6);
  assert.equal(clipped.attributes.uv.getX(i),cp.getX(i));
  assert.equal(clipped.attributes.uv.getY(i),cp.getZ(i));
  for(const axis of ['X','Y','Z'])assert(Math.abs(clipped.attributes.normal['get'+axis](i)-field.attributes.normal['get'+axis](0))<1e-6);
}
const reversed=footprint.toNonIndexed();
for(let i=0;i<reversed.attributes.position.count;i+=3){
  const attribute=reversed.attributes.position,a=atVertex(attribute,i),b=atVertex(attribute,i+1);
  attribute.setXYZ(i,...b);attribute.setXYZ(i+1,...a);
}
function atVertex(attribute,i){return [attribute.getX(i),attribute.getY(i),attribute.getZ(i)];}
const reverseCut=cutGroundUnderRoutes(THREE,field,reversed);
assert.equal(heightAt(reverseCut,1.5,2.4),undefined,'Nonindexed reverse-wound route triangles still own their footprint');
assert(Math.abs(heightAt(reverseCut,2.5,2.4)-plane(2.5,2.4))<1e-6);
const edges=routeEdgeGeometry(THREE,clipped,footprint);
assert(edges.attributes.position?.count>0,'Clipped ground and raised path boundaries need connecting faces');
assert(Math.abs(edges.userData.boundaryLength-22)<1e-4,'Connect the full union perimeter, including notch and T junctions, once');
assert(Math.abs(edges.userData.maxHeightGap-.02)<1e-6);
const ring=[[1,2],[1,4],[4,4],[4,2],[2.5,2]],fanVertices=ring.map(([x,z],i)=>[x,plane(x,z)+(i===4?.25:.02),z]);
fanVertices.push([2.5,plane(2.5,3)+.1,3]);
const fan=geometry(fanVertices,ring.flatMap((_,i)=>[5,i,(i+1)%ring.length]));
const fanCut=cutGroundUnderRoutes(THREE,field,fan),fanEdges=routeEdgeGeometry(THREE,fanCut,fan);
assert(Math.abs(fanEdges.userData.boundaryLength-10)<1e-4);
const fp=fanEdges.attributes.position;
for(let i=0;i<fp.count;i+=6){
  for(const k of [i+2,i+5])assert(Math.abs(fp.getY(k)-heightAt(fan,fp.getX(k),fp.getZ(k),false))<1e-6,'Top edge follows each actual route triangle, including mid-edge height changes');
  assert(Math.abs(fanEdges.attributes.uv.getY(i+5)-fanEdges.attributes.uv.getY(i))>1e-6,'Connection texture has a vertical span');
}
const edgeMesh=new THREE.Mesh(fanEdges,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));edgeMesh.updateMatrixWorld(true);
for(const x of [1.2,1.75,2.49,2.51,3.25,3.8]){
  const top=heightAt(fan,x,2,false),middle=(top+plane(x,2))/2;
  assert(new THREE.Raycaster(new THREE.Vector3(x,middle,1.99),new THREE.Vector3(0,0,1),0,.02).intersectObject(edgeMesh).length,'No seam opening on either side of the boundary T junction');
}
console.log('Route ground ownership: rendered Pond walk penetration removed without changing path or source terrain');
