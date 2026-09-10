import { houseFlooringModel } from './house-flooring.js';
import { HOUSE_FLUE_INTERIOR_TOP } from '../house-chimney.js';

export const finishColors = { wall: '#ddd1be', ceiling: '#ddd1be' };

export function loftInteriorModel(data) {
  const parts = [], footprints = [];
  const materials = {
    paint: { color: '#ddd1be', roughness: .9 }, cabinet: { color: '#d5cabc', roughness: .75 },
    shadow: { color: '#55564f', roughness: .78 }, metal: { color: '#555a58', roughness: .38, metalness: .6 },
    diffuser: { color: '#f8f4e9', roughness: .6, emissive: '#fff1d8', emissiveIntensity: 1.3 },
    concrete: { color: '#adada6', roughness: .96 },
    flue: { color: '#202526', roughness: .58, metalness: .38 },
    equipment: { color: '#30383b', roughness: .55, metalness: .15 },
    rubber: { color: '#171c1d', roughness: .95 }, steel: { color: '#a3a8a7', roughness: .23, metalness: .9 },
    upholstery: { color: '#353d3e', roughness: .93 }, accent: { color: '#94463e', roughness: .6 },
    display: { color: '#23383f', roughness: .25, emissive: '#25404b', emissiveIntensity: .25 },
  };
  const box = (name, x, z, y, w, d, h, material, category = 'furniture') => parts.push({ name, type: 'box',
    position: [x + w / 2, z + d / 2, y + h / 2], size: [w, d, h], material, category,
    bevel: category === 'floorFinish' ? 0 : material === 'upholstery' ? .03 : .003 });
  const flueHeight = HOUSE_FLUE_INTERIOR_TOP - data.floorY;
  parts.push({ name: 'loft_black_flue', type: 'cylinder', position: [6.225, 12.59, flueHeight / 2],
    radiusTop: .09, radiusBottom: .09, height: flueHeight, axis: 'z', segments: 40, material: 'flue', category: 'structure' });
  const cylinder = (name, position, radius, height, material = 'equipment', axis = 'z') => parts.push({ name, type: 'cylinder', position,
    radiusTop: radius, radiusBottom: radius, height, axis, segments: 28, material, category: 'furniture' });
  const beam = (name, start, end, width, depth, material = 'equipment') => parts.push({ name, type: 'beam', start, end, width, depth, material, category: 'furniture' });
  const tube = (name, start, end, radius, material) => {
    const cross = (a, b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const normalize = a => { const length = Math.hypot(...a); return a.map(value => value / length); };
    const direction = normalize(end.map((value, axis) => value - start[axis]));
    const u = normalize(cross(direction, Math.abs(direction[2]) < .9 ? [0,0,1] : [1,0,0]));
    const v = cross(direction, u), count = 12, vertices = [], faces = [];
    for (const origin of [start, end]) for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2;
      vertices.push(origin.map((value, axis) => value + radius * (u[axis] * Math.cos(angle) + v[axis] * Math.sin(angle))));
    }
    for (let i = 0; i < count; i++) { const next = (i + 1) % count; faces.push([i,next,next+count,i+count]); }
    faces.push(Array.from({length:count},(_,i)=>count-1-i),Array.from({length:count},(_,i)=>count+i));
    parts.push({name,type:'mesh',vertices,faces,smooth:true,material,category:'furniture'});
  };
  const ring = (name, center, radius, diameter, axis, material) => {
    const segments = 48;
    const point = angle => axis === 'x' ? [center[0], center[1] + Math.cos(angle) * radius, center[2] + Math.sin(angle) * radius]
      : [center[0] + Math.cos(angle) * radius, center[1], center[2] + Math.sin(angle) * radius];
    for (let i = 0; i < segments; i++) {
      const start = point(i / segments * Math.PI * 2), end = point((i + 1) / segments * Math.PI * 2);
      tube(`${name}_${i}`, start, end, diameter / 2, material);
    }
  };
  const rack = { x0: 5.72, z0: 16.95, x1: 6.95, z1: 18.54, height: 2.17375 };
  footprints.push({ name: 'ATX PRX-720', ...rack, source: 'Owned rack, documented 123 × 159 × 215 cm', provisional: false });
  box('rack_rubber_mat', 5.18, 16.83, .00375, 2.35, 1.83, .02, 'rubber');
  const rackFloor = .02375;
  for (const [i, x] of [rack.x0, rack.x1 - .07].entries()) for (const [j, z] of [rack.z0, rack.z1 - .07].entries()) {
    box(`rack_upright_${i}_${j}`, x, z, rackFloor, .07, .07, 2.15, 'equipment');
    box(`rack_foot_${i}_${j}`, x, z, rackFloor, .07, .07, .012, 'steel');
    for (let hole = 0; hole < 33; hole++) {
      cylinder(`rack_hole_${i}_${j}_${hole}`, [x + .035, z - .001, rackFloor + .25 + hole * .05], .0105, .002, 'rubber', 'y');
    }
    for (const [k, y] of [.1, 2.07].entries()) cylinder(`rack_bolt_${i}_${j}_${k}`, [x + .071, z + .035, rackFloor + y], .008, .009, 'steel', 'x');
  }
  for (const [i, x] of [rack.x0, rack.x1 - .07].entries()) {
    box(`rack_side_base_${i}`, x, rack.z0, rackFloor + .035, .07, 1.59, .07, 'equipment');
    box(`rack_side_top_${i}`, x, rack.z0, rackFloor + 2.08, .07, 1.59, .07, 'equipment');
    box(`rack_safety_${i}`, x + (i ? -.065 : .065), rack.z0 + .07, rackFloor + .64, .05, 1.45, .05, 'steel');
    box(`rack_jcup_back_${i}`, x + (i ? -.016 : .016), rack.z0 - .018, 1.235, .055, .035, .18, 'equipment');
    box(`rack_jcup_saddle_${i}`, x + (i ? -.016 : .016), rack.z0 - .105, 1.30, .055, .12, .028, 'rubber');
    box(`rack_jcup_lip_${i}`, x + (i ? -.016 : .016), rack.z0 - .105, 1.30, .055, .018, .06, 'equipment');
  }
  box('rack_rear_brace', rack.x0, rack.z1 - .07, rackFloor + .045, 1.23, .07, .07, 'equipment');
  cylinder('rack_pullup_bar', [6.335, 17.12, rackFloor + 2.1], .0135, 1.16, 'equipment', 'x');
  for (let i = 0; i < 2; i++) beam(`rack_neutral_grip_${i}`, [6.1 + i * .47, 17.02, rackFloor + 2.1], [6.1 + i * .47, 17.27, rackFloor + 2.1], .027, .027);
  cylinder('rack_barbell_shaft', [6.335, 16.90, 1.345], .014, 2.2, 'steel', 'x');
  for (const sign of [-1, 1]) {
    cylinder(`rack_barbell_sleeve_${sign}`, [6.335 + sign * .88, 16.90, 1.345], .025, .40, 'steel', 'x');
    for (let plate = 0; plate < 2; plate++) cylinder(`rack_plate_${sign}_${plate}`, [6.335 + sign * (.74 + plate * .038), 16.90, 1.345], plate ? .18 : .225, .032, 'rubber', 'x');
    cylinder(`rack_collar_${sign}`, [6.335 + sign * .84, 16.90, 1.345], .044, .045, 'accent', 'x');
  }
  const sim = { x0: 4.65, z0: 14.2, x1: 6.4, z1: 14.95, height: 1.20 };
  footprints.push({ name: 'Sim rig', ...sim, provisional: true, source: 'Generic fit envelope; owned model not found in notes' });
  for (const [i, z] of [14.23, 14.85].entries()) {
    box(`sim_chassis_${i}`, 4.7, z, .05375, 1.65, .06, .08, 'equipment');
    for (const [j, x] of [4.8, 6.2].entries()) cylinder(`sim_foot_${i}_${j}`, [x, z + .03, .02875], .035, .05, 'rubber');
    box(`sim_wheel_post_${i}`, 5.62, z, .13, .07, .06, .60, 'equipment');
  }
  for (const [i, x] of [4.85, 5.55, 6.22].entries()) box(`sim_crossmember_${i}`, x, 14.23, .09, .06, .68, .05, 'metal');
  box('sim_seat_cushion', 4.93, 14.34, .30, .47, .46, .10, 'upholstery');
  beam('sim_seat_back', [4.99, 14.57, .37], [4.80, 14.57, 1.04], .43, .12, 'upholstery');
  for (const [i, z] of [14.30, 14.79].entries()) beam(`sim_seat_bolster_${i}`, [5.05, z, .33], [4.84, z, .93], .10, .09, 'upholstery');
  box('sim_headrest', 4.73, 14.42, .97, .14, .30, .16, 'upholstery');
  box('sim_wheel_deck', 5.54, 14.22, .72, .30, .70, .025, 'metal');
  box('sim_wheel_motor', 5.57, 14.47, .745, .22, .21, .16, 'equipment');
  ring('sim_wheel_rim', [5.50, 14.575, .82], .145, .025, 'x', 'rubber');
  cylinder('sim_wheel_hub', [5.50, 14.575, .82], .045, .05, 'equipment', 'x');
  for (let i = 0; i < 3; i++) {
    const angle = i / 3 * Math.PI * 2;
    beam(`sim_wheel_spoke_${i}`, [5.50, 14.575, .82], [5.50, 14.575 + Math.cos(angle) * .132, .82 + Math.sin(angle) * .132], .025, .012, 'steel');
    box(`sim_pedal_${i}`, 6.10, 14.35 + i * .16, .25, .11, .08, .018, 'steel');
    beam(`sim_pedal_arm_${i}`, [5.99, 14.39 + i * .16, .14], [6.15, 14.39 + i * .16, .25], .025, .025, 'metal');
  }
  box('sim_pedal_base', 5.95, 14.28, .13, .38, .59, .035, 'metal');
  box('sim_monitor_post', 5.95, 14.55, .13, .045, .045, .92, 'equipment');
  box('sim_monitor_body', 5.95, 14.19, .90, .045, .75, .30, 'equipment');
  box('sim_monitor_glass', 5.944, 14.202, .912, .004, .726, .276, 'display');
  const bike = { x0: 8.22, z0: 16.52, x1: 9.10, z1: 18.48, height: 1.15 };
  footprints.push({ name: 'Bike and smart trainer', ...bike, provisional: true, source: 'Generic direct-drive trainer and road bike; owned models not found in notes' });
  box('trainer_mat', 8.16, 16.48, .00375, 1.02, 2.05, .009, 'rubber');
  const bx = 8.66, front = [bx, 16.89, .366], rear = [bx, 17.95, .366], crank = [bx, 17.51, .32], seat = [bx, 17.65, .86], headset = [bx, 17.09, .89];
  ring('bike_front_tyre', front, .337, .032, 'x', 'rubber');
  ring('bike_front_rim', front, .308, .013, 'x', 'steel');
  cylinder('bike_front_hub', front, .025, .10, 'metal', 'x');
  for (let spoke = 0; spoke < 24; spoke++) {
    const angle = spoke / 24 * Math.PI * 2;
    beam(`bike_spoke_${spoke}`, front, [bx, front[1] + Math.cos(angle) * .303, front[2] + Math.sin(angle) * .303], .002, .002, 'steel');
  }
  for (const [name, a, b] of [['top',seat,headset], ['down',headset,crank], ['seat',crank,seat], ['chainstay',crank,rear], ['seatstay',seat,rear], ['fork',headset,front]]) tube(`bike_frame_${name}`, a, b, .019, 'accent');
  tube('bike_seatpost', seat, [bx,17.68,1.01], .0135, 'metal');
  box('bike_saddle', bx-.07,17.57,1.00,.14,.25,.055,'rubber');
  tube('bike_stem', headset,[bx,16.95,1.02],.014,'metal');
  tube('bike_handlebar', [bx-.20,16.95,1.02],[bx+.20,16.95,1.02],.014,'rubber');
  for(const sign of [-1,1]) {
    tube(`bike_drop_${sign}`,[bx+sign*.20,16.95,1.02],[bx+sign*.20,16.96,.87],.014,'rubber');
    tube(`bike_drop_return_${sign}`,[bx+sign*.20,16.96,.87],[bx+sign*.20,17.09,.87],.014,'rubber');
    beam(`bike_crank_${sign}`,[bx+sign*.035,crank[1],crank[2]],[bx+sign*.07,crank[1]+sign*.15,crank[2]-.04],.018,.022,'metal');
    box(`bike_pedal_${sign}`,bx+sign*.13-.05,crank[1]+sign*.15-.04,crank[2]-.05,.10,.08,.025,'equipment');
    beam(`trainer_outrigger_${sign}`,[bx,17.96,.12],[bx+sign*.40,18.19,.045],.07,.06,'equipment');
    cylinder(`trainer_foot_${sign}`,[bx+sign*.40,18.19,.029],.055,.033,'rubber');
  }
  cylinder('bike_chainring',[bx+.035,crank[1],crank[2]],.095,.007,'steel','x');
  cylinder('trainer_cassette',[bx+.04,rear[1],rear[2]],.055,.055,'steel','x');
  for(const offset of [-.055,.055])beam(`bike_chain_${offset}`,[bx+.05,crank[1],crank[2]+offset],[bx+.05,rear[1],rear[2]+offset],.004,.004,'equipment');
  cylinder('trainer_flywheel',[bx-.17,17.96,.22],.18,.11,'equipment','x');
  box('trainer_motor',bx-.20,17.87,.05,.24,.34,.30,'equipment');
  beam('trainer_axle_support',[bx-.08,17.96,.08],rear,.08,.065,'metal');
  box('trainer_status_led',bx-.205,18.02,.25,.005,.035,.01,'display');
  box('room_light_mount', 6.84, 16.96, data.clearH - .055, .36, .36, .055, 'paint', 'ceilingDetail');
  box('room_light_diffuser', 6.855, 16.975, data.clearH - .063, .33, .33, .009, 'diffuser', 'ceilingDetail');
  box('landing_light_mount', 8.25, 14.78, data.clearH - .045, .28, .28, .045, 'paint', 'ceilingDetail');
  box('landing_light_diffuser', 8.265, 14.795, data.clearH - .053, .25, .25, .009, 'diffuser', 'ceilingDetail');
  const attic = data.rooms.find(room => room.id === '2.03');
  const xs = [...new Set([attic.x0, attic.x1, ...data.floorHoles.flatMap(hole => [hole.x0, hole.x1]).filter(x => x > attic.x0 && x < attic.x1)])].sort((a, b) => a - b);
  const zs = [...new Set([attic.z0, attic.z1, ...data.floorHoles.flatMap(hole => [hole.z0, hole.z1]).filter(z => z > attic.z0 && z < attic.z1)])].sort((a, b) => a - b);
  for (let xi = 0; xi < xs.length - 1; xi++) for (let zi = 0; zi < zs.length - 1; zi++) {
    const x = (xs[xi] + xs[xi + 1]) / 2, z = (zs[zi] + zs[zi + 1]) / 2;
    if (data.floorHoles.some(hole => x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1)) continue;
    box(`attic_concrete_${xi}_${zi}`, xs[xi], zs[zi], .00125, xs[xi + 1] - xs[xi], zs[zi + 1] - zs[zi], .0025, 'concrete', 'floorFinish');
  }
  const clearances = [
    { name: 'Door approach', x0: 6.5, z0: 14.18, x1: 7.65, z1: 15.1, height: 2 },
    { name: 'Main access', x0: 6.78, z0: 15.1, x1: 7.60, z1: 16.78, height: 2 },
    { name: 'Rack loading and exercise', x0: 5.10, z0: 16.10, x1: 7.56, z1: 18.68, height: 2.17, sharedUse: true },
    { name: 'Sim rig entry', x0: 5.35, z0: 15.02, x1: 6.40, z1: 15.60, height: 2, sharedUse: true },
    { name: 'Bike mounting', x0: 7.8, z0: 16.4, x1: 9.3, z1: 18.65, height: 1.8, sharedUse: true },
  ];
  return { name: 'Loft room details', floorHeight: 0, parts, materials, footprints, clearances, lights: [],
    notes: [
      'Loft room and landing use Champagne vinyl and Mocha 205F paint. Attic store remains concrete.',
      'Room 2.02 holds the owned ATX PRX-720, a provisional sim-racing cockpit and a provisional direct-drive bike trainer. The previous cabinets are removed.',
      'Rack dimensions follow the specified equipment. Sim rig, bike, trainer, screen and pedal models and envelopes are illustrative pending identification.',
      'Rack top is 2.174 m above the model floor, leaving about 96 mm to the 2.27 m ceiling before fixtures. Rack pull-ups and standing overhead barbell presses do not fit the documented headroom.',
      'Exercise and mounting spaces are shared-use proposals, not safety certification. Confirm actual ceiling strip, floor loading, mat thickness and equipment envelopes on site.',
      'Existing measured ceiling and model floor datum are preserved. This is not a revised structural or headroom drawing.',
      'Black flue continuation to the ridge shows the requested appearance, not an approved chimney routing or installation.',
    ] };
}

