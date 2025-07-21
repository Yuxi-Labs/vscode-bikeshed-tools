import * as vscode from 'vscode';
import * as cp from 'child_process';
import { getBikeshedPath } from '../utils/bikeshedPath';
import * as path from 'path';

export async function previewSpec() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor. Open a Bikeshed (.bs) file to preview.');
    return;
  }

  const doc = editor.document;
  if (path.extname(doc.fileName) !== '.bs') {
    vscode.window.showErrorMessage('Not a Bikeshed file.');
    return;
  }

  const bikeshedPath = getBikeshedPath();
  if (!bikeshedPath) {
    vscode.window.showErrorMessage('Bikeshed path not found or not configured.');
    return;
  }

  const filePath = doc.fileName;
  const outputChannel = vscode.window.createOutputChannel('Bikeshed Preview');
  outputChannel.clear();
  outputChannel.appendLine(`🔍 Previewing: ${filePath}`);
  outputChannel.show(true);

  const output = await runBikeshed(bikeshedPath, filePath, outputChannel);
  if (!output) {
    vscode.window.showErrorMessage('❌ Bikeshed failed to generate preview.');
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'bikeshedPreview',
    'Bikeshed Preview',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = wrapHtml(output);
}

function runBikeshed(
  bikeshedPath: string,
  filePath: string,
  outputChannel: vscode.OutputChannel
): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = cp.spawn(bikeshedPath, ['spec', filePath, '-f', 'text'], { shell: true });

    let output = '';
    let error = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      error += text;
      outputChannel.appendLine(`⚠️ stderr: ${text}`);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        outputChannel.appendLine(`❌ Bikeshed exited with code ${code}`);
        resolve(null);
      }
    });
  });
}

function wrapHtml(body: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            padding: 2rem;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        ${body}
      </body>
    </html>
  `;
}
