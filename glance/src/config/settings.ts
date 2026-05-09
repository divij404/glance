import * as vscode from 'vscode';

export interface PaneSettings {
  refreshMode: 'save' | 'live';
  liveDebounceMs: number;
  defaultViewport: 'mobile' | 'tablet' | 'desktop';
  defaultTheme: 'light' | 'dark' | 'system';
}

export function getSettings(): PaneSettings {
  const cfg = vscode.workspace.getConfiguration('pane');
  return {
    refreshMode: cfg.get<'save' | 'live'>('refreshMode', 'save'),
    liveDebounceMs: cfg.get<number>('liveDebounceMs', 400),
    defaultViewport: cfg.get<'mobile' | 'tablet' | 'desktop'>('defaultViewport', 'desktop'),
    defaultTheme: cfg.get<'light' | 'dark' | 'system'>('defaultTheme', 'dark'),
  };
}
