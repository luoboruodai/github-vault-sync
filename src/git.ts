import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_EXCLUDE_PATTERNS,
  DependencyStatus,
  GitChangeEntry,
  GithubVaultSyncSettings,
  RepoBinding
} from './types';
import {
  ensureDirectory, isLikelySensitivePath, isSafeRelativePath, matchesAnyPattern,
  normalizeRelPath, redact, removeIfExists, scanVault
} from './utils';

export interface GitCommandResult {
  stdout: Buffer;
  stderr: Buffer;
  code: number;
}

export class GitCommandError extends Error {
  readonly args: string[];
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;

  constructor(message: string, args: string[], code: number, stdout: Buffer, stderr: Buffer) {
    super(message);
    this.name = 'GitCommandError';
    this.args = args;
    this.code = code;
    this.stdout = stdout.toString('utf8');
    this.stderr = stderr.toString('utf8');
  }
}

export interface GitRunOptions {
  cwd?: string;
  timeoutMs?: number;
  allowFailure?: boolean;
  onOutput?: (chunk: string) => void;
}

export interface GitTransferProgress {
  kind: 'lfs' | 'git';
  completed: number;
  total: number;
  percent: number;
}

/** Parse progress reported by Git/LFS, without claiming bytes we cannot measure. */
export function parseGitTransferProgress(text: string): GitTransferProgress | null {
  const regex = /(Uploading LFS objects|Writing objects):\s*(\d+)%\s*\((\d+)\/(\d+)\)/g;
  let match: RegExpExecArray | null;
  let latest: GitTransferProgress | null = null;
  while ((match = regex.exec(text)) !== null) {
    const completed = Number(match[3]);
    const total = Number(match[4]);
    if (total <= 0 || completed > total) continue;
    latest = {
      kind: match[1] === 'Uploading LFS objects' ? 'lfs' : 'git',
      completed,
      total,
      percent: Math.min(100, Math.max(0, Number(match[2])))
    };
  }
  return latest;
}

export class GitService {
  private gitExecutable = 'git';
  private gitLfsAvailable = false;
  private initialized = false;

  constructor(private readonly vaultPath: string, private readonly settings: GithubVaultSyncSettings) {}

  private get authToken(): string {
    return this.settings.token;
  }

  private async resolveExecutable(): Promise<string> {
    const candidates = process.platform === 'win32'
      ? [
          'git',
          'C:\\Program Files\\Git\\cmd\\git.exe',
          'C:\\Program Files\\Git\\bin\\git.exe',
          'C:\\Program Files (x86)\\Git\\cmd\\git.exe'
        ]
      : ['git', '/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git'];
    for (const candidate of candidates) {
      try {
        const result = await this.runRaw(candidate, ['--version'], { timeoutMs: 15_000, allowFailure: true });
        if (result.code === 0) return candidate;
      } catch {
        // Continue with the next candidate.
      }
    }
    throw new Error('Git executable was not found. Install Git and retry.');
  }

