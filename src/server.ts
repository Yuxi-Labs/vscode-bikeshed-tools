import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  HoverParams,
  Hover,
  InitializeResult,
  Position
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocumentSyncKind } from 'vscode-languageserver';

/* ───────────────────────────── */
/*  LSP bootstrap                */
/* ───────────────────────────── */
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((): InitializeResult => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Full,
    completionProvider: {
      triggerCharacters: [':', '[', '{', '<', "'"]
    },
    hoverProvider: true
  }
}));

/* ───────────────────────────── */
/*  Placeholder completion + hover data – hydrate at start-up from Bikeshed  */
/* ───────────────────────────── */
const bikeshedMetaKeys = [
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
] as const;

const hoverDocs: Record<string, string> = {
  title:      '**Title** — full spec title.',
  shortname:  '**Shortname** — used in URLs & IDs.',
  level:      '**Level** — spec “version” (1, 2 …).',
  status:     '**Status** — ED, WD, CR …'
  // …extend…
};

/* ───────────────────────────── */
/*  Helpers                      */
/* ───────────────────────────── */
function getWordAt(doc: TextDocument, pos: Position): string | null {
  const line = doc.getText({
    start: { line: pos.line, character: 0 },
    end:   { line: pos.line, character: Number.MAX_SAFE_INTEGER }
  });

  let start = pos.character;
  while (start > 0 && /[\w-]/.test(line.charAt(start - 1))) start--;

  let end = pos.character;
  while (end < line.length && /[\w-]/.test(line.charAt(end))) end++;

  return start === end ? null : line.slice(start, end);
}

/* ───────────────────────────── */
/*  1 · Completion               */
/* ───────────────────────────── */
connection.onCompletion((params: CompletionParams) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  const linePrefix = doc
    .getText({
      start: { line: params.position.line, character: 0 },
      end:   params.position
    })
    .trimStart();

  // Very naive context check – refine later
  if (/^[\w-]*$/.test(linePrefix)) {
    return bikeshedMetaKeys.map<CompletionItem>(k => ({
      label: `${k}:`,
      kind: CompletionItemKind.Property,
      insertText: `${k}: `
    }));
  }
  return [];
});

/* ───────────────────────────── */
/*  2 · Hover                    */
/* ───────────────────────────── */
connection.onHover((params: HoverParams) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const word = getWordAt(doc, params.position);
  if (!word) return null;

  const md = hoverDocs[word.toLowerCase()];
  if (!md) return null;

  const hover: Hover = {
    contents: { kind: 'markdown', value: md }
  };
  return hover;
});

/* ───────────────────────────── */
documents.listen(connection);
connection.listen();
