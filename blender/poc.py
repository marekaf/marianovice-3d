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
from mathutils import Quaternion, Vector, noise

argv = sys.argv
extra = argv[argv.index("--") + 1:]
json_path = os.path.abspath(extra[0])
NO_RENDER = "--no-render" in extra
out_dir = os.path.dirname(json_path)
ASSETS = os.path.join(out_dir, "assets")
with open(json_path) as f:
    GARDEN = json.load(f)

random.seed(42)
scene = bpy.context.scene

for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)


def smoothstep01(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


CUT_Z = 2.46  # graded cut for the level west decks
APRON_Z = -0.050 * 15.88 + 0.030 * 16.805 + 2.775 - 0.5  # garage floor level
DRIP_Z = 2.345  # drip-strip dig level along the facade
DRIP_BANDS = [(10.48, 21.28, 6.68, 7.18), (10.48, 21.28, 26.43, 26.93), (21.28, 21.78, 7.18, 11.58)]


def ground_h(x, y):
    """Terrain height in plan coords (x east, y south), incl. grading cuts."""
    z = max(0.0, -0.050 * x + 0.030 * y + 2.775)
    in_a = 6.5 <= x <= 10.6 and 6.7 <= y <= 28.8
    in_b = 10.48 <= x <= 14.78 and 15.93 <= y <= 19.18
    if in_a or in_b:
        s = 1.0 if in_b else smoothstep01((x - 6.5) / 1.8) * smoothstep01((28.8 - y) / 1.8)
        z -= max(0.0, z - CUT_Z) * s
    if 24.13 <= x <= 34.81 and 26.45 <= y <= 30.75:  # level apron at the garage door
        s = smoothstep01((x - 24.13) / 3.5) * smoothstep01((30.75 - y) / 3.5)
        z -= max(0.0, z - APRON_Z) * s
    for bx0, bx1, by0, by1 in DRIP_BANDS:
        if bx0 - 0.6 <= x <= bx1 + 0.6 and by0 - 0.6 <= y <= by1 + 0.6:
            sx = min(smoothstep01((x - bx0 + 0.6) / 0.6), smoothstep01((bx1 + 0.6 - x) / 0.6))
            sy = min(smoothstep01((y - by0 + 0.6) / 0.6), smoothstep01((by1 + 0.6 - y) / 0.6))
            z -= max(0.0, z - DRIP_Z) * min(sx, sy)
    return z


_pond = next(p for e in GARDEN["elements"] if e["id"] == "pond"
             for p in e["parts"] if p["kind"] == "ellipse")
POND = (_pond["cx"], _pond["cy"], _pond["rx"], _pond["ry"])
POND_EDGE_MIN = min(ground_h(POND[0] + POND[2] * math.cos(a), POND[1] + POND[3] * math.sin(a))
                    for a in [i * math.pi / 8.0 for i in range(16)])
POND_WATER_Z = POND_EDGE_MIN - 0.10


def terrain_z(x, y):
    z = ground_h(x, y)
    cx, cy, rx, ry = POND
    d2 = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
    if d2 < 1.0:
        rr = math.sqrt(d2)
        bowl = POND_EDGE_MIN - 0.55 * (0.5 + 0.5 * math.cos(math.pi * rr))
        z += (min(bowl, z) - z) * smoothstep01((1.0 - rr) / 0.3)
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


def find_map(slug, kind):
    d = os.path.join(ASSETS, "textures", slug)
    if not os.path.isdir(d):
        return None
    for fn in sorted(os.listdir(d)):
        if kind in fn:
            return os.path.join(d, fn)
    return None


def mat_pbr(name, slug, scale=1.0, tint=None, tint_fac=0.85, tint_mode="MULTIPLY",
            rough_fallback=0.8, metal=0.0, nrm=1.0, spec=None):
    """PBR from downloaded texture set, box-projected in object space (no UVs needed)."""
    m, nt, b = new_mat(name)
    b.inputs["Metallic"].default_value = metal
    if spec is not None:
        for sname in ("Specular IOR Level", "Specular"):
            if sname in b.inputs:
                b.inputs[sname].default_value = spec
                break
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])

    def img_node(path, ncol=False):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(path, check_existing=True)
        if ncol:
            n.image.colorspace_settings.name = "Non-Color"
        n.projection = "BOX"
        n.projection_blend = 0.3
        nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
        return n

    diff = img_node(find_map(slug, "_diff_"))
    col_out = diff.outputs["Color"]
    if tint is not None:
        mixn = nt.nodes.new("ShaderNodeMix")
        mixn.data_type = "RGBA"
        mixn.blend_type = tint_mode
        # RGBA sockets by index: several inputs share the names A/B/Result
        mixn.inputs[0].default_value = tint_fac
        mixn.inputs[7].default_value = (*tint, 1.0)
        nt.links.new(col_out, mixn.inputs[6])
        col_out = mixn.outputs[2]
    nt.links.new(col_out, b.inputs["Base Color"])
    rpath = find_map(slug, "_rough_")
    if rpath:
        rough = img_node(rpath, ncol=True)
        nt.links.new(rough.outputs["Color"], b.inputs["Roughness"])
    else:
        b.inputs["Roughness"].default_value = rough_fallback
    npath = find_map(slug, "_nor_gl_")
    if npath:
        nor = img_node(npath, ncol=True)
        nmn = nt.nodes.new("ShaderNodeNormalMap")
        nmn.inputs["Strength"].default_value = nrm
        nt.links.new(nor.outputs["Color"], nmn.inputs["Color"])
        nt.links.new(nmn.outputs["Normal"], b.inputs["Normal"])
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


def mat_pavers(name):
    """DITON large-format concrete pavers: world-space 0.60 x 0.40 m running-bond
    slabs, ~5 mm recessed dark joints, subtle grey multi-tone per slab. Fed from
    Geometry Position so the module size is exact regardless of the draped mesh."""
    m, nt, b = new_mat(name)
    b.inputs["Metallic"].default_value = 0.0
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.5           # running bond: every other row shifted half a slab
    brick.offset_frequency = 2
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Mortar Size"].default_value = 0.010   # ~5 mm joint at this module
    brick.inputs["Mortar Smooth"].default_value = 0.10
    brick.inputs["Bias"].default_value = 0.0
    brick.inputs["Brick Width"].default_value = 0.60
    brick.inputs["Row Height"].default_value = 0.40
    brick.inputs["Color1"].default_value = (*hexc("#9c9995"), 1.0)
    brick.inputs["Color2"].default_value = (*hexc("#88857f"), 1.0)
    brick.inputs["Mortar"].default_value = (*hexc("#47443e"), 1.0)
    nt.links.new(geo.outputs["Position"], brick.inputs["Vector"])
    # broad tonal drift so the field is not just two flat greys
    drift = nt.nodes.new("ShaderNodeTexNoise")
    drift.inputs["Scale"].default_value = 0.5
    drift.inputs["Detail"].default_value = 2.0
    nt.links.new(geo.outputs["Position"], drift.inputs["Vector"])
    dmap = nt.nodes.new("ShaderNodeMapRange")
    dmap.inputs["To Min"].default_value = 0.82
    dmap.inputs["To Max"].default_value = 1.0
    nt.links.new(drift.outputs["Fac"], dmap.inputs["Value"])
    tone = nt.nodes.new("ShaderNodeMix")
    tone.data_type = "RGBA"
    tone.blend_type = "MULTIPLY"
    tone.inputs[0].default_value = 1.0
    nt.links.new(brick.outputs["Color"], tone.inputs[6])
    nt.links.new(dmap.outputs["Result"], tone.inputs[7])
    nt.links.new(tone.outputs[2], b.inputs["Base Color"])
    # matte concrete; joints a touch rougher than the slab faces
    rmap = nt.nodes.new("ShaderNodeMapRange")
    rmap.inputs["To Min"].default_value = 0.62
    rmap.inputs["To Max"].default_value = 0.86
    nt.links.new(brick.outputs["Fac"], rmap.inputs["Value"])
    nt.links.new(rmap.outputs["Result"], b.inputs["Roughness"])
    # recessed joints: slab faces raised, mortar sunk (height = 1 - mortar Fac)
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(brick.outputs["Fac"], inv.inputs[1])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.02
    nt.links.new(inv.outputs["Value"], bump.inputs["Height"])
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
    ramp.color_ramp.elements[0].color = (*hexc("#3f683f"), 1.0)
    ramp.color_ramp.elements[1].color = (*hexc("#7fb37a"), 1.0)
    nt.links.new(oi.outputs["Random"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return m


MAT = {
    "soil": mat_pbr("soil", "leafy_grass", scale=0.45, tint=hexc("#45744c"), tint_fac=0.55, tint_mode="MIX", spec=0.0),
    "meadow": mat_pbr("meadow", "leafy_grass", scale=0.35, tint=hexc("#547c55"), tint_fac=0.8, tint_mode="MIX", spec=0.0),
    "walls": mat_pbr("walls", "plastered_wall_02", scale=0.6, tint=hexc("#cfc8ba"), tint_fac=0.85, tint_mode="MIX"),  # Weber HN3E, light warm greige
    "garage_walls": mat_pbr("garage_walls", "plastered_wall_02", scale=0.6, tint=hexc("#b4b6b8"), tint_fac=0.75, tint_mode="MIX"),
    "roof": mat_pbr("roof", "metal_plate_02", scale=0.8, tint=hexc("#7c838a"), tint_fac=0.7, tint_mode="MIX", metal=0.6),
    "wood": mat_wood("wood", hexc("#7a5a3a"), hexc("#5e4229")),
    "deck": mat_planks("deck", hexc("#a87d4a")),
    "path": mat_concrete("path", hexc("#cdc1ad"), hexc("#b7ab96")),
    "drive": mat_pbr("drive", "clean_asphalt", scale=0.4, tint=hexc("#c9c7c2"), tint_fac=0.45, tint_mode="MIX"),
    "gravel": mat_pbr("gravel", "gravel_floor_02", scale=0.8, tint=hexc("#b8b0a2"), tint_fac=0.4),
    "rock": mat_pbr("rock", "dark_rock", scale=1.3, tint=hexc("#90897f"), tint_fac=0.5, tint_mode="MIX"),
    "bark": mat_pbr("bark", "bark_brown_02", scale=1.4),
    "ash": mat_simple("ash", hexc("#55504a"), rough=1.0),
    "char": mat_wood("char", hexc("#241c15"), hexc("#0e0b08"), rough=0.9, stretch=(2.0, 2.0, 0.6)),
    "water": mat_simple("water", hexc("#2b4550"), rough=0.14),
    "glass": mat_simple("glass", hexc("#d5dde2"), rough=0.03, transmission=1.0, ior=1.45),
    "frame": mat_simple("frame", hexc("#2b2d30"), rough=0.45, metal=0.4),
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
FLOWER = [mat_simple("flower%d" % i, c, rough=0.8) for i, c in enumerate(
    [hexc("#e8e8e0"), hexc("#e8c94a"), hexc("#9a7ab8")])]
MAT["pavers"] = mat_pavers("pavers")
MAT["planter"] = mat_simple("planter", hexc("#3a3a3e"), rough=0.6)
MAT["tuft"] = mat_simple("tuft", hexc("#6f9a4a"), rough=0.8)
MAT["soil_pot"] = mat_simple("soil_pot", hexc("#3a2f24"), rough=0.95)
def mat_molinia_grad(name):
    """Ornamental grass: green base fading to straw tips, by object-space height."""
    m, nt, b = new_mat(name)
    b.inputs["Roughness"].default_value = 0.55
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Max"].default_value = 0.9
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*hexc("#41602c"), 1.0)
    e1 = ramp.color_ramp.elements[1]
    e1.position = 0.55
    e1.color = (*hexc("#8a9a4a"), 1.0)
    e2 = ramp.color_ramp.elements.new(1.0)
    e2.color = (*hexc("#c9b06a"), 1.0)
    nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return m


MAT["molinia"] = mat_molinia_grad("molinia")
MAT["seed"] = mat_simple("seed", hexc("#c9b06a"), rough=0.8)
MAT["bollard"] = mat_simple("bollard", hexc("#1c1c1e"), rough=0.4, metal=0.8)
MAT["bulb"] = mat_simple("bulb", hexc("#2a2419"), rough=0.5, emit=hexc("#ffbe78"), emit_str=6.0)
MAT["spot_disc"] = mat_simple("spot_disc", hexc("#2a2419"), rough=0.5, emit=hexc("#ffb060"), emit_str=4.0)

FLAME_STR = []


def mat_flame(name):
    """Stylized flame: emission gradient over height, fading to transparent at the tip."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp_c = nt.nodes.new("ShaderNodeValToRGB")
    ramp_c.color_ramp.elements[0].color = (1.0, 0.22, 0.02, 1.0)
    ec = ramp_c.color_ramp.elements[1]
    ec.position = 0.5
    ec.color = (1.0, 0.55, 0.08, 1.0)
    ec2 = ramp_c.color_ramp.elements.new(1.0)
    ec2.color = (1.0, 0.85, 0.35, 1.0)
    ramp_a = nt.nodes.new("ShaderNodeValToRGB")
    ramp_a.color_ramp.elements[0].color = (1.0, 1.0, 1.0, 1.0)
    ea = ramp_a.color_ramp.elements[1]
    ea.position = 0.65
    ea.color = (0.35, 0.35, 0.35, 1.0)
    ea2 = ramp_a.color_ramp.elements.new(1.0)
    ea2.color = (0.0, 0.0, 0.0, 1.0)
    em.inputs["Strength"].default_value = 6.0
    FLAME_STR.append(em.inputs["Strength"])
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], ramp_c.inputs["Fac"])
    nt.links.new(sep.outputs["Z"], ramp_a.inputs["Fac"])
    nt.links.new(ramp_c.outputs["Color"], em.inputs["Color"])
    nt.links.new(ramp_a.outputs["Color"], mix.inputs["Fac"])
    nt.links.new(tr.outputs["BSDF"], mix.inputs[1])
    nt.links.new(em.outputs["Emission"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return m


MAT["flame"] = mat_flame("flame")


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


def vtri_xz(name, pts_xz, y_plan, mat):
    """Single vertical triangle in the x-height plane at a fixed plan y."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, -y_plan, zz)) for (x, zz) in pts_xz]
    bm.faces.new(vs)
    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return link_obj(name, mesh, mat)


def gable(name, x0, x1, y0s, y1s, z_eave, z_ridge, ridge_x, mat, end_mat=None):
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
    ob = link_obj(name, mesh, mat)
    if end_mat is not None:  # gable-end triangles in facade material
        mesh.materials.append(end_mat)
        for poly in mesh.polygons:
            if len(poly.vertices) == 3:
                poly.material_index = 1
    return ob


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


def make_rock_mesh(name, seed_i):
    """Irregular boulder: icosphere displaced by 3D noise."""
    bm = bmesh.new()
    try:
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    except TypeError:
        bmesh.ops.create_icosphere(bm, subdivisions=2, diameter=1.0)
    off = Vector((seed_i * 4.13, seed_i * 1.71, seed_i * 2.9))
    for v in bm.verts:
        n = noise.noise(v.co * 1.8 + off)
        n2 = noise.noise(v.co * 5.5 + off)
        v.co *= 1.0 + 0.30 * n + 0.08 * n2
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(MAT["rock"])
    for p in mesh.polygons:
        p.use_smooth = True
    return mesh


ROCK_MESHES = None


def place_rock(name, px, py, z, size, squash=0.75):
    global ROCK_MESHES
    if ROCK_MESHES is None:
        ROCK_MESHES = [make_rock_mesh("rockmesh%d" % i, i) for i in range(5)]
    ob = bpy.data.objects.new(name, random.choice(ROCK_MESHES))
    bpy.context.collection.objects.link(ob)
    ob.location = (px, -py, z)
    ob.rotation_euler = (random.random() * 0.3, random.random() * 0.3, random.random() * 6.283)
    ob.scale = (size * (0.85 + random.random() * 0.4), size * (0.85 + random.random() * 0.4), size * squash)
    return ob


def circle_pts(cx, cy, r, n=24):
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n))
            for i in range(n)]


