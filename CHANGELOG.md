# Changelog

## 0.3.0 — 2026-05-25

### Fixed
- Preview panel was blank when installed from the VS Code marketplace. The `.vsix` now correctly bundles all runtime dependencies (`react`, `react-dom`, `esbuild`, `scheduler`).
- Switched from `esbuild-wasm` to native `esbuild`. The wasm build requires Web Workers and browser globals (`crypto`, `self`) that are unavailable in the VS Code extension host. Native esbuild runs directly in Node with no initialisation overhead.

## 0.2.0

Initial marketplace release.
