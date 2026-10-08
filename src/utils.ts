import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_LFS_PATTERNS,
  GithubVaultSyncSettings,
  SYNC_MANIFEST,
  SyncManifest,
  VaultFile,
  VaultScan
} from './types';

const TEXT_EXTENSIONS = new Set([
  '.md', '.markdown', '.txt', '.json', '.jsonc', '.yaml', '.yml', '.css', '.scss', '.less',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.html', '.htm', '.xml', '.svg', '.csv',
  '.tsv', '.toml', '.ini', '.conf', '.sh', '.bat', '.cmd', '.ps1', '.py', '.rb', '.go',
  '.rs', '.java', '.c', '.h', '.cpp', '.hpp', '.tex', '.log', '.gitignore', '.gitattributes'
]);

const SENSITIVE_KEY_RE = /(?:api[_-]?token|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret|password|private[_-]?key)\s*["'`]?\s*[:=]/i;
const TOKEN_VALUE_RE = /(?:ghp_|gho_|ghs_|ghu_|github_pat_|sk-[A-Za-z0-9_-]{12,})/;
const PRIVATE_KEY_RE = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
// Bundled source code contains words like `password:` and token prefixes as
// part of its implementation. Require a plausible *value* for code assets.
const LITERAL_TOKEN_RE = /(?:^|[^A-Za-z0-9_-])(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{24,})/;
const LITERAL_SECRET_ASSIGNMENT_RE = /(?:api[_-]?token|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|private[_-]?key)\s*[\"'`]?\s*[:=]\s*[\"'`]([A-Za-z0-9_+/-]{24,})[\"'`]/i;
const WINDOWS_RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`)
]);

export function normalizeRelPath(value: string): string {
  return value.split('\\').join('/').replace(/^\.\//, '').replace(/\/+/g, '/');
}

export function isSafeRelativePath(value: string): boolean {
  const normalized = normalizeRelPath(value);
  return Boolean(normalized) && !normalized.startsWith('/') && !normalized.split('/').includes('..');
}

function globToRegExp(pattern: string): RegExp {
  const normalized = normalizeRelPath(pattern).replace(/\/$/, '');
  let source = '';
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === '*') {
      if (normalized[i + 1] === '*') {
        i += 1;
        if (normalized[i + 1] === '/') {
          i += 1;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`, 'i');
}

export function matchesPattern(relPath: string, pattern: string): boolean {
  const normalizedPath = normalizeRelPath(relPath);
  const normalizedPattern = normalizeRelPath(pattern);
  if (globToRegExp(normalizedPattern).test(normalizedPath)) return true;
  // A pattern without a slash, such as *.png, applies to any directory level.
  if (!normalizedPattern.includes('/')) {
    return normalizedPath.split('/').some((segment) => globToRegExp(normalizedPattern).test(segment));
  }
  return false;
}

export function matchesAnyPattern(relPath: string, patterns: string[]): string | undefined {
  const normalized = normalizeRelPath(relPath);
  return patterns.find((pattern) => matchesPattern(normalized, pattern));
}

export function isTextFile(relPath: string): boolean {
  const base = path.posix.basename(normalizeRelPath(relPath)).toLowerCase();
  const ext = path.posix.extname(base);
  return TEXT_EXTENSIONS.has(ext) || base === '.gitignore' || base === '.gitattributes' || base === '.env';
}

export function isLfsFile(relPath: string, patterns: string[]): boolean {
  return matchesAnyPattern(relPath, patterns.length ? patterns : DEFAULT_LFS_PATTERNS) !== undefined;
}

