import assert from 'node:assert/strict';
import {stepSupportHeight} from './walk-step-support.js';
const surfaces=[
  {x0:-.45,x1:0,z0:0,z1:1,y:2.465},
  {x0:0,x1:.68,z0:0,z1:1,y:2.330},
  {x0:.68,x1:1.02,z0:0,z1:1,y:2.195},
  {x0:1.02,x1:1.36,z0:0,z1:1,y:2.060},
];
assert.equal(stepSupportHeight(surfaces,.17,.5),2.465,'Body remains supported by the threshold until clear of the wall');
assert.equal(stepSupportHeight(surfaces,.19,.5),2.330,'Body settles onto the first visible tread after clearing the threshold');
assert.equal(stepSupportHeight(surfaces,.87,.5),2.195);
assert.equal(stepSupportHeight(surfaces,1.21,.5),2.060);
assert.equal(stepSupportHeight(surfaces,1.55,.5),-Infinity,'Support ends beyond the last tread');
assert.equal(stepSupportHeight(surfaces,.3,1.19),-Infinity,'No invisible extension beside the steps');
assert.equal(stepSupportHeight(surfaces,1.50,1.14),-Infinity,'Corner support uses the round walking footprint');
assert.equal(stepSupportHeight([],0,0),-Infinity);
console.log('Exterior step support follows tread tops and clears the threshold before descending');
