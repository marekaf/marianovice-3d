"""Validate a built garden.blend against its generated scene descriptors."""
import json
import math
import os
import re
import sys

import bpy
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from site_terrain import height as site_height

extra = sys.argv[sys.argv.index("--") + 1:]
with open(extra[0]) as source:
    garden = json.load(source)
bpy.context.view_layer.update()
from garden_details import verify_saved_details
details = verify_saved_details(garden)
for key in ('roofModel', 'infillModel'):
    model = garden['houseRoof'][key]
    for part in model['parts']:
        obj = bpy.data.objects[part['name']]
        assert len(obj.data.vertices) == len(part['vertices'])
        for vertex, expected in zip(obj.data.vertices, part['vertices']):
            point = obj.matrix_world @ vertex.co
            assert (point-Vector((expected[0],-expected[1],expected[2]+model['floorHeight']))).length < 1e-5, 'Saved roof matches the approved shared geometry'
assert bpy.data.objects.get('house_roof_w') is None
cap = garden['houseRoof']['wallCap']
wall = bpy.data.objects['house_walls']
for vertex in wall.data.vertices:
    point = wall.matrix_world @ vertex.co
    assert point.z <= min(cap['maxHeight'],cap['intercept']+cap['slope']*point.x)+1e-5, 'House walls remain below approved roof soffit'

roots = [obj for obj in bpy.data.objects if obj.name.startswith("parked_vehicle_")]
assert len(roots) == len(garden["vehicles"])
assert bpy.data.objects.get("car3_body") is None
assert bpy.data.objects.get("et_table") is None
assert not any(obj.name.startswith("et_seat") for obj in bpy.data.objects)
assert any(obj.name.startswith("westTerrace_0_slab") for obj in bpy.data.objects)
assert any(obj.name.startswith("saunaPath_0_slab") for obj in bpy.data.objects)
if details is None:
    assert any(obj.name.startswith("east_deck_board_") for obj in bpy.data.objects)
elements = {element['id']: element for element in garden['elements']}
assert not any(obj.name.startswith(('screenNorth', 'guestBathroomPrivacy')) for obj in bpy.data.objects)
route_mesh = bpy.data.objects['garden_routes']
route_positions = garden['gardenRouteGeometry']['positions']
assert len(route_mesh.data.vertices)*3 == len(route_positions)
for vertex in route_mesh.data.vertices:
    index = vertex.index*3
    expected = Vector((route_positions[index], -route_positions[index+2], route_positions[index+1]))
    assert ((route_mesh.matrix_world @ vertex.co)-expected).length < 1e-5, 'Saved walkway preserves the verified shared ribbon geometry'
route_inverse = route_mesh.matrix_world.inverted()
hit, bend, _, _ = route_mesh.ray_cast(route_inverse @ Vector((8, -13.2, 10)), route_inverse.to_3x3() @ Vector((0, 0, -1)))
assert hit and (route_mesh.matrix_world @ bend).z < garden['raisedBedsModel']['floorHeight']-.1, 'Walkway bend must descend from the bed court'

expected_fence_posts = [part for model in garden['fenceModels'] for part in model['parts'] if part['type'] == 'cylinder']
actual_fence_posts = [obj for obj in bpy.data.objects if re.fullmatch(r'fence_post_\d+(?:\.\d+)?', obj.name)]
assert len(actual_fence_posts) == len(expected_fence_posts)
for part in expected_fence_posts:
    x, y, z = part['position']
    expected_top = z+part['height']/2
    matches = [obj for obj in actual_fence_posts if abs(obj.location.x-x)<1e-5 and abs(obj.location.y+y)<1e-5]
    assert matches, ('missing measured fence post', x, y)
    assert any(abs(max((obj.matrix_world @ Vector(corner)).z for corner in obj.bound_box)-expected_top)<1e-5 for obj in matches), ('measured fence post top changed', x, y)

house = elements['house']['meta']['bbox']
finished_floor = garden['terrain']['houseFFLInternal']
north_gravel = bpy.data.objects['drip0']
north_vertices = [north_gravel.matrix_world @ vertex.co for vertex in north_gravel.data.vertices]
for vertex in north_vertices:
    expected = finished_floor-.5*(vertex.x-house[0])/(house[2]-house[0])
    assert abs(vertex.z-expected) < 1e-5, ('north gravel finish', tuple(vertex), expected)
