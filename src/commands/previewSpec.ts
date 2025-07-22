import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getPythonPath } from '../utils/pythonPath';

/**
 * Preview the current Bikeshed spec as HTML in a side panel.
 */
export async function previewSpec(output?: vscode.OutputChannel) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor. Open a Bikeshed (.bs) file to preview.');
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

  try {
    await doc.save();

    const filePath = doc.fileName;
    const log = output || vscode.window.createOutputChannel('Bikeshed Preview');
    if (!output) {
      log.clear();
      log.show(true);
    }

    log.appendLine(`🚀 Generating preview for: ${filePath}`);
    const htmlOutput = await runBikeshed(pythonPath, filePath, log);

    if (!htmlOutput) {
      vscode.window.showErrorMessage('Failed to generate preview. See output for details.');
      return;
    }

    showPreviewPanel(htmlOutput, log);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Bikeshed preview failed: ${message}`);
    output?.appendLine(`❌ Exception during preview: ${message}`);
  }
}

/**
 * Run Bikeshed CLI and return HTML output by reading a temp file.
 */
function runBikeshed(
  pythonPath: string,
  filePath: string,
  output: vscode.OutputChannel
): Promise<string | null> {
  return new Promise((resolve) => {
    const tmpOut = path.join(os.tmpdir(), `bikeshed-preview-${Date.now()}.html`);
    const proc = cp.spawn(pythonPath, ['-m', 'bikeshed', 'spec', filePath, '-f', 'html', '-o', tmpOut], {
      shell: true
    });

    let stderr = '';

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      output.appendLine(`⚠️ stderr: ${text}`);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const html = fs.readFileSync(tmpOut, 'utf8');
          resolve(html);
        } catch (err) {
          output.appendLine(`❌ Failed to read temp output: ${err}`);
          resolve(null);
        }
      } else {
        output.appendLine(`❌ Bikeshed exited with code ${code}`);
        output.appendLine(stderr);
        resolve(null);
      }
    });

    proc.on('error', (err) => {
      output.appendLine(`❌ Failed to run Bikeshed: ${err.message}`);
      resolve(null);
    });
  });
}

/**
 * Displays the HTML in a new webview panel.
 */
function showPreviewPanel(htmlContent: string, output: vscode.OutputChannel) {
  try {
    const panel = vscode.window.createWebviewPanel(
      'bikeshedPreview',
      'Bikeshed Preview',
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );

    panel.webview.html = wrapHtml(htmlContent);
    output.appendLine('✅ Preview panel rendered successfully.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to render preview panel: ${msg}`);
    output.appendLine(`❌ Preview panel error: ${msg}`);
  }
}

/**
 * Wraps the Bikeshed-generated HTML inside a styled document.
 */
function wrapHtml(body: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: system-ui, sans-serif;
            padding: 2rem;
            line-height: 1.6;
            background: #ffffff;
            color: #1a1a1a;
          }
        </style>
      </head>
      <body>
        ${body}
      </body>
    </html>
  `;
}
