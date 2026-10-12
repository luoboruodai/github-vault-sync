import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { SyncEngine } from '../src/sync-engine';
import { DEFAULT_SETTINGS, GithubVaultSyncSettings } from '../src/types';

const exec = promisify(execFile);
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((r) => fs.rm(r, { recursive: true, force: true }))); });

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gvs-current-note-'));
  roots.push(root);
  const vault = path.join(root, 'vault');
  const remote = path.join(root, 'remote.git');
  const other = path.join(root, 'other');
  await fs.mkdir(path.join(vault, 'Notes'), { recursive: true });
  await fs.mkdir(path.join(vault, '.obsidian'));
  await exec('git', ['init', '--bare', remote]);
  await fs.writeFile(path.join(vault, 'Notes', 'active.md'), '# original\n');
  await fs.writeFile(path.join(vault, 'Notes', 'figure.txt'), 'figure old\n');
  await fs.writeFile(path.join(vault, 'unrelated.md'), '# unchanged\n');
  await fs.writeFile(path.join(vault, '.obsidian', 'app.json'), '{}\n');
  const settings: GithubVaultSyncSettings = { ...DEFAULT_SETTINGS, token: '',
    repo: { owner: 'local', name: 'remote', branch: 'main', remoteUrl: remote, private: true } };
  const engine = new SyncEngine(vault, settings, async () => undefined, () => undefined, () => undefined);
  expect((await engine.upload()).ok).toBe(true);
  return { vault, remote, other, engine, settings };
}

describe('sync only the active Markdown note', () => {
  it('uploads selected note and referenced file, not another changed note or config', async () => {
    const { vault, remote, engine, settings } = await fixture();
    await fs.writeFile(path.join(vault, 'Notes', 'active.md'), '# updated\n');
    await fs.writeFile(path.join(vault, 'Notes', 'figure.txt'), 'figure updated\n');
    await fs.writeFile(path.join(vault, 'unrelated.md'), '# must remain local\n');
    await fs.writeFile(path.join(vault, '.obsidian', 'app.json'), '{"theme":"night"}\n');
    const plan = await engine.previewCurrentNote('Notes/active.md', ['Notes/figure.txt']);
    expect(plan.changedPaths).toEqual(['Notes/active.md', 'Notes/figure.txt']);
    expect((await engine.syncCurrentNote(plan)).ok).toBe(true);
    expect(settings.lastStatus).toBe('local-changes');
    const show = async (file: string) => (await exec('git', ['--git-dir', remote, 'show', `refs/heads/main:${file}`])).stdout;
    expect(await show('Notes/active.md')).toBe('# updated\n');
    expect(await show('Notes/figure.txt')).toBe('figure updated\n');
    expect(await show('unrelated.md')).toBe('# unchanged\n');
    expect(await show('.obsidian/app.json')).toBe('{}\n');
    expect((await exec('git', ['status', '--porcelain=v1'], { cwd: vault })).stdout).toContain('unrelated.md');
  });

  it('expires approval when note changes or remote advances; never commits other changes', async () => {
    const { vault, remote, other, engine } = await fixture();
    await fs.writeFile(path.join(vault, 'Notes/active.md'), '# pending\n');
    const preview = await engine.previewCurrentNote('Notes/active.md');
    await fs.writeFile(path.join(vault, 'Notes/active.md'), '# newer local\n');
    expect((await engine.syncCurrentNote(preview)).ok).toBe(false);
    expect((await exec('git', ['--git-dir', remote, 'show', 'refs/heads/main:Notes/active.md'])).stdout).toBe('# original\n');
    const next = await engine.previewCurrentNote('Notes/active.md');
    await exec('git', ['clone', '--branch', 'main', remote, other]);
    await exec('git', ['config', 'user.name', 'Other Device'], { cwd: other });
    await exec('git', ['config', 'user.email', 'other@example.invalid'], { cwd: other });
    await fs.writeFile(path.join(other, 'Notes/active.md'), '# remote edit\n');
    await exec('git', ['add', 'Notes/active.md'], { cwd: other });
    await exec('git', ['commit', '-m', 'remote edit'], { cwd: other });
    await exec('git', ['push', 'origin', 'main'], { cwd: other });
    expect((await engine.syncCurrentNote(next)).ok).toBe(false);
    await expect(engine.previewCurrentNote('Notes/active.md')).rejects.toThrow(/full Vault/i);
    expect((await exec('git', ['rev-parse', 'HEAD'], { cwd: vault })).stdout.trim())
      .not.toBe((await exec('git', ['--git-dir', remote, 'rev-parse', 'refs/heads/main'])).stdout.trim());
  });

  it('keeps a referenced Git LFS image without staging another image', async () => {
    const { vault, remote, engine } = await fixture();
    const one = path.join(vault, 'Notes/figure.png');
    const other = path.join(vault, 'other.png');
    await fs.writeFile(one, Buffer.from([137, 80, 78, 71, 1, 2, 3]));
    await fs.writeFile(other, Buffer.from([137, 80, 78, 71, 4, 5, 6]));
    await fs.writeFile(path.join(vault, 'Notes/active.md'), '# new image\n![[figure.png]]\n');
    const plan = await engine.previewCurrentNote('Notes/active.md', ['Notes/figure.png']);
    const result = await engine.syncCurrentNote(plan);
    expect(result.ok, result.message).toBe(true);
    const tree = (await exec('git', ['--git-dir', remote, 'ls-tree', '-r', '--name-only', 'refs/heads/main'])).stdout;
    expect(tree).toContain('Notes/figure.png');
    expect(tree).not.toContain('other.png');
    const pointer = (await exec('git', ['--git-dir', remote, 'show', 'refs/heads/main:Notes/figure.png'])).stdout;
    expect(pointer).toContain('version https://git-lfs.github.com/spec/v1');
  });

  it('rejects an already-staged file and an excluded current note', async () => {
    const { vault, engine, settings } = await fixture();
    await fs.writeFile(path.join(vault, 'unrelated.md'), '# staged earlier\n');
    await exec('git', ['add', 'unrelated.md'], { cwd: vault });
    await expect(engine.previewCurrentNote('Notes/active.md')).rejects.toThrow(/staged/i);
    await exec('git', ['reset', 'HEAD', '--', 'unrelated.md'], { cwd: vault });
    settings.excludePatterns = [...settings.excludePatterns, 'Notes/active.md'];
    await expect(engine.previewCurrentNote('Notes/active.md')).rejects.toThrow(/excluded/i);
  });
});
