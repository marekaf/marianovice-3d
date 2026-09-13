import {buildEntranceInterior} from './entrance-interior.js';

const mm=value=>String(Math.round(value*1000));
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const vertices=part=>part.vertices??Array.from({length:8},(_,i)=>part.position.map((v,a)=>v+part.size[a]/2*(i&(1<<a)?1:-1)));
const bounds=parts=>{const points=parts.flatMap(vertices);return {min:[0,1,2].map(a=>Math.min(...points.map(p=>p[a]))),max:[0,1,2].map(a=>Math.max(...points.map(p=>p[a])))};};

function hull(points) {
  const sorted=[...new Map(points.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=list=>{const result=[];for(const p of list){while(result.length>1&&cross(result.at(-2),result.at(-1),p)<=0)result.pop();result.push(p);}return result;};
  return [...half(sorted).slice(0,-1),...half(sorted.reverse()).slice(0,-1)];
}

export function entranceDrawing(data) {
  const {model}=buildEntranceInterior(data);
  const opposite=part=>/^entrance_coat_(shelf|hook_)/.test(part.name);
  const main=model.parts.filter(p=>!opposite(p)),hooks=model.parts.filter(opposite);
  const extent=bounds(main),hookExtent=bounds(hooks),part=name=>model.parts.find(p=>p.name===name);
  const dimensions=[],width=1400,height=1050,scale=220;
  const content=[];
  const line=(x1,y1,x2,y2,style='')=>content.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${style}/>`);
  const text=(x,y,value,anchor='start',size=18)=>content.push(`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}">${escape(value)}</text>`);
  function dimension(id,a,b,value,label=mm(value)) {
    dimensions.push({id,value,label});
    const vertical=a[0]===b[0],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
    content.push(`<g data-dimension="${id}" data-metres="${value}">`);
    line(...a,...b);
    for(const p of [a,b])line(p[0]-4,p[1]+5,p[0]+4,p[1]-5);
    content.push(`<text x="${mx}" y="${my-8}" text-anchor="middle" class="dimension"${vertical?` transform="rotate(-90 ${mx} ${my})"`:''}>${escape(label)}</text></g>`);
  }
  function view(parts,axis,project,depthAxis,direction=1) {
    for(const p of [...parts].sort((a,b)=>direction*(bounds([a]).max[depthAxis]-bounds([b]).max[depthAxis]))){
      const outline=hull(vertices(p).map(v=>project(v[0],v[axis])));
      content.push(`<polygon data-part="${escape(p.name)}" points="${outline.map(p=>p.join(',')).join(' ')}" fill="${model.materials[p.material].color}" stroke-width="0.8"/>`);
    }
  }
  text(70,50,'Vstupní nábytek · rozměry','start',28);
  text(1330,50,'mm','end',20);
  text(100,105,'Čelní pohled','start',21);
  const fx=x=>100+(x-extent.min[0])*scale,fy=y=>720-y*scale;
  view(main,2,(x,y)=>[fx(x),fy(y)],1);
  line(fx(extent.min[0])-15,fy(0),fx(extent.max[0])+15,fy(0),'stroke="#999"');
  const overallY=150;
  for(const x of [extent.min[0],extent.max[0]])line(fx(x),overallY-8,fx(x),fy(bounds(main).max[2])-10,'stroke="#aaa"');
  dimension('overall-width',[fx(extent.min[0]),overallY],[fx(extent.max[0]),overallY],extent.max[0]-extent.min[0]);
  const heightX=fx(extent.max[0])+48;
  for(const y of [0,extent.max[2]])line(fx(extent.max[0])+10,fy(y),heightX+10,fy(y),'stroke="#aaa"');
  dimension('overall-height',[heightX,fy(0)],[heightX,fy(extent.max[2])],extent.max[2]);
  const fronts=main.filter(p=>/sloped_front|entrance_coat_door|entrance_upper_door_1/.test(p.name));
  for(const p of fronts){const b=bounds([p]);dimension(p.name+'-width',[fx(b.min[0]),752],[fx(b.max[0]),752],b.max[0]-b.min[0]);}
  text(100,790,'Šířky čel','start',16);
  text(100,845,'Půdorys','start',21);
  const py=z=>870+(z-extent.min[1])*scale;
  view(main,1,(x,z)=>[fx(x),py(z)],2);
  dimension('overall-depth',[heightX,py(extent.min[1])],[heightX,py(extent.max[1])],extent.max[1]-extent.min[1]);
  text(1080,105,'Protější věšák','start',21);
  const hx=x=>1090+(x-hookExtent.min[0])*180,hy=y=>580-y*180;
  view(hooks,2,(x,y)=>[hx(x),hy(y)],1,-1);
  dimension('coat-width',[hx(hookExtent.min[0]),hy(hookExtent.max[2])-30],[hx(hookExtent.max[0]),hy(hookExtent.max[2])-30],hookExtent.max[0]-hookExtent.min[0]);
  dimension('coat-top-height',[1290,hy(0)],[1290,hy(hookExtent.max[2])],hookExtent.max[2]);
  line(1070,hy(0),1310,hy(0),'stroke="#999"');
  text(1060,635,'Detail','start',21);
  const rows=[
    ['Sedák · šířka',part('entrance_seat_top').size[0]],
    ['Sedák · hloubka',part('entrance_seat_top').size[1]],
    ['Sedák · horní hrana',bounds([part('entrance_seat_top')]).max[2]],
    ['Polstr · horní hrana',bounds([part('entrance_seat_cushion')]).max[2]],
    ['Zrcadlo · šířka',part('entrance_full_length_mirror').size[0]],
    ['Zrcadlo · výška',part('entrance_full_length_mirror').size[2]],
    ['Panel věšáku · výška',part('entrance_coat_hook_panel').size[2]],
    ['Police věšáku · hloubka',part('entrance_coat_shelf').size[1]],
  ];
  rows.forEach(([label,value],i)=>{text(1060,675+i*30,label,'start',16);text(1330,675+i*30,mm(value),'end',18);dimensions.push({id:label,value,label:mm(value)});});
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>Vstupní nábytek · rozměry</title><style>text{font-family:Arial,sans-serif;fill:#26312f;stroke:none}line,polygon{stroke:#4e5551;stroke-width:1;stroke-linejoin:round}text.dimension{font-size:18px;paint-order:stroke;stroke:#fff;stroke-width:6px;stroke-linejoin:round}</style><rect width="${width}" height="${height}" fill="white"/>${content.join('')}</svg>`;
  return {svg,width,height,dimensions};
}

export async function downloadEntranceDrawing(data) {
  const drawing=entranceDrawing(data),url=URL.createObjectURL(new Blob([drawing.svg],{type:'image/svg+xml'}));
  try {
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Could not render entrance drawing'));image.src=url;});
    const canvas=document.createElement('canvas');canvas.width=drawing.width*2;canvas.height=drawing.height*2;
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!png)throw new Error('Could not export entrance drawing');
    const target=URL.createObjectURL(png),link=document.createElement('a');link.href=target;link.download='vstupni-nabytek-rozmery.png';link.click();
    setTimeout(()=>URL.revokeObjectURL(target),1000);
  } finally {URL.revokeObjectURL(url);}
}
