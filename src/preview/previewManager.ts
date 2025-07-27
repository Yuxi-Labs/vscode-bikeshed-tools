import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { findDeps } from '../utils/dependencies';

let previewPanel: vscode.WebviewPanel | undefined;
let bsProc: cp.ChildProcess | undefined;
let debounceTimer: NodeJS.Timeout | undefined;
let currentFile: string | undefined;

/* ────────────────────────────────────────────────────────────────── */
export function initLivePreview(
  context: vscode.ExtensionContext,
  output?: vscode.OutputChannel
): void {
  output?.appendLine('Live preview enabled.');
  context.subscriptions.push(
<<<<<<< HEAD
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (!isBikeshedFile(e.document) || !previewPanel) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => showPreview(e.document, output), 500);
    }),
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (isBikeshedFile(doc) && previewPanel) showPreview(doc, output);
=======
    vscode.workspace.onDidChangeTextDocument(e => {
      if (!isBikeshedFile(e.document)) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => showPreview(e.document, output), 500);
    }),
    vscode.workspace.onDidOpenTextDocument(doc => {
      if (isBikeshedFile(doc)) showPreview(doc, output);
>>>>>>> development
    }),
    vscode.workspace.onDidRenameFiles(ev => {
      if (!previewPanel || !currentFile) return;
      const hit = ev.files.find(f => f.oldUri.fsPath === currentFile);
      if (hit) {
        currentFile = hit.newUri.fsPath;
        previewPanel.title = `📘 Preview: ${path.basename(currentFile)}`;
      }
    })
  );
}

export function disposeLivePreview(): void {
  bsProc?.kill();
  previewPanel?.dispose();
  previewPanel = undefined;
}

/* ────────────────────────────────────────────────────────────────── */
export async function showPreview(
  doc: vscode.TextDocument,
  output?: vscode.OutputChannel
): Promise<void> {
  const { python, bikeshed } = await findDeps();
  if (!python) return; // cannot preview without an interpreter

  const log = output ?? vscode.window.createOutputChannel('Bikeshed Live Preview');
  if (!output) { log.clear(); log.show(true); }

  await doc.save();
  currentFile = doc.fileName;
  bsProc?.kill();

  const useModule = !bikeshed || bikeshed === python || bikeshed.endsWith('.py');
  const cmd       = useModule ? python : bikeshed!;
  const commonArgs = ['spec', '-', '-o', '-', '-s']; // -s ⇒ silent → stdout is pure HTML
  const args       = useModule ? ['-m', 'bikeshed', ...commonArgs] : commonArgs;

  bsProc = cp.spawn(cmd, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });

  // feed the current buffer
  bsProc.stdin!.end(doc.getText().replace(/\r\n?/g, '\n'));

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  bsProc.stdout!.on('data', chunk => stdoutChunks.push(Buffer.from(chunk)));
  bsProc.stderr!.on('data', chunk => stderrChunks.push(Buffer.from(chunk)));

  bsProc.on('close', () => {
    const stdout = Buffer.concat(stdoutChunks).toString('utf8');
    const stderr = Buffer.concat(stderrChunks).toString('utf8');

    if (!stdout.trim()) {
      log.appendLine(`[Bikeshed error] ${stderr || '(no HTML emitted)'}`);
      return;
    }
    renderInWebview(stdout);
  });

  bsProc.on('error', err => log.appendLine(`[Process error] ${err.message}`));
}

/* ────────────────────────────────────────────────────────────────── */
function isBikeshedFile(doc: vscode.TextDocument): boolean {
  return doc.languageId === 'bikeshed' || path.extname(doc.fileName).toLowerCase() === '.bs';
}

function renderInWebview(rawHtml: string): void {
  const finalHtml = ensureUtf8AndCsp(rawHtml);

  /* dump for debugging ------------------------------------------------ */
  try {
    const tmp = path.join(os.tmpdir(), 'bikeshed-preview-debug.html');
    fs.writeFileSync(tmp, finalHtml, 'utf8');
    console.log(`🧪 Bikeshed preview HTML written to: ${tmp}`);
  } catch (e) {
    console.error('❌ Failed to write preview dump:', e);
  }

  /* show in panel ------------------------------------------------------ */
  if (!previewPanel) {
    previewPanel = vscode.window.createWebviewPanel(
      'bikeshedPreview',
      `📘 Preview: ${path.basename(currentFile ?? '')}`,
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );
    previewPanel.onDidDispose(() => { previewPanel = undefined; });
  }

  previewPanel.webview.html = finalHtml;
}

function ensureUtf8AndCsp(html: string): string {
  const metaCharset = `<meta charset="utf-8">`;
  const csp = `<meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src  'unsafe-inline' https:;
    img-src    data: https:;
    script-src 'unsafe-inline' https:;
    font-src   https:;
  ">`;
  const specCSS = `<link rel="stylesheet" href="https://resources.whatwg.org/spec.css">`;

  return html.replace(/<head([^>]*)>/i,
    (_m, g1) => `<head${g1}>${metaCharset}\n${csp}\n${specCSS}`);
}
