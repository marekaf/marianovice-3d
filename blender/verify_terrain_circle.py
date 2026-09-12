import json
import math
import sys
from pathlib import Path

import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from terrain_mesh import align_circular_pads
from site_terrain import height

spec = json.loads(Path(sys.argv[sys.argv.index('--')+1]).read_text())['siteTerrain']
pad = next(p for p in spec['gatheringPads'] if 'radius' in p)
cx, cy, radius = pad['cx'], -pad['cz'], pad['radius']
mesh = bmesh.new()
weight = mesh.verts.layers.float.new('grass')
uv = mesh.loops.layers.uv.new('UVMap')
colour = mesh.loops.layers.float_color.new('tint')
size = 12
vertices = []
for j in range(size+1):
    row = []
    for i in range(size+1):
        x, y = cx-4+i*8/size, cy-4+j*8/size
        vertex = mesh.verts.new((x, y, height(spec, x, -y)))
        vertex[weight] = x*.01+y*.02
        row.append(vertex)
    vertices.append(row)
for j in range(size):
    for i in range(size):
        a, b, c, d = vertices[j][i], vertices[j][i+1], vertices[j+1][i+1], vertices[j+1][i]
        for triangle in [(a,b,c),(a,c,d)]:
            face = mesh.faces.new(triangle)
            face.material_index = 3
            for loop in face.loops:
                x, y = loop.vert.co.x, loop.vert.co.y
                loop[uv].uv = (x*.1, y*.1)
                loop[colour] = (x*.01, y*.01, .5, 1)
mesh.normal_update()
maximum_error = 0
for attempt in range(2):
    align_circular_pads(mesh, spec)
    assert len(mesh.faces) < 10000, 'Circular clipping must remain local and bounded'
    assert all(face.material_index == 3 for face in mesh.faces)
    for vertex in mesh.verts:
        assert abs(vertex[weight]-(vertex.co.x*.01+vertex.co.y*.02)) < 2e-5, 'Grass attribute must interpolate across inserted vertices'
    for face in mesh.faces:
        for loop in face.loops:
            x, y = loop.vert.co.x, loop.vert.co.y
            assert (loop[uv].uv-Vector((x*.1,y*.1))).length < 2e-5, 'UV coordinates must remain continuous'
            assert max(abs(a-b) for a,b in zip(loop[colour],(x*.01,y*.01,.5,1))) < 2e-5, 'Loop colours must interpolate'
    tree = BVHTree.FromBMesh(mesh)
    for ring in range(11):
        for i in range(64):
            angle = i*math.tau/64
            x, y = cx+radius*.9999*ring/10*math.cos(angle), cy+radius*.9999*ring/10*math.sin(angle)
            point, _, _, _ = tree.ray_cast(Vector((x,y,10)),Vector((0,0,-1)))
            assert point is not None, 'Circle clipping cannot leave holes'
            maximum_error = max(maximum_error,abs(point.z-pad['level']))
            assert abs(point.z-pad['level']) < 2e-5, ('Circular soil mesh must stay flat',x,y,point.z)
print(json.dumps({'circleMeshVertices':len(mesh.verts),'circleMeshFaces':len(mesh.faces),'maximumFlatError':maximum_error,'attributes':'grass, UV and loop colour preserved','repeat':'passed'}))
mesh.free()
