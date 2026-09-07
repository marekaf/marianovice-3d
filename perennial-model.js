const PerennialModel = (() => {
  const profiles = ['grass', 'daisy', 'spire', 'umbel', 'broadleaf'];
  function create(THREE, { profile = 'grass', height = .8, spread = .35, seed = 1, bloom = [6, 7, 8], color, winterInterest = true } = {}) {
    if (!profiles.includes(profile) || !(height > 0) || !(spread > 0) || !Number.isFinite(height + spread))
      throw new Error('Perennial form needs a known profile and positive finite dimensions');
    const root = new THREE.Group();
    root.name = `perennial-${profile}`;
    root.userData = { profile, plantingScale: .45, bloom: [...bloom], height, spread, winterInterest };
    let state = (Number(seed) || 1) >>> 0;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    const buffers = { stem: [], foliage: [], flower: [], seedhead: [] };
    const add = (part, ...points) => {
      for (const point of points) {
        const radius = Math.hypot(point[0], point[2]);
        const factor = radius > spread ? spread / radius : 1;
        buffers[part].push(point[0] * factor, Math.max(0, Math.min(height, point[1])), point[2] * factor);
      }
    };
    const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    function tube(a, b, radius, part = 'stem') {
      const direction = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize();
      const side = new THREE.Vector3().crossVectors(direction, Math.abs(direction.y) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
      const other = new THREE.Vector3().crossVectors(direction, side);
      const ring = (p, angle, r) => [p[0] + r * (side.x * Math.cos(angle) + other.x * Math.sin(angle)),
        p[1] + r * (side.y * Math.cos(angle) + other.y * Math.sin(angle)), p[2] + r * (side.z * Math.cos(angle) + other.z * Math.sin(angle))];
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5, next = (i + 1) * Math.PI * 2 / 5;
        const p = ring(a, angle, radius), q = ring(a, next, radius), r = ring(b, angle, radius * .65), s = ring(b, next, radius * .65);
        add(part, p, q, r, q, s, r);
      }
    }
    function leaf(base, angle, length, width, rise, part = 'foliage') {
      const strips = 4, previous = [];
      for (let i = 0; i <= strips; i++) {
        const t = i / strips, breadth = Math.sin(Math.PI * t) * width;
        const center = [base[0] + Math.cos(angle) * length * t,
          base[1] + rise * t + length * .18 * Math.sin(Math.PI * t), base[2] + Math.sin(angle) * length * t];
        const side = [-Math.sin(angle) * breadth, -breadth * .13, Math.cos(angle) * breadth];
        const left = center.map((v, j) => v + side[j]), right = center.map((v, j) => v - side[j]);
        if (i) add(part, previous[0], left, previous[1], left, right, previous[1]);
        previous[0] = left; previous[1] = right;
      }
    }
    function petals(center, radius, count, colorPart = 'flower') {
      for (let i = 0; i < count; i++) {
        const angle = i * Math.PI * 2 / count;
        const tip = [center[0] + Math.cos(angle) * radius, center[1] + radius * .12, center[2] + Math.sin(angle) * radius];
        const left = [center[0] + Math.cos(angle - .35) * radius * .65, center[1] + radius * .24, center[2] + Math.sin(angle - .35) * radius * .65];
        const right = [center[0] + Math.cos(angle + .35) * radius * .65, center[1] + radius * .24, center[2] + Math.sin(angle + .35) * radius * .65];
        add(colorPart, center, left, tip, center, tip, right);
      }
    }
    const basalLeaves = profile === 'grass' ? 64 : profile === 'broadleaf' ? 38 : 48;
    for (let i = 0; i < basalLeaves; i++) {
      const angle = i * 2.399963 + random() * .4;
      const radius = spread * Math.sqrt(random()) * .26;
      const base = [Math.cos(angle) * radius, height * random() * .12, Math.sin(angle) * radius];
      const grass = profile === 'grass';
      leaf(base, angle, spread * (.48 + random() * .38), spread * (grass ? .023 : profile === 'broadleaf' ? .2 : .115), height * (grass ? .24 + random() * .46 : .1 + random() * .23));
    }
    const stalks = profile === 'grass' ? 26 : profile === 'broadleaf' ? 16 : 24;
    for (let i = 0; i < stalks; i++) {
      const angle = i * 2.399963 + random() * .6, radial = Math.sqrt(random()) * spread * .42;
      const base = [Math.cos(angle) * radial, 0, Math.sin(angle) * radial];
      const stalkHeight = height * (.56 + random() * .36);
      const lean = spread * (.12 + random() * .22), tip = [base[0] + Math.cos(angle) * lean, stalkHeight, base[2] + Math.sin(angle) * lean];
      const stemRadius = Math.min(.005, height * .004);
      const bend = t => [base[0] + (tip[0] - base[0]) * t * t, stalkHeight * t, base[2] + (tip[2] - base[2]) * t * t];
      for (let j = 0; j < 3; j++) tube(bend(j / 3), bend((j + 1) / 3), stemRadius * (1 - j * .15));
      if (profile === 'grass') {
        leaf(base, angle, spread * (.5 + random() * .35), spread * .032, stalkHeight * .72);
        leaf(bend(.22), angle + .7, spread * .45, spread * .027, stalkHeight * .36);
        for (let j = 0; j < 7; j++) {
          const center = mix(bend(.79), tip, j / 7), reach = spread * .12 * (1 - j / 9);
          const end = [center[0] + Math.cos(angle + j * 2.4) * reach, center[1] + height * .025, center[2] + Math.sin(angle + j * 2.4) * reach];
          tube(center, end, stemRadius * .55, 'seedhead');
          petals(end, Math.min(spread * .025, height * .02), 3, 'seedhead');
        }
      } else if (profile === 'broadleaf') {
        leaf(bend(.23), angle, spread * (.55 + random() * .22), spread * .17, stalkHeight * .29);
        leaf(bend(.47), angle + 2.3, spread * .52, spread * .14, stalkHeight * .12);
        leaf(bend(.7), angle + .9, spread * .4, spread * .1, stalkHeight * .1);
        for (let j = 0; j < 3; j++) {
          const flower = [tip[0] + Math.cos(angle + j * 2.1) * spread * .12, tip[1] - j * height * .03, tip[2] + Math.sin(angle + j * 2.1) * spread * .12];
          petals(flower, Math.min(spread * .14, height * .07), 5);
        }
      } else {
        for (let j = 0; j < 6; j++) leaf(bend(.12 + j * .09), angle + j * 2.4, spread * .5, spread * .095, height * .06);
        if (profile === 'daisy') {
          petals(tip, Math.min(spread * .24, height * .12), 12);
          petals([tip[0], tip[1] + .003, tip[2]], Math.min(spread * .08, height * .035), 8, 'seedhead');
        } else if (profile === 'spire') {
          for (let j = 0; j < 13; j++) {
            const center = mix(bend(.6), tip, j / 13), radius = spread * .115 * (1 - j * .055);
            petals(center, radius, 7);
            petals(center, radius * .38, 3, 'seedhead');
          }
        } else {
          for (let j = 0; j < 10; j++) {
            const a = j * Math.PI * 2 / 10, radius = spread * .19;
            const end = [tip[0] + Math.cos(a) * radius, Math.min(height * .97, tip[1] + height * .035), tip[2] + Math.sin(a) * radius];
            tube(tip, end, stemRadius * .7);
            petals(end, Math.min(spread * .12, height * .06), 6);
            petals(end, Math.min(spread * .025, height * .01), 3, 'seedhead');
          }
        }
      }
    }
    const flowerColor = color ?? { daisy: '#e2c97a', spire: '#8c78a3', umbel: '#ddd8c8', grass: '#bbb080', broadleaf: '#c7ccb0' }[profile];
    const colors = { stem: '#6c7950', foliage: profile === 'grass' ? '#80916c' : '#627c57', flower: flowerColor, seedhead: '#8c7049' };
    for (const [part, positions] of Object.entries(buffers)) {
      if (!positions.length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const shades = [];
      for (let i = 0; i < positions.length; i += 9) {
        const shade = .78 + random() * .22;
        for (let j = 0; j < 3; j++) shades.push(shade, shade, shade);
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(shades, 3));
      geometry.computeVertexNormals(); geometry.computeBoundingSphere();
      const material = new THREE.MeshStandardMaterial({ color: colors[part], roughness: .95, side: THREE.DoubleSide, vertexColors: true });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `${profile}-${part}`;
      mesh.userData.plantPart = part;
      mesh.userData.summerColor = colors[part];
      mesh.castShadow = part === 'foliage' || part === 'stem';
      mesh.receiveShadow = true;
      root.add(mesh);
    }
    update(root, 7);
    return root;
  }
  function update(root, month) {
    const winter = month <= 3 || month >= 11;
    const blooming = root.userData.bloom.includes(month);
    const dry = winter || month === 10;
    const cut = month === 3 && !blooming;
    for (const mesh of root.children) {
      const part = mesh.userData.plantPart;
      mesh.scale.y = cut ? .12 : 1;
      mesh.visible = part === 'flower' ? blooming : part === 'seedhead'
        ? (root.userData.winterInterest && dry && !cut) || (root.userData.profile === 'daisy' && blooming) : true;
      if (part === 'foliage') {
        mesh.material.color.set(dry && !blooming ? '#9a8969' : mesh.userData.summerColor);
        mesh.visible = !winter || root.userData.profile === 'grass' || blooming;
      } else if (part === 'stem') {
        mesh.material.color.set(dry && !blooming ? '#918163' : mesh.userData.summerColor);
        if (winter && !blooming && (root.userData.profile === 'broadleaf' || !root.userData.winterInterest)) mesh.scale.y = cut ? .12 : .15;
      }
    }
    root.userData.month = month;
    return root;
  }
  return { create, update };
})();
if (typeof module !== 'undefined') module.exports = { PerennialModel };
