import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compassBuildPaths, runCompassBuild } from '../../../scripts/build-cortex-compass.mjs';

const directories = [];
beforeEach(() => { vi.stubEnv('CORTEX_CORE_PROXY_TARGET', undefined); });
afterEach(() => {
  directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }));
  vi.unstubAllEnvs();
});

function fixture({ dependencies = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-compass-build-test-'));
  directories.push(root);
  const paths = compassBuildPaths(root);
  const write = (relative, content = '') => {
    const filename = path.join(paths.checkout, relative);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, content);
  };
  write('package.json', JSON.stringify({ scripts: { build: 'tsc -b && vite build', dev: 'vite' } }));
  write('package-lock.json', '{"lockfileVersion":3}');
  write('vite.config.ts');
  write('index.html', '<div id="root"></div>');
  write('public/data/reference_manifest.json', '{"schema_version":1}');
  write('public/images/example.png', 'public-image');
  write('public/data/brain/surface.glb', 'public-brain');
  write('artifacts/reference/private.npz', 'private-reference');
  write('.env.local', 'PRIVATE_NOT_FOR_DEPLOYMENT=true');
  write('src/private-source.ts', 'source-not-copied');
  const install = () => {
    paths.buildTools.forEach((filename) => {
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, 'installed');
    });
    const fingerprint = createHash('sha256')
      .update(fs.readFileSync(paths.packageJson)).update('\0')
      .update(fs.readFileSync(paths.lockfile)).digest('hex');
    fs.writeFileSync(paths.dependencyStamp, `${fingerprint}\n`);
  };
  if (dependencies) install();
  const runner = vi.fn((_command, args) => {
    if (args[0] === 'ci') install();
    if (args[0] === 'run' && args[1] === 'build') {
      fs.mkdirSync(paths.output, { recursive: true });
      fs.writeFileSync(path.join(paths.output, 'index.html'), '<script src="/infoviz/assets/compiled.js"></script>');
      fs.cpSync(path.join(paths.checkout, 'public'), paths.output, { recursive: true });
    }
    return { status: 0 };
  });
  return { root, paths, runner, install, write };
}