def wedge_we(name, x0, x1, y0s, y1s, z_base, z_high, mat, high="w"):
    """Triangular prism: flat z_base, rising to z_high at one x edge, spanning y."""
    ya, yb = -y1s, -y0s
    hx = x0 if high == "w" else x1
    lx = x1 if high == "w" else x0
    bm = bmesh.new()
    co = [(hx, ya, z_base), (lx, ya, z_base), (hx, ya, z_high),
          (hx, yb, z_base), (lx, yb, z_base), (hx, yb, z_high)]
    vs = [bm.verts.new(cc) for cc in co]
    bm.faces.new([vs[0], vs[1], vs[2]])
    bm.faces.new([vs[5], vs[4], vs[3]])
    bm.faces.new([vs[0], vs[3], vs[4], vs[1]])
    bm.faces.new([vs[1], vs[4], vs[5], vs[2]])
    bm.faces.new([vs[2], vs[5], vs[3], vs[0]])
    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return link_obj(name, mesh, mat)


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
            "sauna", "saunaShelter", "pergola", "raisedBed1", "raisedBed2", "raisedBed3", "raisedBed4"]:
    for prt in els[eid]["parts"]:
        if prt["kind"] == "rect":
            m = 0.15
            EXCL_RECTS.append((prt["x"] - m, prt["y"] - m, prt["x"] + prt["w"] + m, prt["y"] + prt["d"] + m))
for bx0, bx1, by0, by1 in DRIP_BANDS:
    EXCL_RECTS.append((bx0 - 0.1, by0 - 0.1, bx1 + 0.1, by1 + 0.1))
EXCL_POLYS = [hpoly, dpoly]
_fire = next(p for p in els["firePit"]["parts"] if p["kind"] == "circle")
EXCL_ELLIPSES = [(POND[0], POND[1], POND[2] + 0.35, POND[3] + 0.3), (5.0, 2.5, 1.15, 1.15),
                 (_fire["cx"], _fire["cy"], 1.25, 1.25)]
STEP_STONES = [p for p in els["steppingPaths"]["parts"]
               if p["kind"] == "circle"] if "steppingPaths" in els else []
for _s in STEP_STONES:
    EXCL_ELLIPSES.append((_s["cx"], _s["cy"], 0.35, 0.35))


def _seg_d2(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
    dx, dy = px - ax - vx * t, py - ay - vy * t
    return dx * dx + dy * dy


DRIVE_SEGS = [(dpoly[i][0], dpoly[i][1], dpoly[(i + 1) % len(dpoly)][0], dpoly[(i + 1) % len(dpoly)][1])
              for i in range(len(dpoly))]


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


# ---------------- planting zones (meta.plant) ----------------
def rect_fn(r):
    x0, y0, x1, y1 = r["x"], r["y"], r["x"] + r["w"], r["y"] + r["d"]
    return (lambda x, y: x0 <= x <= x1 and y0 <= y <= y1), (x0, y0, x1, y1)


def poly_fn(pts):
    xs = [q[0] for q in pts]
    ys = [q[1] for q in pts]
    return (lambda x, y: point_in_poly(x, y, pts)), (min(xs), min(ys), max(xs), max(ys))


def ellipse_ring_fn(outer, inner):
    ocx, ocy, orx, ory = outer
    icx, icy, irx, iry = inner

    def fn(x, y):
        if ((x - ocx) / orx) ** 2 + ((y - ocy) / ory) ** 2 > 1.0:
            return False
        return ((x - icx) / irx) ** 2 + ((y - icy) / iry) ** 2 >= 1.0

    return fn, (ocx - orx, ocy - ory, ocx + orx, ocy + ory)


def clip_to_plot(fn):
    return lambda x, y: fn(x, y) and point_in_poly(x, y, plot)


PLANT_ZONES = [e for e in GARDEN["elements"] if e.get("meta", {}).get("plant")]
pond_el = next(x for x in els["pond"]["parts"] if x["kind"] == "ellipse")
ZONE_SHAPES = []  # (zone id, plant, fn, bbox)
for zone in PLANT_ZONES:
    if zone["id"] == "atriumPots":
        continue  # planters on the deck, no ground scatter
    for prt in zone["parts"]:
        if prt["kind"] == "rect":
            fn, bbox = rect_fn(prt)
        elif prt["kind"] == "polygon":
            fn, bbox = poly_fn(prt["points"])
        elif prt["kind"] == "ellipse":
            fn, bbox = ellipse_ring_fn((prt["cx"], prt["cy"], prt["rx"], prt["ry"]),
                                       (pond_el["cx"], pond_el["cy"], pond_el["rx"] + 0.3, pond_el["ry"] + 0.3))
        else:
            continue
        ZONE_SHAPES.append((zone["id"], zone["meta"]["plant"], clip_to_plot(fn), bbox))
BED_SHAPES = [(f, b) for _, p, f, b in ZONE_SHAPES if p != "meadow"]
MEADOW_SHAPES = [(f, b) for _, p, f, b in ZONE_SHAPES if p == "meadow"]


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
    for ax, ay, bx, by in DRIVE_SEGS:  # crisp pavement edge: no blades overhanging
        if _seg_d2(x, y, ax, ay, bx, by) < 0.0144:
            return 0.0
    for fn, _ in BED_SHAPES:
        if fn(x, y):
            return 0.0
    for fn, _ in MEADOW_SHAPES:
        if fn(x, y):
            return 1.8
    return 1.0


def grass_scale(x, y):
    for fn, _ in MEADOW_SHAPES:
        if fn(x, y):
            return 1.55
    return 1.0


# ---------------- terrain ----------------
GRASS_DENSITY = 340.0  # blades per m^2

terrain_ob = None


def build_terrain():
    global terrain_ob
    bm = bmesh.new()
    vs = [bm.verts.new((p[0], -p[1], 0.0)) for p in plot]
    bm.faces.new(vs)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    for _ in range(8):
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
    attr_s = mesh.attributes.new("grass_s", "FLOAT", "POINT")
    attr_s.data.foreach_set("value", [grass_scale(v.co.x, -v.co.y) for v in mesh.vertices])
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
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=220, y_subdivisions=220, size=180, location=(22, -17, 0))
    ob = bpy.context.active_object
    ob.name = "surround"
    for v in ob.data.vertices:
        wx = v.co.x + 22.0
        wy = v.co.y - 17.0
        v.co.z = terrain_z(wx, -wy) - 0.10
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
    sattr = ng.nodes.new("GeometryNodeInputNamedAttribute")
    sattr.data_type = "FLOAT"
    sattr.inputs["Name"].default_value = "grass_s"
    smul = ng.nodes.new("ShaderNodeMath")
    smul.operation = "MULTIPLY"
    inst = ng.nodes.new("GeometryNodeInstanceOnPoints")
    join = ng.nodes.new("GeometryNodeJoinGeometry")
    lk = ng.links.new
    lk(attr.outputs["Attribute"], mul.inputs[0])
    lk(n_in.outputs["Geometry"], dist.inputs["Mesh"])
    lk(mul.outputs["Value"], dist.inputs["Density"])
    lk(dist.outputs["Points"], inst.inputs["Points"])
    lk(oinfo.outputs["Geometry"], inst.inputs["Instance"])
    lk(rot_out, inst.inputs["Rotation"])
    lk(scl_out, smul.inputs[0])
    lk(sattr.outputs["Attribute"], smul.inputs[1])
    lk(smul.outputs["Value"], inst.inputs["Scale"])
    lk(n_in.outputs["Geometry"], join.inputs[0])
    lk(inst.outputs["Instances"], join.inputs[0])
    lk(join.outputs["Geometry"], n_out.inputs["Geometry"])
    mod = terrain_ob.modifiers.new("grass", "NODES")
    mod.node_group = ng


build_grass(build_blade())

