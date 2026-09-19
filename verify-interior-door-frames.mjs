import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const {HOUSE_INTERIOR:data}=createRequire(import.meta.url)('./house-interior.js');
const CASING=.065,PROJECTION=.012,LINING=.025,LEAF=.04,GAP=.003;
const close=(a,b,message)=>assert(Math.abs(a-b)<1e-9,`${message}: ${a} vs ${b}`);
const doors=[];
for(const wall of data.intWalls)wall.openings.forEach((opening,index)=>{
  const model=data.buildOpening(wall,opening,index);
  if(!model||model.opening.kind!=='door')return;
  if(opening.reveal){
    assert(!model.parts.some(p=>/casing_/.test(p.name)),`${model.name}: a door set back in a stepped reveal keeps its block frame`);
    return;
  }
  doors.push({wall,opening,model});
});
assert.equal(doors.length,9,`Expected the nine standard interior doors, found ${doors.length}`);
let hinged=0,pocket=0;
for(const {wall,opening,model}of doors){
  const id=model.name,spec=model.opening;
  const alongX=wall.b[0]-wall.a[0]>wall.b[1]-wall.a[1],cross=alongX?1:0,along=alongX?0:1;
  const thickness=Math.abs(wall.b[cross]-wall.a[cross]),centre=(wall.a[cross]+wall.b[cross])/2;
  const low=centre-thickness/2,high=centre+thickness/2;
  const part=name=>model.parts.find(p=>p.name===`${id}_${name}`);
  const leaf=part('leaf');
  assert(leaf,`${id}: leaf`);
  const leafSize=alongX?[leaf.size[1],leaf.size[0]]:[leaf.size[0],leaf.size[1]];
  close(leafSize[0],LEAF,`${id}: Sapeli leaves are 40 mm thick`);
  const leafStart=leaf.position[along]-leafSize[1]/2,leafEnd=leaf.position[along]+leafSize[1]/2,leafTop=leaf.position[2]+leaf.size[2]/2;
  const openingStart=wall.a[along]+opening.at,openingEnd=openingStart+opening.w;
  for(const label of ['low','high']){
    const face=label==='low'?low:high,outer=label==='low'?low-PROJECTION:high+PROJECTION;
    const pieces=['north','south','head'].map(side=>part(`casing_${label}_${side}`));
    assert(pieces.every(piece=>piece?.type==='mesh'&&piece.material==='casing'),`${id}: three mitred casings on the ${label} face`);
    for(const piece of pieces){
      const crosses=piece.vertices.map(v=>v[cross]);
      close(Math.min(...crosses),Math.min(face,outer),`${id}: ${label} casing starts on the wall face`);
      close(Math.max(...crosses),Math.max(face,outer),`${id}: ${label} casing stands 12 mm proud`);
    }
    const [north,south,head]=pieces;
    const span=(piece,axis)=>[Math.min(...piece.vertices.map(v=>v[axis])),Math.max(...piece.vertices.map(v=>v[axis]))];
    const [n0,n1]=span(north,along),[s0,s1]=span(south,along),[h0,h1]=span(head,along),[hb,ht]=span(head,2);
    close(n1-n0,CASING,`${id}: jamb casing is 65 mm wide`);close(s1-s0,CASING,`${id}: jamb casing is 65 mm wide`);
    close(n1,leafStart-GAP,`${id}: casing edge clears the leaf by 3 mm`);close(s0,leafEnd+GAP,`${id}: casing edge clears the leaf by 3 mm`);
    close(hb,leafTop+GAP,`${id}: head casing clears the leaf top by 3 mm`);close(ht-hb,CASING,`${id}: head casing is 65 mm high`);
    close(h0,n0,`${id}: head casing runs to the outer jamb edge`);close(h1,s1,`${id}: head casing runs to the outer jamb edge`);
    const northTops=north.vertices.filter(v=>Math.abs(v[cross]-face)<1e-9).map(v=>[v[along],v[2]]).sort((a,b)=>a[0]-b[0]);
    const outerCorner=northTops.find(([u])=>Math.abs(u-n0)<1e-9),innerCorner=northTops.filter(([u])=>Math.abs(u-n1)<1e-9).sort((a,b)=>b[1]-a[1])[0];
    const outerTop=Math.max(...north.vertices.filter(v=>Math.abs(v[along]-n0)<1e-9).map(v=>v[2]));
    assert(outerCorner&&innerCorner,`${id}: mitre corners`);
    close(outerTop-innerCorner[1],n1-n0,`${id}: the head joint is a 45 degree mitre`);
    assert(n0<openingStart-1e-9&&s1>openingEnd+1e-9&&ht>opening.h+1e-9,`${id}: casings overlap the wall around the structural opening`);
    for(const piece of pieces)for(const face of piece.faces){
      const [a,b,c]=face.map(i=>piece.vertices[i]),u=b.map((v,i)=>v-a[i]),w=c.map((v,i)=>v-a[i]);
      const normal=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
      const centroid=piece.vertices.reduce((sum,v)=>sum.map((value,i)=>value+v[i]/piece.vertices.length),[0,0,0]);
      assert(normal.reduce((sum,value,i)=>sum+value*(a[i]-centroid[i]),0)>0,`${id}: casing faces wind outward`);
    }
  }
  const head=part('head');
  close(alongX?head.size[1]:head.size[0],thickness,`${id}: the lining spans the full wall thickness`);
  close(head.size[2],LINING,`${id}: head lining thickness`);
  assert(head.position[2]+head.size[2]/2<=opening.h+1e-9,`${id}: the lining stays inside the structural opening`);
  if(spec.pocket){
    pocket++;
    close(leaf.position[cross],centre,`${id}: a pocket leaf stays in the wall centre`);
    const missing=spec.pocketDirection<0?'jamb_north':'jamb_south',present=spec.pocketDirection<0?'jamb_south':'jamb_north';
    assert(!part(missing)&&part(present),`${id}: no lining across the pocket mouth`);
    assert.equal(model.doorMotion.kind,'slide');
  }else{
    hinged++;
    const side=spec.reverseSwing?1:-1,flush=side>0?high+PROJECTION:low-PROJECTION;
    close(leaf.position[cross]+side*LEAF/2,flush,`${id}: the rebateless leaf is flush with the casing on its opening side`);
    close(model.doorMotion.pivot[alongX?2:0],leaf.position[cross],`${id}: the hinge axis lies in the leaf plane`);
    assert(part('jamb_north')&&part('jamb_south'),`${id}: lining on both jambs`);
    for(const name of ['escutcheon_-1','escutcheon_1']){
      const plate=part(name);
      close(Math.abs(plate.position[cross]-leaf.position[cross]),LEAF/2+.006,`${id}: hardware follows the leaf`);
    }
  }
  assert(!model.doorMotion.movingParts.some(name=>/casing_|_jamb_|_head$/.test(name)),`${id}: the frame never moves`);
}
assert(hinged===7&&pocket===2,`Expected seven hinged doors and two pocket doors, found ${hinged} and ${pocket}`);
console.log(`Interior door frames: ${hinged} hinged and ${pocket} pocket doors carry a full-depth lining, 65 mm mitred casings 12 mm proud on both wall faces, flush rebateless leaves and fixed frames.`);
