import type { Plugin } from 'esbuild-wasm';

/**
 * esbuild plugin that rewrites bare npm specifiers to esm.sh CDN URLs.
 *
 * Examples:
 *   import React from 'react'          → import React from 'https://esm.sh/react@18'
 *   import { useState } from 'react'   → same
 *   import clsx from 'clsx'            → import clsx from 'https://esm.sh/clsx'
 *
 * Relative imports (./foo, ../bar) and absolute URLs are left untouched.
 *
 * Pin React and React-DOM to @18 to match the sandbox runtime expectation.
 */

const PINNED: Record<string, string> = {
  react: 'react@18',
  'react-dom': 'react-dom@18',
  'react-dom/client': 'react-dom@18/client',
  'react/jsx-runtime': 'react@18/jsx-runtime',
  'react/jsx-dev-runtime': 'react@18/jsx-dev-runtime',
};

const ESM_SH = 'https://esm.sh/';

function isBareSpecifier(path: string): boolean {
  return (
    !path.startsWith('.') &&
    !path.startsWith('/') &&
    !path.startsWith('https://') &&
    !path.startsWith('http://')
  );
}

export const esmShimPlugin: Plugin = {
  name: 'esm-shim',
  setup(build) {
    // Intercept ALL bare specifier imports
    build.onResolve({ filter: /.*/ }, (args) => {
      if (!isBareSpecifier(args.path)) {
        return null; // let esbuild handle relative + URL imports normally
      }

      const pinned = PINNED[args.path];
      const pkg = pinned ?? args.path;
      return {
        path: `${ESM_SH}${pkg}`,
        external: true, // tell esbuild to emit the URL as-is in the output
      };
    });
  },
};
