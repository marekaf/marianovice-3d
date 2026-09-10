import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createExportInputs,parseExportArgs} from './export-inputs.mjs';
import {prepareIntegratedLoft,prepareExportScene} from './export-scene.mjs';

const args=parseExportArgs(process.argv.slice(2));
assert(!args.loftOnly,'This check requires the integrated house, not a supplement');
const inputs=await createExportInputs({...args,toolRoot:dirname(dirname(fileURLToPath(import.meta.url)))});
const require=createRequire(pathToFileURL(join(inputs.viewerRoot,'package.json')));
const load=async path=>import(pathToFileURL((await inputs.resolveRequest('/'+path)).file));
const THREE=await load('node_modules/three/build/three.module.js');
const {buildModel}=await load('model3d.js');
const {attachWalkLoft}=await load('docs/walk-loft.js');
const {HOUSE_LOFT:data}=require('./house-interior.js');
const {HouseRoof}=require('./house-roof.js');
const RoofWindows=require('./docs/house-roof-windows.js');
globalThis.INTERIORS3D=require('./interiors3d.js').INTERIORS3D;
globalThis.document={createElement(){return{getContext(){return{
  fillRect(){},fillText(){},createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}
};}};}};

const roof=HouseRoof.describe({bbox:[0,0,10.8,19.25],atrium:[0,8.75,4.45,12],gable:[3.2,10.8],baseY:0});
const windowModel=RoofWindows.build({gable:[3.2,10.8],ridgeY:roof.ridgeY,eaveY:roof.ridgeY-4.25,windows:[
  {side:'e',z:17.58,width:.66,height:1.4},{side:'e',z:13.6,width:.78,height:1.4},{side:'w',z:13.6,width:.78,height:1.4}
]});
const before=JSON.stringify(data),house={root:new THREE.Group()};
const result=await attachWalkLoft(THREE,house,data,{roof,windowModel,buildModel,applyChampagneFloor(){}});
house.loft=result.loft;
const coverage=prepareIntegratedLoft(house);
const exported=prepareExportScene(THREE,[{name:'house',object:house.root}],[0,0,0]);
let visibleMeshes=0;
house.root.traverseVisible(object=>{
  if(object.isMesh)visibleMeshes+=object.isInstancedMesh?object.count:1;
});
assert.equal(exported.manifest.meshes,visibleMeshes,'Every visible loft mesh transfers exactly once');
assert.throws(()=>prepareExportScene(THREE,[{name:'house',object:house.root},{name:'loft',object:house.loft.root}],[0,0,0]),/Overlapping export roots/);
assert.equal(JSON.stringify(data),before,'Export preparation must not alter source dimensions');
console.log(JSON.stringify({coverage,exportedMeshes:exported.manifest.meshes,scope:'Selected viewer loft factory with fixed roof fixture; no textures, browser, GLB or engine'},null,2));
