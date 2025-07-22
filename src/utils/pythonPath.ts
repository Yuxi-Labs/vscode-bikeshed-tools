import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let internalOutput: vscode.OutputChannel | undefined;

/**
 * Resolve the Python executable for running Bikeshed.
 * 1. Honor the `bikeshedTools.pythonPath` setting (default "python3").
 * 2. If the value is a bare command (no slashes/back‑slashes), return it unchanged.
 * 3. If it looks like a path, expand ~ and validate that the file exists & is executable.
 * 4. Fall back to "python".
 */
export function getPythonPath(output?: vscode.OutputChannel): string {
  // Ensure we always have an output channel
  if (!output) {
    if (!internalOutput) {
      internalOutput = vscode.window.createOutputChannel('Bikeshed Tools (Python)');
    }
    output = internalOutput;
    output.show(true);
  }

  const config = vscode.workspace.getConfiguration('bikeshedTools');
  let userPath = (config.get<string>('pythonPath') || 'python3').trim();

  output.appendLine(`🐍 Config setting 'pythonPath': ${userPath}`);

  // Strip accidental quotes
  userPath = userPath.replace(/^"(.*)"$/, '$1');
  output.appendLine(`🔧 Cleaned Python path: ${userPath}`);

  // Expand a leading ~
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  let expanded = userPath.startsWith('~')
    ? path.join(homeDir, userPath.slice(1))
    : userPath;

  // ────────────────────────────────────────────────────────────────────────────────
  // 1) Bare command (no path separators) → trust the shell to find it
  // ────────────────────────────────────────────────────────────────────────────────
  const hasSeparator = expanded.includes('/') || expanded.includes('\\');
  if (!hasSeparator && !path.isAbsolute(expanded)) {
    output.appendLine(`🔎 Treating '${expanded}' as command on PATH.`);
    return expanded;
  }

  // ────────────────────────────────────────────────────────────────────────────────
  // 2) Looks like a real path → validate
  // ────────────────────────────────────────────────────────────────────────────────
  const resolved = path.normalize(expanded);
  output.appendLine(`📌 Checking absolute path: ${resolved}`);

  if (!fs.existsSync(resolved)) {
    output.appendLine(`❌ Python executable not found at: ${resolved}`);
    return 'python'; // graceful fallback
  }

  if (process.platform !== 'win32') {
    try {
      fs.accessSync(resolved, fs.constants.X_OK);
    } catch {
      output.appendLine(`🚫 Found ${resolved} but it is not executable.`);
      return 'python';
    }
  }

  output.appendLine(`✅ Using Python at: ${resolved}`);
  return resolved;
}
