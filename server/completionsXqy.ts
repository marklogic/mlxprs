'use strict'

import {
    CompletionItem, CompletionItemKind
} from 'vscode-languageserver'
import {
    MarkLogicFnDocsObject, MarkLogicParamsObject
} from './completionTypes'

const xqyHints = require('./etc/marklogic-hint-docs.json').xquery
const allMlXqyNamespaces: CompletionItem[] = Object.keys(xqyHints).map((ns) => {
    const ci: CompletionItem = {
        label: ns,
        kind: CompletionItemKind.Class,
        data: ns + '.namespace'
    }
    return ci
})

function buildFunctionCompletion(docObject: MarkLogicFnDocsObject): string {
    const neededParams: MarkLogicParamsObject[] = docObject.params.filter(p => { return p.optional !== true })
    const optionParams: MarkLogicParamsObject[] = docObject.params.filter(p => { return p.optional === true })
    const neededParamsString = neededParams.map(p => { return '$' + p.name }).join(', ')
    const optionParamsString = optionParams.map(p => { return '[$' + p.name + ']' }).join(', ')
    let middleComma = ''; if (neededParams.length > 0 && optionParams.length > 0) middleComma = ', '
    return `${docObject.name}(${neededParamsString}${middleComma}${optionParamsString})`
}

function buildFullFunctionSignature(docObject: MarkLogicFnDocsObject): string {
    const neededParams: MarkLogicParamsObject[] = docObject.params.filter(p => { return p.optional !== true })
    const optionParams: MarkLogicParamsObject[] = docObject.params.filter(p => { return p.optional === true })
    const neededParamsString = neededParams.map(p => { return '$' + p.name + ' as ' + p.type }).join(',\n\t')
    const optionParamsString = optionParams.map(p => { return '[$' + p.name + ' as ' + p.type + ']' }).join(',\n\t')
    let middleComma = ''; if (neededParams.length > 0 && optionParams.length > 0) middleComma = ',\n\t'
    const nothing: string = docObject.params.length ? '\n\t' : ''
    return `${docObject.prefix}:${docObject.name}(${nothing}${neededParamsString}${middleComma}${optionParamsString})
  as ${docObject.return}`
}


function mlFnDoc2CompletionItem(docObject: MarkLogicFnDocsObject): CompletionItem {
    const nssep = ':'
    const completionItem: CompletionItem = {
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
    const theseHints: MarkLogicFnDocsObject[] = xqyHints[namespace] || []
    return [].concat(
        ...Object.keys(theseHints).map((fn) => {
            const hint: MarkLogicFnDocsObject = new MarkLogicFnDocsObject(theseHints[fn])
            if (hint.return !== null) {
                const ci: CompletionItem = mlFnDoc2CompletionItem(hint)
                return ci
            } else return { label: 'dep' }
        })
    ).filter((h: CompletionItem) => { return h.label !== 'dep' })
}

export {
    allMlXqyNamespaces, allMlXqyFunctions
}
