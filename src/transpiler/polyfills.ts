// Polyfill browser globals required by esbuild-wasm's browser build.
// This module must be imported before esbuild-wasm/lib/browser.js.
// Node 18+ has webcrypto but it isn't always wired onto globalThis.
if (typeof (globalThis as any).crypto === 'undefined') {
  (globalThis as any).crypto = require('crypto').webcrypto;
}
