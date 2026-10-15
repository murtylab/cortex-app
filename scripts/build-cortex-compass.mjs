#!/usr/bin/env node
/** Build the pinned Compass checkout; never fetch or update its Git revision. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const COMPASS_BASE = '/infoviz/';
const CHECKOUT_HELP = 'Run git submodule update --init --recursive from cortex-app.';

export function compassBuildPaths(projectRoot = PROJECT_ROOT) {
  const root = path.resolve(projectRoot);
  const checkout = path.join(root, 'apps', 'cortex-compass');
  return {
    root,
    checkout,
    output: path.join(root, 'dist', 'infoviz'),
    packageJson: path.join(checkout, 'package.json'),
    lockfile: path.join(checkout, 'package-lock.json'),
    dependencyStamp: path.join(checkout, 'node_modules', '.cortex-compass-lock.sha256'),
    buildTools: ['vite', 'tsc'].map((tool) => path.join(checkout, 'node_modules', '.bin', tool)),
  };
}

function validateCheckout(paths) {
  for (const relative of ['package.json', 'package-lock.json', 'vite.config.ts', 'index.html', 'public/data/reference_manifest.json']) {
    if (!fs.existsSync(path.join(paths.checkout, relative))) {
      throw new Error(`Cortex-Compass submodule is missing or incomplete at apps/cortex-compass. ${CHECKOUT_HELP}`);
    }
  }
  const metadata = JSON.parse(fs.readFileSync(paths.packageJson, 'utf8'));
  if (typeof metadata.scripts?.build !== 'string' || typeof metadata.scripts?.dev !== 'string') {
    throw new Error('Cortex-Compass must provide its reviewed npm build and dev scripts.');
  }
}

function validateOutput(paths) {
  const relative = path.relative(path.join(paths.root, 'dist'), paths.output);
  if (relative !== 'infoviz') throw new Error('Cortex-Compass output must remain inside cortex-app/dist/infoviz.');
  // Vite empties its output directory. Do not follow a locally substituted
  // output symlink into another project's files.
  for (const directory of [path.dirname(paths.output), paths.output]) {
    if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) {
      throw new Error('Cortex-Compass build output cannot be a symbolic link.');
    }
  }
}

function dependencyFingerprint(paths) {
  return createHash('sha256')
    .update(fs.readFileSync(paths.packageJson))
    .update('\0')
    .update(fs.readFileSync(paths.lockfile))
    .digest('hex');
}

/** Default mode builds only Compass; --all also builds the Cortex host first. */
export function runCompassBuild({
  projectRoot = PROJECT_ROOT,
  mode = 'build',
  runner = spawnSync,
  environment = process.env,
} = {}) {
  if (!['build', 'all', 'dev'].includes(mode)) throw new Error(`Unknown Cortex-Compass build mode: ${mode}`);
  const paths = compassBuildPaths(projectRoot);
  validateCheckout(paths);
  validateOutput(paths);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const env = { ...environment, VITE_INFOVIZ_BASE_PATH: COMPASS_BASE };
  if (mode === 'dev') {
    // Share only the host's backend proxy setting, not its dotenv files or
    // unrelated local secrets, when running the pinned child directly.
    const proxyTarget = environment.CORTEX_CORE_PROXY_TARGET
      || loadEnv('development', paths.root, 'CORTEX_CORE_PROXY_TARGET').CORTEX_CORE_PROXY_TARGET;
    if (proxyTarget) env.CORTEX_CORE_PROXY_TARGET = proxyTarget;
  }
  const run = (args, cwd) => {
    const result = runner(npm, args, { cwd, env, stdio: 'inherit' });
    if (result.error) throw new Error(`Could not run npm ${args.join(' ')}: ${result.error.message}`);
    if (result.status !== 0) {
      throw new Error(`npm ${args.join(' ')} failed (${result.signal || `exit ${result.status ?? 1}`}).`);
    }
  };

  const fingerprint = dependencyFingerprint(paths);
  const stamp = fs.existsSync(paths.dependencyStamp) ? fs.readFileSync(paths.dependencyStamp, 'utf8').trim() : '';
  if (stamp !== fingerprint || paths.buildTools.some((tool) => !fs.existsSync(tool))) {
    run(['ci', '--include=dev', '--no-audit', '--no-fund'], paths.checkout);
    if (paths.buildTools.some((tool) => !fs.existsSync(tool))) {
      throw new Error('Cortex-Compass dependency installation did not provide Vite and TypeScript.');
    }
    fs.writeFileSync(paths.dependencyStamp, `${fingerprint}\n`, 'utf8');
  }

  if (mode === 'dev') {
    run(['run', 'dev', '--', '--base', COMPASS_BASE], paths.checkout);
    return paths;
  }
  if (mode === 'all') run(['run', 'build:site'], paths.root);
  // Only Vite's bundled output and public/ assets are published. Never copy the
  // checkout wholesale: it can contain private artifacts or temporary sessions.
  run(['run', 'build', '--', '--base', COMPASS_BASE, '--outDir', paths.output, '--emptyOutDir'], paths.checkout);
  if (!fs.existsSync(path.join(paths.output, 'index.html'))
    || !fs.existsSync(path.join(paths.output, 'data', 'reference_manifest.json'))) {
    throw new Error('Cortex-Compass build is incomplete: expected compiled HTML and public reference assets.');
  }
  return paths;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.some((arg) => !['--all', '--dev'].includes(arg))) {
      throw new Error('Usage: node scripts/build-cortex-compass.mjs [--all|--dev]');
    }
    runCompassBuild({ mode: args[0] === '--all' ? 'all' : args[0] === '--dev' ? 'dev' : 'build' });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
