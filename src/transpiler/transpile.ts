import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { makeEsmShimPlugin } from './esmShim';
import { makeImportResolverPlugin } from './importResolver';
import { detectAndBuildTailwind } from './tailwind';

// Root of the extension package — this is where node_modules/react lives.
// __dirname is dist/ at runtime, so one level up is the extension root.
const EXTENSION_ROOT = path.join(__dirname, '..');

// Temp dir for writing bundle files that the webview loads as local resources.
const GLANCE_TMP_DIR = path.join(os.tmpdir(), 'glance-preview');

export type GlanceProps = Record<string, string | number | boolean>;

export type TranspileResult =
  | { kind: 'ok'; bundleUri: vscode.Uri; bundlePath: string; cssText: string; tailwindMode: 'none' | 'cdn' | 'cli'; glanceProps: GlanceProps; dependencies: vscode.Uri[]; isReactNative: boolean }
  | { kind: 'html'; rawHtml: string }
  | { kind: 'error'; message: string; file: string; line: number; col: number };

/**
 * Parse // @glance { ... } from the source file.
 * Returns the parsed object, or {} if not found / invalid.
 */
export function parseGlanceProps(source: string): GlanceProps {
  const match = source.match(/\/\/\s*@glance\s*(\{[\s\S]*?\})/m);
  if (!match) { return {}; }
  try {
    // Use Function constructor so we support unquoted keys and trailing commas
    // eslint-disable-next-line no-new-func
    const obj = new Function(`return (${match[1]})`)();
    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      return obj as GlanceProps;
    }
  } catch { /* ignore parse errors */ }
  return {};
}

// ── esbuild (native Node build) ───────────────────────────────────────────
// We use the native esbuild package in the extension host (Node.js).
// esbuild-wasm is only needed for browser contexts — not applicable here.
async function getEsbuild() {
  return await import('esbuild');
}

// ── Main export ───────────────────────────────────────────────────────────

