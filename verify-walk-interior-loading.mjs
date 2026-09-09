import assert from 'node:assert/strict';
import {createWalkInteriorLoader} from './walk-interior-loading.js';

let builds=0, installs=0, complete;
const states=[];
const load=createWalkInteriorLoader({
  build:()=>{builds++;return new Promise(resolve=>{complete=resolve;});},
  install:()=>{installs++;},
  status:state=>states.push(state),
});
assert.equal(builds,0,'The garden must not build interiors before walk activation');
const first=load(),second=load();
assert.equal(first,second,'Repeated activation shares the pending build');
await Promise.resolve();
complete({root:{}});
await first;
await load();
assert.equal(builds,1);
assert.equal(installs,1);
assert.deepEqual(states,['loading','ready']);

let attempts=0;
const retryStates=[];
const retry=createWalkInteriorLoader({
  build:async()=>{if(++attempts===1)throw new Error('offline');return {};},
  install:()=>{},
  status:(state,error)=>retryStates.push([state,error?.message]),
});
await retry();
await retry();
assert.equal(attempts,2,'A failed load can be retried without reloading the garden');
assert.deepEqual(retryStates,[['loading',undefined],['error','offline'],['loading',undefined],['ready',undefined]]);
console.log('Walk interiors: deferred build, shared loading, single install and retry pass');