for x, level in [(house[0], finished_floor), (house[2], finished_floor-.5)]:
    edge = [vertex for vertex in north_vertices if abs(vertex.x-x) < 1e-5]
    assert len(edge) >= 2
    assert all(abs(vertex.z-level) < 1e-5 for vertex in edge)

pergola_roof = [bpy.data.objects[part['name']] for part in garden['pergolaModel']['parts'] if part['category'] == 'roof']
roof_corners = [obj.matrix_world @ Vector(corner) for obj in pergola_roof for corner in obj.bound_box]
assert min(corner.x for corner in roof_corners) >= house[2]-1e-5
def fence_distance(corner, segment):
    a, b = segment['start'], segment['end']
    dx, dy = b[0]-a[0], b[1]-a[1]
    t = max(0, min(1, ((corner.x-a[0])*dx+(-corner.y-a[1])*dy)/(dx*dx+dy*dy)))
    return math.hypot(corner.x-a[0]-t*dx, -corner.y-a[1]-t*dy)
roof_north_clearance = min(fence_distance(corner, segment) for corner in roof_corners for segment in garden['siteTerrain']['fixedFences']['segments'])
assert abs(roof_north_clearance-2) < 1e-5
pergola_posts = [bpy.data.objects[part['name']] for part in garden['pergolaModel']['parts'] if part['name'].startswith('post_') and part['name'][5:].isdigit()]
post_corners = [obj.matrix_world @ Vector(corner) for obj in pergola_posts for corner in obj.bound_box]
assert abs(min(math.hypot(corner.x-house[2], -corner.y-house[1]) for corner in post_corners)-2) < 1e-5

bed_court = elements['raisedBedsPad']
bed_rect = next(part for part in bed_court['parts'] if part['kind'] == 'rect')
bed_floor = bpy.data.objects['raised_beds_gravel']
bed_corners = [bed_floor.matrix_world @ Vector(corner) for corner in bed_floor.bound_box]
assert abs(max(corner.z for corner in bed_corners)-(finished_floor+.4)) < 1e-5
for axis, lo, hi in [('x', bed_rect['x'], bed_rect['x']+bed_rect['w']),
                     ('y', -bed_rect['y']-bed_rect['d'], -bed_rect['y'])]:
    assert abs(min(getattr(corner, axis) for corner in bed_corners)-lo) < 1e-5
    assert abs(max(getattr(corner, axis) for corner in bed_corners)-hi) < 1e-5

greenhouse = elements['greenhouse']
greenhouse_rect = next(part for part in greenhouse['parts'] if part['kind'] == 'rect')
greenhouse_floor = bpy.data.objects['greenhouse_floor']
greenhouse_corners = [greenhouse_floor.matrix_world @ Vector(corner) for corner in greenhouse_floor.bound_box]
assert abs(max(corner.z for corner in greenhouse_corners)-greenhouse['meta']['grading']['finishedLevel']) < 1e-5
for axis, lo, hi in [('x', greenhouse_rect['x'], greenhouse_rect['x']+greenhouse_rect['w']),
                     ('y', -greenhouse_rect['y']-greenhouse_rect['d'], -greenhouse_rect['y'])]:
    assert abs(min(getattr(corner, axis) for corner in greenhouse_corners)-lo) < 1e-5
    assert abs(max(getattr(corner, axis) for corner in greenhouse_corners)-hi) < 1e-5

heat_pump = bpy.data.objects['heat_pump_pad']
heat_corners = [heat_pump.matrix_world @ Vector(corner) for corner in heat_pump.bound_box]
heat_bottom, heat_top = min(corner.z for corner in heat_corners), max(corner.z for corner in heat_corners)
assert abs(heat_top-garden['garageModel']['floorHeight']-.08) < 1e-5
heat_body = bpy.data.objects['heat_pump_body']
assert abs(min((heat_body.matrix_world @ Vector(corner)).z for corner in heat_body.bound_box)-heat_top) < 1e-5
heat_rect = next(part for part in elements['heatPumpPad']['parts'] if part['kind'] == 'rect')
terrain_mesh = bpy.data.objects['terrain']
terrain_inverse = terrain_mesh.matrix_world.inverted()
walk_grass_samples = 0
for vertex in terrain_mesh.data.vertices:
    point = terrain_mesh.matrix_world @ vertex.co
    if 7.7 < point.x < 8.3 and 7 < -point.y < 12:
        assert terrain_mesh.data.attributes['grass_w'].data[vertex.index].value == 0, 'Grass must not grow through the walkway'
        walk_grass_samples += 1
