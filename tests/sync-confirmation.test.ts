import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { SyncEngine } from '../src/sync-engine';
import { DEFAULT_SETTINGS, GithubVaultSyncSettings, SyncPriority } from '../src/types';

const exec = promisify(execFile);
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-preview-'));
  roots.push(root);
  const vault = path.join(root, 'vault');
  const remote = path.join(root, 'remote.git');
  const other = path.join(root, 'other');
  await fs.mkdir(path.join(vault, 'Notes'), { recursive: true });
  await fs.mkdir(path.join(vault, '.obsidian'));
  await exec('git', ['init', '--bare', remote]);
  await fs.writeFile(path.join(vault, 'Notes', 'today.md'), '# original\n');
  await fs.writeFile(path.join(vault, '.obsidian', 'app.json'), '{"theme":"light"}\n');
  const settings: GithubVaultSyncSettings = { ...DEFAULT_SETTINGS, includeObsidian: true, token: '',
    repo: { owner: 'local', name: 'remote', branch: 'main', remoteUrl: remote, private: true } };
  const engine = new SyncEngine(vault, settings, async () => undefined, () => undefined, () => undefined);
  expect((await engine.upload()).ok).toBe(true);
  await exec('git', ['clone', '--branch', 'main', remote, other]);
  await exec('git', ['config', 'user.name', 'Other Device'], { cwd: other });
  await exec('git', ['config', 'user.email', 'other@example.invalid'], { cwd: other });
  return { vault, remote, other, settings, engine };
}

async function editRemote(other: string, files: Record<string, string>) {
  for (const [name, contents] of Object.entries(files)) {
    const target = path.join(other, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);
  }
  await exec('git', ['add', '--all'], { cwd: other });
  await exec('git', ['commit', '-m', 'other device edit'], { cwd: other });
  await exec('git', ['push', 'origin', 'main'], { cwd: other });
}

describe('review-before-upload', () => {
  it('requires a new preview after local Markdown or remote commits change', async () => {
    const { vault, remote, other, engine } = await fixture();
    await fs.writeFile(path.join(vault, 'Notes', 'today.md'), '# device edit\n');
    const before = await engine.previewSync();
    expect(before.notes.map((item) => item.path)).toEqual(['Notes/today.md']);
    expect(before.obsidianConfig).toEqual([]);
    await fs.writeFile(path.join(vault, 'Notes', 'today.md'), '# changed again\n');
    expect((await engine.syncApproved(before, 'local')).ok).toBe(false);
    expect((await exec('git', ['--git-dir', remote, 'show', 'refs/heads/main:Notes/today.md'])).stdout).toBe('# original\n');

    const refreshed = await engine.previewSync();
    await editRemote(other, { 'remote.md': '# unexpected remote change\n' });
    expect((await engine.syncApproved(refreshed, 'remote')).ok).toBe(false);
    expect((await exec('git', ['--git-dir', remote, 'show', 'refs/heads/main:Notes/today.md'])).stdout).toBe('# original\n');
  });

  for (const priority of ['local', 'remote'] as SyncPriority[]) {
    it(`uses ${priority} for note-only conflicts, preserving the losing Markdown version`, async () => {
      const { vault, remote, other, engine } = await fixture();
      await fs.writeFile(path.join(vault, 'Notes', 'today.md'), '# from this device\n');
      await editRemote(other, { 'Notes/today.md': '# from the repository\n',
        '.obsidian/app.json': '{"theme":"dark"}\n' });
      const preview = await engine.previewSync();
      expect(preview.notes.map((entry) => entry.path)).toEqual(['Notes/today.md']);
      expect(preview.obsidianConfig.map((entry) => entry.path)).toEqual(['.obsidian/app.json']);
      const result = await engine.syncApproved(preview, priority);
      expect(result.ok, result.message).toBe(true);
      const note = (await exec('git', ['--git-dir', remote, 'show', 'refs/heads/main:Notes/today.md'])).stdout;
      expect(note).toBe(priority === 'local' ? '# from this device\n' : '# from the repository\n');
      expect((await exec('git', ['--git-dir', remote, 'show', 'refs/heads/main:.obsidian/app.json'])).stdout)
        .toBe('{"theme":"dark"}\n');
      const backups = path.join(vault, '.github-vault-sync-conflicts');
      const sessions = await fs.readdir(backups);
      expect(sessions).toHaveLength(1);
      const loser = path.join(backups, sessions[0], 'Notes', `today.md.${priority === 'local' ? 'remote' : 'local'}`);
      expect(await fs.readFile(loser, 'utf8')).toBe(priority === 'local' ? '# from the repository\n' : '# from this device\n');
    });
  }

  it('never auto-selects an Obsidian configuration conflict from the note priority', async () => {
    const { vault, other, engine, settings } = await fixture();
    await fs.writeFile(path.join(vault, 'Notes', 'today.md'), '# local note\n');
    await fs.writeFile(path.join(vault, '.obsidian', 'app.json'), '{"theme":"local"}\n');
    await editRemote(other, { 'Notes/today.md': '# remote note\n',
      '.obsidian/app.json': '{"theme":"remote"}\n' });
    const preview = await engine.previewSync();
    const pending = await engine.syncApproved(preview, 'local');
    expect(pending.ok).toBe(false);
    expect(settings.pendingMerge?.conflicts.find((entry) => entry.path === 'Notes/today.md')?.choice).toBe('local');
    expect(settings.pendingMerge?.conflicts.find((entry) => entry.path === '.obsidian/app.json')?.choice).toBeNull();
    const finished = await engine.resolvePending({ '.obsidian/app.json': 'remote', 'Notes/today.md': 'local' });
    expect(finished.ok, finished.message).toBe(true);
  });
});
