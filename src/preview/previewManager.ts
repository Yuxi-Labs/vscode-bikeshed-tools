import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getPythonPath } from '../utils/pythonPath';

let previewPanel: vscode.WebviewPanel | undefined;
let updateTimer: NodeJS.Timeout | undefined;

/**
 * Initializes live preview events for Bikeshed documents.
 */
export function initLivePreview(context: vscode.ExtensionContext, output?: vscode.OutputChannel) {
  const config = vscode.workspace.getConfiguration('bikeshedTools');
  const liveEnabled = config.get<boolean>('livePreview', false);

  if (!liveEnabled) {
    output?.appendLine('Live preview disabled in settings.');
    return;
  }

  output?.appendLine('Live preview enabled.');

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const doc = event.document;
      if (!isBikeshedFile(doc)) return;
      clearTimeout(updateTimer);
      updateTimer = setTimeout(() => updatePreview(doc, context, output), 400);
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (!isBikeshedFile(doc)) return;
      updatePreview(doc, context, output);
    })
  );
}

export function disposeLivePreview() {
  if (previewPanel) {
    previewPanel.dispose();
    previewPanel = undefined;
  }
}

function isBikeshedFile(doc: vscode.TextDocument): boolean {
  return doc.languageId === 'bikeshed' || path.extname(doc.fileName) === '.bs';
}

async function updatePreview(doc: vscode.TextDocument, context: vscode.ExtensionContext, output?: vscode.OutputChannel) {
  const pythonPath = getPythonPath(output);
  if (!pythonPath) {
    output?.appendLine('⚠️ No Python path found. Skipping preview.');
    return;
  }

  try {
    await doc.save();
    const tmpOut = path.join(os.tmpdir(), `bikeshed-preview-${Date.now()}.html`);
    const success = await runBikeshed(pythonPath, doc.fileName, tmpOut, output);

    if (!success) {
      output?.appendLine(`❌ Failed to generate preview for ${doc.fileName}`);
      return;
    }

    const html = fs.readFileSync(tmpOut, 'utf8');
    const cssPath = path.join(context.extensionPath, 'assets', 'styles', 'preview.css');
    const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

    if (!previewPanel) {
      previewPanel = vscode.window.createWebviewPanel(
        'bikeshedPreview',
        `📘 Preview: ${path.basename(doc.fileName)}`,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
      );

      previewPanel.onDidDispose(() => {
        previewPanel = undefined;
      });
    }

    previewPanel.webview.html = wrapHtml(html, css);
    output?.appendLine(`✅ Live preview updated for ${doc.fileName}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Error updating Bikeshed preview: ${msg}`);
    output?.appendLine(`❌ Exception in updatePreview: ${msg}`);
  }
}

function runBikeshed(pythonPath: string, filePath: string, outFile: string, output?: vscode.OutputChannel): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = cp.spawn(pythonPath, ['-m', 'bikeshed', 'spec', filePath, '-f', 'html', '-o', outFile], { shell: true });

    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        output?.appendLine(`[Bikeshed error] ${stderr}`);
        resolve(false);
      }
    });

    proc.on('error', (err) => {
      output?.appendLine(`[Process error] ${err.message}`);
      resolve(false);
    });
  });
}

function wrapHtml(body: string, css: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <style>${css}</style>
      </head>
      <body>${body}</body>
    </html>
  `;
}
