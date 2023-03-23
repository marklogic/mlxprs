'use strict';

import {
    IPCMessageReader, IPCMessageWriter,
    createConnection, Connection,
    TextDocuments,
    TextDocumentPositionParams,
    CompletionItem, CompletionItemKind, InitializeParams, InitializeResult,
    TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import {
    allMlSjsFunctions, allMlSjsNamespaces
} from './completionsSjs';
import {
    allMlXqyFunctions, allMlXqyNamespaces
} from './completionsXqy';

const connection: Connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
documents.listen(connection);

connection.onInitialize((): InitializeResult => {
    return {
        capabilities: {
            // Tell the client that the server works in FULL text document sync mode
            textDocumentSync: TextDocumentSyncKind.Full,
            // Tell the client that the server supports code complete
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: [':', '$', '.']
            },
            definitionProvider: false
        }
    };
});

connection.listen();
const b = /\b/g;         // barrier
const xw = /[\w\d-]+/g;  // xquery word
const xv = /[$\w\d-]/g;  // variable

const jwv = /[\w\d]+/g;  // JS word or variable

function getTheseTokens(document: TextDocument, offset: number): string[] {
    const preceding = document.getText().slice(0, offset);
    const thisLine = preceding.slice(preceding.lastIndexOf('\n'));
    const theseTokens: string[] = thisLine.split(b);
    return theseTokens;
}

function completeXQuery(document: TextDocument, offset: number): CompletionItem[] {
    let allCompletions: CompletionItem[] = [];
    const theseTokens = getTheseTokens(document, offset);

    // shortcircuit: don't complete on dot in XQuery
    if (theseTokens.slice(-1)[0] === '.') { return allCompletions; }

    else if (theseTokens.slice(-1)[0] === ':' && theseTokens.slice(-2)[0].match(jwv)) {
        const namespace: string = theseTokens.slice(-2)[0];
        allCompletions = allCompletions.concat(allMlXqyFunctions(namespace));
    } else if (theseTokens.slice(-2)[0].match(xw) && theseTokens.slice(-1)[0] === ':') {
        const namespace: string = theseTokens.slice(-3)[0];
        allCompletions = allCompletions.concat(allMlXqyFunctions(namespace));
    } else if (allCompletions.length === 0 || allCompletions[0].kind === CompletionItemKind.Class) {
        allCompletions = allCompletions.concat(allMlXqyNamespaces);
    }

    return allCompletions;
}

function completeSJS(document: TextDocument, offset: number): CompletionItem[] {
    let allCompletions: CompletionItem[] = [];
    const theseTokens = getTheseTokens(document, offset);

    // shortcircuit: don't complete on colon in Javascript
    if (theseTokens.slice(-1)[0] === ':') { return allCompletions; }

    if (theseTokens.slice(-1)[0] === '.' && theseTokens.slice(-2)[0].match(jwv)) {
        const namespace: string = theseTokens.slice(-2)[0];
        allCompletions = allCompletions.concat(allMlSjsFunctions(namespace));
    } else if (theseTokens.slice(-2)[0].match(jwv) && theseTokens.slice(-1)[0] === '.') {
        const namespace: string = theseTokens.slice(-3)[0];
        allCompletions = allCompletions.concat(allMlSjsFunctions(namespace));
    } else if (allCompletions.length === 0 || allCompletions[0].kind === CompletionItemKind.Class) {
        allCompletions = allCompletions.concat(allMlSjsNamespaces);
    }

    return allCompletions;
}


connection.onCompletion((textDocumentPositionParams: TextDocumentPositionParams): CompletionItem[] => {
    const document = documents.get(textDocumentPositionParams.textDocument.uri);
    const lang = document.languageId || 'javascript';
    const offset = document.offsetAt(textDocumentPositionParams.position);

    return {
        'xquery-ml': completeXQuery,
        'javascript': completeSJS
    }[lang](document, offset);
});


connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item;
});

