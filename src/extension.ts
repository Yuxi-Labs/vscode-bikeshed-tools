import * as vscode from 'vscode';
import { buildSpec } from './commands/buildSpec';
import { previewSpec } from './commands/previewSpec';
import { activateDiagnostics } from './utils/diagnostics';
import { BikeshedHoverProvider } from './language/hoverProvider';
import { initLivePreview } from './preview/previewManager';

export function activate(context: vscode.ExtensionContext) {
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('bikeshedTools.buildSpec', buildSpec),
    vscode.commands.registerCommand('bikeshedTools.previewSpec', previewSpec)
  );

  // Register hover provider
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('bikeshed', new BikeshedHoverProvider())
  );

  // Activate diagnostics and live preview (conditionally)
  activateDiagnostics(context);
  initLivePreview(context);

  vscode.window.showInformationMessage('🛠️ Bikeshed Tools activated');
}

export function deactivate() {
  // Clean up if needed later. Right now, we just silently stop caring.
}