# ---------------- house ----------------
bb = house["meta"]["bbox"]
ft = ground_h((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2)  # floor level
DECK_TOP = ft + 0.05
h_base = min(ground_h(x, y) for x, y in hpoly) - 0.2
GEN_WALL_H = 3.07  # general wall top / west lean-to eave (DPS řez A) — west rooms sit lower
KNEE = 0.28        # gable pozednice knee above the general walls → ridge +7.15
ROOF_RISE = 3.8    # half the 7.6 m gable span → 45° main pitch (DPS)
WALL_TOP = ft + GEN_WALL_H  # general wall top / west lean-to eave
SPRING = WALL_TOP + KNEE    # gable pozednice spring (ridge base)
HA = house["meta"]["atrium"]  # [x0, z0, x1, z1] open courtyard — no roof over the west part
extrude_poly("house_walls", hpoly, h_base, WALL_TOP, MAT["walls"])

GABLE = (13.68, 21.28)  # 45° main gable x-range; a 5° lean-to sits west of it
ridge_x = (GABLE[0] + GABLE[1]) / 2.0
OV = 0.45  # eave overhang on the E/W long sides; rakes flush with the N/S gable walls
G_SLOPE = ROOF_RISE / ((GABLE[1] - GABLE[0]) / 2.0)  # 3.8/3.8 = 1 → 45°
EAVE_Z = SPRING - OV * G_SLOPE
RIDGE_Z = SPRING + ROOF_RISE
sloped_slab("house_roof_w", GABLE[0] - OV, ridge_x + 0.01, EAVE_Z, RIDGE_Z, bb[1], bb[3], 0.12, MAT["roof"])
sloped_slab("house_roof_e", ridge_x - 0.01, GABLE[1] + OV, RIDGE_Z, EAVE_Z, bb[1], bb[3], 0.12, MAT["roof"])
roof_seams("houseW", GABLE[0] - OV, EAVE_Z + 0.12, ridge_x, RIDGE_Z + 0.12, bb[1], bb[3], MAT["roof"])
roof_seams("houseE", GABLE[1] + OV, EAVE_Z + 0.12, ridge_x, RIDGE_Z + 0.12, bb[1], bb[3], MAT["roof"])
print("HOUSE HEIGHTS: ft=%.3f wall_top=%.3f ridge=%.3f  (ridge-ft=%.2f, ridge-floor=%.2f)"
      % (ft, WALL_TOP, RIDGE_Z, RIDGE_Z - ft, RIDGE_Z - DECK_TOP))


def stit_tri(name, y0s, y1s):
    """Gable-end (štít) triangle at the 45° pitch, GABLE span only — greige
    render (HN3E) matching the facade, per the DPS elevations."""
    bm = bmesh.new()
    pts = [(GABLE[0], SPRING), (GABLE[1], SPRING), (ridge_x, RIDGE_Z)]
    va = [bm.verts.new((x, -y0s, z)) for x, z in pts]
    vb = [bm.verts.new((x, -y1s, z)) for x, z in pts]
    bm.faces.new(va)
    bm.faces.new(list(reversed(vb)))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new([va[i], va[j], vb[j], vb[i]])
    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return link_obj(name, mesh, MAT["walls"])


stit_tri("stit_n", bb[1], bb[1] + 0.12)
stit_tri("stit_s", bb[3] - 0.12, bb[3])

# west office lean-to (5°, rise = KNEE): SPLIT into two shed pieces around the OPEN
# atrium — the courtyard strip (z 15.93–19.18) has no roof over the west part
for wi, (wz0, wz1) in enumerate([(bb[1], HA[1]), (HA[3], bb[3])]):
    sloped_slab("wingW%d" % wi, bb[0] - OV, GABLE[0], WALL_TOP, SPRING, wz0, wz1, 0.12, MAT["roof"])
    roof_seams("wingW%d" % wi, bb[0] - OV, WALL_TOP + 0.12, GABLE[0], SPRING + 0.12, wz0, wz1, MAT["roof"])
# knee strips (greige) closing the 0.28 gap between the general wall top and the gable
# spring on the E gable wall + N/S gable ends; the west edge is closed by the lean-to
box_p("knee_e", GABLE[1] - 0.05, bb[1], GABLE[1] + 0.05, bb[3], WALL_TOP, SPRING, MAT["walls"])
box_p("knee_n", GABLE[0], bb[1] - 0.05, GABLE[1], bb[1] + 0.05, WALL_TOP, SPRING, MAT["walls"])
box_p("knee_s", GABLE[0], bb[3] - 0.05, GABLE[1], bb[3] + 0.05, WALL_TOP, SPRING, MAT["walls"])
# lean-to shed-end triangles (greige) at the four z-edges incl. the open-atrium sides
for z_end in [bb[1], HA[1], HA[3], bb[3]]:
    vtri_xz("wing_end%d" % int(z_end * 100),
            [(bb[0], WALL_TOP), (GABLE[0], WALL_TOP), (GABLE[0], SPRING)], z_end, MAT["walls"])
# drip strips: light gravel bands in the dug terrain along the facade
MAT["gravel_light"] = mat_pbr("gravel_light", "gravel_floor_02", scale=1.0,
                              tint=hexc("#cfcbc3"), tint_fac=0.45, tint_mode="MIX")
for di, (bx0, bx1, by0, by1) in enumerate(DRIP_BANDS):
    draped_poly("drip%d" % di, [(bx0, by0), (bx1, by0), (bx1, by1), (bx0, by1)], 0.03,
                MAT["gravel_light"], subdiv=3)
# marmolit sokl band: level top above floor, bottom under the gravel grade
MAT["sokl"] = mat_pbr("sokl", "plastered_wall_02", scale=2.0,
                      tint=hexc("#453f38"), tint_fac=0.85, tint_mode="MIX")  # marmolit MAR2 M092, dark
SOKL_TOP = ft + 0.25
for run_a0, run_a1, run_c, run_axis, run_dir in [
    (10.48, 21.28, 7.18, "x", -1), (10.48, 21.28, 26.43, "x", 1), (7.18, 11.58, 21.28, "y", 1),
]:
    n_seg = int(math.ceil(run_a1 - run_a0))
    for si in range(n_seg):
        mid = run_a0 + (run_a1 - run_a0) * (si + 0.5) / n_seg
        seg0 = run_a0 + (run_a1 - run_a0) * si / n_seg
        seg1 = run_a0 + (run_a1 - run_a0) * (si + 1) / n_seg
        px, py = (mid, run_c + run_dir * 0.25) if run_axis == "x" else (run_c + run_dir * 0.25, mid)
        z_lo = ground_h(px, py) - 0.15
        if run_axis == "x":
            box_p("sokl_x%d_%d" % (int(run_c), si), seg0, run_c + min(0, run_dir * 0.05), seg1,
                  run_c + max(0, run_dir * 0.05), z_lo, SOKL_TOP, MAT["sokl"])
        else:
            box_p("sokl_y%d_%d" % (int(run_c), si), run_c + min(0, run_dir * 0.05), seg0,
                  run_c + max(0, run_dir * 0.05), seg1, z_lo, SOKL_TOP, MAT["sokl"])

box_p("chimney", ridge_x - 0.3, 21.7, ridge_x + 0.3, 22.3, ft + 3.5, RIDGE_Z + 0.6, MAT["garage_walls"])

# velux roof windows over the attic + stit window in the north gable
MAT["roof_glass"] = mat_simple("roof_glass", hexc("#2a3540"), rough=0.15, metal=0.6)


def velux(side, y_plan, w_across):
    x_e = GABLE[1] + OV if side == "e" else GABLE[0] - OV
    ang = math.atan2(RIDGE_Z - EAVE_Z, ridge_x - x_e)
    t = 0.45
    px = ridge_x + t * (x_e - ridge_x)
    pz = RIDGE_Z + 0.12 - t * (RIDGE_Z - EAVE_Z) + 0.07
    for nm, ln, wd, th, mm in [("f", 1.52, w_across + 0.12, 0.10, MAT["frame"]),
                               ("g", 1.40, w_across, 0.13, MAT["roof_glass"])]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(px, -y_plan, pz))
        ob = bpy.context.active_object
        ob.name = "velux_%s%d_%s" % (side, int(y_plan * 10), nm)
        ob.scale = (ln, wd, th)
        ob.rotation_euler = (0.0, -ang, 0.0)
        ob.data.materials.append(mm)


velux("e", 24.76, 0.78)  # attic room, southern
velux("e", 20.78, 0.78)  # above the stairs
velux("w", 20.78, 0.78)  # west slope, same distance from the S wall

box_p("stit_win_f", ridge_x - 0.435, bb[1] - 0.065, ridge_x + 0.435, bb[1] + 0.025,
      WALL_TOP + 0.44, WALL_TOP + 1.56, MAT["frame"])
box_p("stit_win_g", ridge_x - 0.375, bb[1] - 0.075, ridge_x + 0.375, bb[1] - 0.025,
      WALL_TOP + 0.5, WALL_TOP + 1.5, MAT["roof_glass"])


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
    layer(name + "_fL", 0.02, 0.11, a0, a0 + fw, z0, z1, MAT["frame"])
    layer(name + "_fR", 0.02, 0.11, a1 - fw, a1, z0, z1, MAT["frame"])
    layer(name + "_fB", 0.02, 0.11, a0, a1, z0, z0 + fw, MAT["frame"])
    layer(name + "_fT", 0.02, 0.11, a0, a1, z1 - fw, z1, MAT["frame"])


window("w_kitchen", "x", 20.58, +1, 12.9, 2.3, 0.9, 1.35)
window("w_portal", "x", 20.58, +1, 16.78, 5.16, 0.05, 2.27)
window("w_bedroom", "x", 21.28, +1, 9.5, 2.0, 0.8, 1.75)
window("w_north", "y", 7.18, -1, 15.88, 0.9, 0.3, 2.27)
window("w_west1", "x", 10.48, -1, 10.5, 1.6, 0.05, 2.27)   # offices, floor-level (0 step)
window("w_west2", "x", 10.48, -1, 13.5, 1.6, 0.05, 2.27)
window("w_west3", "x", 10.48, -1, 22.0, 1.25, 0.05, 2.27)  # guest + bathroom, floor-level
window("w_west4", "x", 10.48, -1, 24.5, 1.25, 0.05, 2.27)
window("w_livingportal", "x", 14.78, -1, 17.55, 2.5, 0.05, 2.27)  # onto the atrium, floor-level (0 step)
window("w_south1", "y", 26.43, +1, 16.05, 0.9, 0.9, 1.25)
window("w_south2", "y", 26.43, +1, 19.3, 0.9, 0.9, 1.25)
window("w_door", "x", 21.28, +1, 23.31, 1.42, 0.0, 2.15, door=True)
# HS2 east portal split: central vertical mullion + a handle on the north half
box_p("hs_mull", 20.58, 16.72, 20.69, 16.84, ft + 0.05, ft + 0.05 + 2.27, MAT["frame"])
box_p("hs_handle", 20.66, 16.38, 20.70, 16.42, ft + 0.89, ft + 1.21, MAT["frame"])

# ---------------- garage (pult roof, floor -0.5 vs house) + door + cars ----------------
g = first_rect(els["garage"])
gx0, gy0, gx1, gy1 = g["x"], g["y"], g["x"] + g["w"], g["y"] + g["d"]
GF = ft - 0.5  # garage floor abs
g_wall_top = GF + 2.3  # low east eave
g_roof_high = g_wall_top + 1.2  # high west edge at the carport junction
g_min = min(ground_h(x, y) for x, y in [(gx0, gy0), (gx1, gy0), (gx0, gy1), (gx1, gy1)])
rect_box("garage", g, g_min - 0.25, g_wall_top, MAT["garage_walls"])
wedge_we("garage_fill", gx0, gx1, gy0, gy1, g_wall_top, g_roof_high, MAT["garage_walls"])
g_pitch = 1.2 / g["w"]
sloped_slab("garage_roof", gx0 - 0.3, gx1 + 0.3, g_roof_high + 0.3 * g_pitch,
            g_wall_top - 0.3 * g_pitch, gy0, gy1, 0.12, MAT["roof"])
roof_seams("gar", gx1 + 0.3, g_wall_top - 0.3 * g_pitch + 0.12,
           gx0 - 0.3, g_roof_high + 0.3 * g_pitch + 0.12, gy0, gy1, MAT["roof"])

gd_y = gy1  # south wall
door_r = next(p for p in els["garage"]["parts"] if p["kind"] == "rect" and p["d"] < 1.0)
dx0, dx1 = door_r["x"], door_r["x"] + door_r["w"]
box_p("garage_door", dx0, gd_y + 0.01, dx1, gd_y + 0.06, GF, GF + 2.05, MAT["door_metal"])
for k in range(4):
    zz = GF + 0.41 * (k + 1)
    box_p("garage_groove%d" % k, dx0 + 0.05, gd_y + 0.02, dx1 - 0.05, gd_y + 0.09, zz - 0.02, zz + 0.02, MAT["groove"])


