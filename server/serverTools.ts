'use strict';

import {
    CompletionItem, CompletionItemKind
} from 'vscode-languageserver';

class MarkLogicFnDocsObject {
    name: string;
    prefix: string;
    summary: string;
    return: string;
    example: string[];
    params: MarkLogicParamsObject[] = [];

    constructor(o: any) {
        this.name = o.name;
        this.prefix = o.prefix;
        this.summary = o.summary;
        this.return = o.return;
        this.example = o.example || [];
        this.params = o.params || [];
    }
}

interface MarkLogicParamsObject {
    name: string;
    type: string;
    description: string;
    optional?: boolean;
}

let hints = require('./etc/marklogic-hint-docs.json').xquery;
let allMlNamespaces: CompletionItem[] = Object.keys(hints).map((ns) => {
    let ci: CompletionItem = {
        label: ns,
        kind: CompletionItemKind.Class,
        data: ns + ".namespace"
    }
    return ci
});

function mlFnDoc2CompletionItem(docObject: MarkLogicFnDocsObject): CompletionItem {
    let completionItem: CompletionItem = {
        label: `${docObject.prefix}:${docObject.name}()`,
        kind: CompletionItemKind.Function,
        documentation: docObject.summary,
        detail: buildFullFunctionSignature(docObject),
        insertText: buildFunctionCompletion(docObject),
        data: docObject
    }
    return completionItem
}

function allMlFunctions(namespace: string): CompletionItem[] {
    let theseHints: MarkLogicFnDocsObject[] = hints[namespace] || [];
    return [].concat.apply(
        [],
        Object.keys(theseHints).map((fn) => {
            let hint: MarkLogicFnDocsObject = new MarkLogicFnDocsObject(theseHints[fn]);
            if (hint.return !== null) {
                let ci: CompletionItem = mlFnDoc2CompletionItem(hint)
                return ci;
            } else return {label: 'dep'};
        })
    ).filter((h: CompletionItem) => {return h.label !== 'dep'});
}

function buildFunctionCompletion(docObject: MarkLogicFnDocsObject): string {
    let neededParams: MarkLogicParamsObject[] = docObject.params.filter(p => {return p.optional !== true});
    let optionParams: MarkLogicParamsObject[] = docObject.params.filter(p => {return p.optional === true});
    let neededParamsString = neededParams.map(p => {return  '$'+p.name    }).join(', ');
    let optionParamsString = optionParams.map(p => {return '[$'+p.name+']'}).join(', ');
    let middleComma = ''; if (neededParams.length > 0 && optionParams.length > 0) middleComma = ', ';
    return `${docObject.name}(${neededParamsString}${middleComma}${optionParamsString})`
}

function buildFullFunctionSignature(docObject: MarkLogicFnDocsObject): string {
    let neededParams: MarkLogicParamsObject[] = docObject.params.filter(p => {return p.optional !== true});
    let optionParams: MarkLogicParamsObject[] = docObject.params.filter(p => {return p.optional === true});
    let neededParamsString = neededParams.map(p => {return  '$'+p.name+' as '+p.type    }).join(",\n\t");
    let optionParamsString = optionParams.map(p => {return '[$'+p.name+' as '+p.type+']'}).join(",\n\t");
    let middleComma = ''; if (neededParams.length > 0 && optionParams.length > 0) middleComma = ",\n\t";
    let nothing: string = docObject.params.length ? "\n\t" : "";
    return `${docObject.prefix}:${docObject.name}(${nothing}${neededParamsString}${middleComma}${optionParamsString})
    as ${docObject.return}`
}

let xqToVscCompletions: {[key:string]: CompletionItemKind} = {
    "function": CompletionItemKind.Function,
    "Let binding": CompletionItemKind.Variable,
    "Window variable": CompletionItemKind.Variable,
    "Local variable": CompletionItemKind.Variable,
    "Function parameter": CompletionItemKind.Variable,
    "prefix": CompletionItemKind.Class
}

export {
    allMlFunctions, allMlNamespaces
}
