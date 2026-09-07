const SiteTerrain = (() => {
  const baseHeight = (plane, x, z) => Math.max(0, plane.a * x + plane.b * z + plane.c);
  const surveySampler = () => typeof module !== 'undefined' ? require('./survey-surface.js').SurveySurface : SurveySurface;
  const naturalHeight = (spec, x, z) => spec.surveySurface ? surveySampler().height(spec.surveySurface, x, z) : baseHeight(spec.plane, x, z);
  const smoothstep = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const rectDistance = (r, x, z) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
  function routeSample(route,x,z) {
    const samples=[];
    for(let i=1;i<route.points.length;i++) {
      const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      const distance=Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
      samples.push({distance,level:route.levels[i-1]+(route.levels[i]-route.levels[i-1])*t});
    }
    const distance=Math.min(...samples.map(s=>s.distance));
    let weighted=0,total=0;
    for(const sample of samples) {
      const weight=smoothstep(1-(sample.distance-distance)/.2);
      weighted+=sample.level*weight;total+=weight;
    }
    return {distance,level:weighted/total};
  }
  function polygonDistance(points, x, z) {
    let inside=false,distance=Infinity;
    for(let i=0,j=points.length-1;i<points.length;j=i++) {
      const a=points[j],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1];
      if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
    }
    return inside?0:distance;
  }

  function height(spec, x, z) {
    const base = naturalHeight(spec, x, z);
    let h = base;
    for (const r of spec.cutRects) {
      const blend = r.blend ?? spec.cutBlend;
      const d = rectDistance(r, x, z);
      if (d >= blend) continue;
      const t = smoothstep(d / blend);
      h = Math.min(h, r.level + ((spec.continuousGrading ? h : base) - r.level) * t);
    }
    for (const p of spec.fillPads) {
      if (spec.continuousGrading) {
        const d = rectDistance(p, x, z), blend = p.blend ?? p.eastBlend;
        if (d < blend) h = Math.max(h, p.level + (h - p.level) * smoothstep(d / blend));
        continue;
      }
      if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) h = Math.max(h, p.level);
      else if (x > p.x1 && x < p.x1 + p.eastBlend && z >= p.z0 && z <= p.z1)
        h = Math.max(h, p.level + (base - p.level) * smoothstep((x - p.x1) / p.eastBlend));
    }
    for (const p of spec.levelPads) {
      const blend = p.blend ?? 2.0;
      const d = rectDistance(p, x, z);
      if (d >= blend) continue;
      const t = smoothstep(d / blend);   // inside footprint (d=0): level; edge: banks to grade
      h = p.level + ((spec.continuousGrading ? h : base) - p.level) * t;
    }
    for (const p of spec.postCuts) {
      const d = rectDistance(p, x, z);
      if (d < p.blend) h = Math.min(h, p.level + (h - p.level) * smoothstep(d / p.blend));
    }
    const pond = spec.pond;
    const prr = Math.sqrt(((x - pond.cx) / pond.rx) ** 2 + ((z - pond.cz) / pond.rz) ** 2);
    if (!spec.continuousGrading && prr < 1.3) {
      if (prr <= 1) h = Math.min(h, pond.edge - pond.depth * 0.5 * (1 + Math.cos(prr * Math.PI)));
      else h = Math.min(h, pond.edge + ((spec.continuousGrading ? h : base) - pond.edge) * smoothstep((prr - 1) / 0.3));
    }
    if (spec.houseExcavation) {
      const p=spec.houseExcavation,distance=polygonDistance(p.points,x,z);
      if(distance<p.blend) h=Math.min(h,p.level+(h-p.level)*smoothstep(distance/p.blend));
    }
    if (spec.drivewayProfile) {
      const p=spec.drivewayProfile,distance=Math.max(0,polygonDistance(p.points,x,z)-p.edgeMargin);
      if(distance<p.blend) {
        const level=p.startLevel+(p.gateLevel-p.startLevel)*smoothstep((x-p.startX)/(p.gate[0]-p.startX));
        h=level+(h-level)*smoothstep(distance/p.blend);
      }
    }
    if (spec.finishPads?.length) {
      const distance = Math.min(...spec.finishPads.map(p => rectDistance(p, x, z) / p.blend));
      if (distance < 1) h = spec.finishedSoil + (h - spec.finishedSoil) * smoothstep(distance);
    }
    for (const p of spec.protectedPads ?? []) {
      const distance = rectDistance(p, x, z);
      if (distance < p.blend) h = p.level + (h - p.level) * smoothstep(distance / p.blend);
    }
    for(const route of spec.routeProfiles??[]) {
      const sample=routeSample(route,x,z),distance=Math.max(0,sample.distance-route.width/2);
      if(distance<.5)h=sample.level-.04+(h-sample.level+.04)*smoothstep(distance/.5);
    }
    if(spec.continuousGrading&&prr<1.3) {
      if(prr<=1)h=Math.min(h,pond.edge-pond.depth*.5*(1+Math.cos(prr*Math.PI)));
      else h=Math.min(h,pond.edge+(h-pond.edge)*smoothstep((prr-1)/.3));
    }
    return h;
  }

  function create(garden, terrainPlane, groundPatches, options = {}) {
    const plane = { a: terrainPlane.a, b: terrainPlane.b, c: terrainPlane.c };
    const patchRect = ({ x, y, w, d, level, blend }) => ({ x0: x, z0: y, x1: x + w, z1: y + d, level, blend });
    // Graded cut into the west slope, clamped just under the level west deck;
    // smoothstep bank rising to natural grade; min() leaves downhill areas untouched.
    const cutBlend = 1.8;
    const cutRects = [
      { x0: 8.3, z0: 6.7, x1: 10.48, z1: 26.5, level: 2.46, blend: 2.2 },  // west sidewalk, ending at the deck/SW corner. Do NOT push z1 further south: holding the grade flat past the deck makes the SW garden bank up ~1 m right at the south fence, and the fence then rides over that bump. Ending here lets the garden rise gently inland instead.
      { x0: 10.48, z0: 15.93, x1: 14.93, z1: 19.18, level: 2.46 }, // atrium
      { x0: 10.48, z0: 6.68, x1: 21.28, z1: 7.18, level: 2.345, blend: 0.6 },   // drip strip — north wall
      { x0: 21.28, z0: 7.18, x1: 21.78, z1: 11.58, level: 2.345, blend: 0.6 },  // drip strip — east wall north of the notch
      // The south-side cut to the paved grade (396.50) is applied AFTER the level pads
      // because the carport level pad's blend would otherwise re-raise the SE corner up over the gravel.
    ];
    // Level pads — force the footprint flat to `level` (cut where the grade is higher, fill where it is
    // lower), smoothstep bank to grade at the edges. The real NW→SE fall drops the SE hardscape below its
    // slab level (cut alone can't lift it) and lifts the NW garden pads above theirs (cut alone pits them).
    const levelPads = [
      patchRect(groundPatches.garage),
      ...garden.elements.filter(e=>['sauna','saunaShelter'].includes(e.id)).map(e=>patchRect({...e.parts.find(p=>p.kind==='rect'),level:2.45,blend:1.2})),
      ...[groundPatches.pergola, groundPatches.greenhouse, groundPatches.raisedBeds].map(patchRect),
    ];
    // Pond basin — smooth bowl carved to the pond's downhill edge level.
    const ellipse = garden.elements.find(e => e.id === 'pond').parts.find(p => p.kind === 'ellipse');
    const edge = Math.min(...Array.from({ length: 16 }, (_, i) => {
      const a = i / 16 * Math.PI * 2;
      return naturalHeight({ plane, surveySurface: options.surveySurface }, ellipse.cx + Math.cos(a) * ellipse.rx, ellipse.cy + Math.sin(a) * ellipse.ry);
    }));
    const pond = { cx: ellipse.cx, cz: ellipse.cy, rx: ellipse.rx, rz: ellipse.ry, edge, depth: 0.55 };
    // Fill pads — excess site soil placed FLAT under a structure. Flat over the whole footprint,
    // sloping down only on the +x (garden) side; nothing on the other sides so it never bleeds into
    // the carport. Applied AFTER the cuts so an adjacent cut's blend can't clip the flat pad (no gaps).
    const fillPads = [
      { x0: 20.58, z0: 11.58, x1: 23.58, z1: 19.4, level: 2.44, eastBlend: 2.6 },  // soil under the E terrace, slope into the garden
    ];
    const postCuts = [
      // Driveway graded down to the carport slab level so it falls to the gate in one clean grade. The
      // ground rises just south of the carport, so without this the drive humps up between the parked cars
      // and the gate. Cut only (min), banking back to grade at the garden edges.
      { x0: 21.28, z0: 26.43, x1: 43.5, z1: 32.5, blend: 1.8, level: 1.925 },
      // South side down to the paved grade (396.50 = internal ~1.9). Applied here, AFTER the level pads, so the
      // carport pad's blend can't re-raise the SE corner over the gravel. First rect is the 1 m band + its lawn
      // run-out; second ties the SE corner across to the drive. Cut only (min against the post-pad height).
      // Narrow blend so the cut does NOT bleed west into the W terrace (x<10.48) — a wide blend there dug a
      // dip at the SW corner and the natural SW garden then read as a bump next to it. z1 keeps a 1 m flat
      // run-out south of the gravel so grass still can't climb the band.
      { x0: 10.48, z0: 25.5, x1: 21.28, z1: 28.5, blend: 1.2, level: 1.9 },
      { x0: 16.5, z0: 26.43, x1: 22.2, z1: 29.5, blend: 1.5, level: 1.9 },
    ];
    const spec = { plane, cutBlend, cutRects, fillPads, levelPads, postCuts, pond };
    if (options.surveySurface || Number.isFinite(options.houseFFL)) {
      if (!Number.isFinite(options.houseFFL)) throw new Error('Survey grading requires a finite house finished-floor datum');
      spec.surveySurface = options.surveySurface;
      spec.continuousGrading = true;
      spec.gradingStatus = 'concept proposal over measured-ground interpolation';
      spec.houseBaseY = options.houseFFL;
      spec.deckTop = options.houseFFL;
      spec.finishedSoil = options.houseFFL - .12;
      spec.houseExcavation = { points: garden.elements.find(e => e.id === 'house').parts.find(p => p.kind === 'polygon').points.map(p => p.slice()),
        level: options.houseFFL - .2, blend: .2 };
      spec.fillPads = [];
      spec.levelPads = [groundPatches.garage, groundPatches.pergola, groundPatches.greenhouse, groundPatches.raisedBeds]
        .map(p => ({ ...patchRect(p), blend: Math.max(p.blend ?? 2, 2.4) }));
      spec.cutRects = cutRects.map(p => ({ ...p, level: Math.min(p.level, spec.finishedSoil) }));
      spec.finishPads = garden.elements.filter(e => ['eastTerrace', 'westTerrace', 'sauna', 'saunaShelter', 'saunaPath'].includes(e.id))
        .flatMap(e => e.parts.filter(p => p.kind === 'rect').map(p => ({
          x0: p.x, z0: p.y, x1: p.x + p.w, z1: p.y + p.d, blend: 3,
        })));
      spec.protectedPads = [{ ...patchRect(groundPatches.garage), blend: .2 }];
      spec.protectedPads.push(...[groundPatches.greenhouse,groundPatches.raisedBeds].map(p=>({...patchRect(p),blend:.3})));
      const fire=garden.elements.find(e=>e.id==='firePit').parts.find(p=>p.kind==='circle');
      const gathering=groundPatches.pergola;
      const gatheringLink=(garden.gardenRoutes??[]).find(r=>r.id==='Gathering connection');
      spec.protectedPads.push({...patchRect(gathering),blend:2.4},
        {x0:fire.cx-fire.r,z0:fire.cy-fire.r,x1:fire.cx+fire.r,z1:fire.cy+fire.r,level:gathering.level,blend:2.4});
      if(gatheringLink)spec.protectedPads.push({
        x0:Math.min(gathering.x+gathering.w,...gatheringLink.points.map(p=>p[0]))-.1,
        x1:Math.max(fire.cx-fire.r,...gatheringLink.points.map(p=>p[0]))+.1,
        z0:Math.min(...gatheringLink.points.map(p=>p[1]))-gatheringLink.width/2,
        z1:Math.max(...gatheringLink.points.map(p=>p[1]))+gatheringLink.width/2,level:gathering.level,blend:2.4});
      const dining=(garden.gardenRoutes??[]).find(r=>r.id==='Daily dining');
      spec.routeProfiles=[];
      if(dining) {
        const lengths=[0];
        for(let i=1;i<dining.points.length;i++)lengths.push(lengths[i-1]+Math.hypot(dining.points[i][0]-dining.points[i-1][0],dining.points[i][1]-dining.points[i-1][1]));
        spec.routeProfiles.push({...dining,levels:lengths.map(s=>options.houseFFL+(gathering.level+.1-options.houseFFL)*s/lengths.at(-1))});
      }
      const driveway = garden.elements.find(e => e.id === 'driveway').parts.find(p => p.kind === 'polygon');
      const gateLine = garden.elements.find(e => e.id === 'gate').parts.find(p => p.kind === 'line');
      const gate = [(gateLine.x1 + gateLine.x2) / 2, (gateLine.y1 + gateLine.y2) / 2];
      spec.drivewayProfile = { points: driveway.points.map(p => p.slice()), startX: groundPatches.garage.x + groundPatches.garage.w,
        startLevel: groundPatches.garage.level, gate, gateLevel: naturalHeight(spec, ...gate) - .05, surfaceOffset: .05, edgeMargin: .15, blend: 1 };
      const routeHeight=(x,z)=>{
        for(const route of spec.routeProfiles) {const sample=routeSample(route,x,z);if(sample.distance<=route.width/2+.02)return sample.level;}
        if(gatheringLink&&routeSample({...gatheringLink,levels:gatheringLink.points.map(()=>gathering.level+.1)},x,z).distance<=gatheringLink.width/2+.02)return gathering.level+.1;
        const pads=[...spec.finishPads.map(p=>({...p,finish:options.houseFFL})),
          {...patchRect(gathering),finish:gathering.level+.1},
          {...patchRect(groundPatches.raisedBeds),finish:groundPatches.raisedBeds.level+.06},
          {...patchRect(groundPatches.greenhouse),finish:groundPatches.greenhouse.level+.04}];
        let result=height(spec,x,z)+.02;
        for(const p of pads){const d=rectDistance(p,x,z);if(d<.6)result=p.finish+(result-p.finish)*smoothstep(d/.6);}
        return result;
      };
      return { spec, height: (x, z) => height(spec, x, z), routeHeight, baseHeight: (x, z) => naturalHeight(spec, x, z) };
    }
    const house = garden.elements.find(e => e.id === 'house').parts.find(p => p.kind === 'polygon').points;
    let houseX = 0, houseZ = 0;
    for (const point of house) { houseX += point[0]; houseZ += point[1]; }
    spec.houseBaseY = height(spec, houseX / house.length, houseZ / house.length);
    spec.deckTop = spec.houseBaseY + 0.05;
    // Keep soil below the continuous house-to-sauna finished surface and its bedding.
    spec.postCuts.push(...garden.elements.filter(e => ['sauna', 'saunaShelter', 'saunaPath'].includes(e.id))
      .flatMap(e => e.parts.filter(p => p.kind === 'rect').map(p => ({
        x0: p.x, z0: p.y, x1: p.x + p.w, z1: p.y + p.d,
        level: spec.deckTop - 0.12, blend: 0.35,
      }))));
    return { spec, height: (x, z) => height(spec, x, z), baseHeight: (x, z) => baseHeight(plane, x, z) };
  }

  return { create, height };
})();
if (typeof module !== 'undefined') module.exports = { SiteTerrain };
