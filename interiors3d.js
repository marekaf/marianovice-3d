// Shared garage-interior builder — consumed by index.html (garden viewer) and interior.html
// (dedicated interiors page). Everything the garage interior owns is built HERE so the two
// pages cannot drift. Plot coordinates in meters; `floorY` = absolute scene height of the
// interior floor (index.html passes the terrain-anchored slab level, interior.html passes 0).
// Requires THREE passed in — this file loads as a classic script, before the module scripts.
const INTERIORS3D = (() => {

  // Vehicle group in local coordinates: origin at the ground point under the vehicle centre,
  // nose toward −z (= north when unrotated). Caller positions/rotates it.
  function buildVehicle(THREE, v, buildModel) {
    return buildModel(THREE, VehicleModel.build(v));
  }

  // The garage-bay vehicles only, positioned on the garage floor (for the interiors page).
  function garageVehicles(THREE, GARDEN, floorY, buildModel) {
    const group = new THREE.Group();
    for (const v of GARDEN.vehicles.filter(v => v.bay === 'garage')) {
      const g = buildVehicle(THREE, v, buildModel);
      g.position.set(v.cx, floorY, v.noseZ + v.l / 2);
      if (v.reversed) g.rotation.y = Math.PI;
      group.add(g);
    }
    return group;
  }

  // Centre-position a mesh and enable shadows
  function put(target, mesh, x, y, z) {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    target.add(mesh);
    return mesh;
  }

  // Axis-aligned box from min/max corners
  function mkBox(THREE, target, x0, y0, z0, x1, y1, z1, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    return put(target, m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  }

  function buildFurniture(THREE, list, opts = {}) {
    return opts.buildModel(THREE, FurnitureModel.build(list, opts.floorY ?? 0));
  }

  // Sloped plane (pult roof / ceiling): y varies linearly from lowY at xMin to highY at xMax
  function slopedPlane(THREE, xMin, xMax, zMin, zMax, yAtXMin, yAtXMax) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute([
      xMin, yAtXMin, zMin,
      xMax, yAtXMax, zMin,
      xMax, yAtXMax, zMax,
      xMin, yAtXMin, zMax,
    ], 3));
    geom.setIndex([0, 2, 1, 0, 3, 2]);
    geom.computeVertexNormals();
    return geom;
  }

  function buildGarage(THREE, GARDEN, opts) {
    const model = GarageModel.build(GARDEN, opts.floorY, opts.plinthTo);
    const root = opts.buildModel(THREE, model);
    const categories = root.userData.categories;
    for (const group of Object.values(categories)) group.position.y = model.floorHeight;
    for (const light of root.userData.lights) light.intensity = light.userData.night;
    return {
      walls: Object.fromEntries(["N", "S", "E", "W"].map(face => [face, categories[face]])),
      floor: categories.floor, ceiling: categories.roof, furniture: categories.furniture,
      gateClosed: categories.gateClosed, gateOpen: categories.gateOpen, light: categories.light,
      dims: model.dims,
    };
  }

  // Data contract: outline (polygon, local meters), rooms[{x0,z0,x1,z1,name,id,area,ceil?}],
  // extWalls[{face:'N|S|E|W', a:[x,z], b:[x,z], openings}], intWalls[same minus face],
  // openings[{at (m from wall min-corner along its axis), w, h, sill?}], stairs, clearH.
  // Returns groups parented under `root`, positioned at data.originPlot in plot coordinates.
  function buildHouse(THREE, data, opts = {}) {
    const layers=typeof module!=='undefined'?require('./house-wall-layers.js').HouseWallLayers:HouseWallLayers;
    const sectionMaterials=Object.fromEntries(Object.entries(layers.materials).map(([key,spec])=>{
      const material=new THREE.MeshStandardMaterial(spec);material.name=key;return[key,material];
    }));
    const floorY = opts.floorY ?? 0;
    const H = (data.clearH ?? 2.52) + 0.2;
    const wallMat = new THREE.MeshStandardMaterial({ color: opts.finishColors?.wall ?? 0xe8e5df, roughness: 0.9 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xd7c9a8, roughness: 0.6 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: opts.finishColors?.ceiling ?? 0xf4f2ee, roughness: 0.9, side: THREE.DoubleSide });

    // Walls stop at the clear height — the lid (strop plate) rests ON them. They run 1 cm
    // INTO the plate so no wall-top face is coplanar with the lid underside (z-fighting).
    const wallH = data.lid ? (data.clearH ?? 2.52) + 0.01 : H;
    const root = new THREE.Group();
    const walls = { N: new THREE.Group(), S: new THREE.Group(), E: new THREE.Group(), W: new THREE.Group() };
    const intGroup = new THREE.Group();
    const floor = new THREE.Group();
    const ceiling = new THREE.Group();
    const labels = new THREE.Group();
    const wallIds = new THREE.Group();
    wallIds.visible = false;
    const wallIdSprite = (id, x, y, z) => {
      const cv = document.createElement('canvas');
      cv.width = 128; cv.height = 64;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = 'rgba(20,20,20,0.85)';
      ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = '#ffd54a';
      ctx.font = '700 40px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(id, 64, 34);
      const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.55, 0.28, 1);
      sp.position.set(x, y, z);
      sp.renderOrder = 10;
      wallIds.add(sp);
    };
    for (const g of [walls.N, walls.S, walls.E, walls.W, intGroup, floor, ceiling, labels]) root.add(g);

    const mkB = mkBox.bind(null, THREE);

    function wallRect(target, w) {
      const [ax, az] = w.a, [bx, bz] = w.b;
      if (w.id) wallIdSprite(w.id, (ax + bx) / 2, floorY + (w.h ?? (w.profile ? 1.2 : wallH)) + 0.18, (az + bz) / 2);
      // Gable/štít: a height profile along x, extruded through the wall thickness
      if (w.profile) {
        const shape = new THREE.Shape();
        shape.moveTo(w.profile[0][0], 0);
        for (const [px, py] of w.profile) shape.lineTo(px, py);
        shape.lineTo(w.profile[w.profile.length - 1][0], 0);
        shape.closePath();
        for(const g of w.glazing||[]){
          const hole=new THREE.Path();hole.moveTo(g.x0,g.sill);hole.lineTo(g.x0,g.sill+g.h);
          hole.lineTo(g.x1,g.sill+g.h);hole.lineTo(g.x1,g.sill);hole.closePath();shape.holes.push(hole);
        }
        const geom = new THREE.ExtrudeGeometry(shape, { depth: bz - az, bevelEnabled: false });
        geom.translate(0, floorY, az);
        const m = new THREE.Mesh(geom, wallMat);
        m.castShadow = true;
        m.receiveShadow = true;
        target.add(m);
        for (const g of w.glazing || []) {
          const openingModel=opts.buildModel&&data.buildOpening?.(w,g,(w.glazing||[]).indexOf(g));
          if(openingModel){target.add(opts.buildModel(THREE,{...openingModel,floorHeight:floorY}));continue;}
          const gl = new THREE.Mesh(new THREE.BoxGeometry(g.x1 - g.x0, g.h, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x2a3540, roughness: 0.15, metalness: 0.6 }));
          gl.position.set((g.x0 + g.x1) / 2, floorY + g.sill + g.h / 2, bz + 0.01);
          target.add(gl);
        }
        return;
      }
      const alongX = (bx - ax) >= (bz - az);
      const L = alongX ? bx - ax : bz - az;
      const wh = w.h ?? wallH;   // knee walls / railings carry their own height
      const seg = (s0, s1, y0, y1) => {
        const cross0 = alongX ? az : ax, cross1 = alongX ? bz : bx;
        const reveals = (w.openings || []).filter(o => o.reveal && y0 < floorY + (o.sill || 0) + o.h && y1 > floorY + (o.sill || 0));
        const starts = [s0, s1], depths = [cross0, cross1], heights = [y0, y1];
        for (const o of reveals) {
          const center = o.at + o.w / 2;
          starts.push(...[center - o.reveal.width / 2, center + o.reveal.width / 2].filter(s => s > s0 && s < s1));
          depths.push(...[o.reveal.depth0, o.reveal.depth1].filter(d => d > cross0 && d < cross1));
          heights.push(...[floorY + (o.sill || 0), floorY + (o.sill || 0) + o.h].filter(y => y > y0 && y < y1));
        }
        starts.sort((a, b) => a - b); depths.sort((a, b) => a - b); heights.sort((a, b) => a - b);
        for (let i = 0; i < starts.length - 1; i++) for (let j = 0; j < depths.length - 1; j++) for (let k = 0; k < heights.length - 1; k++) {
          const a = starts[i], b = starts[i + 1], c = depths[j], d = depths[j + 1];
          const bottom = heights[k], top = heights[k + 1];
          if (b - a < 1e-8 || d - c < 1e-8 || top - bottom < 1e-8) continue;
          if (reveals.some(o => Math.abs((a + b) / 2 - o.at - o.w / 2) < o.reveal.width / 2 &&
            (c + d) / 2 > o.reveal.depth0 && (c + d) / 2 < o.reveal.depth1 &&
            (bottom + top) / 2 > floorY + (o.sill || 0) && (bottom + top) / 2 < floorY + (o.sill || 0) + o.h)) continue;
          const rect=alongX?{x0:ax+a,x1:ax+b,z0:c,z1:d,y0:bottom,y1:top}:{x0:c,x1:d,z0:az+a,z1:az+b,y0:bottom,y1:top};
          for(const cell of layers.split(data,w,rect)){
            const material=cell.layer&&Math.abs(top-floorY-wh)<1e-8?[wallMat,wallMat,sectionMaterials[cell.layer==='eps'?'wallEPS':'wallMasonry'],wallMat,wallMat,wallMat]:wallMat;
            const mesh=mkB(target,cell.x0,cell.y0,cell.z0,cell.x1,cell.y1,cell.z1,material);
            mesh.userData.wallLayer=cell.layer;
            opts.decorateWallMesh?.(mesh,w);
          }
        }
      };
      let cur = 0;
      for (const o of [...(w.openings || [])].sort((p, q) => p.at - q.at)) {
        if (o.at > cur) seg(cur, o.at, floorY, floorY + wh);
        const sill = o.sill || 0;
        if (sill > 0) seg(o.at, o.at + o.w, floorY, floorY + sill);
        if (sill + o.h < wh) seg(o.at, o.at + o.w, floorY + sill + o.h, floorY + wh);
        const openingModel = opts.buildModel && data.buildOpening?.(w, o, w.openings.indexOf(o));
        if (openingModel) target.add(opts.buildModel(THREE, { ...openingModel, floorHeight: floorY }));
        cur = o.at + o.w;
      }
      if (cur < L) seg(cur, L, floorY, floorY + wh);
    }
    // face N/S/E/W = true facade plane (hidden by the elevation that looks through it);
    // any other tag (e.g. 'court' for atrium/notch returns) stays visible in every view
    for (const w of data.extWalls) wallRect(walls[w.face] || intGroup, w);
    for (const w of data.intWalls) wallRect(intGroup, w);

    // Plate builder: outline minus holes as ONE mesh with faces only at real boundaries
    // (top, bottom, outline + hole rims) — used by the ceiling lid and the loft floor
    function plate(target, holes, y0, y1, mat) {
      const inOutline = (x, z) => {
        let inside = false;
        const pts = data.outline;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, zi] = pts[i], [xj, zj] = pts[j];
          if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
        }
        return inside;
      };
      const xs = [...new Set([...data.outline.map(p => p[0]), ...holes.flatMap(h => [h.x0, h.x1])])].sort((a, b) => a - b);
      const zs = [...new Set([...data.outline.map(p => p[1]), ...holes.flatMap(h => [h.z0, h.z1])])].sort((a, b) => a - b);
      const solidAt = (xi, zi) => {
        if (xi < 0 || zi < 0 || xi >= xs.length - 1 || zi >= zs.length - 1) return false;
        const cx = (xs[xi] + xs[xi + 1]) / 2, cz = (zs[zi] + zs[zi + 1]) / 2;
        return inOutline(cx, cz) && !holes.some(h => cx > h.x0 && cx < h.x1 && cz > h.z0 && cz < h.z1);
      };
      const pos = [], nrm = [], idx = [];
      const quad = (pts, n) => {
        const i = pos.length / 3;
        for (const p of pts) pos.push(...p);
        for (let k = 0; k < 4; k++) nrm.push(...n);
        idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
      };
      for (let zi = 0; zi < zs.length - 1; zi++) for (let xi = 0; xi < xs.length - 1; xi++) {
        if (!solidAt(xi, zi)) continue;
        const x0 = xs[xi], x1 = xs[xi + 1], z0 = zs[zi], z1 = zs[zi + 1];
        quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0]);
        quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
        if (!solidAt(xi, zi - 1)) quad([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1]);
        if (!solidAt(xi, zi + 1)) quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
        if (!solidAt(xi - 1, zi)) quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]);
        if (!solidAt(xi + 1, zi)) quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      geom.setIndex(idx);
      const m = new THREE.Mesh(geom, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      target.add(m);
    }

    // Sloped ceiling planes (loft SDK under the roof): y varies linearly with x
    for (const sl of data.slopes || []) {
      const m = new THREE.Mesh(slopedPlane(THREE, sl.x0, sl.x1, sl.z0, sl.z1, floorY + sl.y0, floorY + sl.y1), ceilMat);
      m.castShadow = true;
      m.receiveShadow = true;
      ceiling.add(m);
    }

    // Floor: plate with holes (loft — open over the cathedral/stairwell) or plain outline extrude
    if (data.floorHoles) {
      plate(floor, data.floorHoles, floorY - 0.12, floorY, floorMat);
    } else {
      const shape = new THREE.Shape();
      shape.moveTo(data.outline[0][0], -data.outline[0][1]);
      for (let i = 1; i < data.outline.length; i++) shape.lineTo(data.outline[i][0], -data.outline[i][1]);
      shape.closePath();
      const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
      geom.rotateX(-Math.PI / 2);
      // Extrusion grows +y after the rotation — shift down so the slab TOP is the floor level
      geom.translate(0, floorY - 0.12, 0);
      const m = new THREE.Mesh(geom, floorMat);
      m.receiveShadow = true;
      floor.add(m);
    }

    // Ceiling: explicit zone slabs (the loft floor plates) when the data provides them,
    // flush with the wall tops; else fall back to one slab per non-open room
    const cH = data.clearH ?? 2.52;
    if (data.lid) {
      plate(ceiling, data.lid.holes || [], floorY + cH, floorY + cH + 0.2, ceilMat);
      if (data.hatch) {
        const h = data.hatch;
        const lidMat = new THREE.MeshStandardMaterial({ color: 0xb59a6f, roughness: 0.7 });
        mkB(ceiling, h.x0, floorY + cH - 0.02, h.z0, h.x1, floorY + cH + 0.02, h.z1, lidMat);
      }
    }
    // Fireplace — Hoxter insert in a masonry casing with the chimney continuing up through
    // the cathedral; firebox glass on the north face toward the living room
    if (data.fireplace && data.buildFireplace && opts.buildModel) {
      const fireplace = data.buildFireplace();
      intGroup.add(opts.buildModel(THREE, {...fireplace, floorHeight:floorY}));
    } else if (data.fireplace) {
      const f = data.fireplace;
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdedad2, roughness: 0.85 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(f.x1 - f.x0, 4.6, f.z1 - f.z0), bodyMat);
      body.position.set((f.x0 + f.x1) / 2, floorY + 2.3, (f.z0 + f.z1) / 2);
      body.castShadow = true;
      body.receiveShadow = true;
      intGroup.add(body);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.03),
        new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.15, metalness: 0.4 }));
      glass.position.set((f.x0 + f.x1) / 2, floorY + 0.72, f.z0 - 0.005);
      intGroup.add(glass);
    }
    if (data.ceilings) {
      for (const c of data.ceilings) mkB(ceiling, c.x0, floorY + cH, c.z0, c.x1, floorY + H - 0.02, c.z1, ceilMat);
      if (data.hatch) {
        const h = data.hatch;
        const lidMat = new THREE.MeshStandardMaterial({ color: 0xb59a6f, roughness: 0.7 });
        mkB(ceiling, h.x0, floorY + cH - 0.02, h.z0, h.x1, floorY + cH + 0.02, h.z1, lidMat);
      }
    }
    for (const r of data.rooms) {
      if (!data.lid && !data.ceilings && r.ceil !== 'open') mkB(ceiling, r.x0, floorY + cH, r.z0, r.x1, floorY + cH + 0.05, r.z1, ceilMat);
      if (r.noLabel) continue;
      // Room label lying on the floor — reads upright in the north-up plan view
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 160;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#2a2a2a';
      ctx.textAlign = 'center';
      ctx.font = '700 52px -apple-system, sans-serif';
      ctx.fillText(r.name, 256, 66);
      ctx.font = '400 40px -apple-system, sans-serif';
      ctx.fillText(`${r.id} · ${r.area} m²`, 256, 122);
      const tex = new THREE.CanvasTexture(cv);
      const w = Math.min(2.2, (r.x1 - r.x0) * 0.9);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 160 / 512),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      label.rotation.x = -Math.PI / 2;
      label.position.set((r.x0 + r.x1) / 2, floorY + 0.02, (r.z0 + r.z1) / 2);
      labels.add(label);
    }

    if (data.stairs && data.buildStairs && opts.buildModel) {
      intGroup.add(opts.buildModel(THREE,{...data.buildStairs(),floorHeight:floorY}));
    } else if (data.stairs) {
      const s = data.stairs;
      const stepMat = new THREE.MeshStandardMaterial({ color: 0xb59a6f, roughness: 0.7 });
      const runAxis = (s.x1 - s.x0) >= (s.z1 - s.z0) ? 'x' : 'z';
      const L = runAxis === 'x' ? s.x1 - s.x0 : s.z1 - s.z0;
      const going = L / s.steps;
      for (let i = 0; i < s.steps; i++) {
        const p0 = i * going, p1 = (i + 1) * going, top = floorY + (i + 1) * s.rise;
        if (runAxis === 'z') mkB(intGroup, s.x0, floorY, s.toward === 'S' ? s.z0 + p0 : s.z1 - p1, s.x1, top, s.toward === 'S' ? s.z0 + p1 : s.z1 - p0, stepMat);
        else mkB(intGroup, s.toward === 'E' ? s.x0 + p0 : s.x1 - p1, floorY, s.z0, s.toward === 'E' ? s.x0 + p1 : s.x1 - p0, top, s.z1, stepMat);
      }
    }

    // Joinery parented to root, never to a facade group — elevation look-through keeps it visible
    const furniture = data.furniture ? buildFurniture(THREE, data.furniture, { floorY, buildModel: opts.buildModel }) : null;
    if (furniture) root.add(furniture);

    root.position.set(data.originPlot.x, 0, data.originPlot.z);
    const xs = data.outline.map(p => p[0]), zs = data.outline.map(p => p[1]);
    root.add(wallIds);
    return {
      root, walls, int: intGroup, floor, ceiling, labels, wallIds, furniture,
      dims: { w: Math.max(...xs), d: Math.max(...zs), floorY, clearH: data.clearH ?? 2.52, originPlot: data.originPlot },
    };
  }

  return { buildGarage, buildVehicle, garageVehicles, buildHouse, buildFurniture };
})();

if (typeof module !== "undefined") module.exports = { INTERIORS3D };
