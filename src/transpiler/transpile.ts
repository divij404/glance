import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { esmShimPlugin } from './esmShim';
import { makeImportResolverPlugin } from './importResolver';

// Root of the extension package — this is where node_modules/react lives.
// __dirname is dist/ at runtime, so one level up is the extension root.
const EXTENSION_ROOT = path.join(__dirname, '..');

// Temp dir for writing bundle files that the webview loads as local resources.
const GLANCE_TMP_DIR = path.join(os.tmpdir(), 'glance-preview');

export type TranspileResult =
  | { kind: 'ok'; bundleUri: vscode.Uri; bundlePath: string; dependencies: vscode.Uri[] }
  | { kind: 'error'; message: string; file: string; line: number; col: number };

// ── esbuild (native Node build) ───────────────────────────────────────────
// We use the native esbuild package in the extension host (Node.js).
// esbuild-wasm is only needed for browser contexts — not applicable here.
async function getEsbuild() {
  return await import('esbuild');
}

// ── Main export ───────────────────────────────────────────────────────────

export async function transpile(fileUri: vscode.Uri): Promise<TranspileResult> {
  try {
    const esbuild = await getEsbuild();

    // Read the entry file
    const sourceBytes = await vscode.workspace.fs.readFile(fileUri);
    const sourceText = Buffer.from(sourceBytes).toString('utf8');
    const fileDir = path.dirname(fileUri.fsPath);
    const fileName = path.basename(fileUri.fsPath);

    // Collect dependency URIs so the watcher can track them
    const collectedDeps: vscode.Uri[] = [];

    // Append re-exports of React internals so the mount harness (outside IIFE)
    // can access them via window.__glance_module__.__react and .__createRoot
    const wrappedSource =
      sourceText +
      `\nexport { default as __react } from 'react';\nexport { createRoot as __createRoot } from 'react-dom/client';\n`;

    const result = await esbuild.build({
      stdin: {
        contents: wrappedSource,
        loader: fileName.endsWith('.tsx') || fileName.endsWith('.ts') ? 'tsx' : 'jsx',
        // resolveDir points to the extension root so esbuild finds react/react-dom
        // in the extension's node_modules. Relative imports from the user's file
        // are handled by makeImportResolverPlugin which uses fileDir directly.
        resolveDir: EXTENSION_ROOT,
        sourcefile: fileName,
      },
      bundle: true,
      format: 'iife',
      globalName: '__glance_module__',
      platform: 'browser',
      target: 'es2020',
      jsx: 'automatic',
      write: false,
      plugins: [
        makeImportResolverPlugin(fileDir, collectedDeps),
        esmShimPlugin,
      ],
      external: [],
      logLevel: 'silent',
    });

    if (result.errors.length > 0) {
      const err = result.errors[0];
      return {
        kind: 'error',
        message: err.text,
        file: err.location?.file ?? fileName,
        line: err.location?.line ?? 0,
        col: err.location?.column ?? 0,
      };
    }

    const userCode = result.outputFiles[0].text;

    // Append the mount harness directly into the bundle file.
    // This way the webview HTML only needs a single <script src> with no
    // inline scripts — avoiding document.write() injection issues entirely.
    const mountHarness = `
;(function() {
  try {
    var mod = window.__glance_module__;
    var Component = mod && mod.default;
    if (!Component || typeof Component !== "function") {
      throw new Error("No default export found. Make sure your component uses export default.");
    }
    var React = mod.__react;
    var createRoot = mod.__createRoot;
    var rootEl = document.getElementById("root");
    if (!rootEl) { throw new Error("No #root element found"); }
    createRoot(rootEl).render(React.createElement(Component, null));
  } catch (err) {
    document.body.innerHTML =
      "<div style=\\"padding:16px;color:#e06c75;font-family:monospace;white-space:pre-wrap\\">"
      + err.message + "\\n" + (err.stack || "") + "</div>";
  }
})();
`;

    if (!fs.existsSync(GLANCE_TMP_DIR)) {
      fs.mkdirSync(GLANCE_TMP_DIR, { recursive: true });
    }
    const bundlePath = path.join(GLANCE_TMP_DIR, 'bundle.js');
    fs.writeFileSync(bundlePath, userCode + mountHarness, 'utf8');
    const bundleUri = vscode.Uri.file(bundlePath);

    return { kind: 'ok', bundleUri, bundlePath, dependencies: collectedDeps };

  } catch (e: unknown) {
    // esbuild throws an object with .errors array on build failure
    if (isEsbuildError(e)) {
      const err = e.errors[0];
      return {
        kind: 'error',
        message: err.text,
        file: err.location?.file ?? fileUri.fsPath,
        line: err.location?.line ?? 0,
        col: err.location?.column ?? 0,
      };
    }
    return {
      kind: 'error',
      message: e instanceof Error ? e.message : String(e),
      file: fileUri.fsPath,
      line: 0,
      col: 0,
    };
  }
}

function isEsbuildError(e: unknown): e is { errors: Array<{ text: string; location?: { file?: string; line?: number; column?: number } }> } {
  return (
    typeof e === 'object' &&
    e !== null &&
    'errors' in e &&
    Array.isArray((e as { errors: unknown }).errors)
  );
}
