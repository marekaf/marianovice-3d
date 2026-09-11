import importlib.util
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('full_detail', Path(__file__).with_name('build-full-detail.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Settings:
    def __init__(self):
        self.values = {}

    def set_editor_property(self, key, value):
        self.values[key] = value


class Mesh:
    def __init__(self, count, full):
        self.count, self.full = count, full
        self.settings = Settings()

    def get_num_triangles(self, lod):
        assert lod == 0
        return self.count

    def get_editor_property(self, name):
        assert name == 'nanite_settings'
        return self.settings


class Assets:
    def __init__(self):
        self.meshes = {'/Game/Source/house-walkthrough_mesh_0': Mesh(10, 100), '/Game/Source/house-walkthrough_mesh_1': Mesh(12, 12)}
        self.copies = 0

    def load_asset(self, path):
        return self.meshes.get(path)

    def does_asset_exist(self, path):
        return path in self.meshes

    def duplicate_asset(self, source, target):
        assert target not in self.meshes
        self.copies += 1
        original = self.meshes[source]
        self.meshes[target] = Mesh(original.count, original.full)
        return self.meshes[target]

    def save_loaded_asset(self, mesh):
        return True


def rebuild(mesh, settings, apply):
    assert settings.values == {'fallback_target': 'percent', 'fallback_percent_triangles': 1.0, 'fallback_relative_error': 0.0, 'keep_percent_triangles': 1.0, 'trim_relative_error': 0.0}
    assert apply
    mesh.count = mesh.full


assets = Assets()
callbacks = []
engine = SimpleNamespace(EditorAssetLibrary=assets, MoviePipelineQueueSubsystem='queue', StaticMeshEditorSubsystem='mesh', NaniteFallbackTarget=SimpleNamespace(PERCENT_TRIANGLES='percent'), log_error=lambda message: None)
engine.get_editor_subsystem = lambda kind: SimpleNamespace(is_rendering=lambda: False) if kind == 'queue' else SimpleNamespace(set_nanite_settings=rebuild)
engine.register_ticker_callback = lambda callback, delay: callbacks.append(callback) or len(callbacks)
sys.modules['unreal'] = engine


def run(options):
    session = module.start(options)
    while callbacks[-1](0):
        pass
    assert not session['active']
    return session['report']


with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    manifest = root / 'manifest.json'
    manifest.write_text(json.dumps({'sourceGlbSha256': 'test-source', 'meshes': [{'meshIndex': 0, 'rawTriangleCount': 100, 'nondegenerateTriangleCount': 100}, {'meshIndex': 1, 'rawTriangleCount': 12, 'nondegenerateTriangleCount': 12}]}))
    options = {'sourceRoot': '/Game/Source', 'targetRoot': '/Game/Copies', 'manifest': str(manifest), 'output': str(root / 'result.json')}
    result = run(options)
    assert result['state'] == 'complete' and assets.copies == 1
    assert assets.meshes['/Game/Source/house-walkthrough_mesh_0'].count == 10
    assert result['meshes']['0']['triangles'] == 100
    assert result['meshes']['1']['state'] == 'original'
    assert run(options)['state'] == 'complete' and assets.copies == 1
    active = module.start(options)
    try:
        module.start(options)
        raise AssertionError('Overlapping builders must be rejected')
    except RuntimeError:
        pass
    while callbacks[-1](0):
        pass
    unknown = {**options, 'output': str(root / 'unknown.json')}
    assert run(unknown)['state'] == 'failed'
    assert assets.copies == 1
    try:
        module.start({**options, 'sourceRoot': '/Game/Changed'})
        raise AssertionError('Changed inputs must reject an existing report')
    except RuntimeError:
        pass
    malformed = root / 'malformed.json'
    malformed.write_text(json.dumps({'sourceGlbSha256': 'test-source', 'meshes': [{'meshIndex': 0, 'rawTriangleCount': 1, 'nondegenerateTriangleCount': -1}]}))
    try:
        module.start({**options, 'manifest': str(malformed)})
        raise AssertionError('Invalid triangle counts must be rejected before copying')
    except ValueError:
        pass
print('Full-detail builder: copies only reduced meshes, preserves originals, reruns safely, rejects untracked assets and mismatched inputs')
