import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,rmdirSync,readFileSync,unlinkSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runPythonJson} from './scripts/python-json.mjs';

const tempRoot=mkdtempSync(join(tmpdir(),'python-json-check-'));
try {
  const payload={text:'žluťoučký 🌱'.repeat(50000),numbers:[0,-1,Math.PI],tempRoot};
  const result=runPythonJson('import json,sys,os,stat; d=json.load(sys.stdin); print(json.dumps({"payload":d,"regular":stat.S_ISREG(os.fstat(0).st_mode),"fileMode":stat.S_IMODE(os.fstat(0).st_mode),"directoryMode":stat.S_IMODE(os.stat(os.path.join(d["tempRoot"],os.listdir(d["tempRoot"])[0])).st_mode)}))',payload,{tempRoot});
  assert.equal(result.regular,true,'Python JSON input must be a regular file with a definite EOF');
  assert.deepEqual(result.payload,payload);
  assert.equal(result.fileMode,0o600);
  assert.equal(result.directoryMode,0o700);
  assert.deepEqual(readdirSync(tempRoot),[],'Successful calls must remove their private input files');
  const rejects=(source,pattern,options={})=>{
    assert.throws(()=>runPythonJson(source,{secret:'private-input'}, {tempRoot,...options}),error=>{
      assert.match(error.message,pattern);
      assert(error.message.length<600,'Process diagnostics must remain bounded');
      assert(!error.message.includes('private-input'),'Process errors must not attach the input payload');
      return true;
    });
    assert.deepEqual(readdirSync(tempRoot),[],'Failed calls must remove their private input files');
  };
  rejects('print("private-input"*10000)',/returned invalid JSON/);
  rejects('import sys; sys.stderr.write("failure detail"*1000); sys.exit(7)',/exited with status 7/);
  const pidFile=join(tempRoot,'child.pid');
  const started=Date.now();
  try {
    assert.throws(()=>runPythonJson('import json,sys,os,time,signal; signal.signal(signal.SIGTERM,signal.SIG_IGN); d=json.load(sys.stdin); f=open(d["pidFile"],"w"); f.write(str(os.getpid())); f.close(); time.sleep(60)',{pidFile},{tempRoot,timeout:2000}),/timed out after 2000 ms/);
    assert(Date.now()-started<10000,'Timeout must bound the process wait');
    const pid=Number(readFileSync(pidFile,'utf8'));
    assert(Number.isInteger(pid)&&pid>0);
    assert.throws(()=>process.kill(pid,0),error=>error.code==='ESRCH','Timed-out Python must be reaped');
  } finally {if(existsSync(pidFile))unlinkSync(pidFile);}
  assert.deepEqual(readdirSync(tempRoot),[],'Timeout must remove its private input files');
  const helper=new URL('./scripts/python-json.mjs',import.meta.url).href;
  const missing=spawnSync(process.execPath,['--input-type=module','-e',`import {runPythonJson} from ${JSON.stringify(helper)}; try {runPythonJson('print(1)',{},${JSON.stringify({tempRoot})}); process.exitCode=1;} catch(error) {if(!error.message.includes('ENOENT'))throw error;}`],{encoding:'utf8',env:{...process.env,PATH:tempRoot},timeout:5000});
  assert.ifError(missing.error);
  assert.equal(missing.status,0,missing.stderr);
  assert.deepEqual(readdirSync(tempRoot),[],'Missing Python must remove its private input files');
} finally {
  rmdirSync(tempRoot);
}
console.log('Python JSON: large Unicode roundtrip, private regular-file input, failure/timeout cleanup and child exit pass');
