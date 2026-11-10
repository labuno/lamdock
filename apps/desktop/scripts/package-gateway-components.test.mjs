import assert from 'node:assert/strict';
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('tauri development prepares every Codex runtime component', async () => {
  const packageJson = JSON.parse(await readFile(path.join(desktopRoot, 'package.json'), 'utf8'));
  const script = await readFile(
    path.join(desktopRoot, 'scripts/package-gateway-components.mjs'),
    'utf8',
  );

  assert.match(packageJson.scripts['tauri:dev'], /package-gateway-components\.mjs dev/);
  assert.match(script, /async function prepareDev\(\)/);
  for (const binary of ['lam', 'lam-provider-gateway', 'lam-auth-helper']) {
    assert.match(script, new RegExp(`'--bin',\\s*'${binary}'`));
  }
});

test('app builds and DMG builds have separate command contracts', async () => {
  const packageJson = JSON.parse(await readFile(path.join(desktopRoot, 'package.json'), 'utf8'));
  const makefile = await readFile(path.join(desktopRoot, '..', '..', 'Makefile'), 'utf8');

  assert.doesNotMatch(packageJson.scripts['tauri:build'], /package:gateway-dmg/);
  assert.match(packageJson.scripts['tauri:dmg'], /npm run tauri:build/);
  assert.match(packageJson.scripts['tauri:dmg'], /package:gateway-dmg/);
  assert.doesNotMatch(makefile, /^build dmg:/m);
  assert.match(makefile, /^build:.*\n(?:.*\n)*?\tcd .* run tauri:build$/m);
  assert.match(makefile, /^dmg:.*\n(?:.*\n)*?\tcd .* run tauri:dmg$/m);
});

async function bundleFixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'lam-bundle-contract-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const contents = path.join(root, 'src-tauri/target/release/bundle/macos/LamDock.app/Contents');
  await mkdir(path.join(contents, 'MacOS'), { recursive: true });
  await mkdir(path.join(contents, 'Resources'), { recursive: true });
  await mkdir(path.join(root, 'scripts'));
  for (const name of ['package-gateway-components.mjs', 'release-metadata.mjs']) {
    await copyFile(path.join(desktopRoot, 'scripts', name), path.join(root, 'scripts', name));
  }
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '0.4.4' }));
  await writeFile(path.join(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>dev.localagentmanager.packaging-test</string>
<key>CFBundleExecutable</key><string>localagentmanager</string>
<key>CFBundlePackageType</key><string>APPL</string>
</dict></plist>`);
  for (const name of ['localagentmanager', 'lam', 'lam-provider-gateway', 'lam-auth-helper', 'lam-core']) {
    await copyFile('/usr/bin/true', path.join(contents, 'MacOS', name));
  }
  await writeFile(path.join(contents, 'Resources/interface.txt'), 'unchanged UI asset');
  return { root, contents, app: path.dirname(contents) };
}

function runPackaging(root, mode) {
  return spawnSync(process.execPath, [path.join(root, 'scripts/package-gateway-components.mjs'), mode], {
    encoding: 'utf8', env: { ...process.env, LAM_CODESIGN_IDENTITY: '' },
  });
}

const macOnly = { skip: process.platform !== 'darwin' };

test('finalization excludes only lam-core and preserves runtime components and UI assets', macOnly, async (t) => {
  const { root, contents } = await bundleFixture(t);
  const result = runPackaging(root, 'finalize');
  assert.equal(result.status, 0, result.stderr);
  await assert.rejects(access(path.join(contents, 'MacOS/lam-core')), { code: 'ENOENT' });
  await access(path.join(contents, 'MacOS/localagentmanager'));
  assert.equal(await readFile(path.join(contents, 'Resources/interface.txt'), 'utf8'), 'unchanged UI asset');
  const manifest = JSON.parse(await readFile(path.join(contents, 'Resources/provider-gateway-install-manifest.json'), 'utf8'));
  assert.deepEqual(manifest.components.map((component) => component.name), ['launcher', 'gateway', 'auth-helper']);
  for (const component of manifest.components) {
    const bytes = await readFile(path.join(contents, component.relativePath));
    assert.equal(component.sha256, createHash('sha256').update(bytes).digest('hex'));
  }
  const repeated = runPackaging(root, 'finalize');
  assert.equal(repeated.status, 0, repeated.stderr);
  await assert.rejects(access(path.join(contents, 'MacOS/lam-core')), { code: 'ENOENT' });
});

test('finalization fails when a required runtime component is missing', macOnly, async (t) => {
  const { root, contents } = await bundleFixture(t);
  await rm(path.join(contents, 'MacOS/lam-auth-helper'));
  const result = runPackaging(root, 'finalize');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /codesign failed/);
});

test('DMG creation rejects a signed app containing lam-core before staging', macOnly, async (t) => {
  const { root, contents, app } = await bundleFixture(t);
  const finalized = runPackaging(root, 'finalize');
  assert.equal(finalized.status, 0, finalized.stderr);
  await copyFile('/usr/bin/true', path.join(contents, 'MacOS/lam-core'));
  const signed = spawnSync('/usr/bin/codesign', ['--force', '--sign', '-', app], { encoding: 'utf8' });
  assert.equal(signed.status, 0, signed.stderr);
  const result = runPackaging(root, 'dmg');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /development binary lam-core must not be bundled/);
  await assert.rejects(access(path.join(root, 'src-tauri/target/release/bundle/gateway-dmg-staging')), { code: 'ENOENT' });
});
