import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let internalOutput: vscode.OutputChannel | undefined;

/**
 * Resolve the Python interpreter for running Bikeshed.
 *
 *   1. Honour `bikeshedTools.pythonPath` (default "python3").
 *      – If the user provides a *bare command* (basename === value) we simply
 *        return it untouched and let the shell locate it.
 *      – If it looks like a path, expand ~ and verify it exists + is exec‑able.
 *
 *   2. When falling back, prefer `python3` over `python` **if both exist** to
 *      increase the chance of hitting a modern venv.
 */
export function getPythonPath(output?: vscode.OutputChannel): string {
  // Ensure an output channel for debug spew
  if (!output) {
    if (!internalOutput) internalOutput = vscode.window.createOutputChannel('Bikeshed Tools (Python)');
    output = internalOutput;
    output.show(true);
  }

  const config = vscode.workspace.getConfiguration('bikeshedTools');
  let userPath = (config.get<string>('pythonPath') || 'python3').trim();

  output.appendLine(`🐍 config pythonPath = ${userPath}`);

  // Strip accidental quotes
  userPath = userPath.replace(/^"(.*)"$/, '$1');
  output.appendLine(`🔧 cleaned         = ${userPath}`);

  // Expand leading ~
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const expanded = userPath.startsWith('~') ? path.join(homeDir, userPath.slice(1)) : userPath;

  /* ---------------------------------------------------------------------- */
  /*  1) bare command? (basename === value)                                 */
  /* ---------------------------------------------------------------------- */
  const isBare = path.basename(expanded) === expanded && !path.isAbsolute(expanded);
  if (isBare) {
    output.appendLine(`🔎 treating as command on PATH → ${expanded}`);
    return expanded;
  }

  /* ---------------------------------------------------------------------- */
  /*  2) Looks like a filesystem path → validate                             */
  /* ---------------------------------------------------------------------- */
  const resolved = path.normalize(expanded);
  output.appendLine(`📌 resolved path   = ${resolved}`);

  if (!fs.existsSync(resolved)) {
    output.appendLine(`❌ not found; falling back strategy engaged.`);
    return preferPython3(output);
  }

  if (process.platform !== 'win32') {
    try {
      fs.accessSync(resolved, fs.constants.X_OK);
    } catch {
      output.appendLine('🚫 exists but not executable; falling back.');
      return preferPython3(output);
    }
  }

  output.appendLine(`✅ using explicit python at ${resolved}`);
  return resolved;
}

/* ----------------------------------------------------------------------- */
/*  If user path fails, we probe PATH for python3 first, then python        */
/* ----------------------------------------------------------------------- */
function preferPython3(output: vscode.OutputChannel): string {
  const candidate = process.platform === 'win32' ? 'python3.exe' : 'python3';
  output.appendLine(`🔍 checking ${candidate} on PATH…`);
  if (commandExists(candidate)) {
    output.appendLine('✅ found python3; using that.');
    return candidate.replace(/\.exe$/, '');
  }
  output.appendLine('🔍 python3 missing; falling back to python.');
  return process.platform === 'win32' ? 'python.exe' : 'python';
}

/* Simple sync check using fs.access on PATH resolution */
function commandExists(cmd: string): boolean {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of dirs) {
    const full = path.join(dir, cmd);
    if (fs.existsSync(full)) return true;
  }
  return false;
}
