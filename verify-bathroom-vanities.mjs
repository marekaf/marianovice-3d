import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareLivingData} from './docs/living-interior.js';
const require=createRequire(import.meta.url);
const {HOUSE_INTERIOR:data}=require('./house-interior.js');
const {FurnitureModel}=require('./furniture-model.js');
const close=(a,b,label)=>assert(Math.abs(a-b)<1e-9,label);
for(const [room,width,columns] of [['1.10',1.65,2],['1.03',1,1]]) {
  const furniture=prepareLivingData(data).furniture;
  const cabinet=furniture.find(f=>f.kind==='cab'&&f.room===room);
  const basin=furniture.find(f=>f.type==='basin'&&f.room===room);
  close(cabinet.h,.5,'Vanity body is 500 mm');
  assert.equal(cabinet.handle,'gola-c','Opening mechanism is explicit');
  assert.deepEqual(cabinet.drawerRows,[.25,.25]);
  assert.deepEqual(cabinet.modules,room==='1.10'?[.825,.825]:[1]);
  close(cabinet.front==='N'?cabinet.x1-cabinet.x0:cabinet.z1-cabinet.z0,width,'Vanity width');
  const model=FurnitureModel.build([cabinet]);
  const fronts=model.parts.filter(p=>/^fixture_0_front_/.test(p.name));
  assert.equal(fronts.length,columns*2,'Two drawer rows in each column');
  assert.equal(new Set(fronts.map(p=>p.position[2])).size,2,'Two distinct drawer heights');
  const alongAxis=cabinet.front==='N'?0:1;
  assert.deepEqual([...new Set(fronts.map(p=>Number(p.position[alongAxis].toFixed(4))))],room==='1.10'?[1.7625,2.5875]:[17.525],'Column centers');
  for(const front of fronts) {
    close(front.size[alongAxis],room==='1.10'?.815:.99,'Front width allows edge reveals');
    close(front.size[2],.225,'Front height allows central grip and edge reveals');
    assert(front.material==='cashmere','Cashmere drawer faces');
    assert([.4175,.6825].some(height=>Math.abs(front.position[2]-height)<1e-9),'Rows straddle nominal 550 mm split');
  }
  assert.equal(model.parts.filter(p=>p.name.includes('_inner_front_')&&p.material==='whiteBoard').length,columns*2,'White drawer backs');
  assert.equal(model.parts.filter(p=>p.name.includes('_pull')).length,0,'No projecting pulls');
  const top=model.parts.find(p=>p.name.endsWith('_worktop'));
  close(top.position[2]+top.size[2]/2,basin.y0,'Worktop meets fixed basin base');
  const channel=model.parts.filter(p=>p.name.includes('_golaC_'));
  assert.equal(channel.length,3,'Recessed C channel has back and two flanges');
  assert(channel.every(p=>model.materials[p.material].color==='#f3f2ed'),'White Gola profile');
  const depthAxis=cabinet.front==='N'?1:0;
  const edge=cabinet.front==='N'?cabinet.z0:cabinet.x0;
  assert(channel.every(p=>p.position[depthAxis]-p.size[depthAxis]/2>=edge),'Profile stays behind front edge');
  const cavity=[cabinet.x0+cabinet.modules[0]/2,cabinet.z0+.015,.55];
  if(cabinet.front==='W') {cavity[0]=cabinet.x0+.015;cavity[1]=cabinet.z0+.5;}
  assert(!model.parts.some(p=>p.type==='box'&&p.position.every((v,i)=>Math.abs(v-cavity[i])<p.size[i]/2-1e-9)),'Central grip cavity is not filled by shelf or solid bar');
  if(room==='1.10') {
    cavity[0]=2.175;
    assert(!model.parts.some(p=>p.type==='box'&&p.position.every((v,i)=>Math.abs(v-cavity[i])<p.size[i]/2-1e-9)),'Grip cavity also clears central divider');
  }
  const overlaps=(a,b)=>a.position.every((v,i)=>Math.abs(v-b.position[i])<(a.size[i]+b.size[i])/2-1e-9);
  for(const profile of channel) assert(!model.parts.filter(p=>p.type==='box'&&!channel.includes(p)).some(p=>overlaps(p,profile)),'Channel clears carcass and fronts');
  close(basin.y0,.838,'Basin elevation stays fixed');
  if(room==='1.03') {
    assert.deepEqual([cabinet.x0,cabinet.x1,cabinet.z0,cabinet.z1],[6.7,7.2,17.025,18.025]);
    close((cabinet.z0+cabinet.z1)/2,(basin.z0+basin.z1)/2,'Guest vanity centered on fixed basin');
    const wc=furniture.find(f=>f.room===room&&f.type==='wc');
    const radiator=furniture.find(f=>f.room===room&&f.label.startsWith('radiátor'));
    close(wc.z0-cabinet.z1,.14,'Vanity to WC clearance retained');
    close(cabinet.z0-radiator.z1,.175,'Vanity to radiator clearance retained');
    close(top.position[0]-top.size[0]/2-5.9,.78,'Guest passage beside worktop');
  }
}
console.log('Bathroom vanity dimensions, drawer grids, profiles and basin contact pass');
