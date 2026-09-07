"""Asset-free, shared-mesh planting templates with roots at local height zero."""
import math
import random

import bpy
from mathutils import Vector


def plant_template(name, kind, variant=0):
    rng = random.Random(107 + variant)
    vertices, faces, material_indices = [], [], []
    colors = [(0.12, 0.075, 0.035, 1), (0.055, 0.14, 0.035, 1),
              (0.09, 0.21, 0.05, 1), (0.13, 0.26, 0.07, 1),
              [(0.8, 0.78, 0.64, 1), (0.55, 0.2, 0.3, 1), (0.55, 0.1, 0.06, 1)][variant % 3]]
    materials = []
    for i, color in enumerate(colors):
        material = bpy.data.materials.get("procedural_plant_%d_%d" % (variant % 3, i))
        if material is None:
            material = bpy.data.materials.new("procedural_plant_%d_%d" % (variant % 3, i))
            material.diffuse_color = color
            material.use_nodes = True
            shader = material.node_tree.nodes.get("Principled BSDF")
            shader.inputs["Base Color"].default_value = color
            shader.inputs["Roughness"].default_value = 0.84
        materials.append(material)

    def face(points, material):
        start = len(vertices)
        vertices.extend(tuple(point) for point in points)
        faces.append(tuple(range(start, len(vertices))))
        material_indices.append(material)

    def stem(start, end, radius, tip):
        a, b = Vector(start), Vector(end)
        direction = (b - a).normalized()
        reference = Vector((0, 1, 0)) if abs(direction.y) < 0.9 else Vector((1, 0, 0))
        u = direction.cross(reference).normalized()
        v = direction.cross(u).normalized()
        rings = [[center + (math.cos(i * math.tau / 8) * u + math.sin(i * math.tau / 8) * v) * size
                  for i in range(8)] for center, size in [(a, radius), (b, tip)]]
        face(list(reversed(rings[0])), 0)
        face(rings[1], 0)
        for i in range(8):
            j = (i + 1) % 8
            face([rings[0][i], rings[0][j], rings[1][j], rings[1][i]], 0)

    def leaf(center, size, material=None):
        azimuth = rng.random() * math.tau
        elevation = rng.uniform(-0.55, 0.75)
        u = Vector((math.cos(azimuth), math.sin(azimuth), elevation)).normalized() * size
        v = Vector((-math.sin(azimuth), math.cos(azimuth), 0)) * size * 0.43
        center = Vector(center)
        face([center - u, center - u * 0.4 + v, center + u * 0.45 + v,
              center + u, center + u * 0.45 - v, center - u * 0.4 - v], material or rng.randint(1, 3))

    if kind == "tree":
        stem((0, 0, 0), (0.025, 0, 3.4), 0.12, 0.018)
        for i in range(14):
            angle = i * 2.399963
            height = 1.2 + i * 0.11
            end = (math.cos(angle) * 1.05, math.sin(angle) * 1.05, 2.6 + rng.random() * 0.6)
            stem((0, 0, height), end, 0.025, 0.004)
        for i in range(1050):
            angle = rng.random() * math.tau
            radial = math.sqrt(rng.random()) * 1.25
            z = 2.7 + rng.uniform(-0.85, 0.85) * math.sqrt(1 - (radial / 1.3) ** 2)
            leaf((math.cos(angle) * radial, math.sin(angle) * radial, z), rng.uniform(0.105, 0.19))
    elif kind == "grass":
        for i in range(100):
            angle = rng.random() * math.tau
            height = rng.uniform(0.28, 0.85)
            start = Vector((rng.uniform(-0.13, 0.13), rng.uniform(-0.13, 0.13), 0))
            sway = Vector((math.cos(angle), math.sin(angle), 0)) * height * 0.48
            across = Vector((-math.sin(angle), math.cos(angle), 0)) * 0.011
            middle = start + sway * 0.32 + Vector((0, 0, height * 0.65))
            tip = start + sway + Vector((0, 0, height))
            face([start - across, start + across, middle + across, tip, middle - across], rng.randint(1, 3))
    else:
        for i in range(14):
            angle = rng.random() * math.tau
            stem((0, 0, 0), (math.cos(angle) * 0.3, math.sin(angle) * 0.3, rng.uniform(0.45, 0.7)), 0.012, 0.003)
        for i in range(350):
            angle = rng.random() * math.tau
            radial = math.sqrt(rng.random()) * 0.44
            leaf((math.cos(angle) * radial, math.sin(angle) * radial, rng.uniform(0.18, 0.73)), rng.uniform(0.045, 0.085))
        if kind == "flower":
            for i in range(30):
                angle = rng.random() * math.tau
                radial = rng.random() * 0.4
                center = Vector((math.cos(angle) * radial, math.sin(angle) * radial, rng.uniform(0.6, 0.85)))
                for petal in range(6):
                    a = petal * math.tau / 6
                    leaf(center + Vector((math.cos(a) * 0.027, math.sin(a) * 0.027, 0)), 0.037, 4)

    mesh = bpy.data.meshes.new(name)
    base = min(point[2] for point in vertices)
    mesh.from_pydata([(x, y, z - base) for x, y, z in vertices], [], faces)
    mesh.update()
    for material in materials:
        mesh.materials.append(material)
    for polygon, index in zip(mesh.polygons, material_indices):
        polygon.material_index = index
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location.z = -70
    obj.hide_render = True
    bpy.context.view_layer.update()
    return obj
