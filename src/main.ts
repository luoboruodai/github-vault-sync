import {
  App,
  Modal,
  Notice,
  TFile,
  setIcon,
  Plugin,
  PluginSettingTab,
  Setting
} from 'obsidian';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ENCRYPTED_BUNDLE, generateRecoveryKey, inspectEncryptedBundle,
  validateRecoveryKey, writeRecoveryKeyFile } from './encrypted-bundle';
import { GithubClient } from './github';
import { SyncEngine } from './sync-engine';
import { CurrentNotePlan, embeddedAttachmentPaths } from './current-note';
import { buildAllConversionCommands, mediaKindLabel } from './media-scan';
import { isMarkdownNote } from './sync-preview';
import { nextSettingsTab, SETTINGS_TABS, SettingsSection, showSettingsTab } from './settings-tabs';
import { normalizeHttpProxy, normalizeSettings } from './settings';
import {
  ConflictChoice,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_SETTINGS,
  FileChange,
  InitialBindingPreview,
  GithubVaultSyncSettings,
  RepoBinding,
  SyncHealth,
  SyncPreview,
  SyncPriority,
  SyncResult,
  SyncSnapshot,
  VaultScan
} from './types';
import { formatBytes, formatDateTime, isLikelySensitivePath, isSafeRelativePath, matchesAnyPattern } from './utils';

function vaultBasePath(app: App): string {
  const adapter = app.vault.adapter as unknown as { getBasePath?: () => string; basePath?: string };
  const basePath = adapter.getBasePath?.() ?? adapter.basePath;
  if (!basePath) throw new Error('Unable to determine the local Vault path');
  return basePath;
}

function repoNameFromVault(vaultPath: string): string {
  const raw = path.basename(vaultPath).normalize('NFKC').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return (raw || 'obsidian-vault').slice(0, 90);
}

function healthLabel(health: SyncHealth): string {
  const labels: Record<SyncHealth, string> = {
    unconfigured: '未配置',
    'dependencies-missing': '依赖缺失',
    unauthenticated: '未登录',
    checking: '检查中',
    'local-changes': '本地有修改',
    'remote-changes': '远端有更新',
    conflicts: '存在冲突',
    synced: '同步完成',
    error: '同步失败'
  };
  return labels[health];
}

function renderSyncSummary(container: HTMLElement, snapshot: SyncSnapshot): void {
  container.empty();
  container.dataset.health = snapshot.health;
  container.dataset.phase = snapshot.phase;

  const active = ['checking', 'scanning', 'staging', 'fetching', 'uploading', 'pulling', 'merging'].includes(snapshot.phase);
  const synced = snapshot.difference && snapshot.difference.differingPaths === 0 &&
    (snapshot.phase === 'completed' || snapshot.phase === 'idle');
  const title = synced
    ? `本机与仓库一致 · ${snapshot.difference?.totalPaths ?? 0} 个文件`
    : snapshot.progressDetail || snapshot.message;
  const state = container.createDiv({ cls: 'github-vault-sync-summary-state' });
  const dot = state.createSpan({ cls: 'github-vault-sync-summary-dot' });
  dot.setAttribute('aria-hidden', 'true');
  state.createEl('strong', { cls: 'github-vault-sync-summary-title', text: title });
  if (active) state.createEl('span', { cls: 'github-vault-sync-summary-live', text: '进行中' });

  if (snapshot.difference) {
    const diff = snapshot.difference;
    const metrics = container.createDiv({ cls: 'github-vault-sync-summary-metrics' });
    for (const [label, value] of [
      ['本机变化', String(diff.localChanged)],
      ['仓库变化', String(diff.remoteChanged)],
      ['文件差异', `${diff.differingPaths}/${diff.totalPaths}`],
      ['差异率', `${diff.differencePercent}%`]
    ] as const) {
      const item = metrics.createDiv({ cls: 'github-vault-sync-summary-metric' });
      item.createEl('span', { text: label });
      item.createEl('strong', { text: value });
    }
    container.createEl('small', { cls: 'github-vault-sync-summary-caption',
      text: `按文件路径统计 · 最近检查 ${formatDateTime(diff.checkedAt)}` });
  } else if (!active) {
    container.createEl('p', { cls: 'github-vault-sync-summary-empty',
      text: '尚未完成一次本机与仓库检查。点击“预览并同步”开始。' });
  }

  if (active) {
    const progress = document.createElement('progress');
    progress.className = 'github-vault-sync-progress';
    progress.max = 100;
    if (snapshot.progress !== undefined) progress.value = snapshot.progress;
    progress.setAttribute('aria-label', snapshot.progressDetail || '同步进行中');
    container.appendChild(progress);
    if (snapshot.progress !== undefined) container.createEl('small', { cls: 'github-vault-sync-progress-label', text: `当前阶段 ${snapshot.progress}%` });
  }
  if (snapshot.error) {
    container.createEl('p', { cls: 'github-vault-sync-error-text',
      text: `错误${snapshot.errorAt ? `（${formatDateTime(snapshot.errorAt)}）` : ''}：${snapshot.error}` });
  }
  if (snapshot.encryptedNeedsRestore) {
    container.createEl('p', { cls: 'github-vault-sync-error-text',
      text: '远端加密配置已更新；请导入恢复密钥并手动恢复，自动同步暂时暂停。' });
  }
  if (snapshot.changedFiles.length) {
    const list = container.createEl('ul', { cls: 'github-vault-sync-change-list' });
    for (const item of snapshot.changedFiles.slice(0, 12)) {
      list.createEl('li', { text: `${item.localStatus ? '本地 ' : ''}${item.remoteStatus ? '远端 ' : ''}${item.path}` });
    }
    if (snapshot.changedFiles.length > 12) list.createEl('li', { text: `另外 ${snapshot.changedFiles.length - 12} 个文件…` });
  }
}

export default class GithubVaultSyncPlugin extends Plugin {
  settings: GithubVaultSyncSettings = { ...DEFAULT_SETTINGS, excludePatterns: [...DEFAULT_SETTINGS.excludePatterns], lfsPatterns: [...DEFAULT_SETTINGS.lfsPatterns] };
  engine!: SyncEngine;
  private statusBar!: HTMLElement;
  private statusLabel!: HTMLButtonElement;
  private currentNoteButton!: HTMLButtonElement;
  private vaultPath = '';
  private actionRunning = false;
  private autoTimer: number | null = null;
  private autoPending = false;
  private lastAutoAlert = '';
  private readonly snapshotListeners = new Set<(snapshot: SyncSnapshot) => void>();

