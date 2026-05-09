// Typed message protocol between extension host ↔ WebView

export type ExtToWebview =
  | { type: 'UPDATE'; code: string; timestamp: number }
  | { type: 'TRANSPILE_ERROR'; message: string; file: string; line: number; col: number }
  | { type: 'LOADING' }
  | { type: 'SET_THEME'; theme: 'light' | 'dark' };

export type WebviewToExt =
  | { type: 'RUNTIME_ERROR'; message: string; stack: string }
  | { type: 'READY' }
  | { type: 'VIEWPORT_CHANGE'; width: number }
  | { type: 'REFRESH_REQUEST' };
