'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection, TextDocumentSyncKind,
	TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
	InitializeParams, InitializeResult, TextDocumentPositionParams,
	CompletionItem, CompletionItemKind, TextEdit, Range
} from 'vscode-languageserver';

import {
    DocObject,
    allMlFunctions, allMlNamespaces,
    buildCompletion, buildFullSignature
} from './lib/serverTools';

let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

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
            },
            definitionProvider: true
		}
	}
});

connection.listen();

connection.onCompletion((textDocumentPositionParams: TextDocumentPositionParams): CompletionItem[] => {
    let document = documents.get(textDocumentPositionParams.textDocument.uri)
    let offset = document.offsetAt(textDocumentPositionParams.position)
    // TODO: figure out if there's a preceding namespace
    return allMlFunctions.concat(allMlNamespaces)
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    let hint: DocObject = item.data;
    item.documentation = hint.summary;
    item.detail = buildFullSignature(hint);
    item.insertText = buildCompletion(hint);
    return item;
});

