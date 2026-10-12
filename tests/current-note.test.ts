import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { embeddedAttachmentPaths, fingerprintNoteFiles, selectNoteAndAttachments } from '../src/current-note';

describe('current note scope', () => {
  it('uses embeds only, not ordinary links, when resolving attachments', () => {
    const destinations: Record<string, string | null> = {
      'image.png': 'Notes/image.png',
      'linked-note': 'Notes/linked.md',
      'outside': '../outside.png',
      'hidden': '.obsidian/plugins/demo/main.js'
    };
    expect(embeddedAttachmentPaths('Notes/a.md', [
      { link: 'image.png' }, { link: 'image.png' }, { link: 'linked-note' },
      { link: 'outside' }, { link: 'hidden' }, { link: 'missing' }, {}
    ], (link) => destinations[link] ?? null)).toEqual(['Notes/image.png']);
  });

  it('keeps one note and safe referenced attachments, never other Markdown or config', () => {
    expect(selectNoteAndAttachments('Notes/a.md', [
      'Notes/image.png', 'Notes/image.png', 'Notes/linked.md', '../escape.png',
      '.obsidian/plugins/example/main.js', '.github-vault-sync-encrypted/vault.gvs', 'Notes/chart.pdf'
    ])).toEqual(['Notes/a.md', 'Notes/chart.pdf', 'Notes/image.png']);
    expect(() => selectNoteAndAttachments('../a.md', [])).toThrow();
    expect(() => selectNoteAndAttachments('Notes/a.png', [])).toThrow();
  });
  it('invalidates approval on changed note bytes or referenced attachment bytes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gvs-note-scope-'));
    try {
      await fs.mkdir(path.join(root, 'Notes'));
      await fs.writeFile(path.join(root, 'Notes/a.md'), 'A');
      await fs.writeFile(path.join(root, 'Notes/fig.png'), 'B');
      const paths = ['Notes/a.md', 'Notes/fig.png'];
      const first = await fingerprintNoteFiles(root, paths, 'head');
      await fs.writeFile(path.join(root, 'Notes/fig.png'), 'C');
      expect(await fingerprintNoteFiles(root, paths, 'head')).not.toBe(first);
      await fs.unlink(path.join(root, 'Notes/fig.png'));
      await expect(fingerprintNoteFiles(root, paths, 'head')).rejects.toThrow();
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
});
