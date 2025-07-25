import * as vscode from 'vscode';
import which from 'which';
import * as fs from 'fs';

/**
 * Resolve the Python executable the extension should use.
 * – Workspace setting  bikeshedTools.pythonPath  wins if it exists **and** is valid.
 * – Otherwise we probe common commands on $PATH.
 * – Returns null when nothing viable is found.
 */
export function getPythonPath(out?: vscode.OutputChannel): string | null {
  const cfg     = vscode.workspace.getConfiguration('bikeshedTools');
  const manual  = (cfg.get<string>('pythonPath') || '').trim();

  /* 1 · explicit path from settings */
  if (manual) {
    if (fs.existsSync(manual)) {
      return manual;
    }
    out?.appendLine(`⚠️  Python not found at: ${manual}`);
    return null;
  }

  /* 2 · search PATH for common names */
  const candidates = process.platform === 'win32'
    ? ['python', 'py', 'python3']
    : ['python3', 'python'];

  for (const cmd of candidates) {
    const resolved = which.sync(cmd, { nothrow: true });
    if (resolved) {
      return resolved;            // absolute path verified by which
    }
  }

  /* 3 · nothing found */
  return null;
}
