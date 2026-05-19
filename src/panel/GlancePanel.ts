import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { getLoadingHtml, getPreviewHtml, getHtmlFilePreviewHtml } from './panelHtml';
import { transpile } from '../transpiler/transpile';
import { FileWatcher } from '../watcher/FileWatcher';
import { getSettings } from '../config/settings';
import { outputChannel } from '../extension';

const GLANCE_TMP_DIR = path.join(os.tmpdir(), 'glance-preview');

// ── Status bar ────────────────────────────────────────────────────────────────

let _statusBar: vscode.StatusBarItem | null = null;

function ensureStatusBar(): vscode.StatusBarItem {
  if (!_statusBar) {
    _statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    _statusBar.command = 'glance.toggleRefreshMode';
    _statusBar.tooltip = 'Click to toggle Glance refresh mode (save ↔ live)';
  }
  return _statusBar;
}

export function updateStatusBar(): void {
  const bar = ensureStatusBar();
  const { refreshMode } = getSettings();
  bar.text = refreshMode === 'live' ? '$(eye) Glance: live' : '$(save) Glance: save';
  if (GlancePanel.hasAny()) {
    bar.show();
  } else {
    bar.hide();
  }
}

export function disposeStatusBar(): void {
  _statusBar?.dispose();
  _statusBar = null;
}

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

    // Rewire watcher when glance config changes
    this._disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('glance.refreshMode') || e.affectsConfiguration('glance.liveDebounceMs')) {
          outputChannel.appendLine('[Glance] Config changed — rewiring watcher');
          this._rewireWatcher();
          updateStatusBar();
        }
      }),
    );

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
        localResourceRoots: [vscode.Uri.file(GLANCE_TMP_DIR)],
        retainContextWhenHidden: true,
      },
    );

    const instance = new GlancePanel(panel, fileUri);
    GlancePanel.panels.set(key, instance);
    updateStatusBar();
    return instance;
  }

  static closeForFile(fileUri: vscode.Uri): void {
    GlancePanel.panels.get(fileUri.toString())?.dispose();
  }

  static disposeAll(): void {
    GlancePanel.panels.forEach((p) => p.dispose());
    GlancePanel.panels.clear();
  }

  static hasAny(): boolean {
    return GlancePanel.panels.size > 0;
  }

  /** Toggle refreshMode in VS Code settings (used by status bar command). */
  static async toggleRefreshMode(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('glance');
    const current = cfg.get<string>('refreshMode', 'save');
    const next = current === 'save' ? 'live' : 'save';
    await cfg.update('refreshMode', next, vscode.ConfigurationTarget.Global);
    // onDidChangeConfiguration fires → rewires all watchers + updates status bar
  }

  dispose(): void {
    GlancePanel.panels.delete(this._fileUri.toString());
    this._watcher?.dispose();
    this._panel.dispose();
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
    updateStatusBar();
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  async triggerUpdate(): Promise<void> {
    const fileName = this._fileUri.path.split('/').pop() ?? '';
    outputChannel.appendLine(`[Glance] triggerUpdate: ${fileName}`);

    try {
      const result = await transpile(this._fileUri);
      outputChannel.appendLine(`[Glance] transpile result: ${result.kind}`);

      if (result.kind === 'html') {
        // HTML file — rendered via srcdoc so it runs in its own origin context,
        // bypassing the webview's outer CSP and resource URI restrictions.
        this._panel.webview.html = getHtmlFilePreviewHtml(result.rawHtml);
        outputChannel.appendLine('[Glance] HTML preview rendered (srcdoc)');
      } else if (result.kind === 'ok') {
        this._watcher?.setDependencies(result.dependencies);
        const scriptUri = this._panel.webview.asWebviewUri(result.bundleUri).toString();
        const isCdn = result.tailwindMode === 'cdn';
        this._panel.webview.html = getPreviewHtml(scriptUri, undefined, result.cssText, isCdn, result.glanceProps, result.isReactNative);
        this._lastGoodScriptUri = scriptUri;
        this._lastGoodCssText = result.cssText;
        this._lastGoodTailwindCdn = isCdn;
        this._lastGoodGlanceProps = result.glanceProps;
        this._lastGoodIsReactNative = result.isReactNative;
        outputChannel.appendLine(`[Glance] preview updated (tailwind: ${result.tailwindMode}, rn: ${result.isReactNative})`);
      } else {
        outputChannel.appendLine(`[Glance] transpile error: ${result.message}`);
        const errorOverlay = {
          message: result.message,
          file: result.file,
          line: result.line,
          col: result.col,
        };
        if (this._lastGoodScriptUri) {
          this._panel.webview.html = getPreviewHtml(this._lastGoodScriptUri, errorOverlay, this._lastGoodCssText, this._lastGoodTailwindCdn, this._lastGoodGlanceProps, this._lastGoodIsReactNative);
        } else {
          this._panel.webview.html = getPreviewHtml('', errorOverlay);
        }
      }
    } catch (err) {
      outputChannel.appendLine(`[Glance] EXCEPTION in triggerUpdate: ${err}`);
    }
  }

  private _lastGoodScriptUri: string | null = null;
  private _lastGoodCssText: string = '';
  private _lastGoodTailwindCdn: boolean = false;
  private _lastGoodGlanceProps: Record<string, string | number | boolean> = {};
  private _lastGoodIsReactNative: boolean = false;

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

  private _rewireWatcher(): void {
    // Grab existing dependencies before tearing down the old watcher
    const existingDeps = this._watcher ? this._watcher.getDependencies() : [];

    // Dispose old watcher (removes it from _disposables by rebuilding without it)
    this._watcher?.dispose();
    this._disposables = this._disposables.filter((d) => d !== this._watcher);

    // Create new watcher with updated settings
    const settings = getSettings();
    this._watcher = new FileWatcher(
      this._fileUri,
      settings.refreshMode,
      settings.liveDebounceMs,
      () => this.triggerUpdate(),
    );
    this._watcher.setDependencies(existingDeps);
    this._disposables.push(this._watcher);
  }
}
