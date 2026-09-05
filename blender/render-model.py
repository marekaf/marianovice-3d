"""Asset-independent CPU preview of a shared garden model.

Generate input: node generate-blender-json.js
Render: /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/render-model.py -- blender/garden.json --model=pergola
Select --model=sauna (default), --model=pergola, or --model=garage. Append --no-render to save the
scene only, --quick for a 960px preview, or --only=day to render a single view.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from model_parts import build_model, material

args = sys.argv[sys.argv.index("--") + 1:]
source = os.path.abspath(args[0])
with open(source) as stream:
    garden = json.load(stream)
output = os.path.dirname(source)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
terrain = garden["terrain"]
model_name = next((arg.split("=", 1)[1] for arg in args if arg.startswith("--model=")), "sauna")
model = garden[model_name + "Model"]
if model_name == "garage":
    model = dict(model, categoryVisibility={"gateClosed": False, "gateOpen": True})
floor = model["floorHeight"]
build_model(model)


def ground(x, y):
    z = max(0, terrain["a"] * x + terrain["b"] * y + terrain["c"])
    patch = model.get("groundPatch")
    if patch:
        dx = max(patch["x"] - x, 0, x - patch["x"] - patch["w"])
        dy = max(patch["y"] - y, 0, y - patch["y"] - patch["d"])
        t = max(0, min(1, 1 - math.hypot(dx, dy) / patch["blend"]))
        z += (patch["level"] - z) * t * t * (3 - 2 * t)
    return z


center_x, center_y = {"sauna": (7, 4.3), "pergola": (28.78, 3.61), "garage": (30.88, 22.905)}[model_name]
grid = 120
spacing = 0.4
vertices = [(center_x + (i - grid / 2) * spacing, -(center_y + (j - grid / 2) * spacing),
             ground(center_x + (i - grid / 2) * spacing, center_y + (j - grid / 2) * spacing))
            for j in range(grid + 1) for i in range(grid + 1)]
faces = [(j * (grid + 1) + i, (j + 1) * (grid + 1) + i,
          (j + 1) * (grid + 1) + i + 1, j * (grid + 1) + i + 1)
         for j in range(grid) for i in range(grid)]
mesh = bpy.data.meshes.new("Ground")
mesh.from_pydata(vertices, [], faces)
mesh.update()
for polygon in mesh.polygons:
    polygon.use_smooth = True
ground_ob = bpy.data.objects.new("Ground", mesh)
scene.collection.objects.link(ground_ob)
ground_ob.data.materials.append(material("preview ground", {"color": "#777d61", "roughness": 0.94}))

world = bpy.data.worlds.new("Model sky")
world.use_nodes = True
scene.world = world
sky = world.node_tree.nodes.new("ShaderNodeTexSky")
sky_types = sky.bl_rna.properties["sky_type"].enum_items.keys()
sky.sky_type = "MULTIPLE_SCATTERING" if "MULTIPLE_SCATTERING" in sky_types else "NISHITA"
sky.sun_elevation = math.radians(38)
sky.sun_rotation = math.radians(140)
world.node_tree.links.new(sky.outputs["Color"], world.node_tree.nodes["Background"].inputs["Color"])
camera_data = bpy.data.cameras.new("Model camera")
camera = bpy.data.objects.new("Model camera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
scene.render.engine = "CYCLES"
scene.cycles.samples = 24 if "--quick" in args else 48
scene.cycles.device = "CPU"
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 8
scene.cycles.transmission_bounces = 6
scene.render.resolution_x = 960 if "--quick" in args else 1280
scene.render.resolution_y = 640 if "--quick" in args else 854
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "AgX"
scene.render.image_settings.file_format = "PNG"
views = [
    ("day", (15, -13, floor + 4.2), (7, -4.3, floor + 1.0), 42, 38, 0.5, -2),
    ("evening", (-1, -12.3, floor + 3.2), (7, -4.3, floor + 1.0), 38, -4, 0.3, 1.5),
    ("interior", (9.6, -4.6, floor + 1.6), (7.75, -2.5, floor + 0.85), 24, 38, 0.5, -1),
]
if model_name == "pergola":
    views = [
        ("day", (37, -13, floor + 4.6), (28.78, -3.61, floor + 1), 46, 38, 0.5, -2),
        ("evening", (20, -12, floor + 3.5), (28.78, -3.61, floor + 1), 44, -4, 0.3, 1.5),
        ("dining", (32, -7, floor + 2.0), (28.78, -3.61, floor + 0.85), 38, 38, 0.5, -2),
    ]
elif model_name == "garage":
    views = [
        ("day", (38, -33, floor + 4), (30.88, -23, floor + 1.25), 46, 38, 0.5, -2),
        ("interior", (33, -25, floor + 1.65), (30.5, -20, floor + 1.25), 25, 38, 0.5, -0.5),
    ]
only = next((arg.split("=", 1)[1] for arg in args if arg.startswith("--only=")), None)
for name, position, target, lens, elevation, strength, exposure in views:
    if only and name != only:
        continue
    camera.location = position
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.lens = lens
    sky.sun_elevation = math.radians(elevation)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = strength
    scene.render.filepath = os.path.join(output, model_name + "-preview-" + name + ".png")
    scene.view_settings.exposure = exposure
    if name == "day":
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(output, model_name + ".blend"))
    if "--no-render" not in args:
        bpy.ops.render.render(write_still=True)
