const SiteTerrain = (() => {
  const baseHeight = (plane, x, z) => Math.max(0, plane.a * x + plane.b * z + plane.c);
  let surveySurfaceModule = null;
  const surveySampler = () => surveySurfaceModule ??= typeof module !== 'undefined' ? require('./survey-surface.js').SurveySurface : SurveySurface;
  const naturalHeight = (spec, x, z) => spec.surveySurface ? surveySampler().height(spec.surveySurface, x, z) : baseHeight(spec.plane, x, z);
  const smoothstep = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const rectDistance = (r, x, z) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
  // Height queries run tens of millions of times while the viewer builds its ground, so the loops
  // below avoid allocating per call. Every shortcut must return the same number as the plain code.
  const bounds = new WeakMap();
  function polygonBounds(points) {
    let box = bounds.get(points);
    if (!box) {
      box = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
      for (const [px, pz] of points) { box.x0 = Math.min(box.x0, px); box.x1 = Math.max(box.x1, px); box.z0 = Math.min(box.z0, pz); box.z1 = Math.max(box.z1, pz); }
      bounds.set(points, box);
    }
    return box;
  }
  // Most queries lie far from a boundary or fence segment, so the projection clamps to one of its
  // two endpoints. Those two natural heights are constant per segment and are computed once.
  const endpointLevels = new WeakMap();
  function segmentLevel(spec, key, a, dx, dz, t) {
    if (t !== 0 && t !== 1) return naturalHeight(spec, a[0] + t * dx, a[1] + t * dz);
    const surface = spec.surveySurface ?? spec.plane;
    let perSurface = endpointLevels.get(surface);
    if (!perSurface) endpointLevels.set(surface, perSurface = new WeakMap());
    let levels = perSurface.get(key);
    if (!levels) perSurface.set(key, levels = [naturalHeight(spec, a[0], a[1]), naturalHeight(spec, a[0] + dx, a[1] + dz)]);
    return levels[t];
  }
  const minRectDistance = (rects, x, z) => { let d = Infinity; for (const r of rects) d = Math.min(d, rectDistance(r, x, z)); return d; };
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
  const sampleDistances=[],sampleLevels=[];
  function routeSample(route,x,z,bank=false) {
    const count=route.points.length-1;
    let distance=Infinity;
    for(let i=1;i<=count;i++) {
      const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      const d=Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
      sampleDistances[i-1]=d;sampleLevels[i-1]=route.levels[i-1]+(route.levels[i]-route.levels[i-1])*t;
      distance=Math.min(distance,d);
    }
    let weighted=0,total=0,bankWeighted=0,bankTotal=0;
    for(let i=0;i<count;i++) {
      const sampleDistance=sampleDistances[i],sampleLevel=sampleLevels[i];
      const weight=smoothstep(1-(sampleDistance-distance)/(route.approachBank?2:.2))/(sampleDistance**2+1e-12);
      weighted+=sampleLevel*weight;total+=weight;
      if(bank&&route.approachBank){const w=1/(sampleDistance**2+1e-12);bankWeighted+=sampleLevel*w;bankTotal+=w;}
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
    let clearance=Infinity;
    for(const other of route.bankAvoidRoutes??[])clearance=Math.min(clearance,Math.max(0,routeSample(other,x,z).distance-other.width/2));
    return clearance;
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

  function drivewayFinish(spec,x,z) {
    const c=spec.carportSurface;if(c&&rectDistance(c,x,z)===0)return c.finishNorth+(c.finishSouth-c.finishNorth)*Math.max(0,Math.min(1,(z-c.z0)/(c.z1-c.z0)));
    const p=spec.drivewayProfile,t=Math.max(0,Math.min(1,(x-p.startX)/(p.gate[0]-p.startX)));
    const apron=p.apronNorth+(p.apronSouth-p.apronNorth)*Math.max(0,Math.min(1,(z-p.apronZ0)/(p.apronZ1-p.apronZ0)));
    return apron+(p.gateLevel+p.surfaceOffset-apron)*t;
  }
  const routeFootprintDistance=(route,x,z,sample)=>Math.min(Math.max(0,sample.distance-route.width/2-.002),minRectDistance(route.pavingRects??[],x,z));
  function routeSurfaceBedding(spec,x,z) {
    let bedding=.02;
    for(const r of spec.routeProfiles){const s=routeSample(r,x,z),d=routeFootprintDistance(r,x,z,s),blend=r.bankBlend??.5;if(d<blend)bedding=Math.max(bedding,.02+(routeBedding(r,x,z)-.02)*(1-smoothstep(d/blend)));}
    for(const p of [...spec.finishPads,...spec.protectedPads.filter(p=>p.finish!==undefined)]){const d=rectDistance(p,x,z);if(d<.3)bedding=(p.finish-p.level)+(bedding-p.finish+p.level)*smoothstep(d/.3);}
    return bedding;
  }
  const gradeEnvelope=(value,level,slope,distance)=>Math.max(level-slope*distance,Math.min(level+slope*distance,value));
  function drawingHeight(spec,x,z,skipBank=false) {
    let h=naturalHeight(spec,x,z);
    const apply=(p,level)=>{const d=rectDistance(p,x,z);if(p.gradingMode==='blend'){if(d<p.blend)h=level+(h-level)*smoothstep(d/p.blend);}else h=gradeEnvelope(h,level,p.bankSlope??.4,d);};
    for(const p of spec.drawingGrades){const dx=Math.max(0,Math.min(p.x1-p.x0,x-p.x0));let level=p.level+(p.fallX??0)*dx;if(p.southLevel!==undefined)level+=(p.southLevel+(p.southFallX??0)*dx-level)*Math.max(0,Math.min(1,(z-p.z0)/(p.z1-p.z0)));apply(p,level);}
    if(spec.drivewayProfile){const p=spec.drivewayProfile,d=polygonDistance(p.points,x,z);h=gradeEnvelope(h,drivewayFinish(spec,x,z)-p.surfaceOffset,.4,d);}
    for(const p of spec.gatheringPads??[]){const d=p.radius===undefined?rectDistance(p,x,z):Math.max(0,Math.hypot(x-p.cx,z-p.cz)-p.radius);h=gradeEnvelope(h,p.level,.4,d);}
    for(const p of spec.protectedPads??[])apply(p,p.level+(p.fallX??0)*Math.max(0,Math.min(p.x1-p.x0,x-p.x0)),p.blend??1);
    for(const p of spec.finishPads)apply(p,p.level,p.blend);
    for(const strip of [...spec.drainageStrips.slice(1),spec.drainageStrips[0]]){const d=rectDistance(strip,x,z),slope=.4+.8*(1-smoothstep(Math.max(0,z-(spec.westBank.endZ??spec.westPlatform.z1))/2))*(1-smoothstep((x-strip.x0)/.5));h=gradeEnvelope(h,drainageLevel(strip,x,z),slope,d);}
    const bedding=routeSurfaceBedding(spec,x,z);
    for(const r of spec.routeProfiles){const s=routeSample(r,x,z),d=routeFootprintDistance(r,x,z,s);h=gradeEnvelope(h,s.level-bedding,r.bankSlope??.4,d);}
    for(const p of spec.finishPads){const d=rectDistance(p,x,z);if(d<.25)h=Math.min(h,p.level+(h-p.level)*smoothstep(d/.25));}
    for(const p of spec.gatheringPads??[]){if(p.radius===undefined)apply(p,p.level,.3);}
    for(const strip of spec.drainageStrips){const d=rectDistance(strip,x,z);if(d<.2){let clear=minRectDistance(spec.finishPads,x,z);for(const route of spec.routeProfiles){const sample=routeSample(route,x,z);clear=Math.min(clear,Math.max(0,sample.distance-route.width/2));}h+=(drainageLevel(strip,x,z)-h)*(1-smoothstep(d/.2))*smoothstep(clear/.5);}}
    for(const p of spec.protectedPads.filter(p=>['north-facade','south-facade','heat-pump-service'].includes(p.id)).sort((a,b)=>(a.id==='heat-pump-service')-(b.id==='heat-pump-service'))){const d=rectDistance(p,x,z);if(d<p.blend){const level=p.level+(p.fallX??0)*Math.max(0,Math.min(p.x1-p.x0,x-p.x0));h+=(gradeEnvelope(h,level,p.bankSlope??.4,d)-h)*(1-smoothstep(d/p.blend));}}
    const pond=spec.pond,r=Math.hypot((x-pond.cx)/pond.rx,(z-pond.cz)/pond.rz);
    if(r<1)h=Math.min(h,pond.edge-pond.depth*.5*(1+Math.cos(r*Math.PI)));
    else if(r<1.5)h=Math.min(h,pond.edge+(h-pond.edge)*smoothstep((r-1)/.5));
    if(spec.benchPad){const p=spec.benchPad,d=Math.hypot(Math.max(p.x0-x,0,x-p.x1)/p.blend,Math.max(p.z0-z,0)/p.blend,Math.max(z-p.z1,0)/p.southBlend);if(d<1)h=p.level+(h-p.level)*smoothstep(d);}
    if(spec.houseExcavation){const p=spec.houseExcavation,d=polygonDistance(p.points,x,z);if(d<p.blend)h=Math.min(h,p.level+(h-p.level)*smoothstep(d/p.blend));}
    if(spec.drivewayProfile){const p=spec.drivewayProfile,d=polygonDistance(p.points,x,z),level=drivewayFinish(spec,x,z)-p.surfaceOffset;h=Math.min(h,gradeEnvelope(h,level,.4,d));}
    const c=spec.carportSurface;if(c)apply(c,c.finishNorth+(c.finishSouth-c.finishNorth)*Math.max(0,Math.min(1,(z-c.z0)/(c.z1-c.z0)))-.04,.3);
    for(const p of [spec.gateRunback,spec.wicketLanding].filter(Boolean)){const d=polygonDistance(p.points,x,z);if(d<p.blend)h=p.level+(h-p.level)*smoothstep(d/p.blend);}
    const west=spec.westPlatform;
    const endBlend=(1-smoothstep(Math.max(west.z0-z,0,z-(spec.westBank.endZ??west.z1))/1.5));
    if(!skipBank&&x>=west.x1&&x<west.x1+spec.westBank.width){const bank=spec.westBank,foot=drawingHeight(spec,west.x1+bank.width,z,true),crest=drawingHeight(spec,west.x1,z,true),target=crest+(foot-crest)*(x-west.x1)/bank.width;h+=(target-h)*endBlend;}
    if(skipBank)return h;
    let fenceWeight=0,fenceLevel=0,fenceDistance=1;
    for(const segment of spec.fixedFences?.segments??[]){const a=segment.start,b=segment.end,dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz))),bx=a[0]+dx*t,bz=a[1]+dz*t,d=Math.hypot(x-bx,z-bz),width=Math.max(.1,Math.min(spec.boundaryBankWidth,minRectDistance(spec.boundaryGradePads??[spec.westPlatform],bx,bz)));if(d<1e-9)return naturalHeight(spec,x,z);if(d<width){const w=(1-d/width)/(d*d);fenceLevel+=naturalHeight(spec,bx,bz)*w;fenceWeight+=w;fenceDistance=Math.min(fenceDistance,d/width);}}
    if(fenceWeight)h=fenceLevel/fenceWeight+(h-fenceLevel/fenceWeight)*fenceDistance;
    return h;
  }
  function routeHeight(spec,x,z) {
    const bedding=routeSurfaceBedding(spec,x,z);
    let h=height(spec,x,z)+bedding;
    for(const r of spec.routeProfiles){const sample=routeSample(r,x,z),d=routeFootprintDistance(r,x,z,sample);h=Math.max(h,sample.level-(r.bankSlope??.4)*d);}
    const pads=[...spec.finishPads,...spec.protectedPads.filter(p=>p.finish!==undefined),...spec.gatheringPads.filter(p=>p.radius===undefined).map(p=>({...p,finish:p.level+.1}))];
    for(const p of pads){const d=rectDistance(p,x,z);if(d<.6)h=Math.max(h,p.finish+(h-p.finish)*smoothstep(d/.6));}
    for(const p of spec.crossingPads??[]){const d=rectDistance(p,x,z);if(d<p.blend)h=Math.max(height(spec,x,z)+.02,p.finish+(h-p.finish)*smoothstep(d/p.blend));}
    return h;
  }

  function height(spec, x, z) {
    if(spec.drawingGrades)return drawingHeight(spec,x,z);
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
        const bx=a[0]+t*dx,bz=a[1]+t*dz,distance=Math.hypot(x-bx,z-bz),level=segmentLevel(spec,a,a,dx,dz,t);
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
      const p=spec.houseExcavation;
      if(rectDistance(polygonBounds(p.points),x,z)<p.blend){const distance=polygonDistance(p.points,x,z);
      if(distance<p.blend) h=Math.min(h,p.level+(h-p.level)*smoothstep(distance/p.blend));}
    }
    if (spec.drivewayProfile) {
      const p=spec.drivewayProfile,distance=Math.max(0,polygonDistance(p.points,x,z)-p.edgeMargin);
      if(distance<p.blend || spec.regionalGrades) {
        const level=p.startLevel+(p.gateLevel-p.startLevel)*smoothstep((x-p.startX)/(p.gate[0]-p.startX));
        h=spec.regionalGrades?Math.max(level-.4*distance,Math.min(level+.4*distance,h)):level+(h-level)*smoothstep(distance/p.blend);
      }
    }
    if (spec.finishPads?.length) {
      let distance = Infinity, metres = Infinity;
      for (const p of spec.finishPads) { const d = rectDistance(p, x, z); distance = Math.min(distance, d / p.blend); metres = Math.min(metres, d); }
      const level = spec.finishedSoil - (spec.regionalGrades ? .18 * smoothstep((z - 5.7) / 1.48) * (1 - smoothstep((x - 14.93) / 3)) : 0);
      if (spec.regionalGrades) {
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
    if(!spec.regionalGrades)for(const route of spec.routeProfiles??[]) {
      if(!route.bankApron)continue;
      if(route.bankBounds&&rectDistance(route.bankBounds,x,z)>0)continue;
      const sample=routeSample(route,x,z,true),distance=Math.max(0,sample.distance-route.width/2);
      let clear=Math.min(minRectDistance(spec.finishPads??[],x,z),minRectDistance(spec.protectedPads??[],x,z),spec.houseExcavation?polygonDistance(spec.houseExcavation.points,x,z):Infinity);
      for(const s of gatheringSamples)clear=Math.min(clear,s.d);
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
        const clear=route.approachBank?minRectDistance(spec.finishPads??[],x,z):Infinity;
        h+=(target-h)*smoothstep(clear/.3);
      }
      else if(distance<blend) {
        let clear=Infinity;
        if(route.approachBank){clear=Math.min(minRectDistance(spec.finishPads??[],x,z),minRectDistance(spec.protectedPads??[],x,z));for(const s of gatheringSamples)clear=Math.min(clear,s.d);}
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
    if(spec.gateRunback&&rectDistance(polygonBounds(spec.gateRunback.points),x,z)<spec.gateRunback.blend){const p=spec.gateRunback,d=polygonDistance(p.points,x,z);if(d<p.blend)h=p.level+(h-p.level)*smoothstep(d/p.blend);}
    if(spec.wicketLanding&&rectDistance(polygonBounds(spec.wicketLanding.points),x,z)<spec.wicketLanding.blend){const p=spec.wicketLanding,d=Math.hypot(polygonDistance(p.points,x,z),polygonDistance(p.boundary,x,z));if(d<p.blend)h=p.level+(h-p.level)*smoothstep(d/p.blend);}
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
      const bx=a[0]+t*dx,bz=a[1]+t*dz,d=Math.hypot(x-bx,z-bz),level=segmentLevel(spec,segment,a,dx,dz,t);
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
      spec.saunaFinish=garden.gradingPlan?options.houseFFL+garden.gradingPlan.westPlatform.bpv-397:options.houseFFL;
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
        {id:'north-fall',x0:10.48,z0:6.18,x1:21.28,z1:7.18,level:options.houseFFL-.15,fallX:-.45/10.8,blend:2.5},
        {id:'south-fall',x0:10.48,z0:26.43,x1:21.28,z1:27.43,level:options.houseFFL-.15,fallX:-.40/10.8,blend:3},
      ];
      spec.drainageStrips=garden.elements.filter(e=>e.id==='westDrainageStrip').flatMap(e=>e.parts.filter(p=>p.kind==='rect').map(p=>({...patchRect(p),...p.grading,level:options.houseFFL+(p.grading?.relativeLevel??e.meta.grading.relativeLevel)})));
      spec.crossingPads=(garden.elements.find(e=>e.id==='westDrainageStrip')?.meta.grading.coveredCrossings??[]).filter(p=>p.surfaceReference).map(p=>({...patchRect(p),finish:options.houseFFL,blend:.3}));
      spec.bankReview = [
        {id:'productive-west',label:'Užitková zahrada a západní průleh',bounds:[0,10.48,7,23],status:'Čtyři záhony ve dvou řadách blíže západní hranici, 0,40 m nad západní terasou; plynulé spojení se skleníkem a saunou.'},
        {id:'south-house',label:'Jižní svah a servisní plocha',bounds:[8.3,22,26.43,31],status:'Plynulý spád od západu k východu; rovná odbočka k tepelnému čerpadlu. Ověřit povrchový odtok.'},
        {id:'north-fill',label:'Severní a východní dosypání',bounds:[24,43,0,19],status:'Dosypání s volnými svahy do stávajících hranic. Únosnost sousední zdi není započtena; konečný sklon ověřit podle zeminy.'},
      ];
      spec.finishPads = garden.elements.filter(e => ['eastTerrace', 'westTerrace', 'sauna', 'saunaShelter', 'saunaPath'].includes(e.id))
        .flatMap(e => e.parts.filter(p => p.kind === 'rect'&&(e.id!=='saunaPath'||p.role==='saunaLanding')).map(p => ({
          id:e.id,bankSlope:e.id==='eastTerrace'?.48:e.id==='westTerrace'?.45:.4,finish:['sauna','saunaShelter','saunaPath'].includes(e.id)?spec.saunaFinish:options.houseFFL,level:(['sauna','saunaShelter','saunaPath'].includes(e.id)?spec.saunaFinish:options.houseFFL)-.12,
          x0: p.x, z0: p.y, x1: p.x + p.w, z1: p.y + p.d, blend: e.id==='eastTerrace'?1:.5,
        })));
      spec.protectedPads = [{ ...patchRect(groundPatches.garage), bankSlope: .4 }];
      const greenhouse=patchRect(groundPatches.greenhouse),beds=patchRect(groundPatches.raisedBeds);
      spec.productiveCourt={...beds,mode:'level',finish:groundPatches.raisedBeds.level+.06,greenhouseFinish:groundPatches.greenhouse.level+.04,aisles:[],greenhouse};
      spec.protectedPads.push(...[groundPatches.greenhouse,groundPatches.raisedBeds].map(p=>({...patchRect(p),finish:spec.saunaFinish,gradingMode:'blend',blend:.3,bankSlope:p.bankSlope??.4})));
      const service=garden.elements.find(e=>e.id==='heatPumpService')?.parts.find(p=>p.kind==='rect');
      spec.southGravel={x0:10.48,x1:21.28,startDepth:.07,endDepth:.04,service:service?patchRect(service):null,serviceBlend:.15};
      spec.protectedPads.push({id:'south-facade',x0:10.48,z0:26.43,x1:21.28,z1:27.45,level:options.houseFFL-.15,fallX:-.40/10.8,blend:1,bankSlope:.4});
      if(service)spec.protectedPads.push({...patchRect({...service,level:options.houseFFL-.55}),id:'heat-pump-service',blend:1.2,bankSlope:.4});
      spec.protectedPads.push({id:'north-facade',x0:10.48,z0:6.43,x1:21.28,z1:7.18,level:options.houseFFL-.15,fallX:-.45/10.8,blend:1,bankSlope:.4});
      const fireElement=garden.elements.find(e=>e.id==='firePit');
      const fire=fireElement.parts.find(p=>p.kind==='circle');
      const gathering=groundPatches.pergola;
      if(spec.fixedFences&&gathering.fenceBankSlope)spec.fixedFences.levelPads=[{...patchRect(gathering),bankSlope:gathering.fenceBankSlope}];
      const fireLevel=fireElement.meta?.grading?.level??gathering.level;
      const fireFinished=fireLevel+(fireElement.meta?.grading?.surfaceOffset??0)+.008;
      spec.pond.northBankOuter=Math.max(1.3,(pond.cz-fire.cy-fire.r)/pond.rz);
      spec.pond.bankOuter=3;
      spec.pond.edge=garden.gradingPlan?options.houseFFL+garden.gradingPlan.mainLawnBpv-397:groundPatches.garage.level;
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
      const pondApproach=pondWalk?{...pondWalk,id:'Pond approach',points:pondWalk.points.slice(pondWalk.approachStart)}:null;
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
        const start = Number.isFinite(route.startRelativeLevel) ? options.houseFFL+route.startRelativeLevel : id === 'Productive access' ? spec.saunaFinish : bedFinish;
        const lengths = [0];
        for (let i = 1; i < route.points.length; i++) lengths.push(lengths[i-1] + Math.hypot(route.points[i][0]-route.points[i-1][0], route.points[i][1]-route.points[i-1][1]));
        spec.routeProfiles.push({...route,bedding:id==='Greenhouse access'?.04:.06,bankBlend:.3,...(id==='Greenhouse access'?{pavingRects:[{x0:(greenhouse.x0+greenhouse.x1)/2-.57,x1:(greenhouse.x0+greenhouse.x1)/2+.57,z0:greenhouse.z0-(garden.elements.find(e=>e.id==='greenhouse').meta?.entrancePadDepth??.38),z1:greenhouse.z0}]}:{}),levels:lengths.map((distance,i)=>start+(end-start)*(route.levelFractions?.[i]??Math.min(1,distance/(id==='Productive access'?lengths.at(-2):lengths.at(-1))))) });
      }
      const wellness=(garden.gardenRoutes??[]).find(r=>r.id==='Wellness access');
      if(wellness){const corner=wellness.points[1],landing=[7.3,corner[1]];spec.routeProfiles.push({...wellness,points:[wellness.points[0],corner,landing,wellness.points.at(-1)],levels:[options.houseFFL,options.houseFFL+.2,spec.saunaFinish,spec.saunaFinish],bedding:.12,bankBlend:.5,pavingRects:garden.elements.find(e=>e.id==='saunaPath').parts.filter(p=>p.kind==='rect'&&p.role!=='saunaLanding').map(patchRect)});}
      const driveway = garden.elements.find(e => e.id === 'driveway').parts.find(p => p.kind === 'polygon');
      const gateLine = garden.elements.find(e => e.id === 'gate').parts.find(p => p.kind === 'line');
      const gate = [(gateLine.x1 + gateLine.x2) / 2, (gateLine.y1 + gateLine.y2) / 2];
      spec.drivewayProfile = { points: driveway.points.map(p => p.slice()), startX: groundPatches.garage.x + groundPatches.garage.w,
        startLevel: groundPatches.garage.level, gate, gateLevel: naturalHeight(spec, ...gate) - .04, surfaceOffset: .04, edgeMargin: .15, blend: 1, apronNorth:options.houseFFL-.52,apronSouth:options.houseFFL-.55,apronZ0:26.43,apronZ1:30.43,requestedSlope:.056 };
      const waterSource=garden.elements.find(e=>e.id==='waterSource')?.parts.find(p=>p.kind==='circle');
      if(waterSource)spec.drivewayApron={id:'water-source-approach',x0:spec.drivewayProfile.startX,z0:waterSource.cy-2.45,x1:waterSource.cx+1.25,z1:27.89,bankSlope:.4};
      const gateLength=Math.hypot(gateLine.x2-gateLine.x1,gateLine.y2-gateLine.y1);
      const direction=[(gateLine.x2-gateLine.x1)/gateLength,(gateLine.y2-gateLine.y1)/gateLength],start=[gateLine.x1,gateLine.y1];
      const gatePoint=(t,inset)=>[start[0]+direction[0]*t-direction[1]*inset,start[1]+direction[1]*t+direction[0]*inset];
      spec.gateRunback={start,direction,from:-5.8,to:.2,inset:0,width:.8,level:spec.drivewayProfile.gateLevel,blend:.4,
        finishedLevel:spec.drivewayProfile.gateLevel+spec.drivewayProfile.surfaceOffset,
        points:[gatePoint(-5.8,0),gatePoint(.2,0),gatePoint(.2,.8),gatePoint(-5.8,.8)]};
      for(const fence of options.fixedFences??[]){
        const [a,b]=[fence.start,fence.end],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
        const local=p=>[(p[0]-start[0])*direction[0]+(p[1]-start[1])*direction[1],-(p[0]-start[0])*direction[1]+(p[1]-start[1])*direction[0]];
        const [p,q]=[local(a),local(b)];
        if(length<1||Math.abs((dx*direction[0]+dz*direction[1])/length)<.9||Math.max(p[0],q[0])<-5.8||Math.min(p[0],q[0])>.2||Math.min(Math.abs(p[1]),Math.abs(q[1]))>2)continue;
        const center=gatePoint(-2,2),sign=Math.sign(dx*(center[1]-a[1])-dz*(center[0]-a[0]));
        const side=p=>sign*(dx*(p[1]-a[1])-dz*(p[0]-a[0]))/length-.06;
        const clipped=[],points=spec.gateRunback.points;
        for(let i=0;i<points.length;i++){
          const p=points[i],q=points[(i+1)%points.length],dp=side(p),dq=side(q);
          if(dp>=0)clipped.push(p);
          if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);clipped.push(p.map((v,j)=>v+(q[j]-v)*t));}
        }
        spec.gateRunback.points=clipped;
      }
      spec.wicketLanding={start,direction,from:4.02,to:5.30,inset:0,width:1.20,level:spec.drivewayProfile.gateLevel,blend:.3,
        finishedLevel:spec.gateRunback.finishedLevel,boundary:garden.plot.vertices.map(p=>p.slice()),
        points:[gatePoint(4.02,0),gatePoint(5.30,0),gatePoint(5.30,1.20),gatePoint(4.02,1.20)]};
      spec.drivewayProfile.centerlineStart=[spec.drivewayProfile.startX,28.43];
      spec.drivewayProfile.horizontalRun=Math.hypot(gate[0]-spec.drivewayProfile.startX,gate[1]-28.43);
      spec.drivewayProfile.actualSlope=(drivewayFinish(spec,...spec.drivewayProfile.centerlineStart)-spec.drivewayProfile.gateLevel-.04)/spec.drivewayProfile.horizontalRun;
      spec.carportSurface={x0:21.28,x1:27.63,z0:19.4,z1:26.45,finishNorth:options.houseFFL-.51,finishSouth:options.houseFFL-.52};
      if(garden.gradingPlan){
      const plan=garden.gradingPlan,platform=plan.westPlatform;
      spec.boundaryBankWidth=plan.northBankWidth;
      spec.westBank={width:plan.westBank.width,footNorth:options.houseFFL+plan.westBank.northFootBpv-397,footSouth:options.houseFFL+plan.westBank.southFootBpv-397,fallZ0:7.18,fallZ1:platform.y+platform.d};
      spec.westPlatform={id:'west-platform',x0:platform.x,x1:platform.x+platform.w,z0:platform.y,z1:platform.y+platform.d,level:options.houseFFL+platform.bpv-397,blend:.7};
      const counterfall=plan.westCounterfall,westEnd=spec.westPlatform.z1,westLow=options.houseFFL+counterfall.westBpv-397,counterfallSlope=(counterfall.eastBpv-counterfall.westBpv)/platform.w;
      const apron=garden.elements.find(e=>e.id==='driveway').meta.apron,southStrip=plan.southApronStrip;
      spec.westBank.endZ=westEnd+counterfall.transitionDepth+counterfall.stripDepth;
      spec.drawingGrades=[
        {id:'main-lawn',x0:10.48,x1:35,z0:1.6,z1:26.43,level:options.houseFFL+plan.mainLawnBpv-397,blend:2},
        {id:'east-fall',x0:35,x1:40,z0:1.6,z1:19.38,level:options.houseFFL+plan.mainLawnBpv-397,fallX:(plan.eastStripBpv-plan.mainLawnBpv)/5,blend:2},
        {id:'south-apron-strip',x0:apron.x,x1:apron.x+apron.w,z0:apron.y+apron.d,z1:apron.y+apron.d+southStrip.depth,level:spec.drivewayProfile.apronSouth-spec.drivewayProfile.surfaceOffset,southLevel:options.houseFFL+southStrip.westBpv-397,southFallX:(southStrip.eastBpv-southStrip.westBpv)/apron.w},
        spec.westPlatform,
        {id:'west-counterfall-transition',x0:platform.x,x1:platform.x+platform.w,z0:westEnd,z1:westEnd+counterfall.transitionDepth,level:spec.westPlatform.level,southLevel:westLow,southFallX:counterfallSlope},
        {id:'west-counterfall-strip',x0:platform.x,x1:platform.x+platform.w,z0:westEnd+counterfall.transitionDepth,z1:westEnd+counterfall.transitionDepth+counterfall.stripDepth,level:westLow,fallX:counterfallSlope},
        ...spec.protectedPads.filter(p=>['north-facade','south-facade'].includes(p.id)),
      ];
      spec.boundaryGradePads=spec.drawingGrades.filter(p=>p.id.startsWith('west-'));
      }
      const pondProfile=spec.routeProfiles.find(r=>r.id==='Pond approach');
      if(pondProfile&&spec.drawingGrades){
        const priorStart=pondProfile.levels[0],end=pondProfile.levels.at(-1);
        const start=height({...spec,routeProfiles:spec.routeProfiles.filter(r=>r!==pondProfile)},...pondProfile.points[0])+.02;
        pondProfile.levels=pondProfile.levels.map(level=>start+(end-start)*(level-priorStart)/(end-priorStart));
        delete pondProfile.levelAxis;
      }
      spec.gradingStatus='September 2026 C.4 grading with retained garden features and fixed survey fence levels';
      spec.bankReview[0].status='Platform 397.50 m; east bank descends 0.60 m over 0.50 m. Stability and drainage require engineering review.';
      addBenchPad();
      return { spec, height: (x, z) => height(spec, x, z), routeHeight:(x,z)=>routeHeight(spec,x,z), baseHeight: (x, z) => naturalHeight(spec, x, z) };
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
  return { create, height, routeHeight, drivewayFinish, productiveFinish, southGravelDepth };
})();
if (typeof module !== 'undefined') module.exports = { SiteTerrain };
