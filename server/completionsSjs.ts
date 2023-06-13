/*
 * Copyright (c) 2023 MarkLogic Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

import {
    CompletionItem, CompletionItemKind
} from 'vscode-languageserver';
import {
    MarkLogicFnDocsObject, MarkLogicParamsObject
} from './completionTypes';

export type contentType = {
    javascript: object,
    xquery: object
}
import hints = require('./etc/marklogic-hint-docs.json');
const sjsHints = (hints as contentType).javascript;

const allMlSjsNamespaces: CompletionItem[] = Object.keys(sjsHints).map(ns => {
    const ci: CompletionItem = {
        label: ns,
        kind: CompletionItemKind.Class,
        data: ns + '.namespace'
    };
    return ci;
});

function buildFullFunctionSignature(docObject: MarkLogicFnDocsObject): string {
    const neededParams: MarkLogicParamsObject[] = docObject.params.filter(p => {
        return p.optional !== true;
    });
    const optionParams: MarkLogicParamsObject[] = docObject.params.filter(p => {
        return p.optional === true;
    });
    const neededParamsString = neededParams.map(p => {
        return `${p.name} <${p.type}>`;
    }).join(',\n\t');
    const optionParamsString = optionParams.map(p => {
        return `[${p.name} <${p.type}>]`;
    }).join(',\n\t');
    let middleComma = ''; if (neededParams.length > 0 && optionParams.length > 0) middleComma = ',\n\t';
    const nothing: string = docObject.params.length ? '\n\t' : '';
    return `${docObject.prefix}:${docObject.name}(${nothing}${neededParamsString}${middleComma}${optionParamsString})
  as ${docObject.return}`;
}

function buildFunctionCompletion(docObject: MarkLogicFnDocsObject): string {
    const neededParams: MarkLogicParamsObject[] = docObject.params.filter(p => {
        return p.optional !== true;
    });
    const optionParams: MarkLogicParamsObject[] = docObject.params.filter(p => {
        return p.optional === true;
    });
    const neededParamsString = neededParams.map(p => {
        return `${p.name}`;
    }).join(', ');
    const optionParamsString = optionParams.map(p => {
        return `[${p.name}]`;
    }).join(', ');
    let middleComma = ''; if (neededParams.length > 0 && optionParams.length > 0) middleComma = ', ';
    return `${docObject.name}(${neededParamsString}${middleComma}${optionParamsString})`;
}

function mlFnDoc2CompletionItem(docObject: MarkLogicFnDocsObject): CompletionItem {
    const nssep = '.';
    const completionItem: CompletionItem = {
        label: `${docObject.prefix}${nssep}${docObject.name}()`,
        kind: CompletionItemKind.Function,
        documentation: docObject.summary,
        detail: buildFullFunctionSignature(docObject),
        insertText: buildFunctionCompletion(docObject),
        data: docObject
    };
    return completionItem;
}

function allMlSjsFunctions(namespace: string): CompletionItem[] {
    const theseHints: MarkLogicFnDocsObject[] = sjsHints[namespace] || [];
    return [].concat(
        ...Object.keys(theseHints).map(fn => {
            const hint: MarkLogicFnDocsObject = new MarkLogicFnDocsObject(theseHints[fn]);
            if (hint.return !== null) {
                const ci: CompletionItem = mlFnDoc2CompletionItem(hint);
                return ci;
            } else return { label: 'dep' };
        })
    ).filter((h: CompletionItem) => {
        return h.label !== 'dep';
    });
}

export {
    allMlSjsNamespaces, allMlSjsFunctions
};
