import * as crypto from 'crypto';

export function getNonce(): string {
  // Hex only — no +/= characters that would break VS Code's document.write() injection
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Shown immediately when the panel opens, before the first transpile finishes.
 */
export function getLoadingHtml(fileName: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; width: 100%; background: #1e1e1e; color: #888; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 13px; display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <span>Loading ${fileName}…</span>
</body>
</html>`;
}

/**
 * Shown when transpilation fails.
 */
export function getErrorHtml(message: string, file: string, line: number, col: number): string {
  const safeMsg = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeFile = file.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; width: 100%; background: #1e1e1e; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 13px; display: flex; align-items: flex-start; justify-content: flex-start; padding: 16px; }
    .card { background: #3a1a1a; border: 1px solid #c72e2e; border-radius: 4px; padding: 12px 16px; max-width: 100%; }
    .title { color: #e06c75; font-weight: 600; margin-bottom: 6px; }
    .loc { color: #888; font-size: 11px; margin-bottom: 8px; }
    .msg { color: #ddd; font-family: monospace; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">Transpile Error</div>
    <div class="loc">${safeFile}:${line}:${col}</div>
    <div class="msg">${safeMsg}</div>
  </div>
</body>
</html>`;
}

/**
 * The main preview document.
 *
 * The IIFE bundle + mount harness are written to a single temp file on disk
 * by transpile.ts. We load it with a plain <script src>. There is no inline
 * script at all, so VS Code's document.write() injection cannot break it.
 *
 * CSP: the bundle is served by VS Code's service worker under the
 * vscode-resource.vscode-cdn.net hostname. We allow that exact host.
 */
export function getPreviewHtml(bundleScriptUri: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; min-height: 100%; background: #1e1e1e; color: #ccc; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="${bundleScriptUri}"></script>
</body>
</html>`;
}
