import { GitChangeEntry, SyncDifference } from './types';

export function changedPaths(entries: GitChangeEntry[]): Set<string> {
  const paths = new Set<string>();
  for (const entry of entries) {
    if (entry.path) paths.add(entry.path);
    if (entry.oldPath) paths.add(entry.oldPath);
  }
  return paths;
}

/** File-level difference, not a textual similarity score. */
export function summarizeDifference(
  localFiles: Iterable<string>,
  remoteFiles: Iterable<string>,
  localChanges: Iterable<string>,
  remoteChanges: Iterable<string>,
  checkedAt = new Date().toISOString()
): SyncDifference {
  const local = new Set(localFiles);
  const remote = new Set(remoteFiles);
  const left = new Set(localChanges);
  const right = new Set(remoteChanges);
  const allPaths = new Set([...local, ...remote]);
  const different = new Set([...left, ...right]);
  // A missing working file or a new untracked file also differs, even when
  // status reporting was interrupted between file enumeration and comparison.
  for (const item of allPaths) if (local.has(item) !== remote.has(item)) different.add(item);
  return {
    localChanged: left.size,
    remoteChanged: right.size,
    differingPaths: different.size,
    totalPaths: allPaths.size,
    differencePercent: allPaths.size ? Math.min(100, Math.round(different.size / allPaths.size * 10000) / 100) : 0,
    checkedAt
  };
}
