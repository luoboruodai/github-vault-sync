import {
  App,
  Modal,
  Notice,
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
import { isMarkdownNote } from './sync-preview';
import {
  ConflictChoice,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_SETTINGS,
  FileChange,
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
  const phase = container.createDiv({ cls: 'github-vault-sync-summary-title' });
  const synced = snapshot.difference && snapshot.difference.differingPaths === 0 &&
    (snapshot.phase === 'completed' || snapshot.phase === 'idle');
  phase.setText(synced ? `本机与仓库一致 · ${snapshot.difference?.totalPaths ?? 0} 个文件`
    : snapshot.progressDetail || snapshot.message);
  if (snapshot.phase === 'staging' || snapshot.phase === 'uploading' || snapshot.phase === 'scanning' || snapshot.phase === 'fetching') {
    const progress = document.createElement('progress');
    progress.className = 'github-vault-sync-progress';
    progress.max = 100;
    if (snapshot.progress !== undefined) progress.value = snapshot.progress;
    progress.setAttribute('aria-label', snapshot.progressDetail || '同步进行中');
    container.appendChild(progress);
    if (snapshot.progress !== undefined) container.createEl('small', { text: `当前阶段 ${snapshot.progress}%` });
  }
  if (snapshot.difference) {
    const diff = snapshot.difference;
    if (!synced) {
      container.createEl('p', { cls: 'setting-item-description',
        text: `本地变化 ${diff.localChanged} · 仓库变化 ${diff.remoteChanged} · 差异 ${diff.differingPaths}/${diff.totalPaths} 个文件（${diff.differencePercent}%）` });
      container.createEl('small', { text: '按文件路径统计，不是笔记文字相似度。' });
    }
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
  private vaultPath = '';
  private actionRunning = false;
  private autoTimer: number | null = null;
  private autoPending = false;
  private lastAutoAlert = '';
  private readonly snapshotListeners = new Set<(snapshot: SyncSnapshot) => void>();

  async onload(): Promise<void> {
    const loaded = await this.loadData() as Partial<GithubVaultSyncSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(loaded ?? {}), excludePatterns: [...DEFAULT_SETTINGS.excludePatterns], lfsPatterns: [...DEFAULT_SETTINGS.lfsPatterns] };
    if (loaded?.excludePatterns) this.settings.excludePatterns = loaded.excludePatterns;
    if (loaded?.lfsPatterns) this.settings.lfsPatterns = loaded.lfsPatterns;
    this.vaultPath = vaultBasePath(this.app);
    this.engine = new SyncEngine(
      this.vaultPath,
      this.settings,
      async () => this.saveSensitiveSettings(),
      (snapshot) => this.updateStatus(snapshot),
      (level, message) => this.addLog(level, message)
    );

    this.statusBar = this.addStatusBarItem();
    this.statusBar.addClass('github-vault-sync-status');
    this.statusBar.setAttribute('role', 'button');
    this.statusBar.setAttribute('tabindex', '0');
    this.statusBar.addEventListener('click', () => this.openSyncCenter());
    this.statusBar.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.openSyncCenter(); }
    });
    this.updateStatus(this.engine.getSnapshot());
    this.addSettingTab(new GithubVaultSyncSettingTab(this.app, this));

    this.addCommand({ id: 'connect-github', name: '连接 GitHub', callback: () => void this.connectGithub() });
    this.addCommand({ id: 'bind-repository', name: '创建或绑定同步仓库', callback: () => void this.bindRepository() });
    this.addCommand({ id: 'scan-changes', name: '扫描本地/远端变化', callback: () => void this.runAction('scan', () => this.engine.checkRemote()) });
    this.addCommand({ id: 'sync-now', name: '预览并同步笔记', callback: () => void this.syncNow() });
    this.addCommand({ id: 'open-sync-center', name: '打开同步中心', callback: () => this.openSyncCenter() });
    this.addCommand({ id: 'check-dependencies', name: '重新检测 Git/Git LFS', callback: () => void this.checkDependencies() });
    this.addCommand({ id: 'restore-encrypted-settings', name: '恢复加密的插件配置', callback: () => void this.restorePrivateSettings() });
    this.addCommand({ id: 'open-sync-log', name: '查看同步日志', callback: () => this.openLogs() });
    this.addCommand({ id: 'disconnect-repository', name: '断开仓库与清除凭据', callback: () => void this.disconnect() });

    this.addRibbonIcon('git-branch', 'GitHub Vault Sync', () => this.openSyncCenter());
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

  async saveSensitiveSettings(): Promise<void> {
    await this.saveData(this.settings);
    await fs.chmod(path.join(this.vaultPath, '.obsidian', 'plugins', 'github-vault-sync', 'data.json'), 0o600);
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
      this.statusBar.setText(`GitHub Sync · ${healthLabel(snapshot.health)}`);
      this.statusBar.setAttribute('aria-label', snapshot.message);
      this.statusBar.toggleClass('github-vault-sync-error', snapshot.health === 'error');
      this.statusBar.toggleClass('github-vault-sync-conflict', snapshot.health === 'conflicts');
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
        this.settings.encryptedSyncEnabled = true;
        await this.saveSensitiveSettings();
        new Notice(`恢复密钥已导入并保存到本机：${recoveryPath}`, 8000);
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
      if (this.autoPending) {
        this.autoPending = false;
        this.scheduleAutoSync();
      }
    }
  }

  async syncNow(): Promise<void> {
    if (this.actionRunning) { new Notice('已有同步检查正在运行，请稍候。'); return; }
    this.actionRunning = true;
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
        const scan = await this.engine.scan();
        const preview = new InitialBindingModal(this.app, binding, scan, async (direction) => {
          preview.close();
          const result = await this.runAction('bind-repository', () => this.engine.configureRepository(binding, direction));
          if (result && 'conflicts' in result && result.conflicts.length) this.openConflicts();
        });
        preview.open();
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

  constructor(app: App, private readonly plugin: GithubVaultSyncPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    this.unsubscribe?.();
    containerEl.empty();
    containerEl.addClass('github-vault-sync-settings-page');
    const hero = containerEl.createDiv({ cls: 'github-vault-sync-hero' });
    hero.createEl('h2', { text: 'GitHub Vault Sync' });
    hero.createEl('p', { text: this.plugin.settings.repo
      ? `${this.plugin.settings.repo.owner}/${this.plugin.settings.repo.name} · ${this.plugin.settings.branch} · ${this.plugin.settings.repo.private ? '私有仓库' : '仓库'}`
      : '尚未连接同步仓库' });
    hero.createEl('small', { text: '先看笔记与配置差异，再选冲突优先方；未经确认不会上传。' });

    const overview = containerEl.createDiv({ cls: 'github-vault-sync-panel github-vault-sync-panel-main' });
    overview.createEl('h3', { text: '笔记同步' });
    new Setting(overview)
      .setName('同步前预览')
      .setDesc('只读检查 Markdown、笔记附件和 Obsidian 配置；确认本机／仓库优先后再同步。')
      .addButton((button) => button.setButtonText('预览并同步').setCta()
        .setDisabled(!this.plugin.settings.repo || !this.plugin.settings.token)
        .onClick(() => void this.plugin.syncNow()));
    const summary = overview.createDiv({ cls: 'github-vault-sync-summary' });
    renderSyncSummary(summary, this.plugin.engine.getSnapshot());
    this.unsubscribe = this.plugin.subscribeSnapshot((snapshot) => renderSyncSummary(summary, snapshot));
    new Setting(overview)
      .setName('及时检查')
      .setDesc('本地变更后防抖检查，另每 5 分钟检查远端；检测到变化会提醒你预览，不会自动上传。')
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.autoSyncEnabled)
        .onChange(async (value) => this.plugin.setAutoSyncEnabled(value)));

    const privacy = containerEl.createDiv({ cls: 'github-vault-sync-panel' });
    privacy.createEl('h3', { text: '隐私与恢复' });
    privacy.createEl('p', { text: this.plugin.settings.encryptedSyncEnabled
      ? '插件私有配置已加密镜像到仓库；恢复密钥只在本机。请在别处备份密钥。'
      : '可把插件 data.json 与例外插件加密成一个密文包，不上传明文凭据。', cls: 'setting-item-description' });
    new Setting(privacy)
      .setName('恢复密钥')
      .setDesc('明确点击后在弹窗中显示，支持一键复制；关闭弹窗即隐藏。')
      .addButton((button) => button.setButtonText(this.plugin.settings.encryptedSyncEnabled ? '查看并复制' : '启用加密')
        .setDisabled(!this.plugin.settings.repo)
        .onClick(() => void (this.plugin.settings.encryptedSyncEnabled ? this.plugin.showRecoveryFile() : this.plugin.enableEncryptedSync())));
    if (!this.plugin.settings.encryptionKey) {
      let recoveryInput = '';
      new Setting(privacy)
        .setName('导入其他设备的密钥')
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
        .setDesc('先备份再解密，默认不覆盖本机 GitHub 登录；恢复后需重启。')
        .addButton((button) => button.setButtonText('解密并恢复').onClick(() => void this.plugin.restorePrivateSettings()));
    }

    const connection = containerEl.createEl('details', { cls: 'github-vault-sync-details' });
    connection.open = !this.plugin.settings.repo || !this.plugin.settings.token;
    connection.createEl('summary', { text: '账户与仓库' });
    new Setting(connection)
      .setName('GitHub 登录')
      .setDesc(this.plugin.settings.token ? `已连接（${this.plugin.settings.authType ?? 'PAT'}）` : '未连接')
      .addButton((button) => button.setButtonText('连接／更新').onClick(() => void this.plugin.connectGithub()));
    new Setting(connection)
      .setName('绑定仓库')
      .setDesc(this.plugin.settings.repo ? `${this.plugin.settings.repo.owner}/${this.plugin.settings.repo.name}` : '尚未绑定')
      .addButton((button) => button.setButtonText('创建／绑定').onClick(() => void this.plugin.bindRepository()));
    if (!this.plugin.settings.token || this.plugin.settings.authType === 'oauth') {
      new Setting(connection)
        .setName('OAuth Client ID')
        .setDesc('仅在使用浏览器 Device Flow 授权时需要。')
        .addText((text) => text.setValue(this.plugin.settings.oauthClientId).onChange(async (value) => {
          this.plugin.settings.oauthClientId = value.trim();
          await this.plugin.saveSensitiveSettings();
        }));
    }

    const advanced = containerEl.createEl('details', { cls: 'github-vault-sync-details' });
    advanced.createEl('summary', { text: '高级选项与排除规则' });
    new Setting(advanced)
      .setName('同步 .obsidian 设置')
      .setDesc('插件代码和主题可同步；data.json 明文始终排除，私有配置只通过密文镜像同步。')
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.includeObsidian).onChange(async (value) => {
        this.plugin.settings.includeObsidian = value;
        await this.plugin.saveSensitiveSettings();
      }));
    new Setting(advanced)
      .setName('检查延迟（秒）')
      .setDesc('30–600 秒，默认 90 秒。上传仍需逐次确认。')
      .addText((text) => text.setValue(String(this.plugin.settings.autoSyncDelaySeconds)).onChange(async (value) => {
        const seconds = Number.parseInt(value, 10);
        if (Number.isFinite(seconds) && seconds >= 30 && seconds <= 600) {
          this.plugin.settings.autoSyncDelaySeconds = seconds;
          await this.plugin.saveSensitiveSettings();
        }
      }));
    new Setting(advanced)
      .setName('排除规则')
      .setDesc('每行一条 glob；凭据类文件与当前插件 data.json 永远不以明文提交。')
      .addTextArea((area) => {
        area.inputEl.rows = 9;
        area.setValue(this.plugin.settings.excludePatterns.join('\n')).onChange(async (value) => {
          this.plugin.settings.excludePatterns = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
          await this.plugin.saveSensitiveSettings();
        });
      });
    new Setting(advanced)
      .setName('Git LFS 文件类型')
      .setDesc('图片、视频等附件按这些模式使用 Git LFS。')
      .addTextArea((area) => {
        area.inputEl.rows = 7;
        area.setValue(this.plugin.settings.lfsPatterns.join('\n')).onChange(async (value) => {
          this.plugin.settings.lfsPatterns = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
          await this.plugin.saveSensitiveSettings();
        });
      });
    new Setting(advanced)
      .setName('Git 提交作者')
      .addText((text) => text.setValue(this.plugin.settings.gitUserName).onChange(async (value) => {
        this.plugin.settings.gitUserName = value.trim() || 'GitHub Vault Sync';
        await this.plugin.saveSensitiveSettings();
      }));
    new Setting(advanced)
      .setName('Git 提交邮箱')
      .addText((text) => text.setValue(this.plugin.settings.gitUserEmail).onChange(async (value) => {
        this.plugin.settings.gitUserEmail = value.trim() || 'github-vault-sync@users.noreply.github.com';
        await this.plugin.saveSensitiveSettings();
      }));
    new Setting(advanced)
      .setName('启动时检查远端')
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.startupCheck).onChange(async (value) => {
        this.plugin.settings.startupCheck = value;
        await this.plugin.saveSensitiveSettings();
      }));
    new Setting(advanced)
      .setName('工具')
      .addButton((button) => button.setButtonText('检测 Git / LFS').onClick(() => void this.plugin['checkDependencies']()))
      .addButton((button) => button.setButtonText('查看日志').onClick(() => this.plugin.openLogs()));
    new Setting(advanced)
      .setName('完整恢复本插件登录')
      .setDesc('谨慎：解密恢复时覆盖本机 PAT，需再次确认。')
      .addButton((button) => button.setButtonText('含凭据恢复').setWarning().setDisabled(!this.plugin.settings.encryptionKey)
        .onClick(() => void this.plugin.restorePrivateSettings(true)));
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

