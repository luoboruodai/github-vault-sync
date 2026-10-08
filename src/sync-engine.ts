import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  ConflictChoice,
  DEFAULT_EXCLUDE_PATTERNS,
  ConflictItem,
  FileChange,
  GithubVaultSyncSettings,
  GitChangeEntry,
  PendingMerge,
  RepoBinding,
  SyncDifference,
  SyncHealth,
  SyncPreview,
  SyncPriority,
  SyncResult,
  SyncSnapshot,
  VaultScan
} from './types';
import { GitService, GitTransferProgress } from './git';
import { ENCRYPTED_BUNDLE, prepareEncryptedBundle, restoreEncryptedBundle } from './encrypted-bundle';
import { changedPaths, summarizeDifference } from './difference';
import { categorizeChanges, isMarkdownNote } from './sync-preview';
import { ensureConflictDirectory, localExcludeEntries, readSyncPolicy, writeSyncPolicy } from './policy';
import {
  ensureDirectory,
  formatBytes,
  isLikelySensitivePath,
  isSafeRelativePath,
  matchesAnyPattern,
  scanVault,
  sha256File
} from './utils';

export type SettingsSaver = () => Promise<void>;
export type SnapshotListener = (snapshot: SyncSnapshot) => void;
export type LogListener = (level: 'info' | 'warn' | 'error', message: string) => void;

export class SyncEngine {
  readonly git: GitService;
  private scanResult: VaultScan | null = null;
  private snapshot: SyncSnapshot = {
    phase: 'idle',
    health: 'unconfigured',
    message: 'Not configured',
    changedFiles: [],
    conflicts: [],
    warnings: []
  };

  constructor(
    private readonly vaultPath: string,
    private readonly settings: GithubVaultSyncSettings,
    private readonly saveSettings: SettingsSaver,
    private readonly onSnapshot: SnapshotListener,
    private readonly onLog: LogListener
  ) {
    this.git = new GitService(vaultPath, settings);
    if (settings.pendingMerge) {
      this.snapshot = { ...this.snapshot, phase: 'waiting-conflicts', health: 'conflicts',
        message: `${settings.pendingMerge.conflicts.length} conflict(s) need resolution`,
        conflicts: settings.pendingMerge.conflicts };
    } else if (settings.repo) {
      this.snapshot = { ...this.snapshot, health: settings.lastStatus === 'unconfigured' ? 'checking' : settings.lastStatus,
        message: settings.lastStatus === 'synced' ? '上次同步完成，正在等待检查' : '仓库已绑定，等待状态检查' };
    }
  }

  getSnapshot(): SyncSnapshot {
    return { ...this.snapshot, difference: this.snapshot.difference ? { ...this.snapshot.difference } : undefined,
      changedFiles: [...this.snapshot.changedFiles], conflicts: [...this.snapshot.conflicts], warnings: [...this.snapshot.warnings] };
  }

  private async persist(): Promise<void> {
    await this.saveSettings();
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    this.onLog(level, message);
  }

