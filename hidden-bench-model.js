const HiddenBenchModel=(()=>{
  function groundPatch(garden,grade){
    const footprint=garden.elements.find(e=>e.id==='zasivarna').parts.find(p=>p.kind==='rect');
    const cx=footprint.x+footprint.w/2,cy=footprint.y+footprint.d/2;
    return {x:cx-1,y:cy-.65,w:2,d:1.3,level:grade(cx,cy),blend:.8,southBlend:.15,surfaceOffset:.02};
  }
  function build(garden,terrainPlane){
    const footprint=garden.elements.find(e=>e.id==='zasivarna').parts.find(p=>p.kind==='rect');
    const x=footprint.x+(footprint.w-1.28)/2,y=footprint.y+(footprint.d-.70)/2,parts=[],feet=[];
    const grade=(px,py)=>typeof terrainPlane==='function'?terrainPlane(px,py):Math.max(0,terrainPlane.a*px+terrainPlane.b*py+terrainPlane.c);
    const pads=[];
    for(const [i,px]of[.015,1.265].entries())for(const[j,py]of[.025,.685].entries()){
      const x0=i?1.19:0,y0=j?.61:0;
      pads.push({i,j,px,py,corners:[[x+x0,y+y0],[x+x0+.09,y+y0],[x+x0+.09,y+y0+.09],[x+x0,y+y0+.09]]});
    }
    const patch=groundPatch(garden,grade),floorHeight=patch.level+patch.surfaceOffset;
    const materials={ironRed:{color:'#783d32',roughness:.52,metalness:.3},glider:{color:'#282321',roughness:.9},mineral:{color:'#a6a39a',roughness:1}};
    function mesh(name,vertices,faces,material='ironRed',smooth=false){
      let volume=0;const origin=vertices[0];
      for(const face of faces)for(let i=1;i<face.length-1;i++){
        const[a,b,c]=[face[0],face[i],face[i+1]].map(j=>vertices[j].map((v,k)=>v-origin[k]));
        volume+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
      }
      parts.push({name,type:'mesh',vertices,faces:volume<0?faces.map(f=>[...f].reverse()):faces,material,smooth,category:'furniture'});
    }
    const point=([px,py,pz])=>[x+px,y+py,pz];
    function tube(name,path,radius=.013,material='ironRed'){
      const vertices=[],faces=[],sides=12;
      for(let i=0;i<path.length;i++){
        const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],d=b.map((v,k)=>v-a[k]),length=Math.hypot(...d),t=d.map(v=>v/length);
        const reference=Math.abs(t[0])<.9?[1,0,0]:[0,1,0];
        const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
        const raw=cross(t,reference),n=raw.map(v=>v/Math.hypot(...raw)),q=cross(t,n);
        for(let j=0;j<sides;j++){
          const angle=j*Math.PI*2/sides;
          vertices.push(point(path[i].map((v,k)=>v+radius*(Math.cos(angle)*n[k]+Math.sin(angle)*q[k]))));
          if(i)faces.push([(i-1)*sides+j,(i-1)*sides+(j+1)%sides,i*sides+(j+1)%sides,i*sides+j]);
        }
      }
      faces.push(Array.from({length:sides},(_,i)=>sides-1-i),Array.from({length:sides},(_,i)=>(path.length-1)*sides+i));
      mesh(name,vertices,faces,material,true);
    }
    const bezier=(a,b,c,d,steps=12)=>Array.from({length:steps+1},(_,i)=>{const t=i/steps,s=1-t;return a.map((v,k)=>s*s*s*v+3*s*s*t*b[k]+3*s*t*t*c[k]+t*t*t*d[k]);});
    const profile=[
      ...bezier([.068,.359],[.002,.366],[.002,.446],[.072,.446]),
      ...bezier([.072,.446],[.18,.446],[.33,.417],[.39,.438]).slice(1),
      ...bezier([.39,.438],[.495,.464],[.505,.720],[.603,.780]).slice(1),
      ...bezier([.603,.780],[.615,.788],[.640,.787],[.667,.787]).slice(1),
    ];
    for(let rib=0;rib<23;rib++){
      const center=.084+rib*(1.112/22),polygon=[];
      for(const sign of [-1,1]){
        const edge=profile.map((p,i)=>{const a=profile[Math.max(0,i-1)],b=profile[Math.min(profile.length-1,i+1)],d=b.map((v,k)=>v-a[k]),length=Math.hypot(...d);return[p[0]-sign*d[1]/length*.0025,p[1]+sign*d[0]/length*.0025];});
        polygon.push(...(sign===-1?edge:edge.reverse()));
      }
      const vertices=[...polygon.map(([py,pz])=>point([center-.013,py,pz])),...polygon.map(([py,pz])=>point([center+.013,py,pz]))],n=polygon.length;
      const faces=[];
      for(let i=0;i<profile.length-1;i++)faces.push([i,i+1,n-2-i,n-1-i],[n+i,n+i+1,2*n-2-i,2*n-1-i]);
      for(let i=0;i<n;i++)faces.push([i,(i+1)%n,(i+1)%n+n,i+n]);
      mesh(`formed_rib_${rib}`,vertices,faces);
    }
    for(const [i,px]of[.015,1.265].entries()){
      tube(`front_leg_arm_${i}`,[[px,.025,.008],[px,.025,.615],...bezier([px,.025,.615],[px,.025,.659],[px,.050,.675],[px,.095,.675]),[px,.667,.675]]);
      tube(`rear_leg_${i}`,[[px,.685,.008],[px,.667,.735],...bezier([px,.667,.735],[px,.667,.780],[px,.667,.787],[i?1.125:.125,.667,.787])]);
      tube(`side_seat_rail_${i}`,[[px,.025,.350],[px,.677,.350]],.012);
    }
    tube('back_top_rail',[[.125,.667,.787],[1.125,.667,.787]],.013);
    tube('seat_front_rail',[[.015,.068,.357],[1.265,.068,.357]],.012);
    tube('lower_rear_rail',[[.015,.677,.350],[1.265,.677,.350]],.012);
    for(const p of pads){
      tube(`glider_${p.i}_${p.j}`,[[p.px,p.py,0],[p.px,p.py,.012]],.015,'glider');
      feet.push({name:`foot_${p.i}_${p.j}`,center:[x+p.px,y+p.py],bottomCorners:p.corners.map(c=>[...c,-patch.surfaceOffset]),topHeight:0});
    }
    const corners=[[patch.x,patch.y],[patch.x+patch.w,patch.y],[patch.x+patch.w,patch.y+patch.d],[patch.x,patch.y+patch.d]];
    mesh('bench_mineral_pad',[...corners.map(c=>[...c,-patch.surfaceOffset]),...corners.map(c=>[...c,0])],[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],'mineral');
    parts.at(-1).category='ground';
    return{name:'Palissade dining bench',product:'HAY Palissade Dining Bench',materials,parts,lights:[],floorHeight,footprint,feet,seatHeight:.45,backHeight:.80,facing:'N',
      dimensions:{width:1.28,depth:.70,height:.80,seatHeight:.45},groundPatch:patch,groundPatches:[patch],
      notes:['Iron-red powder-coated steel, 128×70×80 cm and 45 cm seat height. Curved steel ribs and tubular frame follow the product reference; rib spacing and tube gauges are visual approximations. The level mineral pad and grading are a landscape proposal.'],
      plantingClearances:[patch,{x:x-.1,y:y-.7,w:1.48,d:.7}]};
  }
  return{build,groundPatch};
})();
if(typeof module!=='undefined')module.exports={HiddenBenchModel};
