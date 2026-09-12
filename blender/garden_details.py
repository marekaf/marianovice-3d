"""Import a verified browser garden-detail supplement without changing terrain."""
import hashlib
import json
from pathlib import Path


def verified_manifest(path, garden, source_root, tool_root=None):
    path = Path(path).resolve()
    source_root = Path(source_root).resolve()
    tool_root = Path(tool_root or Path(__file__).resolve().parent.parent).resolve()
    data = json.loads(path.read_text())
    if data.get('formatVersion') != 1 or data.get('roundtrip') != 'passed':
        raise ValueError('Garden supplement has not passed its GLB roundtrip')
    if data.get('units') != 'metres' or data.get('upAxis') != 'Y' or data.get('sourceOrigin') != [0, 0, 0]:
        raise ValueError('Garden supplement must use the browser world coordinates in metres')
    assets = []
    for asset in data['assets']:
        glb = (path.parent / asset['file']).resolve()
        if not glb.is_relative_to(path.parent) or hashlib.sha256(glb.read_bytes()).hexdigest() != asset['sha256']:
            raise ValueError('Garden supplement GLB is missing or changed')
        assets.append(glb)
    if not assets or sum(asset['meshes'] for asset in data['assets']) != data['meshes']:
        raise ValueError('Garden supplement assets are incomplete')
    for owner, root in [('viewer', source_root), ('tooling', tool_root)]:
        hashes = data['sources'][owner]['fileHashes']
        if not hashes:
            raise ValueError('Garden supplement lacks source hashes')
        for name, expected in hashes.items():
            file = (root / name.lstrip('/')).resolve()
            if not file.is_relative_to(root) or hashlib.sha256(file.read_bytes()).hexdigest() != expected:
                raise ValueError('Stale garden supplement source: ' + name)
    for name, value in data['layout'].items():
        if garden.get(name) != value:
            raise ValueError('Garden supplement layout differs: ' + name)
    if garden.get('siteTerrain') != data['terrain']:
        raise ValueError('Garden supplement terrain differs from garden.json')
    categories = data['categories']
    if not {'planting', 'pond', 'drain'}.issubset(categories) or not any(name.startswith('deck_') for name in categories):
        raise ValueError('Garden supplement is missing a required category')
    names = [name for category in categories.values() for name in category['meshes']]
    if len(names) != len(set(names)) or len(names) != data['meshes']:
        raise ValueError('Garden supplement repeats or omits mesh ownership')
    if not data['treeAnchors'] or len(data['controlPoints']) != len(data['treeAnchors']) or any(abs(p['position'][1]-p['ground']) > 1e-6 for p in data['controlPoints']):
        raise ValueError('Garden supplement tree ground anchors are incomplete or shifted')
    from site_terrain import height
    for point in data['controlPoints']:
        x, y, z = point['position']
        if abs(height(garden['siteTerrain'], x, z)-y) > 1e-5:
            raise ValueError('Garden supplement tree does not meet Blender terrain')
    return data, assets


def import_details(path, garden, source_root, tool_root=None):
    import bpy
    data, assets = verified_manifest(path, garden, source_root, tool_root)
    before = set(bpy.data.objects)
    try:
        for glb in assets:
            bpy.ops.import_scene.gltf(filepath=str(glb))
        imported = set(bpy.data.objects) - before
        meshes = verify_geometry(data, imported)
        for obj in imported:
            obj['garden_detail_supplement'] = hashlib.sha256(Path(path).read_bytes()).hexdigest()
        bpy.context.scene['garden_detail_manifest'] = str(Path(path).resolve())
        bpy.context.scene['garden_detail_source_root'] = str(Path(source_root).resolve())
        bpy.context.scene['garden_detail_tool_root'] = str(Path(tool_root or Path(__file__).resolve().parent.parent).resolve())
        print('GARDEN DETAILS VERIFIED:', len(meshes), 'meshes;', ', '.join(data['categories']))
        return data, imported
    except Exception:
        for obj in set(bpy.data.objects) - before:
            bpy.data.objects.remove(obj, do_unlink=True)
        raise


def verify_geometry(data, objects):
    from mathutils import Vector
    from mathutils.kdtree import KDTree
    meshes = {obj.name: obj for obj in objects if obj.type == 'MESH'}
    expected = {name for category in data['categories'].values() for name in category['meshes']}
    if set(meshes) != expected:
        raise ValueError('Imported garden detail categories do not match the manifest')
    for name, category in data['categories'].items():
        points = [obj.matrix_world @ Vector(corner) for mesh_name in category['meshes']
                  for obj in [meshes[mesh_name]] for corner in obj.bound_box]
        low, high = category['bounds']['min'], category['bounds']['max']
        expected_low, expected_high = [low[0], -high[2], low[1]], [high[0], -low[2], high[1]]
        for axis in range(3):
            if abs(min(point[axis] for point in points)-expected_low[axis]) > 1e-4 or abs(max(point[axis] for point in points)-expected_high[axis]) > 1e-4:
                raise ValueError('Imported garden detail coordinates differ: ' + name)
        probes = category['probes']
        mesh = meshes[probes['mesh']]
        tree = KDTree(len(mesh.data.vertices))
        for i, vertex in enumerate(mesh.data.vertices):
            tree.insert(mesh.matrix_world @ vertex.co, i)
        tree.balance()
        for x, y, z in probes['points']:
            if tree.find((x, -z, y))[2] > 1e-4:
                raise ValueError('Imported garden control vertex shifted: ' + name)
    if not all(obj.data.color_attributes for obj in meshes.values()):
        raise ValueError('Imported garden details lost their vertex colours')
    return meshes


def verify_saved_details(garden):
    import bpy
    scene = bpy.context.scene
    tagged = [obj for obj in bpy.data.objects if obj.get("garden_detail_supplement")]
    path = scene.get("garden_detail_manifest")
    if not path:
        if tagged:
            raise ValueError("Garden supplement is missing its saved provenance")
        return None
    data, _ = verified_manifest(path, garden, scene["garden_detail_source_root"], scene["garden_detail_tool_root"])
    digest = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    if any(obj["garden_detail_supplement"] != digest for obj in tagged):
        raise ValueError("Saved garden supplement manifest changed")
    verify_geometry(data, tagged)
    return data
