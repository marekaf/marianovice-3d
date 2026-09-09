const SiteTerrain = (() => {
  const baseHeight = (plane, x, z) => Math.max(0, plane.a * x + plane.b * z + plane.c);
  const surveySampler = () => typeof module !== 'undefined' ? require('./survey-surface.js').SurveySurface : SurveySurface;
  const naturalHeight = (spec, x, z) => spec.surveySurface ? surveySampler().height(spec.surveySurface, x, z) : baseHeight(spec.plane, x, z);
  const smoothstep = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const rectDistance = (r, x, z) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
  function productiveFinish(court,x) {
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
      const weight=smoothstep(1-(sample.distance-distance)/.2)/(sample.distance**2+1e-12);
      weighted+=sample.level*weight;total+=weight;
    }
    let level=weighted/total;
    if(route.endCircle){const p=route.endCircle,d=Math.max(0,Math.hypot(x-p.cx,z-p.cz)-p.radius);level=route.levels.at(-1)+(level-route.levels.at(-1))*smoothstep(d/.6);}
    if(route.startRect){const d=rectDistance(route.startRect,x,z);level=route.levels[0]+(level-route.levels[0])*smoothstep(d/.6);}
    return {distance,level};
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
    const gatheringSamples=(spec.gatheringPads??[]).map(p=>({p,d:p.radius===undefined?rectDistance(p,x,z):Math.max(0,Math.hypot(x-p.cx,z-p.cz)-p.radius)}));
    const core=gatheringSamples.find(s=>s.d===0);
    if(core)h=core.p.level;
    else {
      let total=0,level=0,strength=0;
      for(const {p,d}of gatheringSamples)if(d<p.blend){
        const influence=1-smoothstep(d/p.blend),weight=influence/(d*d);
        total+=weight;level+=p.level*weight;strength=Math.max(strength,influence);
      }
      if(total)h+=(level/total-h)*strength;
    }
    for(const route of (spec.routeProfiles??[]).filter(route=>route.bankApron)) {
      const sample=routeSample(route,x,z),distance=Math.max(0,sample.distance-route.width/2);
      const clear=Math.min(...(spec.finishPads??[]).map(p=>rectDistance(p,x,z)),...(spec.protectedPads??[]).map(p=>rectDistance(p,x,z)),...gatheringSamples.map(s=>s.d),spec.houseExcavation?polygonDistance(spec.houseExcavation.points,x,z):Infinity);
      const influence=(1-smoothstep(distance/route.bankApron.blend))*smoothstep(clear/route.bankApron.clearBlend);
      h+=(sample.level-(route.bedding??.04)-h)*influence;
    }
    for(const route of spec.routeProfiles??[]) {
      const sample=routeSample(route,x,z),distance=Math.max(0,sample.distance-route.width/2);
      const bedding=route.bedding??.04;
      const blend=route.bankBlend??.5;
      if(distance<blend)h=sample.level-bedding+(h-sample.level+bedding)*smoothstep(distance/blend);
    }
    const pondOuter=spec.continuousGrading&&z<pond.cz?1.3+((pond.northBankOuter??1.3)-1.3)*Math.max(0,(pond.cz-z)/(pond.rz*prr||1))**16:1.3;
    if(spec.continuousGrading&&prr<pondOuter) {
      if(prr<=1)h=Math.min(h,pond.edge-pond.depth*.5*(1+Math.cos(prr*Math.PI)));
      else h=Math.min(h,pond.edge+(h-pond.edge)*smoothstep((prr-1)/(pondOuter-1)));
    }
    if(spec.gateRunback){const p=spec.gateRunback,d=polygonDistance(p.points,x,z);if(d<p.blend)h=p.level+(h-p.level)*smoothstep(d/p.blend);}
    if(spec.wicketLanding){const p=spec.wicketLanding,d=polygonDistance(p.points,x,z);if(d<p.blend&&polygonDistance(p.boundary,x,z)<1e-9)h=p.level+(h-p.level)*smoothstep(d/p.blend);}
    if(spec.benchPad){const p=spec.benchPad,d=Math.hypot(Math.max(p.x0-x,0,x-p.x1)/p.blend,Math.max(p.z0-z,0)/p.blend,Math.max(z-p.z1,0)/p.southBlend);if(d<1)h=p.level+(h-p.level)*smoothstep(d);}
    if(spec.productiveCourt) {
      const p=spec.productiveCourt,weight=productiveInfluence(p,x,z);
      if(weight) {
        const greenhouseWeight=1-smoothstep(rectDistance(p.greenhouse,x,z)/.3);
        const bedding=.06-.02*greenhouseWeight+.06*smoothstep((x-(p.x1-.68))/.68);
        h+=(productiveFinish(p,x)-bedding-h)*weight;
      }
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
      spec.houseBaseY = options.houseFFL;
      spec.deckTop = options.houseFFL;
      spec.finishedSoil = options.houseFFL - .12;
      spec.houseExcavation = { points: garden.elements.find(e => e.id === 'house').parts.find(p => p.kind === 'polygon').points.map(p => p.slice()),
        level: options.houseFFL - .2, blend: .2 };
      spec.fillPads = [];
      spec.levelPads = [groundPatches.garage]
        .map(p => ({ ...patchRect(p), blend: Math.max(p.blend ?? 2, 2.4) }));
      spec.cutRects = cutRects.map(p => ({ ...p, level: Math.min(p.level, spec.finishedSoil) }));
      spec.cutRects[0].blend = 4;
      Object.assign(spec.postCuts[1], { z1:27.43, blend:2.4 });
      Object.assign(spec.postCuts[2], { z1:29, blend:3 });
      spec.bankReview = [
        {id:'productive-west',label:'Productive court planted banks',bounds:[0,9.48,7.5,18.5],status:'Sloping walking approach with level crossfall aisles. Surrounding banks remain steep and provisional; retaining, drainage and soil stability require engineering review.'},
        {id:'south-house',label:'Southwest house bank',bounds:[8.3,17,27.43,30.5],status:'Broader planted transition; remaining steep sections require soil stability and drainage review.'},
        {id:'dining-corner',label:'East terrace / daily dining corner',bounds:[23,25.5,10.8,12.4],status:'The lowered pergola steepens the unchanged terrace approach and its soil banks. This is a level study, not an approved access gradient. Resolve the path alignment, retaining or planted-bank geometry and surface-water interception before construction.'},
      ];
      spec.finishPads = garden.elements.filter(e => ['eastTerrace', 'westTerrace', 'sauna', 'saunaShelter', 'saunaPath'].includes(e.id))
        .flatMap(e => e.parts.filter(p => p.kind === 'rect').map(p => ({
          x0: p.x, z0: p.y, x1: p.x + p.w, z1: p.y + p.d, blend: 3,
        })));
      spec.protectedPads = [{ ...patchRect(groundPatches.garage), blend: .2 }];
      const greenhouse=patchRect(groundPatches.greenhouse),beds=patchRect(groundPatches.raisedBeds);
      spec.productiveCourt={x0:greenhouse.x0,x1:9.48,z0:beds.z0,z1:beds.z1,runStart:greenhouse.x1,
        greenhouseFinish:2.725,houseFinish:options.houseFFL,aisles:[[4.2,5.2],[6.2,7.2]],blend:2.4,eastBlend:.4,greenhouse,
        routes:(garden.gardenRoutes??[]).filter(r=>['Productive access','Bed access','Greenhouse access'].includes(r.id)).map(r=>({...r,levels:r.points.map(()=>0)}))};
      const fireElement=garden.elements.find(e=>e.id==='firePit');
      const fire=fireElement.parts.find(p=>p.kind==='circle');
      const gathering=groundPatches.pergola;
      const fireLevel=fireElement.meta?.grading?.level??gathering.level;
      const fireFinished=fireLevel+(fireElement.meta?.grading?.surfaceOffset??0)+.008;
      spec.pond.northBankOuter=Math.max(1.3,(pond.cz-fire.cy-fire.r)/pond.rz);
      const gatheringLink=(garden.gardenRoutes??[]).find(r=>r.id==='Gathering connection');
      spec.gatheringPads=[{...patchRect(gathering),blend:2.4},
        {cx:fire.cx,cz:fire.cy,radius:fire.r,level:fireLevel,blend:2.4}];
      const dining=(garden.gardenRoutes??[]).find(r=>r.id==='Daily dining');
      spec.routeProfiles=[];
      for(const [route,start,end]of [[dining,options.houseFFL,gathering.level+.1],[gatheringLink,gathering.level+.1,fireFinished]])if(route) {
        const lengths=[0];
        for(let i=1;i<route.points.length;i++)lengths.push(lengths[i-1]+Math.hypot(route.points[i][0]-route.points[i-1][0],route.points[i][1]-route.points[i-1][1]));
        spec.routeProfiles.push({...route,bedding:.1,levels:lengths.map(s=>start+(end-start)*s/lengths.at(-1)),
          ...(route===gatheringLink?{bankBlend:1.8}:{}),
          ...(route===dining?{bankApron:{blend:1.8,clearBlend:.6}}:{}),
          ...(route===gatheringLink?{startRect:patchRect(gathering),endCircle:{cx:fire.cx,cz:fire.cy,radius:fire.r}}:{})});
      }
      const driveway = garden.elements.find(e => e.id === 'driveway').parts.find(p => p.kind === 'polygon');
      const gateLine = garden.elements.find(e => e.id === 'gate').parts.find(p => p.kind === 'line');
      const gate = [(gateLine.x1 + gateLine.x2) / 2, (gateLine.y1 + gateLine.y2) / 2];
      spec.drivewayProfile = { points: driveway.points.map(p => p.slice()), startX: groundPatches.garage.x + groundPatches.garage.w,
        startLevel: groundPatches.garage.level, gate, gateLevel: naturalHeight(spec, ...gate) - .05, surfaceOffset: .05, edgeMargin: .15, blend: 1 };
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
      const routeHeight=(x,z)=>{
        const pads=[...spec.finishPads.map(p=>({...p,finish:options.houseFFL})),
          {...patchRect(gathering),finish:gathering.level+.1}];
        let result=height(spec,x,z)+.02;
        for(const p of pads){const d=rectDistance(p,x,z);if(d<.6)result=p.finish+(result-p.finish)*smoothstep(d/.6);}
        const productive=productivePads.map(p=>({p,d:rectDistance(p,x,z)})).filter(s=>s.d<.6);
        if(productive.length===1){const {p,d}=productive[0];result=p.finish+(result-p.finish)*smoothstep(d/.6);}
        else if(productive.length>1){
          const core=productive.find(s=>s.d===0);
          if(core)result=core.p.finish;
          else {
            let total=0,finish=0,strength=0;
            for(const {p,d}of productive){
              const influence=1-smoothstep(d/.6),weight=influence/(d*d);
              total+=weight;finish+=p.finish*weight;strength=Math.max(strength,influence);
            }
            result+=(finish/total-result)*strength;
          }
        }
        for(const route of spec.routeProfiles){const sample=routeSample(route,x,z),d=Math.max(0,sample.distance-route.width/2-.02);if(d<.5)result=sample.level+(result-sample.level)*smoothstep(d/.5);}
        const influence=productiveInfluence(spec.productiveCourt,x,z);
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

  return { create, height, productiveFinish };
})();
if (typeof module !== 'undefined') module.exports = { SiteTerrain };
