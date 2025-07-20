import * as vscode from 'vscode';
import { buildSpec } from './commands/buildSpec';
import { previewSpec } from './commands/previewSpec';
import { activateDiagnostics } from './utils/diagnostics';
import { BikeshedHoverProvider } from './language/hoverProvider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('bikeshedTools.buildSpec', buildSpec),
    vscode.commands.registerCommand('bikeshedTools.previewSpec', previewSpec),
    vscode.languages.registerHoverProvider('bikeshed', new BikeshedHoverProvider())
  );

  activateDiagnostics(context);
}

export function deactivate() {}
