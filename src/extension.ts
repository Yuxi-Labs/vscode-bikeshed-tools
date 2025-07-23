import * as path from 'path';
import * as vscode from 'vscode';

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
import { activateDiagnostics, deactivateDiagnostics } from './utils/diagnostics';
import { registerCompletions } from './language/completionProvider';
import { initLivePreview, disposeLivePreview } from './preview/previewManager';
import { resolveBikeshed } from './utils/resolveBikeshed';          // ← NEW

let outputChannel: vscode.OutputChannel;
let client: LanguageClient;

/* ──────────────────────────────────────────────────────────────── */
/* Helper — persist user-chosen executables                         */
/* ──────────────────────────────────────────────────────────────── */
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
    vscode.window.showInformationMessage(
      `${dialogTitle} set to ${pick[0].fsPath}`
    );
  }
}

/* ──────────────────────────────────────────────────────────────── */
/* Activation                                                      */
/* ──────────────────────────────────────────────────────────────── */
export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Bikeshed Tools');
  outputChannel.appendLine('Activating Bikeshed Tools extension…');

  try {
    /* ── 1.  Ensure we can run the Bikeshed CLI ────────────────── */
    const bikeshedExe = await resolveBikeshed();
    if (!bikeshedExe) {
      const choice = await vscode.window.showWarningMessage(
        'Bikeshed executable not found. Preview & build commands will fail until one is configured.',
        'Select Binary…',
        'Ignore'
      );
      if (choice === 'Select Binary…') {
        await vscode.commands.executeCommand('bikeshedTools.selectBikeshed');
      }
    }

    /* ── 2. Commands ───────────────────────────────────────────── */
    context.subscriptions.push(
      vscode.commands.registerCommand('bikeshedTools.buildSpec', () =>
        buildSpec(outputChannel)
      ),
      vscode.commands.registerCommand('bikeshedTools.previewSpec', () =>
        previewSpec(outputChannel)
      ),
      vscode.commands.registerCommand('bikeshedTools.selectPython', () =>
        selectExecutable('pythonPath', 'Select Python Interpreter')
      ),
      vscode.commands.registerCommand('bikeshedTools.selectBikeshed', () =>
        selectExecutable('bikeshedPath', 'Select Bikeshed CLI')
      )
    );

    /* ── 3. IntelliSense (completion only – hover via LSP) ─────── */
    context.subscriptions.push(registerCompletions());

    /* ── 4. Diagnostics & live preview ─────────────────────────── */
    activateDiagnostics(context, outputChannel);
    initLivePreview(context, outputChannel);

    /* ── 5. Language-Server Client ─────────────────────────────── */
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

    await client.start();                 // start & await so errors surface
    context.subscriptions.push({ dispose: () => client.stop() });

    outputChannel.appendLine('Bikeshed Tools extension activated.');
  } catch (err) {
    const msg = `Failed to activate Bikeshed Tools: ${
      err instanceof Error ? err.message : String(err)
    }`;
    outputChannel.appendLine(`[ERROR] ${msg}`);
    vscode.window.showErrorMessage(msg);
  }
}

/* ──────────────────────────────────────────────────────────────── */
/* Deactivation                                                    */
/* ──────────────────────────────────────────────────────────────── */
export function deactivate() {
  outputChannel?.appendLine('Deactivating Bikeshed Tools extension…');
  outputChannel?.dispose();
  deactivateDiagnostics?.();
  disposeLivePreview?.();
  client?.stop();
}
