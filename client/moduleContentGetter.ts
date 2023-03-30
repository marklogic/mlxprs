'use strict';

import { ClientContext, sendXQuery, MlClientParameters } from './marklogicClient';

export const listModulesQuery = 'cts:uris()';

export class ModuleContentGetter {
    private _mlClient: ClientContext;

    public constructor(client: ClientContext) {
        const moduleGetterParams: MlClientParameters = client.params;
        moduleGetterParams.contentDb = moduleGetterParams.modulesDb;
        this._mlClient = new ClientContext(moduleGetterParams);
    }

    public host(): string {
        return this._mlClient.params.host;
    }

    public port(): number {
        return this._mlClient.params.port;
    }

    public initialize(client: ClientContext): void {
        this._mlClient = client;
    }

    public async provideTextDocumentContent(modulePath: string): Promise<string> {
        return this._mlClient.databaseClient.read(modulePath)
            .result(
                (fulfill: string[]) => {
                    const moduleContent: string = fulfill[0];
                    return moduleContent;
                },
                (err) => {
                    throw err;
                });
    }

    public async listModules(): Promise<string[]> {
        return sendXQuery(this._mlClient, listModulesQuery)
            .result(
                (fulfill: Record<string, any>[]) => {
                    return fulfill.map(o => {
                        return o.value;
                    });
                },
                (err) => {
                    throw err;
                });
    }



}
