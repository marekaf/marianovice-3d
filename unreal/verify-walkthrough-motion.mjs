import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const route=JSON.parse(await readFile(new URL('./walkthrough-route.json',import.meta.url),'utf8'));
assert.equal(route.units,'Unreal centimetres');
assert.equal(route.fps,24);
assert.equal(route.shots.length,22);
assert.equal(route.shots.reduce((sum,shot)=>sum+shot.duration,0),120);
assert(!route.shots.some(shot=>shot.name==='1.09 North corridor'),'The hallway door close-up is excluded');
assert.equal(new Set(route.shots.map(shot=>shot.name)).size,route.shots.length);

const gentleShots=new Set(['1.02 Utility','1.11 Dressing room','Bedroom northeast garden view','Staircase','2.01 Loft landing']);
const exteriorShots=new Set(['Garden arrival','West garden and offices','Pergola and firepit','Pond toward house']);
const difference=(a,b)=>a.map((value,index)=>value-b[index]);
for(const shot of route.shots){
  if('exposureBias' in shot)assert(Number.isFinite(shot.exposureBias),`${shot.name}: finite exposure bias`);
  assert(Number.isFinite(shot.duration)&&shot.duration>0,`${shot.name}: positive duration`);
  assert(Number.isInteger(shot.duration*route.fps),`${shot.name}: whole frames`);
  for(const key of ['start','end','targetStart','targetEnd']){
    assert(Array.isArray(shot[key])&&shot[key].length===3,`${shot.name}: ${key} has three coordinates`);
    assert(shot[key].every(Number.isFinite),`${shot.name}: ${key} is finite`);
  }
  const distance=Math.hypot(...difference(shot.end,shot.start));
  assert(distance>=5,`${shot.name}: at least 5 cm of translation`);
  assert(distance/shot.duration<=(exteriorShots.has(shot.name)?35:10),`${shot.name}: slow camera speed`);
  if(gentleShots.has(shot.name))assert(distance>=20&&distance<=30,`${shot.name}: visible gentle move between 20 and 30 cm`);
  for(let frame=0;frame<=shot.duration*route.fps;frame++){
    const fraction=frame/(shot.duration*route.fps);
    const position=shot.start.map((value,index)=>value+(shot.end[index]-value)*fraction);
    const target=shot.targetStart.map((value,index)=>value+(shot.targetEnd[index]-value)*fraction);
    assert(Math.hypot(...difference(target,position))>45,`${shot.name}: target stays clear of camera`);
    if(shot.name==='2.01 Loft landing'){
      assert(position[0]>=855&&position[0]<=939,'Landing camera radius clears stairwell and east slope boundary');
      assert(position[1]>=1300&&position[1]<=1383,'Landing camera radius stays inside the stair band');
      assert.equal(position[2],437,'Landing retains the reviewed eye height');
    }
  }
}
for(const name of ['Bedroom northeast garden view','2.01 Loft landing']){
  const shot=route.shots.find(shot=>shot.name===name);
  assert.deepEqual(difference(shot.targetEnd,shot.end),difference(shot.targetStart,shot.start),`${name}: sightline direction stays fixed`);
}
const landing=route.shots.find(shot=>shot.name==='2.01 Loft landing');
assert.equal(landing.start[0],landing.end[0],'Landing maintains distance to the stair edge and roof slope');
console.log('Walkthrough motion: 22 moving shots, 120 seconds, finite frame samples, slow speeds and landing bounds pass. Imported-scene collision still requires Unreal verification.');
