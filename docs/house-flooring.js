function insidePolygon(points, x, z) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[i], [bx, bz] = points[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

export function houseFlooringModel(house, officeOutlines = [], { regions = null } = {}) {
  const rectPolygon = room => [[room.x0, room.z0], [room.x1, room.z0], [room.x1, room.z1], [room.x0, room.z1]];
  const exteriorThresholds=(house.extWalls||[]).filter(w=>w.openings.some(o=>o.door||!(o.sill>0))&&['N','S','E','W'].includes(w.face)).map(w=>{
    const [x0,z0]=w.a,[x1,z1]=w.b,midX=(x0+x1)/2,midZ=(z0+z1)/2;
    return rectPolygon({x0:w.face==='E'?midX-.05:x0,x1:w.face==='W'?midX+.05:x1,
      z0:w.face==='S'?midZ-.05:z0,z1:w.face==='N'?midZ+.05:z1});
  });
  const excluded = [...officeOutlines, ...exteriorThresholds, ...(house.floorHoles || []).map(rectPolygon), ...house.rooms.filter(room => ['1.10', '1.03', 'sprcha'].includes(room.id))
    .map(room => [[room.x0, room.z0], [room.x1, room.z0], [room.x1, room.z1], [room.x0, room.z1]])];
  const bounds = {
    x0: Math.min(...house.outline.map(point => point[0])), x1: Math.max(...house.outline.map(point => point[0])),
    z0: Math.min(...house.outline.map(point => point[1])), z1: Math.max(...house.outline.map(point => point[1])),
  };
  const width = .225, length = 1.524, offsets = [.38];
  const columns = Math.ceil((bounds.x1 - bounds.x0) / width);
  for (let column = 1; column < columns; column++) offsets.push((offsets[column - 1] + .34 + ((column * 137) % 521) / 1000) % length);
  const allowed = regions?.map(rectPolygon);
  const boundaries = [house.outline, ...excluded, ...(allowed || [])].flat();
  const xCuts = [...new Set(boundaries.map(point => point[0]))];
  const zCuts = [...new Set(boundaries.map(point => point[1]))];
  const parts = [];
  for (let column = 0; column < columns; column++) {
    const left = bounds.x0 + column * width, right = Math.min(bounds.x1, left + width);
    const origin = bounds.z0 + offsets[column];
    for (let row = Math.floor((bounds.z0 - origin) / length); origin + row * length < bounds.z1; row++) {
      const start = Math.max(bounds.z0, origin + row * length), end = Math.min(bounds.z1, origin + (row + 1) * length);
      const xs = [left, ...xCuts.filter(x => x > left + 1e-8 && x < right - 1e-8), right].sort((a, b) => a - b);
      const zs = [start, ...zCuts.filter(z => z > start + 1e-8 && z < end - 1e-8), end].sort((a, b) => a - b);
      for (let xi = 0; xi < xs.length - 1; xi++) for (let zi = 0; zi < zs.length - 1; zi++) {
        const x = (xs[xi] + xs[xi + 1]) / 2, z = (zs[zi] + zs[zi + 1]) / 2;
        if (!insidePolygon(house.outline, x, z) || excluded.some(polygon => insidePolygon(polygon, x, z))) continue;
        if (allowed && !allowed.some(polygon => insidePolygon(polygon, x, z))) continue;
        const x0 = xs[xi] + (xs[xi] === left ? .00015 : 0), x1 = xs[xi + 1] - (xs[xi + 1] === right ? .00015 : 0);
        const z0 = zs[zi] + (zs[zi] === start ? .00015 : 0), z1 = zs[zi + 1] - (zs[zi + 1] === end ? .00015 : 0);
        if (x1 - x0 <= 1e-6 || z1 - z0 <= 1e-6) continue;
        parts.push({ name: `champagne_${column}_${row}_${xi}_${zi}`, type: 'box', position: [(x0 + x1) / 2, (z0 + z1) / 2, .0025],
          size: [x1 - x0, z1 - z0, .0025], material: 'floorWood', category: 'floor' });
      }
    }
  }
  return { name: 'House Champagne floor', floorHeight: 0, bounds, excluded,
    floorLayout: { width, length, offsets }, materials: { floorWood: { color: '#ffffff', roughness: .82 } }, parts, lights: [] };
}

export function attachHouseFlooring(THREE, houseView, houseData, { buildModel, renderer, applyChampagneFloor }) {
  const model = houseFlooringModel(houseData, houseView.offices.map(office => office.roomModel.outline));
  const group = buildModel(THREE, { ...model, floorHeight: houseView.dims.floorY });
  applyChampagneFloor(THREE, group, model, renderer);
  houseView.floor.add(group);
  group.userData.floorModel = model;
  return group;
}
