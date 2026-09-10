import assert from 'node:assert/strict';
import {mkdtemp,copyFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const directory=await mkdtemp(join(tmpdir(),'house-refresh-check-'));
try {
  await mkdir(join(directory,'generated'));
  await writeFile(join(directory,'generated','house-walkthrough.glb'),'test input');
  await copyFile(new URL('./refresh-import.py',import.meta.url),join(directory,'refresh-import.py'));
  for(const scenario of ['incompatible','compatible','binding-failure']) {
  const result=spawnSync('python3',['-I','-',join(directory,'refresh-import.py'),scenario],{encoding:'utf8',timeout:5000,input:`
import runpy, sys, types
from pathlib import Path
house = '/Game/Walkthrough/House'
current = house
writes = []
scenario = sys.argv[2]
class Mesh:
    def __init__(self, path='/Game/HouseImport/mesh.mesh'): self.path = path
    def get_path_name(self): return self.path
class Component:
    def __init__(self): self.static_mesh = Mesh()
    def set_static_mesh(self, mesh):
        if scenario == 'binding-failure': return False
        self.static_mesh = mesh
        writes.append(current)
        return True
class Actor:
    def __init__(self):
        self.component = Component()
        self.transform = 'original transform'
    def get_components_by_class(self, kind): return [self.component]
    def get_actor_label(self): return 'changed' if scenario == 'incompatible' and current != house else 'original'
    def get_actor_transform(self): return self.transform
    def set_actor_transform(self, transform, *args):
        self.transform = transform
        writes.append(current)
    def get_path_name(self): return current + '.original'
    def get_attach_parent_actor(self): return None
levels = {house: Actor()}
class API:
    def is_in_play_in_editor(self): return False
    def get_editor_world(self): return types.SimpleNamespace(get_path_name=lambda: current + '.House')
    def get_all_level_actors(self): return [levels[current]]
    def new_level(self, path):
        global current
        current = path
        levels[path] = Actor()
        return True
    def load_level(self, path):
        global current
        current = path
        return True
    def get_current_level(self): return current
    def save_current_level(self):
        writes.append(current)
        return True
api = API()
class Assets:
    @staticmethod
    def save_directory(path, **kwargs):
        writes.append(path)
        return True
    @staticmethod
    def duplicate_asset(source, target):
        import copy
        levels[target] = copy.deepcopy(levels[source])
        writes.append(target)
        return True
    @staticmethod
    def load_asset(path): return Mesh(path)
class Manager:
    def create_source_data(self, path): return path
    def import_scene(self, path, source, params):
        writes.append(path)
        levels[current].component.static_mesh = Mesh(path + '/mesh.mesh')
        levels[current].transform = 'new transform'
        return True
engine = types.ModuleType('unreal')
engine.LevelEditorSubsystem = engine.UnrealEditorSubsystem = engine.EditorActorSubsystem = object
engine.StaticMeshComponent = Component
engine.get_editor_subsystem = lambda kind: api
engine.EditorLoadingAndSavingUtils = types.SimpleNamespace(get_dirty_map_packages=lambda: [])
engine.EditorAssetLibrary = Assets
engine.InterchangeManager = types.SimpleNamespace(get_interchange_manager_scripted=lambda: Manager())
engine.ImportAssetParameters = types.SimpleNamespace
sys.modules['unreal'] = engine
try:
    runpy.run_path(sys.argv[1])
except RuntimeError:
    assert scenario != 'compatible', 'Compatible refresh must prepare a candidate'
else:
    assert scenario == 'compatible', 'Invalid refresh must fail'
assert writes, 'The test must reach scene import'
assert all(not path.startswith('/Game/HouseImport') and path != house for path in writes), writes
assert current == house, 'Original level must reopen after failed staging'
assert levels[house].component.static_mesh.get_path_name() == '/Game/HouseImport/mesh.mesh'
assert levels[house].transform == 'original transform'
if scenario == 'compatible':
    candidates = [actor for path, actor in levels.items() if 'HouseCandidate_' in path]
    assert len(candidates) == 1
    assert candidates[0].component.static_mesh.get_path_name().startswith('/Game/HouseRefresh/')
    assert candidates[0].transform == 'new transform'
print(scenario + ': original assets and level unchanged; editor returned to House')
`});
  assert.equal(result.status,0,result.stderr||result.stdout);
  process.stdout.write(result.stdout);
  }
} finally {
  await rm(directory,{recursive:true,force:true});
}
