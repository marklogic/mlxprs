'use strict'

import { DocumentDescriptor } from 'marklogic'
import { MarklogicClient, sendXQuery, MlClientParameters } from './marklogicClient'

export const listModulesQuery = 'cts:uris()'

export class ModuleContentHandler {
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

    public async readTextDocumentContent(modulePath: string): Promise<string> {
        return this._mlClient.mldbClient.read(modulePath)
            .result(
                (fulfill: string[]) => {
                    const moduleContent: string = fulfill[0]
                    return moduleContent
                },
                (err) => {
                    throw err
                })
    }

    public async writeTextDocumentContent(
        modulePath: string, moduleContent: string, collection: string): Promise<string[]> {
        const docObject: Record<string, unknown> = {}; docObject[modulePath] = moduleContent
        return this._mlClient.mldbClient.writeCollection(collection, docObject)
            .result(
                (fulfill: string[]) => {
                    return fulfill
                },
                (err) => { throw err }
            )
    }

    public async deleteModuleCollection(collection: string): Promise<string> {
        return this._mlClient.mldbClient.removeCollection(collection)
            .result(
                (fulfill: string) => {
                    return fulfill
                },
                (err) => { throw err }
            )
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
