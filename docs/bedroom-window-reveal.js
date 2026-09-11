export function buildBedroomWindowReveal(data) {
  const find=label=>data.furniture.find(f=>f.room==='1.12'&&f.label===label);
  const seat=find('okenní lavice 2×940'),upper=find('okno horní pás'),cushion=find('lavice polstr');
  const wall=data.extWalls.find(w=>w.id==='W8');
  const frame=data.buildOpening(wall,wall.openings[0],0).parts.find(p=>p.name==='opening_W8_0_frame_head');
  const frameX=frame.position[0]-frame.size[0]/2,panel=.018,x=seat.x1,depth=frameX-x;
  const bottom=(seat.y0??0)+seat.h,top=upper.y0,width=seat.z1-seat.z0;
  const parts=[],materials={cashmere:{color:'#b8b2a7',roughness:.75},mattress:{color:'#eeeae0',roughness:.94}};
  const box=(name,x,z,y,w,d,h,material='cashmere',bevel=.001)=>parts.push({
    name:`bedroom_window_${name}`,type:'box',position:[x+w/2,z+d/2,y+h/2],size:[w,d,h],material,bevel,category:'furniture'});
  box('reveal_north',x,seat.z0-panel,bottom,depth,panel,top-bottom);
  box('reveal_south',x,seat.z1,bottom,depth,panel,top-bottom);
  box('reveal_head',x,seat.z0-panel,top,depth,width+2*panel,panel);
  box('reveal_seat',x,seat.z0-panel,bottom-panel,depth,width+2*panel,panel);
  const cushionRearInset=seat.x1-cushion.x1;
  box('cushion',cushion.x0,cushion.z0,cushion.y0,frameX-cushionRearInset-cushion.x0,
    cushion.z1-cushion.z0,cushion.h,'mattress',.003);
  return {name:'Bedroom window reveal',floorHeight:0,parts,materials,lights:[]};
}
