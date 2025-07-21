import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { getBikeshedPath } from '../utils/bikeshedPath';

let previewPanel: vscode.WebviewPanel | undefined;
let updateTimer: NodeJS.Timeout | undefined;

export function initLivePreview(context: vscode.ExtensionContext) {
  // Save-triggered fallback (always enabled)
  vscode.workspace.onDidSaveTextDocument(async (doc) => {
    if (!isBikeshedFile(doc)) return;
    updatePreview(doc);
  });

  // Live typing preview (optional)
  vscode.workspace.onDidChangeTextDocument((event) => {
    const doc = event.document;
    if (!isBikeshedFile(doc)) return;

    const config = vscode.workspace.getConfiguration('bikeshedTools');
    const liveEnabled = config.get<boolean>('livePreview', false);
    if (!liveEnabled) return;

    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => updatePreview(doc), 400); // Throttle delay
  });
}

function isBikeshedFile(doc: vscode.TextDocument): boolean {
  return doc.languageId === 'bikeshed' || path.extname(doc.fileName) === '.bs';
}

async function updatePreview(doc: vscode.TextDocument) {
  const bikeshedPath = getBikeshedPath();
  if (!bikeshedPath) return;

  const html = await runBikeshed(bikeshedPath, doc.fileName);
  if (!html) return;

  if (!previewPanel) {
    previewPanel = vscode.window.createWebviewPanel(
      'bikeshedPreview',
      'Bikeshed Live Preview',
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );

    previewPanel.onDidDispose(() => {
      previewPanel = undefined;
    });
  }

  previewPanel.webview.html = html;
}

function runBikeshed(bikeshedPath: string, filePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = cp.spawn(bikeshedPath, ['spec', filePath, '-f', 'text', '-o', '-'], { shell: true });


    let output = '';
    let error = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      error += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        console.error('[Bikeshed] Preview generation failed:', error);
        resolve(null);
      }
    });
  });
}
