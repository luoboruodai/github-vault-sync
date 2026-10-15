import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  GithubVaultSyncSettings,
  MediaFinding,
  MediaOptimizationKind,
  MediaOptimizationReport,
  VaultFile
} from './types';
import { matchesAnyPattern, normalizeRelPath } from './utils';

export interface MediaRule {
  kind: MediaOptimizationKind;
  projectedRatio: number;
  quality: number;
  targetExtension: string;
}

const MEDIA_RULES: Record<string, MediaRule> = {
  '.png': { kind: 'image', projectedRatio: 0.073, quality: 70, targetExtension: '.avif' },
  '.jpg': { kind: 'image', projectedRatio: 0.325, quality: 60, targetExtension: '.avif' },
  '.jpeg': { kind: 'image', projectedRatio: 0.325, quality: 60, targetExtension: '.avif' },
  '.pdf': { kind: 'pdf', projectedRatio: 0.522, quality: 0, targetExtension: '.pdf' },
  '.mp4': { kind: 'video', projectedRatio: 0.17, quality: 35, targetExtension: '.mp4' },
  '.gif': { kind: 'animated-image', projectedRatio: 0.63, quality: 80, targetExtension: '.webp' }
};

const AVIF_QUALITY_GUARD_SCRIPT = `import math
import os
import sys
import tempfile
from PIL import Image, ImageChops, ImageStat
import pillow_avif

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

source, destination, start, floor = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4])
if os.path.exists(destination):
    raise FileExistsError(f"目标已存在，未覆盖：{destination}")
with Image.open(source) as opened:
    opened.load()
    if getattr(opened, "n_frames", 1) != 1:
        raise ValueError("多帧图像不能按静态 AVIF 流程转换；请保留原图或单独处理")
    has_alpha = "A" in opened.getbands() or "transparency" in opened.info
    image = opened.convert("RGBA" if has_alpha else "RGB")

output_dir = os.path.dirname(os.path.abspath(destination))
fd, candidate = tempfile.mkstemp(prefix=".gvs-", suffix=".avif", dir=output_dir)
os.close(fd)
try:
    qualities = list(dict.fromkeys(q for q in (start, 70, 80, 90, 100) if q >= start))
    for quality in qualities:
        image.save(candidate, format="AVIF", quality=quality, subsampling="4:4:4")
        with Image.open(candidate) as converted:
            restored = converted.convert(image.mode)
            difference = ImageChops.difference(image, restored)
            rms = ImageStat.Stat(difference).rms
        mse = sum(value * value for value in rms) / len(rms)
        psnr = math.inf if mse == 0 else 10 * math.log10(255 ** 2 / mse)
        if psnr >= floor:
            os.replace(candidate, destination)
            print(f"已生成 {destination}：q{quality}，PSNR {psnr:.2f} dB")
            break
    else:
        raise RuntimeError(f"即使 q100 也未达到 PSNR {floor:g} dB；未生成目标文件，请保留原图")
finally:
    if os.path.exists(candidate):
        os.unlink(candidate)`;

export function mediaKindLabel(kind: MediaOptimizationKind): string {
  const labels: Record<MediaOptimizationKind, string> = {
    image: '图像 → AVIF',
    pdf: 'PDF → 150dpi 重打包',
    video: '视频 → AV1',
    'animated-image': '动图 → WebP'
  };
  return labels[kind];
}

