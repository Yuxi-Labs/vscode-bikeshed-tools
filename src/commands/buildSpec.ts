import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { getPythonPath } from '../utils/pythonPath';
import { ensureBikeshedCache } from '../utils/bikeshedPath';   // CHANGED

/**
 * Runs Bikeshed to build a spec file.
 */
export async function buildSpec(output?: vscode.OutputChannel) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('Open a Bikeshed (.bs) file first.');
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

  await doc.save();

  const filePath = doc.fileName;
  const log = output || vscode.window.createOutputChannel('Bikeshed Build');
  if (!output) {
    log.clear();
    log.show(true);
  }

  async function run(): Promise<{ code: number; stderr: string }> {
    return new Promise(resolve => {
      const errBuf: string[] = [];
      const proc = cp.spawn(pythonPath, ['-m', 'bikeshed', 'spec', filePath]);

      proc.stdout.on('data', d => log.append(d.toString()));
      proc.stderr.on('data', d => {
        const s = d.toString();
        errBuf.push(s);
        log.appendLine(`[stderr] ${s}`);
      });

      proc.on('close', c => resolve({ code: c ?? 1, stderr: errBuf.join('') }));
      proc.on('error', err => {
        log.appendLine(`❌ Failed to launch Bikeshed: ${err.message}`);
        resolve({ code: 1, stderr: err.message });
      });
    });
  }

  log.appendLine(`🚧 Building: ${filePath}`);
  log.appendLine(`▶ "${pythonPath}" -m bikeshed spec "${filePath}"`);

  let { code, stderr } = await run();

  // Auto‑prompt to update cache if missing
  if (code !== 0 && /bikeshed update/i.test(stderr)) {
    const choice = await vscode.window.showInformationMessage(
      'Bikeshed cache is missing. Download now?',
      'Yes',
      'No'
    );
    if (choice === 'Yes' && (await ensureBikeshedCache(pythonPath, log))) {
      ({ code } = await run()); // retry once
    }
  }

  if (code === 0) {
    vscode.window.showInformationMessage('✅ Bikeshed spec built successfully.');
  } else {
    vscode.window.showErrorMessage(`❌ Bikeshed build failed (exit code ${code}).`);
  }
}
