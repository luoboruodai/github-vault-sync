import os from 'node:os';
import path from 'node:path';

/** Keep secrets outside the Vault, in the operating system's per-user data area.
 * The optional arguments allow testing platform rules without spoofing Node. */
export function backupDataDirectory(
  platform: NodeJS.Platform = process.platform,
  home: string = os.homedir(),
  env: NodeJS.ProcessEnv = process.env
): string {
  if (platform === 'win32') {
    const appData = env.APPDATA && path.win32.isAbsolute(env.APPDATA)
      ? env.APPDATA : path.win32.join(home, 'AppData', 'Roaming');
    return path.win32.join(appData, 'github-vault-sync-backups');
  }
  if (platform === 'darwin') {
    return path.posix.join(home, 'Library', 'Application Support', 'github-vault-sync-backups');
  }
  const dataHome = env.XDG_DATA_HOME && path.posix.isAbsolute(env.XDG_DATA_HOME)
    ? env.XDG_DATA_HOME : path.posix.join(home, '.local', 'share');
  return path.posix.join(dataHome, 'github-vault-sync-backups');
}
