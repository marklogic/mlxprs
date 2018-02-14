'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection,
	TextDocuments,
	InitializeResult, TextDocumentPositionParams,
	CompletionItem, CompletionItemKind
} from 'vscode-languageserver';

import {
    MarkLogicFnDocsObject,
    allMlFunctions, allMlNamespaces,
    buildFunctionCompletion, buildFullFunctionSignature, buildContextCompletions
} from './lib/serverTools';
import { pos, completion } from 'xqlint';

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
                resolveProvider: true,
                triggerCharacters: [":", "$"]
            },
            definitionProvider: true
		}
	}
});

connection.listen();
let b: RegExp = /\b/g;
let w: RegExp = /[\w\d-]+/g;
let v: RegExp = /[$\w\d-]/g;

connection.onCompletion((textDocumentPositionParams: TextDocumentPositionParams): CompletionItem[] => {
    let document = documents.get(textDocumentPositionParams.textDocument.uri)
    let offset = document.offsetAt(textDocumentPositionParams.position)
    let line: number = textDocumentPositionParams.position.line
    let col: number = textDocumentPositionParams.position.character
    let pos: pos = {line: line, col: col}

    let allCompletions: CompletionItem[] = buildContextCompletions(document.getText(), line, col)


    let preceding = document.getText().slice(0, offset)
    let thisLine = preceding.slice(preceding.lastIndexOf('\n'))
    let theseTokens: string[] = thisLine.split(b)
    if (theseTokens.slice(-1)[0] === ":" && theseTokens.slice(-2)[0].match(w)) {
        let namespace: string = theseTokens.slice(-2)[0]
        allCompletions = allCompletions.concat(allMlFunctions(namespace))
    } else if (theseTokens.slice(-2)[0].match(w) && theseTokens.slice(-1)[0] === ":") {
        let namespace: string = theseTokens.slice(-3)[0]
        allCompletions = allCompletions.concat(allMlFunctions(namespace))
    } else if (allCompletions.length === 0 || allCompletions[0].kind === CompletionItemKind.Class) {
        allCompletions = allCompletions.concat(allMlNamespaces)
    }

    return allCompletions
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item;
});

