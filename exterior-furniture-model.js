const ExteriorFurnitureModel = (() => {
  function build(garden, floorHeight = 0) {
    const materials = {
      lounge_frame: { color: '#535a59', roughness: 0.57, metalness: 0.55 },
      lounge_fabric: { color: '#dedbd0', roughness: 0.96 },
      lounge_piping: { color: '#c8c5ba', roughness: 1 },
      lounge_feet: { color: '#323633', roughness: 0.86 },
      lounge_stone: { color: '#a6a69c', roughness: 0.88 },
      lounge_stone_edge: { color: '#96978e', roughness: 0.92 },
      worktop: { color: '#b5b6ae', roughness: .42, metalness: .45 },
      joinery_front: { color: '#45494a', roughness: .48 },
      joinery_case: { color: '#45494a', roughness: .48 },
    };
    const parts = [], footprints = [], feet = [];
    function lounge(name, cx, cy, width, facing = 1) {
      const point = (u, v, h) => facing==='east'?[cx+v,cy-u,h]:[cx + u, cy + v * facing, h];
      const box = (suffix, u, v, h, w, d, z, material, bevel) => parts.push({ name: `${name}_${suffix}`,
        type: 'box', position: point(u, v, h), size: facing==='east'?[d,w,z]:[w, d, z], material, bevel, category: 'furniture' });
      const beam = (suffix, a, b, w, d, material = 'lounge_frame') => parts.push({ name: `${name}_${suffix}`,
        type: 'beam', start: point(...a), end: point(...b), width: w, depth: d, material, bevel: .012, category: 'furniture' });
      const half = width / 2;
      footprints.push(facing==='east'?{name,x:cx-.4,y:cy-half,w:.8,d:width,height:.72}:{ name, x: cx - half, y: cy - .4, w: width, d: .8, height: .72 });
      for (const [i, u] of [-half + .105, half - .105].entries()) {
        for (const [j, v] of [-.285, .285].entries()) {
          box(`foot_${i}_${j}`, u, v, .008, .045, .045, .016, 'lounge_feet', .004);
          feet.push({ name: `${name}_foot_${i}_${j}`, position: point(u, v, 0) });
          beam(`leg_${i}_${j}`, [u, v, .016], [u * .98, v * .91, .342], .036, .036);
        }
        beam(`side_rail_${i}`, [u, -.31, .335], [u, .31, .335], .038, .038);
        beam(`arm_front_${i}`, [u, .27, .33], [u, .25, .59], .045, .045);
        beam(`arm_${i}`, [u, -.25, .615], [u, .25, .615], .065, .06);
      }
      beam('front_rail', [-half + .08, .3, .338], [half - .08, .3, .338], .04, .04);
      beam('rear_rail', [-half + .08, -.3, .338], [half - .08, -.3, .338], .04, .04);
      const divisions = width > 1 ? 2 : 1, cushionWidth = (width - .19) / divisions;
      for (let i = 0; i < divisions; i++) {
        const u = -half + .095 + cushionWidth * (i + .5);
        box(`seat_${i}`, u, .03, .391, cushionWidth - .012, .58, .098, 'lounge_fabric', .042);
        box(`seat_seam_${i}`, u, .319, .389, cushionWidth - .055, .006, .004, 'lounge_piping', .002);
        box(`back_cushion_${i}`, u, -.266, .568, cushionWidth - .016, .17, .304, 'lounge_fabric', .052);
        box(`back_seam_${i}`, u, -.178, .692, cushionWidth - .06, .004, .004, 'lounge_piping', .002);
      }
      const vertices = [], faces = [], segments = 32;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments, u = (t - .5) * (width - .08), v = -.355 + .16 * Math.abs(2 * t - 1) ** 3;
        for (const [offset, h] of [[-.013,.34],[.013,.34],[.013,.69],[-.013,.69]]) vertices.push(point(u, v + offset, h));
        if (i) for (let j = 0; j < 4; j++) faces.push([(i-1)*4+j,(i-1)*4+(j+1)%4,i*4+(j+1)%4,i*4+j]);
      }
      faces.push([3,2,1,0],[segments*4,segments*4+1,segments*4+2,segments*4+3]);
      parts.push({ name: `${name}_curved_shell`, type: 'mesh', vertices, faces, material: 'lounge_frame', category: 'furniture' });
    }
    function table(name, x, y) {
      footprints.push({ name, x: x - .3, y: y - .3, w: .6, d: .6, height: .4 });
      parts.push({ name, type: 'lathe', position: [x,y,0], profile: [[0,0],[.2,0],[.217,.014],[.225,.05],[.255,.27],[.282,.34],[.298,.36],[.3,.382],[.294,.397],[.28,.4],[0,.4]],
        segments: 64, material: 'lounge_stone', category: 'furniture' });
      parts.push({ name: `${name}_base`, type: 'cylinder', position: [x,y,.006], radiusTop:.198,radiusBottom:.198,height:.012,segments:48,axis:'z',material:'lounge_stone_edge',category:'furniture' });
    }
    const east = garden.elements.find(e => e.id === 'eastTerrace').parts.find(p => p.kind === 'rect');
    const atrium = garden.elements.find(e => e.id === 'house').meta.atrium;
    const circulation = [
      { name:'east_pergola_route', x:east.x+east.w-1, y:east.y, w:1, d:east.d },
      { name:'east_slider_approach', x:east.x, y:14.18, w:.9, d:2.58 },
      { name:'atrium_slider_approach', x:atrium[2]-1.2, y:atrium[1], w:1.2, d:atrium[3]-atrium[1] },
      { name:'atrium_west_route', x:atrium[0], y:atrium[1], w:atrium[2]-atrium[0], d:1.1 },
    ];
    lounge('east_sofa', 21.08, 17.8, 1.64, 'east');
    table('east_low_table', 22.05, 17.8);
    lounge('atrium_west_chair', atrium[0]+.77, atrium[3]-.63, .89, -1);
    lounge('atrium_east_chair', atrium[0]+2.07, atrium[3]-.63, .89, -1);
    table('atrium_low_table', atrium[0]+1.42, atrium[3]-1.78);
    const notch=garden.elements.find(e=>e.id==='house').meta.eNotch;
    const kitchenEnd=circulation.find(r=>r.name==='east_slider_approach').y;
    const worktable = { name:'outdoor_kitchen_table', x:notch[0], y:notch[1], w:notch[2]-notch[0], d:kitchenEnd-notch[1], height:.8 };
    footprints.push(worktable);
    const box = (name,x,y,h,w,d,z,material,bevel=.006) => parts.push({name,type:'box',
      position:[x+w/2,y+d/2,h+z/2],size:[w,d,z],material,bevel,category:'furniture'});
    box('outdoor_kitchen_top',worktable.x,worktable.y,.77,worktable.w,worktable.d,.03,'worktop',.012);
    for (const [i,x] of [worktable.x+.04,worktable.x+worktable.w-.085].entries()) {
      for (const [j,y] of [worktable.y+.04,worktable.y+worktable.d-.085].entries()) {
        const name=`outdoor_kitchen_foot_${i}_${j}`;
        box(name,x,y,0,.045,.045,.015,'lounge_feet',.003);
        feet.push({name,position:[x+.0225,y+.0225,0]});
        box(`outdoor_kitchen_support_${i}_${j}`,x,y,.015,.045,.045,.08,'lounge_feet');
      }
    }
    const front=worktable.x+worktable.w;
    box('outdoor_kitchen_back',worktable.x+.008,worktable.y+.008,.08,.018,worktable.d-.016,.69,'joinery_case',.002);
    box('outdoor_kitchen_base',worktable.x+.008,worktable.y+.008,.08,worktable.w-.036,worktable.d-.016,.018,'joinery_case',.002);
    box('outdoor_kitchen_plinth',worktable.x+.055,worktable.y+.045,.015,worktable.w-.12,worktable.d-.09,.065,'lounge_feet',.002);
    box('outdoor_kitchen_upper_rail',front-.065,worktable.y+.008,.735,.035,worktable.d-.016,.035,'joinery_case',.002);
    for(let i=0;i<=4;i++){
      const y=worktable.y+.008+(worktable.d-.034)*i/4;
      box(`outdoor_kitchen_partition_${i}`,worktable.x+.026,y,.098,worktable.w-.054,.018,.672,'joinery_case',.002);
    }
    const doorWidth=(worktable.d-.016)/4;
    for(let i=0;i<4;i++)
      box(`outdoor_kitchen_door_${i}`,front-.024,worktable.y+.008+i*doorWidth+.0015,.1,.022,doorWidth-.003,.65,'joinery_front',.002);
    return { name: 'Outdoor lounge furniture', materials, parts, floorHeight, lights: [], footprints, feet, circulation };
  }
  return { build };
})();
if (typeof module !== 'undefined') module.exports = { ExteriorFurnitureModel };
