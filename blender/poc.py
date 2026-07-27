"""Garden PoC: build scene from garden.json, save garden.blend, render two views.

Headless render: /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/poc.py -- blender/garden.json
Open in GUI:     /Applications/Blender.app/Contents/MacOS/Blender -P blender/poc.py -- blender/garden.json --no-render
"""
import bpy
import bmesh
import json
import math
import os
import random
import sys
import time
from mathutils import Vector

argv = sys.argv
extra = argv[argv.index("--") + 1:]
json_path = os.path.abspath(extra[0])
NO_RENDER = "--no-render" in extra
out_dir = os.path.dirname(json_path)
with open(json_path) as f:
    GARDEN = json.load(f)

random.seed(42)
scene = bpy.context.scene

for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)


def ground_h(x, y):
    """Terrain height in plan coords (x east, y south)."""
    return max(0.0, -0.062 * x + 0.044 * y + 2.733)


PONDS = [(30.0, 15.0, 2.8, 2.0, 0.45)]


def terrain_z(x, y):
    z = ground_h(x, y)
    for cx, cy, rx, ry, depth in PONDS:
        d2 = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
        if d2 < 1.0:
            z -= depth * (1.0 - d2)
    return z


def hexc(h):
    return tuple((int(h[i:i + 2], 16) / 255.0) ** 2.2 for i in (1, 3, 5))


# ---------------- materials ----------------
def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes["Principled BSDF"]


def mat_simple(name, color, rough=0.6, metal=0.0, emit=None, emit_str=0.0,
               transmission=0.0, ior=1.45):
    m, nt, b = new_mat(name)
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    try:
        b.inputs["IOR"].default_value = ior
        if transmission:
            b.inputs["Transmission Weight"].default_value = transmission
    except KeyError:
        pass
    if emit is not None:
        try:
            b.inputs["Emission Color"].default_value = (*emit, 1.0)
            b.inputs["Emission Strength"].default_value = emit_str
        except KeyError:
            pass
    return m


