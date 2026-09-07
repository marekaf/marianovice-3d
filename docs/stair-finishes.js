import { createFloorTexture, plankSamples } from './floor-texture.js';

export function stairFinishSurfaces(stairs) {
  const alongX = stairs.toward === 'E' || stairs.toward === 'W';
  const length = alongX ? stairs.x1 - stairs.x0 : stairs.z1 - stairs.z0;
  const width = alongX ? stairs.z1 - stairs.z0 : stairs.x1 - stairs.x0;
  const going = length / stairs.steps, thickness = .0025, margin = .003;
  const point = (u, v, height) => stairs.toward === 'E' ? [stairs.x0 + u, height, stairs.z0 + v]
    : stairs.toward === 'W' ? [stairs.x1 - u, height, stairs.z1 - v]
    : stairs.toward === 'S' ? [stairs.x1 - v, height, stairs.z0 + u]
    : [stairs.x0 + v, height, stairs.z1 - u];
  const surfaces = [];
  for (let step = 0; step < stairs.steps; step++) {
    const top = (step + 1) * stairs.rise;
    surfaces.push({ name: `vinyl_tread_${step}`, kind: 'tread', step,
      position: point((step + .5) * going, width / 2, top + thickness / 2),
      size: alongX ? [going - 2 * margin, thickness, width - 2 * margin] : [width - 2 * margin, thickness, going - 2 * margin] });
    surfaces.push({ name: `vinyl_riser_${step}`, kind: 'riser', step,
      position: point(step * going - thickness / 2, width / 2, top - stairs.rise / 2),
      size: alongX ? [thickness, stairs.rise - 2 * margin, width - 2 * margin] : [width - 2 * margin, stairs.rise - 2 * margin, thickness] });
  }
  return surfaces;
}

export function attachStairFinishes(THREE, house, data, { renderer }) {
  const flight = house.root.getObjectByName('Stair flight');
  if (!flight) throw new Error('Vinyl stair finishes require the measured solid stair flight');
  flight.traverse(mesh => {
    if (mesh.material?.name === 'stair') { mesh.material.color.set('#ddd1be'); mesh.material.roughness = .9; }
  });
  const texture = createFloorTexture(THREE, renderer);
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .82, map: texture });
  material.name = 'stairChampagne';
  const group = new THREE.Group();
  group.name = 'Champagne stair finishes';
  group.position.y = house.dims.floorY;
  const samples = plankSamples;
  for (const surface of stairFinishSurfaces(data.stairs)) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...surface.size), material);
    mesh.name = surface.name;
    mesh.position.set(...surface.position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.surface = surface;
    const { position, uv } = mesh.geometry.attributes;
    const [u0, u1, v0, v1] = samples[surface.step % samples.length];
    const alongX = data.stairs.toward === 'E' || data.stairs.toward === 'W';
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) + surface.size[0] / 2;
      const y = position.getY(i) + surface.size[1] / 2;
      const z = position.getZ(i) + surface.size[2] / 2;
      const across = surface.kind === 'tread' ? x / Math.max(.225, surface.size[0]) : y / .225;
      const along = surface.kind === 'tread' ? z / 1.524 : (alongX ? z : x) / 1.524;
      uv.setXY(i, u0 + across * (u1 - u0), v0 + along * (v1 - v0));
    }
    uv.needsUpdate = true;
    group.add(mesh);
  }
  house.int.add(group);
  return group;
}
