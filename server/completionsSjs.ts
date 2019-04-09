'use strict';

import {
  CompletionItem, CompletionItemKind
} from 'vscode-languageserver';
import {
  MarkLogicFnDocsObject, MarkLogicParamsObject
} from './serverTypes';

let sjsHints = require('./etc/marklogic-hint-docs.json').javascript;

let allMlSjsNamespaces: CompletionItem[] = Object.keys(sjsHints).map(ns => {
    let ci: CompletionItem = {
        label: ns,
        kind: CompletionItemKind.Class,
        data: ns + ".namespace"
    }
    return ci
})

function allMlSjsFunctions(namespace: string): CompletionItem[] {
  let theseHints: MarkLogicFnDocsObject[] = sjsHints[namespace] || [];
  return [].concat.apply(
      [],
      Object.keys(theseHints).map(fn => {
          let hint: MarkLogicFnDocsObject = new MarkLogicFnDocsObject(theseHints[fn]);
          if (hint.return !== null) {
              let ci: CompletionItem = mlFnDoc2CompletionItem(hint)
              return ci;
          } else return {label: 'dep'};
      })
  ).filter((h: CompletionItem) => {return h.label !== 'dep'})
}

function mlFnDoc2CompletionItem(docObject: MarkLogicFnDocsObject): CompletionItem {
  let nssep: string = '.'
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

function buildFunctionCompletion(docObject: MarkLogicFnDocsObject): string {
  let neededParams: MarkLogicParamsObject[] = docObject.params.filter(p => {return p.optional !== true});
  let optionParams: MarkLogicParamsObject[] = docObject.params.filter(p => {return p.optional === true});
  let neededParamsString = neededParams.map(p => {return  '$'+p.name    }).join(', ');
  let optionParamsString = optionParams.map(p => {return '[$'+p.name+']'}).join(', ');
  let middleComma = ''; if (neededParams.length > 0 && optionParams.length > 0) middleComma = ', ';
  return `${docObject.name}(${neededParamsString}${middleComma}${optionParamsString})`
}

export {
  allMlSjsNamespaces, allMlSjsFunctions
}
