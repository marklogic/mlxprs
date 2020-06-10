'use strict'

import { MarklogicClient, sendXQuery, MlClientParameters } from './marklogicClient'

export const listModulesQuery = 'cts:uris()'

export class ModuleContentGetter {
    private _cache = new Map<string, string>()
    private _mlClient: MarklogicClient

    public constructor(client: MarklogicClient) {
        const moduleGetterParams: MlClientParameters = client.params
        moduleGetterParams.contentDb = moduleGetterParams.modulesDb
        this._mlClient = new MarklogicClient(moduleGetterParams)
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
        return this._mlClient.mldbClient.read(modulePath)
            .result(
                (fulfill: string[]) => {
                    const moduleContent: string = fulfill[0]
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
