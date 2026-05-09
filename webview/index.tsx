import React from 'react';
import { createRoot } from 'react-dom/client';

// Bootstrap data injected by panelHtml.ts
declare global {
  interface Window {
    __PANE__: {
      fileName: string;
      vscodeApi: ReturnType<typeof acquireVsCodeApi>;
    };
  }
}

const vscode = window.__PANE__.vscodeApi;

function App() {
  return (
    <div style={{ padding: 24, fontFamily: 'monospace', color: '#ccc' }}>
      <p>⚡ Glance is ready</p>
      <p style={{ marginTop: 8, fontSize: 11, opacity: 0.5 }}>
        {window.__PANE__.fileName}
      </p>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

// Tell the extension host we're mounted and ready for the first transpile
vscode.postMessage({ type: 'READY' });
