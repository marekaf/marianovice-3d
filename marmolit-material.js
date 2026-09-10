const tileSize = .08;

export function marmolitUVs(geometry) {
  const { position, normal, uv } = geometry.attributes;
  for (let i = 0; i < position.count; i++) {
    const n = [Math.abs(normal.getX(i)), Math.abs(normal.getY(i)), Math.abs(normal.getZ(i))];
    const axes = [0, 1, 2].filter(axis => axis !== n.indexOf(Math.max(...n)));
    const p = [position.getX(i), position.getY(i), position.getZ(i)];
    uv.setXY(i, p[axes[0]] / tileSize, p[axes[1]] / tileSize);
  }
}

export function createMarmolitMaterial(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#272625';
  ctx.fillRect(0, 0, 256, 256);
  let seed = 9206;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
  for (let row = 0; row < 32; row++) for (let col = 0; col < 32; col++) {
    const x = col * 8 + random() * 5, y = row * 8 + random() * 5;
    const radius = 2.7 + random() * 1.8, value = 43 + Math.floor(random() * 39);
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) {
      const gradient = ctx.createRadialGradient(x + dx - 1, y + dy - 1, .2, x + dx, y + dy, radius);
      gradient.addColorStop(0, `rgb(${value + 17},${value + 14},${value + 12})`);
      gradient.addColorStop(.7, `rgb(${value},${value - 2},${value - 3})`);
      gradient.addColorStop(1, '#292827');
      ctx.fillStyle = gradient;
      ctx.beginPath();ctx.arc(x + dx, y + dy, radius, 0, Math.PI * 2);ctx.fill();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', map, bumpMap: map, bumpScale: .00065, roughness: .65 });
  material.name = 'Marmolit MAR2 M092';
  material.userData.finish = { code: 'MAR2 M092', hbw: 6, accuracy: 'Procedural approximation of the supplied aggregate sample' };
  return material;
}