def car(name, cx, cy, paint, along="y", z=None, cabin_bias=1):
    if z is None:
        z = ground_h(cx, cy)
    L, W = 2.0, 0.86  # half length / half width
    if along == "y":
        box_p(name + "_body", cx - W, cy - L, cx + W, cy + L, z + 0.32, z + 0.92, paint)
        box_p(name + "_cabin", cx - W + 0.1, cy - 1.0 + 0.1 * cabin_bias, cx + W - 0.1,
              cy + 1.0 + 0.1 * cabin_bias, z + 0.92, z + 1.42, MAT["cabin"])
        wheels = [(cx - W, cy - 1.25), (cx + W, cy - 1.25), (cx - W, cy + 1.25), (cx + W, cy + 1.25)]
        rot = (0, math.pi / 2, 0)
    else:
        box_p(name + "_body", cx - L, cy - W, cx + L, cy + W, z + 0.32, z + 0.92, paint)
        box_p(name + "_cabin", cx - 0.9, cy - W + 0.1, cx + 1.1, cy + W - 0.1, z + 0.92, z + 1.42, MAT["cabin"])
        wheels = [(cx - 1.25, cy - W), (cx - 1.25, cy + W), (cx + 1.25, cy - W), (cx + 1.25, cy + W)]
        rot = (math.pi / 2, 0, 0)
    for i, (wx, wy) in enumerate(wheels):
        add_cyl(name + "_wheel%d" % i, wx, wy, z + 0.33, 0.33, 0.2, MAT["tire"], verts=16, rot=rot)


car("car1", 29.0, 22.0, MAT["car_blue"], along="y", z=GF)
car("car2", 32.5, 22.0, MAT["car_red"], along="y", z=GF)
# parked parallel to the garage east wall on the long pad, facing south to the driveway
car("car3", 36.4, 22.9, MAT["car_grey"], along="y",
    z=ground_h(36.41, 22.925) + 0.05, cabin_bias=-1)

# garage west personnel door 900x2150, dark, base at garage floor
box_p("garage_pdoor", gx0 - 0.05, 20.2, gx0 + 0.01, 21.1, GF, GF + 2.15, MAT["door_metal"])


# ---------------- facade climbers ----------------
def climbers(prefix, axis, wall, out_sign, a0, a1, z_base, height):
    """Thin stems + flattened foliage clusters hugging a wall plane."""
    n = max(3, int((a1 - a0) / 0.9))
    for i in range(n):
        ac = a0 + (i + 0.5) * (a1 - a0) / n + random.uniform(-0.1, 0.1)
        h = height * (0.75 + random.random() * 0.35)
        off = wall + out_sign * 0.06
        if axis == "x":
            sx, sy = off, ac
        else:
            sx, sy = ac, off
        add_cyl("%s_stem%d" % (prefix, i), sx, sy, z_base + h / 2, 0.015, h, MAT["trunk"], verts=6)
        mat = random.choice(CANOPY)
        for k in range(3 + int(random.random() * 3)):
            zz = z_base + h * (0.25 + 0.75 * random.random())
            aa = ac + random.uniform(-0.35, 0.35)
            rr = 0.22 + random.random() * 0.16
            off2 = wall + out_sign * (0.10 + random.random() * 0.06)
            if axis == "x":
                px_, py_ = off2, aa
                sc = (0.35, 1.0, 0.9)
            else:
                px_, py_ = aa, off2
                sc = (1.0, 0.35, 0.9)
            add_sphere("%s_f%d_%d" % (prefix, i, k), px_, py_, zz, rr, mat, scale=sc, subdiv=1)


if "facadeClimbers" in els:
    climbers("climb_gar", "x", gx1, +1, 19.7, 26.2, ground_h(gx1 + 0.3, 22.9), 2.8)
    climbers("climb_atrN", "y", 15.93, +1, 10.8, 14.6, DECK_TOP, 2.4)
    climbers("climb_atrS", "y", 19.18, -1, 10.8, 14.6, DECK_TOP, 2.4)

# ---------------- carport (thin plate falling west from the garage junction) ----------------
c = first_rect(els["carport"])
cp_east = g_roof_high  # at garage junction x=27.63
cp_west = g_wall_top + 0.5  # clears the entrance door top


def cp_z(px):
    return cp_west + (px - c["x"]) * (cp_east - cp_west) / c["w"]


for i, (px, py) in enumerate([(c["x"] + 0.3, c["y"] + 0.3), (c["x"] + c["w"] - 0.3, c["y"] + 0.3),
                              (c["x"] + 0.3, c["y"] + c["d"] - 0.3),
                              (c["x"] + c["w"] - 0.3, c["y"] + c["d"] - 0.3)]):
    post("carport_post%d" % i, px, py, ground_h(px, py) - 0.2, cp_z(px) - 0.02, MAT["wood"], half=0.07)
sloped_slab("carport_roof", c["x"], c["x"] + c["w"], cp_west, cp_east,
            c["y"], c["y"] + c["d"], 0.08, MAT["roof"])
roof_seams("cp", c["x"], cp_west + 0.08, c["x"] + c["w"], cp_east + 0.08,
           c["y"], c["y"] + c["d"], MAT["roof"])

# ---------------- terraces (level decks at house floor plane), path ----------------
def level_deck(name, r, post_edge):
    """Level deck slab with support posts to terrain on the downhill edge."""
    rect_box(name, r, DECK_TOP - 0.08, DECK_TOP, MAT["deck"])
    px = r["x"] + 0.15 if post_edge == "w" else r["x"] + r["w"] - 0.15
    for k, py in enumerate([r["y"] + 0.2, r["y"] + r["d"] / 2, r["y"] + r["d"] - 0.2]):
        pz = ground_h(px, py)
        if DECK_TOP - 0.08 - pz < 0.05:
            continue
        post("%s_post%d" % (name, k), px, py, pz - 0.1, DECK_TOP - 0.08, MAT["wood"], half=0.06)


for i, prt in enumerate(x for x in els["westTerrace"]["parts"] if x["kind"] == "rect"):
    level_deck("westTerrace_%d" % i, prt, "w")
for i, prt in enumerate(x for x in els["eastTerrace"]["parts"] if x["kind"] == "rect"):
    level_deck("eastTerrace_%d" % i, prt, "e")

# east-terrace dining: table + 4 chairs, seats facing the table (backrests outside)
et_tx, et_tz = 21.8, 16.0
box_p("et_table", et_tx - 0.8, et_tz - 0.45, et_tx + 0.8, et_tz + 0.45,
      DECK_TOP + 0.72, DECK_TOP + 0.78, MAT["wood"])
for li, (ldx, ldz) in enumerate([(-0.7, -0.4), (0.7, -0.4), (-0.7, 0.4), (0.7, 0.4)]):
    post("et_tableleg%d" % li, et_tx + ldx, et_tz + ldz, DECK_TOP, DECK_TOP + 0.75, MAT["frame"], half=0.03)
for ci, (cdx, cdz) in enumerate([(-0.6, -0.9), (0.6, -0.9), (-0.6, 0.9), (0.6, 0.9)]):
    sx0, sz0 = et_tx + cdx, et_tz + cdz
    box_p("et_seat%d" % ci, sx0 - 0.2, sz0 - 0.2, sx0 + 0.2, sz0 + 0.2,
          DECK_TOP + 0.42, DECK_TOP + 0.47, MAT["wood"])
    for oi, (ox, oz) in enumerate([(-0.16, -0.16), (0.16, -0.16), (-0.16, 0.16), (0.16, 0.16)]):
        post("et_chairleg%d_%d" % (ci, oi), sx0 + ox, sz0 + oz, DECK_TOP, DECK_TOP + 0.425, MAT["trunk"], half=0.02)
    back_z = sz0 + (0.2 if cdz > 0 else -0.2)  # backrest on the outside -> chair faces the table
    box_p("et_back%d" % ci, sx0 - 0.2, back_z - 0.025, sx0 + 0.2, back_z + 0.025,
          DECK_TOP + 0.45, DECK_TOP + 0.95, MAT["wood"])
for i, prt in enumerate(x for x in els["saunaPath"]["parts"] if x["kind"] == "rect"):
    px, py = rect_center(prt)
    z = ground_h(px, py)
    rect_box("saunaPath_%d" % i, prt, z - 0.05, z + 0.1, MAT["path"])

# driveway + carport + parking bay: one continuous DITON large-format paver surface
draped_poly("driveway", dpoly, 0.04, MAT["pavers"], subdiv=6)

# stepping-stone paths: flat stone discs draped on the terrain
MAT["step_stone"] = mat_concrete("step_stone", hexc("#9a958c"), hexc("#7f7a72"),
                                 rough_lo=0.7, rough_hi=0.95)
for si, sp in enumerate(STEP_STONES):
    scx, scy = sp["cx"], sp["cy"]
    e2 = 0.3
    ddx = (terrain_z(scx + e2, scy) - terrain_z(scx - e2, scy)) / (2 * e2)
    ddy = (terrain_z(scx, scy + e2) - terrain_z(scx, scy - e2)) / (2 * e2)
    nrm = Vector((-ddx, ddy, 1.0)).normalized()
    q = nrm.to_track_quat("Z", "Y") @ Quaternion((0.0, 0.0, 1.0), random.random() * 6.283)
    add_cyl("step%d" % si, scx, scy, terrain_z(scx, scy) + 0.012,
            sp["r"] * (0.92 + random.random() * 0.2), 0.05, MAT["step_stone"],
            sx=0.9 + random.random() * 0.2, sy=0.9 + random.random() * 0.2,
            verts=18, rot=q.to_euler())
# no separate parking pad — the driveway polygon already covers the parking bay

# ---------------- pond ----------------
pe = next(x for x in els["pond"]["parts"] if x["kind"] == "ellipse")
add_cyl("pond_water", pe["cx"], pe["cy"], POND_WATER_Z - 0.02, 1.0, 0.04, MAT["water"],
        sx=pe["rx"] * 0.82, sy=pe["ry"] * 0.82, verts=48)
for i in range(19):  # flattened rock chunks around the waterline lip
    a = i * 2 * math.pi / 19.0 + random.uniform(-0.08, 0.08)
    px = pe["cx"] + pe["rx"] * 0.80 * math.cos(a)
    py = pe["cy"] + pe["ry"] * 0.80 * math.sin(a)
    place_rock("pond_lip%d" % i, px, py, max(POND_WATER_Z + 0.03, terrain_z(px, py) - 0.02),
               0.12 + random.random() * 0.08, squash=0.5)
for i in range(26):  # outer scatter on the bank crest
    a = i * 2 * math.pi / 26.0 + random.uniform(-0.06, 0.06)
    px = pe["cx"] + pe["rx"] * 1.04 * math.cos(a)
    py = pe["cy"] + pe["ry"] * 1.04 * math.sin(a)
    place_rock("pond_stone%d" % i, px, py, max(ground_h(px, py) - 0.04, POND_WATER_Z + 0.02),
               0.13 + random.random() * 0.09)

# ---------------- fire pit + stones + benches ----------------
fc = next(x for x in els["firePit"]["parts"] if x["kind"] == "circle")
fz = ground_h(fc["cx"], fc["cy"])
draped_poly("firepit_apron", circle_pts(fc["cx"], fc["cy"], 1.1, 24), 0.035, MAT["gravel"], subdiv=3)
draped_poly("firepit_ash", circle_pts(fc["cx"], fc["cy"], 0.44, 16), 0.065, MAT["ash"], subdiv=2)
for i in range(12):
    a = i * math.pi / 6.0 + random.uniform(-0.12, 0.12)
    sx = fc["cx"] + 0.64 * math.cos(a)
    sy = fc["cy"] + 0.64 * math.sin(a)
    place_rock("firepit_stone%d" % i, sx, sy, terrain_z(sx, sy) + 0.06,
               0.15 + random.random() * 0.07, squash=0.8)
for i, ang in enumerate((25, 100, 175, 255)):
    ar = math.radians(ang)
    ux, uy = math.cos(ar), math.sin(ar)
    add_cyl("firepit_log%d" % i, fc["cx"] - 0.13 * ux, fc["cy"] - 0.13 * uy, fz + 0.17,
            0.05, 0.72, MAT["char"], verts=10, rot=(0, math.radians(63), -ar))
add_sphere("firepit_ember", fc["cx"], fc["cy"], fz + 0.10, 0.17, MAT["fire"],
           scale=(1.0, 1.0, 0.4), subdiv=1)
