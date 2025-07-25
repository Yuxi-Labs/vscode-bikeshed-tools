import * as vscode from 'vscode';

/**
 * Let the user pick a Python interpreter and save it to
 *  bikeshedTools.pythonPath  (workspace setting).
 */
export async function selectPython(): Promise<void> {
  const pick = await vscode.window.showOpenDialog({
    title: 'Select Python Interpreter',
    canSelectMany: false,
    canSelectFolders: false,
    canSelectFiles: true,
    filters:
      process.platform === 'win32'
        ? { Executable: ['exe', 'bat', 'cmd'] }
        : undefined
  });

  if (!pick?.length) {
    return;
  }

  await vscode.workspace
    .getConfiguration('bikeshedTools')
    .update('pythonPath', pick[0].fsPath, vscode.ConfigurationTarget.Workspace);

  vscode.window.showInformationMessage(
    `Python interpreter set to: ${pick[0].fsPath}`
  );
}