  private async runRaw(command: string, args: string[], options: GitRunOptions = {}): Promise<GitCommandResult> {
    const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000;
    const authDir = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-askpass-'));
    let askpassPath: string | undefined;
    try {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        // Electron apps launched from Finder often omit Homebrew from PATH.
        // Git discovers the installed git-lfs subcommand through this value.
        PATH: process.platform === 'win32'
          ? process.env.PATH
          : [process.env.PATH, '/opt/homebrew/bin', '/usr/local/bin'].filter(Boolean).join(path.delimiter),
        GIT_TERMINAL_PROMPT: '0',
        GIT_OPTIONAL_LOCKS: '0'
      };
      if (this.authToken) {
        if (process.platform === 'win32') {
          askpassPath = path.join(authDir, 'askpass.cmd');
          await fs.writeFile(
            askpassPath,
            '@echo off\r\n'
              + 'echo %~1 | findstr /I "username" >nul\r\n'
              + 'if %errorlevel%==0 (echo %GITHUB_VAULT_SYNC_USERNAME%) else (echo %GITHUB_VAULT_SYNC_TOKEN%)\r\n',
            'utf8'
          );
        } else {
          askpassPath = path.join(authDir, 'askpass.sh');
          await fs.writeFile(
            askpassPath,
            [
              '#!/bin/sh',
              'case "$1" in',
              '  *[Uu]sername*) printf "%s" "$GITHUB_VAULT_SYNC_USERNAME" ;;',
              '  *) printf "%s" "$GITHUB_VAULT_SYNC_TOKEN" ;;',
              'esac',
              ''
            ].join('\n'),
            { encoding: 'utf8', mode: 0o700 }
          );
        }
        env.GIT_ASKPASS = askpassPath;
        env.GITHUB_VAULT_SYNC_TOKEN = this.authToken;
        env.GITHUB_VAULT_SYNC_USERNAME = 'oauth2';
      }

      return await new Promise<GitCommandResult>((resolve, reject) => {
        const child = spawn(command, args, {
          cwd: options.cwd ?? this.vaultPath,
          env,
          shell: false,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          child.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
          const timeoutError = new Error(`Git command timed out after ${Math.round(timeoutMs / 1000)}s: ${args.join(' ')}`);
          settled = true;
          reject(timeoutError);
        }, timeoutMs);

        child.stdout.on('data', (chunk: Buffer) => {
          stdout.push(chunk);
          options.onOutput?.(chunk.toString('utf8'));
        });
        child.stderr.on('data', (chunk: Buffer) => {
          stderr.push(chunk);
          options.onOutput?.(chunk.toString('utf8'));
        });
        child.on('error', (error) => {
          if (settled) return;
          clearTimeout(timer);
          settled = true;
          reject(error);
        });
        child.on('close', (code) => {
          if (settled) return;
          clearTimeout(timer);
          settled = true;
          resolve({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), code: code ?? 1 });
        });
      });
    } finally {
      await removeIfExists(authDir);
    }
  }

  async run(args: string[], options: GitRunOptions = {}): Promise<GitCommandResult> {
    if (!this.initialized) {
      this.gitExecutable = await this.resolveExecutable();
      this.initialized = true;
    }
    const result = await this.runRaw(this.gitExecutable, args, options);
    if (result.code !== 0 && !options.allowFailure) {
      const safeArgs = args.map((arg) => (this.authToken && arg.includes(this.authToken) ? '[REDACTED]' : arg));
      throw new GitCommandError(
        `Git command failed (${result.code}): ${safeArgs.join(' ')}\n${redact(result.stderr.toString('utf8'), this.authToken)}`,
        args,
        result.code,
        result.stdout,
        result.stderr
      );
    }
    return result;
  }

  async text(args: string[], options: GitRunOptions = {}): Promise<string> {
    const result = await this.run(args, options);
    return result.stdout.toString('utf8');
  }

  async tryText(args: string[], options: GitRunOptions = {}): Promise<string | null> {
    const result = await this.run(args, { ...options, allowFailure: true });
    return result.code === 0 ? result.stdout.toString('utf8') : null;
  }

  async dependencies(): Promise<DependencyStatus> {
    let gitVersion = '';
    let gitError: string | undefined;
    let gitAvailable = false;
    try {
      this.gitExecutable = await this.resolveExecutable();
      this.initialized = true;
      gitVersion = (await this.text(['--version'], { timeoutMs: 15_000 })).trim();
      gitAvailable = true;
    } catch (error) {
      gitError = String(error);
    }

    let lfsVersion = '';
    let lfsError: string | undefined;
    let lfsAvailable = false;
    let initialized = false;
    if (gitAvailable) {
      try {
        const result = await this.run(['lfs', 'version'], { timeoutMs: 15_000, allowFailure: true });
        lfsAvailable = result.code === 0;
        lfsVersion = result.stdout.toString('utf8').trim() || result.stderr.toString('utf8').trim();
        if (lfsAvailable) {
          const env = await this.run(['lfs', 'env'], { timeoutMs: 15_000, allowFailure: true });
          initialized = env.code === 0 && /LocalWorkingDir|LocalMediaDir/i.test(env.stdout.toString('utf8'));
        }
      } catch (error) {
        lfsError = String(error);
      }
    }
    this.gitLfsAvailable = lfsAvailable;
    return {
      git: { available: gitAvailable, version: gitVersion, executable: this.gitExecutable, error: gitError },
      gitLfs: { available: lfsAvailable, version: lfsVersion, initialized, error: lfsError }
    };
  }

  async init(branch = 'main'): Promise<void> {
    const gitDir = path.join(this.vaultPath, '.git');
    try {
      const stat = await fs.stat(gitDir);
      if (!stat.isDirectory()) throw new Error(`${gitDir} exists but is not a directory`);
    } catch {
      await this.run(['init', '-b', branch]);
    }
    const current = (await this.tryText(['branch', '--show-current']))?.trim() ?? '';
    if (!current) {
      await this.run(['checkout', '-B', branch]);
    } else if (current !== branch) {
      const branchExists = (await this.run(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { allowFailure: true })).code === 0;
      if (branchExists) await this.run(['checkout', branch]);
      else await this.run(['checkout', '-B', branch]);
    }
    await this.run(['config', 'user.name', this.settings.gitUserName || 'GitHub Vault Sync']);
    await this.run(['config', 'user.email', this.settings.gitUserEmail || 'github-vault-sync@users.noreply.github.com']);
  }

  async ensureLfsInitialized(): Promise<void> {
    if (!this.gitLfsAvailable) throw new Error('Git LFS is not available');
    await this.run(['lfs', 'install', '--local']);
  }

  async setRemote(binding: RepoBinding): Promise<void> {
    const existing = await this.tryText(['remote', 'get-url', 'origin']);
    if (existing?.trim()) {
      if (existing.trim() !== binding.remoteUrl) await this.run(['remote', 'set-url', 'origin', binding.remoteUrl]);
    } else {
      await this.run(['remote', 'add', 'origin', binding.remoteUrl]);
    }
  }

  async getRemoteUrl(): Promise<string | null> {
    return (await this.tryText(['remote', 'get-url', 'origin']))?.trim() || null;
  }

  async hasHead(): Promise<boolean> {
    const result = await this.run(['rev-parse', '--verify', 'HEAD'], { allowFailure: true });
    return result.code === 0;
  }

  async headSha(): Promise<string | null> {
    return (await this.tryText(['rev-parse', 'HEAD']))?.trim() || null;
  }

  async refSha(ref: string): Promise<string | null> {
    return (await this.tryText(['rev-parse', ref]))?.trim() || null;
  }

  async mergeBase(left: string, right: string): Promise<string | null> {
    return (await this.tryText(['merge-base', left, right]))?.trim() || null;
  }

  async branchAheadBehind(local = 'HEAD', remote = 'origin/main'): Promise<{ ahead: number; behind: number }> {
    const output = await this.tryText(['rev-list', '--left-right', '--count', `${local}...${remote}`]);
    if (!output) return { ahead: 0, behind: 0 };
    const [ahead, behind] = output.trim().split(/\s+/).map((value) => Number.parseInt(value, 10));
    return { ahead: Number.isFinite(ahead) ? ahead : 0, behind: Number.isFinite(behind) ? behind : 0 };
  }

  async remoteBranchExists(branch: string): Promise<boolean> {
    const output = await this.tryText(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]);
    return Boolean(output?.trim());
  }

  async fetch(branch: string): Promise<void> {
    await this.run(['fetch', '--prune', 'origin', branch], { onOutput: () => undefined });
  }

  async status(): Promise<Array<{ index: string; worktree: string; path: string; oldPath?: string }>> {
    const result = await this.run(['status', '--porcelain=v1', '-z', '-uall']);
    const tokens = result.stdout.toString('utf8').split('\0').filter(Boolean);
    const output: Array<{ index: string; worktree: string; path: string; oldPath?: string }> = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      const index = token[0] ?? ' ';
      const worktree = token[1] ?? ' ';
      const pathValue = normalizeRelPath(token.slice(3));
      const entry: { index: string; worktree: string; path: string; oldPath?: string } = { index, worktree, path: pathValue };
      if (index === 'R' || worktree === 'R' || index === 'C' || worktree === 'C') {
        entry.oldPath = normalizeRelPath(tokens[i + 1] ?? '');
        i += 1;
      }
      output.push(entry);
    }
    return output;
  }

  async hasWorkingChanges(): Promise<boolean> {
    return (await this.status()).length > 0;
  }

  async changedEntries(base: string, head: string): Promise<GitChangeEntry[]> {
    const result = await this.run(['diff', '--name-status', '-z', base, head]);
    const tokens = result.stdout.toString('utf8').split('\0').filter(Boolean);
    const entries: GitChangeEntry[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const status = tokens[i];
      if (status.startsWith('R') || status.startsWith('C')) {
        const oldPath = normalizeRelPath(tokens[i + 1] ?? '');
        const newPath = normalizeRelPath(tokens[i + 2] ?? '');
        entries.push({ status: status[0], oldPath, path: newPath });
        i += 2;
      } else {
        entries.push({ status: status[0], path: normalizeRelPath(tokens[i + 1] ?? '') });
        i += 1;
      }
    }
    return entries;
  }

  async treePaths(ref: string): Promise<Set<string>> {
    const result = await this.run(['ls-tree', '-r', '--name-only', '-z', ref]);
    return new Set(result.stdout.toString('utf8').split('\0').filter(Boolean).map(normalizeRelPath));
  }

  async showFile(ref: string, relPath: string): Promise<Buffer> {
    return (await this.run(['show', `${ref}:${relPath}`])).stdout;
  }

  async pathExistsInRef(ref: string, relPath: string): Promise<boolean> {
    const result = await this.run(['cat-file', '-e', `${ref}:${relPath}`], { allowFailure: true });
    return result.code === 0;
  }

  async fileSizeAndHash(ref: string, relPath: string): Promise<{ size: number; hash: string } | null> {
    const content = await this.run(['show', `${ref}:${relPath}`], { allowFailure: true });
    if (content.code !== 0) return null;
    const { createHash } = await import('node:crypto');
    return { size: content.stdout.length, hash: createHash('sha256').update(content.stdout).digest('hex') };
  }

  async checkoutPath(ref: string, relPath: string): Promise<void> {
    await this.run(['checkout', ref, '--', relPath]);
  }

  async removeWorkingPath(relPath: string): Promise<void> {
    const tracked = await this.run(['ls-files', '--error-unmatch', '--', relPath], { allowFailure: true });
    if (tracked.code === 0) {
      await this.run(['rm', '-f', '--', relPath]);
    } else {
      await fs.rm(path.join(this.vaultPath, relPath), { force: true, recursive: true });
    }
  }

  async addAll(onProgress?: (completed: number, total: number) => void): Promise<void> {
    // Never stage the whole vault: .git/info/exclude only affects untracked files,
    // so a previously tracked secret would otherwise still be committed.
    const scan = await scanVault(this.vaultPath, this.settings);
    if (scan.errors.length || scan.caseCollisions.length || scan.windowsPathIssues.length) {
      throw new Error(`Vault preflight failed before staging: ${[
        ...scan.errors, ...scan.caseCollisions.map((paths) => paths.join(' / ')), ...scan.windowsPathIssues
      ].slice(0, 20).join('; ')}`);
    }
    const included = new Set(scan.included.map((file) => file.path));
    const excluded = new Set(scan.excluded.map((file) => file.path));
    const rules = [
      ...DEFAULT_EXCLUDE_PATTERNS,
      ...(this.settings.includeObsidian ? [] : ['.obsidian/**']),
      ...this.settings.excludePatterns
    ];
    const tracked = (await this.run(['ls-files', '--cached', '-z'])).stdout.toString('utf8').split('\0').filter(Boolean);
    const paths = new Set(included);
    for (const relPath of tracked) {
      if (!isSafeRelativePath(relPath) || excluded.has(relPath)
          || matchesAnyPattern(relPath, rules) || isLikelySensitivePath(relPath)) {
        throw new Error(`Tracked file is excluded or sensitive; refusing to commit: ${relPath}. Review the repository history and untrack this path before syncing.`);
      }
      if (!included.has(relPath)) {
        // A missing tracked file is a deletion. An existing file absent from the
        // scan is a symlink or unsupported file type and must not be staged.
        try {
          await fs.lstat(path.join(this.vaultPath, relPath));
          throw new Error(`Tracked path is not a regular vault file: ${relPath}`);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        paths.add(relPath);
      }
    }
    const selected = [...paths];
    for (let index = 0; index < selected.length; index += 100) {
      const batch = selected.slice(index, index + 100);
      // Literal pathspecs prevent filenames containing glob characters from
      // matching and accidentally staging another file.
      await this.run(['add', '--all', '--', ...batch.map((entry) => `:(literal)${entry}`)]);
      onProgress?.(Math.min(index + batch.length, selected.length), selected.length);
    }
    const staged = new Set((await this.run(['ls-files', '--cached', '-z'])).stdout.toString('utf8').split('\0').filter(Boolean));
    // A deletion is supposed to disappear from the index. Only existing,
    // included files must remain staged after the add --all pass.
    const missing = scan.included.filter((file) => !staged.has(file.path));
    if (missing.length) throw new Error(`Git could not stage ${missing.length} selected file(s), possibly in an embedded repository: ${missing.slice(0, 5).join(', ')}`);
  }

  async hasStagedChanges(): Promise<boolean> {
    const result = await this.run(['diff', '--cached', '--quiet'], { allowFailure: true });
    return result.code !== 0;
  }

  async commit(message: string, allowEmpty = false): Promise<void> {
    const args = ['commit', '-m', message];
    if (allowEmpty) args.push('--allow-empty');
    await this.run(args);
  }

  async commitWorkingTree(message: string, onProgress?: (completed: number, total: number) => void): Promise<boolean> {
    await this.addAll(onProgress);
    if (!(await this.hasStagedChanges())) return false;
    await this.commit(message);
    return true;
  }

  async push(branch: string, onProgress?: (progress: GitTransferProgress) => void): Promise<void> {
    // A first Git LFS push can contain thousands of attachments and take far
    // longer than a normal Git request on a slow connection.
    let recent = '';
    let last = '';
    await this.run(['push', '--set-upstream', 'origin', branch], {
      timeoutMs: 3 * 60 * 60 * 1000,
      onOutput: (chunk) => {
        recent = (recent + chunk.replace(/\x1b\[[0-9;]*m/g, '')).slice(-4096);
        const progress = parseGitTransferProgress(recent);
        if (!progress) return;
        const key = `${progress.kind}:${progress.completed}/${progress.total}`;
        if (key !== last) {
          last = key;
          onProgress?.(progress);
        }
      }
    });
  }

  async fastForward(remoteRef: string): Promise<void> {
    await this.run(['merge', '--ff-only', remoteRef]);
  }

  async beginOursMerge(remoteRef: string, allowUnrelatedHistories: boolean): Promise<void> {
    const args = ['merge', '--no-commit', '--no-ff', '-s', 'ours'];
    if (allowUnrelatedHistories) args.push('--allow-unrelated-histories');
    args.push(remoteRef);
    await this.run(args);
  }

  async commitMerge(message: string): Promise<void> {
    await this.addAll();
    await this.commit(message);
  }

  async abortMerge(): Promise<void> {
    const result = await this.run(['merge', '--abort'], { allowFailure: true });
    if (result.code !== 0) {
      await this.run(['reset', '--merge'], { allowFailure: true });
    }
  }

  async isMergeInProgress(): Promise<boolean> {
    const gitDir = await this.gitDirAbsolute();
    try {
      await fs.access(path.join(gitDir, 'MERGE_HEAD'));
      return true;
    } catch {
      return false;
    }
  }

  async gitDirAbsolute(): Promise<string> {
    const gitDir = (await this.text(['rev-parse', '--git-dir'])).trim();
    return path.isAbsolute(gitDir) ? gitDir : path.resolve(this.vaultPath, gitDir);
  }

  async writeLocalExclude(entries: string[], previousPatterns: string[] = []): Promise<void> {
    const gitDir = await this.gitDirAbsolute();
    const infoDir = path.join(gitDir, 'info');
    await ensureDirectory(infoDir);
    const excludePath = path.join(infoDir, 'exclude');
    let existing = '';
    try {
      existing = await fs.readFile(excludePath, 'utf8');
    } catch {
      // Create it below.
    }
    const begin = '# BEGIN GITHUB VAULT SYNC EXCLUDES';
    const end = '# END GITHUB VAULT SYNC EXCLUDES';
    const lines = existing.split(/\r?\n/).filter(Boolean);
    const start = lines.indexOf(begin);
    const finish = start < 0 ? -1 : lines.indexOf(end, start + 1);
    let preserved: string[];
    if (finish >= 0) {
      preserved = [...lines.slice(0, start), ...lines.slice(finish + 1)];
    } else {
      // Migrate installations from before this managed block existed. The
      // on-disk manifest records the exclusions used by the last Git commit.
      const generated = new Set([
        ...DEFAULT_EXCLUDE_PATTERNS, ...previousPatterns, ...entries,
        '.git/', '.trash/', '.obsidian/', '.obsidian/cache/',
        '.obsidian/workspace*.json', '.github-vault-sync-conflicts/',
        '.obsidian/plugins/**', '.obsidian/themes/**', '**/.DS_Store'
      ]);
      preserved = lines.filter((line) => !generated.has(line));
    }
    const managed = [...new Set(entries)];
    await fs.writeFile(excludePath, `${[...preserved, begin, ...managed, end].join('\n')}\n`, 'utf8');
  }

  async cleanIncludedFiles(paths: string[]): Promise<void> {
    for (const relPath of paths) {
      if (!relPath || relPath === '.git') continue;
      await fs.rm(path.join(this.vaultPath, relPath), { recursive: true, force: true });
    }
  }

  async currentBranch(): Promise<string | null> {
    return (await this.tryText(['branch', '--show-current']))?.trim() || null;
  }
}
