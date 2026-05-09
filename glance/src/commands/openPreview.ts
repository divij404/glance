import * as vscode from 'vscode';
import { PanePanel } from '../panel/PanePanel';

export async function openPreview(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage('Pane: No active editor found.');
    return;
  }

  const { languageId, uri } = editor.document;
  if (languageId !== 'javascriptreact' && languageId !== 'typescriptreact') {
    vscode.window.showWarningMessage(
      'Pane: Preview is only available for .jsx and .tsx files.',
    );
    return;
  }

  PanePanel.openOrReveal(uri, context.extensionUri);
}
