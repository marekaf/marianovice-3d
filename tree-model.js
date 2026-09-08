const TreeModel = (() => {
  const caches = new WeakMap();
  function variation(x, z) {
    let value = Math.imul(Math.round(x * 1000), 73856093) ^ Math.imul(Math.round(z * 1000), 19349663);
    value = Math.imul(value ^ value >>> 16, 2246822507);
    return ((value ^ value >>> 13) >>> 0) / 4294967296;
  }
  function resources(THREE) {
    if (caches.has(THREE)) return caches.get(THREE);
    const outlines = {
      orchard: [[0,-1],[-.3,-.55],[-.48,0],[-.36,.55],[0,1],[.36,.55],[.48,0],[.3,-.55]],
      slender: [[0,-1],[-.2,-.55],[-.62,.05],[-.45,.4],[-.12,.85],[0,1],[.12,.85],[.45,.4],[.62,.05],[.2,-.55]],
      broad: [[0,-1],[-.12,-.4],[-.72,-.45],[-.48,-.08],[-1,.12],[-.62,.25],[-.75,.65],[-.28,.48],[0,1],[.28,.48],[.75,.65],[.62,.25],[1,.12],[.48,-.08],[.72,-.45],[.12,-.4]],
      multistem: [[0,-1],[-.27,-.7],[-.42,-.1],[-.3,.55],[0,1],[.3,.55],[.42,-.1],[.27,-.7]],
    };
    const leaves = {};
    for (const [name, outline] of Object.entries(outlines)) {
      const leaf = new THREE.BufferGeometry(), n = outline.length;
      leaf.setAttribute('position', new THREE.Float32BufferAttribute([...outline.map(([x,y])=>[x,y,0]),[0,0,.12]].flat(),3));
      leaf.setIndex(Array.from({length:n},(_,i)=>[n,i,(i+1)%n]).flat());
      leaf.computeVertexNormals(); leaves[name]=leaf;
    }
    const needles = [], needleIndex = [];
    for(let i=0;i<12;i++) {
      const y=-.6+i*.1,side=i%2?-1:1,start=needles.length/3;
      needles.push(0,y,0,side*.025,y+.035,.02,side*(.48+Math.sin(i)*.12),y+.48,.09);
      needleIndex.push(start,start+1,start+2);
    }
    leaves.evergreen=new THREE.BufferGeometry();
    leaves.evergreen.setAttribute('position',new THREE.Float32BufferAttribute(needles,3));
    leaves.evergreen.setIndex(needleIndex); leaves.evergreen.computeVertexNormals();
    const value = {
      leaves,
      leafMaterial: new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.88 }),
      barkMaterial: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98 }),
    };
    caches.set(THREE, value);
    return value;
  }
  function create(THREE, { x, z, groundY, height, color = 0x4f783d, leafHabit = 'deciduous', form, overlapsStructureAccess = () => false }) {
    let state = Math.imul(Math.round(x * 1000), 73856093) ^ Math.imul(Math.round(z * 1000), 19349663);
    const random = () => { state = Math.imul(state, 1664525) + 1013904223 | 0; return (state >>> 0) / 4294967296; };
    form ||= leafHabit === 'evergreen' ? 'evergreen' : ['multistem', 'slender', 'broad'][Math.floor(random() * 3)];
    const shared = resources(THREE);
    const tree = new THREE.Group();
    tree.name = 'Woody tree';
    tree.position.set(x, groundY, z);
    tree.userData.leafHabit = leafHabit;
    tree.userData.treeForm = form;
    tree.userData.treeLabel = { orchard:'Orchard tree', slender:'Birch form', broad:'Maple form', multistem:'Multi-stem serviceberry form', evergreen:'Pine form' }[form];
    tree.userData.plantingScale = Math.min(0.72, Math.max(0.25, 1.8 / height));
    const radius = height * ({orchard:.42,slender:.23,broad:.44,multistem:.30,evergreen:.32}[form]);
    const positions = [], colors = [], indices = [], leafPositions = [];
    const barkColor = new THREE.Color(form === 'slender' ? '#dedbd0' : form === 'evergreen' ? '#816b56' : '#716049');
    const up = new THREE.Vector3(0, 1, 0);
    const reference = new THREE.Vector3(1, 0, 0);
    const clear = (point, width = 0.03) => !overlapsStructureAccess(x + point.x, z + point.z, width);
    function branch(a, b, baseRadius, tipRadius) {
      const direction = b.clone().sub(a);
      if (direction.lengthSq() < 1e-10) return false;
      if ([0, 0.25, 0.5, 0.75, 1].some(t => !clear(a.clone().lerp(b, t), baseRadius))) return false;
      direction.normalize();
      const u = direction.clone().cross(Math.abs(direction.y) > 0.9 ? reference : up).normalize();
      const v = direction.clone().cross(u).normalize();
      const start = positions.length / 3, segments = 7;
      for (const [center, r] of [[a, baseRadius], [b, tipRadius]]) for (let i = 0; i < segments; i++) {
        const angle = i * Math.PI * 2 / segments;
        const point = center.clone().addScaledVector(u, Math.cos(angle) * r).addScaledVector(v, Math.sin(angle) * r);
        positions.push(point.x, Math.max(0, point.y), point.z);
        const marked = form === 'slender' && baseRadius > height * .008 && Math.floor(point.y / height * 52) % 7 === 0 && i % 3 !== 0;
        const shade = barkColor.clone().multiplyScalar(marked ? .32 : .85 + random() * .24);
        colors.push(shade.r, shade.g, shade.b);
      }
      for (let i = 0; i < segments; i++) {
        const a = start + i, b = start + (i + 1) % segments;
        indices.push(a, b, b + segments, a, b + segments, a + segments);
      }
      for (let i = 1; i < segments - 1; i++) indices.push(start, start + i + 1, start + i,
        start + segments, start + segments + i, start + segments + i + 1);
      return true;
    }
    const stems = form === 'multistem' ? 5 : 1;
    const trunkHeight = height * ({orchard:.53,slender:.96,broad:.68,multistem:.81,evergreen:.93}[form]);
    for (let stem = 0; stem < stems; stem++) {
      const stemAngle = stem * Math.PI * 2 / stems + random() * 0.5;
      const spread = stems > 1 ? radius * .55 : radius * .06;
      const stemSpread = t => stems > 1 ? spread * (.12 + .88 * t * t) : spread * t * t;
      const stemPoint = t => new THREE.Vector3(Math.cos(stemAngle) * stemSpread(t),
        trunkHeight * t, Math.sin(stemAngle) * stemSpread(t));
      for (let segment = 0; segment < 7; segment++) {
        branch(stemPoint(segment / 7), stemPoint((segment + 1) / 7),
          height * (0.016 / stems ** 0.45) * (1 - segment / 8), height * (0.016 / stems ** 0.45) * (1 - (segment + 1) / 8));
      }
      const limbs = stems > 1 ? 6 : form === 'evergreen' ? 16 : 13;
      for (let limb = 0; limb < limbs; limb++) {
        const tier = limb / limbs;
        const angle = limb * 2.399963229728653 + stemAngle + random() * 0.4;
        const branchLevel = {orchard:.23+tier*.28,slender:.47+tier*.38,broad:.34+tier*.30,multistem:.25+tier*.49,evergreen:.39+tier*.44}[form];
        const trunkT = Math.min(.98,branchLevel * height / trunkHeight);
        const start = stemPoint(trunkT);
        const rounded = form === 'orchard' || form === 'broad';
        const reach = radius * (.68 + random() * .18) * (rounded ? Math.sqrt(1-((tier-.36)/.95)**2) : 1-tier*.45);
        const lift = {orchard:.18+tier*.13,slender:.06,broad:.22+tier*.07,multistem:.16,evergreen:.015}[form];
        const end = start.clone().add(new THREE.Vector3(Math.cos(angle) * reach,
          height * (lift + random() * .035), Math.sin(angle) * reach));
        const elbow = start.clone().lerp(end, 0.48);
        elbow.y -= height * 0.025;
        const thickness = height * 0.008 * (1 - tier * 0.55);
        if (!branch(start, elbow, thickness, thickness * 0.62) || !branch(elbow, end, thickness * 0.62, thickness * 0.25)) continue;
        for (let fork = 0; fork < 4; fork++) {
          const origin = elbow.clone().lerp(end, 0.2 + fork * 0.23);
          const turn = angle + (fork % 2 ? -1 : 1) * (0.55 + random() * 0.8);
          const twigLift = form === 'slender' ? -.06-random()*.07 : form === 'evergreen' ? .012 : .055+random()*.07;
          const twigEnd = origin.clone().add(new THREE.Vector3(Math.cos(turn) * radius * .3,
            height * twigLift, Math.sin(turn) * radius * .3));
          twigEnd.y = Math.min(height * 0.97, twigEnd.y);
          if (!branch(origin, twigEnd, thickness * 0.38, 0.0015)) continue;
          for (let spray = 0; spray < 4; spray++) {
            const attach = origin.clone().lerp(twigEnd, 0.35 + spray * 0.2);
            const shootAngle = turn + (spray % 2 ? -1 : 1) * (0.7 + random() * 0.5);
            const shootLift = form === 'slender' ? -.025-random()*.055 : form === 'evergreen' ? .004 : .015+random()*.045;
            const shoot = attach.clone().add(new THREE.Vector3(Math.cos(shootAngle) * radius * .16,
              height * shootLift, Math.sin(shootAngle) * radius * .16));
            shoot.y = Math.min(height * 0.975, shoot.y);
            if (!branch(attach, shoot, 0.0025, 0.0008)) continue;
            const across = new THREE.Vector3(-Math.sin(shootAngle), 0.2, Math.cos(shootAngle));
            const pairs = form === 'evergreen' ? 4 : form === 'slender' ? 5 : 7;
            for (let pair = 0; pair < pairs; pair++) for (const side of [-1, 1]) {
              const point = attach.clone().lerp(shoot, (pair + .4) / pairs).addScaledVector(across, side * (.025 + random() * .045));
              if (clear(point, form === 'broad' || form === 'evergreen' ? .2 : .11)) leafPositions.push(point);
            }
          }
        }
      }
    }
    const skeletonGeometry = new THREE.BufferGeometry();
    skeletonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    skeletonGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    skeletonGeometry.setIndex(indices);
    skeletonGeometry.computeVertexNormals();
    const skeleton = new THREE.Mesh(skeletonGeometry, shared.barkMaterial);
    skeleton.name = 'Branched tree skeleton';
    skeleton.castShadow = skeleton.receiveShadow = true;
    tree.add(skeleton);
    const leaves = new THREE.InstancedMesh(shared.leaves[form], shared.leafMaterial, leafPositions.length);
    leaves.name = form === 'evergreen' ? 'Individual needle sprays' : form === 'broad' ? 'Individual lobed leaves' : 'Individual folded leaves';
    leaves.userData.leafGeometry = form;
    leaves.userData.leafHabit = leafHabit;
    const transform = new THREE.Object3D(), tint = new THREE.Color(color);
    for (let i = leafPositions.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [leafPositions[i], leafPositions[j]] = [leafPositions[j], leafPositions[i]];
    }
    leafPositions.forEach((point, i) => {
      const ranges = {evergreen:[.12,.07],slender:[.024,.023],broad:[.075,.045],multistem:[.035,.025],orchard:[.045,.035]};
      const size = ranges[form][0]+random()*ranges[form][1];
      transform.position.copy(point);
      transform.position.y = Math.min(height-size*1.1, transform.position.y);
      transform.rotation.set(Math.PI * (0.2 + random() * 0.6), random() * Math.PI * 2, random() * Math.PI * 2);
      transform.scale.set(size * (form === 'slender' ? 0.8 : 1), size, size);
      transform.updateMatrix();
      leaves.setMatrixAt(i, transform.matrix);
      leaves.setColorAt(i, tint.clone().offsetHSL((random() - 0.5) * 0.035, (random() - 0.5) * 0.12, (random() - 0.5) * 0.14));
    });
    leaves.castShadow = leaves.receiveShadow = true;
    tree.add(leaves);
    tree.userData.leafCount = leafPositions.length;
    return tree;
  }
  return { create, variation };
})();
