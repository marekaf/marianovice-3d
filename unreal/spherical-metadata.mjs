// Writes the Spherical Video V1 metadata box (a uuid box with RDF XML inside each video
// trak) that YouTube VR, Meta players and ffprobe use to detect a 360 equirectangular file.
// https://github.com/google/spatial-media/blob/master/docs/spherical-video-rfc.md
const SPHERICAL_UUID=Buffer.from('ffcc8263f8554a938814587a02521fdd','hex');
const STEREO_MODES={'none':'mono','top-bottom':'top-bottom','left-right':'left-right'};

export function sphericalXml({stereo='none',source='Unreal Engine Movie Render Queue'}={}){
  const mode=STEREO_MODES[stereo];
  if(!mode)throw new Error(`Unsupported stereo layout ${stereo}`);
  return '<?xml version="1.0"?>'+
    '<rdf:SphericalVideo xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:GSpherical="http://ns.google.com/videos/1.0/spherical/">'+
    '<GSpherical:Spherical>true</GSpherical:Spherical>'+
    '<GSpherical:Stitched>true</GSpherical:Stitched>'+
    `<GSpherical:StitchingSoftware>${source}</GSpherical:StitchingSoftware>`+
    '<GSpherical:ProjectionType>equirectangular</GSpherical:ProjectionType>'+
    `<GSpherical:StereoMode>${mode}</GSpherical:StereoMode>`+
    '</rdf:SphericalVideo>';
}

function readBoxes(buffer,start,end){
  const boxes=[];
  let offset=start;
  while(offset<end){
    if(end-offset<8)throw new Error(`Truncated box header at ${offset}`);
    let size=buffer.readUInt32BE(offset);
    const type=buffer.toString('latin1',offset+4,offset+8);
    let headerSize=8;
    if(size===1){
      size=Number(buffer.readBigUInt64BE(offset+8));
      headerSize=16;
    }else if(size===0)size=end-offset;
    if(size<headerSize||offset+size>end)throw new Error(`Invalid ${type} box size ${size} at ${offset}`);
    boxes.push({type,offset,size,headerSize,bodyStart:offset+headerSize,bodyEnd:offset+size});
    offset+=size;
  }
  return boxes;
}

const CONTAINERS=new Set(['moov','trak','mdia','minf','stbl']);

function walk(buffer,start,end,visit){
  for(const box of readBoxes(buffer,start,end)){
    visit(box);
    if(CONTAINERS.has(box.type))walk(buffer,box.bodyStart,box.bodyEnd,visit);
  }
}

function uuidBox(xml){
  const payload=Buffer.from(xml,'utf8');
  const box=Buffer.alloc(8+16+payload.length);
  box.writeUInt32BE(box.length,0);
  box.write('uuid',4,'latin1');
  SPHERICAL_UUID.copy(box,8);
  payload.copy(box,24);
  return box;
}

function isVideoTrak(buffer,trak){
  let video=false;
  walk(buffer,trak.bodyStart,trak.bodyEnd,box=>{
    if(box.type==='hdlr'&&buffer.toString('latin1',box.bodyStart+8,box.bodyStart+12)==='vide')video=true;
  });
  return video;
}

function hasSphericalBox(buffer,trak){
  let found=false;
  for(const box of readBoxes(buffer,trak.bodyStart,trak.bodyEnd)){
    if(box.type==='uuid'&&buffer.subarray(box.bodyStart,box.bodyStart+16).equals(SPHERICAL_UUID))found=true;
  }
  return found;
}

export function injectSphericalMetadata(buffer,options={}){
  const xml=sphericalXml(options);
  const top=readBoxes(buffer,0,buffer.length);
  const moov=top.find(box=>box.type==='moov');
  if(!moov)throw new Error('No moov box found');
  if(moov.headerSize!==8)throw new Error('64-bit moov boxes are not supported');
  const mdatBefore=top.filter(box=>box.type==='mdat'&&box.offset<moov.offset).length;
  const mdatAfter=top.filter(box=>box.type==='mdat'&&box.offset>moov.offset).length;
  const traks=readBoxes(buffer,moov.bodyStart,moov.bodyEnd).filter(box=>box.type==='trak'&&isVideoTrak(buffer,box));
  if(!traks.length)throw new Error('No video trak found');
  if(traks.some(trak=>hasSphericalBox(buffer,trak)))throw new Error('Spherical metadata already present');
  const insert=uuidBox(xml);
  const grown=insert.length*traks.length;
  const parts=[];
  let cursor=0;
  for(const trak of traks){
    parts.push(buffer.subarray(cursor,trak.bodyEnd),insert);
    cursor=trak.bodyEnd;
  }
  parts.push(buffer.subarray(cursor));
  const output=Buffer.concat(parts);
  // Rewrite the enclosing sizes: moov itself and each patched trak, whose starts are unchanged.
  output.writeUInt32BE(moov.size+grown,moov.offset);
  traks.forEach((trak,index)=>{
    if(trak.headerSize!==8)throw new Error('64-bit trak boxes are not supported');
    output.writeUInt32BE(trak.size+insert.length,trak.offset+insert.length*index);
  });
  // Sample chunk offsets are absolute file positions. When moov precedes mdat (faststart),
  // growing moov shifts every chunk, so every table entry moves by the same amount.
  if(mdatAfter){
    const newMoov={bodyStart:moov.bodyStart,bodyEnd:moov.bodyEnd+grown};
    walk(output,newMoov.bodyStart,newMoov.bodyEnd,box=>{
      if(box.type==='stco'){
        const count=output.readUInt32BE(box.bodyStart+4);
        for(let i=0;i<count;i++){
          const at=box.bodyStart+8+i*4;
          const value=output.readUInt32BE(at);
          if(value>=moov.bodyEnd)output.writeUInt32BE(value+grown,at);
        }
      }else if(box.type==='co64'){
        const count=output.readUInt32BE(box.bodyStart+4);
        for(let i=0;i<count;i++){
          const at=box.bodyStart+8+i*8;
          const value=output.readBigUInt64BE(at);
          if(value>=BigInt(moov.bodyEnd))output.writeBigUInt64BE(value+BigInt(grown),at);
        }
      }
    });
  }
  return {buffer:output,traks:traks.length,mdatBefore,mdatAfter,bytesAdded:grown};
}

export function readSphericalXml(buffer){
  const results=[];
  walk(buffer,0,buffer.length,box=>{
    if(box.type==='uuid'&&buffer.subarray(box.bodyStart,box.bodyStart+16).equals(SPHERICAL_UUID))
      results.push(buffer.toString('utf8',box.bodyStart+16,box.bodyEnd));
  });
  return results;
}
