import { describe, expect, it } from 'vitest';
import { compareVaultPaths } from '../src/migration';

describe('new Vault vs older repository names', () => {
  it('does not silently overwrite distinct notes with the same basename in different folders', () => {
    const preview = compareVaultPaths(['Today/My Note.md', 'folder.md'], ['Archive/My Note.md', 'different.md']);
    expect(preview.shared).toEqual([]);
    expect(preview.sameNameDifferentFolder).toEqual([
      { name: 'My Note.md', local: 'Today/My Note.md', remote: 'Archive/My Note.md' }
    ]);
  });
  it('blocks mixed file/directory or case-insensitive cross-device collisions', () => {
    const preview = compareVaultPaths(['Foo.md', 'pic'], ['foo.md', 'pic/frame.png']);
    expect(preview.structuralConflicts).toEqual(expect.arrayContaining([
      expect.stringContaining('Foo.md ↔ foo.md'), expect.stringContaining('pic ↔ pic/frame.png')
    ]));
  });
  it('treats the same path as shared, not as identical content', () => {
    const preview = compareVaultPaths(['A.md'], ['A.md']);
    expect(preview.shared).toEqual(['A.md']);
    expect(preview.sameNameDifferentFolder).toEqual([]);
  });
});
