import { describe, expect, it } from 'vitest';
import { categorizeChanges, isMarkdownNote } from '../src/sync-preview';
import { FileChange } from '../src/types';

describe('note-first sync preview', () => {
  it('shows Markdown, its folder attachments, Obsidian settings, then other files', () => {
    const items: FileChange[] = [
      { path: '.obsidian/app.json', kind: 'modified' },
      { path: '.github-vault-sync-encrypted/vault.gvs', kind: 'binary' },
      { path: 'Notes/images/figure.png', kind: 'binary' },
      { path: 'Notes/today.md', kind: 'modified' },
      { path: 'standalone.pdf', kind: 'binary' }
    ];
    const groups = categorizeChanges(items, ['Notes/archive.md']);
    expect(groups.notes.map((file) => file.path)).toEqual(['Notes/today.md']);
    expect(groups.noteAttachments.map((file) => file.path)).toEqual(['Notes/images/figure.png']);
    expect(groups.obsidianConfig.map((file) => file.path)).toEqual(['.obsidian/app.json', '.github-vault-sync-encrypted/vault.gvs']);
    expect(groups.otherFiles.map((file) => file.path)).toEqual(['standalone.pdf']);
  });
  it('never treats hidden Obsidian Markdown as an ordinary note', () => {
    expect(isMarkdownNote('.obsidian/plugins/demo/README.md')).toBe(false);
    expect(isMarkdownNote('笔记/概念.MD')).toBe(true);
  });
});
