import * as vscode from 'vscode';
import { openPreview } from './commands/openPreview';
import { closePreview } from './commands/closePreview';
import { GlancePanel } from './panel/GlancePanel';

export function activate(context: vscode.ExtensionContext): void {
  // Show a one-time welcome notification on first install
  const welcomed = context.globalState.get<boolean>('glance.welcomed');
  if (!welcomed) {
    vscode.window.showInformationMessage(
      "Glance installed. Open any .jsx or .tsx file and press Ctrl+Alt+P (Cmd+Alt+P on Mac) to start previewing.",
    );
    context.globalState.update('glance.welcomed', true);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('glance.openPreview', () =>
      openPreview(context),
    ),
    vscode.commands.registerCommand('glance.closePreview', () =>
      closePreview(),
    ),
  );
}

export function deactivate(): void {
  GlancePanel.disposeAll();
}
