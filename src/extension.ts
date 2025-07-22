import * as vscode from 'vscode';
import { buildSpec } from './commands/buildSpec';
import { previewSpec } from './commands/previewSpec';
import { activateDiagnostics, deactivateDiagnostics } from './utils/diagnostics';
import { BikeshedHoverProvider } from './language/hoverProvider';
import { initLivePreview, disposeLivePreview } from './preview/previewManager';

let outputChannel: vscode.OutputChannel;

/**
 * Called when the extension is activated.
 * @param context VS Code extension context
 */
export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Bikeshed Tools');
  outputChannel.appendLine('Activating Bikeshed Tools extension...');

  try {
    // Register build and preview commands
    context.subscriptions.push(
      vscode.commands.registerCommand('bikeshedTools.buildSpec', () => buildSpec(outputChannel)),
      vscode.commands.registerCommand('bikeshedTools.previewSpec', () => previewSpec(outputChannel))
    );

    // Register hover provider
    context.subscriptions.push(
      vscode.languages.registerHoverProvider('bikeshed', new BikeshedHoverProvider())
    );

    // Enable diagnostics and live preview
    activateDiagnostics(context, outputChannel);
    initLivePreview(context, outputChannel);

    outputChannel.appendLine('Bikeshed Tools extension activated successfully.');
    vscode.window.showInformationMessage('Bikeshed Tools is now active.');
  } catch (err) {
    const message = `Failed to activate Bikeshed Tools: ${err instanceof Error ? err.message : String(err)}`;
    outputChannel.appendLine(`[ERROR] ${message}`);
    vscode.window.showErrorMessage(message);
  }
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate() {
  if (outputChannel) {
    outputChannel.appendLine('Deactivating Bikeshed Tools extension...');
    outputChannel.dispose();
  }

  deactivateDiagnostics?.();
  disposeLivePreview?.();
}
