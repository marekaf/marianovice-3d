const SelectedPlanting = (() => {
  function createMaple(THREE, TreeModel, element, heightAt, overlapsStructureAccess=()=>false) {
    const c=element.parts.find(p=>p.kind==='circle');
    if(overlapsStructureAccess(c.cx,c.cy,.7))throw new Error('Specimen maple planting pocket intersects access');
    const tree=TreeModel.create(THREE,{x:c.cx,z:c.cy,groundY:heightAt(c.cx,c.cy),height:5,form:'broad',leafHabit:'deciduous',overlapsStructureAccess});
    const bounds=new THREE.Box3().setFromObject(tree);
    const radius=Math.hypot(Math.max(c.cx-bounds.min.x,bounds.max.x-c.cx),Math.max(c.cy-bounds.min.z,bounds.max.z-c.cy));
    const scale=Math.min(1,c.canopyRadius/radius);tree.scale.set(scale,1,scale);
    tree.name='Specimen Freeman maple';
    Object.assign(tree.userData,{species:'Acer × freemanii',height:5,canopyRadius:c.canopyRadius});
    tree.traverse(mesh=>{if(mesh.userData.leafHabit)mesh.userData.autumnColor='#cd5830';});
    return tree;
  }
  function createRoses(THREE, element) {
    const {x,y,w,d}=element.parts.find(p=>p.kind==='rect');
    const floor=element.meta.grading.level+.1;
    const root=new THREE.Group();root.name='Pergola climbing roses';
    root.userData={species:'Rosa — climbing cultivars',trainedPosts:4,trainedBeams:2};
    const positions=[],leafTransforms=[],flowerTransforms=[],up=new THREE.Vector3(0,1,0);
    const transform=new THREE.Object3D();
    function stem(a,b,r=.012){
      const direction=b.clone().sub(a);
      const geometry=new THREE.CylinderGeometry(r*.75,r,direction.length(),5).toNonIndexed();
      geometry.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(up,direction.normalize()),new THREE.Vector3(1,1,1)));
      positions.push(...geometry.attributes.position.array);geometry.dispose();
    }
    function shoot(point,seed,roof=false){
      const spread=roof?.18+.11*(.5+.5*Math.sin(seed*1.73)): .09;
      for(let i=0;i<(roof?7+seed%4:5);i++){
        const angle=seed+i*2.4;
        const end=point.clone().add(new THREE.Vector3(Math.cos(angle)*spread,(roof?.13:.04)+i*.013,Math.sin(angle)*(roof?spread*.8:.09)));
        stem(point,end,.0025);
        transform.position.copy(end);transform.rotation.set(.3,angle,.4);transform.scale.set(roof?.07:.037,roof?.11:.06,roof?.035:.025);transform.updateMatrix();
        leafTransforms.push(transform.matrix.clone());
      }
      transform.position.copy(point).add(new THREE.Vector3(0,.09,0));transform.rotation.set(.6,seed,0);transform.scale.setScalar(.065);transform.updateMatrix();
      if(!roof||seed%3===0)flowerTransforms.push(transform.matrix.clone());
    }
    const corners=[[x+.27,y+.27],[x+w-.27,y+.27],[x+.27,y+d-.27],[x+w-.27,y+d-.27]];
    for(const [i,[px,pz]] of corners.entries()){
      const cx=px+(px<x+w/2?.28:-.28),cz=pz+(pz<y+d/2?.28:-.28);
      const pot=new THREE.Mesh(new THREE.CylinderGeometry(.25,.21,.5,12),new THREE.MeshStandardMaterial({color:'#6c5142',roughness:.92}));
      pot.position.set(cx,floor+.25,cz);pot.name='Rose container';root.add(pot);
      const soil=new THREE.Mesh(new THREE.CylinderGeometry(.233,.233,.02,12),new THREE.MeshStandardMaterial({color:'#352a20',roughness:1}));
      soil.position.set(cx,floor+.475,cz);root.add(soil);
      let previous=new THREE.Vector3(cx,floor+.49,cz);
      for(let n=1;n<=18;n++){
        const t=n/18,point=new THREE.Vector3(px+.025*Math.sin(t*22+i),floor+.49+t*1.95,pz+.025*Math.cos(t*22+i));
        stem(previous,point);shoot(point,i+n);previous=point;
      }
    }
    for(const pz of [y+.32,y+d-.32]){
      let previous=new THREE.Vector3(x+.32,floor+2.44,pz);
      for(let n=1;n<=30;n++){
        const point=new THREE.Vector3(x+.32+(w-.64)*n/30,floor+2.44+.025*Math.sin(n),pz);
        stem(previous,point);shoot(point,n);previous=point;
      }
    }
    for(let cane=0;cane<5;cane++){
      const px=x+[.6,1.7,2.9,4.05,5.35][cane],reverse=cane%2===1;
      const startZ=reverse?y+d-.32:y+.32,endZ=reverse?y+.6:y+d-(cane%3===0?.9:.55);
      let previous=new THREE.Vector3(px,floor+2.44,startZ);
      const rise=new THREE.Vector3(px,floor+2.83,startZ);stem(previous,rise);previous=rise;
      for(let n=1;n<=36;n++){
        const t=n/36,point=new THREE.Vector3(px+(.12+cane%3*.055)*Math.sin(t*7+cane)*Math.sin(t*Math.PI),floor+2.83+.025*Math.sin(t*8),startZ+(endZ-startZ)*t);
        stem(previous,point);
        if((n+cane*7)%23<18)shoot(point,cane*36+n,true);
        previous=point;
      }
    }
    const branches=new THREE.BufferGeometry();branches.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));branches.computeVertexNormals();
    const woody=new THREE.Mesh(branches,new THREE.MeshStandardMaterial({color:'#65503b',roughness:.95}));woody.name='Rose stems';root.add(woody);
    const leafGeometry=new THREE.SphereGeometry(1,5,3);
    const leaves=new THREE.InstancedMesh(leafGeometry,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.8}),leafTransforms.length);
    leaves.name='Rose leaves';leaves.userData.leafHabit='deciduous';
    leafTransforms.forEach((matrix,i)=>{leaves.setMatrixAt(i,matrix);leaves.setColorAt(i,new THREE.Color(i%2?'#416334':'#668446'));});root.add(leaves);
    const petals=[];
    for(let ring=0;ring<3;ring++)for(let i=0;i<7;i++){
      const a=i*Math.PI*2/7+ring*.45,r=1-ring*.24;
      petals.push(0,0,.18+ring*.15,Math.cos(a)*r,Math.sin(a)*r,.03,Math.cos(a+.8)*r,Math.sin(a+.8)*r,.03);
    }
    const blossom=new THREE.BufferGeometry();blossom.setAttribute('position',new THREE.Float32BufferAttribute(petals,3));blossom.computeVertexNormals();
    const flowers=new THREE.InstancedMesh(blossom,new THREE.MeshStandardMaterial({color:'#bf3453',roughness:.75,side:THREE.DoubleSide}),flowerTransforms.length);
    flowers.name='Rose flowers';flowers.userData.bloom=[6,7,8,9];flowerTransforms.forEach((m,i)=>flowers.setMatrixAt(i,m));root.add(flowers);
    root.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
    return root;
  }
  return {createMaple,createRoses};
})();
if(typeof module!=='undefined')module.exports={SelectedPlanting};
