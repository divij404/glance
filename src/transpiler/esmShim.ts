import * as path from 'path';
import * as fs from 'fs';
import type { Plugin } from 'esbuild';

/**
 * esbuild plugin that stubs bare-specifier imports that cannot be resolved
 * from the extension's node_modules. Packages that ARE in node_modules are
 * left alone so esbuild can bundle them normally. Packages that appear in the
 * alias map are also left alone — esbuild will redirect them after this plugin
 * returns null.
 *
 * Strategy: check (a) the alias map passed at construction time, and (b) the
 * package root in the extension's node_modules via fs.existsSync. If either
 * matches, return null so esbuild handles it. Otherwise emit a warning stub.
 */

// Root of the extension package — node_modules lives here.
// __dirname is dist/ at runtime, so one level up is the extension root.
const EXTENSION_ROOT = path.join(__dirname, '..');
const EXTENSION_NODE_MODULES = path.join(EXTENSION_ROOT, 'node_modules');

function isBareSpecifier(p: string): boolean {
  return (
    !p.startsWith('.') &&
    !p.startsWith('/') &&
    !p.startsWith('https://') &&
    !p.startsWith('http://')
  );
}

function existsInNodeModules(specifier: string): boolean {
  // For sub-path imports like "pkg/sub/path", check the package root first.
  const pkgName = specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0];
  return fs.existsSync(path.join(EXTENSION_NODE_MODULES, pkgName));
}

/**
 * @param aliases - The same alias map passed to esbuild's `alias` option.
 *   Specifiers in this map are passed through so esbuild can redirect them.
 */
export function makeEsmShimPlugin(aliases: Record<string, string> = {}): Plugin {
  return {
    name: 'esm-shim',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (!isBareSpecifier(args.path)) return null;
        // Check alias map — the key may be an exact match or a prefix (pkg → pkg/subpath).
        const pkgName = args.path.startsWith('@')
          ? args.path.split('/').slice(0, 2).join('/')
          : args.path.split('/')[0];
        if (pkgName in aliases || args.path in aliases) return null;
        // If the package root exists in extension node_modules, let esbuild resolve it.
        if (existsInNodeModules(args.path)) return null;
        // Otherwise stub it — it's a package the user hasn't installed.
        return { path: args.path, namespace: 'esm-shim' };
      });

      build.onLoad({ filter: /.*/, namespace: 'esm-shim' }, (args) => {
        return {
          contents: `
            console.warn('[Glance] Package "${args.path}" is not available in the preview sandbox.');
            module.exports = {};
          `,
          loader: 'js',
        };
      });
    },
  };
}

/** @deprecated Use makeEsmShimPlugin(aliases) instead */
export const esmShimPlugin = makeEsmShimPlugin();
