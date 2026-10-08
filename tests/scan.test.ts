import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, GithubVaultSyncSettings } from '../src/types';
import { scanVault } from '../src/utils';

const temporaryDirectories: string[] = [];

function settings(overrides: Partial<GithubVaultSyncSettings> = {}): GithubVaultSyncSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
    excludePatterns: [...DEFAULT_SETTINGS.excludePatterns],
    lfsPatterns: [...DEFAULT_SETTINGS.lfsPatterns]
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('vault scanning policy', () => {
  it('excludes .obsidian when includeObsidian is disabled', async () => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-scan-'));
    temporaryDirectories.push(vault);
    await fs.mkdir(path.join(vault, '.obsidian'), { recursive: true });
    await fs.writeFile(path.join(vault, '.obsidian', 'app.json'), '{}\n', 'utf8');
    await fs.writeFile(path.join(vault, '笔记.md'), '# hello\n', 'utf8');

    const excluded = await scanVault(vault, settings({ includeObsidian: false }));
    expect(excluded.included.map((file) => file.path)).toEqual(['笔记.md']);
    expect(excluded.excluded.find((file) => file.path === '.obsidian/app.json')?.exclusionReason).toBe('.obsidian/**');

    const included = await scanVault(vault, settings({ includeObsidian: true }));
    expect(included.included.map((file) => file.path)).toContain('.obsidian/app.json');
  });
});

it('includes vetted plugin bundles and themes while always excluding plugin data.json', async () => {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-plugin-'));
  temporaryDirectories.push(vault);
  const pluginDir = path.join(vault, '.obsidian', 'plugins', 'demo-plugin');
  const themeDir = path.join(vault, '.obsidian', 'themes', 'Demo');
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.mkdir(themeDir, { recursive: true });
  await fs.writeFile(path.join(pluginDir, 'main.js'), 'const password = "placeholder";\n\0' + ' '.repeat(8 * 1024 * 1024));
  await fs.writeFile(path.join(pluginDir, 'styles.css'), '.password { color: red; }\n');
  await fs.writeFile(path.join(pluginDir, 'data.json'), '{"customAuthValue":"not-a-recognized-token"}\n');
  await fs.writeFile(path.join(themeDir, 'theme.css'), '.password { color: black; }\n');
  const scan = await scanVault(vault, settings({ includeObsidian: true }));
  expect(scan.errors).toEqual([]);
  expect(scan.included.map((file) => file.path)).toEqual(expect.arrayContaining([
    '.obsidian/plugins/demo-plugin/main.js',
    '.obsidian/plugins/demo-plugin/styles.css',
    '.obsidian/themes/Demo/theme.css'
  ]));
  expect(scan.excluded.map((file) => file.path)).toContain('.obsidian/plugins/demo-plugin/data.json');
});

it('blocks actual hardcoded tokens in plugin bundles', async () => {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-plugin-token-'));
  temporaryDirectories.push(vault);
  const pluginDir = path.join(vault, '.obsidian', 'plugins', 'bad-plugin');
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.writeFile(path.join(pluginDir, 'main.js'), `const accessToken = "ghp_${'A'.repeat(30)}";\n`);
  const scan = await scanVault(vault, settings({ includeObsidian: true }));
  expect(scan.sensitive.map((file) => file.path)).toContain('.obsidian/plugins/bad-plugin/main.js');
  expect(scan.included.map((file) => file.path)).not.toContain('.obsidian/plugins/bad-plugin/main.js');
});


it('does not mistake CSS class names for secret tokens', async () => {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-css-'));
  temporaryDirectories.push(vault);
  const pluginDir = path.join(vault, '.obsidian', 'plugins', 'tasks');
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.writeFile(path.join(pluginDir, 'styles.css'), '.tasks-modal-priority-section .task-list { color: blue; }');
  const scan = await scanVault(vault, settings({ includeObsidian: true }));
  expect(scan.sensitive).toEqual([]);
  expect(scan.included.map((file) => file.path)).toContain('.obsidian/plugins/tasks/styles.css');
});

it('rejects an embedded Git repository unless its whole folder is excluded', async () => {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'github-vault-sync-embedded-'));
  temporaryDirectories.push(vault);
  const plugin = path.join(vault, '.obsidian', 'plugins', 'embedded');
  await fs.mkdir(path.join(plugin, '.git'), { recursive: true });
  await fs.writeFile(path.join(plugin, 'main.js'), 'module.exports = {};\n');
  await fs.writeFile(path.join(plugin, '.npmrc'), '//registry.example.invalid/:_authToken=secret\n');
  const settingsWithPlugin = settings({ includeObsidian: true });
  const scan = await scanVault(vault, settingsWithPlugin);
  expect(scan.errors[0]).toContain('Nested Git repository');
  expect(scan.excluded.map((file) => file.path)).toContain('.obsidian/plugins/embedded/.npmrc');
  const excluded = await scanVault(vault, { ...settingsWithPlugin,
    excludePatterns: [...settingsWithPlugin.excludePatterns, '.obsidian/plugins/embedded/**'] });
  expect(excluded.errors).toEqual([]);
});
