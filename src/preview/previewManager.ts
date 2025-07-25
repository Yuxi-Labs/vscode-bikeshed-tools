import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { getPythonPath } from '../utils/pythonPath';
import { getBikeshedPath, ensureBikeshedCache } from '../utils/bikeshedPath';

let previewPanel: vscode.WebviewPanel | undefined;
let bsProc: cp.ChildProcessWithoutNullStreams | undefined;
let debounceTimer: NodeJS.Timeout | undefined;

let lastStalePrompt = 0;
const DAY = 86_400_000;

/* ------------------------------------------------------------------ */
/*  Entry‑points                                                      */
/* ------------------------------------------------------------------ */
export function initLivePreview(
  context: vscode.ExtensionContext,
  output?: vscode.OutputChannel
): void {
  output?.appendLine('Live preview enabled.');

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      const doc = e.document;
      if (!isBikeshedFile(doc)) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => updatePreview(doc, context, output), 500);
    }),
    vscode.workspace.onDidOpenTextDocument(doc => {
      if (isBikeshedFile(doc)) updatePreview(doc, context, output);
    }),
    vscode.workspace.onDidRenameFiles(ev => {
      if (!previewPanel) return;
      const match = ev.files.find(f => f.oldUri.toString() === previewPanel!.title);
      if (match) {
        previewPanel.title = `📘 Preview: ${path.basename(match.newUri.fsPath)}`;
      }
    })
  );
}

export function disposeLivePreview(): void {
  bsProc?.kill();
  previewPanel?.dispose();
  previewPanel = undefined;
}

/* ------------------------------------------------------------------ */
function isBikeshedFile(doc: vscode.TextDocument): boolean {
  return doc.languageId === 'bikeshed' || path.extname(doc.fileName) === '.bs';
}

async function updatePreview(
  doc: vscode.TextDocument,
  context: vscode.ExtensionContext,
  output?: vscode.OutputChannel
): Promise<void> {
  const python = getPythonPath(output);
  if (!python) return;

  const bikeshedCli = getBikeshedPath(output);
  const log = output ?? vscode.window.createOutputChannel('Bikeshed Live Preview');
  if (!output) {
    log.clear();
    log.show(true);
  }

  bsProc?.kill();

  /* ---------- invocation heuristic ---------- */
  const useModule = !bikeshedCli || bikeshedCli.endsWith('.py');
  const cmd = useModule ? python : bikeshedCli;
  const args = useModule
    ? ['-m', 'bikeshed', 'spec', '-', '-o', '-']
    : ['spec', '-', '-o', '-'];

  bsProc = cp.spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });

  const src = doc.getText().replace(/\r\n?/g, '\n');
  bsProc.stdin.end(src);

  const outBuf: string[] = [];
  let stderr = '';

  bsProc.stdout.on('data', d => outBuf.push(d.toString()));
  bsProc.stderr.on('data', d => {
    stderr += d.toString();
  });

  bsProc.on('close', async code => {
    const html = outBuf.join('');

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
          if (ok) {
            await updatePreview(doc, context, output);
            return;
          }
        }
      }
    }

    if (code !== 0 || !html) {
      log.appendLine(`[Bikeshed error] ${stderr}`);
      return;
    }

    renderInWebview(html);
  });

  bsProc.on('error', err => {
    log.appendLine(`[Process error] ${err.message}`);
  });
}

/* ------------------------------------------------------------------ */
function renderInWebview(html: string): void {
  if (!previewPanel) {
    previewPanel = vscode.window.createWebviewPanel(
      'bikeshedPreview',
      `📘 Preview: ${
        vscode.window.activeTextEditor
          ? path.basename(vscode.window.activeTextEditor.document.fileName)
          : ''
      }`,
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );
    previewPanel.onDidDispose(() => {
      previewPanel = undefined;
    });
  }

  previewPanel.webview.html = /<\s*html[\s>]/i.test(html)
    ? injectCsp(html)
    : wrapHtml(html);
}

function injectCsp(rawHtml: string): string {
  return rawHtml.replace(
    /(<!DOCTYPE[^>]*>\s*<html[^>]*>\s*<head[^>]*>)/i,
    `$1<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">`
  );
}

function wrapHtml(body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><style>html,body{box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:2rem;margin:auto;max-width:900px;line-height:1.6;color:#1a1a1a;background:#fff}</style></head><body>${body}</body></html>`;
}
