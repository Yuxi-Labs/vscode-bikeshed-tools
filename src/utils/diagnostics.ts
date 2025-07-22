import * as vscode from 'vscode';

let collection: vscode.DiagnosticCollection;

/**
 * Activates diagnostics for Bikeshed files.
 * @param context VS Code extension context
 * @param output Optional output channel for logging
 */
export function activateDiagnostics(
  context: vscode.ExtensionContext,
  output?: vscode.OutputChannel
) {
  collection = vscode.languages.createDiagnosticCollection('bikeshed');
  context.subscriptions.push(collection);

  output?.appendLine('Initializing Bikeshed diagnostics...');

  // Initial run
  if (vscode.window.activeTextEditor) {
    updateDiagnostics(vscode.window.activeTextEditor.document, output);
  }

  // Listen for changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => updateDiagnostics(e.document, output)),
    vscode.workspace.onDidOpenTextDocument(doc => updateDiagnostics(doc, output)),
    vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri))
  );
}

/**
 * Deactivates diagnostics and clears the collection.
 */
export function deactivateDiagnostics() {
  collection?.clear();
  collection?.dispose();
}

/**
 * Runs diagnostics on a given document.
 */
function updateDiagnostics(document: vscode.TextDocument, output?: vscode.OutputChannel): void {
  if (document.languageId !== 'bikeshed' && !document.fileName.endsWith('.bs')) {
    return;
  }

  const diagnostics: vscode.Diagnostic[] = [];

  const lines = document.getText().split(/\r?\n/);
  lines.forEach((line, index) => {
    // Example diagnostic: detect use of TODO comments
    const todoIndex = line.indexOf('TODO');
    if (todoIndex !== -1) {
      const range = new vscode.Range(
        new vscode.Position(index, todoIndex),
        new vscode.Position(index, todoIndex + 4)
      );
      const diagnostic = new vscode.Diagnostic(
        range,
        'TODO found — please complete this section.',
        vscode.DiagnosticSeverity.Warning
      );
      diagnostics.push(diagnostic);
    }
  });

  collection.set(document.uri, diagnostics);
  output?.appendLine(`Diagnostics updated for ${document.uri.fsPath} (${diagnostics.length} issues)`);
}
