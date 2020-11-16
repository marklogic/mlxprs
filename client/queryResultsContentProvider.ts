'use strict'

import { Event, EventEmitter, TextDocumentContentProvider, Uri, window, workspace } from 'vscode'
import { contentType } from 'marklogic'

export class QueryResultsContentProvider implements TextDocumentContentProvider {
    private _onDidChange = new EventEmitter<Uri>();
    public _cache = new Map<string, string>();

    static scheme = 'mlquery';
    /**
     * Expose an event to signal changes of _virtual_ documents
     * to the editor
     */
    get onDidChange(): Event<Uri> { return this._onDidChange.event }
    public update(uri: Uri): void { this._onDidChange.fire(uri) }

    /**
     * Set the TextDocumentContentProvider local cache to the query results
     * @param uri the 'mlquery' uri representing the query (cache: key)
     * @param val the results of that query (cache: value)
     */
    public updateResultsForUri(uri: Uri, val: Array<Record<string, any>>): Map<string, string> {
        const stringResults: string = val.map(o => this.unwrap(o)).join('\n')
        console.debug(`${Date.now()} writing string results for ${uri.toString()} ${stringResults.length}"`)
        return this._cache.set(uri.toString(), stringResults)
    }

    private unwrap(o: Record<string, any>): string {
        if (o['format'] === 'xml') {
            return JSON.parse(JSON.stringify(o['value']))
        }
        if (o['format'] === 'text' && o['datatype'] === 'node()') {
            return QueryResultsContentProvider.decodeBinaryText(o['value'])
        }
        if (o['format'] === 'text' && o['datatype'] === 'other') {
            return o['value']
        }
        return JSON.stringify(o['value'])
    }

    public static decodeBinaryText(arr: Uint8Array): string {
        if ((typeof arr[0]) === 'string') {
            return arr.toString()
        }
        let str = ''
        for (let i = 0; i < arr.length; i++) {
            str += '%' + ('0' + arr[i].toString(16)).slice(-2)
        }
        str = decodeURIComponent(str)
        return str
    }

    public provideTextDocumentContent(uri: Uri): string {
        console.debug(`${Date.now()} ***** Accessing cache for URI: ${uri.toString()}`)
        const results: string = this._cache.get(uri.toString())
        if (results || results === '') {
            return results
        }
        return 'pending...'
    }

    public static encodeLocation(uri: Uri, host: string, port: number): Uri {
        const query = uri.path
        const newUri = Uri.parse(`${QueryResultsContentProvider.scheme}://${host}:${port}/${uri.path}?${query}`)
        return newUri
    }

    /**
     * Cache a query response so VS Code will show the results in a new editor window
     * @param uri the URI of the VS Code document that sent the query
     * @param response the content of what was returned from the MarkLogic query
     * @returns Promise responseUri where VS Code will retrieve the content to show @async
     */
    public async writeResponseToUri(uri: Uri, response: Array<Record<string, any>>): Promise<Uri> {
        let fmt = 'nothing'
        if (response.length > 0) {
            fmt = response[0]['format']
        } else {
            window.showInformationMessage(`Query in ${uri.query} got an empty response from ${uri.authority}`)
        }
        const responseUri = Uri.parse(`${QueryResultsContentProvider.scheme}://${uri.authority}${uri.path}.${fmt}?${uri.query}`)
        this.updateResultsForUri(responseUri, response)
        console.debug(`${Date.now()} ***** Writing cache for URI: ${uri.toString()}`)
        this.update(responseUri)
        await new Promise(resolve => setTimeout(resolve, 60))
        return responseUri
    }

    /**
     * Cache a SPARQL query response so VS Code will show the results in a new editor window
     * @param uri the URI of the VS Code document that sent the query
     * @param response the content of what was returned from the MarkLogic query
     * @returns Promise responseUri where VS Code will retrieve the content to show @async
     */
    public async writeSparqlResponseToUri(uri: Uri, response: Record<string, unknown>): Promise<Uri> {
        const contentType: contentType = workspace.getConfiguration().get('marklogic.sparqlContentType')
        const fmt: string = contentType.toLowerCase().replace(/^\w+\//, '')
        const responseUri = Uri.parse(`${QueryResultsContentProvider.scheme}://${uri.authority}${uri.path}.${fmt}?${uri.query}`)
        console.debug(`${Date.now()} ***** Writing cache for URI: ${uri.toString()}`)
        const readyResponse = fmt === 'json' ? JSON.stringify(response) : response.toString()
        this._cache.set(responseUri.toString(), readyResponse)
        this.update(responseUri)
        await new Promise(resolve => setTimeout(resolve, 60))
        return responseUri
    }

    /**
     * Cache a query *error* response so VS Code will show the results in a new editor window,
     * This should be caught in the promise reject. It may be
     * - a MarkLogic error (query was received, but couldn't run successfully), or
     * - a network-level error (couldn't reach host, 401 unauthorized, etc.)
     * @param uri the URI of the VS Code document that sent the query
     * @param error the content of the reject promise from the MarkLogic query
     * @returns Promise responseUri where VS Code will retrieve the content to show @async
     */
    public async handleError(uri: Uri, error: any): Promise<Uri> {
        let errorMessage = ''
        const errorResultsObject = { datatype: 'node()', format: 'json', value: error }
        if (error.body === undefined || error.body.message === undefined) {
            // problem reaching MarkLogic
            errorMessage = error.message
        } else {
            // MarkLogic error: useful message in body.errorResponse
            errorMessage = error.body.errorResponse.message
            errorResultsObject.value = error.body
        }
        const responseUri = Uri.parse(`${QueryResultsContentProvider.scheme}://${uri.authority}${uri.path}-error.json?${uri.query}`)
        window.showErrorMessage(JSON.stringify(errorMessage))
        this.updateResultsForUri(responseUri, [errorResultsObject])
        this.update(responseUri)
        await new Promise(resolve => setTimeout(resolve, 60))
        return responseUri
    }
}
