import * as vscode from 'vscode';

/**
 * Let the user pick the Bikeshed CLI (wrapper or bikeshed.py) and save it to
 *  bikeshedTools.bikeshedPath  (workspace setting).
 */
export async function selectBikeshed(): Promise<void> {
  const pick = await vscode.window.showOpenDialog({
    title: 'Select Bikeshed CLI',
    canSelectMany: false,
    canSelectFolders: false,
    canSelectFiles: true,
    filters:
      process.platform === 'win32'
        ? { Executable: ['exe', 'bat', 'cmd', 'py'] }
        : undefined
  });

  if (!pick?.length) {
    return;
  }

  await vscode.workspace
    .getConfiguration('bikeshedTools')
    .update('bikeshedPath', pick[0].fsPath, vscode.ConfigurationTarget.Workspace);

  vscode.window.showInformationMessage(
    `Bikeshed CLI set to: ${pick[0].fsPath}`
  );
}
