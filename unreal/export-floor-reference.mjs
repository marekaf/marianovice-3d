import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export async function createFloorReference(file) {
  if(!file)return null;
  const bytes=await readFile(file);
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!jpeg)throw new Error('Floor reference must be the selected JPEG plank reference');
  const module=`export const plankSamples=[[.003,.247,.55,.98],[.253,.497,.02,.98],[.503,.747,.02,.98],[.753,.997,.29,.98]];
const pending=[];
export function createFloorTexture(THREE,renderer){
  let texture;
  const ready=new Promise((resolve,reject)=>{
    texture=new THREE.TextureLoader().load('/__export/floor-reference.jpg',resolve,undefined,()=>reject(new Error('Local floor reference failed to load')));
  });
  ready.catch(()=>{});pending.push(ready);
  texture.name='Local Floorify Champagne reference';
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
  return texture;
}
export function waitForFloorReference(){return Promise.all(pending);}
`;
  const sha=body=>createHash('sha256').update(body).digest('hex');
  return {module,bytes,metadata:{mode:'local-reference',sha256:sha(bytes),moduleSha256:sha(module)}};
}
