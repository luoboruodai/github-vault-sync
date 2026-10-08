import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { GitService } from '../src/git';
import { DEFAULT_SETTINGS } from '../src/types';

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('GitService', () => {
  it('initializes the configured branch, commits, and pushes to a local remote', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-git-'));
    temporaryDirectories.push(root);
    const vault = path.join(root, 'vault');
    const remote = path.join(root, 'remote.git');
    await fs.mkdir(vault, { recursive: true });
    await execFileAsync('git', ['init', '--bare', remote]);

    const settings = {
      ...DEFAULT_SETTINGS,
      token: '',
      gitUserName: 'Test Sync',
      gitUserEmail: 'test-sync@example.invalid'
    };
    const service = new GitService(vault, settings);
    await service.init('main');
    await service.setRemote({ owner: 'local', name: 'remote', branch: 'main', remoteUrl: remote, private: true });
    await fs.writeFile(path.join(vault, 'note.md'), '# first\n', 'utf8');
    expect(await service.commitWorkingTree('initial')).toBe(true);
    await service.push('main');

    const remoteHead = (await execFileAsync('git', ['--git-dir', remote, 'rev-parse', 'refs/heads/main'])).stdout.trim();
    expect(remoteHead).toMatch(/^[0-9a-f]{40}$/);

    await service.run(['checkout', '-b', 'temporary']);
    await service.init('main');
    expect(await service.currentBranch()).toBe('main');
  });
});

describe('safe Git staging', () => {
  it('never stages untracked sensitive files even when they are not in git/info/exclude', async () => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-secrets-'));
    temporaryDirectories.push(vault);
    const service = new GitService(vault, { ...DEFAULT_SETTINGS, token: '' });
    await service.init('main');
    await fs.writeFile(path.join(vault, 'note.md'), '# safe note\n');
    await fs.writeFile(path.join(vault, 'private.json'), '{"apiToken":"test-secret"}\n');
    expect(await service.commitWorkingTree('safe only')).toBe(true);
    const tracked = await service.text(['ls-files', '-z']);
    expect(tracked.split('\0').filter(Boolean)).toEqual(['note.md']);
    expect((await service.text(['show', 'HEAD:note.md'])).trim()).toBe('# safe note');
  });

  it('refuses to commit a tracked file after it becomes sensitive', async () => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-tracked-'));
    temporaryDirectories.push(vault);
    const service = new GitService(vault, { ...DEFAULT_SETTINGS, token: '' });
    await service.init('main');
    await fs.writeFile(path.join(vault, 'config.json'), '{"theme":"light"}\n');
    expect(await service.commitWorkingTree('initial')).toBe(true);
    await fs.writeFile(path.join(vault, 'config.json'), '{"apiToken":"test-secret"}\n');
    await expect(service.commitWorkingTree('must fail')).rejects.toThrow('refusing to commit: config.json');
    expect((await service.text(['show', 'HEAD:config.json'])).trim()).toBe('{"theme":"light"}');
  });

  it('does not stage Obsidian settings when the setting is disabled', async () => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-obsidian-'));
    temporaryDirectories.push(vault);
    await fs.mkdir(path.join(vault, '.obsidian'));
    await fs.writeFile(path.join(vault, '.obsidian', 'app.json'), '{"theme":"moonstone"}\n');
    await fs.writeFile(path.join(vault, 'note.md'), '# note\n');
    const service = new GitService(vault, { ...DEFAULT_SETTINGS, token: '', includeObsidian: false });
    await service.init('main');
    expect(await service.commitWorkingTree('initial')).toBe(true);
    expect((await service.text(['ls-files', '-z'])).split('\0').filter(Boolean)).toEqual(['note.md']);
  });

  it('stages deletions without treating removed index entries as missing files', async () => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-delete-'));
    temporaryDirectories.push(vault);
    const service = new GitService(vault, { ...DEFAULT_SETTINGS, token: '' });
    await service.init('main');
    await fs.writeFile(path.join(vault, 'keep.md'), '# keep\n');
    await fs.writeFile(path.join(vault, 'delete.md'), '# delete\n');
    expect(await service.commitWorkingTree('initial')).toBe(true);
    await fs.unlink(path.join(vault, 'delete.md'));
    expect(await service.commitWorkingTree('remove note')).toBe(true);
    expect((await service.text(['ls-tree', '-r', '--name-only', 'HEAD'])).trim()).toBe('keep.md');
  });
});

describe('Git LFS initialization', () => {
  it('installs the pre-push hook in a new repository', async () => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-lfs-'));
    temporaryDirectories.push(vault);
    const service = new GitService(vault, { ...DEFAULT_SETTINGS, token: '' });
    await service.init('main');
    const deps = await service.dependencies();
    if (!deps.gitLfs.available) throw new Error('Git LFS is required for this integration test');
    await service.ensureLfsInitialized();
    const hook = await fs.readFile(path.join(vault, '.git', 'hooks', 'pre-push'), 'utf8');
    expect(hook).toContain('git lfs pre-push');
  });
});

describe('local exclude settings', () => {
  it('removes the stale .obsidian exclusion when configuration sync is enabled', async () => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-exclude-'));
    temporaryDirectories.push(vault);
    const service = new GitService(vault, { ...DEFAULT_SETTINGS, token: '' });
    await service.init('main');
    await service.writeLocalExclude(['.obsidian/', '.obsidian/workspace*.json']);
    await service.writeLocalExclude(['.obsidian/workspace*.json', '.obsidian/plugins/**']);
    const exclude = await fs.readFile(path.join(vault, '.git', 'info', 'exclude'), 'utf8');
    expect(exclude.split(/\r?\n/)).not.toContain('.obsidian/');
    expect(exclude).toContain('.obsidian/plugins/**');
    expect(exclude).toContain('.obsidian/workspace*.json');
  });
});


it('replaces old plugin-managed excludes without deleting user-authored ignore lines', async () => {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-old-rules-'));
  temporaryDirectories.push(vault);
  const service = new GitService(vault, { ...DEFAULT_SETTINGS, token: '' });
  await service.init('main');
  const excludePath = path.join(vault, '.git', 'info', 'exclude');
  await fs.writeFile(excludePath, '# My custom rule\n*.temporary\n.obsidian/plugins/**\n.obsidian/themes/**\n');
  await service.writeLocalExclude(['.obsidian/plugins/**/data.json'], ['.obsidian/plugins/**', '.obsidian/themes/**']);
  const migrated = await fs.readFile(excludePath, 'utf8');
  expect(migrated).toContain('*.temporary');
  expect(migrated).toContain('.obsidian/plugins/**/data.json');
  expect(migrated.split('\n')).not.toContain('.obsidian/plugins/**');
  expect(migrated.split('\n')).not.toContain('.obsidian/themes/**');
  await service.writeLocalExclude(['.obsidian/plugins/**/data.json']);
  expect((await fs.readFile(excludePath, 'utf8')).match(/BEGIN GITHUB VAULT SYNC EXCLUDES/g)).toHaveLength(1);
});
