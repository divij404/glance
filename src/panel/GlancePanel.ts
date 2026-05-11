import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { getLoadingHtml, getErrorHtml, getPreviewHtml } from './panelHtml';
import { transpile } from '../transpiler/transpile';
import { FileWatcher } from '../watcher/FileWatcher';
import { getSettings } from '../config/settings';
import { outputChannel } from '../extension';

const GLANCE_TMP_DIR = path.join(os.tmpdir(), 'glance-preview');

/**
 * Singleton-per-file manager for the Glance preview WebviewPanel.
 *
 * On each transpile we set webview.html directly to a full self-contained
 * document — no nested iframe, no vscode-resource URI issues.
 */
export class GlancePanel {
  private static panels = new Map<string, GlancePanel>();

  private readonly _panel: vscode.WebviewPanel;
  private readonly _fileUri: vscode.Uri;
  private _watcher: FileWatcher | null = null;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, fileUri: vscode.Uri) {
    this._panel = panel;
    this._fileUri = fileUri;

    // Show loading state immediately
    const fileName = fileUri.path.split('/').pop() ?? '';
    this._panel.webview.html = getLoadingHtml(fileName);

    // Dispose when the panel is closed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Start watching and do first transpile
    this._startWatcher();
    this.triggerUpdate();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  static openOrReveal(fileUri: vscode.Uri, extensionUri: vscode.Uri): GlancePanel {
    const key = fileUri.toString();
    const existing = GlancePanel.panels.get(key);
    if (existing) {
      existing._panel.reveal(vscode.ViewColumn.Beside);
      return existing;
    }

    const fileName = fileUri.path.split('/').pop() ?? 'Preview';
    const panel = vscode.window.createWebviewPanel(
      'glancePreview',
      `Glance — ${fileName}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        // Allow loading the bundle.js we write to the OS temp dir
        localResourceRoots: [vscode.Uri.file(GLANCE_TMP_DIR)],
        retainContextWhenHidden: true,
      },
    );

    const instance = new GlancePanel(panel, fileUri);
    GlancePanel.panels.set(key, instance);
    return instance;
  }

  static closeForFile(fileUri: vscode.Uri): void {
    GlancePanel.panels.get(fileUri.toString())?.dispose();
  }

  static disposeAll(): void {
    GlancePanel.panels.forEach((p) => p.dispose());
    GlancePanel.panels.clear();
  }

  dispose(): void {
    GlancePanel.panels.delete(this._fileUri.toString());
    this._watcher?.dispose();
    this._panel.dispose();
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  async triggerUpdate(): Promise<void> {
    const fileName = this._fileUri.path.split('/').pop() ?? '';
    outputChannel.appendLine(`[Glance] triggerUpdate: ${fileName}`);
    try {
      const result = await transpile(this._fileUri);
      outputChannel.appendLine(`[Glance] transpile result: ${result.kind}`);

      if (result.kind === 'ok') {
        outputChannel.appendLine(`[Glance] bundle written to: ${result.bundlePath}`);
        // Convert the file URI to a webview URI (vscode-resource://...)
        const scriptUri = this._panel.webview.asWebviewUri(result.bundleUri);
        this._panel.webview.html = getPreviewHtml(scriptUri.toString());
        outputChannel.appendLine(`[Glance] webview.html set (preview), scriptUri: ${scriptUri}`);
      } else {
        outputChannel.appendLine(`[Glance] transpile error: ${result.message} at ${result.file}:${result.line}:${result.col}`);
        this._panel.webview.html = getErrorHtml(
          result.message,
          result.file,
          result.line,
          result.col,
        );
      }
    } catch (err) {
      outputChannel.appendLine(`[Glance] EXCEPTION in triggerUpdate: ${err}`);
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
