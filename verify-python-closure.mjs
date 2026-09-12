import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hashFile, isolatedPaths, prepare, verifyHash, verifyVersion } from './unreal/prepare-python-closure.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'closure-build-'));
try {
  const source = path.join(root, 'engine');
  const output = path.join(root, 'isolated');
  fs.mkdirSync(path.join(source, 'Engine/Build'), { recursive: true });
  const version = { MajorVersion: 5, MinorVersion: 8, PatchVersion: 2, Changelist: 56702186, CompatibleChangelist: 55116800 };
  verifyVersion(version);
  for (const key of Object.keys(version)) assert.throws(() => verifyVersion({ ...version, [key]: version[key] + 1 }), /Unsupported engine/);
  assert.throws(() => isolatedPaths(source, source), /outside/);
  assert.throws(() => isolatedPaths(source, path.join(source, 'clone')), /outside/);
  const alias = path.join(root, 'alias');
  fs.symlinkSync(source, alias);
  assert.throws(() => isolatedPaths(source, path.join(alias, 'clone')), /outside/);
  fs.mkdirSync(output);
  assert.throws(() => isolatedPaths(source, output), /already exists/);
  fs.rmdirSync(output);
  const filename = path.join(source, 'Engine/Build/Build.version');
  fs.writeFileSync(filename, JSON.stringify({ ...version, PatchVersion: 0 }));
  const baseline = hashFile(filename);
  verifyHash(filename, baseline);
  assert.throws(() => prepare(source, output), /Unsupported engine/);
  assert.equal(fs.existsSync(output), false);
  assert.equal(hashFile(filename), baseline);
  fs.appendFileSync(filename, ' ');
  assert.throws(() => verifyHash(filename, baseline), /Fingerprint mismatch/);
  console.log('Isolated plugin build rejects changed versions, input fingerprints, aliases and existing destinations');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
