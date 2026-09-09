import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
const require=createRequire(import.meta.url);
const {HouseRoof}=require('./house-roof.js');
const options={bbox:[10.48,7.18,21.28,26.43],atrium:[10.48,15.93,14.93,19.18],gable:[13.68,21.28],baseY:0,eNotch:[20.58,11.58,21.28,22.53]};
const roof=HouseRoof.create(THREE,options),d=roof.userData.description;
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const runDeclaration=html.match(/^const roofWindowRun =.*;$/m)[0];
const windowBuild=html.match(/const model=window\.RoofWindows\.build\([^\n]+;/)[0];
const windows=new Function('window','GABLE','houseRoofSpec',`${runDeclaration}\n${windowBuild}\nreturn model;`)(
  {RoofWindows:require('./docs/house-roof-windows.js')},options.gable,d);
for(const [i,expected]of[[0,[19.3925,24.76,5.2375]],[1,[19.3925,20.78,5.2375]],[2,[15.5675,20.78,5.2375]]]){
  assert(windows.cutouts[i].center.every((value,axis)=>Math.abs(value-expected[axis])<1e-9),'Roof windows retain their fixed model positions');
}
const topBounds=new THREE.Box3();
roof.traverse(mesh=>{if(mesh.userData.roofSurface)topBounds.expandByObject(mesh);});
for(const [actual,expected]of[[topBounds.min.x,9.33],[topBounds.max.x,21.63],[topBounds.min.z,7.005],[topBounds.max.z,26.605]])assert(Math.abs(actual-expected)<1e-5,'Roof skin follows the specified finished-facade overhang');
assert.equal(d.ridgeX,17.48);
assert.equal(d.ridgeY,7.15);
assert(Math.abs(d.westWing.heightAt(9.33)-3.025)<1e-9);
assert(Math.abs(d.westWing.heightAt(d.intersectionX)-d.mainWest.heightAt(d.intersectionX))<1e-9,'Wing and main metal meet without an overlapping roof plane');
assert(d.intersectionX>13.73&&d.intersectionX<13.75);
roof.updateMatrixWorld(true);
const tops=[],soffits=[],gutters=[];
roof.traverse(mesh=>{
  if(mesh.userData.roofSurface)tops.push(mesh);
  if(mesh.name.endsWith('bioboard soffit'))soffits.push(mesh);
  if(mesh.userData.gutter)gutters.push(mesh);
  assert(!/rafter/i.test(mesh.name),'The exterior finish must not expose individual rafters');
});
function hitsAt(objects,x,z){return new THREE.Raycaster(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0)).intersectObjects(objects);}
for(const [x,z,expected]of[[21.629,10,3.001],[13.331,17,3.001],[17.48,8,7.15],[9.331,8,3.02508749],[13.5,17,3.17]]){
  const hits=hitsAt(tops,x,z);
  assert(hits.length>0,`Roof skin exists at ${x},${z}`);
  assert(hits.every(hit=>Math.abs(hit.point.y-expected)<1e-5),'Generated roof height follows the drawing datum');
}
for(const z of[7.2,10,15.9,19.3,25])for(let x=13.3;x<14.2;x+=.04){
  const hits=hitsAt(tops,x,z);
  assert(hits.length>0);
  const heights=hits.map(h=>h.point.y);
  assert(Math.max(...heights)-Math.min(...heights)<1e-5,'No covered second roof plane remains beneath the wing/main junction');
  assert(Math.abs(heights[0]-d.heightAt(x,z))<1e-5,'Public roof height matches generated metal');
}
for(const [x,z]of[[9.7,10],[10,16],[14,17],[21.5,10],[21,17],[16,7.08]]){
  const hits=hitsAt(soffits,x,z);
  assert(hits.length>0,'Every exposed overhang has a finished underside');
  if(x>13)assert(hits.every(hit=>Math.abs((d.heightAt(x,z)-hit.point.y)*Math.SQRT1_2-.25)<1e-5),'Main overhang has 250mm depth normal to its 45-degree roof skin');
  else assert(hits.every(hit=>Math.abs(hit.point.y-(d.heightAt(x,z)-.04))<1e-5),'Unconfirmed shallow-wing build-down remains unchanged');
}
for(const [x,z]of[[11,10],[18,10],[19,17],[15.5,23]])assert.equal(hitsAt(soffits,x,z).length,0,'Soffits do not create timber ceilings over occupied interior rooms');
assert.equal(gutters.length,4,'Separate continuous gutters serve the eastern, two western and atrium eaves');
for(const gutter of gutters){
  const bounds=new THREE.Box3().setFromObject(gutter),g=gutter.userData.gutter;
  assert(bounds.max.x-bounds.min.x>.129&&bounds.max.x-bounds.min.x<.131,'Half-round gutter has a restrained 130mm width');
  assert(Math.abs(bounds.max.y-g.topY)<1e-5);
  const midZ=(bounds.min.z+bounds.max.z)/2;
  assert(d.heightAt(g.edgeX,midZ)-bounds.max.y>.034,'Gutter lip remains below the metal drip edge');
}
assert(d.undersideHeightAt(10.48,10)>3.07,'Western soffit clears the existing finished wall top');
assert.equal(d.westWing.depthStatus,'unconfirmed');
for(const [x,z]of[[14,17],[21.5,10],[16,7.08]])assert(Math.abs(d.heightAt(x,z)-d.undersideHeightAt(x,z)-.3535533905932738)<1e-9,'Infill API uses the main roof normal build-up');
for(const z of[7.1,26.5,16,19.1]){
  const hits=new THREE.Raycaster(new THREE.Vector3(13.6,3.2,z),new THREE.Vector3(1,0,0),0,.3).intersectObject(roof,true);
  assert(hits.length>0,'Roof depth transition is closed across every exposed overhang strip');
  assert(Math.abs(hits[0].point.x-13.740904105095847)<1e-5,'Closure joins the wing and main undersides');
}
for(const [z,direction]of[[16.105,-1],[19.005,1]]){
  const hits=new THREE.Raycaster(new THREE.Vector3(13.5,3.1,z-direction*.1),new THREE.Vector3(0,0,direction),0,.2).intersectObject(roof,true);
  assert(hits.some(hit=>Math.abs(hit.point.z-z)<1e-5),'Atrium return encloses the deeper roof body');
}
for(const [name,bodyX]of[['East',21.60],['Atrium',13.36]]){
  const fascia=roof.getObjectByName(`${name} eave fascia`),gutter=roof.getObjectByName(`${name} half-round gutter`);
  const bodyBounds=new THREE.Box3().setFromObject(fascia),gutterBounds=new THREE.Box3().setFromObject(gutter);
  assert(Math.abs(bodyBounds.min.x-bodyX)<1e-5&&Math.abs(bodyBounds.max.x-bodyX)<1e-5,'Main fascia sits behind the unchanged gutter');
  assert(name==='East'?gutterBounds.min.x-bodyBounds.max.x>.007:bodyBounds.min.x-gutterBounds.max.x>.007,'Thick fascia cannot intersect the gutter bowl');
  assert(Math.abs((bodyBounds.max.y-bodyBounds.min.y)*Math.SQRT1_2-.25)<1e-5,'Main fascia encloses the complete roof depth');
  const lip=roof.getObjectByName(`${name} metal drip underside`);
  assert(lip,'The metal projection beyond the body has a closed underside');
  const bounds=new THREE.Box3().setFromObject(lip);
  assert(Math.abs(bounds.max.x-bounds.min.x-.03)<1e-5,'Thin drip projection does not move the roof skin edge');
}
for(const name of['North atrium junction closure','South atrium junction closure']){
  const geometry=roof.getObjectByName(name).geometry,position=geometry.attributes.position,index=geometry.index;
  const polygon=Array.from({length:position.count},(_,i)=>[position.getX(i),position.getY(i)]);
  const contains=([x,y])=>{
    let inside=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const [ax,ay]=polygon[i],[bx,by]=polygon[j];
      if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
    }
    return inside;
  };
  const area=points=>Math.abs(points.reduce((sum,[x,y],i)=>{const next=points[(i+1)%points.length];return sum+x*next[1]-next[0]*y;},0))/2;
  let trianglesArea=0;
  for(let i=0;i<index.count;i+=3){
    const triangle=[0,1,2].map(j=>polygon[index.getX(i+j)]);
    assert(contains([triangle.reduce((s,p)=>s+p[0],0)/3,triangle.reduce((s,p)=>s+p[1],0)/3]),'Stepped closure triangles remain inside their outline');
    trianglesArea+=area(triangle);
  }
  assert(Math.abs(trianglesArea-area(polygon))<1e-8,'Stepped closure triangles cover the outline without overlap');
}
console.log('House roof skin, junctions, enclosed overhangs and gutter clearances verified');
