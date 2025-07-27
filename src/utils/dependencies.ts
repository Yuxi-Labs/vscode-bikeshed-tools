import * as vscode from 'vscode';
import { glob } from 'glob';
import which from 'which';
import cp from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

/* ─────────────────────────────────────────────────────────────────── */
/*  Public API                                                        */
/* ─────────────────────────────────────────────────────────────────── */

export interface Deps {
  /** Absolute path to the Python interpreter, or null if none found. */
  python: string | null;
  /**
   * Absolute path to the bikeshed CLI **or** the same path as `python`
   * when Bikeshed must be invoked as `python -m bikeshed`.
   */
  bikeshed: string | null;
}

/**
 * Discover Python + Bikeshed across:
 *  1. Workspace overrides (settings)
 *  2. Local .venv inside the workspace
 *  3. Anything on $PATH
 *  4. pipx / Windows‑Store installs
 *  5. Fallback: use `python -m bikeshed` when only the module exists
 */
export async function findDeps(): Promise<Deps> {
  /* 1 · explicit workspace settings ----------------------------------- */
  const cfg       = vscode.workspace.getConfiguration('bikeshedTools');
  const cfgPython = await validateExec(cfg.get<string>('pythonPath'));
  const cfgBS     = await validateExec(cfg.get<string>('bikeshedPath'));

  /* 2 · local virtual‑env (.venv) -------------------------------------- */
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  const venvDir = path.join(wsRoot, '.venv', process.platform === 'win32' ? 'Scripts' : 'bin');
  const venvPython = await validateExec(path.join(venvDir, exe('python')));
  const venvBS     = await validateExec(path.join(venvDir, exe('bikeshed')));

  /* 3 · PATH ----------------------------------------------------------- */
  const pathPython = findOnPath(['python3', 'python', 'py']);
  const pathBS     = findOnPath(['bikeshed']);

  /* 4 · pipx / Windows store ------------------------------------------ */
  const pipxBS = process.platform === 'win32' ? await findPipxBikeshed() : null;

  /* Consolidate in priority order ------------------------------------- */
  const python   = cfgPython ?? venvPython ?? pathPython ?? null;
  let   bikeshed = cfgBS     ?? venvBS     ?? pathBS     ?? pipxBS ?? null;

  /* 5 · Module‑only fallback ------------------------------------------ */
  if (!bikeshed && python && hasModule(python, 'bikeshed')) {
    bikeshed = python;                    // sentinel -> use `python -m bikeshed`
  }

  return { python, bikeshed };
}

/**
 * Refresh Bikeshed’s data cache.
 * Exported so buildSpec.ts can call it.
 */
export async function ensureBikeshedCache(
  pythonPath: string,
  out: vscode.OutputChannel
): Promise<boolean> {
  out.appendLine('⏬ Updating Bikeshed cache…');
  return new Promise(resolve => {
    const p = cp.spawn(pythonPath, ['-m', 'bikeshed', 'update', '--force']);
    p.stdout.on('data', d => out.append(d.toString()));
    p.stderr.on('data', d => out.append(d.toString()));
    p.on('close', c => {
      out.appendLine(c === 0
        ? '✅ Bikeshed cache updated.'
        : `❌ Cache update failed (code ${c}).`);
      resolve(c === 0);
    });
    p.on('error', e => {
      out.appendLine(`❌ Failed to run bikeshed update: ${(e as Error).message}`);
      resolve(false);
    });
  });
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Internal helpers                                                  */
/* ─────────────────────────────────────────────────────────────────── */

function exe(base: string) {
  return process.platform === 'win32' ? `${base}.exe` : base;
}

async function validateExec(p?: string | null): Promise<string | null> {
  if (!p) return null;
  try {
    await fs.access(p);
    return path.resolve(p);
  } catch {
    return null;
  }
}

function findOnPath(cmds: string[]): string | null {
  for (const c of cmds) {
    const r = which.sync(c, { nothrow: true });
    if (r) return r;
  }
  return null;
}

function hasModule(python: string, mod: string): boolean {
  try {
    cp.execFileSync(python, ['-m', mod, '--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Locate a pipx‑installed bikeshed.exe that isn’t on PATH (Windows). */
async function findPipxBikeshed(): Promise<string | null> {
  const la = process.env.LOCALAPPDATA;
  if (!la) return null;

  const pattern = path.join(
    la,
    'Packages',
    'PythonSoftwareFoundation.Python.*',
    'LocalCache',
    'local-packages',
    'Python??',
    'Scripts',
    'bikeshed.exe'
  );

  try {
    const [first] = await glob(pattern);
    return first ?? null;
  } catch {
    return null;
  }
}