def mat_plaster(name, color, rough=0.85):
    m, nt, b = new_mat(name)
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 55.0
    noise.inputs["Detail"].default_value = 6.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.05
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_wood(name, c1, c2, rough=0.7, stretch=(0.7, 7.0, 7.0)):
    """Procedural grain: noise stretched along x."""
    m, nt, b = new_mat(name)
    b.inputs["Roughness"].default_value = rough
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = stretch
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.0
    noise.inputs["Detail"].default_value = 5.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*c1, 1.0)
    ramp.color_ramp.elements[1].color = (*c2, 1.0)
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.06
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_planks(name, color, rough=0.65, scale=4.2):
    """Deck boards: wave-texture stripe grooves + bump."""
    m, nt, b = new_mat(name)
    b.inputs["Roughness"].default_value = rough
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.inputs["Scale"].default_value = scale
    wave.inputs["Distortion"].default_value = 0.4
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    dark = tuple(c * 0.45 for c in color)
    ramp.color_ramp.elements[0].color = (*dark, 1.0)
    ramp.color_ramp.elements[1].position = 0.12
    ramp.color_ramp.elements[1].color = (*color, 1.0)
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(wave.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_concrete(name, c1, c2, rough_lo=0.55, rough_hi=0.85):
    m, nt, b = new_mat(name)
    speck = nt.nodes.new("ShaderNodeTexNoise")
    speck.inputs["Scale"].default_value = 180.0
    speck.inputs["Detail"].default_value = 2.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*c1, 1.0)
    ramp.color_ramp.elements[1].color = (*c2, 1.0)
    rnoise = nt.nodes.new("ShaderNodeTexNoise")
    rnoise.inputs["Scale"].default_value = 6.0
    mrange = nt.nodes.new("ShaderNodeMapRange")
    mrange.inputs["To Min"].default_value = rough_lo
    mrange.inputs["To Max"].default_value = rough_hi
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.03
    nt.links.new(speck.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(rnoise.outputs["Fac"], mrange.inputs["Value"])
    nt.links.new(mrange.outputs["Result"], b.inputs["Roughness"])
    nt.links.new(speck.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_soil_grass(name, c1, c2, rough=0.95, scale=14.0):
    m, nt, b = new_mat(name)
    b.inputs["Roughness"].default_value = rough
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (*c1, 1.0)
    mix.inputs["B"].default_value = (*c2, 1.0)
    nt.links.new(noise.outputs["Fac"], mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    return m


def mat_blade(name):
    """Grass blade with per-instance color variation via Object Info random."""
    m, nt, b = new_mat(name)
    b.inputs["Roughness"].default_value = 0.65
    oi = nt.nodes.new("ShaderNodeObjectInfo")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*hexc("#3e6b2f"), 1.0)
    ramp.color_ramp.elements[1].color = (*hexc("#8fb45c"), 1.0)
    nt.links.new(oi.outputs["Random"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return m


MAT = {
    "soil": mat_soil_grass("soil", hexc("#4f7040"), hexc("#3f5a33")),
    "meadow": mat_soil_grass("meadow", hexc("#6f9a60"), hexc("#8a9a58"), scale=8.0),
    "walls": mat_plaster("walls", hexc("#d4b896")),
    "garage_walls": mat_plaster("garage_walls", hexc("#9a9a9a")),
    "roof": mat_simple("roof", hexc("#8a8f94"), rough=0.35, metal=0.8),
    "wood": mat_wood("wood", hexc("#7a5a3a"), hexc("#5e4229")),
    "deck": mat_planks("deck", hexc("#a87d4a")),
    "path": mat_concrete("path", hexc("#cdc1ad"), hexc("#b7ab96")),
    "drive": mat_concrete("drive", hexc("#c9c9c6"), hexc("#b2b1ad")),
    "water": mat_simple("water", hexc("#7fa3bd"), rough=0.02, transmission=1.0, ior=1.33),
    "glass": mat_simple("glass", hexc("#d5dde2"), rough=0.03, transmission=1.0, ior=1.45),
    "frame": mat_simple("frame", hexc("#2a2a2a"), rough=0.5, metal=0.3),
    "backing": mat_simple("backing", hexc("#0d1013"), rough=0.9),
    "door_metal": mat_simple("door_metal", hexc("#33383d"), rough=0.4, metal=0.7),
    "groove": mat_simple("groove", hexc("#1c1f22"), rough=0.5, metal=0.5),
    "basin": mat_simple("basin", hexc("#4a4438"), rough=0.9),
    "rim": mat_simple("rim", hexc("#8f8a80"), rough=0.8),
    "stone": mat_simple("stone", hexc("#5c564e"), rough=0.9),
    "fire": mat_simple("fire", hexc("#ff7733"), emit=hexc("#ff6622"), emit_str=8.0),
    "trunk": mat_wood("trunk", hexc("#5a4630"), hexc("#453522"), stretch=(2.0, 2.0, 0.5)),
    "fence": mat_wood("fence", hexc("#6b5844"), hexc("#54432f")),
    "manhole": mat_simple("manhole", hexc("#666666"), rough=0.5, metal=0.4),
    "blade": mat_blade("blade"),
    "tire": mat_simple("tire", hexc("#101010"), rough=0.95),
    "cabin": mat_simple("cabin", hexc("#14171a"), rough=0.15),
    "car_blue": mat_simple("car_blue", hexc("#224488"), rough=0.35, metal=0.3),
    "car_red": mat_simple("car_red", hexc("#aa3333"), rough=0.35, metal=0.3),
    "car_grey": mat_simple("car_grey", hexc("#8f9499"), rough=0.35, metal=0.3),
}
CANOPY = [mat_simple("canopy%d" % i, c, rough=0.85) for i, c in enumerate(
    [hexc("#3f6b3a"), hexc("#4d7a4d"), hexc("#42704a"), hexc("#557f45")])]
PASTEL = [mat_simple("per%d" % i, c, rough=0.9) for i, c in enumerate(
    [hexc("#b28cb8"), hexc("#8a6fae"), hexc("#c9a44a"), hexc("#d8a0b0"), hexc("#9aa87a")])]


# ---------------- geometry helpers ----------------
def link_obj(name, mesh, mat):
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    if mat:
        mesh.materials.append(mat)
    return ob


def box_b(name, x0, x1, y0, y1, z0, z1, mat):
    """Axis-aligned box in blender coords."""
    bm = bmesh.new()
    co = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
          (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    vs = [bm.verts.new(c) for c in co]
    for f in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]:
        bm.faces.new([vs[i] for i in f])
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return link_obj(name, mesh, mat)


def box_p(name, x0, y0s, x1, y1s, z0, z1, mat):
    """Box in plan coords (x east, y south)."""
    return box_b(name, x0, x1, -y1s, -y0s, z0, z1, mat)


def rect_box(name, r, z0, z1, mat):
    return box_p(name, r["x"], r["y"], r["x"] + r["w"], r["y"] + r["d"], z0, z1, mat)


def rect_center(r):
    return r["x"] + r["w"] / 2.0, r["y"] + r["d"] / 2.0


def extrude_poly(name, pts, z0, z1, mat):
    bm = bmesh.new()
    vs = [bm.verts.new((p[0], -p[1], z0)) for p in pts]
    face = bm.faces.new(vs)
    res = bmesh.ops.extrude_face_region(bm, geom=[face])
    for g in res["geom"]:
        if isinstance(g, bmesh.types.BMVert):
            g.co.z = z1
    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return link_obj(name, mesh, mat)


def draped_poly(name, pts, lift, mat, subdiv=4):
    bm = bmesh.new()
    vs = [bm.verts.new((p[0], -p[1], 0.0)) for p in pts]
    bm.faces.new(vs)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    for _ in range(subdiv):
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    for v in bm.verts:
        v.co.z = terrain_z(v.co.x, -v.co.y) + lift
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return link_obj(name, mesh, mat)


def gable(name, x0, x1, y0s, y1s, z_eave, z_ridge, ridge_x, mat):
    ya, yb = -y1s, -y0s
    bm = bmesh.new()
    co = [(x0, ya, z_eave), (ridge_x, ya, z_ridge), (x1, ya, z_eave),
          (x0, yb, z_eave), (ridge_x, yb, z_ridge), (x1, yb, z_eave)]
    vs = [bm.verts.new(c) for c in co]
    bm.faces.new([vs[0], vs[1], vs[2]])
    bm.faces.new([vs[5], vs[4], vs[3]])
    bm.faces.new([vs[0], vs[3], vs[4], vs[1]])
    bm.faces.new([vs[1], vs[4], vs[5], vs[2]])
    bm.faces.new([vs[0], vs[2], vs[5], vs[3]])
    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return link_obj(name, mesh, mat)


def sloped_slab(name, x0, x1, z0, z1, y0s, y1s, thick, mat):
    """Slab sloping from z0 at x0 to z1 at x1 (plan coords)."""
    ya, yb = -y1s, -y0s
    bm = bmesh.new()
    co = [(x0, ya, z0 + thick), (x1, ya, z1 + thick), (x1, yb, z1 + thick), (x0, yb, z0 + thick),
          (x0, ya, z0), (x1, ya, z1), (x1, yb, z1), (x0, yb, z0)]
    vs = [bm.verts.new(c) for c in co]
    for f in [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]:
        bm.faces.new([vs[i] for i in f])
    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return link_obj(name, mesh, mat)


def add_cyl(name, x, y, z, r, depth, mat, sx=1.0, sy=1.0, verts=32, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=(x, -y, z))
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (sx, sy, 1.0)
    if rot:
        ob.rotation_euler = rot
    ob.data.materials.append(mat)
    return ob


def add_sphere(name, x, y, z, r, mat, scale=None, rot=None, subdiv=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=r, location=(x, -y, z))
    ob = bpy.context.active_object
    ob.name = name
    if scale:
        ob.scale = scale
    if rot:
        ob.rotation_euler = rot
    ob.data.materials.append(mat)
    return ob


def post(name, x, y, z0, z1, mat, half=0.05):
    return box_b(name, x - half, x + half, -y - half, -y + half, z0, z1, mat)


def roof_seams(prefix, x_eave, z_eave, x_ridge, z_ridge, y0s, y1s, mat, step=0.4):
    ang = math.atan2(z_ridge - z_eave, x_ridge - x_eave)
    ln = math.hypot(x_ridge - x_eave, z_ridge - z_eave)
    mx, mz = (x_eave + x_ridge) / 2.0, (z_eave + z_ridge) / 2.0
    nx, nz = -math.sin(ang), math.cos(ang)
    if nz < 0:
        nx, nz = -nx, -nz
    yy = y0s + 0.2
    i = 0
    while yy < y1s - 0.1:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(mx + nx * 0.03, -yy, mz + nz * 0.03))
        ob = bpy.context.active_object
        ob.name = "%s_seam%d" % (prefix, i)
        ob.scale = (ln, 0.025, 0.03)
        ob.rotation_euler = (0.0, -ang, 0.0)
        ob.data.materials.append(mat)
        i += 1
        yy += step


# ---------------- data ----------------
plot = GARDEN["plot"]["vertices"]
els = {e["id"]: e for e in GARDEN["elements"]}


def first_rect(el):
    return next(p for p in el["parts"] if p["kind"] == "rect")


house = els["house"]
hpoly = next(p for p in house["parts"] if p["kind"] == "polygon")["points"]
dpoly = next(p for p in els["driveway"]["parts"] if p["kind"] == "polygon")["points"]

# ---------------- grass exclusion mask ----------------
EXCL_RECTS = []
for eid in ["westTerrace", "eastTerrace", "saunaPath", "parking", "carport", "garage",
            "sauna", "saunaShelter", "raisedBed1", "raisedBed2", "raisedBed3", "raisedBed4"]:
    for prt in els[eid]["parts"]:
        if prt["kind"] == "rect":
            m = 0.15
            EXCL_RECTS.append((prt["x"] - m, prt["y"] - m, prt["x"] + prt["w"] + m, prt["y"] + prt["d"] + m))
EXCL_POLYS = [hpoly, dpoly]
EXCL_ELLIPSES = [(30.0, 15.0, 3.1, 2.25), (5.0, 2.5, 1.15, 1.15), (36.0, 8.0, 1.2, 1.2)]


def point_in_poly(x, y, poly):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def grass_weight(x, y):
    for x0, y0, x1, y1 in EXCL_RECTS:
        if x0 <= x <= x1 and y0 <= y <= y1:
            return 0.0
    for cx, cy, rx, ry in EXCL_ELLIPSES:
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1.0:
            return 0.0
    for poly in EXCL_POLYS:
        if point_in_poly(x, y, poly):
            return 0.0
    return 1.0


# ---------------- terrain ----------------
GRASS_DENSITY = 280.0  # blades per m^2

terrain_ob = None


def build_terrain():
    global terrain_ob
    bm = bmesh.new()
    vs = [bm.verts.new((p[0], -p[1], 0.0)) for p in plot]
    bm.faces.new(vs)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    for _ in range(7):
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    for v in bm.verts:
        v.co.z = terrain_z(v.co.x, -v.co.y)
    mesh = bpy.data.meshes.new("terrain")
    bm.to_mesh(mesh)
    bm.free()
    terrain_ob = link_obj("terrain", mesh, MAT["soil"])
    for poly in mesh.polygons:
        poly.use_smooth = True
    attr = mesh.attributes.new("grass_w", "FLOAT", "POINT")
    vals = [grass_weight(v.co.x, -v.co.y) for v in mesh.vertices]
    attr.data.foreach_set("value", vals)
    area = 0.0
    n = len(plot)
    for i in range(n):
        x1p, y1p = plot[i]
        x2p, y2p = plot[(i + 1) % n]
        area += x1p * y2p - x2p * y1p
    area = abs(area) / 2.0
    lawn = area * sum(vals) / len(vals)
    print("GRASS estimate: lawn %.0f m2 -> ~%dk blades" % (lawn, lawn * GRASS_DENSITY / 1000))


def build_surround():
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=80, y_subdivisions=80, size=180, location=(22, -17, 0))
    ob = bpy.context.active_object
    ob.name = "surround"
    for v in ob.data.vertices:
        wx = v.co.x + 22.0
        wy = v.co.y - 17.0
        v.co.z = ground_h(wx, -wy) - 0.08
    ob.data.materials.append(MAT["meadow"])


build_terrain()
build_surround()


# ---------------- grass scatter (geometry nodes) ----------------
def build_blade():
    bm = bmesh.new()
    w = 0.013
    co = [(-w / 2, 0, 0), (w / 2, 0, 0),
          (-w * 0.32, 0.012, 0.055), (w * 0.32, 0.012, 0.055), (0, 0.03, 0.105)]
    vs = [bm.verts.new(c) for c in co]
    bm.faces.new([vs[0], vs[1], vs[3], vs[2]])
    bm.faces.new([vs[2], vs[3], vs[4]])
    mesh = bpy.data.meshes.new("blade")
    bm.to_mesh(mesh)
    bm.free()
    ob = link_obj("blade", mesh, MAT["blade"])
    ob.location = (0, 0, -30)
    ob.hide_render = True
    return ob


def rand_node(nt, dtype, vmin, vmax, seed):
    n = nt.nodes.new("FunctionNodeRandomValue")
    n.data_type = dtype
    vecs = [sk for sk in n.inputs if sk.type == "VECTOR"]
    flts = [sk for sk in n.inputs if sk.type == "VALUE"]
    ints = [sk for sk in n.inputs if sk.type == "INT"]
    if dtype == "FLOAT_VECTOR":
        vecs[0].default_value = vmin
        vecs[1].default_value = vmax
    elif dtype == "FLOAT":
        flts[0].default_value = vmin
        flts[1].default_value = vmax
    ints[-1].default_value = seed
    out_type = {"FLOAT_VECTOR": "VECTOR", "FLOAT": "VALUE"}[dtype]
    out = next(sk for sk in n.outputs if sk.type == out_type)
    return n, out


def build_grass(blade_ob):
    ng = bpy.data.node_groups.new("GrassScatter", "GeometryNodeTree")
    try:
        ng.is_modifier = True
    except AttributeError:
        pass
    ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    n_in = ng.nodes.new("NodeGroupInput")
    n_out = ng.nodes.new("NodeGroupOutput")
    attr = ng.nodes.new("GeometryNodeInputNamedAttribute")
    attr.data_type = "FLOAT"
    attr.inputs["Name"].default_value = "grass_w"
    mul = ng.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = GRASS_DENSITY
    dist = ng.nodes.new("GeometryNodeDistributePointsOnFaces")
    dist.distribute_method = "RANDOM"
    dist.inputs["Seed"].default_value = 4
    oinfo = ng.nodes.new("GeometryNodeObjectInfo")
    oinfo.inputs["Object"].default_value = blade_ob
    oinfo.inputs["As Instance"].default_value = True
    rot_n, rot_out = rand_node(ng, "FLOAT_VECTOR", (-0.22, -0.22, 0.0), (0.22, 0.22, 6.2832), 7)
    scl_n, scl_out = rand_node(ng, "FLOAT", 0.6, 1.15, 11)
    inst = ng.nodes.new("GeometryNodeInstanceOnPoints")
    join = ng.nodes.new("GeometryNodeJoinGeometry")
    lk = ng.links.new
    lk(attr.outputs["Attribute"], mul.inputs[0])
    lk(n_in.outputs["Geometry"], dist.inputs["Mesh"])
    lk(mul.outputs["Value"], dist.inputs["Density"])
    lk(dist.outputs["Points"], inst.inputs["Points"])
    lk(oinfo.outputs["Geometry"], inst.inputs["Instance"])
    lk(rot_out, inst.inputs["Rotation"])
    lk(scl_out, inst.inputs["Scale"])
    lk(n_in.outputs["Geometry"], join.inputs[0])
    lk(inst.outputs["Instances"], join.inputs[0])
    lk(join.outputs["Geometry"], n_out.inputs["Geometry"])
    mod = terrain_ob.modifiers.new("grass", "NODES")
    mod.node_group = ng


build_grass(build_blade())

# ---------------- house ----------------
bb = house["meta"]["bbox"]
core = house["meta"]["coreX"]
ft = ground_h((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2)  # floor level
h_base = min(ground_h(x, y) for x, y in hpoly) - 0.2
extrude_poly("house_walls", hpoly, h_base, ft + 2.8, MAT["walls"])

ridge_x = (core[0] + core[1]) / 2.0
OV = 0.45
gable("house_roof", core[0] - OV, core[1] + OV, bb[1] - OV, bb[3] + OV,
      ft + 2.8, ft + 5.0, ridge_x, MAT["roof"])
roof_seams("houseW", core[0] - OV, ft + 2.8, ridge_x, ft + 5.0, bb[1] - OV, bb[3] + OV, MAT["roof"])
roof_seams("houseE", core[1] + OV, ft + 2.8, ridge_x, ft + 5.0, bb[1] - OV, bb[3] + OV, MAT["roof"])


def wing_z(x):
    return ft + 2.8 + (x - 10.48) * (0.9 / 4.3)


sloped_slab("wingN", 10.13, 14.78, wing_z(10.13), wing_z(14.78), 6.88, 16.23, 0.12, MAT["roof"])
sloped_slab("wingS", 10.13, 14.78, wing_z(10.13), wing_z(14.78), 18.88, 26.73, 0.12, MAT["roof"])
box_p("chimney", 16.7, 21.7, 17.3, 22.3, ft + 3.5, ft + 6.0, MAT["garage_walls"])


def window(name, axis, wall, out_sign, along_c, width, sill, height, door=False):
    """Inset pane stack on a wall plane. axis 'x': wall at plan x, spans plan y.
    axis 'y': wall at plan y, spans plan x. out_sign: outward in plan axis units."""
    z0 = ft + sill
    z1 = z0 + height
    hw = width / 2.0
    a0, a1 = along_c - hw, along_c + hw

    def layer(nm, d0, d1, aa0, aa1, zz0, zz1, mat):
        lo = wall + d0 * out_sign
        hi = wall + d1 * out_sign
        lo, hi = min(lo, hi), max(lo, hi)
        if axis == "x":
            box_p(nm, lo, aa0, hi, aa1, zz0, zz1, mat)
        else:
            box_p(nm, aa0, lo, aa1, hi, zz0, zz1, mat)

    if door:
        layer(name + "_p", 0.005, 0.06, a0, a1, z0, z1, MAT["backing"])
        return
    layer(name + "_b", 0.005, 0.02, a0, a1, z0, z1, MAT["backing"])
    layer(name + "_g", 0.03, 0.05, a0 + 0.05, a1 - 0.05, z0 + 0.04, z1 - 0.04, MAT["glass"])
    fw = 0.06
    layer(name + "_fL", 0.02, 0.10, a0, a0 + fw, z0, z1, MAT["frame"])
    layer(name + "_fR", 0.02, 0.10, a1 - fw, a1, z0, z1, MAT["frame"])
    layer(name + "_fB", 0.02, 0.10, a0, a1, z0, z0 + fw, MAT["frame"])
    layer(name + "_fT", 0.02, 0.10, a0, a1, z1 - fw, z1, MAT["frame"])


window("w_slider1", "x", 20.58, +1, 13.5, 3.29, 0.05, 2.27)
window("w_slider2", "x", 20.58, +1, 18.5, 5.16, 0.05, 2.27)
window("w_bedroom", "x", 21.28, +1, 9.5, 2.0, 0.3, 1.5)
window("w_north", "y", 7.18, -1, 15.88, 0.9, 0.3, 1.5)
window("w_west1", "x", 10.48, -1, 10.5, 1.6, 0.3, 1.5)
window("w_west2", "x", 10.48, -1, 13.5, 1.6, 0.3, 1.5)
window("w_west3", "x", 10.48, -1, 22.0, 1.6, 0.9, 1.67)
window("w_west4", "x", 10.48, -1, 24.5, 1.6, 0.9, 1.67)
window("w_south1", "y", 26.43, +1, 13.5, 0.9, 0.9, 1.25)
window("w_south2", "y", 26.43, +1, 16.5, 0.9, 0.9, 1.25)
window("w_door", "x", 21.28, +1, 23.31, 1.42, 0.0, 2.15, door=True)

# ---------------- garage + door + cars ----------------
g = first_rect(els["garage"])
gcx, gcy = rect_center(g)
gz = ground_h(gcx, gcy)
rect_box("garage", g, gz - 0.3, gz + 2.3, MAT["garage_walls"])
gable("garage_roof", g["x"] - 0.2, g["x"] + g["w"] + 0.2, g["y"] - 0.2, g["y"] + g["d"] + 0.2,
      gz + 2.3, gz + 3.1, gcx, MAT["roof"])
roof_seams("garW", g["x"] - 0.2, gz + 2.3, gcx, gz + 3.1, g["y"] - 0.2, g["y"] + g["d"] + 0.2, MAT["roof"])
roof_seams("garE", g["x"] + g["w"] + 0.2, gz + 2.3, gcx, gz + 3.1, g["y"] - 0.2, g["y"] + g["d"] + 0.2, MAT["roof"])

gd_y = g["y"] + g["d"]  # south wall
box_p("garage_door", 29.57, gd_y + 0.01, 32.87, gd_y + 0.06, gz, gz + 2.1, MAT["door_metal"])
for k in range(4):
    zz = gz + 0.42 * (k + 1)
    box_p("garage_groove%d" % k, 29.62, gd_y + 0.02, 32.82, gd_y + 0.09, zz - 0.02, zz + 0.02, MAT["groove"])


def car(name, cx, cy, paint, along="y", z=None):
    if z is None:
        z = ground_h(cx, cy)
    L, W = 2.0, 0.86  # half length / half width
    if along == "y":
        box_p(name + "_body", cx - W, cy - L, cx + W, cy + L, z + 0.32, z + 0.92, paint)
        box_p(name + "_cabin", cx - W + 0.1, cy - 0.9, cx + W - 0.1, cy + 1.1, z + 0.92, z + 1.42, MAT["cabin"])
        wheels = [(cx - W, cy - 1.25), (cx + W, cy - 1.25), (cx - W, cy + 1.25), (cx + W, cy + 1.25)]
        rot = (0, math.pi / 2, 0)
    else:
        box_p(name + "_body", cx - L, cy - W, cx + L, cy + W, z + 0.32, z + 0.92, paint)
        box_p(name + "_cabin", cx - 0.9, cy - W + 0.1, cx + 1.1, cy + W - 0.1, z + 0.92, z + 1.42, MAT["cabin"])
        wheels = [(cx - 1.25, cy - W), (cx - 1.25, cy + W), (cx + 1.25, cy - W), (cx + 1.25, cy + W)]
        rot = (math.pi / 2, 0, 0)
    for i, (wx, wy) in enumerate(wheels):
        add_cyl(name + "_wheel%d" % i, wx, wy, z + 0.33, 0.33, 0.2, MAT["tire"], verts=16, rot=rot)


car("car1", 29.0, 22.0, MAT["car_blue"], along="y", z=gz)
car("car2", 32.5, 22.0, MAT["car_red"], along="y", z=gz)
car("car3", 36.5, 24.65, MAT["car_grey"], along="x")

# ---------------- carport ----------------
c = first_rect(els["carport"])
ccx, ccy = rect_center(c)
cz = ground_h(ccx, ccy)
for i, (px, py) in enumerate([(c["x"] + 0.3, c["y"] + 0.3), (c["x"] + c["w"] - 0.3, c["y"] + 0.3),
                              (c["x"] + 0.3, c["y"] + c["d"] - 0.3),
                              (c["x"] + c["w"] - 0.3, c["y"] + c["d"] - 0.3)]):
    post("carport_post%d" % i, px, py, ground_h(px, py) - 0.2, cz + 2.3, MAT["wood"], half=0.07)
rect_box("carport_roof", c, cz + 2.3, cz + 2.42, MAT["roof"])

# ---------------- terraces, path, driveway, parking ----------------
for eid, mat in [("westTerrace", MAT["deck"]), ("eastTerrace", MAT["deck"]), ("saunaPath", MAT["path"])]:
    for i, prt in enumerate(x for x in els[eid]["parts"] if x["kind"] == "rect"):
        px, py = rect_center(prt)
        z = ground_h(px, py)
        rect_box("%s_%d" % (eid, i), prt, z - 0.05, z + 0.15, mat)

draped_poly("driveway", dpoly, 0.04, MAT["drive"])
pk = first_rect(els["parking"])
pcx, pcy = rect_center(pk)
pkz = ground_h(pcx, pcy)
rect_box("parking", pk, pkz - 0.05, pkz + 0.05, MAT["drive"])

# ---------------- pond ----------------
pe = next(x for x in els["pond"]["parts"] if x["kind"] == "ellipse")
pz = ground_h(pe["cx"], pe["cy"])
add_cyl("pond_basin", pe["cx"], pe["cy"], pz - 0.26, 1.0, 0.08, MAT["basin"], sx=pe["rx"] * 0.92, sy=pe["ry"] * 0.92)
add_cyl("pond_water", pe["cx"], pe["cy"], pz - 0.16, 1.0, 0.06, MAT["water"], sx=pe["rx"] * 0.97, sy=pe["ry"] * 0.97)
bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.09, location=(pe["cx"], -pe["cy"], pz))
tor = bpy.context.active_object
tor.name = "pond_rim"
tor.scale = (pe["rx"], pe["ry"], 1.0)
tor.data.materials.append(MAT["rim"])

# ---------------- fire pit + stones + benches ----------------
fc = next(x for x in els["firePit"]["parts"] if x["kind"] == "circle")
fz = ground_h(fc["cx"], fc["cy"])
for i in range(12):
    a = i * math.pi / 6.0 + random.random() * 0.2
    sx = fc["cx"] + 0.72 * math.cos(a)
    sy = fc["cy"] + 0.72 * math.sin(a)
    rr = 0.13 + random.random() * 0.07
    add_sphere("firepit_stone%d" % i, sx, sy, fz + 0.10, rr, MAT["stone"],
               scale=(1.0 + random.random() * 0.3, 1.0, 0.75), rot=(0, 0, random.random() * 3), subdiv=1)
add_sphere("firepit_fire", fc["cx"], fc["cy"], fz + 0.14, 0.21, MAT["fire"], scale=(1.0, 1.0, 0.8))
for i, a_deg in enumerate((140, 260, 20)):
    ar = math.radians(a_deg)
    bx = fc["cx"] + 1.85 * math.cos(ar)
    by = fc["cy"] + 1.85 * math.sin(ar)
    bz = ground_h(bx, by)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(bx, -by, bz + 0.175))
    ob = bpy.context.active_object
    ob.name = "bench%d" % i
    ob.scale = (1.4, 0.3, 0.35)
    ob.rotation_euler = (0, 0, math.radians(-(a_deg + 90)))
    ob.data.materials.append(MAT["wood"])

# ---------------- rain tank, sauna, shelter, softub ----------------
rt = first_rect(els["rainTank"])
rcx, rcy = rect_center(rt)
add_cyl("rainTank_manhole", rcx, rcy, ground_h(rcx, rcy) + 0.02, 0.4, 0.06, MAT["manhole"])

s = first_rect(els["sauna"])
scx, scy = rect_center(s)
sz = ground_h(scx, scy)
rect_box("sauna", s, sz - 0.3, sz + 3.0, MAT["wood"])

sh = first_rect(els["saunaShelter"])
shcx, shcy = rect_center(sh)
shz = ground_h(shcx, shcy)
for i, (px, py) in enumerate([(sh["x"] + 0.15, sh["y"] + 0.15), (sh["x"] + sh["w"] - 0.15, sh["y"] + 0.15),
                              (sh["x"] + 0.15, sh["y"] + sh["d"] - 0.15),
                              (sh["x"] + sh["w"] - 0.15, sh["y"] + sh["d"] - 0.15)]):
    post("shelter_post%d" % i, px, py, ground_h(px, py) - 0.2, shz + 2.5, MAT["wood"], half=0.06)
rect_box("shelter_roof", sh, shz + 2.5, shz + 2.6, MAT["roof"])

st = next(x for x in els["softub"]["parts"] if x["kind"] == "circle")
stz = ground_h(st["cx"], st["cy"])
add_cyl("softub", st["cx"], st["cy"], stz + 0.4, st["r"], 0.8, MAT["wood"])
add_cyl("softub_water", st["cx"], st["cy"], stz + 0.78, st["r"] * 0.9, 0.05, MAT["water"])

# ---------------- pergola ----------------
pg = first_rect(els["pergola"])
pgcx, pgcy = rect_center(pg)
pgz = ground_h(pgcx, pgcy)
for i, (px, py) in enumerate([(pg["x"] + 0.2, pg["y"] + 0.2), (pg["x"] + pg["w"] - 0.2, pg["y"] + 0.2),
                              (pg["x"] + 0.2, pg["y"] + pg["d"] - 0.2),
                              (pg["x"] + pg["w"] - 0.2, pg["y"] + pg["d"] - 0.2)]):
    post("pergola_post%d" % i, px, py, ground_h(px, py) - 0.2, pgz + 2.5, MAT["wood"], half=0.07)
for i in range(15):
    bx = pg["x"] + 0.25 + i * (pg["w"] - 0.5) / 14.0
    box_p("pergola_board%d" % i, bx - 0.05, pg["y"], bx + 0.05, pg["y"] + pg["d"],
          pgz + 2.5, pgz + 2.58, MAT["wood"])

# ---------------- raised beds ----------------
for eid in ["raisedBed1", "raisedBed2", "raisedBed3", "raisedBed4"]:
    r = first_rect(els[eid])
    bcx, bcy = rect_center(r)
    z = ground_h(bcx, bcy)
    rect_box(eid, r, z - 0.1, z + 0.4, MAT["wood"])


# ---------------- trees ----------------
def make_tree(idx, cx, cy):
    z = terrain_z(cx, cy)
    sf = 0.8 + random.random() * 0.6
    trunk_h = 1.4 * sf
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.14 * sf, radius2=0.08 * sf,
                                    depth=trunk_h, location=(cx, -cy, z + trunk_h / 2 - 0.1))
    tr = bpy.context.active_object
    tr.name = "tree%d_trunk" % idx
    tr.data.materials.append(MAT["trunk"])
    mat = random.choice(CANOPY)
    for j in range(random.choice([2, 3])):
        rr = (0.7 + random.random() * 0.5) * sf
        ox = (random.random() - 0.5) * 0.7 * sf
        oy = (random.random() - 0.5) * 0.7 * sf
        oz = z + trunk_h - 0.2 + j * 0.55 * sf + (random.random() - 0.5) * 0.2
        sc = (1.0 + (random.random() - 0.5) * 0.3, 1.0 + (random.random() - 0.5) * 0.3,
              0.85 + (random.random() - 0.5) * 0.2)
        add_sphere("tree%d_c%d" % (idx, j), cx + ox, cy + oy, oz, rr, mat, scale=sc,
                   rot=(random.random(), random.random(), random.random()))


