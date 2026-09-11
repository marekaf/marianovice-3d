import json
from pathlib import Path
import time


def start(options):
    import unreal

    if getattr(unreal, '_full_detail_build_session', {}).get('active'):
        raise RuntimeError('A full-detail mesh build is already active')
    source_root = options['sourceRoot'].rstrip('/')
    target_root = options['targetRoot'].rstrip('/')
    if not source_root.startswith('/Game/') or not target_root.startswith('/Game/') or '..' in source_root + target_root:
        raise ValueError('Explicit project asset roots are required')
    if source_root == target_root or target_root.startswith(source_root + '/'):
        raise ValueError('Full-detail copies must use a separate asset root')
    if unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem).is_rendering():
        raise RuntimeError('Wait for the current render before building mesh copies')
    manifest = json.loads(Path(options['manifest']).read_text())
    indices = set()
    for row in manifest['meshes']:
        index, expected, raw = row['meshIndex'], row['nondegenerateTriangleCount'], row['rawTriangleCount']
        if any(type(value) is not int for value in [index, expected, raw]) or index < 0 or not 0 <= expected <= raw or index in indices:
            raise ValueError('Manifest requires unique mesh indices and valid integer triangle counts')
        indices.add(index)
    output = Path(options['output'])
    identity = {'sourceRoot': source_root, 'targetRoot': target_root, 'sourceHash': manifest['sourceGlbSha256']}
    report = json.loads(output.read_text()) if output.exists() else {**identity, 'meshes': {}}
    if any(report.get(key) != value for key, value in identity.items()):
        raise RuntimeError('Existing build report belongs to different inputs')
    report.update(state='running', startedAt=time.time(), error=None)
    rows = iter(manifest['meshes'])
    assets = unreal.EditorAssetLibrary
    editor = unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem)
    session = {'active': True, 'report': report}

    def save():
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2))

    def tick(delta):
        try:
            row = next(rows, None)
            if row is None:
                report.update(state='complete', finishedAt=time.time())
                session['active'] = False
                save()
                return False
            index = str(row['meshIndex'])
            source_path = source_root + '/house-walkthrough_mesh_' + index
            source = assets.load_asset(source_path)
            if source is None:
                raise RuntimeError('Missing source mesh: ' + source_path)
            expected = row['nondegenerateTriangleCount']
            raw = row['rawTriangleCount']
            original_count = source.get_num_triangles(0)
            target_path = target_root + '/Mesh_' + index
            previous = report['meshes'].get(index)
            if previous and previous['source'] != source_path:
                raise RuntimeError('Stored mesh source does not match input')
            if original_count > raw:
                raise RuntimeError('Source mesh has more triangles than its export: ' + source_path)
            if original_count >= expected and (not previous or previous['state'] == 'original'):
                report['meshes'][index] = {'source': source_path, 'asset': source_path, 'state': 'original', 'triangles': original_count, 'expected': expected, 'raw': raw}
            else:
                if assets.does_asset_exist(target_path):
                    if not previous or previous['asset'] != target_path:
                        raise RuntimeError('Refusing to change an untracked asset: ' + target_path)
                    mesh = assets.load_asset(target_path)
                else:
                    report['meshes'][index] = {'source': source_path, 'asset': target_path, 'state': 'building', 'expected': expected, 'raw': raw}
                    save()
                    mesh = assets.duplicate_asset(source_path, target_path)
                settings = mesh.get_editor_property('nanite_settings')
                settings.set_editor_property('fallback_target', unreal.NaniteFallbackTarget.PERCENT_TRIANGLES)
                for name, value in {'fallback_percent_triangles': 1.0, 'fallback_relative_error': 0.0, 'keep_percent_triangles': 1.0, 'trim_relative_error': 0.0}.items():
                    settings.set_editor_property(name, value)
                editor.set_nanite_settings(mesh, settings, True)
                count = mesh.get_num_triangles(0)
                if count < expected or count > raw:
                    raise RuntimeError(f'Mesh {index}: fallback has {count} triangles, source range is {expected}..{raw}')
                if not assets.save_loaded_asset(mesh):
                    raise RuntimeError('Could not save full-detail mesh: ' + target_path)
                report['meshes'][index] = {'source': source_path, 'asset': target_path, 'state': 'copied', 'triangles': count, 'expected': expected, 'raw': raw}
            report['checked'] = int(index) + 1
            save()
            return True
        except Exception as error:
            report.update(state='failed', error=str(error), finishedAt=time.time())
            session['active'] = False
            save()
            unreal.log_error('Full-detail mesh build failed: ' + str(error))
            return False

    save()
    session['handle'] = unreal.register_ticker_callback(tick, delay=0.02)
    unreal._full_detail_build_session = session
    return session
