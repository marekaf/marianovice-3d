import assert from 'node:assert/strict';
import {createAdaptiveResolution} from './adaptive-resolution.js';
const timers=new Map();let id=0,restored=0;
const fire=()=>{for(const [key,callback] of [...timers]){timers.delete(key);callback();}};
const make=dpr=>{
  const renderer={ratio:dpr,sets:0,getPixelRatio(){return this.ratio;},setPixelRatio(v){this.ratio=v;this.sets++;}};
  const adaptive=createAdaptiveResolution({renderer,full:()=>dpr,onRestore:()=>restored++,schedule:cb=>{timers.set(++id,cb);return id;},cancel:key=>timers.delete(key)});
  return {renderer,adaptive};
};
{
  const {renderer,adaptive}=make(2);
  adaptive.interact();assert.equal(renderer.ratio,1.5,'Interaction lowers a Retina display to 1.5x');
  adaptive.interact();adaptive.interact();assert.equal(renderer.sets,1,'Repeated input does not resize again');
  assert.equal(timers.size,1,'One settle timer is pending');
  fire();assert.equal(renderer.ratio,2,'Rest restores the full ratio');assert.equal(restored,1,'Rest asks for one more frame');
  adaptive.refresh();assert.equal(renderer.sets,2,'Refresh at rest keeps the full ratio without a resize');
}
{
  const {renderer,adaptive}=make(1);
  adaptive.interact();assert.equal(renderer.ratio,1,'A 1x display is never lowered');assert.equal(renderer.sets,0);
  fire();assert.equal(renderer.sets,0);
}
{
  const {renderer,adaptive}=make(2);
  adaptive.interact();adaptive.dispose();assert.equal(renderer.ratio,2,'Dispose restores the ratio');assert.equal(timers.size,0,'Dispose cancels the timer');
}
console.log(JSON.stringify({adaptiveResolution:'lower while moving, full at rest'}));
