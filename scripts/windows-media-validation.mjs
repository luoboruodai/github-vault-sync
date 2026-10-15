import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanMediaForOptimization } from '../src/media-scan.ts';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gvs-windows-media-'));
const media = path.join(root, 'media');
fs.mkdirSync(media, { recursive: true });

const python = (script, options = {}) => execFileSync('python', ['-c', script], {
  cwd: options.cwd ?? media,
  encoding: 'utf8',
  stdio: options.stdio ?? 'inherit'
});
const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: options.cwd ?? media,
  encoding: 'utf8',
  stdio: options.stdio ?? 'inherit'
});
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

// Deterministic generated samples only; no Vault or user content is read.
const noise = (size) => `import os
from PIL import Image
from pathlib import Path
root = Path(os.environ.get('GVS_MEDIA_DIR')
root.mkdir(parents=True, exist_ok=True)
def save(name, width, height, fmt, **kwargs):
    image = Image.frombytes('RGB', (width, height), os.urandom(width * height * 3))
    image.save(root / name, format=fmt, **kwargs)
for index in range(2):
    save(f'image-{index}.png', 320, 240, 'PNG', optimize=False)
save('photo.jpg', 640, 480, 'JPEG', quality=95)
pages = [Image.frombytes('RGB', (640, 480), os.urandom(640 * 480 * 3) for _ in range(3))]
pages[0].save(root / 'book.pdf', 'PDF', resolution=150.0, save_all=True, append_images=pages[1:])
`;
python(`import os\nos.environ['GVS_MEDIA_DIR'] = r'${media.replace(/\\/g, '/')}'\n${noise}`);
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=2', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-y', 'demo.mp4']);
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=15:duration=2', '-c:v', 'gif', '-y', 'animation.gif']);

const files = fs.readdirSync(media).map((name) => {
  const absolutePath = path.join(media, name);
  return {
    path: `media/${name}`,
    absolutePath,
    size: fs.statSync(absolutePath).size,
    isText: false,
    isLfs: true,
    excluded: false,
    sensitive: false
  };
});
const settings = {
  mediaSizeThresholdMB: 0.1,
  mediaExcludePatterns: [],
  mediaQualityFloorPsnr: 35,
  mediaShowSavings: true
};
const report = scanMediaForOptimization(files, settings, 'win32');
expect(report.findings.length === 5, `expected 5 media findings, got ${report.findings.length}`);

const sourceHashes = new Map(files.map((file) => [file.path, hash(file.path)]));
const targetHashes = new Map();
for (const [index, finding] of report.findings.entries()) {
  const commandFile = path.join(root, `command-${index + 1}.sh`);
  fs.writeFileSync(commandFile, finding.command);
  execFileSync('bash', ['-n', commandFile], { stdio: 'inherit' });
  execFileSync('bash', [commandFile], { cwd: root, stdio: 'inherit' });
  const target = path.join(root, finding.targetPath);
  expect(fs.existsSync(target), `missing output ${finding.targetPath}`);
  targetHashes.set(finding.targetPath, hash(target));
  const second = spawnSync('bash', [commandFile], { cwd: root, encoding: 'utf8' });
  expect(second.status === 1, `second run should refuse to overwrite ${finding.targetPath}`);
  expect(second.stderr.includes('目标已存在，未覆盖'), `missing overwrite refusal for ${finding.targetPath}`);
  expect(hash(target) === targetHashes.get(finding.targetPath), `target changed after refusal: ${finding.targetPath}`);
}
for (const file of files) {
  expect(hash(file.path) === sourceHashes.get(file.path), `source changed: ${file.path}`);
}

const photo = path.join(media, 'photo.avif');
const photoInfo = python(`from PIL import Image
image = Image.open(r'${photo.replace(/\\/g, '/')}')
print(image.format, image.size, image.mode)
`, { stdio: 'pipe' });
expect(photoInfo.includes('AVIF'), photoInfo);

const psnrText = python(`from PIL import Image, ImageChops, ImageStat
import math
source = Image.open(r'${path.join(media, 'photo.jpg').replace(/\\/g, '/')}')
converted = Image.open(r'${photo.replace(/\\/g, '/')}')
source.load()
converted.load()
difference = ImageChops.difference(source, converted)
rms = ImageStat.Stat(difference).rms
mse = sum(value * value for value in rms) / len(rms)
print('inf' if mse == 0 else 10 * math.log10(255 ** 2 / mse)
`, { stdio: 'pipe' });
const psnr = Number.parseFloat(psnrText.trim());
expect(psnr >= 35, `PSNR below 35 dB: ${psnr}`);

const pdfInfo = python(`from pypdf import PdfReader
reader = PdfReader(r'${path.join(media, 'book-ebook.pdf').replace(/\\/g, '/')}')
print(len(reader.pages)
`, { stdio: 'pipe' });
expect(pdfInfo.trim() === '3', `PDF page count mismatch: ${pdfInfo}`);

const webpInfo = python(`from PIL import Image
image = Image.open(r'${path.join(media, 'animation.webp').replace(/\\/g, '/')}')
print(image.format, image.size, image.mode, image.n_frames)
`, { stdio: 'pipe' });
expect(webpInfo.includes('WEBP'), webpInfo);
expect(!webpInfo.includes(' 1\n'), `GIF was not animated: ${webpInfo}`);

const av1Probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height', '-show_entries', 'format=duration', '-of', 'json', 'demo.av1.mp4'], { stdio: 'pipe' }));
expect(av1Probe.streams[0].codec_name === 'av1', `unexpected AV1 codec: ${JSON.stringify(av1Probe)}`);
expect(Number(av1Probe.format.duration) === 2, `unexpected AV1 duration: ${av1Probe.format.duration}`);

console.log(JSON.stringify({
  status: 'passed',
  findings: report.findings.length,
  totalBytes: report.totalBytes,
  estimatedBytes: report.estimatedBytes,
  avif: photoInfo.trim(),
  psnr,
  pdfPages: Number(pdfInfo.trim()),
  animatedWebP: webpInfo.trim(),
  av1: av1Probe.streams[0],
  overwriteRefusal: true,
  sourceHashesUnchanged: true,
  targetHashesUnchanged: true
}, null, 2));