FLAME_OBJS = []
for i, (fr, fh, ox, oy) in enumerate([(0.13, 0.42, 0.0, 0.0), (0.09, 0.28, 0.09, -0.06)]):
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=fr, radius2=0.0, depth=fh,
                                    location=(fc["cx"] + ox, -fc["cy"] + oy, fz + 0.24 + fh / 2))
    fob = bpy.context.active_object
    fob.name = "firepit_flame%d" % i
    fob.rotation_euler = (random.uniform(-0.08, 0.08), random.uniform(-0.08, 0.08), 0)
    fob.data.materials.append(MAT["flame"])
    for p in fob.data.polygons:
        p.use_smooth = True
    FLAME_OBJS.append(fob)
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
# paved tile floor + dining table for 8-10 under the pergola
pg_rects = [p for p in els["pergola"]["parts"] if p["kind"] == "rect"]
floor_r = next((p for p in pg_rects if p.get("fill") == "#d8d2c8"), None)
table_r = next((p for p in pg_rects if p.get("fill") == "#8a6a4a"), None)
if floor_r:
    MAT["tile"] = mat_concrete("tile", hexc("#d8d2c8"), hexc("#c6c0b4"), rough_lo=0.5, rough_hi=0.75)
    fx0, fy0 = floor_r["x"], floor_r["y"]
    fx1, fy1 = fx0 + floor_r["w"], fy0 + floor_r["d"]
    draped_poly("pergola_floor", [(fx0, fy0), (fx1, fy0), (fx1, fy1), (fx0, fy1)], 0.05,
                MAT["tile"], subdiv=3)
if table_r:
    tx0, ty0 = table_r["x"], table_r["y"]
    tx1, ty1 = tx0 + table_r["w"], ty0 + table_r["d"]
    ttz = ground_h((tx0 + tx1) / 2.0, (ty0 + ty1) / 2.0) + 0.05
    box_p("pergola_table_top", tx0, ty0, tx1, ty1, ttz + 0.72, ttz + 0.78, MAT["wood"])
    for li, (lx, ly) in enumerate([(tx0 + 0.18, ty0 + 0.18), (tx1 - 0.18, ty0 + 0.18),
                                   (tx0 + 0.18, ty1 - 0.18), (tx1 - 0.18, ty1 - 0.18)]):
        post("pergola_table_leg%d" % li, lx, ly, ttz, ttz + 0.72, MAT["wood"], half=0.045)
    for bi, (by0, by1) in enumerate([(ty0 - 0.55, ty0 - 0.2), (ty1 + 0.2, ty1 + 0.55)]):
        box_p("pergola_bench%d" % bi, tx0 + 0.1, by0, tx1 - 0.1, by1, ttz + 0.3, ttz + 0.45, MAT["wood"])

# ---------------- zasivarna: hidden bench in the shade bed (garage north) ----------------
if "zasivarna" in els:
    MAT["bench_blue"] = mat_simple("bench_blue", hexc("#3a6ab8"), rough=0.35, metal=0.6)
    MAT["bench_red"] = mat_simple("bench_red", hexc("#c0392b"), rough=0.35, metal=0.6)
    MAT["bench_leg"] = mat_simple("bench_leg", hexc("#1c1c1e"), rough=0.45, metal=0.7)
    zs_rects = [p for p in els["zasivarna"]["parts"] if p["kind"] == "rect"]
    zx0 = min(p["x"] for p in zs_rects)
    zx1 = max(p["x"] + p["w"] for p in zs_rects)
    zy0 = min(p["y"] for p in zs_rects)
    zy1 = max(p["y"] + p["d"] for p in zs_rects)
    bz = ground_h((zx0 + zx1) / 2.0, (zy0 + zy1) / 2.0)
    for ri, p in enumerate(zs_rects):
        mat_i = MAT["bench_blue"] if p["fill"] == "#3a6ab8" else MAT["bench_red"]
        for si in range(3):
            yy0 = p["y"] + 0.02 + si * (p["d"] - 0.04) / 3.0
            box_p("bench_slat%d_%d" % (ri, si), p["x"] + 0.02, yy0, p["x"] + p["w"] - 0.02,
                  yy0 + (p["d"] - 0.04) / 3.0 - 0.03, bz + 0.42, bz + 0.46, mat_i)
    # backrest on the south (garage) side, sitting faces north into the garden
    box_p("bench_back", zx0 + 0.02, zy1 - 0.06, zx1 - 0.02, zy1 - 0.01, bz + 0.46, bz + 0.88,
          MAT["bench_red"])
    for li, (lx, ly) in enumerate([(zx0 + 0.1, zy0 + 0.1), (zx1 - 0.1, zy0 + 0.1),
                                   (zx0 + 0.1, zy1 - 0.1), (zx1 - 0.1, zy1 - 0.1)]):
        post("bench_leg%d" % li, lx, ly, ground_h(lx, ly) - 0.05, bz + 0.42, MAT["bench_leg"], half=0.025)

# ---------------- raised beds ----------------
for eid in ["raisedBed1", "raisedBed2", "raisedBed3", "raisedBed4"]:
    r = first_rect(els[eid])
    bcx, bcy = rect_center(r)
    z = ground_h(bcx, bcy)
    rect_box(eid, r, z - 0.1, z + 0.6, MAT["wood"])


# ---------------- privacy screens (paravány): 2 m louvre panels blocking neighbour sightlines ----------------
MAT["screen_post"] = mat_simple("screen_post", hexc("#33343a"), rough=0.55, metal=0.5)
for e in GARDEN["elements"]:
    sm = (e.get("meta") or {}).get("screen")
    if not sm:
        continue
    r = first_rect(e)
    h = sm.get("h", 2.0)
    horiz = r["w"] >= r["d"]
    cx = r["x"] + r["w"] / 2.0
    cy = r["y"] + r["d"] / 2.0
    z0 = ground_h(cx, cy)
    ends = ([(r["x"] + 0.06, cy), (r["x"] + r["w"] - 0.06, cy)] if horiz
            else [(cx, r["y"] + 0.06), (cx, r["y"] + r["d"] - 0.06)])
    for i, (px, py) in enumerate(ends):
        post("%s_post%d" % (e["id"], i), px, py, ground_h(px, py) - 0.05, z0 + h + 0.08,
             MAT["screen_post"], half=0.05)
    for i in range(11):
        zz = z0 + 0.14 + i * (h - 0.24) / 10.0
        if horiz:
            box_p("%s_slat%d" % (e["id"], i), r["x"] + 0.06, cy - 0.015, r["x"] + r["w"] - 0.06, cy + 0.015,
                  zz - 0.05, zz + 0.05, MAT["wood"])
        else:
            box_p("%s_slat%d" % (e["id"], i), cx - 0.015, r["y"] + 0.06, cx + 0.015, r["y"] + r["d"] - 0.06,
                  zz - 0.05, zz + 0.05, MAT["wood"])


# ---------------- scanned plant library (Poly Haven, CC0) ----------------
def append_from(slug, names, res="2k"):
    path = os.path.join(ASSETS, "models", slug, slug + "_" + res + ".blend")
    out = []
    if not os.path.exists(path):
        print("MISSING ASSET", path)
        return out
    with bpy.data.libraries.load(path) as (src, dst):
        avail = set(src.objects)
        dst.objects = [n for n in names if n in avail]
    for ob in dst.objects:
        if ob is None:
            continue
        bpy.context.collection.objects.link(ob)
        ob.location = (0, 0, -70)
        ob.hide_render = True
        out.append(ob)
    return out


def append_ext(subpath, names):
    """Append named objects from a staged .blend that doesn't follow the slug_res.blend
    convention (client-supplied plant/tree assets). One libraries.load call so objects
    sharing materials/textures dedupe instead of importing N copies of the same 4K maps."""
    path = os.path.join(ASSETS, "models", subpath)
    out = []
    if not os.path.exists(path):
        print("MISSING ASSET", path)
        return out
    with bpy.data.libraries.load(path) as (src, dst):
        avail = set(src.objects)
        dst.objects = [n for n in names if n in avail]
    for ob in dst.objects:
        if ob is None:
            continue
        bpy.context.collection.objects.link(ob)
        ob.location = (0, 0, -70)
        ob.hide_render = True
        out.append(ob)
    return out


SHRUBS = (append_from("shrub_02", ["shrub_02_a_LOD1", "shrub_02_c_LOD1"]) +
          append_from("shrub_03", ["shrub_03_a_LOD0", "shrub_03_c_LOD0", "shrub_03_d_LOD0"]) +
          append_from("shrub_04", ["shrub_04_b_LOD1", "shrub_04_d_LOD1"]) +
          append_from("shrub_01", ["shrub_01_a_LOD1", "shrub_01_d_LOD1", "shrub_01_g_LOD1"], res="1k"))
GROUND_PLANTS = (append_from("shrub_sorrel_01", ["shrub_sorrel_01_a", "shrub_sorrel_01_c",
                                                 "shrub_sorrel_01_e", "shrub_sorrel_01_g"]) +
                 append_from("fern_02", ["fern_02_a", "fern_02_c"]))
FLOWER_OBJS = append_from("flower_empodium", ["flower_empodium_a_LOD1", "flower_empodium_c_LOD1",
                                              "flower_empodium_e_LOD1"])
GRASS_CLUMPS = append_from("grass_medium_01",
                           ["grass_medium_01_large_a_LOD1", "grass_medium_01_large_b_LOD1",
                            "grass_medium_01_mid_a_LOD1", "grass_medium_01_mid_b_LOD1",
                            "grass_medium_01_tall_a_LOD1", "grass_medium_01_small_a_LOD1"], res="1k")
# real-geometry perennial mix (ferns, sorrel, yellow flowers, ornamental grass tufts);
# grass weighted up so beds read as planted, not spotted. Replaces the old pastel blobs.
PERENNIAL_POOL = GROUND_PLANTS + FLOWER_OBJS + GRASS_CLUMPS + GRASS_CLUMPS
print("LIB shrubs %d ground %d flowers %d grass %d" %
      (len(SHRUBS), len(GROUND_PLANTS), len(FLOWER_OBJS), len(GRASS_CLUMPS)))

# photoscanned flowering accents (client-supplied CC-licensed assets, textures packed):
# ~1.8 m marguerite-daisy bushes in three colours, a ~1 m rose shrub, a firewood log pile.
DAISY_LIB = (append_ext("plants/daisy_white.blend", ["daisy_white"]) +
             append_ext("plants/daisy_pink.blend", ["daisy_pink"]) +
             append_ext("plants/daisy_red.blend", ["daisy_red"]))
ROSE_LIB = append_ext("plants/roses.blend", ["roses"])
LOG_LIB = append_ext("plants/wood_logs.blend", ["wooden logs"])
# stylized tomato in three growth stages for the raised-bed kitchen garden
TOMATO_LIB = append_ext("plants/tomato.blend",
                        ["SM_Tomato_Lv1", "SM_Tomato_Lv2", "SM_Tomato_Lv3"])
print("PLANT LIB daisies %d roses %d logs %d tomato %d" %
      (len(DAISY_LIB), len(ROSE_LIB), len(LOG_LIB), len(TOMATO_LIB)))


def place_asset(src, name, px, py, footprint=None, z=None):
    ob = src.copy()
    bpy.context.collection.objects.link(ob)
    ob.hide_render = False
    s = 1.0
    if footprint:
        d = max(src.dimensions.x, src.dimensions.y, 0.01)
        s = footprint / d
    sv = s * (0.85 + random.random() * 0.3)
    ob.scale = (sv, sv, sv)
    ob.rotation_euler = (0, 0, random.random() * 6.283)
    ob.location = (px, -py, (terrain_z(px, py) - 0.02) if z is None else z)
    ob.name = name
    return ob


# ---------------- trees ----------------
# Primary canopy is a real photoscanned Acer x freemanii (Freeman maple), client-supplied,
# in three ready-grown sizes (~6.8 / 9.8 / 10.2 m) sharing one alpha-cut leaf + bark material
# set. Poly Haven CC0 broadleaves (island_tree_01/03, tree_small_02 wild syringa) stay in as
# secondary silhouettes so the screen isn't a maple monoculture. Each maple / _LOD1 is a single
# realized mesh; copies share it, so a species costs one unique mesh however many trees use it.
# No conifers -- the client rejected needle trees.
TREE_LIB = {
    "island1": append_from("island_tree_01", ["island_tree_01_LOD1"], res="1k"),
    "island3": append_from("island_tree_03", ["island_tree_03_LOD1"], res="1k"),
    "broad": append_from("tree_small_02", ["tree_small_02_LOD1"], res="1k"),
}
_maples = append_ext("maple_freeman/maple_freeman.blend",
                     ["Acer_X_freemanii_Freeman_Maple_Sapindaceae_Tree",
                      "Acer_X_freemanii_Freeman_Maple_Sapindaceae_Tree03",
                      "Acer_X_freemanii_Freeman_Maple_Sapindaceae_Version3.2"])
