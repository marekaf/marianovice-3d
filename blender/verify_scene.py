"""Validate a built garden.blend against its generated scene descriptors."""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

extra = sys.argv[sys.argv.index("--") + 1:]
with open(extra[0]) as source:
    garden = json.load(source)
bpy.context.view_layer.update()
roots = [obj for obj in bpy.data.objects if obj.name.startswith("parked_vehicle_")]
assert len(roots) == len(garden["vehicles"])
assert bpy.data.objects.get("car3_body") is None
assert bpy.data.objects.get("et_table") is None
assert not any(obj.name.startswith("et_seat") for obj in bpy.data.objects)
assert any(obj.name.startswith("westTerrace_0_slab") for obj in bpy.data.objects)
assert any(obj.name.startswith("saunaPath_0_slab") for obj in bpy.data.objects)
assert any(obj.name.startswith("east_deck_board_") for obj in bpy.data.objects)
for index, (vehicle, descriptor) in enumerate(zip(garden["vehicles"], garden["vehicleModels"])):
    root = bpy.data.objects["parked_vehicle_%d" % index]
    assert abs(root.location.x - vehicle["cx"]) < 1e-5
    assert abs(root.location.y + vehicle["noseZ"] + vehicle["l"] / 2) < 1e-5
    assert abs(root.rotation_euler.z - (math.pi if vehicle.get("reversed") else 0)) < 1e-5
    assert len(root.children) == len(descriptor["parts"])
    wheel_parts = [child for child in root.children if child.name.startswith("tire_")]
    assert len(wheel_parts) == (2 if vehicle.get("moto") else 4)
    for wheel in wheel_parts:
        bottom = min((wheel.matrix_world @ Vector(corner)).z for corner in wheel.bound_box)
        assert abs(bottom - root.location.z) < 1e-5, wheel.name
    for child in root.children:
        if child.type == "MESH":
            assert all(math.isfinite(value) for vertex in child.data.vertices for value in vertex.co), child.name
furniture = garden["exteriorFurnitureModel"]
for part in furniture["parts"]:
    assert bpy.data.objects.get(part["name"]) is not None, part["name"]
templates = [obj for obj in bpy.data.objects if obj.name.startswith("procedural_")]
for template in templates:
    assert template.hide_render
    assert len(template.data.vertices) > 100
    assert min(vertex.co.z for vertex in template.data.vertices) >= -1e-6
asset_root = os.path.join(os.path.dirname(os.path.abspath(extra[0])), "assets")
if not os.path.isdir(os.path.join(asset_root, "models")):
    assert len(templates) >= 10
    assert any(obj.name.startswith("tree") and not obj.hide_render for obj in bpy.data.objects)
print("SCENE VERIFIED: %d vehicles, %d outdoor furniture parts, %d procedural templates" %
      (len(roots), len(furniture["parts"]), len(templates)))