tree_i = 0
for eid in ["northTrees", "eastTrees", "orchard"]:
    for prt in els[eid]["parts"]:
        if prt["kind"] == "circle":
            make_tree(tree_i, prt["cx"], prt["cy"])
            tree_i += 1

# ---------------- perennial strip + bushes ----------------
peren_i = 0
while peren_i < 35:
    px = 5.0 + random.random() * 38.0
    if 3.5 <= px <= 10.5 or 25.28 <= px <= 32.28:
        continue
    py = 0.3 + random.random() * 2.2
    rr = 0.25 + random.random() * 0.35
    z = ground_h(px, py)
    add_sphere("peren%d" % peren_i, px, py, z + rr * 0.5, rr, random.choice(PASTEL),
               scale=(1.0, 1.0, 0.75 + random.random() * 0.3), subdiv=2)
    peren_i += 1

for i, (bx, by) in enumerate([(7, 11), (7, 14), (7, 18), (7, 22), (25.5, 12.5), (34.5, 12.5),
                              (25.5, 17.8), (34.5, 17.8), (4, 6), (11.5, 6)]):
    z = ground_h(bx, by)
    mat = random.choice(CANOPY)
    a = random.random() * 6.28
    add_sphere("bush%d_a" % i, bx + 0.3 * math.cos(a), by + 0.3 * math.sin(a), z + 0.42, 0.55, mat,
               scale=(1.1, 1.0, 0.85))
    add_sphere("bush%d_b" % i, bx - 0.3 * math.cos(a), by - 0.3 * math.sin(a), z + 0.34, 0.42, mat,
               scale=(1.0, 1.1, 0.9))

