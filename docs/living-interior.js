import {buildHoxterH60} from '../hoxter-stove-model.js';
import {houseFlue} from '../house-chimney.js';
import {buildRavakFreedomWall} from '../ravak-freedom-model.js';
import {buildStairFlight} from '../stair-flight-model.js';
import {attachHouseFlooring} from './house-flooring.js';
import {buildNightstands} from './nightstand-model.js?v=54a7475cad4e';
import {buildCoronaBed} from '../corona-bed-model.js';
import {buildDressingRoom} from './dressing-model.js';
import {prepareUtilityJoinery} from './utility-joinery.js';
import {buildShowerFittings} from './shower-fittings.js';
import {buildCoffeeNicheUpper} from './coffee-niche.js';

export const finishColors={wall:'#ddd1be',ceiling:'#ddd1be'};

function kitchenRun(data) {
  const base=data.furniture.find(f=>f.label.startsWith('kuchyň base run'));
  const center=index=>base.x0+base.modules.slice(0,index).reduce((sum,width)=>sum+width,0)+base.modules[index]/2;
  return {base,sinkX:center(1),hobX:center(3)};
}

function joineryFinish(f) {
  if(f.kind==='slab'&&f.mat==='mirror'&&f.room==='1.10')return {...f,z0:f.z0-.025,z1:f.z1-.025,ledStandOff:.025};
  if(f.kind==='slab'&&f.mat==='mirror'&&f.room==='1.03')return {...f,x0:f.x0-.025,x1:f.x1-.025,ledStandOff:.025};
  if(f.kind==='cab') {
    const front={ '1.01':'cashmere', '1.02':'greenMatt', '1.03':'cashmere', '1.04':'cashmere', chod04:'cashmere',
      '1.06':'green', nika:'green', '1.07':'whiteBoard', '1.10':'cashmere', '1.11':'whiteBoard', '1.12':'cashmere' }[f.room];
    if(!front)return f;
    const worktop=['1.02','1.06','nika'].includes(f.room)?'cashmereTop':front;
    return {...f,fmat:front,cmat:front,imat:'whiteBoard',wmat:f.worktop?worktop:front};
  }
  if(f.kind==='slab'&&f.room==='1.01'&&f.label.startsWith('vstup front'))return {...f,mat:'cashmere'};
  return f;
}

export function prepareLivingData(data) {
  for(const label of ['kuchyň base run','dřez Blanco PLEON 5','varná deska Siemens']){
    if(!data.furniture.some(f=>f.label.startsWith(label)))throw new Error(`Missing kitchen fixture: ${label}`);
  }
  return {...data,coffeeNicheUpper:data.furniture.find(f=>f.label==='nika uppers'),bedroomBed:data.furniture.find(f=>f.kind==='bed'&&f.room==='1.12'),buildStairs:()=>buildStairFlight(data.stairs),buildFireplace:()=>{
    const model=buildHoxterH60(),f=data.fireplace,flue=houseFlue(data),cx=flue.x;
    const place=([x,z,y])=>[x+cx,z+f.z1-.65,y+.007];
    const chimney=[
      {name:'visible_flue',type:'cylinder',position:[cx,flue.z,(flue.bottom+flue.interiorTop)/2],radiusTop:flue.radius,radiusBottom:flue.radius,height:flue.interiorTop-flue.bottom,axis:'z',segments:48,material:'steel',category:'structure'},
      {name:'flue_collar',type:'cylinder',position:[cx,f.z1-.21,1.990],radiusTop:.099,radiusBottom:.099,height:.03,axis:'z',segments:48,material:'steel',category:'structure'},
    ];
    return {...model,parts:[...model.parts.map(p=>{
      const part={...p};
      for(const key of ['position','start','end'])if(p[key])part[key]=place(p[key]);
      if(p.vertices)part.vertices=p.vertices.map(place);
      return part;
    }),...chimney]};
  }, furniture:data.furniture.flatMap(f=>{
    if(f.kind==='bed'&&f.room==='1.12')return [];
    if(f.room==='1.11'&&f.kind==='cab')return [];
    if(['1.12','1.04'].includes(f.room)&&f.label.startsWith('noční stolek'))return [];
    if(f.type==='bath'&&f.room==='1.10')return [];
    if(f.room!=='1.06'&&f.room!=='nika')return [f];
    if(f.kind==='cab'&&f.label.startsWith('TV stolek'))return [{...f,fmat:'green',cmat:'green',wmat:'green',handle:'push'}];
    if(f.room==='nika'&&['nika back panel','nika uppers'].includes(f.label))return [];
    if(f.label==='dřez Blanco PLEON 5'||f.label==='varná deska Siemens')return [];
    if(f.kind==='cab'&&f.label.startsWith('kuchyň roh filler'))return [{...f,h:.872}];
    if(f.kind!=='cab'||f.fmat!=='green')return [f];
    const next={...f,cmat:'green',handle:f.label.startsWith('ostrov')?'push':'gola'};
    if(f.label==='nika base')next.h=.910-f.worktop;
    if(f.label.startsWith('kuchyň base run')||f.label.startsWith('kuchyň L-leg'))next.h=.910-f.worktop.th;
    if(f.label.startsWith('ostrov')){
      next.h=.910-f.worktop.th;
      next.worktop={...f.worktop,x0:f.x0,x1:f.x1,z0:f.z0};
    }
    if(typeof f.worktop==='number')next.wmat='stone';
    if(f.y0>0)next.golaEdge='bottom';
    if(f.label.startsWith('kuchyň base run')){
      next.tags=[...f.tags];next.tags[1]='s';next.tags[3]='a';
      next.appliances=f.modules.map((_,i)=>i===3?'oven':null);
      const {sinkX}=kitchenRun(data);
      next.worktop={...f.worktop,cutouts:[{x0:sinkX-.255,z0:4.34,x1:sinkX+.255,z1:4.73}]};
    }
    return [next];
  }).map(f=>f.kind==='cab'&&['1.06','nika'].includes(f.room)&&!f.y0&&!f.label.startsWith('TV')?{...f,plinth:.125}:f).map(prepareUtilityJoinery).map(joineryFinish)};
}

