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
import { findDeps } from './utils/dependencies';

let outputChannel: vscode.OutputChannel;
let client: LanguageClient;

/* ───────────────────────────── */
/*  Extension activation         */
/* ───────────────────────────── */
export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Bikeshed Tools');
  outputChannel.appendLine('🔌 Activating Bikeshed Tools extension…');

  try {
    /* 1 · Auto‑detect Python & Bikeshed */
    const { python, bikeshed } = await findDeps();
    const cfg = vscode.workspace.getConfiguration('bikeshedTools');

    /* 1a · Python */
    if (!python) {
      const pick = await vscode.window.showWarningMessage(
        'Python interpreter not found. Select one?',
        'Select',
        'Ignore'
      );
      if (pick === 'Select') await selectPython();
    } else {
      await cfg.update('pythonPath', python, vscode.ConfigurationTarget.Workspace);
      outputChannel.appendLine(`✅ Python resolved to: ${python}`);
    }

    /* 1b · Bikeshed */
    if (!bikeshed) {
      const choice = await vscode.window.showWarningMessage(
        'Bikeshed executable not found. Preview & build commands will fail until one is configured.',
        'Select Binary…',
        'Ignore'
      );
      if (choice === 'Select Binary…') await selectBikeshed();
    } else if (bikeshed !== python) { // only save when it is a standalone CLI path
      await cfg.update('bikeshedPath', bikeshed, vscode.ConfigurationTarget.Workspace);
      outputChannel.appendLine(`✅ Bikeshed CLI resolved to: ${bikeshed}`);
    } else {
      outputChannel.appendLine('ℹ️  Will invoke Bikeshed via "python -m bikeshed"');
    }

    /* 2 · Commands */
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

    /* 3 · Language goodies */
    context.subscriptions.push(registerCompletions());
    activateDiagnostics(context, outputChannel);
    initLivePreview(context, outputChannel);
    context.subscriptions.push(
      vscode.languages.registerHoverProvider('bikeshed', new BikeshedHoverProvider())
    );

    /* 4 · Language server */
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
