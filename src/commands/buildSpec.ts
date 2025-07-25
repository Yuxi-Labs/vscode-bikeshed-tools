import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { getPythonPath } from '../utils/pythonPath';
import { getBikeshedPath, ensureBikeshedCache } from '../utils/bikeshedPath';

/* cache‑staleness prompt control */
let lastCachePrompt = 0;
const ONE_DAY = 86_400_000;

/* ------------------------------------------------------------------ */
export async function buildSpec(output?: vscode.OutputChannel): Promise<void> {
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

  /* tooling */
  const pythonPath = getPythonPath(output);
  const bikeshedCmd = getBikeshedPath(output);
  if (!pythonPath) {
    vscode.window.showErrorMessage(
      'Python path not found or not configured.'
    );
    return;
  }

  await doc.save();

  const filePath = doc.fileName;
  const log = output ?? vscode.window.createOutputChannel('Bikeshed Build');
  if (!output) {
    log.clear();
    log.show(true);
  }

  /* ---------- invocation heuristic ---------- */
  const useModule = !bikeshedCmd || bikeshedCmd.endsWith('.py');

  const cmd = useModule ? pythonPath : bikeshedCmd!;
  const args = useModule
    ? ['-m', 'bikeshed', 'spec', filePath]
    : ['spec', filePath];

  /* ------------------------------------------------------------------ */
  async function run(): Promise<{
    code: number;
    stdout: string;
    stderr: string;
  }> {
    return new Promise(resolve => {
      const outBuf: string[] = [];
      const errBuf: string[] = [];

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
        resolve({
          code: c ?? 1,
          stdout: outBuf.join(''),
          stderr: errBuf.join('')
        })
      );
      proc.on('error', err => {
        log.appendLine(`❌ Failed to launch Bikeshed: ${err.message}`);
        resolve({ code: 1, stdout: '', stderr: err.message });
      });
    });
  }

  log.appendLine(`🚧 Building: ${filePath}`);
  log.appendLine(
    useModule
      ? `▶ "${pythonPath}" -m bikeshed spec "${filePath}"`
      : `▶ "${bikeshedCmd}" spec "${filePath}"`
  );

  let { code, stdout, stderr } = await run();

  /* auto‑download cache if missing */
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

  /* success path, but maybe cache is stale */
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

    vscode.window.showInformationMessage(
      '✅ Bikeshed spec built successfully.'
    );
    return;
  }

  /* failure after retries */
  vscode.window.showErrorMessage(
    `❌ Bikeshed build failed (exit code ${code}).`
  );
}
