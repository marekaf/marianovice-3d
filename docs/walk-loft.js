export async function attachWalkLoft(THREE,house,loftData,{buildModel,renderer,applyChampagneFloor,roof,windowModel}) {
  const [lining,interior]=await Promise.all([import('./loft-roof-windows.js'),import('./loft-interior.js')]);
  const prepared=lining.prepareLoftRoofData({...loftData,intWalls:loftData.intWalls.filter(w=>w.id!=='P13')},roof,windowModel);
  const exteriorIds=new Set(prepared.extWalls.map(w=>w.id));
  const data={...prepared,extWalls:prepared.extWalls.map(wall=>{
    if(wall.face==='N')return {...wall,a:[wall.a[0],wall.a[1]+.002]};
    if(wall.face==='S')return {...wall,b:[wall.b[0],wall.b[1]-.002]};
    return wall;
  }),buildOpening(wall,opening,index){
    if(exteriorIds.has(wall.id))return {name:'Garden-owned exterior glazing',floorHeight:0,parts:[],materials:{},lights:[]};
    return loftData.buildOpening(wall,opening,index);
  }};
  const loft=INTERIORS3D.buildHouse(THREE,data,{floorY:loftData.floorY,buildModel,finishColors:interior.finishColors});
  loft.root.position.set(0,0,0);loft.root.name='garden-walk-loft';house.root.add(loft.root);
  const roofFitout=lining.attachLoftRoofWindows(THREE,loft,data,{buildModel:()=>new THREE.Group()});
  const fitout=interior.attachLoftInterior(THREE,loft,loftData,{renderer,applyChampagneFloor,
    buildModel(three,model){return buildModel(three,{...model,parts:model.parts.filter(part=>part.name!=='loft_black_flue')});}});
  loft.labels.visible=false;loft.wallIds.visible=false;
  loft.root.traverse(object=>{if(object.isLight){object.intensity=0;object.visible=false;}});
  loft.root.userData.furnishedLoft=true;
  return {loft,data,fitout,roofFitout};
}
