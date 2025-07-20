import * as vscode from 'vscode';

const hoverInfoMap = new Map([
  ['Title', '📝 **Title**: The full name of the specification.'],
  ['Shortname', '🔗 **Shortname**: Used for URLs and document IDs.'],
  ['Level', '📶 **Level**: Version number of the spec.'],
  ['Status', '📜 **Status**: Indicates the maturity (e.g., `w3c/WD`, `w3c/CR`).']
]);

export class BikeshedHoverProvider implements vscode.HoverProvider {
  provideHover(doc: vscode.TextDocument, pos: vscode.Position) {
    const range = doc.getWordRangeAtPosition(pos, /[A-Za-z]+/);
    const word = doc.getText(range);
    const message = hoverInfoMap.get(word);

    if (message) {
      return new vscode.Hover(message, range);
    }
    return undefined;
  }
}