  async onload(): Promise<void> {
    const loaded = await this.loadData() as Partial<GithubVaultSyncSettings> | null;
    const normalized = normalizeSettings(loaded);
    this.settings = normalized.settings;
    this.vaultPath = vaultBasePath(this.app);
    if (normalized.changed) await this.saveSensitiveSettings();
    this.engine = new SyncEngine(
      this.vaultPath,
      this.settings,
      async () => this.saveSensitiveSettings(),
      (snapshot) => this.updateStatus(snapshot),
      (level, message) => this.addLog(level, message)
    );

    this.statusBar = this.addStatusBarItem();
    this.statusBar.addClass('github-vault-sync-status');
    this.statusLabel = this.statusBar.createEl('button', {
      cls: 'github-vault-sync-status-info',
      text: 'GitHub Sync'
    });
    this.statusLabel.type = 'button';
    this.statusLabel.addEventListener('click', () => this.openSyncCenter());
    this.currentNoteButton = this.statusBar.createEl('button', {
      cls: 'github-vault-sync-current-note-button',
      text: '同步当前笔记'
    });
    this.currentNoteButton.type = 'button';
    this.currentNoteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      void this.previewActiveNote();
    });
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.updateCurrentNoteButton()));
    this.registerEvent(this.app.workspace.on('file-open', () => this.updateCurrentNoteButton()));
    this.updateStatus(this.engine.getSnapshot());
    this.addSettingTab(new GithubVaultSyncSettingTab(this.app, this));

    this.addCommand({ id: 'connect-github', name: '连接 GitHub', callback: () => void this.connectGithub() });
    this.addCommand({ id: 'bind-repository', name: '创建或绑定同步仓库', callback: () => void this.bindRepository() });
    this.addCommand({ id: 'scan-changes', name: '扫描本地/远端变化', callback: () => void this.runAction('scan', () => this.engine.checkRemote()) });
    this.addCommand({ id: 'sync-now', name: '预览并同步笔记', callback: () => void this.syncNow() });
    this.addCommand({ id: 'sync-current-note', name: '预览并同步当前笔记', icon: 'cloud-upload',
      checkCallback: (checking) => {
        const note = this.app.workspace.getActiveFile();
        if (!note || !isMarkdownNote(note.path) || !this.settings.repo?.private || !this.settings.token) return false;
        if (!checking) void this.previewActiveNote(note);
        return true;
      } });
    this.addCommand({ id: 'open-sync-center', name: '打开同步中心', callback: () => this.openSyncCenter() });
    this.addCommand({ id: 'check-dependencies', name: '重新检测 Git/Git LFS', callback: () => void this.checkDependencies() });
    this.addCommand({ id: 'restore-encrypted-settings', name: '恢复加密的插件配置', callback: () => void this.restorePrivateSettings() });
    this.addCommand({ id: 'open-sync-log', name: '查看同步日志', callback: () => this.openLogs() });
    this.addCommand({ id: 'disconnect-repository', name: '断开仓库与清除凭据', callback: () => void this.disconnect() });

    this.addRibbonIcon('git-branch', 'GitHub Vault Sync', () => this.openSyncCenter())
      .addClass('github-vault-sync-ribbon');
    this.registerEvent(this.app.vault.on('modify', (file) => this.scheduleAutoSync(file.path)));
    this.registerEvent(this.app.vault.on('create', (file) => this.scheduleAutoSync(file.path)));
    this.registerEvent(this.app.vault.on('delete', (file) => this.scheduleAutoSync(file.path)));
    this.registerEvent(this.app.vault.on('rename', (file, previous) => {
      this.scheduleAutoSync(file.path);
      this.scheduleAutoSync(previous);
    }));
    this.registerInterval(window.setInterval(() => void this.pollAutomaticSync(), 5 * 60 * 1000));
    this.register(() => {
      if (this.autoTimer !== null) window.clearTimeout(this.autoTimer);
      this.snapshotListeners.clear();
    });
    window.setTimeout(() => {
      if (this.settings.startupCheck && this.settings.repo) void this.startupCheck();
    }, 1800);
  }

  onunload(): void {
    // The Git operations are short-lived child processes; no persistent watcher is used.
  }

  private updateCurrentNoteButton(): void {
    if (!this.currentNoteButton) return;
    const note = this.getCurrentNote();
    const ready = Boolean(note && this.settings.repo?.private && this.settings.token && !this.actionRunning);
    this.currentNoteButton.disabled = !ready;
    this.currentNoteButton.toggleClass('is-disabled', !ready);
    this.currentNoteButton.setAttribute('aria-label', note
      ? `同步当前笔记：${note.path}`
      : '请先打开一篇 Markdown 笔记');
    this.currentNoteButton.setAttribute('title', note
      ? ready ? `同步当前笔记：${note.path}` : '请先连接私有仓库，或等待当前同步任务完成'
      : '请先打开一篇 Markdown 笔记');
  }

  getCurrentNote(): TFile | null {
    const selected = this.app.workspace.getActiveFile();
    return selected && isMarkdownNote(selected.path) ? selected : null;
  }

  async previewActiveNote(note = this.getCurrentNote()): Promise<void> {
    if (!note) { new Notice('请先在 Obsidian 打开一篇 Markdown 笔记。'); return; }
    if (this.actionRunning) { new Notice('已有同步检查正在运行，请稍后。'); return; }
    this.actionRunning = true;
    this.updateCurrentNoteButton();
    try {
      const embeds = this.app.metadataCache.getFileCache(note)?.embeds ?? [];
      const linked = embeddedAttachmentPaths(note.path, embeds, (link, sourcePath) =>
        this.app.metadataCache.getFirstLinkpathDest(link, sourcePath)?.path);
      const plan = await this.engine.previewCurrentNote(note.path, linked);
      new CurrentNoteModal(this.app, plan, async () => {
        await this.runAction('current-note-sync', () => this.engine.syncCurrentNote(plan));
      }, async () => { await this.syncNow(); }, async () => {
        await this.openNoteComparison(note.path, plan.remoteSha);
      }).open();
    } catch (error) {
      new Notice(`不能只同步这篇笔记：${error instanceof Error ? error.message : String(error)}。可打开全库预览处理。`, 11000);
    } finally {
      this.actionRunning = false;
      this.updateCurrentNoteButton();
    }
  }

  async saveSensitiveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // POSIX modes do not provide equivalent Windows access control; on Windows
    // the Vault's ACL must be managed by its owner.
    if (process.platform !== 'win32') {
      await fs.chmod(path.join(this.vaultPath, '.obsidian', 'plugins', 'github-vault-sync', 'data.json'), 0o600);
    }
  }

  private async startupCheck(): Promise<void> {
    await this.runAction('startup-check', () => this.engine.checkRemote(), false);
    const snapshot = this.engine.getSnapshot();
    if (this.settings.autoSyncEnabled) this.notifyReviewNeeded(snapshot);
    if (snapshot.health === 'conflicts') {
      this.openConflicts();
    }
  }

  private updateStatus(snapshot: SyncSnapshot): void {
    if (this.statusBar) {
      this.statusLabel.setText(`GitHub Sync · ${healthLabel(snapshot.health)}`);
      this.statusLabel.setAttribute('aria-label', snapshot.message);
      this.statusBar.setAttribute('aria-label', snapshot.message);
      this.statusBar.dataset.health = snapshot.health;
      this.statusBar.toggleClass('github-vault-sync-error', snapshot.health === 'error');
      this.statusBar.toggleClass('github-vault-sync-conflict', snapshot.health === 'conflicts');
      this.updateCurrentNoteButton();
    }
    for (const listener of this.snapshotListeners) listener(snapshot);
  }

  subscribeSnapshot(listener: (snapshot: SyncSnapshot) => void): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  isBusy(): boolean { return this.actionRunning; }

  private remoteExecutableChangesNeedReview(): boolean {
    const snapshot = this.engine.getSnapshot();
    return Boolean(snapshot.encryptedNeedsRestore) || snapshot.changedFiles.some((item) =>
      Boolean(item.remoteStatus) && (/^\.obsidian\/(?:plugins|themes)\//.test(item.path) || item.path === ENCRYPTED_BUNDLE));
  }

  private notifyReviewNeeded(snapshot: SyncSnapshot): void {
    if (!this.settings.autoSyncEnabled || snapshot.health === 'synced') {
      this.lastAutoAlert = '';
      return;
    }
    if (snapshot.health === 'error' || snapshot.health === 'checking' || snapshot.health === 'conflicts') return;
    const fingerprint = `${this.settings.lastRemoteSha}:${snapshot.difference?.localChanged}:${snapshot.difference?.remoteChanged}:${snapshot.difference?.differingPaths}:${snapshot.encryptedNeedsRestore}`;
    if (fingerprint === this.lastAutoAlert) return;
    this.lastAutoAlert = fingerprint;
    const warning = this.remoteExecutableChangesNeedReview() ? '远端插件代码或加密配置待人工审核。' : '';
    new Notice(`GitHub Vault Sync：检测到变化，请点“预览并同步”确认本机/仓库优先。${warning}`, 8000);
  }

  async setAutoSyncEnabled(enabled: boolean): Promise<void> {
    this.settings.autoSyncEnabled = enabled;
    await this.saveSensitiveSettings();
    if (enabled) this.scheduleAutoSync();
    else if (this.autoTimer !== null) {
      window.clearTimeout(this.autoTimer);
      this.autoTimer = null;
      this.autoPending = false;
    }
  }

  async enableEncryptedSync(): Promise<void> {
    try {
      if (!this.settings.repo?.private) throw new Error('先绑定 GitHub 私有仓库');
      const remoteState = await this.engine.checkRemote();
      const remoteSnapshot = this.engine.getSnapshot();
      const remoteBundleChanged = remoteSnapshot.changedFiles.some((item) => item.path === ENCRYPTED_BUNDLE && item.remoteStatus);
      if (remoteState.ok && (remoteSnapshot.encryptedNeedsRestore || (remoteBundleChanged && !this.settings.encryptionKey))) {
        throw new Error('远端已有加密配置包，请先导入恢复密钥并解密恢复，避免本机空配置覆盖远端');
      }
      const previousKey = this.settings.encryptionKey;
      const previousFolders = [...(this.settings.encryptedFolders ?? [])];
      try {
        if (!this.settings.encryptionKey) this.settings.encryptionKey = generateRecoveryKey();
        if (!this.settings.encryptedFolders?.length) {
          this.settings.encryptedFolders = ['obsidian-memos', 'obsidian-callout-editor'];
        }
        const recoveryPath = await writeRecoveryKeyFile(this.settings);
        this.settings.encryptedSyncEnabled = true;
        await this.saveSensitiveSettings();
        new RecoveryKeyModal(this.app, this.settings.encryptionKey, recoveryPath).open();
        this.scheduleAutoSync();
      } catch (error) {
        this.settings.encryptionKey = previousKey;
        this.settings.encryptedFolders = previousFolders;
        throw error;
      }
    } catch (error) {
      new Notice(`加密同步未启用：${error instanceof Error ? error.message : String(error)}`, 10000);
    }
  }

  async importEncryptedKey(input: string): Promise<void> {
    try {
      const key = validateRecoveryKey(input);
      if (this.settings.encryptionKey && this.settings.encryptionKey !== key) {
        throw new Error('已有另一把本地密钥；不能直接覆盖，否则旧备份将无法恢复');
      }
      if (!this.settings.repo?.private) throw new Error('请先绑定相同的私有仓库');
      const previous = this.settings.encryptionKey;
      this.settings.encryptionKey = key;
      try {
        if (!this.settings.encryptedFolders?.length) this.settings.encryptedFolders = ['obsidian-memos', 'obsidian-callout-editor'];
        const recoveryPath = await writeRecoveryKeyFile(this.settings);
        // Importing a key is a restore prerequisite. Do not start producing a
        // local encrypted bundle before the remote bundle has been reviewed.
        this.settings.encryptedSyncEnabled = false;
        await this.saveSensitiveSettings();
        new Notice(`恢复密钥已导入并保存到本机：${recoveryPath}。请先解密并恢复，暂不会上传本机配置。`, 9000);
      } catch (error) { this.settings.encryptionKey = previous; throw error; }
    } catch (error) {
      new Notice(`导入失败：${error instanceof Error ? error.message : String(error)}`, 10000);
    }
  }

  async showRecoveryFile(): Promise<void> {
    try {
      const file = await writeRecoveryKeyFile(this.settings);
      new RecoveryKeyModal(this.app, this.settings.encryptionKey, file).open();
    } catch (error) { new Notice(`无法导出恢复密钥：${error instanceof Error ? error.message : String(error)}`, 8000); }
  }

  async restorePrivateSettings(restoreSelf = false): Promise<void> {
    if (!this.settings.encryptionKey) {
      new Notice('先从另一台设备导入恢复密钥，不要把密钥发到聊天中。');
      return;
    }
    try {
      const details = await inspectEncryptedBundle(this.vaultPath, this.settings);
      new ConfirmModal(this.app, '恢复加密配置',
        `将解密 ${details.files} 个文件（${formatBytes(details.totalBytes)}），覆盖插件配置与例外插件文件。${restoreSelf ? '警告：本插件的 GitHub PAT 和同步设置也会被覆盖。' : '本插件的当前登录凭据保持不变。'}覆盖前会备份原文件；完成后需重启 Obsidian。`,
        async () => { await this.runAction('restore-encrypted', () => this.engine.restoreEncryptedSettings(restoreSelf)); }).open();
    } catch (error) {
      new Notice(`无法读取加密包：${error instanceof Error ? error.message : String(error)}`, 10000);
    }
  }

  private scheduleAutoSync(filePath?: string): void {
    if (!this.settings.autoSyncEnabled || !this.settings.repo || !this.settings.token || this.settings.pendingMerge) return;
    if (filePath && (matchesAnyPattern(filePath, [
      ...DEFAULT_EXCLUDE_PATTERNS, ...(this.settings.includeObsidian ? [] : ['.obsidian/**']), ...this.settings.excludePatterns
    ]) || isLikelySensitivePath(filePath) || filePath === '.github-vault-sync.json' || filePath === '.gitattributes')) return;
    if (this.actionRunning) { this.autoPending = true; return; }
    if (this.autoTimer !== null) window.clearTimeout(this.autoTimer);
    const seconds = Math.max(30, Math.min(600, Number(this.settings.autoSyncDelaySeconds) || 90));
    this.autoTimer = window.setTimeout(() => { this.autoTimer = null; void this.checkForReview(); }, seconds * 1000);
  }

  private async checkForReview(): Promise<void> {
    const result = await this.runAction('auto-check', () => this.engine.checkRemote(), false);
    if (result && 'ok' in result && result.ok) this.notifyReviewNeeded(this.engine.getSnapshot());
  }

  private async pollAutomaticSync(): Promise<void> {
    if (!this.settings.autoSyncEnabled || !this.settings.repo || !this.settings.token || this.settings.pendingMerge || this.actionRunning) return;
    await this.checkForReview();
  }

  private addLog(level: 'info' | 'warn' | 'error', message: string): void {
    const token = this.settings.token;
    const redacted = token ? message.split(token).join('[REDACTED]') : message;
    this.settings.logEntries = [...this.settings.logEntries, { at: new Date().toISOString(), level, message: redacted }].slice(-200);
    void this.saveSensitiveSettings();
  }

  private async runAction(name: string, action: () => Promise<SyncResult | VaultScan>, notify = true): Promise<SyncResult | VaultScan | null> {
    if (this.actionRunning) {
      new Notice('GitHub Vault Sync：已有同步任务正在运行。');
      return null;
    }
    this.actionRunning = true;
    this.addLog('info', `Starting ${name}`);
    try {
      const result = await action();
      if (notify && 'message' in result) {
        new Notice(`GitHub Vault Sync：${result.message}`, result.ok ? 4000 : 8000);
      }
      if ('conflicts' in result && result.conflicts.length) this.openConflicts();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.addLog('error', `${name}: ${message}`);
      new Notice(`GitHub Vault Sync：${message}`, 10000);
      return null;
    } finally {
      this.actionRunning = false;
      this.updateCurrentNoteButton();
      if (this.autoPending) {
        this.autoPending = false;
        this.scheduleAutoSync();
      }
    }
  }

  async syncNow(): Promise<void> {
    if (this.actionRunning) { new Notice('已有同步检查正在运行，请稍候。'); return; }
    this.actionRunning = true;
    this.updateCurrentNoteButton();
    try {
      const preview = await this.engine.previewSync();
      new SyncPreviewModal(this.app, preview, async (priority) => {
        const result = await this.runAction('confirmed-sync', () => this.engine.syncApproved(preview, priority));
        if (result && 'ok' in result && result.ok) this.lastAutoAlert = '';
      }, async (file) => this.openNoteComparison(file, preview.remoteSha)).open();
    } catch (error) {
      new Notice(`无法生成同步预览：${error instanceof Error ? error.message : String(error)}`, 10000);
    } finally {
      this.actionRunning = false;
      this.updateCurrentNoteButton();
    }
  }

  private async openNoteComparison(relPath: string, remoteSha: string): Promise<void> {
    if (!isMarkdownNote(relPath) || !isSafeRelativePath(relPath) || path.isAbsolute(relPath)) {
      new Notice('仅支持比较 Vault 内的 Markdown 笔记。');
      return;
    }
    const maxLength = 120_000;
    const readLocal = async (): Promise<{ text: string; modified: string }> => {
      try {
        const absolute = path.join(this.vaultPath, relPath);
        const [file, stat] = await Promise.all([fs.readFile(absolute), fs.stat(absolute)]);
        return { text: file.includes(0) ? '[此文件包含二进制数据，无法安全显示文本]' : file.toString('utf8').slice(0, maxLength),
          modified: `本机文件时间：${formatDateTime(new Date(stat.mtimeMs))}` };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { text: '[本设备不存在或已删除]', modified: '本机无文件' };
        throw error;
      }
    };
    try {
      const local = await readLocal();
      const exists = await this.engine.git.pathExistsInRef(remoteSha, relPath);
      const remote = exists ? await this.engine.git.showFile(remoteSha, relPath) : null;
      const remoteText = remote ? remote.includes(0) ? '[仓库文件包含二进制数据，无法显示文本]'
        : remote.toString('utf8').slice(0, maxLength) : '[仓库中不存在或已删除]';
      const commitTime = (await this.engine.git.tryText(['log', '-1', '--format=%cI', remoteSha, '--', relPath]))?.trim();
      new NoteComparisonModal(this.app, relPath, local.text, remoteText, remoteSha.slice(0, 12),
        local.modified, commitTime ? `仓库提交时间：${formatDateTime(commitTime)}` : '仓库无对应提交时间').open();
    } catch (error) {
      new Notice(`无法加载笔记对照：${error instanceof Error ? error.message : String(error)}`, 8000);
    }
  }

  async connectGithub(): Promise<void> {
    const currentClient = new GithubClient(this.settings);
    const modal = new AuthModal(this.app, this.settings.oauthClientId, Boolean(this.settings.token), async (action) => {
      modal.close();
      if (action.type === 'pat') {
        const token = (action.token ?? '').trim();
        if (!token) return;
        try {
          const user = await currentClient.validateToken(token);
          this.settings.token = token;
          this.settings.authType = 'pat';
          this.settings.lastStatus = this.settings.repo ? this.settings.lastStatus : 'unauthenticated';
          await this.saveSensitiveSettings();
          new Notice(`已连接 GitHub：${user.login}`);
          this.addLog('info', `Authenticated with PAT as ${user.login}`);
        } catch (error) {
          new Notice(`GitHub PAT 验证失败：${error instanceof Error ? error.message : String(error)}`, 10000);
        }
        return;
      }
      if (action.type === 'oauth') {
        this.settings.oauthClientId = (action.clientId ?? '').trim();
        await this.saveSensitiveSettings();
        await this.startDeviceAuthorization();
      }
    });
    modal.open();
  }

  private async startDeviceAuthorization(): Promise<void> {
    const client = new GithubClient(this.settings);
    try {
      const code = await client.startDeviceFlow(this.settings.oauthClientId);
      const modal = new DeviceCodeModal(this.app, code.user_code, code.verification_uri, code.verification_uri_complete);
      modal.open();
      const token = await client.pollDeviceFlow(this.settings.oauthClientId, code, (seconds) => modal.setStatus(`等待授权中，将在约 ${seconds} 秒后重试…`));
      modal.close();
      this.settings.token = token;
      this.settings.authType = 'oauth';
      const user = await client.getAuthenticatedUser();
      await this.saveSensitiveSettings();
      this.addLog('info', `Authenticated with OAuth as ${user.login}`);
      new Notice(`已连接 GitHub：${user.login}`);
    } catch (error) {
      new Notice(`GitHub OAuth 失败：${error instanceof Error ? error.message : String(error)}`, 10000);
    }
  }

  async bindRepository(): Promise<void> {
    if (!this.settings.token) {
      new Notice('请先连接 GitHub。');
      await this.connectGithub();
      return;
    }
    const client = new GithubClient(this.settings);
    let userLogin = '';
    try {
      userLogin = (await client.getAuthenticatedUser()).login;
    } catch (error) {
      new Notice(`GitHub 登录已失效：${error instanceof Error ? error.message : String(error)}`, 10000);
      return;
    }
    const modal = new RepositoryModal(this.app, userLogin, repoNameFromVault(this.vaultPath), async (action) => {
      modal.close();
      try {
        let binding: RepoBinding;
        if (action.type === 'create') {
          const repo = await client.createPrivateRepository(action.name);
          binding = await client.bindRepository(repo.owner.login, repo.name);
        } else {
          binding = await client.bindRepository(action.owner, action.name);
        }
        const initial = await this.engine.inspectInitialBinding(binding);
        new InitialBindingModal(this.app, binding, initial, async (direction) => {
          if (direction === 'separate') {
            if (!initial.remoteSha) return;
            await this.runAction('clone-private-repository', () =>
              this.engine.cloneRemoteAsSeparateVault(binding, initial.remoteSha!));
            return;
          }
          const result = await this.runAction('bind-repository', () =>
            this.engine.configureRepository(binding, 'local', initial.remoteSha));
          if (result && 'conflicts' in result && result.conflicts.length) this.openConflicts();
        }).open();
      } catch (error) {
        new Notice(`仓库绑定失败：${error instanceof Error ? error.message : String(error)}`, 10000);
      }
    });
    modal.open();
  }

  private async checkDependencies(): Promise<void> {
    try {
      const status = await this.engine.dependencies();
      new DependencyModal(this.app, status).open();
    } catch (error) {
      new Notice(`依赖检测失败：${error instanceof Error ? error.message : String(error)}`, 10000);
    }
  }

  openSyncCenter(): void {
    new SyncCenterModal(this.app, this).open();
  }

  openConflicts(): void {
    const conflicts = this.settings.pendingMerge?.conflicts ?? this.engine.getSnapshot().conflicts;
    if (!conflicts.length) {
      new Notice('当前没有待处理冲突。');
      return;
    }
    new ConflictModal(this.app, conflicts, async (choices) => {
      const result = await this.runAction('resolve-conflicts', () => this.engine.resolvePending(choices));
      if (result && 'ok' in result && result.ok) this.openSyncCenter();
    }).open();
  }

  openLogs(): void {
    new TextModal(this.app, 'GitHub Vault Sync 日志', this.settings.logEntries.map((entry) => `[${formatDateTime(entry.at)}] ${entry.level.toUpperCase()} ${entry.message}`).join('\n')).open();
  }

  async disconnect(): Promise<void> {
    new ConfirmModal(this.app, '断开同步', '这会清除插件中的 GitHub 令牌和仓库绑定，但不会删除 Vault 中的 .git 或笔记。', async () => {
      this.settings.token = '';
      this.settings.authType = null;
      this.settings.repo = null;
      this.settings.pendingMerge = null;
      this.settings.lastStatus = 'unconfigured';
      await this.saveSensitiveSettings();
      this.updateStatus({ phase: 'idle', health: 'unconfigured', message: 'Not configured', changedFiles: [], conflicts: [], warnings: [] });
      new Notice('已清除 GitHub 凭据和仓库绑定。');
    }).open();
  }
}

class GithubVaultSyncSettingTab extends PluginSettingTab {
  private unsubscribe?: () => void;
  private activeSection: SettingsSection = 'sync';

  constructor(app: App, private readonly plugin: GithubVaultSyncPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    containerEl.empty();
    containerEl.addClass('github-vault-sync-settings-page');

    const hero = containerEl.createDiv({ cls: 'github-vault-sync-hero' });
    const brand = hero.createDiv({ cls: 'github-vault-sync-brand' });
    const brandIcon = brand.createSpan({ cls: 'github-vault-sync-brand-icon' });
    setIcon(brandIcon, 'git-branch');
    brand.createDiv({ cls: 'github-vault-sync-brand-title', text: 'GitHub Vault Sync',
      attr: { role: 'heading', 'aria-level': '2' } });
    brand.createSpan({ cls: 'github-vault-sync-version', text: `v${this.plugin.manifest.version}` });

    const repoMeta = hero.createDiv({ cls: 'github-vault-sync-hero-repo' });
    repoMeta.createSpan({ cls: 'github-vault-sync-hero-repo-label', text: '当前仓库' });
    const repoIdentity = repoMeta.createSpan({ cls: 'github-vault-sync-hero-repo-identity' });
    if (this.plugin.settings.repo) {
      repoIdentity.setText(`${this.plugin.settings.repo.owner}/${this.plugin.settings.repo.name}`);
      repoMeta.createSpan({ cls: 'github-vault-sync-hero-repo-branch', text: this.plugin.settings.branch });
      repoMeta.createSpan({ cls: 'github-vault-sync-hero-repo-privacy',
        text: this.plugin.settings.repo.private ? '私有' : '公开' });
    } else {
      repoIdentity.setText('尚未连接同步仓库');
    }
    const statusBadge = repoMeta.createSpan({ cls: 'github-vault-sync-health', text: healthLabel(this.plugin.engine.getSnapshot().health) });
    statusBadge.dataset.health = this.plugin.engine.getSnapshot().health;
    hero.createEl('small', { cls: 'github-vault-sync-hero-note',
      text: '先检查本机与仓库差异，再确认同步；不会绕过确认自动上传。' });

    // Pre-mount each panel so keyboard navigation is instant and switching
    // does not recreate live inputs or lose the selected settings section.
    const tablist = containerEl.createEl('nav', { cls: 'github-vault-sync-section-nav',
      attr: { role: 'tablist', 'aria-orientation': 'horizontal', 'aria-label': 'GitHub Vault Sync 设置页面' } });
    const content = containerEl.createDiv({ cls: 'github-vault-sync-settings-content' });
    const panels = SETTINGS_TABS.map(({ id }) => content.createDiv({
      cls: 'github-vault-sync-tab-panel',
      attr: { id: `gvs-panel-${id}`, role: 'tabpanel', 'aria-labelledby': `gvs-tab-${id}` }
    }));
    const tabs = SETTINGS_TABS.map(({ id, label }, index) => {
      const button = tablist.createEl('button', { cls: 'github-vault-sync-section-link', text: label,
        attr: { id: `gvs-tab-${id}`, type: 'button', role: 'tab', 'aria-controls': `gvs-panel-${id}` } });
      button.addEventListener('click', () => select(index));
      button.addEventListener('keydown', (event) => {
        const next = nextSettingsTab(event.key, index, SETTINGS_TABS.length);
        if (next === null) return;
        event.preventDefault();
        select(next);
        tabs[next].focus();
      });
      return button;
    });
    const select = (index: number): void => {
      this.activeSection = SETTINGS_TABS[index].id;
      showSettingsTab(tabs, panels, index);
      // The settings host can retain a previous panel's scroll position.
      // A new page should always begin at its heading.
      const scroller = containerEl.closest<HTMLElement>('.vertical-tab-content');
      scroller?.scrollTo({ top: 0, behavior: 'auto' });
    };

    this.renderSyncSection(panels[0], statusBadge);
    this.renderMediaSection(panels[1]);
    this.renderPrivacySection(panels[2]);
    this.renderAccountSection(panels[3]);
    this.renderAdvancedSection(panels[4]);
    const initial = SETTINGS_TABS.findIndex(({ id }) => id === this.activeSection);
    showSettingsTab(tabs, panels, initial < 0 ? 0 : initial);
  }

  private card(container: HTMLElement, title: string, description?: string, section?: string): HTMLElement {
    const card = container.createDiv({ cls: 'github-vault-sync-card' });
    if (section) card.id = `gvs-settings-${section}`;
    const header = card.createDiv({ cls: 'github-vault-sync-card-header' });
    // Some themes add indentation/decorations to h3. Keep heading semantics
    // without inheriting those document-heading styles in plugin settings.
    header.createDiv({ cls: 'github-vault-sync-card-title', text: title,
      attr: { role: 'heading', 'aria-level': '3' } });
    if (description) header.createEl('p', { text: description });
    return card;
  }

  private renderSyncSection(container: HTMLElement, statusBadge: HTMLElement): void {
    const overview = this.card(container, '同步概览', '先确认本机与仓库的变化，再预览整库并决定如何合并。', 'sync');
    const summary = overview.createDiv({ cls: 'github-vault-sync-summary' });
    renderSyncSummary(summary, this.plugin.engine.getSnapshot());
    this.unsubscribe = this.plugin.subscribeSnapshot((snapshot) => {
      renderSyncSummary(summary, snapshot);
      statusBadge.setText(healthLabel(snapshot.health));
      statusBadge.dataset.health = snapshot.health;
    });
    new Setting(overview)
      .setName('同步前预览')
      .setDesc('先检查 Markdown 笔记、附件及 Obsidian 配置，再选择冲突优先方。')
      .addButton((button) => button.setButtonText('预览并同步').setCta()
        .setDisabled(!this.plugin.settings.repo?.private || !this.plugin.settings.token)
        .onClick(() => void this.plugin.syncNow()));
    new Setting(overview)
      .setName('及时检查')
      .setDesc('本地变更后防抖检查，并每 5 分钟检查远端；只提醒，不自动上传。')
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.autoSyncEnabled)
        .onChange(async (value) => this.plugin.setAutoSyncEnabled(value)));
    new Setting(overview)
      .setName('启动时检查远端')
      .setDesc('打开 Vault 后自动读取远端状态，不会自动合并或上传。')
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.startupCheck).onChange(async (value) => {
        this.plugin.settings.startupCheck = value;
        await this.plugin.saveSensitiveSettings();
      }));

    const current = this.card(container, '当前笔记', '当前 Markdown 笔记的同步按钮位于 Obsidian 底部状态栏；它只处理当前笔记和实际嵌入附件。');
    const note = this.plugin.getCurrentNote();
    new Setting(current)
      .setName(note ? note.path : '尚未打开 Markdown 笔记')
      .setDesc(note ? '点击底部状态栏的“同步当前笔记”，不会提交其他笔记。' : '打开 Markdown 笔记后，底部状态栏按钮会自动启用。')
      .addButton((button) => button.setButtonText('打开同步中心').onClick(() => this.plugin.openSyncCenter()));
  }

  private renderMediaSection(container: HTMLElement): void {
    const media = this.card(container, '上传前媒体预检', '仅影响之后的同步预览；不会自动转换、删除原文件或改写笔记链接。', 'media');
    new Setting(media)
      .setName('媒体提示阈值（MB）')
      .setDesc('列出大于阈值的 PNG/JPG、PDF、MP4 和 GIF；有效范围 0.1–1024，默认 2。')
      .addText((text) => {
        text.inputEl.type = 'number';
        text.inputEl.min = '0.1';
        text.inputEl.max = '1024';
        text.inputEl.step = '0.1';
        text.setValue(String(this.plugin.settings.mediaSizeThresholdMB)).onChange(async (value) => {
          const threshold = Number.parseFloat(value);
          if (Number.isFinite(threshold) && threshold >= 0.1 && threshold <= 1024) {
            this.plugin.settings.mediaSizeThresholdMB = threshold;
            await this.plugin.saveSensitiveSettings();
          }
        });
      });
    new Setting(media)
      .setName('图像 PSNR 质量下限（dB）')
      .setDesc('AVIF 命令自动升档至 q100，仍不达标则不生成目标文件；有效范围 1–60，默认 35。')
      .addText((text) => {
        text.inputEl.type = 'number';
        text.inputEl.min = '1';
        text.inputEl.max = '60';
        text.inputEl.step = '1';
        text.setValue(String(this.plugin.settings.mediaQualityFloorPsnr)).onChange(async (value) => {
          const floor = Number.parseFloat(value);
          if (Number.isFinite(floor) && floor >= 1 && floor <= 60) {
            this.plugin.settings.mediaQualityFloorPsnr = floor;
            await this.plugin.saveSensitiveSettings();
          }
        });
      });
    new Setting(media)
      .setName('媒体排除规则')
      .setDesc('每行一条 glob，例如“图片存储/**”；仅排除优化建议，不改变同步范围。')
      .addTextArea((area) => {
        area.inputEl.rows = 5;
        area.setValue(this.plugin.settings.mediaExcludePatterns.join('\n')).onChange(async (value) => {
          this.plugin.settings.mediaExcludePatterns = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
          await this.plugin.saveSensitiveSettings();
        });
      });
    new Setting(media)
      .setName('显示预估节省')
      .setDesc('按实测投影系数估算，不代表实际转换结果；关闭后仍显示文件清单和转换命令。')
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.mediaShowSavings).onChange(async (value) => {
        this.plugin.settings.mediaShowSavings = value;
        await this.plugin.saveSensitiveSettings();
      }));

    const usage = this.card(container, '转换命令边界', '在同步预览中逐文件或一键批量复制命令，并在 Vault 根目录的终端执行；Windows 使用 Git Bash。');
    new Setting(usage)
      .setName('所需外部工具')
      .setDesc('图像需要 Pillow 与 pillow-avif-plugin；PDF 需要 Ghostscript；MP4 需要含 libsvtav1 的 FFmpeg，GIF 需要含 libwebp 的 FFmpeg。插件不会代为安装或执行。');
    new Setting(usage)
      .setName('先备份再转换')
      .setDesc('有损转换不可逆。命令不会覆盖已有目标或删除源文件；生成后需人工检查画质、更新引用，再单独预览同步。');
  }

  private renderPrivacySection(container: HTMLElement): void {
    const privacy = this.card(container, '配置加密与恢复', this.plugin.settings.encryptedSyncEnabled
      ? '插件私有配置已使用客户端加密镜像；恢复密钥只保存在本机。'
      : '可将插件 data.json 和配置例外加密为密文包，不以明文提交。', 'privacy');
    new Setting(privacy)
      .setName('恢复密钥')
      .setDesc('明确点击后显示完整密钥并支持复制；关闭窗口后隐藏。')
      .addButton((button) => button.setButtonText(this.plugin.settings.encryptionKey ? '查看并复制' : '启用加密')
        .setDisabled(!this.plugin.settings.repo)
        .onClick(() => void (this.plugin.settings.encryptionKey ? this.plugin.showRecoveryFile() : this.plugin.enableEncryptedSync())));
    if (!this.plugin.settings.encryptionKey) {
      let recoveryInput = '';
      new Setting(privacy)
        .setName('导入其他设备的密钥')
        .setDesc('只在本机输入恢复密钥，不要粘贴到笔记或公开仓库。')
        .addText((text) => { text.setPlaceholder('GVS1-…').onChange((value) => { recoveryInput = value; }); text.inputEl.type = 'password'; })
        .addButton((button) => button.setButtonText('导入').onClick(async () => {
          const input = recoveryInput;
          recoveryInput = '';
          await this.plugin.importEncryptedKey(input);
          this.display();
        }));
    }
    if (this.plugin.settings.encryptionKey) {
      new Setting(privacy)
        .setName('从仓库恢复插件设置')
        .setDesc('恢复前自动备份被覆盖文件；默认不覆盖本机 GitHub 登录，完成后需重启。')
        .addButton((button) => button.setButtonText('解密并恢复').onClick(() => void this.plugin.restorePrivateSettings()));
      new Setting(privacy)
        .setName('完整恢复本插件登录')
        .setDesc('谨慎：会连同本机 PAT 和同步设置一起覆盖，并要求重启。')
        .addButton((button) => button.setButtonText('含凭据恢复').setWarning().onClick(() => void this.plugin.restorePrivateSettings(true)));
    }
  }

  private renderAccountSection(container: HTMLElement): void {
    const account = this.card(container, '连接 GitHub', '登录凭据只用于访问你控制的私有笔记仓库；公开插件仓库不是笔记仓库。', 'account');
    new Setting(account)
      .setName('GitHub 登录')
      .setDesc(this.plugin.settings.token ? `已连接（${this.plugin.settings.authType ?? 'PAT'}）` : '未连接')
      .addButton((button) => button.setButtonText('连接／更新').setCta().onClick(() => void this.plugin.connectGithub()));
    new Setting(account)
      .setName('绑定仓库')
      .setDesc(this.plugin.settings.repo ? `${this.plugin.settings.repo.owner}/${this.plugin.settings.repo.name} · ${this.plugin.settings.branch}` : '尚未绑定')
      .addButton((button) => button.setButtonText('创建／绑定').onClick(() => void this.plugin.bindRepository()));
    if (!this.plugin.settings.token || this.plugin.settings.authType === 'oauth') {
      new Setting(account)
        .setName('OAuth Client ID')
        .setDesc('仅在使用浏览器 Device Flow 授权时需要。')
        .addText((text) => text.setValue(this.plugin.settings.oauthClientId).onChange(async (value) => {
          this.plugin.settings.oauthClientId = value.trim();
          await this.plugin.saveSensitiveSettings();
        }));
    }
    new Setting(account)
      .setName('断开同步')
      .setDesc('清除本插件的 GitHub 令牌和仓库绑定，不删除 Vault 笔记或本地 .git。')
      .addButton((button) => button.setButtonText('断开并清除凭据').setWarning().onClick(() => void this.plugin.disconnect()));
  }

  private renderAdvancedSection(container: HTMLElement): void {
    const scope = this.card(container, '同步范围', '控制是否包含 Obsidian 配置、检查延迟和本地扫描范围。', 'advanced');
    new Setting(scope)
      .setName('同步 .obsidian 设置')
      .setDesc('插件代码和主题可同步；data.json 明文始终排除，私有配置只通过密文镜像同步。')
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.includeObsidian).onChange(async (value) => {
        this.plugin.settings.includeObsidian = value;
        await this.plugin.saveSensitiveSettings();
      }));
    new Setting(scope)
      .setName('检查延迟（秒）')
      .setDesc('30–600 秒，默认 90 秒；上传仍需逐次确认。')
      .addText((text) => text.setValue(String(this.plugin.settings.autoSyncDelaySeconds)).onChange(async (value) => {
        const seconds = Number.parseInt(value, 10);
        if (Number.isFinite(seconds) && seconds >= 30 && seconds <= 600) {
          this.plugin.settings.autoSyncDelaySeconds = seconds;
          await this.plugin.saveSensitiveSettings();
        }
      }));

    const rules = this.card(container, '排除规则与附件', '每行一条 glob；凭据类文件和当前插件 data.json 永远不会以明文提交。');
    new Setting(rules)
      .setName('排除规则')
      .setDesc('可添加第三方插件目录、缓存或不希望同步的文件。')
      .addTextArea((area) => {
        area.inputEl.rows = 8;
        area.setValue(this.plugin.settings.excludePatterns.join('\n')).onChange(async (value) => {
          this.plugin.settings.excludePatterns = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
          await this.plugin.saveSensitiveSettings();
        });
      });
    new Setting(rules)
      .setName('Git LFS 文件类型')
      .setDesc('图片、视频、PDF 等附件按这些模式使用 Git LFS。')
      .addTextArea((area) => {
        area.inputEl.rows = 6;
        area.setValue(this.plugin.settings.lfsPatterns.join('\n')).onChange(async (value) => {
          this.plugin.settings.lfsPatterns = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
          await this.plugin.saveSensitiveSettings();
        });
      });

    new Setting(scope)
      .setName('Git HTTP 代理（可选）')
      .setDesc('仅影响 Git/Git LFS 网络请求，不写入远端 URL；例如 Windows 上的 http://127.0.0.1:7897。网络直连正常时留空。')
      .addText((text) => text.setPlaceholder('http://127.0.0.1:7897').setValue(this.plugin.settings.gitHttpProxy)
        .onChange(async (value) => {
          try {
            this.plugin.settings.gitHttpProxy = normalizeHttpProxy(value);
            await this.plugin.saveSensitiveSettings();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : String(error), 7000);
          }
        }));

    const tools = this.card(container, '提交信息与工具', '这些选项只影响本地 Git 提交和诊断，不会改变同步冲突策略。');
    new Setting(tools)
      .setName('Git 提交作者')
      .addText((text) => text.setValue(this.plugin.settings.gitUserName).onChange(async (value) => {
        this.plugin.settings.gitUserName = value.trim() || 'GitHub Vault Sync';
        await this.plugin.saveSensitiveSettings();
      }));
    new Setting(tools)
      .setName('Git 提交邮箱')
      .addText((text) => text.setValue(this.plugin.settings.gitUserEmail).onChange(async (value) => {
        this.plugin.settings.gitUserEmail = value.trim() || 'github-vault-sync@users.noreply.github.com';
        await this.plugin.saveSensitiveSettings();
      }));
    new Setting(tools)
      .setName('诊断工具')
      .addButton((button) => button.setButtonText('检测 Git / LFS').onClick(() => void this.plugin['checkDependencies']()))
      .addButton((button) => button.setButtonText('查看日志').onClick(() => this.plugin.openLogs()));
  }

  hide(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    super.hide();
  }
}

