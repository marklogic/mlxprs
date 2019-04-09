'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection,
	TextDocuments,
	InitializeResult, TextDocumentPositionParams,
	CompletionItem, CompletionItemKind, TextDocument
} from 'vscode-languageserver';

import {
    allMlSjsFunctions, allMlSjsNamespaces
} from './completionsSjs';
import {
    allMlXqyFunctions, allMlXqyNamespaces
} from './completionsXqy'

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
                triggerCharacters: [":", "$", "."]
            },
            definitionProvider: false
		}
	}
});

connection.listen();
let  b: RegExp = /\b/g;       // barrier
let xw: RegExp = /[\w\d-]+/g; // xquery word
let xv: RegExp = /[$\w\d-]/g; // variable

let jwv: RegExp = /[\w\d]+/g;  // JS word or variable

function getTheseTokens(document: TextDocument, offset: number): string[] {
    let preceding = document.getText().slice(0, offset)
    let thisLine = preceding.slice(preceding.lastIndexOf('\n'))
    let theseTokens: string[] = thisLine.split(b)
    return theseTokens
};

connection.onCompletion((textDocumentPositionParams: TextDocumentPositionParams): CompletionItem[] => {
    let document = documents.get(textDocumentPositionParams.textDocument.uri)
    let lang = document.languageId || 'javascript'
    let offset = document.offsetAt(textDocumentPositionParams.position)

    return {
        'xquery-ml': completeXQuery,
        'javascript': completeSJS
    }[lang](document, offset)
})

function completeXQuery(document: TextDocument, offset: number): CompletionItem[] {
    let allCompletions: CompletionItem[] = [];
    let theseTokens = getTheseTokens(document, offset)

    // shortcircuit: don't complete on dot in XQuery
    if (theseTokens.slice(-1)[0] === ".") {return allCompletions}

    else if (theseTokens.slice(-1)[0] === ":" && theseTokens.slice(-2)[0].match(jwv)) {
        let namespace: string = theseTokens.slice(-2)[0]
        allCompletions = allCompletions.concat(allMlXqyFunctions(namespace))
    } else if (theseTokens.slice(-2)[0].match(xw) && theseTokens.slice(-1)[0] === ":") {
        let namespace: string = theseTokens.slice(-3)[0]
        allCompletions = allCompletions.concat(allMlXqyFunctions(namespace))
    } else if (allCompletions.length === 0 || allCompletions[0].kind === CompletionItemKind.Class) {
        allCompletions = allCompletions.concat(allMlXqyNamespaces)
    }

    return allCompletions
};

function completeSJS(document: TextDocument, offset: number): CompletionItem[] {
    let allCompletions: CompletionItem[] = [];
    let theseTokens = getTheseTokens(document, offset)

    // shortcircuit: don't complete on colon in Javascript
    if (theseTokens.slice(-1)[0] === ":") {return allCompletions}

    if (theseTokens.slice(-1)[0] === "." && theseTokens.slice(-2)[0].match(jwv)) {
        let namespace: string = theseTokens.slice(-2)[0]
        allCompletions = allCompletions.concat(allMlSjsFunctions(namespace))
    } else if (theseTokens.slice(-2)[0].match(jwv) && theseTokens.slice(-1)[0] === ".") {
        let namespace: string = theseTokens.slice(-3)[0]
        allCompletions = allCompletions.concat(allMlSjsFunctions(namespace))
    } else if (allCompletions.length === 0 || allCompletions[0].kind === CompletionItemKind.Class) {
        allCompletions = allCompletions.concat(allMlSjsNamespaces)
    }

    return allCompletions
}

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item;
});

