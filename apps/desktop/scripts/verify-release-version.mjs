import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const read = (root, name) => readFile(path.join(root, name), 'utf8');

export async function verifyReleaseVersion(root, { tag, version: input } = {}) {
  const pkg = JSON.parse(await read(root, 'package.json'));
  const version = pkg.version;
  if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
    throw new Error(`invalid source version: ${String(version)}`);
  }
  if (tag && tag !== `v${version}`) throw new Error(`tag version mismatch: ${tag} != v${version}`);
  if (input && input !== version) throw new Error(`input version mismatch: ${input} != ${version}`);
  await verifySourceVersions(root, version);
  return version;
}

async function verifySourceVersions(root, version) {
  const lock = JSON.parse(await read(root, 'package-lock.json'));
  const tauri = JSON.parse(await read(root, 'src-tauri/tauri.conf.json'));
  const cargo = await read(root, 'src-tauri/Cargo.toml');
  const cargoLock = await read(root, 'src-tauri/Cargo.lock');
  const versions = [
    lock.version, lock.packages?.['']?.version, tauri.version,
    cargo.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m)?.[1],
    cargoLock.match(/^name = "localagentmanager-core"\r?\nversion = "([^"]+)"/m)?.[1],
  ];
  if (versions.some((value) => value !== version)) throw new Error('source version mismatch across package, lock, Tauri and Cargo files');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  try {
    const tag = process.env.GITHUB_REF?.startsWith('refs/tags/') ? process.env.GITHUB_REF_NAME : undefined;
    console.log(await verifyReleaseVersion(root, { tag, version: process.env.RELEASE_VERSION }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
