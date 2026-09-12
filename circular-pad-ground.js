export function levelCircularGround(THREE,ground,pads,height) {
  for(const pad of pads.filter(p=>p.radius!==undefined)) {
    const position=ground.attributes.position,texture=ground.attributes.uv;
    const positions=Array.from(position.array),uv=Array.from(texture.array),indices=[];
    const circle=Array.from({length:512},(_,i)=>{const angle=i*Math.PI/256;return [pad.cx+pad.radius*Math.cos(angle),pad.cz+pad.radius*Math.sin(angle)];});
    const cross=(a,b,p)=>(b[0]-a[0])*(p.values[2]-a[1])-(b[1]-a[1])*(p.values[0]-a[0]);
    function clip(polygon,a,b,inside){
      const result=[];
      for(let i=0;i<polygon.length;i++){
        const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=cross(a,b,p),dq=cross(a,b,q);
        const keepP=inside?dp>=0:dp<=0,keepQ=inside?dq>=0:dq<=0;
        if(keepP)result.push(p);
        if(keepP!==keepQ){const t=dp/(dp-dq);result.push({values:p.values.map((v,j)=>v+(q.values[j]-v)*t)});}
      }
      return result;
    }
    function append(polygon,flat=false){
      const ids=polygon.map(p=>{
        if(p.index!==undefined)return p.index;
        const [x,,z,u,v]=p.values,index=positions.length/3;
        positions.push(x,flat?pad.level:height(x,z),z);uv.push(u,v);
        return index;
      });
      for(let i=1;i+1<ids.length;i++){
        const [a,b,c]=[ids[0],ids[i],ids[i+1]].map(id=>[positions[id*3],positions[id*3+2]]);
        if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))>1e-12)indices.push(ids[0],ids[i],ids[i+1]);
      }
    }
    for(let i=0;i<(ground.index?.count??position.count);i+=3){
      const ids=[0,1,2].map(j=>ground.index?ground.index.getX(i+j):i+j);
      const triangle=ids.map(index=>({index,values:[position.getX(index),position.getY(index),position.getZ(index),texture.getX(index),texture.getY(index)]}));
      if(triangle.every(p=>Math.hypot(p.values[0]-pad.cx,p.values[2]-pad.cz)<pad.radius*Math.cos(Math.PI/512))||
        [0,2].some((axis,j)=>Math.max(...triangle.map(p=>p.values[axis]))<[pad.cx,pad.cz][j]-pad.radius||Math.min(...triangle.map(p=>p.values[axis]))>[pad.cx,pad.cz][j]+pad.radius)){
        indices.push(...ids);continue;
      }
      let remaining=triangle;
      for(let edge=0;edge<circle.length&&remaining.length>=3;edge++){
        const a=circle[edge],b=circle[(edge+1)%circle.length],outside=clip(remaining,a,b,false);
        if(outside.length>=3)append(outside);
        remaining=clip(remaining,a,b,true);
      }
      if(remaining.length>=3)append(remaining,true);
    }
    const aligned=new THREE.BufferGeometry();
    aligned.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    aligned.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    aligned.setIndex(indices);ground.dispose();ground=aligned;
  }
  ground.computeVertexNormals();
  return ground;
}
