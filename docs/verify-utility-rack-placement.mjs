import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildUtilityEquipment} from './utility-equipment.js';
const {HOUSE_INTERIOR:data}=createRequire(import.meta.url)('../house-interior.js');
const before=JSON.stringify(data),result=buildUtilityEquipment(data),room=data.rooms.find(r=>r.id==='1.02');
assert.equal(JSON.stringify(data),before);
const rack=result.equipment.find(e=>e.name==='UniFi 12U wall rack'),board=result.equipment.find(e=>e.name==='Electrical distribution board');
assert.equal(rack.wallId,'W10');
assert.equal(board.wallId,'W10');
assert(Math.abs(rack.bounds.x1-room.x1+.02)<1e-8);
assert(Math.abs(rack.bounds.z0-room.z0-.05)<1e-8,'Rack side clears the north Jablotron wall by 50 mm');
assert(Math.abs(board.bounds.z0-16.044)<1e-8,'Moving the rack must not move the electrical board');
assert(Math.abs(rack.bounds.x1-rack.bounds.x0-.600)<1e-8);
assert(Math.abs(rack.bounds.z1-rack.bounds.z0-.598)<1e-8);
assert(Math.abs(rack.bounds.y0-1.575)<1e-8);
const alarm=result.equipment.find(e=>e.name==='Jablotron control enclosure');
assert(Math.abs(alarm.bounds.x0-8.95-.15)<1e-8,'Jablotron sits 150 mm beside the utility entrance opening');
assert.equal(alarm.bounds.y0,1.47);
assert(board.bounds.y1<rack.bounds.y0);
const overlap=(a,b)=>a.x0<b.x1-1e-8&&a.x1>b.x0+1e-8&&a.z0<b.z1-1e-8&&a.z1>b.z0+1e-8&&a.y0<b.y1-1e-8&&a.y1>b.y0+1e-8;
const bounds=p=>{
  const size=p.size?[...p.size]:[p.radiusTop*2,p.radiusTop*2,p.height];
  if(p.type==='cylinder'&&p.axis==='x')[size[0],size[2]]=[size[2],size[0]];
  if(p.type==='cylinder'&&p.axis==='y')[size[1],size[2]]=[size[2],size[1]];
  return {x0:p.position[0]-size[0]/2,x1:p.position[0]+size[0]/2,z0:p.position[1]-size[1]/2,z1:p.position[1]+size[1]/2,y0:p.position[2]-size[2]/2,y1:p.position[2]+size[2]/2};
};
const moved=result.models.filter(m=>['UniFi 12U wall rack','Electrical distribution board','Utility service accessories','Jablotron control enclosure'].includes(m.name));
const others=result.models.filter(m=>!moved.includes(m));
const door={x0:8.05,x1:8.95,z0:15.8,z1:16.7,y0:0,y1:2.1};
for(const model of moved)for(const p of model.parts){
  const b=bounds(p);
  assert(p.position.every(Number.isFinite));
  assert(b.x0>=room.x0&&b.x1<=room.x1&&b.z0>=room.z0-1e-8&&b.z1<=room.z1&&b.y0>=0&&b.y1<=data.clearH,p.name);
  assert(!overlap(b,door),`${p.name} blocks door clearance`);
  for(const other of others)for(const q of other.parts)assert(!overlap(b,bounds(q)),`${p.name} intersects ${q.name}`);
  for(const f of data.furniture.filter(f=>f.room==='1.02'))assert(!overlap(b,{...f,y0:f.y0??0,y1:(f.y0??0)+f.h}),`${p.name} intersects ${f.label}`);
}
for(let i=0;i<moved.length;i++)for(let j=i+1;j<moved.length;j++)for(const p of moved[i].parts)for(const q of moved[j].parts)assert(!overlap(bounds(p),bounds(q)),`${p.name} intersects ${q.name}`);
for(const q of others.flatMap(m=>m.parts))assert(!overlap({...rack.service,y0:rack.bounds.y0,y1:rack.bounds.y1},bounds(q)),`Rack service zone intersects ${q.name}`);
const rackModel=result.models.find(m=>m.name===rack.name),glass=rackModel.parts.find(p=>p.name==='rack_door_glass');
assert(Math.abs(data.clearH-Math.max(...rackModel.parts.map(p=>bounds(p).y1))-.30)<1e-8,'Highest rack component leaves 300 mm to the ceiling');
for(const[i,size]of[.004,.51,.563].entries())assert(Math.abs(glass.size[i]-size)<1e-8);
assert.equal(rackModel.parts.find(p=>p.name==='rack_router_screen').axis,'x');
const ports=rackModel.parts.filter(p=>/^rack_port_5_/.test(p.name));
assert.equal(ports.length,24);
for(let i=1;i<ports.length;i++)assert(Math.abs(ports[i].position[1]-ports[i-1].position[1]-.0168)<1e-8);
const sockets=result.models.find(m=>m.name==='Utility service accessories').parts.filter(p=>/^rack_socket_\d$/.test(p.name));
assert(sockets.every(p=>p.position[2]>rack.bounds.y1&&Math.abs(p.position[0]-room.x1)<.05));
assert(result.notes.some(note=>note.includes('20mm')&&note.includes('service')),'Shared service/door-swing space must be disclosed');
assert(Math.abs(Math.min(rack.service.x1,door.x1)-Math.max(rack.service.x0,door.x0)-.02)<1e-8,'The disclosed shared service width matches the modeled door envelope');
console.log('Utility rack placement: east heat-pump wall, board below, bodies clear; service/door-swing coordination remains');
if(process.env.UTILITY_RACK_BROWSER==='1'){
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const url=new URL(process.env.INTERIOR_URL??'http://127.0.0.1:8765/interior.html');
    url.hash='house-utilityRack';
    await page.goto(url.href,{waitUntil:'networkidle'});
    const report=await page.evaluate(async()=>{
      const THREE=await import('three'),house=DEBUG.hou,fit=DEBUG.utilityFitout;
      house.root.updateMatrixWorld(true);
      const rack=fit.group.getObjectByName('UniFi 12U wall rack'),box=new THREE.Box3().setFromObject(rack);
      const min=house.root.worldToLocal(box.min.clone()),max=house.root.worldToLocal(box.max.clone());
      const origin=house.root.localToWorld(new THREE.Vector3(9.10,house.dims.floorY+1.98,16.34));
      const hit=new THREE.Raycaster(origin,new THREE.Vector3(1,0,0)).intersectObject(rack,true)[0];
      return{min:min.toArray(),max:max.toArray(),glassFacingRoom:hit?.object.name==='rack_door_glass',visible:rack.visible};
    });
    assert(report.visible&&report.glassFacingRoom);
    assert(report.min[0]>=9.715&&report.max[0]<=10.331);
    assert(Math.abs(report.min[2]-15.85)<1e-5&&Math.abs(report.max[2]-16.448)<1e-5);
    assert(Math.abs(report.max[1]-2.22)<1e-5,'Rendered rack top leaves 300 mm below the 2.52 m ceiling');
    assert.deepEqual(errors,[]);
    await page.screenshot({path:'/tmp/utility-rack-east-wall.png'});
    console.log('Utility rack browser checks passed: east-wall geometry and glass door face into room, no runtime errors.');
  }finally{await browser.close();}
}
