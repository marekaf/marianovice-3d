import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const source=readFileSync(new URL('./viewer-loading.js',import.meta.url),'utf8');
assert(html.indexOf('id="viewerLoading"')<html.indexOf('src="terrain.js'));
assert(html.indexOf('src="viewer-loading.js?v=')<html.indexOf('src="terrain.js'));
assert(html.includes('animate();\nViewerLoading.finish();'));
function fixture(){
  const nodes=new Map(),events=new Map(),frames=[],timers=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},hidden:true,textContent:'',classList:{add(){},remove(){}},addEventListener(){},remove(){this.removed=true;}});return nodes.get(id);};
  const window={addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
  class Script{}
  class ErrorEvent{}
  const document={getElementById:node,body:{classList:{remove(){}},removeAttribute(){}}};
  vm.runInNewContext(source,{window,document,HTMLScriptElement:Script,ErrorEvent,performance:{now:()=>100},requestAnimationFrame:fn=>frames.push(fn),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){},location:{reload(){}}});
  return {window,nodes,events,frames,timers,Script,ErrorEvent};
}
const success=fixture();
success.window.ViewerLoading.finish();
assert.equal(success.nodes.get('viewerLoading').dataset.state,'ready');
assert.equal(success.nodes.get('viewerLoading').removed,undefined);
success.frames.shift()();success.timers.find(t=>t.ms===400).fn();
assert.equal(success.nodes.get('viewerLoading').removed,true);
assert.equal(success.events.size,0);
const failed=fixture();
failed.events.get('unhandledrejection')({reason:{message:'WebGL context unavailable'}});
assert.equal(failed.nodes.get('loadingHint').textContent,'Error: WebGL context unavailable');
failed.window.ViewerLoading.finish();
assert.equal(failed.nodes.get('viewerLoading').dataset.state,'error');
assert.equal(failed.nodes.get('loadingRetry').hidden,false);
const optional=fixture(),script=new optional.Script();script.dataset={loadingOptional:'true'};
optional.events.get('error')({target:script});
assert.equal(optional.nodes.get('viewerLoading').dataset.state,undefined);
script.dataset={};optional.events.get('error')({target:script});
assert.equal(optional.nodes.get('viewerLoading').dataset.state,'error');
console.log('Viewer loading: first-frame handoff, fatal failure, retry and optional resource handling pass');