  private update(patch: Partial<SyncSnapshot>): SyncSnapshot {
    this.snapshot = { ...this.snapshot, ...patch };
    this.onSnapshot(this.getSnapshot());
    return this.snapshot;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  async dependencies() {
    const dependencies = await this.git.dependencies();
    if (!dependencies.git.available) {
      this.update({ health: 'dependencies-missing', phase: 'error', message: 'Git is not installed', error: dependencies.git.error });
    }
    return dependencies;
  }

  async scan(): Promise<VaultScan> {
    this.update({ phase: 'scanning', health: 'checking', message: 'Scanning vault…',
      progress: undefined, progressDetail: undefined, error: undefined });
    try {
      const encrypted = await prepareEncryptedBundle(this.vaultPath, this.settings);
      if (encrypted.needsRestore) throw new Error('Remote encrypted settings are newer; restore or resolve them before uploading');
      this.scanResult = await scanVault(this.vaultPath, this.settings);
      this.update({
        phase: 'idle',
        health: this.scanResult.errors.length || this.scanResult.caseCollisions.length || this.scanResult.windowsPathIssues.length ? 'error' : 'checking',
        message: `Scanned ${this.scanResult.files.length} files (${formatBytes(this.scanResult.includedBytes)} included)`,
        changedFiles: [],
        warnings: [...this.scanResult.warnings, ...this.scanResult.sensitive.map((file) => `Excluded sensitive file: ${file.path}`)]
      });
      return this.scanResult;
    } catch (error) {
      const message = this.errorMessage(error);
      this.update({ phase: 'error', health: 'error', message, error: message });
      throw error;
    }
  }

  private progressFromGit(transfer: GitTransferProgress): void {
    const label = transfer.kind === 'lfs' ? 'Git LFS 附件' : 'Git 提交对象';
    this.update({ phase: 'uploading', progress: transfer.percent,
      progressDetail: `${label} ${transfer.completed}/${transfer.total}（按对象数）` });
  }

  private async pushWithProgress(branch: string): Promise<void> {
    // Git LFS does not always emit numeric progress without a TTY; do not
    // invent an upload percentage when Git provides none.
    this.update({ phase: 'uploading', progress: undefined, progressDetail: '正在向 GitHub 上传，等待 Git 报告进度…' });
    await this.git.push(branch, (transfer) => this.progressFromGit(transfer));
    this.update({ progress: 100, progressDetail: '上传成功，正在确认状态…' });
  }

  private async finishRemotePull(): Promise<SyncResult> {
    const encrypted = await prepareEncryptedBundle(this.vaultPath, this.settings);
    if (!encrypted.needsRestore) return this.complete('Pulled remote changes');
    const message = '远端加密配置已下载；请先用恢复密钥手动恢复，再继续上传';
    this.settings.lastStatus = 'remote-changes';
    await this.persist();
    this.update({ phase: 'idle', health: 'remote-changes', message,
      progress: undefined, progressDetail: undefined, encryptedNeedsRestore: true });
    return { ok: true, message, changedFiles: [], conflicts: [], warnings: [] };
  }

  private async validatedRemotePaths(remoteRef: string): Promise<Set<string>> {
    const remoteFiles = await this.git.treePaths(remoteRef);
    const forbidden = [...DEFAULT_EXCLUDE_PATTERNS, ...(this.settings.includeObsidian ? [] : ['.obsidian/**']), ...this.settings.excludePatterns];
    for (const file of remoteFiles) {
      if (!isSafeRelativePath(file) || matchesAnyPattern(file, forbidden) || isLikelySensitivePath(file)) {
        throw new Error(`Remote contains an excluded or unsafe path: ${file}. Review the repository before pulling.`);
      }
    }
    return remoteFiles;
  }

  private async compareWithRemote(remoteRef: string, scan: VaultScan): Promise<{ difference: SyncDifference; changedFiles: FileChange[] }> {
    const remoteFiles = await this.validatedRemotePaths(remoteRef);
    const localFiles = new Set(scan.included.map((file) => file.path));
    const status = await this.git.status();
    const base = await this.git.mergeBase('HEAD', remoteRef);
    const localChanged = base ? changedPaths(await this.git.changedEntries(base, 'HEAD')) : await this.git.treePaths('HEAD');
    const remoteChanged = base ? changedPaths(await this.git.changedEntries(base, remoteRef)) : new Set(remoteFiles);
    for (const entry of status) {
      localChanged.add(entry.path);
      if (entry.oldPath) localChanged.add(entry.oldPath);
    }
    const difference = summarizeDifference(localFiles, remoteFiles, localChanged, remoteChanged);
    const fileMap = new Map(scan.included.map((file) => [file.path, file]));
    const changedFiles: FileChange[] = [...new Set([...localChanged, ...remoteChanged])].sort().map((file) => ({
      path: file,
      kind: !localFiles.has(file) || !remoteFiles.has(file) ? 'added' : fileMap.get(file)?.isLfs ? 'binary' : 'modified',
      localStatus: localChanged.has(file) ? 'changed' : undefined,
      remoteStatus: remoteChanged.has(file) ? 'changed' : undefined,
      size: fileMap.get(file)?.size
    }));
    return { difference, changedFiles };
  }

  private async ensureDependencies(requireLfs: boolean): Promise<void> {
    const dependencies = await this.dependencies();
    if (!dependencies.git.available) throw new Error('Git is required. Install Git and retry.');
    if (requireLfs && !dependencies.gitLfs.available) {
      throw new Error('Git LFS is required for one or more attachments. Install Git LFS and retry.');
    }
    if (requireLfs) {
      // `git lfs env` can report a working directory even when a newly
      // initialized repository has no pre-push hook. Always install locally
      // before a push so pointers cannot be published without their objects.
      await this.git.ensureLfsInitialized();
    }
  }

  private validateScan(scan: VaultScan): void {
    if (scan.errors.length) throw new Error(scan.errors.join('\n'));
    if (scan.caseCollisions.length) throw new Error(`Case-insensitive path collisions detected:\n${scan.caseCollisions.map((paths) => paths.join(' ↔ ')).join('\n')}`);
    if (scan.windowsPathIssues.length) throw new Error(`Windows-incompatible paths detected:\n${scan.windowsPathIssues.slice(0, 20).join('\n')}`);
  }

  private async ensureRepo(binding: RepoBinding): Promise<void> {
    // Repository setup must not write working-tree files. Pull/check operations
    // call this method before checkout; writing the policy here could create an
    // untracked file that blocks checkout of the same path from the remote.
    await this.git.init(this.settings.branch || binding.branch || 'main');
    await this.git.setRemote(binding);
    const previousPolicy = await readSyncPolicy(this.vaultPath);
    await this.git.writeLocalExclude(localExcludeEntries(this.settings), previousPolicy?.excludePatterns ?? []);
  }

  async configureRepository(binding: RepoBinding, direction: 'local' | 'remote'): Promise<SyncResult> {
    this.settings.repo = { ...binding, branch: this.settings.branch || binding.branch || 'main' };
    this.settings.branch = this.settings.repo.branch;
    this.settings.lastError = '';
    await this.persist();
    this.update({ phase: 'checking', health: 'checking', message: 'Preparing repository…', warnings: [], error: undefined });

    try {
      const scan = await this.scan();
      this.validateScan(scan);
      // `git lfs install --local` requires an initialized Git repository.
      await this.ensureRepo(this.settings.repo);
      await this.ensureDependencies(scan.lfsFiles.length > 0 || scan.included.some((file) => file.size > 100 * 1024 * 1024));
      const remoteExists = await this.git.remoteBranchExists(this.settings.branch);
      if (!remoteExists) {
        await writeSyncPolicy(this.vaultPath, this.settings);
        const committed = await this.git.commitWorkingTree('Initialize vault sync');
        if (!committed) await this.git.commit('Initialize vault sync', true);
        await this.pushWithProgress(this.settings.branch);
        const sha = await this.git.headSha();
        this.settings.lastRemoteSha = sha ?? '';
        this.settings.lastStatus = 'synced';
        await this.persist();
        return this.complete('Repository initialized from local vault', scan.warnings);
      }

      await this.git.fetch(this.settings.branch);
      await this.validatedRemotePaths(`origin/${this.settings.branch}`);
      if (direction === 'remote') {
        const backup = await this.backupIncludedFiles(scan);
        await this.git.cleanIncludedFiles(scan.included.map((file) => file.path));
        await this.git.run(['checkout', '-B', this.settings.branch, `origin/${this.settings.branch}`]);
        const sha = await this.git.headSha();
        this.settings.lastRemoteSha = sha ?? '';
        this.settings.lastStatus = 'synced';
        await this.persist();
        return this.complete(`Restored remote vault. Local backup: ${backup}`, scan.warnings);
      }

      await writeSyncPolicy(this.vaultPath, this.settings);
      const committed = await this.git.commitWorkingTree('Initialize local vault sync');
      if (!committed && !(await this.git.hasHead())) await this.git.commit('Initialize local vault sync', true);
      const result = await this.reconcileAndPush('Initial repository binding');
      return result;
    } catch (error) {
      return this.fail(error);
    }
  }

  private async backupIncludedFiles(scan: VaultScan): Promise<string> {
    const parent = path.dirname(this.vaultPath);
    const name = path.basename(this.vaultPath);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const destination = path.join(parent, `${name} GitHub Vault Sync Backup ${stamp}`);
    await ensureDirectory(destination);
    for (const file of scan.included) {
      const target = path.join(destination, file.path);
      await ensureDirectory(path.dirname(target));
      await fs.copyFile(file.absolutePath, target);
    }
    return destination;
  }

  private async reconcileAndPush(message: string, priority: SyncPriority = 'manual', approvedRemoteSha?: string): Promise<SyncResult> {
    // An initial LFS push can fail after a local commit was created while the
    // remote branch is still empty. A later Upload must be able to retry it.
    if (!(await this.git.remoteBranchExists(this.settings.branch))) {
      await this.pushWithProgress(this.settings.branch);
      this.settings.lastRemoteSha = await this.git.headSha() ?? '';
      this.settings.lastStatus = 'synced';
      await this.persist();
      return this.complete(message);
    }
    await this.git.fetch(this.settings.branch);
    const remoteRef = `origin/${this.settings.branch}`;
    const remoteSha = await this.git.refSha(remoteRef);
    if (approvedRemoteSha && remoteSha !== approvedRemoteSha) {
      throw new Error('The repository changed during synchronization. Local changes were checkpointed; review the remote branch before pushing.');
    }
    if (remoteSha) await this.validatedRemotePaths(remoteRef);
    const headSha = await this.git.headSha();
    if (!remoteSha || !headSha) {
      await this.pushWithProgress(this.settings.branch);
      return this.complete(message);
    }
    if (remoteSha === headSha) {
      this.settings.lastRemoteSha = remoteSha;
      this.settings.lastStatus = 'synced';
      await this.persist();
      return this.complete(message);
    }
    const state = await this.git.branchAheadBehind('HEAD', remoteRef);
    if (state.behind === 0) {
      await this.pushWithProgress(this.settings.branch);
      this.settings.lastRemoteSha = await this.git.headSha() ?? remoteSha;
      this.settings.lastStatus = 'synced';
      await this.persist();
      return this.complete(message);
    }
    if (state.ahead === 0) {
      await this.git.fastForward(remoteRef);
      this.settings.lastRemoteSha = await this.git.headSha() ?? remoteSha;
      this.settings.lastStatus = 'synced';
      await this.persist();
      return await this.finishRemotePull();
    }
    return this.beginMerge(remoteRef, message, priority);
  }

  private async changedPathSet(base: string | null, ref: string, includeAllWhenNoBase: boolean): Promise<Set<string>> {
    if (base) {
      const entries = await this.git.changedEntries(base, ref);
      const paths = new Set<string>();
      for (const entry of entries) {
        paths.add(entry.path);
        if (entry.oldPath) paths.add(entry.oldPath);
      }
      return paths;
    }
    if (!includeAllWhenNoBase) return new Set();
    return await this.git.treePaths(ref);
  }

  private async mergeEntries(base: string | null, ref: string): Promise<GitChangeEntry[]> {
    if (base) return this.git.changedEntries(base, ref);
    const paths = await this.git.treePaths(ref);
    return Array.from(paths).map((entry) => ({ status: 'A', path: entry }));
  }

  private async beginMerge(remoteRef: string, message: string, priority: SyncPriority = 'manual'): Promise<SyncResult> {
    this.update({ phase: 'merging', health: 'checking', message: 'Preparing file-level merge…', error: undefined });
    const remoteSha = (await this.git.refSha(remoteRef)) ?? '';
    const baseSha = await this.git.mergeBase('HEAD', remoteRef);
    const localPaths = await this.changedPathSet(baseSha, 'HEAD', true);
    const remotePaths = await this.changedPathSet(baseSha, remoteRef, true);
    const conflicts = new Set<string>();
    for (const value of localPaths) if (remotePaths.has(value)) conflicts.add(value);

    const localEntries = await this.mergeEntries(baseSha, 'HEAD');
    const remoteEntries = await this.mergeEntries(baseSha, remoteRef);
    if (localEntries.some((entry) => entry.status === 'R') || remoteEntries.some((entry) => entry.status === 'R')) {
      for (const entry of localEntries.filter((item) => item.status === 'R')) {
        conflicts.add(entry.path);
        if (entry.oldPath) conflicts.add(entry.oldPath);
      }
      for (const entry of remoteEntries.filter((item) => item.status === 'R')) {
        conflicts.add(entry.path);
        if (entry.oldPath) conflicts.add(entry.oldPath);
      }
    }

    await this.git.beginOursMerge(remoteRef, !baseSha);
    const localOnly = new Set([...localPaths].filter((value) => !remotePaths.has(value)));
    const remoteOnly = new Set([...remotePaths].filter((value) => !localPaths.has(value)));
    for (const entry of remoteEntries) {
      const paths = [entry.path, ...(entry.oldPath ? [entry.oldPath] : [])];
      if (!paths.some((value) => remoteOnly.has(value))) continue;
      if (entry.status === 'D') {
        await this.git.removeWorkingPath(entry.path);
      } else if (entry.status === 'R' && entry.oldPath) {
        await this.git.removeWorkingPath(entry.oldPath);
        await this.git.checkoutPath(remoteRef, entry.path);
      } else {
        await this.git.checkoutPath(remoteRef, entry.path);
      }
    }
    await this.git.addAll();

    const conflictItems: ConflictItem[] = [];
    for (const relPath of conflicts) {
      const localExists = await this.git.pathExistsInRef('HEAD', relPath);
      const remoteExists = await this.git.pathExistsInRef(remoteRef, relPath);
      const localInfo = localExists ? await this.git.fileSizeAndHash('HEAD', relPath) : null;
      const remoteInfo = remoteExists ? await this.git.fileSizeAndHash(remoteRef, relPath) : null;
      conflictItems.push({
        path: relPath,
        localRef: 'HEAD',
        remoteRef,
        localExists,
        remoteExists,
        localHash: localInfo?.hash,
        remoteHash: remoteInfo?.hash,
        localSize: localInfo?.size,
        remoteSize: remoteInfo?.size,
        // The preview's preference applies only to Markdown notes. Plugin
        // configs, encrypted bundles and binary attachments need a file-level
        // choice rather than silently inheriting that preference.
        choice: priority !== 'manual' && isMarkdownNote(relPath) ? priority : null
      });
    }

    if (!conflictItems.length) {
      await this.git.commitMerge(message);
      await this.pushWithProgress(this.settings.branch);
      this.settings.lastRemoteSha = await this.git.headSha() ?? remoteSha;
      this.settings.lastStatus = 'synced';
      await this.persist();
      return this.complete('Merged and uploaded remote changes');
    }

    const sessionFolder = new Date().toISOString().replace(/[:.]/g, '-');
    await ensureConflictDirectory(this.vaultPath, this.settings, sessionFolder);
    const pending: PendingMerge = {
      remoteRef,
      remoteSha,
      baseSha,
      conflicts: conflictItems,
      startedAt: new Date().toISOString(),
      sessionFolder
    };
    this.settings.pendingMerge = pending;
    this.settings.lastStatus = 'conflicts';
    await this.persist();
    this.update({
      phase: 'waiting-conflicts',
      health: 'conflicts',
      message: `${conflictItems.length} conflict(s) need a file-level choice`,
      conflicts: conflictItems,
      changedFiles: [],
      warnings: []
    });
    if (conflictItems.every((item) => item.choice)) {
      const choices = Object.fromEntries(conflictItems.map((item) => [item.path, item.choice]));
      return await this.resolvePending(choices);
    }
    return {
      ok: false,
      message: 'Conflicts need resolution',
      changedFiles: [],
      conflicts: conflictItems,
      warnings: []
    };
  }

  async resolvePending(choices: Record<string, ConflictChoice>): Promise<SyncResult> {
    const pending = this.settings.pendingMerge;
    if (!pending) throw new Error('There is no pending merge');
    this.update({ phase: 'merging', health: 'conflicts', message: 'Applying conflict choices…' });
    try {
      const conflictFolder = await ensureConflictDirectory(this.vaultPath, this.settings, pending.sessionFolder);
      for (const conflict of pending.conflicts) {
        const choice = choices[conflict.path] ?? conflict.choice;
        if (!choice) throw new Error(`Choose a version for ${conflict.path}`);
        await this.applyConflictChoice(conflict, choice, conflictFolder);
      }
      await this.git.commitMerge('Sync remote changes');
      await this.pushWithProgress(this.settings.branch);
      this.settings.pendingMerge = null;
      this.settings.lastRemoteSha = await this.git.headSha() ?? pending.remoteSha;
      this.settings.lastStatus = 'synced';
      await this.persist();
      return this.complete('Conflicts resolved and changes uploaded');
    } catch (error) {
      return this.fail(error);
    }
  }

  private async applyConflictChoice(conflict: ConflictItem, choice: Exclude<ConflictChoice, null>, conflictFolder: string): Promise<void> {
    if (!isSafeRelativePath(conflict.path)) throw new Error(`Unsafe conflict path: ${conflict.path}`);
    const copyVersion = async (ref: string, suffix: 'local' | 'remote'): Promise<void> => {
      const target = path.join(conflictFolder, `${conflict.path}.${suffix}`);
      await ensureDirectory(path.dirname(target));
      const blob = await this.git.showFile(ref, conflict.path);
      // For a Git LFS file this copy is its Git pointer; the selected file and
      // both Git commits still retain the actual LFS objects. Markdown notes
      // are stored byte-for-byte here.
      try { await fs.writeFile(target, blob, { flag: 'wx' }); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if (!(await fs.readFile(target)).equals(blob)) throw new Error(`Conflict backup changed: ${target}`);
      }
    };
    if (conflict.remoteExists && (choice === 'local' || choice === 'both')) {
      await copyVersion(conflict.remoteRef, 'remote');
    }
    if (conflict.localExists && (choice === 'remote' || choice === 'both')) {
      await copyVersion(conflict.localRef, 'local');
    }
    if (choice === 'local') {
      if (conflict.localExists) await this.git.checkoutPath(conflict.localRef, conflict.path);
      else await this.git.removeWorkingPath(conflict.path);
    } else if (choice === 'remote') {
      if (conflict.remoteExists) await this.git.checkoutPath(conflict.remoteRef, conflict.path);
      else await this.git.removeWorkingPath(conflict.path);
    } else {
      if (conflict.localExists) {
        await this.git.checkoutPath(conflict.localRef, conflict.path);
      } else if (conflict.remoteExists) {
        await this.git.checkoutPath(conflict.remoteRef, conflict.path);
      } else {
        await this.git.removeWorkingPath(conflict.path);
      }
    }
  }

  async abortPending(): Promise<SyncResult> {
    if (!this.settings.pendingMerge) return this.complete('No pending merge');
    try {
      await this.git.abortMerge();
      const session = this.settings.pendingMerge.sessionFolder;
      this.settings.pendingMerge = null;
      this.settings.lastStatus = 'local-changes';
      await this.persist();
      this.update({ phase: 'idle', health: 'local-changes', message: `Merge aborted; conflict copies remain in ${this.settings.conflictFolder}/${session}` });
      return { ok: true, message: 'Merge aborted', changedFiles: [], conflicts: [], warnings: [] };
    } catch (error) {
      return this.fail(error);
    }
  }

  async saveLocalCheckpoint(): Promise<SyncResult> {
    try {
      const scan = await this.scan();
      this.validateScan(scan);
      await this.ensureDependencies(scan.lfsFiles.length > 0 || scan.included.some((file) => file.size > 100 * 1024 * 1024));
      if (!this.settings.repo) throw new Error('Bind a GitHub repository first');
      await this.ensureRepo(this.settings.repo);
      await writeSyncPolicy(this.vaultPath, this.settings);
      const committed = await this.git.commitWorkingTree(`Local checkpoint ${new Date().toISOString()}`);
      if (!committed) return this.complete('No local changes to checkpoint');
      this.settings.lastStatus = 'local-changes';
      await this.persist();
      return this.complete('Local changes checkpointed');
    } catch (error) {
      return this.fail(error);
    }
  }

  async upload(priority: SyncPriority = 'manual', approvedRemoteSha?: string): Promise<SyncResult> {
    if (!this.settings.repo) throw new Error('Bind a GitHub repository first');
    if (this.settings.pendingMerge) return this.conflictResult();
    this.update({ phase: 'uploading', health: 'checking', message: 'Preparing local upload…',
      progress: 0, progressDetail: '准备扫描 Vault…', error: undefined });
    try {
      const scan = await this.scan();
      this.validateScan(scan);
      await this.ensureDependencies(scan.lfsFiles.length > 0 || scan.included.some((file) => file.size > 100 * 1024 * 1024));
      await this.ensureRepo(this.settings.repo);
      await writeSyncPolicy(this.vaultPath, this.settings);
      this.update({ phase: 'staging', progress: 0, progressDetail: '正在检查并暂存本地文件…' });
      const committed = await this.git.commitWorkingTree(`Sync local changes ${new Date().toISOString()}`, (done, total) => {
        this.update({ phase: 'staging', progress: Math.round(done / total * 100),
          progressDetail: `本地文件已暂存 ${done}/${total}` });
      });
      if (!committed) return await this.reconcileAndPush('No local changes to upload', priority, approvedRemoteSha);
      return await this.reconcileAndPush('Local changes uploaded', priority, approvedRemoteSha);
    } catch (error) {
      return this.fail(error);
    }
  }

  async pull(): Promise<SyncResult> {
    if (!this.settings.repo) throw new Error('Bind a GitHub repository first');
    if (this.settings.pendingMerge) return this.conflictResult();
    this.update({ phase: 'pulling', health: 'checking', message: 'Checking remote changes…', error: undefined });
    try {
      const status = await this.git.status();
      if (status.length) throw new Error('Local files have uncommitted changes. Create a local checkpoint before pulling.');
      await this.ensureRepo(this.settings.repo);
      await this.ensureDependencies(false);
      const exists = await this.git.remoteBranchExists(this.settings.branch);
      if (!exists) throw new Error(`Remote branch ${this.settings.branch} does not exist`);
      await this.git.fetch(this.settings.branch);
      const remoteRef = `origin/${this.settings.branch}`;
      const remoteSha = await this.git.refSha(remoteRef);
      if (remoteSha) await this.validatedRemotePaths(remoteRef);
      const headSha = await this.git.headSha();
      if (remoteSha && remoteSha === headSha) return this.complete('Already up to date');
      if (!headSha && remoteSha) {
        await this.git.run(['checkout', '-B', this.settings.branch, remoteRef]);
        this.settings.lastRemoteSha = remoteSha;
        this.settings.lastStatus = 'synced';
        await this.persist();
        return await this.finishRemotePull();
      }
      if (!remoteSha) throw new Error('Remote branch has no commit');
      return await this.reconcileAndPush('Remote changes pulled');
    } catch (error) {
      return this.fail(error);
    }
  }

  async checkRemote(): Promise<SyncResult> {
    if (!this.settings.repo) return this.complete('No repository configured');
    if (this.settings.pendingMerge) return this.conflictResult();
    this.update({ phase: 'checking', health: 'checking', message: 'Checking GitHub…',
      progress: undefined, progressDetail: undefined, error: undefined });
    try {
      await this.ensureRepo(this.settings.repo);
      const deps = await this.dependencies();
      if (!deps.git.available) throw new Error('Git is required');
      const encrypted = await prepareEncryptedBundle(this.vaultPath, this.settings);
      await this.git.fetch(this.settings.branch);
      const remoteRef = `origin/${this.settings.branch}`;
      const remoteSha = await this.git.refSha(remoteRef);
      if (!remoteSha) throw new Error(`Remote branch ${this.settings.branch} does not exist`);
      const scan = await scanVault(this.vaultPath, this.settings);
      this.validateScan(scan);
      this.scanResult = scan;
      const { difference, changedFiles } = await this.compareWithRemote(remoteRef, scan);
      const health: SyncHealth = encrypted.needsRestore || difference.remoteChanged > 0 ? 'remote-changes'
        : difference.localChanged > 0 ? 'local-changes' : 'synced';
      const message = encrypted.needsRestore ? '加密配置包有远端更新，需手动恢复后再上传'
        : `本地变化 ${difference.localChanged} · 远端变化 ${difference.remoteChanged} · 文件差异 ${difference.differencePercent}%`;
      this.settings.lastStatus = health;
      this.settings.lastRemoteSha = remoteSha;
      this.settings.lastError = '';
      await this.persist();
      const warnings = [...scan.warnings, ...scan.sensitive.map((file) => `Excluded sensitive file: ${file.path}`)];
      this.update({ phase: 'idle', health, message, difference, changedFiles, warnings,
        encryptedNeedsRestore: encrypted.needsRestore, error: undefined });
      return { ok: true, message, changedFiles, conflicts: [], warnings };
    } catch (error) {
      return this.fail(error);
    }
  }

  private async localFingerprint(): Promise<string> {
    const digest = createHash('sha256');
    digest.update(JSON.stringify({
      head: await this.git.headSha(), branch: this.settings.branch,
      includeObsidian: this.settings.includeObsidian,
      excluded: this.settings.excludePatterns, lfs: this.settings.lfsPatterns,
      encrypted: this.settings.encryptedSyncEnabled,
      encryptedFolders: this.settings.encryptedFolders,
      encryptedDigest: this.settings.encryptionLastDigest
    }));
    const status = (await this.git.status()).sort((a, b) => a.path.localeCompare(b.path));
    for (const entry of status) {
      digest.update(JSON.stringify(entry));
      for (const rel of [entry.path, ...(entry.oldPath ? [entry.oldPath] : [])]) {
        if (!isSafeRelativePath(rel)) throw new Error(`Unsafe changed file path: ${rel}`);
        try {
          const absolute = path.join(this.vaultPath, rel);
          const info = await fs.lstat(absolute);
          if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Changed path is not a regular file: ${rel}`);
          digest.update(`${rel}:${await sha256File(absolute)}`);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          digest.update(`${rel}:missing`);
        }
      }
    }
    return digest.digest('hex');
  }

  async previewSync(): Promise<SyncPreview> {
    if (!this.settings.repo) throw new Error('Bind a private repository first');
    if (this.settings.pendingMerge) throw new Error('Resolve the previous conflicts before starting another sync');
    const result = await this.checkRemote();
    if (!result.ok || !this.snapshot.difference || !this.settings.lastRemoteSha) {
      throw new Error(result.message || 'Could not compare the local vault and repository');
    }
    if (this.snapshot.encryptedNeedsRestore) {
      throw new Error('先恢复远端加密配置，再进行笔记同步');
    }
    const groups = categorizeChanges(result.changedFiles,
      this.scanResult?.included.map((file) => file.path).filter(isMarkdownNote) ?? []);
    return {
      remoteSha: this.settings.lastRemoteSha,
      localFingerprint: await this.localFingerprint(),
      createdAt: new Date().toISOString(), priority: null,
      ...groups, difference: { ...this.snapshot.difference }, warnings: [...this.snapshot.warnings]
    };
  }

  async syncApproved(preview: SyncPreview, priority: SyncPriority): Promise<SyncResult> {
    if (!['local', 'remote', 'manual'].includes(priority)) throw new Error('Select a note conflict priority');
    if (this.settings.pendingMerge) return this.conflictResult();
    try {
      await this.git.fetch(this.settings.branch);
      const remoteSha = await this.git.refSha(`origin/${this.settings.branch}`);
      if (remoteSha !== preview.remoteSha) {
        throw new Error('The repository changed after the preview. Review its latest files before syncing.');
      }
      const encrypted = await prepareEncryptedBundle(this.vaultPath, this.settings);
      if (encrypted.needsRestore) throw new Error('Remote encrypted settings changed; restore and review them before uploading.');
      if (await this.localFingerprint() !== preview.localFingerprint) {
        throw new Error('Local notes or sync settings changed after the preview. Review the latest files before syncing.');
      }
      return await this.upload(priority, preview.remoteSha);
    } catch (error) {
      return this.fail(error);
    }
  }

  private conflictResult(): SyncResult {
    const conflicts = this.settings.pendingMerge?.conflicts ?? [];
    this.update({ phase: 'waiting-conflicts', health: 'conflicts', message: `${conflicts.length} conflict(s) need resolution`, conflicts });
    return { ok: false, message: 'Conflicts need resolution', changedFiles: [], conflicts, warnings: [] };
  }

  private complete(message: string, warnings: string[] = []): SyncResult {
    this.settings.lastError = '';
    this.update({ phase: 'completed', health: 'synced', message, warnings,
      progress: 100, progressDetail: '同步完成', changedFiles: [], encryptedNeedsRestore: false,
      difference: { localChanged: 0, remoteChanged: 0, differingPaths: 0,
        totalPaths: this.scanResult?.included.length ?? this.snapshot.difference?.totalPaths ?? 0,
        differencePercent: 0, checkedAt: new Date().toISOString() },
      error: undefined, conflicts: [] });
    return { ok: true, message, changedFiles: this.snapshot.changedFiles, conflicts: [], warnings };
  }

  async restoreEncryptedSettings(restoreSelf = false): Promise<SyncResult> {
    if (!this.settings.encryptionKey) throw new Error('Import a recovery key before restoring');
    try {
      const restored = await restoreEncryptedBundle(this.vaultPath, this.settings, restoreSelf);
      if (restoreSelf) {
        const own = JSON.parse(await fs.readFile(path.join(this.vaultPath, '.obsidian', 'plugins', 'github-vault-sync', 'data.json'), 'utf8')) as GithubVaultSyncSettings;
        Object.assign(this.settings, own);
      }
      this.settings.lastStatus = 'synced';
      await this.persist();
      const message = `已恢复 ${restored.restored} 个加密文件；覆盖前的备份：${restored.backup}。请重启 Obsidian。`;
      this.update({ phase: 'idle', health: 'synced', message, encryptedNeedsRestore: false });
      return { ok: true, message, changedFiles: [], conflicts: [], warnings: [] };
    } catch (error) {
      return this.fail(error);
    }
  }

  private async fail(error: unknown): Promise<SyncResult> {
    const message = this.errorMessage(error);
    this.settings.lastError = message;
    this.settings.lastStatus = this.settings.pendingMerge ? 'conflicts' : 'error';
    await this.persist();
    this.log('error', message);
    this.update({ phase: 'error', health: this.settings.pendingMerge ? 'conflicts' : 'error', message,
      progress: undefined, progressDetail: undefined, error: message });
    return { ok: false, message, changedFiles: [], conflicts: this.settings.pendingMerge?.conflicts ?? [], warnings: [] };
  }
}
