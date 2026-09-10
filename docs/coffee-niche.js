export function buildCoffeeNicheUpper(data) {
  const f=data.coffeeNicheUpper||data.furniture.find(f=>f.label==='nika uppers');
  const parts=[],p=.019,y=f.y0,ceiling=y+f.h,division=ceiling-.650;
  const materials={green:{color:'#7f8a7d',roughness:.76},whiteBoard:{color:'#f3f2ed',roughness:.75}};
  const box=(name,x,z,bottom,w,d,h,material='whiteBoard')=>parts.push({
    name:`coffee_upper_${name}`,type:'box',position:[x+w/2,z+d/2,bottom+h/2],size:[w,d,h],material,bevel:.001,category:'furniture'});
  const depth=f.x1-f.x0,width=f.z1-f.z0,mid=(f.z0+f.z1)/2;
  box('top',f.x0,f.z0,ceiling-p,depth,width,p,'green');
  box('back',f.x0,f.z0+p,y,p,width-2*p,f.h-p);
  box('side_north',f.x0,f.z0,y,depth,p,f.h-p,'green');
  box('side_south',f.x0,f.z1-p,y,depth,p,f.h-p,'green');
  box('center',f.x0+p,mid-p/2,y,depth-p,p,f.h-p);
  for(const [column,a,b]of [[0,f.z0+p,mid-p/2],[1,mid+p/2,f.z1-p]]){
    box(`bottom_${column}`,f.x0+p,a,y,.381,b-a,p);
    box(`lower_shelf_${column}`,f.x0+p,a,y+p+.201,.381,b-a,p);
    box(`division_${column}`,f.x0+p,a,division,depth-p,b-a,p);
    const z=f.z0+column*.6+.001;
    box(`front_${column}_0`,f.x1,z,y-.010,p,.598,division-.001-(y-.010),'green');
    box(`front_${column}_1`,f.x1,z,division+.001,p,.598,ceiling-division-.001,'green');
  }
  return {name:'Coffee niche upper cabinet',floorHeight:0,parts,materials,lights:[],openingMechanism:'tip-on',
    notes:['The 170 mm lower-shelf dimension runs to the shelf lower face; the 19 mm shelf leaves 151 mm clear above it. Front row dimensions are nominal 400/650 mm with a 2 mm joint.']};
}
