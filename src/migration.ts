import path from 'node:path';
import { isMarkdownNote } from './sync-preview';

export interface VaultOverlap {
  localOnly: string[];
  remoteOnly: string[];
  shared: string[];
  sameNameDifferentFolder: Array<{ name: string; local: string; remote: string }>;
  structuralConflicts: string[];
}

/** Names alone never imply equal content. Same basename in different folders is kept separate. */
export function compareVaultPaths(localPaths: Iterable<string>, remotePaths: Iterable<string>): VaultOverlap {
  const local = new Set(localPaths);
  const remote = new Set(remotePaths);
  const shared = [...local].filter((p) => remote.has(p)).sort();
  const localOnly = [...local].filter((p) => !remote.has(p)).sort();
  const remoteOnly = [...remote].filter((p) => !local.has(p)).sort();
  const structuralConflicts = new Set<string>();
  const entries = [...new Set([...local, ...remote])];
  const insensitive = new Map<string, string>();
  for (const current of entries) {
    const lower = current.normalize('NFC').toLocaleLowerCase('en-US');
    const prior = insensitive.get(lower);
    if (prior && prior !== current) structuralConflicts.add(`${prior} ↔ ${current} (case/Unicode)`);
    insensitive.set(lower, current);
    let slash = current.indexOf('/');
    while (slash >= 0) {
      const parent = current.slice(0, slash);
      if (local.has(parent) || remote.has(parent)) structuralConflicts.add(`${parent} ↔ ${current} (file/folder)`);
      slash = current.indexOf('/', slash + 1);
    }
  }
  const localByName = new Map<string, string[]>();
  for (const rel of local) {
    if (!isMarkdownNote(rel)) continue;
    const key = path.posix.basename(rel).normalize('NFC').toLocaleLowerCase('en-US');
    localByName.set(key, [...(localByName.get(key) ?? []), rel]);
  }
  const sameNameDifferentFolder: VaultOverlap['sameNameDifferentFolder'] = [];
  for (const remotePath of remoteOnly) {
    if (!isMarkdownNote(remotePath)) continue;
    const key = path.posix.basename(remotePath).normalize('NFC').toLocaleLowerCase('en-US');
    for (const localPath of localByName.get(key) ?? []) {
      if (localPath !== remotePath) sameNameDifferentFolder.push({ name: path.posix.basename(remotePath), local: localPath, remote: remotePath });
    }
  }
  return { localOnly, remoteOnly, shared, sameNameDifferentFolder,
    structuralConflicts: [...structuralConflicts].sort() };
}
