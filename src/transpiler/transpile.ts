import * as vscode from 'vscode';

export type TranspileResult =
  | { kind: 'ok'; code: string; dependencies: vscode.Uri[] }
  | { kind: 'error'; message: string; file: string; line: number; col: number };

/**
 * Transpiles a JSX/TSX file to a browser-runnable ESM bundle.
 * Stub implementation — Phase 2 will fill this in with esbuild-wasm.
 */
export async function transpile(_fileUri: vscode.Uri): Promise<TranspileResult> {
  // TODO: Phase 2 — wire up esbuild-wasm, esmShimPlugin, importResolver
  return {
    kind: 'ok',
    code: `
      import { createRoot } from 'https://esm.sh/react-dom@18/client';
      import React from 'https://esm.sh/react@18';
      const root = createRoot(document.getElementById('root'));
      root.render(React.createElement('p', null, 'Transpiler not yet wired up'));
    `,
    dependencies: [],
  };
}
