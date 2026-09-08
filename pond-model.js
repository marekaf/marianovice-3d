export const PondModel = {
  create(THREE, { basin, groundGeometry }) {
    const { cx, cz, rx, rz } = basin;
    const areaScale=rx*rz/5.6,edgeScale=Math.sqrt(areaScale);
    const stoneCount=Math.max(24,Math.round(380*areaScale)),shoreCount=Math.min(stoneCount,Math.max(8,Math.round(32*edgeScale)));
    const clumpCount=Math.max(2,Math.round(8*edgeScale)),lilyCount=Math.max(1,Math.round(6*areaScale));
    const waterLevel = basin.edge - 0.1;
    const group = new THREE.Group();
    group.name = 'Natural garden pond';
    const plantingGroup = new THREE.Group();
    plantingGroup.name = 'Pond marginal plants and lilies';
    let seed = 82719;
    const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
    const ellipse = Array.from({ length: 64 }, (_, i) => [cx + rx * Math.cos(i * Math.PI / 32), cz + rz * Math.sin(i * Math.PI / 32)]);
    function clip(points, distance) {
      const out = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length], da = distance(a), db = distance(b);
        if (da >= 0) out.push(a);
        if ((da >= 0) !== (db >= 0)) {
          const t = da / (da - db);
          out.push(a.map((value, axis) => value + (b[axis] - value) * t));
        }
      }
      return out;
    }
    const source = groundGeometry.attributes.position, index = groundGeometry.index;
    const triangles = [], liner = [], waterVertices = [], colors = [];
    const dry = new THREE.Color('#9d9380'), wet = new THREE.Color('#726d54');
    for (let i = 0; i < index.count; i += 3) {
      let polygon = [0, 1, 2].map(j => { const n = index.getX(i + j); return [source.getX(n), source.getY(n), source.getZ(n)]; });
      if (Math.max(...polygon.map(p => p[0])) < cx - rx || Math.min(...polygon.map(p => p[0])) > cx + rx
        || Math.max(...polygon.map(p => p[2])) < cz - rz || Math.min(...polygon.map(p => p[2])) > cz + rz) continue;
      triangles.push(polygon);
      for (let edge = 0; edge < ellipse.length && polygon.length; edge++) {
        const a = ellipse[edge], b = ellipse[(edge + 1) % ellipse.length];
        polygon = clip(polygon, p => (b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
      }
      for (let j = 1; j < polygon.length - 1; j++) for (const p of [polygon[0], polygon[j], polygon[j + 1]]) {
        liner.push(p[0], p[1] + 0.008, p[2]);
        const tint = wet.clone().lerp(dry, THREE.MathUtils.clamp((p[1] - waterLevel + 0.06) / 0.2, 0, 1));
        colors.push(tint.r, tint.g, tint.b);
      }
      const submerged = clip(polygon, p => waterLevel - 0.012 - p[1]);
      for (let j = 1; j < submerged.length - 1; j++) for (const p of [submerged[0], submerged[j], submerged[j + 1]]) waterVertices.push(p[0], waterLevel, p[2]);
    }
    function surfaceHeight(x, z) {
      for (const [a, b, c] of triangles) {
        const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
        if (Math.abs(denominator) < 1e-12) continue;
        const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
        const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator;
        if (u >= -1e-7 && v >= -1e-7 && u + v <= 1.0000001) return u * a[1] + v * b[1] + (1 - u - v) * c[1] + 0.008;
      }
      return basin.edge;
    }
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = textureCanvas.height = 128;
    const context = textureCanvas.getContext('2d'), pixels = context.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4;
      const n = 155 + random() * 80;
      pixels.data.set([n, n, n, 255], i);
    }
    context.putImageData(pixels, 0, 0);
    const gravelMap = new THREE.CanvasTexture(textureCanvas);
    gravelMap.wrapS = gravelMap.wrapT = THREE.RepeatWrapping;
    function geometry(vertices) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from({ length: vertices.length / 3 }, (_, i) => [vertices[i * 3] * 2, vertices[i * 3 + 2] * 2]).flat(), 2));
      geo.computeVertexNormals();
      return geo;
    }
    const linerGeometry = geometry(liner);
    linerGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const floor = new THREE.Mesh(linerGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, map: gravelMap, bumpMap: gravelMap, bumpScale: 0.013, roughness: 0.94 }));
    floor.name = 'Pond gravel basin';
    floor.receiveShadow = true;
    group.add(floor);
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = normalCanvas.height = 128;
    const normalContext = normalCanvas.getContext('2d'), normalPixels = normalContext.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4, u = x * Math.PI * 2 / 128, v = y * Math.PI * 2 / 128;
      normalPixels.data.set([128 + 18 * Math.sin(u * 3 + v * 2) + 8 * Math.cos(u * 7 - v), 128 + 14 * Math.cos(v * 4 + u) + 7 * Math.sin(u * 2 - v * 5), 253, 255], i);
    }
    normalContext.putImageData(normalPixels, 0, 0);
    const waterNormal = new THREE.CanvasTexture(normalCanvas);
    waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping;
    const water = new THREE.Mesh(geometry(waterVertices), new THREE.MeshPhysicalMaterial({ color: '#91aca0', roughness: 0.12,
      transmission: 0.68, thickness: 0.35, ior: 1.333, attenuationColor: '#4b6958', attenuationDistance: 1.7,
      normalMap: waterNormal, normalScale: new THREE.Vector2(0.12, 0.12), transparent: true, opacity: 0.9 }));
    water.name = 'Pond water';
    group.add(water);
    const stoneGeometry = new THREE.IcosahedronGeometry(1, 1);
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: '#aba391', roughness: 0.95 });
    const stones = new THREE.InstancedMesh(stoneGeometry, stoneMaterial, stoneCount);
    stones.name = 'Partly buried shore stones';
    const transform = new THREE.Object3D(), contacts = [];
    for (let i = 0; i < stoneCount; i++) {
      const angle = random() * Math.PI * 2, r = i < shoreCount ? 0.79 + random() * 0.14 : 0.35 + Math.sqrt(random()) * 0.59;
      const width = i < shoreCount ? 0.11 + random() * 0.14 : 0.018 + random() * 0.035;
      const inset = Math.min(r, 1 - width / Math.min(rx, rz) - 0.012);
      const x = cx + Math.cos(angle) * rx * inset, z = cz + Math.sin(angle) * rz * inset;
      const h = width * (0.42 + random() * 0.25);
      const sampled = [-0.8, 0, 0.8].flatMap(dx => [-0.8, 0, 0.8].map(dz => surfaceHeight(x + dx * width, z + dz * width)));
      const base = Math.min(...sampled) - h * 0.65;
      transform.position.set(x, base + h, z);
      transform.rotation.set(0, random() * Math.PI * 2, 0);
      transform.scale.set(width, h, width * (0.65 + random() * 0.3));
      transform.updateMatrix();
      stones.setMatrixAt(i, transform.matrix);
      stones.setColorAt(i, new THREE.Color().setHSL(0.1, 0.08 + random() * 0.1, 0.52 + random() * 0.18));
      contacts.push({ x, z, bottom: base, ground: surfaceHeight(x, z), radius: width });
    }
    stones.castShadow = stones.receiveShadow = true;
    group.add(stones);
    const bladeGeometry = new THREE.BufferGeometry();
    bladeGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.015, 0, 0, 0.015, 0, 0, 0.018, 0.55, 0.08, 0, 1, 0.22, -0.012, 0.55, 0.08], 3));
    bladeGeometry.setIndex([0, 1, 2, 0, 2, 4, 4, 2, 3]);
    bladeGeometry.computeVertexNormals();
    const plants = new THREE.InstancedMesh(bladeGeometry, new THREE.MeshStandardMaterial({ color: '#526c3b', side: THREE.DoubleSide, roughness: 0.93 }), clumpCount*18);
    plants.name = 'Pond marginal foliage';
    let plant = 0;
    for (let clump = 0; clump < clumpCount; clump++) {
      const angle = 0.1 + clump * 2.38/(clumpCount-1);
      const x = cx + Math.cos(angle) * rx * 0.88, z = cz + Math.sin(angle) * rz * 0.88;
      for (let i = 0; i < 18; i++) {
        const px = x + (random() - 0.5) * 0.12, pz = z + (random() - 0.5) * 0.12;
        transform.position.set(px, surfaceHeight(px, pz), pz);
        transform.rotation.set(0, random() * Math.PI * 2, (random() - 0.5) * 0.35);
        transform.scale.setScalar(0.32 + random() * 0.42);
        transform.updateMatrix();
        plants.setMatrixAt(plant++, transform.matrix);
      }
    }
    plants.castShadow = true;
    plantingGroup.add(plants);
    const padMaterial = new THREE.MeshStandardMaterial({ color: '#4f703e', roughness: 0.52, side: THREE.DoubleSide });
    for (let i = 0; i < lilyCount; i++) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      for (let j = 0; j <= 30; j++) { const angle = 0.22 + j / 30 * (Math.PI * 2 - 0.44); shape.lineTo(Math.cos(angle) * 0.12, Math.sin(angle) * 0.1); }
      shape.closePath();
      const pad = new THREE.Mesh(new THREE.ShapeGeometry(shape), padMaterial);
      pad.rotation.set(-Math.PI / 2, 0, random() * Math.PI * 2);
      pad.position.set(cx + rx*(.18 + (random() - 0.5) * .30), waterLevel + 0.004, cz + rz*(-.075 + (random() - 0.5) * .35));
      pad.name = 'Floating lily pad';
      plantingGroup.add(pad);
    }
    group.userData.contacts = contacts;
    group.userData.waterLevel = waterLevel;
    return { group, plantingGroup, waterNormal, waterLevel, surfaceHeight };
  },
};
