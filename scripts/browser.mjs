import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT=fileURLToPath(new URL('../',import.meta.url));

const TYPES={
  '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
};

// The pages import three from this CDN path. With the pinned devDependency
// installed, the server answers from node_modules, so a run needs no network.
const THREE_CDN='https://unpkg.com/three@0.186.0/';
const LOCAL_THREE=existsSync(resolve(ROOT,'node_modules/three/package.json'));

export async function launchChrome(options={}) {
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
  const browser=await chromium.launch({channel:'chrome',headless:true,...options});
  // A runner without a GPU renders WebGL on the CPU, and the page then answers
  // slower than the 30 s Playwright default. Timeouts a check passes itself stay.
  const timeout=Number(process.env.BROWSER_TIMEOUT_MS);
  if(timeout)for(const method of ['newPage','newContext']){
    const create=browser[method].bind(browser);
    browser[method]=async(...args)=>{const made=await create(...args);made.setDefaultTimeout(timeout);return made;};
  }
  return browser;
}

export async function serveRepo({rewrite,locate}={}) {
  const server=createServer(async(req,res)=>{
    try{
      const path=new URL(req.url,'http://localhost').pathname;
      let file=locate?.(path);
      if(!file){
        file=resolve(ROOT,'.'+path);
        if(!file.startsWith(ROOT))throw new Error('Invalid path');
      }
      let data=await readFile(file);
      if(rewrite)data=await rewrite(path,data);
      if(LOCAL_THREE&&['.html','.js','.mjs'].includes(extname(file)))data=data.toString().replaceAll(THREE_CDN,'/node_modules/three/');
      res.writeHead(200,{'Content-Type':TYPES[extname(file)]||'application/octet-stream'}).end(data);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  return {
    origin:`http://127.0.0.1:${server.address().port}`,
    close:()=>new Promise(done=>server.close(done)),
  };
}
