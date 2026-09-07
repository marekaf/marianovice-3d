const GardenRouteModel = (() => {
  function distance(routes,x,z) {
    let result=Infinity;
    for(const route of routes)for(let i=1;i<route.points.length;i++) {
      const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      result=Math.min(result,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)-route.width/2);
    }
    return result;
  }
  function geometry(routes,height,step=.12) {
    if(!routes.length)return {positions:[],uv:[]};
    const points=routes.flatMap(r=>r.points),margin=Math.max(...routes.map(r=>r.width))/2+step;
    const x0=Math.min(...points.map(p=>p[0]))-margin,z0=Math.min(...points.map(p=>p[1]))-margin;
    const nx=Math.ceil((Math.max(...points.map(p=>p[0]))+margin-x0)/step),nz=Math.ceil((Math.max(...points.map(p=>p[1]))+margin-z0)/step);
    const grid=Array.from({length:(nx+1)*(nz+1)},(_,i)=>{
      const x=x0+(i%(nx+1))*step,z=z0+Math.floor(i/(nx+1))*step;return [x,z,distance(routes,x,z)];
    });
    const positions=[],uv=[];
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
      for(let i=1;i+1<clipped.length;i++)for(const [x,z] of [clipped[0],clipped[i+1],clipped[i]]) {
        positions.push(x,height(x,z),z);uv.push(x,z);
      }
    }
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++) {
      const k=j*(nx+1)+i,a=grid[k],b=grid[k+1],c=grid[k+nx+2],d=grid[k+nx+1];
      triangle([a,b,c]);triangle([a,c,d]);
    }
    return {positions,uv};
  }
  function create(THREE,{routes,height}) {
    const data=geometry(routes,height),meshGeometry=new THREE.BufferGeometry();
    meshGeometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
    meshGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));meshGeometry.computeVertexNormals();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(128,128);let seed=97213;
    for(let i=0;i<pixels.data.length;i+=4) {
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;const variation=(seed>>>24)/255;
      pixels.data[i]=169+variation*30;pixels.data[i+1]=157+variation*28;pixels.data[i+2]=131+variation*25;pixels.data[i+3]=255;
    }
    ctx.putImageData(pixels,0,0);
    const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(meshGeometry,new THREE.MeshStandardMaterial({map:texture,roughness:.98,side:THREE.DoubleSide}));
    mesh.name='Garden mineral routes';mesh.receiveShadow=true;return mesh;
  }
  return {distance,geometry,create};
})();
if(typeof module!=='undefined')module.exports={GardenRouteModel};
