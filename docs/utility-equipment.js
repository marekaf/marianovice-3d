import { buildUtilityJoinery } from './utility-joinery.js';

const materials = {
  white: { color: '#e8e9e5', roughness: .48 }, dark: { color: '#242a2c', roughness: .55 },
  metal: { color: '#a5adad', metalness: .82, roughness: .32 },
  glass: { color: '#d8e2df', transmission: .92, roughness: .035 },
  screen: { color: '#14272c', roughness: .2, emissive: '#24515c', emissiveIntensity: .18 },
  blue: { color: '#498aa1', roughness: .65 }, duct: { color: '#7e8586', metalness: .45, roughness: .67 },
};

export function buildUtilityEquipment(data) {
  const room = data.rooms.find(r => r.id === '1.02');
  const models = [], equipment = [];
  let current;
  const start = (name, bounds, details) => {
    current = { name, floorHeight: 0, materials, parts: [], lights: [] };
    models.push(current);
    equipment.push({ name, bounds, ...details });
  };
  const box = (name, x, z, y, w, d, h, material = 'white', bevel = .003) => current.parts.push({
    name, type: 'box', position: [x+w/2,z+d/2,y+h/2], size: [w,d,h], material, bevel, category: 'furniture' });
  const cylinder = (name, x, z, y, radius, height, material = 'metal', axis = 'z') => current.parts.push({
    name, type: 'cylinder', position: [x,z,y], radiusTop: radius, radiusBottom: radius, height, axis,
    segments: 32, material, category: 'furniture' });

  const hx = room.x1-.65, hz = room.z1-.70;
  start('Bosch Compress indoor tower', {x0:hx,z0:hz,x1:hx+.6,z1:hz+.6,y0:0,y1:1.787},
    { product:'CS5800iAW 12 M', tankLitres:170.7, service:{x0:hx-.8,z0:hz-.05,x1:hx,z1:hz+.65}, topClearance:.4 });
  box('heat_pump_feet',hx+.035,hz+.035,0,.53,.53,.023,'dark');
  box('heat_pump_body',hx,hz,.018,.6,.6,1.769,'white',.018);
  box('heat_pump_panel_joint',hx-.001,hz+.015,.572,.003,.57,.002,'dark',0);
  cylinder('heat_pump_control_bezel',hx-.003,hz+.3,1.50,.056,.012,'metal','x');
  cylinder('heat_pump_round_display',hx-.010,hz+.3,1.50,.049,.004,'screen','x');
  for (let i=0;i<4;i++) {
    cylinder(`heat_pump_pipe_${i}`,hx+.49,hz+.10+i*.12,1.925,.014,.276,'metal');
    cylinder(`heat_pump_union_${i}`,hx+.49,hz+.10+i*.12,1.84,.020,.026,'metal');
  }

  const vx = room.x1-.645, vz = room.z0+1.12, vy = 1.24;
  start('Bosch Vent 5000 C reference', {x0:vx,z0:vz,x1:vx+.595,z1:vz+.785,y0:vy,y1:vy+.84},
    { product:'V5001C envelope; output variant to confirm', service:{x0:vx-.8,z0:vz,x1:vx,z1:vz+.785} });
  box('ventilation_body',vx,vz,vy,.595,.785,.76,'white',.025);
  box('ventilation_filter_joint',vx-.001,vz+.018,vy+.45,.003,.749,.002,'dark',0);
  cylinder('ventilation_latch',vx-.003,vz+.12,vy+.21,.008,.005,'metal','x');
  for (const [i,x] of [vx+.16,vx+.43].entries()) for (const [j,z] of [vz+.18,vz+.60].entries()) {
    cylinder(`ventilation_neck_${i}_${j}`,x,z,vy+.80,.080,.08,'dark');
    cylinder(`ventilation_riser_${i}_${j}`,x,z,(vy+.84+2.50)/2,.079,2.50-vy-.84,'duct');
    for (const [k,y] of [vy+.87,2.46].entries()) cylinder(`ventilation_clamp_${i}_${j}_${k}`,x,z,y,.084,.018,'metal');
  }
  cylinder('ventilation_condensate_stub',vx+.52,vz+.70,vy-.08,.012,.16,'white');

  const rx = room.x1-.62, rz = room.z0+.24, ry = 1.62, rw=.600, rd=.598, rh=.639;
  start('UniFi 12U wall rack', {x0:rx,z0:rz,x1:rx+rw,z1:rz+rd,y0:ry,y1:ry+rh},
    {product:'UACC-Rack-12U-Wall-600-G',service:{x0:rx-.8,z0:rz,x1:rx,z1:rz+rd}});
  box('rack_back',rx+rw-.012,rz,ry,.012,rd,rh);
  for(const[i,z]of[rz,rz+rd-.012].entries())box(`rack_side_${i}`,rx,z,ry,rw,.012,rh);
  for(const[i,y]of[ry,ry+rh-.012].entries())box(`rack_plate_${i}`,rx,rz,y,rw,rd,.012);
  for(const[i,z]of[rz+.022,rz+rd-.044].entries())box(`rack_door_side_${i}`,rx-.005,z,ry+.015,.020,.022,rh-.03);
  for(const[i,y]of[ry+.015,ry+rh-.038].entries())box(`rack_door_edge_${i}`,rx-.005,rz+.022,y,.020,rd-.044,.023);
  box('rack_door_glass',rx+.002,rz+.044,ry+.038,.004,rd-.088,rh-.076,'glass',0);
  cylinder('rack_lock',rx-.009,rz+.055,ry+rh*.52,.009,.006,'metal','x');
  for(const[i,z]of[rz+.065,rz+rd-.080].entries()) {
    box(`rack_rail_${i}`,rx+.050,z,ry+.05,.02,.015,.54,'dark');
    for(let j=0;j<36;j++)box(`rack_rail_hole_${i}_${j}`,rx+.048,z+.004,ry+.057+j*.0148,.003,.006,.006,'metal',0);
  }
  const unit = .04445, bottom = ry+.053;
  const rackUnit = (name,u,count=1,material='metal') => box(name,rx+.062,rz+.077,bottom+(u-1)*unit,.41,.444,count*unit-.002,material,.002);
  rackUnit('rack_ups_2u',1,2);
  rackUnit('rack_pdu',3,1,'dark');
  rackUnit('rack_patch_panel',5,1,'dark');
  rackUnit('rack_cable_manager',6,1,'dark');
  rackUnit('rack_switch_pro_max',7);
  rackUnit('rack_dream_machine_pro',8);
  for(const[u,label]of[[10,'nuc'],[12,'modem']]) {
    box(`rack_shelf_${u}`,rx+.065,rz+.077,bottom+(u-1)*unit,.40,.444,.004,'dark');
    box(`rack_${label}`,rx+.12,rz+.20,bottom+(u-1)*unit+.004,.12,.12,u===10?.05:.035,'dark',.008);
  }
  for(let i=0;i<24;i++) {
    const z=rz+.103+i*.0168;
    for(const u of [5,7])box(`rack_port_${u}_${i}`,rx+.058,z,bottom+(u-1)*unit+.013,.006,.013,.012,'dark',0);
    box(`rack_patch_lead_${i}`,rx+.050,z+.004,bottom+4*unit+.028,.006,.005,2*unit-.006,'blue',.002);
  }
  cylinder('rack_router_screen',rx+.057,rz+.13,bottom+7*unit+.022,.013,.004,'screen','x');
  for(const[i,z]of[rz+.20,rz+.40].entries()){
    cylinder(`rack_top_fan_${i}`,rx+.31,z,ry+rh+.001,.058,.003,'dark');
    for(let j=0;j<5;j++)box(`rack_fan_guard_${i}_${j}`,rx+.255+j*.027,z-.052,ry+rh+.003,.004,.104,.003,'metal',0);
  }

  const bx=room.x1-.145,bz=rz+.004;
  start('Electrical distribution board', {x0:bx,z0:bz,x1:room.x1-.02,z1:bz+.59,y0:.60,y1:1.52},
    {product:'120-module enclosure; exact cabinet not selected',service:{x0:bx-.8,z0:bz,x1:bx,z1:bz+.59}});
  box('electrical_board_case',bx,bz,.60,.125,.59,.92);
  box('electrical_board_door',bx-.007,bz+.018,.618,.013,.554,.884,'white',.006);
  box('electrical_board_latch',bx-.012,bz+.055,1.015,.009,.017,.058,'metal',.003);
  box('electrical_board_identification',bx-.014,bz+.20,1.40,.004,.17,.034,'dark',.001);

  const ax=room.x0+1.84,az=room.z0+.008;
  start('Jablotron control enclosure', {x0:ax,z0:az,x1:ax+.25,z1:az+.075,y0:1.47,y1:1.67},
    {product:'Jablotron panel envelope; JA-103K/106K/107K unresolved in quote'});
  box('jablotron_case',ax,az,1.47,.25,.07,.20,'white',.010);
  box('jablotron_cover',ax+.005,az+.066,1.475,.24,.009,.19,'white',.006);
  cylinder('jablotron_status',ax+.22,az+.077,1.50,.003,.002,'screen','y');
  for(let i=0;i<5;i++)box(`jablotron_vent_${i}`,ax+.028+i*.011,az+.076,1.505,.006,.001,.026,'dark',0);

  start('Utility service accessories', {x0:room.x1-.14,z0:rz+.04,x1:room.x1,z1:rz+.40,y0:2.35,y1:2.45},{});
  for(let i=0;i<3;i++) {
    box(`rack_socket_${i}`,room.x1-.018,rz+.08+i*.084,2.36,.018,.075,.075,'white',.006);
    cylinder(`rack_socket_insert_${i}`,room.x1-.020,rz+.1175+i*.084,2.3975,.020,.003,'dark','x');
  }
  const joinery = buildUtilityJoinery(data);
  if (joinery) models.push(joinery);
  const notes = [
    ...(joinery?.notes ?? []),
    'Equipment positions are a coordination proposal. Laundry/tall joinery, the room footprint, window and entrance are unchanged.',
    'Bosch indoor tower includes the 170.7L cylinder. No separate hot-water tank is added. Allow 800mm front, 50mm sides/back and 400mm overhead access.',
    'The ventilation brief describes a small ceiling unit; the Vent 5000 C envelope modeled here is upright 785×595×840mm. Confirm exact variant and mounting against the revised HVAC drawings.',
    'The four ventilation risers only show connection space. Distribution ducts, condensate and hydraulic routes are not an installation design.',
    'Existing electrical notes place heat-pump/ventilation supplies at the bathroom wall, where the current joinery already sits. Proposed east-wall equipment therefore needs installer coordination.',
    'Rack sits above the 120-module board at 1620mm. This east-wall proposal differs from the specified entrance-side wall; equipment clearance coordination remains outstanding. Exact control-board enclosures remain unconfirmed.',
  ];
  return {models,equipment,notes,presets:{
    utility:{position:[room.x0+1.05,1.60,room.z0+.50],target:[room.x1-.20,1.32,room.z0+1.48]},
    utilityLaundry:{position:[room.x1-.75,1.60,room.z0+1.15],target:[room.x0+.35,1.05,room.z1-.80]},
  }};
}

export function attachUtilityEquipment(THREE, house, data, { buildModel }) {
  const result = buildUtilityEquipment(data), group = new THREE.Group();
  group.name = 'Utility equipment proposal';
  for (const model of result.models) group.add(buildModel(THREE,{...model,floorHeight:house.dims.floorY}));
  house.furniture.add(group);
  return {...result,group};
}
