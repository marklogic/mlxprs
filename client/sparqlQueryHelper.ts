'use strict'
import * as ml from 'marklogic'
import { workspace } from 'vscode'

export function getSparqlQueryForm(query: string): ml.SparqlQueryType {
    //TODO: Use the language server for this
    const regex = /^(?:[^#]|<.*>)*?(SELECT|CONSTRUCT|ASK|DESCRIBE)/im
    const match = query.match(regex)
    return <ml.SparqlQueryType>(match ? match[1].toLowerCase() : 'unknown')
}

export function getSparqlResponseType(queryType: ml.SparqlQueryType): ml.SparqlResponseFormat {
    switch (queryType) {
        case 'select':
        {
            return workspace.getConfiguration().get('marklogic.sparqlSelectResponseType') as ml.SparqlResponseFormat
        }
        case 'construct':
        case 'describe':
        {
            return workspace.getConfiguration().get('marklogic.sparqlGraphResponseType') as ml.SparqlResponseFormat
        }
        case 'ask':
        {
            return workspace.getConfiguration().get('marklogic.sparqlAskResponseType') as ml.SparqlResponseFormat
        }
        default:
        {
            return 'application/json' //Malformatted SPARQL - format for error
        }
    }
}