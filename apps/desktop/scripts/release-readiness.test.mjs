import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { verifyReleaseVersion } from './verify-release-version.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'lam-release-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src-tauri'), { recursive: true });
  const files = {
    'package.json': JSON.stringify({ version: '0.4.4' }),
    'package-lock.json': JSON.stringify({ version: '0.4.4', packages: { '': { version: '0.4.4' } } }),
    'src-tauri/tauri.conf.json': JSON.stringify({ version: '0.4.4' }),
    'src-tauri/Cargo.toml': '[package]\nname = "localagentmanager-core"\nversion = "0.4.4"\n',
    'src-tauri/Cargo.lock': '[[package]]\nname = "localagentmanager-core"\nversion = "0.4.4"\n',
  };
  for (const [name, body] of Object.entries(files)) await writeFile(path.join(root, name), body);
  return { root, files };
}

test('release version validation accepts matching source, tag and input without rewriting files', async (t) => {
  const { root, files } = await fixture(t);
  assert.equal(await verifyReleaseVersion(root, { tag: 'v0.4.4', version: '0.4.4' }), '0.4.4');
  assert.equal(await verifyReleaseVersion(root), '0.4.4');
  for (const [name, body] of Object.entries(files)) assert.equal(await readFile(path.join(root, name), 'utf8'), body);
});

test('rejects tag and input conflicts and invalid package versions', async (t) => {
  const { root } = await fixture(t);
  await assert.rejects(verifyReleaseVersion(root, { tag: 'v0.4.3' }), /tag.*mismatch/);
  await assert.rejects(verifyReleaseVersion(root, { tag: '0.4.4' }), /tag.*mismatch/);
  await assert.rejects(verifyReleaseVersion(root, { version: '0.4.5' }), /input.*mismatch/);
  await writeFile(path.join(root, 'package.json'), '{}');
  await assert.rejects(verifyReleaseVersion(root), /invalid.*version/);
});

for (const file of ['package-lock.json', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock']) {
  test(`rejects inconsistent ${file}`, async (t) => {
    const { root, files } = await fixture(t);
    await writeFile(path.join(root, file), files[file].replaceAll('0.4.4', '0.4.3'));
    await assert.rejects(verifyReleaseVersion(root), /version mismatch/);
  });
}

test('propagates missing source file errors', async (t) => {
  const { root } = await fixture(t);
  await rm(path.join(root, 'src-tauri/Cargo.toml'));
  await assert.rejects(verifyReleaseVersion(root), { code: 'ENOENT' });
});

async function runCheck(t, fail = '') {
  const { root } = await fixture(t);
  await mkdir(path.join(root, 'apps/desktop/node_modules'), { recursive: true });
  await mkdir(path.join(root, 'apps/desktop/src-tauri'), { recursive: true });
  await writeFile(path.join(root, 'Makefile'), await readFile(new URL('../../../Makefile', import.meta.url)));
  for (const tool of ['npm', 'cargo']) {
    await writeFile(path.join(root, tool), `#!/bin/sh\nprintf '%s\\n' '${tool} '"$*" >> "$CHECK_LOG"\n[ '${tool} '"$*" != "$FAIL_CHECK" ]\n`, { mode: 0o755 });
  }
  const log = path.join(root, 'commands.log');
  const result = spawnSync('make', ['check', `NPM=${root}/npm`, `CARGO=${root}/cargo`], {
    cwd: root, encoding: 'utf8', env: { ...process.env, CHECK_LOG: log, FAIL_CHECK: fail },
  });
  return { result, commands: (await readFile(log, 'utf8')).trim().split('\n') };
}

test('shared check covers frontend behavior, lint, build, scripts, UI smoke and Rust gates', async (t) => {
  const { result, commands } = await runCheck(t);
  assert.equal(result.status, 0, result.stderr);
  for (const command of ['npm run build', 'npm test -- --maxWorkers=2', 'npm run lint', 'npm run test:scripts', 'npm run test:ui', 'cargo fmt -- --check', 'cargo clippy -- -D warnings', 'cargo test -j 2']) {
    assert.ok(commands.includes(command), `missing check: ${command}\n${commands.join('\n')}`);
  }
});

test('a failed behavior check stops subsequent checks', async (t) => {
  const { result, commands } = await runCheck(t, 'npm test -- --maxWorkers=2');
  assert.notEqual(result.status, 0);
  assert.equal(commands.at(-1), 'npm test -- --maxWorkers=2');
  assert.ok(!commands.some((command) => command.startsWith('cargo test')));
});

test('CI and Release use shared checks; only matching tags can publish', async () => {
  const readWorkflow = (name) => readFile(new URL(`../../../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
  const ci = await readWorkflow('ci');
  const release = await readWorkflow('release');
  assert.match(ci, /run: make check/);
  assert.match(release, /run: make check/);
  assert.ok(release.indexOf('run: make check') < release.indexOf('run: make dmg'));
  assert.doesNotMatch(release, /make dmg VERSION=/);
  assert.match(release, /verify-release-version\.mjs/);
  assert.match(release, /if: startsWith\(github.ref, 'refs\/tags\/v'\)/);
});
