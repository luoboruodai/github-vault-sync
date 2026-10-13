import { describe, expect, it } from 'vitest';
import { backupDataDirectory } from '../src/platform-paths';

describe('per-user recovery and restore paths', () => {
  it('retains the existing macOS location so existing keys stay discoverable', () => {
    expect(backupDataDirectory('darwin', '/Users/example', {}))
      .toBe('/Users/example/Library/Application Support/github-vault-sync-backups');
  });

  it('uses Windows Roaming AppData and falls back safely when APPDATA is missing', () => {
    expect(backupDataDirectory('win32', 'C:\\Users\\example', { APPDATA: 'C:\\Users\\example\\AppData\\Roaming' }))
      .toBe('C:\\Users\\example\\AppData\\Roaming\\github-vault-sync-backups');
    expect(backupDataDirectory('win32', 'C:\\Users\\example', { APPDATA: 'relative\\path' }))
      .toBe('C:\\Users\\example\\AppData\\Roaming\\github-vault-sync-backups');
  });

  it('honors an absolute XDG location on Linux but never writes relative to the Vault', () => {
    expect(backupDataDirectory('linux', '/home/example', { XDG_DATA_HOME: '/data/example' }))
      .toBe('/data/example/github-vault-sync-backups');
    expect(backupDataDirectory('linux', '/home/example', { XDG_DATA_HOME: '../relative' }))
      .toBe('/home/example/.local/share/github-vault-sync-backups');
  });
});
