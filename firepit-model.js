const FirepitModel = (() => {
  function build(garden,terrainPlane) {
    const circle=garden.elements.find(e=>e.id==='firePit').parts.find(p=>p.kind==='circle');
    const {cx,cy,r}=circle,plane=(x,y)=>Math.max(0,terrainPlane.a*x+terrainPlane.b*y+terrainPlane.c);
    const floorHeight=plane(cx,cy),ground=(x,y)=>plane(x,y)-floorHeight;
    const parts=[],benches=[];
    const materials={
      gravel:{color:'#9a9180',roughness:0.99},gravelLight:{color:'#b5a994',roughness:0.98},
      stone:{color:'#817e72',roughness:0.96},stoneLight:{color:'#a29a88',roughness:0.95},stoneDark:{color:'#65665f',roughness:0.98},
      ash:{color:'#514d45',roughness:1},charcoal:{color:'#252622',roughness:0.99},charEnd:{color:'#514233',roughness:0.96},
      wood:{color:'#94714e',roughness:0.83,grain:'z'},woodLight:{color:'#a47e55',roughness:0.83,grain:'z'},
      steel:{color:'#555854',roughness:0.49,metalness:0.75},
      coal:{color:'#aa3d17',roughness:0.8,emissive:'#ec4b12',emissiveIntensity:1.1},
      flame:{color:'#ffb344',roughness:0.55,emissive:'#ff761b',emissiveIntensity:1.8},
    };
    for(const axis of ['x','y']) materials[`wood_${axis}`]={...materials.wood,grain:axis};
    const random=seed=>{const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n);};
    const mesh=(name,vertices,faces,material,category='structure',smooth=false)=>parts.push({name,type:'mesh',vertices,faces,material,category,smooth});
    const beam=(name,start,end,width,depth,material,category='furniture')=>parts.push({name,type:'beam',start,end,width,depth,material,category,bevel:0.003});
    const prismFaces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
    const drapedDisk=(name,radius,bottom,top,material)=>{
      const vertices=[],faces=[],segments=64;
      for(const z of [bottom,top]) {
        vertices.push([cx,cy,ground(cx,cy)+z]);
        for(let i=0;i<segments;i++) {const a=i*Math.PI*2/segments,x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius;vertices.push([x,y,ground(x,y)+z]);}
      }
      for(let i=0;i<segments;i++) {const a=i+1,b=(i+1)%segments+1,c=segments+1;faces.push([0,b,a],[c,a+c,b+c],[a,b,b+c,a+c]);}
      mesh(name,vertices,faces,material);
    };
    const chip=(name,x,y,radius,z,height,material,category='structure')=>{
      const vertices=[[x,y,z+height],[x,y,z-0.003]],faces=[];
      for(let i=0;i<6;i++) {const a=i*Math.PI/3,rr=radius*(0.8+random(i+x*7+y)*0.2);vertices.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr,z+height*0.2]);}
      for(let i=0;i<6;i++) {const a=i+2,b=(i+1)%6+2;faces.push([0,a,b],[1,b,a]);}
      mesh(name,vertices,faces,material,category);
    };
    drapedDisk('gravel_apron',r,-0.006,0.008,'gravel');
    for(let i=0;i<100;i++) {
      const a=random(i*3)*Math.PI*2,rr=Math.sqrt(0.55**2+random(i*3+1)*((r-0.035)**2-0.55**2));
      const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;
      chip(`gravel_${i}`,x,y,0.015+random(i*3+2)*0.012,ground(x,y)+0.008,0.006,'gravelLight');
    }
    for(let course=0;course<3;course++) for(let i=0;i<12;i++) {
      const a=(i+course*0.5)*Math.PI/6+0.008,b=a+Math.PI/6-0.016;
      const vertices=[],faces=[],base=course*0.09-0.006,top=base+0.09;
      for(const [layer,z] of [base,base+0.012,top-0.012,top].entries()) {
        const bevel=layer===0||layer===3?0.006:0;
        for(const [radius,angle] of [[0.33+bevel,a+bevel],[0.5-bevel,a+bevel],[0.5-bevel,b-bevel],[0.33+bevel,b-bevel]]) {
          const x=cx+Math.cos(angle)*radius,y=cy+Math.sin(angle)*radius;
          vertices.push([x,y,ground(x,y)+z]);
        }
      }
      faces.push([3,2,1,0],[12,13,14,15]);
      for(let layer=0;layer<3;layer++) for(let edge=0;edge<4;edge++) {
        const a=layer*4+edge,b=layer*4+(edge+1)%4;faces.push([a,b,b+4,a+4]);
      }
      mesh(`ring_course_${course}_stone_${i}`,vertices,faces,['stone','stoneLight','stoneDark'][(i+course)%3]);
    }
    drapedDisk('ash',0.329,0.004,0.018,'ash');
    for(let i=0;i<24;i++) {
      const a=random(i*5)*Math.PI*2,rr=Math.sqrt(random(i*5+1))*0.28,x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;
      chip(`ash_clod_${i}`,x,y,0.012+random(i*5+2)*0.012,ground(x,y)+0.018,0.007,i%3?'ash':'charcoal');
    }
    const logs=[];
    for(let i=0;i<3;i++) {
      const angle=0.25+i*0.15,dx=Math.cos(angle),dy=Math.sin(angle),offset=(i-1)*0.095;
      const x=cx-dy*offset,y=cy+dx*offset,length=i===1?0.47:0.39,radius=0.041;
      const start=[x-dx*length/2,y-dy*length/2],end=[x+dx*length/2,y+dy*length/2];
      const axis=[dx,dy,terrainPlane.a*dx+terrainPlane.b*dy],norm=Math.hypot(...axis),u=axis.map(n=>n/norm);
      const v=[-dy,dx,0],w=[-u[2]*dx,-u[2]*dy,Math.hypot(u[0],u[1])];
      const vertices=[],faces=[];
      for(const point of [start,end]) for(let j=0;j<12;j++) {
        const a=j*Math.PI/6,rr=radius*(0.92+random(i*40+j)*0.08);
        vertices.push([point[0]+rr*(Math.cos(a)*v[0]+Math.sin(a)*w[0]),point[1]+rr*(Math.cos(a)*v[1]+Math.sin(a)*w[1]),ground(...point)+0.054+rr*Math.sin(a)*w[2]]);
      }
      faces.push(Array.from({length:12},(_,j)=>11-j),Array.from({length:12},(_,j)=>12+j));
      for(let j=0;j<12;j++) faces.push([j,(j+1)%12,(j+1)%12+12,j+12]);
      mesh(`log_${i}`,vertices,faces,'charcoal');
      logs.push({name:`log_${i}`,start,end,radius,centerHeight:0.054});
      for(let j=0;j<3;j++) {
        const z=0.077+j*0.004,side=(j-1)*0.019;
        beam(`log_${i}_char_ridge_${j}`,[start[0]-dy*side,start[1]+dx*side,ground(...start)+z],
          [end[0]-dy*side,end[1]+dx*side,ground(...end)+z],0.007,0.007,j===1?'charEnd':'charcoal','structure');
      }
    }
    for(const [i,degrees] of [0,60,180,240,300].entries()) {
      const angle=degrees*Math.PI/180,radial=[Math.cos(angle),Math.sin(angle)],tangent=[-radial[1],radial[0]];
      const center=[cx+radial[0]*1.42,cy+radial[1]*1.42],seatHeight=ground(...center)+0.45,feet=[];
      const point=(u,v,z)=>[center[0]+tangent[0]*u+radial[0]*v,center[1]+tangent[1]*u+radial[1]*v,z];
      const timber=(name,u,v,length,depth,bottom,top,drape=false)=>{
        const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>point(u+a*length/2,v+b*depth/2,0));
        const direction=length>=depth?tangent:radial;
        const material=drape?'wood':Math.abs(direction[0])>Math.abs(direction[1])?'wood_x':'wood_y';
        mesh(name,[...corners.map(p=>[p[0],p[1],drape?ground(p[0],p[1]):bottom]),...corners.map(p=>[p[0],p[1],top])],prismFaces.map(face=>face.slice().reverse()),material,'furniture');
      };
      for(let j=0;j<3;j++) timber(`bench_${i}_seat_${j}`,0,(j-1)*0.116,1.14,0.108,seatHeight-0.04,seatHeight);
      for(const [j,[u,v]] of [[-0.43,-0.105],[-0.43,0.105],[0.43,-0.105],[0.43,0.105]].entries()) {
        const p=point(u,v,0);feet.push({center:p.slice(0,2),groundHeight:ground(p[0],p[1]),topHeight:seatHeight-0.04});
        timber(`bench_${i}_leg_${j}`,u,v,0.07,0.07,0,seatHeight-0.04,true);
        beam(`bench_${i}_brace_${j}`,point(u,v,seatHeight-0.19),point(u-Math.sign(u)*0.17,v,seatHeight-0.065),0.035,0.035,'wood');
      }
      for(const [j,v] of [-0.105,0.105].entries()) timber(`bench_${i}_apron_${j}`,0,v,0.93,0.035,seatHeight-0.13,seatHeight-0.04);
      for(const [j,u] of [-0.43,0.43].entries()) {
        timber(`bench_${i}_crossrail_${j}`,u,0,0.05,0.30,seatHeight-0.09,seatHeight-0.04);
        for(const [k,v] of [-0.105,0.105].entries()) {
          const p=point(u,v,seatHeight+0.001);
          parts.push({name:`bench_${i}_bolt_${j}_${k}`,type:'cylinder',position:p,radiusTop:0.007,radiusBottom:0.007,height:0.003,segments:12,material:'steel',category:'furniture'});
        }
      }
      benches.push({id:`bench_${i}`,angle:degrees,center,length:1.14,depth:0.34,seatHeight,feet});
    }
    for(let i=0;i<5;i++) {
      const x=cx+(i-2)*0.045,y=cy+Math.sin(i*2)*0.06,z=ground(x,y)+0.095,height=0.17+random(i)*0.14;
      const vertices=[],faces=[];
      for(let j=0;j<4;j++) {
        const t=j/3,rr=0.028*(1-t)+0.001,bend=Math.sin(t*Math.PI)*0.025;
        for(let k=0;k<6;k++) {const a=k*Math.PI/3;vertices.push([x+bend+Math.cos(a)*rr,y+Math.sin(a)*rr,z+t*height]);}
      }
      faces.push([5,4,3,2,1,0],[18,19,20,21,22,23]);
      for(let j=0;j<3;j++) for(let k=0;k<6;k++) faces.push([j*6+k,j*6+(k+1)%6,(j+1)*6+(k+1)%6,(j+1)*6+k]);
      mesh(`flame_${i}`,vertices,faces,'flame','fire',true);
      chip(`coal_${i}`,x,y,0.024,ground(x,y)+0.018,0.018,'coal','fire');
    }
    return {name:'Firepit',materials,parts,floorHeight,firecenter:[cx,cy],benches,logs,
      pit:{outerRadius:0.5,innerRadius:0.33,wallHeight:0.27,ashHeight:0.018},approach:{angle:120,width:50},
      categoryVisibility:{fire:false},lights:[{name:'fire_glow',position:[cx,cy,0.35],color:'#ff883b',power:35,category:'fire'}],
      plantingClearances:[{x:cx-r,y:cy-r,w:r*2,d:r*2},{x:cx-1.65,y:cy+1.15,w:1.15,d:1.15}]};
  }
  return {build};
})();
if(typeof module!=='undefined') module.exports={FirepitModel};
