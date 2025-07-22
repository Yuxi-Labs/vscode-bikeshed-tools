import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let internalOutput: vscode.OutputChannel | undefined;

/**
 * Resolves the path to the Python executable to run Bikeshed as a module.
 * Prioritizes user-defined setting in `bikeshedTools.pythonPath`, defaults to "python".
 * Logs everything to a shared output channel for sanity.
 * 
 * @param output Optional output channel for logging
 * @returns A valid Python executable path
 */
export function getPythonPath(output?: vscode.OutputChannel): string {
  if (!output) {
    if (!internalOutput) {
      internalOutput = vscode.window.createOutputChannel('Bikeshed Tools (Python)');
    }
    output = internalOutput;
    output.show(true);
  }

  const config = vscode.workspace.getConfiguration('bikeshedTools');
  let userPath = config.get<string>('pythonPath')?.trim() || 'python';

  output.appendLine(`🐍 Config setting 'pythonPath': ${userPath}`);

  // Strip accidental quotes (it happens more than you'd think)
  userPath = userPath.replace(/^"(.*)"$/, '$1');
  output.appendLine(`🔧 Cleaned Python path: ${userPath}`);

  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const expanded = userPath.startsWith('~')
    ? path.join(homeDir, userPath.slice(1))
    : userPath;

  const resolved = path.resolve(expanded);
  output.appendLine(`📌 Resolved Python path: ${resolved}`);

  // Check if file exists
  if (!fs.existsSync(resolved)) {
    output.appendLine(`❌ Python executable not found at: ${resolved}`);
    return 'python'; // fallback to default
  }

  // Check exec permissions on non-Windows
  if (process.platform !== 'win32') {
    try {
      fs.accessSync(resolved, fs.constants.X_OK);
    } catch {
      output.appendLine(`🚫 Python found at ${resolved} but is not executable.`);
      return 'python';
    }
  }

  output.appendLine(`✅ Using Python at: ${resolved}`);
  return resolved;
}
