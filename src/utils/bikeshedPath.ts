import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let internalOutput: vscode.OutputChannel | undefined;

/**
 * Resolves the full path to the Bikeshed CLI based on user settings.
 * Always logs to a shared output channel if none is passed in.
 * @param output Optional output channel for logging
 * @returns A valid Bikeshed path or undefined
 */
export function getBikeshedPath(output?: vscode.OutputChannel): string | undefined {
  if (!output) {
    if (!internalOutput) {
      internalOutput = vscode.window.createOutputChannel('Bikeshed Tools (Auto)');
    }
    output = internalOutput;
    output.show(true); // force display
  }

  const config = vscode.workspace.getConfiguration('bikeshedTools');
  let userPath = config.get<string>('bikeshedPath')?.trim() ?? 'bikeshed';

  output.appendLine(`🔍 Config setting 'bikeshedPath': ${userPath}`);

  // Strip quotes
  userPath = userPath.replace(/^"(.*)"$/, '$1');
  output.appendLine(`🔧 Cleaned path: ${userPath}`);

  // If it's the default case
  if (userPath === 'bikeshed') {
    output.appendLine('📦 Using system-installed Bikeshed (assumes it is in PATH)');
    return 'bikeshed';
  }

  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const expandedPath = userPath.startsWith('~')
    ? path.join(homeDir, userPath.slice(1))
    : userPath;

  output.appendLine(`📂 Expanded path: ${expandedPath}`);

  const resolvedPath = path.resolve(expandedPath);
  output.appendLine(`📌 Resolved absolute path: ${resolvedPath}`);

  if (!fs.existsSync(resolvedPath)) {
    output.appendLine(`❌ Bikeshed CLI not found at: ${resolvedPath}`);
    return undefined;
  }

  if (process.platform !== 'win32') {
    try {
      fs.accessSync(resolvedPath, fs.constants.X_OK);
    } catch (err) {
      output.appendLine(`🚫 Bikeshed found but not executable at: ${resolvedPath}`);
      return undefined;
    }
  }

  output.appendLine(`✅ Using Bikeshed CLI at: ${resolvedPath}`);
  return resolvedPath;
}
