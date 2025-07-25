import * as vscode from 'vscode';
import * as path from 'path';

import {
  LanguageClient,
  TransportKind
} from 'vscode-languageclient/node';
import type {
  LanguageClientOptions,
  ServerOptions
} from 'vscode-languageclient/node';

import { buildSpec } from './commands/buildSpec';
import { previewSpec } from './commands/previewSpec';
import { selectPython } from './commands/selectPython';
import { selectBikeshed } from './commands/selectBikeshed';
import { activateDiagnostics, deactivateDiagnostics } from './utils/diagnostics';
import { registerCompletions } from './language/completionProvider';
import { BikeshedHoverProvider } from './language/hoverProvider';
import { initLivePreview, disposeLivePreview } from './preview/previewManager';
import { resolveBikeshed } from './utils/resolveBikeshed';
import { getPythonPath } from './utils/pythonPath';

let outputChannel: vscode.OutputChannel;
let client: LanguageClient;

/* ───────────────────────────── */
/*  Extension activation         */
/* ───────────────────────────── */
export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Bikeshed Tools');
  outputChannel.appendLine('🔌 Activating Bikeshed Tools extension…');

  try {
    /* 1 · Python */
    const python = getPythonPath(outputChannel);
    if (!python) {
      const pick = await vscode.window.showWarningMessage(
        'Python not found. Select Python interpreter?',
        'Select',
        'Ignore'
      );
      if (pick === 'Select') {
        await selectPython();
      }
    }

    /* 2 · Bikeshed */
    const bikeshed = await resolveBikeshed();
    if (bikeshed) {
      await vscode.workspace
        .getConfiguration('bikeshedTools')
        .update('bikeshedPath', bikeshed, vscode.ConfigurationTarget.Workspace);
      outputChannel.appendLine(`✅ Bikeshed CLI resolved to: ${bikeshed}`);
    } else {
      const choice = await vscode.window.showWarningMessage(
        'Bikeshed executable not found. Preview & build commands will fail until one is configured.',
        'Select Binary…',
        'Ignore'
      );
      if (choice === 'Select Binary…') {
        await selectBikeshed();
      }
    }

    /* 3 · Commands */
    context.subscriptions.push(
      vscode.commands.registerCommand('bikeshedTools.buildSpec', () =>
        buildSpec(outputChannel)
      ),
      vscode.commands.registerCommand('bikeshedTools.previewSpec', () =>
        previewSpec(outputChannel)
      ),
      vscode.commands.registerCommand('bikeshedTools.selectPython', selectPython),
      vscode.commands.registerCommand('bikeshedTools.selectBikeshed', selectBikeshed)
    );

    /* 4 · Language goodies */
    context.subscriptions.push(registerCompletions());
    activateDiagnostics(context, outputChannel);
    initLivePreview(context, outputChannel);
    context.subscriptions.push(
        vscode.languages.registerHoverProvider('bikeshed', new BikeshedHoverProvider())
      );

    /* 5 · Language server */
    const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));

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

    await client.start();
    context.subscriptions.push({ dispose: () => client.stop() });

    outputChannel.appendLine('🚀 Bikeshed Tools extension activated.');
  } catch (err) {
    const msg = `💥 Failed to activate Bikeshed Tools: ${
      err instanceof Error ? err.message : String(err)
    }`;
    outputChannel.appendLine(`[ERROR] ${msg}`);
    vscode.window.showErrorMessage(msg);
  }
}

/* ───────────────────────────── */
export function deactivate() {
  outputChannel?.appendLine('🔌 Deactivating Bikeshed Tools extension…');
  outputChannel?.dispose();
  deactivateDiagnostics?.();
  disposeLivePreview?.();
  client?.stop();
}
