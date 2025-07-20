import * as vscode from 'vscode';

export async function buildSpec() {
  const config = vscode.workspace.getConfiguration('bikeshedTools');
  const bikeshedPath = config.get<string>('bikeshedPath') || 'bikeshed';

  
  vscode.window.showInformationMessage(`Running Bikeshed using: ${bikeshedPath}`);
}
