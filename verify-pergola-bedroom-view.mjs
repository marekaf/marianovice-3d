import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js');
const pergola=GARDEN.elements.find(e=>e.id==='pergola');
const roof=pergola.parts.find(p=>p.kind==='rect');
assert.equal(pergola.meta.grading.level,.95,'North pergola follows lower terrain instead of retaining a raised terrace');
const fire=GARDEN.elements.find(e=>e.id==='firePit').parts.find(p=>p.kind==='circle');
assert.deepEqual([fire.cx,fire.cy,fire.r],[34.5,7.5,2],'Keep the northeast firepit and its seating area in place');
assert(roof.y+roof.d<=5.6,'Pergola belongs near the north fence, clear of the bedroom foreground');
for(const windowZ of [8.52,9.38,10.24])for(const targetZ of [fire.cy-1,fire.cy,fire.cy+1]){
  for(let x=roof.x-.08;x<=roof.x+roof.w+.08;x+=.02){
    const z=windowZ+(targetZ-windowZ)*(x-21.28)/(fire.cx-21.28);
    assert(z>roof.y+roof.d+.08,'Pergola roof must not cross the bedroom-to-firepit view');
  }
}
const [[ax,az],[bx,bz]]=GARDEN.plot.vertices;
const distance=(x,z)=>Math.abs((bx-ax)*(az-z)-(ax-x)*(bz-az))/Math.hypot(bx-ax,bz-az);
const clearance=Math.min(distance(roof.x-.08,roof.y-.08),distance(roof.x+roof.w+.08,roof.y-.08));
assert(clearance>=1.7,'Retain a planted maintenance strip between pergola roof and north boundary');
console.log(JSON.stringify({northBoundaryClearance:clearance,firepitView:'clear',footprint:roof}));
