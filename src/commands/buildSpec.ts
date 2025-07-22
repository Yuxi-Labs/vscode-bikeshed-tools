import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { getPythonPath } from '../utils/pythonPath';

/**
 * Runs Bikeshed to build a spec file.
 */
export async function buildSpec(output?: vscode.OutputChannel) {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showErrorMessage('No active editor. Open a Bikeshed (.bs) file to build.');
    return;
  }

  const doc = editor.document;

  if (doc.languageId !== 'bikeshed' || path.extname(doc.fileName) !== '.bs') {
    vscode.window.showErrorMessage('Only .bs (Bikeshed) files are supported.');
    return;
  }

  const pythonPath = getPythonPath(output);
  if (!pythonPath) {
    vscode.window.showErrorMessage('Python path not found or not configured.');
    return;
  }

  try {
    await doc.save();

    const filePath = doc.fileName;
    const log = output || vscode.window.createOutputChannel('Bikeshed Build');
    if (!output) {
      log.clear();
      log.show(true);
    }

    log.appendLine(`🚧 Building: ${filePath}`);
    log.appendLine(`▶ Command: ${pythonPath} -m bikeshed spec "${filePath}"`);

    const result = await runBikeshedBuild(pythonPath, filePath, log);

    if (result === 0) {
      vscode.window.showInformationMessage('✅ Bikeshed spec built successfully.');
    } else {
      vscode.window.showErrorMessage(`❌ Bikeshed build failed (exit code ${result}).`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Bikeshed build failed: ${message}`);
    output?.appendLine(`❌ Exception during build: ${message}`);
  }
}

function runBikeshedBuild(
  pythonPath: string,
  filePath: string,
  output: vscode.OutputChannel
): Promise<number> {
  return new Promise((resolve) => {
    const proc = cp.spawn(pythonPath, ['-m', 'bikeshed', 'spec', filePath], { shell: true });

    proc.stdout.on('data', (data) => {
      output.append(data.toString());
    });

    proc.stderr.on('data', (data) => {
      output.appendLine(`[stderr] ${data.toString()}`);
    });

    proc.on('close', (code) => {
      output.appendLine(`📦 Process exited with code ${code}`);
      resolve(code ?? 1);
    });

    proc.on('error', (err) => {
      output.appendLine(`❌ Failed to launch Bikeshed: ${err.message}`);
      resolve(1);
    });
  });
}
