import * as vscode from 'vscode';

let collection: vscode.DiagnosticCollection;

export function activateDiagnostics(context: vscode.ExtensionContext) {
  collection = vscode.languages.createDiagnosticCollection('bikeshed');
  context.subscriptions.push(collection);

  if (vscode.window.activeTextEditor) {
    updateDiagnostics(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => updateDiagnostics(e.document)),
    vscode.workspace.onDidOpenTextDocument(updateDiagnostics),
    vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri))
  );
}

function updateDiagnostics(document: vscode.TextDocument): void {
  if (document.languageId !== 'plaintext' || !document.fileName.endsWith('.bs')) {
    return;
  }

  const diagnostics: vscode.Diagnostic[] = [];

  const text = document.getText();
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const index = lines[i].indexOf('TODO');
    if (index !== -1) {
      diagnostics.push({
        severity: vscode.DiagnosticSeverity.Warning,
        message: 'Unresolved TODO',
        range: new vscode.Range(i, index, i, index + 4),
        source: 'bikeshedTools'
      });
    }
  }

  collection.set(document.uri, diagnostics);
}
