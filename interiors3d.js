// Shared garage-interior builder — consumed by index.html (garden viewer) and interior.html
// (dedicated interiors page). Everything the garage interior owns is built HERE so the two
// pages cannot drift. Plot coordinates in meters; `floorY` = absolute scene height of the
// interior floor (index.html passes the terrain-anchored slab level, interior.html passes 0).
// Requires THREE passed in — this file loads as a classic script, before the module scripts.
const INTERIORS3D = (() => {

  // Vehicle group in local coordinates: origin at the ground point under the vehicle centre,
  // nose toward −z (= north when unrotated). Caller positions/rotates it.
  function buildVehicle(THREE, v) {
    const g = new THREE.Group();
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
    const col = parseInt(v.col.slice(1), 16);
    if (v.moto) {
      const paint = new THREE.MeshStandardMaterial({ color: col, metalness: 0.6, roughness: 0.4 });
      for (const wz of [-(v.l / 2 - 0.35), v.l / 2 - 0.35]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 12), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(0, 0.32, wz);
        g.add(wheel);
      }
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, v.l * 0.55), paint);
      body.position.y = 0.75;
      g.add(body);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.7), wheelMat);
      seat.position.set(0, 0.98, 0.35);
      g.add(seat);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(v.w, 0.05, 0.05), wheelMat);
      bar.position.set(0, 1.05, -(v.l / 2 - 0.55));
      g.add(bar);
    } else {
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x101820, metalness: 0.9, roughness: 0.06 });
      const paint = new THREE.MeshStandardMaterial({ color: col, metalness: 0.8, roughness: 0.3 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.55, 4.3), paint);
      body.position.y = 0.62;
      g.add(body);
      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.1, 1.2), paint);
      hood.position.set(0, 0.94, -1.4);
      g.add(hood);
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.14, 0.9), paint);
      trunk.position.set(0, 0.96, 1.6);
      g.add(trunk);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.0), glassMat);
      cabin.position.set(0, 1.14, 0.2);
      g.add(cabin);
      for (const [wx, wz] of [[-0.8, -1.45], [0.8, -1.45], [-0.8, 1.45], [0.8, 1.45]]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.33, wz);
        g.add(wheel);
      }
      // Body is drawn at 4.3 × 1.82 m; scale to the vehicle's real footprint
      g.scale.set(v.w / 1.82, 1, v.l / 4.3);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // The garage-bay vehicles only, positioned on the garage floor (for the interiors page).
  function garageVehicles(THREE, GARDEN, floorY) {
    const group = new THREE.Group();
    for (const v of GARDEN.vehicles.filter(v => v.bay === 'garage')) {
      const g = buildVehicle(THREE, v);
      g.position.set(v.cx, floorY, v.noseZ + v.l / 2);
      if (v.reversed) g.rotation.y = Math.PI;
      group.add(g);
    }
    return group;
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
    const EL = Object.fromEntries(GARDEN.elements.map(e => [e.id, e]));
    const gaEl = EL.garage;
    const GA = gaEl.parts.find(p => p.kind === 'rect');
    const GAT = gaEl.meta.wallT;
    const GOP = gaEl.meta.openings;
    const floorY = opts.floorY;
    const plinthTo = opts.plinthTo ?? (floorY - 0.12);
    const wallTop = floorY + 2.3;
    const pitch = 1.2 / GA.w;
    const roofHigh = wallTop + 1.2;

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7 });
    const paintMat = new THREE.MeshStandardMaterial({ color: 0xe8e5df, roughness: 0.9 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.35 });

    const walls = { N: new THREE.Group(), S: new THREE.Group(), E: new THREE.Group(), W: new THREE.Group() };
    const floor = new THREE.Group();
    const ceiling = new THREE.Group();
    const furniture = new THREE.Group();
    const gateClosed = new THREE.Group();
    const gateOpen = new THREE.Group();
    gateOpen.visible = false;

    // faceMats: BoxGeometry material slots by face — {px, nx, py, ny, pz, nz}; unlisted faces get the wall material
    function box(target, x0, y0, z0, x1, y1, z1, faceMats) {
      const mats = faceMats ? ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map(f => faceMats[f] || wallMat) : wallMat;
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mats);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      m.castShadow = true;
      m.receiveShadow = true;
      target.add(m);
    }

    // Floor slab over the whole footprint — its side faces double as the plinth down to grade;
    // the top face is the polished-concrete interior floor
    box(floor, GA.x, plinthTo, GA.y, GA.x + GA.w, floorY, GA.y + GA.d, { py: floorMat });

    function wall(target, axis, fix0, fix1, a0, a1, openings, innerFace) {
      // axis 'x': wall runs along x at z∈[fix0,fix1]; axis 'z': runs along z at x∈[fix0,fix1].
      // innerFace = which box face looks into the room (gets the paint)
      const seg = (s0, s1, y0, y1) => axis === 'x'
        ? box(target, s0, y0, fix0, s1, y1, fix1, { [innerFace]: paintMat })
        : box(target, fix0, y0, s0, fix1, y1, s1, { [innerFace]: paintMat });
      let at = a0;
      for (const o of [...openings].sort((p, q) => p.from - q.from)) {
        if (o.from > at) seg(at, o.from, floorY, wallTop);
        seg(o.from, o.from + o.w, floorY + o.h, wallTop);
        at = o.from + o.w;
      }
      if (at < a1) seg(at, a1, floorY, wallTop);
    }
    wall(walls.N, 'x', GA.y, GA.y + GAT, GA.x, GA.x + GA.w, GOP.filter(o => o.wall === 'N'), 'pz');
    wall(walls.S, 'x', GA.y + GA.d - GAT, GA.y + GA.d, GA.x, GA.x + GA.w, GOP.filter(o => o.wall === 'S'), 'nz');
    wall(walls.W, 'z', GA.x, GA.x + GAT, GA.y + GAT, GA.y + GA.d - GAT, GOP.filter(o => o.wall === 'W'), 'px');
    wall(walls.E, 'z', GA.x + GA.w - GAT, GA.x + GA.w, GA.y + GAT, GA.y + GA.d - GAT, GOP.filter(o => o.wall === 'E'), 'nx');

    // Interior ceiling — wooden cladding just under the roof plane, battens, hex LED cluster
    const clr = x => roofHigh - pitch * (x - GA.x) - 0.06;
    {
      const x0 = GA.x + GAT, x1 = GA.x + GA.w - GAT, z0 = GA.y + GAT, z1 = GA.y + GA.d - GAT;
      const cladMat = new THREE.MeshStandardMaterial({ color: 0x9a7b52, roughness: 0.85, side: THREE.DoubleSide });
      ceiling.add(new THREE.Mesh(slopedPlane(THREE, x0, x1, z0, z1, clr(x0), clr(x1)), cladMat));
      const battenMat = new THREE.MeshStandardMaterial({ color: 0x6e5233, roughness: 0.9 });
      for (let bx = x0 + 0.35; bx < x1; bx += 0.45) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, z1 - z0), battenMat);
        b.position.set(bx, clr(bx) - 0.02, (z0 + z1) / 2);
        ceiling.add(b);
      }
      // Honeycomb of 5 hexagon rings (6-segment torus = hexagon), flush with the ceiling slope
      const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const lx = GA.x + GA.w / 2, lz = 23.0;
      const led = new THREE.Group();
      for (const [ox, oz] of [[0, 0], [0.68, 0], [-0.68, 0], [0.34, 0.59], [-0.34, -0.59]]) {
        const hex = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.028, 8, 6), ledMat);
        hex.rotation.x = Math.PI / 2;
        hex.position.set(ox, 0, oz);
        led.add(hex);
      }
      led.rotation.z = -Math.atan(pitch);
      led.position.set(lx, clr(lx) - 0.07, lz);
      ceiling.add(led);
    }
    // Fill light so the interior reads even with the sun outside; not parented to the ceiling
    // so it stays on when a page hides the ceiling
    const light = new THREE.PointLight(0xf2f6ff, 1.6, 10, 1);
    light.position.set(GA.x + GA.w / 2, clr(GA.x + GA.w / 2) - 0.4, 23.0);

    // Garage doors (south wall of garage, outside) — base on the garage slab.
    // Two gate states share the opening: closed leaf in the wall plane, or the same leaf
    // parked horizontally under the roof (sectional door open). The caller flips visibility.
    const doorRect = gaEl.parts.filter(p => p.kind === 'rect')[1];
    const doorX = doorRect.x + doorRect.w / 2;
    const doorZ = GA.y + GA.d;
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.4 });
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorRect.w, 2.05, 0.08), doorMat);
    leaf.position.set(doorX, floorY + 1.025, doorZ + 0.04);
    gateClosed.add(leaf);
    // Horizontal section lines on garage door
    for (let i = 1; i < 5; i++) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(doorRect.w + 0.02, 0.03, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
      );
      line.position.set(doorX, floorY + 0.4 * i, doorZ + 0.09);
      gateClosed.add(line);
    }
    {
      const g = GOP.find(o => o.kind === 'gate');
      const panel = new THREE.Mesh(new THREE.BoxGeometry(g.w, 0.06, 2.05), doorMat);
      panel.position.set(doorX, floorY + g.h + 0.1, GA.y + GA.d - GAT - 2.05 / 2 - 0.15);
      panel.castShadow = true;
      gateOpen.add(panel);
    }

    // Garage personnel door 900×2150 on the west wall (under the carport)
    {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.15, 0.9), doorMat.clone());
      d.position.set(GA.x - 0.03, floorY + 2.15 / 2, 20.65);
      walls.W.add(d);
    }

    // Garage workbench across the north wall (full width) — cars must park south of it.
    // Pegboard + tools mount on the N wall group (they hide with that wall in elevations);
    // the freestanding bench goes into `furniture`.
    {
      const { d: bd, h: bh } = gaEl.meta.workbench;
      const backZ = GA.y + GAT;
      const bw = GA.w - 2 * GAT - 0.2, bx = GA.x + GA.w / 2, bz = backZ + bd / 2;
      const legMat = new THREE.MeshStandardMaterial({ color: 0x565b60, roughness: 0.6, metalness: 0.3 });
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.7 });
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x3d4248, roughness: 0.45, metalness: 0.5 });
      const put = (target, mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; target.add(mesh); };
      // Thick butcher top with a small front overhang
      put(furniture, new THREE.Mesh(new THREE.BoxGeometry(bw, 0.08, bd + 0.05), woodMat), bx, floorY + bh - 0.04, bz + 0.025);
      // 3 leg pairs + lower shelf
      for (const dx of [-bw / 2 + 0.15, 0, bw / 2 - 0.15]) for (const dz of [-bd / 2 + 0.07, bd / 2 - 0.07]) {
        put(furniture, new THREE.Mesh(new THREE.BoxGeometry(0.09, bh - 0.08, 0.09), legMat), bx + dx, floorY + (bh - 0.08) / 2, bz + dz);
      }
      put(furniture, new THREE.Mesh(new THREE.BoxGeometry(bw - 0.2, 0.05, bd - 0.16), woodMat), bx, floorY + 0.2, bz);
      // Pegboard with hung tools
      put(walls.N, new THREE.Mesh(new THREE.BoxGeometry(bw, 1.0, 0.05), new THREE.MeshStandardMaterial({ color: 0x6a7075, roughness: 0.8 })), bx, floorY + bh + 0.62, backZ + 0.025);
      const toolZ = backZ + 0.08, toolY = floorY + bh + 0.62;
      put(walls.N, new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.3, 0.035), woodMat), bx - 1.2, toolY, toolZ);          // hammer handle
      put(walls.N, new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.055), steelMat), bx - 1.2, toolY + 0.17, toolZ); // hammer head
      put(walls.N, new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.26, 0.02), steelMat), bx - 0.75, toolY + 0.03, toolZ); // wrench
      put(walls.N, new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.2, 0.02), steelMat), bx - 0.55, toolY + 0.06, toolZ);  // wrench, smaller
      for (let i = 0; i < 3; i++) {
        put(walls.N, new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.2, 0.022), new THREE.MeshStandardMaterial({ color: [0xc0392b, 0xe08a1e, 0x2e6da4][i], roughness: 0.6 })), bx + 0.35 + i * 0.14, toolY + 0.05, toolZ); // screwdrivers
      }
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 14), new THREE.MeshStandardMaterial({ color: 0xe08a1e, roughness: 0.7 }));
      put(walls.N, coil, bx + 1.1, toolY + 0.02, toolZ);                                                                // coiled cable
      // Vice at the right end of the top
      put(furniture, new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.14), steelMat), bx + bw / 2 - 0.35, floorY + bh + 0.035, bz - 0.05);
      put(furniture, new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.2), steelMat), bx + bw / 2 - 0.35, floorY + bh + 0.13, bz - 0.05);
      const viceHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8), steelMat);
      viceHandle.rotation.x = Math.PI / 2;
      put(furniture, viceHandle, bx + bw / 2 - 0.35, floorY + bh + 0.1, bz + 0.09);
      // Toolbox on the lower shelf
      put(furniture, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.24), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5, metalness: 0.3 })), bx - bw / 2 + 0.6, floorY + 0.325, bz);
      put(furniture, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03), steelMat), bx - bw / 2 + 0.6, floorY + 0.45, bz);
    }

    return {
      walls, floor, ceiling, furniture, gateClosed, gateOpen, light,
      dims: { rect: GA, wallT: GAT, wallTop, roofHigh, pitch, floorY },
    };
  }

  return { buildGarage, buildVehicle, garageVehicles };
})();

if (typeof module !== "undefined") module.exports = { INTERIORS3D };
