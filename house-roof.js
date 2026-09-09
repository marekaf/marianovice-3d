const HouseRoof = (() => {
  function describe({bbox,atrium,gable,baseY=0,eNotch}) {
    const ridgeX=(gable[0]+gable[1])/2,ridgeY=baseY+7.15;
    const westX=bbox[0]-1.15,eastX=bbox[2]+.35,northZ=bbox[1]-.175,southZ=bbox[3]+.175;
    const wingSlope=Math.tan(5*Math.PI/180),wingEaveY=baseY+3.025;
    const intersectionX=(wingEaveY-wingSlope*westX-ridgeY+ridgeX)/(1-wingSlope);
    const mainWest={heightAt:x=>ridgeY-(ridgeX-x),normalThickness:.25,verticalDrop:.25*Math.SQRT2};
    const mainEast={heightAt:x=>ridgeY-(x-ridgeX),normalThickness:.25,verticalDrop:.25*Math.SQRT2};
    const westWing={heightAt:x=>wingEaveY+(x-westX)*wingSlope,normalThickness:.227,verticalDrop:.227/Math.cos(5*Math.PI/180),depthStatus:'documented build-up; finish thickness unconfirmed'};
    for(const plane of[mainWest,mainEast,westWing])plane.undersideHeightAt=x=>plane.heightAt(x)-plane.verticalDrop;
    const atriumWestX=atrium[2]-1.6,atriumNorthZ=atrium[1]+.175,atriumSouthZ=atrium[3]-.175;
    function planeAt(x,z) {
      if(z<northZ||z>southZ||x>eastX)return null;
      const wing=z<=atriumNorthZ||z>=atriumSouthZ;
      if(x<(wing?westX:atriumWestX))return null;
      return x>=ridgeX?mainEast:wing&&x<intersectionX?westWing:mainWest;
    }
    const heightAt=(x,z)=>planeAt(x,z)?.heightAt(x)??null;
    const undersideHeightAt=(x,z)=>planeAt(x,z)?.undersideHeightAt(x)??null;
    return {bbox,atrium,eNotch,ridgeX,ridgeY,westX,eastX,northZ,southZ,intersectionX,mainWest,mainEast,westWing,heightAt,undersideHeightAt,
      atriumWestX,atriumNorthZ,atriumSouthZ};
  }
  function create(THREE,options) {
    const d=describe(options),group=new THREE.Group();
    group.name='Finished house roof';
    group.userData.description=d;
    const metal=new THREE.MeshStandardMaterial({color:0x92979b,roughness:.48,metalness:.65,side:THREE.DoubleSide});
    const trim=new THREE.MeshStandardMaterial({color:0x70767a,roughness:.48,metalness:.65,side:THREE.DoubleSide});
    const grain=new Uint8Array(64*128*4);
    for(let y=0;y<128;y++)for(let x=0;x<64;x++){
      const value=244+Math.round(4*Math.sin(x*.72+Math.sin(y/31)*.7)+2*Math.sin(x*2.3));
      grain.set([value,value,value,255],(y*64+x)*4);
    }
    const grainTexture=new THREE.DataTexture(grain,64,128);
    grainTexture.wrapS=grainTexture.wrapT=THREE.RepeatWrapping;grainTexture.colorSpace=THREE.SRGBColorSpace;grainTexture.needsUpdate=true;
    const timber=new THREE.MeshStandardMaterial({color:0xb6a083,roughness:.87,side:THREE.DoubleSide,map:grainTexture});
    const unitBox=new THREE.BoxGeometry(1,1,1),unitCylinder=new THREE.CylinderGeometry(1,1,1,8);
    function surface(name,points,material,roofSurface=false,triangles) {
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(points.flatMap(([x,,z])=>[x/.6,z/2.4]),2));
      const indices=[];
      if(triangles)indices.push(...triangles);
      else for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1);
      geometry.setIndex(indices);geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.userData.roofSurface=roofSurface;
      mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
    }
    function panel(name,x0,x1,z0,z1,plane,material=metal,drop=0,roofSurface=false) {
      return surface(name,[[x0,plane.heightAt(x0)-drop,z0],[x1,plane.heightAt(x1)-drop,z0],
        [x1,plane.heightAt(x1)-drop,z1],[x0,plane.heightAt(x0)-drop,z1]],material,roofSurface);
    }
    function beam(name,a,b,width,height,material=trim,round=false) {
      const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
      const mesh=new THREE.Mesh(round?unitCylinder:unitBox,material);
      mesh.name=name;mesh.position.copy(start).add(end).multiplyScalar(.5);
      mesh.scale.set(width,delta.length(),height);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
      mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
    }
    const planes=[
      {name:'Main east',x0:d.ridgeX,x1:d.eastX,z0:d.northZ,z1:d.southZ,plane:d.mainEast},
      {name:'Main west north',x0:d.intersectionX,x1:d.ridgeX,z0:d.northZ,z1:d.atriumNorthZ,plane:d.mainWest},
      {name:'Main west atrium',x0:d.atriumWestX,x1:d.ridgeX,z0:d.atriumNorthZ,z1:d.atriumSouthZ,plane:d.mainWest},
      {name:'Main west south',x0:d.intersectionX,x1:d.ridgeX,z0:d.atriumSouthZ,z1:d.southZ,plane:d.mainWest},
      {name:'West wing north',x0:d.westX,x1:d.intersectionX,z0:d.northZ,z1:d.atriumNorthZ,plane:d.westWing},
      {name:'West wing south',x0:d.westX,x1:d.intersectionX,z0:d.atriumSouthZ,z1:d.southZ,plane:d.westWing},
    ];
    group.userData.planes=planes;
    for(const p of planes) {
      panel(`${p.name} metal`,p.x0,p.x1,p.z0,p.z1,p.plane,metal,0,true);
      for(let z=d.northZ+.25;z<p.z1-.04;z+=.5)if(z>p.z0+.04){
        beam(`${p.name} standing seam`,[p.x0,p.plane.heightAt(p.x0)+.012,z],[p.x1,p.plane.heightAt(p.x1)+.012,z],.024,.008);
      }
    }
    function soffit(name,x0,x1,z0,z1,plane) {
      if(plane===d.mainEast)x1=Math.min(x1,d.eastX-.03);
      if(plane===d.mainWest&&x0===d.atriumWestX)x0+=.03;
      if(plane===d.westWing)x0=Math.max(x0,d.westX+.03);
      if(x1>x0&&z1>z0)panel(`${name} bioboard soffit`,x0,x1,z0,z1,plane,timber,plane.verticalDrop);
    }
    for(const p of planes) {
      if(p.z0<d.bbox[1])soffit(`${p.name} north`,p.x0,p.x1,p.z0,d.bbox[1],p.plane);
      if(p.z1>d.bbox[3])soffit(`${p.name} south`,p.x0,p.x1,d.bbox[3],p.z1,p.plane);
    }
    soffit('East eave',d.bbox[2],d.eastX,d.bbox[1],d.bbox[3],d.mainEast);
    if(d.eNotch)soffit('East recessed frontage',d.eNotch[0],d.bbox[2],d.eNotch[1],d.eNotch[3],d.mainEast);
    for(const [name,z0,z1]of[['north',d.bbox[1],d.atrium[1]],['south',d.atrium[3],d.bbox[3]]])
      soffit(`West ${name} eave`,d.westX,d.bbox[0],z0,z1,d.westWing);
    for(const [name,z0,z1]of[['north',d.atrium[1],d.atriumNorthZ],['south',d.atriumSouthZ,d.atrium[3]]]){
      soffit(`Atrium ${name} wing return`,d.westX,d.intersectionX,z0,z1,d.westWing);
      soffit(`Atrium ${name} main return`,d.intersectionX,d.atrium[2],z0,z1,d.mainWest);
    }
    soffit('Atrium main eave',d.atriumWestX,d.atrium[2],d.atriumNorthZ,d.atriumSouthZ,d.mainWest);
    for(const [name,z0,z1]of[['North',d.northZ,d.bbox[1]],['South',d.bbox[3],d.southZ],
      ['Atrium north',d.atrium[1],d.atriumNorthZ],['Atrium south',d.atriumSouthZ,d.atrium[3]]]){
      const x=d.intersectionX,upper=d.westWing.undersideHeightAt(x),lower=d.mainWest.undersideHeightAt(x);
      surface(`${name} underside junction closure`,[[x,lower,z0],[x,upper,z0],[x,upper,z1],[x,lower,z1]],timber);
    }
    function fascia(name,a,b,plane) {
      surface(name,[a,b,[b[0],b[1]-plane.verticalDrop,b[2]],[a[0],a[1]-plane.verticalDrop,a[2]]],trim);
      beam(`${name} drip`,[a[0],a[1]-.002,a[2]],[b[0],b[1]-.002,b[2]],.008,.008);
    }
    function westBarge(name,z,endX){
      const plane=d.westWing,x=d.westX,bodyX=x+.03;
      const points=[[endX,plane.heightAt(endX),z],[x,plane.heightAt(x),z],[x,plane.heightAt(x)-.002,z],
        [bodyX,plane.heightAt(bodyX)-.002,z],[bodyX,plane.undersideHeightAt(bodyX),z],[endX,plane.undersideHeightAt(endX),z]];
      const triangles=THREE.ShapeUtils.triangulateShape(points.map(([x,y])=>new THREE.Vector2(x,y)),[]).flat();
      surface(name,points,trim,false,triangles);
      beam(`${name} drip`,[x,plane.heightAt(x)-.002,z],[endX,plane.heightAt(endX)-.002,z],.008,.008);
    }
    for(const [name,z]of[['North',d.northZ],['South',d.southZ]]){
      westBarge(`${name} wing barge`,z,d.intersectionX);
      fascia(`${name} west barge`,[d.intersectionX,d.mainWest.heightAt(d.intersectionX),z],[d.ridgeX,d.ridgeY,z],d.mainWest);
      const bodyX=d.eastX-.03;
      surface(`${name} east barge`,[[d.ridgeX,d.ridgeY,z],[d.eastX,d.mainEast.heightAt(d.eastX),z],
        [d.eastX,d.mainEast.heightAt(d.eastX)-.002,z],[bodyX,d.mainEast.heightAt(bodyX)-.002,z],
        [bodyX,d.mainEast.undersideHeightAt(bodyX),z],[d.ridgeX,d.mainEast.undersideHeightAt(d.ridgeX),z]],trim);
      beam(`${name} east barge drip`,[d.ridgeX,d.ridgeY-.002,z],[d.eastX,d.mainEast.heightAt(d.eastX)-.002,z],.008,.008);
    }
    for(const [name,z]of[['North',d.atriumNorthZ],['South',d.atriumSouthZ]]){
      westBarge(`${name} atrium return`,z,d.atriumWestX);
      const bodyX=d.atriumWestX+.03;
      const closure=[[d.atriumWestX,d.mainWest.heightAt(d.atriumWestX)-.002,z],
        [d.atriumWestX,d.westWing.heightAt(d.atriumWestX),z],[d.intersectionX,d.westWing.heightAt(d.intersectionX),z],
        [d.intersectionX,d.mainWest.undersideHeightAt(d.intersectionX),z],[bodyX,d.mainWest.undersideHeightAt(bodyX),z],
        [bodyX,d.mainWest.heightAt(bodyX)-.002,z]];
      const triangles=THREE.ShapeUtils.triangulateShape(closure.map(([x,y])=>new THREE.Vector2(x,y)),[]).flat();
      surface(`${name} atrium junction closure`,closure,trim,false,triangles);
    }
    const eaves=[['East',d.eastX,d.northZ,d.southZ,d.mainEast,1],
      ['West north',d.westX,d.northZ,d.atriumNorthZ,d.westWing,-1],['West south',d.westX,d.atriumSouthZ,d.southZ,d.westWing,-1],
      ['Atrium',d.atriumWestX,d.atriumNorthZ,d.atriumSouthZ,d.mainWest,-1]];
    for(const [name,x,z0,z1,plane,side]of eaves){
      const y=plane.heightAt(x),bodyX=x-side*.03;
      fascia(`${name} eave fascia`,[bodyX,plane.heightAt(bodyX),z0],[bodyX,plane.heightAt(bodyX),z1],plane);
      if(bodyX!==x){
        panel(`${name} metal drip underside`,Math.min(x,bodyX),Math.max(x,bodyX),z0,z1,plane,trim,.002);
        surface(`${name} metal drip edge`,[[x,y,z0],[x,y,z1],[x,y-.002,z1],[x,y-.002,z0]],trim);
      }
      const radius=.065,cx=x+side*.043,cy=y-.035,vertices=[],indices=[];
      for(let i=0;i<=12;i++){
        const angle=Math.PI*i/12,px=cx+radius*Math.cos(angle),py=cy-radius*Math.sin(angle);
        vertices.push(px,py,z0,px,py,z1);
        if(i<12){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geometry.setIndex(indices);geometry.computeVertexNormals();
      const gutter=new THREE.Mesh(geometry,trim);gutter.name=`${name} half-round gutter`;gutter.userData.gutter={edgeX:x,centerX:cx,radius,topY:cy};
      gutter.castShadow=gutter.receiveShadow=true;group.add(gutter);
      for(const px of[cx-radius,cx+radius])beam(`${name} gutter rolled lip`,[px,cy,z0],[px,cy,z1],.004,.004,trim,true);
      for(const [capName,z]of[['north',z0],['south',z1]]){
        const cap=[[cx,cy,z]];
        for(let i=0;i<=12;i++){const angle=Math.PI*i/12;cap.push([cx+radius*Math.cos(angle),cy-radius*Math.sin(angle),z]);}
        surface(`${name} gutter ${capName} cap`,cap,trim);
      }
    }
    for(const [side,plane,x]of[['west',d.mainWest,d.ridgeX-.10],['east',d.mainEast,d.ridgeX+.10]])
      surface(`${side} folded ridge cap`,[[d.ridgeX,d.ridgeY+.025,d.northZ],[x,plane.heightAt(x)+.018,d.northZ],
        [x,plane.heightAt(x)+.018,d.southZ],[d.ridgeX,d.ridgeY+.025,d.southZ]],trim);
    return group;
  }
  return {describe,create};
})();
if(typeof module!=='undefined')module.exports={HouseRoof};
