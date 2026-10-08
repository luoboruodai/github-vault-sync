import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { ENCRYPTED_BUNDLE, generateRecoveryKey, prepareEncryptedBundle } from '../src/encrypted-bundle';
import { SyncEngine } from '../src/sync-engine';
import { DEFAULT_SETTINGS } from '../src/types';

const exec = promisify(execFile);
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe('encrypted plugin content in Git synchronization', () => {
  it('pushes only ciphertext and pauses when a newer encrypted bundle arrives from another device', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-encrypted-engine-'));
    roots.push(root);
    const vault = path.join(root, 'vault');
    const remote = path.join(root, 'remote.git');
    const other = path.join(root, 'other');
    const key = generateRecoveryKey();
    await fs.mkdir(path.join(vault, '.obsidian', 'plugins', 'demo'), { recursive: true });
    await fs.mkdir(path.join(vault, '.obsidian', 'plugins', 'obsidian-memos'));
    await fs.mkdir(path.join(vault, '.obsidian', 'plugins', 'obsidian-callout-editor', '.git'), { recursive: true });
    await fs.writeFile(path.join(vault, '.obsidian', 'plugins', 'demo', 'data.json'), '{"apiToken":"PRIVATE_A"}\n');
    await fs.writeFile(path.join(vault, '.obsidian', 'plugins', 'obsidian-memos', 'main.js'), 'const password="vendor";\n');
    await fs.writeFile(path.join(vault, '.obsidian', 'plugins', 'obsidian-callout-editor', '.git', 'config'), 'secret-history\n');
    await fs.writeFile(path.join(vault, 'note.md'), '# safe\n');
    await exec('git', ['init', '--bare', remote]);
    const binding = { owner: 'local', name: 'remote', branch: 'main', remoteUrl: remote, private: true };
    const settings = { ...DEFAULT_SETTINGS, token: '', includeObsidian: true,
      encryptedSyncEnabled: true, encryptionKey: key,
      encryptedFolders: ['obsidian-memos', 'obsidian-callout-editor'],
      excludePatterns: [...DEFAULT_SETTINGS.excludePatterns,
        '.obsidian/plugins/obsidian-memos/**', '.obsidian/plugins/obsidian-callout-editor/**'], repo: binding };
    const engine = new SyncEngine(vault, settings, async () => undefined, () => undefined, () => undefined);
    expect((await engine.upload()).ok).toBe(true);
    const paths = (await exec('git', ['--git-dir', remote, 'ls-tree', '-r', '--name-only', 'refs/heads/main'])).stdout;
    expect(paths).toContain(ENCRYPTED_BUNDLE);
    expect(paths).not.toContain('data.json');
    expect(paths).not.toContain('obsidian-memos/main.js');
    expect(paths).not.toContain('obsidian-callout-editor/.git/config');
    const ciphertext = (await exec('git', ['--git-dir', remote, 'show', `refs/heads/main:${ENCRYPTED_BUNDLE}`])).stdout;
    expect(ciphertext).not.toContain('PRIVATE_A');
    expect(ciphertext).not.toContain('secret-history');

    await exec('git', ['clone', '--branch', 'main', remote, other]);
    await exec('git', ['config', 'user.name', 'Remote Device'], { cwd: other });
    await exec('git', ['config', 'user.email', 'remote@example.invalid'], { cwd: other });
    await fs.mkdir(path.join(other, '.obsidian', 'plugins', 'demo'), { recursive: true });
    await fs.writeFile(path.join(other, '.obsidian', 'plugins', 'demo', 'data.json'), '{"apiToken":"PRIVATE_B"}\n');
    const otherSettings = { ...settings, encryptionLastDigest: settings.encryptionLastDigest };
    expect((await prepareEncryptedBundle(other, otherSettings)).changed).toBe(true);
    await exec('git', ['add', ENCRYPTED_BUNDLE], { cwd: other });
    await exec('git', ['commit', '-m', 'encrypted remote settings'], { cwd: other });
    await exec('git', ['push', 'origin', 'main'], { cwd: other });

    expect((await engine.checkRemote()).ok).toBe(true);
    expect(engine.getSnapshot().difference?.remoteChanged).toBe(1);
    expect((await engine.upload()).ok).toBe(true);
    expect(engine.getSnapshot().encryptedNeedsRestore).toBe(true);
    expect((await engine.checkRemote()).ok).toBe(true);
    expect(engine.getSnapshot().encryptedNeedsRestore).toBe(true);
    expect((await engine.upload()).ok).toBe(false);
  });

  it('invalidates approval when plugin credentials change after the preview', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-preview-secret-'));
    roots.push(root);
    const vault = path.join(root, 'vault');
    const remote = path.join(root, 'remote.git');
    const plugin = path.join(vault, '.obsidian', 'plugins', 'demo');
    await fs.mkdir(plugin, { recursive: true });
    await exec('git', ['init', '--bare', remote]);
    await fs.writeFile(path.join(vault, 'note.md'), '# safe\n');
    await fs.writeFile(path.join(plugin, 'data.json'), '{"apiToken":"PRIVATE_BEFORE"}\n');
    const settings = { ...DEFAULT_SETTINGS, token: '', includeObsidian: true,
      encryptedSyncEnabled: true, encryptionKey: generateRecoveryKey(), encryptedFolders: [],
      repo: { owner: 'local', name: 'remote', branch: 'main', remoteUrl: remote, private: true } };
    const engine = new SyncEngine(vault, settings, async () => undefined, () => undefined, () => undefined);
    expect((await engine.upload()).ok).toBe(true);
    const approvedHead = (await exec('git', ['--git-dir', remote, 'rev-parse', 'refs/heads/main'])).stdout.trim();
    const preview = await engine.previewSync();
    await fs.writeFile(path.join(plugin, 'data.json'), '{"apiToken":"PRIVATE_AFTER"}\n');
    const result = await engine.syncApproved(preview, 'local');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('changed after the preview');
    expect((await exec('git', ['--git-dir', remote, 'rev-parse', 'refs/heads/main'])).stdout.trim()).toBe(approvedHead);
  });
});
