"""Garden PoC: build scene from garden.json and render two views headlessly.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/poc.py -- blender/garden.json
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
json_path = os.path.abspath(argv[argv.index("--") + 1])
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


PONDS = []  # (cx, cy, rx, ry, depth) depressions carved into terrain


def terrain_z(x, y):
    z = ground_h(x, y)
    for cx, cy, rx, ry, depth in PONDS:
        d2 = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
        if d2 < 1.0:
            z -= depth * (1.0 - d2)
    return z


def hexc(h):
    return tuple((int(h[i:i + 2], 16) / 255.0) ** 2.2 for i in (1, 3, 5))


def mat_simple(name, color, rough=0.6, metal=0.0, emit=None, emit_str=0.0, transmission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if transmission:
        try:
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


def mat_grass(name, c1, c2, rough=0.9, scale=18.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
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


MAT = {
    "grass": mat_grass("grass", hexc("#7eaf6d"), hexc("#5e8f52")),
    "meadow": mat_grass("meadow", hexc("#6f9a60"), hexc("#8a9a58"), scale=9.0),
    "walls": mat_simple("walls", hexc("#d4b896"), rough=0.8),
    "garage_walls": mat_simple("garage_walls", hexc("#9a9a9a"), rough=0.8),
    "roof": mat_simple("roof", hexc("#8a8f94"), rough=0.35, metal=0.6),
    "wood": mat_simple("wood", hexc("#7a5a3a"), rough=0.7),
    "deck": mat_simple("deck", hexc("#a87d4a"), rough=0.7),
    "path": mat_simple("path", hexc("#cdc1ad"), rough=0.85),
    "drive": mat_simple("drive", hexc("#cccccc"), rough=0.8),
    "water": mat_simple("water", hexc("#3a7ab8"), rough=0.05, transmission=0.25),
    "rim": mat_simple("rim", hexc("#8f8a80"), rough=0.8),
    "stone": mat_simple("stone", hexc("#4a4038"), rough=0.9),
    "fire": mat_simple("fire", hexc("#ff7733"), emit=hexc("#ff6622"), emit_str=8.0),
    "trunk": mat_simple("trunk", hexc("#5a4630"), rough=0.9),
    "fence": mat_simple("fence", hexc("#6b5844"), rough=0.8),
    "manhole": mat_simple("manhole", hexc("#666666"), rough=0.5, metal=0.4),
}
CANOPY = [mat_simple("canopy%d" % i, c, rough=0.85) for i, c in enumerate(
    [hexc("#3f6b3a"), hexc("#4d7a4d"), hexc("#42704a"), hexc("#557f45")])]


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


def rect_box(name, r, z0, z1, mat):
    """Box from a plan-coords rect part."""
    return box_b(name, r["x"], r["x"] + r["w"], -(r["y"] + r["d"]), -r["y"], z0, z1, mat)


def rect_center(r):
    return r["x"] + r["w"] / 2.0, r["y"] + r["d"] / 2.0


def extrude_poly(name, pts, z0, z1, mat):
    """Prism from plan-coords polygon."""
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
    """Polygon filled, subdivided, draped on terrain."""
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


def gable(name, x0, x1, y0s, y1s, z_eave, z_ridge, ridge_x, mat, z_base=None):
    """N-S ridge gable prism over plan-x [x0,x1], plan-y [y0s,y1s]."""
    ya, yb = -y1s, -y0s
    zb = z_base if z_base is not None else z_eave
    bm = bmesh.new()
    co = [(x0, ya, zb), (ridge_x, ya, z_ridge), (x1, ya, zb),
          (x0, yb, zb), (ridge_x, yb, z_ridge), (x1, yb, zb)]
    if zb < z_eave:
        pass
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


def add_cyl(name, x, y, z, r, depth, mat, sx=1.0, sy=1.0, verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=(x, -y, z))
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (sx, sy, 1.0)
    ob.data.materials.append(mat)
    return ob


def add_sphere(name, x, y, z, r, mat, scale=None, rot=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r, location=(x, -y, z))
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


def make_tree(idx, cx, cy, r_hint):
    z = terrain_z(cx, cy)
    s = 0.8 + random.random() * 0.6
    trunk_h = 1.4 * s
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.14 * s, radius2=0.08 * s,
                                    depth=trunk_h, location=(cx, -cy, z + trunk_h / 2 - 0.1))
    tr = bpy.context.active_object
    tr.name = "tree%d_trunk" % idx
    tr.data.materials.append(MAT["trunk"])
    mat = random.choice(CANOPY)
    n = random.choice([2, 3])
    for j in range(n):
        rr = (0.7 + random.random() * 0.5) * s
        ox = (random.random() - 0.5) * 0.7 * s
        oy = (random.random() - 0.5) * 0.7 * s
        oz = z + trunk_h - 0.2 + j * 0.55 * s + (random.random() - 0.5) * 0.2
        sc = (1.0 + (random.random() - 0.5) * 0.3, 1.0 + (random.random() - 0.5) * 0.3,
              0.85 + (random.random() - 0.5) * 0.2)
        rot = (random.random(), random.random(), random.random())
        add_sphere("tree%d_c%d" % (idx, j), cx + ox, cy + oy, oz, rr, mat, scale=sc, rot=rot)


# ---- terrain (pentagon plot + surrounding meadow) ----
PONDS.append((30.0, 15.0, 2.8, 2.0, 0.45))  # pond depression, carved before terrain build

plot = GARDEN["plot"]["vertices"]


def build_terrain():
    bm = bmesh.new()
    vs = [bm.verts.new((p[0], -p[1], 0.0)) for p in plot]
    bm.faces.new(vs)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    for _ in range(6):
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    for v in bm.verts:
        v.co.z = terrain_z(v.co.x, -v.co.y)
    mesh = bpy.data.meshes.new("terrain")
    bm.to_mesh(mesh)
    bm.free()
    ob = link_obj("terrain", mesh, MAT["grass"])
    for poly in ob.data.polygons:
        poly.use_smooth = True


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

# ---- elements ----
els = {e["id"]: e for e in GARDEN["elements"]}


def first_rect(el):
    return next(p for p in el["parts"] if p["kind"] == "rect")


# house
house = els["house"]
hpoly = next(p for p in house["parts"] if p["kind"] == "polygon")["points"]
bb = house["meta"]["bbox"]
hxs = [p[0] for p in hpoly]
hys = [p[1] for p in hpoly]
h_cz = ground_h((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2)
h_base = min(ground_h(x, y) for x, y in hpoly) - 0.2
wall_top = h_cz + 2.8
extrude_poly("house_walls", hpoly, h_base, wall_top, MAT["walls"])
core = house["meta"]["coreX"]
ridge_x = (core[0] + core[1]) / 2.0
gable("house_roof", bb[0] - 0.3, bb[2] + 0.3, bb[1] - 0.3, bb[3] + 0.3,
      wall_top, h_cz + 5.0, ridge_x, MAT["roof"])

# garage
g = first_rect(els["garage"])
gcx, gcy = rect_center(g)
gz = ground_h(gcx, gcy)
rect_box("garage", g, gz - 0.3, gz + 2.3, MAT["garage_walls"])
gable("garage_roof", g["x"] - 0.2, g["x"] + g["w"] + 0.2, g["y"] - 0.2, g["y"] + g["d"] + 0.2,
      gz + 2.3, gz + 3.1, gcx, MAT["roof"])

# carport: 4 posts + flat roof
c = first_rect(els["carport"])
ccx, ccy = rect_center(c)
cz = ground_h(ccx, ccy)
for i, (px, py) in enumerate([(c["x"] + 0.3, c["y"] + 0.3), (c["x"] + c["w"] - 0.3, c["y"] + 0.3),
                              (c["x"] + 0.3, c["y"] + c["d"] - 0.3),
                              (c["x"] + c["w"] - 0.3, c["y"] + c["d"] - 0.3)]):
    post("carport_post%d" % i, px, py, ground_h(px, py) - 0.2, cz + 2.3, MAT["wood"], half=0.07)
rect_box("carport_roof", c, cz + 2.3, cz + 2.42, MAT["roof"])

# terraces + sauna path: thin platforms at center terrain height
for eid, mat in [("westTerrace", MAT["deck"]), ("eastTerrace", MAT["deck"]), ("saunaPath", MAT["path"])]:
    for i, p in enumerate(x for x in els[eid]["parts"] if x["kind"] == "rect"):
        px, py = rect_center(p)
        z = ground_h(px, py)
        rect_box("%s_%d" % (eid, i), p, z - 0.05, z + 0.15, mat)

# driveway draped on terrain
dpoly = next(p for p in els["driveway"]["parts"] if p["kind"] == "polygon")["points"]
draped_poly("driveway", dpoly, 0.04, MAT["drive"])

# parking pad
p = first_rect(els["parking"])
pcx, pcy = rect_center(p)
pz = ground_h(pcx, pcy)
rect_box("parking", p, pz - 0.05, pz + 0.05, MAT["drive"])

# pond: water disc in the carved depression + rim ring
pe = next(x for x in els["pond"]["parts"] if x["kind"] == "ellipse")
pz = ground_h(pe["cx"], pe["cy"])
add_cyl("pond_water", pe["cx"], pe["cy"], pz - 0.22, 1.0, 0.1, MAT["water"], sx=pe["rx"] * 0.97, sy=pe["ry"] * 0.97)
bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.09, location=(pe["cx"], -pe["cy"], pz))
tor = bpy.context.active_object
tor.name = "pond_rim"
tor.scale = (pe["rx"], pe["ry"], 1.0)
tor.data.materials.append(MAT["rim"])

# fire pit: stone ring + embers
fc = next(x for x in els["firePit"]["parts"] if x["kind"] == "circle")
fz = ground_h(fc["cx"], fc["cy"])
bpy.ops.mesh.primitive_torus_add(major_radius=fc["r"] * 0.8, minor_radius=0.18, location=(fc["cx"], -fc["cy"], fz + 0.12))
tor = bpy.context.active_object
tor.name = "firepit_ring"
tor.data.materials.append(MAT["stone"])
add_sphere("firepit_fire", fc["cx"], fc["cy"], fz + 0.18, 0.28, MAT["fire"])

# rain tank: flat manhole disc
rt = first_rect(els["rainTank"])
rcx, rcy = rect_center(rt)
add_cyl("rainTank_manhole", rcx, rcy, ground_h(rcx, rcy) + 0.02, 0.4, 0.06, MAT["manhole"])

# sauna box
s = first_rect(els["sauna"])
scx, scy = rect_center(s)
sz = ground_h(scx, scy)
rect_box("sauna", s, sz - 0.3, sz + 3.0, MAT["wood"])

# sauna shelter: 4 posts + flat roof
sh = first_rect(els["saunaShelter"])
shcx, shcy = rect_center(sh)
shz = ground_h(shcx, shcy)
for i, (px, py) in enumerate([(sh["x"] + 0.15, sh["y"] + 0.15), (sh["x"] + sh["w"] - 0.15, sh["y"] + 0.15),
                              (sh["x"] + 0.15, sh["y"] + sh["d"] - 0.15),
                              (sh["x"] + sh["w"] - 0.15, sh["y"] + sh["d"] - 0.15)]):
    post("shelter_post%d" % i, px, py, ground_h(px, py) - 0.2, shz + 2.5, MAT["wood"], half=0.06)
rect_box("shelter_roof", sh, shz + 2.5, shz + 2.6, MAT["roof"])

# softub: cylinder + water top
st = next(x for x in els["softub"]["parts"] if x["kind"] == "circle")
stz = ground_h(st["cx"], st["cy"])
add_cyl("softub", st["cx"], st["cy"], stz + 0.4, st["r"], 0.8, MAT["wood"])
add_cyl("softub_water", st["cx"], st["cy"], stz + 0.78, st["r"] * 0.9, 0.05, MAT["water"])

# pergola: 4 posts + slatted top
pg = first_rect(els["pergola"])
pgcx, pgcy = rect_center(pg)
pgz = ground_h(pgcx, pgcy)
for i, (px, py) in enumerate([(pg["x"] + 0.2, pg["y"] + 0.2), (pg["x"] + pg["w"] - 0.2, pg["y"] + 0.2),
                              (pg["x"] + 0.2, pg["y"] + pg["d"] - 0.2),
                              (pg["x"] + pg["w"] - 0.2, pg["y"] + pg["d"] - 0.2)]):
    post("pergola_post%d" % i, px, py, ground_h(px, py) - 0.2, pgz + 2.5, MAT["wood"], half=0.07)
for i in range(15):
    bx = pg["x"] + 0.25 + i * (pg["w"] - 0.5) / 14.0
    box_b("pergola_board%d" % i, bx - 0.05, bx + 0.05, -(pg["y"] + pg["d"]), -pg["y"],
          pgz + 2.5, pgz + 2.58, MAT["wood"])

# raised beds
for eid in ["raisedBed1", "raisedBed2", "raisedBed3", "raisedBed4"]:
    r = first_rect(els[eid])
    rcx, rcy = rect_center(r)
    z = ground_h(rcx, rcy)
    rect_box(eid, r, z - 0.1, z + 0.4, MAT["wood"])

# trees: every circle in northTrees, eastTrees, orchard
tree_i = 0
for eid in ["northTrees", "eastTrees", "orchard"]:
    for prt in els[eid]["parts"]:
        if prt["kind"] == "circle":
            make_tree(tree_i, prt["cx"], prt["cy"], prt["r"])
            tree_i += 1

# ---- fence along plot boundary, gate gap on east side ----
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
            s, e = pts[j], pts[j + 1]
            mid = s.lerp(e, 0.5)
            if in_gate(s.x, s.y) or in_gate(e.x, e.y) or in_gate(mid.x, mid.y):
                continue
            for rz in (0.55, 0.95):
                s3 = Vector((s.x, -s.y, ground_h(s.x, s.y) + rz))
                e3 = Vector((e.x, -e.y, ground_h(e.x, e.y) + rz))
                d = e3 - s3
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(s3 + d / 2))
                ob = bpy.context.active_object
                ob.name = "fence_rail%d_%s" % (post_i, rz)
                ob.scale = (d.length, 0.035, 0.06)
                ob.rotation_euler = d.to_track_quat("X", "Z").to_euler()
                ob.data.materials.append(MAT["fence"])


build_fence()

# ---- sun + sky ----
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
out = wnt.nodes.new("ShaderNodeOutputWorld")
wnt.links.new(sky.outputs["Color"], bg.inputs["Color"])
wnt.links.new(bg.outputs["Background"], out.inputs["Surface"])

sun_dir = Vector((math.sin(az) * math.cos(elev), math.cos(az) * math.cos(elev), math.sin(elev)))
sun_data = bpy.data.lights.new("Sun", type="SUN")
sun_data.energy = 4.0
sun_data.angle = math.radians(0.526)
sun = bpy.data.objects.new("Sun", sun_data)
bpy.context.collection.objects.link(sun)
sun.location = (22, -17, 40)
sun.rotation_euler = sun_dir.to_track_quat("Z", "Y").to_euler()

# ---- cameras ----
def add_cam(name, loc, target, lens):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    ob = bpy.data.objects.new(name, cd)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


walk_z = ground_h(34, 9.5) + 1.7
fire_z = ground_h(36, 8) + 1.0
cams = [
    ("iso", add_cam("iso", (60, -55, 35), (22, -17, 2), 40)),
    ("walk", add_cam("walk", (34, -9.5, walk_z), (36, -8, fire_z), 24)),
]

# ---- render setup ----
scene.render.engine = "CYCLES"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.cycles.samples = 96
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

for name, cam in cams:
    scene.camera = cam
    scene.render.filepath = os.path.join(out_dir, "render-%s.png" % name)
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print("RENDER %s done in %.1fs -> %s" % (name, time.time() - t0, scene.render.filepath))

print("POC DONE")
