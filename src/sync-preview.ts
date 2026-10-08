import path from 'node:path';
import { FileChange, SyncPreview } from './types';

export function isMarkdownNote(relPath: string): boolean {
  return !relPath.startsWith('.obsidian/') && /\.(?:md|markdown)$/i.test(relPath);
}

export function categorizeChanges(
  changes: FileChange[],
  knownNotePaths: Iterable<string>
): Pick<SyncPreview, 'notes' | 'noteAttachments' | 'obsidianConfig' | 'otherFiles'> {
  const folders = new Set<string>();
  for (const note of knownNotePaths) {
    if (!isMarkdownNote(note)) continue;
    const folder = path.posix.dirname(note);
    if (folder !== '.') folders.add(folder);
  }
  for (const change of changes) {
    if (!isMarkdownNote(change.path)) continue;
    const folder = path.posix.dirname(change.path);
    if (folder !== '.') folders.add(folder);
  }
  const result = { notes: [] as FileChange[], noteAttachments: [] as FileChange[],
    obsidianConfig: [] as FileChange[], otherFiles: [] as FileChange[] };
  for (const change of changes) {
    const file = change.path;
    if (isMarkdownNote(file)) result.notes.push(change);
    else if (file.startsWith('.obsidian/') || file.startsWith('.github-vault-sync-encrypted/')
      || file === '.github-vault-sync.json' || file === '.gitattributes') result.obsidianConfig.push(change);
    else if ([...folders].some((folder) => file.startsWith(`${folder}/`))) result.noteAttachments.push(change);
    else result.otherFiles.push(change);
  }
  return result;
}
