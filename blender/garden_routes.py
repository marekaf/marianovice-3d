import bpy


def build_routes(garden):
    data = garden['gardenRouteGeometry']
    old = bpy.data.objects.get('garden_routes')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    positions = data['positions']
    vertices = [(positions[i], -positions[i+2], positions[i+1]) for i in range(0, len(positions), 3)]
    mesh = bpy.data.meshes.new('garden_routes')
    mesh.from_pydata(vertices, [], [(i, i+1, i+2) for i in range(0, len(vertices), 3)])
    mesh.update()
    uv = mesh.uv_layers.new(name='UVMap')
    for loop in mesh.loops:
        index = loop.vertex_index*2
        uv.data[loop.index].uv = data['uv'][index:index+2]
    material = bpy.data.materials.get('garden_route_surface') or bpy.data.materials.new('garden_route_surface')
    material.diffuse_color = (.46, .44, .40, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.46, .44, .40, 1)
    shader.inputs['Roughness'].default_value = .98
    mesh.materials.append(material)
    obj = bpy.data.objects.new('garden_routes', mesh)
    bpy.context.collection.objects.link(obj)
    terrain = bpy.data.objects.get('terrain')
    if terrain and terrain.data.attributes.get('grass_w'):
        segments = [(a, b, (route['width']/2+.08)**2) for route in garden['gardenRoutes'] for a, b in zip(route['points'], route['points'][1:])]
        grass = terrain.data.attributes['grass_w'].data
        for vertex in terrain.data.vertices:
            point = terrain.matrix_world @ vertex.co
            x, y = point.x, -point.y
            for a, b, radius2 in segments:
                dx, dy = b[0]-a[0], b[1]-a[1]
                t = max(0, min(1, ((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)))
                if (x-a[0]-t*dx)**2+(y-a[1]-t*dy)**2 <= radius2:
                    grass[vertex.index].value = 0
                    break
        terrain.data.update()
    return obj
