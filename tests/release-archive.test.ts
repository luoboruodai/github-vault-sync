import { execFileSync, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const python = process.platform === 'win32' ? 'python' : 'python3';
const prefix = 'github-vault-sync/';

async function fixture(run: (root: string, archive: string) => Promise<void>): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gvs-release-'));
  try {
    await fs.mkdir(path.join(root, 'scripts'));
    await fs.mkdir(path.join(root, 'docs', 'install'), { recursive: true });
    await fs.copyFile(path.resolve(__dirname, '..', 'scripts', 'release_archive.py'), path.join(root, 'scripts', 'release_archive.py'));
    await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({ id: 'github-vault-sync', version: '0.1.3', minAppVersion: '1.13.0', isDesktopOnly: true }));
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '0.1.3' }));
    await fs.writeFile(path.join(root, 'versions.json'), JSON.stringify({ '0.1.3': '1.13.0' }));
    await fs.writeFile(path.join(root, 'main.js'), '/* test-only compiled fixture */\n');
    await fs.writeFile(path.join(root, 'styles.css'), '/* test-only styles */\n');
    await fs.writeFile(path.join(root, 'README.md'), '[repository-only](docs/missing.md)\n');
    await fs.writeFile(path.join(root, 'data.json'), '{"notForDistribution":true}');
    await fs.writeFile(path.join(root, 'docs', 'install', 'README.md'), '# Plugin v0.1.3\n[Chinese](README.zh-CN.md)\n[Online](https://example.invalid/guide)\n');
    await fs.writeFile(path.join(root, 'docs', 'install', 'README.zh-CN.md'), '# Plugin v0.1.3\n[English](README.md)\n');
    await run(root, path.join(root, 'releases', 'github-vault-sync-0.1.3.zip'));
  } finally {
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

function command(root: string, mode: 'build' | 'verify'): void {
  execFileSync(python, [path.join(root, 'scripts', 'release_archive.py'), mode], { cwd: root, encoding: 'utf8', timeout: 20000 });
}

function rejection(root: string, mode: 'build' | 'verify', reason: string): void {
  const result = spawnSync(python, [path.join(root, 'scripts', 'release_archive.py'), mode], { cwd: root, encoding: 'utf8', timeout: 20000 });
  expect(result.error).toBeUndefined();
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(reason);
}

describe('portable release archive', () => {
  it('ships only runtime files and independent bilingual guides, not the repository README or local settings', async () => {
    await fixture(async (root, archive) => {
      command(root, 'build');
      command(root, 'verify');
      const actual = JSON.parse(execFileSync(python, ['-c', 'import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({"names":z.namelist(),"guide":z.read("github-vault-sync/README.md").decode()}))', archive], { encoding: 'utf8' }));
      expect(actual.names).toEqual([prefix, ...['manifest.json', 'main.js', 'styles.css', 'README.md', 'README.zh-CN.md'].map(name => prefix + name)]);
      expect(actual.guide).toBe(await fs.readFile(path.join(root, 'docs', 'install', 'README.md'), 'utf8'));
      expect(actual.guide).not.toContain('repository-only');
    });
  });

  it('produces identical archive bytes when rebuilt from unchanged inputs', async () => {
    await fixture(async (root, archive) => {
      command(root, 'build');
      const first = await fs.readFile(archive);
      command(root, 'build');
      expect(await fs.readFile(archive)).toEqual(first);
    });
  });

  it('rejects a package version inconsistent with the manifest before building', async () => {
    await fixture(async (root) => {
      await fs.writeFile(path.join(root, 'package.json'), '{"version":"9.9.9"}');
      rejection(root, 'build', 'versions or plugin IDs do not match');
    });
  });

  it('rejects a stale archive after a build input changes', async () => {
    await fixture(async (root) => {
      command(root, 'build');
      await fs.appendFile(path.join(root, 'main.js'), '// modified input\n');
      rejection(root, 'verify', 'Release ZIP member differs from reviewed source: main.js');
    });
  });

  it('rejects an unallowlisted member appended to the ZIP', async () => {
    await fixture(async (root, archive) => {
      command(root, 'build');
      execFileSync(python, ['-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],"a"); z.writestr("github-vault-sync/data.json","{}"); z.close()', archive]);
      rejection(root, 'verify', 'Unexpected release ZIP members');
    });
  });

  it('rejects an unpackaged relative link without overwriting the prior valid archive', async () => {
    await fixture(async (root, archive) => {
      command(root, 'build');
      const first = await fs.readFile(archive);
      await fs.appendFile(path.join(root, 'docs', 'install', 'README.md'), '[Video](docs/media/demo.mp4)\n');
      rejection(root, 'build', 'Installation guide link is not packaged');
      expect(await fs.readFile(archive)).toEqual(first);
      expect(await fs.readdir(path.dirname(archive))).toEqual([path.basename(archive)]);
    });
  });

  it('rejects stale guide versions and embedded video absent from the package', async () => {
    await fixture(async (root) => {
      const guide = path.join(root, 'docs', 'install', 'README.md');
      await fs.writeFile(guide, '# Plugin v0.1.2\n');
      rejection(root, 'build', 'Installation guide version mismatch');
      await fs.writeFile(guide, '# Plugin v0.1.3\n<video src="demo.mp4"></video>\n');
      rejection(root, 'build', 'Installation guide embeds unpackaged media');
    });
  });
});
