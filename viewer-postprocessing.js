import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';

// The scene is drawn exactly as it was drawn to the screen, then SMAA smooths that picture. Materials
// tone map, encode to sRGB and only then blend fog, and three does all of that only for the screen
// or for a target flagged as an XR target. Flagging the scene target keeps the fog and the raw sky
// dome as they were; a half-float texture stores those encoded values without a second encoding.
export function createViewerPostprocessing({THREE,renderer,scene,camera,samples=0}) {
  const size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio();
  const target=new THREE.WebGLRenderTarget(size.width*ratio,size.height*ratio,{type:THREE.HalfFloatType,samples,colorSpace:THREE.SRGBColorSpace});
  const composer=new EffectComposer(renderer,target);
  composer.setSize(size.width,size.height);
  for(const buffer of [composer.renderTarget1,composer.renderTarget2])buffer.isXRRenderTarget=true;
  const passes=[new RenderPass(scene,camera),new SMAAPass()];
  for(const pass of passes)composer.addPass(pass);
  return {
    passes,
    render(){composer.render();},
    setSize(width,height){composer.setSize(width,height);},
    setPixelRatio(value){composer.setPixelRatio(value);},
    dispose(){composer.dispose();},
  };
}
