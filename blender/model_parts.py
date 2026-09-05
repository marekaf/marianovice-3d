"""Render shared, metre-scale model parts using Blender materials and meshes."""
import math

import bpy
from mathutils import Vector


def linear_color(value):
    channels = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels)


def material(name, spec):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    color = linear_color(spec["color"])
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = spec.get("roughness", 0.6)
    shader.inputs["Metallic"].default_value = spec.get("metalness", 0)
    shader.inputs["Transmission Weight"].default_value = spec.get("transmission", 0)
    shader.inputs["IOR"].default_value = 1.333 if spec.get("transmission") and "water" in name else 1.46
    if spec.get("emissive"):
        shader.inputs["Emission Color"].default_value = (*linear_color(spec["emissive"]), 1)
        shader.inputs["Emission Strength"].default_value = spec.get("emissiveIntensity", 1)
    if spec.get("grain"):
        coordinates = nodes.new("ShaderNodeTexCoord")
        mapping = nodes.new("ShaderNodeVectorMath")
        mapping.operation = "MULTIPLY"
        scale = [30, 30, 30]
        scale["xyz".index(spec["grain"])] = 1.5
        mapping.inputs[1].default_value = scale
        links.new(coordinates.outputs["Object"], mapping.inputs[0])
        grain = nodes.new("ShaderNodeTexNoise")
        grain.inputs["Scale"].default_value = 3
        grain.inputs["Detail"].default_value = 3
        grain.inputs["Roughness"].default_value = 0.65
        links.new(mapping.outputs["Vector"], grain.inputs["Vector"])
        ramp = nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.18
        ramp.color_ramp.elements[0].color = (*(c * 0.72 for c in color), 1)
        ramp.color_ramp.elements[1].position = 0.82
        ramp.color_ramp.elements[1].color = (*(min(c * 1.18, 1) for c in color), 1)
        links.new(grain.outputs["Fac"], ramp.inputs["Fac"])
        links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.18
        bump.inputs["Distance"].default_value = 0.0007
        links.new(grain.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return mat


def build_model(model):
    base_height = model["floorHeight"]
    model_name = model.get("name", "Garden model")
    materials = {name: material(model_name + "_" + name, spec) for name, spec in model["materials"].items()}
    collection = bpy.data.collections.new(model_name)
    bpy.context.scene.collection.children.link(collection)

    def mesh_object(part, vertices, faces, absolute=False):
        mesh = bpy.data.meshes.new(part["name"])
        mesh.from_pydata([(x, -y, z + (base_height if absolute else 0)) for x, y, z in vertices], [],
                        [tuple(reversed(face)) for face in faces])
        mesh.update()
        ob = bpy.data.objects.new(part["name"], mesh)
        collection.objects.link(ob)
        if not absolute:
            x, y, z = part["position"]
            ob.location = (x, -y, base_height + z)
        ob.data.materials.append(materials[part["material"]])
        return ob

    for part in model["parts"]:
        kind = part["type"]
        if kind in ("box", "beam"):
            if kind == "beam":
                start, end = Vector(part["start"]), Vector(part["end"])
                midpoint = (start + end) / 2
                part = dict(part, position=list(midpoint))
                x, y, z = part["width"] / 2, part["depth"] / 2, (end - start).length / 2
            else:
                x, y, z = (s / 2 for s in part["size"])
            vertices = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z),
                        (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
            faces = [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
            ob = mesh_object(part, vertices, faces)
            if kind == "beam":
                direction = end - start
                direction.y = -direction.y
                ob.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
        elif kind in ("cylinder", "lathe", "sphere"):
            segments = part.get("segments", 48)
            if kind == "lathe":
                profile = part["profile"]
            elif kind == "cylinder":
                h = part["height"] / 2
                profile = [(0, -h), (part["radiusBottom"], -h), (part["radiusTop"], h), (0, h)]
            else:
                profile = [(math.sin(math.pi * j / 24) / 2, -math.cos(math.pi * j / 24) / 2) for j in range(25)]
            vertices = []
            for radius, height in profile:
                for i in range(segments):
                    theta = i * 2 * math.pi / segments
                    x, y, z = radius * math.cos(theta), radius * math.sin(theta), height
                    if kind == "sphere":
                        x, y, z = x * part["size"][0], y * part["size"][1], z * part["size"][2]
                    if part.get("axis") == "x":
                        x, y, z = z, y, -x
                    elif part.get("axis") == "y":
                        x, y, z = x, z, -y
                    vertices.append((x, y, z))
            faces = []
            for j in range(len(profile) - 1):
                for i in range(segments):
                    a, b = j * segments + i, j * segments + (i + 1) % segments
                    faces.append((a, b, b + segments, a + segments))
            ob = mesh_object(part, vertices, faces)
            for polygon in ob.data.polygons:
                polygon.use_smooth = True
        elif kind == "mesh":
            ob = mesh_object(part, part["vertices"], part["faces"], absolute=True)
        else:
            raise ValueError("Unknown model primitive: " + kind)
        bevel = part.get("bevel", 0.003 if kind in ("box", "beam") else 0)
        if bevel:
            modifier = ob.modifiers.new("Rounded construction edges", "BEVEL")
            modifier.width = bevel
            modifier.segments = 3
            ob.modifiers.new("Face normals", "WEIGHTED_NORMAL")
    for light in model.get("lights", []):
        data = bpy.data.lights.new(light["name"], "POINT")
        data.energy = light.get("power", 20)
        data.color = linear_color(light["color"])
        data.shadow_soft_size = 0.16
        ob = bpy.data.objects.new(light["name"], data)
        collection.objects.link(ob)
        x, y, z = light["position"]
        ob.location = (x, -y, base_height + z)
    return collection
