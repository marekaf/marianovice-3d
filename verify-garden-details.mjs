import assert from 'node:assert/strict';
import * as THREE from 'three';
import {prepareGardenDetails} from './unreal/garden-detail-scene.mjs';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const material=new THREE.MeshStandardMaterial({color:'#80aa40',side:THREE.DoubleSide});
const root=new THREE.Group();root.position.set(11,2,7);
const instances=new THREE.InstancedMesh(new THREE.BoxGeometry(1,2,1),material,2);
instances.setMatrixAt(0,new THREE.Matrix4().makeTranslation(1,1,0));
instances.setMatrixAt(1,new THREE.Matrix4().compose(new THREE.Vector3(3,1,0),new THREE.Quaternion(),new THREE.Vector3(-1,1,1)));
instances.setColorAt(0,new THREE.Color('#ff0000'));instances.setColorAt(1,new THREE.Color('#00ff00'));root.add(instances);
const other=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);other.position.set(20,5,10);
const roots=[{name:'planting',object:root},{name:'pond',object:other}];
const result=prepareGardenDetails(THREE,roots,[0,0,0],{maxVertices:36});
assert(result.scene.children.every(mesh=>mesh.geometry.attributes.position.count<=36));
assert.deepEqual(Object.keys(result.manifest.coverage),['planting','pond']);
assert.equal(result.manifest.sourceInstances,3);
for(const entry of roots){
  const expected=new THREE.Box3().setFromObject(entry.object),actual=new THREE.Box3();
  for(const mesh of result.scene.children.filter(mesh=>mesh.userData.detailCategory===entry.name))actual.expandByObject(mesh);
  assert(expected.min.distanceTo(actual.min)<1e-6&&expected.max.distanceTo(actual.max)<1e-6);
}
for(const mesh of result.scene.children){
  const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,index=mesh.geometry.index;
  assert([...p.array,...n.array].every(Number.isFinite));
  for(let i=0;i<index.count;i+=3){
    const a=new THREE.Vector3().fromBufferAttribute(p,index.getX(i)),b=new THREE.Vector3().fromBufferAttribute(p,index.getX(i+1)),c=new THREE.Vector3().fromBufferAttribute(p,index.getX(i+2));
    const normal=new THREE.Vector3().fromBufferAttribute(n,index.getX(i));
    assert(b.sub(a).cross(c.sub(a)).dot(normal)>0,'Mirrored instances retain outward winding');
  }
}
assert.throws(()=>prepareGardenDetails(THREE,[...roots,{name:'duplicate',object:root}],[0,0,0]),/Duplicate/);
assert.throws(()=>prepareGardenDetails(THREE,[...roots,{name:'nested',object:instances}],[0,0,0]),/Overlapping/);
assert.equal(material.color.getHexString(),'80aa40');
const plantingColours=result.scene.children.filter(mesh=>mesh.userData.detailCategory==='planting').map(mesh=>mesh.geometry.attributes.color);
for(const [index,expected] of [[0,[material.color.r,0,0,1]],[1,[0,material.color.g,0,1]]]){
  const colours=plantingColours[index];
  for(let vertex=0;vertex<colours.count;vertex++)for(let component=0;component<4;component++)assert(Math.abs(colours.array[vertex*4+component]-expected[component])<1e-6,'Baked vertices preserve each instance colour');
}

const directory=mkdtempSync(join(tmpdir(),'garden-details-test-'));
try{
  const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js'),{GradingSite}=require('./grading-site.js');
  const {site}=GradingSite.create({garden:GARDEN,terrain:TERRAIN});
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  writeFileSync(join(directory,'source.js'),'source');writeFileSync(join(directory,'part.glb'),'geometry');
  const categories=Object.fromEntries(['planting','pond','deck_0','drain'].map(name=>[name,{meshes:[name]}]));
  const metadata={formatVersion:1,roundtrip:'passed',units:'metres',upAxis:'Y',sourceOrigin:[0,0,0],assets:[{file:'part.glb',sha256:hash('geometry'),meshes:4}],meshes:4,categories,
    sources:{viewer:{fileHashes:{'/source.js':hash('source')}},tooling:{fileHashes:{'/source.js':hash('source')}}},layout:GARDEN,terrain:site.spec,
    treeAnchors:[{cx:0,cy:0}],controlPoints:[{position:[0,site.height(0,0),0],ground:site.height(0,0)}]};
  writeFileSync(join(directory,'manifest.json'),JSON.stringify(metadata));writeFileSync(join(directory,'garden.json'),JSON.stringify({...GARDEN,siteTerrain:site.spec}));
  const code=`import sys,json,pathlib\nsys.path.insert(0,sys.argv[1])\nfrom garden_details import verified_manifest\np=pathlib.Path(sys.argv[2]); manifest=p/'manifest.json'; garden=json.loads((p/'garden.json').read_text()); original=json.loads(manifest.read_text())\nverified_manifest(manifest,garden,p,p)\nchanges=[lambda d:d.update(sourceOrigin=[1,0,0]),lambda d:d.update(controlPoints=[]),lambda d:d['assets'][0].update(sha256='bad'),lambda d:d['layout'].update(title='changed'),lambda d:d['terrain'].update(houseBaseY=-100),lambda d:d['categories'].pop('drain'),lambda d:d['sources']['viewer']['fileHashes'].update({'/source.js':'bad'})]\nfor change in changes:\n d=json.loads(json.dumps(original));change(d);manifest.write_text(json.dumps(d))\n try: verified_manifest(manifest,garden,p,p)\n except (ValueError,FileNotFoundError): pass\n else: raise AssertionError('Invalid supplement accepted')\nprint('Garden supplement provenance rejects stale files, geometry, datum and missing categories')`;
  console.log(execFileSync('python3',['-I','-c',code,resolve('blender'),directory],{encoding:'utf8',timeout:30000}).trim());
}finally{rmSync(directory,{recursive:true,force:true});}
const poc=readFileSync('blender/poc.py','utf8');
assert(poc.indexOf('detail_legacy.update',poc.indexOf('# ---------------- trees'))<poc.indexOf('# atrium pots:'));
assert(poc.indexOf('detail_legacy.update',poc.indexOf('# ---------------- trees'))<poc.indexOf('build_routes(GARDEN)'));
const rollbackCode=`import sys,types
sys.path.insert(0,sys.argv[1])
import garden_details
original=object(); objects={original}; calls=[]
def importing(**kwargs):
 objects.add(object());calls.append(kwargs)
 if len(calls)==2: raise RuntimeError('Import failed')
class Objects:
 def __iter__(self): return iter(objects)
 def remove(self,obj,**kwargs): objects.remove(obj)
sys.modules['bpy']=types.SimpleNamespace(data=types.SimpleNamespace(objects=Objects()),ops=types.SimpleNamespace(import_scene=types.SimpleNamespace(gltf=importing)))
garden_details.verified_manifest=lambda *args: ({},['first.glb','second.glb'])
try: garden_details.import_details('manifest',{},'source')
except RuntimeError: pass
else: raise AssertionError('Partial import failure swallowed')
assert objects=={original}, 'Partial import left objects behind or removed existing objects'
print('Partial garden import rolls back all new objects and preserves existing scene')`;
console.log(execFileSync('python3',['-I','-c',rollbackCode,resolve('blender')],{encoding:'utf8',timeout:30000}).trim());
console.log('Garden detail batches preserve category bounds, colours, mirrored winding and legacy routes/pots');
