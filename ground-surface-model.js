export const GroundSurfaceModel = {
  create(THREE, { garden, clearances, grassTexture }) {
    const size = 2048;
    const xs = garden.plot.vertices.map(p => p[0]), zs = garden.plot.vertices.map(p => p[1]);
    const x0 = Math.min(...xs), z0 = Math.min(...zs);
    const width = Math.max(...xs) - x0, depth = Math.max(...zs) - z0;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const px = x => (x - x0) / width * size, pz = z => (z - z0) / depth * size;
    const polygon = points => {
      ctx.moveTo(px(points[0][0]), pz(points[0][1]));
      for (const [x, z] of points.slice(1)) ctx.lineTo(px(x), pz(z));
      ctx.closePath();
    };
    function outline(part, rounded = false) {
      if (part.kind === 'ellipse') {
        ctx.moveTo(px(part.cx + part.rx), pz(part.cy));
        ctx.ellipse(px(part.cx), pz(part.cy), part.rx / width * size, part.ry / depth * size, 0, 0, Math.PI * 2);
        return;
      }
      const points = part.kind === 'rect' ? [[part.x, part.y], [part.x + part.w, part.y],
        [part.x + part.w, part.y + part.d], [part.x, part.y + part.d]] : part.points;
      if (!rounded) { polygon(points); return; }
      for (let i = 0; i < points.length; i++) {
        const p = points[i], before = points[(i + points.length - 1) % points.length], after = points[(i + 1) % points.length];
        const a = Math.hypot(before[0] - p[0], before[1] - p[1]), b = Math.hypot(after[0] - p[0], after[1] - p[1]);
        const radius = Math.min(.55, a * .24, b * .24);
        const start = [p[0] + (before[0] - p[0]) * radius / a, p[1] + (before[1] - p[1]) * radius / a];
        const end = [p[0] + (after[0] - p[0]) * radius / b, p[1] + (after[1] - p[1]) * radius / b];
        if (i === 0) ctx.moveTo(px(start[0]), pz(start[1]));
        else ctx.lineTo(px(start[0]), pz(start[1]));
        ctx.quadraticCurveTo(px(p[0]), pz(p[1]), px(end[0]), pz(end[1]));
      }
      ctx.closePath();
    }
    const surfaceParts = element => element.parts.filter(p => ['rect', 'polygon', 'ellipse'].includes(p.kind));
    const beds = garden.elements.filter(e => e.meta?.plant && e.meta.plant !== 'meadow').flatMap(surfaceParts);
    ctx.fillStyle = '#fff';
    for (const bed of beds) {
      ctx.save(); ctx.beginPath(); outline(bed); ctx.clip();
      ctx.beginPath(); outline(bed, true); ctx.fill(); ctx.restore();
    }
    const blurred = document.createElement('canvas');
    blurred.width = blurred.height = size;
    const blurCtx = blurred.getContext('2d');
    blurCtx.filter = `blur(${.035 / width * size}px)`;
    blurCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(blurred, 0, 0);
    // Feathering must stay inside the planned beds, plot and protected walking routes.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath(); for (const bed of beds) outline(bed); ctx.fill();
    ctx.beginPath(); polygon(garden.plot.vertices); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    for (const r of clearances) ctx.fillRect(px(r.x - .03), pz(r.y - .03), (r.w + .06) / width * size, (r.d + .06) / depth * size);
    for(const r of garden.gardenReserves ?? [])ctx.fillRect(px(r.x),pz(r.y),r.w/width*size,r.d/depth*size);
    ctx.save();ctx.translate(-x0/width*size,-z0/depth*size);ctx.scale(size/width,size/depth);
    ctx.lineCap=ctx.lineJoin='round';
    for(const route of garden.gardenRoutes ?? []) {
      ctx.beginPath();route.points.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z));ctx.lineWidth=route.width+.06;ctx.stroke();
    }
    ctx.restore();
    const hardscape = new Set(['house', 'garage', 'eastTerrace', 'westTerrace', 'sauna', 'saunaShelter', 'saunaPath', 'driveway', 'pond']);
    for (const el of garden.elements.filter(e => hardscape.has(e.id))) {
      for (const part of surfaceParts(el)) { ctx.beginPath(); outline(part); ctx.fill(); }
    }
    ctx.globalCompositeOperation = 'source-over';
    const pixels = ctx.getImageData(0, 0, size, size).data;
    const maskData = new Uint8Array(size * size);
    for (let i = 0; i < maskData.length; i++) maskData[i] = pixels[i * 4 + 3];
    const mask = new THREE.DataTexture(maskData, size, size, THREE.RedFormat);
    mask.minFilter = mask.magFilter = THREE.LinearFilter;
    mask.needsUpdate = true;
    let seed = 21937;
    const grainData = new Uint8Array(256 * 256);
    for (let i = 0; i < grainData.length; i++) {
      seed = Math.imul(seed, 1664525) + 1013904223 | 0;
      grainData[i] = 90 + (seed >>> 24) * .6;
    }
    const grain = new THREE.DataTexture(grainData, 256, 256, THREE.RedFormat);
    grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
    grain.minFilter = grain.magFilter = THREE.LinearFilter;
    grain.needsUpdate = true;
    const material = new THREE.MeshStandardMaterial({ color: 0xdfe6d8, map: grassTexture, roughness: 1 });
    material.onBeforeCompile = shader => {
      shader.uniforms.bedMask = { value: mask };
      shader.uniforms.soilGrain = { value: grain };
      shader.uniforms.groundBounds = { value: new THREE.Vector4(x0, z0, width, depth) };
      shader.uniforms.soilColor = { value: new THREE.Color('#766b55') };
      shader.vertexShader = 'varying vec2 vGroundXZ;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundXZ = position.xz;');
      shader.fragmentShader = 'uniform sampler2D bedMask;\nuniform sampler2D soilGrain;\nuniform vec4 groundBounds;\nuniform vec3 soilColor;\nvarying vec2 vGroundXZ;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float bedWeight = texture2D(bedMask, (vGroundXZ - groundBounds.xy) / groundBounds.zw).r;
        float grainValue = texture2D(soilGrain, vGroundXZ / .65).r;
        float soilVariation = .88 + .28 * grainValue + .035 * sin(vGroundXZ.x * 3.1) * sin(vGroundXZ.y * 2.4);
        diffuseColor.rgb = mix(diffuseColor.rgb, soilColor * soilVariation, bedWeight);
      `);
    };
    material.customProgramCacheKey = () => 'garden-ground-soil-blend';
    return { material, mask, soilAt(x, z) {
      const ix = Math.floor((x - x0) / width * size), iz = Math.floor((z - z0) / depth * size);
      return ix < 0 || ix >= size || iz < 0 || iz >= size ? 0 : maskData[iz * size + ix] / 255;
    } };
  },
};