class AuthModal extends Modal {
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

class DeviceCodeModal extends Modal {
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

class RepositoryModal extends Modal {
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
    new Setting(contentEl).setName('仓库名').addText((text) => text.setValue(this.name).onChange((value) => { this.name = value.trim(); }));
    new Setting(contentEl).addButton((button) => button.setButtonText('创建私有仓库').setCta().onClick(() => void this.onSubmit({ type: 'create', name: this.name }))).addButton((button) => button.setButtonText('绑定已有仓库').onClick(() => void this.onSubmit({ type: 'bind', owner: this.owner, name: this.name }))).addButton((button) => button.setButtonText('取消').onClick(() => this.close()));
  }

  onClose(): void { this.contentEl.empty(); }
}

class InitialBindingModal extends Modal {
  constructor(app: App, private readonly binding: RepoBinding, private readonly scan: VaultScan, private readonly onSubmit: (direction: 'local' | 'remote') => Promise<void>) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: '首次绑定预检' });
    contentEl.createEl('p', { text: `${this.binding.owner}/${this.binding.name} · ${this.scan.files.length} 个本地文件 · ${formatBytes(this.scan.includedBytes)} 将参与同步。` });
    if (this.scan.warnings.length) {
      contentEl.createEl('h3', { text: '警告' });
      const list = contentEl.createEl('ul');
      for (const warning of this.scan.warnings.slice(0, 20)) list.createEl('li', { text: warning });
    }
    contentEl.createEl('p', { text: '继续前请选择初始方向。远端恢复会先备份本地纳入同步的文件；本地发布不会强制覆盖远端历史。' });
    new Setting(contentEl).addButton((button) => button.setButtonText('以本地 Vault 为准').setCta().onClick(() => void this.onSubmit('local'))).addButton((button) => button.setButtonText('从远端恢复').onClick(() => void this.onSubmit('remote'))).addButton((button) => button.setButtonText('取消').onClick(() => this.close()));
  }

  onClose(): void { this.contentEl.empty(); }
}