export function attachLivingInterior(THREE,house,data,{buildModel,applyChampagneFloor,renderer}) {
  const seatingShift=.90;
  const parts=[], materials={
    upholstery:{color:'#c6b9a7',roughness:.98},piping:{color:'#ab9c89',roughness:1},
    cushion:{color:'#8b9d91',roughness:.97},clay:{color:'#ab7c67',roughness:.94},
    dark:{color:'#202624',roughness:.5},metal:{color:'#777e7b',metalness:.9,roughness:.24},tapGraphite:{color:'#404746',metalness:.85,roughness:.27},
    glass:{color:'#101b20',roughness:.12,metalness:.22},whiteGlass:{color:'#f5f5f2',roughness:.08,metalness:.04},ceramic:{color:'#ece6d9',roughness:.3},
    rug:{color:'#b9ad97',roughness:1},oak:{color:'#bba181',roughness:.8},tableStone:{color:'#c5bca9',roughness:.84},
    diffuser:{color:'#fff0d9',emissive:'#ffe2b1',emissiveIntensity:1.5,roughness:.5},
    sink:{color:'#827565',roughness:.74},water:{color:'#19201e',roughness:.2},
  };
  const box=(name,x,z,y,w,d,h,material,bevel=.003)=>parts.push({name,type:'box',position:[x+w/2,z+d/2,y+h/2],size:[w,d,h],material,bevel,category:'furniture'});
  const cylinder=(name,x,z,y,r,h,material,axis='z')=>parts.push({name,type:'cylinder',position:[x,z,y],radiusTop:r,radiusBottom:r,height:h,segments:32,axis,material,category:'furniture'});
  box('living_rug',5.52,9.26,.004,3.22,2.35,.009,'rug',.035);
  for(const [i,x]of[5.70,8.30].entries())for(const[j,z]of[9.51,10.38].entries())box(`sofa_foot_${i}_${j}`,x,z,.013,.07,.07,.105,'dark');
  box('sofa_base',5.60,9.43,.10,3,1.10,.23,'upholstery',.065);
  box('sofa_back',5.63,9.42,.30,2.94,.23,.53,'upholstery',.085);
  for(const[i,x]of[5.60,8.40].entries())box(`sofa_arm_${i}`,x,9.47,.30,.20,1.02,.33,'upholstery',.07);
  for(let i=0;i<3;i++){
    const x=5.82+i*.855;
    box(`sofa_seat_piping_${i}`,x,9.69,.328,.835,.80,.009,'piping',.045);
    box(`sofa_seat_${i}`,x,9.69,.336,.835,.80,.145,'upholstery',.055);
    box(`sofa_back_cushion_${i}`,x,9.61,.485,.835,.19,.36,'upholstery',.07);
  }
  box('cuddle_ottoman_base',7.10,10.55,.105,1.50,1.10,.22,'upholstery',.06);
  box('cuddle_ottoman_cushion',7.10,10.55,.335,1.50,1.10,.146,'upholstery',.055);
  for(const[i,x]of[7.21,8.41].entries())for(const[j,z]of[10.65,11.47].entries())box(`ottoman_foot_${i}_${j}`,x,z,.013,.07,.07,.095,'dark');
  box('sofa_sage_pillow',5.90,9.78,.49,.44,.18,.36,'cushion',.10);
  box('sofa_clay_pillow',8.00,9.80,.49,.35,.17,.33,'clay',.085);
  box('coffee_table_top',5.65,10.92,.305,.88,.58,.055,'tableStone',.12);
  box('coffee_table_base',5.82,11.04,.013,.54,.34,.292,'tableStone',.085);
  for(const part of parts)part.position[0]+=seatingShift;

  for(const[i,x]of[6.33,7.01,7.69].entries()){
    box(`bar_stool_${i}_seat`,x-.22,6.855,.595,.44,.43,.065,'cushion',.065);
    box(`bar_stool_${i}_back`,x-.22,7.22,.64,.44,.065,.24,'cushion',.05);
    for(const[j,dx]of[-.17,.17].entries())for(const[k,z]of[6.91,7.25].entries()){
      cylinder(`bar_stool_${i}_leg_${j}_${k}`,x+dx,z,.30,.012,.60,'dark');
      cylinder(`bar_stool_${i}_glide_${j}_${k}`,x+dx,z,.006,.016,.012,'dark');
    }
    cylinder(`bar_stool_${i}_footrest`,x,6.91,.23,.010,.34,'dark','x');
    for(const[j,dx]of[-.17,.17].entries())cylinder(`bar_stool_${i}_brace_${j}`,x+dx,7.08,.23,.010,.34,'dark','y');
  }

  box('dining_table_top',6.20,7.87,.72,1.80,.90,.035,'oak',.025);
  for(const[i,x]of[6.32,7.82].entries())for(const[j,z]of[7.99,8.59].entries())box(`dining_table_leg_${i}_${j}`,x,z,.004,.055,.055,.716,'dark',.012);
  const diningChairs=[6.5,7.1,7.7].flatMap(x=>[[x,7.60,Math.PI],[x,9.04,0]]);
  for(const[i,[cx,cz,angle]]of diningChairs.entries()){
    const first=parts.length;
    box(`dining_chair_${i}_seat`,-.22,-.225,.43,.44,.45,.055,'cushion',.07);
    box(`dining_chair_${i}_back`,-.22,.17,.47,.44,.065,.33,'cushion',.055);
    for(const[j,x]of[-.17,.17].entries())for(const[k,z]of[-.17,.17].entries())cylinder(`dining_chair_${i}_leg_${j}_${k}`,x,z,.22,.012,.44,'dark');
    for(const p of parts.slice(first)){
      const[x,z,y]=p.position;p.position=[cx+x*Math.cos(angle)-z*Math.sin(angle),cz+x*Math.sin(angle)+z*Math.cos(angle),y];
      if(p.type==='box'&&Math.abs(Math.sin(angle))>.5)[p.size[0],p.size[1]]=[p.size[1],p.size[0]];
    }
  }

  const {base,sinkX,hobX}=kitchenRun(data);
  box('kitchen_white_glass_backsplash',base.worktop.x0,4.200,.910,base.worktop.x1-base.worktop.x0,.006,.540,'whiteGlass',.001);
  box('niche_white_glass_backsplash',4.10,7.10,.910,.025,1.20,.550,'whiteGlass',.001);
  box('sink_bottom',sinkX-.235,4.36,.708,.47,.35,.018,'sink');
  box('sink_north',sinkX-.255,4.34,.708,.51,.02,.20,'sink');
  box('sink_south',sinkX-.255,4.71,.708,.51,.02,.20,'sink');
  box('sink_west',sinkX-.255,4.36,.708,.02,.35,.20,'sink');
  box('sink_east',sinkX+.235,4.36,.708,.02,.35,.20,'sink');
  cylinder('sink_drain',sinkX,4.535,.728,.039,.004,'metal');
  cylinder('sink_drain_dark',sinkX,4.535,.731,.027,.003,'dark');
  cylinder('tap_foot',sinkX,4.265,.916,.025,.017,'tapGraphite');
  cylinder('tap_riser',sinkX,4.265,1.052,.014,.26,'tapGraphite');
  cylinder('tap_spout',sinkX,4.375,1.182,.014,.22,'tapGraphite','y');
  cylinder('tap_outlet',sinkX,4.48,1.164,.016,.04,'tapGraphite');
  cylinder('tap_lever',sinkX+.045,4.265,1.022,.008,.07,'tapGraphite');
  box('hob_glass',hobX-.28,4.32,.911,.56,.43,.009,'glass',.006);
  for(const[i,x]of[hobX-.145,hobX+.145].entries())for(const[j,z]of[4.43,4.64].entries()){
    cylinder(`hob_ring_${i}_${j}`,x,z,.921,.080,.001,'metal');
    cylinder(`hob_zone_${i}_${j}`,x,z,.922,.078,.001,'glass');
  }
  for(let i=0;i<5;i++)box(`hob_touch_${i}`,hobX-.13+i*.045,4.727,.923,.016,.006,.001,'metal',0);
  box('coffee_machine_body',4.23,7.27,.910,.31,.26,.34,'dark',.024);
  box('coffee_machine_front',4.53,7.28,.931,.012,.24,.27,'metal',.008);
  box('coffee_machine_tray',4.52,7.285,.927,.10,.23,.012,'dark',.007);
  cylinder('coffee_cup',4.575,7.40,.977,.031,.075,'ceramic');
  box('coffee_machine_screen',4.544,7.32,1.152,.005,.10,.039,'glass');

  const group=buildModel(THREE,{name:'Living and kitchen detail',floorHeight:house.dims.floorY,materials,parts,lights:[]});
  house.furniture.add(group);
  const coffeeNicheModel=buildCoffeeNicheUpper(data),coffeeNiche=buildModel(THREE,{...coffeeNicheModel,floorHeight:house.dims.floorY});
  house.furniture.add(coffeeNiche);
  const nightstandModel=buildNightstands(data),nightstands=buildModel(THREE,{...nightstandModel,floorHeight:house.dims.floorY});
  house.furniture.add(nightstands);
  const bedData=data.furniture.find(f=>f.kind==='bed'&&f.room==='1.12');
  const bedModel=buildCoronaBed(bedData),bed=buildModel(THREE,{...bedModel,floorHeight:house.dims.floorY});
  house.furniture.add(bed);
  const dressingModel=buildDressingRoom(data),dressing=buildModel(THREE,{...dressingModel,floorHeight:house.dims.floorY});
  house.furniture.add(dressing);
  const showerModel=buildShowerFittings(data),showers=buildModel(THREE,{...showerModel,floorHeight:house.dims.floorY});
  house.furniture.add(showers);
  group.userData.proposal='Sofa and ottoman are a layout study, not selected products; fireplace clearances need verification. Dining table size is provisional: 180 × 90 cm. Six chairs, three per long side, no end chairs. Joinery follows the selected U665/U702 palette; screen colours and surface textures are approximations. Vanity tops provisionally match their fronts. Cathedral ceiling is a section-based provisional volume, not an as-built survey.';
  const flooring=attachHouseFlooring(THREE,house,data,{buildModel,renderer,applyChampagneFloor});
  const hearthCenter=(data.fireplace.x0+data.fireplace.x1)/2,hearthBack=data.fireplace.z1;
  const hearthShape=new THREE.Shape();
  hearthShape.moveTo(hearthCenter-.5,-hearthBack);hearthShape.lineTo(hearthCenter+.5,-hearthBack);
  hearthShape.lineTo(hearthCenter+.5,-hearthBack+1.15);hearthShape.lineTo(hearthCenter-.5,-hearthBack+1.15);hearthShape.closePath();
  const airHole=new THREE.Path();airHole.absarc(hearthCenter,-hearthBack+.246,.10,0,Math.PI*2,true);hearthShape.holes.push(airHole);
  const hearthGeometry=new THREE.ExtrudeGeometry(hearthShape,{depth:.006,bevelEnabled:false,curveSegments:48});hearthGeometry.rotateX(-Math.PI/2);
  const hearth=new THREE.Mesh(hearthGeometry,new THREE.MeshStandardMaterial({color:'#101112',roughness:.78,metalness:.35}));
  hearth.name='Black steel hearth plate';hearth.position.y=house.dims.floorY+.001;hearth.receiveShadow=true;hearth.castShadow=true;
  hearth.userData.dimensions={width:1,depth:1.15,thickness:.006,airHoleDiameter:.2};house.floor.add(hearth);
  const bathFixture=data.furniture.find(f=>f.type==='bath'&&f.room==='1.10');
  const bathModel=buildRavakFreedomWall({floorHeight:house.dims.floorY});
  const bathtub=buildModel(THREE,bathModel);bathtub.position.x=bathFixture.x0;bathtub.position.z=bathFixture.z0;
  const graphite=new THREE.MeshStandardMaterial({color:'#404746',metalness:.85,roughness:.27});
  const fitting=(name,x,z,y,r,h)=>{
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,32),graphite);
    mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;bathtub.add(mesh);return mesh;
  };
  for(const[i,z]of[.40,.68,.96,1.20].entries())fitting(`bath_deck_rosette_${i}`,.745,z,.570,.028,.010);
  fitting('bath_mixer',.745,.40,.605,.023,.06);
  const lever=new THREE.Mesh(new THREE.BoxGeometry(.012,.012,.08),graphite);lever.position.set(.745,.643,.425);bathtub.add(lever);
  const spoutCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(.745,.575,.68),new THREE.Vector3(.745,.73,.68),new THREE.Vector3(.72,.76,.68),new THREE.Vector3(.57,.76,.68),new THREE.Vector3(.55,.735,.68)]);
  const spout=new THREE.Mesh(new THREE.TubeGeometry(spoutCurve,32,.013,12,false),graphite);spout.name='bath_spout';spout.castShadow=true;bathtub.add(spout);
  fitting('bath_diverter',.745,.96,.600,.012,.05);
  fitting('bath_hand_shower',.745,1.20,.660,.014,.18);
  house.furniture.add(bathtub);
  const ceilingFinish=new THREE.Group();ceilingFinish.name='Living exposed board ceiling';
  const timber=new THREE.MeshStandardMaterial({color:'#d7bd94',roughness:.9,side:THREE.DoubleSide});
  const panel=(x0,x1,z0,z1,y0,y1)=>{
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([x0,y0,z0,x1,y1,z0,x1,y1,z1,x0,y0,z0,x1,y1,z1,x0,y0,z1],3));
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,timber);mesh.receiveShadow=true;ceilingFinish.add(mesh);
  };
  const livingRoom=data.rooms.find(r=>r.id==='1.06');
  for(let z=livingRoom.z0;z<7;z+=.625)panel(livingRoom.x0,livingRoom.x1,z,Math.min(z+.623,7),2.515,2.515);
  ceilingFinish.position.y=house.dims.floorY;house.ceiling.add(ceilingFinish);
  return {group,flooring,parts,bathtub,bathModel,hearth,nightstands,nightstandModel,showers,showerModel,coffeeNiche,coffeeNicheModel,proposal:group.userData.proposal,presets:{
    ...showerModel.presets,
    overview:{position:[5.05,2.3,8.9],target:[7.35,.75,10.9]},
    living:{position:[7.55+seatingShift,1.12,9.94],target:[8.35,1.05,12.72]},
    kitchen:{position:[7.9,1.62,8.85],target:[7.8,1.15,4.35]},
    garden:{position:[7.55+seatingShift,1.12,9.94],target:[10.2,1.05,10.8]},
    bathroom:{position:[1.7,1.60,2.65],target:[2.75,.45,1.35]},
    mirror:{position:[1.65,1.60,2.65],target:[2.18,1.48,3.94]},
    bedroom:{position:[8.8,1.65,3.2],target:[8.1,.95,1.2]},
    windowSeat:{position:[7.4,1.65,3.2],target:[10.15,1.22,2.2]},
    guest:{position:[1.5,1.7,16],target:[4.5,1.2,17.25]},
    dining:{position:[5.25,1.65,8.45],target:[7.1,.75,8.32]},
    stairs:{position:[9.35,1.20,15.1],target:[7.1,1.35,13.5]},
  }};
}