# ---------------- fence ----------------
GATE_A = Vector((43.83, 27.89))
GATE_B = Vector((43.44, 32.39))


def in_gate(px, py):
    ab = GATE_B - GATE_A
    t = (Vector((px, py)) - GATE_A).dot(ab) / ab.length_squared
    if -0.05 < t < 1.05:
        closest = GATE_A + ab * t
        return (Vector((px, py)) - closest).length < 0.6
    return False


def build_fence():
    n = len(plot)
    post_i = 0
    for i in range(n):
        a = Vector(plot[i])
        b = Vector(plot[(i + 1) % n])
        L = (b - a).length
        steps = max(1, int(math.ceil(L / 2.0)))
        pts = [a.lerp(b, t / steps) for t in range(steps + 1)]
        for pt in pts:
            if in_gate(pt.x, pt.y):
                continue
            z = ground_h(pt.x, pt.y)
            post("fence_post%d" % post_i, pt.x, pt.y, z - 0.15, z + 1.1, MAT["fence"], half=0.045)
            post_i += 1
        for j in range(steps):
            sp, ep = pts[j], pts[j + 1]
            mid = sp.lerp(ep, 0.5)
            if in_gate(sp.x, sp.y) or in_gate(ep.x, ep.y) or in_gate(mid.x, mid.y):
                continue
            for rz in (0.55, 0.95):
                s3 = Vector((sp.x, -sp.y, ground_h(sp.x, sp.y) + rz))
                e3 = Vector((ep.x, -ep.y, ground_h(ep.x, ep.y) + rz))
                d = e3 - s3
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(s3 + d / 2))
                ob = bpy.context.active_object
                ob.name = "fence_rail%d_%s" % (post_i, rz)
                ob.scale = (d.length, 0.035, 0.06)
                ob.rotation_euler = d.to_track_quat("X", "Z").to_euler()
                ob.data.materials.append(MAT["fence"])


