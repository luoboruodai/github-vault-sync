import { cleanFixtureRoots } from './fixture-cleanup';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { SyncEngine } from '../src/sync-engine';
import { DEFAULT_SETTINGS, RepoBinding } from '../src/types';

const exec = promisify(execFile);
const cleanup: string[] = [];
afterEach(async () => { await cleanFixtureRoots(cleanup); });

async function fixture(conflictingFolder = false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gvs-migration-'));
  cleanup.push(root);
  const vault = path.join(root, 'new-vault');
  const remote = path.join(root, 'remote.git');
  const seed = path.join(root, 'old-vault');
  await fs.mkdir(path.join(vault, 'Notes'), { recursive: true });
  await fs.mkdir(path.join(vault, 'Different'), { recursive: true });
  await fs.mkdir(path.join(vault, '.obsidian'), { recursive: true });
  await fs.mkdir(path.join(seed, 'Notes'), { recursive: true });
  await fs.mkdir(path.join(seed, 'Archive'), { recursive: true });
  await fs.mkdir(path.join(seed, '.obsidian'), { recursive: true });
  await exec('git', ['init', '--bare', remote]);
  await exec('git', ['init', '-b', 'main'], { cwd: seed });
  await exec('git', ['config', 'user.name', 'Old Device'], { cwd: seed });
  await exec('git', ['config', 'user.email', 'old@example.invalid'], { cwd: seed });
  await fs.writeFile(path.join(vault, 'Notes/same.md'), '# identical\n');
  await fs.writeFile(path.join(vault, 'Notes/conflict.md'), '# new device\n');
  await fs.writeFile(path.join(vault, 'Different/duplicate.md'), '# local title\n');
  await fs.writeFile(path.join(vault, '.obsidian/app.json'), '{"theme":"new"}\n');
  await fs.writeFile(path.join(seed, 'Notes/same.md'), '# identical\n');
  await fs.writeFile(path.join(seed, 'Notes/conflict.md'), '# old device\n');
  await fs.writeFile(path.join(seed, 'Archive/duplicate.md'), '# remote title\n');
  await fs.writeFile(path.join(seed, '.obsidian/app.json'), '{"theme":"old"}\n');
  if (conflictingFolder) {
    await fs.writeFile(path.join(vault, 'Archive'), 'file rather than remote folder');
  }
  await exec('git', ['add', '--all'], { cwd: seed });
  await exec('git', ['commit', '-m', 'old vault'], { cwd: seed });
  await exec('git', ['remote', 'add', 'origin', remote], { cwd: seed });
  await exec('git', ['push', 'origin', 'main'], { cwd: seed });
  const binding: RepoBinding = { owner: 'local', name: 'remote', branch: 'main', remoteUrl: remote, private: true };
  const settings = { ...DEFAULT_SETTINGS, includeObsidian: true, repo: null };
  const engine = new SyncEngine(vault, settings, async () => undefined, () => undefined, () => undefined);
  return { root, vault, remote, engine, binding, settings };
}

describe('different Vault generations with unrelated histories', () => {
  it('inspects content and names, clones a separate copy without changing the local notes', async () => {
    const { root, vault, engine, binding } = await fixture();
    const before = await fs.readFile(path.join(vault, 'Notes/conflict.md'), 'utf8');
    const preview = await engine.inspectInitialBinding(binding);
    expect(preview.differingMarkdown).toEqual(['Notes/conflict.md']);
    expect(preview.identicalMarkdown).toBe(1);
    expect(preview.differingConfig).toBe(1);
    expect(preview.sameNameDifferentFolder).toContainEqual({
      name: 'duplicate.md', local: 'Different/duplicate.md', remote: 'Archive/duplicate.md'
    });
    expect(preview.structuralConflicts).toEqual([]);
    expect(await fs.readFile(path.join(vault, 'Notes/conflict.md'), 'utf8')).toBe(before);
    const copied = await engine.cloneRemoteAsSeparateVault(binding, preview.remoteSha!);
    expect(copied.ok, copied.message).toBe(true);
    expect(await fs.readFile(path.join(vault, 'Notes/conflict.md'), 'utf8')).toBe(before);
    const copyDir = (await fs.readdir(root)).find((name) => name.startsWith('new-vault-GitHub-copy-'));
    expect(copyDir).toBeDefined();
    // Windows Git commonly checks Markdown out as CRLF (core.autocrlf);
    // this copy's note content must be the same regardless of checkout EOL.
    expect((await fs.readFile(path.join(root, copyDir!, 'Notes/conflict.md'), 'utf8')).replace(/\r\n/g, '\n'))
      .toBe('# old device\n');
  });

  it('merges unique files and flags only differing same-path notes or config, not equal notes', async () => {
    const { vault, remote, engine, binding, settings } = await fixture();
    const preview = await engine.inspectInitialBinding(binding);
    const merged = await engine.configureRepository(binding, 'local', preview.remoteSha);
    expect(merged.ok).toBe(false);
    expect(settings.pendingMerge?.conflicts.map((item) => item.path).sort())
      .toEqual(['.obsidian/app.json', 'Notes/conflict.md']);
    expect(await fs.readFile(path.join(vault, 'Notes/conflict.md'), 'utf8')).toBe('# new device\n');
    const chosen = await engine.resolvePending({ '.obsidian/app.json': 'remote', 'Notes/conflict.md': 'local' });
    expect(chosen.ok, chosen.message).toBe(true);
    const tree = (await exec('git', ['--git-dir', remote, 'ls-tree', '-r', '--name-only', 'refs/heads/main'])).stdout;
    expect(tree).toContain('Notes/same.md');
    expect(tree).toContain('Different/duplicate.md');
    expect(tree).toContain('Archive/duplicate.md');
  });

  it('blocks a file/folder collision before modifying any local note', async () => {
    const { vault, engine, binding } = await fixture(true);
    const preview = await engine.inspectInitialBinding(binding);
    expect(preview.structuralConflicts).toEqual(expect.arrayContaining([expect.stringContaining('Archive')]));
    const before = await fs.readFile(path.join(vault, 'Archive'), 'utf8');
    const result = await engine.configureRepository(binding, 'local', preview.remoteSha);
    expect(result.ok).toBe(false);
    expect(await fs.readFile(path.join(vault, 'Archive'), 'utf8')).toBe(before);
  });

  it('rejects a remote branch that changed after preflight rather than upload a stale plan', async () => {
    const { engine, binding, settings, remote } = await fixture();
    const preview = await engine.inspectInitialBinding(binding);
    const cloned = path.join(path.dirname(remote), 'new-head');
    await exec('git', ['clone', '-b', 'main', remote, cloned]);
    await exec('git', ['config', 'user.name', 'Other'], { cwd: cloned });
    await exec('git', ['config', 'user.email', 'other@example.invalid'], { cwd: cloned });
    await fs.writeFile(path.join(cloned, 'new.md'), 'new version');
    await exec('git', ['add', '--all'], { cwd: cloned });
    await exec('git', ['commit', '-m', 'new remote'], { cwd: cloned });
    await exec('git', ['push', 'origin', 'main'], { cwd: cloned });
    const result = await engine.configureRepository(binding, 'local', preview.remoteSha);
    expect(result.ok).toBe(false);
    expect(settings.lastError).toContain('changed');
  });
});
