import { cleanFixtureRoots } from './fixture-cleanup';
import { createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ENCRYPTED_BUNDLE, generateRecoveryKey, inspectEncryptedBundle, prepareEncryptedBundle,
  restoreEncryptedBundle, validateRecoveryKey, writeRecoveryKeyFile } from '../src/encrypted-bundle';
import { DEFAULT_SETTINGS, GithubVaultSyncSettings } from '../src/types';

const roots: string[] = [];
afterEach(async () => { await cleanFixtureRoots(roots); });

function settings(key: string): GithubVaultSyncSettings {
  return { ...DEFAULT_SETTINGS, token: 'FAKE_TEST_CREDENTIAL_NOT_A_PROVIDER_TOKEN',
    repo: { owner: 'test', name: 'private', branch: 'main', remoteUrl: 'https://github.com/test/private.git', private: true },
    encryptionKey: key, encryptedSyncEnabled: true, encryptedFolders: ['obsidian-memos', 'obsidian-callout-editor'] };
}

async function rewriteDigestAsV012LegacyBundle(bundlePath: string, recoveryKey: string): Promise<void> {
  const envelope = JSON.parse(await fs.readFile(bundlePath, 'utf8')) as {
    nonce: string; tag: string; ciphertext: string; digest: string;
  };
  const key = Buffer.from(recoveryKey.slice(5), 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.nonce, 'base64'));
  decipher.setAAD(Buffer.from('GitHub Vault Sync encrypted plugin backup v1'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const zipped = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
  const plain = gunzipSync(zipped);
  envelope.digest = createHmac('sha256', key).update(plain).digest('hex');
  await fs.writeFile(bundlePath, `${JSON.stringify(envelope)}\n`);
}

async function fixture() {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-encryption-'));
  roots.push(vault);
  for (const name of ['github-vault-sync', 'other', 'obsidian-memos', 'obsidian-callout-editor']) {
    await fs.mkdir(path.join(vault, '.obsidian', 'plugins', name), { recursive: true });
  }
  const pluginRoot = path.join(vault, '.obsidian', 'plugins');
  await fs.writeFile(path.join(pluginRoot, 'github-vault-sync', 'data.json'),
    JSON.stringify({ token: 'FAKE_TEST_CREDENTIAL_NOT_A_PROVIDER_TOKEN',
      repo: { owner: 'test', name: 'private' }, encryptionKey: 'do-not-store-key-in-archive', lastStatus: 'synced' }));
  await fs.writeFile(path.join(pluginRoot, 'other', 'data.json'), JSON.stringify({ apiToken: 'very-private-token' }));
  await fs.writeFile(path.join(pluginRoot, 'obsidian-memos', 'main.js'), Buffer.from('const vendorKey = "private example";\n\0'));
  await fs.mkdir(path.join(pluginRoot, 'obsidian-callout-editor', '.git'), { recursive: true });
  await fs.writeFile(path.join(pluginRoot, 'obsidian-callout-editor', '.git', 'config'), '[remote "origin"]\nurl = git@example.com:private.git\n');
  await fs.writeFile(path.join(pluginRoot, 'obsidian-callout-editor', 'main.js'), 'module.exports = {};\n');
  return vault;
}

describe('client-side encrypted plugin backup', () => {
  it('does not churn the shared digest when device credentials differ', async () => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-digest-'));
    roots.push(vault);
    await fs.mkdir(path.join(vault, '.obsidian', 'plugins', 'github-vault-sync'), { recursive: true });
    const key = generateRecoveryKey();
    const base = settings(key);
    await fs.writeFile(path.join(vault, '.obsidian', 'plugins', 'github-vault-sync', 'data.json'), JSON.stringify({ token: 'DEVICE_A', authType: 'pat', gitHttpProxy: '', repo: base.repo }));
    const first = await prepareEncryptedBundle(vault, base);
    expect(first.changed).toBe(true);
    const digest = base.encryptionLastDigest;
    await fs.writeFile(path.join(vault, '.obsidian', 'plugins', 'github-vault-sync', 'data.json'), JSON.stringify({ token: 'DEVICE_B', authType: 'pat', gitHttpProxy: 'http://127.0.0.1:7897', repo: base.repo }));
    const second = { ...base, token: 'DEVICE_B', authType: 'pat' as const, gitHttpProxy: 'http://127.0.0.1:7897', encryptionLastDigest: digest };
    const result = await prepareEncryptedBundle(vault, second);
    expect(result.changed).toBe(false);
    expect(second.encryptionLastDigest).toBe(digest);
  });

  it('encrypts plugin settings and both exceptional directories; restores without plaintext in Git', async () => {
    const vault = await fixture();
    const key = generateRecoveryKey();
    expect(validateRecoveryKey(key)).toBe(key);
    const config = settings(key);
    expect((await prepareEncryptedBundle(vault, config)).changed).toBe(true);
    const bytes = await fs.readFile(path.join(vault, ENCRYPTED_BUNDLE));
    expect(bytes.toString()).not.toContain('very-private-token');
    expect(bytes.toString()).not.toContain('FAKE_TEST_CREDENTIAL_NOT_A_PROVIDER_TOKEN');
    expect(bytes.toString()).not.toContain('do-not-store-key-in-archive');
    const inspected = await inspectEncryptedBundle(vault, config);
    expect(inspected.files).toBe(5);
    config.lastStatus = 'error';
    expect((await prepareEncryptedBundle(vault, config)).changed).toBe(false);
    await fs.writeFile(path.join(vault, '.obsidian/plugins/github-vault-sync/data.json'),
      JSON.stringify({ lastStatus: 'changed', encryptionKey: 'do-not-store-key-in-archive',
        repo: { name: 'private', owner: 'test' }, token: 'FAKE_TEST_CREDENTIAL_NOT_A_PROVIDER_TOKEN' }, null, 2));
    expect((await prepareEncryptedBundle(vault, config)).changed).toBe(false);

    const otherVault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-decrypt-'));
    roots.push(otherVault);
    await fs.mkdir(path.join(otherVault, '.github-vault-sync-encrypted'));
    await fs.copyFile(path.join(vault, ENCRYPTED_BUNDLE), path.join(otherVault, ENCRYPTED_BUNDLE));
    const restored = await restoreEncryptedBundle(otherVault, config, false, path.join(otherVault, 'backups'));
    expect(restored.restored).toBe(4);
    expect(JSON.parse(await fs.readFile(path.join(otherVault, '.obsidian/plugins/other/data.json'), 'utf8')).apiToken).toBe('very-private-token');
    expect(await fs.readFile(path.join(otherVault, '.obsidian/plugins/obsidian-callout-editor/.git/config'), 'utf8')).toContain('private.git');
    expect(await fs.readFile(path.join(otherVault, '.obsidian/plugins/obsidian-memos/main.js')))
      .toEqual(Buffer.from('const vendorKey = "private example";\n\0'));
    await expect(fs.readFile(path.join(otherVault, '.obsidian/plugins/github-vault-sync/data.json'))).rejects.toThrow();
    const withOwnCredentials = await restoreEncryptedBundle(otherVault, config, true, path.join(otherVault, 'backups'));
    expect(withOwnCredentials.restored).toBe(5);
    const own = JSON.parse(await fs.readFile(path.join(otherVault, '.obsidian/plugins/github-vault-sync/data.json'), 'utf8'));
    expect(own.token).toBe('FAKE_TEST_CREDENTIAL_NOT_A_PROVIDER_TOKEN');
    expect(own.encryptionKey).toBe(key);
  });

  it('reads and migrates a v0.1.2 legacy digest without changing the payload', async () => {
    const vault = await fixture();
    const key = generateRecoveryKey();
    const config = settings(key);
    await prepareEncryptedBundle(vault, config);
    const bundlePath = path.join(vault, ENCRYPTED_BUNDLE);
    const before = await fs.readFile(bundlePath, 'utf8');
    await rewriteDigestAsV012LegacyBundle(bundlePath, key);
    const legacy = await fs.readFile(bundlePath, 'utf8');
    expect(legacy).not.toBe(before);
    expect((await inspectEncryptedBundle(vault, config)).files).toBe(5);

    config.encryptionLastDigest = '';
    const migrated = await prepareEncryptedBundle(vault, config);
    expect(migrated).toEqual({ changed: true, entries: 5, needsRestore: false });
    const normalized = await fs.readFile(bundlePath, 'utf8');
    expect(normalized).not.toBe(legacy);
    expect((await inspectEncryptedBundle(vault, config)).files).toBe(5);
    expect((await prepareEncryptedBundle(vault, config)).changed).toBe(false);
  });

  it('rejects tampered ciphertext, wrong keys, and unsafe folder IDs', async () => {
    const vault = await fixture();
    const config = settings(generateRecoveryKey());
    await prepareEncryptedBundle(vault, config);
    const wrong = settings(generateRecoveryKey());
    await expect(inspectEncryptedBundle(vault, wrong)).rejects.toThrow();
    const bundlePath = path.join(vault, ENCRYPTED_BUNDLE);
    const envelope = JSON.parse(await fs.readFile(bundlePath, 'utf8'));
    envelope.ciphertext = randomBytes(32).toString('base64');
    await fs.writeFile(bundlePath, JSON.stringify(envelope));
    await expect(inspectEncryptedBundle(vault, config)).rejects.toThrow();
    await expect(prepareEncryptedBundle(vault, { ...config, encryptedFolders: ['../../outside'] })).rejects.toThrow();
  });

  it('exports only a private local recovery key file', async () => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-key-'));
    roots.push(vault);
    const config = settings(generateRecoveryKey());
    const file = await writeRecoveryKeyFile(config, path.join(vault, 'recovery'));
    expect((await fs.readFile(file, 'utf8')).trim()).toBe(config.encryptionKey);
    if (process.platform !== 'win32') expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
    expect(await writeRecoveryKeyFile(config, path.join(vault, 'recovery'))).toBe(file);
  });
});
