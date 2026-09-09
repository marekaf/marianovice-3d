import assert from 'node:assert/strict';
import {moveWalker} from './walk-movement.js';

const close=(actual,expected)=>assert(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
function move(keys,yaw=0,frames=60) {
  const position={x:0,y:1.7,z:0};
  for(let i=0;i<frames;i++)moveWalker(position,yaw,keys,1/frames);
  assert.equal(position.y,1.7);
  return position;
}
close(move({w:true}).z,-1.4);
close(move({w:true,shift:true}).z,-3);
close(move({w:true},0,30).z,move({w:true},0,144).z);
const diagonal=move({w:true,d:true});
close(Math.hypot(diagonal.x,diagonal.z),1.4);
close(move({w:true},Math.PI/2).x,-1.4);
close(move({d:true},Math.PI/2).z,-1.4);
assert.deepEqual(move({w:true,s:true,a:true,d:true}),{x:0,y:1.7,z:0});
assert.deepEqual(move({}),{x:0,y:1.7,z:0});
console.log('Walking pace: 1.4 m/s, Shift 3 m/s, normalized diagonal and frame-rate independence pass');
