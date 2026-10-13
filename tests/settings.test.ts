import { describe, expect, it } from 'vitest';
import { normalizeHttpProxy, normalizeSettings, CURRENT_SETTINGS_SCHEMA } from '../src/settings';
import { DEFAULT_EXCLUDE_PATTERNS, DEFAULT_SETTINGS } from '../src/types';

describe('settings migration and network options', () => {
  it('adds mandatory security exclusions without discarding custom legacy rules', () => {
    const result = normalizeSettings({ schemaVersion: 1, excludePatterns: ['**/.DS_Store', '.obsidian/plugins/obsidian-memos/**'] });
    expect(result.changed).toBe(true);
    expect(result.settings.schemaVersion).toBe(CURRENT_SETTINGS_SCHEMA);
    expect(result.settings.excludePatterns).toEqual(expect.arrayContaining(DEFAULT_EXCLUDE_PATTERNS));
    expect(result.settings.excludePatterns).toEqual(expect.arrayContaining(['**/.DS_Store', '.obsidian/plugins/obsidian-memos/**']));
    expect(new Set(result.settings.excludePatterns).size).toBe(result.settings.excludePatterns.length);
  });

  it('keeps a current settings object stable when normalized twice', () => {
    const once = normalizeSettings(DEFAULT_SETTINGS).settings;
    const twice = normalizeSettings(once).settings;
    expect(twice).toEqual(once);
    expect(normalizeSettings(once).changed).toBe(false);
  });

  it('accepts local proxy URLs but rejects credentials and unsupported schemes', () => {
    expect(normalizeHttpProxy(' http://127.0.0.1:7897/ ')).toBe('http://127.0.0.1:7897');
    expect(normalizeHttpProxy('socks5h://127.0.0.1:1080')).toBe('socks5h://127.0.0.1:1080');
    expect(normalizeHttpProxy('')).toBe('');
    expect(() => normalizeHttpProxy('http://user:pass@127.0.0.1:7897')).toThrow(/不要包含/);
    expect(() => normalizeHttpProxy('ftp://127.0.0.1:21')).toThrow(/只支持/);
  });
});
