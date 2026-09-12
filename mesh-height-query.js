export function createMeshHeightQuery(meshOrGeometry,{matrix=meshOrGeometry.matrixWorld,cellSize=1}={}) {
  if(!Number.isFinite(cellSize)||cellSize<=0)throw new RangeError('Cell size must be positive');
  const geometry=meshOrGeometry.geometry??meshOrGeometry,position=geometry.attributes.position,index=geometry.index;
  const cells=new Map(),vertices=[];
  for(let i=0;i<position.count;i++) {
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i),m=matrix?.elements;
    if(m) {
      const w=m[3]*x+m[7]*y+m[11]*z+m[15];
      vertices.push([(m[0]*x+m[4]*y+m[8]*z+m[12])/w,(m[1]*x+m[5]*y+m[9]*z+m[13])/w,(m[2]*x+m[6]*y+m[10]*z+m[14])/w]);
    } else vertices.push([x,y,z]);
  }
  const start=geometry.drawRange?.start??0,end=Math.min(index?.count??position.count,start+(geometry.drawRange?.count??Infinity));
  for(let i=start;i+2<end;i+=3) {
    const [a,b,c]=[0,1,2].map(j=>vertices[index?index.getX(i+j):i+j]);
    const bx=b[0]-a[0],bz=b[2]-a[2],cx=c[0]-a[0],cz=c[2]-a[2],det=bx*cz-bz*cx;
    if(Math.abs(det)<1e-12)continue;
    const triangle={a,bx,bz,cx,cz,det,by:b[1]-a[1],cy:c[1]-a[1]};
    const minX=Math.floor(Math.min(a[0],b[0],c[0])/cellSize),maxX=Math.floor(Math.max(a[0],b[0],c[0])/cellSize);
    const minZ=Math.floor(Math.min(a[2],b[2],c[2])/cellSize),maxZ=Math.floor(Math.max(a[2],b[2],c[2])/cellSize);
    for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++) {
      const key=x+','+z;
      if(!cells.has(key))cells.set(key,[]);
      cells.get(key).push(triangle);
    }
  }
  return (x,z)=>{
    let highest=null;
    for(const t of cells.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize))??[]) {
      const dx=x-t.a[0],dz=z-t.a[2],u=(dx*t.cz-dz*t.cx)/t.det,v=(t.bx*dz-t.bz*dx)/t.det;
      if(u< -1e-9||v< -1e-9||u+v>1+1e-9)continue;
      const y=t.a[1]+u*t.by+v*t.cy;
      if(highest===null||y>highest)highest=y;
    }
    return highest;
  };
}
