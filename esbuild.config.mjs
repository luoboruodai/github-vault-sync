import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const isProduction = process.argv[2] === 'production';
const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', 'child_process', 'fs', 'fs/promises', 'path', 'os', 'crypto', 'stream', 'util', 'url'],
  format: 'cjs',
  platform: 'node',
  target: 'es2018',
  sourcemap: isProduction ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  banner: { js: '/* GitHub Vault Sync */' },
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
  },
  logLevel: 'info'
});

if (isProduction) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
  console.log(`Watching ${manifest.name}...`);
}
