const PergolaModel = (() => {
  const screens = typeof module !== 'undefined' ? require('./privacy-screen-model.js').PrivacyScreenModel : PrivacyScreenModel;
  function build(garden) {
    const element = garden.elements.find(e => e.id === 'pergola');
    const footprint = element.parts.find(p => p.kind === 'rect');
    const paving = element.parts.find(p => p.role === 'paving');
    const table = element.parts.find(p => p.role === 'table');
    const { x, y, w, d } = footprint;
    const floorHeight = element.meta.grading.level + 0.1;
    const groundPatch = { x, y, w, d, ...element.meta.grading };
    const materials = {
      steel: { color: '#33383a', roughness: 0.42, metalness: 0.7 },
      hardware: { color: '#aaa8a0', roughness: 0.28, metalness: 0.85 },
      foundation: { color: '#85857d', roughness: 0.92 },
      joints: { color: '#77776e', roughness: 0.95 },
      ceramic: { color: '#e4ded0', roughness: 0.22 },
      glass: { color: '#f2f7f5', roughness: 0.025, transmission: 1 },
      lamp: { color: '#f6dfb6', roughness: 0.6, emissive: '#ffd19a', emissiveIntensity: 1.3 },
    };
    for (const axis of ['x', 'y', 'z']) {
      materials['frame_' + axis] = { color: '#98734f', roughness: 0.72, grain: axis };
      materials['furniture_' + axis] = { color: '#ae865d', roughness: 0.62, grain: axis };
    }
    for (let i = 0; i < 4; i++) materials['paving_' + i] = {
      color: ['#bdb9af', '#c4c0b7', '#b6b4aa', '#c1bdb2'][i], roughness: 0.82,
    };
    const parts = [], lights = [];
    const box = (name, x0, y0, z0, width, depth, height, material, category = 'structure', bevel = 0.004) => {
      parts.push({ name, type: 'box', position: [x0 + width / 2, y0 + depth / 2, z0 + height / 2],
        size: [width, depth, height], material, category, bevel });
    };
    const beam = (name, start, end, width, depth, material, category = 'structure') => {
      parts.push({ name, type: 'beam', start, end, width, depth, material, category, bevel: 0.004 });
    };
    const cylinder = (name, position, radius, height, material, axis = 'z', category = 'structure') => {
      parts.push({ name, type: 'cylinder', position, radiusTop: radius, radiusBottom: radius,
        height, axis, material, category, segments: 24 });
    };
    const lathe = (name, position, profile, material) => {
      parts.push({ name, type: 'lathe', position, profile, material, category: 'furniture', segments: 40 });
    };

    box('pergola_subbase', paving.x, paving.y, -0.45, paving.w, paving.d, 0.39, 'foundation', 'structure', 0.01);
    box('pergola_bedding', paving.x, paving.y, -0.065, paving.w, paving.d, 0.025, 'joints', 'structure', 0);
    for (let row = 0; row < Math.ceil(paving.d / 0.4); row++) {
      const depth = Math.min(0.4, paving.d - row * 0.4);
      if (depth < 0.01) continue;
      const offset = row % 2 ? -0.3 : 0;
      for (let col = 0; col < Math.ceil((paving.w - offset) / 0.6); col++) {
        const left = Math.max(0, offset + col * 0.6), right = Math.min(paving.w, offset + (col + 1) * 0.6);
        if (right - left < 0.01) continue;
        box(`paver_${row}_${col}`, paving.x + left + 0.003, paving.y + row * 0.4 + 0.003, -0.04,
          right - left - 0.006, depth - 0.006, 0.04, 'paving_' + ((col * 7 + row * 3) % 4), 'structure', 0.003);
      }
    }
    const postInset = 0.16, postWidth = 0.16, beamBottom = 2.30, beamTop = 2.56;
    const corners = [[x+postInset,y+postInset], [x+w-postInset,y+postInset],
      [x+postInset,y+d-postInset], [x+w-postInset,y+d-postInset]];
    for (const [i, [px, py]] of corners.entries()) {
      box(`post_footing_${i}`, px - 0.17, py - 0.17, -0.55, 0.34, 0.34, 0.49, 'foundation', 'structure', 0.01);
      box(`post_plate_${i}`, px - 0.12, py - 0.12, -0.06, 0.24, 0.24, 0.025, 'steel');
      for (const [j, dx] of [-0.086, 0.074].entries()) {
        box(`post_shoe_${i}_${j}`, px + dx, py - 0.08, -0.045, 0.012, 0.16, 0.23, 'steel', 'structure', 0.002);
      }
      box(`post_${i}`, px - postWidth / 2, py - postWidth / 2, -0.035,
        postWidth, postWidth, beamBottom + 0.035, 'frame_z');
      for (const z of [0.07, 0.14]) cylinder(`post_bolt_${i}_${z}`, [px, py, z], 0.012, 0.186, 'hardware', 'x');
      for (const [j, [dx, dy]] of [[-0.088,-0.088], [0.088,-0.088], [-0.088,0.088], [0.088,0.088]].entries()) {
        cylinder(`anchor_${i}_${j}`, [px + dx, py + dy, -0.028], 0.012, 0.03, 'hardware');
      }
      const inwardX = i % 2 === 0 ? 1 : -1, inwardY = i < 2 ? 1 : -1;
      beam(`brace_x_${i}`, [px, py, 1.72], [px + inwardX * 0.64, py, 2.35], 0.085, 0.11, 'frame_z');
      beam(`brace_y_${i}`, [px, py, 1.72], [px, py + inwardY * 0.64, 2.35], 0.085, 0.11, 'frame_z');
      cylinder(`brace_pin_${i}`, [px, py, 1.79], 0.013, 0.18, 'hardware', 'x');
    }
    for (const [i, py] of [y + postInset, y + d - postInset].entries()) {
      box(`beam_x_${i}`, x + 0.02, py - 0.09, beamBottom, w - 0.04, 0.18, beamTop - beamBottom, 'frame_x');
    }
    for (const [i, px] of [x + postInset, x + w - postInset].entries()) {
      box(`beam_y_${i}`, px - 0.08, y + postInset + 0.09, beamBottom,
        0.16, d - 2 * postInset - 0.18, beamTop - beamBottom, 'frame_y');
    }
    const rafterCount = 9;
    for (let i = 0; i < rafterCount; i++) {
      box(`rafter_${i}`, x + 0.1 + i * (w - 0.28) / (rafterCount - 1), y - 0.08, beamTop,
        0.08, d + 0.16, 0.16, 'frame_y', 'roof');
    }
    const slatCount = 21;
    for (let i = 0; i < slatCount; i++) {
      box(`roof_slat_${i}`, x - 0.08, y - 0.055 + i * (d + 0.05) / (slatCount - 1), beamTop + 0.16,
        w + 0.16, 0.065, 0.045, 'frame_x', 'roof');
    }

    const tableTop = .75, tableCenter = [table.x + table.w / 2, table.y + table.d / 2];
    materials.table_ceramic = { color: '#d9d3c7', roughness: .56 };
    materials.table_base = { color: '#a67b52', roughness: .59, metalness: .22, grain: 'z' };
    materials.table_rim = { color: '#a67b52', roughness: .59, metalness: .22, grain: 'x' };
    materials.table_glide = { color: '#4e4840', roughness: .9 };
    function roundedTop(name, width, depth, bottom, height, material) {
      const vertices=[], faces=[], outline=[], radius=.17;
      for(const [cx,cy,start] of [[width/2-radius,depth/2-radius,0],[-width/2+radius,depth/2-radius,Math.PI/2],[-width/2+radius,-depth/2+radius,Math.PI],[width/2-radius,-depth/2+radius,Math.PI*1.5]]) {
        for(let i=0;i<=10;i++) { const a=start+i*Math.PI/20; outline.push([cx+radius*Math.cos(a),cy+radius*Math.sin(a)]); }
      }
      for(const h of [bottom,bottom+height]) for(const [u,v] of outline) vertices.push([tableCenter[0]+u,tableCenter[1]+v,h]);
      const n=outline.length;
      vertices.push([tableCenter[0],tableCenter[1],bottom],[tableCenter[0],tableCenter[1],bottom+height]);
      for(let i=0;i<n;i++) {const j=(i+1)%n;faces.push([i,j,j+n,i+n],[2*n,j,i],[2*n+1,i+n,j+n]);}
      parts.push({name,type:'mesh',vertices,faces,material,category:'furniture'});
    }
    roundedTop('table_ceramic_top',table.w,table.d,.741,.009,'table_ceramic');
    roundedTop('table_rounded_rim',table.w-.012,table.d-.012,.695,.046,'table_rim');
    function branch(name, lower, upper, lowerSize, upperSize) {
      const vertices=[];
      for(const [p,size] of [[lower,lowerSize],[upper,upperSize]])for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]]) vertices.push([tableCenter[0]+p[0]+u*size[0]/2,tableCenter[1]+p[1]+v*size[1]/2,p[2]]);
      parts.push({name,type:'mesh',vertices,faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],material:'table_base',category:'furniture'});
    }
    const tableFeet=[];
    for(const [i,[sx,sy]] of [[-1,-1],[-1,1],[1,-1],[1,1]].entries()) {
      const foot=[sx*.73,sy*.34,.015],hub=[sx*.11,sy*.055,.355],head=[sx*.7,sy*.31,.695];
      const px=tableCenter[0]+foot[0],py=tableCenter[1]+foot[1];
      box('table_foot_'+i,px-.055,py-.044,0,.11,.088,.015,'table_glide','furniture',.003);
      tableFeet.push({name:'table_foot_'+i,position:[px,py,0]});
      branch('table_lower_branch_'+i,foot,hub,[.14,.1],[.17,.13]);
      branch('table_upper_branch_'+i,[hub[0],hub[1],.315],head,[.17,.13],[.13,.1]);
    }
    box('table_hub',tableCenter[0]-.15,tableCenter[1]-.1,.31,.3,.2,.095,'table_base','furniture',.035);
    materials.chair_shell = { color: '#d1ad40', roughness: 0.68 };
    materials.chair_glide = { color: '#6d6650', roughness: 0.86 };
    const diningSeats = [];
    function chair(name, cx, cy, angle) {
      const c = Math.cos(angle), s = Math.sin(angle);
      const point = (u, v, z) => [cx + u*c-v*s, cy+u*s+v*c, z];
      const partBox = (suffix, u, v, z, width, depth, height, material, bevel=.008) => {
        const p=point(u,v,z);
        parts.push({name:name+'_'+suffix,type:'box',position:p,size:Math.abs(s)>.5?[depth,width,height]:[width,depth,height],material,bevel,category:'furniture'});
      };
      diningSeats.push({name, center:[cx,cy], angle, width:.56, depth:.58, seatHeight:.47});
      partBox('seat',0,.015,.45,.47,.45,.04,'chair_shell',.02);
      partBox('front_lip',0,.235,.445,.45,.025,.045,'chair_shell',.011);
      for(const [i,u] of [-.225,.225].entries()) {
        for(const [j,v] of [-.235,.235].entries()) {
          partBox('glide_'+i+'_'+j,u,v,.007,.042,.042,.014,'chair_glide',.004);
          beam(name+'_leg_'+i+'_'+j,point(u,v,.014),point(u*.89,v*.79,.435),.038,.043,'chair_shell','furniture');
        }
        beam(name+'_arm_support_'+i,point(u,.17,.44),point(u,.17,.64),.037,.037,'chair_shell','furniture');
        beam(name+'_arm_'+i,point(u,-.21,.659),point(u,.2,.659),.063,.045,'chair_shell','furniture');
        beam(name+'_back_support_'+i,point(u,-.2,.42),point(u,-.23,.7),.036,.038,'chair_shell','furniture');
      }
      const vertices=[],faces=[],n=24;
      for(let i=0;i<=n;i++) {
        const t=i/n,u=(t-.5)*.52,v=-.265+.11*Math.abs(t*2-1)**2;
        for(const [offset,h] of [[-.012,.53],[.012,.53],[.012,.8],[-.012,.8]])vertices.push(point(u,v+offset,h));
        if(i)for(let j=0;j<4;j++)faces.push([(i-1)*4+j,(i-1)*4+(j+1)%4,i*4+(j+1)%4,i*4+j]);
      }
      faces.push([3,2,1,0],[n*4,n*4+1,n*4+2,n*4+3]);
      parts.push({name:name+'_curved_back',type:'mesh',vertices,faces,material:'chair_shell',category:'furniture'});
    }
    const settings=[];
    for(const [side,cy,angle,py] of [['north',table.y-.48,0,table.y+.21],['south',table.y+table.d+.48,Math.PI,table.y+table.d-.21]]) {
      for(let i=0;i<3;i++) {
        const px=table.x+.5+i*(table.w-1)/2;
        chair('chair_'+side+'_'+i,px,cy,angle);
        settings.push({name:side+'_'+i,x:px,y:py,glassX:px+.16,glassY:py+(side==='north'?.15:-.15)});
      }
    }
    chair('chair_west',table.x-.48,table.y+table.d/2,-Math.PI/2);
    chair('chair_east',table.x+table.w+.48,table.y+table.d/2,Math.PI/2);
    settings.push({name:'west',x:table.x+.2,y:table.y+table.d/2,glassX:table.x+.37,glassY:table.y+table.d/2-.15},
      {name:'east',x:table.x+table.w-.2,y:table.y+table.d/2,glassX:table.x+table.w-.37,glassY:table.y+table.d/2+.15});
    for(const setting of settings) {
      lathe('plate_'+setting.name,[setting.x,setting.y,tableTop],[[0,.003],[.072,.003],[.09,.009],[.12,.024],[.125,.027],[.12,.032],[.085,.017],[0,.013]],'ceramic');
      lathe('glass_'+setting.name,[setting.glassX,setting.glassY,tableTop],[[0,0],[.031,0],[.034,.095],[.031,.095],[.028,.006],[0,.006]],'glass');
    }
    lathe('serving_bowl', [table.x + table.w / 2, table.y + table.d / 2, tableTop],
      [[0,0], [0.09,0], [0.17,0.08], [0.164,0.088], [0.083,0.013], [0,0.013]], 'ceramic');

    const fixtureX = table.x + table.w / 2, fixtureY = table.y + table.d / 2;
    box('pendant_anchor', fixtureX - 0.6, fixtureY - 0.05, 2.69, 1.2, 0.1, 0.04, 'steel', 'roof');
    for (const [i, px] of [fixtureX - 0.45, fixtureX + 0.45].entries()) {
      cylinder(`pendant_cord_${i}`, [px, fixtureY, 2.34], 0.004, 0.7, 'steel', 'z', 'roof');
    }
    box('pendant_body', fixtureX - 0.62, fixtureY - 0.09, 1.95, 1.24, 0.18, 0.06, 'steel', 'roof', 0.012);
    box('pendant_diffuser', fixtureX - 0.59, fixtureY - 0.065, 1.938, 1.18, 0.13, 0.012, 'lamp', 'roof');
    for (let i = 0; i < 3; i++) lights.push({ name: `pergola_pendant_${i}`, category: 'roof',
      position: [fixtureX - 0.4 + i * 0.4, fixtureY, 1.91], color: '#ffd4a0', power: 9 });
    for (const [i, py] of [y + postInset + 0.08, y + d - postInset - 0.1].entries()) {
      box(`beam_light_${i}`, x + 0.9, py, beamBottom - 0.015, w - 1.8, 0.02, 0.015, 'lamp');
      lights.push({ name: `pergola_beam_light_${i}`, position: [x + w / 2, py, 2.24], color: '#ffd4a0', power: 8 });
    }
    const plantingClearances = [
      { x: paving.x - 0.08, y: paving.y - 0.08, w: paving.w + 0.16, d: paving.d + 0.16 },
      { x: x + 1.72, y: y + d - 0.2, w: 1.2, d: 1.35 },
      { x: x + w - 0.2, y: y + 2.7, w: 1.1, d: 1.1 },
    ];
    const panel = screens.build({ name: 'pergola_privacy_north', start: [x + postInset, y + postInset],
      end: [x + w - postInset, y + postInset], side: 'north', category: 'structure' });
    parts.push(...panel.parts);
    Object.assign(materials, panel.materials);
    return { name: 'Pergola dining', materials, parts, lights, floorHeight, groundPatch, plantingClearances, diningSeats,
      diningTable: { center: tableCenter, width: table.w, depth: table.d, height: tableTop, feet: tableFeet }, privacyScreens: [panel.screen] };
  }
  return { build };
})();
if (typeof module !== 'undefined') module.exports = { PergolaModel };
