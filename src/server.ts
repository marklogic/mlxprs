'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection, TextDocumentSyncKind,
	TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
	InitializeParams, InitializeResult, TextDocumentPositionParams,
	CompletionItem, CompletionItemKind
} from 'vscode-languageserver';

let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
let hints = require('./etc/marklogic-hint-docs.json').xquery;
let allMlFunctions = [].concat.apply(
    [],
    Object.keys(hints).map((ns) => {
        return Object.keys(hints[ns]).map((fn) => {
            return {
                label: ns + ":" + fn,
                kind: CompletionItemKind.Function,
                data: {namespace: ns, fn: fn}
            }
        })
    })
);

let documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootPath;
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			// Tell the client that the server supports code complete
			completionProvider: {
				resolveProvider: true
			}
		}
	}
});

connection.listen();

connection.onCompletion((textDocumentPositionParams: TextDocumentPositionParams): CompletionItem[] => {
    return allMlFunctions;
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    let docObject = hints[item.data.namespace][item.data];
    item.detail = item.data.namespace + ":" + item.data.fn;
    item.documentation = hints[item.data.namespace][item.data.fn].summary;
    return item;
});
