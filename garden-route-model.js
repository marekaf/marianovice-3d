const GardenRouteModel = (() => {
  const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  function triangulate(points) {
    const ring=points.map(p=>p.slice(0,2)),triangles=[];
    if(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0)<0)ring.reverse();
    while(ring.length>3){
      const ear=ring.findIndex((b,i)=>{
        const a=ring[(i+ring.length-1)%ring.length],c=ring[(i+1)%ring.length];
        return cross(a,b,c)>1e-10&&!ring.some(p=>p!==a&&p!==b&&p!==c&&cross(a,b,p)>=0&&cross(b,c,p)>=0&&cross(c,a,p)>=0);
      });
      if(ear<0)throw new Error('Hardscape outline cannot be triangulated');
      triangles.push([ring[(ear+ring.length-1)%ring.length],ring[ear],ring[(ear+1)%ring.length]]);ring.splice(ear,1);
    }
    triangles.push(ring);return triangles;
  }
  function surfaceExclusions(garden) {
    const ids=new Set(['house','garage','carport','eastTerrace','westTerrace','sauna','saunaShelter','saunaPath','driveway','greenhouse','raisedBedsPad','pond']);
    const parts=garden.elements.flatMap(e=>e.parts.filter(p=>ids.has(e.id)?['rect','polygon','ellipse'].includes(p.kind):e.id==='pergola'?p.role==='paving':e.id==='firePit'?p.kind==='circle'&&p.r>1:false));
    const greenhouse=garden.elements.find(e=>e.id==='greenhouse')?.parts.find(p=>p.kind==='rect');
    if(greenhouse)parts.push({kind:'rect',x:greenhouse.x+greenhouse.w/2-.57,y:greenhouse.y-.38,w:1.14,d:.38});
    return parts;
  }
  function outlines(parts) {
    return parts.flatMap(p=>{
      const points=p.kind==='rect'?[[p.x,p.y],[p.x+p.w,p.y],[p.x+p.w,p.y+p.d],[p.x,p.y+p.d]]
        :p.kind==='polygon'?p.points:Array.from({length:64},(_,i)=>[p.cx+(p.r??p.rx)*Math.cos(i*Math.PI/32),p.cy+(p.r??p.ry)*Math.sin(i*Math.PI/32)]);
      return triangulate(points).map(points=>({points,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))}));
    });
  }
  function halfPlane(points,a,b,inside) {
    const result=[];
    for(let i=0;i<points.length;i++){
      const p=points[i],q=points[(i+1)%points.length],dp=cross(a,b,p),dq=cross(a,b,q);
      const keepP=inside?dp>=0:dp<=0,keepQ=inside?dq>=0:dq<=0;
      if(keepP)result.push(p);
      if(keepP!==keepQ){const t=dp/(dp-dq);result.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
    }
    return result;
  }
  function subtract(points,obstacle) {
    if(points.every(p=>p[0]<=obstacle.minX)||points.every(p=>p[0]>=obstacle.maxX)||points.every(p=>p[1]<=obstacle.minZ)||points.every(p=>p[1]>=obstacle.maxZ))return [points];
    const outside=[];let remaining=points;
    for(let i=0;i<3&&remaining.length>=3;i++){
      const a=obstacle.points[i],b=obstacle.points[(i+1)%3],piece=halfPlane(remaining,a,b,false);
      if(piece.length>=3)outside.push(piece);
      remaining=halfPlane(remaining,a,b,true);
    }
    return outside;
  }
  function distance(routes,x,z) {
    let result=Infinity;
    for(const route of routes)for(let i=1;i<route.points.length;i++) {
      const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      result=Math.min(result,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)-route.width/2);
    }
    return result;
  }
  function geometry(routes,height,step=.12,exclusions=[]) {
    if(!routes.length)return {positions:[],uv:[]};
    const fine=routes.filter(route=>route.surfaceStep&&route.surfaceStep<step);
    if(fine.length){
      const ordinary=routes.filter(route=>!fine.includes(route));
      const pieces=[geometry(ordinary,height,step,exclusions),...fine.map(route=>geometry([route],height,route.surfaceStep,exclusions))];
      return {positions:pieces.flatMap(p=>p.positions),uv:pieces.flatMap(p=>p.uv)};
    }
    const points=routes.flatMap(r=>r.points),margin=Math.max(...routes.map(r=>r.width))/2+step;
    const x0=Math.min(...points.map(p=>p[0]))-margin,z0=Math.min(...points.map(p=>p[1]))-margin;
    const nx=Math.ceil((Math.max(...points.map(p=>p[0]))+margin-x0)/step),nz=Math.ceil((Math.max(...points.map(p=>p[1]))+margin-z0)/step);
    const grid=Array.from({length:(nx+1)*(nz+1)},(_,i)=>{
      const x=x0+(i%(nx+1))*step,z=z0+Math.floor(i/(nx+1))*step;return [x,z,distance(routes,x,z)];
    });
    const positions=[],uv=[],obstacles=outlines(exclusions);
    function triangle(points) {
      const clipped=[];
      for(let i=0;i<3;i++) {
        const a=points[i],b=points[(i+1)%3];
        if(a[2]<=0)clipped.push(a);
        if((a[2]<0)!==(b[2]<0)) {
          let lo=0,hi=1;
          for(let j=0;j<12;j++) {
            const t=(lo+hi)/2,value=distance(routes,a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]));
            if((value<0)===(a[2]<0))lo=t;else hi=t;
          }
          const t=(lo+hi)/2;clipped.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
        }
      }
      let pieces=clipped.length>=3?[clipped]:[];
      for(const obstacle of obstacles)pieces=pieces.flatMap(piece=>subtract(piece,obstacle));
      for(const piece of pieces)for(let i=1;i+1<piece.length;i++){
        if(Math.abs(cross(piece[0],piece[i],piece[i+1]))<1e-12)continue;
        for(const [x,z] of [piece[0],piece[i+1],piece[i]]){positions.push(x,height(x,z),z);uv.push(x,z);}
      }
    }
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++) {
      const k=j*(nx+1)+i,a=grid[k],b=grid[k+1],c=grid[k+nx+2],d=grid[k+nx+1];
      triangle([a,b,c]);triangle([a,c,d]);
    }
    return {positions,uv};
  }
  function create(THREE,{routes,height,garden,exclusions=[]}) {
    const data=geometry(routes,height,.12,[...(garden?surfaceExclusions(garden):[]),...exclusions]),meshGeometry=new THREE.BufferGeometry();
    meshGeometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
    meshGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));meshGeometry.computeVertexNormals();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(128,128);let seed=97213;
    for(let i=0;i<pixels.data.length;i+=4) {
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;const variation=(seed>>>24)/255;
      pixels.data[i]=175+variation*22;pixels.data[i+1]=172+variation*21;pixels.data[i+2]=164+variation*19;pixels.data[i+3]=255;
    }
    ctx.putImageData(pixels,0,0);
    const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(meshGeometry,new THREE.MeshStandardMaterial({map:texture,roughness:.98,side:THREE.DoubleSide}));
    mesh.name='Garden mineral routes';mesh.receiveShadow=true;return mesh;
  }
  return {distance,geometry,create,surfaceExclusions};
})();
if(typeof module!=='undefined')module.exports={GardenRouteModel};
