import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mountTour} from './tour-viewer.js';

const elements=new Map();
globalThis.document={
  getElementById(id){if(!elements.has(id))elements.set(id,{replaceChildren(){}});return elements.get(id);},
  body:{append(){}},createElement:()=>({}),
};
globalThis.window={devicePixelRatio:1,innerWidth:800,innerHeight:600,addEventListener(){}};
let draw,renderedScene;
class Renderer {
  constructor(){
    this.domElement={addEventListener(){}};
    this.xr={setReferenceSpaceType(){},getController:()=>new THREE.Group()};
  }
  setPixelRatio(){}
  setSize(){}
  setAnimationLoop(callback){draw=callback;}
  render(scene){renderedScene=scene;}
}
const loads=[];
class TextureLoader {
  load(url,onLoad,onProgress,onError){loads.push({url,onLoad,onError});}
}
globalThis.fetch=async()=>({ok:true,json:async()=>({stereo:true,stills:
  ['A','B','C','D'].map((name,index)=>({index,name,file:`${name}.png`,hotspots:[]})),
})});
const tour=mountTour({...THREE,WebGLRenderer:Renderer,TextureLoader},{createButton(){}},{source:'http://localhost/tour.json'});
await new Promise(resolve=>setImmediate(resolve));
draw();
const status=elements.get('tourStatus');
const complete=(request,name)=>request.onLoad(new THREE.Texture({name}));
const visible=()=>renderedScene.children.filter(object=>object.isMesh).map(mesh=>mesh.material.map.image.name);
tour.show(1);
complete(loads[1],'B');
complete(loads[0],'A');
assert.equal(tour.current.index,1);
assert.equal(status.textContent,'B','Late success cannot replace the selected room status');
assert.deepEqual(visible(),['B','B'],'Both eyes keep the selected panorama');
tour.show(0);
assert.equal(loads.length,2,'A stale success remains available in the cache');
assert.deepEqual(visible(),['A','A']);

tour.show(2);
const staleFailure=loads.at(-1);
tour.show(1);
staleFailure.onError();
assert.equal(status.textContent,'B','Late failure cannot replace a cached selection');
assert.deepEqual(visible(),['B','B']);

tour.show(3);
const oldVisit=loads.at(-1);
tour.show(1);
tour.show(3);
const newVisit=loads.at(-1);
oldVisit.onError();
assert.equal(status.textContent,'Loading D…','An earlier visit to the same room is stale too');
newVisit.onError();
assert.equal(status.textContent,'Could not load D.png','The current request still reports errors');
console.log('Tour loading: out-of-order successes, stale failures, cached navigation and repeated visits preserve the selected room.');
