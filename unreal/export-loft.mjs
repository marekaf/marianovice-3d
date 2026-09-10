import {prepareExportScene} from './export-scene.mjs';

export function prepareLoftExport(THREE,loft,houseFloorY=2.465) {
  const sharedWithHouse=new Set(['opening_gable_0','Loft room details_structure_flue']);
  function meshCount(object){
    if(!object||sharedWithHouse.has(object.name)||object.isLight||object.isLine||object.isSprite)return 0;
    return (object.isInstancedMesh?object.count:object.isMesh?1:0)+object.children.reduce((sum,child)=>sum+meshCount(child),0);
  }
  const root=loft.root.clone(true);
  root.visible=true;
  root.position.y+=houseFloorY;
  for(const child of root.children)child.visible=true;
  root.traverse(object=>{
    if(sharedWithHouse.has(object.name))object.visible=false;
  });
  const origin=[loft.dims.originPlot.x,houseFloorY,loft.dims.originPlot.z];
  const exported=prepareExportScene(THREE,[{name:'loft',object:root}],origin);
  const sourceMeshes=meshCount(loft.root);
  if(exported.manifest.meshes!==sourceMeshes)throw new Error(`Loft export omitted source meshes: ${exported.manifest.meshes}/${sourceMeshes}`);
  exported.manifest.sourceMeshes=sourceMeshes;
  exported.manifest.coverage=Object.fromEntries(['floor','ceiling','furniture','int'].map(key=>[key,meshCount(loft[key])]));
  return exported;
}
