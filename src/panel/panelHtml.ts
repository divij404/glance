import * as crypto from 'crypto';

export function getNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Shown immediately when the panel opens, before the first transpile finishes.
 */
export function getLoadingHtml(fileName: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; width: 100%; background: #1e1e1e; color: #555; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: #444; animation: pulse 1.2s ease-in-out infinite; }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes pulse { 0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
  </style>
</head>
<body>
  <div class="dot"></div><div class="dot"></div><div class="dot"></div>
</body>
</html>`;
}

/**
 * Shown when the very first transpile fails (no prior good render to overlay).
 * Renders the error directly as static HTML — no scripts or postMessage needed.
 */
export function getFirstLoadErrorHtml(message: string, file: string, line: number, col: number): string {
  const safeMsg = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const shortFile = file.replace(/\\/g, '/').split('/').pop() ?? file;
  const loc = shortFile + (line ? `:${line}:${col}` : '');
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; width: 100%; background: #1e1e1e; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 13px; display: flex; align-items: flex-start; justify-content: flex-start; padding: 16px; }
    .card { background: #2a1111; border: 1px solid #c72e2e; border-radius: 4px; padding: 12px 16px; max-width: 100%; }
    .header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .label { color: #e06c75; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    .loc { color: #666; font-size: 11px; font-family: monospace; }
    .msg { color: #ddd; font-family: monospace; white-space: pre-wrap; word-break: break-word; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="label">Error</span>
      <span class="loc" title="${file}">${loc}</span>
    </div>
    <div class="msg">${safeMsg}</div>
  </div>
</body>
</html>`;
}

/**
 * Preview for raw .html files.
 *
 * The user's HTML is injected via srcdoc. A sandboxed srcdoc iframe gets its
 * own opaque origin and a fresh CSP, so scripts inside the user's file run
 * normally without being blocked by the outer webview's Content-Security-Policy.
 * allow-same-origin is intentionally omitted to keep the iframe origin opaque.
 */
