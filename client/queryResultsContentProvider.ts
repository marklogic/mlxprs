'use strict'

import { Event, EventEmitter, TextDocumentContentProvider, Uri } from 'vscode'

export class QueryResultsContentProvider implements TextDocumentContentProvider {
    private _onDidChange = new EventEmitter<Uri>();
    public _cache = new Map<string, Record<string, any>>();

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
    public updateResultsForUri(uri: Uri, val: Record<string, any>): void {
        this._cache.set(uri.toString(), val)
    }

    private unwrap(o: Record<string, any>): string {
        if (o['format'] === 'xml') {
            return JSON.parse(JSON.stringify(o['value']))
        }
        if (o['format'] === 'text' && o['datatype'] === 'node()') {
            return this.decodeBinaryText(o['value'])
        }
        if (o['format'] === 'text' && o['datatype'] === 'other') {
            return o['value']
        }
        return JSON.stringify(o['value'])
    }

    private decodeBinaryText(arr: Uint8Array): string {
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
        const results = this._cache.get(uri.toString())
        if (results) {
            const r = results as Array<Record<string, any>>
            return r.map(o => this.unwrap(o)).join('\n')
        }
        return 'pending...'
    }

    public static encodeLocation(uri: Uri, host: string, port: number): Uri {
        const query = JSON.stringify([uri.toString()])
        const newUri = Uri.parse(`${QueryResultsContentProvider.scheme}://${host}:${port}/${uri.path}?${query}`)
        return newUri
    }
}