class SyncPreviewModal extends Modal {
  private selected: SyncPriority | null = null;

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
    const actions = new Setting(contentEl);
    actions.addButton((button) => button.setButtonText('确认并同步').setCta().onClick(async () => {
      if (!this.selected || !selected) { new Notice('先选择同一篇笔记发生冲突时的优先方式。'); return; }
      const priority = this.selected;
      this.close();
      await this.onSubmit(priority);
    }));
    actions.addButton((button) => button.setButtonText('取消，不上传').onClick(() => this.close()));
  }

  private renderGroup(container: HTMLElement, title: string, files: FileChange[]): void {
    const group = container.createDiv({ cls: 'github-vault-sync-preview-group' });
    group.createEl('h3', { text: `${title} · ${files.length}` });
    if (!files.length) { group.createEl('p', { text: '没有发现差异', cls: 'setting-item-description' }); return; }
    const list = group.createEl('ul');
    for (const file of files.slice(0, 30)) {
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
    if (files.length > 30) group.createEl('p', { text: `另有 ${files.length - 30} 个文件未展开…`, cls: 'setting-item-description' });
  }

  onClose(): void { this.contentEl.empty(); }
}

class NoteComparisonModal extends Modal {
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

class SyncCenterModal extends Modal {
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

class ConflictModal extends Modal {
  private choices: Record<string, ConflictChoice> = {};