interface AuthAction {
  type: 'oauth' | 'pat';
  clientId?: string;
  token?: string;
}

/** Scope common button, focus and reduced-motion polish to our own dialogs. */
class GithubVaultSyncModal extends Modal {
  constructor(app: App) {
    super(app);
    this.modalEl.addClass('github-vault-sync-modal');
  }
}

class AuthModal extends GithubVaultSyncModal {
  private clientId = '';
  private pat = '';

  constructor(app: App, clientId: string, private readonly hasToken: boolean, private readonly onSubmit: (action: AuthAction) => Promise<void>) {
    super(app);
    this.clientId = clientId;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: '连接 GitHub' });
    contentEl.createEl('p', { text: '默认通过浏览器 Device Flow 授权；如果尚未配置 OAuth Client ID，也可以粘贴 PAT。令牌只保存在本地插件配置。' });
    new Setting(contentEl).setName('OAuth Client ID').addText((text) => text.setValue(this.clientId).onChange((value) => { this.clientId = value; }));
    new Setting(contentEl).setName('PAT 回退').setDesc(this.hasToken ? '已有令牌；输入新令牌可替换。' : '建议使用具备私有仓库读写权限的令牌。').addText((text) => {
      text.setPlaceholder('github_pat_…').onChange((value) => { this.pat = value; });
      text.inputEl.type = 'password';
    });
    new Setting(contentEl).addButton((button) => button.setButtonText('浏览器授权').setCta().onClick(() => void this.onSubmit({ type: 'oauth', clientId: this.clientId }))).addButton((button) => button.setButtonText('使用 PAT').onClick(() => void this.onSubmit({ type: 'pat', token: this.pat }))).addButton((button) => button.setButtonText('取消').onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class DeviceCodeModal extends GithubVaultSyncModal {
  private statusEl!: HTMLElement;

  constructor(app: App, private readonly userCode: string, private readonly verificationUri: string, private readonly completeUri?: string) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: '在浏览器中授权 GitHub' });
    contentEl.createEl('p', { text: '打开授权页面并输入以下设备码。授权完成后请保持此窗口打开。' });
    const code = contentEl.createEl('pre', { text: this.userCode, cls: 'github-vault-sync-device-code' });
    code.setAttribute('aria-label', 'GitHub device code');
    const link = contentEl.createEl('a', { text: this.verificationUri, href: this.completeUri ?? this.verificationUri });
    link.setAttr('target', '_blank');
    new Setting(contentEl).addButton((button) => button.setButtonText('打开授权页面').setCta().onClick(() => window.open(this.completeUri ?? this.verificationUri, '_blank'))).addButton((button) => button.setButtonText('取消').onClick(() => this.close()));
    this.statusEl = contentEl.createEl('p', { text: '等待授权…', cls: 'setting-item-description' });
  }

  setStatus(message: string): void {
    if (this.statusEl) this.statusEl.setText(message);
  }
}

