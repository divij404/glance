# Changelog

## 0.3.1 — 2026-05-25

### Fixed
- Marketplace installs now work correctly. The `.vsix` bundles all runtime
  dependencies (`react`, `react-dom`, `esbuild`, `scheduler`).
- Switched from `esbuild-wasm` to native `esbuild`. The wasm build requires
  Web Workers and browser globals (`crypto`, `self`) that are unavailable in
  the VS Code extension host — native esbuild runs directly in Node with no
  initialisation overhead and no blank preview panel.

## 0.2.0 — 2026-05-19

### Added
- **HTML preview** — open any `.html` or `.htm` file and press `Ctrl+Alt+P`
  to render it in a sandboxed frame. `<style>` and `<script>` tags work as normal.
- **React Native preview** — files that import from `react-native` are
  automatically aliased to `react-native-web`. Platform-specific extensions
  (`.web.tsx`, `.native.tsx`) resolve automatically. No configuration needed.
- **Tailwind CSS** — detected automatically. Uses the local CLI if available,
  falls back to CDN otherwise.
- **CSS and CSS Modules** — plain `.css` imports and CSS Modules are bundled
  into the preview.
- **Live props** — add a `// @glance { ... }` comment to seed props. An editable
  toolbar appears in the panel; changes apply instantly without rebuilding.
- **Viewport presets** — Mobile (375px), Tablet (768px), Desktop (full width).
- **Theme toggle** — dark, light, or transparent canvas background.
- **Refresh modes** — save mode (default) or live mode with configurable debounce.
- **File watching** — multi-file local imports are tracked; any change to a
  dependency triggers a rebuild.
- **Error overlay** — build and runtime errors are shown inline. The last
  working preview stays visible until the error is fixed.
- Toolbar keyboard navigation with arrow keys, ARIA roles, and focus-visible ring.

## 0.1.0 — initial

- End-to-end React preview via `Ctrl+Alt+P`.
- Preview panel opens beside the editor.
- esbuild-based transpilation with JSX/TSX support.
