import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

let internalOutput: vscode.OutputChannel | undefined;

/**
 * Resolve the Bikeshed CLI location.
 * – Honors `bikeshedTools.bikeshedPath` (default "bikeshed").
 * – Returns the bare command when the value is just a filename (no dir)
 *   regardless of path‑separator characters in Windows.
 * – Otherwise expands ~, normalises and validates the path.
 * – Returns undefined on failure so callers can decide what to do.
 */
export function getBikeshedPath(output?: vscode.OutputChannel): string | undefined {
  if (!output) {
    if (!internalOutput) {
      internalOutput = vscode.window.createOutputChannel('Bikeshed Tools (Auto)');
    }
    output = internalOutput;
    output.show(true);
  }

  const cfg = vscode.workspace.getConfiguration('bikeshedTools');
  let userPath = (cfg.get<string>('bikeshedPath') || 'bikeshed').trim();

  output.appendLine(`🔍 Config setting 'bikeshedPath': ${userPath}`);

  // Strip accidental quotes
  userPath = userPath.replace(/^"(.*)"$/, '$1');

  // Expand ~
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const expanded = userPath.startsWith('~') ? path.join(home, userPath.slice(1)) : userPath;

  /* ────────────────────────────────────────────────────────────────────────── */
  /*  Bare command → no directory component & not absolute                    */
  /* ────────────────────────────────────────────────────────────────────────── */
  if (!path.isAbsolute(expanded) && expanded === path.basename(expanded)) {
    output.appendLine(`📦 Treating '${expanded}' as command on PATH.`);
    return expanded;
  }

  /* ────────────────────────────────────────────────────────────────────────── */
  /*  Treat as explicit path                                                  */
  /* ────────────────────────────────────────────────────────────────────────── */
  const resolved = path.normalize(expanded);
  output.appendLine(`📌 Resolved path: ${resolved}`);

  if (!fs.existsSync(resolved)) {
    output.appendLine(`❌ Bikeshed CLI not found at: ${resolved}`);
    return undefined;
  }

  if (process.platform !== 'win32') {
    try {
      fs.accessSync(resolved, fs.constants.X_OK);
    } catch {
      output.appendLine(`🚫 Found ${resolved} but it is not executable.`);
      return undefined;
    }
  }

  output.appendLine(`✅ Using Bikeshed CLI at: ${resolved}`);
  return resolved;
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Helper to download / refresh the Bikeshed cache on demand                 */
/* ──────────────────────────────────────────────────────────────────────────── */
export async function ensureBikeshedCache(
  pythonPath: string,
  output: vscode.OutputChannel
): Promise<boolean> {
  output.appendLine('⏬ Updating Bikeshed cache…');

  return new Promise<boolean>(resolve => {
    const proc = cp.spawn(pythonPath, ['-m', 'bikeshed', 'update', '--force']);

    proc.stdout.on('data', d => output.append(d.toString()));
    proc.stderr.on('data', d => output.append(d.toString()));

    proc.on('close', code => {
      output.appendLine(
        code === 0 ? '✅ Bikeshed cache updated.' : `❌ Cache update failed (code ${code}).`
      );
      resolve(code === 0);
    });

    proc.on('error', err => {
      output.appendLine(`❌ Failed to run bikeshed update: ${err.message}`);
      resolve(false);
    });
  });
}
