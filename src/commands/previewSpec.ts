import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { getPythonPath } from '../utils/pythonPath';
import { getBikeshedPath, ensureBikeshedCache } from '../utils/bikeshedPath';

/* ──────────────────────────────────────────────────────────────────────────── */
/*  A single long‑lived Bikeshed process                                      */
/* ──────────────────────────────────────────────────────────────────────────── */

let bsProc: cp.ChildProcessWithoutNullStreams | undefined;
let lastStalePrompt = 0;
const DAY = 86_400_000;

async function runBikeshed(
  python: string,
  bikeshedCli: string | undefined,
  htmlOutput: (html: string) => void,
  log: vscode.OutputChannel,
  docText: string
): Promise<void> {
  // Cancel any previous run still working
  bsProc?.kill('SIGTERM');

  // Build argv: prefer explicit bikeshed CLI if user set one, otherwise -m
  const argv = bikeshedCli
    ? [bikeshedCli, 'spec', '-', '-o', '-']
    : ['-m', 'bikeshed', 'spec', '-', '-o', '-'];

  const proc = cp.spawn(python, argv, {
    stdio: ['pipe', 'pipe', 'pipe']
  }) as cp.ChildProcessWithoutNullStreams;

  bsProc = proc;

  /* Stream current buffer via stdin */
  bsProc.stdin.end(docText);

  const outBuf: string[] = [];
  const errBuf: string[] = [];

  bsProc.stdout.on('data', d => outBuf.push(d.toString()));
  bsProc.stderr.on('data', d => errBuf.push(d.toString()));

  return new Promise(resolve => {
    bsProc!.on('close', async code => {
      const html = outBuf.join('');
      const stderr = errBuf.join('');

      // Detect stale cache warnings (only once a day)
      if (/cache\s+is\s+\d+\s+days\s+old/i.test(stderr)) {
        const now = Date.now();
        if (now - lastStalePrompt > DAY) {
          lastStalePrompt = now;
          const choice = await vscode.window.showInformationMessage(
            'Bikeshed cache is stale. Update now?',
            'Yes',
            'No'
          );
          if (choice === 'Yes') {
            const ok = await ensureBikeshedCache(python, log);
            if (ok) return runBikeshed(python, bikeshedCli, htmlOutput, log, docText);
          }
        }
      }

      if (code === 0 && html) {
        htmlOutput(html);
      } else {
        log.appendLine(`❌ Preview failed (exit code ${code}).`);
        log.appendLine(stderr);
        vscode.window.showErrorMessage('Failed to generate Bikeshed preview – see output');
      }
      resolve();
    });
  });
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Command entry‑point                                                        */
/* ──────────────────────────────────────────────────────────────────────────── */

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
    vscode.window.showErrorMessage('Python path not found or is invalid.');
    return;
  }

  const bikeshedCli = getBikeshedPath(output);

  await doc.save();

  const log = output || vscode.window.createOutputChannel('Bikeshed Preview');
  if (!output) {
    log.clear();
    log.show(true);
  }

  const panel = vscode.window.createWebviewPanel(
    'bikeshedPreview',
    'Bikeshed Preview',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  function render(html: string) {
    panel.webview.html = /<\s*html[\s>]/i.test(html) ? html : wrapHtml(html);
    log.appendLine('✅ Preview panel rendered successfully.');
  }

  log.appendLine(`🚀 Generating preview for: ${doc.fileName}`);

  await runBikeshed(pythonPath, bikeshedCli, render, log, doc.getText());
}

function wrapHtml(body: string): string {
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<style>body{font-family:system-ui,sans-serif;padding:2rem;line-height:1.6;background:#fff;color:#1a1a1a;}</style>\n</head>\n<body>${body}</body>\n</html>`;
}