export function pathHasWindowsIssue(relPath: string): boolean {
  const normalized = normalizeRelPath(relPath);
  return normalized.split('/').some((segment) => {
    if (!segment || segment.endsWith('.') || segment.endsWith(' ')) return true;
    if (/[<>:"|?*]/.test(segment)) return true;
    const stem = segment.split('.')[0].toUpperCase();
    return WINDOWS_RESERVED.has(stem);
  });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
}

export function formatDateTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return Number.isNaN(date.getTime()) ? String(iso) : date.toLocaleString();
}

export function redact(value: string, token = ''): string {
  let output = value;
  if (token) output = output.split(token).join('[REDACTED]');
  output = output.replace(/(gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, '$1[REDACTED]');
  output = output.replace(/(Authorization:\s*token\s+)[^\s]+/gi, '$1[REDACTED]');
  return output;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let bytesRead = 0;
    do {
      const result = await handle.read(buffer, 0, buffer.length, null);
      bytesRead = result.bytesRead;
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}

export async function readTextForSecretScan(filePath: string, maxBytes = 8 * 1024 * 1024, allowNul = false): Promise<string | null> {
  const stat = await fs.stat(filePath);
  if (stat.size > maxBytes) return null;
  const buffer = await fs.readFile(filePath);
  if (buffer.includes(0) && !allowNul) return null;
  return buffer.toString('utf8');
}

export function isBundledCodeAsset(relPath: string): boolean {
  const normalized = normalizeRelPath(relPath).toLowerCase();
  return /^\.obsidian\/plugins\/.+\/[^/]+\.(?:js|css|mjs|cjs)$/.test(normalized)
    || /^\.obsidian\/themes\/.+\/[^/]+\.css$/.test(normalized);
}

export function looksSensitive(content: string, relPath: string): boolean {
  const lowerPath = relPath.toLowerCase();
  if (lowerPath.endsWith('.pem') || lowerPath.endsWith('.key') || lowerPath.includes('/secrets/')) return true;
  if (PRIVATE_KEY_RE.test(content)) return true;
  if (isBundledCodeAsset(relPath)) {
    return LITERAL_TOKEN_RE.test(content) || LITERAL_SECRET_ASSIGNMENT_RE.test(content);
  }
  return SENSITIVE_KEY_RE.test(content) || TOKEN_VALUE_RE.test(content);
}

export function isLikelySensitivePath(relPath: string): boolean {
  const lower = relPath.toLowerCase();
  return lower.includes('secret') || lower.includes('credential') || lower.endsWith('.pem') || lower.endsWith('.key');
}

async function walkFiles(root: string, current = root, output: string[] = [], embeddedGitRoots: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.name === '.git') {
      if (current !== root) embeddedGitRoots.push(current);
      continue;
    }
    if (entry.isDirectory()) {
      await walkFiles(root, absolute, output, embeddedGitRoots);
    } else if (entry.isFile()) {
      output.push(absolute);
    }
  }
  return output;
}

export async function scanVault(vaultPath: string, settings: GithubVaultSyncSettings): Promise<VaultScan> {
  const files: VaultFile[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const allPatterns = [
    ...DEFAULT_EXCLUDE_PATTERNS,
    ...(settings.includeObsidian ? [] : ['.obsidian/**']),
    ...settings.excludePatterns
  ];
  const embeddedGitRoots: string[] = [];
  const absoluteFiles = await walkFiles(vaultPath, vaultPath, [], embeddedGitRoots);
  const lowerPaths = new Map<string, string[]>();
  const windowsPathIssues: string[] = [];

  for (const absolutePath of absoluteFiles) {
    const relPath = normalizeRelPath(path.relative(vaultPath, absolutePath));
    if (!isSafeRelativePath(relPath)) {
      errors.push(`Unsafe path skipped: ${relPath}`);
      continue;
    }
    const stat = await fs.stat(absolutePath);
    const isText = isTextFile(relPath);
    const exclusionReason = matchesAnyPattern(relPath, allPatterns);
    let sensitive = isLikelySensitivePath(relPath);
    if (!exclusionReason && isText && !sensitive) {
      try {
        const bundledCode = isBundledCodeAsset(relPath);
        const content = await readTextForSecretScan(absolutePath, bundledCode ? 64 * 1024 * 1024 : 8 * 1024 * 1024, bundledCode);
        if (content === null) {
          errors.push(`Cannot inspect text file for secrets; exclude or inspect manually: ${relPath}`);
        } else {
          sensitive = looksSensitive(content, relPath);
        }
      } catch (error) {
        errors.push(`Cannot inspect ${relPath}: ${String(error)}`);
      }
    }
    const effectiveReason = exclusionReason ?? (sensitive ? 'Sensitive configuration detected' : undefined);
    const file: VaultFile = {
      path: relPath,
      absolutePath,
      size: stat.size,
      isText,
      isLfs: isLfsFile(relPath, settings.lfsPatterns),
      excluded: Boolean(effectiveReason),
      sensitive,
      exclusionReason: effectiveReason
    };
    files.push(file);
    const key = relPath.toLocaleLowerCase('en-US');
    const collision = lowerPaths.get(key) ?? [];
    collision.push(relPath);
    lowerPaths.set(key, collision);
    if (pathHasWindowsIssue(relPath)) windowsPathIssues.push(relPath);
  }

  for (const directory of embeddedGitRoots) {
    const relPath = normalizeRelPath(path.relative(vaultPath, directory));
    if (!matchesAnyPattern(`${relPath}/.git`, allPatterns)) {
      errors.push(`Nested Git repository is not staged by the outer vault: ${relPath}. Exclude it or move its Git history outside the vault.`);
    }
  }

  const caseCollisions = [...lowerPaths.values()].filter((paths) => paths.length > 1);
  if (caseCollisions.length) warnings.push(`${caseCollisions.length} case-insensitive path collision(s) detected`);
  if (windowsPathIssues.length) warnings.push(`${windowsPathIssues.length} Windows-incompatible path(s) detected`);

  const included = files.filter((file) => !file.excluded);
  const excluded = files.filter((file) => file.excluded);
  const sensitive = files.filter((file) => file.sensitive);
  const lfsFiles = included.filter((file) => file.isLfs);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const includedBytes = included.reduce((sum, file) => sum + file.size, 0);

  const tooLarge = included.filter((file) => file.size > 100 * 1024 * 1024);
  if (tooLarge.length) warnings.push(`${tooLarge.length} file(s) exceed GitHub's ordinary Git file size limit; they must be tracked by Git LFS`);
  for (const file of tooLarge.filter((entry) => !entry.isLfs)) {
    errors.push(`File exceeds 100 MiB without an LFS rule: ${file.path}`);
  }
  if (includedBytes > 1024 * 1024 * 1024) warnings.push(`Included content is ${formatBytes(includedBytes)}; GitHub storage and LFS quota should be checked before the first upload`);

  return {
    files,
    included,
    excluded,
    sensitive,
    lfsFiles,
    totalBytes,
    includedBytes,
    warnings,
    errors,
    caseCollisions,
    windowsPathIssues
  };
}

export function createSyncManifest(settings: GithubVaultSyncSettings): SyncManifest {
  return {
    schemaVersion: 1,
    branch: settings.branch,
    includeObsidian: settings.includeObsidian,
    excludePatterns: [...settings.excludePatterns],
    lfsPatterns: [...settings.lfsPatterns],
    conflictFolder: settings.conflictFolder,
    generatedBy: 'github-vault-sync'
  };
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function ensureDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
}

export async function removeIfExists(target: string): Promise<void> {
  await fs.rm(target, { recursive: true, force: true });
}

export async function copyDirectory(source: string, destination: string): Promise<void> {
  await fs.cp(source, destination, { recursive: true, force: false, errorOnExist: false });
}

export function getManifestPath(vaultPath: string): string {
  return path.join(vaultPath, SYNC_MANIFEST);
}
