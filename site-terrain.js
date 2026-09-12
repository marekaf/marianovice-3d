const SiteTerrain = (() => {
  const baseHeight = (plane, x, z) => Math.max(0, plane.a * x + plane.b * z + plane.c);
  const surveySampler = () => typeof module !== 'undefined' ? require('./survey-surface.js').SurveySurface : SurveySurface;
  const naturalHeight = (spec, x, z) => spec.surveySurface ? surveySampler().height(spec.surveySurface, x, z) : baseHeight(spec.plane, x, z);
  const smoothstep = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const rectDistance = (r, x, z) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
  function bankEnvelope(value,level,slope,distance){
    const radius=.08*Math.min(1,distance/2);
    if(!radius)return level;
    const upper=level+slope*distance,lower=level-slope*distance;
    const softMax=(a,b)=>Math.max(a,b)+Math.max(0,radius-Math.abs(a-b))**2/(4*radius);
    return softMax(lower,-softMax(-upper,-value));
  }
  function drainageLevel(strip,x,z) {
    const dx=Math.max(0,Math.min(strip.xEnd??strip.x1,x)-(strip.xStart??strip.x0));
    const dz=Math.max(0,Math.min(strip.zEnd??strip.z1,z)-(strip.zStart??strip.z0));
    return strip.level+(strip.fallX??0)*dx+(strip.fallZ??0)*dz;
  }
  function productiveFinish(court,x) {
    if(court.mode==='level')return court.finish;
    const clamp=(value,max)=>Math.max(0,Math.min(max,value));
    const run=court.x1-court.runStart;
    const flat=court.aisles.reduce((sum,[a,b])=>sum+b-a,0);
    const progress=clamp(x-court.runStart,run)-court.aisles.reduce((sum,[a,b])=>sum+clamp(x-a,b-a),0);
    return court.greenhouseFinish+(court.houseFinish-court.greenhouseFinish)*progress/(run-flat);
  }
  function productiveInfluence(court,x,z) {
    if(x<court.x0-court.blend||x>court.x1+court.eastBlend||z<court.z0-court.blend-1||z>court.z1+court.blend)return 0;
    let distance=rectDistance(court,x,z);
    for(const route of court.routes)distance=Math.min(distance,Math.max(0,routeSample(route,x,z).distance-route.width/2));
    return (1-smoothstep(distance/court.blend))*(1-smoothstep((x-court.x1)/court.eastBlend));
  }
  function routeSample(route,x,z,bank=false) {
    const samples=[];
    for(let i=1;i<route.points.length;i++) {
      const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      const distance=Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
      samples.push({distance,level:route.levels[i-1]+(route.levels[i]-route.levels[i-1])*t});
    }
    const distance=Math.min(...samples.map(s=>s.distance));
    let weighted=0,total=0,bankWeighted=0,bankTotal=0;
    for(const sample of samples) {
      const weight=smoothstep(1-(sample.distance-distance)/(route.approachBank?2:.2))/(sample.distance**2+1e-12);
      weighted+=sample.level*weight;total+=weight;
      if(bank&&route.approachBank){const w=1/(sample.distance**2+1e-12);bankWeighted+=sample.level*w;bankTotal+=w;}
    }
    let level=weighted/total;
    if(bankTotal)level+=(bankWeighted/bankTotal-level)*smoothstep((distance-route.width/2)/.3);
    if(route.levelAxis){
      const p=route.levelAxis,length=Math.abs(p.end-p.start),u=Math.max(0,Math.min(length,((p.axis==='x'?x:z)-p.start)*Math.sign(p.end-p.start)));
      const easing=Math.min(p.easing??0,length/2),area=v=>v/2-easing*Math.sin(Math.PI*v/easing)/(2*Math.PI);
      const progress=easing?(u<easing?area(u):u>length-easing?length-easing-area(length-u):u-easing/2)/(length-easing):u/length;
      level=route.levels[0]+(route.levels.at(-1)-route.levels[0])*progress;
    }
    if(route.startRect){const d=rectDistance(route.startRect,x,z);level=route.levels[0]+(level-route.levels[0])*smoothstep(d/(route.startBlend??.6));}
    if(route.endCircle){const p=route.endCircle,d=Math.max(0,Math.hypot(x-p.cx,z-p.cz)-p.radius);level=route.levels.at(-1)+(level-route.levels.at(-1))*smoothstep(d/(route.endBlend??.6));}
    if(route.finishJoin){const shared=routeSample(route.finishJoin,x,z);const d=Math.max(0,shared.distance-route.finishJoin.width/2);level+=(shared.level-level)*(1-smoothstep(d/.5));}
    return {distance,level};
  }
  function routeBankClearance(route,x,z) {
    return Math.min(Infinity,...(route.bankAvoidRoutes??[]).map(other=>Math.max(0,routeSample(other,x,z).distance-other.width/2)));
  }
  function routeBedding(route,x,z) {
    if(route.startBedding===undefined)return route.bedding??.04;
    const [a,b]=route.points,dx=b[0]-a[0],dz=b[1]-a[1];
    const distance=((x-a[0])*dx+(z-a[1])*dz)/Math.hypot(dx,dz);
    return route.startBedding+(route.bedding-route.startBedding)*smoothstep(distance/1.2);
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
    for (const p of spec.regionalGrades ?? []) {
      const distance = rectDistance(p, x, z);
      const level = p.level + (p.fallX ?? 0) * Math.min(p.x1 - p.x0, Math.max(0, x - p.x0));
      h = Math.max(level - .4 * distance, Math.min(level + .4 * distance, h));
    }
    if(spec.drivewayApron) {
      const p=spec.drivewayProfile,distance=rectDistance(spec.drivewayApron,x,z);
      const level=p.startLevel+(p.gateLevel-p.startLevel)*smoothstep((x-p.startX)/(p.gate[0]-p.startX));
      h=Math.max(h,level-spec.drivewayApron.bankSlope*distance);
    }
    if (spec.regionalGrades) {
      const boundary = spec.boundary;
      for (let i = 0; i < boundary.length; i++) {
        const a = boundary[i], b = boundary[(i + 1) % boundary.length], dx = b[0] - a[0], dz = b[1] - a[1];
        const t = Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
        const bx=a[0]+t*dx,bz=a[1]+t*dz,distance=Math.hypot(x-bx,z-bz),level=naturalHeight(spec,bx,bz);
        h=Math.max(level-.4*distance,Math.min(level+.4*distance,h));
      }
    }
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
      if(distance<p.blend || spec.regionalGrades) {
        const level=p.startLevel+(p.gateLevel-p.startLevel)*smoothstep((x-p.startX)/(p.gate[0]-p.startX));
        h=spec.regionalGrades?Math.max(level-.4*distance,Math.min(level+.4*distance,h)):level+(h-level)*smoothstep(distance/p.blend);
      }
    }
    if (spec.finishPads?.length) {
      const distance = Math.min(...spec.finishPads.map(p => rectDistance(p, x, z) / p.blend));
      const level = spec.finishedSoil - (spec.regionalGrades ? .18 * smoothstep((z - 5.7) / 1.48) * (1 - smoothstep((x - 14.93) / 3)) : 0);
      if (spec.regionalGrades) {
        const metres=Math.min(...spec.finishPads.map(p=>rectDistance(p,x,z)));
        h=Math.max(level-.4*metres,Math.min(level+.4*metres,h));
      } else if (distance < 1) h = level + (h - level) * smoothstep(distance);
    }
    for (const p of spec.protectedPads ?? []) {
      const distance = rectDistance(p, x, z);
      const level=p.level+(p.fallX??0)*Math.min(p.x1-p.x0,Math.max(0,x-p.x0));
      if (p.bankSlope) h=bankEnvelope(h,level,p.bankSlope,distance);
      else if (distance < p.blend) h = level + (h - level) * smoothstep(distance / p.blend);
    }
    const gatheringSamples=(spec.gatheringPads??[]).map(p=>({p,d:p.radius===undefined?rectDistance(p,x,z):Math.max(0,Math.hypot(x-p.cx,z-p.cz)-p.radius)}));
    const core=gatheringSamples.find(s=>s.d===0);
    if(spec.regionalGrades)for(const {p,d} of gatheringSamples)h=Math.max(p.level-.4*d,Math.min(p.level+.4*d,h));
    else if(core)h=core.p.level;
    else {
      let total=0,level=0,strength=0;
      for(const {p,d}of gatheringSamples)if(d<p.blend){
        const influence=1-smoothstep(d/p.blend),weight=influence/(d*d);
        total+=weight;level+=p.level*weight;strength=Math.max(strength,influence);
      }
      if(total)h+=(level/total-h)*strength;
    }
    for(const route of (spec.routeProfiles??[]).filter(route=>route.bankApron&&!spec.regionalGrades)) {
      if(route.bankBounds&&rectDistance(route.bankBounds,x,z)>0)continue;
      const sample=routeSample(route,x,z,true),distance=Math.max(0,sample.distance-route.width/2);
      const clear=Math.min(...(spec.finishPads??[]).map(p=>rectDistance(p,x,z)),...(spec.protectedPads??[]).map(p=>rectDistance(p,x,z)),...gatheringSamples.map(s=>s.d),spec.houseExcavation?polygonDistance(spec.houseExcavation.points,x,z):Infinity);
      const influence=(1-smoothstep(distance/route.bankApron.blend))*smoothstep(clear/route.bankApron.clearBlend)*smoothstep(routeBankClearance(route,x,z));
      h+=(sample.level-(route.bedding??.04)-h)*influence;
    }
    for(const route of spec.routeProfiles??[]) {
      if(route.bankBounds&&rectDistance(route.bankBounds,x,z)>0)continue;
      const sample=routeSample(route,x,z,true),distance=Math.max(0,sample.distance-route.width/2);
      const bedding=routeBedding(route,x,z);
      const blend=route.bankBlend??.5;
      if(spec.regionalGrades){
        let target=Math.max(sample.level-bedding-(route.bankSlope??.4)*distance,Math.min(sample.level-bedding+(route.bankSlope??.4)*distance,h));
        for(const pad of spec.fixedFences?.levelPads??[])target=Math.max(target,pad.level-.4*rectDistance(pad,x,z));
        for(const strip of spec.drainageStrips??[])target=Math.min(target,drainageLevel(strip,x,z)+(strip.bankSlope??.45)*rectDistance(strip,x,z));
        const clear=route.approachBank?Math.min(...(spec.finishPads??[]).map(p=>rectDistance(p,x,z))):Infinity;
        h+=(target-h)*smoothstep(clear/.3);
      }
      else if(distance<blend) {
        const clear=route.approachBank?Math.min(...(spec.finishPads??[]).map(p=>rectDistance(p,x,z)),...(spec.protectedPads??[]).map(p=>rectDistance(p,x,z)),...gatheringSamples.map(s=>s.d)):Infinity;
        const influence=(1-smoothstep(distance/blend))*(route.approachBank?smoothstep(clear/1.2):1)*smoothstep(routeBankClearance(route,x,z));
        h+=(sample.level-bedding-h)*influence;
        if(route.approachBank)h=Math.min(h,h+(sample.level-bedding-h)*(1-smoothstep(distance/.3))*smoothstep(routeBankClearance(route,x,z)/.6));
      }
    }
    for(const strip of spec.drainageStrips??[])h=Math.min(h,drainageLevel(strip,x,z)+(strip.bankSlope??.45)*rectDistance(strip,x,z));
    const outer=pond.bankOuter??1.3;
    if(spec.regionalGrades)h=Math.max(h,pond.edge-.4*Math.max(0,Math.hypot(x-pond.cx,z-pond.cz)-Math.max(pond.rx,pond.rz)));
    const pondOuter=spec.continuousGrading&&z<pond.cz?outer+((pond.northBankOuter??outer)-outer)*Math.max(0,(pond.cz-z)/(pond.rz*prr||1))**16:outer;
    if(spec.regionalGrades && prr>1)h=Math.min(h,pond.edge+.4*(prr-1)*Math.min(pond.rx,pond.rz));
    else if(spec.continuousGrading&&prr<pondOuter) {
      if(prr<=1)h=Math.min(h,pond.edge-pond.depth*.5*(1+Math.cos(prr*Math.PI)));
      else h=Math.min(h,pond.edge+(h-pond.edge)*smoothstep((prr-1)/(pondOuter-1)));
    }
    if(spec.gateRunback){const p=spec.gateRunback,d=polygonDistance(p.points,x,z);if(d<p.blend)h=p.level+(h-p.level)*smoothstep(d/p.blend);}
    if(spec.wicketLanding){const p=spec.wicketLanding,d=Math.hypot(polygonDistance(p.points,x,z),polygonDistance(p.boundary,x,z));if(d<p.blend)h=p.level+(h-p.level)*smoothstep(d/p.blend);}
    if(spec.benchPad){const p=spec.benchPad,d=Math.hypot(Math.max(p.x0-x,0,x-p.x1)/p.blend,Math.max(p.z0-z,0)/p.blend,Math.max(z-p.z1,0)/p.southBlend);if(d<1)h=p.level+(h-p.level)*smoothstep(d);}
    if(spec.productiveCourt&&spec.productiveCourt.mode!=='level') {
      const p=spec.productiveCourt,weight=productiveInfluence(p,x,z);
      if(weight) {
        const greenhouseWeight=1-smoothstep(rectDistance(p.greenhouse,x,z)/.3);
        const bedding=.06-.02*greenhouseWeight+.06*smoothstep((x-(p.x1-.68))/.68);
        h+=(productiveFinish(p,x)-bedding-h)*weight;
      }
    }
    if(spec.drainageStrips?.some(strip=>strip.fallX||strip.fallZ)) {
      const p=(spec.protectedPads??[]).find(p=>p.id==='north-facade');
      if(p)h=Math.max(h,p.level+(p.fallX??0)*Math.min(p.x1-p.x0,Math.max(0,x-p.x0))-.4*rectDistance(p,x,z));
    }
    for(const strip of spec.drainageStrips??[])if(strip.minimumSurface)h=Math.max(h,drainageLevel(strip,x,z)-(strip.bankSlope??.45)*rectDistance(strip,x,z));
    for(const segment of spec.fixedFences?.segments??[]) {
      const [a,b]=[segment.start,segment.end],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      const bx=a[0]+t*dx,bz=a[1]+t*dz,d=Math.hypot(x-bx,z-bz),level=naturalHeight(spec,bx,bz);
      let slope=spec.fixedFences.bankSlope;
      for(const pad of spec.fixedFences.levelPads??[])slope=Math.max(slope,Math.min(pad.bankSlope,Math.abs(pad.level-level)/Math.max(.001,rectDistance(pad,bx,bz))));
      h=Math.max(level-slope*d,Math.min(level+slope*d,h));
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
    const addBenchPad=()=>{
      const model=typeof module!=='undefined'?require('./hidden-bench-model.js').HiddenBenchModel:HiddenBenchModel;
      const patch=model.groundPatch(garden,(x,z)=>height(spec,x,z));
      spec.benchPad={...patchRect(patch),southBlend:patch.southBlend};
    };
    if (options.surveySurface || Number.isFinite(options.houseFFL)) {
      if (!Number.isFinite(options.houseFFL)) throw new Error('Survey grading requires a finite house finished-floor datum');
      spec.surveySurface = options.surveySurface;
      spec.continuousGrading = true;
      spec.gradingStatus = 'concept proposal over measured-ground interpolation';
      spec.gradingBanks = garden.gradingBanks ?? [];
      if(options.fixedFences?.length)spec.fixedFences={segments:options.fixedFences,bankSlope:.4};
      spec.houseBaseY = options.houseFFL;
      spec.deckTop = options.houseFFL;
      spec.finishedSoil = options.houseFFL - .12;
      spec.houseExcavation = { points: garden.elements.find(e => e.id === 'house').parts.find(p => p.kind === 'polygon').points.map(p => p.slice()),
        level: options.houseFFL - .2, blend: .2 };
      spec.fillPads = [];
      spec.levelPads = [];
      spec.cutRects = [];
      spec.postCuts = [];
      spec.boundary = garden.plot.vertices.map(p => p.slice());
      spec.boundaryBlend = 5;
      spec.regionalGrades = [
        {id:'lower-fill',x0:24,z0:3,x1:40,z1:24,level:groundPatches.garage.level,fallX:-.025,blend:5},
        {id:'north-lawn',x0:10.48,z0:4.2,x1:34.13,z1:26.43,level:groundPatches.garage.level,blend:4},
        {...patchRect(groundPatches.raisedBeds),id:'productive',blend:3.5},
        {...patchRect(groundPatches.greenhouse),id:'greenhouse-apron',x0:groundPatches.greenhouse.x-.2,x1:groundPatches.greenhouse.x+groundPatches.greenhouse.w+.2,blend:2.5},
        {id:'west-strip',x0:8.73,z0:7.18,x1:10.48,z1:26.43,level:options.houseFFL-.3,blend:3},
        {id:'north-fall',x0:10.48,z0:6.18,x1:21.28,z1:7.18,level:options.houseFFL-.04,fallX:-.5/10.8,blend:2.5},
        {id:'south-fall',x0:10.48,z0:26.43,x1:21.28,z1:27.43,level:options.houseFFL-.04,fallX:-.5/10.8,blend:3},
      ];
      spec.drainageStrips=garden.elements.filter(e=>e.id==='westDrainageStrip').flatMap(e=>e.parts.filter(p=>p.kind==='rect').map(p=>({...patchRect(p),...p.grading,level:options.houseFFL+(p.grading?.relativeLevel??e.meta.grading.relativeLevel)})));
      spec.bankReview = [
        {id:'productive-west',label:'Užitková zahrada a západní průleh',bounds:[0,10.48,7,23],status:'Čtyři záhony ve dvou řadách blíže západní hranici, 0,40 m nad západní terasou; plynulé spojení se skleníkem a saunou.'},
        {id:'south-house',label:'Jižní svah a servisní plocha',bounds:[8.3,22,26.43,31],status:'Plynulý spád od západu k východu; rovná odbočka k tepelnému čerpadlu. Ověřit povrchový odtok.'},
        {id:'north-fill',label:'Severní a východní dosypání',bounds:[24,43,0,19],status:'Dosypání s volnými svahy do stávajících hranic. Únosnost sousední zdi není započtena; konečný sklon ověřit podle zeminy.'},
      ];
      spec.finishPads = garden.elements.filter(e => ['eastTerrace', 'westTerrace', 'sauna', 'saunaShelter', 'saunaPath'].includes(e.id))
        .flatMap(e => e.parts.filter(p => p.kind === 'rect').map(p => ({
          x0: p.x, z0: p.y, x1: p.x + p.w, z1: p.y + p.d, blend: e.id === 'westTerrace' ? .75 : 3,
        })));
      spec.protectedPads = [{ ...patchRect(groundPatches.garage), bankSlope: .4 }];
      const greenhouse=patchRect(groundPatches.greenhouse),beds=patchRect(groundPatches.raisedBeds);
      spec.productiveCourt={...beds,mode:'level',finish:groundPatches.raisedBeds.level+.06,greenhouseFinish:groundPatches.greenhouse.level+.04,aisles:[],greenhouse};
      spec.protectedPads.push(...[groundPatches.greenhouse,groundPatches.raisedBeds].map(p=>({...patchRect(p),blend:.3,bankSlope:p.bankSlope??.4})));
      const service=garden.elements.find(e=>e.id==='heatPumpService')?.parts.find(p=>p.kind==='rect');
      spec.southGravel={x0:10.48,x1:21.28,startDepth:.07,endDepth:.04,service:service?patchRect(service):null,serviceBlend:.15};
      spec.protectedPads.push({id:'south-facade',x0:10.48,z0:26.43,x1:21.28,z1:27.45,level:options.houseFFL-.07,fallX:-.47/10.8,blend:1,bankSlope:.4});
      if(service)spec.protectedPads.push({...patchRect({...service,level:groundPatches.garage.level}),blend:1.2,bankSlope:.4});
      spec.protectedPads.push({id:'north-facade',x0:10.48,z0:6.73,x1:21.28,z1:7.18,level:options.houseFFL-.07,fallX:-.5/10.8,blend:1,bankSlope:.4});
      const fireElement=garden.elements.find(e=>e.id==='firePit');
      const fire=fireElement.parts.find(p=>p.kind==='circle');
      const gathering=groundPatches.pergola;
      if(spec.fixedFences&&gathering.fenceBankSlope)spec.fixedFences.levelPads=[{...patchRect(gathering),bankSlope:gathering.fenceBankSlope}];
      const fireLevel=fireElement.meta?.grading?.level??gathering.level;
      const fireFinished=fireLevel+(fireElement.meta?.grading?.surfaceOffset??0)+.008;
      spec.pond.northBankOuter=Math.max(1.3,(pond.cz-fire.cy-fire.r)/pond.rz);
      spec.pond.bankOuter=3;
      spec.pond.edge=groundPatches.garage.level;
      const gatheringLink=(garden.gardenRoutes??[]).find(r=>r.id==='Gathering connection');
      spec.gatheringPads=[{...patchRect(gathering),blend:4},
        {cx:fire.cx,cz:fire.cy,radius:fire.r,level:fireLevel,blend:2.4}];
      const dining=(garden.gardenRoutes??[]).find(r=>r.id==='Daily dining');
      if(dining)spec.bankReview.push({id:'dining-corner',label:'Terrace-to-pergola planted approach bank',
        bounds:[Math.min(...dining.points.map(p=>p[0]))-1.3,Math.max(...dining.points.map(p=>p[0]))+1.3,Math.min(...dining.points.map(p=>p[1]))-1.3,Math.max(...dining.points.map(p=>p[1]))+1.3],
        status:'Sloping approach to the northern pergola with level landings and blended planted banks. Local shoulders, retaining, soil stability and surface-water interception require engineering review.'});
      spec.bankReview.push({id:'north-pergola',label:'Northern pergola planted banks',
        bounds:[gathering.x-2.4,gathering.x+gathering.w+2.4,gathering.y-2.4,gathering.y+gathering.d+2.4],
        status:'Lowered pergola pad follows the northern terrain. Bank slopes, north boundary drainage, foundations and retaining remain proposals requiring engineering review.'});
      spec.routeProfiles=[];
      const pondWalk=(garden.gardenRoutes??[]).find(r=>r.id==='Pond walk');
      const pondApproach=pondWalk?{...pondWalk,id:'Pond approach',points:pondWalk.points.slice(3)}:null;
      const pondStart=pondApproach?height(spec,...pondApproach.points[0])+.02:0;
      for(const [route,start,end]of [[dining,options.houseFFL,gathering.level+.1],[gatheringLink,gathering.level+.1,fireFinished],[pondApproach,pondStart,fireFinished]])if(route) {
        const lengths=[0];
        for(let i=1;i<route.points.length;i++)lengths.push(lengths[i-1]+Math.hypot(route.points[i][0]-route.points[i-1][0],route.points[i][1]-route.points[i-1][1]));
        const startLanding=route.startLanding??(route===gatheringLink?.8:1.2),endLanding=route.endLanding??(route===pondApproach?lengths.at(-1)-lengths.at(-3)+1.2:route===gatheringLink?lengths.at(-1)-lengths[1]+.25:1.1);
        const transitionLength=route===gatheringLink?.4:.8,active=lengths.at(-1)-startLanding-endLanding;
        const distances=[...lengths,startLanding,lengths.at(-1)-endLanding].sort((a,b)=>a-b).filter((s,i,a)=>i===0||s-a[i-1]>1e-6);
        const points=distances.map(s=>{const i=Math.max(1,lengths.findIndex(v=>v>=s)),t=(s-lengths[i-1])/(lengths[i]-lengths[i-1]);return route.points[i-1].map((v,k)=>v+t*(route.points[i][k]-v));});
        const levels=distances.map(s=>{const u=Math.max(0,Math.min(active,s-startLanding)),area=v=>v/2-transitionLength*Math.sin(Math.PI*v/transitionLength)/(2*Math.PI);
          const progress=u<transitionLength?area(u):u>active-transitionLength?active-transitionLength-area(active-u):u-transitionLength/2;
          return start+(end-start)*progress/(active-transitionLength);});
        spec.routeProfiles.push({...route,points,bedding:.1,levels,
          ...(route===gatheringLink?{bankBlend:1.8}:{}),
          ...(route===pondApproach?{approachBank:true,bankBlend:2.4,startBedding:.02,endCircle:{cx:fire.cx,cz:fire.cy,radius:fire.r},
            levelAxis:{axis:'x',start:pondApproach.points[0][0],end:groundPatches.garage.x+groundPatches.garage.w,easing:.2},
            finishJoin:spec.routeProfiles.find(profile=>profile.id===gatheringLink?.id),
            bankAvoidRoutes:[dining,gatheringLink].filter(Boolean).map(r=>({...r,levels:r.points.map(()=>0)}))}:{}),
          ...(route===dining?{approachBank:true,bankBlend:1.3,bankApron:{blend:2.4,clearBlend:1.2},
            startRect:patchRect(garden.elements.find(e=>e.id==='eastTerrace').parts.find(p=>p.kind==='rect')),
            endCircle:{cx:route.points.at(-1)[0],cz:route.points.at(-1)[1],radius:route.width/2},
            bankAvoidRoutes:(garden.gardenRoutes??[]).filter(r=>r.id==='Pond walk').map(r=>({...r,levels:r.points.map(()=>0)})),
            bankBounds:{x0:Math.min(...points.map(p=>p[0]))-3,x1:Math.max(...points.map(p=>p[0]))+3,z0:Math.min(...points.map(p=>p[1]))-3,z1:Math.max(...points.map(p=>p[1]))+3}}:{}),
          ...(route===gatheringLink?{endCircle:{cx:fire.cx,cz:fire.cy,radius:fire.r}}:{})});
      }
      for (const id of ['Productive access', 'Bed access', 'Greenhouse access']) {
        const route = (garden.gardenRoutes ?? []).find(r => r.id === id);
        if (!route) continue;
        const bedFinish = groundPatches.raisedBeds.level + .06;
        const end = id === 'Greenhouse access' ? groundPatches.greenhouse.level+.04 : bedFinish;
        const start = Number.isFinite(route.startRelativeLevel) ? options.houseFFL+route.startRelativeLevel : id === 'Productive access' ? options.houseFFL : bedFinish;
        const lengths = [0];
        for (let i = 1; i < route.points.length; i++) lengths.push(lengths[i-1] + Math.hypot(route.points[i][0]-route.points[i-1][0], route.points[i][1]-route.points[i-1][1]));
        spec.routeProfiles.push({...route,bedding:.06,bankBlend:1.2,levels:lengths.map((distance,i)=>start+(end-start)*(route.levelFractions?.[i]??Math.min(1,distance/(id==='Productive access'?lengths.at(-2):lengths.at(-1))))) });
      }
      const driveway = garden.elements.find(e => e.id === 'driveway').parts.find(p => p.kind === 'polygon');
      const gateLine = garden.elements.find(e => e.id === 'gate').parts.find(p => p.kind === 'line');
      const gate = [(gateLine.x1 + gateLine.x2) / 2, (gateLine.y1 + gateLine.y2) / 2];
      spec.drivewayProfile = { points: driveway.points.map(p => p.slice()), startX: groundPatches.garage.x + groundPatches.garage.w,
        startLevel: groundPatches.garage.level, gate, gateLevel: naturalHeight(spec, ...gate) - .04, surfaceOffset: .04, edgeMargin: .15, blend: 3 };
      const waterSource=garden.elements.find(e=>e.id==='waterSource')?.parts.find(p=>p.kind==='circle');
      if(waterSource)spec.drivewayApron={id:'water-source-approach',x0:spec.drivewayProfile.startX,z0:waterSource.cy-2.45,x1:waterSource.cx+1.25,z1:27.89,bankSlope:.4};
      const gateLength=Math.hypot(gateLine.x2-gateLine.x1,gateLine.y2-gateLine.y1);
      const direction=[(gateLine.x2-gateLine.x1)/gateLength,(gateLine.y2-gateLine.y1)/gateLength],start=[gateLine.x1,gateLine.y1];
      const gatePoint=(t,inset)=>[start[0]+direction[0]*t-direction[1]*inset,start[1]+direction[1]*t+direction[0]*inset];
      spec.gateRunback={start,direction,from:-5.8,to:.2,inset:0,width:.8,level:spec.drivewayProfile.gateLevel,blend:.4,
        finishedLevel:spec.drivewayProfile.gateLevel+spec.drivewayProfile.surfaceOffset,
        points:[gatePoint(-5.8,0),gatePoint(.2,0),gatePoint(.2,.8),gatePoint(-5.8,.8)]};
      spec.wicketLanding={start,direction,from:4.02,to:5.30,inset:0,width:1.20,level:spec.drivewayProfile.gateLevel,blend:.3,
        finishedLevel:spec.gateRunback.finishedLevel,boundary:garden.plot.vertices.map(p=>p.slice()),
        points:[gatePoint(4.02,0),gatePoint(5.30,0),gatePoint(5.30,1.20),gatePoint(4.02,1.20)]};
      addBenchPad();
      const productivePads=[
        {...patchRect(groundPatches.raisedBeds),finish:groundPatches.raisedBeds.level+.06},
        {...patchRect(groundPatches.greenhouse),finish:groundPatches.greenhouse.level+.04}];
      const crossingSurfaces=(garden.elements.find(e=>e.id==='westDrainageStrip')?.meta.grading.coveredCrossings??[]).filter(p=>p.surfaceReference).map(p=>{
        const west=garden.elements.find(e=>e.id==='westTerrace').parts.find(p=>p.kind==='rect');
        const route=garden.gardenRoutes.find(r=>r.id===p.routeId);
        return {route:{...route,levels:route.points.map(()=>0)},spec:{...spec,drainageStrips:[{x0:west.x-.75,x1:west.x,z0:west.y,z1:west.y+west.d,level:options.houseFFL+p.surfaceReference.relativeLevel,bankSlope:p.surfaceReference.bankSlope}]}};
      });
      const routeHeight=(x,z)=>{
        const pads=[...spec.finishPads.map(p=>({...p,finish:options.houseFFL})),
          {...patchRect(gathering),finish:gathering.level+.1}];
        const crossing=crossingSurfaces.find(p=>routeSample(p.route,x,z).distance<=p.route.width/2+.02);
        let result=height(crossing?.spec??spec,x,z)+.02;
        for(const p of pads){const d=rectDistance(p,x,z);if(d<.6)result=p.finish+(result-p.finish)*smoothstep(d/.6);}
        const productive=productivePads.map(p=>{const d=rectDistance(p,x,z);return {p,d,influence:1-smoothstep(d/.6)};}).filter(s=>s.influence>0);
        if(productive.length===1){const {p,d}=productive[0];result=p.finish+(result-p.finish)*smoothstep(d/.6);}
        else if(productive.length>1){
          const core=productive.find(s=>s.d===0);
          if(core)result=core.p.finish;
          else {
            let total=0,finish=0,strength=0;
            for(const {p,d,influence}of productive){
              const weight=influence/(d*d);
              total+=weight;finish+=p.finish*weight;strength=Math.max(strength,influence);
            }
            result+=(finish/total-result)*strength;
          }
        }
        for(const route of spec.routeProfiles){if(route.bankBounds&&rectDistance(route.bankBounds,x,z)>0)continue;const sample=routeSample(route,x,z),d=Math.max(0,sample.distance-route.width/2-.02);if(d<.5)result=sample.level+(result-sample.level)*smoothstep(d/.5);}
        const influence=spec.productiveCourt.mode==='level'?0:productiveInfluence(spec.productiveCourt,x,z);
        result+=(productiveFinish(spec.productiveCourt,x)-result)*influence;
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
    addBenchPad();
    return { spec, height: (x, z) => height(spec, x, z), baseHeight: (x, z) => baseHeight(plane, x, z) };
  }

  function southGravelDepth(spec,x,z) {
    const p=spec.southGravel;if(!p)return .07;
    const t=Math.max(0,Math.min(1,(x-p.x0)/(p.x1-p.x0)));
    const service=p.service?1-smoothstep(rectDistance(p.service,x,z)/p.serviceBlend):0;
    return p.startDepth+(p.endDepth-p.startDepth)*t*(1-service);
  }
  return { create, height, productiveFinish, southGravelDepth };
})();
if (typeof module !== 'undefined') module.exports = { SiteTerrain };