  constructor(app: App, private readonly conflicts: Array<{ path: string; localExists: boolean; remoteExists: boolean; localSize?: number; remoteSize?: number; choice: ConflictChoice }>, private readonly onSubmit: (choices: Record<string, ConflictChoice>) => Promise<void>) {
    super(app);
    for (const conflict of conflicts) this.choices[conflict.path] = conflict.choice;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: `同步冲突（${this.conflicts.length}）` });
    contentEl.createEl('p', { text: 'GitHub Vault Sync 不自动合并同一路径的两份修改。请选择每个文件的版本。' });
    new Setting(contentEl).setName('批量默认').addDropdown((dropdown) => dropdown.addOptions({ '': '不改变', local: '全部保留本地', remote: '全部使用远端', both: '全部保留两份' }).onChange((value) => {
      if (!value) return;
      for (const conflict of this.conflicts) this.choices[conflict.path] = value as ConflictChoice;
      this.renderChoices();
    }));
    this.choiceContainer = contentEl.createDiv({ cls: 'github-vault-sync-conflicts' });
    this.renderChoices();
    new Setting(contentEl).addButton((button) => button.setButtonText('应用选择').setCta().onClick(() => void this.onSubmit(this.choices))).addButton((button) => button.setButtonText('取消').onClick(() => this.close()));
  }

