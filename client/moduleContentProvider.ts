'use strict'

import { Event, EventEmitter, TextDocumentContentProvider, Uri } from 'vscode'
import { MarklogicClient, MlClientParameters, sendXQuery } from './marklogicClient'
import { QueryResultsContentProvider } from './queryResultsContentProvider'

const listModulesQuery = `
        xdmp:invoke-function(
            function() {cts:uris()},
            <options xmlns='xdmp:eval'>
                <database>{xdmp:modules-database()}</database>
            </options>)`

const moduleQuery = (modulePath: string): string => {
    return `
        xdmp:invoke-function(
            function() {fn:doc('${modulePath}')},
            <options xmlns='xdmp:eval'>
                <database>{xdmp:modules-database()}</database>
            </options>)`
}

export class ModuleContentProvider implements TextDocumentContentProvider {
    static scheme = 'mlmodule'
    private _onDidChange = new EventEmitter<Uri>()
    private _cache = new Map<string, string>()
    private _mlClient: MarklogicClient
    private _clientParams: MlClientParameters

    public initialize(client: MarklogicClient): void {
        this._mlClient = client
    }

    async provideTextDocumentContent(uri: Uri): Promise<string> {
        if (!this._cache.get(uri.toString())) {
            await this.cacheModule(uri)
        }
        return this._cache.get(uri.toString())
    }

    get onDidChange(): Event<Uri> { return this._onDidChange.event }

    public async cacheModule(uri: Uri): Promise<Uri> {
        return sendXQuery(this._mlClient, moduleQuery(uri.path))
            .result(
                (fulfill: Record<string, any>[]) => {
                    const moduleBinaryContent: Uint8Array = fulfill[0].value
                    const moduleContent: string = QueryResultsContentProvider.decodeBinaryText(moduleBinaryContent)
                    this._cache.set(uri.toString(), moduleContent)
                    return uri
                },
                (err) => {
                    throw err
                })
    }

    public async listModules(): Promise<string[]> {
        return sendXQuery(this._mlClient, listModulesQuery)
            .result(
                (fulfill: Record<string, any>[]) => {
                    return fulfill.map(o => {
                        return o.value
                    })
                },
                (err) => {
                    throw err
                })
    }

    public static encodeLocation(host: string, port: number, path: string): Uri {
        const newUri = Uri.parse(`${ModuleContentProvider.scheme}://${host}:${port}${path}`)
        return newUri
    }

}