class RepositoryModal extends GithubVaultSyncModal {
  private owner: string;
  private name: string;

  constructor(app: App, defaultOwner: string, defaultName: string, private readonly onSubmit: (action: { type: 'create'; name: string } | { type: 'bind'; owner: string; name: string }) => Promise<void>) {
    super(app);
    this.owner = defaultOwner;
    this.name = defaultName;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: '创建或绑定私有仓库' });
    new Setting(contentEl).setName('GitHub 用户名').addText((text) => text.setValue(this.owner).onChange((value) => { this.owner = value.trim(); }));
    new Setting(contentEl).setName('仓库名').setDesc('想保留旧库且不合并，请新建一个不同名字的私有仓库。').addText((text) => text.setValue(this.name).onChange((value) => { this.name = value.trim(); }));
    new Setting(contentEl).addButton((button) => button.setButtonText('新建独立私有仓库').setCta().onClick(() => void this.onSubmit({ type: 'create', name: this.name }))).addButton((button) => button.setButtonText('绑定已有仓库').onClick(() => void this.onSubmit({ type: 'bind', owner: this.owner, name: this.name }))).addButton((button) => button.setButtonText('取消').onClick(() => this.close()));
  }

  onClose(): void { this.contentEl.empty(); }
}

class InitialBindingModal extends GithubVaultSyncModal {
  private submitting = false;

