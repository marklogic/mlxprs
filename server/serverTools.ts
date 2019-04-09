'use strict';

import {
    CompletionItem, CompletionItemKind
} from 'vscode-languageserver';
import {
    allMlSjsNamespaces, allMlSjsFunctions
} from './completionsSjs'
import {
    MarkLogicFnDocsObject, MarkLogicParamsObject
} from './serverTypes';

let xqyHints = require('./etc/marklogic-hint-docs.json').xquery;
let allMlXqyNamespaces: CompletionItem[] = Object.keys(xqyHints).map((ns) => {
    let ci: CompletionItem = {
        label: ns,
        kind: CompletionItemKind.Class,
        data: ns + ".namespace"
    }
    return ci
});
let allMlNamespaces: object = {
    'javascript': allMlSjsNamespaces,
    'xquery-ml': allMlXqyNamespaces
};
let allMlFunctions: object = {
    'javascript': allMlSjsFunctions,
    'xquery-ml': allMlXqyFunctions
};

/**
 * @deprecated
 * @param docObject An item from the MarkLogic docs JSON file
 * @param lang 'javascript' or 'xquery-ml'
 */
function mlFnDoc2CompletionItem(docObject: MarkLogicFnDocsObject, lang: string): CompletionItem {
    let nssep: string = {
        "javascript": ".",
        "xquery-ml": ":"
    }[lang] || ".";
    let completionItem: CompletionItem = {
        label: `${docObject.prefix}${nssep}${docObject.name}()`,
        kind: CompletionItemKind.Function,
        documentation: docObject.summary,
        detail: buildFullFunctionSignature(docObject),
        insertText: buildFunctionCompletion(docObject),
        data: docObject
    }
    return completionItem
}

function allMlXqyFunctions(namespace: string): CompletionItem[] {
    let theseHints: MarkLogicFnDocsObject[] = xqyHints[namespace] || [];
    return [].concat.apply(
        [],
        Object.keys(theseHints).map((fn) => {
            let hint: MarkLogicFnDocsObject = new MarkLogicFnDocsObject(theseHints[fn]);
            if (hint.return !== null) {
                let ci: CompletionItem = mlFnDoc2CompletionItem(hint, 'xquery-ml')
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
