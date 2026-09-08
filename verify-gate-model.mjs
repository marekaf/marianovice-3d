import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {GateModel}=createRequire(import.meta.url)('./gate-model.js');
const options={open:0,wicketOpen:0},before=JSON.stringify(options),model=GateModel.build(options);
assert.equal(JSON.stringify(options),before);
assert.equal(model.dims.opening,4);
assert.equal(model.dims.leafLength,5.5);
assert.equal(model.dims.tail,1.5);
assert.equal(model.dims.height,1.5);
assert.equal(model.dims.bottomGap,.035);
assert.equal(model.dims.wicketOpening,1);
const sharedPost=model.parts.find(p=>p.name==='gate_post_1');
const outerPost=model.parts.find(p=>p.name==='gate_post_2');
assert(Math.abs(Math.min(...outerPost.vertices.map(p=>p[0]))-Math.max(...sharedPost.vertices.map(p=>p[0]))-1)<1e-9);
assert.deepEqual(model.dims.mesh.pitch,[.042,.012]);
assert.equal(model.parts.filter(p=>p.name.endsWith('_expanded_metal')).length,3);
assert.ok(!model.parts.some(p=>p.name.startsWith('wicket_connector')));
const bounds=vertices=>vertices.reduce((b,p)=>({min:p.map((v,i)=>Math.min(v,b.min[i])),max:p.map((v,i)=>Math.max(v,b.max[i]))}),{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
const verticesOf=part=>part.groups
  ? part.groups.flatMap(group=>group.positions.flatMap(position=>group.vertices.map(vertex=>vertex.map((v,i)=>v+position[i]))))
  : part.vertices??[part.start,part.end];
for(const part of model.parts){
  assert(model.materials[part.material],part.name);
  assert(verticesOf(part).flat().every(Number.isFinite),part.name);
  for(const group of part.groups??[part])if(group.faces)for(const face of group.faces)assert(face.every(i=>Number.isInteger(i)&&i>=0&&i<group.vertices.length),part.name);
  if(part.name.endsWith('_expanded_metal')){
    const b=bounds(verticesOf(part));
    assert(b.max[1]-b.min[1]>.004,'Expanded metal needs raised physical depth');
    assert(b.min[2]>=.095-1e-8&&b.max[2]<=1.44+1e-8,'Infill must stay behind the frame');
    const p=verticesOf(part).slice(0,8),a=p[0],c=p[1],d=p[2],e=p[4];
    const cross=[(c[1]-a[1])*(d[2]-a[2])-(c[2]-a[2])*(d[1]-a[1]),(c[2]-a[2])*(d[0]-a[0])-(c[0]-a[0])*(d[2]-a[2]),(c[0]-a[0])*(d[1]-a[1])-(c[1]-a[1])*(d[0]-a[0])];
    assert(cross.reduce((s,v,i)=>s+v*(e[i]-a[i]),0)<0,'Strand winding must account for its x/height plane');
  }
}
const runner=bounds(model.parts.find(p=>p.name==='cantilever_runner').vertices);
assert(Math.abs(runner.max[0]-runner.min[0]-5.5)<1e-9);
assert.equal(runner.min[2],.035);
const opened=GateModel.build({open:1,wicketOpen:1});
const openLeaf=bounds(verticesOf(opened.parts.find(p=>p.name==='sliding_gate_expanded_metal')));
assert(openLeaf.max[0]<0,'Fully open leaf must leave vehicle opening clear');
const openWicket=bounds(verticesOf(opened.parts.find(p=>p.name==='wicket_expanded_metal')));
assert(openWicket.min[0]>5.06,'Open wicket must clear its independent hinge post');
assert(openWicket.max[0]<5.14);
for(let step=0;step<=12;step++){
  const state=GateModel.build({open:0,wicketOpen:step/12});
  for(const part of state.parts.filter(p=>p.category==='wicket')){
    const vertices=verticesOf(part);
    assert(vertices.every(p=>p[0]>4.02),'Entire wicket swing must stay south of the vehicle area');
  }
}
assert.equal(GateModel.build({fixedPanel:false}).parts.filter(p=>p.name.endsWith('_expanded_metal')).length,2);
assert.throws(()=>GateModel.build({direction:[0,0]}));
assert.throws(()=>GateModel.build({open:2}));
const transformed=GateModel.build({openingStart:[10,20],direction:[0,2],open:0,wicketOpen:0});
const original=model.parts.find(p=>p.name==='cantilever_runner').vertices[0],rotated=transformed.parts.find(p=>p.name==='cantilever_runner').vertices[0];
assert.deepEqual(rotated,[10-original[1],20+original[0],original[2]]);
console.log('Entrance gate: 4m opening, 5.5m leaf, raised TR42×12 mesh, frame clipping, opening states and placement transforms pass.');
if(process.env.GATE_BROWSER==='1'){
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.INTERIOR_URL||'http://127.0.0.1:8765/interior.html',{waitUntil:'networkidle'});
    await page.addScriptTag({url:new URL('gate-model.js',page.url()).href});
    const result=await page.evaluate(async()=>{
      const THREE=await import('three'),{buildModel}=await import('./model3d.js');
      const model=GateModel.build({open:0,wicketOpen:0}),group=buildModel(THREE,model),scene=new THREE.Scene();
      scene.background=new THREE.Color('#dce4e6');scene.add(group,new THREE.HemisphereLight('#ffffff','#637066',3));
      const sun=new THREE.DirectionalLight('#fff4dd',3);sun.position.set(-2,5,-5);scene.add(sun);
      const camera=new THREE.PerspectiveCamera(38,1400/950,.01,100);camera.position.set(6,3.2,-9);camera.lookAt(1.6,.75,0);
      const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1400,950);renderer.render(scene,camera);
      const host=document.createElement('div');host.style='position:fixed;inset:0;z-index:99999';host.append(renderer.domElement);document.body.append(host);
      let finite=true;group.traverse(o=>{if(o.isMesh)finite&&=[...o.geometry.attributes.position.array].every(Number.isFinite);});
      return {finite,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls};
    });
    assert(result.finite);assert(result.triangles>500000);assert(result.drawCalls<120);
    if(process.env.GATE_SCREENSHOT)await page.screenshot({path:process.env.GATE_SCREENSHOT});
    assert.deepEqual(errors,[]);
    console.log(`Browser: ${result.triangles} triangles in ${result.drawCalls} draw calls, finite rendered geometry.`);
  }finally{await browser.close();}
}
