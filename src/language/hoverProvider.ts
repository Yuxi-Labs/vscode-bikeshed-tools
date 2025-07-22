import * as vscode from 'vscode';

const hoverInfoMap: Record<string, string> = {
  title: '📝 **Title**: The full name of the specification.',
  shortname: '🔗 **Shortname**: Used for URLs and document IDs.',
  level: '📶 **Level**: Version number of the spec.',
  status: '📜 **Status**: Indicates the maturity (e.g., `w3c/WD`, `w3c/CR`).',
  ed: '🔧 **Editor\'s Draft URL**: Link to the Editor’s Draft.',
  url: '🌐 **URL**: Canonical URL for the spec.',
  latest: '📍 **Latest Version URL**: Points to the latest version of the document.',
  previous: '⏪ **Previous Version URL**: Refers to the prior publication.'
};

export class BikeshedHoverProvider implements vscode.HoverProvider {
  /**
   * Provide hover information for Bikeshed metadata keys.
   */
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(position, /[A-Za-z][\w-]*/);
    if (!range) return;

    const word = document.getText(range).toLowerCase();
    const hoverText = hoverInfoMap[word];

    if (hoverText) {
      return new vscode.Hover(new vscode.MarkdownString(hoverText), range);
    }

    return;
  }
}
