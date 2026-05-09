import * as vscode from 'vscode';
import { GlancePanel } from '../panel/GlancePanel';

export function closePreview(): void {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    GlancePanel.closeForFile(editor.document.uri);
  }
}
