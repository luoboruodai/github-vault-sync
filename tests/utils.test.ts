import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/types';
import { isLfsFile, isSafeRelativePath, looksSensitive, matchesPattern, pathHasWindowsIssue } from '../src/utils';

describe('vault path and policy utilities', () => {
  it('matches gitignore-like glob patterns', () => {
    expect(matchesPattern('.obsidian/workspace.json', '.obsidian/workspace*.json')).toBe(true);
    expect(matchesPattern('图片存储/a.png', '*.png')).toBe(true);
    expect(matchesPattern('图片存储/a.png', '**/*.png')).toBe(true);
  });

  it('identifies LFS attachments', () => {
    expect(isLfsFile('图片存储/a.png', DEFAULT_SETTINGS.lfsPatterns)).toBe(true);
    expect(isLfsFile('笔记.md', DEFAULT_SETTINGS.lfsPatterns)).toBe(false);
  });

  it('detects sensitive configuration content', () => {
    expect(looksSensitive('{"apiToken":"ghp_example"}', 'data.json')).toBe(true);
    expect(looksSensitive('普通笔记内容', '笔记.md')).toBe(false);
  });

  it('rejects unsafe and Windows-incompatible paths', () => {
    expect(isSafeRelativePath('../secret.md')).toBe(false);
    expect(isSafeRelativePath('/absolute.md')).toBe(false);
    expect(pathHasWindowsIssue('CON/file.md')).toBe(true);
    expect(pathHasWindowsIssue('合法/文件.md')).toBe(false);
  });
});
