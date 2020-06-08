'use strict'

import { MarklogicClient, sendXQuery } from './marklogicClient'

export const listModulesQuery = `
        xdmp:invoke-function(
            function() {cts:uris()},
            <options xmlns='xdmp:eval'>
                <database>{xdmp:modules-database()}</database>
            </options>)`

export const moduleQuery = (modulePath: string): string => {
    return `
        xdmp:invoke-function(
            function() {fn:doc('${modulePath}')},
            <options xmlns='xdmp:eval'>
                <database>{xdmp:modules-database()}</database>
            </options>)`
}

export function decodeBinaryText(arr: Uint8Array): string {
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


export class ModuleContentGetter {
    private _cache = new Map<string, string>()
    private _mlClient: MarklogicClient

    public constructor(client: MarklogicClient) {
        this._mlClient = client
    }

    public host(): string {
        return this._mlClient.params.host
    }

    public port(): number {
        return this._mlClient.params.port
    }

    public initialize(client: MarklogicClient): void {
        this._mlClient = client
    }

    async provideTextDocumentContent(modulePath: string): Promise<string> {
        if (!this._cache.get(modulePath)) {
            await this.cacheModule(modulePath)
        }
        return this._cache.get(modulePath)
    }


    public async cacheModule(modulePath: string): Promise<string> {
        return sendXQuery(this._mlClient, moduleQuery(modulePath))
            .result(
                (fulfill: Record<string, any>[]) => {
                    const moduleBinaryContent: Uint8Array = fulfill[0].value
                    const moduleContent: string = decodeBinaryText(moduleBinaryContent)
                    this._cache.set(modulePath, moduleContent)
                    return modulePath
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



}
