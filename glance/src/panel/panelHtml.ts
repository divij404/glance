import * as vscode from 'vscode';
import * as crypto from 'crypto';

/**
 * Generates a cryptographically random nonce for the CSP.
 * A new nonce is generated each time the panel HTML is rebuilt.
 */
export function getNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Returns the full HTML document injected into the WebView.
 *
 * CSP is locked down per Backend §2.7:
 *   - default-src 'none'
 *   - script-src: nonce only + esm.sh (for sandbox iframe scripts)
 *   - style-src: unsafe-inline (VS Code theming needs this)
 *   - img-src: data: https:
 *   - connect-src: esm.sh
 *   - frame-src: 'self'  (allows the srcdoc iframe)
 */
export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nonce: string,
  fileName: string,
): string {
  const webviewScriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'),
  );

  // Codicons CSS — bundled with VS Code, available via webview URI
  const codiconsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      extensionUri,
      'node_modules',
      '@vscode',
      'codicons',
      'dist',
      'codicon.css',
    ),
  );

  const csp = [
    `default-src 'none'`,
    `script-src 'nonce-${nonce}' https://esm.sh https://cdn.tailwindcss.com`,
    `style-src 'unsafe-inline' ${webview.cspSource}`,
    `img-src data: https: ${webview.cspSource}`,
    `connect-src https://esm.sh`,
    `frame-src 'self'`,
    `font-src ${webview.cspSource} https:`,
  ].join('; ');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pane Preview</title>
  <link rel="stylesheet" href="${codiconsUri}" />
  <style nonce="${nonce}">
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; width: 100%; overflow: hidden; }
    body {
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-foreground, #ccc);
      font-family: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    // Pass bootstrap data to the webview bundle
    window.__PANE__ = {
      fileName: ${JSON.stringify(fileName)},
      vscodeApi: acquireVsCodeApi(),
    };
  </script>
  <script nonce="${nonce}" src="${webviewScriptUri}"></script>
</body>
</html>`;
}
