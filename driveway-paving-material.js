// DITON large-format pavers (MONACO/MILÁNO, natural grey), running bond, world-space UV.
export function createDrivewayPavingMaterial(THREE) {
  const M = 2.4, S = 512, ppm = S / M;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#66655f'; ctx.fillRect(0, 0, S, S);            // recessed joint (dark grey)
  const pw = 0.6, ph = 0.4, j = 0.018;
  let row = 0;
  for (let z = 0; z < M; z += ph, row++) {
    const off = (row % 2) * pw / 2;                               // half-paver running-bond shift
    for (let x = -pw; x < M + pw; x += pw) {
      const g = 154 + (Math.random() * 2 - 1) * 15;               // per-paver grey variation
      ctx.fillStyle = `rgb(${g | 0},${(g - 3) | 0},${(g - 8) | 0})`;
      ctx.fillRect((x + off + j) * ppm, (z + j) * ppm, (pw - 2 * j) * ppm, (ph - 2 * j) * ppm);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / M, 1 / M);
  return new THREE.MeshStandardMaterial({ color: 0xffffff, map: t, roughness: 0.85 });
}

export function applyDrivewayPavingMaterial(THREE,root,material) {
  root.updateMatrixWorld(true);
  root.traverse(mesh=>{
    if(!mesh.isMesh||mesh.material.name!=='paving')return;
    const position=mesh.geometry.attributes.position,uv=new Float32Array(position.count*2),point=new THREE.Vector3();
    for(let i=0;i<position.count;i++){
      point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
      uv[i*2]=point.x;uv[i*2+1]=point.z;
    }
    mesh.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    mesh.material=material;
  });
}