build_fence()

# ---------------- sun + sky ----------------
lat = math.radians(50.0)
decl = math.radians(23.45 * math.sin(2 * math.pi * (284 + 172) / 365.0))
H = math.radians((14 - 12) * 15.0)
sin_e = math.sin(lat) * math.sin(decl) + math.cos(lat) * math.cos(decl) * math.cos(H)
elev = math.asin(sin_e)
cos_az = (math.sin(decl) - sin_e * math.sin(lat)) / (math.cos(elev) * math.cos(lat))
az = math.acos(max(-1.0, min(1.0, cos_az)))
if H > 0:
    az = 2 * math.pi - az
print("SUN elevation %.1f deg, azimuth %.1f deg from north" % (math.degrees(elev), math.degrees(az)))

world = scene.world or bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
wnt = world.node_tree
for nd in list(wnt.nodes):
    wnt.nodes.remove(nd)
sky = wnt.nodes.new("ShaderNodeTexSky")
try:
    sky.sky_type = "NISHITA"
except (AttributeError, TypeError):
    pass
if hasattr(sky, "sun_elevation"):
    sky.sun_elevation = elev
if hasattr(sky, "sun_rotation"):
    sky.sun_rotation = az
if hasattr(sky, "sun_disc"):
    sky.sun_disc = False
