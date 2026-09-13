const THREE=require('three');
const {SelectedPlanting}=require('./selected-planting.js');
function buildRoseModel(element) {
  const root=SelectedPlanting.createRoses(THREE,element),groups=new Map(),materials={};
  root.updateMatrixWorld(true);
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const geometry=mesh.geometry,position=geometry.attributes.position,index=geometry.index;
    for(let instance=0;instance<(mesh.isInstancedMesh?mesh.count:1);instance++){
      const matrix=mesh.matrixWorld.clone(),color=mesh.material.color.clone();
      if(mesh.isInstancedMesh){const local=new THREE.Matrix4();mesh.getMatrixAt(instance,local);matrix.multiply(local);if(mesh.instanceColor){const tint=new THREE.Color();mesh.getColorAt(instance,tint);color.multiply(tint);}}
      const key=mesh.name+color.getHexString();
      if(!groups.has(key)){
        const id='rose_material_'+groups.size;
        materials[id]={color:'#'+color.getHexString(),roughness:mesh.material.roughness,metalness:mesh.material.metalness};
        groups.set(key,{name:'pergola_rose_'+groups.size,type:'mesh',material:id,category:'planting',vertices:[],faces:[],...mesh.userData});
      }
      const part=groups.get(key),offset=part.vertices.length;
      for(let i=0;i<position.count;i++){const p=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(matrix);part.vertices.push([p.x,p.z,p.y]);}
      for(let i=0;i<(index?.count??position.count);i+=3)part.faces.push([2,1,0].map(j=>offset+(index?index.getX(i+j):i+j)));
    }
  });
  const geometries=new Set(),usedMaterials=new Set();root.traverse(mesh=>{if(mesh.isMesh){geometries.add(mesh.geometry);usedMaterials.add(mesh.material);}});
  for(const geometry of geometries)geometry.dispose();for(const material of usedMaterials)material.dispose();
  return {name:'Pergola climbing roses',floorHeight:0,parts:[...groups.values()],materials,lights:[],...root.userData};
}
module.exports={buildRoseModel};
