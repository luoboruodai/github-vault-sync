import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { GitService } from '../src/git';
import { SyncEngine } from '../src/sync-engine';
import { DEFAULT_SETTINGS, SyncSnapshot } from '../src/types';

const exec = promisify(execFile);
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe('initial upload retry', () => {
  it('pushes a local checkpoint to an empty remote instead of fetching a nonexistent branch', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-retry-'));
    roots.push(root);
    const vault = path.join(root, 'vault');
    const remote = path.join(root, 'remote.git');
    await fs.mkdir(vault);
    await exec('git', ['init', '--bare', remote]);
    await fs.writeFile(path.join(vault, 'note.md'), '# offline checkpoint\n');
    await fs.mkdir(path.join(vault, '.obsidian'));
    await fs.writeFile(path.join(vault, '.obsidian', 'app.json'), '{}\n');

    const settings = {
      ...DEFAULT_SETTINGS,
      includeObsidian: false,
      token: '',
      repo: { owner: 'local', name: 'remote', branch: 'main', remoteUrl: remote, private: true }
    };
    const git = new GitService(vault, settings);
    await git.init('main');
    expect(await git.commitWorkingTree('offline checkpoint')).toBe(true);

    const snapshots: SyncSnapshot[] = [];
    const engine = new SyncEngine(vault, settings, async () => undefined, (snapshot) => snapshots.push(snapshot), () => undefined);
    const result = await engine.upload();
    expect(result.ok, result.message).toBe(true);
    expect(snapshots.some((snapshot) => snapshot.phase === 'staging' && snapshot.progress === 100)).toBe(true);
    expect(engine.getSnapshot().progress).toBe(100);
    expect(settings.lastStatus).toBe('synced');
    const tree = (await exec('git', ['--git-dir', remote, 'ls-tree', '-r', '--name-only', 'refs/heads/main'])).stdout;
    expect(tree).toContain('note.md');
    expect(tree).not.toContain('.obsidian/app.json');
  });

  it('compares local edits and remote commits at the file level without uploading', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-diff-'));
    roots.push(root);
    const vault = path.join(root, 'vault');
    const remote = path.join(root, 'remote.git');
    const other = path.join(root, 'other');
    await fs.mkdir(vault);
    await exec('git', ['init', '--bare', remote]);
    await fs.writeFile(path.join(vault, 'note.md'), '# initial\n');
    const settings = {
      ...DEFAULT_SETTINGS,
      includeObsidian: false,
      token: '',
      repo: { owner: 'local', name: 'remote', branch: 'main', remoteUrl: remote, private: true }
    };
    const engine = new SyncEngine(vault, settings, async () => undefined, () => undefined, () => undefined);
    expect((await engine.upload()).ok).toBe(true);

    expect((await engine.checkRemote()).ok).toBe(true);
    expect(engine.getSnapshot().difference?.differingPaths).toBe(0);

    await fs.writeFile(path.join(vault, 'note.md'), '# local edit\n');
    expect((await engine.checkRemote()).ok).toBe(true);
    expect(engine.getSnapshot().difference).toMatchObject({ localChanged: 1, remoteChanged: 0, differingPaths: 1 });

    await exec('git', ['clone', '--branch', 'main', remote, other]);
    await exec('git', ['config', 'user.name', 'Remote Test'], { cwd: other });
    await exec('git', ['config', 'user.email', 'remote@example.invalid'], { cwd: other });
    await fs.writeFile(path.join(other, 'remote.md'), '# remote edit\n');
    await exec('git', ['add', 'remote.md'], { cwd: other });
    await exec('git', ['commit', '-m', 'remote change'], { cwd: other });
    await exec('git', ['push', 'origin', 'main'], { cwd: other });

    expect((await engine.checkRemote()).ok).toBe(true);
    expect(engine.getSnapshot().difference).toMatchObject({ localChanged: 1, remoteChanged: 1, differingPaths: 2 });
    expect(engine.getSnapshot().changedFiles.map((item) => item.path)).toEqual(['note.md', 'remote.md']);
    expect(engine.getSnapshot().health).toBe('remote-changes');
  });

  it('refuses a remote commit containing excluded plugin credentials', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-remote-secret-'));
    roots.push(root);
    const vault = path.join(root, 'vault');
    const remote = path.join(root, 'remote.git');
    const other = path.join(root, 'other');
    await fs.mkdir(vault);
    await exec('git', ['init', '--bare', remote]);
    await fs.writeFile(path.join(vault, 'note.md'), 'safe');
    const settings = { ...DEFAULT_SETTINGS, includeObsidian: true, token: '',
      repo: { owner: 'local', name: 'remote', branch: 'main', remoteUrl: remote, private: true } };
    const engine = new SyncEngine(vault, settings, async () => undefined, () => undefined, () => undefined);
    expect((await engine.upload()).ok).toBe(true);

    await exec('git', ['clone', '--branch', 'main', remote, other]);
    await exec('git', ['config', 'user.name', 'Remote Test'], { cwd: other });
    await exec('git', ['config', 'user.email', 'remote@example.invalid'], { cwd: other });
    await fs.mkdir(path.join(other, '.obsidian', 'plugins', 'demo'), { recursive: true });
    await fs.writeFile(path.join(other, '.obsidian', 'plugins', 'demo', 'data.json'), '{"credential":"x"}\n');
    await exec('git', ['add', '--force', '.obsidian/plugins/demo/data.json'], { cwd: other });
    await exec('git', ['commit', '-m', 'unsafe remote'], { cwd: other });
    await exec('git', ['push', 'origin', 'main'], { cwd: other });

    expect((await engine.checkRemote()).ok).toBe(false);
    expect((await engine.upload()).ok).toBe(false);
    expect(await fs.stat(path.join(vault, 'note.md'))).toBeDefined();
    await expect(fs.stat(path.join(vault, '.obsidian', 'plugins', 'demo', 'data.json'))).rejects.toThrow();
  });

  it('removes earlier broad plugin/theme exclusions while keeping data.json private', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-plugin-include-'));
    roots.push(root);
    const vault = path.join(root, 'vault');
    const remote = path.join(root, 'remote.git');
    const plugin = path.join(vault, '.obsidian', 'plugins', 'demo');
    const embedded = path.join(vault, '.obsidian', 'plugins', 'embedded');
    const theme = path.join(vault, '.obsidian', 'themes', 'Demo');
    await fs.mkdir(plugin, { recursive: true });
    await fs.mkdir(path.join(embedded, '.git'), { recursive: true });
    await fs.mkdir(theme, { recursive: true });
    await exec('git', ['init', '--bare', remote]);
    await fs.writeFile(path.join(vault, 'note.md'), '# note\n');
    await fs.writeFile(path.join(plugin, 'main.js'), 'const password = "example";\n');
    await fs.writeFile(path.join(plugin, 'data.json'), '{"customValue":"private"}\n');
    await fs.writeFile(path.join(embedded, 'main.js'), 'module.exports = {};\n');
    await fs.writeFile(path.join(theme, 'theme.css'), '.task-list {color:red;}\n');
    const settings = { ...DEFAULT_SETTINGS, token: '', includeObsidian: true,
      excludePatterns: [...DEFAULT_SETTINGS.excludePatterns, '.obsidian/plugins/**', '.obsidian/themes/**', '.obsidian/plugins/embedded/**'],
      repo: { owner: 'local', name: 'remote', branch: 'main', remoteUrl: remote, private: true } };
    const engine = new SyncEngine(vault, settings, async () => undefined, () => undefined, () => undefined);
    expect((await engine.upload()).ok).toBe(true);
    settings.excludePatterns = settings.excludePatterns.filter((entry) => entry !== '.obsidian/plugins/**' && entry !== '.obsidian/themes/**');
    expect((await engine.upload()).ok).toBe(true);

    const tree = (await exec('git', ['--git-dir', remote, 'ls-tree', '-r', '--name-only', 'refs/heads/main'])).stdout;
    expect(tree).toContain('.obsidian/plugins/demo/main.js');
    expect(tree).toContain('.obsidian/themes/Demo/theme.css');
    expect(tree).not.toContain('.obsidian/plugins/demo/data.json');
    expect(tree).not.toContain('.obsidian/plugins/embedded/main.js');
    const localExclude = await fs.readFile(path.join(vault, '.git', 'info', 'exclude'), 'utf8');
    expect(localExclude.split('\n')).not.toContain('.obsidian/plugins/**');
    expect(localExclude.split('\n')).not.toContain('.obsidian/themes/**');
    expect(localExclude).toContain('.obsidian/plugins/**/data.json');
    expect(localExclude).toContain('.obsidian/plugins/embedded/');
    const status = (await exec('git', ['status', '--porcelain=v1', '-uall'], { cwd: vault })).stdout;
    expect(status).toBe('');
  });
});