bg = wnt.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 0.12
bg_cam = wnt.nodes.new("ShaderNodeBackground")
bg_cam.inputs["Strength"].default_value = 0.5
lp = wnt.nodes.new("ShaderNodeLightPath")
mixsh = wnt.nodes.new("ShaderNodeMixShader")
out = wnt.nodes.new("ShaderNodeOutputWorld")
wnt.links.new(sky.outputs["Color"], bg.inputs["Color"])
wnt.links.new(sky.outputs["Color"], bg_cam.inputs["Color"])
wnt.links.new(lp.outputs["Is Camera Ray"], mixsh.inputs["Fac"])
wnt.links.new(bg.outputs["Background"], mixsh.inputs[1])
wnt.links.new(bg_cam.outputs["Background"], mixsh.inputs[2])
wnt.links.new(mixsh.outputs["Shader"], out.inputs["Surface"])

sun_dir = Vector((math.sin(az) * math.cos(elev), math.cos(az) * math.cos(elev), math.sin(elev)))
sun_data = bpy.data.lights.new("Sun", type="SUN")
sun_data.energy = 4.0
sun_data.angle = math.radians(0.526)
sun = bpy.data.objects.new("Sun", sun_data)
bpy.context.collection.objects.link(sun)
sun.location = (22, -17, 40)
sun.rotation_euler = sun_dir.to_track_quat("Z", "Y").to_euler()