export function attachLoftInterior(THREE, loft, data, { buildModel, renderer, applyChampagneFloor }) {
  const model = loftInteriorModel(data);
  const group = buildModel(THREE, { ...model, floorHeight: loft.dims.floorY });
  if (!loft.furniture) { loft.furniture = new THREE.Group(); loft.root.add(loft.furniture); }
  const categories = group.userData.categories;
  for (const [category, parent] of [['furniture', loft.furniture], ['floorFinish', loft.floor], ['ceilingDetail', loft.ceiling]]) {
    const child = categories[category];
    child.position.y = loft.dims.floorY;
    parent.add(child);
  }
  loft.root.add(group);
  const floorModel = houseFlooringModel(data, [], { regions: data.rooms.filter(room => ['2.01', '2.02', '2.02b'].includes(room.id)) });
  floorModel.name = 'Loft Champagne floor';
  const flooring = buildModel(THREE, { ...floorModel, floorHeight: loft.dims.floorY });
  applyChampagneFloor(THREE, flooring, floorModel, renderer);
  loft.floor.add(flooring);
  for (const [x, z, size] of [[7.02,17.14,.33], [8.39,14.92,.25]]) {
    const light = new THREE.PointLight('#fff1df', .75, 6, 2);
    light.position.set(x, loft.dims.floorY + data.clearH - .1, z);
    light.userData.fixtureSize = size;
    loft.ceiling.add(light);
  }
  group.userData.model = model;
  flooring.userData.floorModel = floorModel;
  return { group, flooring, notes: model.notes, clearances: model.clearances, presets: {
    room: { position: [7.4, 1.65, 15.9], target: [7.35, .80, 17.8] },
    sim: { position: [6.65, 1.4, 15.45], target: [5.3, .65, 14.6] },
    trainer: { position: [7.65, 1.5, 15.95], target: [8.65, .65, 17.5] },
    landing: { position: [8.75, 1.58, 15.1], target: [7.7, 1.1, 14.5] },
    attic: { position: [7.2, 1.55, 5.8], target: [6.7, 1.2, .9] },
  } };
}
