import json
from pathlib import Path


def export_geometry(report_path, output_path):
    import unreal

    report = json.loads(Path(report_path).read_text())
    if report['state'] != 'complete':
        raise RuntimeError('Finish the full-detail mesh build before extracting geometry')
    if getattr(unreal, '_full_detail_build_session', {}).get('active'):
        raise RuntimeError('The mesh builder is still active')
    entries = []
    for index, record in report['meshes'].items():
        mesh = unreal.EditorAssetLibrary.load_asset(record['asset'])
        if mesh is None:
            raise RuntimeError('Missing built mesh: ' + record['asset'])
        sections = []
        for section in range(mesh.get_num_sections(0)):
            vertices, triangles, normals, uvs, tangents = unreal.ProceduralMeshLibrary.get_section_from_static_mesh(mesh, 0, section)
            sections.append({'vertices': [(vertex.x, vertex.y, vertex.z) for vertex in vertices], 'indices': list(triangles)})
        entries.append({'meshIndex': int(index), 'asset': record['asset'], 'sections': sections})
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(entries))
    return {'meshes': len(entries), 'output': str(output), 'bytes': output.stat().st_size}
