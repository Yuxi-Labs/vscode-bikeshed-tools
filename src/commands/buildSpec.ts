import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { getBikeshedPath } from '../utils/bikeshedPath';

export async function buildSpec() {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showErrorMessage('No active editor. Open a Bikeshed (.bs) file to build.');
    return;
  }

  const doc = editor.document;

  if (doc.languageId !== 'plaintext' && path.extname(doc.fileName) !== '.bs') {
    vscode.window.showErrorMessage('This does not appear to be a Bikeshed file.');
    return;
  }

  const bikeshedPath = getBikeshedPath();
  if (!bikeshedPath) {
    vscode.window.showErrorMessage('Bikeshed path not found or not configured correctly.');
    return;
  }

  const filePath = doc.fileName;

  const outputChannel = vscode.window.createOutputChannel('Bikeshed');
  outputChannel.show(true);
  outputChannel.appendLine(`Running: ${bikeshedPath} spec ${filePath}`);

  const process = cp.spawn(bikeshedPath, ['spec', filePath], { shell: true });

  process.stdout.on('data', (data) => {
    outputChannel.append(data.toString());
  });

  process.stderr.on('data', (data) => {
    outputChannel.append(data.toString());
  });

  process.on('close', (code) => {
    if (code === 0) {
      vscode.window.showInformationMessage('✅ Bikeshed spec built successfully.');
    } else {
      vscode.window.showErrorMessage(`❌ Bikeshed failed with exit code ${code}`);
    }
  });
}