describe('pinned Cortex-Compass build integration', () => {
  it('runs the combined build from npm while keeping standalone site/Compass and dev commands', () => {
    const metadata = JSON.parse(fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
    expect(metadata.scripts.build).toBe('node scripts/build-cortex-compass.mjs --all');
    expect(metadata.scripts['build:site']).toBe('vite build');
    expect(metadata.scripts['build:compass']).toBe('node scripts/build-cortex-compass.mjs');
    expect(metadata.scripts['dev:compass']).toBe('node scripts/build-cortex-compass.mjs --dev');
    expect(metadata.scripts).not.toHaveProperty('postinstall');
  });

  it('gives an actionable missing-submodule error before installing or building anything', () => {
    const item = fixture();
    fs.rmSync(item.paths.checkout, { recursive: true, force: true });
    expect(() => runCompassBuild({ projectRoot: item.root, mode: 'all', runner: item.runner }))
      .toThrow(/git submodule update --init --recursive/);
    expect(item.runner).not.toHaveBeenCalled();
  });

  it('rejects incomplete checkout metadata before building the host', () => {
    const item = fixture();
    fs.unlinkSync(item.paths.lockfile);
    expect(() => runCompassBuild({ projectRoot: item.root, mode: 'all', runner: item.runner }))
      .toThrow(/missing or incomplete/);
    expect(item.runner).not.toHaveBeenCalled();
  });

  it('builds the host before Compass and fixes the child output/base independently of environment', () => {
    const item = fixture();
    const result = runCompassBuild({ projectRoot: item.root, mode: 'all', runner: item.runner,
      environment: { VITE_INFOVIZ_BASE_PATH: '/', VITE_CORTEX_CORE_URL: '/research-core' } });
    expect(item.runner.mock.calls.map(([, args]) => args)).toEqual([
      ['run', 'build:site'],
      ['run', 'build', '--', '--base', '/infoviz/', '--outDir', item.paths.output, '--emptyOutDir'],
    ]);
    expect(item.runner.mock.calls.map(([, , options]) => options.cwd))
      .toEqual([item.root, item.paths.checkout]);
    expect(item.runner.mock.calls.every(([, , options]) => options.env.VITE_INFOVIZ_BASE_PATH === '/infoviz/')).toBe(true);
    expect(item.runner.mock.calls[1][2].env.VITE_CORTEX_CORE_URL).toBe('/research-core');
    expect(path.relative(path.join(item.root, 'dist'), result.output)).toBe('infoviz');
    expect(item.runner.mock.calls.every(([command]) => ['npm', 'npm.cmd'].includes(command))).toBe(true);
  });

  it('publishes public images, brain and reference assets without copying source or private artifacts', () => {
    const item = fixture();
    runCompassBuild({ projectRoot: item.root, runner: item.runner });
    for (const [relative, expected] of [['images/example.png', 'public-image'], ['data/brain/surface.glb', 'public-brain'],
      ['data/reference_manifest.json', '{"schema_version":1}']]) {
      expect(fs.readFileSync(path.join(item.paths.output, relative), 'utf8')).toBe(expected);
    }
    for (const relative of ['artifacts', 'src', 'node_modules', '.env.local', '.git', 'comparison_sessions', 'checkpoints']) {
      expect(fs.existsSync(path.join(item.paths.output, relative))).toBe(false);
    }
  });

  it('uses lockfile-pinned npm ci with development build tools for a fresh checkout', () => {
    const item = fixture({ dependencies: false });
    runCompassBuild({ projectRoot: item.root, mode: 'all', runner: item.runner });
    expect(item.runner.mock.calls[0][1]).toEqual(['ci', '--include=dev', '--no-audit', '--no-fund']);
    expect(item.runner.mock.calls[0][2].cwd).toBe(item.paths.checkout);
    expect(fs.existsSync(item.paths.dependencyStamp)).toBe(true);
    item.runner.mockClear();
    runCompassBuild({ projectRoot: item.root, runner: item.runner });
    expect(item.runner).toHaveBeenCalledTimes(1);
  });

  it.each(['lockfile', 'packageJson', 'dependencyStamp', 'buildTool'])('reinstalls when %s changes or is missing', (change) => {
    const item = fixture();
    if (change === 'lockfile') fs.appendFileSync(item.paths.lockfile, '\n');
    if (change === 'packageJson') fs.appendFileSync(item.paths.packageJson, '\n');
    if (change === 'dependencyStamp') fs.unlinkSync(item.paths.dependencyStamp);
    if (change === 'buildTool') fs.unlinkSync(item.paths.buildTools[0]);
    runCompassBuild({ projectRoot: item.root, runner: item.runner });
    expect(item.runner.mock.calls[0][1][0]).toBe('ci');
  });

  it('propagates failed dependency installation without starting either build', () => {
    const item = fixture({ dependencies: false });
    item.runner.mockReturnValue({ status: 1 });
    expect(() => runCompassBuild({ projectRoot: item.root, mode: 'all', runner: item.runner })).toThrow(/npm ci.*failed/);
    expect(item.runner).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(item.paths.dependencyStamp)).toBe(false);
  });

  it('does not start the child build when the parent fails', () => {
    const item = fixture();
    item.runner.mockReturnValue({ status: 1 });
    expect(() => runCompassBuild({ projectRoot: item.root, mode: 'all', runner: item.runner })).toThrow(/build:site failed/);
    expect(item.runner).toHaveBeenCalledTimes(1);
  });

  it('propagates child failure instead of reporting the parent-only output as success', () => {
    const item = fixture();
    item.runner.mockImplementation((_command, args) => ({ status: args[1] === 'build' ? 2 : 0 }));
    expect(() => runCompassBuild({ projectRoot: item.root, mode: 'all', runner: item.runner })).toThrow(/exit 2/);
    expect(item.runner).toHaveBeenCalledTimes(2);
  });

  it('rejects an incomplete child result even when the subprocess reports success', () => {
    const item = fixture();
    item.runner.mockReturnValue({ status: 0 });
    expect(() => runCompassBuild({ projectRoot: item.root, runner: item.runner })).toThrow(/build is incomplete/);
  });

  it.each(['dist', 'dist/infoviz'])('refuses symlinked output %s before npm can empty it', (relative) => {
    const item = fixture();
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-compass-output-target-'));
    directories.push(target);
    const link = path.join(item.root, relative);
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(target, link, 'dir');
    expect(() => runCompassBuild({ projectRoot: item.root, runner: item.runner })).toThrow(/symbolic link/);
    expect(item.runner).not.toHaveBeenCalled();
  });

  it('starts the same pinned child in development without running builds', () => {
    const item = fixture();
    runCompassBuild({ projectRoot: item.root, mode: 'dev', runner: item.runner });
    expect(item.runner).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/^npm(?:\.cmd)?$/),
      ['run', 'dev', '--', '--base', '/infoviz/'], expect.objectContaining({ cwd: item.paths.checkout }));
    expect(fs.existsSync(item.paths.output)).toBe(false);
  });

  it('forwards only the parent dotenv backend proxy setting to the child development server', () => {
    const item = fixture();
    fs.writeFileSync(path.join(item.root, '.env.local'),
      'CORTEX_CORE_PROXY_TARGET=http://127.0.0.1:5558\nPRIVATE_BUILD_TEST=not-forwarded\n');
    runCompassBuild({ projectRoot: item.root, mode: 'dev', runner: item.runner, environment: {} });
    expect(item.runner.mock.calls[0][2].env).toEqual({
      VITE_INFOVIZ_BASE_PATH: '/infoviz/', CORTEX_CORE_PROXY_TARGET: 'http://127.0.0.1:5558',
    });
    expect(fs.existsSync(path.join(item.paths.checkout, '.env'))).toBe(false);
  });

  it('prefers an explicit development proxy environment over the parent dotenv value', () => {
    const item = fixture();
    fs.writeFileSync(path.join(item.root, '.env.local'), 'CORTEX_CORE_PROXY_TARGET=http://127.0.0.1:5558\n');
    runCompassBuild({ projectRoot: item.root, mode: 'dev', runner: item.runner,
      environment: { CORTEX_CORE_PROXY_TARGET: 'http://127.0.0.1:5560' } });
    expect(item.runner.mock.calls[0][2].env.CORTEX_CORE_PROXY_TARGET).toBe('http://127.0.0.1:5560');
  });
});
