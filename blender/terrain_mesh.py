import bmesh


def align_level_pads(mesh, spec):
    pads = spec.get('fixedFences', {}).get('levelPads', [])
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


def align_circular_pads(mesh, spec):
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

    for pad in spec.get('gatheringPads', []):
        if 'radius' not in pad:
            continue
        cx, cy, radius = pad['cx'], -pad['cz'], pad['radius']
        count = 512
        coordinate_scale = max(abs(cx)+radius, abs(cy)+radius, 1.0)
        float32_ulp = math.ldexp(1.0, math.frexp(coordinate_scale)[1]-24)
        # Keep rounded outer fragments outside the true circle at Float32 precision.
        clip_radius = radius+2*float32_ulp
        clip_extent = clip_radius/math.cos(math.pi/count)
        planes = [(math.cos((i+.5)*math.tau/count), math.sin((i+.5)*math.tau/count)) for i in range(count)]
        candidates = [face for face in mesh.faces
                      if min(v.co.x for v in face.verts) <= cx+clip_extent and max(v.co.x for v in face.verts) >= cx-clip_extent
                      and min(v.co.y for v in face.verts) <= cy+clip_extent and max(v.co.y for v in face.verts) >= cy-clip_extent]
        cache = {(round(v.co.x, 10), round(v.co.y, 10)): v for face in candidates for v in face.verts}
        touched, replaced = set(), []
        for face in candidates:
            points = [tuple(vertex.co) for vertex in face.verts]
            if all(math.hypot(point[0]-cx, point[1]-cy) < clip_radius for point in points):
                touched.update(face.verts)
                continue
            remaining, fragments = points, []
            for nx, ny in planes:
                remaining, outside = split_polygon(remaining, nx, ny, nx*cx+ny*cy+clip_radius)
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
