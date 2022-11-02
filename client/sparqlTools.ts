'use strict'
import * as ml from 'marklogic'
import { workspace } from 'vscode'

export function getSparqlQueryForm(query: string): ml.sparqlQueryForm {
    //TODO: Use the language server for this
    const regex = /^(?:[^#]|<.*>)*?(SELECT|CONSTRUCT|ASK|DESCRIBE)/im
    const match = query.match(regex)
    return <ml.sparqlQueryForm>(match ? match[1].toUpperCase() : 'UNKNOWN')
}

export function getSparqlMimeType(queryForm: ml.sparqlQueryForm): ml.mimeType {
    switch (queryForm) {
    case 'SELECT':
    {
        return workspace.getConfiguration().get('marklogic.sparqlResultsType') as ml.sparqlResultsType
    }
    case 'CONSTRUCT':
    case 'DESCRIBE':
    {
        return workspace.getConfiguration().get('marklogic.rdfGraphType') as ml.rdfGraphType
    }
    case 'ASK':
    {
        const confType: ml.sparqlResultsType = workspace.getConfiguration().get('marklogic.sparqlResultsType')
        //ASK doesn't support text/csv.  Passing nothing instead will default to JSON
        return confType === 'text/csv' ? 'application/json' : confType
    }
    default:
    {
        return 'application/json' //Malformatted SPARQL - format for error
    }
    }
}
