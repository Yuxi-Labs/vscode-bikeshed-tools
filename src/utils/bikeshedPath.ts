import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';                // NEW

let internalOutput: vscode.OutputChannel | undefined;

/**
 * Resolve the Bikeshed CLI location.
 * – Honors `bikeshedTools.bikeshedPath` (default "bikeshed").
 * – If the value is a bare command, return it verbatim (let the shell find it).
 * – If it looks like a path, expand ~, validate existence & exec bit.
 * – Return undefined on failure so callers can decide what to do.
 */
export function getBikeshedPath(output?: vscode.OutputChannel): string | undefined {
  // Ensure an output channel
  if (!output) {
    if (!internalOutput) {
      internalOutput = vscode.window.createOutputChannel('Bikeshed Tools (Auto)');
    }
    output = internalOutput;
    output.show(true);
  }

  const config = vscode.workspace.getConfiguration('bikeshedTools');
  let userPath = (config.get<string>('bikeshedPath') || 'bikeshed').trim();

  output.appendLine(`🔍 Config setting 'bikeshedPath': ${userPath}`);

  // Strip accidental quotes
  userPath = userPath.replace(/^"(.*)"$/, '$1');
  output.appendLine(`🔧 Cleaned path: ${userPath}`);

  // Expand ~
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const expanded = userPath.startsWith('~')
    ? path.join(homeDir, userPath.slice(1))
    : userPath;

  // ────────────────────────────────────────────────────────────────────────────────
  // 1) Bare command (no separators, not absolute) → delegate to PATH
  // ────────────────────────────────────────────────────────────────────────────────
  const hasSeparator = expanded.includes('/') || expanded.includes('\\');
  if (!path.isAbsolute(expanded) && !hasSeparator) {
    output.appendLine(`📦 Treating '${expanded}' as command on PATH.`);
    return expanded;
  }

  // ────────────────────────────────────────────────────────────────────────────────
  // 2) Looks like a real path → validate
  // ────────────────────────────────────────────────────────────────────────────────
  const resolved = path.normalize(expanded);
  output.appendLine(`📌 Resolved absolute path: ${resolved}`);

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

/* ────────────────────────────────────────────────────────────────────────────── */
/*  Helper to download / refresh the Bikeshed cache on demand                    */
/* ────────────────────────────────────────────────────────────────────────────── */

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
