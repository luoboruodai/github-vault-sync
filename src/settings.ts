import {
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_LFS_PATTERNS,
  DEFAULT_SETTINGS,
  GithubVaultSyncSettings
} from './types';

export const CURRENT_SETTINGS_SCHEMA = 2;

/**
 * Merge settings from older/prototype builds without dropping user rules.
 * Security exclusions are mandatory: an old `.github-vault-sync.json` or
 * data.json must not silently downgrade the current plaintext safety policy.
 */
export function normalizeSettings(loaded: Partial<GithubVaultSyncSettings> | null | undefined): {
  settings: GithubVaultSyncSettings;
  changed: boolean;
} {
  const source = loaded ?? {};
  const exclude = [...new Set([
    ...DEFAULT_EXCLUDE_PATTERNS,
    ...(Array.isArray(source.excludePatterns) ? source.excludePatterns : [])
  ].map((value) => String(value).trim()).filter(Boolean))];
  const lfs = Array.isArray(source.lfsPatterns) && source.lfsPatterns.length
    ? source.lfsPatterns.map((value) => String(value).trim()).filter(Boolean)
    : [...DEFAULT_LFS_PATTERNS];
  let gitHttpProxy = '';
  if (typeof source.gitHttpProxy === 'string' && source.gitHttpProxy.trim()) {
    try { gitHttpProxy = normalizeHttpProxy(source.gitHttpProxy); } catch { gitHttpProxy = ''; }
  }
  const settings = {
    ...DEFAULT_SETTINGS,
    ...source,
    schemaVersion: CURRENT_SETTINGS_SCHEMA,
    excludePatterns: exclude,
    lfsPatterns: [...new Set(lfs)],
    encryptedFolders: Array.isArray(source.encryptedFolders)
      ? source.encryptedFolders.map((value) => String(value).trim()).filter(Boolean)
      : [...DEFAULT_SETTINGS.encryptedFolders],
    gitHttpProxy
  } as GithubVaultSyncSettings;
  const changed = source.schemaVersion !== settings.schemaVersion
    || JSON.stringify(source.excludePatterns ?? []) !== JSON.stringify(settings.excludePatterns)
    || JSON.stringify(source.lfsPatterns ?? []) !== JSON.stringify(settings.lfsPatterns)
    || source.gitHttpProxy !== settings.gitHttpProxy;
  return { settings, changed };
}

export function normalizeHttpProxy(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  let parsed: URL;
  try { parsed = new URL(trimmed); } catch { throw new Error('Git HTTP 代理必须是完整 URL，例如 http://127.0.0.1:7897'); }
  if (!['http:', 'https:', 'socks5:', 'socks5h:'].includes(parsed.protocol)) {
    throw new Error('Git HTTP 代理只支持 http、https、socks5 或 socks5h');
  }
  if (parsed.username || parsed.password) throw new Error('代理 URL 不要包含用户名或密码；请使用本机代理配置');
  return parsed.toString().replace(/\/$/, '');
}
