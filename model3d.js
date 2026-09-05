import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function timberTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const wave = x + 2.2 * Math.sin(y * Math.PI / 256) + 0.7 * Math.sin(y * Math.PI / 64);
      const fine = Math.sin(wave * 1.73) * Math.sin(wave * 0.31);
      const rings = Math.sin(wave * 0.14 + 0.8 * Math.sin(wave * 0.033));
      const value = Math.round(220 + fine * 8 + rings * 12);
      const i = (y * canvas.width + x) * 4;
      pixels.data[i] = value;
      pixels.data[i + 1] = value;
      pixels.data[i + 2] = value;
      pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function timberUVs(geometry, grain, seed) {
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  const axis = { x: 0, y: 2, z: 1 }[grain];
  const offset = seed * 0.61803398875 % 1;
  for (let i = 0; i < positions.count; i++) {
    const p = [positions.getX(i), positions.getY(i), positions.getZ(i)];
    const n = [Math.abs(normals.getX(i)), Math.abs(normals.getY(i)), Math.abs(normals.getZ(i))];
    const faceAxis = n.indexOf(Math.max(...n));
    const along = axis === faceAxis ? (axis + 1) % 3 : axis;
    const across = [0, 1, 2].find(a => a !== faceAxis && a !== along);
    uv.setXY(i, p[across] / 0.32 + offset, p[along] / 2.4 + offset);
  }
}

export function buildModel(THREE, model) {
  const group = new THREE.Group();
  group.name = model.name;
  const categoryNames = new Set(['structure', 'roof', 'furniture',
    ...model.parts.map(part => part.category || 'structure'),
    ...model.lights.map(light => light.category || 'structure')]);
  const categories = Object.fromEntries([...categoryNames].map(name => {
    const category = new THREE.Group();
    category.name = name;
    category.visible = model.categoryVisibility?.[name] !== false;
    group.add(category);
    return [name, category];
  }));
  const wood = timberTexture(THREE);
  const materials = new Map(Object.entries(model.materials).map(([name, spec]) => {
    const material = new THREE.MeshPhysicalMaterial({
      color: spec.color,
      roughness: spec.roughness,
      metalness: spec.metalness || 0,
      transmission: spec.transmission || 0,
      thickness: spec.transmission ? 0.035 : 0,
      ior: name.toLowerCase().includes('water') ? 1.333 : 1.5,
      emissive: spec.emissive || '#000000',
      emissiveIntensity: spec.emissiveIntensity || 0,
      ...(spec.grain ? { map: wood, bumpMap: wood, bumpScale: 0.0007 } : {}),
    });
    material.name = name;
    return [name, material];
  }));
  const batches = new Map();
  for (const [index, part] of model.parts.entries()) {
    let geometry;
    if (part.type === 'box') {
      const [w, d, h] = part.size;
      const radius = Math.min(part.bevel || 0, w / 4, d / 4, h / 4);
      geometry = radius > 0
        ? new RoundedBoxGeometry(w, h, d, 1, radius)
        : new THREE.BoxGeometry(w, h, d);
      if (model.materials[part.material].grain) timberUVs(geometry, model.materials[part.material].grain, index);
    } else if (part.type === 'beam') {
      const start = new THREE.Vector3(part.start[0], part.start[2], part.start[1]);
      const end = new THREE.Vector3(part.end[0], part.end[2], part.end[1]);
      const direction = end.clone().sub(start);
      const length = direction.length();
      const radius = Math.min(part.bevel || 0, part.width / 4, part.depth / 4, length / 4);
      geometry = radius > 0
        ? new RoundedBoxGeometry(part.width, length, part.depth, 1, radius)
        : new THREE.BoxGeometry(part.width, length, part.depth);
      if (model.materials[part.material].grain) timberUVs(geometry, model.materials[part.material].grain, index);
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
      const center = start.add(end).multiplyScalar(0.5);
      geometry.translate(center.x, center.y, center.z);
    } else if (part.type === 'cylinder') {
      geometry = new THREE.CylinderGeometry(part.radiusTop, part.radiusBottom, part.height, part.segments || 32);
      if (model.materials[part.material].grain) {
        const { uv, normal, position } = geometry.attributes;
        for (let i = 0; i < uv.count; i++) {
          if (Math.abs(normal.getY(i)) < 0.5) {
            const radius = part.radiusBottom + (part.radiusTop - part.radiusBottom) * uv.getY(i);
            uv.setXY(i, uv.getX(i) * Math.PI * 2 * radius / 0.32, uv.getY(i) * part.height / 2.4);
          } else {
            uv.setXY(i, position.getX(i) / 0.32, position.getZ(i) / 0.32);
          }
        }
      }
      if (part.axis === 'x') geometry.rotateZ(Math.PI / 2);
      if (part.axis === 'y') geometry.rotateX(Math.PI / 2);
    } else if (part.type === 'sphere') {
      geometry = new THREE.SphereGeometry(0.5, 16, 12);
      geometry.scale(part.size[0], part.size[2], part.size[1]);
    } else if (part.type === 'lathe') {
      geometry = new THREE.LatheGeometry(part.profile.map(([radius, height]) => new THREE.Vector2(radius, height)), part.segments || 64);
    } else if (part.type === 'mesh') {
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.vertices.flatMap(([x, y, z]) => [x, z, y]), 3));
      const indices = [];
      for (const face of part.faces) {
        for (let i = 1; i < face.length - 1; i++) indices.push(face[0], face[i + 1], face[i]);
      }
      geometry.setIndex(indices);
      geometry = geometry.toNonIndexed();
      geometry.computeVertexNormals();
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
      if (model.materials[part.material].grain) timberUVs(geometry, model.materials[part.material].grain, index);
    } else {
      throw new Error(`Unsupported model geometry: ${part.type}`);
    }
    const material = materials.get(part.material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = part.name;
    if (part.position) mesh.position.set(part.position[0], part.position[2], part.position[1]);
    mesh.castShadow = !material.transmission;
    mesh.receiveShadow = !material.transmission;
    const category = part.category || 'structure';
    if (material.transmission) {
      categories[category].add(mesh);
    } else {
      const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      baked.translate(mesh.position.x, mesh.position.y, mesh.position.z);
      const key = `${category}/${part.material}`;
      if (!batches.has(key)) batches.set(key, { category, material: part.material, geometries: [] });
      batches.get(key).geometries.push(baked);
      geometry.dispose();
    }
  }
  for (const { material, category, geometries } of batches.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), materials.get(material));
    mesh.name = `${model.name}_${category}_${material}`;
    mesh.castShadow = mesh.receiveShadow = true;
    categories[category].add(mesh);
    geometries.forEach(geometry => geometry.dispose());
  }
  const lights = model.lights.map(spec => {
    const light = new THREE.PointLight(spec.color, 0, 5, 2);
    light.name = spec.name;
    light.position.set(spec.position[0], spec.position[2], spec.position[1]);
    light.userData.night = Math.min(10, spec.power / 12);
    categories[spec.category || 'structure'].add(light);
    return light;
  });
  group.position.y = model.floorHeight;
  group.userData.lights = lights;
  group.userData.categories = categories;
  return group;
}
