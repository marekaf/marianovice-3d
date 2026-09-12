import bmesh


def align_level_pads(mesh, spec):
    pads = spec.get('fixedFences', {}).get('levelPads', [])+spec.get('drainageStrips', [])
    if not pads:
        return
    for pad in pads:
        for axis, position in [(0, pad['x0']), (0, pad['x1']), (1, -pad['z0']), (1, -pad['z1'])]:
            point = [0.0, 0.0, 0.0]
            normal = [0.0, 0.0, 0.0]
            point[axis] = position
            normal[axis] = 1.0
            bmesh.ops.bisect_plane(mesh, geom=list(mesh.verts)+list(mesh.edges)+list(mesh.faces),
                                   dist=1e-7, plane_co=point, plane_no=normal,
                                   clear_inner=False, clear_outer=False)
    bmesh.ops.triangulate(mesh, faces=list(mesh.faces))


def align_circular_pads(mesh, spec, boundaries=()):
    import math
    from site_terrain import height

    def split_polygon(points, nx, ny, offset):
        inside, outside = [], []
        previous = points[-1]
        previous_distance = previous[0]*nx+previous[1]*ny-offset
        if abs(previous_distance) < 2e-6:
            previous_distance = 0.0
        for point in points:
            distance = point[0]*nx+point[1]*ny-offset
            if abs(distance) < 2e-6:
                distance = 0.0
            if (distance <= 0) != (previous_distance <= 0):
                factor = previous_distance/(previous_distance-distance)
                crossing = tuple(a+(b-a)*factor for a,b in zip(previous, point))
                inside.append(crossing)
                outside.append(crossing)
            (inside if distance <= 0 else outside).append(point)
            previous, previous_distance = point, distance
        return inside, outside

    for pad in spec.get('gatheringPads', [])+list(boundaries):
        if 'radius' not in pad and 'boundary' not in pad:
            continue
        cx, cy, radius = pad.get('cx',0), -pad.get('cz',0), pad.get('radius',0)
        count = 512
        coordinate_scale = max([abs(value) for point in pad.get('boundary',[]) for value in point]+[abs(cx)+radius,abs(cy)+radius,1.0])
        float32_ulp = math.ldexp(1.0, math.frexp(coordinate_scale)[1]-24)
        # Keep rounded outer fragments outside the true circle at Float32 precision.
        clip_radius = radius+2*float32_ulp
        clip_extent = clip_radius/math.cos(math.pi/count)
        if 'boundary' in pad:
            boundary=[(x,-z) for x,z in pad['boundary']]
            area=sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(boundary,boundary[1:]+boundary[:1]))
            if area>0:
                boundary.reverse()
            planes=[]
            for a,b in zip(boundary,boundary[1:]+boundary[:1]):
                dx,dy=b[0]-a[0],b[1]-a[1]
                length=math.hypot(dx,dy)
                if length<1e-12:
                    continue
                nx,ny=-dy/length,dx/length
                planes.append((nx,ny,nx*a[0]+ny*a[1]+2*float32_ulp))
            xmin,xmax=min(p[0] for p in boundary)-2*float32_ulp,max(p[0] for p in boundary)+2*float32_ulp
            ymin,ymax=min(p[1] for p in boundary)-2*float32_ulp,max(p[1] for p in boundary)+2*float32_ulp
        else:
            planes=[(math.cos((i+.5)*math.tau/count),math.sin((i+.5)*math.tau/count)) for i in range(count)]
            planes=[(nx,ny,nx*cx+ny*cy+clip_radius) for nx,ny in planes]
            xmin,xmax,ymin,ymax=cx-clip_extent,cx+clip_extent,cy-clip_extent,cy+clip_extent
        candidates = [face for face in mesh.faces
                      if min(v.co.x for v in face.verts)<=xmax and max(v.co.x for v in face.verts)>=xmin
                      and min(v.co.y for v in face.verts)<=ymax and max(v.co.y for v in face.verts)>=ymin]
        cache = {(round(v.co.x, 10), round(v.co.y, 10)): v for face in candidates for v in face.verts}
        touched, replaced = set(), []
        for face in candidates:
            points = [tuple(vertex.co) for vertex in face.verts]
            if all(all(nx*point[0]+ny*point[1]<offset for nx,ny,offset in planes) if 'boundary' in pad else math.hypot(point[0]-cx,point[1]-cy)<clip_radius for point in points):
                touched.update(face.verts)
                continue
            remaining, fragments = points, []
            for nx, ny, offset in planes:
                remaining, outside = split_polygon(remaining, nx, ny, offset)
                if len(outside) >= 3:
                    fragments.append(outside)
                if len(remaining) < 3:
                    break
            if len(remaining) < 3 or abs(sum((remaining[i][0]-remaining[0][0])*(remaining[i+1][1]-remaining[0][1])-(remaining[i+1][0]-remaining[0][0])*(remaining[i][1]-remaining[0][1]) for i in range(1,len(remaining)-1))) < 1e-12:
                continue
            if not fragments:
                touched.update(face.verts)
                continue
            fragments.append(remaining)
            for polygon in fragments:
                for i in range(1, len(polygon)-1):
                    a, b, c = polygon[0], polygon[i], polygon[i+1]
                    if abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])) < 1e-12:
                        continue
                    vertices = []
                    for point in (a, b, c):
                        key = (round(point[0], 10), round(point[1], 10))
                        if key not in cache:
                            cache[key] = mesh.verts.new(point)
                        vertices.append(cache[key])
                    if len(set(vertices)) < 3:
                        continue
                    replacement = mesh.faces.new(vertices)
                    replacement.material_index = face.material_index
                    replacement.smooth = face.smooth
                    replacement.copy_from_face_interp(face, True)
                    touched.update(vertices)
            replaced.append(face)
        for face in replaced:
            mesh.faces.remove(face)
        for vertex in touched:
            vertex.co.z = height(spec, vertex.co.x, -vertex.co.y)
        loose_edges = [edge for vertex in touched for edge in vertex.link_edges if not edge.link_faces]
        for edge in set(loose_edges):
            mesh.edges.remove(edge)
        mesh.normal_update()


