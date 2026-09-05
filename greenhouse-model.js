const GreenhouseModel = (() => {
  function build(garden, terrainPlane) {
    const rect = garden.elements.find(e => e.id === 'greenhouse').parts.find(p => p.kind === 'rect');
    const { x, y, w, d } = rect, cx = x + w / 2;
    const floorHeight = Math.max(...[x,x+w].flatMap(px => [y,y+d].map(py =>
      Math.max(0,terrainPlane.a*px+terrainPlane.b*py+terrainPlane.c)))) + 0.04;
    const dwarfH = 0.4, eave = 1.9, ridge = 2.65, frame = 0.035, wallT = 0.12;
    const roofAt = px => eave + (1 - Math.abs(px-cx)/(w/2))*0.75;
    const doorX = cx - 0.45, doorW = 0.9, doorH = 2;
    const materials = {
      masonry: { color: '#9c9180', roughness: 0.92 },
      joints: { color: '#c3b9a8', roughness: 0.95 },
      floor: { color: '#b7b2a7', roughness: 0.85 },
      aluminum: { color: '#c3ccca', roughness: 0.33, metalness: 0.78 },
      hardware: { color: '#5e6869', roughness: 0.32, metalness: 0.8 },
      glass: { color: '#eef7f3', roughness: 0.025, transmission: 1 },
      terracotta: { color: '#af704f', roughness: 0.86 },
      tray: { color: '#404f43', roughness: 0.8 },
      soil: { color: '#44382b', roughness: 0.99 },
      leaf: { color: '#5e8544', roughness: 0.86 },
      leafLight: { color: '#7c9e58', roughness: 0.88 },
    };
    for (const axis of ['x','y','z']) materials['timber_'+axis] = { color: '#a48760', roughness: 0.76, grain: axis };
    const parts = [], lights = [];
    const box = (name, px, py, pz, width, depth, height, material, category = 'structure', bevel = 0.002) => {
      parts.push({ name,type:'box',position:[px+width/2,py+depth/2,pz+height/2],size:[width,depth,height],material,category,bevel });
    };
    const beam = (name,start,end,width,depth,material='aluminum',category='structure') => {
      parts.push({name,type:'beam',start,end,width,depth,material,category,bevel:0.001});
    };
    const cylinder = (name,position,radius,height,material,category='structure',axis='z') => {
      parts.push({name,type:'cylinder',position,radiusTop:radius,radiusBottom:radius,height,material,category,axis,segments:24});
    };
    const pane = (name,outline,offset,category='structure') => {
      const vertices = [...outline,...outline.map(p=>p.map((v,i)=>v+offset[i]))], n=outline.length;
      const faces = [Array.from({length:n},(_,i)=>n-1-i),Array.from({length:n},(_,i)=>n+i)];
      for(let i=0;i<n;i++) faces.push([i,(i+1)%n,(i+1)%n+n,i+n]);
      parts.push({name,type:'mesh',vertices,faces,material:'glass',category});
    };
    box('greenhouse_floor',x,y,-0.075,w,d,0.075,'floor');
    const wall = (name,px,py,width,depth) => {
      const courseHeight=(dwarfH-0.025)/4;
      for(let course=0;course<4;course++) {
        const bottom=course*courseHeight+(course?0.004:0),top=(course+1)*courseHeight-(course<3?0.004:0);
        box(`${name}_course_${course}`,px,py,bottom,width,depth,top-bottom,'masonry');
        if(course>0) box(`${name}_joint_${course}`,px,py,course*courseHeight-0.004,width,depth,0.008,'joints','structure',0);
      }
      box(`${name}_cap`,px-0.005,py-0.005,dwarfH-0.025,width+0.01,depth+0.01,0.025,'masonry');
    };
    wall('dwarf_west',x,y,wallT,d);
    wall('dwarf_east',x+w-wallT,y,wallT,d);
    wall('dwarf_south',x+wallT,y+d-wallT,w-2*wallT,wallT);
    wall('dwarf_north_left',x+wallT,y,doorX-x-wallT,wallT);
    wall('dwarf_north_right',doorX+doorW,y,x+w-wallT-doorX-doorW,wallT);
    const bays = 6, bay = (d-frame)/bays;
    for(const [side,px] of [['west',x+frame/2],['east',x+w-frame/2]]) {
      for(let i=0;i<=bays;i++) box(`${side}_mullion_${i}`,px-frame/2,y+i*bay,dwarfH,frame,frame,eave-dwarfH,'aluminum');
      for(const [i,pz] of [dwarfH,eave-frame].entries()) box(`${side}_rail_${i}`,px-frame/2,y,pz,frame,d,frame,'aluminum');
      for(let i=0;i<bays;i++) {
        const py=y+i*bay+frame, depth=bay-frame;
        box(`${side}_glass_${i}`,px-0.003,py,dwarfH+frame,0.006,depth,eave-dwarfH-2*frame,'glass', 'structure',0);
      }
    }
    for(const [side,py] of [['north',y+frame/2],['south',y+d-frame/2]]) {
      const splits=side==='north'?[x+frame,doorX-frame,doorX+doorW+frame,x+w-frame]:[x+frame,cx-frame/2,cx+frame/2,x+w-frame];
      for(const [i,[left,right]] of [[splits[0],splits[1]],[splits[2],splits[3]]].entries()) {
        box(`${side}_pane_${i}`,left,py-0.003,dwarfH+frame,right-left,0.006,eave-dwarfH-2*frame,'glass', 'structure',0);
        box(`${side}_sill_${i}`,left,py-frame/2,dwarfH,right-left,frame,frame,'aluminum');
        box(`${side}_eave_${i}`,left,py-frame/2,eave-frame,right-left,frame,frame,'aluminum');
      }
      if(side==='south') box('south_center_mullion',cx-frame/2,py-frame/2,dwarfH,frame,frame,ridge-dwarfH,'aluminum');
      const left=x+frame, right=x+w-frame, low=eave+0.008;
      if(side==='south') {
        pane('south_gable_left',[[left,py,low],[cx-frame/2,py,low],[cx-frame/2,py,roofAt(cx-frame/2)-0.025],[left,py,roofAt(left)-0.012]],[0,-0.006,0]);
        pane('south_gable_right',[[cx+frame/2,py,low],[right,py,low],[right,py,roofAt(right)-0.012],[cx+frame/2,py,roofAt(cx+frame/2)-0.025]],[0,-0.006,0]);
      } else {
        pane('north_gable_left',[[left,py,low],[doorX-frame,py,low],[doorX-frame,py,roofAt(doorX-frame)-0.025],[left,py,roofAt(left)-0.012]],[0,-0.006,0]);
        pane('north_gable_right',[[doorX+doorW+frame,py,low],[right,py,low],[right,py,roofAt(right)-0.012],[doorX+doorW+frame,py,roofAt(doorX+doorW+frame)-0.025]],[0,-0.006,0]);
        pane('north_door_transom',[[doorX,py,doorH+frame],[doorX+doorW,py,doorH+frame],
          [doorX+doorW,py,roofAt(doorX+doorW)-0.025],[cx,py,ridge-0.025],[doorX,py,roofAt(doorX)-0.025]],[0,-0.006,0]);
      }
      beam(`${side}_gable_frame_left`,[x+frame/2,py,eave],[cx,py,ridge],frame,frame);
      beam(`${side}_gable_frame_right`,[cx,py,ridge],[x+w-frame/2,py,eave],frame,frame);
    }
    for(const [i,px] of [doorX-frame,doorX+doorW].entries()) box(`door_jamb_${i}`,px,y,0,frame,frame,roofAt(px)-0.02,'aluminum');
    box('door_head',doorX,y,doorH,doorW,frame,frame,'aluminum');
    box('door_threshold',doorX,y,0,doorW,0.11,0.012,'hardware');
    for(const [i,px] of [doorX+0.008,doorX+doorW-0.038].entries()) box(`door_stile_${i}`,px,y+0.005,0.015,0.03,0.025,doorH-0.03,'aluminum');
    for(const [i,pz] of [0.015,doorH-0.045].entries()) box(`door_rail_${i}`,doorX+0.008,y+0.005,pz,doorW-0.016,0.025,0.03,'aluminum');
    box('door_glass',doorX+0.04,y+0.014,0.047,doorW-0.08,0.006,doorH-0.094,'glass','structure',0);
    for(const pz of [0.25,1,1.75]) cylinder(`door_hinge_${pz}`,[doorX+0.009,y+0.034,pz],0.009,0.06,'hardware');
    cylinder('door_handle',[doorX+doorW-0.08,y+0.048,0.98],0.009,0.13,'hardware','structure','x');
    for(const [i,px] of [doorX+doorW-0.13,doorX+doorW-0.03].entries()) cylinder(`door_handle_mount_${i}`,[px,y+0.032,0.98],0.008,0.032,'hardware','structure','y');
    box('entrance_pad',doorX-0.12,y-0.38,-0.3,doorW+0.24,0.38,0.3,'floor');

    beam('ridge_bar',[cx,y,ridge],[cx,y+d,ridge],0.045,0.045,'aluminum','roof');
    const ventBay = 2;
    for(const [side,left,right] of [['west',x+frame/2,cx],['east',cx,x+w-frame/2]]) {
      for(let i=0;i<=bays;i++) {
        const py=y+frame/2+i*bay;
        beam(`${side}_rafter_${i}`,[left,py,roofAt(left)],[right,py,roofAt(right)],frame,frame,'aluminum','roof');
      }
      for(let i=0;i<bays;i++) {
        if(side==='east'&&i===ventBay) continue;
        const a=left+0.025,b=right-0.025,py=y+frame+i*bay, endY=y+(i+1)*bay;
        pane(`roof_glass_${side}_${i}`,[[a,py,roofAt(a)],[b,py,roofAt(b)],[b,endY,roofAt(b)],[a,endY,roofAt(a)]],[0,0,0.006],'roof');
      }
    }
    const ventY=y+frame+ventBay*bay, ventD=bay-frame, ventLeft=cx+0.025, ventClosedRight=x+w-frame/2-0.025;
    const ventHinge=roofAt(ventLeft), ventAngle=0.14;
    const ventDx=ventClosedRight-ventLeft, ventDz=roofAt(ventClosedRight)-ventHinge;
    const ventRight=ventLeft+ventDx*Math.cos(ventAngle)-ventDz*Math.sin(ventAngle);
    const ventEnd=ventHinge+ventDx*Math.sin(ventAngle)+ventDz*Math.cos(ventAngle);
    for(const [i,py] of [ventY,ventY+ventD].entries()) beam(`vent_side_${i}`,[ventLeft,py,ventHinge],[ventRight,py,ventEnd],0.025,0.025,'aluminum','roof');
    for(const [i,px,pz] of [[0,ventLeft,ventHinge],[1,ventRight,ventEnd]]) beam(`vent_end_${i}`,[px,ventY,pz],[px,ventY+ventD,pz],0.025,0.025,'aluminum','roof');
    const ventAt=px=>ventHinge+(px-ventLeft)/(ventRight-ventLeft)*(ventEnd-ventHinge);
    pane('vent_glass',[[ventLeft+0.02,ventY+0.02,ventAt(ventLeft+0.02)],
      [ventRight-0.02,ventY+0.02,ventAt(ventRight-0.02)],[ventRight-0.02,ventY+ventD-0.02,ventAt(ventRight-0.02)],
      [ventLeft+0.02,ventY+ventD-0.02,ventAt(ventLeft+0.02)]],[0,0,0.006],'roof');
    for(const [i,py] of [ventY+0.07,ventY+ventD-0.07].entries()) cylinder(`vent_hinge_${i}`,[ventLeft,py,ventHinge],0.012,0.08,'hardware','roof','y');
    const fixedX=ventClosedRight-0.1,movingX=ventRight-0.11,mountY=ventY+ventD/2;
    const fixedZ=roofAt(fixedX),movingZ=ventAt(movingX)-0.018;
    beam('vent_fixed_crossbar',[fixedX,ventY-frame/2,fixedZ],[fixedX,ventY+ventD+frame/2,fixedZ],0.03,0.025,'aluminum','roof');
    beam('vent_moving_crossbar',[movingX,ventY,movingZ],[movingX,ventY+ventD,movingZ],0.03,0.025,'aluminum','roof');
    box('vent_fixed_bracket',fixedX-0.014,mountY-0.018,fixedZ-0.004,0.028,0.036,0.04,'hardware','roof');
    box('vent_moving_bracket',movingX-0.014,mountY-0.018,movingZ-0.036,0.028,0.036,0.04,'hardware','roof');
    cylinder('vent_fixed_pin',[fixedX,mountY,fixedZ+0.028],0.008,0.045,'hardware','roof','y');
    cylinder('vent_moving_pin',[movingX,mountY,movingZ-0.028],0.008,0.045,'hardware','roof','y');
    beam('vent_opener',[fixedX,mountY,fixedZ+0.028],[movingX,mountY,movingZ-0.028],0.014,0.014,'hardware','roof');
    for(const [side,px] of [['west',x-0.045],['east',x+w-0.015]]) {
      box(`${side}_gutter_base`,px,y,eave-0.04,0.06,d,0.012,'aluminum','roof');
      box(`${side}_gutter_edge`,side==='west'?px:px+0.05,y,eave-0.04,0.01,d,0.055,'aluminum','roof');
      for(const [i,py] of [y,y+d-0.01].entries()) box(`${side}_gutter_cap_${i}`,px,py,eave-0.04,0.06,0.01,0.055,'aluminum','roof');
    }
    cylinder('downpipe',[x+w+0.025,y+d-0.07,(eave-0.028)/2],0.018,eave-0.028,'aluminum');
    for(const pz of [0.45,1.35]) box(`downpipe_bracket_${pz}`,x+w-0.015,y+d-0.095,pz,0.05,0.05,0.015,'hardware');

    const benchX=x+w-0.68, benchY=y+0.5, benchW=0.5, benchD=d-1, benchH=0.8;
    for(let i=0;i<4;i++) box(`bench_top_${i}`,benchX+i*benchW/4,benchY,benchH-0.035,benchW/4-0.004,benchD,0.035,'timber_y','furniture');
    for(const [i,px] of [benchX+0.025,benchX+benchW-0.07].entries()) for(const [j,py] of [benchY+0.035,benchY+benchD-0.08].entries())
      box(`bench_leg_${i}_${j}`,px,py,0,0.045,0.045,benchH-0.035,'timber_z','furniture');
    for(const [i,px] of [benchX+0.025,benchX+benchW-0.07].entries()) {
      box(`bench_apron_${i}`,px,benchY+0.035,benchH-0.105,0.045,benchD-0.07,0.07,'timber_y','furniture');
      box(`bench_shelf_support_${i}`,px,benchY+0.035,0.16,0.045,benchD-0.07,0.045,'timber_y','furniture');
    }
    box('bench_shelf',benchX+0.025,benchY+0.035,0.205,benchW-0.05,benchD-0.07,0.025,'timber_y','furniture');
    for(let t=0;t<3;t++) {
      const tx=benchX+0.045,ty=benchY+0.13+t*0.77,tw=0.4,td=0.48;
      box(`tray_${t}_bottom`,tx,ty,benchH,tw,td,0.012,'tray','furniture');
      for(const [i,px] of [tx,tx+tw-0.012].entries()) box(`tray_${t}_side_${i}`,px,ty,benchH+0.012,0.012,td,0.075,'tray','furniture');
      for(const [i,py] of [ty,ty+td-0.012].entries()) box(`tray_${t}_end_${i}`,tx+0.012,py,benchH+0.012,tw-0.024,0.012,0.075,'tray','furniture');
      box(`tray_${t}_soil`,tx+0.015,ty+0.015,benchH+0.012,tw-0.03,td-0.03,0.05,'soil','furniture',0);
      for(let i=0;i<6;i++) {
        const px=tx+0.1+(i%2)*0.2,py=ty+0.09+Math.floor(i/2)*0.15,height=0.08+(i%3)*0.014;
        cylinder(`seedling_${t}_${i}_stem`,[px,py,benchH+0.062+height/2],0.003,height,'leaf','furniture');
        for(const [j,sign] of [-1,1].entries()) {
          const leafZ=benchH+0.062+height*(j?0.8:0.6),leafX=px+sign*0.025;
          parts.push({name:`seedling_${t}_${i}_leaf_${j}`,type:'sphere',position:[leafX,py,leafZ],size:[0.057,0.022,0.012],
            material:j?'leafLight':'leaf',category:'furniture'});
        }
      }
    }
    for(let i=0;i<4;i++) {
      const px=benchX+benchW/2,py=benchY+0.3+i*0.55,r=0.11,h=0.18;
      parts.push({name:`pot_${i}`,type:'lathe',position:[px,py,0.23],segments:40,material:'terracotta',category:'furniture',
        profile:[[0,0],[r*0.66,0],[r*0.7,0.015],[r,h-0.018],[r*1.03,h-0.018],[r*1.03,h],
          [r*0.88,h],[r*0.63,0.02],[0,0.02]]});
      cylinder(`pot_${i}_soil`,[px,py,0.23+h-0.025],r*0.85,0.018,'soil','furniture');
    }
    return {name:'Greenhouse',materials,parts,lights,floorHeight,
      groundPatch:{x,y,w,d,level:floorHeight-0.04,blend:0.6},
      plantingClearances:[{x:x-0.08,y:y-0.08,w:w+0.16,d:d+0.16},{x:doorX-0.15,y:y-0.65,w:doorW+0.3,d:0.65}],
      openings:[{name:'door',wall:'N',from:doorX,w:doorW,h:doorH,bottom:0,top:doorH}]};
  }
  return {build};
})();
if(typeof module!=='undefined') module.exports={GreenhouseModel};
