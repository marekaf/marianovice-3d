export function entranceLanding(entry, origin, facadeX, floorY, groundY) {
  const threshold=entry.model.parts.find(part=>part.name.endsWith('_threshold'));
  const opening=entry.model.opening;
  return {x0:origin.x+threshold.position[0]+threshold.size[0]/2,x1:facadeX,
    z0:origin.z+opening.center-opening.width/2,z1:origin.z+opening.center+opening.width/2,
    y:floorY+.001,bottom:groundY};
}

const stairDepths=[.68,.34,.34],stairZ=[19.4,22.6];

export function entrancePavingDatum(garden,sampleFinish) {
  const facadeX=garden.elements.find(element=>element.id==='house').meta.eNotch[0];
  const carport=garden.elements.find(element=>element.id==='carport').parts.find(part=>part.kind==='rect');
  const xs=[Math.max(facadeX,carport.x),Math.min(facadeX+stairDepths.reduce((sum,depth)=>sum+depth,0),carport.x+carport.w)];
  const zs=[Math.max(stairZ[0],carport.y),Math.min(stairZ[1],carport.y+carport.d)];
  if(xs[0]>xs[1]||zs[0]>zs[1])throw new Error('Entrance stairs must meet the carport pavement');
  const levels=xs.flatMap(x=>zs.map(z=>sampleFinish(x,z)));
  if(!levels.every(Number.isFinite))throw new Error('Entrance pavement requires finite finish levels');
  return Math.min(...levels);
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
  for(const [index,depth] of stairDepths.entries()){
    const surface={x0,x1:x0+depth,z0:stairZ[0],z1:stairZ[1],y:floorY-(floorY-pavingY)*index/3};
    add(`entrance_step_${index}`,surface);walkSurfaces.push(surface);x0+=depth;
  }
  return {name:'house_entrance_stairs',floorHeight:0,materials:{stairFinish:{color:'#b9b4ab',roughness:.9}},parts,lights:[],walkSurfaces};
}
