import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getPythonPath } from '../utils/pythonPath';
import { getBikeshedPath } from '../utils/bikeshedPath';

let previewPanel: vscode.WebviewPanel | undefined;
let bsProc: cp.ChildProcess | undefined;
let debounceTimer: NodeJS.Timeout | undefined;
let currentFile: string | undefined;

export function initLivePreview(
  context: vscode.ExtensionContext,
  output?: vscode.OutputChannel
): void {
  output?.appendLine('Live preview enabled.');
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (!isBikeshedFile(e.document) || !previewPanel) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => showPreview(e.document, output), 500);
    }),
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (isBikeshedFile(doc) && previewPanel) showPreview(doc, output);
    }),
    vscode.workspace.onDidRenameFiles((ev) => {
      if (!previewPanel || !currentFile) return;
      const hit = ev.files.find((f) => f.oldUri.fsPath === currentFile);
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

export async function showPreview(
  doc: vscode.TextDocument,
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

  await doc.save();
  currentFile = doc.fileName;
  bsProc?.kill();

  const useModule = !bikeshedCli || bikeshedCli.endsWith('.py');
  const cmd = useModule ? python : bikeshedCli!;
  const args = useModule
    ? ['-m', 'bikeshed', 'spec', '-', '-o', '-', '--print']
    : ['spec', '-', '-o', '-', '--print'];

  bsProc = cp.spawn(cmd, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });

  const src = doc.getText().replace(/\r\n?/g, '\n');
  bsProc.stdin!.end(src);

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  bsProc.stdout!.on('data', (chunk) => {
    stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8'));
  });

  bsProc.stderr!.on('data', (chunk) => {
    stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8'));
  });

  bsProc.on('close', async (code) => {
    const stdout = Buffer.concat(stdoutChunks).toString('utf8');
    const stderr = Buffer.concat(stderrChunks).toString('utf8');

    if (code !== 0 || !stdout.trim()) {
      log.appendLine(`[Bikeshed error] ${stderr}`);
      return;
    }

    renderInWebview(stdout);
  });

  bsProc.on('error', (err) => {
    log.appendLine(`[Process error] ${err.message}`);
  });
}

function isBikeshedFile(doc: vscode.TextDocument): boolean {
  return doc.languageId === 'bikeshed' || path.extname(doc.fileName) === '.bs';
}

function renderInWebview(rawHtml: string): void {
  const finalHtml = ensureUtf8AndCsp(rawHtml);

  // 💾 Dump HTML to temp file
  try {
    const tempPath = path.join(os.tmpdir(), 'bikeshed-preview-debug.html');
    fs.writeFileSync(tempPath, finalHtml, 'utf8');
    console.log(`🧪 Bikeshed preview HTML written to: ${tempPath}`);
  } catch (err) {
    console.error('❌ Failed to write preview dump:', err);
  }

  if (!previewPanel) {
    previewPanel = vscode.window.createWebviewPanel(
      'bikeshedPreview',
      `📘 Preview: ${path.basename(currentFile ?? '')}`,
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );
    previewPanel.onDidDispose(() => {
      previewPanel = undefined;
    });
  }

  previewPanel.webview.html = finalHtml;
}

function ensureUtf8AndCsp(html: string): string {
  const metaCharset = `<meta charset="utf-8">`;
  const csp = `<meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src 'unsafe-inline' https:;
    img-src data: https:;
    script-src 'unsafe-inline' https:;
    font-src https:;
  ">`;
  const specCSS = `<link rel="stylesheet" href="https://resources.whatwg.org/spec.css">`;

  return html.replace(/<head([^>]*)>/i, (_match, g1) =>
    `<head${g1}>\n${metaCharset}\n${csp}\n${specCSS}`
  );
}
