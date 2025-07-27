import * as vscode from 'vscode';
import * as cp      from 'child_process';
import * as path    from 'path';
import * as fs      from 'fs';
import { findDeps, ensureBikeshedCache } from '../utils/dependencies';

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
  if (doc.languageId !== 'bikeshed' || path.extname(doc.fileName).toLowerCase() !== '.bs') {
    vscode.window.showErrorMessage('Only .bs (Bikeshed) files are supported.');
    return;
  }

  /* tooling – unified discovery */
  const { python: pythonPath, bikeshed } = await findDeps();
  if (!pythonPath) {
    vscode.window.showErrorMessage('Python interpreter not found. Configure one first.');
    return;
  }

  await doc.save();

  const filePath = doc.fileName;
  const log = output ?? vscode.window.createOutputChannel('Bikeshed Build');
  if (!output) { log.clear(); log.show(true); }

  /* ---------- invocation heuristic ---------- */
  const useModule = !bikeshed || bikeshed === pythonPath || bikeshed.endsWith('.py');
  const cmd  = useModule ? pythonPath : bikeshed!;
  const args = useModule
    ? ['-m', 'bikeshed', 'spec', filePath]
    : ['spec', filePath];

  /* ------------------------------------------------------------------ */
  async function run(): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise(resolve => {
      const outBuf: string[] = [];
      const errBuf: string[] = [];

      const proc = cp.spawn(cmd, args);

      proc.stdout.on('data', d => { const s = d.toString(); outBuf.push(s); log.append(s); });
      proc.stderr.on('data', d => { const s = d.toString(); errBuf.push(s); log.appendLine(`[stderr] ${s}`); });

      proc.on('close', c => resolve({ code: c ?? 1, stdout: outBuf.join(''), stderr: errBuf.join('') }));
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
      : `▶ "${bikeshed}" spec "${filePath}"`
  );

  let { code, stdout, stderr } = await run();

  /* auto‑download cache if missing */
  if (code !== 0 && /bikeshed update/i.test(stderr)) {
    const choice = await vscode.window.showInformationMessage(
      'Bikeshed cache is missing. Download now?', 'Yes', 'No');
    if (choice === 'Yes' && (await ensureBikeshedCache(pythonPath, log))) {
      ({ code, stdout, stderr } = await run()); // retry once
    }
  }

  /* success path, but maybe cache is stale */
  if (code === 0) {
    /* ensure <meta charset="utf-8"> so © ® § render correctly */
    try {
      const htmlPath = filePath.replace(/\.bs$/i, '.html');
      if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, 'utf8');
        if (!/meta\\s+charset/i.test(html)) {
          html = html.replace(/<head([^>]*)>/i, `<head$1><meta charset="utf-8">`);
          fs.writeFileSync(htmlPath, html, 'utf8');
          log.appendLine('ℹ️  Injected <meta charset="utf-8"> into output HTML.');
        }
      }
    } catch (e) {
      log.appendLine(`⚠️  Could not post‑process HTML for charset: ${(e as Error).message}`);
    }

    const cacheWarning = /cache\\s+is\\s+\\d+\\s+days\\s+stale/i.test(stdout);
    if (cacheWarning && Date.now() - lastCachePrompt > ONE_DAY) {
      lastCachePrompt = Date.now();
      const choice = await vscode.window.showInformationMessage(
        'Bikeshed cache looks stale. Update now?', 'Yes', 'Ignore for a day');
      if (choice === 'Yes') await ensureBikeshedCache(pythonPath, log);
    }

    vscode.window.showInformationMessage('✅ Bikeshed spec built successfully.');
    return;
  }

  /* failure after retries */
  vscode.window.showErrorMessage(`❌ Bikeshed build failed (exit code ${code}).`);
}