export function getHtmlFilePreviewHtml(rawHtml: string): string {
  const nonce = getNonce();
  // srcdoc requires only `"` to be escaped inside a double-quoted attribute.
  const srcdoc = rawHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Toolbar ── */
    #glance-toolbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 36px;
      background: #2d2d2d;
      border-bottom: 2px solid #111;
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 0 10px;
      z-index: 9998;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 11px;
      user-select: none;
    }
    .tb-group {
      display: flex;
      align-items: center;
      gap: 1px;
      border-right: 1px solid #3a3a3a;
      padding-right: 6px;
      margin-right: 4px;
    }
    .tb-group:last-child { border-right: none; }
    .tb-btn {
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      color: #888;
      cursor: pointer;
      font-size: 11px;
      font-family: inherit;
      padding: 4px 7px;
      transition: color 0.1s, border-color 0.1s;
      white-space: nowrap;
      min-width: 44px;
      text-align: center;
    }
    .tb-btn:hover { color: #ccc; }
    .tb-btn.active { color: #61afef; border-bottom-color: #61afef; }
    .tb-btn.tb-icon { font-size: 14px; min-width: 30px; padding: 2px 6px; }
    .tb-btn:focus-visible { outline: 2px solid #61afef; outline-offset: 1px; border-radius: 2px; }
    .tb-label { color: #555; font-size: 10px; padding: 0 6px 0 2px; letter-spacing: 0.04em; text-transform: uppercase; }
    .tb-badge { color: #888; font-size: 10px; margin-left: auto; padding-right: 4px; letter-spacing: 0.04em; text-transform: uppercase; }

    /* ── Preview area ── */
    html, body { width: 100%; min-height: 100%; }
    body { padding-top: 36px; }

    #glance-canvas {
      min-height: calc(100vh - 36px);
      padding: 24px;
      overflow-x: auto;
      transition: background 0.15s;
    }
    #glance-canvas.theme-dark  { background: #383838; }
    #glance-canvas.theme-light { background: #e8e8e8; }
    #glance-canvas.theme-none {
      background-image: linear-gradient(45deg, #3a3a3a 25%, transparent 25%),
                        linear-gradient(-45deg, #3a3a3a 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #3a3a3a 75%),
                        linear-gradient(-45deg, transparent 75%, #3a3a3a 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
      background-color: #2a2a2a;
    }

    /* ── iframe frame ── */
    #glance-frame {
      margin: 0 auto;
      width: 100%;
      transition: width 0.2s ease;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.4), 0 4px 24px rgba(0,0,0,0.35);
    }
    #glance-frame.vp-mobile  { width: 375px; }
    #glance-frame.vp-tablet  { width: 768px; }
    #glance-frame.vp-desktop { width: 100%; box-shadow: none; }

    #glance-iframe {
      display: block;
      width: 100%;
      border: none;
      /* Starts at full viewport height; grows via postMessage from the injected reporter */
      min-height: 100vh;
    }
  </style>
</head>
<body>
  <div id="glance-toolbar" role="toolbar" aria-label="Glance preview controls">
    <div class="tb-group" role="group" aria-label="Viewport">
      <button class="tb-btn tb-icon" id="vp-mobile"  onclick="setViewport('mobile')"  title="Mobile (375px)"  aria-label="Mobile viewport"  aria-pressed="false">
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden="true"><rect x="1" y="0" width="10" height="16" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="4.5" y="13" width="3" height="1.5" rx="0.75"/></svg>
      </button>
      <button class="tb-btn tb-icon" id="vp-tablet"  onclick="setViewport('tablet')"  title="Tablet (768px)"  aria-label="Tablet viewport"  aria-pressed="false">
        <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor" aria-hidden="true"><rect x="0" y="0" width="16" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="6.5" y="11" width="3" height="1.5" rx="0.75"/></svg>
      </button>
      <button class="tb-btn tb-icon" id="vp-desktop" onclick="setViewport('desktop')" title="Desktop (full)" aria-label="Desktop viewport" aria-pressed="false">
        <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor" aria-hidden="true"><rect x="0" y="0" width="18" height="11" rx="1.5" ry="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 12 h6 M9 11 v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="tb-group" role="group" aria-label="Background">
      <span class="tb-label" aria-hidden="true">bg</span>
      <button class="tb-btn" id="th-dark"  onclick="setTheme('dark')"  aria-label="Dark background"        aria-pressed="false">dark</button>
      <button class="tb-btn" id="th-light" onclick="setTheme('light')" aria-label="Light background"       aria-pressed="false">light</button>
      <button class="tb-btn" id="th-none"  onclick="setTheme('none')"  aria-label="Transparent background" aria-pressed="false">none</button>
    </div>
    <span class="tb-badge">HTML</span>
  </div>

  <div id="glance-canvas" class="theme-dark">
    <div id="glance-frame" class="vp-desktop">
      <iframe
        id="glance-iframe"
        srcdoc="${srcdoc}"
        sandbox="allow-scripts allow-forms allow-modals allow-popups"
        title="HTML preview"
      ></iframe>
    </div>
  </div>

  <script nonce="${nonce}">
    var vscode;
    try { vscode = acquireVsCodeApi(); } catch(e) { vscode = null; }

    function loadState() {
      if (!vscode) { return { viewport: 'desktop', theme: 'dark' }; }
      return Object.assign({ viewport: 'desktop', theme: 'dark' }, vscode.getState() || {});
    }
    function saveState(patch) {
      if (!vscode) { return; }
      vscode.setState(Object.assign(loadState(), patch));
    }

    var frame = document.getElementById('glance-frame');
    function setViewport(vp) {
      frame.className = 'vp-' + vp;
      ['mobile','tablet','desktop'].forEach(function(v) {
        var btn = document.getElementById('vp-' + v);
        btn.classList.toggle('active', v === vp);
        btn.setAttribute('aria-pressed', String(v === vp));
      });
      saveState({ viewport: vp });
    }

    var canvas = document.getElementById('glance-canvas');
    function setTheme(th) {
      canvas.className = 'theme-' + th;
      ['dark','light','none'].forEach(function(t) {
        var btn = document.getElementById('th-' + t);
        btn.classList.toggle('active', t === th);
        btn.setAttribute('aria-pressed', String(t === th));
      });
      saveState({ theme: th });
    }

    (function() {
      var s = loadState();
      setViewport(s.viewport);
      setTheme(s.theme);
    })();

    document.getElementById('glance-toolbar').addEventListener('keydown', function(e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') { return; }
      var group = e.target.closest('.tb-group');
      if (!group) { return; }
      var btns = Array.prototype.slice.call(group.querySelectorAll('.tb-btn'));
      var idx = btns.indexOf(e.target);
      if (idx === -1) { return; }
      var next = e.key === 'ArrowRight' ? (idx + 1) % btns.length : (idx - 1 + btns.length) % btns.length;
      btns[next].focus();
      e.preventDefault();
    });
  </script>
</body>
</html>`;
}

/**
 * The main preview document.
 *
 * Toolbar state (viewport, theme) is persisted via vscode.getState/setState
 * so it survives webview.html reassignments across transpiles.
 */
export interface ErrorOverlay {
  message: string;
  file: string;
  line: number;
  col: number;
}

export function getPreviewHtml(
  bundleScriptUri: string,
  error?: ErrorOverlay,
  cssText?: string,
  tailwindCdn?: boolean,
  glanceProps?: Record<string, string | number | boolean>,
  isReactNative?: boolean,
): string {
  const bust = Date.now();
  const nonce = getNonce();

  const errorBar = error ? (() => {
    const safeMsg = error.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const shortFile = error.file.replace(/\\/g, '/').split('/').pop() ?? error.file;
    const loc = shortFile + (error.line ? `:${error.line}:${error.col}` : '');
    return `<div id="glance-error" class="visible">
    <div class="err-summary">
      <span class="err-label">Error</span>
      <span class="err-loc" title="${error.file}">${loc}</span>
      <span class="err-short">&#8212; ${safeMsg.split('\n')[0]}</span>
      <span class="err-chevron">&#9660;</span>
    </div>
    <div class="err-detail"><div class="err-msg">${safeMsg}</div></div>
  </div>`;
  })() : `<div id="glance-error"></div>`;

  // Build props controls for the second toolbar row
  const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  const propsRow = glanceProps && Object.keys(glanceProps).length > 0
    ? (() => {
        const controls = Object.entries(glanceProps).map(([key, val]) => {
          const type = typeof val;
          if (type === 'boolean') {
            return `<label class="tb-prop-item" title="${key}">
              <span class="tb-prop-name">${key}</span>
              <input class="tb-prop-check" type="checkbox" data-key="${key}" data-type="boolean"${val ? ' checked' : ''}/>
            </label>`;
          } else if (type === 'number') {
            return `<label class="tb-prop-item" title="${key}">
              <span class="tb-prop-name">${key}</span>
              <input class="tb-prop-input tb-prop-number" type="number" data-key="${key}" data-type="number" value="${val}"/>
            </label>`;
          } else if (HEX_RE.test(String(val))) {
            const safe = String(val).replace(/"/g, '&quot;');
            return `<label class="tb-prop-item tb-prop-color-item" title="${key}">
              <span class="tb-prop-name">${key}</span>
              <input class="tb-prop-color" type="color" data-key="${key}" data-type="string" value="${safe}"/>
            </label>`;
          } else {
            const safe = String(val).replace(/"/g, '&quot;');
            return `<label class="tb-prop-item" title="${key}">
              <span class="tb-prop-name">${key}</span>
              <input class="tb-prop-input tb-prop-text" type="text" data-key="${key}" data-type="string" value="${safe}"/>
            </label>`;
          }
        }).join('');
        return `<div id="glance-props-bar">
          <span class="tb-label">props</span>
          <div class="tb-props-controls">${controls}</div>
        </div>`;
      })()
    : '';

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  ${tailwindCdn ? `<script src="https://cdn.tailwindcss.com"></script>` : ''}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Toolbar ── */
    #glance-toolbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 36px;
      background: #2d2d2d;
      border-bottom: 2px solid #111;
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 0 10px;
      z-index: 9998;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 11px;
      user-select: none;
    }
    .tb-group {
      display: flex;
      align-items: center;
      gap: 1px;
      border-right: 1px solid #3a3a3a;
      padding-right: 6px;
      margin-right: 4px;
    }
    .tb-group:last-child { border-right: none; }
    .tb-btn {
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      color: #888;
      cursor: pointer;
      font-size: 11px;
      font-family: inherit;
      padding: 4px 7px;
      transition: color 0.1s, border-color 0.1s;
      white-space: nowrap;
      min-width: 44px;
      text-align: center;
    }
    .tb-btn:hover { color: #ccc; }
    .tb-btn.active { color: #61afef; border-bottom-color: #61afef; }
    .tb-btn.tb-icon { font-size: 14px; min-width: 30px; padding: 2px 6px; }
    .tb-btn:focus-visible { outline: 2px solid #61afef; outline-offset: 1px; border-radius: 2px; }
    .tb-label { color: #555; font-size: 10px; padding: 0 6px 0 2px; letter-spacing: 0.04em; text-transform: uppercase; }
    .tb-badge { color: #888; font-size: 10px; margin-left: auto; padding-right: 4px; letter-spacing: 0.04em; text-transform: uppercase; }

    /* ── Props row (second toolbar bar) ── */
    #glance-props-bar {
      position: fixed;
      top: 36px; left: 0; right: 0;
      min-height: 30px;
      background: #272727;
      border-bottom: 1px solid #1a1a1a;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 10px;
      z-index: 9997;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 11px;
      user-select: none;
      flex-wrap: wrap;
    }
    .tb-props-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .tb-prop-item { display: flex; align-items: center; gap: 5px; cursor: pointer; }
    .tb-prop-name { color: #999; font-size: 11px; font-family: 'Segoe UI', system-ui, sans-serif; }
    .tb-prop-input {
      background: #1e1e1e;
      border: 1px solid #3a3a3a;
      border-radius: 3px;
      color: #ccc;
      font-size: 11px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      height: 22px;
      padding: 0 6px;
      outline: none;
      transition: border-color 0.1s;
    }
    .tb-prop-input:focus { border-color: #61afef; }
    .tb-prop-text   { width: 100px; }
    .tb-prop-number { width: 56px; }
    .tb-prop-check  { accent-color: #61afef; width: 13px; height: 13px; cursor: pointer; margin: 0; }
    .tb-prop-color  { width: 28px; height: 22px; padding: 1px; border: 1px solid #3a3a3a; border-radius: 3px; background: #1e1e1e; cursor: pointer; outline: none; }
    .tb-prop-color:focus { border-color: #61afef; }

    /* ── Preview area ── */
    html, body { width: 100%; min-height: 100%; }
    body { padding-top: ${propsRow ? '66px' : '36px'}; }

    #glance-canvas {
      min-height: calc(100vh - ${propsRow ? '66px' : '36px'});
      padding: 24px;
      overflow-x: auto;
      transition: background 0.15s;
    }
    /* Themes */
    #glance-canvas.theme-dark  { background: #383838; }
    #glance-canvas.theme-light { background: #e8e8e8; }
    #glance-canvas.theme-none {
      background-image: linear-gradient(45deg, #3a3a3a 25%, transparent 25%),
                        linear-gradient(-45deg, #3a3a3a 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #3a3a3a 75%),
                        linear-gradient(-45deg, transparent 75%, #3a3a3a 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
      background-color: #2a2a2a;
    }

    /* Viewport frames */
    #glance-frame {
      margin: 0 auto;
      width: 100%;
      transition: width 0.2s ease;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.4), 0 4px 24px rgba(0,0,0,0.35);
    }
    #glance-frame.vp-mobile  { width: 375px; }
    #glance-frame.vp-tablet  { width: 768px; }
    #glance-frame.vp-desktop { width: 100%; box-shadow: none; }

    #root { color: #ccc; }

    /* ── Error bar ── */
    #glance-error {
      display: none;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      background: #2a1111;
      border-top: 2px solid #c72e2e;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      z-index: 9999;
      cursor: pointer;
      user-select: none;
    }
    #glance-error.visible { display: block; }
    #glance-error .err-summary {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 16px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #glance-error .err-label { color: #e06c75; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }
    #glance-error .err-loc { color: #666; font-size: 11px; font-family: monospace; flex-shrink: 0; }
    #glance-error .err-short { color: #ddd; font-family: monospace; overflow: hidden; text-overflow: ellipsis; }
    #glance-error .err-chevron { color: #555; font-size: 10px; margin-left: auto; flex-shrink: 0; transition: transform 0.15s; }
    #glance-error.expanded .err-chevron { transform: rotate(180deg); }
    #glance-error .err-detail { display: none; padding: 8px 16px 12px; border-top: 1px solid #3a1a1a; max-height: 30vh; overflow-y: auto; cursor: auto; }
    #glance-error.expanded .err-detail { display: block; }
    #glance-error .err-msg { color: #ddd; font-family: monospace; font-size: 13px; white-space: pre-wrap; word-break: break-word; line-height: 1.5; }
  </style>
  ${isReactNative ? `<style>
    /* React Native Web root reset — mirrors RN's default flex-column layout.
       Width:100% ensures the root View fills the container (RNW uses flex by default).
       min-height fills the visible area below the toolbar without overriding body padding. */
    #root { display: flex; flex-direction: column; width: 100%; min-height: calc(100vh - ${propsRow ? '66px' : '36px'}); }
  </style>` : ''}
  ${cssText ? `<style>${cssText}</style>` : ''}
</head>
<body>
  <div id="glance-toolbar" role="toolbar" aria-label="Glance preview controls">
    <div class="tb-group" role="group" aria-label="Viewport">
      <button class="tb-btn tb-icon" id="vp-mobile"  onclick="setViewport('mobile')"  title="Mobile (375px)"  aria-label="Mobile viewport" aria-pressed="false">
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden="true"><rect x="1" y="0" width="10" height="16" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="4.5" y="13" width="3" height="1.5" rx="0.75"/></svg>
      </button>
      <button class="tb-btn tb-icon" id="vp-tablet"  onclick="setViewport('tablet')"  title="Tablet (768px)"  aria-label="Tablet viewport"  aria-pressed="false">
        <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor" aria-hidden="true"><rect x="0" y="0" width="16" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="6.5" y="11" width="3" height="1.5" rx="0.75"/></svg>
      </button>
      <button class="tb-btn tb-icon" id="vp-desktop" onclick="setViewport('desktop')" title="Desktop (full)" aria-label="Desktop viewport" aria-pressed="false">
        <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor" aria-hidden="true"><rect x="0" y="0" width="18" height="11" rx="1.5" ry="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 12 h6 M9 11 v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="tb-group" role="group" aria-label="Background">
      <span class="tb-label" aria-hidden="true">bg</span>
      <button class="tb-btn" id="th-dark"  onclick="setTheme('dark')"  aria-label="Dark background"        aria-pressed="false">dark</button>
      <button class="tb-btn" id="th-light" onclick="setTheme('light')" aria-label="Light background"       aria-pressed="false">light</button>
      <button class="tb-btn" id="th-none"  onclick="setTheme('none')"  aria-label="Transparent background" aria-pressed="false">none</button>
    </div>
    ${isReactNative ? `<span class="tb-badge">RN</span>` : ''}
  </div>
  ${propsRow}

  <div id="glance-canvas" class="theme-dark">
    <div id="glance-frame" class="vp-desktop">
      <div id="root"></div>
    </div>
  </div>

  ${errorBar}

  <script nonce="${nonce}">
    // ── VS Code state persistence ──
    var vscode;
    try { vscode = acquireVsCodeApi(); } catch(e) { vscode = null; }

    function loadState() {
      if (!vscode) { return { viewport: 'desktop', theme: 'dark' }; }
      return Object.assign({ viewport: 'desktop', theme: 'dark' }, vscode.getState() || {});
    }
    function saveState(patch) {
      if (!vscode) { return; }
      vscode.setState(Object.assign(loadState(), patch));
    }

    // ── Viewport ──
    var frame = document.getElementById('glance-frame');
    function setViewport(vp) {
      frame.className = 'vp-' + vp;
      ['mobile','tablet','desktop'].forEach(function(v) {
        var btn = document.getElementById('vp-' + v);
        btn.classList.toggle('active', v === vp);
        btn.setAttribute('aria-pressed', String(v === vp));
      });
      saveState({ viewport: vp });
    }

    // ── Theme ──
    var canvas = document.getElementById('glance-canvas');
    function setTheme(th) {
      canvas.className = 'theme-' + th;
      ['dark','light','none'].forEach(function(t) {
        var btn = document.getElementById('th-' + t);
        btn.classList.toggle('active', t === th);
        btn.setAttribute('aria-pressed', String(t === th));
      });
      saveState({ theme: th });
    }

    // ── Restore persisted state on load ──
    (function() {
      var s = loadState();
      setViewport(s.viewport);
      setTheme(s.theme);
    })();

    // ── Arrow key navigation within toolbar groups ──
    document.getElementById('glance-toolbar').addEventListener('keydown', function(e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') { return; }
      var group = e.target.closest('.tb-group');
      if (!group) { return; }
      var btns = Array.prototype.slice.call(group.querySelectorAll('.tb-btn'));
      var idx = btns.indexOf(e.target);
      if (idx === -1) { return; }
      var next = e.key === 'ArrowRight' ? (idx + 1) % btns.length : (idx - 1 + btns.length) % btns.length;
      btns[next].focus();
      e.preventDefault();
    });

    // ── Error bar expand/collapse ──
    var errEl = document.getElementById('glance-error');
    if (errEl) {
      errEl.addEventListener('click', function() {
        errEl.classList.toggle('expanded');
      });
    }

    // ── Props controls ──
    function readProps() {
      var props = {};
      document.querySelectorAll('[data-key]').forEach(function(el) {
        var key = el.getAttribute('data-key');
        var type = el.getAttribute('data-type');
        if (type === 'boolean') {
          props[key] = el.checked;
        } else if (type === 'number') {
          props[key] = Number(el.value);
        } else {
          props[key] = el.value;
        }
      });
      return props;
    }

    function applyProps() {
      var props = readProps();
      saveState({ props: props });
      if (window.__glance_render__) {
        window.__glance_render__(props);
      }
    }

    // Restore persisted prop values if they match the current prop keys
    (function restoreProps() {
      var saved = loadState().props;
      if (!saved) { return; }
      document.querySelectorAll('[data-key]').forEach(function(el) {
        var key = el.getAttribute('data-key');
        if (!(key in saved)) { return; }
        var type = el.getAttribute('data-type');
        if (type === 'boolean') { el.checked = !!saved[key]; }
        else { el.value = String(saved[key]); }
      });
      // Apply restored props to component
      applyProps();
    })();

    document.querySelectorAll('[data-key]').forEach(function(el) {
      el.addEventListener('input', applyProps);
      el.addEventListener('change', applyProps);
    });
  </script>

  ${bundleScriptUri ? `<script nonce="${nonce}" src="${bundleScriptUri}?v=${bust}"></script>` : ''}
</body>
</html>`;
}
