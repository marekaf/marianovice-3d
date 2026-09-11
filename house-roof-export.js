const THREE=require('three');
const {HouseRoof}=require('./house-roof.js');
const RoofWindows=require('./docs/house-roof-windows.js');
const {HOUSE_INTERIOR}=require('./house-interior.js');
const {GarageModel}=require('./garage-model.js');

function splitPolygon(polygon,axis,value,sign) {
  const result=[];
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length],insideA=sign*(a[axis]-value)>=0,insideB=sign*(b[axis]-value)>=0;
    if(insideA)result.push(a);
    if(insideA!==insideB){const t=(value-a[axis])/(b[axis]-a[axis]);result.push(a.map((v,j)=>v+(b[j]-v)*t));}
  }
  return result;
}
function subtractBox(polygon,box) {
  const outside=[];let remaining=polygon;
  for(let axis=0;axis<3&&remaining.length;axis++)for(const [value,sign]of[[box.min[axis],1],[box.max[axis],-1]]) {
    const piece=splitPolygon(remaining,axis,value,-sign);
    if(piece.length>=3)outside.push(piece);
    remaining=splitPolygon(remaining,axis,value,sign);
  }
  return outside;
}
function meshPart(name,triangles,material,cuts=[],roofSurface=false) {
  const vertices=[],faces=[];
  for(const triangle of triangles) {
    let polygons=[triangle];
    for(const box of cuts)polygons=polygons.flatMap(p=>subtractBox(p,box));
    for(const p of polygons)for(let i=1;i<p.length-1;i++) {
      const a=new THREE.Vector3(...p[0]),b=new THREE.Vector3(...p[i]),c=new THREE.Vector3(...p[i+1]);
      if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-20)continue;
      const first=vertices.length;vertices.push(...[p[0],p[i],p[i+1]].map(([x,y,z])=>[x,z,y]));faces.push([first+2,first+1,first]);
    }
  }
  return {name,type:'mesh',vertices,faces,material,category:'roof',roofSurface};
}
function buildHouseRoofExport(garden,baseY) {
  const house=garden.elements.find(e=>e.id==='house'),options={bbox:house.meta.bbox,atrium:house.meta.atrium,gable:[13.68,21.28],baseY,eNotch:house.meta.eNotch};
  const root=HouseRoof.create(THREE,options),d=root.userData.description;
  const windowModel=RoofWindows.build({gable:options.gable,ridgeY:d.ridgeY,eaveY:d.ridgeY-4.25});
  const openings=windowModel.cutouts.map(c=>({min:[c.x0,-100,c.z0],max:[c.x1,100,c.z1]}));
  const flashings=windowModel.cutouts.map(c=>({min:[c.x0-.18*Math.abs(c.slopeAxis[0]),-100,c.z0-.12],max:[c.x1+.18*Math.abs(c.slopeAxis[0]),100,c.z1+.12]}));
  const parts=[],materials={},materialIds=new Map();root.updateMatrixWorld(true);
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    if(!materialIds.has(mesh.material)) {
      const id=`roof_material_${materialIds.size}`,m=mesh.material;materialIds.set(m,id);
      materials[id]={color:'#'+m.color.getHexString(),roughness:m.roughness,metalness:m.metalness,...(m.map?{grain:'y'}:{})};
    }
    const g=mesh.geometry,p=g.attributes.position,index=g.index,triangles=[];
    for(let i=0;i<(index?index.count:p.count);i+=3)triangles.push([0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld).toArray()));
    parts.push(meshPart(mesh.name,triangles,materialIds.get(mesh.material),g.type==='BoxGeometry'?flashings:openings,!!mesh.userData.roofSurface));
  });
  const wallTop=baseY+3.07,infill=[],bbox=options.bbox,atrium=options.atrium,notch=options.eNotch;
  const gable=HOUSE_INTERIOR.gableOpening(),origin=HOUSE_INTERIOR.originPlot,o=gable.opening;
  const gableCut={min:[origin.x+o.x-o.width/2,baseY+o.sill,bbox[1]-.01],max:[origin.x+o.x+o.width/2,baseY+o.sill+o.height,bbox[1]+.46]};
  function fill(a,b,topA,topB) {
    if(topA<=wallTop&&topB<=wallTop)return;
    if(topA<wallTop){const t=(wallTop-topA)/(topB-topA);a=a.map((v,i)=>v+(b[i]-v)*t);topA=wallTop;}
    if(topB<wallTop){const t=(wallTop-topB)/(topA-topB);b=b.map((v,i)=>v+(a[i]-v)*t);topB=wallTop;}
    const p=[[a[0],wallTop,a[1]],[b[0],wallTop,b[1]],[b[0],topB,b[1]],[a[0],topA,a[1]]];
    infill.push(meshPart(`roof_facade_infill_${infill.length}`,[[p[0],p[1],p[2]],[p[0],p[2],p[3]]],'render',[gableCut]));
  }
  function span(x0,x1,z){const x=(x0+x1)/2,p=x<d.intersectionX?d.westWing:x<d.ridgeX?d.mainWest:d.mainEast;fill([x0,z],[x1,z],p.undersideHeightAt(x0),p.undersideHeightAt(x1));}
  for(const z of[bbox[1],bbox[3]]){const xs=[bbox[0],d.intersectionX,d.ridgeX,bbox[2]];for(let i=1;i<xs.length;i++)span(xs[i-1],xs[i],z);}
  for(const z of[atrium[1],atrium[3]]){const xs=[bbox[0],d.intersectionX,atrium[2]];for(let i=1;i<xs.length;i++)span(xs[i-1],xs[i],z);}
  fill([atrium[2],atrium[1]],[atrium[2],atrium[3]],d.mainWest.undersideHeightAt(atrium[2]),d.mainWest.undersideHeightAt(atrium[2]));
  for(const[x,z0,z1]of[[bbox[2],bbox[1],notch[1]],[notch[0],notch[1],notch[3]],[bbox[2],notch[3],bbox[3]]])fill([x,z0],[x,z1],d.mainEast.undersideHeightAt(x),d.mainEast.undersideHeightAt(x));
  for(const z of[notch[1],notch[3]])fill([notch[0],z],[notch[2],z],d.mainEast.undersideHeightAt(notch[0]),d.mainEast.undersideHeightAt(notch[2]));
  const at=p=>[p[0]+origin.x,p[1]+origin.z,p[2]];
  const gableWindowModel={...gable,name:'House gable window',floorHeight:baseY,parts:gable.parts.map(p=>({...p,...(p.position?{position:at(p.position)}:{}),...(p.vertices?{vertices:p.vertices.map(at)}:{}),...(p.start?{start:at(p.start),end:at(p.end)}:{})}))};
  const model=(name,parts,materials)=>({name,floorHeight:0,parts,materials,lights:[]});
  const result={roofModel:model('Finished house roof',parts,materials),windowModel,gableWindowModel,infillModel:model('House roof facade infill',infill,{render:{color:GarageModel.facadeFinish.color,roughness:.85}}),wallCap:{slope:d.westWing.heightAt(1)-d.westWing.heightAt(0),intercept:d.westWing.undersideHeightAt(0),maxHeight:wallTop},spec:{bounds:[d.westX,d.eastX,d.northZ,d.southZ],normalThickness:[d.mainWest.normalThickness,d.mainEast.normalThickness,d.westWing.normalThickness],windowCuts:openings}};
  const geometries=new Set();root.traverse(m=>{if(m.isMesh)geometries.add(m.geometry);});for(const g of geometries)g.dispose();for(const m of materialIds.keys()){m.map?.dispose();m.dispose();}
  return result;
}
module.exports={buildHouseRoofExport};