  constructor(app: App, private readonly binding: RepoBinding,
    private readonly comparison: InitialBindingPreview,
    private readonly onSubmit: (direction: 'local' | 'separate') => Promise<void>) { super(app); }

  private async submit(direction: 'local' | 'separate'): Promise<void> {
    if (this.submitting) return;
    this.submitting = true;
    this.close();
    await this.onSubmit(direction);
  }

  onOpen(): void {
    const { contentEl } = this;
    this.modalEl.addClass('github-vault-sync-wide-modal');
    contentEl.empty();
    contentEl.addClass('github-vault-sync-initial-preview');
    contentEl.createEl('h2', { text: '先确认新旧笔记库' });
    contentEl.createEl('p', { text: `${this.binding.owner}/${this.binding.name} · ${this.binding.branch} · 私有仓库` });
    contentEl.createEl('p', { cls: 'setting-item-description',
      text: '本次预检可能会为后续 Git 操作建立或更新 Vault 内的 .git 元数据和远程地址，但不会提交、覆盖笔记或上传；取消后这些 Git 元数据可能保留。' });
    const cards = contentEl.createDiv({ cls: 'github-vault-sync-preview-metrics' });
    for (const [label, value] of [
      ['本机文件', this.comparison.localFiles],
      ['仓库文件', this.comparison.remoteFiles],
      ['同路径但笔记内容不同', this.comparison.differingMarkdown.length],
      ['笔记内容相同', this.comparison.identicalMarkdown]
    ] as const) {
      const card = cards.createDiv({ cls: 'github-vault-sync-preview-metric' });
      card.createEl('strong', { text: String(value) }); card.createEl('span', { text: label });
    }
    if (!this.comparison.remoteExists) {
      contentEl.createEl('p', { text: '仓库尚无提交。可以从本机首次上传，不需要与旧笔记合并。' });
    } else {
      contentEl.createEl('p', { text: `仅本机 ${this.comparison.localOnly} · 仅仓库 ${this.comparison.remoteOnly} · 插件/配置同路径 ${this.comparison.differingConfig} · 附件同路径 ${this.comparison.overlappingAttachments}` });
      if (this.comparison.differingMarkdown.length) {
        const list = contentEl.createEl('details', { cls: 'github-vault-sync-initial-list' });
        list.open = true;
        list.createEl('summary', { text: `同路径不同内容的笔记（${this.comparison.differingMarkdown.length}）：后续逐篇选择` });
        const ul = list.createEl('ul');
        for (const item of this.comparison.differingMarkdown.slice(0, 30)) ul.createEl('li', { text: item });
        if (this.comparison.differingMarkdown.length > 30) ul.createEl('li', { text: '其余笔记需在合并冲突中心选择。' });
      }
      if (this.comparison.sameNameDifferentFolder.length) {
        const list = contentEl.createEl('details', { cls: 'github-vault-sync-initial-list' });
        list.createEl('summary', { text: `${this.comparison.sameNameDifferentFolder.length} 对同名但不同目录的笔记（路径不会被当作相同文件）` });
        const ul = list.createEl('ul');
        for (const pair of this.comparison.sameNameDifferentFolder.slice(0, 20)) ul.createEl('li', { text: `${pair.local} ↔ ${pair.remote}` });
      }
      if (this.comparison.structuralConflicts.length) {
        contentEl.createEl('p', { cls: 'github-vault-sync-error-text',
          text: `检测到大小写或文件/文件夹路径冲突，不能安全合并：${this.comparison.structuralConflicts.slice(0, 5).join('；')}` });
      }
    }
    const note = contentEl.createDiv({ cls: 'github-vault-sync-preview-advice' });
    note.createEl('strong', { text: '不要把“本机较新”理解成自动覆盖整个仓库' });
    note.createEl('p', { text: '选择合并后，两端独有文件都会保留；同一路径但内容不同的笔记和配置进入逐文件冲突处理。也可将仓库完整恢复到旁边的新 Vault，不改变当前笔记库。若想完全不混用旧库，请先新建另一个私有仓库。' });
    if (this.comparison.warnings.length) {
      const warning = contentEl.createEl('details');
      warning.createEl('summary', { text: `预检提醒 ${this.comparison.warnings.length}` });
      for (const message of this.comparison.warnings.slice(0, 12)) warning.createEl('p', { text: message });
    }
    const actions = new Setting(contentEl).setClass('github-vault-sync-modal-actions');
    if (this.comparison.remoteExists) actions.addButton((button) => button.setButtonText('另建仓库副本')
      .onClick(() => void this.submit('separate')));
    actions.addButton((button) => button.setButtonText('取消').onClick(() => this.close()));
    actions.addButton((button) => button.setButtonText(this.comparison.remoteExists ? '合并本机与仓库' : '从本机初始化私有仓库')
      .setCta().setDisabled(this.comparison.structuralConflicts.length > 0)
      .onClick(() => void this.submit('local')));
  }

