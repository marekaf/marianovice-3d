import {attachElectricalPoints} from './electrical-model.js';

export function outletOnFinishedSurface(point, panels=[]) {
  if(!point.resolved||point.normal[1])return point;
  const axis=point.normal[0]?0:2,sign=point.normal[axis];
  let offset=0;
  for(const panel of panels){
    const center=[panel.position[0],panel.position[2],panel.position[1]],size=[panel.size[0],panel.size[2],panel.size[1]];
    const back=center[axis]-sign*size[axis]/2;
    if(Math.abs(back-point.position[axis])>.001)continue;
    if(point.position.every((value,i)=>i===axis||value>=center[i]-size[i]/2&&value<=center[i]+size[i]/2))offset=Math.max(offset,size[axis]);
  }
  if(!offset)return point;
  const position=[...point.position];position[axis]+=sign*offset;
  return{...point,position,finishOffset:offset};
}

export function attachElectricalView(THREE, buildings, points, container, focus) {
  points=points.map(p=>outletOnFinishedSurface(p,buildings[p.building]?.finishPanels));
  const groups={};
  for(const [id,{house}] of Object.entries(buildings)){
    groups[id]=attachElectricalPoints(THREE,house,points.filter(p=>p.building===id&&p.resolved&&!p.occupiedBy));
  }
  const panel=document.createElement('details');
  panel.id='electrical';
  const summary=document.createElement('summary');summary.textContent='Sockets and data outlets';panel.append(summary);
  const toggles={};
  for(const [kind,label] of [['power','Power sockets'],['data','Data outlets'],['coax','Coax outlets']]){
    const row=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=true;input.id=`electrical-${kind}`;
    row.append(input,document.createTextNode(` ${label}`));panel.append(row);toggles[kind]=input;input.addEventListener('change',updateVisibility);
  }
  const counts=document.createElement('p');counts.id='electricalCounts';panel.append(counts);
  const select=document.createElement('select');select.id='electricalPoint';select.style.width='100%';select.setAttribute('aria-label','Electrical point');panel.append(select);
  const description=document.createElement('p');description.id='electricalDescription';panel.append(description);
  const button=document.createElement('button');button.textContent='View selected outlet';button.id='electricalFocus';panel.append(button);
  const note=document.createElement('small');note.textContent='Only resolved positions are drawn. Unresolved records remain listed. Frame appearance and module order are illustrative. Hide joinery to inspect concealed outlets.';panel.append(note);
  container.append(panel);
  let current=null;
  function selected(){return points.find(p=>p.id===select.value);}
  function describe(){
    const point=selected();
    button.disabled=!point?.resolved;
    description.textContent=!point?'No outlet records for this building.':point.resolved
      ?`${point.id}: ${point.count} ${point.kind} outlet${point.count===1?'':'s'}${point.switchCount?` + ${point.switchCount} switch`:''}, ${Math.round(point.position[1]*1000)} mm above finished floor.${point.occupiedBy?' Concealed by the modeled device.':''}`
      :`${point.id}: not drawn. ${point.reason}`;
  }
  function updateVisibility(){
    for(const [building,group]of Object.entries(groups))for(const fixture of group.children){
      const records=fixture.userData.records;
      const point=points.find(p=>p.id===records[0].id),wall=buildings[building].data?.extWalls?.find(w=>w.id===point.wallId);
      const wallVisible=!wall||buildings[building].house.walls[wall.face]?.visible!==false;
      fixture.visible=wallVisible&&records.some(r=>toggles[r.kind].checked);
      for(const mesh of fixture.children)if(mesh.userData.kind)mesh.visible=toggles[mesh.userData.kind==='switch'?'power':mesh.userData.kind].checked;
    }
  }
  select.addEventListener('change',describe);
  button.addEventListener('click',()=>{const point=selected();if(point?.resolved)focus(point);});
  function update(building){
    if(current!==building){
      const previous=selected();
      current=building;select.replaceChildren();
      const records=points.filter(p=>p.building===building),resolved=records.filter(p=>p.resolved);
      for(const point of points){const option=document.createElement('option');option.value=point.id;option.textContent=`${point.id} · ${point.building}${point.resolved?'':' · unresolved'}`;select.append(option);}
      if(previous?.building===building)select.value=previous.id;
      else if(records.length)select.value=records[0].id;
      counts.textContent=`${resolved.length}/${records.length} records placed in this building. ${points.filter(p=>p.resolved).length}/${points.length} placed overall.`;
      describe();
    }
    updateVisibility();
  }
  return{groups,points,panel,update};
}
