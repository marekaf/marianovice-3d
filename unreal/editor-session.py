import hashlib
import json
from pathlib import Path
import time
import traceback
import unreal

ROOT = Path(__file__).resolve().parent
TASK = ROOT / 'generated' / 'editor-task.py'
RESULT = ROOT / 'generated' / 'editor-result.json'
last_digest = None
last_check = 0
busy = False

unreal.EditorPythonScripting.set_keep_python_script_alive(True)


def tick(delta):
    global last_digest, last_check, busy
    if busy or time.monotonic() - last_check < .5:
        return
    last_check = time.monotonic()
    if not TASK.exists():
        return
    source = TASK.read_text()
    digest = hashlib.sha256(source.encode()).hexdigest()
    if digest == last_digest:
        return
    last_digest = digest
    report = {'digest': digest, 'status': 'running'}
    RESULT.write_text(json.dumps(report))
    busy = True
    try:
        context = {'__file__': str(TASK), '__name__': '__main__', 'unreal': unreal}
        exec(compile(source, str(TASK), 'exec'), context)
        report.update(status='complete', result=context.get('result'))
    except Exception:
        report.update(status='error', error=traceback.format_exc())
        unreal.log_error(report['error'])
    finally:
        busy = False
    RESULT.write_text(json.dumps(report, indent=2, default=str))


handle = unreal.register_slate_post_tick_callback(tick)
unreal.log('Local walkthrough editor session ready')
