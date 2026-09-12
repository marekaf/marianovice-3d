import assert from 'node:assert/strict';
import {createMeshHeightQuery} from './mesh-height-query.js';
import * as THREE from 'three';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {levelCircularGround,gradingGroundBoundaries,refinePlateauGround,gradingGroundRefinement} from './circular-pad-ground.js';
const require=createRequire(import.meta.url),{GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js'),{GradingSite}=require('./grading-site.js');
const survey=existsSync('docs/survey-terrain.js')?require('./docs/survey-terrain.js').SURVEY_TERRAIN:{points:[[-10,-10,4],[60,-10,1],[60,50,2],[-10,50,5]]};
const {GradingZones}=require('./grading-zones.js'),zone=GradingZones.create(GARDEN).zones.find(z=>z.id==='C');
const contains=(x,z)=>zone.polygons.some(p=>p.every((a,i)=>{const b=p[(i+1)%p.length];return (b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0])>=-1e-8;}));
const {site}=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey}),pond=site.spec.pond;
const ground=new THREE.PlaneGeometry(24,24,35,35);ground.rotateX(-Math.PI/2);ground.translate(30,0,11);
const position=ground.attributes.position;
for(let i=0;i<position.count;i++)position.setY(i,site.height(position.getX(i),position.getZ(i)));
const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),queries=new WeakMap();
function height(mesh,x,z) {
  if(!queries.has(mesh))queries.set(mesh,createMeshHeightQuery(mesh));
  const y=queries.get(mesh)(x,z);assert(y!==null,'Every tested ground point is covered by a triangle');return y;
}
const rim=Array.from({length:720},(_,i)=>{const angle=i*Math.PI/360;return [pond.cx+pond.rx*Math.cos(angle),pond.cz+pond.rz*Math.sin(angle)];});
const coarse=new THREE.Mesh(ground,material);
assert(Math.max(...rim.map(p=>Math.abs(height(coarse,...p)-pond.edge)))>.01,'Coarse triangles reproduce a visibly lowered pond rim');
const aligned=refinePlateauGround(THREE,levelCircularGround(THREE,ground,gradingGroundBoundaries(GARDEN,site.spec),site.height),site.height,gradingGroundRefinement(site.spec)),mesh=new THREE.Mesh(aligned,material);
let maximumRimError=0,maximumLawnError=0,lawnSamples=0,worst;
for(const p of rim)maximumRimError=Math.max(maximumRimError,Math.abs(height(mesh,...p)-pond.edge));
for(let x=21.3;x<=34.13;x+=.2)for(let z=0;z<=19.38;z+=.2)if(contains(x,z)&&Math.abs(site.height(x,z)-pond.edge)<1e-10) {
  const error=Math.abs(height(mesh,x,z)-pond.edge);
  if(error>maximumLawnError){maximumLawnError=error;worst=[x,z];}lawnSamples++;
}
assert(maximumRimError<2e-5,`Pond rim follows the filled grade: ${maximumRimError}`);
assert(lawnSamples>1000&&maximumLawnError<.001,`Flat lawn is not pulled into route bedding: ${maximumLawnError} at ${worst}`);
let vertexError=0;
for(let i=0;i<aligned.attributes.position.count;i++){const p=aligned.attributes.position;vertexError=Math.max(vertexError,Math.abs(p.getY(i)-site.height(p.getX(i),p.getZ(i))));}
assert(vertexError<2e-5,`Inserted mesh vertices preserve sampled ramps and basin: ${vertexError}`);
assert(aligned.index.count/3<150000,'Local refinement keeps the coarse fixture below150,000 triangles');
assert(height(mesh,pond.cx,pond.cz)<pond.edge-pond.depth*.8,'Boundary alignment preserves the excavated basin');
console.log(JSON.stringify({rimSamples:rim.length,lawnSamples,maximumRimError,maximumLawnError,vertexError,triangles:aligned.index.count/3}));
