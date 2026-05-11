import type { Plugin } from 'esbuild';

/**
 * esbuild plugin for non-React bare specifiers only.
 * React and react-dom are bundled directly from node_modules — no shim needed.
 * Unknown npm packages get a warning stub.
 */

function isBareSpecifier(p: string): boolean {
  return (
    !p.startsWith('.') &&
    !p.startsWith('/') &&
    !p.startsWith('https://') &&
    !p.startsWith('http://')
  );
}

const REACT_PACKAGES = new Set([
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'scheduler',
  'scheduler/tracing',
]);

export const esmShimPlugin: Plugin = {
  name: 'esm-shim',
  setup(build) {
    // Only intercept non-React bare specifiers
    build.onResolve({ filter: /.*/ }, (args) => {
      if (!isBareSpecifier(args.path)) return null;
      if (REACT_PACKAGES.has(args.path)) return null; // let esbuild resolve from node_modules
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
