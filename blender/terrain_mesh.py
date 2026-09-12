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