  onClose(): void { this.contentEl.empty(); }
}

class CurrentNoteModal extends GithubVaultSyncModal {
  private submitting = false;

  constructor(app: App, private readonly plan: CurrentNotePlan,
    private readonly onSubmit: () => Promise<void>, private readonly onFullPreview: () => Promise<void>,
    private readonly onCompare: () => Promise<void>) { super(app); }

  onOpen(): void {
    this.contentEl.empty();
    this.modalEl.addClass('github-vault-sync-note-modal');
    const content = this.contentEl;
    content.createEl('h2', { text: '仅同步当前笔记' });
    content.createEl('p', { cls: 'github-vault-sync-note-path', text: this.plan.notePath });
    content.createEl('p', { cls: 'setting-item-description',
      text: `本次仅包含此 Markdown 文件${this.plan.attachments.length ? `及 ${this.plan.attachments.length} 个 Obsidian 元数据识别的嵌入附件` : ''}。其他笔记与 .obsidian 配置不会提交。` });
    const status = content.createDiv({ cls: 'github-vault-sync-scope-status' });
    status.createEl('strong', { text: this.plan.changedPaths.length
      ? `待上传 ${this.plan.changedPaths.length} 个文件` : '笔记和引用附件已与仓库一致' });
    status.createEl('span', { text: this.plan.remoteHasNote
      ? this.plan.remoteNoteDifferent ? '此笔记的本机内容与仓库不同' : '笔记正文相同'
      : '仓库尚无此笔记；将新建文件' });
    if (this.plan.attachments.length) {
      const list = content.createEl('details', { cls: 'github-vault-sync-note-assets' });
      list.createEl('summary', { text: `引用的附件（${this.plan.attachments.length}）` });
      const ul = list.createEl('ul');
      for (const asset of this.plan.attachments.slice(0, 30)) ul.createEl('li', { text: asset });
      if (this.plan.attachments.length > 30) ul.createEl('li', { text: `另外 ${this.plan.attachments.length - 30} 个…` });
    }
    content.createEl('p', { cls: 'github-vault-sync-hint',
      text: '若其他设备已推送新版本、Git 索引中有暂存文件，或预览后这篇笔记发生变化，本操作会拒绝上传。请先进行全库预览与冲突处理。' });
    const secondary = new Setting(content).setClass('github-vault-sync-modal-secondary');
    secondary.addButton((button) => button.setButtonText('查看本机与仓库内容').onClick(() => void this.onCompare()));
    secondary.addButton((button) => button.setButtonText('全库预览').onClick(async () => { this.close(); await this.onFullPreview(); }));
    const actions = new Setting(content).setClass('github-vault-sync-modal-actions');
    actions.addButton((button) => button.setButtonText('取消').onClick(() => this.close()));
    actions.addButton((button) => button.setButtonText('仅上传此笔记').setCta()
      .setDisabled(this.plan.changedPaths.length === 0).onClick(async () => {
        if (this.submitting) return;
        this.submitting = true;
        this.close();
        await this.onSubmit();
      }));
  }

  onClose(): void { this.contentEl.empty(); }
}