_maples.sort(key=lambda o: o.dimensions.z)
for _sp, _ob in zip(("maple_s", "maple_m", "maple_l"), _maples):
    TREE_LIB[_sp] = [_ob]
# native crown height per species (from the realized mesh) so target heights in metres
# convert to a uniform scale regardless of how big each source model ships
TREE_NATIVE_H = {k: (max(min(o.dimensions.z for o in v), 0.5) if v else 4.0)
                 for k, v in TREE_LIB.items()}
print("TREE LIB " + " ".join("%s %d(%.1fm)" % (k, len(v), TREE_NATIVE_H[k])
                              for k, v in TREE_LIB.items()))


def place_tree(species, name, cx, cy, hmin, hmax, tilt=0.05):
    """Linked-duplicate a species template so instances share mesh data. Scale to a
    target crown height (hmin..hmax metres, normalised by the species' native height),
    Z-spin, and a slight tilt so the row does not read as clones."""
    tmpl = random.choice(TREE_LIB[species])
    ob = tmpl.copy()
    bpy.context.collection.objects.link(ob)
    ob.hide_render = False
    sc = (hmin + random.random() * (hmax - hmin)) / TREE_NATIVE_H[species]
    ob.scale = (sc * (0.93 + random.random() * 0.14),
                sc * (0.93 + random.random() * 0.14),
                sc * (0.96 + random.random() * 0.10))
    ob.rotation_euler = ((random.random() - 0.5) * tilt,
                         (random.random() - 0.5) * tilt,
                         random.random() * 6.283)
    ob.location = (cx, -cy, terrain_z(cx, cy) - 0.05)
    ob.name = name
    return ob


# perimeter screen (north + east edges): Freeman-maple-dominant mixed canopy at garden
# height, with island + wild-syringa broadleaves tucked between for silhouette variety.
# 13 mix entries = 13 perimeter positions, shuffled then dealt one per slot so species and
# height vary along the screen without visible clones.
PERIM_MIX = ([("maple_l", 9.5, 11.5)] * 3 +
             [("maple_m", 8.5, 10.5)] * 4 +
             [("maple_s", 6.5, 8.5)] * 2 +
             [("island1", 5.5, 8.0)] * 2 +
             [("broad", 5.0, 7.0)] * 2)
tree_i = 0
perim_seq = [(prt["cx"], prt["cy"]) for eid in ("northTrees", "eastTrees")
             for prt in els[eid]["parts"] if prt["kind"] == "circle"]
random.shuffle(PERIM_MIX)
for pi, (cx, cy) in enumerate(perim_seq):
    sp, hmin, hmax = PERIM_MIX[pi % len(PERIM_MIX)]
    place_tree(sp, "tree%d" % tree_i, cx, cy, hmin, hmax)
    tree_i += 1
# orchard: smaller crowns at fruit-tree scale (~3.5-6 m); a young maple plus the smaller
# broadleaves so the block reads as an orchard, not a second tall screen.
ORCHARD_MIX = [("maple_s", 4.6, 6.0), ("broad", 3.8, 5.2), ("island3", 3.2, 4.6)]
oi = 0
for prt in els["orchard"]["parts"]:
    if prt["kind"] == "circle":
        sp, hmin, hmax = ORCHARD_MIX[oi % len(ORCHARD_MIX)]
        place_tree(sp, "tree%d" % tree_i, prt["cx"], prt["cy"], hmin, hmax)
        tree_i += 1
        oi += 1
# specimen maple: one large Freeman maple standing alone in the east lawn room (east of the
# pond, clear of beds and the drive) as a focal shade tree read from the terrace + living views
if TREE_LIB.get("maple_l"):
    place_tree("maple_l", "specimen_maple", 35.0, 13.0, 12.0, 13.0, tilt=0.03)
    tree_i += 1
print("TREES placed:", tree_i)

# ---------------- perennial strip + bushes ----------------
peren_i = 0
while peren_i < 70:
    px = 5.0 + random.random() * 38.0
    if 3.5 <= px <= 10.5 or 25.28 <= px <= 32.28:
        continue
    py = 0.3 + random.random() * 2.6
    place_asset(random.choice(GROUND_PLANTS + SHRUBS[2:5]), "peren%d" % peren_i, px, py,
                footprint=0.4 + random.random() * 0.5)
    peren_i += 1

def make_bush(name, bx, by, s=1.0):
    place_asset(random.choice(SHRUBS), name, bx, by, footprint=(1.0 + random.random() * 0.4) * s)


# massed understory: a thick band inside the west + east fences, plus fillers around the
# open mid-garden lawn so the perimeter reads as a planted screen, not fence + grass
for i, (bx, by) in enumerate([(7, 11), (7, 14), (7, 18), (7, 22), (25.5, 12.5), (34.5, 12.5),
                              (25.5, 17.8), (34.5, 17.8), (4, 6), (11.5, 6),
                              (7, 9), (7, 12.5), (7, 16), (7, 20), (7, 24), (2.5, 20),
                              (2.5, 33), (6, 33), (25.5, 10.5), (25.5, 15), (34.5, 10.5),
                              (34.5, 15), (34.5, 20), (40, 9), (40, 13), (40, 17),
                              (40, 21), (40, 31), (40, 34)]):
    make_bush("bush%d" % i, bx, by, s=0.9 + random.random() * 0.5)


# ---------------- photoscanned flowering accents + firewood ----------------
def place_plant(lib, name, px, py, footprint, zoff=0.0):
    """Linked-duplicate a staged plant, scale to a footprint (m across), seat its base on
    the terrain via the local bounding box so nothing floats or sinks, random Z-spin."""
    if not lib:
        return
    ob = random.choice(lib).copy()
    bpy.context.collection.objects.link(ob)
    ob.hide_render = False
    d = max(ob.dimensions.x, ob.dimensions.y, 0.01)
    sv = footprint / d
    ob.scale = (sv, sv, sv)
    ob.rotation_euler = (0, 0, random.random() * 6.283)
    base = min(c[2] for c in ob.bound_box) * sv
    ob.location = (px, -py, terrain_z(px, py) - base + zoff)
    ob.name = name


# daisy bushes (white/pink/red) planted the Flera way: single-colour DRIFTS in the beds, a
# dedicated cutting bed beside the raised beds, and naturalised through the orchard meadow.
def place_daisy(ci, name, px, py, foot):
    ob = DAISY_LIB[ci % len(DAISY_LIB)].copy()
    bpy.context.collection.objects.link(ob)
    ob.hide_render = False
    s = foot / max(ob.dimensions.x, ob.dimensions.y, 0.01)
    ob.scale = (s, s, s)
    ob.rotation_euler = (0, 0, random.random() * 6.283)
    base = min(c[2] for c in ob.bound_box) * s
    ob.location = (px, -py, terrain_z(px, py) - base - 0.03)
    ob.name = name


di = 0
# (1) single-colour drifts (cx, cy, colour 0=white/1=pink/2=red, count) in the flower beds
for cx, cy, ci, cnt in [(25.7, 13.2, 0, 4), (25.9, 17.4, 1, 4),          # bedTerrace
                        (30.0, 8.6, 2, 4), (31.9, 9.9, 0, 3),            # prairieIsland
                        (24.4, 3.1, 1, 3), (30.9, 3.0, 2, 3), (33.4, 3.9, 0, 3),  # pergola
                        (39.4, 3.6, 1, 3),                               # rainGarden
                        (13.5, 6.4, 0, 3), (18.0, 6.4, 1, 3)]:           # northFoundation
    for k in range(cnt):
        place_daisy(ci, "daisy%d" % di, cx + (random.random() - 0.5) * 1.1,
                    cy + (random.random() - 0.5) * 0.9, 0.9 + random.random() * 0.4)
        di += 1
# (2) dedicated cutting bed east of the raised beds: a dense mixed block of daisies
for row in range(5):
    for col in range(4):
        place_daisy((row + col) % 3, "daisycut%d" % di,
                    5.2 + col * 0.62 + (random.random() - 0.5) * 0.18,
                    11.0 + row * 1.55 + (random.random() - 0.5) * 0.4, 0.75 + random.random() * 0.25)
        di += 1
# (3) naturalised drifts scattered through the orchard meadow (west)
for k in range(14):
    place_daisy(k % 3, "daisymeadow%d" % di, 0.8 + random.random() * 4.2,
                21.7 + random.random() * 9.6, 0.7 + random.random() * 0.35)
    di += 1
print("DAISIES placed:", di)

# rose shrubs along the pergola beds + the bed-terrace strip
ROSE_SPOTS = [(23.8, 2.2), (26.2, 4.6), (28.8, 2.0), (31.4, 4.8), (33.8, 2.6),
              (26.6, 12.2), (26.6, 15.0), (26.6, 18.2)]
for i, (px, py) in enumerate(ROSE_SPOTS):
    place_plant(ROSE_LIB, "rose%d" % i, px, py, 0.9 + random.random() * 0.4, zoff=-0.02)


# climbing roses trained up the pergola posts and spilling over the top slats: stacked rose
# clumps up each corner post (bulging inward toward the frame) form a rough vertical column,
# plus a run of clumps along the two long top beams so the roof reads as rose-covered.
def put_rose(name, px, py, z, smin, smax):
    ob = random.choice(ROSE_LIB).copy()
    bpy.context.collection.objects.link(ob)
    ob.hide_render = False
    s = (smin + random.random() * (smax - smin)) / max(ob.dimensions.x, ob.dimensions.y, 0.01)
    ob.scale = (s, s, s)
    ob.rotation_euler = (0, 0, random.random() * 6.283)
    ob.location = (px, -py, z)
    ob.name = name


if ROSE_LIB:
    pg = first_rect(els["pergola"])
    px0, py0, pw, pdp = pg["x"], pg["y"], pg["w"], pg["d"]
    pgz = ground_h(px0 + pw / 2, py0 + pdp / 2)
    top = pgz + 2.5
    ri = 0
    for qx, qy in [(px0 + 0.2, py0 + 0.2), (px0 + pw - 0.2, py0 + 0.2),
                   (px0 + 0.2, py0 + pdp - 0.2), (px0 + pw - 0.2, py0 + pdp - 0.2)]:
        ox = 0.12 if qx < px0 + pw / 2 else -0.12
        oy = 0.12 if qy < py0 + pdp / 2 else -0.12
        for h in (0.7, 1.25, 1.8, 2.4):
            put_rose("pergrose%d" % ri, qx + ox + (random.random() - 0.5) * 0.1,
                     qy + oy + (random.random() - 0.5) * 0.1, pgz + h, 0.5, 0.85)
            ri += 1
    for edge_y in (py0 + 0.15, py0 + pdp - 0.15):
        for k in range(6):
            put_rose("pergrose%d" % ri,
                     px0 + 0.4 + (pw - 0.8) * k / 5.0 + (random.random() - 0.5) * 0.2,
                     edge_y + (random.random() - 0.5) * 0.15, top - 0.15, 0.55, 0.95)
            ri += 1
    print("PERGOLA ROSES:", ri)

# firewood pile beside the sauna
place_plant(LOG_LIB, "logs0", 10.9, 3.4, 1.5)

# firewood by the fire pit (37.5, 6.6) so there is wood to actually burn there
for i, (px, py) in enumerate([(38.7, 6.5), (36.4, 5.6)]):
    place_plant(LOG_LIB, "firepitlogs%d" % i, px, py, 1.2)

# stacked log store: split-log rounds cross-stacked into a wall (cut ends facing the garden),
# tucked under the sauna shelter. Brick-offset rows so the ends don't line up into a grid.
MAT["logwood"] = mat_simple("logwood", hexc("#c2a878"), rough=0.85)


