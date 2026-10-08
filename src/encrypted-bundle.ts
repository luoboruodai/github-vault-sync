import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { GithubVaultSyncSettings } from './types';
import { ensureDirectory, isSafeRelativePath, normalizeRelPath } from './utils';

export const ENCRYPTED_BUNDLE = '.github-vault-sync-encrypted/vault.gvs';
const MAGIC = 'GVS-AES-256-GCM-v1';
const AAD = Buffer.from('GitHub Vault Sync encrypted plugin backup v1');
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_ENTRIES = 10_000;
const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;

type Entry = { path: string; mode: number; data: string };
type Payload = { version: 1; entries: Entry[] };
type Envelope = { format: string; nonce: string; tag: string; ciphertext: string; digest: string; entries: number };

async function readEnvelope(file: string): Promise<Envelope> {
  if ((await fs.stat(file)).size > MAX_ARCHIVE_BYTES) throw new Error('Encrypted bundle exceeds safety limit');
  return JSON.parse(await fs.readFile(file, 'utf8')) as Envelope;
}

function decodeKey(recoveryKey: string): Buffer {
  const normalized = recoveryKey.trim();
  if (!normalized.startsWith('GVS1-')) throw new Error('Invalid recovery key format');
  const raw = normalized.slice(5);
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) throw new Error('Invalid recovery key length');
  const key = Buffer.from(raw, 'base64url');
  if (key.length !== 32 || key.toString('base64url') !== raw) throw new Error('Invalid recovery key');
  return key;
}

export function generateRecoveryKey(): string {
  return `GVS1-${randomBytes(32).toString('base64url')}`;
}

export function validateRecoveryKey(key: string): string {
  decodeKey(key);
  return key.trim();
}

function validFolder(name: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(name) && name !== '.' && name !== '..';
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(source).sort().map((key) => [key, canonicalJson(source[key])]));
  }
  return value;
}

function allowedPayloadPath(rel: string, folders: string[]): boolean {
  if (!isSafeRelativePath(rel) || normalizeRelPath(rel) !== rel || rel.includes('\0')) return false;
  const parts = rel.split('/');
  if (parts[0] !== '.obsidian' || parts[1] !== 'plugins' || parts.length < 4 || !validFolder(parts[2])) return false;
  return (parts.length === 4 && parts[3] === 'data.json') || folders.includes(parts[2]);
}

