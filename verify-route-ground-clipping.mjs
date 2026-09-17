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
const drainage=geometry([[0,2.165,0],[0,2.165,2],[1,2.165,2],[1,2.165,0],[2,2.165,2],[2,2.165,0]],[0,1,2,0,2,3,3,2,4,3,4,5]);
const crossing=geometry([[0,2.4,0],[0,2.4,2],[2,2.4,2],[2,2.4,0]],[0,1,2,0,2,3]);
const preserved=cutGroundUnderRoutes(THREE,drainage,crossing,[{x0:0,x1:1,z0:0,z1:2}]);
assert(Math.abs(heightAt(preserved,.3,.7)-2.165)<1e-6,'Aligned drainage soil remains beneath a path crossing');
assert.equal(heightAt(preserved,1.3,.7),undefined,'Ordinary route ground is still removed outside the preserved strip');
// The cell index and the reach box only skip work; they must reproduce the plain scan exactly,
// including slivers and ground vertices within the 1e-5 m acceptance band of a route edge.
function plainRouteEdges(ground,routes){
  const cross=(a,b,p)=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]),at=(attribute,i)=>[attribute.getX(i),attribute.getY(i),attribute.getZ(i)];
  const bins=new Map(),rp=routes.attributes.position;
  for(let i=0;i<(routes.index?.count??rp.count);i+=3){
    const points=[0,1,2].map(j=>at(rp,routes.index?routes.index.getX(i+j):i+j));
    const area=cross(...points);if(Math.abs(area)<1e-12)continue;
    if(area<0)[points[1],points[2]]=[points[2],points[1]];
    const xs=points.map(p=>p[0]),zs=points.map(p=>p[2]);
    for(let x=Math.floor(Math.min(...xs));x<=Math.floor(Math.max(...xs));x++)for(let z=Math.floor(Math.min(...zs));z<=Math.floor(Math.max(...zs));z++){
      const key=`${x},${z}`;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(points);
    }
  }
  const atRoute=p=>(bins.get(`${Math.floor(p[0])},${Math.floor(p[2])}`)??[]).some(triangle=>triangle.every((a,i)=>cross(a,triangle[(i+1)%3],p)>=0));
  const interpolate=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),positions=[],seen=new Set(),gp=ground.attributes.position;
  function connect(a,b,triangle){
    const height=p=>triangle.reduce((sum,q,i)=>sum+q[1]*cross(triangle[(i+1)%3],triangle[(i+2)%3],p),0)/cross(...triangle);
    const topA=[a[0],height(a),a[2]],topB=[b[0],height(b),b[2]],gapA=topA[1]-a[1],gapB=topB[1]-b[1];
    if(gapA*gapB<0&&Math.min(Math.abs(gapA),Math.abs(gapB))>1e-7){const middle=interpolate(a,b,gapA/(gapA-gapB));connect(a,middle,triangle);connect(middle,b,triangle);return;}
    const length=Math.hypot(b[0]-a[0],b[2]-a[2]);
    if(length<1e-7||Math.max(Math.abs(gapA),Math.abs(gapB))<1e-6)return;
    for(const p of [a,b,topB,a,topB,topA])positions.push(...p);
  }
  for(let i=0;i<(ground.index?.count??gp.count);i+=3)for(let edge=0;edge<3;edge++){
    const a=at(gp,ground.index?ground.index.getX(i+edge):i+edge),b=at(gp,ground.index?ground.index.getX(i+(edge+1)%3):i+(edge+1)%3);
    const length=Math.hypot(b[0]-a[0],b[2]-a[2]);if(length<1e-7)continue;
    const candidates=new Set();
    for(let x=Math.floor(Math.min(a[0],b[0]));x<=Math.floor(Math.max(a[0],b[0]));x++)for(let z=Math.floor(Math.min(a[2],b[2]));z<=Math.floor(Math.max(a[2],b[2]));z++)for(const triangle of bins.get(`${x},${z}`)??[])candidates.add(triangle);
    if(!candidates.size)continue;
    const key=[a,b].map(p=>p.map(v=>Math.round(v*1e6)).join(',')).sort().join('/');if(seen.has(key))continue;seen.add(key);
    const intervals=[];
    for(const triangle of candidates){
      let from=0,to=1;
      for(let j=0;j<3&&from<=to;j++){
        const start=triangle[j],end=triangle[(j+1)%3],da=cross(start,end,a),db=cross(start,end,b),tolerance=1e-5*Math.hypot(end[0]-start[0],end[2]-start[2]);
        if(da<-tolerance&&db<-tolerance){from=1;to=0;break;}
        if(da<-tolerance)from=Math.max(from,da/(da-db));
        if(db<-tolerance)to=Math.min(to,da/(da-db));
      }
      if(to-from>1e-8)intervals.push({from,to,triangle});
    }
    const cuts=[...new Set(intervals.flatMap(({from,to})=>[from,to]))].sort((a,b)=>a-b);
    for(let j=1;j<cuts.length;j++){
      const from=cuts[j-1],to=cuts[j],t=(from+to)/2;if((to-from)*length<1e-7)continue;
      const interval=intervals.find(interval=>t>=interval.from&&t<=interval.to);if(!interval)continue;
      const middle=interpolate(a,b,t),nx=-(b[2]-a[2])/length*.00005,nz=(b[0]-a[0])/length*.00005;
      if(atRoute([middle[0]+nx,0,middle[2]+nz])===atRoute([middle[0]-nx,0,middle[2]-nz]))continue;
      connect(interpolate(a,b,from),interpolate(a,b,to),interval.triangle);
    }
  }
  return positions;
}
let seed=7;const random=()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
let fuzzed=0;
for(let run=0;run<40;run++){
  const n=6+Math.floor(random()*8),step=6/n,pos=[],idx=[];
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++)pos.push([-2+i*step+(random()-.5)*step*.6,random()*.1,-2+j*step+(random()-.5)*step*.6]);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;idx.push(a,d,b,a,c,d);}
  const routePoints=[];
  for(let t=0,count=2+Math.floor(random()*6);t<count;t++){
    const kind=random(),cx=random()*4-1,cz=random()*4-1;let corners;
    if(kind<.3){const length=.5+random()*2,width=1e-6+random()*2e-4,angle=random()*Math.PI,ux=Math.cos(angle),uz=Math.sin(angle);corners=[[cx,cz],[cx+length*ux,cz+length*uz],[cx+length/2*ux-width*uz,cz+length/2*uz+width*ux]];}
    else if(kind<.6){const [gx,,gz]=pos[Math.floor(random()*pos.length)],offset=(random()-.5)*4e-5;corners=[[gx+offset,gz-offset],[gx+1+random(),gz+random()*.3],[gx+random()*.3,gz+1+random()]];}
    else corners=[[cx,cz],[cx+random()*1.5,cz+random()*.4],[cx+random()*.4,cz+random()*1.5]];
    for(const [x,z] of corners)routePoints.push([x,.05+random()*.1,z]);
  }
  const ground=geometry(pos,idx),routes=geometry(routePoints,routePoints.map((_,i)=>i)),cut=cutGroundUnderRoutes(THREE,ground,routes);
  assert.deepEqual(Array.from(routeEdgeGeometry(THREE,cut,routes).attributes.position.array),Array.from(new THREE.Float32BufferAttribute(plainRouteEdges(cut,routes),3).array),`Indexed edge pass matches the plain scan in scene ${run}`);
  fuzzed++;
}
console.log(JSON.stringify({routeEdgeFuzzScenes:fuzzed}));
