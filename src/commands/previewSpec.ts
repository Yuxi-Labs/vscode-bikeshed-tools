import * as vscode from 'vscode';
import { showPreview } from '../preview/previewManager';

export async function previewSpec(output?: vscode.OutputChannel): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('Open a Bikeshed (.bs) file first.');
    return;
  }
  const doc = editor.document;
  if (doc.languageId !== 'bikeshed' || !doc.fileName.endsWith('.bs')) {
    vscode.window.showErrorMessage('Current file is not a Bikeshed (.bs) spec.');
    return;
  }
  await showPreview(doc, output);
}
