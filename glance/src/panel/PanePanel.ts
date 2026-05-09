import * as vscode from 'vscode';
import { getNonce, getWebviewHtml } from './panelHtml';
import { ExtToWebview, WebviewToExt } from './panelMessages';
import { transpile } from '../transpiler/transpile';
import { FileWatcher } from '../watcher/FileWatcher';
import { getSettings } from '../config/settings';

/**
 * Singleton-per-file manager for the Pane preview WebviewPanel.
 *
 * Only one panel exists per file URI. Calling openOrReveal on the same
 * file brings the existing panel to the foreground instead of opening a
 * second one.
 */
export class PanePanel {
  private static panels = new Map<string, PanePanel>();

  private readonly _panel: vscode.WebviewPanel;
  private readonly _fileUri: vscode.Uri;
  private readonly _extensionUri: vscode.Uri;
  private _watcher: FileWatcher | null = null;
  private _disposables: vscode.Disposable[] = [];
  private _nonce: string;

  private constructor(
    panel: vscode.WebviewPanel,
    fileUri: vscode.Uri,
    extensionUri: vscode.Uri,
  ) {
    this._panel = panel;
    this._fileUri = fileUri;
    this._extensionUri = extensionUri;
    this._nonce = getNonce();

    // Set initial HTML
    this._refresh();

    // Handle messages from the WebView
    this._panel.webview.onDidReceiveMessage(
      (msg: WebviewToExt) => this._handleWebviewMessage(msg),
      null,
      this._disposables,
    );

    // Dispose when the panel is closed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Wire up file watcher
    this._startWatcher();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  static openOrReveal(
    fileUri: vscode.Uri,
    extensionUri: vscode.Uri,
  ): PanePanel {
    const key = fileUri.toString();
    const existing = PanePanel.panels.get(key);
    if (existing) {
      existing._panel.reveal(vscode.ViewColumn.Beside);
      return existing;
    }

    const fileName = fileUri.path.split('/').pop() ?? 'Preview';
    const panel = vscode.window.createWebviewPanel(
      'panePreview',
      `Pane — ${fileName}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true,
      },
    );

    const instance = new PanePanel(panel, fileUri, extensionUri);
    PanePanel.panels.set(key, instance);
    return instance;
  }

  static closeForFile(fileUri: vscode.Uri): void {
    PanePanel.panels.get(fileUri.toString())?.dispose();
  }

  static disposeAll(): void {
    PanePanel.panels.forEach((p) => p.dispose());
    PanePanel.panels.clear();
  }

  dispose(): void {
    PanePanel.panels.delete(this._fileUri.toString());
    this._watcher?.dispose();
    this._panel.dispose();
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _refresh(): void {
    const fileName = this._fileUri.path.split('/').pop() ?? '';
    this._panel.webview.html = getWebviewHtml(
      this._panel.webview,
      this._extensionUri,
      this._nonce,
      fileName,
    );
  }

  /** Trigger a full transpile → postMessage cycle. */
  async triggerUpdate(): Promise<void> {
    this._post({ type: 'LOADING' });

    const result = await transpile(this._fileUri);

    if (result.kind === 'ok') {
      this._post({
        type: 'UPDATE',
        code: result.code,
        timestamp: Date.now(),
      });
    } else {
      this._post({
        type: 'TRANSPILE_ERROR',
        message: result.message,
        file: result.file,
        line: result.line,
        col: result.col,
      });
    }
  }

  private _post(msg: ExtToWebview): void {
    this._panel.webview.postMessage(msg);
  }

  private _handleWebviewMessage(msg: WebviewToExt): void {
    switch (msg.type) {
      case 'READY':
        // WebView is mounted — do the first transpile
        this.triggerUpdate();
        break;
      case 'RUNTIME_ERROR':
        // Log to the output channel; WebView already shows the ErrorCard
        console.error('[Pane runtime error]', msg.message, msg.stack);
        break;
      case 'REFRESH_REQUEST':
        this.triggerUpdate();
        break;
      case 'VIEWPORT_CHANGE':
        // No-op in the extension host; the WebView manages viewport state
        break;
    }
  }

  private _startWatcher(): void {
    const settings = getSettings();
    this._watcher = new FileWatcher(
      this._fileUri,
      settings.refreshMode,
      settings.liveDebounceMs,
      () => this.triggerUpdate(),
    );
    this._disposables.push(this._watcher);
  }
}
