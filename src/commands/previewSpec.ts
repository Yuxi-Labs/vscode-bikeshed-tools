import * as vscode from 'vscode';
import * as cp      from 'child_process';
import * as path    from 'path';
import { getPythonPath }                   from '../utils/pythonPath';
import { getBikeshedPath, ensureBikeshedCache } from '../utils/bikeshedPath';

/* ──────────────────────────────────────────────────────────────── */
/*  One long-lived Bikeshed process                                */
/* ──────────────────────────────────────────────────────────────── */

let bsProc: cp.ChildProcessWithoutNullStreams | undefined;
let lastStalePrompt = 0;
const DAY = 86_400_000;

async function runBikeshed(
  python: string,
  bikeshedCli: string | undefined,
  htmlOut: (html: string) => void,
  log: vscode.OutputChannel,
  source: string
): Promise<void> {
  /* cancel any previous invocation still running */
  bsProc?.kill('SIGTERM');

  /**
   * Decide how to invoke Bikeshed
   *
   *  – if the user gave us an **absolute / relative path** to the CLI
   *    (contains “/” or “\” or starts with “.”) → run it as a script
   *      $ python  /abs/path/to/bikeshed  spec - -o -
   *
   *  – if they typed just **`bikeshed`** (or we fall back to PATH)
   *    → treat it as a module instead:
   *      $ python  -m bikeshed  spec - -o -
   */
  const useAsModule =
  !bikeshedCli                       // no setting → module
  || !(/[\\/]/.test(bikeshedCli));   // no slash → module

const argv = useAsModule
  ? ['-m', 'bikeshed', 'spec', '-', '-o', '-']
  : [path.isAbsolute(bikeshedCli)
       ? bikeshedCli                // absolute → keep as-is
       : bikeshedCli,               // relative path → leave it; DON’T resolve
     'spec', '-', '-o', '-'];

  bsProc = cp.spawn(python, argv, { stdio: ['pipe', 'pipe', 'pipe'] }) as cp.ChildProcessWithoutNullStreams;

  /* stream current buffer via stdin */
  bsProc.stdin.end(source);

  const stdout: string[] = [];
  const stderr: string[] = [];

  bsProc.stdout.on('data', d => stdout.push(d.toString()));
  bsProc.stderr.on('data', d => stderr.push(d.toString()));

  return new Promise(res => {
    bsProc!.on('close', async code => {
      const html = stdout.join('');
      const err  = stderr.join('');

      /* Stale-cache warning once a day */
      if (/cache\s+is\s+\d+\s+days\s+old/i.test(err)) {
        const now = Date.now();
        if (now - lastStalePrompt > DAY) {
          lastStalePrompt = now;
          const choice = await vscode.window.showInformationMessage(
            'Bikeshed cache looks stale. Update now?',
            'Yes', 'No'
          );
          if (choice === 'Yes') {
            const ok = await ensureBikeshedCache(python, log);
            if (ok) {               // rerun with fresh cache
              await runBikeshed(python, bikeshedCli, htmlOut, log, source);
              return res();
            }
          }
        }
      }

      if (code === 0 && html) {
        htmlOut(html);
      } else {
        log.appendLine(`❌ Preview failed (exit code ${code}).`);
        log.appendLine(err);
        vscode.window.showErrorMessage(
          'Failed to generate Bikeshed preview – check the output panel.'
        );
      }
      res();
    });
  });
}

/* ──────────────────────────────────────────────────────────────── */
/*  Main command                                                   */
/* ──────────────────────────────────────────────────────────────── */
export async function previewSpec(output?: vscode.OutputChannel) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('Open a Bikeshed (.bs) file first.');
    return;
  }

  const doc = editor.document;
  if (doc.languageId !== 'bikeshed' || path.extname(doc.fileName) !== '.bs') {
    vscode.window.showErrorMessage('Current file is not a Bikeshed (.bs) spec.');
    return;
  }

  const pythonPath = getPythonPath(output);
  if (!pythonPath) {
    vscode.window.showErrorMessage('Python executable not configured.');
    return;
  }

  const bikeshedCli = getBikeshedPath(output);     // may be undefined → use -m

  await doc.save();

  const log = output ?? vscode.window.createOutputChannel('Bikeshed Preview');
  if (!output) {
    log.clear();
    log.show(true);
  }

  const panel = vscode.window.createWebviewPanel(
    'bikeshedPreview',
    `Preview — ${path.basename(doc.fileName)}`,
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  const render = (html: string) => {
    panel.webview.html = /<\s*html[\s>]/i.test(html) ? html : wrapHtml(html);
    log.appendLine('✅ Preview rendered.');
  };

  log.appendLine(`🚀 Generating preview for: ${doc.fileName}`);
  await runBikeshed(pythonPath, bikeshedCli, render, log, doc.getText());
}

function wrapHtml(body: string): string {
  return `<!doctype html><html lang="en"><meta charset=utf-8><body>${body}</body></html>`;
}
