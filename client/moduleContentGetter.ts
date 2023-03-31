'use strict';

import { ClientContext, sendXQuery, MlClientParameters } from './marklogicClient';

export const listModulesQuery = 'cts:uris()';

export class ModuleContentGetter {
    private dbClientContext: ClientContext;

    public constructor(dbClientContext: ClientContext) {
        const moduleGetterParams: MlClientParameters = dbClientContext.params;
        moduleGetterParams.contentDb = moduleGetterParams.modulesDb;
        this.dbClientContext = new ClientContext(moduleGetterParams);
    }

    public host(): string {
        return this.dbClientContext.params.host;
    }

    public port(): number {
        return this.dbClientContext.params.port;
    }

    public initialize(dbClientContext: ClientContext): void {
        this.dbClientContext = dbClientContext;
    }

    public async provideTextDocumentContent(modulePath: string): Promise<string> {
        return this.dbClientContext.databaseClient.read(modulePath)
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
        return sendXQuery(this.dbClientContext, listModulesQuery)
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
