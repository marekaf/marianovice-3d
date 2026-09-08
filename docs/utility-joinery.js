export function prepareUtilityJoinery(f) {
  if (f.room !== '1.02' || f.kind !== 'cab') return f;
  const finish = { cmat: 'greenMatt', fmat: 'greenMatt', imat: 'whiteBoard', wmat: 'cashmereTop' };
  if (!f.worktop) return { ...f, ...finish, handleHeight: 1.05 };
  return { ...f, ...finish, kind: 'utilityJoinery', h: .862, worktop: .038,
    modules: [.628, .628, .4, .4], tags: ['a', 'a', 'd', 'd'] };
}

export function buildUtilityJoinery(data) {
  const source = data.furniture.find(f => f.room === '1.02' && f.worktop);
  if (!source) return null;
  const f = source.kind === 'utilityJoinery' ? source : prepareUtilityJoinery(source);
  const parts = [], materials = {
    green: { color: '#7f8a7d', roughness: .9 }, white: { color: '#f3f2ed', roughness: .5 },
    top: { color: '#b8b2a7', roughness: .45 }, steel: { color: '#bdc4c7', metalness: .95, roughness: .28 },
    chrome: { color: '#d9dfe0', metalness: 1, roughness: .12 },
    dark: { color: '#182025', roughness: .22 }, glass: { color: '#33454c', metalness: .4, roughness: .12 },
  };
  const box = (name,x,z,y,w,d,h,material) => parts.push({ name, type:'box', position:[x+w/2,z+d/2,y+h/2], size:[w,d,h], material, bevel:.002, category:'furniture' });
  const cyl = (name,x,z,y,r,h,material,axis='z') => parts.push({name,type:'cylinder',position:[x,z,y],radiusTop:r,radiusBottom:r,height:h,axis,segments:48,material,category:'furniture'});
  const top=.9, sx=(f.x0+f.x1)/2, sz=f.z1-.4, edge=.255, opening=.23;
  const x0=f.x0,x1=f.x1,z0=f.z0,z1=f.z1;
  box('utility_top_back',x0,z0,.862,sx-opening-x0,z1-z0,.038,'top');
  box('utility_top_front',sx+opening,z0,.862,x1-sx-opening,z1-z0,.038,'top');
  box('utility_top_north',sx-opening,z0,.862,opening*2,sz-opening-z0,.038,'top');
  box('utility_top_south',sx-opening,sz+opening,.862,opening*2,z1-sz-opening,.038,'top');
  for(const [i,z] of [z0,z0+.628,z1-.8,z1-.018].entries()) box(`utility_green_side_${i}`,x0,z,.03,x1-x0,.018,.832,'green');
  box('utility_sink_cabinet_bottom',x0,z1-.8,.1,x1-x0,.8,.018,'white');
  for(let i=0;i<2;i++) box(`utility_sink_door_${i}`,x1-.018,z1-.8+i*.4+.003,.103,.018,.394,.756,'green');
  for(let i=0;i<2;i++) {
    const z=z0+i*.628+.022, front=x1-.022;
    box(`laundry_${i}_body`,x0+.025,z,.025,.545,.584,.82,'white');
    box(`laundry_${i}_control_panel`,front-.018,z+.01,.722,.018,.564,.11,'white');
    cyl(`laundry_${i}_door_rim`,front,z+.292,.432,.205,.018,'steel','x');
    cyl(`laundry_${i}_door_gasket`,front+.009,z+.292,.432,.18,.008,'dark','x');
    cyl(`laundry_${i}_door_glass`,front+.014,z+.292,.432,.161,.006,'glass','x');
    cyl(`laundry_${i}_selector`,front+.008,z+.18,.782,.026,.016,'chrome','x');
    box(`laundry_${i}_display`,front+.004,z+.34,.753,.006,.16,.055,'dark');
    box(`laundry_${i}_detergent_drawer`,front+.004,z+.025,.751,.006,.10,.06,'white');
  }
  box('utility_sink_bottom',sx-opening,sz-opening,.71,opening*2,opening*2,.003,'steel');
  for(const [i,x] of [sx-opening,sx+opening-.003].entries()) box(`utility_sink_bowl_x_${i}`,x,sz-opening,.713,.003,opening*2,.187,'steel');
  for(const [i,z] of [sz-opening,sz+opening-.003].entries()) box(`utility_sink_bowl_z_${i}`,sx-opening,z,.713,opening*2,.003,.187,'steel');
  for(const [i,x] of [sx-edge,sx+opening].entries()) box(`utility_sink_rim_x_${i}`,x,sz-edge,top,.025,.51,.003,'steel');
  for(const [i,z] of [sz-edge,sz+opening].entries()) box(`utility_sink_rim_z_${i}`,sx-opening,z,top,.46,.025,.003,'steel');
  cyl('utility_sink_waste',sx,sz,.714,.022,.002,'dark');
  const tapX=x0+.025;
  cyl('utility_tap_base',tapX,sz,top+.006,.022,.012,'chrome');
  cyl('utility_tap_stem',tapX,sz,top+.12,.014,.23,'chrome');
  cyl('utility_tap_horizontal',tapX+.105,sz,top+.23,.012,.21,'chrome','x');
  cyl('utility_tap_telescopic_head',tapX+.21,sz,top+.208,.019,.055,'chrome');
  cyl('utility_tap_lever',tapX,sz+.04,top+.12,.006,.07,'chrome','y');
  return {name:'Utility laundry and sink',floorHeight:0,materials,parts,lights:[],
    dimensions:{worktopHeight:top,sinkWidth:.51,sinkDepth:.51,sinkCenter:[sx,sz]},
    notes:['Laundry appearance, sink offset and tap geometry are illustrative; the sink envelope and 900mm finished worktop height follow the selected schedule and elevation.']};
}
