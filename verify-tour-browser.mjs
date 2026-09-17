import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, extname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildTour} from './unreal/tour-geometry.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('.',import.meta.url));
const dir=await mkdtemp(join(tmpdir(),'tour-browser-'));
// A synthetic stereo panorama: the top (left eye) half has green at the centre, red on
// the right quarter and blue on the left quarter; the bottom (right eye) half is magenta.
function band(colour,x0,x1,y0,y1){return `drawbox=x=${x0}:y=${y0}:w=${x1-x0}:h=${y1-y0}:color=${colour}:t=fill`;}
const still=[band('lime',648,792,0,360),band('red',1008,1152,0,360),band('blue',288,432,0,360),band('magenta',0,1440,360,720)].join(',');
const made=spawnSync('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=gray:size=1440x720:rate=1','-frames:v','1','-vf',still,join(dir,'a_360_TB.png')],{encoding:'utf8'});
assert.equal(made.status,0,made.stderr);
const shots=[
  {name:'A room',start:[0,0,170],targetStart:[100,0,170]},
  {name:'B room',start:[0,300,170],targetStart:[0,400,170]},
];
const tour=buildTour(shots,{stereo:true,extension:'png'});
for(const item of tour.stills){item.file='a_360_TB.png';}
await writeFile(join(dir,'tour.json'),JSON.stringify(tour));
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://localhost').pathname;
  const file=path.startsWith('/unreal/generated/tour/')?join(dir,path.slice('/unreal/generated/tour/'.length)):resolve(root,'.'+path);
  const data=await readFile(file);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(data);
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:800,height:600}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/tour.html`);
  await page.waitForFunction(()=>window.tourReview&&document.getElementById('tourStatus').textContent==='A room',null,{timeout:60000});
  assert.deepEqual(errors,[]);
  async function centrePixel(){
    const shot=await page.screenshot({clip:{x:399,y:299,width:1,height:1}});
    const raw=spawnSync('ffmpeg',['-v','error','-i','-','-f','rawvideo','-pix_fmt','rgb24','-'],{input:shot,encoding:'latin1',maxBuffer:1<<20});
    const [r,g,b]=Buffer.from(raw.stdout,'latin1');
    return {r,g,b};
  }
  await page.evaluate(()=>{tourReview.look.yaw=0;tourReview.look.pitch=0;tourReview.orient();});
  await page.waitForTimeout(300);
  let pixel=await centrePixel();
  assert(pixel.g>150&&pixel.r<100&&pixel.b<100,`Facing the heading shows the panorama centre (left eye), got ${JSON.stringify(pixel)}`);
  await page.evaluate(()=>{tourReview.look.yaw=-Math.PI/2;tourReview.orient();});
  await page.waitForTimeout(300);
  pixel=await centrePixel();
  assert(pixel.r>150&&pixel.g<100,`A right turn shows the right quarter of the image, got ${JSON.stringify(pixel)}`);
  await page.evaluate(()=>{tourReview.look.yaw=Math.PI/2;tourReview.orient();});
  await page.waitForTimeout(300);
  pixel=await centrePixel();
  assert(pixel.b>150&&pixel.g<100,`A left turn shows the left quarter of the image, got ${JSON.stringify(pixel)}`);
  const hotspots=await page.evaluate(()=>tourReview.hotspots());
  assert.equal(hotspots.length,1);
  assert.equal(hotspots[0].to,1);
  assert(hotspots[0].position[0]>1&&Math.abs(hotspots[0].position[2])<0.01&&hotspots[0].position[1]<0,`B room lies on +Y, a right turn from the +X heading, so its ring sits to the right and below eye level: ${hotspots[0].position}`);
  await page.evaluate(()=>{tourReview.look.yaw=-Math.PI/2;tourReview.look.pitch=-0.35;tourReview.orient();});
  await page.waitForTimeout(300);
  const target=await page.evaluate(()=>{
    const [x,y,z]=tourReview.hotspots()[0].position;
    const v=new (tourReview.camera.position.constructor)(x,y,z).project(tourReview.camera);
    return {x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight};
  });
  await page.mouse.click(target.x,target.y);
  await page.waitForFunction(()=>document.getElementById('tourStatus').textContent==='B room',null,{timeout:10000});
  assert.equal(await page.evaluate(()=>tourReview.current.index),1,'Clicking the ring moves to the linked still');
  assert.equal(await page.locator('#tourNext').isDisabled(),true,'The last still has no next');
  await page.locator('#tourPrev').click();
  await page.waitForFunction(()=>tourReview.current.index===0,null,{timeout:10000});
  assert.deepEqual(errors,[]);
  console.log('Tour browser: panorama centre faces the heading, right and left turns map to the right and left image quarters, the left eye is the top half, and floor rings navigate.');
}finally{
  await browser?.close();
  server.close();
  await rm(dir,{recursive:true,force:true});
}
