"""Asset-independent preview of the shared sauna model.

Generate input: node generate-blender-json.js
Render: /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/render-sauna.py -- blender/garden.json
Append --no-render to save the scene only, --quick for a 960px preview, or --cpu to render without Metal.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sauna import build_sauna, material

args = sys.argv[sys.argv.index("--") + 1:]
source = os.path.abspath(args[0])
with open(source) as stream:
    garden = json.load(stream)
output = os.path.dirname(source)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
terrain = garden["terrain"]
floor = garden["saunaModel"]["floorHeight"]
build_sauna(garden["saunaModel"], floor)
mesh = bpy.data.meshes.new("Ground")
mesh.from_pydata([(x, -y, terrain["a"] * x + terrain["b"] * y + terrain["c"])
                 for x, y in [(-100, -100), (100, -100), (100, 100), (-100, 100)]],
                 [], [(3, 2, 1, 0)])
mesh.update()
ground_ob = bpy.data.objects.new("Ground", mesh)
scene.collection.objects.link(ground_ob)
ground_ob.data.materials.append(material("preview ground", {"color": "#777d61", "roughness": 0.94}))

world = bpy.data.worlds.new("Sauna sky")
world.use_nodes = True
scene.world = world
sky = world.node_tree.nodes.new("ShaderNodeTexSky")
sky_types = sky.bl_rna.properties["sky_type"].enum_items.keys()
sky.sky_type = "MULTIPLE_SCATTERING" if "MULTIPLE_SCATTERING" in sky_types else "NISHITA"
sky.sun_elevation = math.radians(38)
sky.sun_rotation = math.radians(140)
world.node_tree.links.new(sky.outputs["Color"], world.node_tree.nodes["Background"].inputs["Color"])
camera_data = bpy.data.cameras.new("Sauna camera")
camera = bpy.data.objects.new("Sauna camera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
scene.render.engine = "CYCLES"
scene.cycles.samples = 24 if "--quick" in args else 96
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 8
scene.cycles.transmission_bounces = 6
scene.render.resolution_x = 960 if "--quick" in args else 1600
scene.render.resolution_y = 640 if "--quick" in args else 1066
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "AgX"
scene.render.image_settings.file_format = "PNG"
try:
    preferences = bpy.context.preferences.addons["cycles"].preferences
    preferences.compute_device_type = "METAL"
    preferences.get_devices()
    if "--cpu" not in args and any(d.type == "METAL" for d in preferences.devices):
        for device in preferences.devices:
            device.use = device.type == "METAL"
        scene.cycles.device = "GPU"
except (TypeError, AttributeError):
    pass

for name, position, target, lens, elevation, strength, exposure in [
    ("day", (15, -13, floor + 4.2), (7, -4.3, floor + 1.0), 42, 38, 0.5, -2),
    ("evening", (-1, -12.3, floor + 3.2), (7, -4.3, floor + 1.0), 38, -4, 0.3, 1.5),
    ("interior", (9.6, -4.6, floor + 1.6), (7.75, -2.5, floor + 0.85), 24, 38, 0.5, -1),
]:
    camera.location = position
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.lens = lens
    sky.sun_elevation = math.radians(elevation)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = strength
    scene.render.filepath = os.path.join(output, "sauna-preview-" + name + ".png")
    scene.view_settings.exposure = exposure
    if name == "day":
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(output, "sauna.blend"))
    if "--no-render" not in args:
        bpy.ops.render.render(write_still=True)
