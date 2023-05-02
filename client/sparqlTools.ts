'use strict'
import * as ml from 'marklogic'
import { workspace } from 'vscode'

export function getSparqlQueryForm(query: string): ml.GraphsQueryType {
    //TODO: Use the language server for this
    const regex = /^(?:[^#]|<.*>)*?(SELECT|CONSTRUCT|ASK|DESCRIBE)/im
    const match = query.match(regex)
    return <ml.GraphsQueryType>(match ? match[1].toLowerCase() : 'unknown')
}

export function getSparqlResponseType(queryType: ml.GraphsQueryType): ml.GraphsResponseFormat {
    switch (queryType) {
        case 'select':
        {
            return workspace.getConfiguration().get('marklogic.sparqlSelectResponseType') as ml.GraphsResponseFormat
        }
        case 'construct':
        case 'describe':
        {
            return workspace.getConfiguration().get('marklogic.sparqlGraphResponseType') as ml.GraphsResponseFormat
        }
        case 'ask':
        {
            return workspace.getConfiguration().get('marklogic.sparqlAskResponseType') as ml.GraphsResponseFormat
        }
        default:
        {
            return 'application/json' //Malformatted SPARQL - format for error
        }
    }
}