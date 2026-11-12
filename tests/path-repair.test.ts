import { describe, expect, it } from 'vitest';
import { convertWindowsPath, planWindowsPathRepairs } from '../src/path-repair';

describe('Windows path repair', () => {
  it('converts reserved characters, trailing punctuation and reserved device names', () => {
    expect(convertWindowsPath('笔记/标题? 加:引号" 和|竖线* 。.md')).toBe('笔记/标题？ 加：引号＂ 和｜竖线＊ 。.md');
    expect(convertWindowsPath('folder/file.')).toBe('folder/file．');
    expect(convertWindowsPath('folder/name ')).toBe('folder/name　');
    expect(convertWindowsPath('AUX.md')).toBe('_AUX.md');
  });

  it('plans safe renames and rejects no-ops, duplicate targets and existing targets', () => {
    const plan = planWindowsPathRepairs([
      'a/note?.md',
      'a/note?.md',
      'c/already-safe.md',
      'd/existing?.md'
    ], (target) => target === 'd/existing？.md');

    expect(plan.repairs).toEqual([{ from: 'a/note?.md', to: 'a/note？.md' }]);
    expect(plan.errors).toEqual([
      'Multiple files would rename to a/note？.md',
      'Path is already compatible: c/already-safe.md',
      'Rename target already exists: d/existing？.md'
    ]);
  });
});
