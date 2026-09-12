import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from terrain_mesh import align_circular_pads, align_level_pads

args = sys.argv[sys.argv.index('--')+1:]
spec = json.loads(Path(args[0]).read_text())['siteTerrain']
with bpy.data.libraries.load(args[1], link=False) as (source, target):
    assert 'terrain' in source.meshes
    target.meshes = ['terrain']
mesh = bmesh.new()
mesh.from_mesh(target.meshes[0])
align_level_pads(mesh, spec)
align_circular_pads(mesh, spec)
tree = BVHTree.FromBMesh(mesh)
maximum_error, missing, failures, samples = 0, 0, [], 0
for pad in spec.get('gatheringPads', []):
    if 'radius' not in pad:
        continue
    cx, cy, radius = pad['cx'], -pad['cz'], pad['radius']
    bins = {}
    for face in mesh.faces:
        points = [tuple(vertex.co) for vertex in face.verts]
        if max(p[0] for p in points) < cx-radius-.01 or min(p[0] for p in points) > cx+radius+.01 or max(p[1] for p in points) < cy-radius-.01 or min(p[1] for p in points) > cy+radius+.01:
            continue
        for i in range(1,len(points)-1):
            triangle = (points[0],points[i],points[i+1])
            for x in range(math.floor(min(p[0] for p in triangle)*10),math.floor(max(p[0] for p in triangle)*10)+1):
                for y in range(math.floor(min(p[1] for p in triangle)*10),math.floor(max(p[1] for p in triangle)*10)+1):
                    bins.setdefault((x,y),[]).append(triangle)
    for i in range(1024):
        angle = i*math.tau/1024
        x, y = cx+radius*math.cos(angle), cy+radius*math.sin(angle)
        heights = []
        point, _, _, _ = tree.ray_cast(Vector((x,y,pad['level']+1)),Vector((0,0,-1)))
        if point is not None:
            heights.append(point.z)
        for a,b,c in bins.get((math.floor(x*10),math.floor(y*10)),[]):
            den = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
            if abs(den) < 1e-20:
                continue
            u = ((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den
            v = ((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den
            w = 1-u-v
            if min(u,v,w) >= -1e-8:
                heights.append(u*a[2]+v*b[2]+w*c[2])
        samples += 1
        if not heights:
            missing += 1
            continue
        error = max(abs(value-pad['level']) for value in heights)
        maximum_error = max(maximum_error,error)
        if error > 2e-5 and len(failures) < 5:
            failures.append({'x':x,'z':-y,'heights':heights,'expected':pad['level']})
report = {'boundarySamples':samples,'maximumError':maximum_error,'missing':missing,'failures':failures,'meshFaces':len(mesh.faces)}
print(json.dumps(report),flush=True)
assert samples >= 1024 and not missing and maximum_error < 2e-5, 'Every exact circle vertex and arc midpoint must have flat supported terrain'
mesh.free()