function quoteShell(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function targetPathFor(relPath: string, rule: MediaRule): string {
  const normalized = normalizeRelPath(relPath);
  const extension = path.posix.extname(normalized);
  const stem = normalized.slice(0, normalized.length - extension.length);
  if (rule.kind === 'pdf') return `${stem}-ebook${rule.targetExtension}`;
  if (rule.kind === 'video') return `${stem}.av1${rule.targetExtension}`;
  return `${stem}${rule.targetExtension}`;
}

function targetKey(targetPath: string): string {
  return normalizeRelPath(targetPath).toLocaleLowerCase('en-US');
}

function collisionSafeTarget(relPath: string, rule: MediaRule, occupied: Set<string>): string {
  const initial = targetPathFor(relPath, rule);
  const extension = path.posix.extname(initial);
  const stem = initial.slice(0, initial.length - extension.length);
  const hash = createHash('sha256').update(normalizeRelPath(relPath)).digest('hex').slice(0, 8);
  let target = initial;
  let suffix = 1;
  while (occupied.has(targetKey(target))) {
    target = `${stem}-${hash}${suffix > 1 ? `-${suffix}` : ''}${extension}`;
    suffix += 1;
  }
  occupied.add(targetKey(target));
  return target;
}

function noClobberPrefix(targetPath: string): string {
  const output = quoteShell(targetPath);
  const message = quoteShell(`目标已存在，未覆盖：${targetPath}`);
  return `if test -e ${output}; then echo ${message} >&2; exit 1; fi; `;
}

export function buildConversionCommand(
  relPath: string,
  rule: MediaRule,
  platform: NodeJS.Platform,
  qualityFloorPsnr = 35,
  requestedTargetPath = targetPathFor(relPath, rule)
): string {
  const sourcePath = normalizeRelPath(relPath);
  const targetPath = normalizeRelPath(requestedTargetPath);
  const input = quoteShell(sourcePath);
  const output = quoteShell(targetPath);
  if (rule.kind === 'image') {
    const python = platform === 'win32' ? 'python' : 'python3';
    const floor = Number.isFinite(qualityFloorPsnr) && qualityFloorPsnr > 0 && qualityFloorPsnr <= 60
      ? qualityFloorPsnr : 35;
    const args = [sourcePath, targetPath, String(rule.quality), String(floor)].map(quoteShell).join(' ');
    return `${python} - ${args} <<'GVS_AVIF'\n${AVIF_QUALITY_GUARD_SCRIPT}\nGVS_AVIF`;
  }
  if (rule.kind === 'pdf') {
    const gs = platform === 'win32' ? 'MSYS_NO_PATHCONV=1 gswin64c' : 'gs';
    return `${noClobberPrefix(targetPath)}${gs} -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=${output} ${input}`;
  }
  if (rule.kind === 'video') {
    return `${noClobberPrefix(targetPath)}ffmpeg -n -i ${input} -c:v libsvtav1 -crf ${rule.quality} -preset 6 -c:a aac -b:a 96k ${output}`;
  }
  return `${noClobberPrefix(targetPath)}ffmpeg -n -i ${input} -c:v libwebp -loop 0 -q:v ${rule.quality} ${output}`;
}

export function buildAllConversionCommands(report: MediaOptimizationReport): string {
  return report.findings.map((finding) => `# ${finding.path}\n${finding.command}`).join('\n\n');
}

export function formatMediaCount(displayed: number, total: number): string {
  return `已显示 ${displayed} / 共 ${total} 个`;
}

export interface ConversionCopyButton {
  setText(text: string): void;
  setAttribute(name: string, value: string): void;
}

export function markAllConversionCommandsCopied(buttons: ConversionCopyButton[]): void {
  for (const button of buttons) {
    button.setText('已复制');
    button.setAttribute('aria-pressed', 'true');
  }
}

export function scanMediaForOptimization(
  files: VaultFile[],
  settings: Pick<GithubVaultSyncSettings, 'mediaSizeThresholdMB' | 'mediaExcludePatterns' | 'mediaQualityFloorPsnr' | 'mediaShowSavings'>,
  platform: NodeJS.Platform = process.platform
): MediaOptimizationReport {
  const thresholdMB = Number.isFinite(settings.mediaSizeThresholdMB) && settings.mediaSizeThresholdMB > 0
    ? settings.mediaSizeThresholdMB : 2;
  const thresholdBytes = Math.round(thresholdMB * 1024 * 1024);
  const qualityFloorPsnr = Number.isFinite(settings.mediaQualityFloorPsnr) && settings.mediaQualityFloorPsnr > 0
    ? settings.mediaQualityFloorPsnr : 35;
  const occupied = new Set(files.map((file) => targetKey(file.path)));
  const candidates = files
    .filter((file) => !file.excluded && file.size > thresholdBytes)
    .map((file) => ({ file, rule: MEDIA_RULES[path.posix.extname(normalizeRelPath(file.path)).toLowerCase()] }))
    .filter((candidate): candidate is { file: VaultFile; rule: MediaRule } => Boolean(candidate.rule))
    .filter(({ file }) => !settings.mediaExcludePatterns.length
      || !matchesAnyPattern(file.path, settings.mediaExcludePatterns))
    .sort((a, b) => a.file.path.localeCompare(b.file.path));
  const findings = candidates.map(({ file, rule }) => {
    const targetPath = collisionSafeTarget(file.path, rule, occupied);
    return {
      path: file.path,
      size: file.size,
      kind: rule.kind,
      targetPath,
      estimatedBytes: Math.round(file.size * rule.projectedRatio),
      command: buildConversionCommand(file.path, rule, platform, qualityFloorPsnr, targetPath)
    };
  });
  findings.sort((a, b) => b.size - a.size || a.path.localeCompare(b.path));
  const totalBytes = findings.reduce((sum, finding) => sum + finding.size, 0);
  const estimatedBytes = findings.reduce((sum, finding) => sum + finding.estimatedBytes, 0);
  return { findings, totalBytes, estimatedBytes, thresholdBytes, showSavings: settings.mediaShowSavings };
}
