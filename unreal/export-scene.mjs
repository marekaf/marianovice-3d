export function prepareIntegratedLoft(house) {
  const loft=house.loft;
  if(loft?.root?.userData.furnishedLoft!==true)throw new Error('Full house export requires an integrated furnished loft');
  const ancestors=[];
  for(let node=loft.root;node&&node!==house.root;node=node.parent)ancestors.push(node);
  if(ancestors.at(-1)?.parent!==house.root)throw new Error('Furnished loft must belong to the exported house root');
  const groups={floor:loft.floor,furniture:loft.furniture,int:loft.int,ceiling:loft.ceiling};
  for(const [name,group]of Object.entries(groups))if(!group)throw new Error(`Integrated loft is missing its ${name} group`);
  const walls=Object.values(loft.walls||{});
  if(!walls.length)throw new Error('Integrated loft is missing its exterior walls');
  const visible=[house.root,...ancestors];
  for(const group of [...Object.values(groups),...walls]){
    let node=group;
    for(;node&&node!==loft.root;node=node.parent)visible.push(node);
    if(node!==loft.root)throw new Error('Integrated loft geometry must belong to its furnished root');
  }
  for(const group of visible)group.visible=true;
  const meshCount=group=>{
    let count=0;
    group.traverseVisible(object=>{if(object.isMesh&&object.geometry?.attributes.position?.count&&(!object.isInstancedMesh||object.count>0))count++;});
    return count;
  };
  const coverage=Object.fromEntries(Object.entries(groups).map(([name,group])=>[name,meshCount(group)]));
  coverage.walls=walls.reduce((count,group)=>count+meshCount(group),0);
  for(const [name,count]of Object.entries(coverage))if(!count)throw new Error(`Integrated loft has no visible ${name} geometry`);
  return coverage;
}

export function prepareExportScene(THREE,roots,origin,geometryOverrides=new Map()) {
  const sourceRoots=new Map();
  for(const {name,object}of roots){
    if(sourceRoots.has(object))throw new Error(`Duplicate export roots: ${sourceRoots.get(object)} and ${name}`);
    sourceRoots.set(object,name);
  }
  for(const {name,object}of roots)for(let ancestor=object.parent;ancestor;ancestor=ancestor.parent){
    if(sourceRoots.has(ancestor))throw new Error(`Overlapping export roots: ${sourceRoots.get(ancestor)} contains ${name}`);
  }
  const scene=new THREE.Scene();scene.name='House walkthrough import';
  const materials=new Map(),nodes=[],doors=[];
  const offset=new THREE.Matrix4().makeTranslation(-origin[0],-origin[1],-origin[2]);
  function material(source){
    if(!materials.has(source)){
      const copy=source.clone();copy.envMap=null;copy.userData={};
      if(source.name==='mirror'){copy.metalness=1;copy.roughness=.01;}
      copy.name=`material_${materials.size}_${source.name||source.type}`;
      materials.set(source,copy);
    }
    return materials.get(source);
  }
  function visit(source,parent,path,isRoot=false){
    if(!source.visible||source.isLight||source.isLine||source.isSprite)return;
    const node=new THREE.Group();node.name=path;node.matrixAutoUpdate=false;
    node.matrix.copy(isRoot?offset.clone().multiply(source.matrixWorld):source.matrix);
    parent.add(node);
    if(source.userData.walkDoor){
      const door=source.userData.walkDoor;
      doors.push({node:path,id:door.id,kind:door.model.doorMotion.kind||'hinge',motion:door.model.doorMotion});
    }
    function mesh(matrix,index){
      const mats=Array.isArray(source.material)?source.material.map(material):material(source.material);
      const output=new THREE.Mesh(geometryOverrides.get(source)||source.geometry,mats);output.name=`${path}_mesh${index}`;
      output.matrixAutoUpdate=false;output.matrix.copy(matrix);
      if(source.instanceColor){
        const color=new THREE.Color();source.getColorAt(index,color);
        output.material=Array.isArray(mats)?mats.map(m=>m.clone()):mats.clone();
        for(const m of [output.material].flat())m.color.multiply(color);
      }
      node.add(output);nodes.push(output.name);
    }
    if(source.isInstancedMesh){
      const matrix=new THREE.Matrix4();
      for(let i=0;i<source.count;i++){source.getMatrixAt(i,matrix);mesh(matrix,i);}
    }else if(source.isMesh)mesh(new THREE.Matrix4(),0);
    source.children.forEach((child,i)=>visit(child,node,`${path}_${i}_${child.name||'node'}`));
  }
  roots.forEach(({name,object})=>{
    object.updateWorldMatrix(true,true);visit(object,scene,name,true);
  });
  scene.updateMatrixWorld(true);
  return {scene,manifest:{units:'metres',upAxis:'Y',sourceOrigin:origin,meshes:nodes.length,doors,
    materials:[...materials.values()].map(m=>({name:m.name,color:m.color?.getHexString(),roughness:m.roughness,metalness:m.metalness,textured:!!m.map}))}};
}
