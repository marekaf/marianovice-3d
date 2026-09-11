import re

import bmesh
import bpy
from mathutils import Vector
from model_parts import build_model


def cap_wall(ob, profile):
    world = ob.matrix_world.copy()
    inverse = world.inverted()
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for vertex in bm.verts:
        vertex.co = world @ vertex.co
    crossover = (profile['maxHeight'] - profile['intercept']) / profile['slope']
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                          plane_co=Vector((crossover, 0, 0)), plane_no=Vector((1, 0, 0)),
                          clear_inner=False, clear_outer=False, dist=1e-7)
    for vertex in bm.verts:
        vertex.co.z = min(vertex.co.z, profile['maxHeight'],
                          profile['slope'] * vertex.co.x + profile['intercept'])
        vertex.co = inverse @ vertex.co
    bm.normal_update()
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    ob['roof_wall_cap'] = True


def build_house_roof(bundle, wall_objects):
    legacy = re.compile(r'^(house_roof_[we]|house[WE]_seam\d+|wingW\d+(?:_seam\d+)?|'
                        r'stit_[ns]|knee_[ens]|wing_end\d+|velux_[ew]\d+_[fg]|stit_win_[fg])(?:\.\d+)?$')
    for ob in list(bpy.data.objects):
        if legacy.fullmatch(ob.name):
            bpy.data.objects.remove(ob, do_unlink=True)
    for name in ['Finished house roof', 'House roof facade infill',
                 bundle['windowModel']['name'], 'House gable window']:
        collection = bpy.data.collections.get(name)
        if collection:
            for ob in list(collection.objects):
                bpy.data.objects.remove(ob, do_unlink=True)
            bpy.data.collections.remove(collection)
    for ob in wall_objects:
        if ob and ob.type == 'MESH':
            cap_wall(ob, bundle['wallCap'])
    for key in ['roofModel', 'infillModel', 'windowModel', 'gableWindowModel']:
        build_model(bundle[key])
