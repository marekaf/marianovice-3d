import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {FenceModel}=createRequire(import.meta.url)('./fence-model.js');
const model=FenceModel.build({start:[0,0],end:[7,0],heightAt:(x)=>.08*x+.03*Math.sin(x),startPost:false});
assert.equal(model.dims.height,2);assert.equal(model.dims.boardVisible,.2);assert.equal(model.dims.wireDiameter,.0028);
assert.equal(model.dims.bays.length,3);
assert(!model.parts.some(p=>p.name==='fence_post_0'));
assert(model.parts.some(p=>p.name==='fence_post_3'));
assert(!model.parts.some(p=>p.name==='fence_end_brace_0'));
assert.equal(model.parts.filter(p=>p.name.startsWith('chain_link_mesh_')).length,3);
for(const b of model.dims.bays){assert(b.to-b.from<=2.5);assert(b.samples.every(h=>b.bottom<h));}
for(const p of model.parts){
  assert(model.materials[p.material],p.name);
  assert((p.vertices??p.position??[...p.start,...p.end]).flat().every(Number.isFinite),p.name);
  if(p.faces)assert(p.faces.flat().every(i=>i>=0&&i<p.vertices.length),p.name);
}
const reversed=FenceModel.build({start:[7,0],end:[0,0],heightAt:x=>.08*x});
assert.equal(reversed.dims.bays.length,3);
assert.throws(()=>FenceModel.build({start:[0,0],end:[0,0],heightAt:()=>0}));
console.log('Boundary fence: nominal2m height, concrete support below terrain, wiremesh, bracing and omitted gate-abutment posts pass.');
