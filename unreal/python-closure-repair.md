The macOS arm64 PythonScriptPlugin shipped with Unreal 5.8.2 allocates its closure callable in 40 bytes while inheriting a weak-reference pointer at offset 40 from CPython's 56-byte builtin callable. Python garbage collection can therefore read outside the allocation.

The patch reserves the inherited weak-reference and vectorcall fields, initializes them on allocation and free-list reuse, and clears weak references before deallocation. Compile-time assertions check its layout against the installed Python headers. It preserves the existing call implementation.

Build a separate engine copy on an APFS volume with Xcode installed:

```sh
node unreal/prepare-python-closure.mjs /path/to/UE_5.8 /path/to/UE_5.8-isolated
```

The destination must not exist. The script checks the exact engine version and source/binary fingerprints, makes a copy-on-write clone, applies the small patch, and builds only the engine-scoped PythonScriptPlugin module. The installed engine remains unchanged. A local `python-closure-repair.json` records source, destination, version, build arguments and output hashes. Keep that file with the isolated engine; it contains local paths.

Use the isolated engine executable for verification and rendering. Run `verify-python-closure-runtime.py` with its `-ExecutePythonScript` argument and require normal process exit 0, not merely a success log. On macOS, use `-RenderOffScreen -Unattended -NoSplash -NoLiveCoding -skipminspeccheck` with file logging; do not add `-log`, which creates a console window. Passively monitor activation/windows and stop the owned process if it interrupts the desktop. Unattended crash reporting remains enabled.

Verified locally: actual 56-byte type with weak-reference offset 40; 1,000 generated method calls and weak-reference callbacks; explicit garbage collection; class-default-object lookup; native exit 0. A separate six-frame mirror render also completed with visible reflections, no capture failures, full temporary-actor/ticker cleanup and exit 0. This does not establish that unrelated engine crashes are fixed.

Rollback consists of selecting the unchanged original engine executable. Do not copy the repaired library into the installed engine. Engine upgrades require a new source/layout review; the fingerprint guard deliberately rejects them.
