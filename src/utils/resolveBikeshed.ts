import * as vscode from 'vscode';
import { glob } from 'glob';
import * as which from 'which';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Returns the root folder of the current workspace, or an empty string if not found.
 */
function wsRoot(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
}

/**
 * Attempts to find the Bikeshed CLI from various locations:
 *  - Explicitly configured path
 *  - Local virtual environment
 *  - System PATH
 *  - Windows Store-style pipx installs
 */
export async function resolveBikeshed(): Promise<string | undefined> {
  const cfg = vscode.workspace.getConfiguration('bikeshedTools');

  // 1. Check for explicit user setting
  const explicit = (cfg.get<string>('bikeshedPath') || '')
    .trim()
    .replace(/^"(.*)"$/, '$1');

  if (explicit) {
    try {
      await fs.access(explicit);
      return explicit;
    } catch {
      // ignored, fall through to next
    }
  }

  // 2. Check for local virtual environment installs
  const candidates = [
    path.join(wsRoot(), '.venv', 'bin', 'bikeshed'),               // Linux/macOS
    path.join(wsRoot(), '.venv', 'Scripts', 'bikeshed.exe')        // Windows
  ];

  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // ignored, keep looking
    }
  }

  // 3. Look on PATH via which
  try {
    return which.sync('bikeshed');
  } catch {
    // not found
  }

  // 4. Windows Store pipx fallback
  if (process.platform === 'win32') {
    const appData = process.env.LOCALAPPDATA;
    if (appData) {
      const pattern = path.join(
        appData,
        'Packages',
        'PythonSoftwareFoundation.Python.*',
        'LocalCache',
        'local-packages',
        'Python??',
        'Scripts',
        'bikeshed.exe'
      );

      try {
        const matches = await glob(pattern);
        if (matches.length) {
          return matches[0]; // return the first match
        }
      } catch {
        // ignored
      }
    }
  }

  // If nothing was found
  return undefined;
}
