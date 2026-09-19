import json
from pathlib import Path
import runpy
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import patch


ROOT = Path(__file__).resolve().parent


class StaticMeshActor:
    def __init__(self, folder, parent=None):
        path = f'/Game/{folder}/Meshes/mesh'
        mesh = SimpleNamespace(get_path_name=lambda: path)
        self.static_mesh_component = SimpleNamespace(static_mesh=mesh)
        self.parent = parent
        self.kind = 'StaticMeshActor'

    def get_class(self):
        return SimpleNamespace(get_name=lambda: self.kind)

    def get_attached_actors(self):
        return []

    def get_attach_parent_actor(self):
        return self.parent


class Group:
    def __init__(self, world, parent=None, components=('SceneComponent',)):
        self.world, self.parent, self.kind = world, parent, 'Actor'
        self.components = components

    def get_class(self):
        return SimpleNamespace(get_name=lambda: 'Actor')

    def get_attached_actors(self):
        return [actor for actor in self.world.actors if actor.parent is self]

    def get_attach_parent_actor(self):
        return self.parent

    def get_components_by_class(self, component_class):
        return [SimpleNamespace(get_class=lambda name=name: SimpleNamespace(get_name=lambda: name))
                for name in self.components]


class Light:
    parent = None

    def get_class(self):
        return SimpleNamespace(get_name=lambda: 'DirectionalLight')

    def get_attached_actors(self):
        return []


class World:
    def __init__(self):
        self.actors = []
        self.path = ''

    def get_path_name(self):
        return self.path


def build(world):
    house_root = Group(world)
    house_room = Group(world, house_root)
    garden_root = Group(world)
    world.actors = [house_root, house_room, garden_root, Light(),
                    StaticMeshActor('HouseOld', house_room), StaticMeshActor('HouseOld', house_room),
                    StaticMeshActor('HousePatch', house_root), StaticMeshActor('Garden', garden_root),
                    StaticMeshActor('Context', garden_root)]


def fake_unreal(world, state):
    subsystem = SimpleNamespace(get_all_level_actors=lambda: list(world.actors),
                                destroy_actor=lambda actor: world.actors.remove(actor))

    def import_scene(assets, source, params):
        state['imported'] = (assets, source)
        world.actors.extend(StaticMeshActor(assets.split('/')[2]) for _ in range(3))
        return True

    def load_map(path):
        world.path = path + '.' + path.split('/')[-1]
        state.setdefault('loaded', []).append(path)

    def save_map(target_world, path):
        state['saved_as'] = path
        return True

    fake = SimpleNamespace(
        StaticMeshActor=StaticMeshActor,
        ActorComponent=object,
        EditorAssetLibrary=SimpleNamespace(does_asset_exist=lambda path: path in state.get('existing', ()),
                                           does_directory_exist=lambda path: path in state.get('existing', ()),
                                           save_directory=lambda *args, **kwargs: True),
        EditorLoadingAndSavingUtils=SimpleNamespace(load_map=load_map, save_map=save_map),
        InterchangeManager=SimpleNamespace(get_interchange_manager_scripted=lambda: SimpleNamespace(
            create_source_data=lambda path: path, import_scene=import_scene)),
        ImportAssetParameters=lambda: SimpleNamespace(),
        UnrealEditorSubsystem='world', EditorActorSubsystem='actors', LevelEditorSubsystem='levels',
    )
    subsystems = {'world': SimpleNamespace(get_editor_world=lambda: world), 'actors': subsystem,
                  'levels': SimpleNamespace(get_current_level=lambda: 'level', save_current_level=lambda: True)}
    fake.get_editor_subsystem = subsystems.__getitem__
    return fake


def run(options, existing=()):
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        (root / 'generated').mkdir()
        (root / 'generated' / 'house-walkthrough.glb').write_bytes(b'glb')
        (root / 'generated' / 'rebuild-level.json').write_text(json.dumps(options))
        world, state = World(), {'existing': set(existing)}
        build(world)
        with patch.dict(sys.modules, unreal=fake_unreal(world, state)):
            module = runpy.run_path(str(ROOT / 'rebuild-level.py'))
            live = module['rebuild'].__globals__
            live['ROOT'], live['OPTIONS'] = root, root / 'generated' / 'rebuild-level.json'
            report = module['rebuild']()
        return report, world, state, json.loads((root / 'generated' / 'rebuild-level-report.json').read_text())


OPTIONS = {'sourceLevel': 'HouseGarden', 'newLevel': 'HouseFresh', 'assetFolder': 'HouseFreshAssets',
           'replaceAssetFolders': ['HouseOld', 'HousePatch']}
report, world, state, written = run(OPTIONS)
assert report == written
assert state['loaded'] == ['/Game/Walkthrough/HouseGarden', '/Game/Walkthrough/HouseFresh'] and state['saved_as'] == '/Game/Walkthrough/HouseFresh'
assert report['houseMeshesRemoved'] == 3 and report['emptyGroupsPruned'] == 2, 'Both the emptied room group and then its parent are pruned'
assert report['keptMeshesByFolder'] == {'Garden': 1, 'Context': 1}, 'Garden and context meshes survive'
assert report['houseMeshesImported'] == 3 and state['imported'][0] == '/Game/HouseFreshAssets'
kinds = [actor.get_class().get_name() for actor in world.actors]
assert kinds.count('DirectionalLight') == 1 and kinds.count('Actor') == 1, 'Lights and the populated garden group stay'

for bad, message in [({**OPTIONS, 'newLevel': '../Other'}, 'plain asset name'),
                     ({**OPTIONS, 'replaceAssetFolders': []}, 'replaceAssetFolders'),
                     ({**OPTIONS, 'replaceAssetFolders': ['HouseFreshAssets']}, 'cannot also be removed'),
                     ({**OPTIONS, 'replaceAssetFolders': ['Nothing']}, 'No house meshes matched')]:
    try:
        run(bad)
        raise AssertionError('Expected a refusal for ' + message)
    except (ValueError, RuntimeError) as error:
        assert message in str(error), str(error)
for existing in ('/Game/Walkthrough/HouseFresh', '/Game/HouseFreshAssets'):
    try:
        run(OPTIONS, existing=[existing])
        raise AssertionError('Existing targets must not be overwritten')
    except RuntimeError as error:
        assert 'already exists' in str(error)
print('Rebuild level: copies the source level, removes only the listed house imports, prunes emptied groups, keeps garden, context and lights, imports the fresh house, and refuses overwrites.')

for matched in (True, False):
    world = World()
    unrelated_empty = Group(world)
    unrelated_light = Group(world, components=('SceneComponent', 'PointLightComponent'))
    ancestor_with_mesh = Group(world, components=('SceneComponent', 'StaticMeshComponent'))
    empty_room = Group(world, ancestor_with_mesh)
    house = StaticMeshActor('HouseOld', empty_room)
    world.actors = [unrelated_empty, unrelated_light, ancestor_with_mesh, empty_room, house]
    with patch.dict(sys.modules, unreal=fake_unreal(world, {})):
        module = runpy.run_path(str(ROOT / 'rebuild-level.py'))
        subsystem = module['unreal'].get_editor_subsystem('actors')
        removed, pruned = module['remove_house'](subsystem, {'HouseOld' if matched else 'Absent'})
    assert unrelated_empty in world.actors and unrelated_light in world.actors, 'Unrelated actors survive pruning'
    assert ancestor_with_mesh in world.actors, 'Ancestors with mesh components are not empty'
    assert (removed, pruned) == ((1, 1) if matched else (0, 0))
    assert (empty_room in world.actors) is not matched
