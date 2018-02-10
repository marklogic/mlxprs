'use strict';

import {
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

let hints = require('../etc/marklogic-hint-docs.json').xquery;
let allMlNamespaces: CompletionItem[] = Object.keys(hints).map((ns) => {
    let ci: CompletionItem = {
        label: ns,
        kind: CompletionItemKind.Class,
        data: ns + ".namespace"
    }
    return ci
});

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

function buildCompletion(docObject: DocObject): string {
    let neededParams: ParamsObject[] = docObject.params.filter(p => {return p.optional !== true});
    let optionParams: ParamsObject[] = docObject.params.filter(p => {return p.optional === true});
    let neededParamsString = neededParams.map(p => {return  '$'+p.name    }).join(', ');
    let optionParamsString = optionParams.map(p => {return '[$'+p.name+']'}).join(', ');
    let middleComma = ''; if (neededParams.length > 0 && optionParams.length > 0) middleComma = ', ';
    return `${docObject.name}(${neededParamsString}${middleComma}${optionParamsString})`
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

export {
    DocObject,
    allMlFunctions, allMlNamespaces,
    buildCompletion, buildFullSignature
}
