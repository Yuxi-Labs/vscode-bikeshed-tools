/**
 * Completion provider for Bikeshed metadata keys.
 * (Pure client-side – the language-server adds the heavy stuff.)
 */

import * as vscode from 'vscode';

/* ----------------------------------------------------------------- */
/*  Keys & docs – extend / hydrate at runtime if you wish            */
/* ----------------------------------------------------------------- */
const META_KEYS: readonly string[] = [
  'Title',
  'Shortname',
  'Level',
  'Status',
  'ED',
  'TR',
  'Latest',
  'Previous',
  'Editor',
  'Abstract'
];

export function registerCompletions(): vscode.Disposable {
  const items = META_KEYS.map(key => {
    const item = new vscode.CompletionItem(
      `${key}:`,
      vscode.CompletionItemKind.Property
    );
    item.insertText = `${key}: `;
    item.detail = 'Bikeshed metadata key';
    return item;
  });

  const provider: vscode.CompletionItemProvider = {
    provideCompletionItems(document, position) {
      /* Only at start of lines inside <pre class="metadata">…</pre> */
      const upToPos = document
        .getText(new vscode.Range(new vscode.Position(0, 0), position))
        .toLowerCase();
      const inMeta =
        upToPos.lastIndexOf('<pre') > upToPos.lastIndexOf('</pre');

      if (!inMeta) return;

      const line = document.lineAt(position.line).text;
      if (/^[\s\w-]*$/.test(line.slice(0, position.character))) {
        return items;
      }
      return undefined;
    }
  };

  /* trigger on “:” or Ctrl-Space */
  return vscode.languages.registerCompletionItemProvider(
    'bikeshed',
    provider,
    ':'
  );
}