async function collectFiles(vaultPath: string, settings: GithubVaultSyncSettings): Promise<Entry[]> {
  const folders = settings.encryptedFolders ?? [];
  if (!folders.every(validFolder)) throw new Error('Encrypted folder names must be simple plugin IDs');
  const plugins = path.join(vaultPath, '.obsidian', 'plugins');
  const entries: Entry[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;
  async function addFile(absolute: string, sanitizeSelf = false): Promise<void> {
    const rel = normalizeRelPath(path.relative(vaultPath, absolute));
    if (!allowedPayloadPath(rel, folders) || seen.has(rel)) return;
    const stat = await fs.lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Cannot archive a non-regular plugin file: ${rel}`);
    if (stat.size > MAX_BYTES) throw new Error(`Encrypted plugin file is too large: ${rel}`);
    let bytes = await fs.readFile(absolute);
    if (rel.endsWith('/data.json')) {
      try {
        const config = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
        if (sanitizeSelf) {
          for (const key of ['encryptionKey', 'encryptionLastDigest', 'logEntries', 'lastError', 'lastStatus', 'lastRemoteSha',
            'pendingMerge', 'autoSyncEnabled', 'autoSyncDelaySeconds', 'startupCheck']) delete config[key];
        }
        bytes = Buffer.from(`${JSON.stringify(canonicalJson(config))}\n`, 'utf8');
      } catch (error) {
        if (sanitizeSelf) throw error;
        // Preserve another plugin's non-JSON data verbatim if it is in use.
      }
    }
    totalBytes += bytes.length;
    if (totalBytes > MAX_BYTES || entries.length >= MAX_ENTRIES) throw new Error('Encrypted plugin backup exceeds safety limits');
    seen.add(rel);
    entries.push({ path: rel, mode: stat.mode & 0o777, data: bytes.toString('base64') });
  }
  const installed = await fs.readdir(plugins, { withFileTypes: true });
  for (const plugin of installed) {
    if (!plugin.isDirectory() || !validFolder(plugin.name)) continue;
    const file = path.join(plugins, plugin.name, 'data.json');
    try { await fs.lstat(file); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    await addFile(file, plugin.name === 'github-vault-sync');
  }
  async function walk(directory: string): Promise<void> {
    for (const file of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, file.name);
      if (file.isSymbolicLink()) throw new Error(`Symlink inside encrypted plugin folder: ${normalizeRelPath(path.relative(vaultPath, absolute))}`);
      if (file.isDirectory()) await walk(absolute);
      else if (file.isFile()) await addFile(absolute);
    }
  }
  for (const folder of folders) {
    const dir = path.join(plugins, folder);
    try { await fs.access(dir); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    await walk(dir);
  }
  entries.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  return entries;
}

function encryptPayload(payload: Payload, recoveryKey: string): Envelope {
  const key = decodeKey(recoveryKey);
  const plain = Buffer.from(JSON.stringify(payload), 'utf8');
  if (plain.length > MAX_ARCHIVE_BYTES) throw new Error('Encrypted archive is too large');
  const digest = createHmac('sha256', key).update(plain).digest('hex');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(gzipSync(plain)), cipher.final()]);
  return { format: MAGIC, nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'), digest, entries: payload.entries.length };
}

function decryptPayload(envelope: Envelope, recoveryKey: string): Payload {
  if (envelope.format !== MAGIC || !Number.isSafeInteger(envelope.entries) || envelope.entries < 0 || envelope.entries > MAX_ENTRIES) {
    throw new Error('Unsupported encrypted bundle format');
  }
  const key = decodeKey(recoveryKey);
  const nonce = Buffer.from(envelope.nonce, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  if (nonce.length !== 12 || tag.length !== 16 || ciphertext.length > MAX_ARCHIVE_BYTES) throw new Error('Invalid encrypted bundle');
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);
  const zipped = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const plain = gunzipSync(zipped, { maxOutputLength: MAX_ARCHIVE_BYTES });
  const expected = createHmac('sha256', key).update(plain).digest();
  const actual = Buffer.from(envelope.digest, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Encrypted bundle checksum mismatch');
  const parsed = JSON.parse(plain.toString('utf8')) as Payload;
  if (parsed.version !== 1 || !Array.isArray(parsed.entries) || parsed.entries.length !== envelope.entries) {
    throw new Error('Invalid encrypted bundle payload');
  }
  return parsed;
}

export async function writeRecoveryKeyFile(settings: GithubVaultSyncSettings, recoveryDirectory?: string): Promise<string> {
  if (!settings.repo) throw new Error('Bind a repository before exporting a recovery key');
  const key = validateRecoveryKey(settings.encryptionKey);
  const root = recoveryDirectory ?? path.join(os.homedir(), 'Library', 'Application Support', 'github-vault-sync-backups', 'recovery-keys');
  await ensureDirectory(root);
  await fs.chmod(root, 0o700);
  const owner = settings.repo.owner.replace(/[^A-Za-z0-9._-]/g, '-');
  const name = settings.repo.name.replace(/[^A-Za-z0-9._-]/g, '-');
  const destination = path.join(root, `${owner}-${name}.key`);
  try { await fs.writeFile(destination, `${key}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if ((await fs.readFile(destination, 'utf8')).trim() !== key) {
      throw new Error('A different recovery key already exists; refusing to overwrite it');
    }
  }
  await fs.chmod(destination, 0o600);
  return destination;
}

export async function prepareEncryptedBundle(vaultPath: string, settings: GithubVaultSyncSettings): Promise<{ changed: boolean; entries: number; needsRestore: boolean }> {
  if (!settings.encryptedSyncEnabled) return { changed: false, entries: 0, needsRestore: false };
  if (!settings.encryptionKey) throw new Error('Encrypted synchronization requires a local recovery key');
  const payload: Payload = { version: 1, entries: await collectFiles(vaultPath, settings) };
  const plain = Buffer.from(JSON.stringify(payload), 'utf8');
  const digest = createHmac('sha256', decodeKey(settings.encryptionKey)).update(plain).digest('hex');
  const target = path.join(vaultPath, ENCRYPTED_BUNDLE);
  try {
    const old = await readEnvelope(target);
    if (old.format !== MAGIC) throw new Error('Unrecognized encrypted bundle on disk');
    if (old.digest === digest) {
      settings.encryptionLastDigest = digest;
      return { changed: false, entries: payload.entries.length, needsRestore: false };
    }
    if (!settings.encryptionLastDigest) {
      return { changed: false, entries: payload.entries.length, needsRestore: true };
    }
    if (old.digest !== settings.encryptionLastDigest) {
      if (digest === settings.encryptionLastDigest) {
        return { changed: false, entries: payload.entries.length, needsRestore: true };
      }
      throw new Error('Local and remote encrypted settings both changed; resolve the encrypted archive conflict manually');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const envelope = encryptPayload(payload, settings.encryptionKey);
  await ensureDirectory(path.dirname(target));
  const temporary = `${target}.tmp-${process.pid}`;
  try {
    await fs.writeFile(temporary, `${JSON.stringify(envelope)}\n`, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporary, target);
  } finally { await fs.rm(temporary, { force: true }); }
  settings.encryptionLastDigest = digest;
  return { changed: true, entries: payload.entries.length, needsRestore: false };
}

export async function inspectEncryptedBundle(vaultPath: string, settings: GithubVaultSyncSettings): Promise<{ files: number; totalBytes: number }> {
  const envelope = await readEnvelope(path.join(vaultPath, ENCRYPTED_BUNDLE));
  const payload = decryptPayload(envelope, settings.encryptionKey);
  const folders = settings.encryptedFolders ?? [];
  const paths = new Set<string>();
  let totalBytes = 0;
  for (const entry of payload.entries) {
    if (!allowedPayloadPath(entry.path, folders) || paths.has(entry.path)) throw new Error('Unsafe or duplicate path in encrypted bundle');
    paths.add(entry.path);
    const data = Buffer.from(entry.data, 'base64');
    totalBytes += data.length;
    if (data.length > MAX_BYTES || totalBytes > MAX_BYTES) throw new Error('Encrypted bundle is too large to restore');
  }
  return { files: paths.size, totalBytes };
}

export async function restoreEncryptedBundle(vaultPath: string, settings: GithubVaultSyncSettings, restoreSelf = false, backupRoot?: string): Promise<{ restored: number; backup: string }> {
  const envelope = await readEnvelope(path.join(vaultPath, ENCRYPTED_BUNDLE));
  const payload = decryptPayload(envelope, settings.encryptionKey);
  const folders = settings.encryptedFolders ?? [];
  const seen = new Set<string>();
  const safe: Array<{ path: string; data: Buffer; mode: number }> = [];
  let totalBytes = 0;
  for (const entry of payload.entries) {
    if (!allowedPayloadPath(entry.path, folders) || seen.has(entry.path) || !Number.isInteger(entry.mode)) {
      throw new Error('Unsafe or duplicate path in encrypted bundle');
    }
    seen.add(entry.path);
    if (!restoreSelf && entry.path === '.obsidian/plugins/github-vault-sync/data.json') continue;
    let data = Buffer.from(entry.data, 'base64');
    if (entry.path === '.obsidian/plugins/github-vault-sync/data.json') {
      const own = JSON.parse(data.toString('utf8')) as Record<string, unknown>;
      const archivedRepo = own.repo as { owner?: string; name?: string } | undefined;
      if (archivedRepo?.owner !== settings.repo?.owner || archivedRepo?.name !== settings.repo?.name) {
        throw new Error('Archived plugin credentials belong to another repository');
      }
      own.encryptionKey = settings.encryptionKey;
      own.encryptedSyncEnabled = true;
      own.encryptedFolders = folders;
      own.encryptionLastDigest = envelope.digest;
      own.lastStatus = settings.lastStatus;
      own.lastRemoteSha = settings.lastRemoteSha;
      own.pendingMerge = settings.pendingMerge;
      data = Buffer.from(`${JSON.stringify(own, null, 2)}\n`);
    }
    totalBytes += data.length;
    if (data.length > MAX_BYTES || totalBytes > MAX_BYTES) throw new Error('Encrypted bundle is too large to restore');
    safe.push({ path: entry.path, data, mode: entry.mode & 0o777 });
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(backupRoot ?? path.join(os.homedir(), 'Library', 'Application Support', 'github-vault-sync-backups', 'restores'), stamp);
  await ensureDirectory(backup);
  await fs.chmod(backup, 0o700);
  for (const entry of safe) {
    const target = path.join(vaultPath, entry.path);
    const destination = path.join(backup, entry.path);
    // Do not follow existing symlinks at any intermediate path.
    let segment = vaultPath;
    for (const part of entry.path.split('/')) {
      segment = path.join(segment, part);
      try { if ((await fs.lstat(segment)).isSymbolicLink()) throw new Error(`Refusing symlink restore path: ${entry.path}`); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    try {
      const old = await fs.lstat(target);
      if (!old.isFile()) throw new Error(`Cannot overwrite a non-file during restore: ${entry.path}`);
      await ensureDirectory(path.dirname(destination));
      await fs.copyFile(target, destination);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  for (const entry of safe) {
    const target = path.join(vaultPath, entry.path);
    await ensureDirectory(path.dirname(target));
    const temporary = `${target}.restore-${process.pid}`;
    try {
      await fs.writeFile(temporary, entry.data, { mode: entry.path.endsWith('/data.json') ? 0o600 : entry.mode });
      await fs.rename(temporary, target);
    } finally { await fs.rm(temporary, { force: true }); }
  }
  settings.encryptionLastDigest = envelope.digest;
  return { restored: safe.length, backup };
}
