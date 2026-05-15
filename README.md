# Glance — React Component Preview

**Instant sandboxed preview for React components. No dev server. No config. No build step.**

Press `Ctrl+Alt+P` on any `.jsx` or `.tsx` file and a live preview opens beside your editor.

---

## Why

Spinning up a dev server, wiring a route, opening a browser tab — it's too much friction for just checking a component. Glance bundles your file in-memory with esbuild and renders it directly in VS Code. Zero setup.

---

## Quick start

1. Open a `.jsx` or `.tsx` file
2. Press `Ctrl+Alt+P` (`Cmd+Alt+P` on Mac)
3. Edit and save — preview updates instantly

---

## `@glance` props

Seed your component with test props by adding a comment to the file:

```tsx
// @glance { label: "Click me", count: 0, disabled: false, color: "#61afef" }

export default function Button({ label, count, disabled, color }) {
  // ...
}
```

Glance reads the comment and renders your component with those values. A props bar appears in the toolbar where you can edit strings, numbers, booleans, and colors live — no retranspile needed.

---

## Toolbar

- **Viewport** — Mobile (375 px), Tablet (768 px), Desktop (1280 px)
- **Background** — Light or dark sandbox canvas
- **Props bar** — live controls for every `@glance` prop, persisted across reloads

---

## Refresh modes

**Save** (default) — refreshes on `Ctrl+S`. Good for most work.

**Live** — refreshes on every keystroke with a 400 ms debounce. Good for layout and styling.

Toggle by clicking **Glance: save** / **Glance: live** in the status bar.

---

## CSS & Tailwind

Plain CSS imports and CSS Modules work out of the box. For Tailwind, Glance detects your project automatically — if the CLI is installed it runs a build; otherwise it injects the CDN. No config needed either way.

---

## Error handling

Build errors and runtime exceptions appear as an overlay without blowing away the last good preview. A typo won't nuke your working render.

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `glance.refreshMode` | `"save"` | `"save"` or `"live"` |
| `glance.liveDebounceMs` | `400` | Debounce delay for live mode (ms) |
| `glance.defaultViewport` | `"desktop"` | `"mobile"`, `"tablet"`, or `"desktop"` |
| `glance.defaultTheme` | `"dark"` | `"light"`, `"dark"`, or `"system"` |

---

## Commands

| Command | Keybinding | Description |
|---|---|---|
| Glance: Open Preview | `Ctrl+Alt+P` / `Cmd+Alt+P` | Open preview for the active file |
| Glance: Close Preview | — | Close the preview panel |
| Glance: Toggle Refresh Mode | Click status bar | Switch save ↔ live |

---

## License

MIT
