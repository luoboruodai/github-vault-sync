import { describe, expect, it } from 'vitest';
import { changedPaths, summarizeDifference } from '../src/difference';

describe('file-level local/remote comparison', () => {
  it('counts changed paths once even when both sides edited the same file', () => {
    const summary = summarizeDifference(
      ['a.md', 'b.md', 'local.md'], ['a.md', 'b.md', 'remote.md'],
      ['a.md', 'local.md'], ['a.md', 'remote.md'], '2026-10-08T00:00:00.000Z'
    );
    expect(summary).toMatchObject({
      localChanged: 2, remoteChanged: 2, differingPaths: 3, totalPaths: 4, differencePercent: 75
    });
  });
  it('reports zero for an empty or synchronized repository', () => {
    expect(summarizeDifference([], [], [], []).differencePercent).toBe(0);
    expect(summarizeDifference(['a.md'], ['a.md'], [], []).differingPaths).toBe(0);
  });
  it('tracks both source and destination of a rename', () => {
    expect([...changedPaths([{ status: 'R', oldPath: 'old.md', path: 'new.md' }])].sort())
      .toEqual(['new.md', 'old.md']);
  });
});
