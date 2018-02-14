'use strict';

import {
    CompletionItem, CompletionItemKind
} from 'vscode-languageserver';
import { completion } from 'xqlint';
// import { XQLint, completion } from 'xqlint';
let XQLint = require('xqlint').XQLint
// import { completion } from 'xqlint';

interface MarkLogicFnDocsObject {
    name: string;
    prefix: string;
    summary: string;
    return: string;
    example: string[];
    params: MarkLogicParamsObject[];
}

interface MarkLogicParamsObject {
    name: string;
    type: string;
    description: string;
    optional?: boolean;
}

let hints = require('../etc/marklogic-hint-docs.json').xquery;
let allMlNamespaces: CompletionItem[] = Object.keys(hints).map((ns) => {
    let ci: CompletionItem = {
        label: ns,
        kind: CompletionItemKind.Class,
        data: ns + ".namespace"
    }
    return ci
});

function allMlFunctions(namespace: string): CompletionItem[] {
    return [].concat.apply(
        [],
        Object.keys(hints[namespace]).map((fn) => {
            let hint: MarkLogicFnDocsObject = hints[namespace][fn];
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
    ).filter((h: CompletionItem) => {return h.label !== 'dep'});
}

function buildContextCompletions(txt: string, line: number, col: number): CompletionItem[] {
    let contextCompletions: CompletionItem[] = [];
    let xql = new XQLint(txt);
    let completions = xql.getCompletions({line, col});
    completions.forEach((qco: completion) => {
        let kind: CompletionItemKind =
            xqToVscCompletions[qco.meta] ? xqToVscCompletions[qco.meta] : CompletionItemKind.Text;
        let hint: MarkLogicFnDocsObject = {
            name: qco.name, prefix: "", summary: qco.value,
            return: "", example: [], params: []
        }
        let ci: CompletionItem = {
            label: qco.name, kind: kind, data: hint
        }
        contextCompletions.push(ci);
    });
    return contextCompletions
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
    return `${docObject.prefix}:${docObject.name}(\n\t${neededParamsString}${middleComma}${optionParamsString})
    as ${docObject.return}`
}

let xqToVscCompletions: {[key:string]: CompletionItemKind} = {
    "function": CompletionItemKind.Function,
    "Let binding": CompletionItemKind.Variable,
    "Window variable": CompletionItemKind.Variable,
    "Function parameter": CompletionItemKind.Variable,
    "prefix": CompletionItemKind.Class
}

export {
    MarkLogicFnDocsObject,
    allMlFunctions, allMlNamespaces,
    buildContextCompletions,
    buildFunctionCompletion, buildFullFunctionSignature
}
