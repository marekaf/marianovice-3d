const SurveySurface = (() => {
  const planeHeight = (plane, x, z) => Math.max(0, plane.a * x + plane.b * z + plane.c);
  const cross = (a, b, c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);

  function height(data, x, z) {
    const { points, triangles, hullEdges, fallbackPlane } = data;
    for (const [i,j,k] of triangles) {
      const a=points[i],b=points[j],c=points[k],area=cross(a,b,c);
      const wb=((x-a[0])*(c[1]-a[1])-(z-a[1])*(c[0]-a[0]))/area;
      const wc=((b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]))/area;
      const wa=1-wb-wc;
      if (wa >= -1e-10 && wb >= -1e-10 && wc >= -1e-10) return wa*a[2]+wb*b[2]+wc*c[2];
    }
    let distance=Infinity,residual=0;
    for (const [i,j] of hullEdges) {
      const a=points[i],b=points[j],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      const px=a[0]+t*dx,pz=a[1]+t*dz,d=Math.hypot(x-px,z-pz);
      if (d < distance) {
        distance=d;
        residual=a[2]+t*(b[2]-a[2])-planeHeight(fallbackPlane,px,pz);
      }
    }
    // Projection onto a convex hull is continuous, including where two edges meet.
    return planeHeight(fallbackPlane,x,z)+residual*Math.exp(-distance/data.extrapolationBlend);
  }

  function create(input, fallbackPlane) {
    if (!input || input.length < 3 || !input.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))
      throw new Error('Survey surface needs at least three finite [x, z, height] points');
    if (!fallbackPlane || !['a','b','c'].every(k=>Number.isFinite(fallbackPlane[k]))) throw new Error('Survey fallback plane must be finite');
    const points=input.map(p=>p.slice()).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    for(let i=1;i<points.length;i++) if(points[i][0]===points[i-1][0]&&points[i][1]===points[i-1][1]) throw new Error('Survey points must have distinct horizontal positions');
    const count=points.length,minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
    const minZ=Math.min(...points.map(p=>p[1])),maxZ=Math.max(...points.map(p=>p[1]));
    const span=Math.max(maxX-minX,maxZ-minZ),cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
    if (!(span>0)) throw new Error('Survey points must span a surface');
    // Shallow hull corners have circumcircles much larger than the survey extent.
    const work=[...points,[cx-65536*span,cz-32768*span,0],[cx+65536*span,cz-32768*span,0],[cx,cz+65536*span,0]];
    let triangles=[[count,count+1,count+2]];
    const inCircle=(triangle,p)=>{
      const [a,b,c]=triangle.map(i=>work[i]);
      const ax=a[0]-p[0],ay=a[1]-p[1],bx=b[0]-p[0],by=b[1]-p[1],cx=c[0]-p[0],cy=c[1]-p[1];
      return (ax*ax+ay*ay)*(bx*cy-by*cx)-(bx*bx+by*by)*(ax*cy-ay*cx)+(cx*cx+cy*cy)*(ax*by-ay*bx)>0;
    };
    for(let i=0;i<count;i++) {
      const bad=new Set(),edges=new Map();
      for(let j=0;j<triangles.length;j++) if(inCircle(triangles[j],work[i])) {
        bad.add(j);
        const tri=triangles[j];
        for(let e=0;e<3;e++) {
          const a=tri[e],b=tri[(e+1)%3],key=Math.min(a,b)+','+Math.max(a,b);
          if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);
        }
      }
      triangles=triangles.filter((_,j)=>!bad.has(j));
      for(const [a,b] of edges.values()) {
        const area=cross(work[a],work[b],work[i]);
        if(Math.abs(area)>span*span*1e-14)triangles.push(area>0?[a,b,i]:[b,a,i]);
      }
    }
    triangles=triangles.filter(tri=>tri.every(i=>i<count));
    if(!triangles.length)throw new Error('Survey points must not be collinear');
    const edges=new Map();
    for(const tri of triangles)for(let e=0;e<3;e++) {
      const a=tri[e],b=tri[(e+1)%3],key=Math.min(a,b)+','+Math.max(a,b);
      if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);
    }
    const hullEdges=[...edges.values()];
    if (new Set(triangles.flat()).size !== count || hullEdges.some(([a,b])=>points.some(p=>cross(points[a],points[b],p)<-span*span*1e-12)))
      throw new Error('Survey triangulation could not resolve its convex boundary');
    const data={points,triangles,hullEdges,fallbackPlane:{...fallbackPlane},extrapolationBlend:10};
    return {data,height:(x,z)=>height(data,x,z)};
  }
  return { create, height };
})();
if (typeof module !== 'undefined') module.exports = { SurveySurface };
