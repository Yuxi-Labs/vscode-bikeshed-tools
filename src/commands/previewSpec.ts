import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { getPythonPath } from '../utils/pythonPath';
import { ensureBikeshedCache } from '../utils/bikeshedPath';

/**
 * Preview the current Bikeshed spec as HTML in a side panel.
 */
export async function previewSpec(output?: vscode.OutputChannel) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('Open a Bikeshed (.bs) file first.');
    return;
  }

  const doc = editor.document;
  if (doc.languageId !== 'bikeshed' || path.extname(doc.fileName) !== '.bs') {
    vscode.window.showErrorMessage('Current file is not a Bikeshed (.bs) spec.');
    return;
  }

  const pythonPath = getPythonPath(output);
  if (!pythonPath) {
    vscode.window.showErrorMessage('Python path not found or is invalid.');
    return;
  }

  await doc.save();

  const filePath = doc.fileName;
  const log = output || vscode.window.createOutputChannel('Bikeshed Preview');
  if (!output) {
    log.clear();
    log.show(true);
  }

  async function run(): Promise<{ html: string | null; stderr: string; code: number }> {
    return new Promise(resolve => {
      const outBuf: string[] = [];
      const errBuf: string[] = [];

      const proc = cp.spawn(pythonPath, [
  '-m',
  'bikeshed',
  'spec',
  filePath,
  '-o',
  '-'           // stream finished HTML to stdout
]);

      proc.stdout.on('data', d => outBuf.push(d.toString()));
      proc.stderr.on('data', d => {
        const s = d.toString();
        errBuf.push(s);
        log.appendLine(`⚠️ stderr: ${s}`);
      });

      proc.on('close', c =>
        resolve({ html: outBuf.join(''), stderr: errBuf.join(''), code: c ?? 1 })
      );

      proc.on('error', err => resolve({ html: null, stderr: err.message, code: 1 }));
    });
  }

  log.appendLine(`🚀 Generating preview for: ${filePath}`);

  let { html, stderr, code } = await run();

  // Offer cache download if missing
  if (!html && code !== 0 && /bikeshed update/i.test(stderr)) {
    const choice = await vscode.window.showInformationMessage(
      'Bikeshed cache is missing. Download now?',
      'Yes',
      'No'
    );
    if (choice === 'Yes' && (await ensureBikeshedCache(pythonPath, log))) {
      ({ html } = await run()); // retry once
    }
  }

  if (!html) {
    vscode.window.showErrorMessage('Failed to generate preview (see “Bikeshed Preview” output).');
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'bikeshedPreview',
    'Bikeshed Preview',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = /<\s*html[\s>]/i.test(html) ? html : wrapHtml(html);
  log.appendLine('✅ Preview panel rendered successfully.');
}

function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
body{font-family:system-ui,sans-serif;padding:2rem;line-height:1.6;background:#fff;color:#1a1a1a;}
</style>
</head>
<body>${body}</body>
</html>`;
}
