export function prepareGardenDetails(THREE,roots,origin,{maxVertices=180000}={}) {
  if(!Number.isInteger(maxVertices)||maxVertices<3)throw new Error('Invalid garden batch size');
  const selected=new Set();
  for(const {object}of roots){if(selected.has(object))throw new Error('Duplicate garden root');selected.add(object);}
  for(const {object}of roots)for(let parent=object.parent;parent;parent=parent.parent)if(selected.has(parent))throw new Error('Overlapping garden roots');
  const scene=new THREE.Scene(),batches=new Map(),materials=new Map(),sourceBatches=new WeakMap(),coverage={};
  const offset=new THREE.Matrix4().makeTranslation(-origin[0],-origin[1],-origin[2]);
  const point=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3(),tint=new THREE.Color();
  let sourceMeshes=0,sourceInstances=0,skippedZeroScale=0,vertices=0;
  function flush(batch){
    if(!batch.position.length)return;
    const geometry=new THREE.BufferGeometry();
    for(const [name,size]of [['position',3],['normal',3],['uv',2],['uv1',2],['color',4]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(batch[name],size));
    const attributes=Object.entries(geometry.attributes),unique=new Map(),indices=[],values=Object.fromEntries(attributes.map(([name])=>[name,[]]));
    for(let i=0;i<geometry.attributes.position.count;i++){
      const key=attributes.map(([,attribute])=>Array.from(attribute.array.subarray(i*attribute.itemSize,(i+1)*attribute.itemSize)).join(',')).join('|');
      let index=unique.get(key);
      if(index===undefined){index=unique.size;unique.set(key,index);for(const [name,attribute]of attributes)for(let j=0;j<attribute.itemSize;j++)values[name].push(attribute.array[i*attribute.itemSize+j]);}
      indices.push(index);
    }
    for(const [name,attribute]of attributes)geometry.setAttribute(name,new THREE.Float32BufferAttribute(values[name],attribute.itemSize));
    geometry.setIndex(indices);
    const mesh=new THREE.Mesh(geometry,batch.material);mesh.name=`detail_${batch.rootName}_${scene.children.length}`;mesh.userData.detailCategory=batch.rootName;scene.add(mesh);
    for(const name of ['position','normal','uv','uv1','color'])batch[name]=[];
  }
  function batchFor(source,rootName){
    if(!sourceBatches.has(source))sourceBatches.set(source,new Map());
    const cached=sourceBatches.get(source);if(cached.has(rootName))return cached.get(rootName);
    const definition=source.toJSON();delete definition.uuid;delete definition.name;delete definition.metadata;delete definition.textures;delete definition.images;delete definition.userData;
    delete definition.color;delete definition.vertexColors;delete definition.envMap;
    const key=rootName+JSON.stringify(definition);
    if(!batches.has(key)){
      const material=source.clone();material.name=`garden_material_${materials.size}`;material.envMap=null;material.userData={};material.color?.set(0xffffff);material.vertexColors=true;
      materials.set(key,material);batches.set(key,{rootName,material,position:[],normal:[],uv:[],uv1:[],color:[]});
    }
    cached.set(rootName,batches.get(key));return batches.get(key);
  }
  for(const {name,object}of roots){
    coverage[name]={meshes:0,instances:0,vertices:0};object.updateWorldMatrix(true,true);
    object.traverseVisible(source=>{
      if(!source.isMesh)return;
      if(source.isSkinnedMesh||Object.keys(source.geometry.morphAttributes).length)throw new Error('Garden export requires static geometry');
      sourceMeshes++;coverage[name].meshes++;
      const geometry=source.geometry.clone();if(!geometry.attributes.normal)geometry.computeVertexNormals();
      const p=geometry.attributes.position,n=geometry.attributes.normal,c=geometry.attributes.color,uv=geometry.attributes.uv,uv1=geometry.attributes.uv1,index=geometry.index;
      const total=index?index.count:p.count,groups=Array.isArray(source.material)?geometry.groups:[{start:0,count:total,materialIndex:0}];
      const instance=new THREE.Matrix4(),matrix=new THREE.Matrix4();
      for(let i=0;i<(source.isInstancedMesh?source.count:1);i++){
        matrix.copy(offset).multiply(source.matrixWorld);
        if(source.isInstancedMesh){source.getMatrixAt(i,instance);matrix.multiply(instance);}
        if(Math.abs(matrix.determinant())<1e-14){skippedZeroScale++;continue;}
        sourceInstances++;coverage[name].instances++;normalMatrix.getNormalMatrix(matrix);
        const corners=matrix.determinant()<0?[0,2,1]:[0,1,2];
        tint.set(0xffffff);if(source.isInstancedMesh&&source.instanceColor)source.getColorAt(i,tint);
        for(const group of groups){
          const material=Array.isArray(source.material)?source.material[group.materialIndex]:source.material;
          if(!material||!material.visible)continue;
          const batch=batchFor(material,name),base=material.color||new THREE.Color(0xffffff);
          const start=Math.max(group.start,geometry.drawRange.start),end=Math.min(total,group.start+group.count,geometry.drawRange.start+geometry.drawRange.count);
          for(let t=start;t+2<end;t+=3){
            if(batch.position.length/3+3>maxVertices)flush(batch);
            for(const corner of corners){
              const j=index?index.getX(t+corner):t+corner;
              point.fromBufferAttribute(p,j).applyMatrix4(matrix);normal.fromBufferAttribute(n,j).applyMatrix3(normalMatrix).normalize();
              batch.position.push(point.x,point.y,point.z);batch.normal.push(normal.x,normal.y,normal.z);
              batch.uv.push(uv?uv.getX(j):0,uv?uv.getY(j):0);batch.uv1.push(uv1?uv1.getX(j):0,uv1?uv1.getY(j):0);
              batch.color.push(base.r*tint.r*(material.vertexColors&&c?c.getX(j):1),base.g*tint.g*(material.vertexColors&&c?c.getY(j):1),base.b*tint.b*(material.vertexColors&&c?c.getZ(j):1),material.vertexColors&&c?.itemSize===4?c.getW(j):1);
              vertices++;coverage[name].vertices++;
            }
          }
        }
      }
      geometry.dispose();
    });
  }
  for(const batch of batches.values())flush(batch);
  scene.updateMatrixWorld(true);
  return {scene,manifest:{units:'metres',upAxis:'Y',sourceOrigin:origin,roots:roots.map(root=>root.name),coverage,sourceMeshes,sourceInstances,skippedZeroScale,vertices,indexedVertices:scene.children.reduce((sum,mesh)=>sum+mesh.geometry.attributes.position.count,0),meshes:scene.children.length,materials:materials.size}};
}
