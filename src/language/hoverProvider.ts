import * as vscode from 'vscode';

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Hover text for Bikeshed metadata keys                                      */
/* ──────────────────────────────────────────────────────────────────────────── */

const hoverInfoMap: Record<string, string> = {
  title:       '📝 **Title** — full title of the spec.',
  shortname:   '🔗 **Shortname** — used in URLs and IDs.',
  level:       '📶 **Level** — version number of the spec.',
  status:      '📜 **Status** — maturity label (e.g. `w3c/WD`).',
  url:         '🌐 **URL** — canonical URL for the spec.',
  latest:      '📍 **Latest** — link to the latest TR version.',
  previous:    '⏪ **Previous** — link to the preceding TR version.',
  ed:          '🛠 **ED** — URL of the Editor’s Draft.',
  editor:      '💁 **Editor** — `<name>, <org>, <email>` triple.',
  abstract:    '✏️ **Abstract** — one‑paragraph summary.',
  boilerplate: '📑 **Boilerplate** — `yes`/`no` to include BS boilerplate.',
  inlinejson:  '🧩 **InlineJSON** — embed JSON literal for preprocessor.',
  repository:  '📦 **Repository** — URL of source repo.',
  feedback:    '💌 **Feedback** — public comment list URL.'
};

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Hover provider (optional fallback for non-LSP mode)                        */
/* ──────────────────────────────────────────────────────────────────────────── */

export class BikeshedHoverProvider implements vscode.HoverProvider {
  provideHover(
    doc: vscode.TextDocument,
    pos: vscode.Position
  ): vscode.ProviderResult<vscode.Hover> {
    const range = doc.getWordRangeAtPosition(pos, /[A-Za-z][\w-]*/);
    if (!range) return;

    const key = doc.getText(range).toLowerCase();
    const msg = hoverInfoMap[key];

    const md = new vscode.MarkdownString(msg ?? `Bikeshed key: \`${key}\``);
    md.isTrusted = true;

    return new vscode.Hover(md, range);
  }
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Completion provider (client-side only)                                     */
/* ──────────────────────────────────────────────────────────────────────────── */

export function registerCompletions(): vscode.Disposable {
  const items = Object.entries(hoverInfoMap).map(([key, doc]) => {
    const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Property);
    item.insertText = key + ': ';
    item.detail = 'Bikeshed metadata key';
    const md = new vscode.MarkdownString(doc);
    md.isTrusted = true;
    item.documentation = md;
    return item;
  });

  const provider: vscode.CompletionItemProvider = {
    provideCompletionItems(document, position) {
      const textBefore = document
        .getText(new vscode.Range(new vscode.Position(0, 0), position))
        .toLowerCase();

      const insideMeta = textBefore.lastIndexOf('<pre') > textBefore.lastIndexOf('</pre');
      if (!insideMeta) return;

      const line = document.lineAt(position.line).text;
      const isStartOfLine = /^\s*[\w-]*$/.test(line.slice(0, position.character));
      return isStartOfLine ? items : undefined;
    }
  };

  return vscode.languages.registerCompletionItemProvider('bikeshed', provider, ':');
}
