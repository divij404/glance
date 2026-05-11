import * as vscode from 'vscode';
import * as path from 'path';
import type { Plugin } from 'esbuild';

/**
 * esbuild plugin that resolves relative imports (./foo, ../bar) by reading
 * files directly from disk via vscode.workspace.fs.
 *
 * Also tracks every file it loads so the caller can update the FileWatcher
 * dependency set after each transpile.
 */
export function makeImportResolverPlugin(
  rootDir: string,
  collectedDeps: vscode.Uri[],
): Plugin {
  return {
    name: 'local-import-resolver',
    setup(build) {
      // Resolve relative specifiers to absolute disk paths
      build.onResolve({ filter: /^\.\.?\// }, (args) => {
        const abs = path.resolve(
          args.resolveDir || rootDir,
          args.path,
        );

        // Try common extensions if no extension given
        const candidates = abs.includes('.')
          ? [abs]
          : [
              abs,
              `${abs}.tsx`,
              `${abs}.ts`,
              `${abs}.jsx`,
              `${abs}.js`,
              `${abs}/index.tsx`,
              `${abs}/index.ts`,
              `${abs}/index.jsx`,
              `${abs}/index.js`,
            ];

        return { path: candidates[0], namespace: 'local-file', pluginData: { candidates } };
      });

      // Load the file via VS Code's fs API
      build.onLoad({ filter: /.*/, namespace: 'local-file' }, async (args) => {
        const candidates: string[] = args.pluginData?.candidates ?? [args.path];

        let contents: Uint8Array | null = null;
        let resolvedPath = args.path;

        for (const candidate of candidates) {
          try {
            const uri = vscode.Uri.file(candidate);
            contents = await vscode.workspace.fs.readFile(uri);
            resolvedPath = candidate;
            break;
          } catch {
            // try next candidate
          }
        }

        if (contents === null) {
          return { errors: [{ text: `Cannot resolve local import: ${args.path}` }] };
        }

        const uri = vscode.Uri.file(resolvedPath);
        // Track as a dependency so the watcher knows to re-transpile when it changes
        if (!collectedDeps.some((u) => u.toString() === uri.toString())) {
          collectedDeps.push(uri);
        }

        const ext = path.extname(resolvedPath).slice(1) || 'tsx';
        const loaderMap: Record<string, 'tsx' | 'ts' | 'jsx' | 'js' | 'css' | 'text'> = {
          tsx: 'tsx', ts: 'ts', jsx: 'jsx', js: 'js',
          css: 'css', txt: 'text',
        };
        const loader = loaderMap[ext] ?? 'tsx';

        return {
          contents,
          loader,
          resolveDir: path.dirname(resolvedPath),
        };
      });
    },
  };
}
