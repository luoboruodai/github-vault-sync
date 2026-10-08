export type AuthType = 'oauth' | 'pat' | null;

export type SyncPhase =
  | 'idle'
  | 'checking'
  | 'scanning'
  | 'staging'
  | 'fetching'
  | 'merging'
  | 'uploading'
  | 'pulling'
  | 'waiting-conflicts'
  | 'completed'
  | 'error';

export type SyncHealth =
  | 'unconfigured'
  | 'dependencies-missing'
  | 'unauthenticated'
  | 'checking'
  | 'local-changes'
  | 'remote-changes'
  | 'conflicts'
  | 'synced'
  | 'error';

export type FileChangeKind =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'binary'
  | 'excluded'
  | 'sensitive'
  | 'large';

export type ConflictChoice = 'local' | 'remote' | 'both' | null;
export type SyncPriority = 'local' | 'remote' | 'manual';

export interface RepoBinding {
  owner: string;
  name: string;
  branch: string;
  remoteUrl: string;
  private: boolean;
}

export interface GithubVaultSyncSettings {
  schemaVersion: number;
  oauthClientId: string;
  token: string;
  authType: AuthType;
  repo: RepoBinding | null;
  startupCheck: boolean;
  autoSyncEnabled: boolean;
  autoSyncDelaySeconds: number;
  encryptedSyncEnabled: boolean;
  encryptionKey: string;
  encryptedFolders: string[];
  encryptionLastDigest: string;
  includeObsidian: boolean;
  branch: string;
  excludePatterns: string[];
  lfsPatterns: string[];
  conflictFolder: string;
  gitUserName: string;
  gitUserEmail: string;
  lastRemoteSha: string;
  lastStatus: SyncHealth;
  lastError: string;
  pendingMerge: PendingMerge | null;
  logEntries: LogEntry[];
}

export interface SyncManifest {
  schemaVersion: number;
  branch: string;
  includeObsidian: boolean;
  excludePatterns: string[];
  lfsPatterns: string[];
  conflictFolder: string;
  generatedBy: string;
}

export interface DependencyStatus {
  git: { available: boolean; version: string; executable: string; error?: string };
  gitLfs: { available: boolean; version: string; initialized: boolean; error?: string };
}

export interface VaultFile {
  path: string;
  absolutePath: string;
  size: number;
  isText: boolean;
  isLfs: boolean;
  excluded: boolean;
  sensitive: boolean;
  exclusionReason?: string;
}

export interface VaultScan {
  files: VaultFile[];
  included: VaultFile[];
  excluded: VaultFile[];
  sensitive: VaultFile[];
  lfsFiles: VaultFile[];
  totalBytes: number;
  includedBytes: number;
  warnings: string[];
  errors: string[];
  caseCollisions: string[][];
  windowsPathIssues: string[];
}

export interface GitChangeEntry {
  status: string;
  path: string;
  oldPath?: string;
}

export interface FileChange {
  path: string;
  kind: FileChangeKind;
  localStatus?: string;
  remoteStatus?: string;
  size?: number;
  hash?: string;
  reason?: string;
}

export interface ConflictItem {
  path: string;
  localRef: string;
  remoteRef: string;
  localExists: boolean;
  remoteExists: boolean;
  localHash?: string;
  remoteHash?: string;
  localSize?: number;
  remoteSize?: number;
  choice: ConflictChoice;
}

export interface PendingMerge {
  remoteRef: string;
  remoteSha: string;
  baseSha: string | null;
  conflicts: ConflictItem[];
  startedAt: string;
  sessionFolder: string;
}

export interface SyncResult {
  ok: boolean;
  message: string;
  changedFiles: FileChange[];
  conflicts: ConflictItem[];
  warnings: string[];
}

export interface SyncDifference {
  localChanged: number;
  remoteChanged: number;
  differingPaths: number;
  totalPaths: number;
  differencePercent: number;
  checkedAt: string;
}

export interface SyncPreview {
  remoteSha: string;
  localFingerprint: string;
  createdAt: string;
  priority: SyncPriority | null;
  notes: FileChange[];
  noteAttachments: FileChange[];
  obsidianConfig: FileChange[];
  otherFiles: FileChange[];
  difference: SyncDifference;
  warnings: string[];
}

export interface SyncSnapshot {
  phase: SyncPhase;
  health: SyncHealth;
  message: string;
  progress?: number;
  progressDetail?: string;
  difference?: SyncDifference;
  encryptedNeedsRestore?: boolean;
  changedFiles: FileChange[];
  conflicts: ConflictItem[];
  warnings: string[];
  error?: string;
}

export interface LogEntry {
  at: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export const PLUGIN_ID = 'github-vault-sync';
export const PLUGIN_NAME = 'GitHub Vault Sync';
export const SYNC_MANIFEST = '.github-vault-sync.json';
export const GIT_ATTRIBUTES = '.gitattributes';
export const DEFAULT_BRANCH = 'main';
export const MIN_APP_VERSION = '1.13.0';

export const DEFAULT_EXCLUDE_PATTERNS = [
  '.git/**',
  '.trash/**',
  '.obsidian/workspace*.json',
  '.obsidian/cache/**',
  '**/*.log',
  '.github-vault-sync-conflicts/**',
  '.github-vault-sync-encrypted/*.tmp-*',
  '.obsidian/plugins/github-vault-sync/data.json',
  // Plugin configuration may contain tokens with unrecognized key names.
  '.obsidian/plugins/**/data.json',
  '**/.npmrc',
  '**/.netrc',
  '**/.pypirc',
  '**/.env',
  '**/.env.*'
];

export const DEFAULT_LFS_PATTERNS = [
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.webp',
  '*.bmp',
  '*.tif',
  '*.tiff',
  '*.svg',
  '*.pdf',
  '*.mp4',
  '*.mov',
  '*.mkv',
  '*.avi',
  '*.webm',
  '*.mp3',
  '*.wav',
  '*.flac',
  '*.m4a',
  '*.zip',
  '*.7z',
  '*.rar',
  '*.ai',
  '*.psd',
  '*.blend',
  '*.c4d',
  '*.exr',
  '*.glb',
  '*.gltf'
];

export const DEFAULT_SETTINGS: GithubVaultSyncSettings = {
  schemaVersion: 1,
  oauthClientId: '',
  token: '',
  authType: null,
  repo: null,
  startupCheck: true,
  autoSyncEnabled: false,
  autoSyncDelaySeconds: 90,
  encryptedSyncEnabled: false,
  encryptionKey: '',
  encryptedFolders: [],
  encryptionLastDigest: '',
  includeObsidian: true,
  branch: DEFAULT_BRANCH,
  excludePatterns: [...DEFAULT_EXCLUDE_PATTERNS],
  lfsPatterns: [...DEFAULT_LFS_PATTERNS],
  conflictFolder: '.github-vault-sync-conflicts',
  gitUserName: 'GitHub Vault Sync',
  gitUserEmail: 'github-vault-sync@users.noreply.github.com',
  lastRemoteSha: '',
  lastStatus: 'unconfigured',
  lastError: '',
  pendingMerge: null,
  logEntries: []
};