export async function transpile(fileUri: vscode.Uri): Promise<TranspileResult> {
  try {
    // Read the entry file — prefer the in-memory buffer so live mode reflects
    // unsaved edits. Fall back to disk if the file isn't open in an editor.
    const openDoc = vscode.workspace.textDocuments.find(
      (d) => d.uri.toString() === fileUri.toString(),
    );
    const sourceText = openDoc
      ? openDoc.getText()
      : Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString('utf8');
    const fileDir = path.dirname(fileUri.fsPath);
    const fileName = path.basename(fileUri.fsPath);

    // ── HTML files: pass raw HTML to the panel for srcdoc rendering ─────────
    if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
      return { kind: 'html', rawHtml: sourceText };
    }

    // ── React Native detection ────────────────────────────────────────────────
    // If the file imports from 'react-native', alias it to react-native-web so
    // RN components render to the DOM without any changes to the user's code.
    const isReactNative = /from\s+['"]react-native['"]|require\s*\(\s*['"]react-native['"]\s*\)/.test(sourceText);

    const esbuild = await getEsbuild();

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
        // resolveDir = user's file directory so relative imports (./Foo) resolve correctly.
        // EXTENSION_ROOT is added via nodePaths so bare specifiers (react, react-dom)
        // are found in the extension's node_modules.
        resolveDir: fileDir,
        sourcefile: fileName,
      },
      nodePaths: [path.join(EXTENSION_ROOT, 'node_modules')],
      bundle: true,
      format: 'iife',
      globalName: '__glance_module__',
      platform: 'browser',
      target: 'es2020',
      jsx: 'automatic',
      write: false,
      outdir: GLANCE_TMP_DIR,
      // Alias react-native → react-native-web for RN components so they render to DOM
      alias: isReactNative ? { 'react-native': 'react-native-web' } : {},
      plugins: [
        makeImportResolverPlugin(fileDir, collectedDeps),
        makeEsmShimPlugin(isReactNative ? { 'react-native': 'react-native-web' } : {}),
      ],
      external: [],
      logLevel: 'silent',
    });

    if (result.errors.length > 0) {
      const err = result.errors[0];
      const loc = err.location;
      // Append source context line + caret if available
      let message = err.text;
      if (loc?.lineText) {
        const caret = ' '.repeat(loc.column ?? 0) + '^';
        message += `\n\n${loc.lineText}\n${caret}`;
      }
      // Append any notes (esbuild often adds helpful hints here)
      if (err.notes?.length) {
        message += '\n\n' + err.notes.map((n) => n.text).join('\n');
      }
      return {
        kind: 'error',
        message,
        file: (loc?.file ?? fileName).replace(/^local-file:/, ''),
        line: loc?.line ?? 0,
        col: loc?.column ?? 0,
      };
    }

    // esbuild outputs JS first, then CSS (if any styles were imported)
    const jsFile = result.outputFiles.find((f) => f.path.endsWith('.js'));
    const cssFile = result.outputFiles.find((f) => f.path.endsWith('.css'));
    const userCode = jsFile?.text ?? result.outputFiles[0].text;
    const cssText = cssFile?.text ?? '';

    // Parse @glance props from source
    const glanceProps = parseGlanceProps(sourceText);
    const propsJson = JSON.stringify(glanceProps);

    // Append the mount harness directly into the bundle file.
    // Props are seeded from the @glance comment; the toolbar can override them
    // live by calling window.__glance_render__(newProps) without re-transpiling.
    const mountHarness = `
;(function() {
  function showError(msg, stack) {
    var el = document.getElementById("root");
    if (!el) { el = document.body; }
    el.innerHTML =
      "<div style=\\"padding:20px;font-family:'Segoe UI',system-ui,sans-serif;\\">" +
      "<div style=\\"color:#e06c75;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;\\">Runtime Error</div>" +
      "<div style=\\"color:#ddd;font-family:monospace;font-size:13px;white-space:pre-wrap;line-height:1.5;\\">" + msg + (stack ? "\\n\\n" + stack : "") + "</div>" +
      "</div>";
  }

  // React 18 does NOT propagate render errors to the createRoot().render() caller.
  // We intercept console.error to catch React's "The above error occurred..." message.
  var _origError = console.error.bind(console);
  var _renderErrorShown = false;
  console.error = function() {
    _origError.apply(console, arguments);
    if (_renderErrorShown) { return; }
    var msg = Array.prototype.join.call(arguments, ' ');
    // React logs uncaught render errors with this prefix
    if (msg.indexOf('The above error occurred') !== -1 || msg.indexOf('Uncaught Error') !== -1) {
      _renderErrorShown = true;
      showError(msg, '');
    }
  };

  // Also catch unhandled errors (covers synchronous throws outside React tree)
  window.addEventListener('error', function(e) {
    if (_renderErrorShown) { return; }
    _renderErrorShown = true;
    showError(e.message || String(e), e.error && e.error.stack ? e.error.stack.split("\\n").slice(1,4).join("\\n") : '');
  });

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
    var _root = createRoot(rootEl);
    var _props = ${propsJson};
    function _render(props) {
      _props = props;
      // Use JSON key so stateful components remount when props change,
      // ensuring useState(prop) reinitializes with the new value.
      var key = JSON.stringify(props);
      _root.render(React.createElement(Component, Object.assign({ key: key }, props)));
    }
    window.__glance_render__ = _render;
    window.__glance_props__ = _props;
    _render(_props);
  } catch (err) {
    var msg = err && err.message ? err.message : String(err);
    var stack = err && err.stack ? err.stack.split("\\n").slice(1, 4).join("\\n") : "";
    showError(msg, stack);
  }
})();
`;

    if (!fs.existsSync(GLANCE_TMP_DIR)) {
      fs.mkdirSync(GLANCE_TMP_DIR, { recursive: true });
    }
    const bundlePath = path.join(GLANCE_TMP_DIR, 'bundle.js');
    fs.writeFileSync(bundlePath, userCode + mountHarness, 'utf8');
    const bundleUri = vscode.Uri.file(bundlePath);

    // Detect and build Tailwind CSS if the user's project uses it.
    // RN files use StyleSheet.create() — Tailwind is not applicable.
    const twResult = await detectAndBuildTailwind(fileDir, fileUri.fsPath, isReactNative);
    const tailwindCss = twResult.kind === 'cli' ? twResult.cssText : '';
    const combinedCss = [tailwindCss, cssText].filter(Boolean).join('\n');

    return {
      kind: 'ok',
      bundleUri,
      bundlePath,
      cssText: combinedCss,
      tailwindMode: twResult.kind,
      glanceProps,
      dependencies: collectedDeps,
      isReactNative,
    };

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
