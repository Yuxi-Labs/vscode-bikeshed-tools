// src/utils/resolveBikeshed.ts
import * as vscode from 'vscode';
import { glob }    from 'glob';          // ① explicit import (ESM v10)
import * as which  from 'which';
import * as fs     from 'fs/promises';
import * as path   from 'path';

/** Safely returns the first workspace folder’s fsPath (or empty string). */
function wsRoot(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
}

export async function resolveBikeshed(): Promise<string | undefined> {
  const cfg = vscode.workspace.getConfiguration('bikeshedTools');

  /* 1 · explicit setting wins (trim quotes / whitespace) */
  const explicit = (cfg.get<string>('bikeshedPath') || '')
    .trim()
    .replace(/^"(.*)"$/, '$1');

  if (explicit) {
    try {
      await fs.access(explicit);
      return explicit; // ✅ valid custom path
    } catch {
      /* fall through to other strategies */
    }
  }

  /* 2 · local venv */
  const candidates = [
    path.join(wsRoot(), '.venv', 'bin', 'bikeshed'),
    path.join(wsRoot(), '.venv', 'Scripts', 'bikeshed.exe')
  ];

  for (const p of candidates) {
    try {
      await fs.access(p);
      return p; // ✅ found inside project venv
    } catch { /* ignore */ }
  }

  /* 3 · anywhere on the PATH */
  try {
    return which.sync('bikeshed');
  } catch { /* ignore */ }

  /* 4 · Windows Store / pipx install */
  if (process.platform === 'win32') {
    const appData = process.env.LOCALAPPDATA;
    if (appData) {
      // e.g.  "%LOCALAPPDATA%\Packages\PythonSoftwareFoundation.Python.3_*\LocalCache\local-packages\PythonXY\Scripts\bikeshed.exe"
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
        if (matches.length) return matches[0]; // ✅ first match wins
      } catch { /* ignore */ }
    }
  }

  /* 🙅 nothing found */
  return undefined;
}