class SyncPreviewModal extends GithubVaultSyncModal {
  private selected: SyncPriority | null = null;
  private configApproved = false;
  private submitting = false;

  constructor(app: App, private readonly preview: SyncPreview,
    private readonly onSubmit: (priority: SyncPriority) => Promise<void>,
    private readonly onCompareNote: (path: string) => Promise<void>) { super(app); }

  onOpen(): void {
    const { contentEl } = this;
    this.modalEl.addClass('github-vault-sync-wide-modal');
    contentEl.empty();
    contentEl.addClass('github-vault-sync-preview');
    contentEl.createEl('h2', { text: '同步前确认' });
    contentEl.createEl('p', { text: '先检查笔记和笔记文件夹，再检查 Obsidian 配置。请先保存正在编辑的笔记；此时尚未提交或上传。' });
    const stats = contentEl.createDiv({ cls: 'github-vault-sync-preview-metrics' });
    for (const [label, count] of [
      ['Markdown 笔记', this.preview.notes.length],
      ['笔记文件夹附件', this.preview.noteAttachments.length],
      ['Obsidian 配置', this.preview.obsidianConfig.length],
      ['其他文件', this.preview.otherFiles.length]
    ] as const) {
      const card = stats.createDiv({ cls: 'github-vault-sync-preview-metric' });
      card.createEl('strong', { text: String(count) });
      card.createEl('span', { text: label });
    }
    contentEl.createEl('p', { cls: 'setting-item-description',
      text: `本机变化 ${this.preview.difference.localChanged} · 仓库变化 ${this.preview.difference.remoteChanged} · 按文件计的差异 ${this.preview.difference.differencePercent}%` });
    const groups = contentEl.createDiv({ cls: 'github-vault-sync-preview-groups' });
    this.renderGroup(groups, '1 · Markdown 笔记', this.preview.notes);
    this.renderGroup(groups, '2 · 笔记文件夹附件', this.preview.noteAttachments);
    this.renderGroup(groups, '3 · Obsidian 插件与配置', this.preview.obsidianConfig);
    this.renderGroup(groups, '4 · 其他文件', this.preview.otherFiles);
    this.renderMediaAdvice(contentEl);
    const incomingConfig = this.preview.obsidianConfig.filter((file) => file.remoteStatus);
    if (incomingConfig.length) {
      new Setting(contentEl).setName(`远端配置变化：${incomingConfig.length} 个文件`)
        .setDesc('远端插件代码与 Obsidian 配置可能不同于本设备。请先核对上方列表再允许合并；未确认不会应用这些远端内容。')
        .addToggle((toggle) => toggle.setValue(false).onChange((value) => { this.configApproved = value; }));
    }

    const advice = contentEl.createDiv({ cls: 'github-vault-sync-preview-advice' });
    advice.createEl('strong', { text: '优先方式只处理“同一篇 Markdown 两端都改过”的冲突' });
    advice.createEl('p', { text: '两端各自新增或修改的不同文件仍会合并；插件配置、加密包和附件的冲突一律逐项确认。优先方式不是按设备时钟自动判定“最新”。未选中的笔记版本会另存冲突备份，不会强制推送。' });
    let selected = '';
    new Setting(contentEl)
      .setName('同一篇笔记的冲突优先方')
      .addDropdown((dropdown) => dropdown.addOptions({
        '': '请选择，上传前必须确认',
        local: '以本设备为主',
        remote: '以 GitHub 仓库为主',
        manual: '每篇笔记逐项选择'
      }).setValue('').onChange((value) => { selected = value; this.selected = value ? value as SyncPriority : null; }));
    if (this.preview.warnings.length) {
      const warning = contentEl.createEl('details');
      warning.createEl('summary', { text: `预检提醒（${this.preview.warnings.length}）` });
      for (const message of this.preview.warnings.slice(0, 12)) warning.createEl('p', { text: message });
    }
    const actions = new Setting(contentEl).setClass('github-vault-sync-modal-actions');
    actions.addButton((button) => button.setButtonText('取消，不上传').onClick(() => this.close()));
    actions.addButton((button) => button.setButtonText('确认并同步').setCta().onClick(async () => {
      if (!this.selected || !selected) { new Notice('先选择同一篇笔记发生冲突时的优先方式。'); return; }
      if (incomingConfig.length && !this.configApproved) { new Notice('请先审阅并确认远端 Obsidian 配置差异。'); return; }
      if (this.submitting) return;
      this.submitting = true;
      const priority = this.selected;
      this.close();
      await this.onSubmit(priority);
    }));
  }

  private renderMediaAdvice(container: HTMLElement): void {
    const report = this.preview.media;
    if (!report?.findings.length) return;
    const section = container.createDiv({ cls: 'github-vault-sync-preview-group github-vault-sync-media-advice' });
    section.createEl('h3', { text: `媒体优化建议 · ${report.findings.length} 个文件` });
    const savings = report.showSavings
      ? ` · 估算转换后 ${formatBytes(report.estimatedBytes)}，约减少 ${formatBytes(Math.max(0, report.totalBytes - report.estimatedBytes))}`
      : '';
    section.createEl('p', { cls: 'setting-item-description',
      text: `当前合计 ${formatBytes(report.totalBytes)}${savings}。估算来自实测投影系数，不是实际转换保证。` });
    section.createEl('p', { cls: 'github-vault-sync-media-warning',
      text: '此建议不会阻塞同步。逐文件和批量按钮都只复制命令，不执行转换；请在 Vault 根目录终端运行（Windows 用 Git Bash），先备份并检查生成文件，再手动更新引用。' });
    const copyAll = section.createEl('button', {
      cls: 'github-vault-sync-note-compare github-vault-sync-media-copy github-vault-sync-media-copy-all',
      text: '一键复制全部转换命令',
      attr: { type: 'button', 'aria-label': `复制全部 ${report.findings.length} 个媒体转换命令` }
    });
    copyAll.addEventListener('click', async () => {
      const commands = buildAllConversionCommands(report);
      try {
        await navigator.clipboard.writeText(commands);
        copyAll.setText('已复制全部');
        new Notice(`已复制 ${report.findings.length} 个媒体转换命令。`);
      } catch {
        new TextModal(this.app, `手动复制全部转换命令（${report.findings.length} 个文件）`, commands).open();
        new Notice('自动复制失败，请在新窗口中手动复制全部命令。', 7000);
      }
    });
    const list = section.createEl('ul', { cls: 'github-vault-sync-media-list' });
    let displayed = 0;
    const displayMore = () => {
      const end = Math.min(displayed + 30, report.findings.length);
      for (const finding of report.findings.slice(displayed, end)) {
        const item = list.createEl('li', { cls: 'github-vault-sync-media-item' });
        const info = item.createDiv({ cls: 'github-vault-sync-media-info' });
        info.createEl('span', { cls: 'github-vault-sync-media-path', text: finding.path });
        const estimate = report.showSavings ? ` → 约 ${formatBytes(finding.estimatedBytes)}` : '';
        info.createEl('small', {
          text: `${mediaKindLabel(finding.kind)} · ${formatBytes(finding.size)}${estimate} · 目标 ${finding.targetPath}`
        });
        const copy = item.createEl('button', {
          cls: 'github-vault-sync-note-compare github-vault-sync-media-copy',
          text: '复制转换命令',
          attr: { type: 'button', 'aria-label': `复制 ${finding.path} 的转换命令` }
        });
        copy.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(finding.command);
            copy.setText('已复制');
            new Notice(`已复制转换命令：${finding.path}`);
          } catch {
            new TextModal(this.app, `手动复制转换命令：${finding.path}`, finding.command).open();
            new Notice('自动复制失败，请在新窗口中手动复制命令。', 7000);
          }
        });
      }
      displayed = end;
      if (more) {
        more.setText(`再显示 30 个（剩余 ${report.findings.length - displayed}）`);
        more.toggleClass('is-hidden', displayed >= report.findings.length);
      }
    };
    let more: HTMLButtonElement | undefined;
    displayMore();
    if (report.findings.length > displayed) {
      more = section.createEl('button', {
        cls: 'github-vault-sync-note-compare',
        text: `再显示 30 个（剩余 ${report.findings.length - displayed}）`,
        attr: { type: 'button' }
      });
      more.addEventListener('click', displayMore);
    }
  }

  private renderGroup(container: HTMLElement, title: string, files: FileChange[]): void {
    const group = container.createDiv({ cls: 'github-vault-sync-preview-group' });
    group.createEl('h3', { text: `${title} · ${files.length}` });
    if (!files.length) { group.createEl('p', { text: '没有发现差异', cls: 'setting-item-description' }); return; }
    const list = group.createEl('ul');
    let displayed = 0;
    const displayMore = () => {
      const end = Math.min(displayed + 30, files.length);
      for (const file of files.slice(displayed, end)) {
        const side = file.localStatus && file.remoteStatus ? '两端均有变化'
          : file.localStatus ? '本机有变化' : '仓库有变化';
        const item = list.createEl('li');
        item.createEl('span', { text: `${file.path} · ${side}` });
        if (isMarkdownNote(file.path)) {
          const compare = item.createEl('button', { cls: 'github-vault-sync-note-compare', text: '查看两端内容' });
          compare.type = 'button';
          compare.addEventListener('click', () => void this.onCompareNote(file.path));
        }
      }
      displayed = end;
      if (more) {
        more.setText(`再显示 30 个（剩余 ${files.length - displayed}）`);
        more.toggleClass('is-hidden', displayed >= files.length);
      }
    };
    let more: HTMLButtonElement | undefined;
    displayMore();
    if (files.length > displayed) {
      more = group.createEl('button', { cls: 'github-vault-sync-note-compare', text: `再显示 30 个（剩余 ${files.length - displayed}）` });
      more.type = 'button';
      more.addEventListener('click', displayMore);
    }
  }

  onClose(): void { this.contentEl.empty(); }
}

class NoteComparisonModal extends GithubVaultSyncModal {
  constructor(app: App, private readonly filePath: string, private readonly local: string,
    private readonly remote: string, private readonly remoteCommit: string,
    private readonly localModified: string, private readonly remoteModified: string) { super(app); }

