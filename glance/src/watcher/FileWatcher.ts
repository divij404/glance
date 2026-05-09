import * as vscode from 'vscode';

type RefreshMode = 'save' | 'live';

/**
 * Watches a single file for changes and calls `onUpdate` when the file
 * should be re-transpiled.
 *
 * - save mode:  fires on `onDidSaveTextDocument` only
 * - live mode:  fires on `onDidChangeTextDocument`, debounced by `debounceMs`
 */
export class FileWatcher implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _trackedUris = new Set<string>();

  constructor(
    private readonly _primaryUri: vscode.Uri,
    private _mode: RefreshMode,
    private _debounceMs: number,
    private readonly _onUpdate: () => void,
  ) {
    this._trackedUris.add(_primaryUri.toString());
    this._wire();
  }

  /** Add a dependency file URI (e.g. a locally imported component). */
  trackDependency(uri: vscode.Uri): void {
    this._trackedUris.add(uri.toString());
  }

  /** Replace the set of tracked dependency URIs (called after each transpile). */
  setDependencies(uris: vscode.Uri[]): void {
    this._trackedUris = new Set([
      this._primaryUri.toString(),
      ...uris.map((u) => u.toString()),
    ]);
  }

  dispose(): void {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
    }
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _wire(): void {
    this._disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (this._trackedUris.has(doc.uri.toString())) {
          // Always fire on save regardless of mode (save mode = only this fires)
          if (this._mode === 'save') {
            this._onUpdate();
          }
        }
      }),

      vscode.workspace.onDidChangeTextDocument((e) => {
        if (
          this._mode === 'live' &&
          this._trackedUris.has(e.document.uri.toString())
        ) {
          this._debounce();
        }
      }),
    );
  }

  private _debounce(): void {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this._onUpdate();
    }, this._debounceMs);
  }
}
