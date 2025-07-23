import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { getPythonPath } from '../utils/pythonPath';
import { getBikeshedPath, ensureBikeshedCache } from '../utils/bikeshedPath';

/**
 * Remember when we last nagged about a stale Bikeshed cache ― to avoid spamming
 * users every build.  Epoch ms; zero means never.
 */
let lastCachePrompt = 0;
const ONE_DAY = 24 * 60 * 60 * 1000;

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

  // Resolve tooling
  const pythonPath = getPythonPath(output); // always needed for cache ops.
  const bikeshedCmd = getBikeshedPath(output); // may be undefined → fall back to python -m

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

  /** Spawn Bikeshed and collect stdout / stderr. */
  async function run(): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise(resolve => {
      const outBuf: string[] = [];
      const errBuf: string[] = [];

      const usePython = !bikeshedCmd; // no custom CLI → use python -m
      const cmd = usePython ? pythonPath : bikeshedCmd!;
      const args = usePython ? ['-m', 'bikeshed', 'spec', filePath] : ['spec', filePath];

      const proc = cp.spawn(cmd, args);

      proc.stdout.on('data', d => {
        const s = d.toString();
        outBuf.push(s);
        log.append(s);
      });
      proc.stderr.on('data', d => {
        const s = d.toString();
        errBuf.push(s);
        log.appendLine(`[stderr] ${s}`);
      });

      proc.on('close', c =>
        resolve({ code: c ?? 1, stdout: outBuf.join(''), stderr: errBuf.join('') })
      );
      proc.on('error', err => {
        log.appendLine(`❌ Failed to launch Bikeshed: ${err.message}`);
        resolve({ code: 1, stdout: '', stderr: err.message });
      });
    });
  }

  log.appendLine(`🚧 Building: ${filePath}`);
  if (bikeshedCmd) {
    log.appendLine(`▶ "${bikeshedCmd}" spec "${filePath}"`);
  } else {
    log.appendLine(`▶ "${pythonPath}" -m bikeshed spec "${filePath}"`);
  }

  let { code, stdout, stderr } = await run();

  // Auto‑prompt to update cache if Bikeshed failed to find one
  if (code !== 0 && /bikeshed update/i.test(stderr)) {
    const choice = await vscode.window.showInformationMessage(
      'Bikeshed cache is missing. Download now?',
      'Yes',
      'No'
    );
    if (choice === 'Yes' && (await ensureBikeshedCache(pythonPath, log))) {
      ({ code, stdout, stderr } = await run()); // retry once
    }
  }

  // ‑‑‑ Success path — but maybe the cache is stale.
  if (code === 0) {
    const cacheWarning = /cache\s+is\s+\d+\s+days\s+stale/i.test(stdout);
    if (cacheWarning && Date.now() - lastCachePrompt > ONE_DAY) {
      lastCachePrompt = Date.now();
      const choice = await vscode.window.showInformationMessage(
        'Bikeshed cache looks stale. Update now?',
        'Yes',
        'Ignore for a day'
      );
      if (choice === 'Yes') {
        await ensureBikeshedCache(pythonPath, log);
      }
    }

    vscode.window.showInformationMessage('✅ Bikeshed spec built successfully.');
    return;
  }

  // Failure after retries
  vscode.window.showErrorMessage(`❌ Bikeshed build failed (exit code ${code}).`);
}
