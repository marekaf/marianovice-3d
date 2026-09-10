import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import {buildModel} from './model3d.js';
import {buildCoffeeNicheUpper} from './docs/coffee-niche.js';
import {prepareLivingData} from './docs/living-interior.js';
import {attachInteriorLed} from './docs/interior-led.js';
const {HOUSE_INTERIOR:data}=createRequire(import.meta.url)('./house-interior.js');
const before=JSON.stringify(data),model=buildCoffeeNicheUpper(data);
const close=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const get=name=>model.parts.find(p=>p.name===`coffee_upper_${name}`);
const bottom=p=>p.position[2]-p.size[2]/2,top=p=>p.position[2]+p.size[2]/2;
const fronts=model.parts.filter(p=>p.name.includes('_front_'));
assert.equal(fronts.length,4);
for(const [column,z]of [[0,7.4],[1,8.0]])for(const [row,y0,y1]of [[0,1.45,1.849],[1,1.851,2.5]]){
  const p=get(`front_${column}_${row}`);close(p.position[1],z);close(p.size[1],.598);close(bottom(p),y0);close(top(p),y1);
  close(p.size[0],.019);assert.equal(p.material,'green');
}
close(bottom(get('bottom_0')),1.460);close(top(get('top')),2.5);
close(bottom(get('division_0')),1.850);close(top(get('division_0')),1.869);
close(bottom(get('top'))-top(get('division_0')),.612);
for(const column of [0,1]){
  close(get(`lower_shelf_${column}`).size[0],.381);
  close(get(`bottom_${column}`).size[0],.381);
  close(bottom(get(`lower_shelf_${column}`))-top(get(`bottom_${column}`)),.201);
  close(bottom(get(`division_${column}`))-bottom(get(`lower_shelf_${column}`)),.170);
}
assert(model.parts.every(p=>p.type==='box'&&p.size.every(v=>Number.isFinite(v)&&v>0)&&p.position.every(Number.isFinite)));
assert(!model.parts.some(p=>/handle|gola/i.test(p.name)));
assert.equal(model.openingMechanism,'tip-on');
for(let i=0;i<model.parts.length;i++)for(const b of model.parts.slice(i+1)){
  const a=model.parts[i];
  assert(!a.position.every((v,axis)=>Math.abs(v-b.position[axis])<(a.size[axis]+b.size[axis])/2-1e-9),`${a.name} overlaps ${b.name}`);
}
globalThis.document={createElement(){return{getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};}};}};
const group=buildModel(THREE,model);group.updateMatrixWorld(true);
for(const z of [7.4,8.0])for(const y of [1.6,2.2]){
  const hits=new THREE.Raycaster(new THREE.Vector3(5,y,z),new THREE.Vector3(-1,0,0)).intersectObject(group,true);
  assert(hits[0]&&Math.abs(hits[0].point.x-4.719)<1e-5&&hits[0].object.material.name==='green','The finished niche has closed fronts, not exposed shelf rows');
}
assert.equal(JSON.stringify(data),before);
const prepared=prepareLivingData(data);
const led=attachInteriorLed(THREE,{furniture:new THREE.Group()},prepared).fixtures.find(f=>f.name==='Coffee niche strip');
for(const point of [led.start,led.end]){
  close(point[1]+.004,bottom(get('bottom_0')));
  const support=get(point[2]<7.7?'bottom_0':'bottom_1');
  assert(point[0]-.009>support.position[0]-support.size[0]/2);
  assert(point[0]+.009<support.position[0]+support.size[0]/2,'LED channel must sit under the shallow cabinet bottom');
}
console.log('Coffee niche upper: closed 400/650 fronts, 19 mm boards, shelf datums and supported underside lighting verified');
