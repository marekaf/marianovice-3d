export const plankSamples = [[.003,.247,.01,.99],[.253,.497,.01,.99],[.503,.747,.01,.99],[.753,.997,.01,.99]];

export function createFloorCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const board = Math.floor(x / 128), u = x % 128;
      const bend = 2.8 * Math.sin(y / 170 + board * 2) + 1.2 * Math.sin(y / 61 + board);
      const grain = Math.sin((u + bend) * 1.7 + board) * 1.8
        + Math.sin((u + bend) * .29 + board * 4) * 3.2
        + Math.sin((u + bend) * .071 + board * 2) * 4;
      const noise = ((Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 0) % 101 / 100 - .5;
      const shade = grain + noise * 2 + [0, 2, -2, 1][board];
      const offset = (y * canvas.width + x) * 4;
      pixels.data[offset] = 192 + shade;
      pixels.data[offset + 1] = 178 + shade;
      pixels.data[offset + 2] = 154 + shade;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export function createFloorTexture(THREE, renderer) {
  const texture = new THREE.CanvasTexture(createFloorCanvas());
  texture.name = 'Procedural pale oak floor';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}
