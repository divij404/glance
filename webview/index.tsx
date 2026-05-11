import React, { useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Sandbox } from './Sandbox';

declare global {
  interface Window {
    __PANE__: {
      fileName: string;
      sandboxSrcdoc: string;
      vscodeApi: ReturnType<typeof acquireVsCodeApi>;
    };
  }
}

const vscode = window.__PANE__.vscodeApi;

type AppState =
  | { status: 'loading' }
  | { status: 'ready'; code: string }
  | { status: 'transpile_error'; message: string; file: string; line: number; col: number }
  | { status: 'runtime_error'; message: string; stack: string };

function App() {
  const [state, setState] = useState<AppState>({ status: 'loading' });
  const [theme] = useState<'light' | 'dark'>('dark');
  const [viewportWidth] = useState(1280);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const msg = e.data;
      if (!msg?.type) return;

      switch (msg.type) {
        case 'UPDATE':
          setState({ status: 'ready', code: msg.code });
          break;
        case 'TRANSPILE_ERROR':
          setState({ status: 'transpile_error', message: msg.message, file: msg.file, line: msg.line, col: msg.col });
          break;
        case 'LOADING':
          setState({ status: 'loading' });
          break;
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleRuntimeError = useCallback((message: string, stack: string) => {
    setState({ status: 'runtime_error', message, stack });
    vscode.postMessage({ type: 'RUNTIME_ERROR', message, stack });
  }, []);

  const handleIframeReady = useCallback(() => {
    // no-op; code arrives via UPDATE message
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: 16, background: 'var(--vscode-editor-background, #1e1e1e)' }}>

        {state.status === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a8a8a', fontSize: 12, fontFamily: 'monospace', gap: 8 }}>
            <span>◌</span> Transpiling…
          </div>
        )}

        {state.status === 'transpile_error' && (
          <div style={{ width: '100%', borderLeft: '3px solid #f44747', background: 'rgba(244,71,71,0.08)', padding: '12px 16px', borderRadius: 2, fontFamily: 'monospace', fontSize: 12 }}>
            <div style={{ color: '#f44747', marginBottom: 8, fontWeight: 600 }}>✕ Transpile Error</div>
            <div style={{ color: '#8a8a8a', marginBottom: 4 }}>{state.file}:{state.line}:{state.col}</div>
            <div style={{ color: '#cccccc' }}>{state.message}</div>
          </div>
        )}

        {state.status === 'runtime_error' && (
          <div style={{ width: '100%', borderLeft: '3px solid #cca700', background: 'rgba(204,167,0,0.08)', padding: '12px 16px', borderRadius: 2, fontFamily: 'monospace', fontSize: 12 }}>
            <div style={{ color: '#cca700', marginBottom: 8, fontWeight: 600 }}>⚠ Runtime Error</div>
            <div style={{ color: '#cccccc', marginBottom: 4 }}>{state.message}</div>
            <div style={{ color: '#8a8a8a', whiteSpace: 'pre-wrap', fontSize: 11 }}>{state.stack}</div>
          </div>
        )}

        {state.status === 'ready' && (
          <Sandbox
            code={state.code}
            theme={theme}
            viewportWidth={viewportWidth}
            onRuntimeError={handleRuntimeError}
            onReady={handleIframeReady}
          />
        )}
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

// Tell the extension host we're mounted and ready for the first transpile
vscode.postMessage({ type: 'READY' });
