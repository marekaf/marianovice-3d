import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assetVersion,localScriptReferences,runtimeAssetReferences,versionLocalScripts} from './runtime-asset-references.mjs';
const source=`
  import {render} from './renderer.js?v=abc';
  const image='missing-image.png';
  link.download = 'generated-drawing.png';
  link.href = 'missing-input.svg';
  other.download = "generated-copy.svg";
  const next = './next.html';
`;
assert.deepEqual([...runtimeAssetReferences(source)],['./renderer.js?v=abc','missing-image.png','missing-input.svg','./next.html']);
assert.deepEqual([...runtimeAssetReferences(`link.download='output.png'; image.src='output.png';`)],['output.png'],'Using the same name as a real input still requires that input');

const scripts=`
  <script src="plain.js"></script><script src='docs/old.js?v=abc'></script>
  import {a} from './static.js';
  const b=await import("./dynamic.mjs?v=123");
  new Worker('./worker.js');
  import * as THREE from 'three';
  import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
  import('https://example.com/remote.js');
  const node=typeof module!=='undefined'?require('./node-only.js'):Browser;
  const file=require('path').join(__dirname,'docs/data.js');
  download('layout.js', text);
  link.download = 'export.js';
  scripts.find(script=>script.src.endsWith(\`/\${name}.js\`));
`;
assert.deepEqual([...localScriptReferences(scripts)].map(({path,version})=>[path,version]),
  [['plain.js',null],['docs/old.js','abc'],['./static.js',null],['./dynamic.mjs','123'],['./worker.js',null]],
  'Only scripts the browser fetches from this site carry a version');

const directory=mkdtempSync(join(tmpdir(),'asset-versions-'));
try{
  const file=name=>join(directory,name),read=name=>readFileSync(file(name),'utf8');
  mkdirSync(file('docs'));
  writeFileSync(file('docs/leaf.js'),'export const leaf=1;\n');
  writeFileSync(file('docs/middle.js'),"import {leaf} from './leaf.js?v=stale';\nconst node=require('./leaf.js');\n");
  writeFileSync(file('top.js'),"export const load=()=>import('./docs/middle.js');\n");
  writeFileSync(file('page.html'),'<script src="top.js"></script><script type="module">import "./docs/leaf.js";</script>\n');
  const versions=()=>({leaf:assetVersion(file('docs/leaf.js')),middle:assetVersion(file('docs/middle.js')),top:assetVersion(file('top.js'))});
  const expectChain=()=>{
    const {leaf,middle,top}=versions();
    assert.equal(read('docs/middle.js'),`import {leaf} from './leaf.js?v=${leaf}';\nconst node=require('./leaf.js');\n`);
    assert.equal(read('top.js'),`export const load=()=>import('./docs/middle.js?v=${middle}');\n`);
    assert.equal(read('page.html'),`<script src="top.js?v=${top}"></script><script type="module">import "./docs/leaf.js?v=${leaf}";</script>\n`);
  };
  assert.equal(versionLocalScripts([file('page.html')]).length,3);
  expectChain();
  const before=versions();
  assert.deepEqual(versionLocalScripts([file('page.html')]),[],'A second run changes nothing');
  writeFileSync(file('docs/leaf.js'),'export const leaf=2;\n');
  assert.equal(versionLocalScripts([file('page.html')]).length,3,'One run carries a leaf change up to the page');
  expectChain();
  const after=versions();
  for(const name of ['leaf','middle','top'])assert.notEqual(after[name],before[name],`${name} hash follows the leaf change`);
  writeFileSync(file('docs/leaf.js'),"import './middle.js';\n");
  assert.throws(()=>versionLocalScripts([file('page.html')]),/import each other/);
  writeFileSync(file('docs/leaf.js'),"import './absent.js';\n");
  assert.throws(()=>versionLocalScripts([file('page.html')]),/missing script/);
}finally{rmSync(directory,{recursive:true,force:true});}
console.log('Runtime assets distinguish download names from required scripts, images and links');
