import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {PlantingProfiles}=require('./planting-profiles.js');
const source={bed:[{name:"Salvia nemorosa 'Schneehügel'",height:.4,bloom:[6,7,8],share:1}]};
const sample=PlantingProfiles.sample('bed',2,3,'perennials',source);
assert.equal(sample.profile,'spire');assert.equal(sample.color,'#eee9dc');
assert.deepEqual(sample.bloom,[6,7,8]);assert.ok(sample.height>=.352&&sample.height<=.432);
assert.deepEqual(sample,PlantingProfiles.sample('bed',2,3,'perennials',source));
assert.deepEqual(source.bed[0],{name:"Salvia nemorosa 'Schneehügel'",height:.4,bloom:[6,7,8],share:1});
for(let i=0;i<100;i++){
  const p=PlantingProfiles.sample('unknown',i*.31,i*.7);
  assert.ok(Number.isFinite(p.height)&&p.height>0);assert.ok(p.spread>=.28&&p.spread<=.48);
}
console.log('Planting profiles: deterministic drifts, bounded sizes, source bloom months and safe fallback pass');
