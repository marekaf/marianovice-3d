export function prepareLoftRoofData(data,roof,windowModel) {
  const flat=data.floorY+data.clearH,normalDepth=.480,drop=normalDepth*Math.SQRT2;
  const westHeight=x=>roof.mainWest.heightAt(x)-drop,eastHeight=x=>roof.mainEast.heightAt(x)-drop;
  const eastJoin=roof.ridgeX+eastHeight(roof.ridgeX)-flat,westJoin=roof.ridgeX-westHeight(roof.ridgeX)+flat;
  const eastFloor=roof.ridgeX+eastHeight(roof.ridgeX)-data.floorY;
  const surfaces=[];
  for(const [i,slope]of data.slopes.entries()){
    const east=slope.x0>roof.ridgeX,x0=east?eastJoin:slope.x0,x1=east?Math.min(slope.x1,eastFloor):westJoin;
    surfaces.push({name:`Loft slope ${i}`,x0,x1,z0:slope.z0,z1:slope.z1,
      heightAt:east?eastHeight:westHeight});
  }
  for(const [i,ceiling]of data.ceilings.entries()){
    const x0=Math.max(ceiling.x0,westJoin),x1=Math.min(ceiling.x1,eastJoin);
    if(x1>x0)surfaces.push({...ceiling,x0,x1,name:`Loft flat ceiling ${i}`,heightAt:()=>flat,topAt:x=>Math.min(flat+.18,westHeight(x),eastHeight(x))});
  }
  const cap=wall=>{
    const profile=wall.profile||[[wall.a[0],wall.h??data.clearH],[wall.b[0],wall.h??data.clearH]];
    const pieces=[];
    for(let i=0;i<profile.length-1;i++){
      const [ax,ay]=profile[i],[bx,by]=profile[i+1],xs=[ax,bx];
      for(const x of[roof.intersectionX,roof.ridgeX])if(ax<x&&bx>x)xs.push(x);
      xs.sort((a,b)=>a-b);
      for(let j=0;j<xs.length-1;j++){
        const a=xs[j],b=xs[j+1],old=x=>ay+(by-ay)*(x-ax)/(bx-ax);
        const mid=(a+b)/2,height=mid<roof.intersectionX?x=>roof.westWing.undersideHeightAt(x):mid<roof.ridgeX?westHeight:eastHeight;
        const limit=x=>height(x)-data.floorY,knots=[a,b],da=old(a)-limit(a),db=old(b)-limit(b);
        if(da*db<0)knots.push(a+(b-a)*da/(da-db));
        knots.sort((a,b)=>a-b);
        for(let k=1;k<knots.length;k++){
          let x0=knots[k-1],x1=knots[k],y0=Math.min(old(x0),limit(x0)),y1=Math.min(old(x1),limit(x1));
          if(y0<=0&&y1<=0)continue;
          if(y0<0){x0+=(x1-x0)*-y0/(y1-y0);y0=0;}
          if(y1<0){x1=x0+(x1-x0)*y0/(y0-y1);y1=0;}
          const previous=pieces.at(-1);
          if(previous&&Math.abs(previous.at(-1)[0]-x0)<1e-8&&Math.abs(previous.at(-1)[1]-y0)<1e-8)previous.push([x1,y1]);
          else pieces.push([[x0,y0],[x1,y1]]);
        }
      }
    }
    if(pieces.length===1&&JSON.stringify(pieces[0])===JSON.stringify(profile))return [wall];
    if(wall.openings?.length)throw new Error(`Roof lining would alter door wall ${wall.id}`);
    let widest=0;
    for(let i=1;i<pieces.length;i++)if(pieces[i].at(-1)[0]-pieces[i][0][0]>pieces[widest].at(-1)[0]-pieces[widest][0][0])widest=i;
    return pieces.map((profile,index)=>{
      const glazing=wall.glazing?.filter(g=>g.x0>=profile[0][0]&&g.x1<=profile.at(-1)[0]);
      const primary=wall.glazing?.length?glazing.length>0:index===widest;
      return {...wall,id:primary?wall.id:`${wall.id}_roof_${index}`,roofSourceId:wall.id,profile,...(wall.glazing?{glazing}:{})};
    });
  };
  const cutouts=windowModel.cutouts.map((cut,index)=>{
    const frame=windowModel.parts.filter(part=>part.name.startsWith(`roof_window_${index}_timber_frame`));
    const back=Math.min(...frame.flatMap(part=>part.vertices.map(point=>point.reduce((sum,v,i)=>sum+(v-cut.center[i])*cut.normal[i],0))));
    return {...cut,x0:cut.x0+back*cut.normal[0],x1:cut.x1+back*cut.normal[0],back};
  });
  const floorTopClip={slope:roof.westWing.undersideHeightAt(1)-roof.westWing.undersideHeightAt(0),offset:roof.westWing.undersideHeightAt(0)-data.floorY};
  return {...data,slopes:[],ceilings:[],floorTopClip,extWalls:data.extWalls.flatMap(cap),intWalls:data.intWalls.flatMap(cap),
    roofWindowLining:{surfaces,westJoin,eastJoin,normalDepth,windowModel,cutouts,
      notes:'Roof-window positions match the exterior model. Loft lining uses a rounded 480 mm normal build-up including the service cavity, independently of the 250 mm projecting roof edge. The flat finished ceiling retains 2.27 m clear height. The inaccessible western floor build-up is capped at the shallow roof underside for visualization, not as an approved construction detail.'}};
}

