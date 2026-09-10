const FurnitureModel = (() => {
  function build(list, floorHeight = 0) {
    const materials = {
      wood: { color: '#8a6a44', roughness: 0.7, grain: 'x' },
      carc: { color: '#b59a6f', roughness: 0.7, grain: 'z' },
      front: { color: '#f2f0ea', roughness: 0.5 },
      appliance: { color: '#565b60', roughness: 0.4, metalness: 0.3 },
      ceramic: { color: '#ffffff', roughness: 0.15 },
      glass: { color: '#e7f0ef', roughness: 0.025, transmission: 1, thickness: .008 },
      mirror: { color: '#cfdde6', metalness: 0.3, roughness: 0.08 },
      plinth: { color: '#2b2b2b', roughness: 0.8 },
      mattress: { color: '#eeeae0', roughness: 0.94 },
      green: { color: '#7f8a7d', roughness: 0.76 },
      greenMatt: { color: '#7f8a7d', roughness: 0.9 },
      cashmere: { color: '#b8b2a7', roughness: 0.75 },
      cashmereTop: { color: '#b8b2a7', roughness: 0.45 },
      whiteBoard: { color: '#f3f2ed', roughness: 0.75 },
      stone: { color: '#dcd9d2', roughness: 0.35 },
      hardware: { color: '#babfbe', metalness: 0.88, roughness: 0.2 },
      graphite: { color: '#404746', metalness: 0.85, roughness: 0.27 },
      grip: { color: '#17191a', metalness: 0.65, roughness: 0.32 },
      ovenGlass: { color: '#11171b', metalness: 0.25, roughness: 0.14 },
    };
    const parts = [];
    const box = (name, x0, y0, z0, width, depth, height, material, bevel = 0.003) => {
      parts.push({ name, type: 'box', position: [x0 + width / 2, y0 + depth / 2, z0 + height / 2],
        size: [width, depth, height], material, bevel, category: 'furniture' });
    };
    const cylinder = (name, position, radius, height, material, axis = 'z') => {
      parts.push({ name, type: 'cylinder', position, radiusTop: radius, radiusBottom: radius,
        height, axis, material, category: 'furniture', segments: 24 });
    };
    const cutSlab = (name, x0, y0, z0, width, depth, height, material, cutouts, bevel) => {
      if (!cutouts?.length) return box(name, x0, y0, z0, width, depth, height, material, bevel);
      const x1 = x0 + width, y1 = y0 + depth;
      const cuts = cutouts.map(cut => ({ x0: Math.max(x0, cut.x0), x1: Math.min(x1, cut.x1),
        z0: Math.max(y0, cut.z0), z1: Math.min(y1, cut.z1) })).filter(cut => cut.x0 < cut.x1 && cut.z0 < cut.z1);
      const xs = [...new Set([x0, x1, ...cuts.flatMap(cut => [cut.x0, cut.x1])])].sort((a, b) => a - b);
      const ys = [...new Set([y0, y1, ...cuts.flatMap(cut => [cut.z0, cut.z1])])].sort((a, b) => a - b);
      for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
        const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
        if (cuts.some(cut => cx > cut.x0 && cx < cut.x1 && cy > cut.z0 && cy < cut.z1)) continue;
        box(`${name}_${i}_${j}`, xs[i], ys[j], z0, xs[i + 1] - xs[i], ys[j + 1] - ys[j], height, material, 0);
      }
    };
    const shell = (name, cx, cy, rx, ry, profile, material) => {
      const segments = 48, vertices = [], faces = [];
      for (const [radius, height] of profile) for (let i = 0; i < segments; i++) {
        const angle = i * Math.PI * 2 / segments;
        vertices.push([cx + rx * radius * Math.cos(angle), cy + ry * radius * Math.sin(angle), height]);
      }
      for (let j = 0; j < profile.length - 1; j++) for (let i = 0; i < segments; i++) {
        const a = j * segments + i, b = j * segments + (i + 1) % segments;
        faces.push([a, b, b + segments, a + segments]);
      }
      parts.push({ name, type: 'mesh', vertices, faces, material, smooth: true, category: 'furniture' });
    };
    const mat = (value, fallback) => materials[value] ? value : fallback;
    for (const [index, f] of list.entries()) {
      const prefix = `fixture_${index}`;
      const x = f.x0, y = f.z0, z = f.y0 ?? 0, w = f.x1 - x, d = f.z1 - y, h = f.h;
      if (f.kind === 'cab') {
        const fronts = Array.isArray(f.front) ? f.front : f.front ? [f.front] : [];
        const alongX = !fronts.length || fronts[0] === 'N' || fronts[0] === 'S';
        const modules = f.modules || [alongX ? w : d], tags = f.tags || modules.map(() => 'd');
        const plinth = f.plinth || 0, panel = Math.min(0.018, w / 8, d / 8, (h - plinth) / 8);
        const carc = mat(f.cmat, 'carc'), frontMat = mat(f.fmat, 'front');
        const interior = mat(f.imat, carc);
        const base = z + plinth, bodyH = h - plinth;
        if (plinth > 0) {
          const west = fronts.includes('W') ? 0.05 : 0, east = fronts.includes('E') ? 0.05 : 0;
          const north = fronts.includes('N') ? 0.05 : 0, south = fronts.includes('S') ? 0.05 : 0;
          box(`${prefix}_plinth`, x + west, y + north, z, w - west - east, d - north - south, plinth, 'plinth');
        }
        box(`${prefix}_bottom`, x, y, base, w, d, panel, carc);
        cutSlab(`${prefix}_top`, x, y, z + h - panel, w, d, panel, carc, f.worktop?.cutouts, 0.003);
        const section = (name, at, thickness, material = carc, divider = false) => {
          const inset = divider && f.drawerRows ? .04 : 0;
          if (alongX) box(name, at, y + (fronts.includes('N') ? inset : 0), base + panel, thickness, d-inset, bodyH-2*panel, material);
          else box(name, x + (fronts.includes('W') ? inset : 0), at, base + panel, w-inset, thickness, bodyH-2*panel, material);
        };
        section(`${prefix}_side_0`, alongX ? x : y, panel);
        section(`${prefix}_side_1`, (alongX ? x + w : y + d) - panel, panel);
        const runStart = alongX ? x : y;
        let cursor = runStart;
        for (const [i, width] of modules.entries()) {
          const next = cursor + width;
          if (i < modules.length - 1) section(`${prefix}_divider_${i}`, next - panel / 2, panel, interior, true);
          const left = cursor + (i === 0 ? panel : panel / 2), right = next - (i === modules.length - 1 ? panel : panel / 2);
          const tag = tags[i];
          if (tag === 'f') {
            if (alongX) box(`${prefix}_filler_${i}`, left, y, base + panel, right - left, d, bodyH - 2 * panel, carc);
            else box(`${prefix}_filler_${i}`, x, left, base + panel, w, right - left, bodyH - 2 * panel, carc);
          } else if (!f.drawerRows && tag !== 's' && !(tag === 'a' && f.appliances?.[i] === 'oven')) {
            const shelfCount = Math.max(1, Math.floor(bodyH / 0.5));
            for (let j = 0; j < shelfCount; j++) {
              const shelfZ = base + (j + 1) * bodyH / (shelfCount + 1);
              if (alongX) box(`${prefix}_shelf_${i}_${j}`, left, y + panel, shelfZ, right - left, d - 2 * panel, panel, interior);
              else box(`${prefix}_shelf_${i}_${j}`, x + panel, left, shelfZ, w - 2 * panel, right - left, panel, interior);
            }
          }
          cursor = next;
        }
        const closedBacks = alongX ? ['N', 'S'] : ['W', 'E'];
        for (const face of closedBacks.filter(face => !fronts.includes(face))) {
          if (face === 'N' || face === 'S') box(`${prefix}_back_${face}`, x + panel, face === 'N' ? y : y + d - panel,
            base + panel, w - 2 * panel, panel, bodyH - 2 * panel, carc);
          else box(`${prefix}_back_${face}`, face === 'W' ? x : x + w - panel, y + panel,
            base + panel, panel, d - 2 * panel, bodyH - 2 * panel, carc);
        }
        if (interior !== carc) {
          const skin = 0.0005, innerW = w - 2 * panel, innerD = d - 2 * panel;
          box(`${prefix}_inner_bottom`, x + panel, y + panel, base + panel,
            innerW, innerD, skin, interior, 0);
          cutSlab(`${prefix}_inner_top`, x + panel, y + panel, z + h - panel - skin,
            innerW, innerD, skin, interior, f.worktop?.cutouts, 0);
          for (const face of ['N', 'S', 'W', 'E'].filter(face => !fronts.includes(face))) {
            if (face === 'N' || face === 'S') box(`${prefix}_inner_${face}`, x + panel,
              face === 'N' ? y + panel : y + d - panel - skin, base + panel,
              innerW, skin, bodyH - 2 * panel, interior, 0);
            else box(`${prefix}_inner_${face}`, face === 'W' ? x + panel : x + w - panel - skin,
              y + panel, base + panel, skin, innerD, bodyH - 2 * panel, interior, 0);
          }
        }
        for (const face of fronts) {
          if (f.drawerRows && f.handle === 'gola-c') {
            const across = face === 'N' || face === 'S';
            const outward = face === 'N' || face === 'W' ? -1 : 1;
            const edge = face === 'N' ? y : face === 'S' ? y+d : face === 'W' ? x : x+w;
            const faceBox = (name, at, span, heightAt, height, depthAt, depth, material) => box(name,
              across ? at : depthAt, across ? depthAt : at, heightAt,
              across ? span : depth, across ? depth : span, height, material, .001);
            // Channel clearance and metal thickness illustrate the recessed section, not a fabrication specification.
            const gap=.04, metal=.002, channelDepth=.03;
            let heightAt=base;
            for (const [row,rowHeight] of f.drawerRows.entries()) {
              let at=runStart;
              const bottomGap=row ? gap/2 : .005;
              const topGap=row<f.drawerRows.length-1 ? gap/2 : .005;
              for (const [column,width] of modules.entries()) {
                faceBox(`${prefix}_front_${face}_${column}_${row}`,at+.005,width-.01,
                  heightAt+bottomGap,rowHeight-bottomGap-topGap,edge+(outward<0?-.012:-.006),.018,frontMat);
                if (interior !== carc) faceBox(`${prefix}_inner_front_${face}_${column}_${row}`,at+.005,width-.01,
                  heightAt+bottomGap,rowHeight-bottomGap-topGap,edge+(outward<0?.006:-.0065),.0005,interior);
                at+=width;
              }
              heightAt+=rowHeight;
              if (row<f.drawerRows.length-1) {
                const endInset=panel+(interior!==carc?.0005:0);
                const span=(across?w:d)-2*endInset, depthAt=outward<0?edge+.006:edge-.006-channelDepth;
                const backAt=outward<0?depthAt+channelDepth-metal:depthAt;
                faceBox(`${prefix}_golaC_${face}_${row}_back`,runStart+endInset,span,heightAt-gap/2,gap,backAt,metal,'whiteBoard');
                for (const [name,level] of [['bottom',heightAt-gap/2],['top',heightAt+gap/2-metal]])
                  faceBox(`${prefix}_golaC_${face}_${row}_${name}`,runStart+endInset,span,level,metal,depthAt,channelDepth,'whiteBoard');
              }
            }
            continue;
          }
          const golaGap = f.handle === 'gola' ? Math.min(0.04, bodyH * 0.12) : 0;
          const bottomGrip = f.golaEdge === 'bottom';
          if (golaGap) {
            const across = face === 'N' || face === 'S';
            box(`${prefix}_gola_${face}`, across ? x : face === 'W' ? x + 0.012 : x + w - 0.02,
              across ? face === 'N' ? y + 0.012 : y + d - 0.02 : y,
              bottomGrip ? base + 0.005 : z + h - golaGap - 0.005,
              across ? w : 0.008, across ? 0.008 : d, golaGap, 'grip', 0.001);
          }
          let at = runStart;
          for (const [i, width] of modules.entries()) {
            const start = at + 0.005, span = width - 0.01;
            at += width;
            if (tags[i] === 'o' || tags[i] === 'f') continue;
            const surface = tags[i] === 'a' ? 'appliance' : frontMat;
            const frontX = face === 'W' ? x - 0.012 : face === 'E' ? x + w - 0.006 : start;
            const frontY = face === 'N' ? y - 0.012 : face === 'S' ? y + d - 0.006 : start;
            const across = face === 'N' || face === 'S';
            const frontW = across ? span : 0.018, frontD = across ? 0.018 : span;
            const frontZ = base + 0.005 + (bottomGrip ? golaGap : 0), frontH = bodyH - 0.01 - golaGap;
            box(`${prefix}_front_${face}_${i}`, frontX, frontY, frontZ, frontW, frontD, frontH, surface, 0.002);
            if (interior !== carc && tags[i] !== 'a') {
              const skin = 0.0005;
              box(`${prefix}_inner_front_${face}_${i}`,
                across ? frontX : face === 'W' ? frontX + frontW : frontX - skin,
                across ? face === 'N' ? frontY + frontD : frontY - skin : frontY,
                frontZ, across ? frontW : skin, across ? skin : frontD, frontH, interior, 0);
            }
            const oven = tags[i] === 'a' && f.appliances?.[i] === 'oven';
            if (oven) {
              const panelAt = face === 'N' ? frontY - 0.003 : face === 'S' ? frontY + frontD : face === 'W' ? frontX - 0.003 : frontX + frontW;
              const appliancePanel = (name, inset, zz, hh, material) => box(`${prefix}_oven_${name}_${face}_${i}`,
                across ? start + inset : panelAt, across ? panelAt : start + inset, zz,
                across ? span - 2 * inset : 0.003, across ? 0.003 : span - 2 * inset, hh, material, 0.001);
              appliancePanel('glass', span * 0.08, frontZ + frontH * 0.14, frontH * 0.6, 'ovenGlass');
              appliancePanel('controls', span * 0.06, frontZ + frontH * 0.82, frontH * 0.12, 'grip');
            }
            if (!oven && (f.handle === 'gola' || f.handle === 'push')) continue;
            const pullW = Math.min(0.16, span * 0.55), pullZ = f.handleHeight ?? frontZ + frontH - Math.min(0.055, frontH * 0.2);
            const edge = face === 'N' ? frontY : face === 'S' ? frontY + frontD : face === 'W' ? frontX : frontX + frontW;
            const outward = face === 'N' || face === 'W' ? -1 : 1;
            const gripAt = edge + outward * 0.009, center = start + span / 2;
            cylinder(`${prefix}_pull_${face}_${i}`, across ? [center,gripAt,pullZ] : [gripAt,center,pullZ],
              0.004, pullW, 'hardware', across ? 'x' : 'y');
            for (const [j, along] of [center-pullW/2+0.004,center+pullW/2-0.004].entries()) {
              const mountAt = edge + outward * 0.004;
              cylinder(`${prefix}_pull_mount_${face}_${i}_${j}`, across ? [along,mountAt,pullZ] : [mountAt,along,pullZ],
                0.004, 0.012, 'hardware', across ? 'y' : 'x');
            }
          }
        }
        if (f.worktop) {
          const top = typeof f.worktop === 'object' ? f.worktop : {
            x0: x - (fronts.includes('W') ? 0.02 : 0), x1: x + w + (fronts.includes('E') ? 0.02 : 0),
            z0: y - (fronts.includes('N') ? 0.02 : 0), z1: y + d + (fronts.includes('S') ? 0.02 : 0), th: f.worktop,
          };
          cutSlab(`${prefix}_worktop`, top.x0, top.z0, z + h, top.x1 - top.x0, top.z1 - top.z0,
            top.th, mat(f.wmat, 'wood'), top.cutouts, 0.006);
        }
      } else if (f.kind === 'slab' || f.kind === 'glass') {
        box(`${prefix}_${f.kind}`, x, y, z, w, d, h, f.kind === 'glass' ? 'glass' : mat(f.mat, 'wood'), f.kind === 'glass' ? 0 : 0.004);
      } else if (f.kind === 'fix') {
        const cx = x + w / 2;
        if (f.type === 'wc') {
          const cy = y + d * 0.52, rim = z + h * 0.95;
          shell(`${prefix}_pedestal`, cx, cy, w * 0.3, d * 0.25,
            [[0,z], [0.83,z], [1,z+h*0.04], [0.75,z+h*0.42], [0.95,z+h*0.58], [0,z+h*0.58]], 'ceramic');
          shell(`${prefix}_bowl`, cx, cy, w * 0.49, d * 0.46,
            [[0,z+h*0.42], [0.5,z+h*0.42], [0.85,z+h*0.65], [1,rim-h*0.03], [0.98,rim],
              [0.76,rim], [0.7,rim-h*0.07], [0.32,z+h*0.55], [0,z+h*0.55]], 'ceramic');
          shell(`${prefix}_seat`, cx, cy, w * 0.49, d * 0.46,
            [[0.78,rim], [1,rim], [1,z+h], [0.78,z+h], [0.78,rim]], 'front');
          for (const [i, px] of [cx - w * 0.14,cx + w * 0.14].entries()) cylinder(`${prefix}_seat_hinge_${i}`,
            [px, y + d * 0.14, rim + h * 0.017], w * 0.025, h * 0.034, 'hardware');
        } else {
          const bath = f.type === 'bath', cy = y + d / 2, rim = z + h * 0.8;
          const rx = w * 0.49, ry = d * 0.49, inner = bath ? 0.85 : 0.77;
          shell(`${prefix}_${bath ? 'bath' : 'basin'}`, cx, cy, rx, ry,
            [[0,z], [0.65,z], [0.82,z+h*0.05], [1,rim-h*0.06], [1,rim-h*0.015], [0.98,rim],
              [inner,rim], [inner-0.025,rim-h*0.06], [0.53,z+h*0.18], [0,z+h*0.18]], 'ceramic');
          cylinder(`${prefix}_drain`, [cx,cy,z+h*0.186], Math.min(w,d)*0.032, h*0.012, 'hardware');
          if(f.tap?.mount==='wall'){
            const {wall,wallAt,height,reach}=f.tap;
            const south=wall==='S',axis=south?'y':'x',along=south?cx:cy;
            const point=(u,v,zz)=>south?[u,wallAt-v,zz]:[wallAt-v,u,zz];
            cylinder(`${prefix}_wall_tap_spout_plate`,point(along,.004,height),.0325,.008,'graphite',axis);
            cylinder(`${prefix}_wall_tap_spout`,point(along,reach/2,height),.012,reach,'graphite',axis);
            cylinder(`${prefix}_wall_tap_outlet`,point(along,reach-.013,height-.014),.012,.028,'graphite');
            const control=along+(south?-.15:.15);
            cylinder(`${prefix}_wall_tap_control_plate`,point(control,.004,height),.0325,.008,'graphite',axis);
            cylinder(`${prefix}_wall_tap_control`,point(control,.023,height),.022,.038,'graphite',axis);
            cylinder(`${prefix}_wall_tap_lever`,point(control,.04,height+.055),.0045,.11,'graphite');
          }else{
          const tapY = y + d * 0.065, tapRadius = Math.min(w * 0.017, d * 0.022, h * 0.03);
          cylinder(`${prefix}_tap_base`, [cx,tapY,rim+h*0.012], tapRadius*1.5,h*0.025,'hardware');
          cylinder(`${prefix}_tap_stem`, [cx,tapY,rim+h*0.1],tapRadius,h*0.2,'hardware');
          cylinder(`${prefix}_tap_spout`, [cx,tapY+d*0.07,z+h*0.95],tapRadius,d*0.14,'hardware','y');
          cylinder(`${prefix}_tap_outlet`, [cx,tapY+d*0.14,z+h*0.923],tapRadius,h*0.05,'hardware');
          box(`${prefix}_tap_lever`, cx - tapRadius, tapY - tapRadius, z + h * 0.985,
            tapRadius * 2, Math.min(d * 0.08, 0.06), h * 0.015, 'hardware', 0.002);
          }
        }
      } else if (f.kind === 'bed') {
        const head = f.head || 'N', sideways = head === 'E' || head === 'W';
        const length = sideways ? w : d, width = sideways ? d : w;
        const point = (u, v, zz) => head === 'N' ? [x+u,y+v,z+zz] : head === 'S' ? [x+w-u,y+d-v,z+zz]
          : head === 'W' ? [x+v,y+d-u,z+zz] : [x+w-v,y+u,z+zz];
        const fabricHeight = (u, v, thickness) => thickness * (0.38 + Math.sin(Math.PI*u)*Math.sin(Math.PI*v)
          * (0.49 + 0.09 * Math.sin(u*17+v*7)*Math.sin(v*19-u*3)));
        const fabric = (name, u0, v0, z0, ww, dd, hh, material, pillow = false, support = () => 0) => {
          const vertices = [], faces = [];
          if (pillow) {
            const rings = 16, segments = 32;
            const rounded = value => Math.sign(value) * Math.abs(value) ** 0.45;
            for (let j = 0; j <= rings; j++) {
              const latitude = -Math.PI / 2 + j * Math.PI / rings;
              for (let i = 0; i < segments; i++) {
                const longitude = i * Math.PI * 2 / segments, radial = Math.cos(latitude) ** 0.55;
                vertices.push(point(u0 + ww / 2 + ww / 2 * radial * rounded(Math.cos(longitude)),
                  v0 + dd / 2 + dd / 2 * radial * rounded(Math.sin(longitude)),
                  z0 + hh / 2 * (1 + Math.sin(latitude))));
              }
            }
            for (let j = 0; j < rings; j++) for (let i = 0; i < segments; i++) {
              const a = j * segments + i, b = j * segments + (i + 1) % segments;
              faces.push([a,b,b+segments,a+segments]);
            }
          } else {
            const cols = 24, rows = 28, stride = cols + 1, count = stride * (rows + 1);
            for (let layer = 0; layer < 2; layer++) for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
              const u = i / cols, v = j / rows;
              const height = layer === 0 ? 0 : fabricHeight(u, v, hh);
              vertices.push(point(u0+u*ww,v0+v*dd,z0+support(u,v)+height));
            }
            for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
              const a = j*stride+i, b = a+1, c = a+stride+1, e = a+stride;
              faces.push([a,e,c,b], [a+count,b+count,c+count,e+count]);
            }
            const edge = [...Array.from({length:cols},(_,i)=>i), ...Array.from({length:rows},(_,j)=>j*stride+cols),
              ...Array.from({length:cols},(_,i)=>rows*stride+cols-i), ...Array.from({length:rows},(_,j)=>(rows-j)*stride)];
            for(let i=0;i<edge.length;i++) { const a=edge[i], b=edge[(i+1)%edge.length]; faces.push([a,b,b+count,a+count]); }
          }
          parts.push({ name: `${prefix}_${name}`, type: 'mesh', vertices, faces, smooth: true, material, category: 'furniture' });
        };
        const place = (name, u, v, zz, ww, dd, hh, material, bevel) => {
          let px, py, pw, pd;
          if (head === 'N') { px = x + u; py = y + v; pw = ww; pd = dd; }
          else if (head === 'S') { px = x + w - u - ww; py = y + d - v - dd; pw = ww; pd = dd; }
          else if (head === 'W') { px = x + v; py = y + d - u - ww; pw = dd; pd = ww; }
          else { px = x + w - v - dd; py = y + u; pw = dd; pd = ww; }
          box(`${prefix}_${name}`, px, py, z + zz, pw, pd, hh, material, bevel);
        };
        const rail = Math.min(0.04, width * 0.06, length * 0.04), inset = Math.min(0.05,width * 0.08,length * 0.08);
        for (const [i, u] of [0,width-rail].entries()) place(`frame_side_${i}`,u,0,h*0.12,rail,length,h*0.4,'wood',0.006);
        for (const [i, v] of [0,length-rail].entries()) place(`frame_end_${i}`,rail,v,h*0.12,width-2*rail,rail,h*0.4,'wood',0.006);
        for (const [i, u] of [rail,width-rail*2].entries()) for (const [j,v] of [rail,length-rail*2].entries())
          place(`foot_${i}_${j}`,u,v,0,rail,rail,h*0.16,'wood',0.005);
        const slats = Math.ceil(length / 0.17);
        for(let i=0;i<slats;i++) place(`slat_${i}`,rail,rail+i*(length-2*rail)/slats,h*0.43,
          width-2*rail,(length-2*rail)/slats*0.78,h*0.035,'wood',0.002);
        place('mattress',inset,inset,h*0.465,width-2*inset,length-2*inset,h*0.27,'mattress',Math.min(0.05,h*0.08));
        place('headboard',0,0,h*0.12,width,rail,h*0.88,'wood',0.008);
        const pillowCount = width > 1.15 ? 2 : 1, pillowArea = width - 2*inset;
        for(let i=0;i<pillowCount;i++) fabric(`pillow_${i}`,inset+i*pillowArea/pillowCount+0.012,
          inset+0.025,h*0.735,pillowArea/pillowCount-0.024,Math.min(length*0.22,0.46),h*0.18,'mattress',true);
        const duvetStart = inset + Math.min(length*0.27,0.55);
        const duvetDepth = length-inset-duvetStart, foldDepth = Math.min(length*0.12,0.24);
        fabric('duvet',inset,duvetStart,h*0.735,width-2*inset,duvetDepth,h*0.115,'green');
        fabric('duvet_fold',inset,duvetStart,h*0.735,width-2*inset,foldDepth,h*0.04,'green',false,
          (u,v) => fabricHeight(u,v*foldDepth/duvetDepth,h*0.115));
      }
    }
    return { name: 'Interior furniture', materials, parts, lights: [], floorHeight };
  }
  return { build };
})();
if (typeof module !== 'undefined') module.exports = { FurnitureModel };
