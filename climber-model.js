export const ClimberModel = {
  create(THREE, { width = 1.1, height = 2.2, seed = 1, blocked = () => false } = {}) {
    if (!(width >= .3 && height >= .4) || !Number.isFinite(width + height)) throw new Error('Climber requires finite wall dimensions');
    const root = new THREE.Group();
    root.name = 'facade-climber';
    root.userData = { plantingScale: .45, climber: true, width, height, depth: .22 };
    let state = seed >>> 0;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    const stems = [], leaves = [];
    const leafSize = Math.min(.115, height * .075, width * .15);
    const up = new THREE.Vector3(0, 1, 0);
    function branch(a, b, radius) {
      if (blocked(a, radius) || blocked(b, radius)) return false;
      const direction = b.clone().sub(a), length = direction.length();
      const geometry = new THREE.CylinderGeometry(radius * .72, radius, length, 5, 1, false);
      geometry.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()), new THREE.Vector3(1, 1, 1)));
      const plain = geometry.toNonIndexed();
      stems.push(...plain.attributes.position.array);
      geometry.dispose(); plain.dispose();
      return true;
    }
    function leaf(at, angle) {
      const size = leafSize * (.68 + random() * .32);
      if (blocked(at, size)) return;
      const stalk = new THREE.Vector3(Math.sin(angle) * size * .3, Math.cos(angle) * size * .3, .012);
      const origin = at.clone().add(stalk);
      if (!branch(at, origin, .0015)) return;
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler((random() - .5) * .9, (random() - .5) * .5, -angle));
      leaves.push({ matrix: new THREE.Matrix4().compose(origin, rotation, new THREE.Vector3(size, size, size)), shade: random() });
    }
    let previous = new THREE.Vector3(0, 0, .045);
    for (let tier = 1; tier <= 10; tier++) {
      const t = (tier - .4 + random() * .4) / 10;
      const trunk = new THREE.Vector3(Math.sin(t * 8 + seed) * width * .08 * t, height * t * .76, .045 + t * .024);
      if (!branch(previous, trunk, .014 * (1 - t * .55))) break;
      for (const side of [-1, 1]) {
        const reach = Math.min(width * .5 - Math.abs(trunk.x) - leafSize * 1.4, width * (.1 + random() * .26) * Math.sin(Math.PI * (.15 + t * .68)));
        const rise = height * (.012 + random() * .12);
        const curl = (random() - .5) * height * .065;
        let start = trunk;
        for (let step = 1; step <= 8; step++) {
          const u = step / 8;
          const point = new THREE.Vector3(trunk.x + side * reach * u, trunk.y + rise * u + curl * Math.sin(u * Math.PI), .07 + Math.sin(u * Math.PI) * .03);
          if (!branch(start, point, .004 * (1 - u * .55))) break;
          leaf(point, side * (.65 + random() * .5));
          if (step % 2 === 0) leaf(point, -side * (.55 + random() * .6));
          start = point;
        }
      }
      previous = trunk;
    }
    if (stems.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(stems, 3));
      geometry.computeVertexNormals();
      const wood = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#62503a', roughness: .95 }));
      wood.name = 'climber-branches'; wood.castShadow = true; wood.receiveShadow = true;
      root.add(wood);
    }
    const outline = [[0, 0], [-.27, .22], [-.48, .45], [-.25, .48], [-.35, .75], [-.13, .67], [0, 1], [.15, .67], [.35, .75], [.25, .48], [.48, .45], [.27, .22]];
    const points = [], shades = [];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      points.push(0, .48, .075, a[0], a[1], 0, b[0], b[1], 0);
      const edge = i % 2 ? .86 : .96;
      shades.push(1, 1, 1, edge, edge, edge, edge, edge, edge);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(shades, 3));
    geometry.computeVertexNormals();
    const foliage = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .76, side: THREE.DoubleSide, vertexColors: true }), leaves.length);
    const dark = new THREE.Color('#315631'), light = new THREE.Color('#68834b');
    leaves.forEach(({ matrix, shade }, i) => { foliage.setMatrixAt(i, matrix); foliage.setColorAt(i, dark.clone().lerp(light, shade)); });
    foliage.name = 'climber-leaves'; foliage.userData.leafHabit = 'deciduous';
    foliage.castShadow = true; foliage.receiveShadow = true;
    root.add(foliage);
    return root;
  }
};