def build_log_store(name, x0, x1, y_front, depth, height, mat):
    r = 0.07
    step = 2 * r + 0.004
    cols = int((x1 - x0) / step)
    rows = int(height / (2 * r * 0.9))
    cy = y_front - depth / 2.0
    zb = ground_h((x0 + x1) / 2.0, y_front)
    n = 0
    for rw in range(rows):
        off = r if rw % 2 else 0.0
        for cl in range(cols):
            cx = x0 + r + off + cl * step
            if cx > x1 - r:
                continue
            cz = zb + r + rw * (2 * r * 0.9)
            add_cyl("%s_%d" % (name, n), cx + (random.random() - 0.5) * 0.006, cy, cz,
                    r * (0.9 + random.random() * 0.18), depth * (0.9 + random.random() * 0.2),
                    mat, verts=12, rot=(math.radians(90), 0, (random.random() - 0.5) * 0.08))
            n += 1
    print("LOG STORE logs:", n)


build_log_store("logstore", 3.6, 6.0, 4.0, 0.5, 0.85, MAT["logwood"])


# ---------------- edible kitchen garden (four western raised beds) ----------------
def place_edible(lib, name, px, py, soil, footprint):
    """Seat a plant with its base on the raised-bed soil surface (not the terrain)."""
    ob = random.choice(lib).copy()
    bpy.context.collection.objects.link(ob)
    ob.hide_render = False
    d = max(ob.dimensions.x, ob.dimensions.y, 0.01)
    sv = footprint / d
    ob.scale = (sv, sv, sv)
    ob.rotation_euler = (0, 0, random.random() * 6.283)
    base = min(c[2] for c in ob.bound_box) * sv
    ob.location = (px, -py, soil - base)
    ob.name = name


# tomatoes (mostly the two larger growth stages) alternating with leafy greens in two
# rows per bed, seated on the soil top (bed box = ground + 0.4). GROUND_PLANTS = sorrel +
# fern, which read as veg-row foliage.
edible_i = 0
for eid in ["raisedBed1", "raisedBed2", "raisedBed3", "raisedBed4"]:
    r = first_rect(els[eid])
    x0, y0, w, dep = r["x"], r["y"], r["w"], r.get("d", r.get("h"))
    soil = ground_h(x0 + w / 2, y0 + dep / 2) + 0.6
    n_rows = 6
    for row in range(n_rows):
        py = y0 + 0.45 + (dep - 0.9) * row / (n_rows - 1)
        for col, cx in enumerate([x0 + w * 0.33, x0 + w * 0.67]):
            px = cx + (random.random() - 0.5) * 0.12
            if TOMATO_LIB and (row + col) % 2 == 0:
                tmpl = random.choice(TOMATO_LIB[1:] or TOMATO_LIB)
                ob = tmpl.copy()
                bpy.context.collection.objects.link(ob)
                ob.hide_render = False
                sv = (0.45 + random.random() * 0.12) / max(ob.dimensions.x, ob.dimensions.y, 0.01)
                ob.scale = (sv, sv, sv)
                ob.rotation_euler = (0, 0, random.random() * 6.283)
                ob.location = (px, -py, soil - min(c[2] for c in ob.bound_box) * sv)
                ob.name = "tomato%d" % edible_i
            elif GROUND_PLANTS:
                place_edible(GROUND_PLANTS, "green%d" % edible_i, px, py, soil,
                             0.26 + random.random() * 0.12)
            edible_i += 1
print("EDIBLE placed:", edible_i)


# ---------------- planting-zone vegetation ----------------
COUNTS = {"perennial": 0, "tuft": 0, "shrub": 0, "flower": 0, "pot": 0, "molinia": 0, "stalks": 0}


def sample_shape(fn, bbox, count):
    pts = []
    attempts = 0
    while len(pts) < count and attempts < count * 80 + 200:
        attempts += 1
        x = bbox[0] + random.random() * (bbox[2] - bbox[0])
        y = bbox[1] + random.random() * (bbox[3] - bbox[1])
        if fn(x, y):
            pts.append((x, y))
    return pts


def shape_area(fn, bbox, probes=1200):
    hits = 0
    for _ in range(probes):
        x = bbox[0] + random.random() * (bbox[2] - bbox[0])
        y = bbox[1] + random.random() * (bbox[3] - bbox[1])
        if fn(x, y):
            hits += 1
    return (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) * hits / probes


def make_tuft(name, px, py, z, depth=0.4):
    # real ornamental-grass clump instead of a procedural cone; depth biases its size
    place_asset(random.choice(GRASS_CLUMPS), name, px, py,
                footprint=0.16 + depth * 0.4 + random.random() * 0.12, z=z - 0.01)
    COUNTS["tuft"] += 1


def scatter_perennials(zid, fn, bbox, area, density=5.0, tufts=0.9):
    for ci, (cx, cy) in enumerate(sample_shape(fn, bbox, max(1, int(area * density / 3.0)))):
        for k in range(3):
            px = cx + (random.random() - 0.5) * 0.7
            py = cy + (random.random() - 0.5) * 0.7
            if not fn(px, py):
                continue
            place_asset(random.choice(PERENNIAL_POOL), "%s_p%d_%d" % (zid, ci, k), px, py,
                        footprint=0.28 + random.random() * 0.4)
            COUNTS["perennial"] += 1
    for ti, (px, py) in enumerate(sample_shape(fn, bbox, max(1, int(area * tufts)))):
        make_tuft("%s_t%d" % (zid, ti), px, py, terrain_z(px, py))


def scatter_shrubs(zid, fn, bbox, area, per_m2=0.7):
    for i, (px, py) in enumerate(sample_shape(fn, bbox, max(1, int(area * per_m2)))):
        make_bush("%s_s%d" % (zid, i), px, py, s=0.7 + random.random() * 0.7)
        COUNTS["shrub"] += 1


def scatter_flowers(zid, fn, bbox, area, per_m2=0.9):
    for i, (px, py) in enumerate(sample_shape(fn, bbox, max(1, int(area * per_m2)))):
        place_asset(random.choice(FLOWER_OBJS), "%s_f%d" % (zid, i), px, py,
                    footprint=0.25 + random.random() * 0.2)
        COUNTS["flower"] += 1


def build_molinia_mesh(name, n_blades=28, n_stalks=6, blade_len=0.55):
    """Ornamental-grass clump: fountain of curved blade strips + seed-head stalks."""
    bm = bmesh.new()
    blade_faces = 0
    for i in range(n_blades):
        a = 2 * math.pi * i / n_blades + random.random() * 0.4
        dx, dy = math.cos(a), math.sin(a)
        L = blade_len * (0.7 + random.random() * 0.6)
        ts = [0.0, 0.35, 0.7, 1.0]
        centers = [(dx * L * (t ** 1.7) * 1.05, dy * L * (t ** 1.7) * 1.05,
                    L * (1.35 * t - 0.55 * t * t)) for t in ts]
        nx_, ny_ = -dy, dx
        prev = None
        for k, (cx_, cy_, cz_) in enumerate(centers):
            wk = 0.008 * (1.0 - 0.85 * ts[k])
            v1 = bm.verts.new((cx_ - nx_ * wk, cy_ - ny_ * wk, cz_))
            v2 = bm.verts.new((cx_ + nx_ * wk, cy_ + ny_ * wk, cz_))
            if prev:
                bm.faces.new((prev[0], prev[1], v2, v1))
                blade_faces += 1
            prev = (v1, v2)
    for i in range(n_stalks):
        a = random.random() * 2 * math.pi
        bx_, by_ = math.cos(a) * 0.05, math.sin(a) * 0.05
        tx = bx_ + (random.random() - 0.5) * 0.3
        ty = by_ + (random.random() - 0.5) * 0.3
        hgt = 0.85 + random.random() * 0.35
        v1 = bm.verts.new((bx_ - 0.006, by_, 0))
        v2 = bm.verts.new((bx_ + 0.006, by_, 0))
        v3 = bm.verts.new((tx, ty, hgt))
        bm.faces.new((v1, v2, v3))
        hw, hh = 0.012, 0.055
        vt = bm.verts.new((tx, ty, hgt + hh))
        vb = bm.verts.new((tx, ty, hgt - hh * 0.4))
        vm = [bm.verts.new((tx + hw, ty, hgt)), bm.verts.new((tx, ty + hw, hgt)),
              bm.verts.new((tx - hw, ty, hgt)), bm.verts.new((tx, ty - hw, hgt))]
        for k in range(4):
            bm.faces.new((vt, vm[k], vm[(k + 1) % 4]))
            bm.faces.new((vb, vm[(k + 1) % 4], vm[k]))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(MAT["molinia"])
    mesh.materials.append(MAT["seed"])
    for pi_, poly in enumerate(mesh.polygons):
        poly.material_index = 0 if pi_ < blade_faces else 1
    return mesh


MOLINIA_MESH = build_molinia_mesh("molinia", 28, 6)
STALKS_MESH = build_molinia_mesh("stalksOnly", 5, 8, blade_len=0.35)
MOLINIA_ZONES = {"pondFringe", "prairieIsland", "arrivalStrip"}


def place_clump(mesh, name, px, py, s, kind):
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    ob.location = (px, -py, terrain_z(px, py) - 0.01)
    ob.rotation_euler = (0, 0, random.random() * 6.283)
    ob.scale = (s, s, s * (0.85 + random.random() * 0.35))
    COUNTS[kind] += 1
    return ob


for zid, plant, zfn, zbbox in ZONE_SHAPES:
    zarea = shape_area(zfn, zbbox)
    if plant == "perennials":
        scatter_perennials(zid, zfn, zbbox, zarea,
                           density=4.0 if zid in MOLINIA_ZONES else 5.5)
    elif plant == "shrubs":
        scatter_shrubs(zid, zfn, zbbox, zarea)
        scatter_perennials(zid, zfn, zbbox, zarea, density=2.5, tufts=0.5)  # groundcover under the shrubs
    elif plant == "mixed":
        scatter_shrubs(zid, zfn, zbbox, zarea, per_m2=0.45)
        scatter_perennials(zid, zfn, zbbox, zarea, density=3.5, tufts=0.6)
    elif plant == "meadow":
        scatter_flowers(zid, zfn, zbbox, zarea)
        for mi, (px, py) in enumerate(sample_shape(zfn, zbbox, max(3, int(zarea * 0.28)))):
            place_clump(STALKS_MESH, "%s_st%d" % (zid, mi), px, py, 0.7 + random.random() * 0.4, "stalks")
        for gi, (px, py) in enumerate(sample_shape(zfn, zbbox, max(2, int(zarea * 0.2)))):
            make_tuft("%s_mg%d" % (zid, gi), px, py, terrain_z(px, py), depth=0.5)
    if zid in MOLINIA_ZONES:
        for mi, (px, py) in enumerate(sample_shape(zfn, zbbox, max(2, int(zarea * 0.6)))):
            place_clump(MOLINIA_MESH, "%s_m%d" % (zid, mi), px, py, 0.8 + random.random() * 0.5, "molinia")
        if zid == "pondFringe":  # denser on the east side
            efn = (lambda f: (lambda x, y: f(x, y) and x > 30.5))(zfn)
            for mi, (px, py) in enumerate(sample_shape(efn, zbbox, max(2, int(zarea * 0.45)))):
                place_clump(MOLINIA_MESH, "%s_me%d" % (zid, mi), px, py, 0.9 + random.random() * 0.5, "molinia")

# atrium pots: planter cylinders on the west-terrace deck
deck_top = DECK_TOP
pot_parts = sorted((x for x in els["atriumPots"]["parts"] if x["kind"] == "circle"),
                   key=lambda q: -q["r"])
for i, potc in enumerate(pot_parts):
    pcx2, pcy2, pr = potc["cx"], potc["cy"], potc["r"]
    add_cyl("pot%d" % i, pcx2, pcy2, deck_top + 0.25, pr, 0.5, MAT["planter"])
    add_cyl("pot%d_soil" % i, pcx2, pcy2, deck_top + 0.48, pr * 0.9, 0.04, MAT["soil_pot"])
    top = deck_top + 0.5
    COUNTS["pot"] += 1
    if i == 0:  # largest: multi-stem shrub
        mat = random.choice(CANOPY)
        for k in range(3):
            a = k * 2.1 + random.random()
            sxp = pcx2 + 0.15 * math.cos(a)
            syp = pcy2 + 0.15 * math.sin(a)
            bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.025, depth=0.8,
                                                location=(sxp, -syp, top + 0.35))
            ob = bpy.context.active_object
            ob.name = "pot%d_stem%d" % (i, k)
            ob.rotation_euler = ((random.random() - 0.5) * 0.25, (random.random() - 0.5) * 0.25, 0)
            ob.data.materials.append(MAT["trunk"])
        place_asset(random.choice(SHRUBS), "pot%d_can" % i, pcx2, pcy2,
                    footprint=pr * 2.6, z=top + 0.55)
    else:
        place_asset(random.choice(GROUND_PLANTS), "pot%d_per" % i, pcx2, pcy2,
                    footprint=pr * 1.9, z=top - 0.02)
        make_tuft("pot%d_tuft" % i, pcx2, pcy2, top, depth=0.35)