assert walk_grass_samples > 0

carport_rect = next(part for part in elements['carport']['parts'] if part['kind'] == 'rect')
for name, x, y, finish_offset in [('driveway', carport_rect['x']+carport_rect['w']/2, carport_rect['y']+carport_rect['d']/2, 0),
                                 ('driveway', 31, 29.3, 0), ('terrain', 28, 13.8, .04)]:
    obj = bpy.data.objects[name]
    inverse = obj.matrix_world.inverted()
    hit, position, _, _ = obj.ray_cast(inverse @ Vector((x, -y, 10)), inverse.to_3x3() @ Vector((0, 0, -1)))
    assert hit
    assert abs((obj.matrix_world @ position).z+finish_offset-(finished_floor-.5)) < 1e-5, ('common arrival and lawn finish', name, x, y)

for utility_id in ('rainTank', 'waterSource'):
    element=elements[utility_id]
    part=next(part for part in element['parts'] if part['kind'] in ('rect','circle'))
    cover=element.get('meta',{}).get('accessCover')
    x,y=(cover['x'],cover['z']) if cover else (part['cx'],part['cy']) if part['kind']=='circle' else (part['x']+part['w']/2,part['y']+part['d']/2)
    lid=bpy.data.objects[utility_id+'_manhole']
    assert abs(lid.location.x-x)<1e-5 and abs(lid.location.y+y)<1e-5, 'Utility covers keep their separate recorded positions'
    assert abs(lid.location.z-site_height(garden['siteTerrain'],x,y)-.02)<1e-5, 'Utility cover follows finished ground'
compost=next(part for part in elements['compost']['parts'] if part['kind']=='rect')
compost_posts=[obj for obj in bpy.data.objects if obj.name.startswith('compost_post_')]
assert len(compost_posts)==4
post_centres=[]
for post in compost_posts:
    corners=[post.matrix_world @ Vector(corner) for corner in post.bound_box]
    post_centres.append(((min(c.x for c in corners)+max(c.x for c in corners))/2,-(min(c.y for c in corners)+max(c.y for c in corners))/2))
for x in (compost['x'],compost['x']+compost['w']):
    for y in (compost['y'],compost['y']+compost['d']):
        assert any(abs(px-x)<1e-5 and abs(py-y)<1e-5 for px,py in post_centres), 'Composter posts match the rotated footprint'
assert sum(obj.name.startswith('compost_cross_slat_') or obj.name.startswith('compost_long_slat_') for obj in bpy.data.objects)==24
assert bpy.data.objects.get('compost_heap') is not None
for tx in [0, .5, 1]:
    for ty in [0, .5, 1]:
        x, y = heat_rect['x']+tx*heat_rect['w'], heat_rect['y']+ty*heat_rect['d']
        origin = terrain_inverse @ Vector((x, -y, 100))
        direction = terrain_inverse.to_3x3() @ Vector((0, 0, -1))
        hit, position, _, _ = terrain_mesh.ray_cast(origin, direction)
        assert hit, ('terrain missing below heat-pump pad', x, y)
        ground = (terrain_mesh.matrix_world @ position).z
        assert heat_bottom <= ground <= heat_top, ('heat-pump pad loses ground contact', x, y, ground)
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
if details is None and not os.path.isdir(os.path.join(asset_root, "models")):
    assert len(templates) >= 10
    assert any(obj.name.startswith("tree") and not obj.hide_render for obj in bpy.data.objects)
print("SCENE VERIFIED: %d vehicles, %d outdoor furniture parts, %d procedural templates" %
      (len(roots), len(furniture["parts"]), len(templates)))
print("GRADING VERIFIED: north gravel 0.50 m fall; greenhouse footprint and finish; heat-pump pad contact")
