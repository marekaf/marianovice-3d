import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({channel:'chrome',headless:true});
const output=process.env.SAUNA_SCREENSHOTS||'/tmp/compact-sauna';
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/index.html',async route=>route.fulfill({contentType:'text/html',body:(await readFile(new URL('./index.html',import.meta.url),'utf8')).replace('ViewerLoading.finish();','window.saunaCheck={THREE,scene,camera,controls,renderer,saunaGroup,saunaModel,boundaryFence,gradingOverlay};ViewerLoading.finish();')}));
  await page.goto(process.env.MODEL_URL||'http://127.0.0.1:8765/index.html');
  await page.locator('#viewerLoading').waitFor({state:'hidden',timeout:120000});
  const result=await page.evaluate(()=>{
    const t=saunaCheck;t.scene.updateMatrixWorld(true);
    const roof=t.saunaGroup.userData.categories.roof,bounds=new t.THREE.Box3().setFromObject(roof);
    const point=new t.THREE.Vector3();let minimum=Infinity,vertices=0;
    roof.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);vertices++;
        for(const segment of t.boundaryFence.segments.filter(s=>s.measured)){
          const [a,b]=[segment.start,segment.end],dx=b[0]-a[0],dz=b[1]-a[1];
          const f=Math.max(0,Math.min(1,((point.x-a[0])*dx+(point.z-a[1])*dz)/(dx*dx+dz*dz)));
          minimum=Math.min(minimum,Math.hypot(point.x-a[0]-f*dx,point.z-a[1]-f*dz));
        }
      }
    });
    return {roof:[bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z],minimum,vertices,
      dimensions:t.gradingOverlay.data.dimensions.filter(d=>['saunaFacility','saunaFenceGap'].includes(d.id)).map(d=>({id:d.id,value:d.value})),
      hallBenchParts:t.saunaModel.parts.filter(p=>p.name.startsWith('hall_bench')).length,
      upperBenchParts:t.saunaModel.parts.filter(p=>p.name.startsWith('bench_upper_slat')).length,
      lowerBenchParts:t.saunaModel.parts.filter(p=>p.name.startsWith('bench_lower_slat')).length};
  });
  assert(Math.abs(result.roof[0]-5)<1e-4&&Math.abs(result.roof[1]-2.5)<1e-4,'Rendered continuous roof must be 5 × 2.5 m');
  assert(result.minimum>=2-1e-4&&result.minimum<2.001,'Rendered roof must retain 2 m measured-fence clearance');
  assert(result.vertices>100&&result.hallBenchParts>0&&result.upperBenchParts>0&&result.lowerBenchParts>0,'Roof, hall bench and both sauna bench tiers must be built');
  assert.equal(result.dimensions.find(d=>d.id==='saunaFacility').value,'5,00 × 2,50 m');
  assert.equal(result.dimensions.find(d=>d.id==='saunaFenceGap').value,'2,00 m');
  for(const view of ['front','plan']){
    await page.evaluate(view=>{
      const t=saunaCheck,s=GARDEN.elements.find(e=>e.id==='saunaShelter').parts.find(p=>p.kind==='rect');
      t.saunaGroup.userData.categories.roof.visible=view!=='plan';
      t.camera.up.set(0,view==='plan'?0:1,view==='plan'?-1:0);
      t.camera.position.set(s.x+(view==='plan'?2.5:7),t.saunaModel.floorHeight+(view==='plan'?12:3.3),s.y+(view==='plan'?1.25:7.3));
      t.controls.target.set(s.x+2.5,t.saunaModel.floorHeight+(view==='plan'?0:1),s.y+1.25);
      t.controls.update();t.renderer.render(t.scene,t.camera);
    },view);
    await page.screenshot({path:`${output}/${view}.png`});
  }
  await page.goto(new URL('interior.html#sauna-plan',process.env.MODEL_URL||'http://127.0.0.1:8765/index.html').href);
  await page.locator('#interiorToolbar').waitFor({timeout:120000});
  assert.match(await page.locator('#dims').textContent(),/5\.00 × 2\.50 m overall/);
  assert.match(await page.locator('#viewlabel').textContent(),/SAUNA \+ SOFTUB/);
  await page.screenshot({path:`${output}/interior-plan.png`});
  assert.deepEqual(errors,[]);
  console.log('Actual compact sauna:',JSON.stringify(result));
} finally {await browser.close();}