# ---------------- cameras ----------------
def add_cam(name, loc, target, lens, fstop=None):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    ob = bpy.data.objects.new(name, cd)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = d.length
    return ob


walk_loc = (33.4, -10.4, ground_h(33.4, 10.4) + 1.65)
walk_tgt = (36.0, -8.0, ground_h(36, 8) + 0.5)
cams = [
    ("iso", add_cam("iso", (60, -55, 35), (22, -17, 2), 40)),
    ("walk", add_cam("walk", walk_loc, walk_tgt, 30, fstop=2.8)),
]

# ---------------- render ----------------
scene.render.engine = "CYCLES"
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.cycles.samples = 128
scene.cycles.use_denoising = True

device_used = "CPU"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    try:
        prefs.refresh_devices()
    except AttributeError:
        prefs.get_devices()
    metal = [d for d in prefs.devices if d.type == "METAL"]
    if metal:
        for d in prefs.devices:
            d.use = d.type in {"METAL", "CPU"}
        scene.cycles.device = "GPU"
        device_used = "GPU/Metal (%s)" % metal[0].name
except Exception as ex:
    print("Metal unavailable, CPU fallback:", ex)
print("RENDER DEVICE:", device_used)

scene.camera = cams[0][1]
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "garden.blend"))
print("SAVED", os.path.join(out_dir, "garden.blend"))

if NO_RENDER:
    print("NO-RENDER mode: scene built, skipping renders")
else:
    for name, cam in cams:
        scene.camera = cam
        scene.render.filepath = os.path.join(out_dir, "render-%s.png" % name)
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        print("RENDER %s done in %.1fs -> %s" % (name, time.time() - t0, scene.render.filepath))
    print("POC DONE")
