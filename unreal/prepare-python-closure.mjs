import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const plugin = 'Engine/Plugins/Experimental/PythonScriptPlugin/';
const fingerprints = {
  'Source/PythonScriptPlugin/Private/PyMethodWithClosure.h': ['16b4a77767b0eb498a4a9f167ac333d7fda67389821b2c395ddbf2e32be69cef', 'fb3b9eebb75b2eb8c2dbe0ce01188e10c24c808ce4f25db1a055158554ec40a4'],
  'Source/PythonScriptPlugin/Private/PyMethodWithClosure.cpp': ['f7981cf487e78833c034d633ae3d37b42bcf6aaae82233f45ff903aa1c98eb19', '1875e20fec8f7ac937b0ed92f8f5a3c46657c3d3808c0e663e83b861da06073e'],
  'Binaries/Mac/libUnrealEditor-PythonScriptPlugin.dylib': ['67acb4e655648dae10154e45bedfdab158ff7fd0df1103d19ca7ee8962970cc9'],
};

export function hashFile(filename) {
  return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

export function verifyVersion(version) {
  const expected = { MajorVersion: 5, MinorVersion: 8, PatchVersion: 2, Changelist: 56702186, CompatibleChangelist: 55116800 };
  for (const [key, value] of Object.entries(expected)) {
    if (version[key] !== value) throw new Error(`Unsupported engine ${key}: ${version[key]}`);
  }
}

export function verifyHash(filename, expected) {
  if (hashFile(filename) !== expected) throw new Error(`Fingerprint mismatch: ${filename}`);
}

export function isolatedPaths(source, destination) {
  source = fs.realpathSync(source);
  destination = path.join(fs.realpathSync(path.dirname(path.resolve(destination))), path.basename(destination));
  if (destination === source || destination.startsWith(source + path.sep)) throw new Error('Destination must be outside the source engine');
  if (fs.existsSync(destination)) throw new Error('Destination already exists; use a new isolated path');
  return { source, destination };
}

export function prepare(source, destination) {
  ({ source, destination } = isolatedPaths(source, destination));
  const version = JSON.parse(fs.readFileSync(path.join(source, 'Engine/Build/Build.version')));
  verifyVersion(version);
  for (const [file, [original]] of Object.entries(fingerprints)) verifyHash(path.join(source, plugin, file), original);
  if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('This build procedure requires macOS arm64');
  execFileSync('cp', ['-cR', source, destination], { stdio: 'inherit' });
  const patch = fileURLToPath(new URL('./patches/python-closure-layout.patch', import.meta.url));
  execFileSync('git', ['apply', '--check', patch], { cwd: destination, stdio: 'inherit' });
  execFileSync('git', ['apply', patch], { cwd: destination, stdio: 'inherit' });
  for (const [file, [, repaired]] of Object.entries(fingerprints)) {
    if (repaired) verifyHash(path.join(destination, plugin, file), repaired);
  }
  const args = ['UnrealEditor', 'Mac', 'Development', '-architecture=arm64', '-Module=PythonScriptPlugin',
    '-Plugin=' + path.join(destination, plugin, 'PythonScriptPlugin.uplugin'), '-NoHotReload'];
  execFileSync(path.join(destination, 'Engine/Build/BatchFiles/Mac/Build.sh'), args, { stdio: 'inherit' });
  for (const [file, [original]] of Object.entries(fingerprints)) verifyHash(path.join(source, plugin, file), original);
  const manifest = { version, source, destination, buildArguments: args,
    files: Object.fromEntries(Object.keys(fingerprints).map(file => [file, hashFile(path.join(destination, plugin, file))])) };
  fs.writeFileSync(path.join(destination, 'python-closure-repair.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Usage: node prepare-python-closure.mjs SOURCE_ENGINE NEW_ISOLATED_ENGINE');
  const result = prepare(process.argv[2], process.argv[3]);
  console.log(`Built isolated PythonScriptPlugin: ${result.destination}`);
}