  private choiceContainer!: HTMLElement;

  private renderChoices(): void {
    if (!this.choiceContainer) return;
    this.choiceContainer.empty();
    for (const conflict of this.conflicts) {
      const size = `本地 ${conflict.localExists ? formatBytes(conflict.localSize ?? 0) : '不存在'} · 远端 ${conflict.remoteExists ? formatBytes(conflict.remoteSize ?? 0) : '不存在'}`;
      new Setting(this.choiceContainer).setName(conflict.path).setDesc(size).addDropdown((dropdown) => dropdown.addOptions({ '': '请选择', local: '保留本地', remote: '使用远端', both: '保留两份' }).setValue(this.choices[conflict.path] ?? '').onChange((value) => { this.choices[conflict.path] = value as ConflictChoice; }));
    }
  }

  onClose(): void { this.contentEl.empty(); }
}

class RecoveryKeyModal extends Modal {
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

class DependencyModal extends Modal {
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

class TextModal extends Modal {
  constructor(app: App, private readonly title: string, private readonly value: string) { super(app); }
  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl('h2', { text: this.title });
    this.contentEl.createEl('pre', { text: this.value || '暂无日志' });
    new Setting(this.contentEl).addButton((button) => button.setButtonText('关闭').onClick(() => this.close()));
  }
  onClose(): void { this.contentEl.empty(); }
}

class ConfirmModal extends Modal {
  constructor(app: App, private readonly title: string, private readonly description: string, private readonly onConfirm: () => Promise<void>) { super(app); }
  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl('h2', { text: this.title });
    this.contentEl.createEl('p', { text: this.description });
    new Setting(this.contentEl).addButton((button) => button.setButtonText('确认').setWarning().onClick(async () => { this.close(); await this.onConfirm(); })).addButton((button) => button.setButtonText('取消').onClick(() => this.close()));
  }
  onClose(): void { this.contentEl.empty(); }
}