print("PLANTING:", COUNTS)

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


# ---------------- garden light fixtures ----------------
def circles_of(el_id):
    e = els.get(el_id)
    if not e:
        return []
    return [(p["cx"], p["cy"]) for p in e["parts"] if p["kind"] == "circle"]


path_lights = circles_of("pathLights") or [
    (23.0, 26.15), (26.8, 26.15), (30.6, 26.15), (34.4, 26.7),  # driveway north edge
    (9.25, 4.5), (9.25, 6.7),  # sauna path
    (24.8, 22.7),  # terrace SE corner
]
garden_spots = circles_of("gardenSpots") or [(41.5, 33.5), (33.5, 13.2), (25.0, 5.6)]

for i, (lx, ly) in enumerate(path_lights):
    z = terrain_z(lx, ly)
    add_cyl("bollard%d" % i, lx, ly, z + 0.33, 0.045, 0.66, MAT["bollard"], verts=12)
    add_cyl("bollard%d_head" % i, lx, ly, z + 0.69, 0.05, 0.06, MAT["bulb"], verts=12)
    ld = bpy.data.lights.new("bollardL%d" % i, type="POINT")
    ld.energy = 7.0
    ld.color = (1.0, 0.6, 0.3)
    ld.shadow_soft_size = 0.05
    lo = bpy.data.objects.new("bollardL%d" % i, ld)
    bpy.context.collection.objects.link(lo)
    lo.location = (lx, -ly, z + 0.78)

for i, (lx, ly) in enumerate(garden_spots):
    z = terrain_z(lx, ly)
    add_cyl("spotdisc%d" % i, lx, ly, z + 0.02, 0.09, 0.04, MAT["spot_disc"], verts=16)
    ld = bpy.data.lights.new("spotL%d" % i, type="SPOT")
    ld.energy = 15.0
    ld.color = (1.0, 0.65, 0.35)
    ld.spot_size = math.radians(75)
    ld.shadow_soft_size = 0.05
    lo = bpy.data.objects.new("spotL%d" % i, ld)
    bpy.context.collection.objects.link(lo)
    lo.location = (lx, -ly, z + 0.06)
    lo.rotation_euler = (math.pi, 0, 0)  # aim up

fire_ld = bpy.data.lights.new("fireL", type="POINT")
fire_ld.energy = 0.0
fire_ld.color = (1.0, 0.45, 0.15)
fire_ld.shadow_soft_size = 0.2
fire_lo = bpy.data.objects.new("fireL", fire_ld)
bpy.context.collection.objects.link(fire_lo)
fire_lo.location = (fc["cx"], -fc["cy"], fz + 0.4)

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

HDRI_CACHE = {}


def hdri_env():
    """Day HDRI + Z rotation that aligns its sun with the computed sun azimuth."""
    if "img" not in HDRI_CACHE:
        d = os.path.join(ASSETS, "hdri")
        fn = sorted(f for f in os.listdir(d) if f.endswith((".hdr", ".exr")))[0]
        img = bpy.data.images.load(os.path.join(d, fn), check_existing=True)
        import numpy as np
        w, h = img.size
        arr = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(arr)
        lum = arr.reshape(h, w, 4)[..., :3].sum(axis=2)
        j, i = np.unravel_index(int(np.argmax(lum)), lum.shape)
        phi_img = (0.5 - (i + 0.5) / w) * 2.0 * math.pi
        HDRI_CACHE["img"] = img
        HDRI_CACHE["rot"] = phi_img - (math.pi / 2.0 - az)
        print("HDRI sun at col %d/%d -> world rot %.1f deg" % (i, w, math.degrees(HDRI_CACHE["rot"])))
    return HDRI_CACHE["img"], HDRI_CACHE["rot"]

world = scene.world or bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
wnt = world.node_tree

sun_data = bpy.data.lights.new("Sun", type="SUN")
sun_data.energy = 4.0
sun_data.angle = math.radians(0.526)
sun = bpy.data.objects.new("Sun", sun_data)
bpy.context.collection.objects.link(sun)
sun.location = (22, -17, 40)


def aim_sun(elev_r, az_r):
    d = Vector((math.sin(az_r) * math.cos(elev_r), math.cos(az_r) * math.cos(elev_r), math.sin(elev_r)))
    sun.rotation_euler = d.to_track_quat("Z", "Y").to_euler()


ember = MAT["fire"].node_tree.nodes["Principled BSDF"]


def set_lighting(mode):
    """day: computed 14:00 June sun; golden: ~19:45 WNW low warm; night: dark blue + fixtures."""
    for nd in list(wnt.nodes):
        wnt.nodes.remove(nd)
    out_n = wnt.nodes.new("ShaderNodeOutputWorld")
    lp = wnt.nodes.new("ShaderNodeLightPath")
    mixsh = wnt.nodes.new("ShaderNodeMixShader")
    bg_l = wnt.nodes.new("ShaderNodeBackground")  # lighting rays
    bg_c = wnt.nodes.new("ShaderNodeBackground")  # camera rays
    wnt.links.new(lp.outputs["Is Camera Ray"], mixsh.inputs["Fac"])
    wnt.links.new(bg_l.outputs["Background"], mixsh.inputs[1])
    wnt.links.new(bg_c.outputs["Background"], mixsh.inputs[2])
    wnt.links.new(mixsh.outputs["Shader"], out_n.inputs["Surface"])
    if mode == "night":
        bg_l.inputs["Color"].default_value = (*hexc("#22344f"), 1.0)
        bg_l.inputs["Strength"].default_value = 0.55
        bg_c.inputs["Color"].default_value = (*hexc("#16263f"), 1.0)
        bg_c.inputs["Strength"].default_value = 1.0
        sun_data.energy = 0.4
        sun_data.color = (0.6, 0.72, 1.0)
        aim_sun(math.radians(50), math.radians(120))
        ember.inputs["Emission Strength"].default_value = 30.0
        fire_ld.energy = 40.0
        for s in FLAME_STR:
            s.default_value = 6.0
        for ob in FLAME_OBJS:
            ob.hide_render = False
        return
    if mode == "day":
        img, rot = hdri_env()
        env = wnt.nodes.new("ShaderNodeTexEnvironment")
        env.image = img
        tcw = wnt.nodes.new("ShaderNodeTexCoord")
        mpw = wnt.nodes.new("ShaderNodeMapping")
        mpw.inputs["Rotation"].default_value = (0.0, 0.0, rot)
        wnt.links.new(tcw.outputs["Generated"], mpw.inputs["Vector"])
        wnt.links.new(mpw.outputs["Vector"], env.inputs["Vector"])
        wnt.links.new(env.outputs["Color"], bg_l.inputs["Color"])
        wnt.links.new(env.outputs["Color"], bg_c.inputs["Color"])
        bg_l.inputs["Strength"].default_value = 0.45
        bg_c.inputs["Strength"].default_value = 0.7
        sun_data.energy = 2.4
        sun_data.color = (1.0, 0.98, 0.94)
        aim_sun(elev, az)
        ember.inputs["Emission Strength"].default_value = 6.0
        fire_ld.energy = 0.0
        for ob in FLAME_OBJS:
            ob.hide_render = True
        return
    sky2 = wnt.nodes.new("ShaderNodeTexSky")
    try:
        sky2.sky_type = "NISHITA"
    except (AttributeError, TypeError):
        pass
    e_r, a_r = math.radians(17.0), math.radians(300.0)
    sun_data.energy = 7.0
    sun_data.color = (1.0, 0.45, 0.22)
    cam_strength = 0.4
    amb_strength = 0.15
    ember_str, fire_e = 15.0, 10.0
    for s in FLAME_STR:
        s.default_value = 3.0
    for ob in FLAME_OBJS:
        ob.hide_render = False
    if hasattr(sky2, "sun_elevation"):
        sky2.sun_elevation = e_r
    if hasattr(sky2, "sun_rotation"):
        sky2.sun_rotation = a_r
    if hasattr(sky2, "sun_disc"):
        sky2.sun_disc = False
    sky_src = sky2.outputs["Color"]
    if mode == "golden":
        warm = wnt.nodes.new("ShaderNodeMix")
        warm.data_type = "RGBA"
        warm.blend_type = "MULTIPLY"
        warm.inputs[0].default_value = 0.8
        warm.inputs[7].default_value = (1.0, 0.58, 0.36, 1.0)
        wnt.links.new(sky2.outputs["Color"], warm.inputs[6])
        sky_src = warm.outputs[2]
    wnt.links.new(sky_src, bg_l.inputs["Color"])
    wnt.links.new(sky_src, bg_c.inputs["Color"])
    bg_l.inputs["Strength"].default_value = amb_strength
    bg_c.inputs["Strength"].default_value = cam_strength
    aim_sun(e_r, a_r)
    ember.inputs["Emission Strength"].default_value = ember_str
    fire_ld.energy = fire_e


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


fcx2, fcy2 = fc["cx"], fc["cy"]  # cameras follow the fire pit
walk_loc = (fcx2 - 4.1, -(fcy2 + 3.8), ground_h(fcx2 - 4.1, fcy2 + 3.8) + 1.65)
walk_tgt = (fcx2, -fcy2, ground_h(fcx2, fcy2) + 0.5)
deck_e_top = DECK_TOP
CAMS = {
    "iso": add_cam("iso", (60, -55, 35), (22, -17, 2), 40),
    "walk": add_cam("walk", walk_loc, walk_tgt, 30, fstop=2.8),
    "living": add_cam("living", (20.80, -17.5, ft + 1.5),
                      (30.5, -14.5, ground_h(30.5, 14.5) + 1.0), 35, fstop=4.0),
    "terrace": add_cam("terrace", (23.0, -16.0, deck_e_top + 1.6),
                       (fcx2, -fcy2, ground_h(fcx2, fcy2) + 1.0), 30),
    "arrival": add_cam("arrival", (42.3, -29.3, ground_h(42.3, 29.3) + 1.65),
                       (31.0, -24.8, ground_h(31, 24.8) + 1.4), 28),
}

# ---------------- render ----------------
scene.render.engine = "CYCLES"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Base Contrast"
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.cycles.samples = 128
scene.cycles.use_denoising = True
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.05
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 3
scene.cycles.glossy_bounces = 3
scene.cycles.transmission_bounces = 4
scene.cycles.transparent_max_bounces = 6
scene.cycles.blur_glossy = 1.0
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False

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

JOBS = [
    ("iso", "render-iso.png", "day", 96, 0.0),
    ("walk", "render-walk.png", "day", 96, 0.0),
    ("living", "render-living.png", "day", 96, 0.0),
    ("terrace", "render-terrace-golden.png", "golden", 128, 0.4),
    ("arrival", "render-arrival-night.png", "night", 192, 0.3),
]
only = []
for a2 in extra:
    if a2.startswith("--only="):
        only = a2.split("=", 1)[1].split(",")

tri_unique = 0
for _me in bpy.data.meshes:
    if _me.users == 0:
        continue
    _me.calc_loop_triangles()
    tri_unique += len(_me.loop_triangles)
tri_scene = sum(len(ob.data.loop_triangles) for ob in bpy.data.objects
                if ob.type == "MESH" and not ob.hide_render)
print("TRIS unique %.0fk / placed %.0fk (excl. GN grass blades)" % (tri_unique / 1e3, tri_scene / 1e3))

set_lighting("day")
scene.camera = CAMS["iso"]
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "garden.blend"))
print("SAVED", os.path.join(out_dir, "garden.blend"))

if NO_RENDER:
    print("NO-RENDER mode: scene built, skipping renders")
else:
    for cname, outfile, mode, smp, expo in JOBS:
        if only and cname not in only:
            continue
        set_lighting(mode)
        scene.cycles.samples = smp
        scene.view_settings.exposure = expo
        scene.camera = CAMS[cname]
        scene.render.filepath = os.path.join(out_dir, outfile)
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        print("RENDER %s (%s) done in %.1fs -> %s" % (cname, mode, time.time() - t0, scene.render.filepath))
    print("POC DONE")
