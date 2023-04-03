'use strict';

import * as vsc from 'vscode';
import { RangeUtil } from '../xmlFormatting/RangeUtil';
import { XqyFormatter } from './XqyFormatter';

export class XqyFormattingEditProvider implements vsc.DocumentFormattingEditProvider, vsc.DocumentRangeFormattingEditProvider {
    provideDocumentFormattingEdits(document: vsc.TextDocument, options: vsc.FormattingOptions): vsc.TextEdit[] {
        const range = RangeUtil.getRangeForDocument(document);
        return this._provideFormattingEdits(document, range, options);
    }

    provideDocumentRangeFormattingEdits(document: vsc.TextDocument, range: vsc.Range, options: vsc.FormattingOptions): vsc.TextEdit[] {
        return this._provideFormattingEdits(document, range, options);
    }

    private _provideFormattingEdits(document: vsc.TextDocument, range: vsc.Range, options: vsc.FormattingOptions): vsc.TextEdit[] {
        const formatter = new XqyFormatter();
        const xqy = formatter.formatXqy(document.getText(range));
        return [vsc.TextEdit.replace(range, xqy)];
    }
}