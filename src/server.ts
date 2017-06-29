'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection, TextDocumentSyncKind,
	TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
	InitializeParams, InitializeResult, TextDocumentPositionParams,
	CompletionItem, CompletionItemKind
} from 'vscode-languageserver';

interface DocObject {
    name: string;
    prefix: string;
    summary: string;
    return: string;
    example: string[];
    params: ParamsObject[];
}

interface ParamsObject {
    name: string;
    type: string;
    description: string;
    optional?: boolean;
}

let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
let hints = require('./etc/marklogic-hint-docs.json').xquery;
let allMlFunctions: CompletionItem[] = [].concat.apply(
    [],
    Object.keys(hints).map((ns) => {
        return Object.keys(hints[ns]).map((fn) => {
            let hint: DocObject = hints[ns][fn];
            if (hint.params === null) hint.params = [];
            if (hint.return !== null) {
                let ci: CompletionItem = {
                    label: `${hint.prefix}:${hint.name}()`,
                    kind: CompletionItemKind.Function,
                    data: hint
                }
                return ci;
            } else return {label: 'dep'};
        })
    })
).filter(h => {return h.label !== 'dep'});

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
    let hint: DocObject = item.data;
    item.documentation = hint.summary;
    item.detail = buildFullSignature(hint);
    item.insertText = buildCompletion(hint);
    return item;
});

function buildCompletion(docObject: DocObject): string {
    let neededParams: ParamsObject[] = docObject.params.filter(p => {return p.optional !== true});
    let optionParams: ParamsObject[] = docObject.params.filter(p => {return p.optional === true});
    let neededParamsString = neededParams.map(p => {return  '$'+p.name    }).join(', ');
    let optionParamsString = optionParams.map(p => {return '[$'+p.name+']'}).join(', ');
    let middleComma = ''; if (neededParams.length > 0 && optionParams.length > 0) middleComma = ', ';
    return `${docObject.prefix}:${docObject.name}(${neededParamsString}${middleComma}${optionParamsString})`
}

function buildFullSignature(docObject: DocObject): string {
    let neededParams: ParamsObject[] = docObject.params.filter(p => {return p.optional !== true});
    let optionParams: ParamsObject[] = docObject.params.filter(p => {return p.optional === true});
    let neededParamsString = neededParams.map(p => {return  '$'+p.name+' as '+p.type    }).join(",\n\t");
    let optionParamsString = optionParams.map(p => {return '[$'+p.name+' as '+p.type+']'}).join(",\n\t");
    let middleComma = ''; if (neededParams.length > 0 && optionParams.length > 0) middleComma = ",\n\t";
    return `${docObject.prefix}:${docObject.name}(\n\t${neededParamsString}${middleComma}${optionParamsString})
    as ${docObject.return}`
}
