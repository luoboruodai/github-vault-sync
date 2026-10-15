import { describe, expect, it } from 'vitest';
import { buildConversionCommand, mediaKindLabel, scanMediaForOptimization } from '../src/media-scan';
import { VaultFile } from '../src/types';

function file(relPath: string, size: number, excluded = false): VaultFile {
  return { path: relPath, absolutePath: `/vault/${relPath}`, size, isText: false, isLfs: true, excluded, sensitive: false };
}

const settings = {
  mediaSizeThresholdMB: 2,
  mediaExcludePatterns: [] as string[],
  mediaQualityFloorPsnr: 35,
  mediaShowSavings: true
};
const MB = 1024 * 1024;
const pngRule = { kind: 'image', projectedRatio: 0.073, quality: 70, targetExtension: '.avif' } as const;

describe('media optimization pre-check', () => {
  it('lists PNG/JPG/PDF/MP4/GIF over the threshold, largest first, with measured-ratio estimates', () => {
    const report = scanMediaForOptimization([
      file('图片存储/a.png', 10 * MB),
      file('图片存储/b.PNG', 4 * MB),
      file('notes/small.png', 100 * 1024),
      file('docs/book.pdf', 100 * MB),
      file('clips/demo.mp4', 20 * MB),
      file('clips/anim.gif', 3 * MB),
      file('photo.jpg', 8 * MB),
      file('notes/文字.md', 5 * MB)
    ], settings, 'darwin');

    expect(report.findings.map((finding) => finding.path)).toEqual([
      'docs/book.pdf', 'clips/demo.mp4', '图片存储/a.png', 'photo.jpg', '图片存储/b.PNG', 'clips/anim.gif'
    ]);
    expect(report.thresholdBytes).toBe(2 * MB);
    const byPath = new Map(report.findings.map((finding) => [finding.path, finding]));
    expect(byPath.get('图片存储/a.png')?.estimatedBytes).toBe(Math.round(10 * MB * 0.073));
    expect(byPath.get('photo.jpg')?.estimatedBytes).toBe(Math.round(8 * MB * 0.325));
    expect(byPath.get('docs/book.pdf')?.estimatedBytes).toBe(Math.round(100 * MB * 0.522));
    expect(byPath.get('clips/demo.mp4')?.estimatedBytes).toBe(Math.round(20 * MB * 0.17));
    expect(byPath.get('clips/anim.gif')?.estimatedBytes).toBe(Math.round(3 * MB * 0.63));
    expect(report.totalBytes).toBe(report.findings.reduce((sum, finding) => sum + finding.size, 0));
    expect(report.estimatedBytes).toBe(report.findings.reduce((sum, finding) => sum + finding.estimatedBytes, 0));
    expect(report.showSavings).toBe(true);
  });

  it('skips already-excluded files and user media exclusion patterns', () => {
    const report = scanMediaForOptimization([
      file('private/secret.png', 10 * MB, true),
      file('图片存储/keep.png', 10 * MB),
      file('其他/keep.jpg', 10 * MB)
    ], { ...settings, mediaExcludePatterns: ['图片存储/**'] }, 'darwin');
    expect(report.findings.map((finding) => finding.path)).toEqual(['其他/keep.jpg']);
  });

  it('produces distinct non-destructive targets when converted names collide', () => {
    const report = scanMediaForOptimization([
      file('a.png', 3 * MB), file('a.jpg', 4 * MB), file('a.avif', 5 * MB)
    ], settings, 'darwin');
    const targets = report.findings.map((finding) => finding.targetPath);
    expect(targets).toHaveLength(2);
    expect(new Set(targets).size).toBe(2);
    expect(targets).not.toContain('a.avif');
    for (const target of targets) expect(target).toMatch(/^a-[a-f0-9]{8}(?:-\d+)?\.avif$/);
  });

  it('produces non-destructive target names per conversion kind', () => {
    const report = scanMediaForOptimization([
      file('a/b.png', 3 * MB), file('a/c.pdf', 3 * MB), file('a/d.mp4', 3 * MB), file('a/e.gif', 3 * MB)
    ], settings, 'darwin');
    const targets = report.findings.map((finding) => finding.targetPath);
    expect(targets).toContain('a/b.avif');
    expect(targets).toContain('a/c-ebook.pdf');
    expect(targets).toContain('a/d.av1.mp4');
    expect(targets).toContain('a/e.webp');
  });

  it('builds plan-compliant conversion commands per platform', () => {
    const imageCommand = buildConversionCommand('图 片/x.png', pngRule, 'darwin');
    expect(imageCommand).toContain("python3 - '图 片/x.png' '图 片/x.avif' '70' '35' <<'GVS_AVIF'");
    expect(imageCommand).toContain('(start, 70, 80, 90, 100)');
    expect(imageCommand).toContain('ImageStat.Stat(difference).rms');
    expect(imageCommand).toContain('subsampling="4:4:4"');
    expect(imageCommand).toContain('raise FileExistsError');
    expect(buildConversionCommand('x.png', pngRule, 'win32')).toContain("python - 'x.png'");

    const pdf = { kind: 'pdf', projectedRatio: 0.522, quality: 0, targetExtension: '.pdf' } as const;
    const pdfCommand = buildConversionCommand('book.pdf', pdf, 'darwin');
    expect(pdfCommand).toContain("if test -e 'book-ebook.pdf'");
    expect(pdfCommand).toContain('gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook');
    expect(pdfCommand).toContain("-sOutputFile='book-ebook.pdf' 'book.pdf'");
    expect(buildConversionCommand('book.pdf', pdf, 'win32')).toContain('MSYS_NO_PATHCONV=1 gswin64c ');

    const video = { kind: 'video', projectedRatio: 0.17, quality: 35, targetExtension: '.mp4' } as const;
    expect(buildConversionCommand('demo.mp4', video, 'darwin'))
      .toContain("ffmpeg -n -i 'demo.mp4' -c:v libsvtav1 -crf 35 -preset 6 -c:a aac -b:a 96k 'demo.av1.mp4'");

    const gif = { kind: 'animated-image', projectedRatio: 0.63, quality: 80, targetExtension: '.webp' } as const;
    expect(buildConversionCommand('a.gif', gif, 'darwin'))
      .toContain("ffmpeg -n -i 'a.gif' -c:v libwebp -loop 0 -q:v 80 'a.webp'");
  });

  it('shell-quotes unusual file names instead of embedding them in Python code', () => {
    const command = buildConversionCommand("图'片.png", pngRule, 'darwin');
    expect(command).toContain("'图'\"'\"'片.png'");
    expect(command).toContain("'图'\"'\"'片.avif'");
  });

  it('uses q60 and the configured PSNR floor for JPG sources', () => {
    const report = scanMediaForOptimization([file('p.jpeg', 5 * MB)], { ...settings, mediaQualityFloorPsnr: 41.5 }, 'darwin');
    expect(report.findings[0].command).toContain("'p.avif' '60' '41.5'");
    expect(report.findings[0].kind).toBe('image');
    expect(mediaKindLabel('image')).toBe('图像 → AVIF');
    expect(mediaKindLabel('animated-image')).toBe('动图 → WebP');
  });

  it('treats the threshold as strictly greater-than and reports an empty list when appropriate', () => {
    const report = scanMediaForOptimization([
      file('boundary.png', 2 * MB), file('above.png', 2 * MB + 1), file('tiny.png', 1024)
    ], settings, 'darwin');
    expect(report.findings.map((finding) => finding.path)).toEqual(['above.png']);
    expect(report.totalBytes).toBe(2 * MB + 1);
    expect(scanMediaForOptimization([file('tiny.png', 1024)], settings, 'darwin').estimatedBytes).toBe(0);
  });
});
