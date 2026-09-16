import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {injectSphericalMetadata, readSphericalXml, sphericalXml} from './spherical-metadata.mjs';

function box(type,...children){
  const body=Buffer.concat(children.map(child=>Buffer.isBuffer(child)?child:Buffer.from(child,'latin1')));
  const header=Buffer.alloc(8);
  header.writeUInt32BE(8+body.length,0);
  header.write(type,4,'latin1');
  return Buffer.concat([header,body]);
}
function u32(...values){const out=Buffer.alloc(values.length*4);values.forEach((v,i)=>out.writeUInt32BE(v,i*4));return out;}
function u64(...values){const out=Buffer.alloc(values.length*8);values.forEach((v,i)=>out.writeBigUInt64BE(BigInt(v),i*8));return out;}
const hdlr=kind=>box('hdlr',u32(0,0),kind,u32(0,0,0),'\0');
const stco=(...offsets)=>box('stco',u32(0,offsets.length),u32(...offsets));
const co64=(...offsets)=>box('co64',u32(0,offsets.length),u64(...offsets));
const trak=(kind,table)=>box('trak',box('mdia',hdlr(kind),box('minf',box('stbl',table))));
const ftyp=box('ftyp','isom',u32(512),'isomiso2');
const mdat=box('mdat','0123456789abcdef');

{
  const file=Buffer.concat([ftyp,mdat,box('moov',trak('vide',stco(ftyp.length+8)),trak('soun',stco(ftyp.length+12)))]);
  const {buffer,traks,mdatBefore,mdatAfter,bytesAdded}=injectSphericalMetadata(file,{stereo:'top-bottom'});
  assert.equal(traks,1,'Only the video trak is tagged');
  assert.equal(mdatBefore,1);assert.equal(mdatAfter,0);
  assert.equal(buffer.length,file.length+bytesAdded);
  assert.equal(buffer.readUInt32BE(ftyp.length+mdat.length),file.readUInt32BE(ftyp.length+mdat.length)+bytesAdded,'moov size grows');
  const xml=readSphericalXml(buffer);
  assert.deepEqual(xml,[sphericalXml({stereo:'top-bottom'})]);
  assert.match(xml[0],/<GSpherical:StereoMode>top-bottom<\/GSpherical:StereoMode>/);
  assert.match(xml[0],/<GSpherical:ProjectionType>equirectangular<\/GSpherical:ProjectionType>/);
  assert.equal(buffer.readUInt32BE(buffer.indexOf('stco')+12),ftyp.length+8,'Chunk offsets before moov are unchanged');
  assert.throws(()=>injectSphericalMetadata(buffer,{stereo:'top-bottom'}),/already present/);
  assert.throws(()=>injectSphericalMetadata(file,{stereo:'sideways'}),/Unsupported stereo/);
}
{
  const moov=box('moov',trak('vide',stco(0)),trak('vide',co64(0)));
  const chunk=ftyp.length+moov.length+8;
  const file=Buffer.concat([ftyp,box('moov',trak('vide',stco(chunk)),trak('vide',co64(chunk+4))),mdat]);
  assert.equal(file.toString('latin1',chunk,chunk+4),'0123','Fixture chunk offset points into mdat');
  const {buffer,traks,mdatAfter,bytesAdded}=injectSphericalMetadata(file,{stereo:'none'});
  assert.equal(traks,2);assert.equal(mdatAfter,1);
  const first=buffer.indexOf('stco'),second=buffer.indexOf('co64');
  assert.equal(buffer.readUInt32BE(first+12),chunk+bytesAdded,'stco entries shift with the grown moov');
  assert.equal(Number(buffer.readBigUInt64BE(second+12)),chunk+4+bytesAdded,'co64 entries shift too');
  assert.equal(buffer.toString('latin1',chunk+bytesAdded,chunk+bytesAdded+4),'0123','Shifted offset still reaches the same sample bytes');
  assert.equal(readSphericalXml(buffer).length,2);
  assert.equal(buffer.subarray(buffer.length-mdat.length).equals(mdat),true,'mdat bytes are untouched');
}
assert.throws(()=>injectSphericalMetadata(Buffer.concat([ftyp,mdat]),{}),/No moov/);
assert.throws(()=>injectSphericalMetadata(Buffer.concat([ftyp,box('moov',trak('soun',stco(1)))]),{}),/No video trak/);

const ffmpeg=spawnSync('ffmpeg',['-version'],{encoding:'utf8'});
if(ffmpeg.error){
  console.log('Spherical metadata: box injection, size and chunk-offset fixes pass. ffmpeg is unavailable, so the ffprobe round trip was skipped.');
}else{
  const dir=await mkdtemp(join(tmpdir(),'spherical-'));
  try{
    const source=join(dir,'source.mp4'),tagged=join(dir,'tagged.mp4');
    const encode=spawnSync('ffmpeg',['-v','error','-y','-f','lavfi','-i','testsrc=size=64x64:rate=10','-t','0.5','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',source],{encoding:'utf8'});
    assert.equal(encode.status,0,encode.stderr);
    const result=injectSphericalMetadata(await readFile(source),{stereo:'top-bottom'});
    assert.equal(result.mdatAfter,1,'faststart places moov before mdat');
    await writeFile(tagged,result.buffer);
    const probe=spawnSync('ffprobe',['-v','error','-show_streams','-of','json',tagged],{encoding:'utf8'});
    assert.equal(probe.status,0,probe.stderr);
    const stream=JSON.parse(probe.stdout).streams.find(stream=>stream.codec_type==='video');
    const spherical=(stream.side_data_list||[]).find(item=>/spherical/i.test(item.side_data_type));
    assert(spherical,`ffprobe must report spherical mapping side data: ${JSON.stringify(stream.side_data_list)}`);
    assert.equal(spherical.projection,'equirectangular');
    const stereo=(stream.side_data_list||[]).find(item=>/stereo/i.test(item.side_data_type));
    assert(stereo&&/top.*bottom/i.test(stereo.type),`ffprobe must report top-bottom stereo: ${JSON.stringify(stream.side_data_list)}`);
    const decode=spawnSync('ffmpeg',['-v','error','-i',tagged,'-f','null','-'],{encoding:'utf8'});
    assert.equal(decode.status,0,decode.stderr);
    assert.equal(decode.stderr,'','Tagged file decodes without errors');
    console.log('Spherical metadata: box injection passes and ffprobe reads equirectangular top-bottom stereo from a faststart file.');
  }finally{
    await rm(dir,{recursive:true,force:true});
  }
}
