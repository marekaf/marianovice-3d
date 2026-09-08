import { createFloorTexture, plankSamples } from './floor-texture.js';

const source = new URL('.', import.meta.url);

function loadScript(name) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(name, source).href;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${name}`));
    document.head.append(script);
  });
}

export async function loadOfficeIntegration() {
  if (typeof OfficeRooms === 'undefined') await loadScript('office-rooms.js');
  if (typeof OfficeFurniture === 'undefined') await loadScript('office-furniture.js');
  return { createOffice, decorateWallMesh, attach };
}

export function applyChampagneFloor(THREE, group, roomModel, renderer) {
  const texture = createFloorTexture(THREE, renderer);
  const { width, length, offsets } = roomModel.floorLayout;
  const { x0, z0 } = roomModel.bounds;
  const samples = plankSamples;
  group.traverse(o => {
    if (o.material?.name !== 'floorWood') return;
    o.material.map = texture;
    o.material.needsUpdate = true;
    const { position, uv } = o.geometry.attributes;
    for (let i = 0; i < position.count; i += 3) {
      const cx = (position.getX(i) + position.getX(i + 1) + position.getX(i + 2)) / 3;
      const cz = (position.getZ(i) + position.getZ(i + 1) + position.getZ(i + 2)) / 3;
      const column = Math.max(0, Math.min(offsets.length - 1, Math.floor((cx - x0) / width)));
      const origin = z0 + offsets[column], row = Math.floor((cz - origin) / length);
      const variant = ((column * 7 + row * 3) % 4 + 4) % 4;
      const [u0, u1, v0, v1] = samples[variant];
      for (let j = i; j < i + 3; j++) {
        const u = (position.getX(j) - x0 - column * width) / width;
        const v = (position.getZ(j) - origin - row * length) / length;
        uv.setXY(j, u0 + u * (u1 - u0), v0 + ((column + row) % 2 === 0 ? v : 1 - v) * (v1 - v0));
      }
    }
    uv.needsUpdate = true;
  });
}

function createOffice(THREE, house, id, { buildModel, renderer, standing = false, shelfLed = true, doorOpen = false, finishesOnly = false } = {}) {
  const roomModel = OfficeRooms.build(house, id, { doorOpen });
  const furnitureModel = OfficeFurniture.build(id, { standing, shelfLed });
  const shellModel = finishesOnly ? { ...roomModel, parts: roomModel.parts.filter(p => p.name.startsWith('plank_')) } : roomModel;
  const shell = buildModel(THREE, shellModel);
  applyChampagneFloor(THREE, shell, roomModel, renderer);
  const furniture = buildModel(THREE, furnitureModel);
  furniture.userData.lights = furniture.userData.lights.map(light => {
    const downlight = new THREE.SpotLight(light.color, light.userData.night, 4, Math.PI / 2.2, .7, 2);
    downlight.name = light.name;
    downlight.position.copy(light.position);
    downlight.target.position.copy(light.position).y -= 1;
    light.parent.add(downlight, downlight.target);
    light.removeFromParent();
    return downlight;
  });
  return { roomModel, furnitureModel, shell, furniture };
}

const roomCache = new WeakMap();
function decorateWallMesh(THREE, mesh, wall, house) {
  if (!roomCache.has(house)) roomCache.set(house, ['1.05', '1.08'].map(id => OfficeRooms.build(house, id)));
  mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox.clone().translate(mesh.position);
  for (const room of roomCache.get(house)) {
    for (const part of room.parts.filter(p => p.material === 'wallPaint' && p.name.startsWith(`${wall.id}_`))) {
      const side = part.category === 'niche' ? (wall.id === 'W23' ? 'east' : 'south') : part.category;
      const alongX = side === 'north' || side === 'south';
      const sign = side === 'north' || side === 'west' ? 1 : -1;
      const [x, z, y] = part.position, [w, d, h] = part.size;
      const a = Math.max(alongX ? x - w / 2 : z - d / 2, alongX ? bounds.min.x : bounds.min.z);
      const b = Math.min(alongX ? x + w / 2 : z + d / 2, alongX ? bounds.max.x : bounds.max.z);
      const bottom = Math.max(y - h / 2, bounds.min.y), top = Math.min(y + h / 2, bounds.max.y);
      if (b - a < 1e-6 || top - bottom < 1e-6) continue;
      const cross = (alongX ? z + sign * d / 2 : x + sign * w / 2) + sign * .0008;
      const face = alongX ? (sign > 0 ? bounds.max.z : bounds.min.z) : (sign > 0 ? bounds.max.x : bounds.min.x);
      if (Math.abs(cross - sign * .0008 - face) > 1e-6) continue;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(b - a, top - bottom), new THREE.MeshStandardMaterial(room.materials.wallPaint));
      plane.name = `office-paint-${room.name}-${part.name}`;
      plane.material.name = 'officeSeafoam';
      if (alongX) { plane.position.set((a + b) / 2, (bottom + top) / 2, cross); plane.rotation.y = sign > 0 ? 0 : Math.PI; }
      else { plane.position.set(cross, (bottom + top) / 2, (a + b) / 2); plane.rotation.y = sign * Math.PI / 2; }
      plane.position.sub(mesh.position);
      plane.receiveShadow = true;
      mesh.add(plane);
    }
    const wallAlongX = wall.b[0] - wall.a[0] >= wall.b[1] - wall.a[1];
    for (let i = 0; i < room.outline.length; i++) {
      const start = room.outline[i], end = room.outline[(i + 1) % room.outline.length];
      const alongX = start[1] === end[1];
      if (alongX === wallAlongX) continue;
      const sign = alongX ? Math.sign(end[0] - start[0]) : -Math.sign(end[1] - start[1]);
      const cross = start[alongX ? 1 : 0];
      const face = alongX ? (sign > 0 ? bounds.max.z : bounds.min.z) : (sign > 0 ? bounds.max.x : bounds.min.x);
      if (Math.abs(cross - face) > 1e-6) continue;
      const axis = alongX ? 0 : 1;
      const a = Math.max(Math.min(start[axis], end[axis]), alongX ? bounds.min.x : bounds.min.z);
      const b = Math.min(Math.max(start[axis], end[axis]), alongX ? bounds.max.x : bounds.max.z);
      const bottom = Math.max(0, bounds.min.y), top = Math.min(room.clearHeight, bounds.max.y);
      if (b - a < 1e-6 || top - bottom < 1e-6) continue;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(b - a, top - bottom), new THREE.MeshStandardMaterial(room.materials.wallPaint));
      plane.name = `office-paint-${room.name}-${wall.id}_return_${i}`;
      plane.material.name = 'officeSeafoam';
      if (alongX) { plane.position.set((a + b) / 2, (bottom + top) / 2, cross + sign * .0008); plane.rotation.y = sign > 0 ? 0 : Math.PI; }
      else { plane.position.set(cross + sign * .0008, (bottom + top) / 2, (a + b) / 2); plane.rotation.y = sign * Math.PI / 2; }
      plane.position.sub(mesh.position);
      plane.receiveShadow = true;
      mesh.add(plane);
    }
  }
}

function attach(THREE, houseView, house, options) {
  const offices = ['1.05', '1.08'].map(id => createOffice(THREE, house, id, { ...options, finishesOnly: true }));
  if (!houseView.furniture) {
    houseView.furniture = new THREE.Group();
    houseView.root.add(houseView.furniture);
  }
  for (const office of offices) {
    office.shell.position.y = houseView.dims.floorY + .003;
    office.furniture.position.y = houseView.dims.floorY;
    houseView.floor.add(office.shell);
    houseView.furniture.add(office.furniture);
  }
  houseView.offices = offices;
  return offices;
}
