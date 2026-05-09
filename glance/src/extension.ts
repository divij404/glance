import * as vscode from 'vscode';
import { openPreview } from './commands/openPreview';
import { closePreview } from './commands/closePreview';
import { PanePanel } from './panel/PanePanel';

export function activate(context: vscode.ExtensionContext): void {
  // Show a one-time welcome notification on first install
  const welcomed = context.globalState.get<boolean>('pane.welcomed');
  if (!welcomed) {
    vscode.window.showInformationMessage(
      "Pane installed. Open any .jsx or .tsx file and press Ctrl+Alt+P (Cmd+Alt+P on Mac) to start previewing.",
    );
    context.globalState.update('pane.welcomed', true);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('pane.openPreview', () =>
      openPreview(context),
    ),
    vscode.commands.registerCommand('pane.closePreview', () =>
      closePreview(),
    ),
  );
}

export function deactivate(): void {
  PanePanel.disposeAll();
}
