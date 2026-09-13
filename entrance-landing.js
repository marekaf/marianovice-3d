export function entranceLanding(entry, origin, facadeX, floorY, groundY) {
  const threshold=entry.model.parts.find(part=>part.name.endsWith('_threshold'));
  const opening=entry.model.opening;
  return {x0:origin.x+threshold.position[0]+threshold.size[0]/2,x1:facadeX,
    z0:origin.z+opening.center-opening.width/2,z1:origin.z+opening.center+opening.width/2,
    y:floorY+.001,bottom:groundY};
}
