const materials = {
  cashmere: {color:'#b8b2a7',roughness:.68}, white: {color:'#f3f2ed',roughness:.64},
  shadow: {color:'#393b38',roughness:.75}, metal: {color:'#505450',roughness:.32,metalness:.65},
  mirror: {color:'#cfdde6',roughness:.08,metalness:.3}, cushion: {color:'#aaa697',roughness:.96},
  keyMetal: {color:'#c5c8c8',roughness:.3,metalness:.7}, screen: {color:'#162e35',roughness:.14,emissive:'#284953',emissiveIntensity:.28},
  indicator: {color:'#a9d6c1',roughness:.3,emissive:'#91cbb1',emissiveIntensity:.35},
};

export function prepareEntranceData(data) {
  const placeholders=new Set(['vstup front nízký','vstup front střední','vstup front vysoký','vstup skříň 470+750','zrcadlo vstup']);
  return {...data,furniture:data.furniture.filter(f=>f.room!=='1.01'||!placeholders.has(f.label))};
}

export function buildEntranceInterior(data) {
  const parts=[], s=data.stairs, waist=s.waist??.18;
  const soffit=x=>(x-s.x0)/(s.x1-s.x0)*s.steps*s.rise-waist;
  const box=(name,x,z,y,w,d,h,material='cashmere',bevel=.001)=>parts.push({name,type:'box',position:[x+w/2,z+d/2,y+h/2],size:[w,d,h],material,bevel,category:'furniture'});
  const prism=(name,x0,x1,z0,z1,y0,h0,h1,material)=>{
    const vertices=[[x0,z0,y0],[x1,z0,y0],[x1,z0,h1],[x0,z0,h0],[x0,z1,y0],[x1,z1,y0],[x1,z1,h1],[x0,z1,h0]];
    parts.push({name,type:'mesh',vertices,faces:[[1,2,3,0],[7,6,5,4],[4,5,1,0],[5,6,2,1],[6,7,3,2],[7,4,0,3]],material,category:'furniture',smooth:false});
  };
  const boundaries=[6.08,6.55,7.19,7.83,s.x1];
  for(let i=0;i<boundaries.length-1;i++){
    const x0=boundaries[i]+.002,x1=boundaries[i+1]-.002,h0=soffit(x0)-.025,h1=soffit(x1)-.025;
    prism(`entrance_sloped_front_${i}`,x0,x1,s.z1-.022,s.z1,.055,h0,h1,'cashmere');
    prism(`entrance_white_back_${i}`,x0,x1,s.z1-.59,s.z1-.578,.055,h0,h1,'white');
    for(const[j,x]of[x0,x1-.018].entries())prism(`entrance_white_side_${i}_${j}`,x,x+.018,s.z1-.578,s.z1-.024,.055,soffit(x)-.045,soffit(x+.018)-.045,'white');
    box(`entrance_bottom_${i}`,x0,s.z1-.578,.055,x1-x0,.554,.018,'white');
    for(let y=.30,j=0;y<h0-.06;y+=.25,j++)box(`entrance_shoe_shelf_${i}_${j}`,x0+.018,s.z1-.578,y,x1-x0-.036,.535,.018,'white');
    box(`entrance_recessed_plinth_${i}`,x0,s.z1-.07,.004,x1-x0,.025,.05,'shadow');
  }
  const x=s.x1,z=s.z1-.6,w=9.65-x;
  box('entrance_tall_back',x,z,.055,w,.018,2.44,'white');
  for(const[i,px]of[x,x+.47-.009,x+w-.018].entries())box(`entrance_tall_side_${i}`,px,z+.018,i===0?.055:.004,.018,.56,i===0?2.44:2.491,i===0?'white':'cashmere');
  for(const[i,y]of[.055,1.985,2.482].entries())box(`entrance_tall_shelf_${i}`,x,z+.018,y,i===0?.47:w,.56,.018,'white');
  box('entrance_tall_plinth',x,z+.52,.004,.47,.035,.05,'shadow');
  box('entrance_coat_door',x+.002,s.z1-.02,.058,.466,.02,1.925);
  box('entrance_full_length_mirror',x+.483,z+.019,.48,w-.505,.004,1.50,'mirror',.001);
  for(const[i,px]of[x+.002,x+.472].entries())box(`entrance_upper_door_${i}`,px,s.z1-.02,1.988,i===0?.466:w-.474,.02,.510);
  box('entrance_coat_rail',x+.035,z+.285,1.80,.40,.022,.022,'metal',.009);

  const seat={x0:x+.479,x1:9.632,z0:z+.028,z1:s.z1-.002};
  const seatWidth=seat.x1-seat.x0,seatDepth=seat.z1-seat.z0;
  box('entrance_seat_drawer_front',seat.x0+.002,seat.z1-.020,.280,seatWidth-.004,.020,.113);
  box('entrance_seat_drawer_bottom',seat.x0+.015,seat.z0+.02,.286,seatWidth-.03,seatDepth-.052,.012,'white');
  for(const[i,px]of[seat.x0+.015,seat.x1-.027].entries())box(`entrance_seat_drawer_side_${i}`,px,seat.z0+.02,.298,.012,seatDepth-.052,.084,'white');
  box('entrance_seat_top',seat.x0,seat.z0,.395,seatWidth,seatDepth,.025);
  box('entrance_seat_cushion',seat.x0+.012,seat.z0+.010,.420,seatWidth-.024,seatDepth-.022,.050,'cushion',.015);
  const keyRail={x0:9.625,x1:9.644,z0:15.44,z1:15.51};
  box('entrance_key_rail',keyRail.x0,keyRail.z0,1.04,.019,.07,.22,'metal',.004);
  for(let i=0;i<2;i++){
    const py=1.095+i*.115;
    box(`entrance_key_hook_stem_${i}`,9.590,15.466,py,.035,.018,.018,'metal',.006);
    box(`entrance_key_hook_tip_${i}`,9.581,15.466,py,.018,.018,.035,'metal',.006);
    box(`entrance_key_bow_${i}`,9.576,15.464,py-.003,.004,.022,.016,'keyMetal',.006);
    box(`entrance_key_blade_${i}`,9.576,15.472,py-.032,.004,.006,.03,'keyMetal',.001);
    for(let j=0;j<2;j++)box(`entrance_key_tooth_${i}_${j}`,9.576,15.475,py-.028+j*.010,.004,.008,.004,'keyMetal',.001);
  }
  const intercom={width:.072,height:.135,depth:.0318,centerHeight:1.40,zCenter:15.50,provisional:true};
  box('entrance_intercom_body',9.65-intercom.depth,15.464,1.3325,intercom.depth,.072,.135,'white',.006);
  box('entrance_intercom_screen',9.6172,15.469,1.3425,.001,.062,.115,'screen',.002);
  box('entrance_intercom_call_icon',9.6160,15.489,1.356,.001,.018,.007,'indicator',.003);
  for(let i=0;i<3;i++)box(`entrance_intercom_status_${i}`,9.6160,15.479,1.418+i*.009,.001,.040-i*.007,.003,'white',.001);
  box('entrance_coat_shelf',7.02,15.325,1.85,.82,.20,.025);
  box('entrance_coat_hook_panel',7.025,15.525,1.18,.81,.018,.67);
  for(let i=0;i<3;i++){
    const px=7.16+i*.27,py=i===1?1.30:1.70;
    box(`entrance_coat_hook_stem_${i}`,px,15.47,py,.018,.055,.018,'metal',.006);
    box(`entrance_coat_hook_tip_${i}`,px,15.46,py,.018,.018,.045,'metal',.006);
  }
  return {model:{name:'Entrance fitted storage',materials,parts,lights:[]},seat,keyRail,intercom,soffit,
    notes:[
      'Cashmere U702 ST9 visible fronts and white internal boards follow the furniture schedule. Colours are indicative.',
      'Sloping closed fronts and shoe shelves follow the entrance drawing. Module widths are fitted to the current stair model, not a fabrication drawing.',
      'The mirror is at the back of the bench niche, with a drawer directly below the seat and an open niche down to the continuous vinyl floor underneath. Drawer height is provisional. The compact key rail is on the solid entrance-door wall return.',
      'A shallow shelf and three coat hooks occupy the opposite wall between the bathroom and utility doors, without another bench. Their 820mm width, 200mm shelf depth and mounting heights are a layout proposal.',
      'UniFi Intercom Viewer is shown as an option, not an ordered device: 135×72×31.8mm, centered at the documented 1400mm height and 150mm from the entrance jamb. Key hooks sit below it; final wall positions need coordination.',
      'The stair soffit ends below the 2500mm wardrobe top; this junction needs coordination with the joiner.',
    ],presets:{entrance:{position:[6.60,1.63,15.20],target:[7.85,1.10,13.96]},entranceSeat:{position:[8.20,1.55,15.12],target:[9.15,1.04,13.53]},entranceCoats:{position:[5.45,1.63,14.55],target:[7.40,1.35,15.44]},entranceControls:{position:[9.02,1.43,15.12],target:[9.64,1.32,15.48]}}};
}

export function attachEntranceInterior(THREE,house,data,{buildModel}) {
  const result=buildEntranceInterior(data),group=new THREE.Group();
  group.name='Entrance fitted storage';
  group.add(buildModel(THREE,{...result.model,floorHeight:house.dims.floorY}));
  house.furniture.add(group);
  return {...result,group};
}
