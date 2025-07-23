import * as vscode from 'vscode';

let collection: vscode.DiagnosticCollection;

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Metadata expectations                                                      */
/* ──────────────────────────────────────────────────────────────────────────── */

// Keys Bikeshed absolutely requires for a valid spec.
const mandatoryKeys = ['title', 'shortname', 'status'];
// Keys we explicitly recognise so we don’t flag them as “unknown”.
const knownKeys = new Set([
  ...mandatoryKeys,
  'level',
  'url',
  'latest',
  'ed',
  'previous',
  'editor',
  'abstract',
  'boilerplate',
  'inlinejson',
  'repository',
  'feedback'
]);

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Public activation helpers                                                  */
/* ──────────────────────────────────────────────────────────────────────────── */

export function activateDiagnostics(
  context: vscode.ExtensionContext,
  output?: vscode.OutputChannel
) {
  collection = vscode.languages.createDiagnosticCollection('bikeshed');
  context.subscriptions.push(collection);

  const log = output ?? vscode.window.createOutputChannel('Bikeshed Diagnostics');

  const update = (doc: vscode.TextDocument) => updateDiagnostics(doc, log);

  if (vscode.window.activeTextEditor) update(vscode.window.activeTextEditor.document);

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => update(e.document)),
    vscode.workspace.onDidOpenTextDocument(update),
    vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri))
  );

  log.appendLine('Bikeshed diagnostics activated.');
}

export function deactivateDiagnostics() {
  collection?.clear();
  collection?.dispose();
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Core logic                                                                 */
/* ──────────────────────────────────────────────────────────────────────────── */

function updateDiagnostics(document: vscode.TextDocument, log: vscode.OutputChannel): void {
  if (document.languageId !== 'bikeshed' && !document.fileName.endsWith('.bs')) return;

  const diags: vscode.Diagnostic[] = [];

  let insideMeta = false;
  const seenKeys = new Set<string>();

  document.getText().split(/\r?\n/).forEach((line, lineNo) => {
    if (/^<pre\s+class=['"]metadata['"]>/i.test(line)) {
      insideMeta = true;
      return;
    }
    if (/^<\/pre>/i.test(line) && insideMeta) {
      insideMeta = false;
      return;
    }

    if (insideMeta) {
      const m = /^(\s*?)([A-Za-z0-9_-]+)\s*:/i.exec(line);
      if (m) {
        const key = m[2].toLowerCase();
        seenKeys.add(key);
        if (!knownKeys.has(key)) {
          const range = new vscode.Range(
            new vscode.Position(lineNo, m[1].length),
            new vscode.Position(lineNo, m[1].length + key.length)
          );
          diags.push(
            new vscode.Diagnostic(
              range,
              `Unknown metadata key “${key}”.`,
              vscode.DiagnosticSeverity.Information
            )
          );
        }
      }
    }

    // TODO warning kept from scaffold
    const todoIdx = line.indexOf('TODO');
    if (todoIdx !== -1) {
      const range = new vscode.Range(
        new vscode.Position(lineNo, todoIdx),
        new vscode.Position(lineNo, todoIdx + 4)
      );
      diags.push(
        new vscode.Diagnostic(
          range,
          'TODO found — please complete this section.',
          vscode.DiagnosticSeverity.Warning
        )
      );
    }
  });

  // Check for missing mandatory keys after we’ve parsed the file.
  mandatoryKeys.forEach(key => {
    if (!seenKeys.has(key)) {
      const diag = new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
        `Missing mandatory metadata key “${key}”.`,
        vscode.DiagnosticSeverity.Error
      );
      diags.push(diag);
    }
  });

  collection.set(document.uri, diags);
  log.appendLine(
    `Diagnostics updated for ${document.uri.fsPath} (${diags.length} issues)`
  );
}
