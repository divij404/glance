// esbuild.config.js — builds both the extension host and the WebView bundle
const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const baseOpts = {
  bundle: true,
  sourcemap: true,
  minify: false, // keep readable during dev; flip to true before vsce publish
  logLevel: 'info',
};

// ── Extension host bundle ──────────────────────────────────────────────────
// CommonJS, external vscode (provided by VS Code at runtime)
const extensionOpts = {
  ...baseOpts,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  external: ['vscode'],
  // esbuild-wasm ships its own .wasm binary; mark it external so it's
  // copied as-is rather than bundled into the JS.
  loader: { '.wasm': 'copy' },
};

// ── WebView bundle ─────────────────────────────────────────────────────────
// IIFE/ESM for browser context.  React/ReactDOM are bundled in because the
// WebView has no module resolution of its own.
const webviewOpts = {
  ...baseOpts,
  entryPoints: ['webview/index.tsx'],
  outfile: 'dist/webview.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  jsxImportSource: 'react',
};

async function build() {
  if (watch) {
    const [extCtx, wvCtx] = await Promise.all([
      esbuild.context(extensionOpts),
      esbuild.context(webviewOpts),
    ]);
    await Promise.all([extCtx.watch(), wvCtx.watch()]);
    console.log('Watching for changes…');
  } else {
    await Promise.all([
      esbuild.build(extensionOpts),
      esbuild.build(webviewOpts),
    ]);
    console.log('Build complete.');
  }
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
