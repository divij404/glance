import * as vscode from 'vscode';
import { GlancePanel } from '../panel/GlancePanel';

export async function openPreview(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage('Glance: No active editor found.');
    return;
  }

  const { languageId, uri } = editor.document;
  if (languageId !== 'javascriptreact' && languageId !== 'typescriptreact' && languageId !== 'html') {
    vscode.window.showWarningMessage(
      'Glance: Preview is only available for .jsx, .tsx, and .html files.',
    );
    return;
  }

  GlancePanel.openOrReveal(uri, context.extensionUri);
}
