export const plankSamples = [[.003,.247,.55,.98],[.253,.497,.02,.98],[.503,.747,.02,.98],[.753,.997,.29,.98]];
const pending = [];

export function createFloorTexture(THREE, renderer) {
  let texture;
  const ready = new Promise((resolve, reject) => {
    texture = new THREE.TextureLoader().load(new URL('../floorify-champagne.jpg', import.meta.url).href,
      () => resolve(), undefined, () => reject(new Error('Floorify Champagne texture failed to load')));
  });
  ready.catch(() => {});
  pending.push(ready);
  texture.name = 'Floorify Champagne';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

export function waitForFloorReference() {
  return Promise.all(pending);
}
