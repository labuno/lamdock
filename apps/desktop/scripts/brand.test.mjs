import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('application windows use LamDock while retaining the installation identity', async () => {
  const config = JSON.parse(await read('src-tauri/tauri.conf.json'));
  assert.equal(config.productName, 'LamDock');
  assert.equal(config.identifier, 'dev.localagentmanager.desktop');
  assert.equal(config.app.windows.find((window) => window.label === 'main').title, 'LamDock');
  assert.equal(
    config.app.windows.find((window) => window.label === 'quota-popover').title,
    'LamDock Quota',
  );
});

test('startup and main interface identify the application as LamDock', async () => {
  const html = await read('index.html');
  const app = await read('src/App.tsx');
  assert.ok(html.includes('<title>LamDock</title>'));
  assert.ok(html.includes('Loading LamDock...'));
  assert.ok(app.includes('Loading LamDock...'));
  assert.ok(app.includes('<p className="titlebarBrand">LamDock</p>'));
});

test('tray and account/settings copy consistently identify LamDock', async () => {
  const files = [
    'src/components/tray-quota-panel.tsx',
    'src/components/api-account-flow.tsx',
    'src/routes/views.tsx',
    'src-tauri/src/tray.rs',
  ];
  for (const file of files) {
    const body = await read(file);
    assert.match(body, /LamDock/, file);
    assert.doesNotMatch(body, /\bLAM\b/, file);
  }
  assert.ok((await read(files[0])).includes('<h2>LamDock</h2>'));
  const tray = await read(files[3]);
  assert.ok(tray.includes('Open LamDock'));
  assert.ok(tray.includes('LamDock · Codex quota'));
});

test('packaging stages and verifies LamDock.app and preserves sidecar identifiers', async () => {
  const packaging = await read('scripts/package-gateway-components.mjs');
  assert.ok(packaging.includes('macos/LamDock.app'));
  assert.ok(packaging.includes("path.join(staging, 'LamDock.app')"));
  assert.ok(packaging.includes("path.join(mount, 'LamDock.app')"));
  assert.ok(packaging.includes("'LamDock',"));
  assert.doesNotMatch(packaging, /LAM\.app/);
  assert.ok(packaging.includes('process.env.LAM_CODESIGN_IDENTITY'));
  assert.ok(packaging.includes('dev.localagentmanager.provider-gateway'));
});

test('the release acceptance manifest names the current LamDock artifacts', async () => {
  const manifest = JSON.parse(
    await read('src-tauri/tests/fixtures/provider-gateway-g5/manifest.json'),
  );
  assert.deepEqual(manifest.artifacts, ['LamDock.app', 'LamDock_{version}_{architecture}.dmg']);
});

test('desktop and interface share the selected dark master and icon generation source', async () => {
  const master = await readFile(new URL('../src-tauri/icons/lamdock-master.png', import.meta.url));
  assert.equal(master.toString('ascii', 1, 4), 'PNG');
  assert.equal(master.readUInt32BE(16), 1024);
  assert.equal(master.readUInt32BE(20), 1024);
  const interfacePng = await readFile(new URL('../src/assets/lam-orbit-icon.png', import.meta.url));
  assert.deepEqual(interfacePng, master);
  const packageJson = JSON.parse(await read('package.json'));
  assert.equal(
    packageJson.scripts.icons,
    'tauri icon src-tauri/icons/lamdock-master.png -o src-tauri/icons',
  );
  assert.ok((await read('src/components/icons.tsx')).includes('../assets/lam-orbit-icon.png'));
});

test('initial HTML loading screen reuses the selected application PNG', async () => {
  const html = await read('index.html');
  assert.match(html, /src="\/src\/assets\/lam-orbit-icon\.png"/);
  assert.doesNotMatch(html, /<svg/);
});