def refine_plateau_ground(mesh, spec, options):
    from site_terrain import height

    if not options:
        return
    x0, x1, z0, z1 = (options[key] for key in ('x0', 'x1', 'z0', 'z1'))
    tolerance = options.get('tolerance', .00025)
    level = options['level']
    sampled = {}

    def sample(x, y):
        key = (x, y)
        if key not in sampled:
            sampled[key] = height(spec, x, -y)
        return sampled[key]

    def local(face):
        return (min(v.co.x for v in face.verts) <= x1 and max(v.co.x for v in face.verts) >= x0
                and min(-v.co.y for v in face.verts) <= z1 and max(-v.co.y for v in face.verts) >= z0)

    for vertex in {v for face in mesh.faces if local(face) for v in face.verts}:
        vertex.co.z = sample(vertex.co.x, vertex.co.y)
    for _ in range(options.get('maxDepth', 10)):
        edges = set()
        for face in mesh.faces:
            if not local(face):
                continue
            a, b, c = (v.co for v in face.verts)
            if all(abs(point.z-level) < 1e-7 for point in (a, b, c)):
                continue
            probes = [(a+b)/2, (b+c)/2, (c+a)/2, (a+b+c)/3]
            near_flat = any(abs(point.z-level) < 1e-7 for point in (a, b, c)) or any(
                abs(sample(point.x, point.y)-level) < 1e-7 for point in probes)
            if not near_flat:
                continue
            for point in probes:
                expected = sample(point.x, point.y)
                if abs(expected-level) < .1 and abs(point.z-expected) > tolerance:
                    edges.update(face.edges)
                    break
        if not edges:
            break
        result = bmesh.ops.subdivide_edges(mesh, edges=list(edges), cuts=1, use_grid_fill=True)
        changed = set(result['geom_inner']) | set(result['geom_split'])
        vertices = {item for item in changed if isinstance(item, bmesh.types.BMVert)}
        faces = {face for vertex in vertices for face in vertex.link_faces}
        bmesh.ops.triangulate(mesh, faces=list(faces))
        for vertex in vertices:
            vertex.co.z = sample(vertex.co.x, vertex.co.y)
    mesh.normal_update()
