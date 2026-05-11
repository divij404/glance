import React, { useEffect, useRef } from 'react';

interface SandboxProps {
  code: string | null;
  theme: 'light' | 'dark';
  viewportWidth: number;
  onRuntimeError: (message: string, stack: string) => void;
  onReady: () => void;
}

/**
 * Renders the user's transpiled component inside a sandboxed iframe.
 * The iframe src points to webview/sandbox.html served via VS Code's
 * webview resource URI — it has its own permissive CSP for running
 * user code and loading React from esm.sh.
 */
export function Sandbox({ code, theme, viewportWidth, onRuntimeError, onReady }: SandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sandboxSrcdoc = window.__PANE__.sandboxSrcdoc;
  const bgColor = theme === 'light' ? '#ffffff' : '#1e1e1e';

  // Send code into the iframe whenever it changes
  useEffect(() => {
    if (!code || !iframeRef.current) return;
    const win = iframeRef.current.contentWindow;
    if (!win) return;
    // Small delay to ensure the iframe's module script has loaded React
    const timer = setTimeout(() => {
      win.postMessage({ type: 'UPDATE', code }, '*');
    }, 300);
    return () => clearTimeout(timer);
  }, [code]);

  // Listen for messages back from the iframe
  useEffect(() => {
    function handler(e: MessageEvent) {
      if (!e.data) return;
      if (e.data.type === 'RUNTIME_ERROR') {
        onRuntimeError(e.data.message, e.data.stack ?? '');
      }
      if (e.data.type === 'IFRAME_READY') {
        onReady();
      }
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onRuntimeError, onReady]);

  // Update background when theme changes by posting a message
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({ type: 'SET_THEME', bg: bgColor }, '*');
  }, [theme, bgColor]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={sandboxSrcdoc}
      sandbox="allow-scripts allow-same-origin"
      style={{
        width: viewportWidth,
        minHeight: '100%',
        border: '1px solid var(--vscode-panel-border, #3c3c3c)',
        borderRadius: 2,
        background: bgColor,
        display: 'block',
      }}
      title="Glance Preview"
    />
  );
}
