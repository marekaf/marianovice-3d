export function cathedralGeometry(data) {
  const room = data.rooms.find(room => room.id === '1.06');
  const voidBounds = data.lid.holes.find(hole => hole.x0 === room.x0 && hole.x1 === room.x1 && hole.z1 === room.z1);
  const ridgeX = 7.00, ridgeY = 7.15 - .292 * Math.SQRT2;
  return { ...voidBounds, ridgeX, ridgeY, baseY: data.clearH,
    westY: ridgeY - (ridgeX - voidBounds.x0), eastY: ridgeY - (voidBounds.x1 - ridgeX) };
}

export function attachCathedralInterior(THREE, house, data) {
  const geometry = cathedralGeometry(data);
  const { x0, x1, z0, z1, ridgeX, ridgeY, westY, eastY, baseY } = geometry;
  const roof = new THREE.Group();
  roof.name = 'Cathedral bioboard ceiling';
  roof.position.y = house.dims.floorY;
  house.ceiling.add(roof);
  const grain = new Uint8Array(64 * 256 * 4);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
    const i = (y * 64 + x) * 4;
    const tone = 239 + Math.round(5 * Math.sin(x * 1.73 + Math.sin(y / 39)) + 2 * Math.sin(y * .31 + x));
    grain.set([tone, tone, tone, 255], i);
  }
  const texture = new THREE.DataTexture(grain, 64, 256);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const board = new THREE.MeshStandardMaterial({ color: '#d7bd94', roughness: .87, side: THREE.DoubleSide, map: texture });
  const timber = new THREE.MeshStandardMaterial({ color: '#c9ae84', roughness: .85 });
  const paint = new THREE.MeshStandardMaterial({ color: '#ddd1be', roughness: .92, side: THREE.DoubleSide });
  const surfaces = [];
  function panel(name, points, parent, material) {
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    shape.setIndex(points.length === 5 ? [0, 1, 2, 0, 2, 3, 0, 3, 4] : [0, 1, 2, 0, 2, 3]);
    shape.setAttribute('uv', new THREE.Float32BufferAttribute(points.flatMap(([x, y, z]) => [x / .45, z / 2.4 + y / 12]), 2));
    shape.computeVertexNormals();
    const mesh = new THREE.Mesh(shape, material);
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    if (parent !== roof) mesh.position.y = house.dims.floorY;
    parent.add(mesh);
    surfaces.push(mesh);
    return mesh;
  }
  panel('Cathedral west roof lining', [[x0, westY, z0], [ridgeX, ridgeY, z0], [ridgeX, ridgeY, z1], [x0, westY, z1]], roof, board);
  panel('Cathedral east roof lining', [[ridgeX, ridgeY, z0], [x1, eastY, z0], [x1, eastY, z1], [ridgeX, ridgeY, z1]], roof, board);
  panel('Cathedral west lid-edge closure', [[x0, baseY, z0], [x0, westY, z0], [x0, westY, z1], [x0, baseY, z1]], house.walls.W, paint);
  panel('Cathedral east upper wall', [[x1, baseY, z0], [x1, eastY, z0], [x1, eastY, z1], [x1, baseY, z1]], house.walls.E, paint);
  for (const [name, z] of [['north', z0], ['south', z1]]) {
    panel(`Cathedral ${name} upper enclosure`, [[x0, baseY, z], [x1, baseY, z], [x1, eastY, z], [ridgeX, ridgeY, z], [x0, westY, z]], house.int, paint);
  }
  const rafters = [];
  for (let z = z0 + .2; z < z1 - .1; z += .9) {
    for (const [name, startX, endX] of [['west', x0, ridgeX], ['east', ridgeX, x1]]) {
      const start = new THREE.Vector3(startX + .065, ridgeY - Math.abs(startX + .065 - ridgeX) - .13, z);
      const end = new THREE.Vector3(endX - .065, ridgeY - Math.abs(endX - .065 - ridgeX) - .13, z);
      const direction = end.clone().sub(start);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(.18, direction.length(), .1), timber);
      mesh.name = `Cathedral ${name} illustrative rafter ${rafters.length}`;
      mesh.position.copy(start).add(end).multiplyScalar(.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      mesh.castShadow = mesh.receiveShadow = true;
      roof.add(mesh);
      rafters.push(mesh);
    }
  }
  const notes = 'Cathedral lining follows the 292 mm nominal ST03 roof build-up, including its visible bioboard. Its ridge aligns with the exterior model; rafter spacing remains illustrative, not an as-built structural survey.';
  return { group: roof, geometry, surfaces, rafters, notes, presets: {
    cathedral: { position: [5.55, 1.6, 11.7], target: [7.15, 4.15, 8.9], cut: false, description: notes },
  } };
}
