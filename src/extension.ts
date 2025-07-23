import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';

import { buildSpec } from './commands/buildSpec';
import { previewSpec } from './commands/previewSpec';
import { activateDiagnostics, deactivateDiagnostics } from './utils/diagnostics';
import { registerCompletions } from './language/hoverProvider'; // completions only
import { initLivePreview, disposeLivePreview } from './preview/previewManager';

let outputChannel: vscode.OutputChannel;
let client: LanguageClient;

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Helper: choose an executable and persist to settings                       */
/* ──────────────────────────────────────────────────────────────────────────── */
async function selectExecutable(cfgKey: string, dialogTitle: string) {
  const pick = await vscode.window.showOpenDialog({
    title: dialogTitle,
    canSelectMany: false,
    canSelectFolders: false,
    canSelectFiles: true,
    filters:
      process.platform === 'win32'
        ? { Executable: ['exe', 'bat', 'cmd'] }
        : undefined
  });
  if (pick?.length) {
    await vscode.workspace
      .getConfiguration('bikeshedTools')
      .update(cfgKey, pick[0].fsPath, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(`${dialogTitle} set to ${pick[0].fsPath}`);
  }
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Extension activation                                                       */
/* ──────────────────────────────────────────────────────────────────────────── */
export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Bikeshed Tools');
  outputChannel.appendLine('Activating Bikeshed Tools extension...');

  try {
    /* Commands */
    context.subscriptions.push(
      vscode.commands.registerCommand('bikeshedTools.buildSpec', () => buildSpec(outputChannel)),
      vscode.commands.registerCommand('bikeshedTools.previewSpec', () => previewSpec(outputChannel)),
      vscode.commands.registerCommand('bikeshedTools.selectPython', () =>
        selectExecutable('pythonPath', 'Select Python Interpreter')
      ),
      vscode.commands.registerCommand('bikeshedTools.selectBikeshed', () =>
        selectExecutable('bikeshedPath', 'Select Bikeshed CLI')
      )
    );

    /* IntelliSense (completion only – hover is served by the language server) */
    context.subscriptions.push(registerCompletions());

    /* Diagnostics + live preview */
    activateDiagnostics(context, outputChannel);
    initLivePreview(context, outputChannel);

    /* ─────────────────────────────── */
    /*  Language Server (LSP client)   */
    /* ─────────────────────────────── */
    const serverModule = context.asAbsolutePath(path.join('dist', 'server.cjs'));
    const serverOptions: ServerOptions = {
      run:   { module: serverModule, transport: TransportKind.ipc },
      debug: { module: serverModule, transport: TransportKind.ipc }
    };
    const clientOptions: LanguageClientOptions = {
      documentSelector: [{ scheme: 'file', language: 'bikeshed' }]
    };

    client = new LanguageClient(
      'bikeshedLS',
      'Bikeshed Language Server',
      serverOptions,
      clientOptions
    );
    context.subscriptions.push(client.start());

    outputChannel.appendLine('Bikeshed Tools extension activated successfully.');
  } catch (err) {
    const msg = `Failed to activate Bikeshed Tools: ${
      err instanceof Error ? err.message : String(err)
    }`;
    outputChannel.appendLine(`[ERROR] ${msg}`);
    vscode.window.showErrorMessage(msg);
  }
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Deactivation cleanup                                                       */
/* ──────────────────────────────────────────────────────────────────────────── */
export function deactivate() {
  outputChannel?.appendLine('Deactivating Bikeshed Tools extension...');
  outputChannel?.dispose();
  deactivateDiagnostics?.();
  disposeLivePreview?.();
  client?.stop();
}
