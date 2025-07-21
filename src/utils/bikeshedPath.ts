import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function getBikeshedPath(): string | undefined {
  const config = vscode.workspace.getConfiguration('bikeshedTools');
  const customPath = config.get<string>('bikeshedPath') || 'bikeshed';

  // If it's just 'bikeshed', assume it's in PATH
  if (customPath === 'bikeshed') {
    return customPath;
  }

  // Cross-platform home directory resolution
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';

  // Expand ~ if present
  const resolvedPath = customPath.startsWith('~')
    ? path.join(homeDir, customPath.slice(1))
    : customPath;

  // Check if path exists
  if (!fs.existsSync(resolvedPath)) {
    vscode.window.showErrorMessage(`⚠️ Bikeshed CLI not found at path: ${resolvedPath}`);
    return undefined;
  }

  // Optional: Check if it's executable (mostly meaningful on Unix)
  try {
    fs.accessSync(resolvedPath, fs.constants.X_OK);
  } catch {
    vscode.window.showErrorMessage(`🚫 Bikeshed found at ${resolvedPath} but is not executable.`);
    return undefined;
  }

  return resolvedPath;
}
