# Glance

Preview React, React Native, and HTML files instantly inside VS Code — no dev server, no browser, no setup.

## What's in it for you

Starting a dev server just to check one component takes too long. You wait for a build, open a browser, and navigate to the right page. Glance skips all of that.

- Open any `.jsx`, `.tsx`, `.html`, or React Native file and press one key. A preview appears beside your editor.
- The preview updates every time you save. No browser tab to switch to.
- Glance works with Create React App, Vite, Next.js, and React Native. You do not need to change your project.
- Glance bundles everything it needs. You do not install React or esbuild separately.

## Installation

1. Open VS Code
2. Press `Ctrl+Shift+X` to open the Extensions panel
3. Search for **Glance**
4. Click **Install**

That's it. Glance includes all its dependencies.

## Usage

### Open a preview

1. Open a `.jsx`, `.tsx`, `.html`, or React Native file
2. Press `Ctrl+Alt+P` (Mac: `Cmd+Alt+P`)
3. A preview panel opens beside your editor
4. Edit and save — the preview updates

You can also right-click in the editor and choose **Glance: Open Preview**.

### HTML files

Open any `.html` or `.htm` file and press `Ctrl+Alt+P`. Glance renders it in a sandboxed frame. Your `<style>` and `<script>` tags work as normal. No build step runs.

### React Native files

Open a `.jsx` or `.tsx` file that imports from `react-native` and press `Ctrl+Alt+P`. Glance automatically detects React Native imports and aliases them to `react-native-web`, so your components render directly in the panel without any configuration. Platform-specific extensions (`.web.tsx`, `.native.tsx`) are resolved automatically.

### Live props

You can pass test props to a React component. Add a comment at the top of the file:

```tsx
// @glance { label: "Click me", count: 0, disabled: false, color: "#61afef" }

export default function Button({ label, count, disabled, color }) {
  return <button disabled={disabled} style={{ color }}>{label} ({count})</button>;
}
```

Glance reads the comment and shows a props bar in the toolbar. You can edit each value live. The component updates without rebuilding.

### Toolbar

**Viewport** — sets the preview width. Choose Mobile (375px), Tablet (768px), or Desktop (full width).

**Background** — sets the canvas color behind the component. Choose dark, light, or transparent.

### Errors

If your file has a build error, Glance shows it at the bottom of the panel. The last working preview stays visible. When you fix the error and save, the preview returns.

### Refresh mode

By default, Glance updates when you save (`Ctrl+S`). You can switch to **live mode**, which updates as you type. Click **Glance: save** in the status bar to toggle.

> [!NOTE]
> Live mode waits 400ms after your last keystroke before it rebuilds. You can change this delay in settings.

## Configuration

Open VS Code Settings (`Ctrl+,`) and search for **Glance**.

| Setting | Default | Description |
|---|---|---|
| `glance.refreshMode` | `"save"` | When to update: `"save"` or `"live"` |
| `glance.liveDebounceMs` | `400` | Delay before live mode rebuilds (ms) |
| `glance.defaultViewport` | `"desktop"` | Starting viewport: `"mobile"`, `"tablet"`, or `"desktop"` |
| `glance.defaultTheme` | `"dark"` | Starting background: `"light"`, `"dark"`, or `"system"` |

### Commands

| Command | Keybinding | Description |
|---|---|---|
| Glance: Open Preview | `Ctrl+Alt+P` / `Cmd+Alt+P` | Open the preview panel |
| Glance: Close Preview | — | Close the preview panel |
| Glance: Toggle Refresh Mode | Click status bar | Switch between save and live mode |

## Contributing

Pull requests are welcome. The source is on [GitHub](https://github.com/divij404/glance).

**Set up the dev environment:**

```bash
git clone https://github.com/divij404/glance.git
cd glance
npm install
npm run build
```

Then press `F5` in VS Code. This opens a new VS Code window with Glance loaded. You can test your changes there.

**Run the linter:**

```bash
npm run lint
```

> [!IMPORTANT]
> You need Node.js 18 or later. VS Code includes Node.js 18 by default, so no separate install is needed in most cases.

## License

MIT License — see [LICENSE](LICENSE).
