"""Run a small real Blender import and retain a reviewable detail-only scene."""
import json
import sys
from pathlib import Path
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from garden_details import import_details, verify_saved_details

args = sys.argv[sys.argv.index('--')+1:]
manifest, garden_path, source_root, output = args
garden = json.loads(Path(garden_path).read_text())
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
data, objects = import_details(manifest, garden, source_root)
assert not any(obj.name in {'terrain', 'driveway', 'house_walls'} for obj in objects)
assert data['coverage']['planting']['instances'] > 0
assert data['coverage']['pond']['instances'] > 0
assert data['coverage']['drain']['instances'] > 0
bpy.ops.wm.save_as_mainfile(filepath=str(Path(output).resolve()))
bpy.ops.wm.open_mainfile(filepath=str(Path(output).resolve()))
assert verify_saved_details(garden)['meshes'] == data['meshes']
print('DETAIL IMPORT SAVED AND RELOADED', output)
