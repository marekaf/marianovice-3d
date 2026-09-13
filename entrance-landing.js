export function entranceLanding(entry, origin, facadeX, floorY, groundY) {
  const threshold=entry.model.parts.find(part=>part.name.endsWith('_threshold'));
  const opening=entry.model.opening;
  return {x0:origin.x+threshold.position[0]+threshold.size[0]/2,x1:facadeX,
    z0:origin.z+opening.center-opening.width/2,z1:origin.z+opening.center+opening.width/2,
    y:floorY+.001,bottom:groundY};
}

export function buildEntranceStairs(house,garden,floorY,pavingY) {
  const entry=house.exteriorOpenings().find(item=>item.model.opening.kind==='entrance');
  if(!entry)throw new Error('House entrance opening is required for the stairs');
  if(!(floorY>pavingY))throw new Error('Entrance floor must be above the finished paving');
  const facadeX=garden.elements.find(element=>element.id==='house').meta.eNotch[0];
  const bridge=entranceLanding(entry,house.originPlot,facadeX,floorY,pavingY);
  const parts=[],walkSurfaces=[{x0:bridge.x0,x1:bridge.x1,z0:bridge.z0,z1:bridge.z1,y:floorY}];
  const add=(name,surface)=>parts.push({name,type:'box',position:[(surface.x0+surface.x1)/2,(surface.z0+surface.z1)/2,(surface.y+pavingY)/2],
    size:[surface.x1-surface.x0,surface.z1-surface.z0,surface.y-pavingY],material:'stairFinish',category:'structure',bevel:0});
  add('entrance_reveal_landing',bridge);
  let x0=facadeX;
  for(const [index,depth] of [.68,.34,.34].entries()){
    const surface={x0,x1:x0+depth,z0:19.4,z1:22.6,y:floorY-(floorY-pavingY)*index/3};
    add(`entrance_step_${index}`,surface);walkSurfaces.push(surface);x0+=depth;
  }
  return {name:'house_entrance_stairs',floorHeight:0,materials:{stairFinish:{color:'#b9b4ab',roughness:.9}},parts,lights:[],walkSurfaces};
}
