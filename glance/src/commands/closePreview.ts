import * as vscode from 'vscode';
import { PanePanel } from '../panel/PanePanel';

export function closePreview(): void {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    PanePanel.closeForFile(editor.document.uri);
  }
}