export function attachLoftRoofWindows(THREE,loft,data,{buildModel}) {
  const {surfaces,windowModel,notes}=data.roofWindowLining;
  const group=new THREE.Group(),lining=new THREE.Group(),reveals=new THREE.Group();
  group.name='Loft roof windows and finished lining';lining.name='Loft lining with physical roof apertures';reveals.name='Roof window reveal shafts';
  group.add(lining,reveals);
  loft.ceiling.add(group);
  const finish=new THREE.MeshStandardMaterial({color:'#ddd1be',roughness:.92,side:THREE.DoubleSide});
  function panel(name,points,parent){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
    geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,finish);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  const cuts=data.roofWindowLining.cutouts;
  for(const surface of surfaces){
    const {x0,x1,z0,z1,heightAt}=surface;
    const holes=cuts.filter(c=>c.x1>x0&&c.x0<x1&&c.z1>z0&&c.z0<z1);
    const xs=[...new Set([x0,x1,...holes.flatMap(c=>[c.x0,c.x1]).filter(x=>x>x0&&x<x1)])].sort((a,b)=>a-b);
    const zs=[...new Set([z0,z1,...holes.flatMap(c=>[c.z0,c.z1]).filter(z=>z>z0&&z<z1)])].sort((a,b)=>a-b);
    for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){
      const a=xs[i-1],b=xs[i],c=zs[j-1],d=zs[j],mx=(a+b)/2,mz=(c+d)/2;
      if(holes.some(h=>mx>h.x0&&mx<h.x1&&mz>h.z0&&mz<h.z1))continue;
      panel(surface.name,[[a,heightAt(a),c],[b,heightAt(b),c],[b,heightAt(b),d],[a,heightAt(a),d]],lining);
      if(surface.topAt){
        const bottom=[[a,heightAt(a),c],[b,heightAt(b),c],[b,heightAt(b),d],[a,heightAt(a),d]];
        const top=bottom.map(([x,y,z])=>[x,surface.topAt(x),z]);panel(`${surface.name} top`,top,lining);
        for(let k=0;k<4;k++)panel(`${surface.name} edge`,[bottom[k],bottom[(k+1)%4],top[(k+1)%4],top[k]],lining);
      }
    }
  }
  for(const [index,cut]of cuts.entries()){
    const edges=[[[cut.x0,cut.z0],[cut.x1,cut.z0]],[[cut.x1,cut.z0],[cut.x1,cut.z1]],
      [[cut.x1,cut.z1],[cut.x0,cut.z1]],[[cut.x0,cut.z1],[cut.x0,cut.z0]]];
    const frameHeight=x=>cut.center[2]+(x-cut.center[0])*cut.slopeAxis[2]/cut.slopeAxis[0]+cut.back/cut.normal[2];
    for(const [edge,[a,b]]of edges.entries()){
      const ts=[0,1];
      for(const s of surfaces){
        if(a[0]!==b[0])for(const x of[s.x0,s.x1]){const t=(x-a[0])/(b[0]-a[0]);if(t>0&&t<1)ts.push(t);}
        if(a[1]!==b[1])for(const z of[s.z0,s.z1]){const t=(z-a[1])/(b[1]-a[1]);if(t>0&&t<1)ts.push(t);}
      }
      const sorted=[...new Set(ts)].sort((a,b)=>a-b),at=t=>a.map((v,i)=>v+(b[i]-v)*t);
      for(let i=1;i<sorted.length;i++){
        const p=at(sorted[i-1]),q=at(sorted[i]),m=at((sorted[i-1]+sorted[i])/2);
        const s=surfaces.find(s=>m[0]>=s.x0-1e-8&&m[0]<=s.x1+1e-8&&m[1]>=s.z0-1e-8&&m[1]<=s.z1+1e-8);
        if(!s)throw new Error(`Roof window ${index} edge has no lining surface`);
        panel(`Roof window ${index} reveal ${edge}.${i}`,[[p[0],s.heightAt(p[0]),p[1]],[q[0],s.heightAt(q[0]),q[1]],
          [q[0],frameHeight(q[0]),q[1]],[p[0],frameHeight(p[0]),p[1]]],reveals);
      }
    }
  }
  const windows=buildModel(THREE,windowModel);windows.name='Shared loft roof window frames and glazing';group.add(windows);
  return {group,windows,lining,reveals,notes};
}
