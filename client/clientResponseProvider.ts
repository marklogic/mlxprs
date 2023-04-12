'use strict';

import { contentType, RowsResponse, RowsResponseFormat } from 'marklogic';
import { Event, EventEmitter, TextDocumentContentProvider, Uri, window, workspace } from 'vscode';

export class ClientResponseProvider implements TextDocumentContentProvider {
    // This class provides implementation details for virtual documents that store the responses and errors from the MarkLogic client
    // so that those the information in the virutal documents can be displayed in an editor tab
    //
    // Note the Uri class used is here is required by the TextDocumentContentProvider
    // and is directly associated with a specific editor tab.
    // It is used here to provide a unique key to the virtual documents stored in this class's "responseResults" field.
    // It is not related to MarkLogic document URIs.
    private _onDidChange = new EventEmitter<Uri>();
    public responseResults = new Map<string, string>();

    static scheme = 'mlquery';
    /**
     * Expose an event to signal changes of _virtual_ documents
     * to the editor
     */
    get onDidChange(): Event<Uri> {
        return this._onDidChange.event;
    }
    public update(resultsEditorTabIdentifier: Uri): void {
        this._onDidChange.fire(resultsEditorTabIdentifier);
    }

    /**
     * Set the TextDocumentContentProvider local cache to the query results
     * @param resultsEditorTabIdentifier the 'mlquery' resultsEditorTabIdentifier representing the query (cache: key)
     * @param val the results of that query (cache: value)
     */
    public updateResultsForUri(resultsEditorTabIdentifier: Uri, val: Array<Record<string, unknown>>): Map<string, string> {
        const stringResults: string = val.map(o => this.unwrap(o)).join('\n');
        console.debug(`${Date.now()} writing string results for ${resultsEditorTabIdentifier.toString()} ${stringResults.length}"`);
        return this.responseResults.set(resultsEditorTabIdentifier.toString(), stringResults);
    }

    private unwrap(o: Record<string, any>): string {
        if (o['format'] === 'xml') {
            return JSON.parse(JSON.stringify(o['value']));
        }
        if (o['format'] === 'text' && o['datatype'] === 'node()') {
            return ClientResponseProvider.decodeBinaryText(o['value']);
        }
        if (o['format'] === 'text' && o['datatype'] === 'other') {
            return o['value'];
        }
        return JSON.stringify(o['value']);
    }

    public static decodeBinaryText(arr: Uint8Array): string {
        if ((typeof arr[0]) === 'string') {
            return arr.toString();
        }
        let str = '';
        for (let i = 0; i < arr.length; i++) {
            str += '%' + ('0' + arr[i].toString(16)).slice(-2);
        }
        str = decodeURIComponent(str);
        return str;
    }

    public provideTextDocumentContent(resultsEditorTabIdentifier: Uri): string {
        console.debug(`${Date.now()} ***** Accessing responseResults for resultsEditorTabIdentifier: ${resultsEditorTabIdentifier.toString()}`);
        const results: string = this.responseResults.get(resultsEditorTabIdentifier.toString());
        if (results || results === '') {
            return results;
        }
        return 'pending...';
    }

    public static encodeLocation(editorTabUri: Uri, host: string, port: number): Uri {
        const query = editorTabUri.path;
        const resultsEditorTabIdentifier = Uri.parse(`${ClientResponseProvider.scheme}://${host}:${port}/${editorTabUri.path}?${query}`);
        return resultsEditorTabIdentifier;
    }

    /**
     * Cache a query response so VS Code will show the results in a new editor window
     * @param editorTabUri the URI of the VS Code document that sent the query
     * @param response the content of what was returned from the MarkLogic query
     * @returns Promise resultsEditorTabIdentifier where VS Code will retrieve the content to show @async
     */
    public async writeResponseToUri(editorTabUri: Uri, response: Array<Record<string, any>>): Promise<Uri> {
        let fmt = 'nothing';
        if (response.length > 0) {
            fmt = response[0]['format'];
        } else {
            window.showInformationMessage(`Query in ${editorTabUri.query} got an empty response from ${editorTabUri.authority}`);
        }
        const resultsEditorTabIdentifier = this.buildResultsEditorTabIdentifier(editorTabUri, fmt);
        this.updateResultsForUri(resultsEditorTabIdentifier, response);
        console.debug(`${Date.now()} ***** Saving responseResults for resultsEditorTabIdentifier: ${editorTabUri.toString()}`);
        this.update(resultsEditorTabIdentifier);
        await new Promise(resolve => setTimeout(resolve, 60));
        return resultsEditorTabIdentifier;
    }