  onOpen(): void {
    this.modalEl.addClass('github-vault-sync-note-wide-modal');
    this.contentEl.empty();
    this.contentEl.addClass('github-vault-sync-note-comparison');
    this.contentEl.createEl('h2', { text: this.filePath });
    this.contentEl.createEl('p', { cls: 'setting-item-description',
      text: '以下为只读预览，超过 120,000 字的内容会截断。请按内容判断，不要仅依赖设备时间。' });
    const columns = this.contentEl.createDiv({ cls: 'github-vault-sync-note-columns' });
    const left = columns.createDiv();
    left.createEl('h3', { text: '本设备' });
    left.createEl('small', { text: this.localModified, cls: 'setting-item-description' });
    left.createEl('pre', { text: this.local });
    const right = columns.createDiv();
    right.createEl('h3', { text: `GitHub 仓库 · ${this.remoteCommit}` });
    right.createEl('small', { text: this.remoteModified, cls: 'setting-item-description' });
    right.createEl('pre', { text: this.remote });
    new Setting(this.contentEl).addButton((button) => button.setButtonText('返回同步预览').onClick(() => this.close()));
  }

  onClose(): void { this.contentEl.empty(); }
}

class SyncCenterModal extends GithubVaultSyncModal {
  private unsubscribe?: () => void;
  private summaryEl?: HTMLElement;
  private statusEl?: HTMLElement;

  constructor(app: App, private readonly plugin: GithubVaultSyncPlugin) {
    super(app);
  }

  onOpen(): void {
    this.render();
    this.unsubscribe = this.plugin.subscribeSnapshot((snapshot) => {
      this.statusEl?.setText(snapshot.message);
      if (this.summaryEl) renderSyncSummary(this.summaryEl, snapshot);
      if (snapshot.phase === 'waiting-conflicts') this.render();
    });
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    const snapshot = this.plugin.engine.getSnapshot();
    contentEl.createEl('h2', { text: 'GitHub Vault Sync' });
    if (this.plugin.settings.repo) contentEl.createEl('p', { text: `仓库：${this.plugin.settings.repo.owner}/${this.plugin.settings.repo.name} · 分支：${this.plugin.settings.branch}` });
    this.statusEl = contentEl.createEl('p', { cls: 'setting-item-description', text: snapshot.message });
    this.summaryEl = contentEl.createDiv({ cls: 'github-vault-sync-summary' });
    renderSyncSummary(this.summaryEl, snapshot);
    if (snapshot.error) contentEl.createEl('pre', { text: snapshot.error, cls: 'github-vault-sync-error-text' });
    if (snapshot.warnings.length) {
      const list = contentEl.createEl('ul');
      for (const warning of snapshot.warnings.slice(0, 15)) list.createEl('li', { text: warning });
    }
    const actions = new Setting(contentEl);
    actions.addButton((button) => button.setButtonText('预览并同步').setCta().onClick(async () => { await this.plugin.syncNow(); this.render(); }));
    if (this.plugin.settings.encryptionKey) actions.addButton((button) => button.setButtonText('恢复加密配置').onClick(() => void this.plugin.restorePrivateSettings()));
    if ((this.plugin.settings.pendingMerge?.conflicts.length ?? 0) > 0) actions.addButton((button) => button.setButtonText('处理冲突').setWarning().onClick(() => this.plugin.openConflicts()));
    actions.addButton((button) => button.setButtonText('关闭').onClick(() => this.close()));
  }

  onClose(): void { this.unsubscribe?.(); this.contentEl.empty(); }
}

class ConflictModal extends GithubVaultSyncModal {
  private choices: Record<string, ConflictChoice> = {};
  private submitting = false;

  constructor(app: App, private readonly conflicts: Array<{ path: string; localExists: boolean; remoteExists: boolean; localSize?: number; remoteSize?: number; choice: ConflictChoice }>, private readonly onSubmit: (choices: Record<string, ConflictChoice>) => Promise<void>) {
    super(app);
    for (const conflict of conflicts) this.choices[conflict.path] = conflict.choice;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: `同步冲突（${this.conflicts.length}）` });
    contentEl.createEl('p', { text: '先处理同一篇笔记，再逐项检查附件与插件配置。未选中的笔记版本保存在 Vault 本地冲突副本中。' });
    new Setting(contentEl).setName('批量选择 Markdown 笔记').setDesc('不会影响插件设置、密文包或附件冲突。')
      .addDropdown((dropdown) => dropdown.addOptions({ '': '不改变', local: '笔记保留本机', remote: '笔记使用仓库', both: '笔记保留两份' }).onChange((value) => {
      if (!value) return;
      for (const conflict of this.conflicts.filter((item) => isMarkdownNote(item.path))) this.choices[conflict.path] = value as ConflictChoice;
      this.renderChoices();
    }));
    this.choiceContainer = contentEl.createDiv({ cls: 'github-vault-sync-conflicts' });
    this.renderChoices();
    const actions = new Setting(contentEl).setClass('github-vault-sync-modal-actions');
    actions.addButton((button) => button.setButtonText('稍后处理').onClick(() => this.close()));
    actions.addButton((button) => button.setButtonText('确认合并这些文件').setCta().onClick(async () => {
      if (this.conflicts.some((item) => !this.choices[item.path])) { new Notice('请先为每个冲突文件选择版本。'); return; }
      if (this.submitting) return;
      this.submitting = true;
      try {
        await this.onSubmit(this.choices);
        this.close();
      } finally {
        this.submitting = false;
      }
    }));
  }

  private choiceContainer!: HTMLElement;

  private renderChoices(): void {
    if (!this.choiceContainer) return;
    this.choiceContainer.empty();
    for (const conflict of [...this.conflicts].sort((a, b) => Number(isMarkdownNote(b.path)) - Number(isMarkdownNote(a.path)) || a.path.localeCompare(b.path))) {
      const size = `本地 ${conflict.localExists ? formatBytes(conflict.localSize ?? 0) : '不存在'} · 远端 ${conflict.remoteExists ? formatBytes(conflict.remoteSize ?? 0) : '不存在'}`;
      new Setting(this.choiceContainer).setName(conflict.path).setDesc(size).addDropdown((dropdown) => dropdown.addOptions({ '': '请选择', local: '保留本地', remote: '使用远端', both: '保留两份' }).setValue(this.choices[conflict.path] ?? '').onChange((value) => { this.choices[conflict.path] = value as ConflictChoice; }));
    }
  }

  onClose(): void { this.contentEl.empty(); }
}

class RecoveryKeyModal extends GithubVaultSyncModal {
  constructor(app: App, private recoveryKey: string, private readonly recoveryFile: string) { super(app); }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.addClass('github-vault-sync-key-modal');
    this.contentEl.createEl('h2', { text: '恢复密钥' });
    this.contentEl.createEl('p', { text: '仅在此窗口打开时显示。任何拿到此密钥及仓库副本的人都可能解密你的插件凭据；请勿截图分享、粘贴到笔记或上传至 GitHub。' });
    const key = this.contentEl.createEl('code', { cls: 'github-vault-sync-key-value', text: this.recoveryKey });
    key.setAttribute('aria-label', '仅在本机显示的恢复密钥');
    this.contentEl.createEl('small', { text: `本机备份文件：${this.recoveryFile}`, cls: 'setting-item-description' });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText('复制密钥').setCta().onClick(async () => {
        let copied = false;
        try {
          await navigator.clipboard.writeText(this.recoveryKey);
          copied = true;
        } catch {
          const field = document.createElement('textarea');
          field.value = this.recoveryKey;
          field.style.position = 'fixed';
          field.style.opacity = '0';
          document.body.appendChild(field);
          field.select();
          copied = document.execCommand('copy');
          field.remove();
        }
        new Notice(copied ? '恢复密钥已复制；粘贴后请注意清理剪贴板。' : '自动复制失败，请选中密钥文本手动复制。');
      }))
      .addButton((button) => button.setButtonText('关闭并隐藏').onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
    this.recoveryKey = '';
  }
}

class DependencyModal extends GithubVaultSyncModal {
  constructor(app: App, private readonly status: { git: { available: boolean; version: string; executable: string; error?: string }; gitLfs: { available: boolean; version: string; initialized: boolean; error?: string } }) { super(app); }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Git 依赖检测' });
    contentEl.createEl('p', { text: `Git：${this.status.git.available ? this.status.git.version : '未安装'}${this.status.git.executable ? ` · ${this.status.git.executable}` : ''}` });
    contentEl.createEl('p', { text: `Git LFS：${this.status.gitLfs.available ? this.status.gitLfs.version : '未安装'}${this.status.gitLfs.available ? (this.status.gitLfs.initialized ? ' · 已初始化' : ' · 未初始化') : ''}` });
    if (!this.status.git.available || !this.status.gitLfs.available) contentEl.createEl('p', { text: '请安装 Git 和 Git LFS 后重新检测。插件不会静默执行管理员安装。', cls: 'setting-item-description' });
    new Setting(contentEl).addButton((button) => button.setButtonText('关闭').onClick(() => this.close()));
  }

  onClose(): void { this.contentEl.empty(); }
}

class TextModal extends GithubVaultSyncModal {
  constructor(app: App, private readonly title: string, private readonly value: string) { super(app); }
  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl('h2', { text: this.title });
    this.contentEl.createEl('pre', { text: this.value || '暂无日志' });
    new Setting(this.contentEl).addButton((button) => button.setButtonText('关闭').onClick(() => this.close()));
  }
  onClose(): void { this.contentEl.empty(); }
}

class ConfirmModal extends GithubVaultSyncModal {
  private submitting = false;

  constructor(app: App, private readonly title: string, private readonly description: string, private readonly onConfirm: () => Promise<void>) { super(app); }
  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl('h2', { text: this.title });
    this.contentEl.createEl('p', { text: this.description });
    new Setting(this.contentEl).addButton((button) => button.setButtonText('确认').setWarning().onClick(async () => {
      if (this.submitting) return;
      this.submitting = true;
      this.close();
      try { await this.onConfirm(); } finally { this.submitting = false; }
    })).addButton((button) => button.setButtonText('取消').onClick(() => this.close()));
  }
  onClose(): void { this.contentEl.empty(); }
}
