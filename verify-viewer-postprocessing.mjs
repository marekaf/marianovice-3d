import assert from 'node:assert/strict';
import * as THREE from 'three';
// SMAA loads its lookup textures through an Image; Node has none.
globalThis.Image=class{};
const {createViewerPostprocessing}=await import('./viewer-postprocessing.js');
const renderer={getSize:v=>v.set(800,600),getPixelRatio:()=>2,getRenderTarget:()=>null,setRenderTarget(){},render(){},getClearColor:()=>new THREE.Color(),getClearAlpha:()=>1,setClearColor(){}};
const post=createViewerPostprocessing({THREE,renderer,scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),samples:4});
assert.deepEqual(post.passes.map(p=>p.constructor.name),['RenderPass','SMAAPass'],'SMAA smooths the finished picture');
assert.equal(post.passes[0].renderToScreen,false);
const scene=post.passes[0];
post.setSize(1000,500);post.setPixelRatio(1.5);
console.log(JSON.stringify({postprocessing:post.passes.length,scenePass:scene.constructor.name}));
