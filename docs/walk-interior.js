function disposeRoots(roots,environment) {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  for(const root of roots)root.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    for(const material of [object.material].flat().filter(Boolean)){
      materials.add(material);
      for(const value of Object.values(material))if(value?.isTexture&&value!==environment?.texture)textures.add(value);
    }
  });
  for(const resource of [...geometries,...materials,...textures])resource.dispose();
  environment?.dispose();
}

function insetFacade(mesh,wall,outline) {
  const positions=mesh.geometry.attributes.position;
  for(let i=0;i<outline.length;i++){
    const a=outline[i],b=outline[(i+1)%outline.length],cross=a[0]===b[0]?0:1,along=1-cross;
    if(Math.min(wall.b[along],Math.max(a[along],b[along]))<=Math.max(wall.a[along],Math.min(a[along],b[along])))continue;
    const sign=Math.abs(wall.a[cross]-a[cross])<1e-6?1:Math.abs(wall.b[cross]-a[cross])<1e-6?-1:0;
    if(!sign)continue;
    for(let vertex=0;vertex<positions.count;vertex++){
      const coordinate=cross===0?positions.getX(vertex)+mesh.position.x:positions.getZ(vertex)+mesh.position.z;
      if(Math.abs(coordinate-a[cross])>1e-6)continue;
      if(cross===0)positions.setX(vertex,positions.getX(vertex)+sign*.002);
      else positions.setZ(vertex,positions.getZ(vertex)+sign*.002);
    }
  }
  positions.needsUpdate=true;
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
}

export async function buildWalkInterior(THREE,data,{buildModel,renderer,floorY,exteriorWallHeight=data.clearH,roofWallProfile,loftData,loftRoof,loftWindows}) {
  const {capRoofWall}=await import('./roof-wall-cap.js?v=0ed105086bfd');
  const [officeModule,living,bathroom,utility,stairs,led,entrance,kitchen,cathedral,electrical,records,electricalView,{RoomEnvironment}]=await Promise.all([
    import('./office-integration.js'),import('./living-interior.js?v=54501b62efb2'),import('./bathroom-finishes.js'),
    import('./utility-equipment.js'),import('./stair-finishes.js'),import('./interior-led.js'),
    import('./entrance-interior.js'),import('./kitchen-window-worktop.js'),import('./cathedral-interior.js'),
    import('./electrical-model.js'),import('./electrical-points.js'),import('./electrical-view.js'),
    import('three/addons/environments/RoomEnvironment.js'),
  ]);
  const offices=await officeModule.loadOfficeIntegration();
  const bathroomFinishes=bathroom.createBathroomFinishes(THREE,data);
  const prepared=entrance.prepareEntranceData(kitchen.prepareKitchenWindowData(living.prepareLivingData(data)));
  const exteriorIds=new Set(data.extWalls.map(wall=>wall.id));
  const shellData={...prepared,extWalls:prepared.extWalls.map(wall=>({...wall,h:exteriorWallHeight})),
    buildOpening(wall,opening,index){
      return exteriorIds.has(wall.id)?null:prepared.buildOpening(wall,opening,index);
    },
  };
  const builtRoots=[];
  const doors=[];
  const trackedBuild=(three,model)=>{
    const root=buildModel(three,model);
    if(root.userData.walkDoor)doors.push(root);
    builtRoots.push(root);return root;
  };
  let house,environment;
  try {
    house=INTERIORS3D.buildHouse(THREE,shellData,{floorY:0,buildModel:trackedBuild,finishColors:living.finishColors,
      decorateWallMesh(mesh,wall){
        builtRoots.push(mesh);
        offices.decorateWallMesh(THREE,mesh,wall,data);
        bathroomFinishes.decorateWallMesh(mesh,wall);
        if(exteriorIds.has(wall.id)){
          insetFacade(mesh,wall,data.outline);
          if(roofWallProfile)capRoofWall(THREE,mesh,roofWallProfile,{offset:[data.originPlot.x,floorY,data.originPlot.z]});
        }
      },
    });
    builtRoots.push(house.root);
    house.root.name='garden-walk-interior';
    offices.attach(THREE,house,data,{buildModel:trackedBuild,renderer});
    const livingFitout=living.attachLivingInterior(THREE,house,data,{buildModel:trackedBuild,renderer,applyChampagneFloor:officeModule.applyChampagneFloor});
    led.attachInteriorLed(THREE,house,prepared);
    entrance.attachEntranceInterior(THREE,house,prepared,{buildModel:trackedBuild});
    kitchen.attachKitchenWindowWorktop(THREE,house,prepared);
    const cathedralFitout=cathedral.attachCathedralInterior(THREE,house,prepared);
    const upperEast=cathedralFitout.surfaces.find(mesh=>mesh.name==='Cathedral east upper wall');
    const vertices=upperEast.geometry.attributes.position;
    for(let i=0;i<vertices.count;i++)if(Math.abs(vertices.getY(i)-data.clearH)<1e-6)vertices.setY(i,exteriorWallHeight);
    vertices.needsUpdate=true;
    upperEast.geometry.computeBoundingBox();
    upperEast.geometry.computeBoundingSphere();
    bathroomFinishes.attach(house);
    stairs.attachStairFinishes(THREE,house,data,{renderer});
    utility.attachUtilityEquipment(THREE,house,data,{buildModel:trackedBuild});
    const panels=livingFitout.parts.filter(part=>part.material==='whiteGlass');
    house.electrical=electrical.attachElectricalPoints(THREE,house,records.ELECTRICAL_POINTS
      .filter(point=>point.building==='house'&&point.resolved&&!point.occupiedBy)
      .map(point=>electricalView.outletOnFinishedSurface(point,panels)));
    if(loftData){
      const {attachWalkLoft}=await import('./walk-loft.js');
      const groundDoorCount=doors.length;
      house.loftFitout=await attachWalkLoft(THREE,house,loftData,{buildModel:trackedBuild,renderer,applyChampagneFloor:officeModule.applyChampagneFloor,roof:loftRoof,windowModel:loftWindows});
      house.loft=house.loftFitout.loft;
      house.loft.doors=doors.splice(groundDoorCount);
      house.loft.electrical=electrical.attachElectricalPoints(THREE,house.loft,records.ELECTRICAL_POINTS.filter(point=>point.building==='loft'&&point.resolved&&!point.occupiedBy));
    }
    house.labels.visible=false;
    house.wallIds.visible=false;
    house.root.traverse(object=>{if(object.isLight){object.intensity=0;object.visible=false;}});
    house.root.position.y=floorY;
    house.root.userData.furnishedGroundFloor=true;
    house.doors=doors;
    const reflectionRoom=new RoomEnvironment(),reflectionGenerator=new THREE.PMREMGenerator(renderer);
    try{environment=reflectionGenerator.fromScene(reflectionRoom,.04);}
    finally{reflectionRoom.dispose();reflectionGenerator.dispose();}
    house.root.traverse(object=>{
      for(const material of [object.material].flat().filter(Boolean))if(material.isMeshStandardMaterial){
        material.envMap=environment.texture;material.envMapIntensity=.65;material.needsUpdate=true;
      }
    });
    house.dispose=()=>disposeRoots([house.root],environment);
    return house;
  } catch(error) {
    disposeRoots(builtRoots,environment);
    throw error;
  }
}
