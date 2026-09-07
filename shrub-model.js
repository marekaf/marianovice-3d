const shared = new WeakMap();

function resources(THREE) {
  if(shared.has(THREE))return shared.get(THREE);
  const outline=[[0,-1,0],[-.42,-.55,0],[-.55,.05,0],[-.32,.65,0],[0,1,0],[.32,.65,0],[.55,.05,0],[.42,-.55,0],[0,0,.16]];
  const leaf=new THREE.BufferGeometry();
  leaf.setAttribute('position',new THREE.Float32BufferAttribute(outline.flat(),3));
  leaf.setIndex(Array.from({length:8},(_,i)=>[8,i,(i+1)%8]).flat());
  leaf.computeVertexNormals();
  const result={leaf,bark:new THREE.MeshStandardMaterial({color:'#77624b',roughness:.98}),
    foliage:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.88,side:THREE.DoubleSide})};
  shared.set(THREE,result);
  return result;
}

function create(THREE,{x=0,z=0,groundY=0,size=1,color=0x658449}={}) {
  if(![x,z,groundY,size].every(Number.isFinite)||size<=0)throw new Error('Shrub dimensions and position must be finite, with positive size');
  let state=Math.imul(Math.round(x*1000),73856093)^Math.imul(Math.round(z*1000),19349663);
  const random=()=>{state=Math.imul(state,1664525)+1013904223|0;return (state>>>0)/4294967296;};
  const radius=.72*size,height=1.5*size,positions=[],indices=[],sprays=[];
  const point=(angle,r,y)=>new THREE.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r);
  function branch(a,b,thickness) {
    const direction=b.clone().sub(a).normalize();
    const side=direction.clone().cross(new THREE.Vector3(Math.abs(direction.y)>.9?1:0,Math.abs(direction.y)>.9?0:1,0)).normalize();
    const across=direction.clone().cross(side).normalize(),start=positions.length/3;
    for(const [p,r] of [[a,thickness],[b,thickness*.4]])for(let j=0;j<6;j++) {
      const angle=j*Math.PI/3;
      const vertex=p.clone().addScaledVector(side,Math.cos(angle)*r).addScaledVector(across,Math.sin(angle)*r);
      positions.push(vertex.x,Math.max(0,vertex.y),vertex.z);
    }
    for(let j=0;j<6;j++){const next=(j+1)%6;indices.push(start+j,start+next,start+j+6,start+next,start+next+6,start+j+6);}
  }
  for(let stem=0;stem<8;stem++) {
    const angle=stem*Math.PI*.25+(random()-.5)*.35;
    let previous=point(angle,.035*size,0);
    const stemHeight=height*(.76+random()*.15);
    for(let tier=1;tier<=7;tier++) {
      const t=tier/7;
      const center=point(angle,radius*(.1+.26*Math.sin(t*Math.PI*.7)),stemHeight*t);
      branch(previous,center,size*(.018*(1-t)+.004));
      if(tier>1)for(const side of [-1,1]) {
        const turn=angle+side*(.6+random()*.8);
        const extent=radius*(.24+.2*Math.sin(t*Math.PI));
        const end=center.clone().add(point(turn,extent,height*(.015+random()*.035)));
        branch(center,end,.004*size);
        for(let pair=0;pair<8;pair++)for(const leafSide of [-1,1]) {
          const attach=center.clone().lerp(end,(pair+.5)/8);
          const leafAngle=turn+leafSide*1.1;
          sprays.push({center:attach.add(point(leafAngle,.038*size,0)),angle:leafAngle});
        }
      }
      previous=center;
    }
  }
  const material=resources(THREE),group=new THREE.Group();
  group.name='Branching shrub';
  group.position.set(x,groundY,z);
  Object.assign(group.userData,{plantingScale:.45,leafHabit:'deciduous',spread:radius,height});
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const skeleton=new THREE.Mesh(geometry,material.bark);
  skeleton.name='Shrub woody stems';
  const leaves=new THREE.InstancedMesh(material.leaf,material.foliage,sprays.length);
  leaves.name='Individual shrub leaves';
  leaves.userData.leafHabit='deciduous';
  const transform=new THREE.Object3D(),tint=new THREE.Color(color);
  for(let i=sprays.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[sprays[i],sprays[j]]=[sprays[j],sprays[i]];}
  sprays.forEach((spray,i)=>{
    const length=size*(.075+random()*.04),clearance=length*1.16;
    transform.position.copy(spray.center);
    const reach=Math.hypot(transform.position.x,transform.position.z);
    if(reach>radius-clearance){transform.position.x*=(radius-clearance)/reach;transform.position.z*=(radius-clearance)/reach;}
    transform.position.y=Math.max(clearance,Math.min(height-clearance,transform.position.y));
    transform.rotation.set(.5+random()*1.8,spray.angle,(random()-.5)*2);
    transform.scale.setScalar(length);transform.updateMatrix();
    leaves.setMatrixAt(i,transform.matrix);
    leaves.setColorAt(i,tint.clone().offsetHSL((random()-.5)*.025,(random()-.5)*.08,(random()-.5)*.1));
  });
  for(const mesh of [skeleton,leaves]){mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
  group.userData.leafCount=sprays.length;
  return group;
}

export const ShrubModel={create};
