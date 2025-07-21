import * as vscode from 'vscode';
import { buildSpec } from './commands/buildSpec';
import { previewSpec } from './commands/previewSpec';
import { activateDiagnostics } from './utils/diagnostics';
import { BikeshedHoverProvider } from './language/hoverProvider';
import { initLivePreview } from './preview/previewManager';

export function activate(context: vscode.ExtensionContext) {
  // Register build and preview commands
  context.subscriptions.push(
    vscode.commands.registerCommand('bikeshedTools.buildSpec', buildSpec),
    vscode.commands.registerCommand('bikeshedTools.previewSpec', previewSpec)
  );

  // Register hover provider for Bikeshed files
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('bikeshed', new BikeshedHoverProvider())
  );

  // Enable diagnostics and live preview
  activateDiagnostics(context);
  initLivePreview(context);

  vscode.window.showInformationMessage('Bikeshed Tools extension activated.');
}

export function deactivate() {
  // Currently no cleanup required
}
