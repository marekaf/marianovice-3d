import {createWalkDoors} from '../walk-doors.js';
import {createWalkLevels} from '../walk-levels.js';

export function createWalkHouseNavigation(THREE,{house,data,exteriorDoors,floorY,groundHeight,roof}) {
  const loft=house.loftFitout,loftDoors=house.loft.doors;
  const ground=createWalkDoors(THREE,{data,doors:[...exteriorDoors,...house.doors],floorY});
  const upper=createWalkDoors(THREE,{data:loft.data,doors:loftDoors,floorY:floorY+house.loft.dims.floorY});
  const controllers=[ground,upper],ceilingMeshes=[];
  for(const root of [house.loft.ceiling,roof])root.traverse(mesh=>{if(mesh.isMesh)ceilingMeshes.push(mesh);});
  const ray=new THREE.Raycaster(),direction=new THREE.Vector3(0,1,0),origin=new THREE.Vector3(),box=new THREE.Box3();
  const levels=createWalkLevels({data,loftData:loft.data,floorY,groundHeight,
    canStandAt:(x,z,y)=>controllers.every(controller=>controller.canStandAt(x,z,y)),
    headroomAt(x,z){
      origin.set(x,floorY+house.loft.dims.floorY+.05,z);ray.set(origin,direction);
      const hit=ray.intersectObjects(ceilingMeshes,false)[0];
      return hit?.point.y??Infinity;
    }});
  return {
    levels,
    reset(position){
      levels.reset(position);
      const s=data.stairs,o=data.originPlot,x=position.x-o.x,z=position.z-o.z;
      if(x>=s.x0&&x<s.x1&&z>=s.z0&&z<=s.z1){
        position.x=o.x+s.x0-.19;
        position.z=o.z+Math.max(s.z0+.18,Math.min(s.z1-.18,z));
      }
      ground.recover(position);levels.reset(position);
    },
    constrain:levels.constrain,
    aimedDoor(camera){
      const candidates=controllers.map(controller=>controller.aimedDoor(camera)).filter(Boolean);
      const distance=door=>box.setFromObject(door.userData.walkDoor.leaf).distanceToPoint(camera.position);
      return candidates.sort((a,b)=>distance(a)-distance(b))[0]??null;
    },
    toggle(door,camera){return controllers.find(controller=>controller.doors.includes(door)).toggle(door,camera);},
  };
}
