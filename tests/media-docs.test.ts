import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// These hashes identify the exact MP4s approved for the documentation preview.
const approvedMedia = {
  'overview-b-status-flow.mp4': 'a8e8531d4bcaff9ee9d552e7d6a4aab5fdcd1f53a30cdb4929ff47f57ae9cc80',
  'safe-sync-a-preview.mp4': '7d9716643676fe4d847f349078495852540306aaeccb92caed6b6a3844a9f031',
  'recovery-c-encrypted-boundary.mp4': '60893bcbe8b8521647e7cc423a7faf8716a288d484894e401f3f702c4a0a4d63'
} as const;
const projectRoot = path.resolve(__dirname, '..');

describe('approved UI-motion documentation', () => {
  it('contains only the three approved MP4 files, with unchanged contents', async () => {
    const mediaDir = path.join(projectRoot, 'docs', 'media');
    expect((await readdir(mediaDir)).sort()).toEqual(Object.keys(approvedMedia).sort());

    for (const [filename, expectedHash] of Object.entries(approvedMedia)) {
      const video = await readFile(path.join(mediaDir, filename));
      expect(video.subarray(4, 8).toString('ascii')).toBe('ftyp');
      expect(createHash('sha256').update(video).digest('hex')).toBe(expectedHash);
    }
  });

  it.each(['README.md', 'README.zh-CN.md'])('%s has a playable-file link outside the inline HTML fallback', async (name) => {
    const readme = await readFile(path.join(projectRoot, name), 'utf8');
    const tour = readme.split('## UI motion tour')[1] ?? readme.split('## UI Motion 界面动效导览')[1];
    expect(tour).toBeDefined();
    for (const filename of Object.keys(approvedMedia)) {
      const relativePath = `docs/media/${filename}`;
      expect(tour).toContain(`](${relativePath})`);
      expect(tour).toContain(`<source src="${relativePath}" type="video/mp4">`);
      // GitHub removes the <video> tag; the Markdown link must not be nested inside it.
      expect(tour!.indexOf(`](${relativePath})`)).toBeLessThan(tour!.indexOf(`<source src="${relativePath}"`));
    }
  });
});
