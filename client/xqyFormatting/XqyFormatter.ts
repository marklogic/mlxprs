'use strict';

import { window } from 'vscode';
import { CodeFormatter, XQLint } from '@quodatum/xqlint';

const DEFAULT_OPTIONS = { styleCheck: true };

export class XqyFormatter {
    ast: unknown;

    newLine: string;
    indentPattern: string;
    splitNamespaces: boolean;

    formatXqy(xqy: string): string {
        window.showInformationMessage('Formatting XQuery');
        const linter = new XQLint(xqy, undefined, DEFAULT_OPTIONS);
        const formatter = new CodeFormatter(linter.getAST());
        this.ast = linter.getAST();
        console.debug(linter.printAST());
        const formatted = formatter.format();
        console.debug(formatted.trim());

        const markers = linter.getMarkers().sort(function (a, b) {
            return a.sl - b.sl;
        });
        console.debug(markers);

        return formatted;
    }
}
