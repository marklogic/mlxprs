'use strict';

import * as vsc from 'vscode';
import { RangeUtil } from './RangeUtil';
import { XmlFormatter, IXmlFormatterOptions } from './XmlFormatter';

const CFG_SECTION = 'xmlTools';
const CFG_SPLIT_NAMESPACES = 'splitXmlnsOnFormat';

export class XmlFormattingEditProvider implements vsc.DocumentFormattingEditProvider, vsc.DocumentRangeFormattingEditProvider {
    provideDocumentFormattingEdits(document: vsc.TextDocument, options: vsc.FormattingOptions): vsc.TextEdit[] {
        const range = RangeUtil.getRangeForDocument(document);

        return this._provideFormattingEdits(document, range, options);
    }

    provideDocumentRangeFormattingEdits(document: vsc.TextDocument, range: vsc.Range, options: vsc.FormattingOptions): vsc.TextEdit[] {
        return this._provideFormattingEdits(document, range, options);
    }

    private _provideFormattingEdits(document: vsc.TextDocument, range: vsc.Range, options: vsc.FormattingOptions): vsc.TextEdit[] {
        const splitNamespaces: boolean = vsc.workspace.getConfiguration(CFG_SECTION).get<boolean>(CFG_SPLIT_NAMESPACES, true);

        const formatterOptions: IXmlFormatterOptions = {
            preferSpaces: options.insertSpaces,
            tabSize: options.tabSize,
            splitNamespaces: splitNamespaces
        };

        const formatter = new XmlFormatter(formatterOptions);
        const xml = formatter.format(document.getText(range));

        return [vsc.TextEdit.replace(range, xml)];
    }
}