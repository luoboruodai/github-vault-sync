import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isMarkdownNote } from './sync-preview';
import { isSafeRelativePath, normalizeRelPath, sha256File } from './utils';

export interface CurrentNotePlan {
  notePath: string;
  attachments: string[];
  selectedPaths: string[];
  remoteSha: string;
  localHead: string;
  fingerprint: string;
  changedPaths: string[];
  remoteHasNote: boolean;
  remoteNoteDifferent: boolean;
  noteContent?: string;
}

export interface EmbeddedLink {
  link?: string;
}

/**
 * Resolve only actual embeds from Obsidian's metadata cache. `resolvedLinks`
 * also contains ordinary wiki/Markdown links, and treating those as upload
 * scope would unexpectedly publish unrelated notes or documents.
 */
export function embeddedAttachmentPaths(
  notePath: string,
  embeds: readonly EmbeddedLink[],
  resolve: (link: string, sourcePath: string) => string | null | undefined
): string[] {
  const resolved = new Set<string>();
  for (const embed of embeds) {
    if (!embed.link) continue;
    const target = resolve(embed.link, notePath);
    if (!target || !isSafeRelativePath(target) || normalizeRelPath(target) !== target) continue;
    if (isMarkdownNote(target) || target.split('/').some((part) => part.startsWith('.'))) continue;
    resolved.add(target);
  }
  return [...resolved].sort((a, b) => a.localeCompare(b));
}

/** Only non-Markdown resolved embeds are eligible; a linked note never becomes a scope expansion. */
export function selectNoteAndAttachments(notePath: string, resolvedPaths: readonly string[]): string[] {
  if (!isSafeRelativePath(notePath) || !isMarkdownNote(notePath) || normalizeRelPath(notePath) !== notePath) {
    throw new Error('Only a saved Markdown note inside the vault can be synchronized');
  }
  if (resolvedPaths.length > 500) throw new Error('This note has over 500 linked attachments; review them before uploading');
  const selected = new Set([notePath]);
  for (const value of resolvedPaths) {
    if (!isSafeRelativePath(value) || normalizeRelPath(value) !== value) continue;
    if (isMarkdownNote(value) || value.split('/').some((part) => part.startsWith('.'))) continue;
    selected.add(value);
  }
  return [...selected].sort((a, b) => a.localeCompare(b));
}

/** Fingerprint exactly the approved scope, not unrelated unsynchronized notes. */
export async function fingerprintNoteFiles(vaultPath: string, paths: readonly string[], localHead: string): Promise<string> {
  const hash = createHash('sha256').update(localHead);
  for (const rel of [...new Set(paths)].sort()) {
    if (!isSafeRelativePath(rel) || normalizeRelPath(rel) !== rel) throw new Error(`Unsafe note path: ${rel}`);
    let current = vaultPath;
    for (const component of rel.split('/')) {
      current = path.join(current, component);
      const info = await fs.lstat(current);
      if (info.isSymbolicLink()) throw new Error(`Symlink in note path: ${rel}`);
    }
    const stat = await fs.lstat(current);
    if (!stat.isFile()) throw new Error(`Selected path is not a regular file: ${rel}`);
    hash.update(rel).update(String(stat.size)).update(await sha256File(current));
  }
  return hash.digest('hex');
}