    public async writeRowsResponseToUri(editorTabUri: Uri, response: RowsResponse, resultFormat: RowsResponseFormat): Promise<Uri> {
        const resultsEditorTabIdentifier = this.buildResultsEditorTabIdentifier(editorTabUri, resultFormat);
        let readyResponse: string = null;
        if (resultFormat === 'json') {
            readyResponse = JSON.stringify(response);
        } else {
            readyResponse = response.toString();
        }
        this.responseResults.set(resultsEditorTabIdentifier.toString(), readyResponse);
        this.update(resultsEditorTabIdentifier);
        await new Promise(resolve => setTimeout(resolve, 60));
        return resultsEditorTabIdentifier;
    }

    /**
     * Cache a SPARQL query response so VS Code will show the results in a new editor window
     * @param editorTabUri the URI of the VS Code document that sent the query
     * @param response the content of what was returned from the MarkLogic query
     * @returns Promise resultsEditorTabIdentifier where VS Code will retrieve the content to show @async
     */
    public async writeSparqlResponseToUri(editorTabUri: Uri, response: Record<string, any>): Promise<Uri> {
        const contentType: contentType = workspace.getConfiguration().get('marklogic.sparqlContentType');
        const fmt: string = (contentType) ? contentType.toLowerCase().replace(/^\w+\//, '') : 'json';
        const resultsEditorTabIdentifier = this.buildResultsEditorTabIdentifier(editorTabUri, 'json');
        console.debug(`${Date.now()} ***** Saving responseResults for resultsEditorTabIdentifier: ${resultsEditorTabIdentifier.toString()}`);
        const readyResponse = fmt === 'json' ? JSON.stringify(response) : response.toString();
        this.responseResults.set(resultsEditorTabIdentifier.toString(), readyResponse);
        this.update(resultsEditorTabIdentifier);
        await new Promise(resolve => setTimeout(resolve, 60));
        return resultsEditorTabIdentifier;
    }

    /**
     * Cache a query *error* response so VS Code will show the results in a new editor window,
     * This should be caught in the promise reject. It may be
     * - a MarkLogic error (query was received, but couldn't run successfully), or
     * - a network-level error (couldn't reach host, 401 unauthorized, etc.)
     * @param editorTabUri the URI of the VS Code document that sent the query
     * @param error the content of the reject promise from the MarkLogic query
     * @returns Promise resultsEditorTabIdentifier where VS Code will retrieve the content to show @async
     */
    public async handleError(editorTabUri: Uri, error: any): Promise<Uri> {
        const errorResultsObject = ClientResponseProvider.buildErrorResultsObject(error);
        const resultsEditorTabIdentifier = this.buildResultsEditorTabIdentifier(editorTabUri, 'json', '-error');
        window.showErrorMessage(JSON.stringify(errorResultsObject.errorMessage));
        this.updateResultsForUri(resultsEditorTabIdentifier, [errorResultsObject]);
        this.update(resultsEditorTabIdentifier);
        await new Promise(resolve => setTimeout(resolve, 60));
        return resultsEditorTabIdentifier;
    }

    buildResultsEditorTabIdentifier(editorTabUri: Uri, uriSuffix: string, errorStr = '') {
        let validUriPath = editorTabUri.path + errorStr;
        if (validUriPath.startsWith('//')) {
            validUriPath = validUriPath.substring(1);
        }
        return Uri.parse(`${ClientResponseProvider.scheme}://${editorTabUri.authority}${validUriPath}.${uriSuffix}?${editorTabUri.query}`);
    }

    public static buildErrorResultsObject(error: any): ErrorResultsObject {
        const errorResultsObject = { datatype: 'node()', format: 'json', value: error, errorMessage: '' };
        if (error.body === undefined || error.body.message === undefined) {
            // problem reaching MarkLogic
            errorResultsObject.errorMessage = error.message;
        } else {
            // MarkLogic error: useful message in body.errorResponse
            errorResultsObject.errorMessage = error.body.errorResponse.message;
            errorResultsObject.value = error.body;
        }
        return errorResultsObject;
    }
}

export type ErrorResultsObject = {
    datatype: string,
    format: string,
    value: any,
    errorMessage: string
}
