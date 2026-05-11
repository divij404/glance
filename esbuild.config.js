// esbuild.config.js — builds the extension host only.
// The webview HTML is generated as a string in panelHtml.ts — no separate bundle needed.
const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const baseOpts = {
  bundle: true,
  sourcemap: true,
  minify: false, // keep readable during dev; flip to true before vsce publish
  logLevel: 'info',
};

const extensionOpts = {
  ...baseOpts,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  // vscode is provided by VS Code at runtime.
  // esbuild is a native Node addon — must NOT be bundled.
  external: ['vscode', 'esbuild'],
};

async function build() {
  if (watch) {
    const ctx = await esbuild.context(extensionOpts);
    await ctx.watch();
    console.log('Watching for changes…');
  } else {
    await esbuild.build(extensionOpts);
    console.log('Build complete.');
  }
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
